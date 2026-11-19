/* =========================================================================
   MenuReal — RA ao vivo com a folha marcadora (para celulares sem ARCore)
   A câmera reconhece a folha A4 impressa no chão; o móvel fica preso nela,
   no tamanho real (a folha tem 21 cm de largura), e o cliente anda em volta.
   Rastreamento por imagem: MindAR (MIT) + three.js (MIT), servidos pelo site.
   ========================================================================= */
import * as THREE from 'three';
import { MindARThree } from './vendor/ra/mindar/mindar-image-three.prod.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const LARGURA_FOLHA_M = 0.21;   // A4 em pé: a imagem rastreada é a folha inteira
const ALTURA_FOLHA_M = 0.297;

function texturaSombra() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * Abre a câmera dentro de `container` e mostra o móvel preso na folha.
 * Devolve { girar(graus), parar() }. Eventos: aoEncontrar(), aoPerder(), aoCarregar().
 */
export async function iniciarRaFolha(op) {
  const mind = new MindARThree({
    container: op.container,
    imageTargetSrc: op.alvo || 'vendor/ra/folha-ra.mind',
    uiLoading: 'no', uiScanning: 'no', uiError: 'no',
    filterMinCF: 0.0005, filterBeta: 0.01,   // suaviza o tremido sem atrasar demais
    warmupTolerance: 3, missTolerance: 8
  });
  const { renderer, scene, camera } = mind;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.6));
  const sol = new THREE.DirectionalLight(0xffffff, 0.8); sol.position.set(0.5, 1, 1.5); scene.add(sol);

  const ancora = mind.addAnchor(0);
  // a folha está no plano XY da âncora (1 unidade = largura da folha); o chão é esse plano e o "para cima" é +Z
  const raiz = new THREE.Group();
  raiz.scale.setScalar(1 / LARGURA_FOLHA_M);   // a partir daqui, 1 unidade = 1 metro
  raiz.rotation.x = Math.PI / 2;                // y do móvel = para cima; frente do móvel = para a seta (quem segura o celular)
  ancora.group.add(raiz);
  const giro = new THREE.Group(); raiz.add(giro);
  const pivo = new THREE.Group(); giro.add(pivo);

  const gltf = await new Promise((ok, falha) => new GLTFLoader().load(op.modelo, ok, undefined, falha));
  const movel = gltf.scene;
  const caixa = new THREE.Box3().setFromObject(movel), tam = caixa.getSize(new THREE.Vector3()), centro = caixa.getCenter(new THREE.Vector3());
  // a folha fica no chão bem na FRENTE do móvel: a frente do móvel encosta na borda de cima da folha (a do lado oposto à seta).
  // Assim a folha fica perto da câmera (fácil de reconhecer) e o móvel aparece atrás dela.
  const bordaLonge = ALTURA_FOLHA_M / 2;
  movel.position.set(-centro.x, -caixa.min.y, -bordaLonge - caixa.max.z);
  // o giro acontece no centro do móvel: leva o pivô para lá
  giro.position.set(0, 0, -bordaLonge - tam.z / 2);
  movel.position.z += bordaLonge + tam.z / 2;
  pivo.add(movel);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(tam.x * 1.15, tam.z * 1.15), new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.set(0, 0.002, -bordaLonge - tam.z / 2);
  sombra.position.z = 0;
  pivo.add(sombra);
  if (op.aoCarregar) op.aoCarregar({ largura: tam.x, altura: tam.y, profundidade: tam.z });

  ancora.onTargetFound = () => { if (op.aoEncontrar) op.aoEncontrar(); };
  ancora.onTargetLost = () => { if (op.aoPerder) op.aoPerder(); };

  await mind.start();
  renderer.setAnimationLoop(() => renderer.render(scene, camera));

  // girar com o dedo (arrastar para os lados)
  let x0 = null;
  const alvoToque = op.container;
  const baixo = (e) => { x0 = e.clientX; };
  const mover = (e) => { if (x0 == null) return; giro.rotation.y += (e.clientX - x0) * 0.012; x0 = e.clientX; };
  const cima = () => { x0 = null; };
  alvoToque.addEventListener('pointerdown', baixo); alvoToque.addEventListener('pointermove', mover);
  alvoToque.addEventListener('pointerup', cima); alvoToque.addEventListener('pointercancel', cima);

  return {
    girar(graus) { giro.rotation.y += graus * Math.PI / 180; },
    parar() {
      try { renderer.setAnimationLoop(null); mind.stop(); } catch (e) { /* ok */ }
      alvoToque.removeEventListener('pointerdown', baixo); alvoToque.removeEventListener('pointermove', mover);
      alvoToque.removeEventListener('pointerup', cima); alvoToque.removeEventListener('pointercancel', cima);
      try { renderer.dispose(); } catch (e) { /* ok */ }
      op.container.innerHTML = '';
    }
  };
}
