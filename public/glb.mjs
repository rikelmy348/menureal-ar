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
  calda_chocolate: { nome: 'Calda de chocolate', ordem: 8 },
  morango_picado: { nome: 'Morango picado', ordem: 5.5 },
  nutella: { nome: 'Nutella', ordem: 9 },
  // dentro do copo, entre camadas de açaí (gerado aqui; a textura vem do próprio copo)
  camada_creme: { nome: 'Camada de creme', ordem: 101, camada: 'creme_parede' },
  camada_morango: { nome: 'Camada de morango', ordem: 102, camada: 'creme_parede', pecas: '_pedacos_morango' },
  camada_nutella: { nome: 'Camada de Nutella', ordem: 103, camada: 'nutella_parede' }
};
// Como cada ingrediente aparece quando vira CAMADA dentro do copo (montagem pelo cliente).
// mat: material liso da parede (vem do copo); pecas: biblioteca de pedaços encostados no copo;
// peso: altura relativa da camada; esp: espaçamento dos pedaços (unidades da cobertura).
export const CAPACIDADE = 5.5;
export const VISUAL_CAMADA = {
  acai: { nome: 'Açaí', mat: 'acai_camada', topo: 'acai', peso: 1 },
  camada_creme: { mat: 'creme_parede', peso: 0.55 },
  creme: { mat: 'creme_parede', peso: 0.55 },
  camada_nutella: { mat: 'nutella_parede', peso: 0.5 },
  nutella: { mat: 'nutella_parede', peso: 0.5 },
  leite_condensado: { mat: 'condensado_parede', peso: 0.42 },
  calda_chocolate: { mat: 'chocolate_parede', peso: 0.38 },
  leite_po: { mat: 'po_parede', peso: 0.42 },
  camada_morango: { mat: 'creme_parede', pecas: '_pedacos_morango', peso: 0.62, esp: 0.125 },
  morango: { pecas: '_pedacos_morango', peso: 0.45, esp: 0.125 },
  morango_picado: { pecas: '_pedacos_morango', peso: 0.45, esp: 0.125 },
  banana: { pecas: '_pedacos_banana', peso: 0.45, esp: 0.34 },
  granola: { pecas: '_pedacos_granola', peso: 0.4, esp: 0.12 },
  pacoca: { pecas: '_pedacos_pacoca', peso: 0.38, esp: 0.1 },
  confete: { pecas: '_pedacos_confete', peso: 0.32, esp: 0.15 }
};
export function pesoCamada(tipo) { return (VISUAL_CAMADA[tipo] || VISUAL_CAMADA.acai).peso; }
/** Bibliotecas de pedaços necessárias para uma pilha de camadas. */
export function bibliotecasDe(pilha) {
  return [...new Set((pilha || []).map((t) => VISUAL_CAMADA[t] && VISUAL_CAMADA[t].pecas).filter(Boolean))];
}

/** Arquivo 3D de um adicional (em assets/adicionais), ou null se não precisa de arquivo. */
export function arquivoDe(tipo) {
  const a = ADICIONAIS_3D[tipo];
  if (!a) return null;
  return a.camada ? a.pecas || null : tipo;
}

/**
 * base: GLB do copo (bytes). camadas: [{ tipo, buf }]. opcoes.animar: tipo que "cai" com animação.
 * Devolve o GLB montado (bytes). A posição de descanso fica nos nós, então sem tocar a
 * animação o açaí já aparece pronto (é o que a câmera do Google mostra).
 */
