/* =========================================================================
   MenuReal AR — montador de sorvete e milkshake (3D gerado por código)
   Tudo aqui é JavaScript puro (sem DOM): roda no navegador (tela) e no
   Cloudflare Worker (arquivo para a câmera). Unidades: metros.

   montarSorvete({ recipiente, sabores, coberturas, animar }) → GLB (bytes)
     recipiente: casquinha | cascao | taca | copinho | milkshake | milkshake300
     sabores:    lista de SABORES (bolas, de baixo para cima; no milkshake, faixas)
     coberturas: lista de COBERTURAS
     animar:     { bola: índice } | { cobertura: tipo }  (só na tela)
   ========================================================================= */
import { escreverGlb, lerGlb } from './glb.mjs';

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------
// cor: sRGB; pedacos: [cor, quantidade por bola, tamanho (m), forma]
export const SABORES = {
  creme:         { nome: 'Creme',             cor: '#F3E2B3', pedacos: [['#6B4423', 10, 0.0007, 'ponto']] },
  chocolate:     { nome: 'Chocolate',         cor: '#5E3421' },
  morango:       { nome: 'Morango',           cor: '#F4A3B8', pedacos: [['#C21E3A', 16, 0.0021, 'floco']] },
  flocos:        { nome: 'Flocos',            cor: '#F6EFDF', pedacos: [['#2E1A0E', 55, 0.0026, 'floco']] },
  napolitano:    { nome: 'Napolitano',        cor: '#F3E2B3', faixas: ['#5E3421', '#F3E2B3', '#F4A3B8'] },
  pistache:      { nome: 'Pistache',          cor: '#BBD48C', pedacos: [['#7E9A4A', 18, 0.0018, 'floco']] },
  limao:         { nome: 'Limão',             cor: '#F2F0A8', gelo: true },
  menta:         { nome: 'Menta com chocolate', cor: '#A6E5CC', pedacos: [['#2E1A0E', 40, 0.0026, 'floco']] },
  coco:          { nome: 'Coco',              cor: '#FBF8F1', pedacos: [['#FFFFFF', 30, 0.003, 'fio']] },
  doce_de_leite: { nome: 'Doce de leite',     cor: '#D69C5E', pedacos: [['#A8652A', 8, 0.004, 'veio']] },
  acai:          { nome: 'Açaí',              cor: '#4E1F63' },
  uva:           { nome: 'Uva',               cor: '#8F5AA8', gelo: true },
  maracuja:      { nome: 'Maracujá',          cor: '#F5C74A', pedacos: [['#2B2118', 12, 0.0014, 'ponto']] },
  cookies:       { nome: 'Cookies',           cor: '#F1E6D2', pedacos: [['#3A2416', 18, 0.003, 'floco']] },
  chiclete:      { nome: 'Chiclete',          cor: '#7CC6F2' }
};
export const COBERTURAS = {
  calda_chocolate: { nome: 'Calda de chocolate', ordem: 1 },
  calda_morango:   { nome: 'Calda de morango', ordem: 2 },
  calda_caramelo:  { nome: 'Calda de caramelo', ordem: 3 },
  chantilly:       { nome: 'Chantilly', ordem: 4 },
  granulado:       { nome: 'Granulado', ordem: 5 },
  confete:         { nome: 'Confete colorido', ordem: 6 },
  amendoim:        { nome: 'Amendoim', ordem: 7 },
  wafer:           { nome: 'Biscoito wafer', ordem: 8 },
  cereja:          { nome: 'Cereja', ordem: 9 }
};
const CALDA = { calda_chocolate: '#3A1B0D', calda_morango: '#B3122C', calda_caramelo: '#B4651F' };
// recipientes: bolas = máximo sugerido; R = raio da bola
export const RECIPIENTES = {
  casquinha:    { nome: 'Casquinha', bolas: 2, R: 0.0265 },
  cascao:       { nome: 'Cascão', bolas: 3, R: 0.029 },
  taca:         { nome: 'Taça', bolas: 4, R: 0.0285 },
  copinho:      { nome: 'Copinho', bolas: 2, R: 0.026 },
  milkshake:    { nome: 'Copo de milkshake 500 ml', bolas: 2, R: 0.03, milk: true, H: 0.155 },
  milkshake300: { nome: 'Copo de milkshake 300 ml', bolas: 2, R: 0.028, milk: true, H: 0.128 }
};

// ---------------------------------------------------------------------------
// Utilidades: cor, ruído, vetores
// ---------------------------------------------------------------------------
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function corLin(hex) { const n = parseInt(hex.slice(1), 16); return [lin((n >> 16 & 255) / 255), lin((n >> 8 & 255) / 255), lin((n & 255) / 255)]; }
const mistura = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function semente(texto) { let h = 2166136261; for (const ch of String(texto)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function aleatorio(seed) { let r = seed || 1; return () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; }; }
function hash3(i, j, k, s) { let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647) + Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function ruido(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const f = (t) => t * t * (3 - 2 * t);
  const u = f(x - xi), v = f(y - yi), w = f(z - zi);
  let r = 0;
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
    r += hash3(xi + a, yi + b, zi + c, s) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  }
  return r * 2 - 1;
}
const fbm = (x, y, z, s) => ruido(x, y, z, s) * 0.6 + ruido(x * 2.1, y * 2.1, z * 2.1, s + 7) * 0.28 + ruido(x * 4.3, y * 4.3, z * 4.3, s + 13) * 0.12;
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function quatEixo(eixo, ang) { const e = norm(eixo), s = Math.sin(ang / 2); return [e[0] * s, e[1] * s, e[2] * s, Math.cos(ang / 2)]; }
function girar(q, v) {
  const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
function quatYpara(v) {
  const d = norm(v), eixo = [d[2], 0, -d[0]];
  if (Math.hypot(...eixo) < 1e-6) return d[1] > 0 ? [0, 0, 0, 1] : [1, 0, 0, 0];
  return quatEixo(eixo, Math.acos(Math.max(-1, Math.min(1, d[1]))));
}

// ---------------------------------------------------------------------------
// Geometria: malhas { pos, nrm, cor, idx }
// ---------------------------------------------------------------------------
/** Superfície em grade (u em volta, fechada; v de 0 a 1). f(u, v) → { p, c }. Normais suavizadas. */
function grade(f, nu, nv, fecharV0 = false, fecharV1 = false) {
  const pos = [], cor = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const r = f(i / nu, j / nv);
    pos.push(...r.p); cor.push(...r.c);
  }
  const L = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * L + i, b = a + 1, c = a + L, d = c + 1;
    idx.push(a, c, d, a, d, b);
  }
  const nrm = normais(pos, idx);
  // costura (u = 0 e u = 1) e polos com a mesma normal
  for (let j = 0; j <= nv; j++) {
    const a = j * L, b = a + nu, n = norm([nrm[a * 3] + nrm[b * 3], nrm[a * 3 + 1] + nrm[b * 3 + 1], nrm[a * 3 + 2] + nrm[b * 3 + 2]]);
    nrm.splice(a * 3, 3, ...n); nrm.splice(b * 3, 3, ...n);
  }
  const polo = (j) => {
    let s = [0, 0, 0];
    for (let i = 0; i <= nu; i++) { const k = (j * L + i) * 3; s = [s[0] + nrm[k], s[1] + nrm[k + 1], s[2] + nrm[k + 2]]; }
    s = norm(s);
    for (let i = 0; i <= nu; i++) nrm.splice((j * L + i) * 3, 3, ...s);
  };
  if (fecharV0) polo(0);
  if (fecharV1) polo(nv);
  const m = { pos, nrm, cor, idx };
  // faces viradas para fora (em relação ao centro da peça)
  const cx = [0, 0, 0], n = pos.length / 3;
  for (let i = 0; i < pos.length; i += 3) { cx[0] += pos[i] / n; cx[1] += pos[i + 1] / n; cx[2] += pos[i + 2] / n; }
  let soma = 0;
  for (let i = 0; i < pos.length; i += 3) soma += nrm[i] * (pos[i] - cx[0]) + nrm[i + 1] * (pos[i + 1] - cx[1]) + nrm[i + 2] * (pos[i + 2] - cx[2]);
  if (soma < 0) virar(m);
  return m;
}
function virar(m) {
  for (let t = 0; t < m.idx.length; t += 3) { const x = m.idx[t + 1]; m.idx[t + 1] = m.idx[t + 2]; m.idx[t + 2] = x; }
  for (let i = 0; i < m.nrm.length; i++) m.nrm[i] = -m.nrm[i];
}
function normais(pos, idx) {
  const n = new Array(pos.length).fill(0);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const v = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const f = cruz(u, v);
    for (const k of [a, b, c]) { n[k] += f[0]; n[k + 1] += f[1]; n[k + 2] += f[2]; }
  }
  for (let k = 0; k < n.length; k += 3) { const l = Math.hypot(n[k], n[k + 1], n[k + 2]) || 1; n[k] /= l; n[k + 1] /= l; n[k + 2] /= l; }
  return n;
}
function juntar(lista) {
  const out = { pos: [], nrm: [], cor: [], idx: [] };
  for (const m of lista) {
    if (!m) continue;
    const base = out.pos.length / 3;
    for (let i = 0; i < m.pos.length; i++) { out.pos.push(m.pos[i]); out.nrm.push(m.nrm[i]); out.cor.push(m.cor[i]); }
    for (const i of m.idx) out.idx.push(i + base);
  }
  return out;
}
/** Copia a malha com rotação q, escala e e translação t. */
function transformar(m, q, e, t) {
  const out = { pos: [], nrm: [], cor: m.cor.slice(), idx: m.idx.slice() };
  for (let i = 0; i < m.pos.length; i += 3) {
    const p = girar(q, [m.pos[i] * e[0], m.pos[i + 1] * e[1], m.pos[i + 2] * e[2]]);
    out.pos.push(p[0] + t[0], p[1] + t[1], p[2] + t[2]);
    const n = norm(girar(q, [m.nrm[i] / e[0], m.nrm[i + 1] / e[1], m.nrm[i + 2] / e[2]]));
    out.nrm.push(...n);
  }
  return out;
}
function pintar(m, c) { const out = { ...m, cor: [] }; for (let i = 0; i < m.pos.length; i += 3) out.cor.push(...c); return out; }
/** Esfera irregular (pedaços de fruta, cereja, amendoim). */
function bolinha(raio, nu, nv, seed, rugas = 0.12) {
  return grade((u, v) => {
    const th = u * Math.PI * 2, ph = v * Math.PI;
    const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), -Math.sin(ph) * Math.sin(th)];
    const r = raio * (1 + rugas * fbm(d[0] * 2 + 3, d[1] * 2, d[2] * 2, seed));
    return { p: d.map((x) => x * r), c: [1, 1, 1] };
  }, nu, nv, true, true);
}
/** Tubo ao longo de um caminho P(t), com raio rr(t) e seção s(α) (1 = redondo). */
function tubo(P, rr, n, nl, secao = () => 1, cor = () => [1, 1, 1]) {
  const pts = [];
  for (let j = 0; j <= nl; j++) pts.push(P(j / nl));
  // quadro transportado ao longo do caminho (sem torcer)
  let Nant = null;
  const quadros = pts.map((p, j) => {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(nl, j + 1)];
    const T = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    let N;
    if (!Nant) { N = cruz(T, [0, 0, 1]); if (Math.hypot(...N) < 1e-4) N = cruz(T, [1, 0, 0]); }
    else { const d = Nant[0] * T[0] + Nant[1] * T[1] + Nant[2] * T[2]; N = [Nant[0] - T[0] * d, Nant[1] - T[1] * d, Nant[2] - T[2] * d]; if (Math.hypot(...N) < 1e-6) N = Nant; }
    N = norm(N); Nant = N;
    return { N, B: cruz(T, N) };
  });
  return grade((u, v) => {
    const j = Math.round(v * nl), al = u * Math.PI * 2, p = pts[j], { N, B } = quadros[j];
    const r = rr(v) * secao(al, v);
    return { p: [p[0] + (N[0] * Math.cos(al) + B[0] * Math.sin(al)) * r, p[1] + (N[1] * Math.cos(al) + B[1] * Math.sin(al)) * r, p[2] + (N[2] * Math.cos(al) + B[2] * Math.sin(al)) * r], c: cor(u, v) };
  }, n, nl, true, true);
}
/** Superfície de revolução: perfil (t) → [r, y]; normal para fora (sentido 1) ou dentro (-1). */
function revolucao(perfil, nu, nv, sentido = 1, cor = () => [1, 1, 1]) {
  const m = grade((u, v) => {
    const [r, y] = perfil(v), th = u * Math.PI * 2;
    return { p: [r * Math.cos(th), y, -r * Math.sin(th)], c: cor(u, v, r, y) };
  }, nu, nv);
  // sentido 1: normal se afasta do eixo (ou para cima em discos); -1: o contrário
  let soma = 0;
  for (let i = 0; i < m.pos.length; i += 3) soma += m.nrm[i] * m.pos[i] + m.nrm[i + 2] * m.pos[i + 2] + 0.001 * m.nrm[i + 1];
  if ((soma < 0) !== (sentido < 0)) virar(m);
  return m;
}

