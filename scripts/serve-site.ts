import alphabet from '../web/alphabet.html';
import editor from '../web/editor.html';
import index from '../web/index.html';
import { glyphRequest } from './glyph-store.ts';
import { siteAssets } from './site-assets.ts';

const editorMode = process.argv.includes('--editor');
let savingGlyphs = false;

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env.PORT ?? (editorMode ? 3334 : 3333)),
  development: { hmr: true },
  routes: {
    '/': index,
    '/index.html': index,
    '/alphabet.html': alphabet,
    '/editor.html': editor,
    async '/__glyphs'(request) {
      if (savingGlyphs)
        return new Response('保存中です。もう一度お試しください。', {
          status: 409,
        });
      savingGlyphs = true;
      try {
        return await glyphRequest(
          request,
          new URL('../src/glyphs.json', import.meta.url)
        );
      } finally {
        savingGlyphs = false;
      }
    },
    async '/:file'(request) {
      const svg = (await siteAssets())[request.params.file];
      return svg === undefined
        ? new Response('Not found', { status: 404 })
        : new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
    },
  },
});

console.log(
  editorMode
    ? `Glyph Editor: ${new URL('editor.html', server.url)}`
    : `Playground: ${server.url}`
);
