/* GET  /api/cadastro?slug=x   → { livre, suporte }   (endereço disponível?)
   POST /api/cadastro          { nome, slug, ramo, whatsapp, email, senha }
        → { token, slug, nome, codigo, testeAte }
   O próprio lojista cria a conta, com 7 dias de teste grátis.
   Limite: 3 contas por IP por dia. */
import { json, slugValido, hashSenha, criarToken, ipDe, gerarCodigo, hashCodigo } from '../lib/comum.mjs';
import { contaPorEmail, lojaExiste, salvarConta, lerConfig, dentroDoLimite, RAMOS } from '../lib/banco.mjs';

export const DIAS_TESTE = 7;

export default async function cadastro(req, env) {
  if (req.method === 'GET') {
    const slug = String(new URL(req.url).searchParams.get('slug') || '').toLowerCase();
    const suporte = (await lerConfig(env, 'suporte')) || '';
    if (!slug) return json({ suporte });
    return json({ livre: slugValido(slug) && !(await lojaExiste(env, slug)), valido: slugValido(slug), suporte });
  }
  if (req.method !== 'POST') return json({ erro: 'Use GET ou POST.' }, 405);
  if (!env.MENUREAL_CODIGO && !env.MENUREAL_SEGREDO) return json({ erro: 'Servidor não configurado: defina MENUREAL_CODIGO nas variáveis da Cloudflare.' }, 500);

  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const nome = String(d.nome || '').trim().slice(0, 60);
  const slug = String(d.slug || '').trim().toLowerCase();
  const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  const senha = String(d.senha || '');
  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '');
  const ramo = RAMOS[d.ramo] ? d.ramo : 'moveis';
  if (String(d.site || '')) return json({ erro: 'Requisição inválida.' }, 400); // campo isca: robôs preenchem

  if (!nome) return json({ erro: 'Informe o nome da loja.', campo: 'nome' }, 400);
  if (!slugValido(slug)) return json({ erro: 'Endereço inválido: use de 3 a 40 letras minúsculas, números e hífens.', campo: 'slug' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ erro: 'E-mail inválido.', campo: 'email' }, 400);
  if (senha.length < 8) return json({ erro: 'A senha precisa ter pelo menos 8 caracteres.', campo: 'senha' }, 400);
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) return json({ erro: 'WhatsApp inválido. Use DDD + número.', campo: 'whatsapp' }, 400);
  if (await lojaExiste(env, slug)) return json({ erro: 'Este endereço já está em uso. Escolha outro.', campo: 'slug' }, 409);
  if (await contaPorEmail(env, email)) return json({ erro: 'Já existe uma loja com este e-mail. Entre pela loja ou recupere a senha.', campo: 'email' }, 409);
  if (!(await dentroDoLimite(env, 'cadastro:' + ipDe(req), 3, 864e5))) {
    return json({ erro: 'Muitas contas criadas a partir desta conexão hoje. Tente amanhã ou fale com o suporte.' }, 429);
  }

  const codigo = gerarCodigo();
  const zap = whatsapp && whatsapp.length <= 11 ? '55' + whatsapp : whatsapp;
  await salvarConta(env, { slug, nome, email, senhaHash: await hashSenha(senha), ramo, teste: DIAS_TESTE, whatsapp: zap,
    codigoHash: await hashCodigo(slug, codigo) });
  const conta = await contaPorEmail(env, email);
  return json({ ok: true, token: await criarToken(env, slug), slug, nome, codigo, testeAte: conta && conta.teste_ate });
}
