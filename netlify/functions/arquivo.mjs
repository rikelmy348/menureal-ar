/* =========================================================================
   MenuReal AR — serve os modelos 3D guardados na nuvem
   GET /api/arquivo/modelos/<nome>.glb   público (clientes, Scene Viewer, Quick Look)
   ========================================================================= */
import { loja, json } from '../lib/comum.mjs';

export default async (req) => {
  const chave = decodeURIComponent(new URL(req.url).pathname.replace(/^\/api\/arquivo\//, ''));
  if (!/^(modelos|combos)\/(?:[a-z0-9-]+\/)?[\w.-]+\.glb$/.test(chave) || chave.includes('..')) return json({ erro: 'Arquivo inválido.' }, 400);
  const dados = await loja().get(chave, { type: 'stream' });
  if (!dados) return json({ erro: 'Modelo não encontrado.' }, 404);
  return new Response(dados, {
    headers: {
      'content-type': 'model/gltf-binary',
      'cache-control': 'public, max-age=31536000, immutable',
      'access-control-allow-origin': '*'
    }
  });
};

export const config = { path: '/api/arquivo/*' };
