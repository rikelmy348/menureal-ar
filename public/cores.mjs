/* =========================================================================
   MenuReal — troca de cor do móvel 3D
   1. analisarCores(): acha as cores principais do 3D (na textura, ou nos
      materiais de cor lisa) para o lojista tocar na parte que muda.
   2. recolorir(): pinta só aquela parte, mantendo sombras, trama do tecido
      e veios (troca a cor e preserva a luz de cada ponto).
   3. gravarCores(): grava as cores dentro do próprio GLB (extensão
      KHR_materials_variants). O cliente troca a cor no catálogo, e o
      servidor entrega a cor escolhida para a câmera do Android.
   ========================================================================= */
import { lerGlb, escreverGlb } from './glb.mjs';

// ------------------------------------------------------------------ cor: sRGB ⇄ Lab
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
export function rgbParaLab(r, g, b) {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const gam = (c) => { c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return c < 0 ? 0 : c > 1 ? 255 : Math.round(c * 255); };
const fi = (t) => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
export function labParaRgb(L, a, b) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const x = fi(fx) * 0.95047, y = fi(fy), z = fi(fz) * 1.08883;
  return [gam(x * 3.2406 - y * 1.5372 - z * 0.4986), gam(-x * 0.9689 + y * 1.8758 + z * 0.0415), gam(x * 0.0557 - y * 0.204 + z * 1.057)];
}
export const hexParaRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgbParaHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// ------------------------------------------------------------------ leitura do 3D
function fonteDaTextura(json, ti) {
  const t = json.textures && json.textures[ti];
  if (!t) return -1;
  if (t.source != null) return t.source;
  const ex = t.extensions || {};
  for (const k of ['EXT_texture_webp', 'KHR_texture_basisu', 'EXT_texture_avif']) if (ex[k] && ex[k].source != null) return ex[k].source;
  return -1;
}
function bytesDaImagem(json, bin, ii) {
  const im = json.images[ii];
  if (!im || im.bufferView == null) return null;
  const bv = json.bufferViews[im.bufferView];
  return { bytes: bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength), tipo: im.mimeType || 'image/jpeg' };
}

/** Lê o GLB e devolve as "partes" que podem mudar de cor. */
export async function analisarCores(buf) {
  const { json, bin } = lerGlb(buf);
  const mats = json.materials || [];
  // tira cores antigas embutidas (o lojista recria do zero, a partir da cor padrão)
  const usados = new Set(), area = {};   // área aproximada = nº de vértices de cada material
  for (const m of json.meshes || []) for (const p of m.primitives || []) {
    if (p.material == null) continue;
    usados.add(p.material);
    const ac = json.accessors[p.attributes && p.attributes.POSITION];
    area[p.material] = (area[p.material] || 0) + (ac ? ac.count : 1);
  }
  const areaDe = (lista) => lista.reduce((s, mi) => s + (area[mi] || 1), 0);

  // 1) materiais com textura de cor: agrupa pela imagem
  const porImagem = new Map();
  for (const mi of usados) {
    const pbr = (mats[mi] && mats[mi].pbrMetallicRoughness) || {};
    if (!pbr.baseColorTexture) continue;
    const ii = fonteDaTextura(json, pbr.baseColorTexture.index);
    if (ii < 0) continue;
    const chave = ii + '|' + (pbr.baseColorFactor || [1, 1, 1, 1]).join(',');
    if (!porImagem.has(chave)) porImagem.set(chave, []);
    porImagem.get(chave).push(mi);
  }
  const partes = [];
  for (const [chave, materiais] of porImagem) {
    const ii = Number(chave.split('|')[0]);
    const fc = ((mats[materiais[0]].pbrMetallicRoughness || {}).baseColorFactor) || [1, 1, 1, 1];
    const b = bytesDaImagem(json, bin, ii);
    if (!b) continue;
    let bmp;
    try { bmp = await createImageBitmap(new Blob([b.bytes], { type: b.tipo })); } catch { continue; }
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
    if (fc.slice(0, 3).some((c) => c < 0.999)) {   // a cor que aparece é textura × cor base: junta as duas
      g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgb(' + fc.slice(0, 3).map((c) => gam(c)).join(',') + ')'; g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(bmp, 0, 0); g.globalCompositeOperation = 'source-over';
    }
    for (const gr of agrupar(cv)) partes.push({ tipo: 'textura', imagem: ii, materiais, canvas: cv, lab: gr.lab, rgb: gr.rgb, pct: gr.pct * areaDe(materiais) });
  }
  // 2) materiais de cor lisa (ex.: 3D de planejado, arquivos de fábrica)
  for (const mi of usados) {
    const pbr = (mats[mi] && mats[mi].pbrMetallicRoughness) || {};
    if (pbr.baseColorTexture) continue;
    const fc = pbr.baseColorFactor || [1, 1, 1, 1];
    const rgb = fc.slice(0, 3).map((c) => gam(c));
    const exist = partes.find((p) => p.tipo === 'lisa' && dist(p.rgb, rgb) < 3);
    if (exist) { exist.materiais.push(mi); exist.pct += area[mi] || 1; continue; }
    partes.push({ tipo: 'lisa', materiais: [mi], rgb, lab: rgbParaLab(rgb[0], rgb[1], rgb[2]), pct: area[mi] || 1, nome: (mats[mi] && mats[mi].name) || '' });
  }
  // ordena: maiores áreas primeiro; corta partes muito pequenas
  const total = partes.reduce((s, p) => s + p.pct, 0) || 1;
  partes.forEach((p) => { p.pct = p.pct / total; });
  partes.sort((a, b) => b.pct - a.pct);
  return { json, bin, partes: partes.filter((p) => p.pct >= 0.01).slice(0, 10) };
}

