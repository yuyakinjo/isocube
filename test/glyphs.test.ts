import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  generateLogo,
  getDefaultGlyphs,
  parseGlyphConfig,
  serializeGlyphConfig,
} from '../dist/index.js';
import { glyphRequest } from '../scripts/glyph-store.ts';

describe('glyph configuration', () => {
  it('round trips the source without unrelated formatting changes', async () => {
    const source = await readFile(
      new URL('../src/glyphs.json', import.meta.url),
      'utf8'
    );
    assert.equal(serializeGlyphConfig(getDefaultGlyphs()), source);
    assert.deepEqual(parseGlyphConfig(JSON.parse(source)), getDefaultGlyphs());
  });

  it('applies width, outline and marks to selected glyphs without changing defaults', () => {
    const defaults = getDefaultGlyphs();
    const original = generateLogo({ text: 'AI', colors: ['#f00'] });
    const draft = getDefaultGlyphs();
    draft.A!.width = 120;
    draft.A!.marks = 'M60 35V65 M60 100V140';
    draft.A!.outline = [
      [0, 0],
      [100, 0],
      [120, 140],
      [0, 140],
    ];
    const edited = generateLogo({
      text: 'AI',
      colors: ['#f00'],
      glyphs: draft,
    });
    assert.match(edited.svg, /viewBox="0 0 254 204"/);
    assert.match(edited.svg, /M0 0L100 0L120 140L0 140Z/);
    assert.match(edited.svg, /M60 35V65 M60 100V140/);
    assert.match(edited.svg, /translate\(132 52\)" data-letter="I"/);
    assert.deepEqual(getDefaultGlyphs(), defaults);
    assert.deepEqual(generateLogo({ text: 'AI', colors: ['#f00'] }), original);
    assert.deepEqual(
      generateLogo({ text: 'AI', colors: ['#f00'], glyphs: defaults }),
      original
    );
  });

  it('rejects incomplete data, unsafe SVG, and invalid geometry before rendering', () => {
    for (const glyph of [
      { width: 0 },
      { width: Infinity },
      { width: 241 },
      { marks: 'M50 35"/><script>alert(1)</script>' },
      { marks: 'M50 35V141' },
      { marks: 'M101 35V65' },
      { marks: 'M50 35H' },
      { marks: 'M50 NaNV65' },
      {
        outline: [
          [0, 0],
          [100, 0],
        ],
      },
      {
        outline: [
          [0, 0],
          [100, 0],
          [-1, 140],
        ],
      },
      {
        outline: [
          [0, 0],
          [100, 0],
          [100, 141],
        ],
      },
      { unknown: true },
    ]) {
      const draft = getDefaultGlyphs();
      const data = { ...draft, A: glyph };
      assert.throws(() => parseGlyphConfig(data), /Invalid glyph/);
    }
    const missing = getDefaultGlyphs();
    delete missing.A;
    for (const data of [null, [], missing, { ...getDefaultGlyphs(), '!': {} }])
      assert.throws(() => parseGlyphConfig(data), /Invalid glyph/);
  });
});

describe('local glyph saving', () => {
  it('returns fixed errors without exposing request contents or file paths', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'isocube-glyph-'));
    const file = pathToFileURL(join(dir, 'private-glyphs.json'));
    const baseline = serializeGlyphConfig(getDefaultGlyphs());
    const request = (body?: string) =>
      new Request('http://127.0.0.1:3333/__glyphs', {
        method: body === undefined ? 'GET' : 'PUT',
        headers: {
          origin: 'http://127.0.0.1:3333',
          'Content-Type': 'application/json',
        },
        body,
      });
    try {
      await writeFile(file, baseline);
      for (const body of ['private-input', 'null', '{"glyphs":{}}']) {
        const response = await glyphRequest(request(body), file);
        assert.equal(response.status, 400);
        assert.equal(
          await response.text(),
          '設定が不正です。JSONと文字の設定を確認してください。'
        );
        assert.equal(await readFile(file, 'utf8'), baseline);
      }
      const validBody = JSON.stringify({
        baseline,
        glyphs: getDefaultGlyphs(),
      });
      for (const contents of [undefined, 'private-file-contents']) {
        if (contents === undefined) await rm(file);
        else await writeFile(file, contents);
        for (const body of [undefined, validBody]) {
          const response = await glyphRequest(request(body), file);
          assert.equal(response.status, 500);
          assert.equal(
            await response.text(),
            '設定ファイルの読み込みまたは保存に失敗しました。'
          );
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('saves valid changes and refuses stale, invalid, or cross-origin writes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'isocube-glyph-'));
    const file = pathToFileURL(join(dir, 'glyphs.json'));
    const baseline = serializeGlyphConfig(getDefaultGlyphs());
    const glyphs = getDefaultGlyphs();
    glyphs.A!.marks = 'M50 30V65 M50 100V140';
    const put = (body: unknown, origin = 'http://127.0.0.1:3333') =>
      glyphRequest(
        new Request('http://127.0.0.1:3333/__glyphs', {
          method: 'PUT',
          headers: { origin, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        file
      );
    try {
      await writeFile(file, baseline);
      const get = await glyphRequest(
        new Request('http://127.0.0.1:3333/__glyphs'),
        file
      );
      assert.deepEqual(await get.json(), getDefaultGlyphs());
      assert.equal(
        (await put({ baseline, glyphs }, 'https://example.com')).status,
        403
      );
      assert.equal((await put({ baseline, glyphs: {} })).status, 400);
      assert.equal(await readFile(file, 'utf8'), baseline);
      assert.equal((await put({ baseline, glyphs })).status, 200);
      assert.equal(await readFile(file, 'utf8'), serializeGlyphConfig(glyphs));
      assert.equal(
        (await put({ baseline, glyphs: getDefaultGlyphs() })).status,
        409
      );
      assert.equal(await readFile(file, 'utf8'), serializeGlyphConfig(glyphs));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
