/* =========================================================================
   MenuReal AR — banco de dados (Cloudflare D1, SQLite)
   Lojas, contas e produtos ficam aqui; arquivos 3D ficam no KV (MODELOS).
   O esquema é criado/atualizado sozinho na primeira requisição.
   ========================================================================= */
import { erroComStatus } from './comum.mjs';

export const DEMO = '_demo'; // linha da demonstração exibida na página inicial
const VERSAO_ESQUEMA = 1;

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
     PRIMARY KEY (loja, id)
   )`,
  'CREATE INDEX IF NOT EXISTS produtos_por_loja ON produtos (loja, posicao)',
  `CREATE TABLE IF NOT EXISTS tarefas_3d (
     id        TEXT PRIMARY KEY,
     loja      TEXT NOT NULL DEFAULT '',
     resultado TEXT NOT NULL,
     criada_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
  await env.DB.batch([
    ...ESQUEMA.map((s) => env.DB.prepare(s)),
    env.DB.prepare("INSERT INTO configuracao (chave, valor) VALUES ('esquema', ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor").bind(String(VERSAO_ESQUEMA))
  ]);
  esquemaPronto = true;
}

const agora = () => new Date().toISOString();
const lerJson = (t, padrao) => { try { return JSON.parse(t); } catch { return padrao; } };
const texto = (v, max) => String(v == null ? '' : v).slice(0, max);
const dimOk = (d, k) => { const v = Number(d && d[k]); return v > 0 && v < 100000 ? Math.round(v * 100) / 100 : 5; };
const slugBanco = (slug) => slug || DEMO;

// ---------------------------------------------------------------------------
// Cardápio / catálogo
// ---------------------------------------------------------------------------
export async function lerCardapio(env, slug) {
  const l = await env.DB.prepare('SELECT * FROM lojas WHERE slug = ?').bind(slugBanco(slug)).first();
  if (!l) return null;
  const { results } = await env.DB.prepare('SELECT * FROM produtos WHERE loja = ? ORDER BY posicao').bind(l.slug).all();
  return {
    padaria: { nome: l.nome, slogan: l.slogan, abre: l.abre, fecha: l.fecha, dias: lerJson(l.dias, []), whatsapp: l.whatsapp, tipo: l.tipo },
    categorias: lerJson(l.categorias, []),
    produtos: results.map((p) => ({
      id: p.id, nome: p.nome, categoria: p.categoria, preco: p.preco, descricao: p.descricao,
      dim: { largura: p.largura_cm, profundidade: p.profundidade_cm, altura: p.altura_cm },
      modelo: p.modelo, ilustrativo: Boolean(p.ilustrativo), ingredientes: p.ingredientes,
      alergenos: lerJson(p.alergenos, []), tamanhos: lerJson(p.tamanhos, [])
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
    env.DB.prepare(`UPDATE lojas SET nome = ?, slogan = ?, abre = ?, fecha = ?, dias = ?, whatsapp = ?, tipo = ?, categorias = ?, atualizada_em = ?
                    WHERE slug = ?`).bind(
      texto(p.nome, 60) || 'Loja', texto(p.slogan, 90), /^\d{2}:\d{2}$/.test(p.abre) ? p.abre : '08:00',
      /^\d{2}:\d{2}$/.test(p.fecha) ? p.fecha : '18:00', JSON.stringify(dias), String(p.whatsapp || '').replace(/\D/g, '').slice(0, 15),
      tipo, JSON.stringify(categorias), atual, s),
    env.DB.prepare('DELETE FROM produtos WHERE loja = ?').bind(s)
  ];
  const inserir = env.DB.prepare(`INSERT INTO produtos (loja, id, posicao, nome, categoria, preco, descricao, largura_cm, profundidade_cm, altura_cm,
      modelo, ilustrativo, ingredientes, alergenos, tamanhos) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const vistos = new Set();
  let pos = 0;
  for (const x of (dados.produtos || []).slice(0, 500)) {
    if (!x || !x.nome) continue;
    let id = texto(x.id || 'p' + pos, 80);
    while (vistos.has(id)) id += '-2';
    vistos.add(id);
    const tamanhos = (Array.isArray(x.tamanhos) ? x.tamanhos : []).slice(0, 8).map((t) => ({
      id: texto(t.id, 60), nome: texto(t.nome, 30), preco: Math.max(0, Number(t.preco) || 0),
      dim: { largura: dimOk(t.dim, 'largura'), profundidade: dimOk(t.dim, 'profundidade'), altura: dimOk(t.dim, 'altura') }, modelo: texto(t.modelo, 300)
    }));
    comandos.push(inserir.bind(s, id, pos++, texto(x.nome, 60), texto(x.categoria, 40) || categorias[0] || 'Geral',
      Math.min(99999999, Math.max(0, Math.round((Number(x.preco) || 0) * 100) / 100)), texto(x.descricao, 240),
      dimOk(x.dim, 'largura'), dimOk(x.dim, 'profundidade'), dimOk(x.dim, 'altura'), texto(x.modelo, 300), x.ilustrativo === false ? 0 : 1,
      texto(x.ingredientes, 600), JSON.stringify((Array.isArray(x.alergenos) ? x.alergenos : []).map((a) => texto(a, 40)).slice(0, 20)),
      JSON.stringify(tamanhos)));
  }
  await env.DB.batch(comandos); // transação: tudo ou nada
  return atual;
}

// ---------------------------------------------------------------------------
// Contas das lojas
// ---------------------------------------------------------------------------
export async function listarLojas(env) {
  const { results } = await env.DB.prepare(`SELECT l.slug, l.nome, l.email, l.tipo, l.criada_em AS criadoEm,
      (SELECT count(*) FROM produtos p WHERE p.loja = l.slug) AS produtos
    FROM lojas l WHERE l.slug <> ? ORDER BY l.nome`).bind(DEMO).all();
  return results;
}
export async function contaPorEmail(env, email) {
  return env.DB.prepare('SELECT slug, nome, email, senha_hash FROM lojas WHERE email = ?').bind(email).first();
}
/** Cria a loja ou atualiza nome, e-mail e senha de uma existente. */
export async function salvarConta(env, { slug, nome, email, senhaHash, tipo }) {
  const existia = await env.DB.prepare('SELECT 1 AS ok FROM lojas WHERE slug = ?').bind(slug).first();
  if (existia) {
    await env.DB.prepare('UPDATE lojas SET nome = ?, email = ?, senha_hash = ?, atualizada_em = ? WHERE slug = ?')
      .bind(nome, email, senhaHash, agora(), slug).run();
  } else {
    await env.DB.prepare(`INSERT INTO lojas (slug, nome, email, senha_hash, tipo, slogan, abre, fecha, categorias)
      VALUES (?, ?, ?, ?, ?, ?, '08:00', '18:00', ?)`).bind(slug, nome, email, senhaHash, tipo,
      tipo === 'produtos' ? 'Veja em tamanho real antes de comprar' : 'Veja antes de pedir',
      JSON.stringify(tipo === 'produtos' ? ['Destaques', 'Novidades', 'Promoções'] : ['Salgados', 'Doces', 'Bebidas'])).run();
  }
  return { atualizado: Boolean(existia) };
}

// ---------------------------------------------------------------------------
// Tarefas de geração 3D e configuração
// ---------------------------------------------------------------------------
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
