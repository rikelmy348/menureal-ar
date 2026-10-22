/* =========================================================================
   MenuReal AR — Cloudflare Worker
   /api/*  → funções abaixo;  o resto → arquivos de ./public (index.html para
   qualquer endereço de loja, ex.: /sabor-da-vila).
   ========================================================================= */
import { json } from './lib/comum.mjs';
import { garantirEsquema } from './lib/banco.mjs';
import cardapio from './api/cardapio.mjs';
import contas from './api/contas.mjs';
import entrar from './api/entrar.mjs';
import lerCardapio from './api/ler-cardapio.mjs';
import modelo3d from './api/modelo-3d.mjs';
import arquivo from './api/arquivo.mjs';
import combo from './api/combo.mjs';
import imagem from './api/imagem.mjs';
import montagem from './api/montagem.mjs';

const ROTAS = {
  '/api/cardapio': cardapio,
  '/api/contas': contas,
  '/api/entrar': entrar,
  '/api/ler-cardapio': lerCardapio,
  '/api/modelo-3d': modelo3d,
  '/api/combo': combo,
  '/api/imagem': imagem,
  '/api/montagem': montagem
};

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
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
