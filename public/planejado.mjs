/* =========================================================================
   MenuReal — montador de móveis planejados
   Uma "ficha" (JSON) descreve o móvel em trechos de parede e módulos
   (portas, gavetas, nichos, eletros, ripado…). Daqui sai um GLB leve,
   com as medidas certas. A ficha pode vir de um modelo pronto, do lojista
   ou da IA que lê a planta. Medidas em cm; o arquivo sai em metros.
   normalizarFicha() não usa o navegador (o servidor também usa).
   ========================================================================= */

export const CORES = {
  branco: 'Branco', off_white: 'Off-white', cinza: 'Cinza', grafite: 'Grafite', preto: 'Preto',
  areia: 'Areia', verde: 'Verde', azul: 'Azul', rosa: 'Rosa', madeira_clara: 'Madeira clara',
  madeira_freijo: 'Madeira freijó', madeira_escura: 'Madeira escura'
};
export const TAMPOS = {
  granito_preto: 'Granito preto', quartzo_branco: 'Quartzo branco', marmore_branco: 'Mármore branco',
  quartzo_cinza: 'Quartzo cinza', madeira: 'Igual à madeira', igual_corpo: 'Igual ao corpo'
};
export const TIPOS_TRECHO = { baixo: 'Armário de baixo (com tampo)', aereo: 'Armário aéreo', alto: 'Armário alto / guarda-roupa', painel: 'Painel (TV, ripado)', bancada: 'Mesa / bancada' };
export const PAREDES = { A: 'Parede principal', B_direita: 'Parede da direita (L)', B_esquerda: 'Parede da esquerda (L)' };
export const TIPOS_MODULO = { portas: 'Portas', gavetas: 'Gavetas', nicho: 'Nicho / prateleiras', eletro: 'Eletrodoméstico', ripado: 'Ripado', tv: 'TV', vazio: 'Vão livre' };
export const FRENTES = { padrao: 'Cor das portas', madeira: 'Madeira', vidro: 'Vidro', espelho: 'Espelho' };
export const APARELHOS = { forno: 'Forno', lava_loucas: 'Lava-louças', lava_seca: 'Lava e seca', geladeira: 'Geladeira', micro_ondas: 'Micro-ondas', cooktop: 'Só cooktop (porta embaixo)' };
export const ITENS_TAMPO = { nenhum: 'Nada', cuba: 'Cuba', cuba_dupla: 'Cuba dupla', tanque: 'Tanque', cooktop: 'Cooktop' };

const PADRAO_TRECHO = {
  baixo: { altura: 90, profundidade: 60, elevacao: 0, tampo: true },
  aereo: { altura: 70, profundidade: 35, elevacao: 150, tampo: false },
  alto: { altura: 250, profundidade: 60, elevacao: 0, tampo: false },
  painel: { altura: 180, profundidade: 3, elevacao: 30, tampo: false },
  bancada: { altura: 75, profundidade: 60, elevacao: 0, tampo: true }
};

// ------------------------------------------------------------------ validação (cliente e servidor)
const num = (v, min, max, pad) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n * 10) / 10)) : pad; };
const de = (v, lista, pad) => (Object.prototype.hasOwnProperty.call(lista, v) ? v : pad);
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export function normalizarFicha(f) {
  f = f && typeof f === 'object' ? f : {};
  const a = f.acabamentos || {};
  const trechos = (Array.isArray(f.trechos) ? f.trechos : []).slice(0, 8).map((t, i) => {
    t = t || {};
    const tipo = de(t.tipo, TIPOS_TRECHO, 'baixo'), p = PADRAO_TRECHO[tipo];
    return {
      nome: txt(t.nome, 40) || TIPOS_TRECHO[tipo].split(' (')[0] + ' ' + (i + 1),
      tipo,
      parede: de(t.parede, PAREDES, 'A'),
      inicio: num(t.inicio, 0, 2000, 0),
      altura: num(t.altura, 5, 320, p.altura),
      profundidade: num(t.profundidade, 1, 120, p.profundidade),
      elevacao: num(t.elevacao, 0, 260, p.elevacao),
      tampo: t.tampo == null ? p.tampo : Boolean(t.tampo),
      ripado: Boolean(t.ripado),
      altura_ripado: num(t.altura_ripado, 5, 120, 30),
      led: Boolean(t.led),
      modulos: (Array.isArray(t.modulos) ? t.modulos : []).slice(0, 30).map((m) => {
        m = m || {};
        const tm = de(m.tipo, TIPOS_MODULO, 'portas');
        return {
          tipo: tm,
          largura: num(m.largura, 5, 400, 60),
          portas: Math.round(num(m.portas, 0, 6, tm === 'portas' ? 1 : 0)),
          gavetas: (Array.isArray(m.gavetas) ? m.gavetas : []).slice(0, 8).map((g) => num(g, 5, 100, 20)),
          prateleiras: Math.round(num(m.prateleiras, 0, 10, tm === 'nicho' ? 1 : 0)),
          frente: de(m.frente, FRENTES, 'padrao'),
          aparelho: de(m.aparelho, APARELHOS, 'forno'),
          item_tampo: de(m.item_tampo, ITENS_TAMPO, 'nenhum')
        };
      })
    };
  });
  return {
    nome: txt(f.nome, 60) || 'Móvel planejado',
    acabamentos: {
      portas: de(a.portas, CORES, 'cinza'),
      corpo: de(a.corpo, CORES, 'madeira_freijo'),
      tampo: de(a.tampo, TAMPOS, 'granito_preto')
    },
    trechos,
    observacoes: txt(f.observacoes, 1200)
  };
}

// ------------------------------------------------------------------ modelos prontos
const M = (tipo, largura, extra) => Object.assign({ tipo, largura }, extra || {});
export const MODELOS_PRONTOS = {
  cozinha_reta: { nome: 'Cozinha reta', acabamentos: { portas: 'cinza', corpo: 'madeira_freijo', tampo: 'granito_preto' }, trechos: [
    { nome: 'Balcão', tipo: 'baixo', parede: 'A', modulos: [M('portas', 80, { portas: 2, item_tampo: 'cuba' }), M('gavetas', 50, { gavetas: [16, 15, 15, 30] }), M('eletro', 70, { aparelho: 'forno', item_tampo: 'cooktop' }), M('portas', 40), M('eletro', 60, { aparelho: 'lava_loucas' }), M('portas', 80, { portas: 2 })] },
    { nome: 'Aéreo', tipo: 'aereo', parede: 'A', led: true, modulos: [M('portas', 80, { portas: 2 }), M('nicho', 50, { prateleiras: 1, frente: 'vidro' }), M('portas', 110, { portas: 2 }), M('portas', 140, { portas: 2 })] }] },
  cozinha_l: { nome: 'Cozinha em L', acabamentos: { portas: 'cinza', corpo: 'madeira_freijo', tampo: 'granito_preto' }, trechos: [
    { nome: 'Balcão principal', tipo: 'baixo', parede: 'A', modulos: [M('portas', 67, { portas: 2, item_tampo: 'tanque' }), M('eletro', 66, { aparelho: 'lava_seca' }), M('eletro', 68, { aparelho: 'forno', item_tampo: 'cooktop' }), M('portas', 22), M('gavetas', 60, { gavetas: [16, 15, 15, 30] }), M('portas', 70, { portas: 2, item_tampo: 'cuba' }), M('portas', 45)] },
    { nome: 'Balcão do canto', tipo: 'baixo', parede: 'B_direita', inicio: 60, modulos: [M('portas', 50), M('eletro', 60, { aparelho: 'lava_loucas' }), M('portas', 10)] },
    { nome: 'Aéreo', tipo: 'aereo', parede: 'A', elevacao: 145, altura: 87, ripado: true, altura_ripado: 28, led: true, modulos: [M('nicho', 80, { frente: 'vidro', prateleiras: 0 }), M('portas', 160, { portas: 3 }), M('portas', 158, { portas: 3 })] }] },
  guarda_roupa: { nome: 'Guarda-roupa', acabamentos: { portas: 'off_white', corpo: 'madeira_freijo', tampo: 'igual_corpo' }, trechos: [
    { nome: 'Guarda-roupa', tipo: 'alto', parede: 'A', altura: 260, modulos: [M('portas', 90, { portas: 2 }), M('gavetas', 60, { gavetas: [20, 20, 20, 20] }), M('portas', 90, { portas: 2, frente: 'espelho' }), M('portas', 90, { portas: 2 })] }] },
  painel_tv: { nome: 'Painel de TV com rack', acabamentos: { portas: 'grafite', corpo: 'madeira_freijo', tampo: 'igual_corpo' }, trechos: [
    { nome: 'Painel', tipo: 'painel', parede: 'A', altura: 200, elevacao: 20, modulos: [M('ripado', 50), M('tv', 145), M('ripado', 50)] },
    { nome: 'Rack suspenso', tipo: 'baixo', parede: 'A', altura: 40, profundidade: 45, elevacao: 25, tampo: false, led: true, modulos: [M('gavetas', 60, { gavetas: [20, 20] }), M('nicho', 125, { prateleiras: 0 }), M('portas', 60)] }] },
  banheiro: { nome: 'Gabinete de banheiro', acabamentos: { portas: 'madeira_freijo', corpo: 'madeira_freijo', tampo: 'quartzo_branco' }, trechos: [
    { nome: 'Gabinete suspenso', tipo: 'baixo', parede: 'A', altura: 55, profundidade: 50, elevacao: 30, modulos: [M('gavetas', 60, { gavetas: [25, 25], item_tampo: 'cuba' }), M('nicho', 30, { prateleiras: 1 })] },
    { nome: 'Espelheira', tipo: 'aereo', parede: 'A', altura: 70, profundidade: 14, elevacao: 115, led: true, modulos: [M('portas', 60, { frente: 'espelho' }), M('nicho', 30, { prateleiras: 2 })] }] },
  escritorio: { nome: 'Escritório', acabamentos: { portas: 'branco', corpo: 'madeira_clara', tampo: 'madeira' }, trechos: [
    { nome: 'Mesa', tipo: 'bancada', parede: 'A', modulos: [M('gavetas', 45, { gavetas: [15, 15, 30] }), M('vazio', 120), M('portas', 45)] },
    { nome: 'Prateleiras', tipo: 'aereo', parede: 'A', elevacao: 160, altura: 40, profundidade: 30, modulos: [M('nicho', 105, { prateleiras: 0 }), M('portas', 105, { portas: 2 })] }] }
};
export const NOMES_MODELOS = { cozinha_reta: 'Cozinha reta', cozinha_l: 'Cozinha em L', guarda_roupa: 'Guarda-roupa', painel_tv: 'Painel de TV', banheiro: 'Banheiro', escritorio: 'Escritório' };

