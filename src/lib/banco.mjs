/* =========================================================================
   MenuReal AR — banco de dados (Cloudflare D1, SQLite)
   Lojas, contas e produtos ficam aqui; arquivos 3D ficam no KV (MODELOS).
   O esquema é criado/atualizado sozinho na primeira requisição.
   ========================================================================= */
import { erroComStatus } from './comum.mjs';

export const DEMO = '_demo'; // linha da demonstração exibida na página inicial
const VERSAO_ESQUEMA = 7; // 7: eventos (números da loja) · 2: lojas.visual · 3: produtos.adicionais · 4: produtos.opcoes · 5: lojas.pedido · 6: plano, teste, código de recuperação, limites

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS lojas (
     slug          TEXT PRIMARY KEY,
     nome          TEXT NOT NULL,
     email         TEXT UNIQUE,
     senha_hash    TEXT,
     tipo          TEXT NOT NULL DEFAULT 'alimentos' CHECK (tipo IN ('alimentos', 'produtos')),
     slogan        TEXT NOT NULL DEFAULT '',
     abre          TEXT NOT NULL DEFAULT '08:00',
     fecha         TEXT NOT NULL DEFAULT '18:00',
     dias          TEXT NOT NULL DEFAULT '[1,2,3,4,5,6]',   -- JSON
     whatsapp      TEXT NOT NULL DEFAULT '',
     categorias    TEXT NOT NULL DEFAULT '[]',              -- JSON
     visual        TEXT NOT NULL DEFAULT '{}',              -- JSON: aparência da página
     pedido        TEXT NOT NULL DEFAULT '{}',              -- JSON: entrega, retirada, taxas, pagamento
     plano         TEXT NOT NULL DEFAULT 'ativo',           -- ativo | teste | bloqueado
     teste_ate     TEXT NOT NULL DEFAULT '',                -- ISO: fim do teste grátis
     codigo_hash   TEXT NOT NULL DEFAULT '',                -- código de recuperação de senha (hash)
     criada_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
     atualizada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   )`,
  `CREATE TABLE IF NOT EXISTS produtos (
     loja            TEXT NOT NULL REFERENCES lojas (slug) ON DELETE CASCADE,
     id              TEXT NOT NULL,
     posicao         INTEGER NOT NULL,
     nome            TEXT NOT NULL,
     categoria       TEXT NOT NULL,
     preco           REAL NOT NULL DEFAULT 0 CHECK (preco >= 0),
     descricao       TEXT NOT NULL DEFAULT '',
     largura_cm      REAL NOT NULL DEFAULT 5,
     profundidade_cm REAL NOT NULL DEFAULT 5,
     altura_cm       REAL NOT NULL DEFAULT 5,
     modelo          TEXT NOT NULL DEFAULT '',
     ilustrativo     INTEGER NOT NULL DEFAULT 1,
     ingredientes    TEXT NOT NULL DEFAULT '',
     alergenos       TEXT NOT NULL DEFAULT '[]',              -- JSON
     tamanhos        TEXT NOT NULL DEFAULT '[]',              -- JSON
     adicionais      TEXT NOT NULL DEFAULT '[]',              -- JSON: complementos com preço
     opcoes          TEXT NOT NULL DEFAULT '{}',              -- JSON: { montar: cliente monta em camadas }
     PRIMARY KEY (loja, id)
   )`,
  'CREATE INDEX IF NOT EXISTS produtos_por_loja ON produtos (loja, posicao)',
  `CREATE TABLE IF NOT EXISTS tarefas_3d (
     id        TEXT PRIMARY KEY,
     loja      TEXT NOT NULL DEFAULT '',
     resultado TEXT NOT NULL,
     criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
   )`,
  `CREATE TABLE IF NOT EXISTS eventos (
     loja  TEXT NOT NULL,
     dia   TEXT NOT NULL,          -- AAAA-MM-DD (horário de Brasília)
     tipo  TEXT NOT NULL,          -- visita | produto | ar | pedido
     chave TEXT NOT NULL DEFAULT '',
     n     INTEGER NOT NULL DEFAULT 0,
     PRIMARY KEY (loja, dia, tipo, chave)
   )`,
  `CREATE TABLE IF NOT EXISTS limites (
     chave TEXT PRIMARY KEY,
     n     INTEGER NOT NULL,
     ate   INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS configuracao (
     chave TEXT PRIMARY KEY,
     valor TEXT NOT NULL
   )`
];

let esquemaPronto = false;
export async function garantirEsquema(env) {
  if (esquemaPronto) return;
  try {
    const r = await env.DB.prepare("SELECT valor FROM configuracao WHERE chave = 'esquema'").first();
    if (r && Number(r.valor) >= VERSAO_ESQUEMA) { esquemaPronto = true; return; }
  } catch { /* tabelas ainda não existem */ }
  await env.DB.batch(ESQUEMA.map((s) => env.DB.prepare(s)));
  // bancos criados na versão 1 não têm a coluna visual
  const { results: colunas } = await env.DB.prepare('PRAGMA table_info(lojas)').all();
  if (!colunas.some((c) => c.name === 'visual')) {
    await env.DB.prepare("ALTER TABLE lojas ADD COLUMN visual TEXT NOT NULL DEFAULT '{}'").run();
  }
  const novasLojas = [['pedido', "'{}'"], ['plano', "'ativo'"], ['teste_ate', "''"], ['codigo_hash', "''"]];
  for (const [col, padrao] of novasLojas) {
    if (!colunas.some((c) => c.name === col)) await env.DB.prepare(`ALTER TABLE lojas ADD COLUMN ${col} TEXT NOT NULL DEFAULT ${padrao}`).run();
  }
  const { results: colProd } = await env.DB.prepare('PRAGMA table_info(produtos)').all();
  if (!colProd.some((c) => c.name === 'adicionais')) {
    await env.DB.prepare("ALTER TABLE produtos ADD COLUMN adicionais TEXT NOT NULL DEFAULT '[]'").run();
  }
  if (!colProd.some((c) => c.name === 'opcoes')) {
    await env.DB.prepare("ALTER TABLE produtos ADD COLUMN opcoes TEXT NOT NULL DEFAULT '{}'").run();
  }
  await env.DB.batch([
    env.DB.prepare("INSERT INTO configuracao (chave, valor) VALUES ('esquema', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor").bind(String(VERSAO_ESQUEMA))
  ]);
  esquemaPronto = true;
}

const agora = () => new Date().toISOString();
const lerJson = (t, padrao) => { try { return JSON.parse(t); } catch { return padrao; } };
const texto = (v, max) => String(v == null ? '' : v).slice(0, max);
const dimOk = (d, k) => { const v = Number(d && d[k]); return v > 0 && v < 100000 ? Math.round(v * 100) / 100 : 5; };
const slugBanco = (slug) => slug || DEMO;

import { SABORES, COBERTURAS, RECIPIENTES } from '../../public/sorvete.mjs';
const TIPOS_3D = ['granola', 'pacoca', 'confete', 'banana', 'morango', 'morango_picado', 'leite_po', 'leite_condensado', 'calda_chocolate', 'nutella',
  'camada_creme', 'camada_morango', 'camada_nutella',
  ...Object.keys(SABORES).map((k) => 'sabor_' + k), ...Object.keys(COBERTURAS).map((k) => 'cob_' + k)];
const MODOS = ['acai', 'sorvete', 'milkshake'];
function limparCopo(c) {
  if (!c || typeof c !== 'object') return null;
  const n = (v, a, b) => { v = Number(v); return v >= a && v <= b ? Math.round(v * 10) / 10 : 0; };
  const medidas = {};
  Object.keys(c.medidas || {}).slice(0, 10).forEach((k) => {
    const m = c.medidas[k] || {};
    medidas[texto(k, 60)] = { ml: n(m.ml, 50, 3000), boca: n(m.boca, 2, 40), fundo: n(m.fundo, 2, 40), altura: n(m.altura, 3, 60) };
  });
  return { estilo: c.estilo === 'vidro' ? 'vidro' : 'pet', logo: c.logo !== false, medidas };
}
function limparAdicionais(lista) {
  const vistos = new Set();
  return (Array.isArray(lista) ? lista : []).filter((a) => a && a.nome).slice(0, 30).map((a, i) => {
    let id = texto(a.id || 'a' + i, 40).replace(/[^\w-]/g, '') || 'a' + i;
    while (vistos.has(id)) id += '2';
    vistos.add(id);
    return { id, nome: texto(a.nome, 40), preco: Math.min(9999, Math.max(0, Math.round((Number(a.preco) || 0) * 100) / 100)),
      tipo3d: TIPOS_3D.includes(a.tipo3d) ? a.tipo3d : '', esgotado: a.esgotado === true };
  });
}

const reais = (v, max) => Math.min(max, Math.max(0, Math.round((Number(v) || 0) * 100) / 100));
const TIPOS_PIX = ['cpf', 'cnpj', 'telefone', 'email', 'aleatoria'];
/** Como a loja recebe pedidos: entrega, retirada, taxas, pagamento, horário. */
export function limparPedido(v) {
  v = v && typeof v === 'object' ? v : {};
  const bairros = (Array.isArray(v.bairros) ? v.bairros : []).filter((b) => b && b.nome).slice(0, 60)
    .map((b) => ({ nome: texto(b.nome, 50).trim(), taxa: reais(b.taxa, 999) })).filter((b) => b.nome);
  const pix = v.pix && typeof v.pix === 'object' ? v.pix : {};
  return {
    entrega: v.entrega !== false,
    retirada: v.retirada !== false,
    local: v.local === true,
    taxa: reais(v.taxa, 999),
    bairros,
    minimo: reais(v.minimo, 9999),
    tempo: texto(v.tempo, 40),
    endereco: texto(v.endereco, 160),
    pagamento: {
      pix: !(v.pagamento && v.pagamento.pix === false),
      cartao: !(v.pagamento && v.pagamento.cartao === false),
      dinheiro: !(v.pagamento && v.pagamento.dinheiro === false)
    },
    pix: { tipo: TIPOS_PIX.includes(pix.tipo) ? pix.tipo : 'cpf', chave: texto(pix.chave, 77).trim(),
      nome: texto(pix.nome, 25).trim(), cidade: texto(pix.cidade, 15).trim() },
    foraDoHorario: v.foraDoHorario === 'agendar' ? 'agendar' : 'bloquear',
    pausado: v.pausado === true
  };
}

export const FONTES = ['moderno', 'elegante', 'divertido', 'classico'];
const COR = /^#[0-9a-f]{6}$/i;
/** Aparência da página da loja. Imagens só da pasta da própria loja no KV. */
export function limparVisual(v, slug) {
  v = v && typeof v === 'object' ? v : {};
  const img = (u) => {
    u = String(u || '');
    return new RegExp('^api/arquivo/imagens/' + slugBanco(slug).replace(/[^a-z0-9_-]/g, '') + '/[\\w.-]+\\.(webp|png|jpg)$').test(u) ? u : '';
  };
  return {
    cor: COR.test(v.cor) ? v.cor.toUpperCase() : '',
    destaque: COR.test(v.destaque) ? v.destaque.toUpperCase() : '',
    fonte: FONTES.includes(v.fonte) ? v.fonte : 'moderno',
    logo: img(v.logo),
    capa: img(v.capa),
    og: img(v.og),                                            // imagem de prévia do link (WhatsApp, Instagram)
    ogAss: String(v.ogAss || '').replace(/[^a-z0-9]/g, '').slice(0, 20),
    marca: v.marca !== false,
    cenario: ['logo', 'cor', 'claro'].includes(v.cenario) ? v.cenario : 'logo'   // fundo atrás do 3D
  };
}

// ---------------------------------------------------------------------------
// Cardápio / catálogo
// ---------------------------------------------------------------------------
export async function lerCardapio(env, slug) {
  const l = await env.DB.prepare('SELECT * FROM lojas WHERE slug = ?').bind(slugBanco(slug)).first();
  if (!l) return null;
  const { results } = await env.DB.prepare('SELECT * FROM produtos WHERE loja = ? ORDER BY posicao').bind(l.slug).all();
  return {
    padaria: { nome: l.nome, slogan: l.slogan, abre: l.abre, fecha: l.fecha, dias: lerJson(l.dias, []), whatsapp: l.whatsapp, tipo: l.tipo,
      visual: limparVisual(lerJson(l.visual, {}), slug), pedido: limparPedido(lerJson(l.pedido, {})),
      plano: { situacao: situacaoLoja(l), ate: l.plano === 'teste' ? l.teste_ate : '' } },
    categorias: lerJson(l.categorias, []),
    produtos: results.map((p) => ({
      id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco, descricao: p.descricao,
      dim: { largura: p.largura_cm, profundidade: p.profundidade_cm, altura: p.altura_cm },
      modelo: p.modelo, ilustrativo: Boolean(p.ilustrativo), ingredientes: p.ingredientes,
      alergenos: lerJson(p.alergenos, []), tamanhos: lerJson(p.tamanhos, []), adicionais: lerJson(p.adicionais, []),
      montar: Boolean(lerJson(p.opcoes, {}).montar), copo: lerJson(p.opcoes, {}).copo || null, esgotado: Boolean(lerJson(p.opcoes, {}).esgotado),
      modo: lerJson(p.opcoes, {}).modo || 'acai'
    })),
    atualizadoEm: l.atualizada_em
  };
}

/** Substitui o cardápio inteiro da loja, numa transação (batch). */
export async function salvarCardapio(env, slug, dados, opcoes = {}) {
  const s = slugBanco(slug);
  const p = dados.padaria || {};
  const tipo = p.tipo === 'produtos' ? 'produtos' : 'alimentos';
  const dias = (Array.isArray(p.dias) ? p.dias : []).map(Number).filter((d) => d >= 0 && d <= 6);
  const categorias = (Array.isArray(dados.categorias) ? dados.categorias : ['Salgados', 'Doces', 'Pães', 'Bebidas'])
    .map((c) => texto(c, 40)).filter(Boolean).slice(0, 30);
  const atual = agora();

  if (opcoes.criarSeFaltar) {
    await env.DB.prepare('INSERT INTO lojas (slug, nome) VALUES (?, ?) ON CONFLICT (slug) DO NOTHING').bind(s, texto(p.nome, 60) || 'Loja').run();
  } else if (!(await env.DB.prepare('SELECT 1 AS ok FROM lojas WHERE slug = ?').bind(s).first())) {
    throw erroComStatus('Estabelecimento não encontrado.', 404);
  }

  const comandos = [
    env.DB.prepare(`UPDATE lojas SET nome = ?, slogan = ?, abre = ?, fecha = ?, dias = ?, whatsapp = ?, tipo = ?, categorias = ?, visual = ?, pedido = ?, atualizada_em = ?
                    WHERE slug = ?`).bind(
      texto(p.nome, 60) || 'Loja', texto(p.slogan, 90), /^\d{2}:\d{2}$/.test(p.abre) ? p.abre : '08:00',
      /^\d{2}:\d{2}$/.test(p.fecha) ? p.fecha : '18:00', JSON.stringify(dias), String(p.whatsapp || '').replace(/\D/g, '').slice(0, 15),
      tipo, JSON.stringify(categorias), JSON.stringify(limparVisual(p.visual, slug)), JSON.stringify(limparPedido(p.pedido)), atual, s),
    env.DB.prepare('DELETE FROM produtos WHERE loja = ?').bind(s)
  ];
  const inserir = env.DB.prepare(`INSERT INTO produtos (loja, id, posicao, nome, categoria, preco, descricao, largura_cm, profundidade_cm, altura_cm,
      modelo, ilustrativo, ingredientes, alergenos, tamanhos, adicionais, opcoes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const vistos = new Set();
  let pos = 0;
  for (const x of (dados.produtos || []).slice(0, 500)) {
    if (!x || !x.nome) continue;
    let id = texto(x.id || 'p' + pos, 80);
    while (vistos.has(id)) id += '-2';
    vistos.add(id);
    const tamanhos = (Array.isArray(x.tamanhos) ? x.tamanhos : []).slice(0, 8).map((t) => ({
      id: texto(t.id, 60), nome: texto(t.nome, 30), preco: Math.max(0, Number(t.preco) || 0),
      dim: { largura: dimOk(t.dim, 'largura'), profundidade: dimOk(t.dim, 'profundidade'), altura: dimOk(t.dim, 'altura') }, modelo: texto(t.modelo, 300),
      ...(RECIPIENTES[t.recipiente] ? { recipiente: t.recipiente, bolas: Math.min(5, Math.max(1, Math.round(Number(t.bolas) || 1))) } : {})
    }));
    comandos.push(inserir.bind(s, id, pos++, texto(x.nome, 60), texto(x.categoria, 40) || categorias[0] || 'Geral',
      Math.min(99999999, Math.max(0, Math.round((Number(x.preco) || 0) * 100) / 100)), texto(x.descricao, 240),
      dimOk(x.dim, 'largura'), dimOk(x.dim, 'profundidade'), dimOk(x.dim, 'altura'), texto(x.modelo, 300), x.ilustrativo === false ? 0 : 1,
      texto(x.ingredientes, 600), JSON.stringify((Array.isArray(x.alergenos) ? x.alergenos : []).map((a) => texto(a, 40)).slice(0, 20)),
      JSON.stringify(tamanhos), JSON.stringify(limparAdicionais(x.adicionais)), JSON.stringify({ montar: x.montar === true, copo: limparCopo(x.copo), esgotado: x.esgotado === true, modo: MODOS.includes(x.modo) ? x.modo : 'acai' })));
  }
  await env.DB.batch(comandos); // transação: tudo ou nada
  return atual;
}

// ---------------------------------------------------------------------------
// Contas das lojas
// ---------------------------------------------------------------------------
export async function listarLojas(env) {
  const { results } = await env.DB.prepare(`SELECT l.slug, l.nome, l.email, l.tipo, l.whatsapp, l.plano, l.teste_ate AS testeAte, l.criada_em AS criadoEm,
      (SELECT count(*) FROM produtos p WHERE p.loja = l.slug) AS produtos
    FROM lojas l WHERE l.slug <> ? ORDER BY l.nome`).bind(DEMO).all();
  return results.map((r) => ({ ...r, situacao: situacaoLoja({ plano: r.plano, teste_ate: r.testeAte }) }));
}
export async function contaPorEmail(env, email) {
  return env.DB.prepare('SELECT slug, nome, email, senha_hash, codigo_hash, plano, teste_ate FROM lojas WHERE email = ?').bind(email).first();
}
export async function contaPorSlug(env, slug) {
  return env.DB.prepare('SELECT slug, nome, email, senha_hash, codigo_hash, plano, teste_ate FROM lojas WHERE slug = ?').bind(slug).first();
}
export async function lojaExiste(env, slug) {
  return Boolean(await env.DB.prepare('SELECT 1 AS ok FROM lojas WHERE slug = ?').bind(slug).first());
}
/** ativo | teste (dentro do prazo) | vencido (teste acabou) | bloqueado */
export function situacaoLoja(l) {
  if (!l) return 'ativo';
  if (l.plano === 'bloqueado') return 'bloqueado';
  if (l.plano === 'teste') return l.teste_ate && l.teste_ate > new Date().toISOString() ? 'teste' : 'vencido';
  return 'ativo';
}
export async function mudarSenha(env, slug, senhaHash) {
  await env.DB.prepare('UPDATE lojas SET senha_hash = ?, atualizada_em = ? WHERE slug = ?').bind(senhaHash, agora(), slug).run();
}
export async function gravarCodigoRecuperacao(env, slug, codigoHash) {
  await env.DB.prepare('UPDATE lojas SET codigo_hash = ? WHERE slug = ?').bind(codigoHash, slug).run();
}
/** plano: 'ativo' | 'bloqueado' | 'teste' (com dias a partir de hoje ou do fim do teste atual) */
export async function mudarPlano(env, slug, plano, dias = 7) {
  const l = await contaPorSlug(env, slug);
  if (!l) throw erroComStatus('Loja não encontrada.', 404);
  let ate = l.teste_ate;
  if (plano === 'teste') {
    const base = Math.max(Date.now(), Date.parse(l.teste_ate || 0) || 0);
    ate = new Date(base + dias * 864e5).toISOString();
  }
  await env.DB.prepare('UPDATE lojas SET plano = ?, teste_ate = ?, atualizada_em = ? WHERE slug = ?').bind(plano, ate || '', agora(), slug).run();
  return { plano, testeAte: ate, situacao: situacaoLoja({ plano, teste_ate: ate }) };
}
/** Dados curtos para a prévia do link (título, descrição e imagem). */
export async function resumoLoja(env, slug) {
  const l = await env.DB.prepare('SELECT nome, slogan, tipo, visual FROM lojas WHERE slug = ?').bind(slug).first();
  if (!l) return null;
  return { nome: l.nome, slogan: l.slogan, tipo: l.tipo, visual: limparVisual(lerJson(l.visual, {}), slug) };
}
/** Limite de tentativas (cadastro, login, recuperação). true = pode seguir. */
export async function dentroDoLimite(env, chave, max, janelaMs) {
  const t = Date.now();
  const r = await env.DB.prepare('SELECT n, ate FROM limites WHERE chave = ?').bind(chave).first();
  if (!r || r.ate < t) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO limites (chave, n, ate) VALUES (?, 1, ?) ON CONFLICT (chave) DO UPDATE SET n = 1, ate = excluded.ate').bind(chave, t + janelaMs),
      env.DB.prepare('DELETE FROM limites WHERE ate < ?').bind(t - 864e5)
    ]);
    return true;
  }
  if (r.n >= max) return false;
  await env.DB.prepare('UPDATE limites SET n = n + 1 WHERE chave = ?').bind(chave).run();
  return true;
}
/** Cria a loja ou atualiza nome, e-mail e senha de uma existente. */
export async function salvarConta(env, { slug, nome, email, senhaHash, tipo, sorveteria = false, teste = 0, whatsapp = '', codigoHash = '' }) {
  const existia = await env.DB.prepare('SELECT 1 AS ok FROM lojas WHERE slug = ?').bind(slug).first();
  if (existia) {
    await env.DB.prepare('UPDATE lojas SET nome = ?, email = ?, senha_hash = ?, atualizada_em = ? WHERE slug = ?')
      .bind(nome, email, senhaHash, agora(), slug).run();
  } else {
    await env.DB.prepare(`INSERT INTO lojas (slug, nome, email, senha_hash, tipo, slogan, abre, fecha, categorias)
      VALUES (?, ?, ?, ?, ?, ?, '08:00', '18:00', ?)`).bind(slug, nome, email, senhaHash, tipo,
      tipo === 'produtos' ? 'Veja em tamanho real antes de comprar' : sorveteria ? 'Monte o seu e veja na mesa' : 'Veja antes de pedir',
      JSON.stringify(tipo === 'produtos' ? ['Destaques', 'Novidades', 'Promoções']
        : sorveteria ? ['Açaí', 'Sorvetes', 'Picolés', 'Milkshakes', 'Bebidas'] : ['Salgados', 'Doces', 'Bebidas'])).run();
    if (teste > 0 || whatsapp || codigoHash || sorveteria) {
      await env.DB.prepare(`UPDATE lojas SET plano = ?, teste_ate = ?, whatsapp = ?, codigo_hash = ?, abre = ?, fecha = ?, dias = ? WHERE slug = ?`).bind(
        teste > 0 ? 'teste' : 'ativo', teste > 0 ? new Date(Date.now() + teste * 864e5).toISOString() : '',
        String(whatsapp).replace(/\D/g, '').slice(0, 15), codigoHash,
        sorveteria ? '13:00' : '08:00', sorveteria ? '22:00' : '18:00', sorveteria ? '[0,1,2,3,4,5,6]' : '[1,2,3,4,5,6]', slug).run();
    }
  }
  return { atualizado: Boolean(existia) };
}

