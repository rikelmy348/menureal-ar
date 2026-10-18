/* =========================================================================
   MenuReal AR — cardápio na nuvem (Netlify Blobs)
   GET  /api/cardapio   público: devolve o cardápio publicado
   PUT  /api/cardapio   com código de acesso: publica o cardápio para todos
   ========================================================================= */
import { loja, json, exigirCodigo } from '../lib/comum.mjs';

const LIMITE = 300_000; // bytes

export default async (req) => {
  const store = loja();
  if (req.method === 'GET') {
    const dados = await store.get('cardapio', { type: 'json' });
    if (!dados) return json({ erro: 'Nenhum cardápio publicado ainda.' }, 404);
    return json(dados);
  }
  if (req.method !== 'PUT') return json({ erro: 'Use GET ou PUT.' }, 405);
  const negado = exigirCodigo(req);
  if (negado) return negado;
  const texto = await req.text();
  if (texto.length > LIMITE) return json({ erro: 'Cardápio grande demais.' }, 413);
  let dados;
  try { dados = JSON.parse(texto); } catch { return json({ erro: 'JSON inválido.' }, 400); }
  if (!dados || typeof dados !== 'object' || !dados.padaria || !Array.isArray(dados.produtos) || dados.produtos.length > 500) {
    return json({ erro: 'Formato de cardápio inválido.' }, 400);
  }
  dados.atualizadoEm = new Date().toISOString();
  await store.setJSON('cardapio', dados);
  return json({ ok: true, atualizadoEm: dados.atualizadoEm });
};

export const config = { path: '/api/cardapio' };
