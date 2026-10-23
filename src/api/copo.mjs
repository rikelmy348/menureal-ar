/* POST /api/copo?loja=slug&nome=...   corpo: o GLB do copo sob medida (gerado no navegador)
   → { url }   Guarda no KV. Só aceita copos do montador (asset.extras.copo). */
import { json, autorizar, lerSlug, guardarModelo } from '../lib/comum.mjs';

const LIMITE = 9_000_000;

export default async function copo(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const u = new URL(req.url);
  const slug = lerSlug(req);
  await autorizar(req, env, slug);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length < 20 || bytes.length > LIMITE) return json({ erro: 'Arquivo do copo inválido ou grande demais.' }, 413);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) return json({ erro: 'O arquivo não é um modelo 3D (GLB).' }, 400);
  // confere só o cabeçalho JSON (barato): precisa ser um copo do montador
  const lenJson = dv.getUint32(12, true);
  let info = null;
  try { info = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + lenJson))).asset.extras.copo; } catch { /* inválido */ }
  if (!info || !(info.rt > 0)) return json({ erro: 'Este arquivo não é um copo do montador.' }, 400);
  const nome = String(u.searchParams.get('nome') || 'copo').replace(/[^\w-]/g, '').slice(0, 60) || 'copo';
  const chave = 'modelos/' + (slug ? slug + '/' : '') + nome + '-' + Date.now().toString(36) + '.glb';
  return json({ url: await guardarModelo(env, chave, bytes, { copo: true }) });
}
