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
    let offsetX = 0,
      offsetY = 0;
    let fill: string | undefined;
    const elements =
      /<g transform="translate\(([-\d.]+) ([-\d.]+)\)"[^>]*>|<\/g>|<path fill="(#[A-F\d]+)" d="([^"]+)"/g;
    for (const match of svg.matchAll(elements)) {
      if (match[1] !== undefined) {
        offsetX = Number(match[1]);
        offsetY = Number(match[2]);
      } else if (match[0] === '</g>') {
        offsetX = offsetY = 0;
      } else {
        const path = match[4];
        assert.ok(path);
        const values = path.match(/-?\d+(?:\.\d+)?/g);
        assert.ok(values);
        const coordinates = values.map(Number);
        const points: [number, number][] = [];
        for (let i = 0; i < coordinates.length; i += 2) {
          points.push([
            coordinates[i]! + offsetX,
            coordinates[i + 1]! + offsetY,
          ]);
        }
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [ax, ay] = points[i]!,
            [bx, by] = points[j]!;
          if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
            inside = !inside;
        }
        if (inside) fill = match[3];
      }
    }
    return fill;
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