// ------------------------------------------------------------------ medidas da ficha
export function comprimentoTrecho(t) { return t.modulos.reduce((s, m) => s + m.largura, 0); }

// ------------------------------------------------------------------ geometria
// comPecas = true: cada peça (porta, gaveta, lateral, prateleira…) fica separada, para o Raio-X.
// O interior deixa de ser um bloco escuro e vira a caixa de verdade (laterais, fundo, caixa da gaveta).
function criarGeo(comPecas) {
  const mats = new Map(); let T = { ang: 0, tx: 0, tz: 0 };
  const pecas = []; let peca = null;
  function g(mat) {
    let alvo = mats;
    if (comPecas) { if (!peca) novaPeca({ nome: 'Estrutura', tipo: 'estrutura' }); alvo = peca.mats; }
    if (!alvo.has(mat)) alvo.set(mat, { pos: [], nor: [], uv: [], idx: [] });
    return alvo.get(mat);
  }
  function novaPeca(info) { if (!comPecas) return; peca = Object.assign({ mats: new Map() }, info); pecas.push(peca); }
  function tp(x, y, z) { // aplica giro (graus, em torno do eixo vertical) + translação
    const a = T.ang * Math.PI / 180, c = Math.round(Math.cos(a) * 1e6) / 1e6, s = Math.round(Math.sin(a) * 1e6) / 1e6;
    return [c * x + s * z + T.tx, y, -s * x + c * z + T.tz];
  }
  function tn(x, y, z) { const a = T.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [c * x + s * z, y, -s * x + c * z]; }
  function quad(mat, p, n, uvs) {
    const G = g(mat), b = G.pos.length / 3;
    p.forEach((q, i) => { const w = tp(q[0], q[1], q[2]); G.pos.push(w[0], w[1], w[2]); const nn = tn(n[0], n[1], n[2]); G.nor.push(nn[0], nn[1], nn[2]); G.uv.push(uvs[i][0], uvs[i][1]); });
    G.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  // caixa em cm; uv em metros (texturas repetem a cada ~60 cm)
  function caixa(mat, x0, x1, y0, y1, z0, z1) {
    if (!(x1 > x0 && y1 > y0 && z1 > z0)) return;
    const k = 1 / 60;
    quad(mat, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0 * k, y0 * k], [x1 * k, y0 * k], [x1 * k, y1 * k], [x0 * k, y1 * k]]);
    quad(mat, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[x1 * k, y0 * k], [x0 * k, y0 * k], [x0 * k, y1 * k], [x1 * k, y1 * k]]);
    quad(mat, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[z1 * k, y0 * k], [z0 * k, y0 * k], [z0 * k, y1 * k], [z1 * k, y1 * k]]);
    quad(mat, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0 * k, y0 * k], [z1 * k, y0 * k], [z1 * k, y1 * k], [z0 * k, y1 * k]]);
    quad(mat, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0 * k, z1 * k], [x1 * k, z1 * k], [x1 * k, z0 * k], [x0 * k, z0 * k]]);
    quad(mat, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0 * k, z0 * k], [x1 * k, z0 * k], [x1 * k, z1 * k], [x0 * k, z1 * k]]);
  }
  // cilindro: eixo 'y' (em pé) ou 'z' (de frente)
  function cilindro(mat, r, h, cx, cy, cz, eixo, seg) {
    seg = seg || 28;
    const P = (ang, t) => { const u = Math.cos(ang) * r, v = Math.sin(ang) * r; return eixo === 'z' ? [cx + u, cy + v, cz + t] : eixo === 'x' ? [cx + t, cy + u, cz + v] : [cx + u, cy + t, cz + v]; };
    const N = (ang) => { const u = Math.cos(ang), v = Math.sin(ang); return eixo === 'z' ? [u, v, 0] : eixo === 'x' ? [0, u, v] : [u, 0, v]; };
    const E = eixo === 'z' ? [0, 0, 1] : eixo === 'x' ? [1, 0, 0] : [0, 1, 0];
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, n = N((a0 + a1) / 2);
      quad(mat, [P(a0, -h / 2), P(a1, -h / 2), P(a1, h / 2), P(a0, h / 2)].reverse().reverse(), n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      const G = g(mat);
      [[h / 2, 1], [-h / 2, -1]].forEach(([t, sg]) => {   // tampas
        const b = G.pos.length / 3, c = eixo === 'z' ? [cx, cy, cz + t] : eixo === 'x' ? [cx + t, cy, cz] : [cx, cy + t, cz];
        [c, P(a0, t), P(a1, t)].forEach((q) => { const w = tp(q[0], q[1], q[2]); G.pos.push(w[0], w[1], w[2]); const nn = tn(E[0] * sg, E[1] * sg, E[2] * sg); G.nor.push(nn[0], nn[1], nn[2]); G.uv.push(0.5, 0.5); });
        G.idx.push(b, b + 1, b + 2);
      });
    }
  }
  return { mats, caixa, cilindro, set: (t) => { T = t; }, tp, tn, pecas, detalhe: !!comPecas,
    // peca(info): o que vier depois pertence a esta peça (só no modo com peças)
    peca: (info) => {
      if (!comPecas) return;
      if (info.chave) { const ex = pecas.find((x) => x.chave === info.chave); if (ex) { peca = ex; return; } }
      info.explode = info.explode ? tn(...info.explode) : [0, 0, 0]; if (info.pivo) info.pivo = tp(...info.pivo); if (info.desliza) info.desliza = tn(...info.desliza); novaPeca(info); } };
}