// ---------------------------------------------------------------------------
// Bola de sorvete: esfera com caroços, marcas da colher e a "saia" embaixo
// ---------------------------------------------------------------------------
function raioBola(R, d, seed) {
  const ph = Math.acos(Math.max(-1, Math.min(1, d[1])));
  let r = R * (1 + 0.065 * fbm(d[0] * 1.8, d[1] * 1.8, d[2] * 1.8, seed) + 0.022 * fbm(d[0] * 6, d[1] * 6, d[2] * 6, seed + 3));
  // marcas onduladas da colher (arcos em volta de um eixo inclinado)
  const ax = norm([0.35, 0.2, 0.9]);
  const g = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2];
  r += R * 0.018 * Math.sin(g * 26 + 3 * fbm(d[0] * 2, d[1] * 2, d[2] * 2, seed + 9)) * Math.max(0, d[1] + 0.2);
  // saia: borda irregular onde a colher fechou
  const th = Math.atan2(-d[2], d[0]);
  const borda = 0.64 * Math.PI + 0.05 * Math.sin(th * 3 + seed);
  r += R * (0.11 + 0.05 * ruido(th * 2.5, 0, 0, seed + 5)) * Math.exp(-(((ph - borda) / 0.07) ** 2));
  if (ph > borda + 0.08) r *= 0.9;
  return r;
}
function pontoBola(R, d, seed) {
  const r = raioBola(R, d, seed);
  return [d[0] * r, d[1] * r * (d[1] < 0 ? 0.8 : 1), d[2] * r];
}
function malhaBola(sabor, R, seed, detalhe) {
  const s = SABORES[sabor] || SABORES.creme;
  const base = corLin(s.cor);
  const faixas = s.faixas ? s.faixas.map(corLin) : null;
  const nu = detalhe ? 64 : 44, nv = detalhe ? 48 : 32;
  const bola = grade((u, v) => {
    const th = u * Math.PI * 2, ph = v * Math.PI;
    const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), -Math.sin(ph) * Math.sin(th)];
    let c = base;
    if (faixas) c = faixas[Math.min(2, Math.floor(((th + 0.3 + 0.15 * ruido(d[1] * 3, 0, 0, seed)) / (Math.PI * 2)) * 3 + 3) % 3)];
    const n = fbm(d[0] * 3, d[1] * 3, d[2] * 3, seed + 21);
    const sombra = 0.88 + 0.12 * Math.max(0, Math.min(1, (raioBola(R, d, seed) / R - 0.92) / 0.16));
    c = c.map((x) => Math.min(1, x * (0.95 + 0.1 * n) * sombra));
    if (s.gelo) c = mistura(c, [1, 1, 1], 0.06 * Math.max(0, n));
    return { p: pontoBola(R, d, seed), c };
  }, nu, nv, true, true);
  // pedaços na superfície (flocos de chocolate, morango, pistache…)
  const partes = [bola];
  const rnd = aleatorio(seed + 77);
  for (const [hex, qtd, tam, forma] of s.pedacos || []) {
    const cor = corLin(hex);
    const n = Math.round(qtd * (detalhe ? 1 : 0.7));
    for (let k = 0; k < n; k++) {
      const z = 1 - 1.55 * rnd(), a = rnd() * Math.PI * 2, rr = Math.sqrt(Math.max(0, 1 - z * z));
      const d = [rr * Math.cos(a), z, rr * Math.sin(a)];
      const p = pontoBola(R, d, seed);
      const q = quatYpara(d), giro = quatEixo([0, 1, 0], rnd() * 6.28);
      const qq = [q[3] * giro[0] + q[0] * giro[3] + q[1] * giro[2] - q[2] * giro[1], q[3] * giro[1] - q[0] * giro[2] + q[1] * giro[3] + q[2] * giro[0],
        q[3] * giro[2] + q[0] * giro[1] - q[1] * giro[0] + q[2] * giro[3], q[3] * giro[3] - q[0] * giro[0] - q[1] * giro[1] - q[2] * giro[2]];
      const t0 = tam * (0.7 + 0.6 * rnd());
      let m, e;
      if (forma === 'floco') { m = bolinha(1, 6, 4, k, 0.35); e = [t0, t0 * 0.28, t0 * 0.7]; }
      else if (forma === 'fio') { m = bolinha(1, 5, 3, k, 0.2); e = [t0, t0 * 0.18, t0 * 0.18]; }
      else if (forma === 'veio') { m = bolinha(1, 8, 4, k, 0.25); e = [t0 * 1.8, t0 * 0.18, t0 * 0.5]; }
      else if (forma === 'ponto') { m = bolinha(1, 4, 3, k, 0.1); e = [t0, t0 * 0.5, t0]; }
      else { m = bolinha(1, 7, 5, k, 0.3); e = [t0, t0 * 0.75, t0 * 0.9]; }
      const fora = forma === 'veio' ? 0.05 : forma === 'pedaco' ? 0.2 : 0.12;
      partes.push(pintar(transformar(m, qq, e, [p[0] + d[0] * t0 * fora, p[1] + d[1] * t0 * fora, p[2] + d[2] * t0 * fora]), cor.map((x) => x * (0.85 + 0.3 * rnd()))));
    }
  }
  return juntar(partes);
}

