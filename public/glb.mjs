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

// ---------------------------------------------------------------------------
// Monte seu açaí: coberturas sobre o copo
// ---------------------------------------------------------------------------
// As camadas de public/assets/adicionais/*.glb ocupam um círculo de 1 m de diâmetro,
// apoiadas numa cúpula de altura DOMO (tools/gerar_acai.py usa os mesmos valores).
export const DOMO = 0.08;
export const AREA = 0.88;
export const ADICIONAIS_3D = {
  granola: { nome: 'Granola', ordem: 1 },
  pacoca: { nome: 'Paçoca', ordem: 2 },
  confete: { nome: 'Confete', ordem: 3 },
  banana: { nome: 'Banana', ordem: 4 },
  morango: { nome: 'Morango', ordem: 5 },
  leite_po: { nome: 'Leite em pó', ordem: 6 },
  leite_condensado: { nome: 'Leite condensado', ordem: 7 },
  calda_chocolate: { nome: 'Calda de chocolate', ordem: 8 }
};

/**
 * base: GLB do copo (bytes). camadas: [{ tipo, buf }]. opcoes.animar: tipo que "cai" com animação.
 * Devolve o GLB montado (bytes). A posição de descanso fica nos nós, então sem tocar a
 * animação o açaí já aparece pronto (é o que a câmera do Google mostra).
 */
export const CALDAS = ['leite_condensado', 'calda_chocolate'];
/** Arquivo do ajudante da animação: frasco de vidro para caldas, mão para o resto. */
export function ajudanteDe(tipo) { return CALDAS.includes(tipo) ? '_frasco_' + tipo : '_mao'; }

/**
 * base: GLB do copo (bytes). camadas: [{ tipo, buf }].
 * opcoes.animar: tipo que entra com animação; opcoes.ajudante: bytes da mão ou do frasco.
 * Devolve o GLB montado. A pose de descanso dos nós é o açaí pronto (é o que a câmera
 * mostra); a animação só existe na tela.
 */
export function montarAcai(base, camadas, opcoes = {}) {
  const baseGlb = lerGlb(base);
  const { mn, mx } = caixaGlb(baseGlb.json);
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  const s = AREA * Math.min(mx[0] - mn[0], mx[2] - mn[2]);
  const topo = mx[1];
  const lista = camadas.filter((c) => ADICIONAIS_3D[c.tipo])
    .sort((a, b) => ADICIONAIS_3D[a.tipo].ordem - ADICIONAIS_3D[b.tipo].ordem);
  const itens = [{ glb: baseGlb, no: { name: 'copo' } }];
  const angulos = [];
  lista.forEach((c, k) => {
    const ang = (ADICIONAIS_3D[c.tipo].ordem * 0.83) % (Math.PI * 2);
    angulos.push(ang);
    itens.push({
      buf: c.buf,
      no: {
        name: 'adicional_' + c.tipo,
        translation: [cx, topo - DOMO * s + k * 0.004 * s, cz],
        rotation: [0, Math.sin(ang / 2), 0, Math.cos(ang / 2)],
        scale: [s, s, s]
      }
    });
  });
  const k = lista.findIndex((x) => x.tipo === opcoes.animar);
  let ajudante = null;
  if (k > -1 && opcoes.ajudante) {
    const frasco = CALDAS.includes(lista[k].tipo);
    const camada = itens[k + 1].no;
    // a mão fica de frente para a câmera (sem girar junto com a camada); o frasco segue a calda
    itens.push({ buf: opcoes.ajudante, no: { name: 'ajudante', translation: camada.translation, scale: camada.scale,
      rotation: frasco ? camada.rotation : [0, 0, 0, 1] } });
    ajudante = { frasco, ang: frasco ? 0 : angulos[k] };
  }
  const c = combinar(itens, 'MenuReal AR · monte seu açaí');
  if (k > -1) {
    const nosAjudante = ajudante ? c.json.nodes[c.nos[c.nos.length - 1]].children || [] : [];
    // em repouso o ajudante fica invisível: não entra nas medidas nem no enquadramento
    nosAjudante.forEach((no) => { c.json.nodes[no].scale = [1e-4, 1e-4, 1e-4]; });
    animarEntrada(c, c.json.nodes[c.nos[k + 1]].children || [], ajudante, nosAjudante);
  }
  return finalizar(c);
}