// k-médias em Lab, numa versão pequena da textura
function agrupar(cv) {
  const lado = 160, k = Math.min(lado / cv.width, lado / cv.height, 1);
  const w = Math.max(1, Math.round(cv.width * k)), h = Math.max(1, Math.round(cv.height * k));
  const p = document.createElement('canvas'); p.width = w; p.height = h;
  const g = p.getContext('2d', { willReadFrequently: true }); g.drawImage(cv, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, pts = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) pts.push(rgbParaLab(d[i], d[i + 1], d[i + 2]));
  if (!pts.length) return [];
  const K = 6;
  let cen = [];
  // começa espalhado pela claridade
  const ord = pts.slice().sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < K; i++) cen.push(ord[Math.floor((i + 0.5) / K * ord.length)].slice());
  const lab = new Int8Array(pts.length);
  for (let it = 0; it < 14; it++) {
    const soma = cen.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < pts.length; i++) {
      let mj = 0, md = Infinity;
      for (let j = 0; j < cen.length; j++) { const dd = dist(pts[i], cen[j]); if (dd < md) { md = dd; mj = j; } }
      lab[i] = mj; const s = soma[mj]; s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; s[3]++;
    }
    cen = cen.map((c, j) => (soma[j][3] ? [soma[j][0] / soma[j][3], soma[j][1] / soma[j][3], soma[j][2] / soma[j][3]] : c));
  }
  const cont = cen.map(() => 0); for (let i = 0; i < pts.length; i++) cont[lab[i]]++;
  let grupos = cen.map((c, j) => ({ lab: c, n: cont[j] })).filter((g2) => g2.n);
  // junta grupos parecidos (sombra e luz do mesmo tecido)
  grupos.sort((a, b) => b.n - a.n);
  const fim = [];
  for (const g2 of grupos) {
    const igual = fim.find((x) => dist([0, x.lab[1], x.lab[2]], [0, g2.lab[1], g2.lab[2]]) < 9 && Math.abs(x.lab[0] - g2.lab[0]) < 26);
    if (igual) { const t = igual.n + g2.n; igual.lab = igual.lab.map((v, i) => (v * igual.n + g2.lab[i] * g2.n) / t); igual.n = t; } else fim.push({ lab: g2.lab.slice(), n: g2.n });
  }
  return fim.map((g2) => ({ lab: g2.lab, rgb: labParaRgb(g2.lab[0], g2.lab[1], g2.lab[2]), pct: g2.n / pts.length }));
}

// ------------------------------------------------------------------ pintar
/** Pinta a parte (cor de origem em Lab) com a cor nova. sens: 0–100 (quanto pegar das cores vizinhas). */
export function recolorir(cvOrig, origemLab, alvoHex, sens, ladoMax) {
  const k = Math.min(1, (ladoMax || 4096) / Math.max(cvOrig.width, cvOrig.height));
  const w = Math.round(cvOrig.width * k), h = Math.round(cvOrig.height * k);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(cvOrig, 0, 0, w, h);
  const im = g.getImageData(0, 0, w, h), d = im.data;
  const al = rgbParaRgbLab(alvoHex), [L0, a0, b0] = origemLab;
  const lim = 10 + (sens == null ? 50 : sens) * 0.45, borda = lim * 0.55;   // raio de cor (Lab) e transição suave
  // contraste: tecido escuro → claro precisa de menos variação, claro → escuro mantém a trama
  const escala = Math.max(0.45, Math.min(1.25, (al[0] + 12) / (L0 + 12)));
  const cache = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], ch = (r << 16) | (gg << 8) | b;
    let res = cache.get(ch);
    if (res === undefined) {
      const [L, a, bb] = rgbParaLab(r, gg, b);
      // distância só de cor dá mais peso ao tom que à claridade (sombra do mesmo tecido entra)
      const dd = Math.hypot((L - L0) * 0.45, a - a0, bb - b0);
      const peso = dd <= borda ? 1 : dd >= lim ? 0 : 1 - (dd - borda) / (lim - borda);
      if (peso <= 0) res = null;
      else {
        const nL = Math.max(0, Math.min(100, al[0] + (L - L0) * escala));
        const nc = labParaRgb(nL, al[1] + (a - a0) * 0.35, al[2] + (bb - b0) * 0.35);
        res = [r + (nc[0] - r) * peso, gg + (nc[1] - gg) * peso, b + (nc[2] - b) * peso];
      }
      if (cache.size < 300000) cache.set(ch, res);
    }
    if (res) { d[i] = res[0]; d[i + 1] = res[1]; d[i + 2] = res[2]; }
  }
  g.putImageData(im, 0, 0);
  return cv;
}
function rgbParaRgbLab(hex) { const c = hexParaRgb(hex); return rgbParaLab(c[0], c[1], c[2]); }

