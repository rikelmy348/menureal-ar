/* POST /api/sorvete-ar?recipiente=casquinha&sabores=morango.chocolate&coberturas=calda_chocolate.granulado
   Corpo: o GLB que o próprio celular montou (sorvete.mjs, versão leve) → { url } para abrir na câmera.
   Gerar no servidor custaria mais CPU do que o plano grátis da Cloudflare permite, então o
   navegador gera e envia. Proteções: só combinações válidas do catálogo, um arquivo por
   combinação (não sobrescreve), tamanho máximo, conferência do formato e limite por IP. */
import { json, hashCurto, guardarModelo, PREFIXO_ARQUIVO, ipDe } from '../lib/comum.mjs';
import { dentroDoLimite } from '../lib/banco.mjs';
import { SABORES, COBERTURAS, RECIPIENTES } from '../../public/sorvete.mjs';

const VERSAO = 's1';
const LIMITE = 2_500_000;

export default async function sorveteAr(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  const q = new URL(req.url).searchParams;
  const rec = String(q.get('recipiente') || '');
  const sabores = String(q.get('sabores') || '').split('.').filter(Boolean);
  const cobs = String(q.get('coberturas') || '').split('.').filter(Boolean);
  if (!RECIPIENTES[rec] || sabores.length > 6 || cobs.length > 9 || !sabores.every((x) => SABORES[x]) || !cobs.every((x) => COBERTURAS[x])) {
    return json({ erro: 'Combinação inválida.' }, 400);
  }
  const chave = 'combos/sorvete-' + (await hashCurto(VERSAO + '|' + rec + '|' + sabores.join('.') + '|' + [...cobs].sort().join('.'))) + '.glb';
  const { value: existe } = await env.MODELOS.getWithMetadata(chave, 'stream');
  if (existe) { await existe.cancel(); return json({ url: PREFIXO_ARQUIVO + chave, cache: true }); }
  if (!(await dentroDoLimite(env, 'sorvete:' + ipDe(req), 60, 36e5))) return json({ erro: 'Muitas montagens seguidas. Espere um pouco.' }, 429);
  const corpo = new Uint8Array(await req.arrayBuffer());
  if (corpo.length < 64 || corpo.length > LIMITE) return json({ erro: 'Arquivo inválido.' }, 400);
  const dv = new DataView(corpo.buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) return json({ erro: 'Arquivo inválido.' }, 400);
  let gltf;
  try { gltf = JSON.parse(new TextDecoder().decode(corpo.subarray(20, 20 + dv.getUint32(12, true)))); } catch { return json({ erro: 'Arquivo inválido.' }, 400); }
  if (!gltf.asset || gltf.asset.generator !== 'MenuReal · montador de sorvete' || (gltf.images || []).length) return json({ erro: 'Arquivo inválido.' }, 400);
  return json({ url: await guardarModelo(env, chave, corpo, { sorvete: 1 }) });
}