// ---------------------------------------------------------------------------
// Recipientes
// ---------------------------------------------------------------------------
const COR_WAFFLE = corLin('#D9A35E'), COR_WAFFLE_ESC = corLin('#B9772F'), COR_WAFFLE_CLA = corLin('#EDC07F');
/** Casquinha de waffle: cone com xadrez em losango em relevo. */
function casquinha(alto, rt, detalhe, cascao) {
  const nu = detalhe ? 120 : 80, nv = detalhe ? 70 : 44;
  const perfil = (v) => {
    const r = cascao ? rt * (0.08 + 0.92 * v ** 0.85) * (v > 0.82 ? 1 + 0.25 * ((v - 0.82) / 0.18) ** 2 : 1) : rt * (0.06 + 0.94 * v);
    return [r, alto * v];
  };
  const relevo = (u, v) => {
    const a = u * 22 + v * 9, b = u * 22 - v * 9;
    const fa = Math.abs(a - Math.round(a)), fb = Math.abs(b - Math.round(b));
    return Math.max(Math.exp(-((fa / 0.09) ** 2)), Math.exp(-((fb / 0.09) ** 2)));
  };
  const fora = grade((u, v) => {
    const [r0, y] = perfil(v), th = u * Math.PI * 2;
    const k = relevo(u, v), n = ruido(u * 30, v * 20, 0, 4);
    const r = r0 + 0.0011 * k * Math.min(1, v * 6);
    const c = mistura(mistura(COR_WAFFLE_ESC, COR_WAFFLE_CLA, k), COR_WAFFLE, 0.35).map((x) => x * (0.92 + 0.12 * n) * (0.8 + 0.2 * Math.min(1, v * 3)));
    return { p: [r * Math.cos(th), y, -r * Math.sin(th)], c };
  }, nu, nv, true, false);
  const dentro = revolucao((v) => { const [r, y] = perfil(0.15 + 0.85 * v); return [r - 0.0018, y]; }, 48, 16, -1, () => COR_WAFFLE_ESC.map((x) => x * 0.8));
  // borda enrolada no topo
  const [rTop, yTop] = perfil(1);
  const borda = tubo((t) => [rTop * Math.cos(t * Math.PI * 2) - 0.0006, yTop, -rTop * Math.sin(t * Math.PI * 2)], () => 0.0026, 10, 90,
    () => 1, (u, v) => COR_WAFFLE_CLA.map((x) => x * (0.95 + 0.08 * ruido(v * 40, u * 4, 0, 3))));
  return { malha: juntar([fora, dentro, borda]), topo: yTop, raio: rTop };
}
const COR_VIDRO = [0.96, 0.98, 1.0];
/** Taça de vidro (sundae): pé, haste e bojo. */
function taca(detalhe) {
  const nu = detalhe ? 96 : 64;
  const pts = [[0.0, 0], [0.036, 0], [0.038, 0.0025], [0.03, 0.005], [0.008, 0.012], [0.006, 0.026], [0.009, 0.03], [0.006, 0.035],
    [0.014, 0.042], [0.034, 0.055], [0.05, 0.075], [0.058, 0.095], [0.061, 0.104]];
  const perfil = (pts) => (v) => {
    const x = v * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)), f = x - i, s = f * f * (3 - 2 * f);
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * s, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * s];
  };
  const fora = revolucao(perfil(pts), nu, 90, 1, () => COR_VIDRO);
  const dentro = revolucao(perfil(pts.slice(8).map(([r, y]) => [Math.max(0.0005, r - 0.0028), y + 0.002])), nu, 40, -1, () => COR_VIDRO);
  const borda = tubo((t) => [0.0596 * Math.cos(t * Math.PI * 2), 0.104, -0.0596 * Math.sin(t * Math.PI * 2)], () => 0.0016, 8, 96, () => 1, () => COR_VIDRO);
  return { malha: juntar([fora, dentro]), borda, fundo: 0.06, topo: 0.104, raio: 0.058 };
}
/** Copinho de papel listrado. */
function copinho(detalhe) {
  const rb = 0.03, rt = 0.039, H = 0.052;
  const rosa = corLin('#FF5C93'), branco = corLin('#FFF8F2');
  const listra = (u) => (Math.floor(u * 24) % 2 ? rosa : branco);
  const fora = revolucao((v) => [rb + (rt - rb) * v, H * v], detalhe ? 96 : 72, 6, 1, (u) => listra(u));
  const dentro = revolucao((v) => [rb - 0.0006 + (rt - rb) * v, 0.001 + (H - 0.001) * v], 48, 4, -1, () => branco.map((x) => x * 0.9));
  const fundo = revolucao((v) => [rb * (1 - v), 0.0002], 48, 2, -1, () => branco);
  const borda = tubo((t) => [rt * Math.cos(t * Math.PI * 2), H, -rt * Math.sin(t * Math.PI * 2)], () => 0.0013, 8, 96, () => 1, () => branco);
  return { malha: juntar([fora, dentro, fundo, borda]), topo: H, raio: rt };
}
/** Copo alto de vidro para milkshake. */
function copoMilk(H, detalhe) {
  const rb = 0.03, rt = 0.04, g = 0.0026, base = 0.012;
  const nu = detalhe ? 96 : 64;
  const fora = revolucao((v) => [rb + (rt - rb) * v, H * v], nu, 24, 1, () => COR_VIDRO);
  const dentro = revolucao((v) => [rb - g + (rt - rb) * v, base + (H - base) * v], nu, 20, -1, () => COR_VIDRO);
  const fundo = revolucao((v) => [rb * (1 - v), 0], nu, 2, -1, () => COR_VIDRO);
  const fundoDentro = revolucao((v) => [(rb - g) * v, base], nu, 2, 1, () => COR_VIDRO);
  const borda = tubo((t) => [(rt - g / 2) * Math.cos(t * Math.PI * 2), H, -(rt - g / 2) * Math.sin(t * Math.PI * 2)], () => g / 2, 8, 96, () => 1, () => COR_VIDRO);
  return { malha: juntar([fora, dentro, fundo, fundoDentro, borda]), H, rb, rt, g, base, raioDentro: (y) => rb - g + (rt - rb) * (y / H) };
}

