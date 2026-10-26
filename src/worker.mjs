/* =========================================================================
   MenuReal AR — Cloudflare Worker
   /api/*  → funções abaixo;  o resto → arquivos de ./public (index.html para
   qualquer endereço de loja, ex.: /sabor-da-vila).
   ========================================================================= */
import { json, slugValido } from './lib/comum.mjs';
import { garantirEsquema, resumoLoja } from './lib/banco.mjs';
import cardapio from './api/cardapio.mjs';
import contas from './api/contas.mjs';
import entrar from './api/entrar.mjs';
import lerCardapio from './api/ler-cardapio.mjs';
import modelo3d from './api/modelo-3d.mjs';
import arquivo from './api/arquivo.mjs';
import combo from './api/combo.mjs';
import imagem from './api/imagem.mjs';
import cadastro from './api/cadastro.mjs';
import recuperar from './api/recuperar.mjs';
import conta from './api/conta.mjs';
import evento from './api/evento.mjs';
import modeloArquivo from './api/modelo-arquivo.mjs';

const ROTAS = {
  '/api/cardapio': cardapio,
  '/api/contas': contas,
  '/api/entrar': entrar,
  '/api/ler-cardapio': lerCardapio,
  '/api/modelo-3d': modelo3d,
  '/api/combo': combo,
  '/api/imagem': imagem,
  '/api/cadastro': cadastro,
  '/api/recuperar': recuperar,
  '/api/conta': conta,
  '/api/evento': evento,
  '/api/modelo-arquivo': modeloArquivo
};

// ---------------------------------------------------------------------------
// Prévia do link (WhatsApp, Instagram, Facebook): título, descrição e imagem
// da loja já no HTML, porque esses apps não executam JavaScript.
// ---------------------------------------------------------------------------
const PAGINAS_FIXAS = {
  '': { titulo: 'MenuReal — seus móveis em 3D, na casa do cliente', desc: 'O cliente vê o sofá, a mesa ou a estante no tamanho real, na sala dele, pela câmera do celular. E pede o orçamento no WhatsApp. 7 dias grátis.' },
  criar: { titulo: 'Crie o catálogo 3D da sua loja de móveis — MenuReal', desc: 'Cadastro em 2 minutos, 7 dias grátis. Seus móveis em 3D e no tamanho real, na casa do cliente.' }
};
function escAttr(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function paginaComPrevia(req, env, caminho) {
  const url = new URL(req.url);
  const base = await env.ASSETS.fetch(new Request(new URL('/', url), { headers: req.headers }));
  if (!base.ok || !/text\/html/.test(base.headers.get('content-type') || '')) return base;
  let info = PAGINAS_FIXAS[caminho];
  let imagem = url.origin + '/assets/og.jpg';
  if (!info) {
    let loja = null;
    try { if (env.DB) { await garantirEsquema(env); loja = await resumoLoja(env, caminho); } } catch (e) { console.error('previa', e); }
    if (!loja) return base;
    const v = loja.visual;
    info = { titulo: loja.nome + (loja.tipo === 'produtos' ? ' — catálogo' : ' — cardápio'),
      desc: loja.slogan || (loja.tipo === 'produtos' ? 'Veja os móveis em 3D, no tamanho real, na sua casa. Peça o orçamento pelo WhatsApp.' : 'Veja o cardápio em 3D e peça pelo WhatsApp.') };
    if (v.og || v.capa || v.logo) imagem = url.origin + '/' + (v.og || v.capa || v.logo);
  }
  const metas = [
    ['property', 'og:type', 'website'], ['property', 'og:site_name', 'MenuReal'], ['property', 'og:title', info.titulo],
    ['property', 'og:description', info.desc], ['property', 'og:url', url.origin + url.pathname], ['property', 'og:image', imagem],
    ['property', 'og:locale', 'pt_BR'], ['name', 'twitter:card', 'summary_large_image']
  ].map(([a, k, v]) => `<meta ${a}="${k}" content="${escAttr(v)}">`).join('');
  const html = new HTMLRewriter()
    .on('title', { element(el) { el.setInnerContent(info.titulo); } })
    .on('meta[name="description"]', { element(el) { el.setAttribute('content', info.desc); } })
    .on('head', { element(el) { el.append(metas, { html: true }); } })
    .transform(base);
  const h = new Headers(html.headers);
  h.set('cache-control', 'public, max-age=60');
  return new Response(html.body, { status: 200, headers: h });
}

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith('/api/')) {
      // página inicial, /criar e /<loja>: HTML com a prévia do link; o resto são arquivos
      const caminho = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, '').toLowerCase();
      if ((req.method === 'GET' || req.method === 'HEAD') && (caminho in PAGINAS_FIXAS || slugValido(caminho))) {
        try { return await paginaComPrevia(req, env, caminho); } catch (e) { console.error('previa', e); }
      }
      return env.ASSETS.fetch(req);
    }
    try {
      if (pathname.startsWith('/api/arquivo/')) return await arquivo(req, env);
      const rota = ROTAS[pathname.replace(/\/+$/, '')];
      if (!rota) return json({ erro: 'Endereço não encontrado.' }, 404);
      if (rota === lerCardapio && req.method === 'GET') return await rota(req, env); // diagnóstico funciona mesmo sem banco
      if (!env.DB) return json({ erro: 'Banco de dados não ligado ao Worker (binding DB).' }, 500);
      await garantirEsquema(env);
      return await rota(req, env);
    } catch (e) {
      if (e && e.status && e.status < 500) return json({ erro: e.message }, e.status);
      console.error(pathname, e);
      return json({ erro: (e && e.status && e.message) || 'Erro no servidor. Tente de novo em instantes.' }, (e && e.status) || 500);
    }
  }
};
