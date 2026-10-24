/* GET  /api/cadastro?slug=x   → { livre, suporte }   (endereço disponível?)
   POST /api/cadastro          { nome, slug, tipo, whatsapp, email, senha }
        → { token, slug, nome, codigo, testeAte }
   O próprio lojista cria a conta, com 7 dias de teste grátis.
   Limite: 3 contas por IP por dia. */
import { json, slugValido, hashSenha, criarToken, ipDe, gerarCodigo, hashCodigo } from '../lib/comum.mjs';
import { contaPorEmail, lojaExiste, salvarConta, salvarCardapio, lerCardapio, lerConfig, dentroDoLimite } from '../lib/banco.mjs';

export const DIAS_TESTE = 7;

// Açaí de exemplo para quem escolhe "Açaí e sorveteria": a loja já vê o montador funcionando
const ACAI_INICIAL = {
  id: 'acai-monte-o-seu', nome: 'Açaí — monte o seu', categoria: 'Açaí', preco: 16,
  descricao: 'Escolha o tamanho e monte camada por camada. Depois veja na mesa, no tamanho real.',
  dim: { largura: 9.6, profundidade: 9.6, altura: 11.7 }, modelo: 'assets/models/acai-pet-500.glb', ilustrativo: true, montar: true,
  tamanhos: [
    { id: '300', nome: '300 ml', preco: 13, dim: { largura: 8.6, profundidade: 8.6, altura: 9.6 }, modelo: 'assets/models/acai-pet-300.glb' },
    { id: '500', nome: '500 ml', preco: 16, dim: { largura: 9.6, profundidade: 9.6, altura: 11.7 }, modelo: 'assets/models/acai-pet-500.glb' },
    { id: '700', nome: '700 ml', preco: 20, dim: { largura: 10.6, profundidade: 10.6, altura: 13.5 }, modelo: 'assets/models/acai-pet-700.glb' }
  ],
  adicionais: [
    { id: 'creme-ninho', nome: 'Creme de ninho', preco: 4, tipo3d: 'camada_creme' },
    { id: 'morango', nome: 'Morango', preco: 3, tipo3d: 'morango_picado' },
    { id: 'banana', nome: 'Banana', preco: 2, tipo3d: 'banana' },
    { id: 'nutella', nome: 'Nutella', preco: 5, tipo3d: 'nutella' },
    { id: 'leite-condensado', nome: 'Leite condensado', preco: 2.5, tipo3d: 'leite_condensado' },
    { id: 'leite-po', nome: 'Leite em pó', preco: 2.5, tipo3d: 'leite_po' },
    { id: 'granola', nome: 'Granola', preco: 2, tipo3d: 'granola' },
    { id: 'pacoca', nome: 'Paçoca', preco: 2, tipo3d: 'pacoca' },
    { id: 'confete', nome: 'Confete', preco: 2.5, tipo3d: 'confete' },
    { id: 'calda-chocolate', nome: 'Calda de chocolate', preco: 3, tipo3d: 'calda_chocolate' }
  ]
};

// Sorvete e milkshake de exemplo (mesmos recipientes e sabores de public/sorvete.mjs)
const tam = (id, nome, preco, recipiente, bolas, dim, modelo) => ({ id, nome, preco, recipiente, bolas, dim, modelo });
const SABOR = (k, nome, preco = 0) => ({ id: 's-' + k, nome, preco, tipo3d: 'sabor_' + k });
const COB = (k, nome, preco) => ({ id: 'c-' + k, nome, preco, tipo3d: 'cob_' + k });
const SORVETE_INICIAL = {
  id: 'sorvete-monte-o-seu', nome: 'Sorvete — monte o seu', categoria: 'Sorvetes', preco: 11, montar: true, modo: 'sorvete', ilustrativo: true,
  descricao: 'Casquinha ou taça: escolha os sabores, uma bola de cada vez, e a cobertura por cima.',
  dim: { largura: 6.2, profundidade: 6.2, altura: 16 }, modelo: 'assets/models/sorvete-casquinha.glb',
  tamanhos: [
    tam('c1', 'Casquinha 1 bola', 7, 'casquinha', 1, { largura: 6.2, profundidade: 6.2, altura: 16 }, 'assets/models/sorvete-casquinha.glb'),
    tam('c2', 'Casquinha 2 bolas', 11, 'casquinha', 2, { largura: 6.2, profundidade: 6.2, altura: 16 }, 'assets/models/sorvete-casquinha.glb'),
    tam('t3', 'Taça 3 bolas', 18, 'taca', 3, { largura: 12.4, profundidade: 12.4, altura: 15 }, 'assets/models/sorvete-taca.glb')
  ],
  adicionais: [SABOR('creme', 'Creme'), SABOR('chocolate', 'Chocolate'), SABOR('morango', 'Morango'), SABOR('flocos', 'Flocos'), SABOR('napolitano', 'Napolitano'),
    SABOR('pistache', 'Pistache', 2), SABOR('menta', 'Menta com chocolate'), SABOR('coco', 'Coco'), SABOR('doce_de_leite', 'Doce de leite'), SABOR('cookies', 'Cookies', 2),
    COB('calda_chocolate', 'Calda de chocolate', 2), COB('calda_morango', 'Calda de morango', 2), COB('chantilly', 'Chantilly', 3), COB('granulado', 'Granulado', 1.5),
    COB('confete', 'Confete colorido', 2), COB('wafer', 'Biscoito wafer', 2.5), COB('cereja', 'Cereja', 1.5)]
};
const MILK_INICIAL = {
  id: 'milkshake', nome: 'Milkshake', categoria: 'Milkshakes', preco: 18, montar: true, modo: 'milkshake', ilustrativo: true,
  descricao: 'Escolha até 2 sabores, chantilly, calda e cereja. Vem com canudo.',
  dim: { largura: 8.2, profundidade: 8.2, altura: 20 }, modelo: 'assets/models/milkshake-500.glb',
  tamanhos: [
    tam('300', '300 ml', 14, 'milkshake300', 2, { largura: 7.8, profundidade: 7.8, altura: 17.5 }, 'assets/models/milkshake-300.glb'),
    tam('500', '500 ml', 18, 'milkshake', 2, { largura: 8.2, profundidade: 8.2, altura: 20 }, 'assets/models/milkshake-500.glb')
  ],
  adicionais: [SABOR('chocolate', 'Chocolate'), SABOR('morango', 'Morango'), SABOR('creme', 'Creme'), SABOR('doce_de_leite', 'Doce de leite'),
    COB('chantilly', 'Chantilly', 0), COB('calda_chocolate', 'Calda de chocolate', 2), COB('calda_morango', 'Calda de morango', 2), COB('granulado', 'Granulado', 1.5), COB('cereja', 'Cereja', 1.5)]
};

