/* POST /api/modelo-arquivo?loja=slug&nome=...   corpo: o arquivo 3D do produto (.glb)
   → { url }   A loja envia o arquivo real do móvel (normalmente fornecido pela fábrica).
   O navegador já confere formato e medidas; aqui só o essencial (barato em CPU):
   assinatura glTF binário, versão 2, tamanho máximo e cabeçalho JSON legível. */
import { json, autorizar, lerSlug, guardarModelo } from '../lib/comum.mjs';

const LIMITE = 25 * 1024 * 1024;   // limite de um valor no KV da Cloudflare

export default async function modeloArquivo(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const u = new URL(req.url);
  const slug = lerSlug(req);
  await autorizar(req, env, slug);
  const tam = Number(req.headers.get('content-length') || 0);
  if (tam > LIMITE) return json({ erro: 'Arquivo grande demais (máximo 25 MB).' }, 413);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length < 20) return json({ erro: 'Arquivo vazio.' }, 400);
  if (bytes.length > LIMITE) return json({ erro: 'Arquivo grande demais (máximo 25 MB).' }, 413);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(4, true) !== 2) return json({ erro: 'O arquivo não é um modelo 3D .glb (glTF 2.0).' }, 400);
  const lenJson = dv.getUint32(12, true);
  let gltf = null;
  try { gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + lenJson))); } catch { /* inválido */ }
  if (!gltf || !gltf.asset || !Array.isArray(gltf.meshes) || !gltf.meshes.length) return json({ erro: 'O arquivo .glb não tem nenhum objeto 3D.' }, 400);
  const nome = String(u.searchParams.get('nome') || 'produto').replace(/[^\w-]/g, '').slice(0, 60) || 'produto';
  const chave = 'modelos/' + (slug ? slug + '/' : '') + nome + '-' + Date.now().toString(36) + '.glb';
  return json({ url: await guardarModelo(env, chave, bytes, { enviado: true }) });
}
