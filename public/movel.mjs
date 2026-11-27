/* =========================================================================
   MenuReal — Móvel pela foto
   A IA lê a foto do anúncio e devolve a FICHA do móvel (medidas, partes de
   baixo para cima, colunas, portas, gavetas, nichos, puxador e cores).
   Aqui a ficha vira um 3D fiel: medidas exatas, uma cor por variação
   (o cliente troca no catálogo) e peças com nome (Raio-X automático).
   Serve para móveis "de caixa": armário, guarda-roupa, cômoda, rack,
   estante, sapateira, balcão, criado-mudo, cristaleira.
   normalizarMovel roda também no servidor; montarMovel só no navegador.
   ========================================================================= */
import { escreverGlb } from './glb.mjs';

export const TIPOS_ITEM = {
  porta: 'Porta', portas: '2 portas', porta_vidro: 'Porta de vidro', portas_vidro: '2 portas de vidro',
  espelho: 'Porta com espelho', basculante: 'Porta basculante (abre para cima)', gaveta: 'Gaveta', nicho: 'Nicho aberto'
};
export const BASES = { pes: 'Pés', rodape: 'Rodapé', rodizios: 'Rodízios', nenhuma: 'Direto no chão' };
export const PUXADORES = { perfil: 'Perfil de alumínio na borda', barra: 'Barra', botao: 'Botão', cava: 'Cava (embutido)', nenhum: 'Sem puxador' };
export const DOBRADICAS = { auto: 'Automático', esquerda: 'Esquerda', direita: 'Direita' };

const num = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; };
const txt = (v, n, d = '') => (String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, n) || d);
const hexOk = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim().toUpperCase() : d);
const lista = (v) => (Array.isArray(v) ? v : []);

export function normalizarMovel(f) {
  f = f && typeof f === 'object' ? f : {};
  const largura = num(f.largura, 20, 400, 100), altura = num(f.altura, 20, 300, 180), profundidade = num(f.profundidade, 15, 120, 45);
  const bt = f.base && BASES[f.base.tipo] ? f.base.tipo : 'nenhuma';
  const base = { tipo: bt, altura: bt === 'nenhuma' ? 0 : num(f.base.altura, 2, Math.min(40, altura * 0.3), bt === 'rodape' ? 8 : 10) };
  const corpo = { nome: txt(f.corpo && f.corpo.nome, 40, 'Branco'), hex: hexOk(f.corpo && f.corpo.hex, '#EDECE8'), madeira: !!(f.corpo && f.corpo.madeira) };
  const puxador = { tipo: f.puxador && PUXADORES[f.puxador.tipo] ? f.puxador.tipo : 'perfil', hex: hexOk(f.puxador && f.puxador.hex, '#C4CAD2') };
  const vistos = {};
  let cores = lista(f.cores).map((c) => ({ nome: txt(c && c.nome, 30), hex: hexOk(c && c.hex, ''), madeira: !!(c && c.madeira) }))
    .filter((c) => { const k = c.nome.toLowerCase(); if (!c.nome || !c.hex || vistos[k]) return false; vistos[k] = 1; return true; }).slice(0, 8);
  if (!cores.length) cores = [{ nome: 'Padrão', hex: '#8A8D90', madeira: false }];
  const secoes = lista(f.secoes).slice(0, 4).map((s) => ({
    altura: num(s && s.altura, 1, 300, 50),
    profundidade: num(s && s.profundidade, 0, 120, 0),   // 0 = a profundidade do móvel
    tampo: !!(s && s.tampo),
    colunas: lista(s && s.colunas).slice(0, 8).map((c) => ({
      largura: num(c && c.largura, 1, 400, 40),
      itens: lista(c && c.itens).slice(0, 10).map((it) => ({
        tipo: it && TIPOS_ITEM[it.tipo] ? it.tipo : 'nicho',
        altura: num(it && it.altura, 1, 300, 30),
        prateleiras: Math.round(num(it && it.prateleiras, 0, 8, 0)),
        divisoes: Math.round(num(it && it.divisoes, 0, 6, 0)),
        dobradica: it && DOBRADICAS[it.dobradica] ? it.dobradica : 'auto'
      }))
    })).filter((c) => c.itens.length)
  })).filter((s) => s.colunas.length);
  // pelo menos uma parte usa a profundidade toda (senão a medida não fecharia)
  if (secoes.length && !secoes.some((s) => !s.profundidade || s.profundidade >= profundidade)) secoes.forEach((s) => { if (s.profundidade === Math.max(...secoes.map((x) => x.profundidade))) s.profundidade = 0; });
  return {
    v: 1, nome: txt(f.nome, 60, 'Móvel'), material: txt(f.material, 40, ''), largura, altura, profundidade, base, corpo, puxador, cores, secoes,
    observacoes: txt(f.observacoes, 1200, '')
  };
}

