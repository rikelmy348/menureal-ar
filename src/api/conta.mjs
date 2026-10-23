/* Conta da loja logada (token).
   GET  /api/conta?loja=slug                          → { email, situacao, testeAte, temCodigo }
   POST /api/conta?loja=slug { acao: 'senha', atual, nova }
   POST /api/conta?loja=slug { acao: 'codigo', senha }   → { codigo }  (novo código de recuperação) */
import { json, autorizar, lerSlug, hashSenha, conferirSenha, gerarCodigo, hashCodigo, ipDe } from '../lib/comum.mjs';
import { contaPorSlug, mudarSenha, gravarCodigoRecuperacao, situacaoLoja, dentroDoLimite } from '../lib/banco.mjs';

export default async function conta(req, env) {
  const slug = lerSlug(req);
  if (!slug) return json({ erro: 'Informe a loja.' }, 400);
  await autorizar(req, env, slug);
  const c = await contaPorSlug(env, slug);
  if (!c) return json({ erro: 'Loja não encontrada.' }, 404);
  if (req.method === 'GET') return json({ email: c.email, situacao: situacaoLoja(c), testeAte: c.plano === 'teste' ? c.teste_ate : '', temCodigo: Boolean(c.codigo_hash) });
  if (req.method !== 'POST') return json({ erro: 'Use GET ou POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  if (!(await dentroDoLimite(env, 'conta:' + slug + ':' + ipDe(req), 10, 36e5))) return json({ erro: 'Muitas tentativas. Espere uma hora.' }, 429);
  const atual = String(d.atual || d.senha || '');
  if (!(await conferirSenha(atual, c.senha_hash))) {
    await new Promise((r) => setTimeout(r, 500));
    return json({ erro: 'Senha atual incorreta.', campo: 'atual' }, 401);
  }
  if (d.acao === 'senha') {
    const nova = String(d.nova || '');
    if (nova.length < 8) return json({ erro: 'A nova senha precisa ter pelo menos 8 caracteres.', campo: 'nova' }, 400);
    await mudarSenha(env, slug, await hashSenha(nova));
    return json({ ok: true });
  }
  if (d.acao === 'codigo') {
    const codigo = gerarCodigo();
    await gravarCodigoRecuperacao(env, slug, await hashCodigo(slug, codigo));
    return json({ ok: true, codigo });
  }
  return json({ erro: 'Ação inválida.' }, 400);
}
