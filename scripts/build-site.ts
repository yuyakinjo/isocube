import { mkdir, copyFile, readdir, rm, writeFile } from 'node:fs/promises';

import { generateLogo } from '../src/index.js';
import { HIRAGANA, KATAKANA } from '../src/kana.js';

const BUNDLED = new Set(['app.ts', 'theme.ts', 'tsconfig.json']);

async function copyStaticAssets(source: URL, destination: URL) {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = new URL(entry.name, source);
    const to = new URL(entry.name, destination);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyStaticAssets(
        new URL(`${entry.name}/`, source),
        new URL(`${entry.name}/`, destination)
      );
      continue;
    }
    if (BUNDLED.has(entry.name) || entry.name.endsWith('.ts')) continue;
    await copyFile(from, to);
  }
}

export async function buildSite() {
  const destination = new URL('../site-dist/', import.meta.url);
  const web = new URL('../web/', import.meta.url);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const result = await Bun.build({
    entrypoints: ['app.ts', 'theme.ts'].map(
      (file) => new URL(`../web/${file}`, import.meta.url).pathname
    ),
    outdir: destination.pathname,
    target: 'browser',
    minify: true,
  });
  if (!result.success)
    throw new AggregateError(result.logs, 'Site build failed');
  await copyStaticAssets(web, destination);
  const alphabet = generateLogo({
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
  await writeFile(new URL('alphabet.svg', destination), alphabet.svg);
  for (const [name, text] of [
    [
      'hiragana',
      HIRAGANA.slice(0, 35).match(/.{5}/g)!.join('\n') +
        '\nやゆよ\nらりるれろ\nわをん',
    ],
    [
      'katakana',
      KATAKANA.slice(0, 35).match(/.{5}/g)!.join('\n') +
        '\nヤユヨ\nラリルレロ\nワヲン',
    ],
    [
      'hiragana-voiced',
      'がぎぐげご\nざじずぜぞ\nだぢづでど\nばびぶべぼ\nぱぴぷぺぽ\nゔ',
    ],
    [
      'katakana-voiced',
      'ガギグゲゴ\nザジズゼゾ\nダヂヅデド\nバビブベボ\nパピプペポ\nヴヷヺ',
    ],
    ['hiragana-small', 'ぁぃぅぇぉ\nっゃゅょゎ\nゕゖー'],
    ['katakana-small', 'ァィゥェォ\nッャュョヮ\nヵヶー'],
  ]) {
    const result = generateLogo({
      text: text!,
      colors: ['#2D00F7', '#E500A4', '#F20089', '#FFB600', '#6A00F4'],
    });
    await writeFile(new URL(`${name}.svg`, destination), result.svg);
  }
  for (const file of ['logo.svg', 'isocube.svg']) {
    await copyFile(
      new URL(`../examples/${file}`, import.meta.url),
      new URL(file, destination)
    );
  }
}

if (import.meta.main) {
  await buildSite();
  console.log('GitHub Pages site built in site-dist/');
}
