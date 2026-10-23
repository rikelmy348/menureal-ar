/* GET  /api/contas   lista as lojas + WhatsApp de suporte    (código MENUREAL_CODIGO)
   POST /api/contas   cria ou redefine a senha  { slug, nome, email, senha, tipo }
   POST /api/contas   { acao: 'plano', slug, plano: 'ativo'|'bloqueado'|'teste', dias }
   POST /api/contas   { acao: 'suporte', numero }   WhatsApp que as lojas veem para falar com você */
import { json, ehMestre, slugValido, hashSenha } from '../lib/comum.mjs';
import { listarLojas, contaPorEmail, salvarConta, mudarPlano, lerConfig, gravarConfig } from '../lib/banco.mjs';

export default async function contas(req, env) {
  if (!env.MENUREAL_CODIGO) return json({ erro: 'Servidor não configurado: defina MENUREAL_CODIGO nas variáveis da Cloudflare.' }, 500);
  if (!ehMestre(req, env)) return json({ erro: 'Código de acesso incorreto.' }, 401);
  if (req.method === 'GET') return json({ contas: await listarLojas(env), suporte: (await lerConfig(env, 'suporte')) || '' });
  if (req.method !== 'POST') return json({ erro: 'Use GET ou POST.' }, 405);

  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  if (d.acao === 'plano') {
    const plano = ['ativo', 'bloqueado', 'teste'].includes(d.plano) ? d.plano : null;
    if (!plano || !slugValido(String(d.slug || ''))) return json({ erro: 'Plano ou loja inválidos.' }, 400);
    return json({ ok: true, ...(await mudarPlano(env, d.slug, plano, Math.min(90, Math.max(1, Number(d.dias) || 7)))) });
  }
  if (d.acao === 'suporte') {
    let n = String(d.numero || '').replace(/\D/g, '');
    if (n && n.length <= 11) n = '55' + n;
    if (n && (n.length < 12 || n.length > 13)) return json({ erro: 'WhatsApp inválido. Use DDD + número.' }, 400);
    await gravarConfig(env, 'suporte', n);
    return json({ ok: true, suporte: n });
  }
  const slug = String(d.slug || '').trim().toLowerCase();
  const nome = String(d.nome || '').trim().slice(0, 60);
  const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  const senha = String(d.senha || '');
  const sorveteria = d.tipo === 'sorveteria';
  const tipo = d.tipo === 'produtos' ? 'produtos' : 'alimentos';
  if (!slugValido(slug)) return json({ erro: 'Endereço inválido: use de 3 a 40 letras minúsculas, números e hífens (ex.: sabor-da-vila).' }, 400);
  if (!nome) return json({ erro: 'Informe o nome da loja.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ erro: 'E-mail inválido.' }, 400);
  if (senha.length < 8) return json({ erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);

  const dono = await contaPorEmail(env, email);
  if (dono && dono.slug !== slug) return json({ erro: 'Este e-mail já é usado pela loja "' + dono.slug + '".' }, 409);
  const { atualizado } = await salvarConta(env, { slug, nome, email, senhaHash: await hashSenha(senha), tipo, sorveteria });
  return json({ ok: true, slug, nome, email, atualizado });
}