// ---------------------------------------------------------------------------
// Coberturas
// ---------------------------------------------------------------------------
/** Calda sobre a bola (casca brilhante com pingos escorrendo). Origem: topo da bola. */
function caldaNaBola(R, seed, tipo, detalhe) {
  const c = corLin(CALDA[tipo] || CALDA.calda_chocolate);
  const rnd = aleatorio(seed + 31);
  const pingos = Array.from({ length: 7 }, () => ({ th: rnd() * Math.PI * 2, a: 0.2 + rnd() * 0.5, w: 0.13 + rnd() * 0.1 }));
  const limite = (th) => {
    let m = 0.72 + 0.08 * Math.sin(th * 3 + seed);
    for (const p of pingos) { let d = Math.abs(th - p.th); d = Math.min(d, Math.PI * 2 - d); m += p.a * Math.exp(-((d / p.w) ** 2)); }
    return Math.min(1.55, m);
  };
  const topo = pontoBola(R, [0, 1, 0], seed)[1];
  return grade((u, v) => {
    const th = u * Math.PI * 2, lim = limite(th), ph = lim * v;
    const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), -Math.sin(ph) * Math.sin(th)];
    const esp = 0.0017 * (1 - v ** 3) + 0.0006 * Math.exp(-(((v - 0.93) / 0.05) ** 2)) * (lim > 1 ? 1 : 0);
    const p = pontoBola(R, d, seed);
    const k = 1 + esp / Math.max(0.01, Math.hypot(...p));
    return { p: [p[0] * k, p[1] * k - topo, p[2] * k], c: c.map((x) => x * (0.9 + 0.15 * ruido(u * 9, v * 5, 0, seed))) };
  }, detalhe ? 72 : 48, detalhe ? 30 : 20, true, false);
}
/** Granulado/confete/amendoim espalhado em cima de uma bola: devolve grupos (para cair em sequência). */
function confeitos(R, seed, tipo, extra, grupos, detalhe) {
  const rnd = aleatorio(seed + (tipo === 'confete' ? 99 : tipo === 'amendoim' ? 55 : 11));
  const cores = tipo === 'confete' ? ['#E53935', '#FDD835', '#1E88E5', '#43A047', '#FF6FB5', '#FFFFFF'].map(corLin)
    : tipo === 'amendoim' ? ['#C99556', '#B07A3C', '#D9AE73'].map(corLin) : ['#2B160B', '#3A1F10'].map(corLin);
  const n = Math.round((tipo === 'amendoim' ? 26 : 70) * (detalhe ? 1 : 0.7));
  const out = Array.from({ length: grupos }, () => []);
  const peca = tipo === 'amendoim' ? bolinha(1, 6, 4, 2, 0.35) : tubo((t) => [0, t - 0.5, 0], (t) => 1 - 0.3 * (2 * t - 1) ** 8, 6, 3);
  for (let k = 0; k < n; k++) {
    const z = 1 - 0.95 * rnd(), a = rnd() * Math.PI * 2, rr = Math.sqrt(Math.max(0, 1 - z * z));
    const d = [rr * Math.cos(a), z, rr * Math.sin(a)];
    const p = pontoBola(R, d, seed);
    const t = norm(cruz(d, [Math.cos(a * 3), 0.2, Math.sin(a * 3)]));
    const q = quatYpara(t);
    const tam = tipo === 'amendoim' ? 0.0026 * (0.7 + 0.6 * rnd()) : 0.0062;
    const e = tipo === 'amendoim' ? [tam, tam * 0.7, tam * 0.9] : [0.0011, tam * (0.8 + 0.4 * rnd()), 0.0011];
    const sobe = extra + (tipo === 'amendoim' ? tam * 0.5 : 0.0011);
    const cor = cores[Math.floor(rnd() * cores.length)];
    out[k % grupos].push(pintar(transformar(peca, q, e, [p[0] + d[0] * sobe, p[1] + d[1] * sobe, p[2] + d[2] * sobe]), cor));
  }
  return out.map(juntar);
}
/** Chantilly: espiral com seção em estrela, terminando em bico. Origem: base. */
function chantilly(raio, detalhe) {
  const voltas = 2.6, h = raio * 1.25;
  const P = (t) => {
    const a = t * voltas * Math.PI * 2, rho = raio * 0.62 * (1 - t) ** 0.9;
    return [rho * Math.cos(a), h * t ** 0.9, -rho * Math.sin(a)];
  };
  const branco = corLin('#FFFDF8');
  const espiral = tubo(P, (t) => raio * (0.42 * (1 - t) ** 0.7 + 0.04), 16, detalhe ? 120 : 80,
    (al) => 1 + 0.16 * Math.cos(al * 8), (u, v) => branco.map((x) => x * (0.93 + 0.07 * Math.cos(u * Math.PI * 16))));
  const miolo = revolucao((v) => [raio * 0.7 * Math.sin((1 - v) * Math.PI / 2), h * 0.55 * v], 32, 8, 1, () => branco);
  return juntar([espiral, miolo]);
}
/** Cereja com cabinho. Origem: base da cereja. */
function cereja() {
  const r = 0.0085;
  const fruta = grade((u, v) => {
    const th = u * Math.PI * 2, ph = v * Math.PI;
    const d = [Math.sin(ph) * Math.cos(th), Math.cos(ph), -Math.sin(ph) * Math.sin(th)];
    const covinha = 1 - 0.25 * Math.exp(-((ph / 0.35) ** 2));
    return { p: [d[0] * r, r + d[1] * r * 0.92 * covinha, d[2] * r], c: corLin('#B0101C').map((x) => x * (0.9 + 0.12 * ruido(d[0] * 4, d[1] * 4, d[2] * 4, 2))) };
  }, 36, 24, true, true);
  const cabo = tubo((t) => [0.006 * t * t, r * 1.75 + 0.026 * t, 0.002 * t], () => 0.0007, 6, 12, () => 1, () => corLin('#5B7A2A'));
  return juntar([fruta, cabo]);
}
/** Biscoito wafer enrolado (canudinho). Origem: ponta que entra no sorvete. */
function wafer() {
  const c1 = corLin('#E5B46C'), c2 = corLin('#C98E3E');
  return tubo((t) => [0, t * 0.07, 0], () => 0.0048, 20, 40, () => 1, (u, v) => (Math.floor((u + v * 7) * 6) % 2 ? c1 : c2));
}
/** Canudo listrado. Origem: ponta de baixo. */
function canudo(comp) {
  const v1 = corLin('#E53950'), b = corLin('#FFFFFF');
  return tubo((t) => [0, t * comp, 0], () => 0.0034, 14, 60, () => 1, (u, v) => (Math.floor((u + v * 9) * 4) % 2 ? v1 : b));
}

// ---------------------------------------------------------------------------
// Montagem da cena (glTF)
// ---------------------------------------------------------------------------
function novaCena() {
  return {
    json: { asset: { version: '2.0', generator: 'MenuReal · montador de sorvete' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [],
      accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }], extensionsUsed: ['KHR_materials_ior', 'KHR_materials_specular'] },
    partes: [], bin: 0, mats: {}, canais: [], samplers: []
  };
}
function anexar(c, arr, alvo) {
  const pad = (4 - (c.bin % 4)) % 4;
  if (pad) { c.partes.push(new Uint8Array(pad)); c.bin += pad; }
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  c.json.bufferViews.push(Object.assign({ buffer: 0, byteOffset: c.bin, byteLength: bytes.byteLength }, alvo ? { target: alvo } : {}));
  c.partes.push(bytes); c.bin += bytes.byteLength;
  return c.json.bufferViews.length - 1;
}
const MATERIAIS = {
  sorvete: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.62 } },
  calda: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.12 } },
  doce: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.38 } },
  massa: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.75 } },
  cereja: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.18 } },
  liquido: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.3 } },
  vidro: { alphaMode: 'BLEND', doubleSided: false, pbrMetallicRoughness: { baseColorFactor: [0.96, 0.98, 1, 0.2], metallicFactor: 0, roughnessFactor: 0.03 },
    extensions: { KHR_materials_ior: { ior: 1.5 }, KHR_materials_specular: { specularFactor: 1 } } },
  vidro_borda: { alphaMode: 'BLEND', doubleSided: false, pbrMetallicRoughness: { baseColorFactor: [0.97, 0.99, 1, 0.5], metallicFactor: 0, roughnessFactor: 0.05 } },
  metal: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 1, roughnessFactor: 0.26 } },
  tecido: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.7 } },
  papel: { pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.8 } }
};
function material(c, nome) {
  if (c.mats[nome] == null) {
    c.json.materials.push(Object.assign({ name: nome, doubleSided: true }, JSON.parse(JSON.stringify(MATERIAIS[nome]))));
    c.mats[nome] = c.json.materials.length - 1;
  }
  return c.mats[nome];
}
function malhaGltf(c, nome, m, mat) {
  const P = new Float32Array(m.pos), N = new Float32Array(m.nrm), C = new Float32Array(m.cor);
  const I = m.pos.length / 3 > 65535 ? new Uint32Array(m.idx) : new Uint16Array(m.idx);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
  const acc = (arr, tipo, alvo, extra) => {
    c.json.accessors.push(Object.assign({ bufferView: anexar(c, arr, alvo), componentType: arr instanceof Uint32Array ? 5125 : arr instanceof Uint16Array ? 5123 : 5126,
      count: tipo === 'SCALAR' ? arr.length : arr.length / 3, type: tipo }, extra || {}));
    return c.json.accessors.length - 1;
  };
  c.json.meshes.push({ name: nome, primitives: [{ attributes: { POSITION: acc(P, 'VEC3', 34962, { min: mn, max: mx }), NORMAL: acc(N, 'VEC3', 34962), COLOR_0: acc(C, 'VEC3', 34962) },
    indices: acc(I, 'SCALAR', 34963), material: material(c, mat) }] });
  return c.json.meshes.length - 1;
}
function no(c, dados, pai) {
  c.json.nodes.push(dados);
  const i = c.json.nodes.length - 1;
  if (pai == null) c.json.scenes[0].nodes.push(i);
  else (c.json.nodes[pai].children = c.json.nodes[pai].children || []).push(i);
  return i;
}
function canal(c, alvo, path, tempos, valores, interp = 'LINEAR') {
  const T = new Float32Array(tempos), V = new Float32Array(valores);
  c.json.accessors.push({ bufferView: anexar(c, T), componentType: 5126, count: T.length, type: 'SCALAR', min: [Math.min(...T)], max: [Math.max(...T)] });
  const ti = c.json.accessors.length - 1;
  c.json.accessors.push({ bufferView: anexar(c, V), componentType: 5126, count: T.length, type: path === 'rotation' ? 'VEC4' : 'VEC3' });
  c.samplers.push({ input: ti, output: c.json.accessors.length - 1, interpolation: interp });
  c.canais.push({ sampler: c.samplers.length - 1, target: { node: alvo, path } });
}
function fecharCena(c) {
  if (c.canais.length) c.json.animations = [{ name: 'entrada', samplers: c.samplers, channels: c.canais }];
  const bin = new Uint8Array(c.bin);
  let p = 0; for (const x of c.partes) { bin.set(x, p); p += x.length; }
  c.json.buffers[0].byteLength = c.bin;
  return escreverGlb(c.json, bin);
}
const MIN = 1e-4;
// animações prontas
function animQueda(c, n, pos, altura, inicio = 0.05) {
  const t = [0, inicio, inicio + 0.38, inicio + 0.46, inicio + 0.56, inicio + 0.66];
  canal(c, n, 'translation', t, [pos[0], pos[1] + altura, pos[2], pos[0], pos[1] + altura, pos[2], ...pos, pos[0], pos[1] + 0.004, pos[2], ...pos, ...pos]);
  canal(c, n, 'scale', t, [MIN, MIN, MIN, 1, 1, 1, 1.12, 0.84, 1.12, 0.96, 1.05, 0.96, 1.02, 0.98, 1.02, 1, 1, 1]);
}
function animEscorrer(c, n, inicio = 0.05, dur = 0.9) {
  canal(c, n, 'scale', [0, inicio, inicio + dur * 0.35, inicio + dur], [MIN, MIN, MIN, 1, 0.02, 1, 1.02, 0.45, 1.02, 1, 1, 1]);
}
function animCrescer(c, n, inicio = 0.05) {
  canal(c, n, 'scale', [0, inicio, inicio + 0.45, inicio + 0.6], [MIN, MIN, MIN, 0.3, 0.05, 0.3, 1.06, 1.1, 1.06, 1, 1, 1]);
  canal(c, n, 'rotation', [0, inicio, inicio + 0.6], [...quatEixo([0, 1, 0], 1.6), ...quatEixo([0, 1, 0], 1.6), 0, 0, 0, 1]);
}
function animDeslizar(c, n, pos, dir, dist, inicio = 0.05) {
  const ini = [pos[0] + dir[0] * dist, pos[1] + dir[1] * dist, pos[2] + dir[2] * dist];
  canal(c, n, 'translation', [0, inicio, inicio + 0.5], [...ini, ...ini, ...pos]);
  canal(c, n, 'scale', [0, inicio], [MIN, MIN, MIN, 1, 1, 1], 'STEP');
}