// lados das faces: a geometria usa a regra da mão direita; as tampas do cilindro são dupla face no material
function corrigirOrientacao(G) {
  // garante que cada triângulo aponta para o lado da sua normal (os materiais ainda são dupla face por segurança)
  const todos = [...G.mats.values(), ...G.pecas.flatMap((pc) => [...pc.mats.values()])];
  for (const m of todos) {
    const p = m.pos, n = m.nor, ix = m.idx;
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
      if (cx * n[a] + cy * n[a + 1] + cz * n[a + 2] < 0) { const k = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = k; }
    }
  }
}

// ------------------------------------------------------------------ montagem dos trechos
const RODAPE = 10, FOLGA = 0.4, TAMPO = 3;

function montarTrecho(G, t, fic, ti) {
  const P = t.profundidade, E = t.elevacao, H = t.altura;
  const temTampo = t.tampo && (t.tipo === 'baixo' || t.tipo === 'bancada');
  const comRodape = (t.tipo === 'baixo' || t.tipo === 'alto') && E === 0;
  const y0 = E + (comRodape ? (t.tipo === 'alto' ? 5 : RODAPE) : 0);
  const yTopo = E + H - (temTampo ? TAMPO : 0);
  const zf0 = P - 1.8, zf1 = P;
  const furos = [];
  const C = G.caixa, CIL = G.cilindro;
  const D = G.detalhe, PC = G.peca;   // D: modo com peças (Raio-X)
  const inv = t.parede === 'B_esquerda';
  let s = t.inicio;
  const faixas = [];   // [a, b] em x local de cada módulo
  for (const m of t.modulos) {
    const a = inv ? -(s + m.largura) : s, b = inv ? -s : s + m.largura;
    faixas.push([a, b, m]); s += m.largura;
  }
  if (!faixas.length) return;
  const xmin = Math.min(...faixas.map((f) => f[0])), xmax = Math.max(...faixas.map((f) => f[1]));
  const frenteMat = (m) => (m.frente === 'madeira' ? 'corpo' : m.frente === 'vidro' ? 'vidro' : m.frente === 'espelho' ? 'espelho' : 'portas');
  const nomeT = t.nome || TIPOS_TRECHO[t.tipo].split(' (')[0];
  const meioT = (xmin + xmax) / 2, largT = Math.max(1, xmax - xmin);
  const abre = (a, b) => ((a + b) / 2 - meioT) / largT * 1.2;   // na vista explodida os módulos se afastam um pouco

  function porta(mat, a, b, ya, yb) {
    if (mat === 'vidro') {   // vidro com moldura de alumínio
      C('perfil', a + FOLGA, b - FOLGA, ya, yb, zf0, zf1 - 0.4);
      C('vidro', a + 2.2, b - 2.2, ya + 2.2, yb - 2.2, zf1 - 0.5, zf1 - 0.1);
      if (!D) C('interno', a + 2.2, b - 2.2, ya + 2.2, yb - 2.2, zf0 - 0.2, zf0);
      return;
    }
    C(mat, a + FOLGA, b - FOLGA, ya + FOLGA, yb - FOLGA, zf0, zf1);
  }
  // porta de abrir: a dobradiça fica do lado oposto ao puxador
  function pecaPorta(nome, a, b, esq, grupo, sx, mat) {
    PC({ nome, tipo: 'porta', grupo, mat, pivo: [esq ? a + FOLGA : b - FOLGA, 0, zf1], giro: esq ? -1 : 1, dobradica: esq ? 'esquerda' : 'direita', explode: [sx, 0, 1.2] });
  }
  function puxadorCava(a, b, y) { C('perfil', a + FOLGA, b - FOLGA, y - 3, y - 0.4, zf0 - 2.6, zf0 - 2.2); }
  function puxadorVertical(x, ya, yb) { C('perfil', x - 0.8, x + 0.8, ya, yb, zf1, zf1 + 1.6); }

  // ----- painel (ripado / TV)
  if (t.tipo === 'painel') {
    PC({ nome: 'Painel', tipo: 'painel', grupo: nomeT, mat: 'corpo', explode: [0, 0, -0.6] });
    C('corpo', xmin, xmax, E, E + H, 0, 1.8);
    faixas.forEach(([a, b, m], i) => {
      const grupo = nomeT + ' · módulo ' + (i + 1), sx = abre(a, b);
      if (m.tipo === 'ripado') {
        PC({ nome: 'Ripado', tipo: 'painel', grupo, mat: 'corpo', explode: [sx, 0, 0.5] });
        for (let x = a + 0.9; x + 2.2 <= b; x += 4) C('corpo', x, x + 2.2, E, E + H, 1.8, 4.8);
      } else if (m.tipo === 'tv') {
        const w = Math.min(m.largura - 4, 200), h = w * 0.5625, cx = (a + b) / 2, yc = E + H * 0.5;
        PC({ nome: 'TV', tipo: 'eletro', grupo, mat: 'preto', explode: [sx, 0, 1.4] });
        C('preto', cx - w / 2, cx + w / 2, yc - h / 2, yc + h / 2, 4, 7);
        C('tela', cx - w / 2 + 0.8, cx + w / 2 - 0.8, yc - h / 2 + 0.8, yc + h / 2 - 0.8, 7, 7.15);
      } else if (m.tipo === 'nicho') {
        const n = Math.max(1, m.prateleiras);
        for (let k = 1; k <= n; k++) { PC({ nome: 'Prateleira', tipo: 'prateleira', grupo, mat: 'corpo', explode: [sx, 0, 0.9] }); C('corpo', a, b, E + H * k / (n + 1) - 1, E + H * k / (n + 1) + 1, 1.8, 26); }
      }
    });
    if (t.led) { PC({ nome: 'Iluminação LED', tipo: 'led', grupo: nomeT, mat: 'led', explode: [0, 0.4, 0.4] }); C('led', xmin, xmax, E + H - 1, E + H - 0.4, 5, 5.6); }
    return;
  }

  // ----- corpo de cada módulo
  faixas.forEach(([a, b, m], i) => {
    const w = b - a, grupo = nomeT + ' · módulo ' + (i + 1), sx = abre(a, b);
    if (m.tipo === 'vazio') return;
    if (m.tipo === 'eletro' && m.aparelho === 'geladeira') {
      const hG = Math.min(190, Math.max(150, (t.tipo === 'alto' ? H - 10 : 185)));
      PC({ nome: 'Geladeira', tipo: 'eletro', grupo, mat: 'inox', explode: [sx, 0, 1.4] });
      C('inox', a + 1, b - 1, 0, hG, 2, zf1 - 2);
      C('inox_esc', a + 1.2, b - 1.2, hG * 0.62, hG * 0.62 + 0.4, zf1 - 2, zf1 - 1.9);
      C('cromado', b - 6, b - 4.5, hG * 0.66, hG * 0.95, zf1, zf1 + 2.5); C('cromado', b - 6, b - 4.5, hG * 0.3, hG * 0.58, zf1, zf1 + 2.5);
      if (t.tipo === 'alto') { PC({ nome: 'Caixa sobre a geladeira', tipo: 'estrutura', grupo, mat: 'corpo', explode: [sx, 0.9, 0] }); C('corpo', a, b, hG + 1, E + H, 0, zf1); }
      furos.push({ a, b, todo: true });
      return;
    }
    if (m.tipo === 'ripado' || m.tipo === 'tv') { PC({ nome: m.tipo === 'tv' ? 'Painel da TV' : 'Painel ripado', tipo: 'painel', grupo, mat: 'corpo', explode: [sx, 0, -0.6] }); C('corpo', a, b, y0, yTopo, 0, 1.8); return; }
    // caixa e rodapé
    if (comRodape) { PC({ nome: 'Rodapé', tipo: 'rodape', chave: 'rodape' + ti, grupo: nomeT, mat: 'rodape', explode: [0, -0.2, 0.7] }); C('rodape', a, b, E, y0, 0, P - 6); }
    const temCuba = temTampo && /cuba|tanque/.test(m.item_tampo);
    const topoInterno = temCuba ? yTopo - (m.item_tampo === 'tanque' ? 31 : 21) : yTopo - 1.8;   // deixa espaço para a cuba
    if (m.tipo !== 'nicho' && !D) C('interno', a + 0.1, b - 0.1, y0 + 1.8, topoInterno, 0.1, zf0 - 0.1);
    if (m.tipo !== 'nicho') {
      if (!temTampo) { PC({ nome: 'Topo', tipo: 'estrutura', grupo, mat: 'corpo', explode: [sx, 0.9, 0] }); C('corpo', a, b, yTopo - 1.8, yTopo, 0, zf0); }   // topo (com tampo, o tampo cobre)
      PC({ nome: 'Base', tipo: 'estrutura', grupo, mat: 'corpo', explode: [sx, -0.35, 0] });
      C('corpo', a, b, y0, y0 + 1.8, 0, zf0);         // base
      if (D) {   // a caixa de verdade: laterais e fundo
        const yl = temTampo ? yTopo : yTopo - 1.8;
        PC({ nome: a <= xmin + 0.01 ? 'Lateral esquerda' : 'Divisória', tipo: a <= xmin + 0.01 ? 'lateral' : 'divisoria', grupo, mat: 'corpo', explode: [sx - 1, 0, 0] });
        C('corpo', a, a + 1.8, y0 + 1.8, yl, 0, zf0);
        PC({ nome: b >= xmax - 0.01 ? 'Lateral direita' : 'Divisória', tipo: b >= xmax - 0.01 ? 'lateral' : 'divisoria', grupo, mat: 'corpo', explode: [sx + 1, 0, 0] });
        C('corpo', b - 1.8, b, y0 + 1.8, yl, 0, zf0);
        PC({ nome: 'Fundo', tipo: 'fundo', grupo, mat: 'corpo', explode: [sx, 0, -1] });
        C('corpo', a + 1.8, b - 1.8, y0 + 1.8, yl, 0, 0.6);
      }
    }
    const yt = yTopo - (t.tipo === 'baixo' && temTampo ? 3.4 : 0);   // espaço do puxador cava
    const cava = t.tipo === 'baixo' && temTampo;
    const gola = () => PC({ nome: 'Perfil puxador (gola)', tipo: 'puxador', chave: 'gola' + ti + ':' + i, grupo, mat: 'perfil', explode: [sx, 0, 0.6] });
    if (cava) { gola(); puxadorCava(a, b, yTopo); }
    // prateleiras internas: só as que o projeto tem
    const prateleiras = (yb, n) => {
      if (!D || !n) return;
      for (let k = 1; k <= n; k++) {
        const yy = y0 + 1.8 + (yb - y0 - 1.8) * k / (n + 1);
        PC({ nome: 'Prateleira', tipo: 'prateleira', grupo, mat: 'corpo', explode: [sx, 0, 0.8] });
        C('corpo', a + 1.8, b - 1.8, yy - 0.9, yy + 0.9, 0.6, zf0 - 1.5);
      }
    };

    if (m.tipo === 'portas') {
      const n = Math.max(1, m.portas || 1), fm = frenteMat(m);
      const maleiro = t.tipo === 'alto' && H >= 200 ? 45 : 0;
      for (let k = 0; k < n; k++) {
        const pa = a + w * k / n, pb = a + w * (k + 1) / n;
        pecaPorta(n > 1 ? 'Porta ' + (k + 1) : 'Porta', pa, pb, k % 2 === 0, grupo, sx, fm);
        porta(fm, pa, pb, y0, yt - maleiro);
        if (t.tipo === 'alto') puxadorVertical(k % 2 ? pa + 4 : pb - 4, y0 + (yt - y0 - maleiro) * 0.35, y0 + (yt - y0 - maleiro) * 0.62);
        if (maleiro) { pecaPorta('Porta do maleiro', pa, pb, k % 2 === 0, grupo, sx, fm === 'espelho' ? 'portas' : fm); porta(fm === 'espelho' ? 'portas' : fm, pa, pb, yt - maleiro, yt); }
      }
      if (D && maleiro) { PC({ nome: 'Divisão do maleiro', tipo: 'divisoria', grupo, mat: 'corpo', explode: [sx, 0.35, 0.5] }); C('corpo', a + 1.8, b - 1.8, yt - maleiro - 0.9, yt - maleiro + 0.9, 0.6, zf0 - 0.5); }
      prateleiras((temTampo ? yTopo : yTopo - 1.8) - maleiro, m.prateleiras);
    } else if (m.tipo === 'gavetas') {
      let gav = m.gavetas.length ? m.gavetas : [20, 20, 20];
      const hDisp = t.tipo === 'alto' ? Math.min(yt - y0, gav.reduce((x, v) => x + v, 0)) : yt - y0;
      const esc = hDisp / gav.reduce((x, v) => x + v, 0);
      const fundoCx = Math.min(55, zf0 - 4), curso = Math.round(fundoCx * 0.75);
      let y = y0 + hDisp, g = 0;
      for (const hg of gav) {
        const ya = y - hg * esc, mov = 'gaveta:' + ti + ':' + i + ':' + (g++);
        PC({ nome: 'Gaveta' + (gav.length > 1 ? ' ' + g : ''), tipo: 'gaveta', grupo, mat: frenteMat(m), mov, desliza: [0, 0, curso], explode: [sx, 0, 1.6] });
        porta(frenteMat(m), a, b, ya, y);
        if (t.tipo !== 'baixo') C('perfil', (a + b) / 2 - 8, (a + b) / 2 + 8, y - 3.5, y - 2.3, zf1, zf1 + 1.4);
        if (D) {   // caixa da gaveta (corre junto com a frente)
          const bx0 = a + 3, bx1 = b - 3, by0 = ya + 2.5, by1 = Math.max(by0 + 6, y - 4.5), bz0 = zf0 - 0.2 - fundoCx, bz1 = zf0 - 0.2;
          PC({ nome: 'Caixa da gaveta' + (gav.length > 1 ? ' ' + g : ''), tipo: 'gaveta', grupo, mat: 'corpo', mov, desliza: [0, 0, curso], explode: [sx, 0, 1.6] });
          C('corpo', bx0, bx0 + 1.5, by0, by1, bz0, bz1); C('corpo', bx1 - 1.5, bx1, by0, by1, bz0, bz1);
          C('corpo', bx0 + 1.5, bx1 - 1.5, by0, by1, bz0, bz0 + 1.5); C('corpo', bx0 + 1.5, bx1 - 1.5, by0, by1, bz1 - 1.5, bz1);
          C('corpo', bx0 + 1.5, bx1 - 1.5, by0, by0 + 0.6, bz0 + 1.5, bz1 - 1.5);
        }
        if (!cava || y < yt - 1) { gola(); C('perfil', a + FOLGA, b - FOLGA, y - 2.6, y - FOLGA, zf0 - 2.6, zf0 - 2.2); }
        y = ya;
      }
      if (t.tipo === 'alto' && y0 + hDisp < yt - 1) {   // portas acima das gavetas
        const maleiro = H >= 200 ? 45 : 0;
        pecaPorta('Porta', a, b, true, grupo, sx, 'portas');
        porta('portas', a, b, y0 + hDisp, yt - maleiro);
        puxadorVertical(b - 4, y0 + hDisp + 30, y0 + hDisp + 80);
        if (maleiro) { pecaPorta('Porta do maleiro', a, b, true, grupo, sx, 'portas'); porta('portas', a, b, yt - maleiro, yt); }
        if (D) { PC({ nome: 'Divisão das gavetas', tipo: 'divisoria', grupo, mat: 'corpo', explode: [sx, 0, 0.5] }); C('corpo', a + 1.8, b - 1.8, y0 + hDisp, y0 + hDisp + 1.8, 0.6, zf0 - 0.5); }
        if (D && maleiro) { PC({ nome: 'Divisão do maleiro', tipo: 'divisoria', grupo, mat: 'corpo', explode: [sx, 0.35, 0.5] }); C('corpo', a + 1.8, b - 1.8, yt - maleiro - 0.9, yt - maleiro + 0.9, 0.6, zf0 - 0.5); }
      }
    } else if (m.tipo === 'nicho') {
      PC({ nome: 'Lateral do nicho', tipo: a <= xmin + 0.01 ? 'lateral' : 'divisoria', grupo, mat: 'corpo', explode: [sx - 1, 0, 0] }); C('corpo', a, a + 1.8, y0, yTopo, 0, zf1);
      PC({ nome: 'Lateral do nicho', tipo: b >= xmax - 0.01 ? 'lateral' : 'divisoria', grupo, mat: 'corpo', explode: [sx + 1, 0, 0] }); C('corpo', b - 1.8, b, y0, yTopo, 0, zf1);
      PC({ nome: 'Base do nicho', tipo: 'estrutura', grupo, mat: 'corpo', explode: [sx, -0.35, 0] }); C('corpo', a, b, y0, y0 + 1.8, 0, zf1);
      PC({ nome: 'Topo do nicho', tipo: 'estrutura', grupo, mat: 'corpo', explode: [sx, 0.9, 0] }); C('corpo', a, b, yTopo - 1.8, yTopo, 0, zf1);
      PC({ nome: 'Fundo do nicho', tipo: 'fundo', grupo, mat: 'corpo', explode: [sx, 0, -1] }); C('corpo', a, b, y0, yTopo, 0, 1.5);
      const n = m.prateleiras;
      for (let k = 1; k <= n; k++) { const yy = y0 + (yTopo - y0) * k / (n + 1); PC({ nome: 'Prateleira', tipo: 'prateleira', grupo, mat: 'corpo', explode: [sx, 0, 0.8] }); C('corpo', a + 1.8, b - 1.8, yy - 0.9, yy + 0.9, 1.5, zf1 - 1); }
      if (m.frente === 'vidro' || m.frente === 'espelho') { pecaPorta(m.frente === 'vidro' ? 'Porta de vidro' : 'Porta de espelho', a, b, true, grupo, sx, m.frente); porta(m.frente, a, b, y0, yTopo); }
    } else if (m.tipo === 'eletro') {
      eletro(G, m.aparelho, a, b, y0, yt, zf0, zf1, E, comRodape, { grupo, sx, porta: (nome) => pecaPorta(nome, a, b, true, grupo, sx, 'portas') });
    }
  });

  // ----- tampo com recortes
  if (temTampo) {
    const ytA = E + H - TAMPO, ytB = E + H, zt = P + 1;
    for (const [a, b, m] of faixas) {
      if (m.item_tampo === 'nenhum' && !(m.tipo === 'eletro' && m.aparelho === 'cooktop')) continue;
      const it = m.tipo === 'eletro' && m.aparelho === 'cooktop' ? 'cooktop' : m.item_tampo;
      const cx = (a + b) / 2, cz = P / 2 + 0.5;
      if (it === 'cooktop') {
        const w = Math.min(85, Math.max(58, b - a + 20)), p = Math.min(50, P - 12);
        furos.push({ a: cx - w / 2, b: cx + w / 2, za: cz - p / 2, zb: cz + p / 2 });
        PC({ nome: 'Cooktop', tipo: 'acessorio', grupo: nomeT, mat: 'cooktop', explode: [abre(a, b), 2.6, 0] });
        cooktop(G, cx, cz, w, p, ytB);
      } else {
        const dupla = it === 'cuba_dupla', tq = it === 'tanque';
        const w = Math.max(28, Math.min(dupla ? 80 : tq ? 50 : 60, b - a - 8)), p = Math.min(tq ? 42 : 40, P - 18);
        PC({ nome: tq ? 'Tanque' : dupla ? 'Cuba dupla' : 'Cuba', tipo: 'acessorio', grupo: nomeT, mat: 'inox', explode: [abre(a, b), 2.6, 0] });
        if (dupla) {
          [cx - w / 4, cx + w / 4].forEach((c) => { furos.push({ a: c - w / 4 + 1, b: c + w / 4 - 1, za: cz - p / 2, zb: cz + p / 2 }); cuba(G, c, cz, w / 2 - 2, p, tq ? 30 : 20, ytB, c === cx - w / 4); });
        } else {
          furos.push({ a: cx - w / 2, b: cx + w / 2, za: cz - p / 2, zb: cz + p / 2 });
          cuba(G, cx, cz, w, p, tq ? 30 : 20, ytB, true);
        }
      }
    }
    // tampo dividido em faixas para deixar os furos (e não cobrir a geladeira)
    const cortes = [xmin, xmax];
    furos.forEach((f) => cortes.push(f.a, f.b));
    const xs = [...new Set(cortes.map((v) => Math.round(v * 100) / 100))].sort((p, q) => p - q);
    const tampoMat = fic.acabamentos.tampo === 'igual_corpo' ? 'corpo' : 'tampo';
    PC({ nome: 'Tampo', tipo: 'tampo', grupo: nomeT, mat: tampoMat, explode: [0, 1.5, 0] });
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i], xb = xs[i + 1], meio = (xa + xb) / 2;
      if (meio < xmin || meio > xmax) continue;
      const fx = furos.filter((f) => meio > f.a && meio < f.b);
      if (fx.some((f) => f.todo)) continue;
      let zs = [0, zt];
      fx.forEach((f) => zs.push(f.za, f.zb));
      zs = [...new Set(zs)].sort((p, q) => p - q);
      for (let j = 0; j < zs.length - 1; j++) {
        const zm = (zs[j] + zs[j + 1]) / 2;
        if (fx.some((f) => zm > f.za && zm < f.zb)) continue;
        C(tampoMat, xa, xb, ytA, ytB, zs[j], zs[j + 1]);
      }
    }
    if (t.tipo === 'baixo' && E === 0) C(tampoMat, xmin, xmax, ytB, ytB + 7, 0, 2);   // rodabanca
    if (t.tipo === 'bancada') {   // pés/painéis nas pontas quando não há módulo
      const [fa] = faixas, fb = faixas[faixas.length - 1];
      if (fa[2].tipo === 'vazio') { PC({ nome: 'Pé da bancada', tipo: 'estrutura', grupo: nomeT, mat: 'corpo', explode: [-1.2, 0, 0] }); C('corpo', fa[0], fa[0] + 2.5, 0, ytA, 0, zt); }
      if (fb[2].tipo === 'vazio') { PC({ nome: 'Pé da bancada', tipo: 'estrutura', grupo: nomeT, mat: 'corpo', explode: [1.2, 0, 0] }); C('corpo', fb[1] - 2.5, fb[1], 0, ytA, 0, zt); }
    }
  }

  // ----- aéreo/alto: LED e ripado em cima
  const led = () => PC({ nome: 'Iluminação LED', tipo: 'led', chave: 'led' + ti, grupo: nomeT, mat: 'led', explode: [0, -0.5, 0.3] });
  if (t.led && t.tipo !== 'baixo') { led(); C('led', xmin + 2, xmax - 2, E - 0.5, E, P - 6, P - 4); }
  if (t.led && t.tipo === 'baixo' && !temTampo) { led(); C('led', xmin + 2, xmax - 2, E - 0.5, E, P - 8, P - 6); }
  if (t.ripado) {
    const yr0 = E + H, yr1 = yr0 + t.altura_ripado;
    PC({ nome: 'Ripado', tipo: 'painel', grupo: nomeT, mat: 'corpo', explode: [0, 1, -0.3] });
    C('corpo', xmin, xmax, yr0, yr1, 0, 1.5);
    for (let x = xmin + 0.9; x + 2.2 <= xmax; x += 4) C('corpo', x, x + 2.2, yr0, yr1, 1.5, 4.5);
    if (t.led) { led(); C('led', xmin, xmax, yr0 + 0.2, yr0 + 0.8, 4.6, 5); }
  }
  // laterais de acabamento nas pontas do trecho (madeira)
  const acab = (lado) => PC({ nome: 'Lateral de acabamento', tipo: 'lateral', grupo: nomeT, mat: 'corpo', explode: [lado * 1.6, 0, 0] });
  if (t.tipo === 'aereo' || t.tipo === 'alto') { acab(-1); C('corpo', xmin - 1.8, xmin, E, E + H, 0, P); acab(1); C('corpo', xmax, xmax + 1.8, E, E + H, 0, P); }
  if (t.tipo === 'baixo') {   // laterais de acabamento (fecham as pontas do balcão)
    const yl = temTampo ? E + H - TAMPO : E + H;
    acab(-1); C('corpo', xmin - 0.01, xmin + 1.8, E, yl, 0, P); acab(1); C('corpo', xmax - 1.8, xmax + 0.01, E, yl, 0, P);
  }
}

