import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { generateLogo } from '../dist/index.js';

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const run = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

describe('generator', () => {
  // Sample filled polygons in SVG paint order, away from stroked boundaries.
  const fillAt = (svg: string, x: number, y: number): string | undefined => {
    const offsets: [number, number][] = [[0, 0]];
    let fill: string | undefined;
    for (const [element] of svg.matchAll(/<g\b[^>]*>|<\/g>|<path\b[^>]*>/g)) {
      const [offsetX, offsetY] = offsets.at(-1)!;
      if (element.startsWith('<g')) {
        const translation = /transform="translate\(([-\d.]+) ([-\d.]+)\)"/.exec(
          element
        );
        offsets.push([
          offsetX + Number(translation?.[1] ?? 0),
          offsetY + Number(translation?.[2] ?? 0),
        ]);
        continue;
      }
      if (element === '</g>') {
        offsets.pop();
        continue;
      }
      const color = /\sfill="(#[A-F\d]+)"/i.exec(element)?.[1];
      if (color === undefined) continue;
      const path = /\sd="([^"]+)"/.exec(element)?.[1];
      assert.ok(path);
      assert.match(path, /^[MLZ\d.\s,-]+$/);
      let winding = 0;
      for (const [contour] of path.matchAll(/M[^M]+/g)) {
        const values = contour.match(/-?\d+(?:\.\d+)?/g);
        assert.ok(values);
        const coordinates = values.map(Number);
        const points: [number, number][] = [];
        for (let i = 0; i < coordinates.length; i += 2) {
          points.push([
            coordinates[i]! + offsetX,
            coordinates[i + 1]! + offsetY,
          ]);
        }
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [ax, ay] = points[i]!,
            [bx, by] = points[j]!;
          const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
          if (ay <= y && by > y && cross > 0) winding++;
          if (ay > y && by <= y && cross < 0) winding--;
        }
      }
      const inside = element.includes('fill-rule="evenodd"')
        ? Math.abs(winding) % 2 === 1
        : winding !== 0;
      if (inside) fill = color;
    }
    return fill;
  };
  const faceFor = (svg: string, letter: string): string => {
    const face = new RegExp(`data-letter="${letter}">(.*?)</g>`).exec(svg)?.[1];
    assert.ok(face);
    return face;
  };
  const contoursFor = (face: string): number =>
    /\sd="([^"]+)"/.exec(face)![1]!.match(/M/g)!.length;
  const faceBounds = (face: string): [number, number] => {
    const coordinates = /\sd="([^"]+)"/
      .exec(face)![1]!
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    const xs = coordinates.filter((_, index) => index % 2 === 0);
    const ys = coordinates.filter((_, index) => index % 2 === 1);
    return [
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ];
  };
  it('keeps lower-row caps visible beyond the row above and hides covered portions', () => {
    const svg = (text: string) =>
      generateLogo({ text, colors: ['#FF0000', '#00FF00', '#0000FF'] }).svg;
    assert.equal(fillAt(svg('A\nAB'), 150, 180), '#0000FF');
    assert.equal(fillAt(svg('I\nA'), 110, 180), '#00FF00');
    assert.equal(fillAt(svg('A\nA'), 70, 180), '#FF0000');
    assert.equal(fillAt(svg('A\nA'), 118, 180), '#FF0000');
    assert.equal(fillAt(svg('A\nA'), 140, 180), '#00FF00');
    assert.equal(fillAt(svg('AAA\nI\nA'), 110, 320), '#00FF00');
    assert.equal(fillAt(svg('I\nW'), 110, 180), '#00FF00');
    assert.equal(fillAt(svg('I\nL'), 90, 280), '#00FF00');
  });
  it('fills exposed sides and notch tops in ST / LO with the owning letter color', () => {
    const { svg } = generateLogo({
      text: 'ST\nLO',
      colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'],
    });
    assert.equal(fillAt(svg, 125, 120), '#FF0000'); // S side beside T
    assert.equal(fillAt(svg, 195, 120), '#00FF00'); // T stem side
    assert.equal(fillAt(svg, 90, 280), '#0000FF'); // L notch top
    assert.equal(fillAt(svg, 128, 182), '#FFFF00'); // O cap beneath T's left gap
    assert.equal(fillAt(svg, 210, 182), '#FFFF00'); // O cap beneath T's right gap
    assert.equal(fillAt(svg, 160, 182), '#00FF00'); // cap hidden by T
    assert.equal(fillAt(svg, 230, 120), undefined); // outside T's actual shape
    const adjacent = generateLogo({
      text: 'TL',
      colors: ['#00FF00', '#0000FF'],
    }).svg;
    assert.equal(fillAt(adjacent, 95, 120), '#00FF00');
    assert.equal(fillAt(adjacent, 190, 140), '#0000FF');
  });
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
  it('reverses the input before wrapping and assigning colors', () => {
    const colors = ['#f00', '#0f0', '#00f'];
    for (const [text, breakAt, expected] of [
      ['hello12', undefined, '21OLLEH'],
      ['decopin', [4], 'NIPO\nCED'],
      ['ab\nc12', undefined, '21C\nBA'],
      ['a', undefined, 'A'],
    ] as const) {
      assert.deepEqual(
        generateLogo({
          text,
          reverse: true,
          breakAt: breakAt === undefined ? undefined : [...breakAt],
          colors,
        }),
        generateLogo({ text: expected, colors })
      );
    }
    assert.deepEqual(
      generateLogo({ text: 'hello12', reverse: false, colors }),
      generateLogo({ text: 'hello12', colors })
    );
    assert.throws(() =>
      generateLogo({ text: 'A\nB', reverse: true, breakAt: [1] })
    );
    assert.throws(() => generateLogo({ text: 'ß', reverse: true }));
  });
  it('draws both kana alphabets and distinguishes voiced and small forms', () => {
    const basic =
      'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const additional =
      'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゔガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴヷヺぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶー';
    const text = basic + additional;
    const { svg, colors } = generateLogo({ text, colors: ['#123456'] });
    assert.equal(basic.length, 92);
    assert.equal(svg.match(/data-letter=/g)?.length, text.length);
    assert.equal(colors.length, text.length);
    assert.ok(!svg.includes('undefined'));
    assert.ok(!svg.includes('<text'));
    const faces = [...text].map((letter) => faceFor(svg, letter));
    const paths = faces.map((face) => /\sd="([^"]+)"/.exec(face)?.[1]);
    for (const [index, face] of faces.entries()) {
      const letter = text[index]!;
      const hasInsetMarks =
        /^[ァ-ヺ]$/.test(letter) &&
        !'スノフメ'.includes(letter.normalize('NFD')[0]!);
      assert.equal(face.match(/<path/g)?.length, hasInsetMarks ? 2 : 1);
      assert.match(face, /fill="#123456"/);
      assert.match(face, /fill-rule="evenodd"/);
      assert.match(paths[index]!, /^[MLZ\d.\s,-]+Z$/);
      if (hasInsetMarks) {
        assert.match(face, /fill="none" stroke-width="6"/);
        continue;
      }
      assert.doesNotMatch(face, /fill="none"|stroke-width="6"/);
      const hasGap = Array.from({ length: 42 }, (_, sample) =>
        fillAt(face, 10 + (sample % 6) * 20, 10 + Math.floor(sample / 6) * 20)
      ).some((color) => color === undefined);
      assert.ok(
        hasGap,
        `${text[index]} must not have a rectangular backing face`
      );
    }
    assert.equal(new Set(paths.slice(0, 46)).size, 46);
    // Block-style kana share a rectangular face and differ in their inset marks.
    assert.equal(new Set(faces.slice(46, 92)).size, 46);
    for (const [base, voiced, semivoiced] of [
      ['は', 'ば', 'ぱ'],
      ['ハ', 'バ', 'パ'],
    ]) {
      assert.ok(
        contoursFor(faceFor(svg, voiced!)) > contoursFor(faceFor(svg, base!))
      );
      assert.ok(
        contoursFor(faceFor(svg, semivoiced!)) >
          contoursFor(faceFor(svg, base!))
      );
      assert.notEqual(faceFor(svg, voiced!), faceFor(svg, semivoiced!));
    }
    for (const [small, full] of [
      ['ぁ', 'あ'],
      ['ァ', 'ア'],
      ['っ', 'つ'],
      ['ッ', 'ツ'],
      ['ェ', 'エ'],
      ['ュ', 'ユ'],
      ['ョ', 'ヨ'],
    ]) {
      const smallBounds = faceBounds(faceFor(svg, small!));
      const fullBounds = faceBounds(faceFor(svg, full!));
      assert.ok(smallBounds[0] < fullBounds[0] * 0.8);
      assert.ok(smallBounds[1] < fullBounds[1] * 0.8);
    }
  });
  it('leaves space between kana strokes and cuts counters out of their colored faces', () => {
    const color = '#123456';
    const ko = generateLogo({ text: 'こ', colors: [color] }).svg;
    const a = generateLogo({ text: 'あ', colors: [color] }).svg;
    assert.equal(fillAt(faceFor(ko, 'こ'), 90, 20), color);
    assert.equal(fillAt(faceFor(ko, 'こ'), 90, 80), undefined);
    assert.equal(fillAt(faceFor(ko, 'こ'), 90, 120), color);
    assert.equal(fillAt(faceFor(a, 'あ'), 78, 94), undefined);
    assert.equal(fillAt(faceFor(a, 'あ'), 15, 100), color);
    assert.ok(contoursFor(faceFor(a, 'あ')) >= 2);
  });
  it('keeps katakana inset marks within their owning faces', () => {
    const letters =
      'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const color = '#123456';
    const { svg } = generateLogo({ text: letters, colors: [color] });
    for (const letter of letters) {
      const face = faceFor(svg, letter);
      const marks = /fill="none" stroke-width="6" d="([^"]+)"/.exec(face)?.[1];
      if (!marks) continue;
      for (const [line] of marks.matchAll(/M[^M]+/g)) {
        const points = [...line.matchAll(/([\d.]+),([\d.]+)/g)].map(
          ([, x, y]) => [Number(x), Number(y)] as const
        );
        for (let i = 1; i < points.length; i++) {
          const [ax, ay] = points[i - 1]!;
          const [bx, by] = points[i]!;
          for (let step = 0; step <= 10; step++) {
            const x = ax + ((bx - ax) * step) / 10;
            const y = ay + ((by - ay) * step) / 10;
            // Boundary marks may sit exactly on the silhouette edge.
            assert.ok(
              [-0.1, 0, 0.1].some((dx) =>
                [-0.1, 0, 0.1].some(
                  (dy) => fillAt(face, x + dx, y + dy) === color
                )
              ),
              `${letter}: inset mark leaves its face at ${x},${y}`
            );
          }
        }
      }
    }
  });
  it('normalizes kana accents before counting, reversing, and wrapping mixed text', () => {
    const colors = ['#f00', '#0f0'];
    assert.deepEqual(
      generateLogo({
        text: 'か\u3099は\u309aヴa1',
        reverse: true,
        breakAt: [3],
        colors,
      }),
      generateLogo({ text: '1Aヴ\nぱが', colors })
    );
    assert.deepEqual(
      generateLogo({ text: 'が'.repeat(256).normalize('NFD'), colors }).lines,
      ['が'.repeat(256)]
    );
    assert.throws(() => generateLogo({ text: 'あ'.repeat(257) }));
    for (const text of [
      'あ\u309a',
      '\u3099',
      'ｶﾀｶﾅ',
      '漢字',
      'あ。',
      'ゐ',
      'ヿ',
      'K',
      'ſ',
    ]) {
      assert.throws(() => generateLogo({ text }));
    }
    assert.throws(() => generateLogo({ text: 'か\u3099', breakAt: [1] }));
    assert.throws(() => generateLogo({ text: 'かな\nカナ', breakAt: [2] }));
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
    assert.equal(svg.match(/data-letter=/g)?.length, 36);
    assert.ok(!svg.includes('undefined'));
    const i = /data-letter="I">(.*?)<\/g>/.exec(svg)?.[1];
    assert.ok(i);
    assert.equal(i.match(/<path/g)?.length, 1);
  });
});