/** Resumo para a tela: quantas portas, gavetas e nichos. */
export function resumoMovel(f) {
  const r = { portas: 0, gavetas: 0, nichos: 0 };
  f.secoes.forEach((s) => s.colunas.forEach((c) => c.itens.forEach((it) => {
    if (it.tipo === 'gaveta') r.gavetas++; else if (it.tipo === 'nicho') r.nichos++; else r.portas += /^portas/.test(it.tipo) ? 2 : 1;
  })));
  return r;
}

// ------------------------------------------------------------------ texturas
function sorteio(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function ruido(r, n, sx, sy) {   // ruído suave, esticado sx × sy pixels
  const gw = Math.ceil(n / sx) + 2, gh = Math.ceil(n / sy) + 2, g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(n * n), s = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) {
    const gy = y / sy, y0 = Math.floor(gy), fy = s(gy - y0);
    for (let x = 0; x < n; x++) {
      const gx = x / sx, x0 = Math.floor(gx), fx = s(gx - x0), i = y0 * gw + x0;
      const a = g[i] + (g[i + 1] - g[i]) * fx, b = g[i + gw] + (g[i + gw + 1] - g[i + gw]) * fx;
      out[y * n + x] = a + (b - a) * fy;
    }
  }
  return out;
}
function rgbDe(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
// madeira de veio reto (como MDF/MDP madeirado), na cor pedida
function texturaMadeira(hex, seed, n) {
  const r = sorteio(seed), L = n * 3;
  let perfil = new Float32Array(L);
  for (let x = 0; x < L;) {
    const w = 0.8 + r() * 4.2, f = Math.pow(0.15 + r() * 0.85, 1.6), i0 = Math.floor(x);
    for (let k = 0; k < Math.max(1, Math.floor(w)); k++) if (i0 + k < L) perfil[i0 + k] += f;
    x += -Math.log(1 - r() * 0.999) * 9 * n / 1024 + w;
  }
  const suav = new Float32Array(L), faixas = new Float32Array(L), alea = new Float32Array(L).map(() => r());
  for (let i = 0; i < L; i++) {
    let s = 0; for (let k = -2; k <= 2; k++) s += perfil[Math.min(L - 1, Math.max(0, i + k))] * [0.1, 0.2, 0.4, 0.2, 0.1][k + 2];
    suav[i] = s;
  }
  let acc = 0; const jan = Math.round(90 * n / 1024);
  for (let i = 0; i < L; i++) { acc += alea[i] - (i >= jan ? alea[i - jan] : 0); faixas[i] = acc / Math.min(i + 1, jan); }
  let mx = 0, media = 0; for (let i = 0; i < L; i++) { mx = Math.max(mx, suav[i]); media += faixas[i] / L; }
  const e = n / 1024;
  const d1 = ruido(r, n, 256 * e, 340 * e), d2 = ruido(r, n, 64 * e, 120 * e), fib = ruido(r, n, 1, 90 * e), man = ruido(r, n, 300 * e, 300 * e);
  const base = rgbDe(hex), claro = base.map((v) => Math.min(255, v * 1.1 + 6)), escuro = base.map((v) => v * 0.6);
  const cv = document.createElement('canvas'); cv.width = cv.height = n;
  const ctx = cv.getContext('2d'), im = ctx.createImageData(n, n), px = im.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, xi = Math.min(L - 1, Math.max(0, Math.round(x + (d1[i] - 0.5) * 26 * e + (d2[i] - 0.5) * 5 * e + n)));
    let v = 0.62 * suav[xi] / (mx || 1) + 0.22 * (fib[i] - 0.5) + 0.25 * (faixas[xi] - media) * 4 + 0.12 * (man[i] - 0.5);
    v = Math.max(-0.4, Math.min(1, v));
    const t = Math.max(0, v), luz = 1 + Math.min(0.4, Math.max(0, -v)) * 0.18;
    for (let k = 0; k < 3; k++) px[i * 4 + k] = Math.min(255, (claro[k] + (escuro[k] - claro[k]) * t) * luz);
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  return cv;
}
function canvasJpeg(cv) {
  return new Promise((ok, falha) => cv.toBlob((b) => (b ? b.arrayBuffer().then((x) => ok(new Uint8Array(x)), falha) : falha(new Error('Sem imagem'))), 'image/jpeg', 0.86));
}

// ------------------------------------------------------------------ montar o 3D
const E = 1.5, FOLGA = 0.3, TAMPO = 2.5, FE = 1.5, TILE = 120;
export async function montarMovel(fBruta) {
  const f = normalizarMovel(fBruta);
  if (!f.secoes.length) throw new Error('A ficha não tem nenhuma parte do móvel.');
  const g = FOLGA / 2;
  const sal = { perfil: 0.4, cava: 0, barra: 2.8, botao: 2.4, nenhum: 0 }[f.puxador.tipo];
  const W = f.largura, H = f.altura, D = f.profundidade;
  const temTampo = f.secoes.some((s) => s.tampo);
  const sobra = temTampo ? Math.min(1.5, W * 0.02) : 0;
  const XL = -W / 2 + sobra, XR = W / 2 - sobra;
  const Pmax = Math.max(8, D - 0.1 - FE - sal);
  const yb = f.base.altura;
  const nS = f.secoes.length;
  // ---- alturas: base, partes e as chapas entre elas
  const bordas = [{ t: E, tipo: 'base' }];
  f.secoes.forEach((s, i) => bordas.push(s.tampo ? { t: TAMPO, tipo: 'tampo' } : { t: E, tipo: i === nS - 1 ? 'topo' : 'divisao' }));
  const livre = H - yb - bordas.reduce((a, b) => a + b.t, 0);
  if (livre < nS * 4) throw new Error('Altura pequena demais para as partes do móvel.');
  const somaH = f.secoes.reduce((a, s) => a + s.altura, 0);
  let y = yb;
  bordas[0].y0 = y; y += E;
  const sec = f.secoes.map((s, i) => {
    const h = livre * s.altura / somaH, o = { s, y0: y, y1: y + h, P: s.profundidade ? Math.max(8, Math.min(Pmax, s.profundidade - 0.1 - FE - sal)) : Pmax };
    y += h; bordas[i + 1].y0 = y; y += bordas[i + 1].t;
    return o;
  });

  // ---- peças (cada uma vira um ou mais nós com o mesmo nome: o Raio-X junta)
  const pecas = [];
  const material = f.material ? f.material + ' ' : '';
  function peca(nome, tipo, mat, extra) { const p = { ex: Object.assign({ nome, tipo, material: mat, explodir: 'frente' }, extra || {}), partes: new Map() }; pecas.push(p); return p; }
  function caixa(p, m, x0, x1, y0, y1, z0, z1, du = 0) {
    if (x1 - x0 < 0.05 || y1 - y0 < 0.05 || z1 - z0 < 0.05) return;
    if (!p.partes.has(m)) p.partes.set(m, { pos: [], nor: [], uv: [], idx: [] });
    const q = p.partes.get(m);
    const faces = [[[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]], [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]], [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]], [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]]];
    for (const [nr, qs] of faces) {
      const b = q.pos.length / 3;
      for (const [vx, vy, vz] of qs) {
        q.pos.push(vx, vy, vz); q.nor.push(...nr);
        if (nr[0]) q.uv.push((vz + du) / TILE, 1 - vy / TILE); else if (nr[1]) q.uv.push((vx + du) / TILE, vz / TILE); else q.uv.push((vx + du) / TILE, 1 - vy / TILE);
      }
      q.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  function cilindro(p, m, cx, cz, y0, y1, r0, r1, seg = 24) {
    if (!p.partes.has(m)) p.partes.set(m, { pos: [], nor: [], uv: [], idx: [] });
    const q = p.partes.get(m), k = Math.atan2(r0 - r1, y1 - y0);
    let b = q.pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const a = 2 * Math.PI * i / seg, c = Math.cos(a), s = Math.sin(a);
      q.pos.push(cx + r0 * c, y0, cz + r0 * s, cx + r1 * c, y1, cz + r1 * s);
      const nn = [c * Math.cos(k), Math.sin(k), s * Math.cos(k)]; q.nor.push(...nn, ...nn); q.uv.push(i / seg, 1, i / seg, 0);
    }
    for (let i = 0; i < seg; i++) { const a = b + 2 * i; q.idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    b = 0;
    for (const [yy, rr, sg] of [[y0, r0, -1], [y1, r1, 1]]) {
      const c0 = q.pos.length / 3; q.pos.push(cx, yy, cz); q.nor.push(0, sg, 0); q.uv.push(0.5, 0.5);
      for (let i = 0; i <= seg; i++) { const a = 2 * Math.PI * i / seg; q.pos.push(cx + rr * Math.cos(a), yy, cz + rr * Math.sin(a)); q.nor.push(0, sg, 0); q.uv.push(0.5, 0.5); }
      for (let i = 0; i < seg; i++) q.idx.push(...(sg < 0 ? [c0, c0 + 1 + i, c0 + 2 + i] : [c0, c0 + 2 + i, c0 + 1 + i]));
    }
  }
  // materiais: 0 corpo, 1 fundo, 2 puxador, 3 pés, 4 vidro, 5 espelho, 6.. frentes (uma por cor)
  const M = { corpo: 0, fundo: 1, pux: 2, pes: 3, vidro: 4, espelho: 5, frente: 6 };
  const rotCorpo = (material || 'Corpo ') + f.corpo.nome.toLowerCase();
  const rotFrente = (material ? material + 'na cor escolhida' : 'Na cor escolhida') + (f.puxador.tipo === 'nenhum' ? '' : ' · puxador: ' + PUXADORES[f.puxador.tipo].toLowerCase());

  // ---- estrutura
  const lateral = (lado) => peca(lado < 0 ? 'Lateral esquerda' : 'Lateral direita', 'lateral', rotCorpo, { explodir: lado < 0 ? 'esquerda' : 'direita' });
  const latE = lateral(-1), latD = lateral(1);
  sec.forEach((o, i) => {
    const yA = i === 0 ? yb : o.y0;   // a chapa entre as partes já está dentro da lateral de baixo
    const yZ = bordas[i + 1].tipo === 'tampo' ? o.y1 : o.y1 + E;
    caixa(latE, M.corpo, XL, XL + E, yA, yZ, 0, o.P); caixa(latD, M.corpo, XR - E, XR, yA, yZ, 0, o.P);
  });
  caixa(peca('Base', 'estrutura', rotCorpo, { explodir: 'baixo' }), M.corpo, XL + E, XR - E, yb, yb + E, 0, sec[0].P);
  let nTampo = 0, nDiv = 0;
  bordas.slice(1).forEach((b, i) => {
    const de = sec[i], pra = sec[i + 1];
    if (b.tipo === 'tampo') { nTampo++; caixa(peca(nS > 1 && i < nS - 1 ? 'Tampo do meio' : 'Tampo', 'tampo', rotCorpo, { explodir: 'cima' }), M.corpo, -W / 2, W / 2, b.y0, b.y0 + TAMPO, 0, D); }
    else if (b.tipo === 'topo') caixa(peca('Topo', 'estrutura', rotCorpo, { explodir: 'cima' }), M.corpo, XL + E, XR - E, b.y0, b.y0 + E, 0, de.P);
    else { nDiv++; caixa(peca('Divisão entre as partes', 'divisoria', rotCorpo, { explodir: 'frente' }), M.corpo, XL + E, XR - E, b.y0, b.y0 + E, 0, Math.max(de.P, pra ? pra.P : 0)); }
  });
  const fundo = peca('Fundo', 'fundo', rotCorpo, { explodir: 'tras' });
  sec.forEach((o) => caixa(fundo, M.fundo, XL + E, XR - E, o.y0, o.y1, 0, 0.3));
  // base: pés, rodapé ou rodízios
  if (f.base.tipo !== 'nenhuma') {
    const pb = peca(f.base.tipo === 'pes' ? 'Pés' : f.base.tipo === 'rodizios' ? 'Rodízios' : 'Rodapé', f.base.tipo === 'rodape' ? 'rodape' : 'estrutura', f.base.tipo === 'rodape' ? rotCorpo : '', { explodir: 'baixo' });
    if (f.base.tipo === 'rodape') caixa(pb, M.corpo, XL + 1, XR - 1, 0, yb, 2, sec[0].P - 3);
    else {
      const n = Math.max(1, Math.ceil((XR - XL - 8) / 75)), zs = [4, sec[0].P - 4];
      for (let k = 0; k <= n; k++) for (const z of zs) {
        const x = XL + 4 + (XR - XL - 8) * k / n;
        if (f.base.tipo === 'pes') cilindro(pb, M.pes, x, z, 0, yb, 2.0, 2.4);
        else { cilindro(pb, M.pes, x, z, 0, yb * 0.75, 2.6, 2.6); cilindro(pb, M.pes, x, z, yb * 0.75, yb, 1.4, 1.8); }
      }
    }
  }

  // ---- colunas, prateleiras, nichos, portas e gavetas
  let nPorta = 0, nGaveta = 0, nPrat = 0, nDivisoria = 0, nNicho = 0, du = 0;
  const xi0 = XL + E, xi1 = XR - E;
  sec.forEach((o, si) => {
    const s = o.s, nc = s.colunas.length, livreW = xi1 - xi0 - (nc - 1) * E, somaW = s.colunas.reduce((a, c) => a + c.largura, 0);
    const zf0 = o.P + 0.1, zf1 = zf0 + FE;
    let x = xi0;
    s.colunas.forEach((c, ci) => {
      const w = livreW * c.largura / somaW, cx0 = x, cx1 = x + w;
      x = cx1 + E;
      if (ci < nc - 1) { nDivisoria++; caixa(peca('Divisória ' + nDivisoria, 'divisoria', rotCorpo, { explodir: 'frente' }), M.corpo, cx1, cx1 + E, o.y0, o.y1, 0.3, o.P); }
      // itens de baixo para cima; entre eles uma prateleira (gaveta em cima de gaveta não leva)
      const its = c.itens, chapas = its.slice(1).map((it, k) => !(it.tipo === 'gaveta' && its[k].tipo === 'gaveta'));
      const livreH = o.y1 - o.y0 - chapas.filter(Boolean).length * E, somaI = its.reduce((a, it) => a + it.altura, 0);
      let yy = o.y0;
      const faixas = its.map((it, k) => {
        const h = livreH * it.altura / somaI, r = { y0: yy, y1: yy + h };
        yy += h;
        if (k < its.length - 1 && chapas[k]) { nPrat++; caixa(peca('Prateleira ' + nPrat, 'prateleira', rotCorpo, { explodir: 'frente' }), M.corpo, cx0, cx1, yy, yy + E, 0.3, o.P - 0.5); yy += E; }
        return r;
      });
      // até onde a frente cobre: laterais e topo inteiros; divisórias e prateleiras pela metade; tampo não
      const fx0 = ci === 0 ? XL : cx0 - E / 2, fx1 = ci === nc - 1 ? XR : cx1 + E / 2;
      its.forEach((it, k) => {
        const fy = faixas[k];
        const abaixo = k > 0 ? (chapas[k - 1] ? fy.y0 - E / 2 : fy.y0) : (si === 0 ? yb : bordas[si].tipo === 'tampo' ? fy.y0 : fy.y0 - E / 2);
        const acima = k < its.length - 1 ? (chapas[k] ? fy.y1 + E / 2 : fy.y1) : (bordas[si + 1].tipo === 'topo' ? fy.y1 + E : bordas[si + 1].tipo === 'tampo' ? fy.y1 : fy.y1 + E / 2);
        const fy0 = abaixo + g, fy1 = acima - g;
        // prateleiras e divisões internas (nichos e atrás das portas)
        for (let m = 1; m <= it.prateleiras; m++) { const ys = fy.y0 + (fy.y1 - fy.y0) * m / (it.prateleiras + 1); nPrat++; caixa(peca('Prateleira ' + nPrat, 'prateleira', rotCorpo, { explodir: 'frente' }), M.corpo, cx0, cx1, ys - E / 2, ys + E / 2, 0.3, o.P - 0.5); }
        for (let m = 1; m <= it.divisoes; m++) { const xs = cx0 + w * m / (it.divisoes + 1); nDivisoria++; caixa(peca('Divisória ' + nDivisoria, 'divisoria', rotCorpo, { explodir: 'frente' }), M.corpo, xs - 0.6, xs + 0.6, fy.y0, fy.y1, 0.3, o.P - 0.5); }
        if (it.tipo === 'nicho') { nNicho++; return; }
        // frentes
        const folhas = /^portas/.test(it.tipo) ? [[fx0 + g, (fx0 + fx1) / 2 - g, 'esquerda'], [(fx0 + fx1) / 2 + g, fx1 - g, 'direita']]
          : [[fx0 + g, fx1 - g, it.dobradica !== 'auto' ? it.dobradica : nc > 1 && ci === nc - 1 ? 'direita' : 'esquerda']];
        folhas.forEach(([a, b, lado]) => {
          du += 37;
          const gav = it.tipo === 'gaveta', basc = it.tipo === 'basculante', vidro = /vidro/.test(it.tipo);
          const nome = gav ? 'Gaveta ' + (++nGaveta) : 'Porta ' + (++nPorta);
          const p = peca(nome, gav ? 'gaveta' : 'porta', vidro ? 'Vidro com moldura de alumínio' : rotFrente, {
            mov: gav ? 'gaveta' : basc ? 'basculante' : lado === 'direita' ? 'porta_dir' : 'porta_esq', explodir: 'frente',
            desc: gav ? 'Gaveta de correr.' : basc ? 'Porta basculante: abre para cima.' : 'Porta de abrir, dobradiça à ' + lado + '.'
          });
          if (vidro) {   // moldura de alumínio + vidro
            caixa(p, M.pux, a, a + 2.2, fy0, fy1, zf0, zf1); caixa(p, M.pux, b - 2.2, b, fy0, fy1, zf0, zf1);
            caixa(p, M.pux, a + 2.2, b - 2.2, fy0, fy0 + 2.2, zf0, zf1); caixa(p, M.pux, a + 2.2, b - 2.2, fy1 - 2.2, fy1, zf0, zf1);
            caixa(p, M.vidro, a + 2.2, b - 2.2, fy0 + 2.2, fy1 - 2.2, zf0 + 0.5, zf0 + 0.9);
          } else caixa(p, M.frente, a, b, fy0, fy1, zf0, zf1, du);
          if (it.tipo === 'espelho') caixa(p, M.espelho, a + 3, b - 3, fy0 + 3, fy1 - 3, zf1, zf1 + 0.2);
          puxador(p, a, b, fy0, fy1, zf0, zf1, gav, basc, lado);
          if (gav) {   // caixa da gaveta (corre junto com a frente)
            const bx0 = cx0 + 1.3, bx1 = cx1 - 1.3, by0 = fy.y0 + 1.5, by1 = Math.max(by0 + 5, fy.y1 - 2.5), bz0 = 2.5, bz1 = zf0 - 0.1;
            caixa(p, M.corpo, bx0, bx0 + 1.2, by0, by1, bz0, bz1); caixa(p, M.corpo, bx1 - 1.2, bx1, by0, by1, bz0, bz1);
            caixa(p, M.corpo, bx0 + 1.2, bx1 - 1.2, by0, by1, bz0, bz0 + 1.2); caixa(p, M.corpo, bx0 + 1.2, bx1 - 1.2, by0, by1, bz1 - 1.2, bz1);
            caixa(p, M.corpo, bx0 + 1.2, bx1 - 1.2, by0, by0 + 0.3, bz0 + 1.2, bz1 - 1.2);
          }
        });
      });
    });
  });
  function puxador(p, a, b, y0, y1, z0, z1, gav, basc, lado) {
    const t = f.puxador.tipo, alto = (y0 + y1) / 2 > 110, livre = lado === 'direita' ? 'esq' : 'dir';
    const xl = livre === 'dir' ? b : a, dx = livre === 'dir' ? -1 : 1, perto = Math.min(y1 - 6, Math.max(y0 + 6, 105));
    if (t === 'nenhum') return;
    if (t === 'perfil' || t === 'cava') {
      const m = t === 'cava' ? M.fundo : M.pux, zz1 = t === 'cava' ? z1 : z1 + 0.4;
      if (!gav && !basc && y1 - y0 > 110) caixa(p, m, livre === 'dir' ? b - 1.4 : a, livre === 'dir' ? b : a + 1.4, y0 + 0.2, y1 - 0.2, z0 - 0.2, zz1);   // porta alta: perfil na lateral
      else if (gav || (!alto && !basc)) caixa(p, m, a + 0.2, b - 0.2, y1 - 1.4, y1, z0 - 0.2, zz1);
      else caixa(p, m, a + 0.2, b - 0.2, y0, y0 + 1.4, z0 - 0.2, zz1);
      return;
    }
    if (t === 'barra') {
      if (gav || basc) {
        const L = Math.min(32, (b - a) * 0.55), cx = (a + b) / 2, yh = basc ? y0 + 4 : y1 - Math.max(3.5, Math.min(6, (y1 - y0) * 0.25));
        caixa(p, M.pux, cx - L / 2, cx + L / 2, yh - 0.6, yh + 0.6, z1 + 1.6, z1 + 2.8);
        caixa(p, M.pux, cx - L / 2 + 1, cx - L / 2 + 2, yh - 0.5, yh + 0.5, z1, z1 + 1.6); caixa(p, M.pux, cx + L / 2 - 2, cx + L / 2 - 1, yh - 0.5, yh + 0.5, z1, z1 + 1.6);
      } else {
        const L = Math.min(30, (y1 - y0) * 0.5), yc = alto ? Math.max(y0 + L / 2 + 4, Math.min(y1 - L / 2 - 4, perto)) : Math.min(y1 - L / 2 - 4, Math.max(y0 + L / 2 + 4, perto));
        const xc = xl + dx * 3.5;
        caixa(p, M.pux, xc - 0.6, xc + 0.6, yc - L / 2, yc + L / 2, z1 + 1.6, z1 + 2.8);
        caixa(p, M.pux, xc - 0.5, xc + 0.5, yc - L / 2 + 1, yc - L / 2 + 2, z1, z1 + 1.6); caixa(p, M.pux, xc - 0.5, xc + 0.5, yc + L / 2 - 2, yc + L / 2 - 1, z1, z1 + 1.6);
      }
      return;
    }
    // botão
    const bot = (bx, by) => { caixa(p, M.pux, bx - 0.5, bx + 0.5, by - 0.5, by + 0.5, z1, z1 + 1.2); caixa(p, M.pux, bx - 1.2, bx + 1.2, by - 1.2, by + 1.2, z1 + 1.2, z1 + 2.4); };
    if (gav || basc) { const by = basc ? y0 + 4 : (y0 + y1) / 2; if (b - a > 60) { bot(a + (b - a) / 4, by); bot(b - (b - a) / 4, by); } else bot((a + b) / 2, by); }
    else bot(xl + dx * 3.5, Math.min(y1 - 5, Math.max(y0 + 5, perto)));
  }

  // ---- glTF: um nó por (peça, material), com o nome e o tipo da peça para o Raio-X
  const views = [], acc = [], partesBin = []; let tam = 0;
  const add = (arr, comp, tipo, alvo, mm) => {
    tam = (tam + 3) & ~3; const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    partesBin.push([tam, bytes]); views.push(Object.assign({ buffer: 0, byteOffset: tam, byteLength: bytes.length }, alvo ? { target: alvo } : {})); tam += bytes.length;
    const n = tipo === 'SCALAR' ? arr.length : arr.length / (tipo === 'VEC3' ? 3 : 2);
    const a = { bufferView: views.length - 1, componentType: comp, count: n, type: tipo };
    if (mm) { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < arr.length; i++) { mn[i % 3] = Math.min(mn[i % 3], arr[i]); mx[i % 3] = Math.max(mx[i % 3], arr[i]); } a.min = mn; a.max = mx; }
    acc.push(a); return acc.length - 1;
  };
  const meshes = [], nodes = [], dz = -D / 2;
  const mmn = [Infinity, Infinity, Infinity], mmx = [-Infinity, -Infinity, -Infinity];
  const nVar = f.cores.length;
  pecas.forEach((p, pi) => {
    const base = 'peca_' + pi;
    for (const [m, q] of p.partes) {
      if (!q.idx.length) continue;
      const pos = new Float32Array(q.pos.length);
      for (let i = 0; i < q.pos.length; i++) { const v = (q.pos[i] + (i % 3 === 2 ? dz : 0)) / 100; pos[i] = v; mmn[i % 3] = Math.min(mmn[i % 3], v); mmx[i % 3] = Math.max(mmx[i % 3], v); }
      const nv = pos.length / 3;
      const prim = { attributes: { POSITION: add(pos, 5126, 'VEC3', 34962, true), NORMAL: add(new Float32Array(q.nor), 5126, 'VEC3', 34962), TEXCOORD_0: add(new Float32Array(q.uv), 5126, 'VEC2', 34962) },
        indices: add(nv > 65535 ? new Uint32Array(q.idx) : new Uint16Array(q.idx), nv > 65535 ? 5125 : 5123, 'SCALAR', 34963), material: m };
      if (m === M.frente && nVar > 1) prim.extensions = { KHR_materials_variants: { mappings: f.cores.map((c, i) => ({ material: M.frente + i, variants: [i] })) } };
      meshes.push({ primitives: [prim] });
      nodes.push({ name: base + '_' + m, mesh: meshes.length - 1, extras: { menureal: p.ex } });
    }
  });
  // materiais (texturas de madeira quando a cor é madeirada)
  const lin = (hex) => rgbDe(hex).map((v) => +Math.pow(v / 255, 2.2).toFixed(4)).concat(1);
  const escurecer = (hex, k) => '#' + rgbDe(hex).map((v) => Math.round(v * k).toString(16).padStart(2, '0')).join('');
  const madeiras = f.cores.filter((c) => c.madeira).length + (f.corpo.madeira ? 1 : 0), ntex = madeiras <= 2 ? 1024 : 512;
  const imagens = [], texturas = [];
  async function tex(hex, seed) {
    const bytes = await canvasJpeg(texturaMadeira(hex, seed, ntex));
    tam = (tam + 3) & ~3; partesBin.push([tam, bytes]); views.push({ buffer: 0, byteOffset: tam, byteLength: bytes.length }); tam += bytes.length;
    imagens.push({ bufferView: views.length - 1, mimeType: 'image/jpeg' }); texturas.push({ source: imagens.length - 1, sampler: 0 });
    return texturas.length - 1;
  }
  const mat = async (nome, hex, rough, metal, madeira, seed) => {
    const m = { name: nome, pbrMetallicRoughness: { baseColorFactor: madeira ? [1, 1, 1, 1] : lin(hex), roughnessFactor: rough, metallicFactor: metal } };
    if (madeira) m.pbrMetallicRoughness.baseColorTexture = { index: await tex(hex, seed) };
    return m;
  };
  const materiais = [
    await mat('Corpo ' + f.corpo.nome, f.corpo.madeira ? f.corpo.hex : escurecer(f.corpo.hex, 0.95), f.corpo.madeira ? 0.55 : 0.62, 0, f.corpo.madeira, 3),
    await mat('Fundo', escurecer(f.corpo.hex, f.corpo.madeira ? 0.8 : 0.86), 0.7, 0, false, 0),
    await mat('Puxador', f.puxador.tipo === 'cava' ? '#3A3B3D' : f.puxador.hex, 0.32, f.puxador.tipo === 'cava' ? 0 : 0.85, false, 0),
    await mat('Pés', f.base.tipo === 'rodizios' ? '#2E2F31' : '#7C8086', 0.5, 0, false, 0),
    Object.assign(await mat('Vidro', '#BFD3D6', 0.05, 0.1, false, 0), { alphaMode: 'BLEND' }),
    await mat('Espelho', '#E8ECEE', 0.04, 1, false, 0)
  ];
  materiais[4].pbrMetallicRoughness.baseColorFactor[3] = 0.32;
  for (let i = 0; i < f.cores.length; i++) { const c = f.cores[i]; materiais.push(await mat('Frente ' + c.nome, c.madeira ? c.hex : c.hex, c.madeira ? 0.5 : 0.42, 0, c.madeira, 11 + i * 10)); }
  const bin = new Uint8Array((tam + 3) & ~3);
  for (const [o, b] of partesBin) bin.set(b, o);
  const json = {
    asset: { version: '2.0', generator: 'MenuReal — móvel pela foto' },
    scene: 0, scenes: [{ name: f.nome, nodes: nodes.map((_, i) => i) }], nodes, meshes, materials: materiais,
    accessors: acc, bufferViews: views, buffers: [{ byteLength: bin.length }]
  };
  if (texturas.length) { json.textures = texturas; json.images = imagens; json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }]; }
  if (nVar > 1) {
    json.extensionsUsed = ['KHR_materials_variants'];
    json.extensions = { KHR_materials_variants: { variants: f.cores.map((c) => ({ name: c.nome })) } };
  }
  const medidas = { largura: +((mmx[0] - mmn[0]) * 100).toFixed(1), altura: +((mmx[1] - mmn[1]) * 100).toFixed(1), profundidade: +((mmx[2] - mmn[2]) * 100).toFixed(1) };
  return { glb: escreverGlb(json, bin), medidas, resumo: Object.assign(resumoMovel(f), { pecas: pecas.length }), ficha: f };
}