function eletro(G, ap, a, b, y0, yt, zf0, zf1, E, comRodape, ctx) {
  const C = G.caixa, CIL = G.cilindro, w = b - a, cx = (a + b) / 2, PC = G.peca;
  const ap1 = (nome, mat) => PC({ nome, tipo: 'eletro', grupo: ctx.grupo, mat, explode: [ctx.sx, 0, 1.4] });
  const frente = () => PC({ nome: 'Frente', tipo: 'frente', grupo: ctx.grupo, mat: 'portas', explode: [ctx.sx, 0, 1.2] });
  if (ap === 'lava_loucas') {
    ap1('Lava-louças', 'preto');
    C('preto', a + FOLGA, b - FOLGA, y0, yt, zf0 - 0.5, zf1 + 0.3);
    C('cromado', a + 6, b - 6, yt - 6, yt - 4.6, zf1 + 1.8, zf1 + 3.2);
    C('cromado', a + 8, a + 9.4, yt - 6, yt - 4.6, zf1 + 0.3, zf1 + 1.8); C('cromado', b - 9.4, b - 8, yt - 6, yt - 4.6, zf1 + 0.3, zf1 + 1.8);
  } else if (ap === 'lava_seca') {
    const L = Math.min(60, w - 2), la = cx - L / 2, lb = cx + L / 2, h = Math.min(85, yt - E + 3);
    ap1('Lava e seca', 'eletro');
    C('eletro', la, lb, E + 2, E + h, 2, zf1 - 0.5);
    C('eletro', la + 1, lb - 1, E + h - 12, E + h - 1, zf1 - 0.5, zf1);
    C('vidro_esc', la + 30, lb - 6, E + h - 9, E + h - 4, zf1, zf1 + 0.2);
    CIL('cromado', 1.6, 1.2, la + 14, E + h - 6.5, zf1 + 0.4, 'z');
    CIL('cromado', 21, 2, cx, E + 45, zf1 + 0.8, 'z', 40);
    CIL('vidro_esc', 17, 2.4, cx, E + 45, zf1 + 1, 'z', 40);
    if (la - a > 1) { frente(); C('portas', a + FOLGA, la, y0, yt, zf0, zf1); }
    if (b - lb > 1) { frente(); C('portas', lb, b - FOLGA, y0, yt, zf0, zf1); }
  } else if (ap === 'forno') {
    const hF = 58, yfb = Math.max(y0 + 12, yt - hF);
    if (yfb - y0 > 6) { frente(); C('portas', a + FOLGA, b - FOLGA, y0 + FOLGA, yfb - FOLGA, zf0, zf1); }
    ap1('Forno', 'preto');
    C('preto', a + 1.5, b - 1.5, yfb, yt, zf0 - 0.5, zf1 + 0.4);
    C('vidro_esc', a + 8, b - 8, yfb + 4, yt - 16, zf1 + 0.4, zf1 + 0.6);
    C('cromado', a + 10, b - 10, yt - 13, yt - 11.5, zf1 + 1.6, zf1 + 3);
    for (let k = 0; k < 4; k++) CIL('cromado', 1.5, 1.2, a + 14 + k * ((w - 28) / 3), yt - 5, zf1 + 1, 'z', 16);
  } else if (ap === 'micro_ondas') {
    const h = Math.min(30, yt - y0), ya = (y0 + yt) / 2 - h / 2;
    ap1('Micro-ondas', 'preto');
    C('preto', a + 1, b - 1, ya, ya + h, zf0 - 30, zf1 + 0.3);
    C('vidro_esc', a + 4, b - 16, ya + 4, ya + h - 4, zf1 + 0.3, zf1 + 0.5);
    C('cromado', b - 12, b - 10.6, ya + 5, ya + h - 5, zf1 + 0.3, zf1 + 2);
    frente(); C('portas', a + FOLGA, b - FOLGA, y0, ya - FOLGA, zf0, zf1);
    frente(); C('portas', a + FOLGA, b - FOLGA, ya + h + FOLGA, yt, zf0, zf1);
  } else { // cooktop: porta embaixo
    ctx.porta('Porta');
    C('portas', a + FOLGA, b - FOLGA, y0 + FOLGA, yt - FOLGA, zf0, zf1);
  }
}

