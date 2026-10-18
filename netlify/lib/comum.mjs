/* =========================================================================
   MenuReal AR — utilidades compartilhadas pelas funções de servidor
   ========================================================================= */
import { getStore } from '@netlify/blobs';

export const LOJA = 'menureal';

export function loja() {
  return getStore({ name: LOJA, consistency: 'strong' });
}

export function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

/** Confere o código de acesso do painel. Devolve uma Response de erro, ou null se estiver ok. */
export function exigirCodigo(req) {
  const codigo = process.env.MENUREAL_CODIGO;
  if (!codigo) return json({ erro: 'Servidor não configurado: defina MENUREAL_CODIGO na Netlify.' }, 500);
  if ((req.headers.get('x-menureal-codigo') || '') !== codigo) return json({ erro: 'Código de acesso incorreto.' }, 401);
  return null;
}

// ---------------------------------------------------------------------------
// GLB: leitura, caixa delimitadora e escala para medidas reais (em metros)
// ---------------------------------------------------------------------------
function lerGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Arquivo não é GLB.');
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) {
    const len = dv.getUint32(off, true);
    const tipo = dv.getUint32(off + 4, true);
    const dados = buf.subarray(off + 8, off + 8 + len);
    if (tipo === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(dados));
    else if (tipo === 0x004e4942) bin = dados;
    off += 8 + len;
  }
  if (!json) throw new Error('GLB sem JSON.');
  return { json, bin };
}

function escreverGlb(json, bin) {
  const enc = new TextEncoder();
  let js = enc.encode(JSON.stringify(json));
  const padJs = (4 - (js.length % 4)) % 4;
  const binLen = bin ? bin.length + ((4 - (bin.length % 4)) % 4) : 0;
  const total = 12 + 8 + js.length + padJs + (bin ? 8 + binLen : 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, js.length + padJs, true); dv.setUint32(16, 0x4e4f534a, true);
  out.set(js, 20);
  out.fill(0x20, 20 + js.length, 20 + js.length + padJs);
  if (bin) {
    const o = 20 + js.length + padJs;
    dv.setUint32(o, binLen, true); dv.setUint32(o + 4, 0x004e4942, true);
    out.set(bin, o + 8);
  }
  return out;
}

// matrizes 4x4 em ordem coluna (como no glTF)
function mul(a, b) {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let l = 0; l < 4; l++) for (let k = 0; k < 4; k++) r[c * 4 + l] += a[k * 4 + l] * b[c * 4 + k];
  return r;
}
function matrizNo(n) {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale || [1, 1, 1];
  const [tx, ty, tz] = n.translation || [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1
  ];
}
function aplicar(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

export function caixaGlb(json) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const cena = (json.scenes || [])[json.scene || 0] || { nodes: [] };
  const id = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  (function visitar(nos, pai) {
    (nos || []).forEach((i) => {
      const n = json.nodes[i];
      const m = mul(pai, matrizNo(n));
      if (n.mesh != null) {
        json.meshes[n.mesh].primitives.forEach((p) => {
          const a = json.accessors[p.attributes.POSITION];
          if (!a || !a.min || !a.max) return;
          for (let c = 0; c < 8; c++) {
            const v = aplicar(m, [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]]);
            for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); }
          }
        });
      }
      visitar(n.children, m);
    });
  })(cena.nodes, id);
  if (!isFinite(mn[0])) throw new Error('Modelo sem geometria.');
  return { mn, mx };
}

/**
 * Ajusta o GLB para medidas reais: escala uniforme (mantém as proporções da foto)
 * para que a maior dimensão do modelo seja a maior medida cadastrada; apoia a
 * base em y=0 e centraliza em x/z. dimCm = { largura, profundidade, altura }.
 */
export function escalarGlb(buf, dimCm) {
  const { json, bin } = lerGlb(buf);
  const { mn, mx } = caixaGlb(json);
  const tam = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  const alvoMax = Math.max(dimCm.largura, dimCm.profundidade, dimCm.altura) / 100;
  const s = alvoMax / Math.max(...tam);
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  const cenaIdx = json.scene || 0;
  json.nodes = json.nodes || [];
  json.nodes.push({
    name: 'menureal_escala_real',
    scale: [s, s, s],
    translation: [-cx * s, -mn[1] * s, -cz * s],
    children: json.scenes[cenaIdx].nodes
  });
  json.scenes[cenaIdx].nodes = [json.nodes.length - 1];
  json.asset = json.asset || { version: '2.0' };
  json.asset.extras = Object.assign({}, json.asset.extras, {
    menureal: { unidade: 'metro', dimensoes_cm: dimCm, medidas_finais_cm: tam.map((t) => +(t * s * 100).toFixed(2)) }
  });
  return { glb: escreverGlb(json, bin), medidasCm: tam.map((t) => t * s * 100) };
}

