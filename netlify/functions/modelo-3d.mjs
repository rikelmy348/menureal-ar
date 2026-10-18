/* =========================================================================
   MenuReal AR — gera um modelo 3D realista a partir de fotos (Meshy)
   POST /api/modelo-3d                 inicia: { imagens:[base64 JPEG, 1 a 4] }
   GET  /api/modelo-3d?tarefa=ID&produto=ID&largura=&profundidade=&altura=
        acompanha; quando pronto, ajusta a escala às medidas reais, guarda na
        nuvem e devolve { status:'SUCCEEDED', url }

   Variáveis de ambiente: MESHY_API_KEY, MENUREAL_CODIGO
   ========================================================================= */
import { loja, json, exigirCodigo, escalarGlb } from '../lib/comum.mjs';

const API = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const LIMITE_GLB = 19_000_000; // respostas em streaming da Netlify: até 20 MB

function chaveMeshy() { return (process.env.MESHY_API_KEY || '').trim(); }

async function meshy(caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: { authorization: 'Bearer ' + chaveMeshy(), 'content-type': 'application/json', ...(opcoes.headers || {}) }
  });
  const texto = await r.text();
  let dados = {};
  try { dados = JSON.parse(texto); } catch { /* resposta não-JSON */ }
  if (!r.ok) {
    console.error('Meshy respondeu', r.status, texto.slice(0, 500));
    const msg = r.status === 401 ? 'A chave da Meshy (MESHY_API_KEY) é inválida.'
      : r.status === 402 ? 'Sem créditos na Meshy. Compre créditos de API na conta da Meshy.'
      : r.status === 429 ? 'Muitos pedidos à Meshy agora. Aguarde um minuto e tente de novo.'
      : r.status === 400 ? 'A Meshy recusou as fotos: ' + (dados.message || 'verifique o formato.')
      : 'O serviço de modelos 3D está indisponível no momento.';
    const e = new Error(msg); e.status = 502; throw e;
  }
  return dados;
}

export default async (req) => {
  const negado = exigirCodigo(req);
  if (negado) return negado;
  if (!chaveMeshy()) return json({ erro: 'Servidor não configurado: defina MESHY_API_KEY na Netlify.' }, 500);

  try {
    if (req.method === 'POST') {
      let corpo;
      try { corpo = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
      const imagens = Array.isArray(corpo && corpo.imagens) ? corpo.imagens.filter((x) => typeof x === 'string' && x) : [];
      if (imagens.length < 1 || imagens.length > 4) return json({ erro: 'Envie de 1 a 4 fotos.' }, 400);
      if (imagens.some((x) => x.length > 4_000_000)) return json({ erro: 'Foto grande demais.' }, 413);
      const r = await meshy('', {
        method: 'POST',
        body: JSON.stringify({
          image_urls: imagens.map((b) => 'data:image/jpeg;base64,' + b),
          ai_model: 'latest',
          should_texture: true,
          enable_pbr: true,
          should_remesh: true,
          target_polycount: 40000, // leve o bastante para celulares
          target_formats: ['glb']
        })
      });
      return json({ tarefa: r.result });
    }

    if (req.method === 'GET') {
      const u = new URL(req.url);
      const tarefa = u.searchParams.get('tarefa') || '';
      const produto = (u.searchParams.get('produto') || 'produto').replace(/[^\w-]/g, '').slice(0, 60) || 'produto';
      const dim = {
        largura: Number(u.searchParams.get('largura')),
        profundidade: Number(u.searchParams.get('profundidade')),
        altura: Number(u.searchParams.get('altura'))
      };
      if (!/^[\w-]{6,80}$/.test(tarefa)) return json({ erro: 'Tarefa inválida.' }, 400);
      if (!(dim.largura > 0 && dim.profundidade > 0 && dim.altura > 0)) return json({ erro: 'Medidas inválidas.' }, 400);

      const store = loja();
      const pronto = await store.get('tarefas/' + tarefa, { type: 'json' });
      if (pronto) return json({ status: 'SUCCEEDED', progresso: 100, ...pronto });

      const t = await meshy('/' + encodeURIComponent(tarefa));
      if (t.status === 'FAILED' || t.status === 'CANCELED') {
        return json({ status: t.status, erro: (t.task_error && t.task_error.message) || 'A geração do modelo falhou. Tente com outras fotos.' });
      }
      if (t.status !== 'SUCCEEDED') return json({ status: t.status, progresso: t.progress || 0 });

      const urlGlb = t.model_urls && t.model_urls.glb;
      if (!urlGlb) return json({ status: 'FAILED', erro: 'A Meshy não devolveu o arquivo GLB.' });
      const r = await fetch(urlGlb);
      if (!r.ok) return json({ status: 'FAILED', erro: 'Não foi possível baixar o modelo gerado.' });
      const original = new Uint8Array(await r.arrayBuffer());
      const { glb, medidasCm } = escalarGlb(original, dim);
      if (glb.length > LIMITE_GLB) return json({ status: 'FAILED', erro: 'O modelo gerado ficou pesado demais (' + (glb.length / 1e6).toFixed(1) + ' MB).' });

      const chave = 'modelos/' + produto + '-' + Date.now().toString(36) + '.glb';
      await store.set(chave, glb, { metadata: { produto, tarefa, dim } });
      const resultado = { url: 'api/arquivo/' + chave, miniatura: t.thumbnail_url || '', medidasCm, tamanhoMb: +(glb.length / 1e6).toFixed(1) };
      await store.setJSON('tarefas/' + tarefa, resultado);
      return json({ status: 'SUCCEEDED', progresso: 100, ...resultado });
    }

    return json({ erro: 'Use POST ou GET.' }, 405);
  } catch (e) {
    console.error(e);
    return json({ erro: e.message || 'Erro inesperado.' }, e.status || 500);
  }
};

export const config = { path: '/api/modelo-3d' };