const QUEIMA = [[0.5, 0.2, 4.5], [0.24, 0.47, 4], [0.76, 0.47, 4], [0.24, 0.75, 3], [0.76, 0.75, 6]];
function cooktop(G, cx, cz, w, p, yt) {
  const C = G.caixa, CIL = G.cilindro, a = cx - w / 2, za = cz - p / 2;
  C('cooktop', a, a + w, yt, yt + 0.6, za, za + p);
  const y = yt + 0.6;
  for (const [fx, fz, r] of QUEIMA) {
    const x = a + fx * w, z = za + (1 - fz) * p;
    CIL('ferro', r + 1, 0.8, x, y + 0.4, z, 'y'); CIL('inox', r, 1.4, x, y + 0.9, z, 'y'); CIL('ferro', r * 0.55, 1.6, x, y + 1.2, z, 'y');
  }
  const yg = y + 2.6;
  for (const [g0, g1] of [[a + 2, cx - 0.5], [cx + 0.5, a + w - 2]]) {
    for (const zz of [za + 2, za + p - 2]) C('ferro', g0, g1, yg, yg + 1, zz - 0.5, zz + 0.5);
    for (const xx of [g0, g1]) C('ferro', xx - 0.5, xx + 0.5, yg, yg + 1, za + 2, za + p - 2);
    for (let k = 1; k < 4; k++) { const xx = g0 + (g1 - g0) * k / 4; C('ferro', xx - 0.4, xx + 0.4, yg, yg + 0.9, za + 2, za + p - 2); }
    for (const zz of [za + p / 3, za + 2 * p / 3]) C('ferro', g0, g1, yg, yg + 0.9, zz - 0.4, zz + 0.4);
    for (const xx of [g0 + 1, g1 - 1]) for (const zz of [za + 3, za + p - 3]) C('ferro', xx - 0.6, xx + 0.6, y, yg, zz - 0.6, zz + 0.6);
  }
  for (let k = 0; k < 5; k++) CIL('cromado', 1.3, 1.6, a + w / 2 - 18 + k * 9, y + 0.8, za + p - 3.2, 'y', 16);
}