// ---------------------------------------------------------------------------
// Ajudantes da animação (só na tela): pegador de sorvete, frasco/jarra de vidro,
// saco de confeitar e a mão (arquivo _mao.glb, o mesmo do açaí)
// ---------------------------------------------------------------------------
const ESC_MAO = 0.09;
/** Pegador (boleador): concha de metal virada para baixo, com cabo rosa. Origem: centro da concha (onde fica a bola). */
function pegador(R) {
  const Rp = R * 1.1, aco = corLin('#C9CED6');
  const fora = grade((u, v) => {
    const th = u * Math.PI * 2, ph = v * Math.PI * 0.5;
    return { p: [Rp * Math.sin(ph) * Math.cos(th), Rp * Math.cos(ph), -Rp * Math.sin(ph) * Math.sin(th)], c: aco };
  }, 40, 14, true, false);
  const dentro = grade((u, v) => {
    const th = u * Math.PI * 2, ph = v * Math.PI * 0.5, r = Rp - 0.0012;
    return { p: [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), -r * Math.sin(ph) * Math.sin(th)], c: aco.map((x) => x * 0.8) };
  }, 40, 14, true, false);
  virar(dentro);
  const aro = tubo((t) => [(Rp - 0.0006) * Math.cos(t * Math.PI * 2), 0, -(Rp - 0.0006) * Math.sin(t * Math.PI * 2)], () => 0.0009, 6, 60, () => 1, () => aco);
  // alavanca (a lâmina que solta a bola) e o pescoço do cabo
  const lamina = tubo((t) => { const a = -0.9 + t * 1.8; return [Rp * 0.98 * Math.sin(a) * 0.15, Rp * 0.98 * Math.cos(a) * 0.98, -Rp * 0.98 * Math.sin(a)]; }, () => 0.0011, 6, 20, () => 1, () => aco);
  const ini = [Rp * 0.55, Rp * 0.82, 0], dir = norm([1, 0.55, 0]);
  const pescoco = tubo((t) => [ini[0] + dir[0] * 0.03 * t, ini[1] + dir[1] * 0.03 * t, 0], () => 0.0028, 10, 6, () => 1, () => aco);
  const metal = juntar([fora, dentro, aro, lamina, pescoco]);
  const rosa = corLin('#FF3D8B');
  const cabo = tubo((t) => [ini[0] + dir[0] * (0.03 + 0.085 * t), ini[1] + dir[1] * (0.03 + 0.085 * t), 0], (t) => 0.0052 * (0.85 + 0.15 * Math.sin(t * Math.PI)), 14, 16,
    (al) => 1 - 0.12 * Math.abs(Math.sin(al)), (u, v) => rosa.map((x) => x * (0.92 + 0.08 * Math.cos(v * 40))));
  return { metal, cabo };
}
/** Frasco (ou jarra) de vidro em pé, com o bico na origem e o corpo para baixo. */
function frasco(corHex, grande) {
  const rn = grande ? 0.011 : 0.0055, rb = grande ? 0.04 : 0.019, L = grande ? 0.13 : 0.075;
  const pts = [[rn + 0.0012, 0], [rn, -0.002], [rn, -L * 0.18], [rb * 0.9, -L * 0.3], [rb, -L * 0.36], [rb, -L * 0.96], [rb * 0.92, -L], [0.001, -L]];
  const perfil = (v) => {
    const x = v * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)), f = x - i, k = f * f * (3 - 2 * f);
    return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
  };
  const vidro = revolucao(perfil, 48, 60, 1, () => COR_VIDRO);
  const cor = corLin(corHex);
  const liquido = revolucao((v) => [(rb - 0.002) * Math.min(1, Math.sin(v * Math.PI) * 3), -L * 0.97 + L * 0.55 * v], 40, 16, 1, (u, v) => cor.map((x) => x * (0.9 + 0.12 * v)));
  const borda = tubo((t) => [(rn + 0.0008) * Math.cos(t * Math.PI * 2), 0, -(rn + 0.0008) * Math.sin(t * Math.PI * 2)], () => 0.0012, 6, 40, () => 1, () => COR_VIDRO);
  return { vidro: juntar([vidro, borda]), liquido };
}
/** Fio de calda saindo do bico: comprimento 1 para baixo (a escala Y dá o tamanho). */
function jato(corHex, grosso) {
  const cor = corLin(corHex), r = grosso ? 0.0032 : 0.0017;
  return tubo((t) => [0, -t, 0], (t) => r * (1 - 0.25 * t), 8, 8, () => 1, () => cor);
}
/** Saco de confeitar com bico de estrela. Origem: ponta do bico. */
function sacoConfeitar() {
  const aco = corLin('#C9CED6'), pano = corLin('#E3F0FF');
  const bico = revolucao((v) => [0.0022 + 0.0045 * v, 0.014 * v], 16, 4, 1, (u) => aco.map((x) => x * (0.85 + 0.15 * Math.cos(u * Math.PI * 16))));
  const saco = revolucao((v) => [0.0066 + 0.03 * Math.sin(Math.min(1, v * 1.25) * Math.PI / 2) * (v > 0.85 ? 1 - (v - 0.85) * 4.5 : 1), 0.013 + 0.12 * v], 32, 24, 1,
    (u, v) => pano.map((x) => x * (0.9 + 0.1 * Math.sin(u * Math.PI * 10 + v * 6))));
  return { bico, saco };
}
/** Incorpora um GLB (a mão) à cena. Devolve o nó-pai (escondido em repouso). */
function incorporar(c, bytes, nome, escala) {
  const { json, bin } = lerGlb(bytes);
  const j = c.json;
  j.images = j.images || []; j.textures = j.textures || []; j.samplers = j.samplers || [];
  const off = { bv: j.bufferViews.length, acc: j.accessors.length, img: j.images.length, smp: j.samplers.length, tex: j.textures.length, mat: j.materials.length, mesh: j.meshes.length, node: j.nodes.length };
  const pad = (4 - (c.bin % 4)) % 4;
  if (pad) { c.partes.push(new Uint8Array(pad)); c.bin += pad; }
  const base = c.bin;
  if (bin) { c.partes.push(bin); c.bin += bin.length; }
  (json.bufferViews || []).forEach((v) => j.bufferViews.push({ ...v, buffer: 0, byteOffset: (v.byteOffset || 0) + base }));
  (json.accessors || []).forEach((a) => j.accessors.push({ ...a, bufferView: a.bufferView + off.bv }));
  (json.images || []).forEach((im) => j.images.push({ ...im, bufferView: im.bufferView + off.bv }));
  (json.samplers || []).forEach((x) => j.samplers.push({ ...x }));
  (json.textures || []).forEach((t) => j.textures.push({ ...t, source: t.source + off.img, sampler: t.sampler == null ? undefined : t.sampler + off.smp }));
  const tex = (o) => { if (o && typeof o.index === 'number') o.index += off.tex; };
  (json.materials || []).forEach((m) => {
    const n = JSON.parse(JSON.stringify(m));
    if (n.pbrMetallicRoughness) { tex(n.pbrMetallicRoughness.baseColorTexture); tex(n.pbrMetallicRoughness.metallicRoughnessTexture); }
    tex(n.normalTexture); tex(n.occlusionTexture); tex(n.emissiveTexture);
    j.materials.push(n);
  });
  (json.meshes || []).forEach((m) => {
    const n = JSON.parse(JSON.stringify(m));
    n.primitives.forEach((p) => {
      for (const k of Object.keys(p.attributes)) p.attributes[k] += off.acc;
      if (p.indices != null) p.indices += off.acc;
      if (p.material != null) p.material += off.mat;
    });
    j.meshes.push(n);
  });
  (json.nodes || []).forEach((n) => j.nodes.push({ ...n, mesh: n.mesh == null ? undefined : n.mesh + off.mesh, children: n.children ? n.children.map((x) => x + off.node) : undefined }));
  const filhos = ((json.scenes || [])[json.scene || 0] || { nodes: [] }).nodes.map((x) => x + off.node);
  j.nodes.push({ name: nome, scale: [MIN, MIN, MIN], children: filhos });
  j.scenes[0].nodes.push(j.nodes.length - 1);
  return { no: j.nodes.length - 1, escala };
}
/** Nó de ajudante feito aqui (escondido em repouso), com várias malhas. */
function ajudante(c, nome, partes) {
  const pai = no(c, { name: nome, scale: [MIN, MIN, MIN] });
  partes.forEach(([m, mat], i) => no(c, { name: nome + '_' + i, mesh: malhaGltf(c, nome + '_' + i, m, mat) }, pai));
  return { no: pai, escala: 1 };
}
/** Movimento de um ajudante: kf = [[t, posição, rotação?], ...]; aparece no 1º e some depois do último. */
function mover(c, aj, kf) {
  const T = kf.map((k) => +k[0].toFixed(3));
  canal(c, aj.no, 'translation', T, kf.flatMap((k) => k[1]));
  if (kf.some((k) => k[2])) canal(c, aj.no, 'rotation', T, kf.flatMap((k) => k[2] || [0, 0, 0, 1]));
  const e = aj.escala, fim = T[T.length - 1];
  canal(c, aj.no, 'scale', [0, fim + 0.01], [e, e, e, MIN, MIN, MIN], 'STEP');
}
const soma = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Bola que chega no pegador e cai no lugar. */
function animBolaComPegador(c, nBola, pos, peg) {
  const S = soma(pos, [0.11, 0.17, 0.07]), A = soma(pos, [0, 0.07, 0]);
  canal(c, nBola, 'translation', [0, 0.45, 0.58, 0.8, 0.88, 0.97], [...S, ...A, ...A, ...pos, ...soma(pos, [0, 0.004, 0]), ...pos]);
  canal(c, nBola, 'scale', [0, 0.58, 0.8, 0.88, 0.97], [1, 1, 1, 1, 1, 1, 1.12, 0.84, 1.12, 0.96, 1.05, 0.96, 1, 1, 1]);
  if (peg) {
    const giro = quatEixo([0, 0, 1], 0.35);
    mover(c, peg, [[0, S], [0.45, A], [0.55, soma(A, [0, 0.004, 0]), giro], [0.8, soma(A, [0.03, 0.05, 0.01])], [1.1, soma(S, [0.05, 0.06, 0])]]
      .map((k, i) => [k[0], k[1], i === 2 ? giro : [0, 0, 0, 1]]));
  }
}
const POUR = quatEixo([0, 0, 1], 2.3), DE_PE = quatEixo([0, 0, 1], 0.55);