export default async function cadastro(req, env) {
  if (req.method === 'GET') {
    const slug = String(new URL(req.url).searchParams.get('slug') || '').toLowerCase();
    const suporte = (await lerConfig(env, 'suporte')) || '';
    if (!slug) return json({ suporte });
    return json({ livre: slugValido(slug) && !(await lojaExiste(env, slug)), valido: slugValido(slug), suporte });
  }
  if (req.method !== 'POST') return json({ erro: 'Use GET ou POST.' }, 405);
  if (!env.MENUREAL_CODIGO && !env.MENUREAL_SEGREDO) return json({ erro: 'Servidor não configurado: defina MENUREAL_CODIGO nas variáveis da Cloudflare.' }, 500);

  let d;
  try { d = await req.json(); } catch { return json({ erro: 'Requisição inválida.' }, 400); }
  const nome = String(d.nome || '').trim().slice(0, 60);
  const slug = String(d.slug || '').trim().toLowerCase();
  const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  const senha = String(d.senha || '');
  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '');
  const sorveteria = d.tipo === 'sorveteria';
  const tipo = d.tipo === 'produtos' ? 'produtos' : 'alimentos';
  if (String(d.site || '')) return json({ erro: 'Requisição inválida.' }, 400); // campo isca: robôs preenchem

  if (!nome) return json({ erro: 'Informe o nome da loja.', campo: 'nome' }, 400);
  if (!slugValido(slug)) return json({ erro: 'Endereço inválido: use de 3 a 40 letras minúsculas, números e hífens.', campo: 'slug' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ erro: 'E-mail inválido.', campo: 'email' }, 400);
  if (senha.length < 8) return json({ erro: 'A senha precisa ter pelo menos 8 caracteres.', campo: 'senha' }, 400);
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) return json({ erro: 'WhatsApp inválido. Use DDD + número.', campo: 'whatsapp' }, 400);
  if (await lojaExiste(env, slug)) return json({ erro: 'Este endereço já está em uso. Escolha outro.', campo: 'slug' }, 409);
  if (await contaPorEmail(env, email)) return json({ erro: 'Já existe uma loja com este e-mail. Entre pela loja ou recupere a senha.', campo: 'email' }, 409);
  if (!(await dentroDoLimite(env, 'cadastro:' + ipDe(req), 3, 864e5))) {
    return json({ erro: 'Muitas contas criadas a partir desta conexão hoje. Tente amanhã ou fale com o suporte.' }, 429);
  }

  const codigo = gerarCodigo();
  const zap = whatsapp && whatsapp.length <= 11 ? '55' + whatsapp : whatsapp;
  await salvarConta(env, { slug, nome, email, senhaHash: await hashSenha(senha), tipo, sorveteria, teste: DIAS_TESTE, whatsapp: zap,
    codigoHash: await hashCodigo(slug, codigo) });
  if (sorveteria) {
    const atual = await lerCardapio(env, slug);
    await salvarCardapio(env, slug, { ...atual, produtos: [ACAI_INICIAL, SORVETE_INICIAL, MILK_INICIAL] });
  }
  const conta = await contaPorEmail(env, email);
  return json({ ok: true, token: await criarToken(env, slug), slug, nome, codigo, testeAte: conta && conta.teste_ate });
}
