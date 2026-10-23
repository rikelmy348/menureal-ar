/* POST /api/recuperar  { email, codigo, senha } → { token, slug, codigo }
   Troca a senha com o código de recuperação (mostrado no cadastro).
   O código usado deixa de valer: um novo é devolvido para a loja guardar.
   Limite: 6 tentativas por hora por IP. */
import { json, hashSenha, criarToken, ipDe, gerarCodigo, hashCodigo, conferirCodigo } from '../lib/comum.mjs';
import { contaPorEmail, mudarSenha, gravarCodigoRecuperacao, dentroDoLimite } from '../lib/banco.mjs';

export default async function recuperar(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const email = String(d.email || '').trim().toLowerCase();
  const senha = String(d.senha || '');
  if (senha.length < 8) return json({ erro: 'A nova senha precisa ter pelo menos 8 caracteres.', campo: 'senha' }, 400);
  if (!(await dentroDoLimite(env, 'recuperar:' + ipDe(req), 6, 36e5))) return json({ erro: 'Muitas tentativas. Espere uma hora e tente de novo.' }, 429);
  const conta = email ? await contaPorEmail(env, email) : null;
  const ok = conta && conta.codigo_hash && (await conferirCodigo(conta.slug, d.codigo, conta.codigo_hash));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ erro: conta && !conta.codigo_hash
      ? 'Esta loja não tem código de recuperação. Fale com o suporte do MenuReal para trocar a senha.'
      : 'E-mail ou código de recuperação incorretos.' }, 401);
  }
  const novo = gerarCodigo();
  await mudarSenha(env, conta.slug, await hashSenha(senha));
  await gravarCodigoRecuperacao(env, conta.slug, await hashCodigo(conta.slug, novo));
  return json({ ok: true, token: await criarToken(env, conta.slug), slug: conta.slug, nome: conta.nome, codigo: novo });
}