// ---------------------------------------------------------------------------
// Contas por estabelecimento: senha (scrypt) e token assinado (HMAC)
// ---------------------------------------------------------------------------
import { scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';

export const SLUG_OK = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVADOS = new Set(['api', 'assets', 'vendor', 'netlify', 'tools', 'index', 'admin', 'entrar', 'menureal']);
export function slugValido(s) { return SLUG_OK.test(s || '') && !RESERVADOS.has(s); }

function segredo() {
  return process.env.MENUREAL_SEGREDO || ('menureal:' + (process.env.MENUREAL_CODIGO || ''));
}
export function hashSenha(senha) {
  const sal = randomBytes(16);
  const h = scryptSync(String(senha), sal, 32);
  return 'scrypt$' + sal.toString('base64') + '$' + h.toString('base64');
}
export function conferirSenha(senha, guardado) {
  const [, sal, h] = String(guardado || '').split('$');
  if (!sal || !h) return false;
  const calc = scryptSync(String(senha), Buffer.from(sal, 'base64'), 32);
  const esperado = Buffer.from(h, 'base64');
  return calc.length === esperado.length && timingSafeEqual(calc, esperado);
}
export function criarToken(slug, dias = 30) {
  const corpo = Buffer.from(JSON.stringify({ s: slug, e: Date.now() + dias * 864e5 })).toString('base64url');
  const assin = createHmac('sha256', segredo()).update(corpo).digest('base64url');
  return corpo + '.' + assin;
}
export function lerToken(token) {
  const [corpo, assin] = String(token || '').split('.');
  if (!corpo || !assin) return null;
  const certo = createHmac('sha256', segredo()).update(corpo).digest('base64url');
  if (certo.length !== assin.length || !timingSafeEqual(Buffer.from(certo), Buffer.from(assin))) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    return d.e > Date.now() ? d.s : null;
  } catch { return null; }
}

/** Mestre = código MENUREAL_CODIGO (dono da plataforma). Loja = token da própria loja. */
export function ehMestre(req) {
  const c = process.env.MENUREAL_CODIGO;
  return Boolean(c) && (req.headers.get('x-menureal-codigo') || '') === c;
}
/**
 * Autoriza a edição de uma loja ('' = cardápio de demonstração da raiz).
 * Devolve null se autorizado, ou uma Response de erro.
 */
export function autorizar(req, slug) {
  if (ehMestre(req)) return null;
  const auth = req.headers.get('authorization') || '';
  const s = lerToken(auth.replace(/^Bearer\s+/i, ''));
  if (s && slug && s === slug) return null;
  if (!process.env.MENUREAL_CODIGO) return json({ erro: 'Servidor não configurado: defina MENUREAL_CODIGO na Netlify.' }, 500);
  return json({ erro: s ? 'Sem permissão para esta loja.' : slug ? 'Entre na conta do estabelecimento.' : 'Código de acesso incorreto.' }, 401);
}
export function chaveCardapio(slug) { return slug ? 'cardapios/' + slug : 'cardapio'; }
export function hashCurto(texto) { return createHash('sha256').update(texto).digest('hex').slice(0, 20); }

// ---------------------------------------------------------------------------
// Combo: junta vários GLB lado a lado em um único arquivo
// ---------------------------------------------------------------------------
function remapTexturas(obj, off) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object') {
      if (/texture$/i.test(k) && typeof v.index === 'number') v.index += off;
      remapTexturas(v, off);
    }
  }
}

