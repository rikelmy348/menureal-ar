/* POST /api/entrar  { email, senha } → { token, slug, nome } */
import { json, conferirSenha, criarToken } from '../lib/comum.mjs';
import { contaPorEmail } from '../lib/banco.mjs';

export default async function entrar(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const email = String(d.email || '').trim().toLowerCase();
  const senha = String(d.senha || '');
  const conta = email ? await contaPorEmail(env, email) : null;
  if (!conta || !(await conferirSenha(senha, conta.senha_hash))) {
    await new Promise((r) => setTimeout(r, 600)); // dificulta tentativas em sequência
    return json({ erro: 'E-mail ou senha incorretos.' }, 401);
  }
  return json({ token: await criarToken(env, conta.slug), slug: conta.slug, nome: conta.nome });
}
