/* =========================================================================
   MenuReal AR — acesso ao banco de dados (Netlify Database / PostgreSQL)
   Lojas, contas e produtos ficam no banco; arquivos 3D ficam no Netlify Blobs.
   ========================================================================= */
import { getDatabase } from '@netlify/database';
import { loja as blobs } from './comum.mjs';

export const DEMO = '_demo'; // slug interno do cardápio de demonstração da página inicial

let conexao = null;
export function banco() {
  // MENUREAL_DB_URL só é usada em testes locais; na Netlify a conexão é automática
  if (!conexao) conexao = getDatabase(process.env.MENUREAL_DB_URL ? { connectionString: process.env.MENUREAL_DB_URL } : undefined);
  return conexao;
}
function slugBanco(slug) { return slug || DEMO; }

async function consulta(texto, params = []) {
  const r = await banco().pool.query(texto, params);
  return r.rows;
}

async function transacao(fn) {
  const cliente = await banco().pool.connect();
  try {
    await cliente.query('BEGIN');
    const r = await fn(cliente);
    await cliente.query('COMMIT');
    return r;
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

// ---------------------------------------------------------------------------
// Importação única dos dados que existiam no Netlify Blobs (versão anterior)
// ---------------------------------------------------------------------------
let migracaoFeita = false;
export async function garantirMigracao() {
  if (migracaoFeita) return;
  const flag = await consulta("SELECT 1 FROM configuracao WHERE chave = 'migrado_blobs'");
  if (flag.length) { migracaoFeita = true; return; }
  const store = blobs();
  const demo = await store.get('cardapio', { type: 'json' }).catch(() => null);
  if (demo) await salvarCardapio('', demo, { criarSeFaltar: true, nome: (demo.padaria && demo.padaria.nome) || 'Demonstração' });
  const { blobs: lista } = await store.list({ prefix: 'contas/' }).catch(() => ({ blobs: [] }));
  for (const b of lista) {
    const c = await store.get(b.key, { type: 'json' }).catch(() => null);
    if (!c || !c.slug) continue;
    await consulta(
      `INSERT INTO lojas (slug, nome, email, senha_hash, criada_em) VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()))
       ON CONFLICT (slug) DO NOTHING`,
      [c.slug, c.nome, c.email, c.senha, c.criadoEm || null]
    );
    const cardapio = await store.get('cardapios/' + c.slug, { type: 'json' }).catch(() => null);
    if (cardapio) await salvarCardapio(c.slug, cardapio);
  }
  await consulta("INSERT INTO configuracao (chave, valor) VALUES ('migrado_blobs', $1) ON CONFLICT DO NOTHING",
    [JSON.stringify({ em: new Date().toISOString(), lojas: lista.length, demo: Boolean(demo) })]);
  migracaoFeita = true;
}

// ---------------------------------------------------------------------------
// Cardápio / catálogo
// ---------------------------------------------------------------------------
const n = (v) => Number(v);

export async function lerCardapio(slug) {
  const [l] = await consulta('SELECT * FROM lojas WHERE slug = $1', [slugBanco(slug)]);
  if (!l) return null;
  const produtos = await consulta('SELECT * FROM produtos WHERE loja = $1 ORDER BY posicao', [l.slug]);
  return {
    padaria: { nome: l.nome, slogan: l.slogan, abre: l.abre, fecha: l.fecha, dias: l.dias.map(n), whatsapp: l.whatsapp, tipo: l.tipo },
    categorias: l.categorias,
    produtos: produtos.map((p) => ({
      id: p.id, nome: p.nome, categoria: p.categoria, preco: n(p.preco), descricao: p.descricao,
      dim: { largura: n(p.largura_cm), profundidade: n(p.profundidade_cm), altura: n(p.altura_cm) },
      modelo: p.modelo, ilustrativo: p.ilustrativo, ingredientes: p.ingredientes, alergenos: p.alergenos, tamanhos: p.tamanhos
    })),
    atualizadoEm: l.atualizada_em
  };
}

function dimOk(d, k) { const v = Number(d && d[k]); return v > 0 && v < 100000 ? Math.round(v * 100) / 100 : 5; }
function texto(v, max) { return String(v == null ? '' : v).slice(0, max); }

/** Substitui o cardápio inteiro da loja (dados no formato usado pelo site). */
export async function salvarCardapio(slug, dados, opcoes = {}) {
  const s = slugBanco(slug);
  const p = dados.padaria || {};
  const tipo = p.tipo === 'produtos' ? 'produtos' : 'alimentos';
  const dias = (Array.isArray(p.dias) ? p.dias : []).map(Number).filter((d) => d >= 0 && d <= 6);
  const categorias = (Array.isArray(dados.categorias) ? dados.categorias : ['Salgados', 'Doces', 'Pães', 'Bebidas']).map((c) => texto(c, 40)).filter(Boolean).slice(0, 30);
  return transacao(async (c) => {
    if (opcoes.criarSeFaltar) {
      await c.query('INSERT INTO lojas (slug, nome) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING', [s, texto(opcoes.nome || p.nome || 'Loja', 60)]);
    }
    const r = await c.query(
      `UPDATE lojas SET nome = $2, slogan = $3, abre = $4, fecha = $5, dias = $6, whatsapp = $7, tipo = $8, categorias = $9, atualizada_em = now()
       WHERE slug = $1 RETURNING atualizada_em`,
      [s, texto(p.nome, 60) || 'Loja', texto(p.slogan, 90), /^\d{2}:\d{2}$/.test(p.abre) ? p.abre : '08:00',
        /^\d{2}:\d{2}$/.test(p.fecha) ? p.fecha : '18:00', dias, String(p.whatsapp || '').replace(/\D/g, '').slice(0, 15), tipo, categorias]
    );
    if (!r.rowCount) { const e = new Error('Estabelecimento não encontrado.'); e.status = 404; throw e; }
    await c.query('DELETE FROM produtos WHERE loja = $1', [s]);
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
      await c.query(
        `INSERT INTO produtos (loja, id, posicao, nome, categoria, preco, descricao, largura_cm, profundidade_cm, altura_cm,
           modelo, ilustrativo, ingredientes, alergenos, tamanhos)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [s, id, pos++, texto(x.nome, 60), texto(x.categoria, 40) || categorias[0] || 'Geral', Math.min(99999999, Math.max(0, Number(x.preco) || 0)),
          texto(x.descricao, 240), dimOk(x.dim, 'largura'), dimOk(x.dim, 'profundidade'), dimOk(x.dim, 'altura'),
          texto(x.modelo, 300), x.ilustrativo !== false, texto(x.ingredientes, 600),
          (Array.isArray(x.alergenos) ? x.alergenos : []).map((a) => texto(a, 40)).slice(0, 20), JSON.stringify(tamanhos)]
      );
    }
    return r.rows[0].atualizada_em;
  });
}

// ---------------------------------------------------------------------------
// Contas das lojas
// ---------------------------------------------------------------------------
export async function listarLojas() {
  return consulta(`SELECT l.slug, l.nome, l.email, l.tipo, l.criada_em AS "criadoEm",
      (SELECT count(*)::int FROM produtos p WHERE p.loja = l.slug) AS produtos
    FROM lojas l WHERE l.slug <> $1 ORDER BY l.nome`, [DEMO]);
}
export async function contaPorEmail(email) {
  const [c] = await consulta('SELECT slug, nome, email, senha_hash FROM lojas WHERE email = $1', [email]);
  return c || null;
}
export async function contaPorSlug(slug) {
  const [c] = await consulta('SELECT slug, nome, email, tipo FROM lojas WHERE slug = $1', [slug]);
  return c || null;
}
/** Cria a loja ou atualiza nome, e-mail e senha de uma existente. */
export async function salvarConta({ slug, nome, email, senhaHash, tipo }) {
  const r = await consulta(
    `INSERT INTO lojas (slug, nome, email, senha_hash, tipo, slogan, abre, fecha, categorias)
     VALUES ($1, $2, $3, $4, $5, $6, '08:00', '18:00', $7)
     ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome, email = EXCLUDED.email, senha_hash = EXCLUDED.senha_hash, atualizada_em = now()
     RETURNING (xmax <> 0) AS atualizado`,
    [slug, nome, email, senhaHash, tipo,
      tipo === 'produtos' ? 'Veja em tamanho real antes de comprar' : 'Veja antes de pedir',
      tipo === 'produtos' ? ['Destaques', 'Novidades', 'Promoções'] : ['Salgados', 'Doces', 'Bebidas']]
  );
  return { atualizado: r[0].atualizado };
}

// ---------------------------------------------------------------------------
// Tarefas de geração 3D (cache do resultado)
// ---------------------------------------------------------------------------
export async function lerTarefa(id) {
  const [t] = await consulta('SELECT resultado FROM tarefas_3d WHERE id = $1', [id]);
  return t ? t.resultado : null;
}
export async function salvarTarefa(id, slug, resultado) {
  await consulta('INSERT INTO tarefas_3d (id, loja, resultado) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET resultado = EXCLUDED.resultado',
    [id, slug || '', JSON.stringify(resultado)]);
}

export async function bancoOk() {
  try { await consulta('SELECT 1'); return true; } catch (e) { console.error('banco:', e.message); return false; }
}
