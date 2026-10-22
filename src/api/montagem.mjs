/* POST /api/montagem  { base: 'assets/models/...glb' | 'api/arquivo/modelos/...glb', camadas: ['granola', 'banana', ...] }
   → { url }   Açaí montado (copo + coberturas) num arquivo só, para abrir na câmera.
   Público, como o combo; o resultado fica guardado (mesma escolha = mesmo arquivo). */
import { json, hashCurto, lerModelo, guardarModelo, montarAcai, ADICIONAIS_3D, arquivoDe, VISUAL_CAMADA, bibliotecasDe, PREFIXO_ARQUIVO } from '../lib/comum.mjs';

const VERSAO = 'v5-montador';

export default async function montagem(req, env) {
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const base = String((d && d.base) || '');
  const camadas = [...new Set((Array.isArray(d && d.camadas) ? d.camadas : []).map(String))].filter((t) => ADICIONAIS_3D[t]).sort();
  // pilha: camadas montadas pelo cliente, de baixo para cima (ordem importa, pode repetir)
  const pilha = Array.isArray(d && d.pilha) ? d.pilha.map(String).filter((t) => VISUAL_CAMADA[t]).slice(0, 30) : null;
  if (!base) return json({ erro: 'Informe o modelo do copo.' }, 400);
  if (!camadas.length && !pilha) return json({ url: base });
  // VERSAO muda quando os modelos dos adicionais mudam (não reaproveita montagens antigas)
  const chave = 'combos/acai-' + (await hashCurto(VERSAO + '|' + base + '|' + camadas.join(',') + '|' + (pilha ? pilha.join('.') : '-'))) + '.glb';
  const { value: existe } = await env.MODELOS.getWithMetadata(chave, 'stream');
  if (existe) { await existe.cancel(); return json({ url: PREFIXO_ARQUIVO + chave, cache: true }); }
  const copo = await lerModelo(env, base).catch(() => null);
  if (!copo) return json({ erro: 'Modelo do copo não encontrado.' }, 404);
  const partes = [];
  for (const tipo of camadas) {
    const arq = arquivoDe(tipo);   // camadas internas de creme/Nutella não precisam de arquivo
    if (!arq) { partes.push({ tipo, buf: null }); continue; }
    const r = await env.ASSETS.fetch(new Request('https://site/assets/adicionais/' + arq + '.glb'));
    if (!r.ok) return json({ erro: 'Adicional sem 3D: ' + tipo }, 404);
    partes.push({ tipo, buf: new Uint8Array(await r.arrayBuffer()) });
  }
  const libs = {};
  for (const nome of pilha ? bibliotecasDe(pilha) : []) {
    const r = await env.ASSETS.fetch(new Request('https://site/assets/adicionais/' + nome + '.glb'));
    if (r.ok) libs[nome] = new Uint8Array(await r.arrayBuffer());
  }
  let glb;
  try { glb = montarAcai(copo, partes, { pilha, libs }); } catch (e) { return json({ erro: 'Não foi possível montar: ' + e.message }, 422); }
  return json({ url: await guardarModelo(env, chave, glb, { camadas: camadas.length }) });
}
