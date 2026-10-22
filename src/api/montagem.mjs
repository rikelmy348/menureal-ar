/* POST /api/montagem  { base: 'assets/models/...glb' | 'api/arquivo/modelos/...glb', camadas: ['granola', 'banana', ...] }
   → { url }   Açaí montado (copo + coberturas) num arquivo só, para abrir na câmera.
   Público, como o combo; o resultado fica guardado (mesma escolha = mesmo arquivo). */
import { json, hashCurto, lerModelo, guardarModelo, montarAcai, ADICIONAIS_3D, PREFIXO_ARQUIVO } from '../lib/comum.mjs';

const VERSAO = 'v2-vidro';

export default async function montagem(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const base = String((d && d.base) || '');
  const camadas = [...new Set((Array.isArray(d && d.camadas) ? d.camadas : []).map(String))].filter((t) => ADICIONAIS_3D[t]).sort();
  if (!base) return json({ erro: 'Informe o modelo do copo.' }, 400);
  if (!camadas.length) return json({ url: base });
  // VERSAO muda quando os modelos dos adicionais mudam (não reaproveita montagens antigas)
  const chave = 'combos/acai-' + (await hashCurto(VERSAO + '|' + base + '|' + camadas.join(','))) + '.glb';
  const { value: existe } = await env.MODELOS.getWithMetadata(chave, 'stream');
  if (existe) { await existe.cancel(); return json({ url: PREFIXO_ARQUIVO + chave, cache: true }); }
  const copo = await lerModelo(env, base).catch(() => null);
  if (!copo) return json({ erro: 'Modelo do copo não encontrado.' }, 404);
  const partes = [];
  for (const tipo of camadas) {
    const r = await env.ASSETS.fetch(new Request('https://site/assets/adicionais/' + tipo + '.glb'));
    if (!r.ok) return json({ erro: 'Adicional sem 3D: ' + tipo }, 404);
    partes.push({ tipo, buf: new Uint8Array(await r.arrayBuffer()) });
  }
  let glb;
  try { glb = montarAcai(copo, partes); } catch (e) { return json({ erro: 'Não foi possível montar: ' + e.message }, 422); }
  return json({ url: await guardarModelo(env, chave, glb, { camadas: camadas.length }) });
}