/**
 * Posições das bolas no recipiente. Devolve [{ x, y, z }] (centros) e quais ficam expostas por cima.
 */
function posicoesBolas(rec, n, R, info) {
  const pos = [];
  if (rec === 'casquinha' || rec === 'cascao') {
    let y = info.topo + R * 0.42;
    for (let i = 0; i < n; i++) {
      const lado = i ? (i % 2 ? 1 : -1) * R * 0.08 : 0;
      pos.push([lado, y, i ? R * 0.05 : 0]);
      y += R * 1.48;
    }
    return { pos, expostas: n ? [n - 1] : [] };
  }
  const base = rec === 'copinho' ? info.topo + R * 0.15 : info.fundo + R * 0.95;
  const d = rec === 'taca' ? R * 0.82 : R * 1.02;
  const camada1 = n === 1 ? [[0, 0]] : n === 2 ? [[-d * 0.92, 0], [d * 0.92, 0]] : [[-d, d * 0.58], [d, d * 0.58], [0, -d * 1.12]];
  for (let i = 0; i < Math.min(n, 3); i++) pos.push([camada1[i][0], base + (n === 2 ? 0.003 : 0), camada1[i][1]]);
  if (n >= 4) pos.push([0, base + R * 1.15, 0]);
  return { pos, expostas: n >= 4 ? [3, 0, 1, 2] : pos.map((_, i) => i) };
}

/**
 * Monta o sorvete ou o milkshake. opcoes.leve: menos polígonos (arquivo para a câmera).
 */
