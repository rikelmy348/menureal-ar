/* =========================================================================
   MenuReal AR — cardápio/catálogo de cada loja (banco de dados)
   GET  /api/cardapio?loja=slug   público
   PUT  /api/cardapio?loja=slug   conta da loja (ou código mestre)
   Sem ?loja: demonstração da página inicial (só o código mestre edita)
   ========================================================================= */
import { json, autorizar, slugValido } from '../lib/comum.mjs';
import { garantirMigracao, lerCardapio, salvarCardapio } from '../lib/banco.mjs';

const LIMITE = 600_000; // bytes

export default async (req) => {
  const slug = (new URL(req.url).searchParams.get('loja') || '').toLowerCase();
  if (slug && !slugValido(slug)) return json({ erro: 'Loja inválida.' }, 400);
  try {
    await garantirMigracao();
    if (req.method === 'GET') {
      const dados = await lerCardapio(slug);
      if (!dados) return json({ erro: slug ? 'Estabelecimento não encontrado.' : 'Nenhum cardápio publicado ainda.' }, 404);
      return json(dados);
    }
    if (req.method !== 'PUT') return json({ erro: 'Use GET ou PUT.' }, 405);
    const negado = autorizar(req, slug);
    if (negado) return negado;
    const textoReq = await req.text();
    if (textoReq.length > LIMITE) return json({ erro: 'Cardápio grande demais.' }, 413);
    let dados;
    try { dados = JSON.parse(textoReq); } catch { return json({ erro: 'JSON inválido.' }, 400); }
    if (!dados || typeof dados !== 'object' || !dados.padaria || !Array.isArray(dados.produtos) || dados.produtos.length > 500) {
      return json({ erro: 'Formato de cardápio inválido.' }, 400);
    }
    const atualizadoEm = await salvarCardapio(slug, dados, { criarSeFaltar: !slug });
    return json({ ok: true, atualizadoEm });
  } catch (e) {
    console.error('cardapio:', e);
    return json({ erro: e.status === 404 ? e.message : 'Erro no banco de dados. Tente de novo em instantes.' }, e.status || 500);
  }
};

export const config = { path: '/api/cardapio' };
