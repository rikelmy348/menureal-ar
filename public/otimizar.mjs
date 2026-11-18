/* =========================================================================
   MenuReal — deixa o arquivo 3D (GLB) mais leve para abrir rápido no 4G
   1. Texturas: reduz para no máximo 2048 px (cor) / 1024 px (relevo, brilho…)
      e salva em JPEG quando não há transparência.
   2. Geometria: guarda posições, normais e coordenadas de textura em números
      menores (extensão padrão KHR_mesh_quantization, que o model-viewer, o
      Android e o iPhone entendem). Diferença menor que 0,1 mm.
   Não muda medidas, cores, variantes de cor nem pontos de informação.
   ========================================================================= */
import { lerGlb, escreverGlb } from './glb.mjs';

const TAM = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function lerAcessor(json, bin, ai) {
  const a = json.accessors[ai], bv = json.bufferViews[a.bufferView];
  const n = COMP[a.type], t = TAM[a.componentType], passo = bv.byteStride || n * t;
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = new Float32Array(a.count * n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) out[i * n + k] = dv.getFloat32(base + i * passo + k * 4, true);
  return out;
}

async function reduzirImagem(bytes, tipo, lado, transparente, qualidade) {
  let bmp;
  try { bmp = await createImageBitmap(new Blob([bytes], { type: tipo }), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); } catch { return null; }
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, w, h);
  const mime = transparente ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((ok) => cv.toBlob(ok, mime, qualidade));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), tipo: mime };
}

