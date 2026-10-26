/* POST /api/combo  { itens: ['api/arquivo/modelos/...glb' | 'assets/moveis/...glb', ...] }
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
  const chave = 'combos/' + (await hashCurto(itens.join('|'))) + '.glb';
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
  try { glb = juntarGlbs(arquivos); } catch (e) { return json({ erro: 'Não foi possível montar o combo: ' + e.message }, 422); }
  if (glb.length > LIMITE) return json({ erro: 'O combo ficou pesado demais. Tente com menos itens.' }, 413);
  return json({ url: await guardarModelo(env, chave, glb, { itens: itens.length }) });
}