export const CALDAS = ['leite_condensado', 'calda_chocolate', 'nutella'];
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
  const ordem = (a, b) => ADICIONAIS_3D[a.tipo].ordem - ADICIONAIS_3D[b.tipo].ordem;
  const validas = camadas.filter((c) => ADICIONAIS_3D[c.tipo]);
  const info = baseGlb.json.asset && baseGlb.json.asset.extras && baseGlb.json.asset.extras.copo;
  // camadas internas só em copos preparados (tools/gerar_acai.py grava as medidas do copo)
  const internos = info ? validas.filter((c) => ADICIONAIS_3D[c.tipo].camada).sort(ordem) : [];
  // pilha: camadas que o cliente montou, de baixo para cima (pode repetir); null = modo antigo
  const pilha = info && Array.isArray(opcoes.pilha) ? opcoes.pilha.filter((t) => VISUAL_CAMADA[t]) : null;
  const lista = validas.filter((c) => !ADICIONAIS_3D[c.tipo].camada).sort(ordem);
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
    ajudante = { frasco, ang: frasco ? 0 : angulos[k], item: itens.length - 1 };
  }
  // bibliotecas de pedaços (cubinhos de morango, rodelas de banana…) entram escondidas;
  // a coluna reaproveita as malhas
  const libs = {};
  const addLib = (nome, buf) => {
    if (nome && buf && libs[nome] == null) {
      libs[nome] = itens.length;
      itens.push({ buf, no: { name: 'biblioteca_' + nome, scale: [1e-4, 1e-4, 1e-4] } });
    }
  };
  internos.forEach((x) => addLib(ADICIONAIS_3D[x.tipo].pecas, x.buf));
  Object.keys(opcoes.libs || {}).forEach((nome) => addLib(nome, opcoes.libs[nome]));
  const c = combinar(itens, 'MenuReal AR · monte seu açaí');
  const malhasDe = () => {
    const m = {};
    Object.keys(libs).forEach((nome) => {
      m[nome] = (c.json.nodes[c.nos[libs[nome]]].children || []).map((no) => c.json.nodes[no])
        .filter((n) => n.mesh != null).map((n) => ({ mesh: n.mesh, encostar: !!(n.extras && n.extras.encostar) }));
    });
    return m;
  };
  const esconderInterior = () => (c.json.nodes[c.nos[0]].children || []).forEach((no) => {
    const n = c.json.nodes[no];
    if (n.extras && n.extras.interior) n.scale = [1e-4, 1e-4, 1e-4];
  });
  if (pilha) {
    esconderInterior();
    const coluna = gerarColuna(c, info, pilha, malhasDe(), s, false);
    if (Number.isInteger(opcoes.animarCamada) && opcoes.animarCamada < coluna.faixas.length) {
      animarCamadaNova(c, coluna, opcoes.animarCamada, info);
      return finalizar(c);
    }
  } else if (internos.length) {
    esconderInterior();
    // modo antigo: camadas escolhidas como adicionais, intercaladas com açaí, enchendo o copo
    const auto = ['acai'];
    internos.forEach((x) => auto.push(x.tipo, 'acai'));
    const coluna = gerarColuna(c, info, auto, malhasDe(), s, true);
    if (internos.some((x) => x.tipo === opcoes.animar)) {
      const coberturas = [];
      lista.forEach((_, i) => (c.json.nodes[c.nos[i + 1]].children || []).forEach((no) => coberturas.push(no)));
      animarColuna(c, coluna, coberturas, info);
      return finalizar(c);
    }
  }
  if (k > -1) {
    const nosAjudante = ajudante ? c.json.nodes[c.nos[ajudante.item]].children || [] : [];
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

// ---------------------------------------------------------------------------
// Açaí em camadas: açaí → creme/fruta/Nutella → açaí … gerado dentro do copo.
// As medidas vêm do próprio copo (asset.extras.copo, em metros).
// ---------------------------------------------------------------------------
function semente(texto) { let h = 2166136261; for (const ch of texto) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function aleatorio(seed) { let r = seed || 1; return () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; }; }

function malha(c, nome, pos, nrm, uv, idx, material) {
  const acc = c.json.accessors;
  const P = new Float32Array(pos), N = new Float32Array(nrm), U = new Float32Array(uv), I = new Uint32Array(idx);
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
  const add = (arr, tipo, alvo, extra = {}) => {
    const bv = anexar(c, arr);
    if (alvo) c.json.bufferViews[bv].target = alvo;
    acc.push(Object.assign({ bufferView: bv, componentType: arr instanceof Uint32Array ? 5125 : 5126,
      count: tipo === 'SCALAR' ? arr.length : arr.length / (tipo === 'VEC3' ? 3 : 2), type: tipo }, extra));
    return acc.length - 1;
  };
  const prim = {
    attributes: { POSITION: add(P, 'VEC3', 34962, { min: mn, max: mx }), NORMAL: add(N, 'VEC3', 34962), TEXCOORD_0: add(U, 'VEC2', 34962) },
    indices: add(I, 'SCALAR', 34963), material
  };
  c.json.meshes = c.json.meshes || [];
  c.json.meshes.push({ name: nome, primitives: [prim] });
  return c.json.meshes.length - 1;
}

function multQ(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
function quatEixo(eixo, ang) { const l = Math.hypot(...eixo) || 1, s = Math.sin(ang / 2); return [eixo[0] / l * s, eixo[1] / l * s, eixo[2] / l * s, Math.cos(ang / 2)]; }
/** Rotação que leva o eixo Y local para a direção v. */
function quatYpara(v) {
  const l = Math.hypot(...v) || 1, d = [v[0] / l, v[1] / l, v[2] / l];
  const eixo = [d[2], 0, -d[0]];
  if (Math.hypot(...eixo) < 1e-6) return d[1] > 0 ? [0, 0, 0, 1] : [1, 0, 0, 0];
  return quatEixo(eixo, Math.acos(Math.max(-1, Math.min(1, d[1]))));
}

/**
 * Coluna de camadas dentro do copo. pilha: tipos de baixo para cima (VISUAL_CAMADA).
 * encher=true: as camadas dividem a altura toda; false: cada camada ocupa peso/CAPACIDADE
 * (o copo vai enchendo conforme o cliente adiciona). Devolve nós para animação.
 */
function gerarColuna(c, info, pilha, malhas, s, encher) {
  const mat = (nome) => { const i = c.json.materials.findIndex((m) => m.name === nome); return i < 0 ? 0 : i; };
  const { rt, rb, H, g, folga, base, y0, y_borda: yb, pico, k } = info;
  const raio = (y) => rb - g + (rt - rb) * (y - base) / (H - base) - folga;
  const inclina = (rt - rb) / (H - base);
  const res = { faixas: [], topo: null, cheio: false };
  if (!pilha.length) return res;
  // material de fundo de cada camada: camadas só de pedaços mostram a camada de baixo entre eles
  let fundo = 'acai_camada';
  const seq = pilha.map((t) => {
    const v = VISUAL_CAMADA[t] || VISUAL_CAMADA.acai;
    if (v.mat) fundo = v.mat;
    return { tipo: t, mat: v.mat || fundo, topo: v.topo, peso: v.peso, pecas: v.pecas, esp: v.esp };
  });
  const somaPesos = seq.reduce((a, x) => a + x.peso, 0);
  const total = encher ? somaPesos : CAPACIDADE;
  res.cheio = encher || somaPesos >= CAPACIDADE - 0.05;
  const alturaCol = yb - y0;
  let acum = 0;
  const fronteiras = [{ y: y0, onda: () => 0 }];
  seq.forEach((x, i) => {
    acum += x.peso;
    const ultimaCheia = res.cheio && i === seq.length - 1;
    const y = ultimaCheia ? yb : Math.min(yb, y0 + alturaCol * acum / total);
    if (ultimaCheia) { fronteiras.push({ y: yb, onda: () => 0 }); return; }
    // ondulação estável: depende só das camadas até aqui (adicionar outra não mexe nas de baixo)
    const rnd = aleatorio(semente(pilha.slice(0, i + 1).join('|') + '#' + i));
    const f = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28], a = 0.003 + rnd() * 0.0016;
    fronteiras.push({ y, onda: (th) => a * (0.6 * Math.sin(2 * th + f[0]) + 0.3 * Math.sin(5 * th + f[1]) + 0.15 * Math.sin(9 * th + f[2])) });
  });
  const NU = 96, NV = 10;
  const novoNo = (no) => { c.json.nodes.push(no); const i = c.json.nodes.length - 1; c.json.scenes[0].nodes.push(i); return i; };
  seq.forEach((x, i) => {
    const baixo = fronteiras[i], cima = fronteiras[i + 1];
    if (cima.y - baixo.y < 0.0004) return;
    const pos = [], nrm = [], uv = [], idx = [];
    for (let j = 0; j < NV; j++) {
      const t = j / (NV - 1);
      for (let q = 0; q <= NU; q++) {
        const th = (q / NU) * Math.PI * 2;
        const y = baixo.y + baixo.onda(th) + (cima.y + cima.onda(th) - baixo.y - baixo.onda(th)) * t;
        const r = raio(y);
        pos.push(r * Math.cos(th), y - baixo.y, -r * Math.sin(th));
        const n = [Math.cos(th), -inclina, -Math.sin(th)], l = Math.hypot(...n);
        nrm.push(n[0] / l, n[1] / l, n[2] / l);
        uv.push(q / NU, (y - y0) / alturaCol);
      }
    }
    for (let j = 0; j < NV - 1; j++) for (let q = 0; q < NU; q++) {
      const a = j * (NU + 1) + q, b = a + 1, d = a + NU + 1, e = d + 1;
      idx.push(a, b, e, a, e, d);
    }
    if (i === 0) {
      const centro = pos.length / 3;
      pos.push(0, 0, 0); nrm.push(0, -1, 0); uv.push(0.5, 0);
      for (let q = 0; q < NU; q++) idx.push(centro, q + 1, q);
    }
    const ultima = i === seq.length - 1;
    if (!(ultima && res.cheio)) {   // tampa ondulada (a superfície de cima enquanto o copo não está cheio)
      const anel = pos.length / 3;
      for (let q = 0; q <= NU; q++) {
        const th = (q / NU) * Math.PI * 2;
        const y = cima.y + cima.onda(th), r = raio(y) - 0.0002;
        pos.push(r * Math.cos(th), y - baixo.y, -r * Math.sin(th)); nrm.push(0, 1, 0); uv.push(q / NU, (y - y0) / alturaCol);
      }
      const centro = pos.length / 3;
      pos.push(0, cima.y - baixo.y + 0.0012, 0); nrm.push(0, 1, 0); uv.push(0.5, (cima.y - y0) / alturaCol);
      for (let q = 0; q < NU; q++) idx.push(centro, anel + q, anel + q + 1);
    }
    const m = malha(c, 'camada_' + i, pos, nrm, uv, idx, mat(x.mat));
    const no = novoNo({ name: 'camada_' + i + '_' + x.tipo, mesh: m, translation: [0, baixo.y, 0] });
    const faixa = { no, y0: baixo.y, y1: cima.y, pecas: [], i };
    res.faixas.push(faixa);
    // pedaços: encostados no copo (aparecem pelo plástico) e espalhados por cima da camada
    const lib = x.pecas && malhas[x.pecas];
    if (lib && lib.length) {
      const rnd = aleatorio(semente('pecas|' + pilha.slice(0, i + 1).join('|') + '#' + i));
      const fs = s * 0.92, esp = (x.esp || 0.12) * s;
      const altura = cima.y - baixo.y;
      const linhas = Math.max(1, Math.round(altura / (esp * 0.95)));
      for (let ln = 0; ln < linhas; ln++) {
        const y = baixo.y + altura * (ln + 0.5) / linhas;
        const r = raio(y);
        const n = Math.max(6, Math.floor((2 * Math.PI * r) / esp));
        for (let q = 0; q < n; q++) {
          const p = lib[Math.floor(rnd() * lib.length)];
          const th = ((q + (ln % 2 ? 0.5 : 0) + (rnd() - 0.5) * 0.35) / n) * Math.PI * 2;
          const fora = [Math.cos(th), 0, -Math.sin(th)];
          const rr = r - (p.encostar ? 0.0032 : 0.0042);
          const rot = p.encostar
            ? multQ(quatYpara([fora[0] + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.4, fora[2] + (rnd() - 0.5) * 0.3]), quatEixo([0, 1, 0], rnd() * 6.28))
            : quatEixo([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], rnd() * 6.28);
          faixa.pecas.push(novoNo({ name: 'pedaco', mesh: p.mesh, translation: [rr * Math.cos(th), y + (rnd() - 0.5) * 0.003, -rr * Math.sin(th)], rotation: rot, scale: [fs, fs, fs] }));
        }
      }
      // por cima da camada (ficam cobertos pela próxima; com o copo aberto, aparecem)
      const rc = raio(cima.y) * 0.78;
      const nTopo = Math.max(4, Math.round((Math.PI * rc * rc) / (esp * esp) * 0.75));
      for (let q = 0; q < nTopo; q++) {
        const p = lib[Math.floor(rnd() * lib.length)];
        const a = rnd() * 6.28, d = rc * Math.sqrt(rnd());
        const th = Math.atan2(-d * Math.sin(a), d * Math.cos(a));
        const yTopo = cima.y + cima.onda(th < 0 ? th + 6.283 : th) + (p.encostar ? 0.0028 : 0.0035);
        const rot = p.encostar ? multQ(quatEixo([rnd() - 0.5, 0, rnd() - 0.5], rnd() * 0.5), quatEixo([0, 1, 0], rnd() * 6.28))
          : quatEixo([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5], rnd() * 6.28);
        faixa.pecas.push(novoNo({ name: 'pedaco_topo', mesh: p.mesh, translation: [d * Math.cos(a), yTopo, d * Math.sin(a)], rotation: rot, scale: [fs, fs, fs] }));
      }
    }
  });
  if (res.cheio) {
    // topo em cúpula (o mesmo do copo), sobre a última camada
    const ult = seq[seq.length - 1];
    const ra = raio(yb), NT = 32, NQ = 128;
    const pos = [], nrm = [], uv = [], idx = [];
    for (let j = 0; j < NT; j++) {
      const t = j / (NT - 1), r = ra * t;
      for (let q = 0; q <= NQ; q++) {
        const th = (q / NQ) * Math.PI * 2;
        const dobra = 0.0009 * Math.sin(5 * th + t * 9) * Math.sin(Math.PI * t) ** 2 * (0.6 + 0.4 * Math.sin(3 * th));
        pos.push(r * Math.cos(th), pico - k * r * r + dobra - yb, -r * Math.sin(th));
        const n = [2 * k * r * Math.cos(th), 1, -2 * k * r * Math.sin(th)], l = Math.hypot(...n);
        nrm.push(n[0] / l, n[1] / l, n[2] / l);
        uv.push(q / NQ, t);
      }
    }
    for (let j = 0; j < NT - 1; j++) for (let q = 0; q < NQ; q++) {
      const a = j * (NQ + 1) + q, b = a + 1, d = a + NQ + 1, e = d + 1;
      idx.push(a, e, b, a, d, e);
    }
    const mt = malha(c, 'topo', pos, nrm, uv, idx, mat(ult.topo || ult.mat));
    res.topo = novoNo({ name: 'topo_acai', mesh: mt, translation: [0, yb, 0] });
  }
  return res;
}

/** Camada que o cliente acabou de adicionar: sobe do nível de antes e os pedaços caem dentro. */
function animarCamadaNova(c, col, indice, info) {
  const f = col.faixas.find((x) => x.i === indice);
  if (!f) return;
  const anim = criarAnimador(c);
  const MIN = 1e-4;
  anim.canal(f.no, 'scale', [0, 0.05, 0.55], [1, MIN, 1, 1, MIN, 1, 1, 1, 1], 'VEC3');
  const topoY = info.H + 0.03;
  f.pecas.forEach((no, j) => {
    const n = c.json.nodes[no];
    const t = n.translation, e = n.scale, r = n.rotation;
    const d = 0.1 + ((j * 0.618) % 1) * 0.45;
    const ini = [t[0] * 0.5, topoY + ((j * 0.37) % 1) * 0.02, t[2] * 0.5];
    const us = [0, 0.4, 0.75, 1], F = 0.32;
    anim.canal(no, 'translation', [0, ...us.map((u) => d + F * u)],
      [...ini, ...us.flatMap((u) => [ini[0] + (t[0] - ini[0]) * u, ini[1] + (t[1] - ini[1]) * u * u, ini[2] + (t[2] - ini[2]) * u])], 'VEC3');
    anim.canal(no, 'rotation', [0, d, d + F], [0.3, 0.6, 0.1, 0.735, 0.3, 0.6, 0.1, 0.735, ...r], 'VEC4');
    anim.canal(no, 'scale', [0, d], [MIN, MIN, MIN, ...e], 'VEC3', 'STEP');
  });
  if (col.topo != null && col.faixas[col.faixas.length - 1] === f) {
    anim.canal(col.topo, 'scale', [0, 0.5, 0.55, 0.8], [MIN, MIN, MIN, MIN, MIN, MIN, 1, 0.05, 1, 1, 1, 1], 'VEC3');
  }
  anim.fechar();
}

function criarAnimador(c) {
  const acc = c.json.accessors;
  const samplers = [], channels = [];
  const add = (dados, tipo) => {
    const arr = new Float32Array(dados);
    const n = tipo === 'SCALAR' ? arr.length : arr.length / (tipo === 'VEC3' ? 3 : 4);
    const a = { bufferView: anexar(c, arr), componentType: 5126, count: n, type: tipo };
    if (tipo === 'SCALAR') { a.min = [Math.min(...arr)]; a.max = [Math.max(...arr)]; }
    acc.push(a);
    return acc.length - 1;
  };
  return {
    canal(no, path, tempos, valores, tipo, interp = 'LINEAR') {
      samplers.push({ input: add(tempos, 'SCALAR'), output: add(valores, tipo), interpolation: interp });
      channels.push({ sampler: samplers.length - 1, target: { node: no, path } });
    },
    fechar() { if (channels.length) c.json.animations = [{ name: 'entrada', samplers, channels }]; }
  };
}

/** Copo enchendo: cada camada sobe, os pedaços de fruta caem, o topo cobre; coberturas no fim. */
function animarColuna(c, col, coberturas, info) {
  const acc = c.json.accessors;
  const samplers = [], channels = [];
  const MIN = 1e-4;
  const add = (dados, tipo) => {
    const arr = new Float32Array(dados);
    const n = tipo === 'SCALAR' ? arr.length : arr.length / (tipo === 'VEC3' ? 3 : 4);
    const a = { bufferView: anexar(c, arr), componentType: 5126, count: n, type: tipo };
    if (tipo === 'SCALAR') { a.min = [Math.min(...arr)]; a.max = [Math.max(...arr)]; }
    acc.push(a);
    return acc.length - 1;
  };
  const canal = (no, path, tempos, valores, tipo, interp = 'LINEAR') => {
    samplers.push({ input: add(tempos, 'SCALAR'), output: add(valores, tipo), interpolation: interp });
    channels.push({ sampler: samplers.length - 1, target: { node: no, path } });
  };
  const DUR = 0.34, PASSO = 0.3;
  col.faixas.forEach((f, i) => {
    const a = 0.12 + i * PASSO;
    f.inicio = a;
    canal(f.no, 'scale', [0, a - 0.005, a, a + DUR], [MIN, MIN, MIN, MIN, MIN, MIN, 1, 0.03, 1, 1, 1, 1], 'VEC3');
  });
  const fim = 0.12 + col.faixas.length * PASSO;
  const pecas = [];
  col.faixas.forEach((f) => f.pecas.forEach((no, j) => pecas.push({ no, f, t: ((j * 0.618) % 1) })));
  pecas.forEach((p) => {
    const n = c.json.nodes[p.no];
    const t = n.translation, e = n.scale, r = n.rotation;
    const f = p.f;
    const d = f.inicio + 0.06 + p.t * 0.14;
    const ini = [t[0] * 0.7, f.y1 + 0.025, t[2] * 0.7];
    const us = [0, 0.4, 0.75, 1], F = 0.18;
    canal(p.no, 'translation', [0, ...us.map((u) => d + F * u)],
      [...ini, ...us.flatMap((u) => [ini[0] + (t[0] - ini[0]) * u, ini[1] + (t[1] - ini[1]) * u * u, ini[2] + (t[2] - ini[2]) * u])], 'VEC3');
    canal(p.no, 'rotation', [0, d, d + F], [0.3, 0.6, 0.1, 0.735, 0.3, 0.6, 0.1, 0.735, ...r], 'VEC4');
    canal(p.no, 'scale', [0, d], [MIN, MIN, MIN, ...e], 'VEC3', 'STEP');
  });
  canal(col.topo, 'scale', [0, fim - 0.005, fim, fim + 0.3], [MIN, MIN, MIN, MIN, MIN, MIN, 1, 0.05, 1, 1, 1, 1], 'VEC3');
  coberturas.forEach((no) => {
    const e = c.json.nodes[no].scale || [1, 1, 1];
    canal(no, 'scale', [0, fim + 0.3], [MIN, MIN, MIN, ...e], 'VEC3', 'STEP');
  });
  if (channels.length) c.json.animations = [{ name: 'entrada', samplers, channels }];
}

// ---------------------------------------------------------------------------
// Copo sob medida: a loja informa as medidas do copo dela (boca, fundo, altura) e,
// se quiser, a logo estampada. As texturas e materiais vêm de um copo modelo
// (assets/models/acai-pet-500.glb ou acai-500.glb); a geometria é refeita aqui,
// com as mesmas proporções internas que tools/gerar_acai.py usa (camadas e caldas
// escorrendo continuam encaixando).
// ---------------------------------------------------------------------------
const PROP_VIDRO = 0.030, PROP_FOLGA = 0.012, PROP_BASE = 0.105;

/** Medidas típicas (cm) de um copo de açaí com essa capacidade em ml. */
export function medidasPorMl(ml) {
  const v = Math.max(80, Math.min(2000, Number(ml) || 500));
  const rt = Math.cbrt((1.1 * v) / 5.195);           // proporções: fundo 0,69 da boca, altura 2,29 × raio
  return { boca: +(2 * rt).toFixed(1), fundo: +(2 * rt * 0.69).toFixed(1), altura: +(2.29 * rt).toFixed(1) };
}

function revolucao(raio, alt, linhas, nq, sentido, ref) {
  // sentido: 1 = normal para fora do eixo, -1 = para dentro; ref(t) opcional = centro de referência
  const pos = [], nrm = [], uv = [], idx = [];
  const P = (t, q) => { const th = (q / nq) * Math.PI * 2, r = raio(t); return [r * Math.cos(th), alt(t), -r * Math.sin(th)]; };
  for (let j = 0; j < linhas; j++) {
    const t = j / (linhas - 1);
    for (let q = 0; q <= nq; q++) {
      const p = P(t, q);
      const dt = 1e-3, a = P(Math.min(1, t + dt), q), b = P(Math.max(0, t - dt), q);
      const th = (q / nq) * Math.PI * 2;
      const tq = [-Math.sin(th), 0, -Math.cos(th)];
      const tv = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      let n = [tv[1] * tq[2] - tv[2] * tq[1], tv[2] * tq[0] - tv[0] * tq[2], tv[0] * tq[1] - tv[1] * tq[0]];
      const l = Math.hypot(...n) || 1;
      n = n.map((x) => x / l);
      const c = ref ? ref(t, th) : [0, p[1], 0];
      const fora = (p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2];
      if ((fora < 0) === (sentido > 0)) n = n.map((x) => -x);
      pos.push(...p); nrm.push(...n); uv.push(q / nq, t);
    }
  }
  for (let j = 0; j < linhas - 1; j++) for (let q = 0; q < nq; q++) {
    const a = j * (nq + 1) + q, b = a + 1, d = a + nq + 1, e = d + 1;
    // ordem dos vértices acompanha a normal
    const p0 = pos.slice(a * 3, a * 3 + 3), p1 = pos.slice(b * 3, b * 3 + 3), p2 = pos.slice(e * 3, e * 3 + 3);
    const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], w = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cr = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const nn = nrm.slice(a * 3, a * 3 + 3);
    if (cr[0] * nn[0] + cr[1] * nn[1] + cr[2] * nn[2] >= 0) idx.push(a, b, e, a, e, d); else idx.push(a, e, b, a, d, e);
  }
  return { pos, nrm, uv, idx };
}
function discoMalha(r, y, nq, cima) {
  const pos = [0, y, 0], nrm = [0, cima ? 1 : -1, 0], uv = [0.5, 0.5], idx = [];
  for (let q = 0; q <= nq; q++) {
    const th = (q / nq) * Math.PI * 2;
    pos.push(r * Math.cos(th), y, -r * Math.sin(th)); nrm.push(0, cima ? 1 : -1, 0); uv.push(0.5 + 0.5 * Math.cos(th), 0.5 + 0.5 * Math.sin(th));
  }
  for (let q = 1; q <= nq; q++) cima ? idx.push(0, q, q + 1) : idx.push(0, q + 1, q);
  return { pos, nrm, uv, idx };
}
function juntarMalhas(lista) {
  const out = { pos: [], nrm: [], uv: [], idx: [] };
  lista.forEach((m) => {
    const base = out.pos.length / 3;
    out.pos.push(...m.pos); out.nrm.push(...m.nrm); out.uv.push(...m.uv); out.idx.push(...m.idx.map((i) => i + base));
  });
  return out;
}

