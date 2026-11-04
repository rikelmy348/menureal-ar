/* =========================================================================
   MenuReal AR — arquivos GLB (glTF 2.0 binário) sem dependências
   Usado pelo site (montar o açaí na tela) e pelo servidor (combo e montagem
   para a câmera). Unidades em metros, Y para cima.
   ========================================================================= */

export function lerGlb(buf) {
  if (!(buf instanceof Uint8Array)) buf = new Uint8Array(buf);
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

export function escreverGlb(json, bin) {
  const js = new TextEncoder().encode(JSON.stringify(json));
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

/** Caixa delimitadora da cena (metros), com as transformações dos nós. */
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

/**
 * Junta vários GLB numa cena só. itens: [{ buf, no: { name, translation, rotation, scale } }].
 * Cada item vira um nó com a transformação dada, pai dos nós da cena original.
 * Devolve { json, partes, binTotal, nos } para quem quiser acrescentar dados (animação).
 */
export function combinar(itens, gerador = 'MenuReal AR') {
  const saida = { asset: { version: '2.0', generator: gerador }, scene: 0, scenes: [{ nodes: [] }],
    nodes: [], meshes: [], materials: [], textures: [], images: [], samplers: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
  const usados = new Set(), exigidos = new Set();
  const partes = [];
  const nos = [];
  let binTotal = 0;
  itens.forEach((item) => {
    const { json, bin } = item.glb || lerGlb(item.buf);
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
    saida.nodes.push(Object.assign({}, item.no || {}, { children: cena.nodes.map((k) => k + off.node) }));
    saida.scenes[0].nodes.push(saida.nodes.length - 1);
    nos.push(saida.nodes.length - 1);
    (json.extensionsUsed || []).forEach((e) => usados.add(e));
    (json.extensionsRequired || []).forEach((e) => exigidos.add(e));
  });
  if (usados.has('KHR_draco_mesh_compression')) throw new Error('Modelo comprimido com Draco não pode ser combinado.');
  if (usados.size) saida.extensionsUsed = [...usados];
  if (exigidos.size) saida.extensionsRequired = [...exigidos];
  return { json: saida, partes, binTotal, nos };
}

/** Acrescenta dados ao bloco binário (alinhado a 4 bytes) e devolve o índice do bufferView. */
function anexar(c, bytes) {
  const pad = (4 - (c.binTotal % 4)) % 4;
  if (pad) { c.partes.push(new Uint8Array(pad)); c.binTotal += pad; }
  c.json.bufferViews.push({ buffer: 0, byteOffset: c.binTotal, byteLength: bytes.byteLength });
  c.partes.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  c.binTotal += bytes.byteLength;
  return c.json.bufferViews.length - 1;
}

export function finalizar(c) {
  const s = c.json;
  for (const k of ['meshes', 'materials', 'textures', 'images', 'samplers']) if (s[k] && !s[k].length) delete s[k];
  const bin = new Uint8Array(c.binTotal);
  let p = 0; for (const parte of c.partes) { bin.set(parte, p); p += parte.length; }
  s.buffers[0].byteLength = c.binTotal;
  return escreverGlb(s, bin);
}

/** Combo na mesa: itens lado a lado, apoiados em y = 0, com uma folga entre eles. */
export function juntarGlbs(lista, folgaM = 0.02) {
  const glbs = lista.map((buf) => lerGlb(buf));
  const caixas = glbs.map((g) => caixaGlb(g.json));
  const total = caixas.reduce((s, c) => s + (c.mx[0] - c.mn[0]), 0) + folgaM * (lista.length - 1);
  let x = -total / 2;
  const itens = glbs.map((glb, i) => {
    const c = caixas[i];
    const cx = (c.mn[0] + c.mx[0]) / 2, cz = (c.mn[2] + c.mx[2]) / 2, larg = c.mx[0] - c.mn[0];
    const no = { name: 'item_' + (i + 1), translation: [x + larg / 2 - cx, -c.mn[1], -cz] };
    x += larg + folgaM;
    return { glb, no };
  });
  return finalizar(combinar(itens, 'MenuReal AR combo'));
}

/* -------------------------------------------------------------------------
   Formas simples com foto (lata, balde, caixa, colchão…): geometria exata
   nas medidas cadastradas e a foto do produto aplicada como rótulo.
   op = { forma: 'cilindro' | 'caixa', medidasM: [largura, altura, profundidade],
          imagem: Uint8Array (JPEG), cor: [r,g,b] 0..1, bordasMetal: bool, repetir: 1 | 2 }
   ------------------------------------------------------------------------- */
export function gerarForma(op) {
  const [L, A, P] = op.medidasM;
  const partes = []; // { pos, nor, uv, idx, mat }
  const MAT_ROTULO = 0, MAT_COR = 1, MAT_METAL = 2;

  function cilindro(r, y0, y1, mat, u0, u1, seg) {
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg, ang = t * Math.PI * 2;
      // t = 0 fica na frente (+Z); o centro da foto fica de frente para o cliente
      const x = Math.sin(ang), z = Math.cos(ang);
      const u = u0 + (u1 - u0) * ((t + 0.5 / (op.repetir || 1)) % 1 || 0);
      pos.push(x * r, y0, z * r, x * r, y1, z * r);
      nor.push(x, 0, z, x, 0, z);
      uv.push(u, 1, u, 0);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    partes.push({ pos, nor, uv, idx, mat });
  }
  function rotuloCilindro(r, y0, y1, seg) {
    // costura sem "salto": cada repetição tem seus próprios vértices
    const rep = op.repetir || 1, pos = [], nor = [], uv = [], idx = [];
    for (let k = 0; k < rep; k++) {
      const base = pos.length / 3;
      const n = Math.ceil(seg / rep);
      for (let i = 0; i <= n; i++) {
        const t = (k + i / n) / rep, ang = t * Math.PI * 2 - Math.PI / rep; // centro da 1ª cópia na frente
        const x = Math.sin(ang), z = Math.cos(ang), u = i / n;
        pos.push(x * r, y0, z * r, x * r, y1, z * r);
        nor.push(x, 0, z, x, 0, z);
        uv.push(u, 1, u, 0);
      }
      for (let i = 0; i < n; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    partes.push({ pos, nor, uv, idx, mat: MAT_ROTULO });
  }
  function disco(r, y, cima, mat, seg) {
    const pos = [0, y, 0], nor = [0, cima ? 1 : -1, 0], uv = [0.5, 0.5], idx = [];
    for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * Math.PI * 2, x = Math.sin(ang), z = Math.cos(ang);
      pos.push(x * r, y, z * r); nor.push(0, cima ? 1 : -1, 0); uv.push(0.5 + x / 2, 0.5 - z / 2);
    }
    for (let i = 1; i <= seg; i++) cima ? idx.push(0, i, i + 1) : idx.push(0, i + 1, i);
    partes.push({ pos, nor, uv, idx, mat });
  }
  function anel(r0, r1, y, mat, seg) { // coroa plana virada para cima
    const pos = [], nor = [], uv = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const ang = (i / seg) * Math.PI * 2, x = Math.sin(ang), z = Math.cos(ang);
      pos.push(x * r0, y, z * r0, x * r1, y, z * r1); nor.push(0, 1, 0, 0, 1, 0); uv.push(0, 0, 1, 1);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    partes.push({ pos, nor, uv, idx, mat });
  }
  function face(c, ux, uy, n, mat, comFoto) { // retângulo: centro c, meias-arestas ux, uy, normal n
    const pos = [], nor = [], uv = [];
    const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    cantos.forEach(([a, b]) => {
      pos.push(c[0] + ux[0] * a + uy[0] * b, c[1] + ux[1] * a + uy[1] * b, c[2] + ux[2] * a + uy[2] * b);
      nor.push(...n);
      uv.push(comFoto ? (a + 1) / 2 : 0, comFoto ? (1 - b) / 2 : 0);
    });
    partes.push({ pos, nor, uv, idx: [0, 1, 2, 0, 2, 3], mat });
  }

  if (op.forma === 'cilindro') {
    const r = L / 2, seg = 72;
    if (op.bordasMetal) {
      const b = Math.min(A * 0.05, 0.02), aba = Math.min(r * 0.06, 0.008);
      cilindro(r, 0, b, MAT_METAL, 0, 0, seg);
      rotuloCilindro(r * 0.995, b, A - b, seg);
      cilindro(r, A - b, A, MAT_METAL, 0, 0, seg);
      anel(r - aba, r, A, MAT_METAL, seg);
      cilindro(r - aba, A - aba * 0.8, A, MAT_METAL, 0, 0, seg); // borda interna da tampa (metal é dupla face)
      disco(r - aba, A - aba * 0.8, true, MAT_METAL, seg);
      disco(r, 0, false, MAT_METAL, seg);
    } else {
      rotuloCilindro(r, 0, A, seg);
      disco(r, A, true, MAT_COR, seg);
      disco(r, 0, false, MAT_COR, seg);
    }
  } else {
    const x = L / 2, y = A / 2, z = P / 2;
    face([0, y, z], [x, 0, 0], [0, y, 0], [0, 0, 1], MAT_ROTULO, true);     // frente: foto
    face([0, y, -z], [-x, 0, 0], [0, y, 0], [0, 0, -1], MAT_COR, false);     // trás
    face([x, y, 0], [0, 0, -z], [0, y, 0], [1, 0, 0], MAT_COR, false);       // direita
    face([-x, y, 0], [0, 0, z], [0, y, 0], [-1, 0, 0], MAT_COR, false);      // esquerda
    face([0, A, 0], [x, 0, 0], [0, 0, -z], [0, 1, 0], MAT_COR, false);       // topo
    face([0, 0, 0], [x, 0, 0], [0, 0, z], [0, -1, 0], MAT_COR, false);       // base
  }

  // junta por material
  const porMat = new Map();
  partes.forEach((p) => {
    const g = porMat.get(p.mat) || { pos: [], nor: [], uv: [], idx: [] };
    const base = g.pos.length / 3;
    g.pos.push(...p.pos); g.nor.push(...p.nor); g.uv.push(...p.uv); g.idx.push(...p.idx.map((i) => i + base));
    porMat.set(p.mat, g);
  });

  const blocos = []; let tam = 0;
  const json = { asset: { version: '2.0', generator: 'MenuReal forma' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: 'produto', mesh: 0 }], meshes: [{ primitives: [] }], materials: [], accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
  function vista(bytes, alvo) {
    const pad = (4 - (tam % 4)) % 4; if (pad) { blocos.push(new Uint8Array(pad)); tam += pad; }
    const v = { buffer: 0, byteOffset: tam, byteLength: bytes.byteLength }; if (alvo) v.target = alvo;
    json.bufferViews.push(v); blocos.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)); tam += bytes.byteLength;
    return json.bufferViews.length - 1;
  }
  function acessor(arr, tipo, comMinMax) {
    const f = new Float32Array(arr), n = tipo === 'VEC3' ? 3 : 2;
    const a = { bufferView: vista(f, 34962), componentType: 5126, count: f.length / n, type: tipo };
    if (comMinMax) {
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < f.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], f[i + k]); mx[k] = Math.max(mx[k], f[i + k]); }
      a.min = mn; a.max = mx;
    }
    json.accessors.push(a); return json.accessors.length - 1;
  }
  const temFoto = !!op.imagem && porMat.has(MAT_ROTULO);
  if (temFoto) {
    json.images = [{ bufferView: vista(op.imagem), mimeType: 'image/jpeg' }];
    json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }];
    json.textures = [{ source: 0, sampler: 0 }];
  }
  const cor = op.cor || [0.8, 0.8, 0.8];
  const defMat = {
    [MAT_ROTULO]: { name: 'rotulo', pbrMetallicRoughness: Object.assign({ metallicFactor: 0, roughnessFactor: 0.5 }, temFoto ? { baseColorTexture: { index: 0 } } : { baseColorFactor: [...cor, 1] }) },
    [MAT_COR]: { name: 'cor', pbrMetallicRoughness: { baseColorFactor: [...cor, 1], metallicFactor: 0, roughnessFactor: 0.6 } },
    [MAT_METAL]: { name: 'metal', doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.8, 0.81, 0.83, 1], metallicFactor: 1, roughnessFactor: 0.32 } }
  };
  for (const [mat, g] of porMat) {
    json.materials.push(defMat[mat]);
    const idx = new Uint32Array(g.idx);
    json.accessors.push({ bufferView: vista(idx, 34963), componentType: 5125, count: idx.length, type: 'SCALAR' });
    const iIdx = json.accessors.length - 1;
    json.meshes[0].primitives.push({
      attributes: { POSITION: acessor(g.pos, 'VEC3', true), NORMAL: acessor(g.nor, 'VEC3'), TEXCOORD_0: acessor(g.uv, 'VEC2') },
      indices: iIdx, material: json.materials.length - 1
    });
  }
  const bin = new Uint8Array(tam); let p = 0; for (const b of blocos) { bin.set(b, p); p += b.length; }
  json.buffers[0].byteLength = tam;
  return escreverGlb(json, bin);
}
