/* POST /api/kiwify?signature=...   Webhook da Kiwify (assinaturas do MenuReal).
   A Kiwify assina o corpo com HMAC-SHA1 usando o token do webhook (variável KIWIFY_TOKEN).
   - compra aprovada / renovada  → ativa a loja do e-mail do comprador no plano comprado
   - reembolso, chargeback, assinatura cancelada ou atrasada → pausa a loja
   Se ainda não existe loja com aquele e-mail, a compra fica guardada e é aplicada quando a
   loja for criada com o mesmo e-mail. Tudo fica registrado para o dono ver no painel. */
import { json } from '../lib/comum.mjs';
import { contaPorEmail, mudarPlano, registrarPagamento, guardarPendente } from '../lib/banco.mjs';

const ATIVAR = ['order_approved', 'compra_aprovada', 'subscription_renewed', 'order_paid'];
const PAUSAR = ['order_refunded', 'compra_reembolsada', 'chargeback', 'subscription_canceled', 'subscription_late'];

async function hmacSha1Hex(chave, texto) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function iguais(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Qual plano do MenuReal pelo nome do plano ou do produto na Kiwify. */
export function tipoPeloNome(nome) {
  const n = String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('fundador')) return 'fundador';
  if (n.includes('anual')) return 'anual';
  if (n.includes('loja') || n.includes('mensal')) return 'loja';
  return '';
}

export default async function kiwify(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const token = (env.KIWIFY_TOKEN || '').trim();
  if (!token) return json({ erro: 'Defina KIWIFY_TOKEN nas variáveis da Cloudflare.' }, 500);
  const corpo = await req.text();
  if (corpo.length > 200000) return json({ erro: 'Corpo grande demais.' }, 413);
  const u = new URL(req.url);
  const assinatura = (u.searchParams.get('signature') || '').toLowerCase();
  const ok = iguais(assinatura, await hmacSha1Hex(token, corpo)) || iguais(u.searchParams.get('token'), token);
  if (!ok) return json({ erro: 'Assinatura inválida.' }, 401);

  let d;
  try { d = JSON.parse(corpo); } catch { return json({ erro: 'JSON inválido.' }, 400); }
  const evento = String(d.webhook_event_type || d.trigger || d.event || '').toLowerCase();
  const status = String(d.order_status || '').toLowerCase();
  const cliente = d.Customer || d.customer || {};
  const email = String(cliente.email || d.email || '').trim().toLowerCase();
  const assin = d.Subscription || d.subscription || {};
  const nomePlano = (assin.plan && assin.plan.name) || (d.Product && d.Product.product_name) || d.product_name || '';
  const tipo = tipoPeloNome(nomePlano);
  const pedido = String(d.order_id || d.order_ref || '').slice(0, 80);

  let acao = '';
  if (ATIVAR.includes(evento) || (!evento && status === 'paid')) acao = 'ativar';
  else if (PAUSAR.includes(evento) || ['refunded', 'chargedback'].includes(status)) acao = 'pausar';

  let resultado = 'ignorado';
  let loja = '';
  if (acao && email) {
    const conta = await contaPorEmail(env, email);
    if (conta) {
      loja = conta.slug;
      if (acao === 'ativar') {
        await mudarPlano(env, conta.slug, 'ativo', 7, tipo || conta.plano_tipo || 'loja');
        resultado = 'ativada';
      } else {
        await mudarPlano(env, conta.slug, 'bloqueado');
        resultado = 'pausada';
      }
    } else if (acao === 'ativar') {
      await guardarPendente(env, email, tipo || 'loja');
      resultado = 'sem loja: guardado';
    } else resultado = 'sem loja';
  }
  await registrarPagamento(env, { evento: evento || status, email, tipo, loja, resultado, pedido });
  return json({ ok: true, resultado });
}
