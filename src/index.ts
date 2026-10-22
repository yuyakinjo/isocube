import { defaultGlyphs, parseGlyphConfig } from './glyphs.js';
import type { Glyph, GlyphConfig } from './glyphs.js';

export {
  getDefaultGlyphs,
  parseGlyphConfig,
  serializeGlyphConfig,
} from './glyphs.js';
export type { Glyph, GlyphConfig } from './glyphs.js';

export interface LogoOptions {
  text: string;
  /** 文字ごとの幅・輪郭・切れ込み。省略時は標準設定。 */
  glyphs?: GlyphConfig;
  /** 改行を含む入力全体を逆順にしてから breakAt を適用する。 */
  reverse?: boolean;
  /** 改行を入れる文字数の累積位置。例: [4] → DECO / PIN */
  breakAt?: number[];
  /** #RGB / #RRGGBB / rgb(r,g,b)。足りない場合は先頭から繰り返す。 */
  colors?: string[];
}

function colorValue(color: string): string {
  const value = color.trim();
  if (/^#[\da-f]{6}$/i.test(value)) return value.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(value)) {
    return `#${Array.from(value.slice(1), (digit) => digit.repeat(2)).join('')}`.toUpperCase();
  }
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(
    value
  );
  if (rgb !== null && rgb.slice(1).every((channel) => Number(channel) <= 255)) {
    return `#${rgb
      .slice(1)
      .map((channel) => Number(channel).toString(16).padStart(2, '0'))
      .join('')}`.toUpperCase();
  }
  throw new Error(`Invalid color: ${color}. Use #RGB, #RRGGBB, or rgb(0,0,0).`);
}

function randomColor(): string {
  return `#${[...crypto.getRandomValues(new Uint8Array(3))].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function generateLogo(options: LogoOptions): {
  svg: string;
  lines: string[];
  colors: string[];
} {
  // Unicode の大文字展開 (ß → SS など) を暗黙に受け入れない。
  if (!/^[a-z0-9 \n]+$/i.test(options.text) || options.text.length > 256) {
    throw new Error(
      'Enter 1–256 ASCII letters, digits, spaces, or line breaks.'
    );
  }
  const uppercase = options.text.toUpperCase();
  const text = options.reverse ? [...uppercase].reverse().join('') : uppercase;
  const breaks = options.breakAt ?? [];
  if (text.includes('\n') && breaks.length > 0) {
    throw new Error(
      'Line breaks in the text cannot be combined with --break-at.'
    );
  }
  let previous = 0;
  for (const position of breaks) {
    if (
      !Number.isSafeInteger(position) ||
      position <= previous ||
      position >= text.length
    ) {
      throw new Error(
        'Line break positions must be positive integers in ascending order, each less than the text length.'
      );
    }
    previous = position;
  }
  const lines =
    breaks.length === 0
      ? text.split('\n')
      : [...breaks, text.length].map((end, index) =>
          text.slice(breaks[index - 1] ?? 0, end)
        );
  if (lines.some((line) => line.length === 0))
    throw new Error('Empty lines are not allowed.');
  const palette = options.colors?.map(colorValue);
  if (palette?.length === 0) throw new Error('Specify at least one color.');
  const count = lines.join('').length;
  const colors = Array.from({ length: count }, (_, index) =>
    palette === undefined ? randomColor() : palette[index % palette.length]!
  );
  const glyphs =
    options.glyphs === undefined
      ? defaultGlyphs
      : parseGlyphConfig(options.glyphs);
  const glyph = (letter: string): Glyph => glyphs[letter]!;
  const widths = lines.map((line) =>
    [...line].reduce((sum, letter) => sum + (glyph(letter).width ?? 100), 0)
  );
  const margin = 12,
    depth = 40,
    height = 140,
    stroke = 5;
  const width = Math.max(...widths) + depth + margin * 2;
  const totalHeight = lines.length * height + depth + margin * 2;
  const faces: string[] = [];
  const sides: string[] = [];
  let colorIndex = 0;
  for (const [row, line] of lines.entries()) {
    const rowSides: string[] = [];
    let x = margin;
    const y = margin + depth + row * height;
    for (const [column, letter] of [...line].entries()) {
      const spec = glyph(letter);
      const w = spec.width ?? 100;
      const color = colors[colorIndex++]!;
      if (letter === ' ') {
        x += w;
        continue;
      }
      // 正面と押し出しに同じ輪郭を使い、切り欠きの内側にも面を付ける。
      // D の斜めの右端に次のブロックをかみ合わせる。
      const outline =
        spec.outline ??
        (line[column - 1] === 'D'
          ? ([
              [-18, 0],
              [w, 0],
              [w, height],
              [-18, height],
              [0, 115],
              [0, 25],
            ] as const)
          : ([
              [0, 0],
              [w, 0],
              [w, height],
              [0, height],
            ] as const));
      const glyphSides: string[] = [];
      for (const [index, start] of outline.entries()) {
        const end = outline[(index + 1) % outline.length]!;
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        if (dx + dy <= 0) continue;
        const ax = x + start[0],
          ay = y + start[1];
        const bx = x + end[0],
          by = y + end[1];
        glyphSides.push(
          `<path fill="${color}" d="M${ax} ${ay}L${ax + depth} ${ay - depth}L${bx + depth} ${by - depth}L${bx} ${by}Z"/>`
        );
      }
      // 下の行から、行内では左から描き、手前の面で隠れる部分を覆う。
      // 行幅や列位置で省略しないことで、隣の切り欠きから見える面も残す。
      rowSides.push(...glyphSides);
      const face = `M${outline.map(([px, py]) => `${px} ${py}`).join('L')}Z`;
      faces.push(
        `<g transform="translate(${x} ${y})" data-letter="${letter}"><path fill="${color}" d="${face}"/>${spec.marks === undefined ? '' : `<path fill="none" stroke-width="6" d="${spec.marks}"/>`}</g>`
      );
      x += w;
    }
    sides.unshift(...rowSides);
  }
  const label = lines.join(' / ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" role="img" aria-labelledby="title"><title id="title">${label}</title><g stroke="#000000" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round">${sides.join('')}${faces.join('')}</g></svg>\n`;
  return { svg, lines, colors };
}
