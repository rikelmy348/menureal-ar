/* GET  /api/cardapio?loja=slug   público
   PUT  /api/cardapio?loja=slug   conta da loja (ou código mestre)
   Sem ?loja: demonstração da página inicial (só o código mestre edita) */
import { json, autorizar, lerSlug } from '../lib/comum.mjs';
import { lerCardapio, salvarCardapio } from '../lib/banco.mjs';

const LIMITE = 600_000; // bytes

export default async function cardapio(req, env) {
  const slug = lerSlug(req);
  if (req.method === 'GET') {
    const dados = await lerCardapio(env, slug);
    if (!dados) return json({ erro: slug ? 'Estabelecimento não encontrado.' : 'Nenhum cardápio publicado ainda.' }, 404);
    return json(dados);
  }
  if (req.method !== 'PUT') return json({ erro: 'Use GET ou PUT.' }, 405);
  await autorizar(req, env, slug);
  const textoReq = await req.text();
  if (textoReq.length > LIMITE) return json({ erro: 'Cardápio grande demais.' }, 413);
  let dados;
  try { dados = JSON.parse(textoReq); } catch { return json({ erro: 'JSON inválido.' }, 400); }
  if (!dados || typeof dados !== 'object' || !dados.padaria || !Array.isArray(dados.produtos) || dados.produtos.length > 500) {
    return json({ erro: 'Formato de cardápio inválido.' }, 400);
  }
  const atualizadoEm = await salvarCardapio(env, slug, dados, { criarSeFaltar: !slug });
  return json({ ok: true, atualizadoEm });
}
