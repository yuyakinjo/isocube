import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const config = await readFile(new URL('../.oxlintrc.json', import.meta.url));
const oxlint = fileURLToPath(
  new URL('../node_modules/.bin/oxlint', import.meta.url)
);

async function lintSource(file: string, source: string) {
  const directory = await mkdtemp(join(tmpdir(), 'isocube-boundaries-'));
  try {
    const path = join(directory, file);
    const configPath = join(directory, '.oxlintrc.json');
    await mkdir(dirname(path), { recursive: true });
    await writeFile(configPath, config);
    await writeFile(path, source);
    const result = Bun.spawnSync([oxlint, '--config', configPath, path], {
      cwd: directory,
    });
    return {
      exitCode: result.exitCode,
      output: result.stdout.toString() + result.stderr.toString(),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('SVG dependency boundaries', () => {
  it('allows local source modules and approved CLI built-ins', async () => {
    for (const [file, source] of [
      [
        'src/index.ts',
        'import "./glyphs.js"; export type { Glyph } from "./glyphs.js";',
      ],
      [
        'src/cli.ts',
        'import "./index.js"; import "node:fs/promises"; import "node:path"; import "node:util";',
      ],
      ['src/geometry/paths.ts', 'export * from "./points.js";'],
    ] as const) {
      const result = await lintSource(file, source);
      assert.equal(result.exitCode, 0, result.output);
    }
  });

  it('rejects UI and tooling dependencies through all supported import forms', async () => {
    for (const source of [
      'import "../web/app.js";',
      'import "./../web/editor.js";',
      'import "../scripts/build-site.js";',
      'import "animejs";',
      'export type { Theme } from "../web/theme.js";',
      'import type { Theme } from "../web/theme.js"; export type { Theme };',
      'export * from "../web/editor.js";',
      'void import("../web/app.js");',
      'import "/tmp/web/app.js";',
      'import "node:http";',
    ]) {
      const result = await lintSource('src/cli.ts', source);
      assert.notEqual(result.exitCode, 0, source);
      assert.match(result.output, /no-restricted-imports/, source);
    }
  });

  it('checks generator helpers too and limits Node imports to the CLI', async () => {
    for (const [file, source] of [
      ['src/index.ts', 'import "node:fs/promises";'],
      ['src/geometry/paths.ts', 'import "animejs";'],
    ] as const) {
      const result = await lintSource(file, source);
      assert.notEqual(result.exitCode, 0, file);
      assert.match(result.output, /no-restricted-imports/);
    }
  });

  it('rejects CommonJS imports as an alternate entry point', async () => {
    const result = await lintSource('src/cli.ts', 'require("animejs");');
    assert.notEqual(result.exitCode, 0);
    assert.match(result.output, /no-require-imports/);
  });
});