export function juntarGlbs(lista, folgaM = 0.02) {
  const saida = { asset: { version: '2.0', generator: 'MenuReal AR combo' }, scene: 0, scenes: [{ nodes: [] }],
    nodes: [], meshes: [], materials: [], textures: [], images: [], samplers: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
  const usados = new Set(), exigidos = new Set();
  const partes = [];
  let binTotal = 0;
  const larguras = lista.map((buf) => { const { json } = lerGlb(buf); const { mn, mx } = caixaGlb(json); return { mn, mx }; });
  const total = larguras.reduce((s, c) => s + (c.mx[0] - c.mn[0]), 0) + folgaM * (lista.length - 1);
  let x = -total / 2;
  lista.forEach((buf, i) => {
    const { json, bin } = lerGlb(buf);
    const c = larguras[i];
    const off = { bv: saida.bufferViews.length, acc: saida.accessors.length, img: saida.images.length, smp: saida.samplers.length,
      tex: saida.textures.length, mat: saida.materials.length, mesh: saida.meshes.length, node: saida.nodes.length };
    const binOff = binTotal;
    if (bin) { partes.push(bin); binTotal += bin.length; const pad = (4 - (binTotal % 4)) % 4; if (pad) { partes.push(new Uint8Array(pad)); binTotal += pad; } }
    (json.bufferViews || []).forEach((v) => saida.bufferViews.push({ ...v, buffer: 0, byteOffset: (v.byteOffset || 0) + binOff }));
    (json.accessors || []).forEach((a) => {
      const n = { ...a };
      if (n.bufferView != null) n.bufferView += off.bv;
      if (n.sparse) { n.sparse = JSON.parse(JSON.stringify(n.sparse)); n.sparse.indices.bufferView += off.bv; n.sparse.values.bufferView += off.bv; }
      saida.accessors.push(n);
    });
    (json.images || []).forEach((im) => saida.images.push(im.bufferView != null ? { ...im, bufferView: im.bufferView + off.bv } : { ...im }));
    (json.samplers || []).forEach((s) => saida.samplers.push({ ...s }));
    (json.textures || []).forEach((t) => {
      const n = JSON.parse(JSON.stringify(t));
      if (n.source != null) n.source += off.img;
      if (n.sampler != null) n.sampler += off.smp;
      if (n.extensions) for (const e of Object.values(n.extensions)) if (e && typeof e.source === 'number') e.source += off.img;
      saida.textures.push(n);
    });
    (json.materials || []).forEach((m) => { const n = JSON.parse(JSON.stringify(m)); remapTexturas(n, off.tex); saida.materials.push(n); });
    (json.meshes || []).forEach((m) => {
      const n = JSON.parse(JSON.stringify(m));
      n.primitives.forEach((p) => {
        for (const k of Object.keys(p.attributes)) p.attributes[k] += off.acc;
        if (p.indices != null) p.indices += off.acc;
        if (p.material != null) p.material += off.mat;
        (p.targets || []).forEach((t) => { for (const k of Object.keys(t)) t[k] += off.acc; });
        if (p.extensions) delete p.extensions.KHR_draco_mesh_compression;
      });
      saida.meshes.push(n);
    });
    (json.nodes || []).forEach((nd) => {
      const n = { ...nd };
      delete n.camera; delete n.skin;
      if (n.mesh != null) n.mesh += off.mesh;
      if (n.children) n.children = n.children.map((c2) => c2 + off.node);
      saida.nodes.push(n);
    });
    const cena = (json.scenes || [])[json.scene || 0] || { nodes: [] };
    const cx = (c.mn[0] + c.mx[0]) / 2, cz = (c.mn[2] + c.mx[2]) / 2, larg = c.mx[0] - c.mn[0];
    saida.nodes.push({ name: 'item_' + (i + 1), translation: [x + larg / 2 - cx, -c.mn[1], -cz], children: cena.nodes.map((k) => k + off.node) });
    saida.scenes[0].nodes.push(saida.nodes.length - 1);
    x += larg + folgaM;
    (json.extensionsUsed || []).forEach((e) => usados.add(e));
    (json.extensionsRequired || []).forEach((e) => exigidos.add(e));
  });
  if (usados.has('KHR_draco_mesh_compression')) throw new Error('Modelo comprimido com Draco não pode ser combinado.');
  if (usados.size) saida.extensionsUsed = [...usados];
  if (exigidos.size) saida.extensionsRequired = [...exigidos];
  for (const k of ['meshes', 'materials', 'textures', 'images', 'samplers']) if (!saida[k].length) delete saida[k];
  const bin = new Uint8Array(binTotal);
  let p = 0; for (const parte of partes) { bin.set(parte, p); p += parte.length; }
  saida.buffers[0].byteLength = binTotal;
  return escreverGlb(saida, bin);
}