// ---------------------------------------------------------------------------
// Tarefas de geração 3D e configuração
// ---------------------------------------------------------------------------
export async function tipoLoja(env, slug) {
  const r = await env.DB.prepare('SELECT tipo FROM lojas WHERE slug = ?').bind(slugBanco(slug)).first();
  return r ? r.tipo : 'alimentos';
}
export async function lerTarefa(env, id) {
  const t = await env.DB.prepare('SELECT resultado FROM tarefas_3d WHERE id = ?').bind(id).first();
  return t ? lerJson(t.resultado, null) : null;
}
export async function salvarTarefa(env, id, slug, resultado) {
  await env.DB.prepare('INSERT INTO tarefas_3d (id, loja, resultado) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET resultado = excluded.resultado')
    .bind(id, slug || '', JSON.stringify(resultado)).run();
}
export async function lerConfig(env, chave) {
  const r = await env.DB.prepare('SELECT valor FROM configuracao WHERE chave = ?').bind(chave).first();
  return r ? lerJson(r.valor, null) : null;
}
export async function gravarConfig(env, chave, valor) {
  await env.DB.prepare('INSERT INTO configuracao (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor')
    .bind(chave, JSON.stringify(valor)).run();
}
export async function bancoOk(env) {
  try { await env.DB.prepare('SELECT 1').first(); return true; } catch (e) { console.error('banco:', e.message); return false; }
}

// ---------------------------------------------------------------------------
// Números da loja: contagens por dia, sem dados pessoais
// ---------------------------------------------------------------------------
export function diaBrasil(ms = Date.now()) { return new Date(ms - 3 * 36e5).toISOString().slice(0, 10); }
export async function registrarEvento(env, slug, tipo, chave = '') {
  await env.DB.prepare('INSERT INTO eventos (loja, dia, tipo, chave, n) VALUES (?, ?, ?, ?, 1) ON CONFLICT (loja, dia, tipo, chave) DO UPDATE SET n = n + 1')
    .bind(slug, diaBrasil(), tipo, chave).run();
}
export async function lerEventos(env, slug, dias = 30) {
  const desde = diaBrasil(Date.now() - (dias - 1) * 864e5);
  const { results } = await env.DB.prepare('SELECT dia, tipo, chave, n FROM eventos WHERE loja = ? AND dia >= ? ORDER BY dia').bind(slug, desde).all();
  return { desde, hoje: diaBrasil(), linhas: results };
}