/** A ficha do Armário G (exemplo e teste). */
export const EXEMPLO_MOVEL = {
  nome: 'Armário G', material: 'MDF', largura: 149, altura: 185, profundidade: 40,
  base: { tipo: 'pes', altura: 8 }, corpo: { nome: 'Branco', hex: '#EDECE8', madeira: false }, puxador: { tipo: 'perfil', hex: '#C4CAD2' },
  cores: [{ nome: 'Cinza', hex: '#808387', madeira: false }, { nome: 'Tabaco', hex: '#5A4B44', madeira: true }, { nome: 'Barcelona', hex: '#F0F0ED', madeira: false }, { nome: 'Nogal', hex: '#A2714F', madeira: true }],
  secoes: [
    { altura: 68, profundidade: 0, tampo: true, colunas: [
      { largura: 60, itens: [{ tipo: 'portas', altura: 68, prateleiras: 1 }] },
      { largura: 38, itens: [{ tipo: 'porta', altura: 68, dobradica: 'direita' }] },
      { largura: 51, itens: [{ tipo: 'gaveta', altura: 17 }, { tipo: 'gaveta', altura: 17 }, { tipo: 'gaveta', altura: 17 }, { tipo: 'gaveta', altura: 17 }] }] },
    { altura: 103, profundidade: 0, tampo: false, colunas: [
      { largura: 60, itens: [{ tipo: 'nicho', altura: 29 }, { tipo: 'portas', altura: 72, prateleiras: 1 }] },
      { largura: 38, itens: [{ tipo: 'nicho', altura: 35 }, { tipo: 'nicho', altura: 15 }, { tipo: 'nicho', altura: 33 }, { tipo: 'nicho', altura: 16, divisoes: 2 }] },
      { largura: 51, itens: [{ tipo: 'nicho', altura: 35 }, { tipo: 'nicho', altura: 15 }, { tipo: 'porta', altura: 50, dobradica: 'direita' }] }] }
  ],
  observacoes: ''
};
