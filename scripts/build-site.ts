import { mkdir, copyFile, rm } from 'node:fs/promises';

export async function buildSite() {
  const destination = new URL('../site-dist/', import.meta.url);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const result = await Bun.build({
    entrypoints: [new URL('../web/app.ts', import.meta.url).pathname],
    outdir: destination.pathname,
    target: 'browser',
    minify: true,
  });
  if (!result.success)
    throw new AggregateError(result.logs, 'Site build failed');
  for (const file of ['index.html', 'style.css']) {
    await copyFile(
      new URL(`../web/${file}`, import.meta.url),
      new URL(file, destination)
    );
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
