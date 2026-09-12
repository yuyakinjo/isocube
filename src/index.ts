import { randomBytes } from 'node:crypto';

interface Glyph {
  width?: number;
  face?: string;
  marks?: string;
}

// 100×140 の正面。黒い切れ込みと輪郭で文字を描く。
const GLYPHS: Record<string, Glyph> = {
  A: { marks: 'M50 35V65 M50 100V140' },
  B: { marks: 'M50 30V50 M50 90V110 M80 70H100' },
  C: { marks: 'M55 70H100' },
  D: {
    face: 'M0 0H82L100 25V115L82 140H0Z',
    marks: 'M50 42V98',
  },
  E: { marks: 'M55 45H100 M55 95H100' },
  F: { face: 'M0 0H100V90H55V140H0Z', marks: 'M55 45H100' },
  G: { marks: 'M55 45H100 M55 95H75V70H100' },
  H: { marks: 'M50 0V45 M50 95V140' },
  I: { width: 70 },
  J: { marks: 'M45 0V95H25' },
  K: {
    face: 'M0 0H100L65 70L100 140H0Z',
    marks: 'M45 0V35 M45 105V140',
  },
  L: { face: 'M0 0H55V100H100V140H0Z' },
  M: { width: 120, marks: 'M40 140V50L60 75L80 50V140' },
  N: { marks: 'M48 0L56 42 M40 98L48 140' },
  O: { marks: 'M50 42V98' },
  P: { face: 'M0 0H100V90H50V140H0Z', marks: 'M42 42H62' },
  Q: { marks: 'M50 35V80 M65 105L100 140' },
  R: { marks: 'M42 42H62 M50 95L75 140 M80 75H100' },
  S: { marks: 'M0 45H60 M40 95H100' },
  T: { face: 'M0 0H100V40H70V140H30V40H0Z' },
  U: { marks: 'M50 0V95' },
  V: { face: 'M0 0H100L75 140H25Z', marks: 'M50 0V85' },
  W: { width: 120, marks: 'M40 0V90L60 65L80 90V0' },
  X: { face: 'M0 0H100L70 70L100 140H0L30 70Z' },
  Y: { face: 'M0 0H100V60L70 85V140H30V85L0 60Z', marks: 'M50 0V45' },
  Z: { marks: 'M0 45H60L40 95H100' },
  '0': { marks: 'M50 35V105 M35 85L65 55' },
  '1': { width: 70, face: 'M0 25L30 0H70V140H20V45H0Z' },
  '2': { marks: 'M0 45H55V70 M45 95H100' },
  '3': { marks: 'M0 45H55 M0 95H55' },
  '4': { marks: 'M50 0V50 M0 100H50V140' },
  '5': { marks: 'M45 45H100 M0 95H55' },
  '6': { marks: 'M55 40H100 M50 90V110' },
  '7': { face: 'M0 0H100V45L65 140H15L50 45H0Z' },
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
  throw new Error(`不正な色: ${color} (#RRGGBB または rgb(0,0,0) を指定)`);
}

function randomColor(): string {
  return `#${[...randomBytes(3)].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function generateLogo(options: LogoOptions): {
  svg: string;
  lines: string[];
  colors: string[];
} {
  // Unicode の大文字展開 (ß → SS など) を暗黙に受け入れない。
  if (!/^[a-z0-9\n]+$/i.test(options.text) || options.text.length > 256) {
    throw new Error('文字は半角英数字と改行で1〜256文字を指定してください。');
  }
  const text = options.text.toUpperCase();
  const breaks = options.breakAt ?? [];
  if (text.includes('\n') && breaks.length > 0) {
    throw new Error('文字内の改行と --break-at は同時に指定できません。');
  }
  let previous = 0;
  for (const position of breaks) {
    if (
      !Number.isSafeInteger(position) ||
      position <= previous ||
      position >= text.length
    ) {
      throw new Error(
        '改行位置は文字数未満の正の整数を昇順で指定してください。'
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
    throw new Error('空の行は指定できません。');
  const palette = options.colors?.map(colorValue);
  if (palette?.length === 0) throw new Error('色は1色以上指定してください。');
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
    let x = margin;
    const y = margin + depth + row * height;
    for (const [column, letter] of [...line].entries()) {
      const spec = glyph(letter);
      const w = spec.width ?? 100;
      const color = colors[colorIndex++]!;
      // 下段には上面を描かず、正面同士を密着させる。
      if (row === 0) {
        sides.push(
          `<path fill="${color}" d="M${x} ${y}l${depth} -${depth}h${w}l-${depth} ${depth}Z"/>`
        );
      }
      if (column === line.length - 1) {
        sides.push(
          `<path fill="${color}" d="M${x + w} ${y}l${depth} -${depth}v${height}l-${depth} ${depth}Z"/>`
        );
      }
      // D の斜めの右端に次のブロックをかみ合わせる。
      const face =
        spec.face ??
        (line[column - 1] === 'D'
          ? `M-18 0H${w}V${height}H-18L0 115V25Z`
          : `M0 0H${w}V${height}H0Z`);
      faces.push(
        `<g transform="translate(${x} ${y})" data-letter="${letter}"><path fill="${color}" d="${face}"/>${spec.marks === undefined ? '' : `<path fill="none" stroke-width="6" d="${spec.marks}"/>`}</g>`
      );
      x += w;
    }
  }
  const label = lines.join(' / ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" role="img" aria-labelledby="title"><title id="title">${label}</title><g stroke="#000000" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round">${sides.join('')}${faces.join('')}</g></svg>\n`;
  return { svg, lines, colors };
}
