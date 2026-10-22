import { readFile, writeFile } from 'node:fs/promises';

import { parseGlyphConfig, serializeGlyphConfig } from '../src/glyphs.js';

/** A local-only endpoint with stale-file protection; never runs Git commands. */
export async function glyphRequest(
  request: Request,
  file: URL
): Promise<Response> {
  const url = new URL(request.url);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname))
    return new Response('Forbidden', { status: 403 });
  if (request.method !== 'GET' && request.method !== 'PUT')
    return new Response('Method not allowed', { status: 405 });
  if (
    request.method === 'PUT' &&
    (request.headers.get('origin') !== url.origin ||
      !request.headers.get('content-type')?.startsWith('application/json'))
  )
    return new Response('Forbidden', { status: 403 });
  const current = parseGlyphConfig(JSON.parse(await readFile(file, 'utf8')));
  if (request.method === 'GET')
    return Response.json(current, { headers: { 'Cache-Control': 'no-store' } });
  if (Number(request.headers.get('content-length')) > 100_000)
    return new Response('設定ファイルが大きすぎます。', { status: 413 });
  try {
    const body = await request.text();
    if (body.length > 100_000)
      return new Response('設定ファイルが大きすぎます。', { status: 413 });
    const input = JSON.parse(body);
    const next = serializeGlyphConfig(parseGlyphConfig(input.glyphs));
    // Read again immediately before writing to detect changes made in an editor.
    const latest = parseGlyphConfig(JSON.parse(await readFile(file, 'utf8')));
    if (input.baseline !== serializeGlyphConfig(latest))
      return new Response(
        'src/glyphs.json が別の場所で変更されました。調整内容をダウンロードしてからページを再読み込みし、差分を確認してください。',
        { status: 409 }
      );
    await writeFile(file, next);
    return new Response('Saved');
  } catch (cause) {
    return new Response(
      cause instanceof Error ? cause.message : String(cause),
      { status: 400 }
    );
  }
}
