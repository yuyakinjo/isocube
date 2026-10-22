import { mkdir, rm, writeFile } from 'node:fs/promises';

import externalSvg from './external-svg.ts';
import { siteAssets } from './site-assets.ts';

export async function buildSite() {
  const destination = new URL('../site-dist/', import.meta.url);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const result = await Bun.build({
    entrypoints: ['index.html', 'alphabet.html', 'editor.html'].map(
      (file) => new URL(`../web/${file}`, import.meta.url).pathname
    ),
    outdir: destination.pathname,
    target: 'browser',
    minify: true,
    plugins: [externalSvg],
  });
  if (!result.success)
    throw new AggregateError(result.logs, 'Site build failed');
  for (const [file, svg] of Object.entries(await siteAssets()))
    await writeFile(new URL(file, destination), svg);
}

if (import.meta.main) {
  await buildSite();
  console.log('GitHub Pages site built in site-dist/');
}
