import { mkdir, copyFile, rm, writeFile } from 'node:fs/promises';

import { generateLogo } from '../src/index.js';

export async function buildSite() {
  const destination = new URL('../site-dist/', import.meta.url);
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
  for (const file of ['index.html', 'alphabet.html', 'style.css']) {
    await copyFile(
      new URL(`../web/${file}`, import.meta.url),
      new URL(file, destination)
    );
  }
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
