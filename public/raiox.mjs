/* =========================================================================
   MenuReal — Modo Raio-X (Three.js)
   Mostra o móvel por dentro: transparência só nas peças de fora (portas,
   frentes, laterais, tampo), seleção de peças, vista explodida, portas e
   gavetas que abrem. Só usa peças que existem de verdade:
   - planejados: as peças vêm da ficha do montador (mesmas medidas do 3D);
   - arquivo .glb: as partes que o marceneiro identificou no painel.
   Carregado só quando o cliente abre o Raio-X (não pesa no catálogo).
   ========================================================================= */
import * as THREE from './vendor/three/three.module.min.js';
import { GLTFLoader } from './vendor/three/addons/GLTFLoader.js';
import { DRACOLoader } from './vendor/three/addons/DRACOLoader.js';
import { MeshoptDecoder } from './vendor/three/addons/meshopt_decoder.module.js';
import { OrbitControls } from './vendor/three/addons/OrbitControls.js';
import { RoomEnvironment } from './vendor/three/addons/RoomEnvironment.js';

const BASE = new URL('./', import.meta.url).href;
export const TIPOS_PECA = {
  porta: 'Porta', gaveta: 'Gaveta', prateleira: 'Prateleira', lateral: 'Lateral', divisoria: 'Divisória', fundo: 'Fundo',
  tampo: 'Tampo', estrutura: 'Estrutura', puxador: 'Puxador', rodape: 'Rodapé', eletro: 'Eletrodoméstico', acessorio: 'Acessório',
  painel: 'Painel', led: 'Iluminação', frente: 'Frente', ferragem: 'Ferragem', estofado: 'Estofado', outra: 'Peça'
};
// peças "de fora": ficam transparentes no Raio-X para mostrar o que há dentro
const CASCA = new Set(['porta', 'frente', 'lateral', 'tampo', 'painel', 'rodape', 'puxador', 'estofado']);
const DIRECOES = { frente: [0, 0, 1], tras: [0, 0, -1], esquerda: [-1, 0, 0], direita: [1, 0, 0], cima: [0, 1, 0], baixo: [0, -1, 0] };
export const VISTAS = { inicio: [28, 72], frente: [0, 80], lado: [90, 80], tras: [180, 80], cima: [0, 12] };
const COR_DESTAQUE = new THREE.Color('#D8B78E');
const suave = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const ANG_PORTA = THREE.MathUtils.degToRad(100);

export function webglDisponivel() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

/** Lista as partes (malhas) de um .glb, na mesma ordem que o Raio-X usa. Para o painel. */
export async function listarPartesGlb(url) {
  const gltf = await carregarGlb(url);
  const out = [];
  gltf.scene.traverse((o) => { if (o.isMesh) out.push({ no: out.length, nome: o.name || '', tri: triangulos(o.geometry) }); });
  liberar(gltf.scene);
  return { partes: out, animacoes: gltf.animations.map((a) => a.name || 'Animação') };
}

function triangulos(g) { return Math.round((g.index ? g.index.count : g.attributes.position.count) / 3); }

let dracoComp = null;
function carregarGlb(url, aoProgresso) {
  const loader = new GLTFLoader();
  if (!dracoComp) { dracoComp = new DRACOLoader(); dracoComp.setDecoderPath(BASE + 'vendor/three/draco/'); }
  loader.setDRACOLoader(dracoComp);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.loadAsync(url, (e) => { if (aoProgresso && e.total) aoProgresso(e.loaded / e.total); });
}

function liberar(raiz) {
  raiz.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach((m) => { for (const k of Object.keys(m)) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); });
  });
}

/**
 * Abre o Raio-X dentro de `el`.
 * fonte: { tipo: 'planejado', ficha } | { tipo: 'glb', url, pecas: [{ no, nomeNo, nome, tipo, desc, material, destacar, mov, explodir }] }
 * op: { orbita: { theta, phi, radius, alvo:[x,y,z], fov }, pouca, editor, aoSelecionar(info|null), aoMudar(), aoProgresso(f), aoFalhar(msg) }
 */
