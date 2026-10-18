/* =========================================================================
   MenuReal AR — combo na mesa: junta os modelos do pedido em um só arquivo
   POST /api/combo  { itens: ['api/arquivo/modelos/...glb' | 'assets/models/...glb', ...] }
        → { url }   (público; até 8 itens; resultado guardado em cache)
   ========================================================================= */
import { loja, json, juntarGlbs, hashCurto } from '../lib/comum.mjs';

const MAX_ITENS = 8;
const LIMITE = 19_000_000;

async function lerModelo(url, origem) {
  if (url.includes('..')) return null;
  const nuvem = /^\/?api\/arquivo\/(modelos\/(?:[a-z0-9-]+\/)?[\w.-]+\.glb)$/.exec(url);
  if (nuvem) { const ab = await loja().get(nuvem[1], { type: 'arrayBuffer' }); return ab ? new Uint8Array(ab) : null; }
  if (/^\/?assets\/models\/[\w.-]+\.glb$/.test(url)) {
    const r = await fetch(new URL(url.replace(/^\//, ''), origem + '/'));
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  }
  return null;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const itens = Array.isArray(d && d.itens) ? d.itens.map(String).slice(0, MAX_ITENS) : [];
  if (itens.length < 2) return json({ erro: 'Escolha pelo menos 2 itens com 3D.' }, 400);
  const store = loja();
  const chave = 'combos/' + hashCurto(itens.join('|')) + '.glb';
  if (await store.getMetadata(chave)) return json({ url: 'api/arquivo/' + chave, cache: true });
  const origem = new URL(req.url).origin;
  const arquivos = [];
  for (const u of itens) {
    let a = null;
    try { a = await lerModelo(u, origem); } catch (e) { console.error('combo: falha ao ler', u, e); }
    if (!a) return json({ erro: 'Um dos modelos do pedido não foi encontrado.' }, 404);
    arquivos.push(a);
  }
  let glb;
  try { glb = juntarGlbs(arquivos); } catch (e) { return json({ erro: 'Não foi possível montar o combo: ' + e.message }, 422); }
  if (glb.length > LIMITE) return json({ erro: 'O combo ficou pesado demais. Tente com menos itens.' }, 413);
  await store.set(chave, glb, { metadata: { itens } });
  return json({ url: 'api/arquivo/' + chave });
};

export const config = { path: '/api/combo' };
