/* POST /api/contato   { loja, whatsapp, cidade, site }  → { ok }
        Pedido de demonstração deixado na página inicial (lojista interessado). Público.
        Limite: 5 por conexão por dia. "site" é campo isca: robôs preenchem.
   GET  /api/contato   → { pedidos: [...] }   (só o dono do MenuReal: código mestre)
   POST /api/contato   { acao: 'atendido', id, atendido: true|false } | { acao: 'remover', id }  (código mestre) */
import { json, ehMestre, ipDe } from '../lib/comum.mjs';
import { dentroDoLimite, salvarContato, listarContatos, marcarContato, removerContato } from '../lib/banco.mjs';

export default async function contato(req, env) {
  if (req.method === 'GET') {
    if (!ehMestre(req, env)) return json({ erro: 'Código de acesso incorreto.' }, 401);
    return json({ pedidos: await listarContatos(env) });
  }
  if (req.method !== 'POST') return json({ erro: 'Use GET ou POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }

  if (d && d.acao) {
    if (!ehMestre(req, env)) return json({ erro: 'Código de acesso incorreto.' }, 401);
    const id = Number(d.id);
    if (!Number.isInteger(id) || id < 1) return json({ erro: 'Pedido inválido.' }, 400);
    if (d.acao === 'remover') await removerContato(env, id);
    else if (d.acao === 'atendido') await marcarContato(env, id, d.atendido !== false);
    else return json({ erro: 'Ação inválida.' }, 400);
    return json({ ok: true });
  }

  if (String(d.site || '')) return json({ ok: true }); // robô: finge que deu certo
  const loja = String(d.loja || '').trim().slice(0, 80);
  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '').slice(0, 13);
  const cidade = String(d.cidade || '').trim().slice(0, 60);
  if (!loja) return json({ erro: 'Informe o nome da loja.', campo: 'loja' }, 400);
  if (whatsapp.length < 10) return json({ erro: 'Informe o WhatsApp com DDD.', campo: 'whatsapp' }, 400);
  if (!(await dentroDoLimite(env, 'contato:' + ipDe(req), 5, 864e5))) {
    return json({ erro: 'Recebemos vários pedidos desta conexão hoje. Fale com a gente pelo botão de suporte.' }, 429);
  }
  await salvarContato(env, { loja, whatsapp, cidade });
  return json({ ok: true });
}
