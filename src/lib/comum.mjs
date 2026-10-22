/* =========================================================================
   MenuReal AR — utilidades do servidor (Cloudflare Workers)
   Respostas JSON, login (WebCrypto), escala e combo de modelos GLB.
   ========================================================================= */
import { lerGlb, escreverGlb, caixaGlb, juntarGlbs, montarAcai, ADICIONAIS_3D } from '../../public/glb.mjs';
export { caixaGlb, juntarGlbs, montarAcai, ADICIONAIS_3D };

export function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function erroComStatus(msg, status) { const e = new Error(msg); e.status = status; return e; }

// ---------------------------------------------------------------------------
// Endereços das lojas
// ---------------------------------------------------------------------------
export const SLUG_OK = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVADOS = new Set(['api', 'assets', 'vendor', 'tools', 'index', 'admin', 'entrar', 'menureal', 'demo']);
export function slugValido(s) { return SLUG_OK.test(s || '') && !RESERVADOS.has(s); }
export function lerSlug(req) {
  const s = (new URL(req.url).searchParams.get('loja') || '').toLowerCase();
  if (s && !slugValido(s)) throw erroComStatus('Loja inválida.', 400);
  return s;
}

// ---------------------------------------------------------------------------
// Senhas (PBKDF2-SHA256) e token de login (HMAC-SHA256), só com WebCrypto
// ---------------------------------------------------------------------------
const enc = new TextEncoder();
const ITERACOES = 20000; // leve o bastante para o plano gratuito; o número fica gravado no hash

function b64(bytes) { let s = ''; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b); return btoa(s); }
function deB64(t) { return Uint8Array.from(atob(t), (c) => c.charCodeAt(0)); }
function b64url(bytes) { return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function deB64url(t) { return deB64(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)); }

async function pbkdf2(senha, sal, iteracoes) {
  const chave = await crypto.subtle.importKey('raw', enc.encode(String(senha)), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, chave, 256));
}
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
export async function hashSenha(senha) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  return 'pbkdf2$' + ITERACOES + '$' + b64(sal) + '$' + b64(await pbkdf2(senha, sal, ITERACOES));
}
export async function conferirSenha(senha, guardado) {
  const [tipo, it, sal, h] = String(guardado || '').split('$');
  if (tipo !== 'pbkdf2' || !sal || !h) return false;
  return iguais(await pbkdf2(senha, deB64(sal), Number(it)), deB64(h));
}

function segredo(env) { return env.MENUREAL_SEGREDO || ('menureal:' + (env.MENUREAL_CODIGO || '')); }
async function chaveHmac(env) {
  return crypto.subtle.importKey('raw', enc.encode(segredo(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function criarToken(env, slug, dias = 30) {
  const corpo = b64url(enc.encode(JSON.stringify({ s: slug, e: Date.now() + dias * 864e5 })));
  const assin = b64url(await crypto.subtle.sign('HMAC', await chaveHmac(env), enc.encode(corpo)));
  return corpo + '.' + assin;
}
export async function lerToken(env, token) {
  const [corpo, assin] = String(token || '').split('.');
  if (!corpo || !assin) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await chaveHmac(env), deB64url(assin), enc.encode(corpo)); } catch { return null; }
  if (!ok) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(deB64url(corpo)));
    return d.e > Date.now() ? d.s : null;
  } catch { return null; }
}

/** Mestre = código MENUREAL_CODIGO (dono da plataforma). */
export function ehMestre(req, env) {
  const c = env.MENUREAL_CODIGO;
  return Boolean(c) && (req.headers.get('x-menureal-codigo') || '') === c;
}
/** Autoriza a edição de uma loja ('' = demonstração). Lança erro com status se negado. */
export async function autorizar(req, env, slug) {
  if (ehMestre(req, env)) return;
  const s = await lerToken(env, (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  if (s && slug && s === slug) return;
  if (!env.MENUREAL_CODIGO) throw erroComStatus('Servidor não configurado: defina MENUREAL_CODIGO nas variáveis da Cloudflare.', 500);
  throw erroComStatus(s ? 'Sem permissão para esta loja.' : slug ? 'Entre na conta do estabelecimento.' : 'Código de acesso incorreto.', 401);
}

export async function hashCurto(texto) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(texto)));
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20);
}

// ---------------------------------------------------------------------------
// Modelos 3D guardados no KV (binding MODELOS)
// ---------------------------------------------------------------------------
export const PREFIXO_ARQUIVO = 'api/arquivo/';
export async function guardarModelo(env, chave, bytes, meta = {}) {
  await env.MODELOS.put(chave, bytes, { metadata: meta });
  return PREFIXO_ARQUIVO + chave;
}
/** Lê um modelo: da nuvem (api/arquivo/...) ou dos arquivos do site (assets/models/...). */
export async function lerModelo(env, url) {
  url = String(url || '').replace(/^\//, '');
  if (url.includes('..')) return null;
  const nuvem = /^api\/arquivo\/((?:modelos|combos)\/(?:[a-z0-9-]+\/)?[\w.-]+\.glb)$/.exec(url);
  if (nuvem) { const ab = await env.MODELOS.get(nuvem[1], 'arrayBuffer'); return ab ? new Uint8Array(ab) : null; }
  if (/^assets\/models\/[\w.-]+\.glb$/.test(url)) {
    const r = await env.ASSETS.fetch(new Request('https://site/' + url));
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// GLB: leitura, caixa delimitadora e escala para medidas reais (em metros)
// ---------------------------------------------------------------------------
/**
 * Ajusta o GLB para medidas reais: escala uniforme (mantém as proporções da foto)
 * para que a maior dimensão do modelo seja a maior medida cadastrada; apoia a
 * base em y=0 e centraliza em x/z. dimCm = { largura, profundidade, altura }.
 */
/**
 * Materiais mais realistas: o padrão do glTF para "metálico" é 1 (vira espelho escuro) quando
 * o arquivo não informa; e comida nunca é metal (evita aspecto de plástico/cromado).
 */
export function ajustarMateriais(json, { comida = false } = {}) {
  for (const m of json.materials || []) {
    const pbr = (m.pbrMetallicRoughness = m.pbrMetallicRoughness || {});
    if (comida) {
      pbr.metallicFactor = 0;
      // sem mapa: fosco moderado; com mapa: usa o mapa sem deixar tudo brilhando
      if (pbr.roughnessFactor != null && pbr.roughnessFactor < 0.45) pbr.roughnessFactor = pbr.metallicRoughnessTexture ? 1 : 0.6;
      else if (pbr.roughnessFactor == null && !pbr.metallicRoughnessTexture) pbr.roughnessFactor = 0.6;
    } else if (!pbr.metallicRoughnessTexture && pbr.metallicFactor == null) {
      pbr.metallicFactor = 0;
    }
  }
}

export function escalarGlb(buf, dimCm, opcoes = {}) {
  const { json, bin } = lerGlb(buf);
  ajustarMateriais(json, opcoes);
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

