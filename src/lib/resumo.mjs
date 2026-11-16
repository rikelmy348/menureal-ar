/* Resumo semanal por e-mail para cada loja (toda segunda de manhã).
   Só funciona com as variáveis RESEND_API_KEY (secreta) e EMAIL_REMETENTE
   (ex.: "MenuReal <resumo@menureal.com.br>") configuradas na Cloudflare. */
import { resumoSemanal, lojasParaResumo, lerConfig, gravarConfig } from './banco.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dataBr = (d) => d.slice(8, 10) + '/' + d.slice(5, 7);

function variacao(agora, antes) {
  if (!antes && !agora) return '';
  if (!antes) return 'novo';
  const p = Math.round((agora - antes) / antes * 100);
  return p === 0 ? 'igual à semana anterior' : (p > 0 ? '+' : '') + p + '% vs. semana anterior';
}

/** Texto do resumo (o mesmo usado no WhatsApp pelo painel). */
export function textoResumo(loja, r, origem) {
  const orc = loja.tipo === 'produtos' ? 'orçamentos' : 'pedidos';
  const s = r.semana;
  const linhas = [
    `Resumo da semana — ${loja.nome}`,
    `${dataBr(r.desde)} a ${dataBr(r.ate)}`,
    '',
    `• ${s.visita} visitas no catálogo` + (variacao(s.visita, r.anterior.visita) ? ` (${variacao(s.visita, r.anterior.visita)})` : ''),
    `• ${s.ar} abriram a câmera para ver em casa`,
    `• ${s.pedido} ${orc} enviados pelo WhatsApp`
  ];
  if (s.qr) linhas.push(`• ${s.qr} abriram um produto pelo QR das etiquetas`);
  if (r.top.length) linhas.push('', 'Mais vistos:', ...r.top.map((t, i) => `${i + 1}. ${t.nome} (${t.n})`));
  if (!s.visita) linhas.push('', 'Dica: mande o link do catálogo para os clientes e cole as etiquetas com QR Code nos móveis da loja.');
  linhas.push('', `Ver mais: ${origem}/${loja.slug}`);
  return linhas.join('\n');
}

function htmlResumo(loja, r, origem) {
  const orc = loja.tipo === 'produtos' ? 'orçamentos' : 'pedidos';
  const s = r.semana;
  const bloco = (v, rot, extra) => `<td style="padding:12px;background:#F4F1EC;border-radius:12px;text-align:center;width:33%">
    <div style="font-size:28px;font-weight:800;color:#1B1D1A">${v}</div><div style="font-size:13px;color:#55605A">${rot}</div>${extra ? `<div style="font-size:12px;color:#2E7D4F">${esc(extra)}</div>` : ''}</td>`;
  return `<!doctype html><html><body style="margin:0;background:#FAF8F5;font-family:Arial,Helvetica,sans-serif;color:#1B1D1A">
  <div style="max-width:520px;margin:0 auto;padding:24px 16px">
    <p style="margin:0 0 4px;font-size:13px;color:#55605A">Resumo da semana · ${dataBr(r.desde)} a ${dataBr(r.ate)}</p>
    <h1 style="margin:0 0 16px;font-size:22px">${esc(loja.nome)}</h1>
    <table role="presentation" style="width:100%;border-spacing:8px 0"><tr>
      ${bloco(s.visita, 'visitas', variacao(s.visita, r.anterior.visita))}${bloco(s.ar, 'viram na câmera')}${bloco(s.pedido, orc + ' enviados')}
    </tr></table>
    ${r.top.length ? `<h2 style="font-size:16px;margin:22px 0 8px">Mais vistos</h2><ol style="margin:0;padding-left:20px">${r.top.map((t) => `<li style="margin:4px 0">${esc(t.nome)} <span style="color:#55605A">(${t.n})</span></li>`).join('')}</ol>` : ''}
    ${!s.visita ? '<p style="margin:20px 0 0;font-size:14px">Dica: mande o link do catálogo para os clientes e cole as etiquetas com QR Code nos móveis da loja (painel → Divulgar).</p>' : ''}
    <p style="margin:24px 0"><a href="${origem}/${loja.slug}" style="display:inline-block;background:#1B1D1A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">Abrir meu painel</a></p>
    <p style="font-size:12px;color:#8A8F88">Você recebe este resumo toda segunda. Para parar, desligue em Painel → Início → Resumo da semana.</p>
  </div></body></html>`;
}

export function emailConfigurado(env) { return Boolean(env.RESEND_API_KEY && env.EMAIL_REMETENTE); }

async function enviar(env, para, assunto, html, texto) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_REMETENTE, to: [para], subject: assunto, html, text: texto })
  });
  if (!r.ok) throw new Error('Resend ' + r.status + ': ' + (await r.text()).slice(0, 200));
}

/** Chamado pelo agendamento da Cloudflare (wrangler.jsonc → triggers). */
export async function enviarResumos(env) {
  if (!emailConfigurado(env)) { console.log('resumo: e-mail não configurado (RESEND_API_KEY / EMAIL_REMETENTE)'); return; }
  const origem = (env.ENDERECO_SITE || 'https://menureal.com.br').replace(/\/+$/, '');
  const semana = new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);
  let enviados = 0;
  for (const loja of await lojasParaResumo(env)) {
    if (enviados >= 30) break;   // limite de chamadas por execução; a próxima hora continua
    const marca = 'resumo-enviado:' + loja.slug;
    if ((await lerConfig(env, marca)) === semana) continue;   // já foi hoje (agendamento repetido)
    try {
      const r = await resumoSemanal(env, loja.slug);
      await enviar(env, loja.email, `Sua semana no MenuReal: ${r.semana.visita} visitas, ${r.semana.pedido} ${loja.tipo === 'produtos' ? 'orçamentos' : 'pedidos'}`,
        htmlResumo(loja, r, origem), textoResumo(loja, r, origem));
      await gravarConfig(env, marca, semana);
      enviados++;
    } catch (e) { console.error('resumo', loja.slug, e.message); }
  }
  console.log('resumo: enviados', enviados);
}