describe('CLI', () => {
  it('shows help without requiring text or creating files', () => {
    const result = run('--help');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /isocube --text/);
    assert.match(result.stdout, /--reverse/);
  });
  it('writes reversed text with --reverse and applies break positions afterward', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'isocube-test-'));
    try {
      const output = join(dir, 'logo.svg');
      const result = run(
        '--text',
        'decopin',
        '--reverse',
        '--break-at',
        '4',
        '--colors',
        '#f00,#0f0',
        '--out',
        output
      );
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /NIPO \/ CED/);
      assert.equal(
        await readFile(output, 'utf8'),
        generateLogo({ text: 'NIPO\nCED', colors: ['#f00', '#0f0'] }).svg
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('writes an SVG, overwrites by default, and accepts --force for compatibility', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'isocube-test-'));
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
      const replacement = run(
        '--text',
        'A',
        '--colors',
        '#123456',
        '--out',
        output
      );
      assert.equal(replacement.status, 0, replacement.stderr);
      assert.equal(
        await readFile(output, 'utf8'),
        generateLogo({ text: 'A', colors: ['#123456'] }).svg
      );
      assert.equal(run(...args, '--force').status, 0);
      assert.equal(await readFile(output, 'utf8'), before);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('writes mixed kana input through the CLI', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'isocube-kana-'));
    try {
      const output = join(dir, 'kana.svg');
      const text = 'ひらがなカタカナぱピょー';
      const result = run(
        '--text',
        text,
        '--break-at',
        '4,8',
        '--colors',
        '#f00',
        '--out',
        output
      );
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        await readFile(output, 'utf8'),
        generateLogo({ text, breakAt: [4, 8], colors: ['#f00'] }).svg
      );
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
