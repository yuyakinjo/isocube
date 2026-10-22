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
  if (Number(request.headers.get('content-length')) > 100_000)
    return new Response('設定ファイルが大きすぎます。', { status: 413 });
  try {
    if (request.method === 'GET') {
      const current = parseGlyphConfig(
        JSON.parse(await readFile(file, 'utf8'))
      );
      return Response.json(current, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    let baseline: unknown;
    let next: string;
    try {
      const body = await request.text();
      if (body.length > 100_000)
        return new Response('設定ファイルが大きすぎます。', { status: 413 });
      const input = JSON.parse(body);
      next = serializeGlyphConfig(parseGlyphConfig(input.glyphs));
      baseline = input.baseline;
    } catch {
      return new Response(
        '設定が不正です。JSONと文字の設定を確認してください。',
        {
          status: 400,
        }
      );
    }
    // Read immediately before writing to detect changes made in an editor.
    const latest = parseGlyphConfig(JSON.parse(await readFile(file, 'utf8')));
    if (baseline !== serializeGlyphConfig(latest))
      return new Response(
        'src/glyphs.json が別の場所で変更されました。調整内容をダウンロードしてからページを再読み込みし、差分を確認してください。',
        { status: 409 }
      );
    await writeFile(file, next);
    return new Response('Saved');
  } catch {
    return new Response('設定ファイルの読み込みまたは保存に失敗しました。', {
      status: 500,
    });
  }
}
