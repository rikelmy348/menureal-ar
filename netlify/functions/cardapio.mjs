/* =========================================================================
   MenuReal AR — cardápio na nuvem (Netlify Blobs)
   GET  /api/cardapio?loja=slug   público
   PUT  /api/cardapio?loja=slug   conta da loja (ou código mestre)
   Sem ?loja: cardápio de demonstração da página inicial (só código mestre edita)
   ========================================================================= */
import { loja, json, autorizar, slugValido, chaveCardapio } from '../lib/comum.mjs';

const LIMITE = 600_000; // bytes

export default async (req) => {
  const slug = (new URL(req.url).searchParams.get('loja') || '').toLowerCase();
  if (slug && !slugValido(slug)) return json({ erro: 'Loja inválida.' }, 400);
  const store = loja();
  if (req.method === 'GET') {
    const dados = await store.get(chaveCardapio(slug), { type: 'json' });
    if (!dados) return json({ erro: slug ? 'Estabelecimento não encontrado.' : 'Nenhum cardápio publicado ainda.' }, 404);
    return json(dados);
  }
  if (req.method !== 'PUT') return json({ erro: 'Use GET ou PUT.' }, 405);
  const negado = autorizar(req, slug);
  if (negado) return negado;
  if (slug && !(await store.get('contas/' + slug, { type: 'json' }))) return json({ erro: 'Estabelecimento não encontrado.' }, 404);
  const texto = await req.text();
  if (texto.length > LIMITE) return json({ erro: 'Cardápio grande demais.' }, 413);
  let dados;
  try { dados = JSON.parse(texto); } catch { return json({ erro: 'JSON inválido.' }, 400); }
  if (!dados || typeof dados !== 'object' || !dados.padaria || !Array.isArray(dados.produtos) || dados.produtos.length > 500) {
    return json({ erro: 'Formato de cardápio inválido.' }, 400);
  }
  dados.atualizadoEm = new Date().toISOString();
  await store.setJSON(chaveCardapio(slug), dados);
  return json({ ok: true, atualizadoEm: dados.atualizadoEm });
};

export const config = { path: '/api/cardapio' };
