/* POST /api/combo  { itens: ['api/arquivo/modelos/...glb' | 'assets/moveis/...glb', ...], posicoes?: [{ x, z, r }] }
   → { url }   (público; até 8 itens; resultado guardado em cache) */
import { json, juntarGlbs, hashCurto, lerModelo, guardarModelo, PREFIXO_ARQUIVO } from '../lib/comum.mjs';

const MAX_ITENS = 8;
const LIMITE = 24_000_000; // KV aceita até 25 MiB por arquivo

export default async function combo(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const itens = Array.isArray(d && d.itens) ? d.itens.map(String).slice(0, MAX_ITENS) : [];
  if (itens.length < 2) return json({ erro: 'Escolha pelo menos 2 itens com 3D.' }, 400);
  // Montar ambiente: posição (metros) e giro (0/90/180/270) de cada item, vistos de cima
  const lim = (v) => Math.max(-15, Math.min(15, Math.round((Number(v) || 0) * 1000) / 1000));
  const posicoes = Array.isArray(d.posicoes) && d.posicoes.length === itens.length
    ? d.posicoes.map((p) => ({ x: lim(p && p.x), z: lim(p && p.z), r: [0, 90, 180, 270].includes(Number(p && p.r)) ? Number(p.r) : 0 }))
    : null;
  const chave = 'combos/v2-' + (await hashCurto(itens.join('|') + (posicoes ? '#' + JSON.stringify(posicoes) : ''))) + '.glb';
  const { value: existe } = await env.MODELOS.getWithMetadata(chave, 'stream');
  if (existe) { await existe.cancel(); return json({ url: PREFIXO_ARQUIVO + chave, cache: true }); }
  const arquivos = [];
  for (const u of itens) {
    let a = null;
    try { a = await lerModelo(env, u); } catch (e) { console.error('combo: falha ao ler', u, e); }
    if (!a) return json({ erro: 'Um dos modelos do pedido não foi encontrado.' }, 404);
    arquivos.push(a);
  }
  let glb;
  try { glb = juntarGlbs(arquivos, 0.02, posicoes); } catch (e) { return json({ erro: 'Não foi possível montar o combo: ' + e.message }, 422); }
  if (glb.length > LIMITE) return json({ erro: 'O combo ficou pesado demais. Tente com menos itens.' }, 413);
  return json({ url: await guardarModelo(env, chave, glb, { itens: itens.length }) });
}
