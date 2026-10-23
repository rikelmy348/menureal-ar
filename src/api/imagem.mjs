/* POST /api/imagem?loja=slug  { imagem: base64, tipo: 'image/webp'|'image/png'|'image/jpeg', uso: 'logo'|'capa' }
   → { url }   Guarda a logo ou a foto de capa da loja no KV (o navegador já reduz a imagem).
   Autorização: conta da loja (token) ou código mestre. */
import { json, autorizar, lerSlug, guardarModelo } from '../lib/comum.mjs';
import { DEMO } from '../lib/banco.mjs';

const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };
const LIMITE_BASE64 = 1_500_000; // ~1,1 MB de imagem

export default async function imagem(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const slug = lerSlug(req);
  await autorizar(req, env, slug);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const ext = EXT[d && d.tipo];
  const uso = d && ['logo', 'capa', 'og'].includes(d.uso) ? d.uso : null;
  if (!ext || !uso || typeof d.imagem !== 'string' || !d.imagem) return json({ erro: 'Envie uma imagem JPG, PNG ou WebP.' }, 400);
  if (d.imagem.length > LIMITE_BASE64) return json({ erro: 'Imagem grande demais. Use uma foto menor.' }, 413);
  let bytes;
  try { bytes = Uint8Array.from(atob(d.imagem), (c) => c.charCodeAt(0)); } catch { return json({ erro: 'Imagem inválida.' }, 400); }
  const chave = 'imagens/' + (slug || DEMO) + '/' + uso + '-' + Date.now().toString(36) + '.' + ext;
  return json({ url: await guardarModelo(env, chave, bytes, { tipo: d.tipo }) });
}