/**
 * Animação de entrada de uma cobertura. Cada pedaço traz em "extras" como deve entrar
 * (tools/gerar_acai.py): "peca" cai girando e quica; "calda" aparece em trechos, como se
 * fosse desenhada; "escorrido" desce pelo vidro; "monte" (leite em pó) cresce.
 * Com ajudante: a mão chega por trás do copo e solta cada pedaço da pinça; o frasco de
 * vidro passa por cima despejando a calda. Unidades: as da cobertura.
 */
function animarEntrada(c, nos, ajudante, nosAjudante) {
  const acc = c.json.accessors;
  const samplers = [], channels = [];
  const MIN = 1e-4;
  const add = (dados, tipo) => {
    const arr = new Float32Array(dados);
    const n = tipo === 'SCALAR' ? arr.length : tipo === 'VEC3' ? arr.length / 3 : arr.length / 4;
    const a = { bufferView: anexar(c, arr), componentType: 5126, count: n, type: tipo };
    if (tipo === 'SCALAR') { a.min = [Math.min(...arr)]; a.max = [Math.max(...arr)]; }
    acc.push(a);
    return acc.length - 1;
  };
  const canal = (no, path, tempos, valores, tipo, interp = 'LINEAR') => {
    samplers.push({ input: add(tempos, 'SCALAR'), output: add(valores, tipo), interpolation: interp });
    channels.push({ sampler: samplers.length - 1, target: { node: no, path } });
  };
  const suave = (u) => u * u * (3 - 2 * u);
  const lerp = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  const ext = (no) => c.json.nodes[no].extras || {};
  const atrasos = nos.map((no) => Math.max(0.02, Number(ext(no).atraso) || 0));
  const ultimo = Math.max(0.1, ...atrasos);
  const E = ajudante ? 0.45 : 0;          // tempo para o ajudante chegar

  // --- mão: caminho da pinça (espaço da mão) e conversão para o espaço da camada
  const PARTIDA = [0.7, 2.7, -2.2], SAIDA = [-0.5, 2.9, -2.3];
  const pairar = (t) => {
    const f = (t - E) / 0.8;
    return [0.24 * Math.sin(f * Math.PI * 2), 0.85 + 0.05 * Math.sin(f * Math.PI * 4), -0.36 + 0.06 * Math.cos(f * Math.PI * 2)];
  };
  const fimAjuda = E + ultimo + 0.15;
  const pinca = (t) => {
    if (t <= E) return lerp(PARTIDA, pairar(E), suave(Math.max(0, t / E)));
    if (t <= fimAjuda) return pairar(t);
    return lerp(pairar(fimAjuda), SAIDA, suave(Math.min(1, (t - fimAjuda) / 0.45)));
  };
  const naCamada = (p) => {
    const a = ajudante ? ajudante.ang : 0, co = Math.cos(a), si = Math.sin(a);
    return [p[0] * co - p[2] * si, p[1], p[0] * si + p[2] * co];
  };

  let r = 1;
  const aleat = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
  nos.forEach((no, i) => {
    const n = c.json.nodes[no];
    const ex = ext(no);
    const d = atrasos[i] + E;
    const t = n.translation || [0, 0, 0];
    const e = n.scale || [1, 1, 1];
    const rot = n.rotation || [0, 0, 0, 1];
    if (ex.anim === 'peca') {
      const g = Array.isArray(ex.giro) && ex.giro.length === 4 ? ex.giro : [0, 0, 0, 1];
      const ini = ajudante && !ajudante.frasco
        ? naCamada(pinca(d)).map((v, j) => v + (j === 1 ? -0.05 : (aleat() - 0.5) * 0.06))
        : [t[0], t[1] + (Number(ex.queda) || 1.5), t[2]];
      const F = 0.3;
      const us = [0, 0.33, 0.66, 1];
      const T = [0, ...us.map((u) => d + F * u), d + F + 0.07, d + F + 0.14];
      const P = [ini, ...us.map((u) => [ini[0] + (t[0] - ini[0]) * u, ini[1] + (t[1] - ini[1]) * u * u, ini[2] + (t[2] - ini[2]) * u]),
        [t[0], t[1] + 0.03, t[2]], t];
      canal(no, 'translation', T, P.flat(), 'VEC3');
      canal(no, 'rotation', [0, d, d + F], [...g, ...g, ...rot], 'VEC4');
      const amassa = [e[0] * 1.07, e[1] * 0.84, e[2] * 1.07];
      canal(no, 'scale', [0, d - 0.005, d, d + F, d + F + 0.05, d + F + 0.12],
        [MIN, MIN, MIN, MIN, MIN, MIN, ...e, ...e, ...amassa, ...e], 'VEC3');
    } else if (ex.anim === 'calda') {
      canal(no, 'scale', [0, d], [MIN, MIN, MIN, e[0], e[1], e[2]], 'VEC3', 'STEP');
    } else if (ex.anim === 'escorrido') {
      canal(no, 'scale', [0, d - 0.01, d, d + 0.9], [MIN, MIN, MIN, MIN, MIN, MIN, e[0], e[1] * 0.04, e[2], e[0], e[1], e[2]], 'VEC3');
    } else if (ex.anim === 'monte') {
      canal(no, 'scale', [0, d, d + 0.5, d + 0.6], [MIN, MIN, MIN, e[0] * 0.3, e[1] * 0.1, e[2] * 0.3, e[0] * 1.05, e[1] * 0.92, e[2] * 1.05, e[0], e[1], e[2]], 'VEC3');
    }
  });

  if (ajudante && !ajudante.frasco) {
    const [mao] = nosAjudante;
    if (mao != null) {
      const T = [], P = [], R = [];
      const fim = fimAjuda + 0.45;
      for (let t = 0; t <= fim + 1e-6; t += 0.04) {
        T.push(+t.toFixed(3));
        P.push(...pinca(t));
        // pulso dá um toque a cada pedaço solto
        const toque = t > E && t < fimAjuda ? 0.09 * Math.max(0, Math.sin(((t - E) / 0.16) * Math.PI * 2)) : 0;
        R.push(Math.sin(toque / 2), 0, 0, Math.cos(toque / 2));
      }
      canal(mao, 'translation', T, P, 'VEC3');
      canal(mao, 'rotation', T, R, 'VEC4');
      canal(mao, 'scale', [0, +(fim + 0.02).toFixed(3)], [1, 1, 1, MIN, MIN, MIN], 'VEC3', 'STEP');
    }
  }
  if (ajudante && ajudante.frasco) {
    const [frasco, jato] = nosAjudante;
    // o bico do frasco segue o caminho da calda (gravado no primeiro trecho pelo gerador)
    const comCaminho = nos.map((no) => ext(no).caminho).find((x) => Array.isArray(x) && x.length > 1);
    if (frasco != null && comCaminho) {
      const ALT = 0.5;
      const T = [0], P = [[0.2, 2.6, -1.6]];
      comCaminho.forEach(([tt, x, y, z]) => {
        const d = tt + E;
        if (d > T[T.length - 1] + 0.005) { T.push(+d.toFixed(3)); P.push([x, y + ALT, z]); }
      });
      const fimC = T[T.length - 1];
      T.push(+(fimC + 0.45).toFixed(3)); P.push([-0.3, 2.8, -1.7]);
      canal(frasco, 'translation', T, P.flat(), 'VEC3');
      canal(frasco, 'scale', [0, +(fimC + 0.47).toFixed(3)], [1, 1, 1, MIN, MIN, MIN], 'VEC3', 'STEP');
      if (jato != null) {
        canal(jato, 'translation', T, P.flat(), 'VEC3');
        canal(jato, 'scale', [0, T[1], +(fimC + 0.06).toFixed(3)], [MIN, MIN, MIN, 1, ALT + 0.03, 1, MIN, MIN, MIN], 'VEC3', 'STEP');
      }
    }
  }
  if (channels.length) c.json.animations = [{ name: 'entrada', samplers, channels }];
}
