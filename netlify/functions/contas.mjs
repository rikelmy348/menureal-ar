/* =========================================================================
   MenuReal AR — contas dos estabelecimentos (somente o dono da plataforma)
   GET  /api/contas   lista as lojas            (código MENUREAL_CODIGO)
   POST /api/contas   cria ou redefine a senha  { slug, nome, email, senha }
   ========================================================================= */
import { loja, json, ehMestre, slugValido, hashSenha } from '../lib/comum.mjs';

export default async (req) => {
  if (!process.env.MENUREAL_CODIGO) return json({ erro: 'Servidor não configurado: defina MENUREAL_CODIGO.' }, 500);
  if (!ehMestre(req)) return json({ erro: 'Código de acesso incorreto.' }, 401);
  const store = loja();

  if (req.method === 'GET') {
    const { blobs } = await store.list({ prefix: 'contas/' });
    const contas = [];
    for (const b of blobs) {
      const c = await store.get(b.key, { type: 'json' });
      if (c) contas.push({ slug: c.slug, nome: c.nome, email: c.email, criadoEm: c.criadoEm });
    }
    contas.sort((a, b) => a.nome.localeCompare(b.nome));
    return json({ contas });
  }

  if (req.method === 'POST') {
    let d;
    try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
    const slug = String(d.slug || '').trim().toLowerCase();
    const nome = String(d.nome || '').trim().slice(0, 60);
    const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
    const senha = String(d.senha || '');
    if (!slugValido(slug)) return json({ erro: 'Endereço inválido: use de 3 a 40 letras minúsculas, números e hífens (ex.: sabor-da-vila).' }, 400);
    if (!nome) return json({ erro: 'Informe o nome do estabelecimento.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ erro: 'E-mail inválido.' }, 400);
    if (senha.length < 8) return json({ erro: 'A senha precisa ter pelo menos 8 caracteres.' }, 400);

    const dono = await store.get('emails/' + email, { type: 'json' });
    if (dono && dono.slug !== slug) return json({ erro: 'Este e-mail já é usado pela loja "' + dono.slug + '".' }, 409);
    const atual = await store.get('contas/' + slug, { type: 'json' });
    if (atual && atual.email !== email) await store.delete('emails/' + atual.email);

    const conta = { slug, nome, email, senha: hashSenha(senha), criadoEm: (atual && atual.criadoEm) || new Date().toISOString() };
    await store.setJSON('contas/' + slug, conta);
    await store.setJSON('emails/' + email, { slug });
    if (!(await store.get('cardapios/' + slug, { type: 'json' }))) {
      await store.setJSON('cardapios/' + slug, {
        padaria: { nome, slogan: 'Veja antes de pedir', abre: '07:00', fecha: '19:00', dias: [1, 2, 3, 4, 5, 6], whatsapp: '' },
        categorias: ['Salgados', 'Doces', 'Bebidas'],
        produtos: [],
        atualizadoEm: new Date().toISOString()
      });
    }
    return json({ ok: true, slug, nome, email, atualizado: Boolean(atual) });
  }

  return json({ erro: 'Use GET ou POST.' }, 405);
};

export const config = { path: '/api/contas' };
