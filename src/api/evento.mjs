/* POST /api/evento  { loja, tipo, chave }   público (contagem anônima; o navegador evita repetir)
   GET  /api/evento?loja=slug&dias=30        conta da loja → contagens por dia
   Tipos: visita, produto (chave = id do produto), ar (viu na mesa), pedido (enviou pelo WhatsApp). */
import { json, autorizar, lerSlug, slugValido } from '../lib/comum.mjs';
import { lojaExiste, registrarEvento, lerEventos } from '../lib/banco.mjs';

const TIPOS = ['visita', 'produto', 'ar', 'pedido'];

export default async function evento(req, env) {
  if (req.method === 'GET') {
    const slug = lerSlug(req);
    if (!slug) return json({ erro: 'Informe a loja.' }, 400);
    await autorizar(req, env, slug);
    const dias = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get('dias')) || 30));
    return json(await lerEventos(env, slug, dias));
  }
  if (req.method !== 'POST') return json({ erro: 'Use GET ou POST.' }, 405);
  let d;
  try { d = JSON.parse((await req.text()).slice(0, 500)); } catch { return new Response(null, { status: 204 }); }
  const slug = String(d.loja || '').toLowerCase();
  const tipo = TIPOS.includes(d.tipo) ? d.tipo : null;
  const chave = tipo === 'produto' ? String(d.chave || '').replace(/[^\w-]/g, '').slice(0, 80) : '';
  if (!tipo || !slugValido(slug) || (tipo === 'produto' && !chave)) return new Response(null, { status: 204 });
  if (await lojaExiste(env, slug)) await registrarEvento(env, slug, tipo, chave);
  return new Response(null, { status: 204 });
}