function cuba(G, cx, cz, w, p, fundo, yt, comTorneira) {
  const C = G.caixa, CIL = G.cilindro, a = cx - w / 2, b = cx + w / 2, za = cz - p / 2, zb = cz + p / 2, e = 0.8;
  C('inox', a, b, yt - fundo, yt - fundo + e, za, zb);
  C('inox', a, a + e, yt - fundo, yt, za, zb); C('inox', b - e, b, yt - fundo, yt, za, zb);
  C('inox', a, b, yt - fundo, yt, za, za + e); C('inox', a, b, yt - fundo, yt, zb - e, zb);
  C('inox', a - 1.2, b + 1.2, yt, yt + 0.25, za - 1.2, za); C('inox', a - 1.2, b + 1.2, yt, yt + 0.25, zb, zb + 1.2);
  C('inox', a - 1.2, a, yt, yt + 0.25, za, zb); C('inox', b, b + 1.2, yt, yt + 0.25, za, zb);
  CIL('inox_esc', 2.2, 0.3, cx, yt - fundo + e + 0.15, cz, 'y', 20);
  if (!comTorneira) return;
  const tz = za - 5;
  CIL('cromado', 2.4, 2, cx, yt + 1, tz, 'y', 20);
  CIL('cromado', 1.2, 30, cx, yt + 16, tz, 'y', 16);
  for (let k = 0; k <= 12; k++) { const an = Math.PI * k / 12; CIL('cromado', 1.25, 2.6, cx, yt + 31 + 9 * Math.sin(an), tz + 9 - 9 * Math.cos(an), 'y', 14); }
  CIL('cromado', 1.35, 5, cx, yt + 28.5, tz + 18, 'y', 16);
  CIL('cromado', 0.6, 7, cx + 3.4, yt + 7, tz, 'x', 12);
}

