/* GET /api/arquivo/(modelos|combos)/<nome>.glb  e  /api/arquivo/imagens/<loja>/<nome>.(webp|png|jpg)   público (clientes, Scene Viewer, Quick Look) */
import { json } from '../lib/comum.mjs';
import { escolherVariante } from '../../public/glb.mjs';

export default async function arquivo(req, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ erro: 'Use GET.' }, 405);
  const chave = decodeURIComponent(new URL(req.url).pathname.replace(/^\/api\/arquivo\//, ''));
  const modelo = /^(modelos|combos)\/(?:[a-z0-9-]+\/)?[\w.-]+\.glb$/.test(chave);
  const foto = /^imagens\/[a-z0-9_-]+\/[\w.-]+\.(webp|png|jpg)$/.exec(chave);
  if ((!modelo && !foto) || chave.includes('..')) return json({ erro: 'Arquivo inválido.' }, 400);
  // ?cor=Nome: o mesmo 3D já na cor escolhida (para a câmera do Android). Fica guardado no cache da Cloudflare.
  const cor = modelo ? (new URL(req.url).searchParams.get('cor') || '').slice(0, 60) : '';
  if (cor && req.method === 'GET') {
    const cache = caches.default, chaveCache = new Request(new URL(req.url).toString());
    const salvo = await cache.match(chaveCache);
    if (salvo) return salvo;
    const buf = await env.MODELOS.get(chave, 'arrayBuffer');
    if (!buf) return json({ erro: 'Arquivo não encontrado.' }, 404);
    let saida = null;
    try { saida = escolherVariante(new Uint8Array(buf), cor); } catch (e) { saida = null; }
    const resp = new Response(saida || buf, { headers: { 'content-type': 'model/gltf-binary', 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' } });
    try { await cache.put(chaveCache, resp.clone()); } catch (e) { /* sem cache: segue */ }
    return resp;
  }
  const dados = await env.MODELOS.get(chave, 'stream');
  if (!dados) return json({ erro: 'Arquivo não encontrado.' }, 404);
  return new Response(req.method === 'HEAD' ? null : dados, {
    headers: {
      'content-type': foto ? { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' }[foto[1]] : 'model/gltf-binary',
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*'
    }
  });
}
