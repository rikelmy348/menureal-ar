/* GET /api/arquivo/(modelos|combos)/<nome>.glb  e  /api/arquivo/imagens/<loja>/<nome>.(webp|png|jpg)   público (clientes, Scene Viewer, Quick Look) */
import { json } from '../lib/comum.mjs';

export default async function arquivo(req, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ erro: 'Use GET.' }, 405);
  const chave = decodeURIComponent(new URL(req.url).pathname.replace(/^\/api\/arquivo\//, ''));
  const modelo = /^(modelos|combos)\/(?:[a-z0-9-]+\/)?[\w.-]+\.glb$/.test(chave);
  const foto = /^imagens\/[a-z0-9_-]+\/[\w.-]+\.(webp|png|jpg)$/.exec(chave);
  if ((!modelo && !foto) || chave.includes('..')) return json({ erro: 'Arquivo inválido.' }, 400);
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
