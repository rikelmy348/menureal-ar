/* =========================================================================
   MenuReal AR — login do estabelecimento
   POST /api/entrar  { email, senha } → { token, slug, nome }
   ========================================================================= */
import { loja, json, conferirSenha, criarToken } from '../lib/comum.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const email = String(d.email || '').trim().toLowerCase();
  const senha = String(d.senha || '');
  const store = loja();
  const idx = email && await store.get('emails/' + email, { type: 'json' });
  const conta = idx && await store.get('contas/' + idx.slug, { type: 'json' });
  if (!conta || !conferirSenha(senha, conta.senha)) {
    await new Promise((r) => setTimeout(r, 600)); // dificulta tentativas em sequência
    return json({ erro: 'E-mail ou senha incorretos.' }, 401);
  }
  return json({ token: criarToken(conta.slug), slug: conta.slug, nome: conta.nome });
};

export const config = { path: '/api/entrar' };
