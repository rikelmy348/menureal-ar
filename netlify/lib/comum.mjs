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
