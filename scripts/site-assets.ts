import { readFile } from 'node:fs/promises';

import { generateLogo, parseGlyphConfig } from '../src/index.js';

/** SVGs next to the pages, read from src/glyphs.json on every call. */
export async function siteAssets(): Promise<Record<string, string>> {
  const glyphs = parseGlyphConfig(
    JSON.parse(
      await readFile(new URL('../src/glyphs.json', import.meta.url), 'utf8')
    )
  );
  const favicon = generateLogo({ text: 'i', colors: ['#B429F9'], glyphs });
  const alphabet = generateLogo({
    glyphs,
    text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    breakAt: [7, 14, 21],
    colors: [
      '#2D00F7',
      '#E500A4',
      '#F20089',
      '#FFB600',
      '#6A00F4',
      '#8900F2',
      '#BC00DD',
    ],
  });
  const example = (file: string) =>
    readFile(new URL(`../examples/${file}`, import.meta.url), 'utf8');
  return {
    'favicon.svg': favicon.svg,
    'alphabet.svg': alphabet.svg,
    'logo.svg': await example('logo.svg'),
    'isocube.svg': await example('isocube.svg'),
  };
}
