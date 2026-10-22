import { watch } from 'node:fs';
import { resolve, sep } from 'node:path';

import { buildSite } from './build-site.ts';
import { glyphRequest } from './glyph-store.ts';

const root = resolve(import.meta.dirname, '../site-dist');
const editorMode = process.argv.includes('--editor');
const sources = resolve(import.meta.dirname, '../web');
const reloadScript = `<script>new EventSource("/__reload").onmessage = () => location.reload();</script>`;
const listeners = new Set<ReadableStreamDefaultController<Uint8Array>>();
let savingGlyphs = false;

await buildSite();

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT ?? (editorMode ? 3334 : 3333)),
  async fetch(request) {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    if (pathname === '/__glyphs') {
      if (savingGlyphs)
        return new Response('保存中です。もう一度お試しください。', {
          status: 409,
        });
      savingGlyphs = true;
      try {
        const response = await glyphRequest(
          request,
          new URL('../src/glyphs.json', import.meta.url)
        );
        if (response.ok && request.method === 'PUT') await buildSite();
        return response;
      } finally {
        savingGlyphs = false;
      }
    }
    if (pathname === '/__reload') {
      let listener: ReadableStreamDefaultController<Uint8Array>;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            listener = controller;
            listeners.add(controller);
          },
          cancel() {
            listeners.delete(listener);
          },
        }),
        {
          headers: {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
          },
        }
      );
    }
    const path = resolve(
      root,
      `.${pathname === '/' ? '/index.html' : pathname}`
    );
    if (!path.startsWith(root + sep))
      return new Response('Forbidden', { status: 403 });
    const file = Bun.file(path);
    if (!(await file.exists()))
      return new Response('Not found', { status: 404 });
    if (!path.endsWith('.html')) return new Response(file);
    const html = (await file.text()).replace(
      '</body>',
      `${reloadScript}</body>`
    );
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  },
});

let pending: ReturnType<typeof setTimeout> | undefined;
watch(sources, { recursive: true }, () => {
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try {
      await buildSite();
      const message = new TextEncoder().encode('data: reload\n\n');
      for (const listener of listeners) listener.enqueue(message);
      console.log('Rebuilt site-dist/ after a change in web/');
    } catch (cause) {
      console.error(cause);
    }
  }, 50);
});

console.log(
  editorMode
    ? `Glyph Editor: ${new URL('editor.html', server.url)}`
    : `Playground: ${server.url}`
);