// ------------------------------------------------------------------ materiais e texturas
const RGB = {
  branco: [226, 226, 222], off_white: [214, 207, 192], cinza: [104, 107, 109], grafite: [56, 58, 60], preto: [26, 26, 28],
  areia: [190, 174, 150], verde: [88, 104, 86], azul: [58, 78, 100], rosa: [196, 158, 150]
};
const MADEIRAS = { madeira_clara: [196, 164, 124], madeira_freijo: [150, 108, 72], madeira_escura: [96, 66, 46] };

function texturaMadeira(base) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const c = cv.getContext('2d'); c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, 512, 512);
  let semente = 7; const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  for (let x = 0; x < 512; x += 1) {
    const t = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(x * 0.022) * 3), d = -22 * t + (rnd() - 0.5) * 10;
    c.fillStyle = `rgb(${base[0] + d},${base[1] + d * 0.85},${base[2] + d * 0.7})`; c.fillRect(x, 0, 1, 512);
  }
  c.globalAlpha = 0.25; c.strokeStyle = `rgb(${base[0] - 30},${base[1] - 26},${base[2] - 20})`;
  for (let k = 0; k < 60; k++) { const x = rnd() * 512; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 20, 170, x - 20, 340, x + (rnd() - 0.5) * 30, 512); c.stroke(); }
  return cv;
}
function texturaPedra(tipo) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const c = cv.getContext('2d');
  const base = { granito_preto: [20, 20, 22], quartzo_branco: [236, 236, 232], marmore_branco: [234, 232, 228], quartzo_cinza: [150, 150, 148] }[tipo];
  c.fillStyle = `rgb(${base})`; c.fillRect(0, 0, 512, 512);
  let semente = 11; const rnd = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
  if (tipo === 'marmore_branco') {
    c.strokeStyle = 'rgba(120,120,125,0.35)';
    for (let k = 0; k < 7; k++) { c.lineWidth = 0.6 + rnd() * 1.6; c.beginPath(); let x = rnd() * 512, y = 0; c.moveTo(x, y); while (y < 512) { x += (rnd() - 0.5) * 40; y += 20 + rnd() * 30; c.lineTo(x, y); } c.stroke(); }
  } else {
    for (let k = 0; k < 2600; k++) {
      const v = tipo === 'granito_preto' ? 40 + rnd() * 70 : base[0] - 30 + rnd() * 40;
      c.fillStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.5})`; c.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
    }
  }
  return cv;
}
function texturaCooktop() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300; const c = cv.getContext('2d');
  c.fillStyle = '#0e0e10'; c.fillRect(0, 0, 512, 300);
  c.strokeStyle = '#3c3c40'; c.lineWidth = 3;
  for (const [fx, fz, r] of QUEIMA) { c.beginPath(); c.arc(fx * 512, fz * 300, r * 6 + 22, 0, Math.PI * 2); c.stroke(); }
  return cv;
}
function texturaTela() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 144; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 256, 144); g.addColorStop(0, '#16181c'); g.addColorStop(0.5, '#262a31'); g.addColorStop(1, '#0d0e10');
  c.fillStyle = g; c.fillRect(0, 0, 256, 144); return cv;
}

function definirMateriais(fic) {
  const cor = (k) => (MADEIRAS[k] ? { tex: () => texturaMadeira(MADEIRAS[k]), rough: 0.62 } : { rgb: RGB[k], rough: k === 'preto' || k === 'grafite' ? 0.4 : 0.48 });
  const tampo = fic.acabamentos.tampo === 'madeira'
    ? { tex: () => texturaMadeira(MADEIRAS[MADEIRAS[fic.acabamentos.corpo] ? fic.acabamentos.corpo : 'madeira_freijo']), rough: 0.55 }
    : fic.acabamentos.tampo === 'igual_corpo' ? cor(fic.acabamentos.corpo)
      : { tex: () => texturaPedra(fic.acabamentos.tampo), rough: fic.acabamentos.tampo === 'granito_preto' ? 0.28 : 0.22 };
  return {
    portas: Object.assign({ nome: 'Portas ' + CORES[fic.acabamentos.portas] }, cor(fic.acabamentos.portas)),
    corpo: Object.assign({ nome: 'Corpo ' + CORES[fic.acabamentos.corpo] }, cor(fic.acabamentos.corpo)),
    tampo: Object.assign({ nome: 'Tampo ' + TAMPOS[fic.acabamentos.tampo] }, tampo),
    interno: { nome: 'Interno', rgb: [60, 60, 60], rough: 0.9 },
    rodape: { nome: 'Rodapé', rgb: [42, 42, 42], rough: 0.7 },
    inox: { nome: 'Inox', rgb: [124, 126, 130], metal: 1, rough: 0.4 },
    inox_esc: { nome: 'Inox escovado', rgb: [96, 98, 102], metal: 1, rough: 0.5 },
    cromado: { nome: 'Cromado', rgb: [205, 207, 211], metal: 1, rough: 0.16 },
    perfil: { nome: 'Perfil de alumínio', rgb: [124, 126, 128], metal: 1, rough: 0.35 },
    ferro: { nome: 'Ferro fundido', rgb: [24, 24, 25], metal: 0.4, rough: 0.55 },
    vidro: { nome: 'Vidro reflecta bronze', rgb: [70, 52, 40], alfa: 0.82, metal: 0.3, rough: 0.05 },
    vidro_esc: { nome: 'Vidro escuro', rgb: [18, 18, 22], metal: 0.3, rough: 0.08 },
    espelho: { nome: 'Espelho', rgb: [235, 238, 240], metal: 1, rough: 0.03 },
    preto: { nome: 'Preto', rgb: [22, 22, 24], metal: 0.3, rough: 0.35 },
    eletro: { nome: 'Eletro branco', rgb: [226, 228, 230], rough: 0.35 },
    led: { nome: 'LED', rgb: [255, 220, 160], emissivo: [1, 0.82, 0.55], rough: 0.5 },
    cooktop: { nome: 'Vidro do cooktop', tex: texturaCooktop, rough: 0.12, metal: 0.2, uvCaixa: true },
    tela: { nome: 'Tela', tex: texturaTela, rough: 0.1, metal: 0.2, uvCaixa: true }
  };
}

function canvasParaBytes(cv) {
  return new Promise((ok, falha) => cv.toBlob((b) => (b ? b.arrayBuffer().then((x) => ok(new Uint8Array(x)), falha) : falha(new Error('Sem imagem'))), 'image/jpeg', 0.86));
}

function gerarGeo(fic, comPecas) {
  const G = criarGeo(comPecas);
  const compA = Math.max(0, ...fic.trechos.filter((t) => t.parede === 'A').map((t) => t.inicio + comprimentoTrecho(t)));
  fic.trechos.forEach((t, ti) => {
    if (t.parede === 'A') G.set({ ang: 0, tx: 0, tz: 0 });
    else if (t.parede === 'B_direita') G.set({ ang: -90, tx: compA, tz: 0 });
    else G.set({ ang: 90, tx: 0, tz: 0 });
    montarTrecho(G, t, fic, ti);
  });
  G.set({ ang: 0, tx: 0, tz: 0 });
  const grupos = comPecas ? G.pecas.flatMap((pc) => [...pc.mats.values()]) : [...G.mats.values()];
  if (!grupos.some((m) => m.idx.length)) throw new Error('Adicione pelo menos um módulo.');
  corrigirOrientacao(G);
  // caixa total e centralização (x/z no meio, chão em y = 0), cm → m
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const m of grupos) for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], m.pos[i + k]); mx[k] = Math.max(mx[k], m.pos[i + k]); }
  const centro = [(mn[0] + mx[0]) / 2, mn[1], (mn[2] + mx[2]) / 2];
  const medidas = { largura: +(mx[0] - mn[0]).toFixed(1), altura: +(mx[1] - mn[1]).toFixed(1), profundidade: +(mx[2] - mn[2]).toFixed(1) };
  return { G, centro, medidas };
}

const TIPOS_PECA = { porta: 'Porta', gaveta: 'Gaveta', prateleira: 'Prateleira', lateral: 'Lateral', divisoria: 'Divisória', fundo: 'Fundo', tampo: 'Tampo', estrutura: 'Estrutura', puxador: 'Puxador', rodape: 'Rodapé', eletro: 'Eletrodoméstico', acessorio: 'Acessório', painel: 'Painel', led: 'Iluminação', frente: 'Frente' };
function descreverPeca(pc) {
  if (pc.tipo === 'porta' && pc.dobradica) return 'Porta de abrir, com dobradiça à ' + pc.dobradica + '.';
  if (pc.tipo === 'gaveta') return /^Caixa/.test(pc.nome) ? 'Caixa interna da gaveta: corre junto com a frente.' : 'Gaveta de correr.';
  if (pc.tipo === 'divisoria') return 'Divide o espaço interno do armário.';
  if (pc.tipo === 'prateleira') return 'Prateleira interna prevista no projeto.';
  if (pc.tipo === 'fundo') return 'Fecha a parte de trás do módulo.';
  return '';
}

/** Raio-X: as peças do planejado separadas (mesmas medidas e posição do GLB). Só no navegador. */
export function montarPecasPlanejado(fichaBruta) {
  const fic = normalizarFicha(fichaBruta);
  const { G, centro, medidas } = gerarGeo(fic, true);
  const defs = definirMateriais(fic);
  const m3 = (v) => [(v[0] - centro[0]) / 100, (v[1] - centro[1]) / 100, (v[2] - centro[2]) / 100];
  const pecas = G.pecas.filter((pc) => [...pc.mats.values()].some((m) => m.idx.length)).map((pc, i) => {
    const partes = [];
    const pmn = [Infinity, Infinity, Infinity], pmx = [-Infinity, -Infinity, -Infinity];
    for (const [mat, m] of pc.mats) {
      if (!m.idx.length) continue;
      const n = m.pos.length / 3, pos = new Float32Array(m.pos.length), uv = new Float32Array(m.uv);
      const lmn = [Infinity, Infinity, Infinity], lmx = [-Infinity, -Infinity, -Infinity];
      for (let j = 0; j < n; j++) for (let k = 0; k < 3; k++) { const v = (m.pos[j * 3 + k] - centro[k]) / 100; pos[j * 3 + k] = v; lmn[k] = Math.min(lmn[k], v); lmx[k] = Math.max(lmx[k], v); pmn[k] = Math.min(pmn[k], v); pmx[k] = Math.max(pmx[k], v); }
      if ((defs[mat] || {}).uvCaixa) {
        const lx = lmx[0] - lmn[0] || 1, lz = lmx[2] - lmn[2] || 1, ly = lmx[1] - lmn[1] || 1;
        for (let j = 0; j < n; j++) { uv[j * 2] = (pos[j * 3] - lmn[0]) / lx; uv[j * 2 + 1] = mat === 'tela' ? 1 - (pos[j * 3 + 1] - lmn[1]) / ly : (pos[j * 3 + 2] - lmn[2]) / lz; }
      }
      partes.push({ mat, pos, nor: new Float32Array(m.nor), uv, idx: n > 65535 ? new Uint32Array(m.idx) : new Uint16Array(m.idx) });
    }
    const principal = defs[pc.mat] ? pc.mat : partes[0].mat;
    return {
      id: 'p' + i, nome: pc.nome, tipo: pc.tipo, tipoNome: TIPOS_PECA[pc.tipo] || 'Peça', grupo: pc.grupo || '',
      desc: descreverPeca(pc), material: (defs[principal] || {}).nome || '',
      medidas: [0, 1, 2].map((k) => +((pmx[k] - pmn[k]) * 100).toFixed(1)),
      explode: pc.explode, partes,
      mov: pc.pivo ? { id: 'porta:' + i, tipo: 'porta', pivo: m3(pc.pivo), giro: pc.giro } : pc.desliza ? { id: pc.mov || 'gaveta:' + i, tipo: 'gaveta', vetor: pc.desliza.map((v) => v / 100) } : null
    };
  });
  return { pecas, materiais: defs, medidas };
}

// ------------------------------------------------------------------ montar o GLB
export async function montarPlanejado(fichaBruta) {
  const fic = normalizarFicha(fichaBruta);
  const { G, centro, medidas } = gerarGeo(fic, false);
  const defs = definirMateriais(fic);
  const json = { asset: { version: '2.0', generator: 'MenuReal planejados' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ name: fic.nome, mesh: 0 }], meshes: [{ name: fic.nome, primitives: [] }], materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }],
    accessors: [], bufferViews: [], buffers: [{ byteLength: 0 }] };
  const blocos = []; let tam = 0;
  const vista = (bytes, alvo) => {
    const pad = (4 - (tam % 4)) % 4; if (pad) { blocos.push(new Uint8Array(pad)); tam += pad; }
    const v = { buffer: 0, byteOffset: tam, byteLength: bytes.byteLength }; if (alvo) v.target = alvo;
    json.bufferViews.push(v); blocos.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)); tam += bytes.byteLength;
    return json.bufferViews.length - 1;
  };
  for (const [nome, m] of G.mats) {
    if (!m.idx.length) continue;
    const d = defs[nome] || defs.interno;
    const mat = { name: d.nome, pbrMetallicRoughness: { metallicFactor: d.metal || 0, roughnessFactor: d.rough } };
    if (d.tex) {
      const bytes = await canvasParaBytes(d.tex());
      json.images.push({ bufferView: vista(bytes), mimeType: 'image/jpeg' });
      json.textures.push({ sampler: 0, source: json.images.length - 1 });
      mat.pbrMetallicRoughness.baseColorTexture = { index: json.textures.length - 1 };
    } else {
      mat.pbrMetallicRoughness.baseColorFactor = [...d.rgb.map((v) => Math.pow(v / 255, 2.2)), d.alfa || 1];
    }
    if (d.alfa) mat.alphaMode = 'BLEND';
    if (d.emissivo) mat.emissiveFactor = d.emissivo;
    if (nome === 'vidro' || nome === 'espelho') mat.doubleSided = true;
    json.materials.push(mat);

    const n = m.pos.length / 3, pos = new Float32Array(m.pos.length), nor = new Float32Array(m.nor), uv = new Float32Array(m.uv.length);
    const pmn = [Infinity, Infinity, Infinity], pmx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const v = (m.pos[i * 3 + k] - centro[k]) / 100; pos[i * 3 + k] = v; pmn[k] = Math.min(pmn[k], v); pmx[k] = Math.max(pmx[k], v); }
    if (d.uvCaixa) {   // cooktop/tela: a imagem cobre a face de cima (ou da frente) inteira
      const lx = pmx[0] - pmn[0] || 1, lz = pmx[2] - pmn[2] || 1, ly = pmx[1] - pmn[1] || 1;
      for (let i = 0; i < n; i++) {
        const x = (pos[i * 3] - pmn[0]) / lx, y = (pos[i * 3 + 1] - pmn[1]) / ly, z = (pos[i * 3 + 2] - pmn[2]) / lz;
        uv[i * 2] = x; uv[i * 2 + 1] = nome === 'tela' ? 1 - y : z;
      }
    } else uv.set(m.uv);
    const idx = n > 65535 ? new Uint32Array(m.idx) : new Uint16Array(m.idx);
    const acc = (bv, comp, count, type, extra) => { json.accessors.push(Object.assign({ bufferView: bv, componentType: comp, count, type }, extra || {})); return json.accessors.length - 1; };
    const aPos = acc(vista(pos, 34962), 5126, n, 'VEC3', { min: pmn, max: pmx });
    const aNor = acc(vista(nor, 34962), 5126, n, 'VEC3');
    const aUv = acc(vista(uv, 34962), 5126, n, 'VEC2');
    const aIdx = acc(vista(idx, 34963), idx instanceof Uint32Array ? 5125 : 5123, idx.length, 'SCALAR');
    json.meshes[0].primitives.push({ attributes: { POSITION: aPos, NORMAL: aNor, TEXCOORD_0: aUv }, indices: aIdx, material: json.materials.length - 1 });
  }
  if (!json.textures.length) { delete json.textures; delete json.images; delete json.samplers; }
  const bin = new Uint8Array(tam); let p = 0; for (const b of blocos) { bin.set(b, p); p += b.length; }
  json.buffers[0].byteLength = tam;
  const { escreverGlb } = await import('./glb.mjs');
  return {
    glb: escreverGlb(json, bin),
    medidas,
    ficha: fic
  };
}