export function montarSorvete(opcoes = {}) {
  const rec = RECIPIENTES[opcoes.recipiente] ? opcoes.recipiente : 'casquinha';
  const info0 = RECIPIENTES[rec];
  const sabores = (opcoes.sabores || []).filter((s) => SABORES[s]).slice(0, 6);
  const cobs = [...new Set((opcoes.coberturas || []).filter((x) => COBERTURAS[x]))].sort((a, b) => COBERTURAS[a].ordem - COBERTURAS[b].ordem);
  const det = !opcoes.leve;
  const an = opcoes.animar || {};
  const c = novaCena();
  const R = info0.R;
  const temCalda = cobs.find((x) => CALDA[x]);

  const mao = () => (opcoes.mao ? incorporar(c, opcoes.mao, 'mao', ESC_MAO) : null);
  if (info0.milk) return montarMilkshake(c, rec, sabores, cobs, an, det, mao);

  // recipiente
  let info;
  if (rec === 'taca') {
    info = taca(det);
    no(c, { name: 'taca', mesh: malhaGltf(c, 'taca', info.malha, 'vidro') });
    no(c, { name: 'taca_borda', mesh: malhaGltf(c, 'taca_borda', info.borda, 'vidro_borda') });
  }
  else if (rec === 'copinho') { info = copinho(det); no(c, { name: 'copinho', mesh: malhaGltf(c, 'copinho', info.malha, 'papel') }); }
  else { info = casquinha(rec === 'cascao' ? 0.135 : 0.105, rec === 'cascao' ? 0.033 : 0.028, det, rec === 'cascao'); no(c, { name: 'casquinha', mesh: malhaGltf(c, 'casquinha', info.malha, 'massa') }); }

  // bolas
  const { pos, expostas } = posicoesBolas(rec, sabores.length, R, info);
  const nosBola = sabores.map((sab, i) => {
    const seed = semente(sab + '#' + i + rec);
    const giro = quatEixo([0, 1, 0], i * 2.1);
    const n = no(c, { name: 'bola_' + i + '_' + sab, mesh: malhaGltf(c, 'bola_' + sab, malhaBola(sab, R, seed, det), 'sorvete'), translation: pos[i], rotation: giro });
    if (an.bola === i) {
      const pg = pegador(R);
      animBolaComPegador(c, n, pos[i], ajudante(c, 'pegador', [[pg.metal, 'metal'], [pg.cabo, 'doce']]));
    }
    return { n, seed, p: pos[i], giro };
  });
  if (!sabores.length) return fecharCena(c);

  // topo de cada bola exposta (no espaço da cena)
  const topoDe = (b) => [b.p[0], b.p[1] + pontoBola(R, [0, 1, 0], b.seed)[1], b.p[2]];
  const alvo = expostas.map((i) => nosBola[i]);
  const maisAlta = alvo.reduce((a, b) => (topoDe(b)[1] > topoDe(a)[1] ? b : a), alvo[0]);
  let topoFinal = topoDe(maisAlta);

  cobs.forEach((tipo) => {
    const animar = an.cobertura === tipo;
    if (CALDA[tipo]) {
      // frasco de vidro chega, inclina e despeja a calda em cada bola
      const fr = animar ? frasco(CALDA[tipo], false) : null;
      const aj = fr ? ajudante(c, 'frasco', [[fr.liquido, 'calda'], [fr.vidro, 'vidro']]) : null;
      const jt = fr ? no(c, { name: 'jato', mesh: malhaGltf(c, 'jato', jato(CALDA[tipo]), 'calda'), scale: [MIN, MIN, MIN] }) : null;
      const kf = [], kj = { T: [0], P: [0, 0, 0], E: [MIN, MIN, MIN] };
      const ALT = 0.045;
      alvo.forEach((b, k) => {
        const t = topoDe(b);
        const n = no(c, { name: 'calda_' + k, mesh: malhaGltf(c, 'calda_' + tipo + k, caldaNaBola(R, b.seed, tipo, det), 'calda'), translation: t, rotation: b.giro });
        if (!animar) return;
        const t0 = 0.4 + k * 0.6, bico = soma(t, [0, ALT, 0]);
        if (!k) kf.push([0, soma(bico, [0.12, 0.02, 0.05]), DE_PE]);
        kf.push([t0 - 0.05, bico, POUR], [t0 + 0.45, soma(bico, [0.004, 0, 0]), POUR]);
        animEscorrer(c, n, t0, 0.9);
        kj.T.push(t0 - 0.01, t0, t0 + 0.45, t0 + 0.46); kj.P.push(...bico, ...bico, ...bico, ...bico); kj.E.push(MIN, MIN, MIN, 1, ALT, 1, 1, ALT, 1, MIN, MIN, MIN);
      });
      if (animar) {
        const ult = kf[kf.length - 1];
        kf.push([ult[0] + 0.4, soma(ult[1], [0.1, 0.06, 0.04]), DE_PE]);
        mover(c, aj, kf);
        canal(c, jt, 'translation', kj.T, kj.P, 'STEP');
        canal(c, jt, 'scale', kj.T, kj.E, 'STEP');
      }
    } else if (tipo === 'granulado' || tipo === 'confete' || tipo === 'amendoim') {
      // a mão salpica por cima de cada bola
      const m = animar ? mao() : null, kf = [];
      alvo.forEach((b, k) => {
        const grupos = confeitos(R, b.seed + k, tipo, temCalda ? 0.0017 : 0, animar ? 5 : 1, det);
        const t0 = 0.4 + k * 0.55, pinca = soma(b.p, [0, 0.09, 0]);
        if (m && !k) kf.push([0, soma(pinca, [0.14, 0.1, -0.06])]);
        if (m) for (let j = 0; j <= 5; j++) kf.push([t0 - 0.05 + j * 0.09, soma(pinca, [0.008 * Math.cos(j * 1.7), 0.006 * Math.sin(j * 2.3), 0.008 * Math.sin(j * 1.7)])]);
        grupos.forEach((g, j) => {
          const n = no(c, { name: tipo + '_' + k + '_' + j, mesh: malhaGltf(c, tipo + k + j, g, 'doce'), translation: b.p, rotation: b.giro });
          if (animar) animQueda(c, n, b.p, 0.09, t0 + j * 0.09);
        });
      });
      if (m) { const u = kf[kf.length - 1]; kf.push([u[0] + 0.45, soma(u[1], [-0.1, 0.1, -0.06])]); mover(c, m, kf); }
    } else if (tipo === 'chantilly') {
      const raio = rec === 'taca' && sabores.length >= 2 && sabores.length < 4 ? R * 1.05 : R * 0.82;
      const centro = rec === 'taca' && sabores.length >= 2 && sabores.length < 4
        ? [0, Math.max(...alvo.map((b) => topoDe(b)[1])) - R * 0.35, sabores.length === 3 ? R * 0.02 : 0] : [topoFinal[0], topoFinal[1] - R * 0.18, topoFinal[2]];
      const n = no(c, { name: 'chantilly', mesh: malhaGltf(c, 'chantilly', chantilly(raio, det), 'sorvete'), translation: centro });
      if (animar) { animCrescer(c, n, 0.4); animarSaco(c, centro, raio); }
      topoFinal = [centro[0], centro[1] + raio * 1.2, centro[2]];
    } else if (tipo === 'cereja') {
      const p = [topoFinal[0], topoFinal[1] - 0.003, topoFinal[2]];
      const rot = quatEixo([0.3, 0, 1], 0.25);
      const n = no(c, { name: 'cereja', mesh: malhaGltf(c, 'cereja', cereja(), 'cereja'), translation: p, rotation: rot });
      if (animar) animCerejaComMao(c, n, p, rot, mao());
    } else if (tipo === 'wafer') {
      const b = maisAlta, dir = norm([0.55, 0.75, 0.35]);
      const p = [b.p[0] + dir[0] * R * 0.55, b.p[1] + dir[1] * R * 0.55, b.p[2] + dir[2] * R * 0.55];
      const n = no(c, { name: 'wafer', mesh: malhaGltf(c, 'wafer', wafer(), 'massa'), translation: p, rotation: quatYpara(dir) });
      if (animar) animWaferComMao(c, n, p, dir, mao());
    }
  });
  return fecharCena(c);
}

/** Cereja: a mão traz pelo cabinho e solta em cima. */
function animCerejaComMao(c, n, p, rot, m) {
  const solta = soma(p, [0, 0.07, 0]), ini = soma(solta, [0.14, 0.09, -0.06]);
  const cabo = [0.006, 0.041, 0.002];   // onde a mão segura (ponta do cabinho)
  canal(c, n, 'translation', [0, 0.45, 0.55, 0.78, 0.86, 0.95], [...ini, ...solta, ...solta, ...p, ...soma(p, [0, 0.004, 0]), ...p]);
  canal(c, n, 'scale', [0, 0.55, 0.78, 0.86, 0.95], [1, 1, 1, 1, 1, 1, 1.1, 0.85, 1.1, 0.97, 1.04, 0.97, 1, 1, 1]);
  if (m) mover(c, m, [[0, soma(ini, cabo)], [0.45, soma(solta, cabo)], [0.58, soma(solta, soma(cabo, [0, 0.008, 0]))], [1.0, soma(solta, [-0.1, 0.12, -0.06])]]);
}
/** Wafer: a mão espeta o biscoito no sorvete. */
function animWaferComMao(c, n, p, dir, m) {
  const L = 0.07, D = 0.07, ini = soma(p, dir.map((x) => x * D));
  canal(c, n, 'translation', [0, 0.4, 0.85], [...ini, ...ini, ...p]);
  if (m) {
    const ponta = (q) => soma(q, dir.map((x) => x * (L - 0.004)));
    mover(c, m, [[0, soma(ponta(ini), [0.12, 0.08, -0.05])], [0.4, ponta(ini)], [0.85, ponta(p)], [0.95, ponta(p)], [1.3, soma(ponta(p), [0.09, 0.1, -0.05])]]);
  }
}
/** Saco de confeitar fazendo o chantilly em espiral (sobe enquanto o chantilly cresce). */
function animarSaco(c, centro, raio) {
  const sc = sacoConfeitar();
  const aj = ajudante(c, 'saco', [[sc.bico, 'metal'], [sc.saco, 'tecido']]);
  const kf = [[0, soma(centro, [0.1, 0.16, 0.05])]];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12, a = u * Math.PI * 2 * 2.6, rho = raio * 0.62 * (1 - u);
    kf.push([0.4 + u * 0.6, soma(centro, [rho * Math.cos(a), raio * 1.25 * u + 0.004, -rho * Math.sin(a)])]);
  }
  const u = kf[kf.length - 1];
  kf.push([u[0] + 0.15, soma(u[1], [0, 0.02, 0])], [u[0] + 0.5, soma(u[1], [0.08, 0.12, 0.04])]);
  mover(c, aj, kf);
}

