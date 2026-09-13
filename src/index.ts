interface Glyph {
  width?: number;
  marks?: string;
  outline?: readonly (readonly [number, number])[];
}

// 100×140 の正面。黒い切れ込みと輪郭で文字を描く。
const GLYPHS: Record<string, Glyph> = {
  A: { marks: 'M50 35V65 M50 100V140' },
  B: { marks: 'M50 30V50 M50 90V110 M80 70H100' },
  C: { marks: 'M55 70H100' },
  D: {
    outline: [
      [0, 0],
      [82, 0],
      [100, 25],
      [100, 115],
      [82, 140],
      [0, 140],
    ],
    marks: 'M50 42V98',
  },
  E: { marks: 'M55 45H100 M55 95H100' },
  F: {
    outline: [
      [0, 0],
      [100, 0],
      [100, 90],
      [55, 90],
      [55, 140],
      [0, 140],
    ],
    marks: 'M55 45H100',
  },
  G: { marks: 'M100 45H50V95H75' },
  H: { marks: 'M50 0V45 M50 95V140' },
  I: { width: 70 },
  J: {
    outline: [
      [55, 0],
      [100, 0],
      [100, 115],
      [75, 140],
      [25, 140],
      [0, 115],
      [0, 85],
      [40, 85],
      [40, 100],
      [55, 100],
    ],
  },
  K: {
    outline: [
      [0, 0],
      [100, 0],
      [65, 70],
      [100, 140],
      [0, 140],
    ],
    marks: 'M45 0V35 M45 105V140',
  },
  L: {
    outline: [
      [0, 0],
      [55, 0],
      [55, 100],
      [100, 100],
      [100, 140],
      [0, 140],
    ],
  },
  M: {
    width: 120,
    outline: [
      [15, 0],
      [45, 0],
      [60, 85],
      [75, 0],
      [105, 0],
      [120, 140],
      [0, 140],
    ],
    marks: 'M30 140V97.5 M90 140V97.5',
  },
  N: { marks: 'M48 0L56 42 M40 98L48 140' },
  O: { marks: 'M50 42V98' },
  P: {
    outline: [
      [0, 0],
      [100, 0],
      [100, 90],
      [50, 90],
      [50, 140],
      [0, 140],
    ],
    marks: 'M42 42H62',
  },
  Q: { marks: 'M50 35V80 M65 105L100 140' },
  R: { marks: 'M42 42H62 M50 95L75 140 M80 75H100' },
  S: { marks: 'M40 45H100 M0 95H60' },
  T: {
    outline: [
      [0, 0],
      [100, 0],
      [100, 40],
      [70, 40],
      [70, 140],
      [30, 140],
      [30, 40],
      [0, 40],
    ],
  },
  U: { marks: 'M50 0V95' },
  V: {
    outline: [
      [0, 0],
      [100, 0],
      [75, 140],
      [25, 140],
    ],
    marks: 'M50 0V42.5',
  },
  W: {
    width: 120,
    outline: [
      [0, 0],
      [120, 0],
      [105, 140],
      [75, 140],
      [60, 100],
      [45, 140],
      [15, 140],
    ],
    marks: 'M30 0V42.5 M90 0V42.5',
  },
  X: {
    outline: [
      [0, 0],
      [100, 0],
      [70, 70],
      [100, 140],
      [0, 140],
      [30, 70],
    ],
  },
  Y: {
    outline: [
      [0, 0],
      [100, 0],
      [100, 60],
      [70, 85],
      [70, 140],
      [30, 140],
      [30, 85],
      [0, 60],
    ],
    marks: 'M50 0V45',
  },
  Z: { marks: 'M0 45H60L40 95H100' },
  '0': { marks: 'M50 35V105 M35 85L65 55' },
  '1': {
    width: 70,
    outline: [
      [0, 25],
      [30, 0],
      [70, 0],
      [70, 140],
      [20, 140],
      [20, 45],
      [0, 45],
    ],
  },
  '2': { marks: 'M0 45H55V70 M45 95H100' },
  '3': { marks: 'M0 45H55 M0 95H55' },
  '4': { marks: 'M50 0V50 M0 100H50V140' },
  '5': { marks: 'M45 45H100 M0 95H55' },
  '6': { marks: 'M55 40H100 M50 90V110' },
  '7': {
    outline: [
      [0, 0],
      [100, 0],
      [100, 45],
      [65, 140],
      [15, 140],
      [50, 45],
      [0, 45],
    ],
  },
  '8': { marks: 'M50 30V50 M50 90V110' },
  '9': { marks: 'M50 30V50 M0 100H50' },
};

export interface LogoOptions {
  text: string;
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
  if (!/^[a-z0-9\n]+$/i.test(options.text) || options.text.length > 256) {
    throw new Error('Enter 1–256 ASCII letters, digits, or line breaks.');
  }
  const text = options.text.toUpperCase();
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
  const glyph = (letter: string): Glyph => GLYPHS[letter]!;
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