/** Veludo (sheen) e reflexo colorido (specular) acompanham a cor nova, senão "puxam" para a cor antiga. */
export function ajustarBrilho(mat, hex) {
  const ex = mat.extensions || {}, lin = corLisa(hex);
  if (ex.KHR_materials_sheen) {
    const sh = ex.KHR_materials_sheen;
    if (sh.sheenColorFactor || sh.sheenColorTexture) { sh.sheenColorFactor = lin.map((c) => Math.min(1, c * 0.8 + 0.04)); delete sh.sheenColorTexture; }
  }
  if (ex.KHR_materials_specular) { delete ex.KHR_materials_specular.specularColorFactor; delete ex.KHR_materials_specular.specularColorTexture; }
}

/** Cor lisa: troca a cor mantendo a diferença de claridade original. */
export function corLisa(hex) { return hexParaRgb(hex).map((c) => LIN[c]); }

// ------------------------------------------------------------------ gravar no GLB
/**
 * parte: a parte escolhida (de analisarCores); variantes: [{ nome, hex }] (a 1ª é a cor original, sem hex).
 * Devolve os bytes do novo GLB.
 */
export async function gravarCores(analise, parte, variantes, sens, ladoMax) {
  const json = JSON.parse(JSON.stringify(analise.json));
  let bin = analise.bin;
  // remove cores embutidas antigas
  for (const m of json.meshes || []) for (const p of m.primitives || []) if (p.extensions) { delete p.extensions.KHR_materials_variants; if (!Object.keys(p.extensions).length) delete p.extensions; }
  if (json.extensions) { delete json.extensions.KHR_materials_variants; if (!Object.keys(json.extensions).length) delete json.extensions; }
  json.extensionsUsed = (json.extensionsUsed || []).filter((e) => e !== 'KHR_materials_variants');

  const pedacos = [bin]; let tam = bin.length;
  const anexar = async (cv) => {
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/jpeg', 0.86));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const pad = (4 - (tam % 4)) % 4; if (pad) { pedacos.push(new Uint8Array(pad)); tam += pad; }
    json.bufferViews.push({ buffer: 0, byteOffset: tam, byteLength: bytes.length });
    pedacos.push(bytes); tam += bytes.length;
    json.images.push({ bufferView: json.bufferViews.length - 1, mimeType: 'image/jpeg' });
    return json.images.length - 1;
  };
  const mapa = {};   // material original → [material da variante 1, 2…]
  for (const mi of parte.materiais) mapa[mi] = [];
  for (const v of variantes.slice(1)) {
    let novaImg = null;
    if (parte.tipo === 'textura') novaImg = await anexar(recolorir(parte.canvas, parte.lab, v.hex, sens, ladoMax));
    for (const mi of parte.materiais) {
      const mat = JSON.parse(JSON.stringify(json.materials[mi]));
      mat.name = (mat.name || 'material') + ' — ' + v.nome;
      const pbr = mat.pbrMetallicRoughness = mat.pbrMetallicRoughness || {};
      if (novaImg != null) {
        const t0 = json.textures[pbr.baseColorTexture.index];
        const t = { source: novaImg }; if (t0.sampler != null) t.sampler = t0.sampler;
        json.textures.push(t);
        pbr.baseColorTexture = Object.assign({}, pbr.baseColorTexture, { index: json.textures.length - 1 });
        pbr.baseColorFactor = [1, 1, 1, (pbr.baseColorFactor || [1, 1, 1, 1])[3]];
      } else {
        // cor lisa: mesma claridade relativa da parte original
        const alvo = corLisa(v.hex), orig = (pbr.baseColorFactor || [1, 1, 1, 1]);
        pbr.baseColorFactor = [alvo[0], alvo[1], alvo[2], orig[3] == null ? 1 : orig[3]];
      }
      ajustarBrilho(mat, v.hex);
      json.materials.push(mat);
      mapa[mi].push(json.materials.length - 1);
    }
  }
  json.extensions = Object.assign(json.extensions || {}, { KHR_materials_variants: { variants: variantes.map((v) => ({ name: v.nome })) } });
  json.extensionsUsed.push('KHR_materials_variants');
  for (const m of json.meshes || []) for (const p of m.primitives || []) {
    if (!(p.material in mapa)) continue;
    const maps = [{ material: p.material, variants: [0] }].concat(mapa[p.material].map((mm, k) => ({ material: mm, variants: [k + 1] })));
    p.extensions = Object.assign(p.extensions || {}, { KHR_materials_variants: { mappings: maps } });
  }
  const out = new Uint8Array(tam); let o = 0; for (const pc of pedacos) { out.set(pc, o); o += pc.length; }
  json.buffers[0].byteLength = tam;
  return escreverGlb(json, out);
}
