/* GET /api/arquivo/(modelos|combos)/<nome>.glb   público (clientes, Scene Viewer, Quick Look) */
import { json } from '../lib/comum.mjs';

export default async function arquivo(req, env) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ erro: 'Use GET.' }, 405);
  const chave = decodeURIComponent(new URL(req.url).pathname.replace(/^\/api\/arquivo\//, ''));
  if (!/^(modelos|combos)\/(?:[a-z0-9-]+\/)?[\w.-]+\.glb$/.test(chave) || chave.includes('..')) return json({ erro: 'Arquivo inválido.' }, 400);
  const dados = await env.MODELOS.get(chave, 'stream');
  if (!dados) return json({ erro: 'Modelo não encontrado.' }, 404);
  return new Response(req.method === 'HEAD' ? null : dados, {
    headers: {
      'content-type': 'model/gltf-binary',
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*'
    }
  });
}
