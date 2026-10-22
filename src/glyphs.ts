import data from './glyphs.json' with { type: 'json' };

export interface Glyph {
  width?: number;
  marks?: string;
  outline?: [number, number][];
}

export type GlyphConfig = Record<string, Glyph>;
export const CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';

const coordinate = (value: unknown, max: number): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max;

/** Accept only geometry, never arbitrary SVG markup. Return an independent copy. */
export function parseGlyphConfig(value: unknown): GlyphConfig {
  const fail = (letter: string): never => {
    throw new Error(
      `Invalid glyph configuration: ${letter === ' ' ? 'Space' : letter}.`
    );
  };
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail('expected an object');
  const source = value as Record<string, unknown>;
  if (
    Object.keys(source).length !== CHARACTERS.length ||
    Object.keys(source).some(
      (key) => !CHARACTERS.includes(key) || key.length !== 1
    )
  )
    fail('expected A–Z, 0–9 and Space');
  const result: GlyphConfig = {};
  for (const letter of CHARACTERS) {
    const raw = source[letter];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      fail(letter);
    const spec = raw as Record<string, unknown>;
    if (
      Object.keys(spec).some(
        (key) => !['width', 'marks', 'outline'].includes(key)
      )
    )
      fail(letter);
    const glyph: Glyph = {};
    if (spec.width !== undefined) {
      if (!coordinate(spec.width, 240) || spec.width < 20) fail(letter);
      glyph.width = spec.width as number;
    }
    const width = glyph.width ?? 100;
    if (spec.marks !== undefined) {
      if (typeof spec.marks !== 'string' || spec.marks.length > 2000)
        fail(letter);
      const marks = spec.marks as string;
      const number = String.raw`\d+(?:\.\d+)?`;
      if (
        !new RegExp(
          `^M${number} ${number}(?:[ML]${number} ${number}|[HV]${number}| +M${number} ${number})*$`
        ).test(marks)
      )
        fail(letter);
      for (const segment of marks.matchAll(/([MLHV])([\d.]+)(?: ([\d.]+))?/g)) {
        if (segment[1] === 'V') {
          if (!coordinate(Number(segment[2]), 140)) fail(letter);
        } else {
          if (!coordinate(Number(segment[2]), width)) fail(letter);
          if (segment[3] !== undefined && !coordinate(Number(segment[3]), 140))
            fail(letter);
        }
      }
      glyph.marks = marks;
    }
    if (spec.outline !== undefined) {
      if (
        !Array.isArray(spec.outline) ||
        spec.outline.length < 3 ||
        spec.outline.length > 32
      )
        fail(letter);
      glyph.outline = (spec.outline as unknown[]).map((point) => {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          !coordinate(point[0], width) ||
          !coordinate(point[1], 140)
        )
          fail(letter);
        return [...(point as [number, number])];
      });
    }
    if (
      letter === ' ' &&
      (glyph.marks !== undefined || glyph.outline !== undefined)
    )
      fail(letter);
    result[letter] = glyph;
  }
  return result;
}

export const defaultGlyphs = parseGlyphConfig(data);

export function getDefaultGlyphs(): GlyphConfig {
  return parseGlyphConfig(defaultGlyphs);
}

/** Stable formatting keeps exported files easy to review in Git. */
export function serializeGlyphConfig(value: GlyphConfig): string {
  return (
    JSON.stringify(parseGlyphConfig(value), null, 2).replace(
      /\[\n\s+([\d.]+),\n\s+([\d.]+)\n\s+\]/g,
      '[$1, $2]'
    ) + '\n'
  );
}
