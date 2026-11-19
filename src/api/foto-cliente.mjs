/* Foto do cliente com o móvel na casa dele (tirada no "Ver ao vivo"), para mandar no WhatsApp da loja.
   POST /api/foto-cliente?loja=slug   corpo: image/jpeg (até 600 KB)  → { url: '/f/<id>' }
   GET  /api/foto-cliente?id=<id>     → a imagem
   Fica guardada 30 dias. Limite por aparelho/rede para não virar hospedagem de imagens. */
import { json, slugValido, ipDe } from '../lib/comum.mjs';
import { lojaExiste } from '../lib/banco.mjs';

const MAX = 600 * 1024, DIAS = 30, POR_DIA = 30;
export const ID_FOTO = /^[a-z0-9]{12}$/;

export default async function fotoCliente(req, env) {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    if (!ID_FOTO.test(id)) return json({ erro: 'Foto não encontrada.' }, 404);
    const r = await env.MODELOS.getWithMetadata('fotos/' + id, 'arrayBuffer');
    if (!r || !r.value) return json({ erro: 'Essa foto expirou.' }, 404);
    return new Response(r.value, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } });
  }
  if (req.method !== 'POST') return json({ erro: 'Use GET ou POST.' }, 405);
  const slug = String(url.searchParams.get('loja') || '').toLowerCase();
  if (!slugValido(slug) || !(await lojaExiste(env, slug))) return json({ erro: 'Loja não encontrada.' }, 404);
  const tam = Number(req.headers.get('content-length') || 0);
  if (tam > MAX) return json({ erro: 'Foto grande demais.' }, 413);
  const buf = await req.arrayBuffer();
  const b = new Uint8Array(buf);
  if (buf.byteLength < 1000 || buf.byteLength > MAX || b[0] !== 0xFF || b[1] !== 0xD8) return json({ erro: 'Envie uma foto JPEG.' }, 400);
  // limite por dia
  const dia = new Date().toISOString().slice(0, 10);
  const chaveLim = 'lim-foto/' + dia + '/' + ipDe(req);
  const n = Number(await env.MODELOS.get(chaveLim)) || 0;
  if (n >= POR_DIA) return json({ erro: 'Muitas fotos hoje. Tente amanhã.' }, 429);
  await env.MODELOS.put(chaveLim, String(n + 1), { expirationTtl: 2 * 86400 });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join('');
  await env.MODELOS.put('fotos/' + id, buf, { expirationTtl: DIAS * 86400, metadata: { loja: slug } });
  return json({ url: '/f/' + id });
}

/** Página /f/<id>: mostra a foto e tem a prévia (og:image) para o WhatsApp exibir a imagem no chat. */
export async function paginaFoto(req, env, id) {
  const r = await env.MODELOS.getWithMetadata('fotos/' + id, 'stream');
  const origem = new URL(req.url).origin;
  if (!r || !r.value) return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Foto expirada</title><body style="font-family:system-ui;padding:24px">Essa foto já expirou.</body>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  try { r.value.cancel(); } catch (e) {}
  const loja = (r.metadata && r.metadata.loja) || '';
  const img = origem + '/api/foto-cliente?id=' + id;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Como ficaria na minha casa</title><meta name="robots" content="noindex">
<meta property="og:title" content="Como ficaria na minha casa"><meta property="og:description" content="Foto feita com a câmera ao vivo do catálogo.">
<meta property="og:image" content="${img}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">
<style>body{margin:0;background:#1D0F2E;color:#fff;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
img{max-width:100%;max-height:80vh;border-radius:16px;display:block;margin:0 auto 14px}a{color:#FFC24B;font-weight:700}</style></head>
<body><main><img src="${img}" alt="Móvel na casa do cliente">${loja ? `<p style="text-align:center"><a href="/${loja}">Ver o catálogo da loja</a></p>` : ''}</main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