/**
 * modelo: bytes do copo modelo. medidas: { boca, fundo, altura } em cm.
 * logo (opcional): { bytes: PNG/JPEG, tipo: 'image/png', largura, altura }.
 * Devolve o GLB do copo com açaí, pronto para o montador (asset.extras.copo).
 */
export function gerarCopo(modelo, medidas, logo) {
  const t = lerGlb(modelo);
  const rt = medidas.boca / 200, rb = medidas.fundo / 200, H = medidas.altura / 100;
  if (!(rt > 0.01 && rb > 0.008 && rb <= rt * 1.2 && H > 0.03 && H < 0.6)) throw new Error('Medidas do copo inválidas.');
  const g = PROP_VIDRO * rt, folga = PROP_FOLGA * rt, base = PROP_BASE * rt;
  const s = AREA * 2 * rt, k = (4 * DOMO) / s;
  const yb = H - 0.0015, y0 = base + 0.0004;
  const raT = rt - g - folga, raB = rb - g - folga;
  const pico = yb + k * raT * raT;
  const c = {
    json: { asset: { version: '2.0', generator: 'MenuReal AR · copo sob medida', extras: {} }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [],
      materials: JSON.parse(JSON.stringify(t.json.materials)), textures: JSON.parse(JSON.stringify(t.json.textures || [])),
      images: [], samplers: JSON.parse(JSON.stringify(t.json.samplers || [{}])), accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] },
    partes: [], binTotal: 0
  };
  // imagens do modelo (só os bytes delas; a geometria antiga fica de fora)
  (t.json.images || []).forEach((im) => {
    const bv = t.json.bufferViews[im.bufferView];
    const bytes = t.bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    c.json.images.push({ bufferView: anexar(c, new Uint8Array(bytes)), mimeType: im.mimeType });
  });
  if (t.json.extensionsUsed) c.json.extensionsUsed = t.json.extensionsUsed.slice();
  const mat = (nome) => Math.max(0, c.json.materials.findIndex((m) => m.name === nome));
  const pet = !c.json.materials.some((m) => m.extensions && m.extensions.KHR_materials_ior && (m.pbrMetallicRoughness.baseColorFactor || [])[3] > 0.12);
  const NQ = 128;
  // vidro/plástico: parede externa (com frisos no PET), interna, fundo grosso e borda arredondada
  const friso = (u) => (pet && u > 0.82 ? 0.00035 * Math.max(0, Math.sin(Math.min(1, (u - 0.82) / 0.16) * Math.PI * 5)) : 0) + (pet ? 0.0006 * Math.exp(-(((u - 0.04) / 0.012) ** 2)) : 0);
  const vidro = juntarMalhas([
    revolucao((u) => rb + (rt - rb) * u + friso(u), (u) => H * u, pet ? 160 : 40, NQ, 1),
    revolucao((u) => rb - g + (rt - rb) * u, (u) => base + (H - base) * u, 40, NQ, -1),
    discoMalha(rb, 0, NQ, false), discoMalha(rb - g, base, NQ, true)
  ]);
  const borda = revolucao((u) => rt - g / 2 + (g / 2) * Math.cos(u * Math.PI), (u) => H + (g / 2) * Math.sin(u * Math.PI), 12, NQ, 1,
    (u, th) => [(rt - g / 2) * Math.cos(th), H, -(rt - g / 2) * Math.sin(th)]);
  // açaí (interior: some quando o cliente monta as camadas)
  const parede = juntarMalhas([revolucao((u) => raB + (raT - raB) * u, (u) => y0 + (yb - y0) * u, 32, NQ, 1), discoMalha(raB, y0, NQ, false)]);
  const topo = revolucao((u) => raT * u, (u) => pico - k * (raT * u) ** 2, 40, NQ, 1, (u) => [0, -1, 0]);
  const no = (nome, m, extras) => { c.json.nodes.push(Object.assign({ name: nome, mesh: m }, extras ? { extras } : {})); c.json.scenes[0].nodes.push(c.json.nodes.length - 1); };
  // um nó para o interior (com as duas malhas como filhas) e outro para o copo
  const mParede = malha(c, 'acai_parede', parede.pos, parede.nrm, parede.uv, parede.idx, mat('acai_parede'));
  const mTopo = malha(c, 'acai_topo', topo.pos, topo.nrm, topo.uv, topo.idx, mat('acai'));
  c.json.nodes.push({ name: 'interior_topo', mesh: mTopo });
  c.json.nodes.push({ name: 'interior', mesh: mParede, extras: { interior: true }, children: [c.json.nodes.length - 1] });
  c.json.scenes[0].nodes.push(c.json.nodes.length - 1);
  // logo estampada na frente do copo (de frente para a câmera)
  if (logo && logo.bytes) {
    c.json.images.push({ bufferView: anexar(c, logo.bytes), mimeType: logo.tipo || 'image/png' });
    c.json.samplers.push({ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 });
    c.json.textures.push({ source: c.json.images.length - 1, sampler: c.json.samplers.length - 1 });
    c.json.materials.push({ name: 'logo', alphaMode: 'BLEND', doubleSided: false,
      pbrMetallicRoughness: { baseColorTexture: { index: c.json.textures.length - 1 }, metallicFactor: 0, roughnessFactor: 0.45 } });
    const asp = (logo.largura || 1) / (logo.altura || 1);
    let h = 0.3 * H;
    const yc = 0.5 * H, rmed = rb + (rt - rb) * (yc / H);
    let arco = (h * asp) / rmed;
    if (arco > 2.0) { arco = 2.0; h = (arco * rmed) / asp; }
    const L = 24, Q = 48, pos = [], nrm = [], uv = [], idx = [];
    const centro = -Math.PI / 2;
    for (let j = 0; j < L; j++) {
      const v = j / (L - 1), y = yc + h / 2 - h * v;
      const r = rb + (rt - rb) * (y / H) + 0.00025;
      for (let q = 0; q < Q; q++) {
        const u = q / (Q - 1), th = centro - arco / 2 + arco * u;
        pos.push(r * Math.cos(th), y, -r * Math.sin(th));
        nrm.push(Math.cos(th), 0, -Math.sin(th));
        uv.push(u, v);
      }
    }
    for (let j = 0; j < L - 1; j++) for (let q = 0; q < Q - 1; q++) {
      const a = j * Q + q, b = a + 1, d = a + Q, e = d + 1;
      idx.push(a, d, e, a, e, b);
    }
    no('logo', malha(c, 'logo', pos, nrm, uv, idx, c.json.materials.length - 1));
  }
  no('copo', malha(c, 'copo', vidro.pos, vidro.nrm, vidro.uv, vidro.idx, mat('vidro')));
  no('copo_borda', malha(c, 'copo_borda', borda.pos, borda.nrm, borda.uv, borda.idx, mat('vidro_borda')));
  const larg = 2 * rt * 100, alt = pico * 100;
  c.json.asset.extras = { unidade: 'metro', dimensoes_cm: { largura_x: +larg.toFixed(2), profundidade_z: +larg.toFixed(2), altura_y: +alt.toFixed(2) },
    copo: { rt, rb, H, g, folga, base, y0, y_borda: yb, pico, k } };
  return { glb: finalizar(c), medidasCm: { largura: +larg.toFixed(1), profundidade: +larg.toFixed(1), altura: +alt.toFixed(1) } };
}