/** Devolve { glb, antes, depois } (bytes). Se não der para melhorar, devolve o original. */
export async function otimizarGlb(entrada, opcoes) {
  const op = Object.assign({ ladoCor: 2048, ladoOutros: 1024 }, opcoes || {});
  const { json, bin } = lerGlb(entrada);
  const antes = entrada.length;
  const usados = new Set([...(json.extensionsUsed || []), ...(json.extensionsRequired || [])]);
  const temBuffers = (json.buffers || []).length === 1 && (json.bufferViews || []).every((v) => (v.buffer || 0) === 0);
  if (!temBuffers) return { glb: entrada, antes, depois: antes };

  // ---------- quem usa cada imagem (cor com/sem transparência, ou mapas técnicos)
  const papel = {};   // imagem → { cor: bool, alfa: bool }
  const fonte = (ti) => { const t = json.textures && json.textures[ti]; return t ? (t.source != null ? t.source : -1) : -1; };
  const marcar = (info, cor, alfa) => { if (!info) return; const ii = fonte(info.index); if (ii < 0) return; const p = papel[ii] || (papel[ii] = { cor: false, alfa: false, outro: false }); if (cor) p.cor = true; else p.outro = true; if (alfa) p.alfa = true; };
  for (const m of json.materials || []) {
    const pbr = m.pbrMetallicRoughness || {}, alfa = m.alphaMode === 'BLEND' || m.alphaMode === 'MASK';
    marcar(pbr.baseColorTexture, true, alfa);
    marcar(pbr.metallicRoughnessTexture, false); marcar(m.normalTexture, false); marcar(m.occlusionTexture, false);
    marcar(m.emissiveTexture, true, false);
    for (const ex of Object.values(m.extensions || {})) for (const [k, v] of Object.entries(ex || {})) if (/Texture$/.test(k) && v && v.index != null) marcar(v, /Color/.test(k), /sheenColor|specularColor/.test(k) ? false : false);
  }
  // ---------- novos dados de cada bufferView (null = mantém)
  const novos = {};
  for (let ii = 0; ii < (json.images || []).length; ii++) {
    const im = json.images[ii];
    if (im.bufferView == null) continue;
    const bv = json.bufferViews[im.bufferView], tipo = im.mimeType || 'image/png';
    if (!/png|jpeg/.test(tipo)) continue;
    const p = papel[ii] || { cor: true, alfa: true };
    const orig = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    const r = await reduzirImagem(orig, tipo, p.cor ? op.ladoCor : op.ladoOutros, p.alfa || (tipo === 'image/png' && p.cor && !p.outro && false), p.outro && !p.cor ? 0.9 : 0.86);
    if (r && r.bytes.length < orig.length * 0.9) { novos[im.bufferView] = r.bytes; im.mimeType = r.tipo; }
  }

  // ---------- geometria em números menores
  const podeGeo = !['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_mesh_quantization'].some((e) => usados.has(e))
    && !(json.skins || []).length && !(json.accessors || []).some((a) => a.sparse);
  const trocaAcessor = {};   // acessor antigo → novo
  const extras = [];          // bufferViews novos { bytes, stride }
  if (podeGeo) {
    const usoPos = {};   // acessor POSITION → meshes que usam
    (json.meshes || []).forEach((m, mi) => m.primitives.forEach((p) => {
      const ap = p.attributes && p.attributes.POSITION;
      if (ap != null) (usoPos[ap] = usoPos[ap] || new Set()).add(mi);
    }));
    const quantPos = {};   // mesh → { c, s }
    (json.meshes || []).forEach((m, mi) => {
      if (m.primitives.some((p) => p.targets || p.attributes.POSITION == null)) return;
      const aps = [...new Set(m.primitives.map((p) => p.attributes.POSITION))];
      if (aps.some((ap) => usoPos[ap].size > 1 || json.accessors[ap].componentType !== 5126)) return;
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      aps.forEach((ap) => { const a = json.accessors[ap]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a.min[k]); mx[k] = Math.max(mx[k], a.max[k]); } });
      const c = mn.map((v, k) => (v + mx[k]) / 2), s = mn.map((v, k) => Math.max((mx[k] - v) / 2, 1e-6));
      quantPos[mi] = { c, s, aps };
    });
    const novoAcessor = (base, bytes, stride, comp, normalizado, min, max) => {
      extras.push({ bytes, stride });
      const a = { bufferView: -extras.length, componentType: comp, count: base.count, type: base.type, normalized: normalizado };
      if (min) { a.min = min; a.max = max; }
      json.accessors.push(a);
      return json.accessors.length - 1;
    };
    // posições: inteiros de 16 bits dentro da caixa do objeto (passo de 8 bytes por vértice)
    for (const [mi, q] of Object.entries(quantPos)) {
      for (const ap of q.aps) {
        const a = json.accessors[ap], f = lerAcessor(json, bin, ap), n = a.count;
        const buf = new Int16Array(n * 4), mn = [32767, 32767, 32767], mx = [-32767, -32767, -32767];
        for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
          const v = Math.max(-32767, Math.min(32767, Math.round((f[i * 3 + k] - q.c[k]) / q.s[k] * 32767)));
          buf[i * 4 + k] = v; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
        }
        trocaAcessor[ap] = novoAcessor(a, new Uint8Array(buf.buffer), 8, 5122, true, mn, mx);   // min/max nos inteiros guardados (regra do glTF)
      }
    }
    // normais e tangentes: bytes; coordenadas de textura: 16 bits sem sinal quando ficam entre 0 e 1
    const feitos = new Set();
    for (const m of json.meshes || []) for (const p of m.primitives) for (const [nome, ai] of Object.entries(p.attributes)) {
      if (feitos.has(ai) || trocaAcessor[ai] != null) continue;
      const a = json.accessors[ai];
      if (a.componentType !== 5126) continue;
      if (nome === 'NORMAL' || nome === 'TANGENT') {
        feitos.add(ai);
        const f = lerAcessor(json, bin, ai), n = a.count, nc = COMP[a.type], buf = new Int8Array(n * 4);
        for (let i = 0; i < n; i++) for (let k = 0; k < nc; k++) buf[i * 4 + k] = Math.max(-127, Math.min(127, Math.round(f[i * nc + k] * 127)));
        trocaAcessor[ai] = novoAcessor(a, new Uint8Array(buf.buffer), 4, 5120, true);
      } else if (/^TEXCOORD_/.test(nome)) {
        feitos.add(ai);
        const f = lerAcessor(json, bin, ai);
        let ok = true; for (let i = 0; i < f.length; i++) if (f[i] < 0 || f[i] > 1) { ok = false; break; }
        if (!ok) continue;
        const buf = new Uint16Array(f.length); for (let i = 0; i < f.length; i++) buf[i] = Math.round(f[i] * 65535);
        trocaAcessor[ai] = novoAcessor(a, new Uint8Array(buf.buffer), 4, 5123, true);
      }
    }
    for (const m of json.meshes || []) for (const p of m.primitives) for (const nome of Object.keys(p.attributes)) if (trocaAcessor[p.attributes[nome]] != null) p.attributes[nome] = trocaAcessor[p.attributes[nome]];
    // cada mesh com posições comprimidas vai para um nó filho que "desfaz" a compressão (posição + escala)
    for (const [mi, q] of Object.entries(quantPos)) {
      (json.nodes || []).forEach((no) => {
        if (no.mesh !== Number(mi)) return;
        json.nodes.push({ name: (no.name || 'mesh') + '_q', mesh: Number(mi), translation: q.c, scale: q.s });
        delete no.mesh;
        no.children = (no.children || []).concat(json.nodes.length - 1);
      });
    }
    if (Object.keys(trocaAcessor).length) {
      json.extensionsUsed = [...new Set([...(json.extensionsUsed || []), 'KHR_mesh_quantization'])];
      json.extensionsRequired = [...new Set([...(json.extensionsRequired || []), 'KHR_mesh_quantization'])];
    }
  }

  // ---------- remonta o buffer só com o que ainda é usado
  const acessoresUsados = new Set();
  for (const m of json.meshes || []) for (const p of m.primitives) {
    Object.values(p.attributes).forEach((a) => acessoresUsados.add(a));
    if (p.indices != null) acessoresUsados.add(p.indices);
    (p.targets || []).forEach((t) => Object.values(t).forEach((a) => acessoresUsados.add(a)));
  }
  for (const an of json.animations || []) for (const sm of an.samplers || []) { acessoresUsados.add(sm.input); acessoresUsados.add(sm.output); }
  for (const sk of json.skins || []) if (sk.inverseBindMatrices != null) acessoresUsados.add(sk.inverseBindMatrices);
  const textoJson = JSON.stringify(json);
  const outrasRefs = /"bufferView"\s*:/.test(JSON.stringify(Object.assign({}, json, { accessors: [], images: [], bufferViews: [] })));
  const viewsUsadas = new Set();
  json.accessors.forEach((a, i) => { if ((acessoresUsados.has(i) || outrasRefs) && a.bufferView != null && a.bufferView >= 0) viewsUsadas.add(a.bufferView); });
  (json.images || []).forEach((im) => { if (im.bufferView != null) viewsUsadas.add(im.bufferView); });
  if (outrasRefs) json.bufferViews.forEach((v, i) => viewsUsadas.add(i));   // extensões com bufferView próprio: não remove nada

  const pedacos = [], novasViews = [], mapa = {};
  let tam = 0;
  const por = (bytes, extra) => {
    const pad = (4 - (tam % 4)) % 4; if (pad) { pedacos.push(new Uint8Array(pad)); tam += pad; }
    const v = Object.assign({ buffer: 0, byteOffset: tam, byteLength: bytes.length }, extra || {});
    pedacos.push(bytes); tam += bytes.length; novasViews.push(v); return novasViews.length - 1;
  };
  json.bufferViews.forEach((v, i) => {
    if (!viewsUsadas.has(i)) return;
    const bytes = novos[i] || bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength);
    const extra = {}; if (v.byteStride) extra.byteStride = v.byteStride; if (v.target) extra.target = v.target; if (v.name) extra.name = v.name;
    if (v.extensions) extra.extensions = v.extensions;
    mapa[i] = por(bytes, extra);
  });
  extras.forEach((e, k) => { mapa[-(k + 1)] = por(e.bytes, { byteStride: e.stride, target: 34962 }); });
  // acessores não usados ficam sem bufferView (válido no glTF: lidos como zero) só se ainda apontarem para algo removido
  json.accessors.forEach((a) => { if (a.bufferView == null) return; if (mapa[a.bufferView] == null) { delete a.bufferView; delete a.byteOffset; } else a.bufferView = mapa[a.bufferView]; });
  (json.images || []).forEach((im) => { if (im.bufferView != null) im.bufferView = mapa[im.bufferView]; });
  json.bufferViews = novasViews;
  json.buffers = [{ byteLength: tam }];
  void textoJson;
  const saida = new Uint8Array(tam); let o = 0; for (const p of pedacos) { saida.set(p, o); o += p.length; }
  const glb = escreverGlb(json, saida);
  return glb.length < antes * 0.95 ? { glb, antes, depois: glb.length } : { glb: entrada, antes, depois: antes };
}
