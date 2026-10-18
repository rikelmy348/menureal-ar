/* =========================================================================
   MenuReal AR — login da loja
   POST /api/entrar  { email, senha } → { token, slug, nome }
   ========================================================================= */
import { json, conferirSenha, criarToken } from '../lib/comum.mjs';
import { garantirMigracao, contaPorEmail } from '../lib/banco.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const email = String(d.email || '').trim().toLowerCase();
  const senha = String(d.senha || '');
  try {
    await garantirMigracao();
    const conta = email ? await contaPorEmail(email) : null;
    if (!conta || !conferirSenha(senha, conta.senha_hash)) {
      await new Promise((r) => setTimeout(r, 600)); // dificulta tentativas em sequência
      return json({ erro: 'E-mail ou senha incorretos.' }, 401);
    }
    return json({ token: criarToken(conta.slug), slug: conta.slug, nome: conta.nome });
  } catch (e) {
    console.error('entrar:', e);
    return json({ erro: 'Erro no banco de dados. Tente de novo em instantes.' }, 500);
  }
};

export const config = { path: '/api/entrar' };