function montarMilkshake(c, rec, sabores, cobs, an, det, mao) {
  const copo = copoMilk(RECIPIENTES[rec].H, det);
  const { H, base } = copo;
  const topoLiq = H * 0.84;
  // líquido: uma faixa por sabor (de baixo para cima), com espuma no topo
  if (sabores.length) {
    const alt = (topoLiq - base - 0.0005) / sabores.length;
    sabores.forEach((sab, i) => {
      const s = SABORES[sab] || SABORES.creme;
      const cor = mistura(corLin(s.cor), [1, 1, 1], 0.04);
      const y0 = base + 0.0004 + i * alt, y1 = y0 + alt;
      const ultimo = i === sabores.length - 1;
      const seed = semente(sab + i);
      const parede = revolucao((v) => { const y = y0 + (y1 - y0) * v; return [copo.raioDentro(y) - 0.0005, y - y0]; }, det ? 72 : 48, 8, 1,
        (u, v) => cor.map((x) => x * (0.94 + 0.08 * ruido(u * 14, v * 4, 0, seed)) * (ultimo && v > 0.9 ? 1.08 : 1)));
      const tampa = revolucao((v) => [(copo.raioDentro(y1) - 0.0005) * (1 - v), (y1 - y0) + 0.0012 * Math.sin(v * Math.PI)], det ? 72 : 48, 6, 1,
        (u) => (ultimo ? mistura(cor, [1, 1, 1], 0.3) : cor).map((x) => x * (0.95 + 0.06 * ruido(u * 20, 0, 0, seed))));
      const fundo = i === 0 ? revolucao((v) => [(copo.raioDentro(y0) - 0.0005) * v, 0], 48, 2, -1, () => cor) : null;
      const n = no(c, { name: 'liquido_' + i + '_' + sab, mesh: malhaGltf(c, 'liquido_' + i, juntar([parede, tampa, fundo]), 'liquido'), translation: [0, y0, 0] });
      if (an.bola === i) {
        // jarra de vidro despeja o milkshake no copo
        canal(c, n, 'scale', [0, 0.45, 1.25], [MIN, MIN, MIN, 1, 0.02, 1, 1, 1, 1]);
        const jr = frasco(s.cor, true);
        const aj = ajudante(c, 'jarra', [[jr.liquido, 'liquido'], [jr.vidro, 'vidro']]);
        const bico = [copo.rt * 0.35, H + 0.035, 0], alt = bico[1] - y0;
        mover(c, aj, [[0, soma(bico, [0.16, 0.02, 0.06]), DE_PE], [0.4, bico, POUR], [1.25, soma(bico, [0.004, 0, 0]), POUR], [1.65, soma(bico, [0.15, 0.05, 0.06]), DE_PE]]);
        const jt = no(c, { name: 'jato', mesh: malhaGltf(c, 'jato_milk', jato(s.cor, true), 'liquido'), translation: bico, scale: [MIN, MIN, MIN] });
        canal(c, jt, 'scale', [0, 0.42, 1.25], [MIN, MIN, MIN, 1, alt, 1, MIN, MIN, MIN], 'STEP');
      }
    });
  }
  let topo = sabores.length ? topoLiq : base;
  const temChantilly = cobs.includes('chantilly');
  // caldas: fios escorrendo por dentro do vidro (+ por cima do chantilly)
  cobs.forEach((tipo) => {
    const animar = an.cobertura === tipo;
    if (CALDA[tipo]) {
      const cor = corLin(CALDA[tipo]);
      const rnd = aleatorio(semente(tipo));
      const fios = [];
      for (let k = 0; k < 9; k++) {
        const th = (k / 9) * Math.PI * 2 + rnd() * 0.4, comp = (0.25 + rnd() * 0.55) * (H - base), w = 0.0022 + rnd() * 0.0016;
        fios.push(tubo((t) => {
          const y = H - 0.004 - comp * t, r = copo.raioDentro(y) - 0.0014, a = th + 0.015 * Math.sin(t * 4 + k);
          return [r * Math.cos(a), y - (H - 0.004), -r * Math.sin(a)];
        }, (t) => w * 0.6 * (1 - 0.3 * t) * (t > 0.94 ? 1.3 : 1), 10, 30, () => 1, () => cor));
      }
      const n = no(c, { name: 'calda_copo', mesh: malhaGltf(c, 'calda_copo_' + tipo, juntar(fios), 'calda'), translation: [0, H - 0.004, 0] });
      if (animar) {
        animEscorrer(c, n, 0.4, 1.1);
        // frasco de vidro dá a volta na borda despejando
        const fr = frasco(CALDA[tipo], false);
        const aj = ajudante(c, 'frasco', [[fr.liquido, 'calda'], [fr.vidro, 'vidro']]);
        const kf = [[0, [0.14, H + 0.06, 0.06], DE_PE]], P = [], T = [];
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI * 2, r = copo.rt * 0.78, b = [r * Math.cos(a), H + 0.03, -r * Math.sin(a)];
          kf.push([0.4 + i * 0.1, b, POUR]); T.push(+(0.4 + i * 0.1).toFixed(3)); P.push(...b);
        }
        kf.push([1.6, [0.14, H + 0.08, 0.06], DE_PE]);
        mover(c, aj, kf);
        const jt = no(c, { name: 'jato', mesh: malhaGltf(c, 'jato', jato(CALDA[tipo]), 'calda'), scale: [MIN, MIN, MIN] });
        canal(c, jt, 'translation', T, P);
        canal(c, jt, 'scale', [0, 0.41, 1.21], [MIN, MIN, MIN, 1, 0.03, 1, MIN, MIN, MIN], 'STEP');
      }
    }
  });
  if (temChantilly) {
    const raio = copo.rt * 0.98;
    const p = [0, H - 0.008, 0];
    const n = no(c, { name: 'chantilly', mesh: malhaGltf(c, 'chantilly', chantilly(raio, det), 'sorvete'), translation: p });
    if (an.cobertura === 'chantilly') { animCrescer(c, n, 0.4); animarSaco(c, p, raio); }
    topo = p[1] + raio * 1.22;
    const caldaTop = cobs.find((x) => CALDA[x]);
    if (caldaTop) {
      // zigue-zague de calda por cima do chantilly
      const cor = corLin(CALDA[caldaTop]);
      const z = tubo((t) => {
        const a = t * Math.PI * 2 * 3.2, rho = raio * 0.62 * (1 - t) + 0.004;
        return [rho * Math.cos(a), raio * 1.2 * (0.1 + 0.62 * t) + 0.002, -rho * Math.sin(a)];
      }, () => 0.0019, 8, 90, () => 1, () => cor);
      const nz = no(c, { name: 'calda_topo', mesh: malhaGltf(c, 'calda_topo', z, 'calda'), translation: p });
      if (an.cobertura === caldaTop) animCrescer(c, nz, 0.4);
    }
  }
  cobs.forEach((tipo) => {
    const animar = an.cobertura === tipo;
    if (tipo === 'granulado' || tipo === 'confete' || tipo === 'amendoim') {
      // espalhado por cima (chantilly ou líquido)
      const raio = temChantilly ? copo.rt * 0.75 : copo.raioDentro(topo) * 0.85;
      const grupos = confeitos(raio, 7, tipo, 0, animar ? 5 : 1, det);
      const p = [0, temChantilly ? H + 0.004 : topo - raio * 0.98, 0];
      grupos.forEach((g, j) => {
        const n = no(c, { name: tipo + '_' + j, mesh: malhaGltf(c, tipo + j, g, 'doce'), translation: p, scale: [1, temChantilly ? 1 : 0.15, 1] });
        if (animar) animQueda(c, n, p, 0.09, 0.4 + j * 0.09);
      });
      const m = animar ? mao() : null;
      if (m) {
        const pinca = soma(p, [0, 0.1, 0]), kf = [[0, soma(pinca, [0.14, 0.1, -0.06])]];
        for (let j = 0; j <= 5; j++) kf.push([0.35 + j * 0.09, soma(pinca, [0.01 * Math.cos(j * 1.7), 0, 0.01 * Math.sin(j * 1.7)])]);
        kf.push([1.2, soma(pinca, [-0.1, 0.1, -0.06])]);
        mover(c, m, kf);
      }
    } else if (tipo === 'cereja') {
      const p = [0.004, topo - 0.004, 0];
      const n = no(c, { name: 'cereja', mesh: malhaGltf(c, 'cereja', cereja(), 'cereja'), translation: p });
      if (animar) animCerejaComMao(c, n, p, [0, 0, 0, 1], mao());
    } else if (tipo === 'wafer') {
      const dir = norm([-0.45, 0.85, 0.3]);
      const p = [-0.012, topo - 0.022, 0.004];
      const n = no(c, { name: 'wafer', mesh: malhaGltf(c, 'wafer', wafer(), 'massa'), translation: p, rotation: quatYpara(dir) });
      if (animar) animWaferComMao(c, n, p, dir, mao());
    }
  });
  // canudo aparece quando há bebida
  if (sabores.length) {
    const comp = H * 1.28, dir = norm([0.28, 1, -0.12]);
    const p = [-0.011, base + 0.003, 0.004];
    const n = no(c, { name: 'canudo', mesh: malhaGltf(c, 'canudo', canudo(comp), 'doce'), translation: p, rotation: quatYpara(dir) });
    if (an.bola === 0 && sabores.length === 1) animDeslizar(c, n, p, dir, 0.1, 1.5);
  }
  // o vidro por último (transparência desenhada por cima do conteúdo)
  no(c, { name: 'copo', mesh: malhaGltf(c, 'copo', copo.malha, 'vidro') });
  return fecharCena(c);
}

/** Medidas aproximadas (cm) do recipiente montado, para o cadastro do tamanho. */
export function medidasRecipiente(rec) {
  return { casquinha: { largura: 6.2, profundidade: 6.2, altura: 16 }, cascao: { largura: 7.6, profundidade: 7.6, altura: 21 },
    taca: { largura: 12.4, profundidade: 12.4, altura: 15 }, copinho: { largura: 8.2, profundidade: 8.2, altura: 9.5 },
    milkshake: { largura: 8.2, profundidade: 8.2, altura: 20 }, milkshake300: { largura: 7.8, profundidade: 7.8, altura: 17.5 } }[rec] || { largura: 6, profundidade: 6, altura: 15 };
}
