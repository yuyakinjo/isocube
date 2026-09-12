import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { generateLogo } from '../dist/index.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const run = (...args) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

describe('generator', () => {
  it('wraps at cumulative offsets and cycles normalized RGB colors across rows', () => {
    const options = { colors: ['#2d00f7', 'rgb(229,0,164)', '#fb0'] };
    const result = generateLogo({ ...options, text: 'decopin', breakAt: [4] });
    assert.deepEqual(result, generateLogo({ ...options, text: 'DECO\nPIN' }));
    assert.deepEqual(result.lines, ['DECO', 'PIN']);
    assert.deepEqual(result.colors, [
      '#2D00F7',
      '#E500A4',
      '#FFBB00',
      '#2D00F7',
      '#E500A4',
      '#FFBB00',
      '#2D00F7',
    ]);
    assert.deepEqual(
      generateLogo({ text: 'ABCDEFGHI', breakAt: [3, 6] }).lines,
      ['ABC', 'DEF', 'GHI']
    );
  });
  it('reproduces random output when the returned colors are reused', () => {
    const first = generateLogo({ text: 'DECOPIN' });
    assert.equal(first.colors.length, 7);
    for (const color of first.colors) assert.match(color, /^#[0-9A-F]{6}$/);
    assert.equal(
      generateLogo({ text: 'DECOPIN', colors: first.colors }).svg,
      first.svg
    );
  });
  it('rejects invalid text, wraps, and colors', () => {
    for (const text of [
      '',
      '日本語',
      '<svg>',
      'A B',
      'ß',
      '\nA',
      'A\n',
      'A\n\nB',
      'A'.repeat(257),
    ]) {
      assert.throws(() => generateLogo({ text }));
    }
    for (const breakAt of [[0], [7], [-1], [1.5], [4, 3], [3, 3], [NaN]]) {
      assert.throws(() => generateLogo({ text: 'DECOPIN', breakAt }));
    }
    assert.throws(() => generateLogo({ text: 'A\nB', breakAt: [1] }));
    for (const colors of [
      [],
      ['red'],
      ['#ffff'],
      ['rgb(256,0,0)'],
      ['rgb(-1,0,0)'],
    ]) {
      assert.throws(() => generateLogo({ text: 'A', colors }));
    }
  });
  it('draws every advertised glyph and leaves I without a central line', () => {
    const { svg } = generateLogo({
      text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    });
    assert.equal(svg.match(/data-letter=/g).length, 36);
    assert.ok(!svg.includes('undefined'));
    const i = /data-letter="I">(.*?)<\/g>/.exec(svg)[1];
    assert.equal(i.match(/<path/g).length, 1);
  });
});

describe('CLI', () => {
  it('shows help without requiring text or creating files', () => {
    const result = run('--help');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /block-string-logo --text/);
  });
  it('writes an SVG, rejects overwrite, and supports --force', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'block-string-logo-test-'));
    try {
      const output = join(dir, 'nested', 'logo.svg');
      const args = [
        '--text',
        'DECOPIN',
        '--break-at',
        '4',
        '--colors',
        'rgb(45,0,247),#fb0',
        '--out',
        output,
      ];
      const result = run(...args);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /DECO \/ PIN/);
      const before = await readFile(output, 'utf8');
      assert.match(before, /#2D00F7/);
      assert.match(before, /#FFBB00/);
      assert.equal(run(...args).status, 1);
      assert.equal(await readFile(output, 'utf8'), before);
      assert.equal(run(...args, '--force').status, 0);
      assert.equal(await readFile(output, 'utf8'), before);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('fails invalid CLI arguments without succeeding silently', () => {
    for (const args of [
      [],
      ['--unknown'],
      ['--text', 'A', '--out', 'a.png'],
      ['--text', 'ABC', '--break-at', '1,'],
      ['--text', 'ABC', '--colors', ''],
    ]) {
      assert.equal(run(...args).status, 1);
    }
  });
});