export async function criarRaioX(el, fonte, op = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'rx-canvas';
  canvas.setAttribute('aria-label', 'Raio-X do móvel em 3D. Arraste para girar, toque numa peça para ver os detalhes.');
  canvas.setAttribute('role', 'img');
  el.appendChild(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !op.pouca && (window.devicePixelRatio || 1) < 2.5, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { canvas.remove(); throw new Error('Este aparelho não conseguiu abrir o 3D do Raio-X.'); }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, op.pouca ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);

  const cena = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  const ambiente = pm.fromScene(new RoomEnvironment(), 0.04);
  pm.dispose();
  cena.environment = ambiente.texture;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
  const ctr = new OrbitControls(cam, canvas);
  ctr.enableDamping = true; ctr.dampingFactor = 0.09; ctr.screenSpacePanning = true; ctr.rotateSpeed = 0.75; ctr.zoomSpeed = 0.9;
  ctr.minPolarAngle = THREE.MathUtils.degToRad(4); ctr.maxPolarAngle = THREE.MathUtils.degToRad(98);

  const modelo = new THREE.Group(); cena.add(modelo);
  const pecas = [];      // { id, nome, tipo, tipoNome, grupo, desc, material, medidas, casca, destacar, malhas[], grupo3d, base, explode[], mov }
  const movs = new Map(); // id → { tipo, giro, vetor, eixo, v, alvo, pecas[] }
  let mixer = null, clipes = [], acoes = [];
  let vivo = true, sujo = true, raf = 0;

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (vivo && op.aoFalhar) op.aoFalhar('O aparelho pausou o 3D para economizar memória.'); });

  // ------------------------------------------------------------ peças
  function prepararMalha(m, pc) {
    const ms = Array.isArray(m.material) ? m.material : [m.material];
    const novos = ms.map((x) => { const c = x.clone(); c.userData.orig = { opacity: c.opacity, transparent: c.transparent, depthWrite: c.depthWrite, emissive: c.emissive ? c.emissive.clone() : null, ei: c.emissiveIntensity }; return c; });
    m.material = Array.isArray(m.material) ? novos : novos[0];
    m.userData.peca = pc;
    pc.malhas.push(m);
  }

  if (fonte.tipo === 'planejado') {
    const P = await import(BASE + 'planejado.mjs');
    const r = P.montarPecasPlanejado(fonte.ficha);
    const base = {};
    const mat = (nome) => {
      if (base[nome]) return base[nome];
      const d = r.materiais[nome] || r.materiais.interno;
      const m = new THREE.MeshStandardMaterial({ roughness: d.rough, metalness: d.metal || 0, side: nome === 'vidro' || nome === 'espelho' ? THREE.DoubleSide : THREE.FrontSide });
      if (d.tex) { const t = new THREE.CanvasTexture(d.tex()); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; m.map = t; }
      else m.color.setRGB(...d.rgb.map((v) => Math.pow(v / 255, 2.2)));
      if (d.alfa) { m.transparent = true; m.opacity = d.alfa; }
      if (d.emissivo) m.emissive.setRGB(...d.emissivo);
      return (base[nome] = m);
    };
    for (const p of r.pecas) {
      const g3 = new THREE.Group();
      const pivo = p.mov && p.mov.tipo === 'porta' ? p.mov.pivo : [0, 0, 0];
      g3.position.set(...pivo);
      const pc = { id: p.id, nome: p.nome, tipo: p.tipo, tipoNome: p.tipoNome, grupo: p.grupo, desc: p.desc, material: p.material, medidas: p.medidas,
        casca: CASCA.has(p.tipo) || (p.tipo === 'gaveta' && !/^Caixa/.test(p.nome)), destacar: true, malhas: [], grupo3d: g3, base: new THREE.Vector3(...pivo), explode: p.explode, movId: null };
      for (const pt of p.partes) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pt.pos, 3));
        geo.setAttribute('normal', new THREE.BufferAttribute(pt.nor, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(pt.uv, 2));
        geo.setIndex(new THREE.BufferAttribute(pt.idx, 1));
        if (pivo[0] || pivo[2]) geo.translate(-pivo[0], -pivo[1], -pivo[2]);
        const m = new THREE.Mesh(geo, mat(pt.mat));
        prepararMalha(m, pc);
        g3.add(m);
      }
      if (p.mov) {
        const mv = movs.get(p.mov.id) || { tipo: p.mov.tipo, giro: p.mov.giro || 0, vetor: p.mov.vetor ? new THREE.Vector3(...p.mov.vetor) : null, eixo: 'y', v: 0, alvo: 0, pecas: [] };
        mv.pecas.push(pc); movs.set(p.mov.id, mv); pc.movId = p.mov.id;
      }
      modelo.add(g3); pecas.push(pc);
    }
    Object.values(base).forEach((m) => m.dispose());   // as peças usam cópias
  } else {
    const gltf = await carregarGlb(fonte.url, op.aoProgresso);
    if (!vivo) { liberar(gltf.scene); return null; }
    const raiz = gltf.scene; modelo.add(raiz); raiz.updateMatrixWorld(true);
    const malhas = []; raiz.traverse((o) => { if (o.isMesh) malhas.push(o); });
    const caixaTudo = new THREE.Box3().setFromObject(raiz);
    const tam = caixaTudo.getSize(new THREE.Vector3()), centroTudo = caixaTudo.getCenter(new THREE.Vector3());
    const conf = op.editor
      ? malhas.map((m, i) => ({ no: i, nome: m.name || 'Parte ' + (i + 1), nomeNo: m.name || '', tipo: 'outra', destacar: true, id: 'n' + i, tri: triangulos(m.geometry) }))
      : (fonte.pecas || []).filter((c) => malhas[c.no] && (!c.nomeNo || c.nomeNo === (malhas[c.no].name || '')));
    const porNome = new Map();
    conf.forEach((c) => {
      const chave = op.editor ? c.id : (c.nome || '').trim().toLowerCase() + '|' + c.tipo;
      if (!porNome.has(chave)) porNome.set(chave, { c, nos: [] });
      porNome.get(chave).nos.push(c.no);
    });
    let k = 0;
    for (const { c, nos } of porNome.values()) {
      const cx = new THREE.Box3(); nos.forEach((n) => cx.expandByObject(malhas[n]));
      const sz = cx.getSize(new THREE.Vector3()), ct = cx.getCenter(new THREE.Vector3());
      let pivo = new THREE.Vector3(), mov = null;
      if (c.mov === 'porta_esq' || c.mov === 'porta_dir') { pivo.set(c.mov === 'porta_esq' ? cx.min.x : cx.max.x, 0, cx.max.z); mov = { tipo: 'porta', giro: c.mov === 'porta_esq' ? -1 : 1, eixo: 'y' }; }
      else if (c.mov === 'basculante') { pivo.set(0, cx.max.y, cx.max.z); mov = { tipo: 'porta', giro: -1, eixo: 'x' }; }
      else if (c.mov === 'gaveta') mov = { tipo: 'gaveta', vetor: new THREE.Vector3(0, 0, Math.max(sz.z, tam.z) * 0.7), eixo: 'y' };
      const g3 = new THREE.Group(); g3.position.copy(pivo); modelo.add(g3); g3.updateMatrixWorld(true);
      const explode = c.explodir === 'auto' ? ct.clone().sub(centroTudo).normalize().toArray() : DIRECOES[c.explodir] || [0, 0, 0];
      const pc = { id: c.id || 'g' + (k++), nome: c.nome, tipo: c.tipo, tipoNome: TIPOS_PECA[c.tipo] || 'Peça', grupo: '', desc: c.desc || '', material: c.material || '',
        medidas: null, casca: CASCA.has(c.tipo) || c.tipo === 'gaveta', destacar: c.destacar !== false, malhas: [], grupo3d: g3, base: pivo.clone(), explode: explode.map((v) => v * 1.2), movId: null, nos,
        nomeNo: c.nomeNo || '', tri: c.tri || 0 };
      nos.forEach((n) => { g3.attach(malhas[n]); prepararMalha(malhas[n], pc); });
      if (mov) { const id = 'm' + pc.id; movs.set(id, Object.assign({ v: 0, alvo: 0, pecas: [pc] }, mov)); pc.movId = id; }
      pecas.push(pc);
    }
    if (gltf.animations.length) {
      mixer = new THREE.AnimationMixer(raiz);
      clipes = gltf.animations.map((a, i) => a.name || 'Animação ' + (i + 1));
      acoes = gltf.animations.map((a) => { const ac = mixer.clipAction(a); ac.setLoop(THREE.LoopOnce, 1); ac.clampWhenFinished = true; ac.userData = { frente: false }; return ac; });
    }
  }

  // ------------------------------------------------------------ enquadramento e chão
  modelo.updateMatrixWorld(true);
  const caixa = new THREE.Box3().setFromObject(modelo);
  const centro = caixa.getCenter(new THREE.Vector3()), tamanho = caixa.getSize(new THREE.Vector3());
  const raio = Math.max(0.05, tamanho.length() / 2);
  const distExplode = THREE.MathUtils.clamp(raio * (fonte.tipo === 'planejado' ? 0.32 : 0.42), 0.1, 0.8);
  ctr.minDistance = raio * 0.45; ctr.maxDistance = raio * 7;
  cam.near = Math.max(0.005, raio / 200); cam.far = raio * 60; cam.updateProjectionMatrix();
  (function chao() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(0.55, 'rgba(0,0,0,.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const tx = new THREE.CanvasTexture(cv);
    const s = Math.max(tamanho.x, tamanho.z) * 1.5 + 0.2;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(s * (tamanho.x >= tamanho.z ? 1 : tamanho.x / tamanho.z + 0.3), s * (tamanho.z > tamanho.x ? 1 : tamanho.z / tamanho.x + 0.3)), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(centro.x, caixa.min.y - 0.001, centro.z); pl.renderOrder = -1;
    cena.add(pl);
  })();

  function distanciaIdeal() {
    const v = THREE.MathUtils.degToRad(cam.fov) / 2, h = Math.atan(Math.tan(v) * cam.aspect);
    return raio / Math.sin(Math.min(v, h)) * 1.04;
  }
  function posicionar(theta, phi, r, alvo) {
    ctr.target.copy(alvo);
    cam.position.copy(new THREE.Vector3().setFromSphericalCoords(r, phi, theta)).add(alvo);
    cam.lookAt(alvo);
  }
  // como no model-viewer: o ângulo de visão vale para o lado menor da tela (no celular em pé, a largura)
  let fovMenor = 30;
  function tamanhoTela() {
    const w = el.clientWidth || 300, h = el.clientHeight || 300;
    renderer.setSize(w, h, false); cam.aspect = w / h;
    cam.fov = cam.aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fovMenor) / 2) / cam.aspect)) : fovMenor;
    cam.updateProjectionMatrix(); sujo = true;
  }
  tamanhoTela();
  if (op.orbita && op.orbita.radius > 0) {
    if (op.orbita.fov > 5 && op.orbita.fov < 120) { fovMenor = op.orbita.fov; tamanhoTela(); }
    posicionar(op.orbita.theta, op.orbita.phi, op.orbita.radius, new THREE.Vector3(...op.orbita.alvo));
  } else posicionar(THREE.MathUtils.degToRad(VISTAS.inicio[0]), THREE.MathUtils.degToRad(VISTAS.inicio[1]), distanciaIdeal(), centro);
  ctr.update();
  // o alvo da câmera não sai de perto do móvel (evita perder o móvel de vista arrastando)
  const limite = caixa.clone().expandByScalar(raio * 0.15);
  ctr.addEventListener('change', () => { if (!limite.containsPoint(ctr.target)) { const t = ctr.target.clone(); limite.clampPoint(t, ctr.target); } sujo = true; });

  // ------------------------------------------------------------ aparência (transparência e destaque)
  const estado = { transp: 0, sel: null, exp: 0, expAlvo: 0, expPausada: false, cam: null };
  const linhaCasca = new THREE.LineBasicMaterial({ color: COR_DESTAQUE, transparent: true, opacity: 0.5, depthWrite: false });
  const linhaSel = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
  function arestas(m) {
    if (m.userData.arestas !== undefined) return m.userData.arestas;
    m.userData.arestas = null;
    if (triangulos(m.geometry) > 40000) return null;
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), linhaCasca);
    l.raycast = () => {}; l.visible = false; m.add(l);
    return (m.userData.arestas = l);
  }
  function aplicarVisual() {
    const t = estado.transp, sel = estado.sel;
    for (const pc of pecas) {
      let o = pc.casca ? 1 - 0.88 * t : 1;
      if (sel) o = pc === sel ? 1 : Math.min(o, 0.13);
      for (const m of pc.malhas) {
        const ms = Array.isArray(m.material) ? m.material : [m.material];
        for (const mt of ms) {
          const og = mt.userData.orig, tr = og.transparent || o < 0.999;
          if (mt.transparent !== tr) { mt.transparent = tr; mt.needsUpdate = true; }
          mt.opacity = og.opacity * o;
          mt.depthWrite = o >= 0.999 ? og.depthWrite : false;
          if (mt.emissive) { if (pc === sel) { mt.emissive.copy(COR_DESTAQUE).multiplyScalar(0.28); mt.emissiveIntensity = 1; } else { mt.emissive.copy(og.emissive); mt.emissiveIntensity = og.ei; } }
        }
        const querLinha = pc === sel || (pc.casca && t > 0.04 && !sel);
        const l = querLinha ? arestas(m) : m.userData.arestas;
        if (l) { l.visible = querLinha; l.material = pc === sel ? linhaSel : linhaCasca; }
      }
      pc.grupo3d.renderOrder = pc === sel ? 2 : pc.casca ? 1 : 0;
    }
    linhaCasca.opacity = 0.18 + 0.4 * t;
    sujo = true;
  }

  // ------------------------------------------------------------ animação
  const relogio = new THREE.Clock();
  function posicoes() {
    const d = distExplode * suave(estado.exp);
    const tmp = new THREE.Vector3();
    for (const pc of pecas) {
      pc.grupo3d.position.copy(pc.base);
      if (d) pc.grupo3d.position.add(tmp.set(...pc.explode).multiplyScalar(d));
      const mv = pc.movId && movs.get(pc.movId);
      if (mv) {
        const e = suave(mv.v);
        // porta: gira na dobradiça (vertical); basculante: abre para cima, na dobradiça de cima
        if (mv.tipo === 'porta') { if (mv.eixo === 'x') pc.grupo3d.rotation.x = -ANG_PORTA * 0.85 * e; else pc.grupo3d.rotation.y = mv.giro * ANG_PORTA * e; }
        else if (mv.vetor) pc.grupo3d.position.addScaledVector(mv.vetor, e);
      }
    }
  }
  function passo(dt) {
    let mexeu = false;
    if (!estado.expPausada && estado.exp !== estado.expAlvo) {
      const s = Math.sign(estado.expAlvo - estado.exp) * dt / 1.4;
      estado.exp = Math.abs(estado.expAlvo - estado.exp) <= Math.abs(s) ? estado.expAlvo : estado.exp + s;
      mexeu = true;
      if (estado.exp === estado.expAlvo && op.aoMudar) op.aoMudar();
    }
    for (const mv of movs.values()) {
      if (mv.v === mv.alvo) continue;
      const s = Math.sign(mv.alvo - mv.v) * dt / 0.7;
      mv.v = Math.abs(mv.alvo - mv.v) <= Math.abs(s) ? mv.alvo : mv.v + s; mexeu = true;
    }
    if (mexeu) posicoes();
    if (mixer && acoes.some((a) => a.isRunning())) { mixer.update(dt); mexeu = true; }
    if (estado.cam) {
      const c = estado.cam; c.t = Math.min(1, c.t + dt / 0.65); const e = suave(c.t);
      const alvo = c.de.alvo.clone().lerp(c.para.alvo, e);
      let dth = c.para.theta - c.de.theta; if (dth > Math.PI) dth -= 2 * Math.PI; if (dth < -Math.PI) dth += 2 * Math.PI;
      posicionar(c.de.theta + dth * e, c.de.phi + (c.para.phi - c.de.phi) * e, c.de.r + (c.para.r - c.de.r) * e, alvo);
      if (c.t >= 1) estado.cam = null;
      mexeu = true;
    }
    return mexeu;
  }
  function quadro() {
    if (!vivo) return;
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(0.1, relogio.getDelta());
    if (passo(dt)) sujo = true;
    if (!estado.cam && ctr.update()) sujo = true;
    if (sujo) { renderer.render(cena, cam); sujo = false; }
  }
  const ro = new ResizeObserver(() => tamanhoTela()); ro.observe(el);
  posicoes(); aplicarVisual();
  renderer.render(cena, cam);
  quadro();

  // ------------------------------------------------------------ toque nas peças
  const ray = new THREE.Raycaster(), pt = new THREE.Vector2();
  let toque = null;
  canvas.addEventListener('pointerdown', (e) => { toque = { x: e.clientX, y: e.clientY, t: performance.now() }; estado.cam = null; });
  canvas.addEventListener('pointerup', (e) => {
    if (!toque || Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 7 || performance.now() - toque.t > 600) { toque = null; return; }
    toque = null;
    const r = canvas.getBoundingClientRect();
    pt.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(pt, cam);
    const alvos = []; pecas.forEach((pc) => { if (pc.destacar) alvos.push(...pc.malhas); });
    const hits = ray.intersectObjects(alvos, false);
    // atrás de uma porta transparente, a peça de dentro tem prioridade
    const visivel = hits.find((h) => { const pc = h.object.userData.peca; return !(pc.casca && estado.transp > 0.5) && !(estado.sel && pc !== estado.sel && estado.transp > 0.5); });
    const h = visivel || hits[0];
    api.selecionar(h ? h.object.userData.peca.id : null);
  });

  function info(pc) {
    const mv = pc.movId ? movs.get(pc.movId) : null;
    return { id: pc.id, nome: pc.nome, tipo: pc.tipo, tipoNome: pc.tipoNome, grupo: pc.grupo, desc: pc.desc, material: pc.material, medidas: pc.medidas,
      mov: mv ? mv.tipo : null, aberto: mv ? mv.alvo > 0.5 : false, nos: pc.nos || null, nomeNo: pc.nomeNo || '', tri: pc.tri || 0 };
  }
  function orbitaAtual() {
    const s = new THREE.Spherical().setFromVector3(cam.position.clone().sub(ctr.target));
    return { theta: s.theta, phi: s.phi, radius: s.radius, alvo: ctr.target.toArray(), fov: fovMenor };
  }
  function irPara(theta, phi, r, alvo) {
    const o = orbitaAtual();
    estado.cam = { t: 0, de: { theta: o.theta, phi: o.phi, r: o.radius, alvo: ctr.target.clone() }, para: { theta, phi, r, alvo: alvo.clone() } };
    if (reduz()) { estado.cam.t = 0.999; }
  }
  const reduz = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const api = {
    pecas: pecas.map(info),
    temExplosao: pecas.some((pc) => pc.explode.some((v) => v)),
    temMovimento: movs.size > 0,
    clipes,
    medidas: { largura: +(tamanho.x * 100).toFixed(1), altura: +(tamanho.y * 100).toFixed(1), profundidade: +(tamanho.z * 100).toFixed(1) },
    transparencia(v) { estado.transp = THREE.MathUtils.clamp(v, 0, 1); aplicarVisual(); },
    selecionar(id) {
      const pc = id ? pecas.find((p) => p.id === id) : null;
      estado.sel = pc || null; aplicarVisual();
      if (op.aoSelecionar) op.aoSelecionar(pc ? info(pc) : null);
      return pc ? info(pc) : null;
    },
    // explosão: alvo 0..1 (intensidade), pausar
    explodir(alvo) { estado.expAlvo = THREE.MathUtils.clamp(alvo, 0, 1); estado.expPausada = false; if (reduz()) { estado.exp = estado.expAlvo; posicoes(); sujo = true; } },
    pausarExplosao(p) { estado.expPausada = p; },
    explosao() { return { atual: estado.exp, alvo: estado.expAlvo, pausada: estado.expPausada, andando: !estado.expPausada && estado.exp !== estado.expAlvo }; },
    alternarMov(id) {
      const pc = pecas.find((p) => p.id === id); const mv = pc && pc.movId && movs.get(pc.movId);
      if (!mv) return null;
      mv.alvo = mv.alvo > 0.5 ? 0 : 1; if (reduz()) { mv.v = mv.alvo; posicoes(); sujo = true; }
      return mv.alvo > 0.5;
    },
    abrirTudo(abrir) { for (const mv of movs.values()) { mv.alvo = abrir ? 1 : 0; if (reduz()) mv.v = mv.alvo; } posicoes(); sujo = true; },
    algoAberto() { for (const mv of movs.values()) if (mv.alvo > 0.5) return true; return false; },
    tocarClipe(i) {
      const a = acoes[i]; if (!a) return false;
      const frente = !a.userData.frente; a.userData.frente = frente;
      a.paused = false; a.timeScale = frente ? 1 : -1;
      if (!a.isRunning()) { if (frente) a.reset(); else a.time = a.time || a.getClip().duration; a.play(); }
      relogio.getDelta(); sujo = true; return frente;
    },
    vista(nome) { const v = VISTAS[nome] || VISTAS.inicio; irPara(THREE.MathUtils.degToRad(v[0]), THREE.MathUtils.degToRad(v[1]), distanciaIdeal(), centro); },
    centralizar() { const o = orbitaAtual(); irPara(o.theta, o.phi, distanciaIdeal(), centro); },
    zoom(f) { const o = orbitaAtual(); irPara(o.theta, o.phi, THREE.MathUtils.clamp(o.radius * f, ctr.minDistance, ctr.maxDistance), ctr.target.clone()); },
    orbita: orbitaAtual,
    redesenhar() { tamanhoTela(); },
    destruir() {
      if (!vivo) return; vivo = false;
      cancelAnimationFrame(raf); ro.disconnect(); ctr.dispose();
      if (mixer) { mixer.stopAllAction(); mixer.uncacheRoot(mixer.getRoot()); }
      liberar(cena); linhaCasca.dispose(); linhaSel.dispose(); ambiente.dispose();
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* ok */ }
      canvas.remove();
    }
  };
  return api;
}
