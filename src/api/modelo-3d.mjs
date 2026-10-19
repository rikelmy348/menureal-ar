/* POST /api/modelo-3d?loja=slug  { imagens:[base64 JPEG, 1 a 4] }        → { tarefa }
   POST /api/modelo-3d?loja=slug  { acao:'reescalar', url, dim, produto }  → { url, medidasCm }
   GET  /api/modelo-3d?loja=slug&tarefa=ID&produto=nome&largura=&profundidade=&altura=
        acompanha; quando pronto, ajusta a escala, guarda no KV e devolve { url }
   Autorização: conta da loja (token) ou código mestre. Variável: MESHY_API_KEY. */
import { json, autorizar, lerSlug, escalarGlb, lerModelo, guardarModelo, erroComStatus } from '../lib/comum.mjs';
import { lerTarefa, salvarTarefa } from '../lib/banco.mjs';

const API = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d';
const LIMITE_GLB = 24_000_000; // KV aceita até 25 MiB por arquivo

const pasta = (slug) => 'modelos/' + (slug ? slug + '/' : '');
const nomeArq = (s) => String(s || 'produto').replace(/[^\w-]/g, '').slice(0, 60) || 'produto';
function lerDim(d) {
  const r = { largura: Number(d && d.largura), profundidade: Number(d && d.profundidade), altura: Number(d && d.altura) };
  return r.largura > 0 && r.profundidade > 0 && r.altura > 0 && Math.max(r.largura, r.profundidade, r.altura) <= 1000 ? r : null;
}

async function meshy(env, caminho, opcoes = {}) {
  const r = await fetch(API + caminho, {
    ...opcoes,
    headers: { authorization: 'Bearer ' + (env.MESHY_API_KEY || '').trim(), 'content-type': 'application/json', ...(opcoes.headers || {}) }
  });
  const texto = await r.text();
  let dados = {};
  try { dados = JSON.parse(texto); } catch { /* resposta não-JSON */ }
  if (!r.ok) {
    console.error('Meshy respondeu', r.status, texto.slice(0, 500));
    throw erroComStatus(r.status === 401 ? 'A chave da Meshy (MESHY_API_KEY) é inválida.'
      : r.status === 402 ? 'Sem créditos na Meshy. Compre créditos de API na conta da Meshy.'
      : r.status === 429 ? 'Muitos pedidos à Meshy agora. Aguarde um minuto e tente de novo.'
      : r.status === 400 ? 'A Meshy recusou as fotos: ' + (dados.message || 'verifique o formato.')
      : 'O serviço de modelos 3D está indisponível no momento.', 502);
  }
  return dados;
}

const SEM_MESHY = 'Servidor não configurado: defina MESHY_API_KEY nas variáveis do Worker na Cloudflare.';

export default async function modelo3d(req, env) {
  const u = new URL(req.url);
  const slug = lerSlug(req);
  await autorizar(req, env, slug);

  if (req.method === 'POST') {
    let corpo;
    try { corpo = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }

    // Ajustar o tamanho de um modelo existente (não gasta créditos)
    if (corpo && corpo.acao === 'reescalar') {
      const dim = lerDim(corpo.dim);
      if (!dim) return json({ erro: 'Medidas inválidas.' }, 400);
      let atual = null;
      try { atual = await lerModelo(env, corpo.url); } catch (e) { console.error('reescalar: falha ao ler', corpo.url, e); }
      if (!atual) return json({ erro: 'Modelo 3D não encontrado. Gere o 3D do produto primeiro.' }, 404);
      const { glb, medidasCm } = escalarGlb(atual, dim);
      const chave = pasta(slug) + nomeArq(corpo.produto) + '-' + Date.now().toString(36) + '.glb';
      return json({ url: await guardarModelo(env, chave, glb, { dim }), medidasCm });
    }

    if (!(env.MESHY_API_KEY || '').trim()) return json({ erro: SEM_MESHY }, 500);
    const imagens = Array.isArray(corpo && corpo.imagens) ? corpo.imagens.filter((x) => typeof x === 'string' && x) : [];
    if (imagens.length < 1 || imagens.length > 4) return json({ erro: 'Envie de 1 a 4 fotos.' }, 400);
    if (imagens.some((x) => x.length > 4_000_000)) return json({ erro: 'Foto grande demais.' }, 413);
    const r = await meshy(env, '', {
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
    if (!(env.MESHY_API_KEY || '').trim()) return json({ erro: SEM_MESHY }, 500);
    const tarefa = u.searchParams.get('tarefa') || '';
    const dim = lerDim({ largura: u.searchParams.get('largura'), profundidade: u.searchParams.get('profundidade'), altura: u.searchParams.get('altura') });
    if (!/^[\w-]{6,80}$/.test(tarefa)) return json({ erro: 'Tarefa inválida.' }, 400);
    if (!dim) return json({ erro: 'Medidas inválidas.' }, 400);

    const pronto = await lerTarefa(env, tarefa);
    if (pronto) return json({ status: 'SUCCEEDED', progresso: 100, ...pronto });

    const t = await meshy(env, '/' + encodeURIComponent(tarefa));
    if (t.status === 'FAILED' || t.status === 'CANCELED') {
      return json({ status: t.status, erro: (t.task_error && t.task_error.message) || 'A geração do modelo falhou. Tente com outras fotos.' });
    }
    if (t.status !== 'SUCCEEDED') return json({ status: t.status, progresso: t.progress || 0 });

    const urlGlb = t.model_urls && t.model_urls.glb;
    if (!urlGlb) return json({ status: 'FAILED', erro: 'A Meshy não devolveu o arquivo GLB.' });
    const r = await fetch(urlGlb);
    if (!r.ok) return json({ status: 'FAILED', erro: 'Não foi possível baixar o modelo gerado.' });
    const { glb, medidasCm } = escalarGlb(new Uint8Array(await r.arrayBuffer()), dim);
    if (glb.length > LIMITE_GLB) return json({ status: 'FAILED', erro: 'O modelo gerado ficou pesado demais (' + (glb.length / 1e6).toFixed(1) + ' MB).' });

    const chave = pasta(slug) + nomeArq(u.searchParams.get('produto')) + '-' + Date.now().toString(36) + '.glb';
    const url = await guardarModelo(env, chave, glb, { tarefa, dim });
    const resultado = { url, miniatura: t.thumbnail_url || '', medidasCm, tamanhoMb: +(glb.length / 1e6).toFixed(1) };
    await salvarTarefa(env, tarefa, slug, resultado);
    return json({ status: 'SUCCEEDED', progresso: 100, ...resultado });
  }

  return json({ erro: 'Use POST ou GET.' }, 405);
}
