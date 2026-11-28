/* =========================================================================
   MenuReal AR — app.js
   JavaScript puro. Sem frameworks. Dados no navegador (localStorage).
   ========================================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Configuração
  // ---------------------------------------------------------------------
  var MV_VERSAO = '4.4.0';
  // 1º: CDN jsDelivr (pacote oficial @google/model-viewer no npm)
  // 2º: cópia local em vendor/ (funciona offline em servidor local)
  var MV_FONTES = [
    'https://cdn.jsdelivr.net/npm/@google/model-viewer@' + MV_VERSAO + '/dist/model-viewer.min.js',
    new URL('vendor/model-viewer.min.js', document.baseURI).href
  ];
  // Endereço do estabelecimento: https://site/<loja>  ('' = demonstração na página inicial)
  var CAMINHO = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, '').toLowerCase();
  var PAGINAS_SISTEMA = ['criar', 'cadastro', 'recuperar'];
  var LOJA = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(CAMINHO) && PAGINAS_SISTEMA.indexOf(CAMINHO) < 0 ? CAMINHO : '';
  var ABRIR_CADASTRO = CAMINHO === 'criar' || CAMINHO === 'cadastro';
  var BEM_VINDO = /[?&]bemvindo=1/.test(location.search);
  var SUFIXO = LOJA ? ':' + LOJA : '';
  var CHAVE_DADOS = 'menureal:dados:v1' + SUFIXO;
  var CHAVE_CARRINHO = 'menureal:carrinho:v1' + SUFIXO;
  var CHAVE_TOKEN = 'menureal:token' + SUFIXO;
  var CATEGORIAS_PADRAO = ['Açaí', 'Sorvetes', 'Milkshakes'];
  var CATEGORIAS = CATEGORIAS_PADRAO.slice();
  // Alérgenos de declaração obrigatória no Brasil (RDC Anvisa 26/2015), agrupados
  var ALERGENOS = ['Glúten', 'Leite', 'Ovos', 'Soja', 'Amendoim', 'Castanhas e nozes', 'Peixes', 'Crustáceos', 'Látex natural'];
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var TOLERANCIA_ESCALA = 0.05; // 5% de diferença aceitável entre arquivo e cadastro

  // Na versão de arquivo único, os GLBs vêm embutidos como data: URI
  var MODELOS_EMBUTIDOS = window.MENUREAL_MODELOS || null;
  var reduzMovimento = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var TIPOS_PIX = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['telefone', 'Celular'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']];

  // Demonstração: loja de móveis. Os modelos 3D são de móveis reais (Wayfair, via Khronos
  // glTF Sample Assets; créditos em assets/moveis/CREDITOS.txt). Preços FICTÍCIOS.
  // Medidas em centímetros: largura (X), profundidade (Z), altura (Y) — as do próprio produto.
  var PADRAO = {
    padaria: {
      nome: 'Casa & Sala Móveis',
      slogan: 'Veja na sua casa antes de comprar',
      abre: '09:00',
      fecha: '18:00',
      dias: [1, 2, 3, 4, 5, 6],
      whatsapp: '',
      tipo: 'produtos',
      pedido: { entrega: true, retirada: true, taxa: 0, bairros: [], minimo: 0, tempo: '', endereco: '', pix: { tipo: 'email', chave: '', nome: '', cidade: '' } }
    },
    categorias: ['Sofás', 'Poltronas', 'Puffs', 'Decoração'],
    produtos: [
      { id: 'sofa-veludo', nome: 'Sofá 3 lugares Veludo', categoria: 'Sofás', preco: 3899,
        descricao: 'Veludo macio, braços curvos e pés dourados. Escolha a cor e veja na sua sala.',
        dim: { largura: 218.8, profundidade: 102.3, altura: 78.8 }, modelo: 'assets/moveis/sofa-veludo.glb', ilustrativo: false,
        ingredientes: 'Estrutura em madeira, espuma D33, tecido veludo, pés em metal dourado' },
      { id: 'poltrona', nome: 'Poltrona Concha', categoria: 'Poltronas', preco: 1490,
        descricao: 'Encosto envolvente em veludo. Duas cores à escolha.',
        dim: { largura: 82.7, profundidade: 57, altura: 68.6 }, modelo: 'assets/moveis/poltrona.glb', ilustrativo: false,
        ingredientes: 'Veludo, espuma, pés em madeira' },
      { id: 'poltrona-damasco', nome: 'Poltrona Damasco', categoria: 'Poltronas', preco: 1690,
        descricao: 'Tecido adamascado roxo e dourado, para dar destaque ao ambiente.',
        dim: { largura: 82.9, profundidade: 57.2, altura: 68.7 }, modelo: 'assets/moveis/poltrona-damasco.glb', ilustrativo: false,
        ingredientes: 'Tecido adamascado, espuma, pés em madeira' },
      { id: 'puff-seda', nome: 'Puff Redondo Seda', categoria: 'Puffs', preco: 590,
        descricao: 'Puff baixo, de 61 cm, que serve de apoio ou assento extra.',
        dim: { largura: 61, profundidade: 61, altura: 19.8 }, modelo: 'assets/moveis/puff-seda.glb', ilustrativo: false,
        ingredientes: 'Tecido acetinado, enchimento em fibra' },
      { id: 'vaso-flores', nome: 'Vaso de Vidro com Flores', categoria: 'Decoração', preco: 189,
        descricao: 'Arranjo de mesa para a sala de estar ou de jantar.',
        dim: { largura: 21.7, profundidade: 14.2, altura: 20.3 }, modelo: 'assets/moveis/vaso-flores.glb', ilustrativo: false,
        ingredientes: 'Vidro, flores artificiais' }
    ]
  };

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function brl(v) { return moeda.format(v || 0); }
  function num(v) { return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function dimTexto(d) { return num(d.largura) + ' × ' + num(d.profundidade) + ' × ' + num(d.altura) + ' cm'; }
  function slug(s) { return semAcento(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'produto'; }
  function lerPreco(v) {
    var s = String(v).trim().replace(/[R$\s]/g, '');
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }

  function ler(chave) {
    try { var v = localStorage.getItem(chave); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  }
  function apagar(chave) { try { localStorage.removeItem(chave); } catch (e) { /* ignora */ } }

  // Luz de estúdio fotográfico (HDR criado para o projeto: tools/gerar_estudio_hdr.py)
  function ESTUDIO() { return urlModelo('assets/estudio.hdr'); }

  function urlModelo(caminho) {
    if (!caminho) return '';
    if (MODELOS_EMBUTIDOS && MODELOS_EMBUTIDOS[caminho]) return MODELOS_EMBUTIDOS[caminho];
    return caminho;
  }

  var ICONES = {
    fechar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    cubo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M4 7.4 12 12l8-4.6M12 12v9.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    ar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 7.5 16 9.8v4.4L12 16.5 8 14.2V9.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.3-2h5.2l1.3 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12.3" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    sacola: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
  };

  // ---------------------------------------------------------------------
  // Estado
  // ---------------------------------------------------------------------
  var COR_OK = /^#[0-9a-f]{6}$/i;
  var FONTES_LOJA = {
    moderno: { nome: 'Moderno', css: 'var(--fonte)' },
    elegante: { nome: 'Elegante', css: '"Playfair Display MR", Georgia, serif' },
    divertido: { nome: 'Divertido', css: '"Fredoka MR", ui-rounded, system-ui, sans-serif' },
    classico: { nome: 'Clássico', css: '"Lora MR", Georgia, serif' }
  };
  var PALETAS = [
    { nome: 'Padrão (grafite)', cor: '', destaque: '' },
    { nome: 'Nogueira', cor: '#4A3326', destaque: '#D8B78E' },
    { nome: 'Areia', cor: '#7A6047', destaque: '#F3EADC' },
    { nome: 'Terracota', cor: '#A9502F', destaque: '#F6D6A8' },
    { nome: 'Oliva', cor: '#4B5A2A', destaque: '#EBDDA8' },
    { nome: 'Musgo', cor: '#2F4A3A', destaque: '#D9C7A3' },
    { nome: 'Petróleo', cor: '#1F4A57', destaque: '#E6C79C' },
    { nome: 'Marinho', cor: '#1D3B6E', destaque: '#E6C79C' },
    { nome: 'Vinho', cor: '#6B1E2E', destaque: '#E8B04A' },
    { nome: 'Chumbo', cor: '#43464B', destaque: '#E2D6C2' },
    { nome: 'Noite', cor: '#121212', destaque: '#D8B78E' }
  ];
  var TIPOS_PECA = { porta: 'Porta', gaveta: 'Gaveta', prateleira: 'Prateleira', lateral: 'Lateral', divisoria: 'Divisória', fundo: 'Fundo', tampo: 'Tampo', estrutura: 'Estrutura',
    puxador: 'Puxador', rodape: 'Rodapé', eletro: 'Eletrodoméstico', acessorio: 'Acessório', painel: 'Painel', led: 'Iluminação', frente: 'Frente', ferragem: 'Ferragem', estofado: 'Estofado', outra: 'Outra peça' };
  var MOV_PECA = { '': 'Não se mexe', porta_esq: 'Porta: dobradiça à esquerda', porta_dir: 'Porta: dobradiça à direita', basculante: 'Porta basculante (abre para cima)', gaveta: 'Gaveta (corre para a frente)' };
  var EXPLODIR_PECA = { '': 'Fica no lugar', auto: 'Para fora (automático)', frente: 'Para a frente', tras: 'Para trás', esquerda: 'Para a esquerda', direita: 'Para a direita', cima: 'Para cima', baixo: 'Para baixo' };
  function lerPecas(l) {
    var vistos = {};
    return (Array.isArray(l) ? l : []).map(function (x) {
      var no = Math.round(Number(x && x.no)), nome = String((x && x.nome) || '').trim().slice(0, 60);
      if (!(no >= 0 && no < 5000) || !nome || vistos[no]) return null;
      vistos[no] = 1;
      return { no: no, nomeNo: String(x.nomeNo || '').slice(0, 120), nome: nome, tipo: TIPOS_PECA[x.tipo] ? x.tipo : 'outra', desc: String(x.desc || '').slice(0, 240),
        material: String(x.material || '').slice(0, 80), destacar: x.destacar !== false, mov: MOV_PECA[x.mov] ? x.mov : '', explodir: EXPLODIR_PECA[x.explodir] !== undefined ? x.explodir : '' };
    }).filter(Boolean).slice(0, 200);
  }
  var TIPOS_FOTO = { frente: 'Frente', lateral: 'Lateral', traseira: 'Traseira', perspectiva: 'Perspectiva', detalhe: 'Detalhe / acabamento', ambiente: 'Ambiente (ilustrativa)', outra: 'Outra' };
  var COR_PADRAO = '#1F1E1B', DESTAQUE_PADRAO = '#D8B78E';
  // Compatibilidade: 3D precisa de WebGL (diferente de RA, que é WebXR/ARCore/Quick Look).
  // Sem WebGL, o cliente vê as fotos e as medidas; com pouca memória, a lista usa fotos (mais leve).
  var SEM_3D = (function () { try { var c = document.createElement('canvas'); return !(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return true; } })();
  var POUCA_MEMORIA = !!(navigator.deviceMemory && navigator.deviceMemory <= 1);

  var VAZIO = { padaria: { nome: 'Carregando…', slogan: '', abre: '00:00', fecha: '00:00', dias: [], whatsapp: '' }, categorias: [], produtos: [] };
  // Página inicial: sempre a demonstração da loja de móveis (não depende do que está salvo)
  var dados = LOJA ? (validarDados(ler(CHAVE_DADOS)) || validarDados(clonar(VAZIO))) : validarDados(clonar(PADRAO));
  CATEGORIAS = dados.categorias;
  var carrinho = ler(CHAVE_CARRINHO) || {};
  var filtro = { cat: 'Todos', q: '' };
  var mvStatus = 'carregando'; // 'carregando' | 'ok' | 'falhou'
  var produtoAtual = null;
  var servidor = false; // true quando /api/cardapio existe (site publicado com funções)

  function lerPontos(l) {
    var vet = function (v) { return Array.isArray(v) && v.length === 3 && v.every(function (n) { return isFinite(Number(n)); }) ? v.map(Number) : null; };
    return (Array.isArray(l) ? l : []).map(function (x) {
      var p = vet(x && x.p), t = String((x && x.t) || '').trim().slice(0, 80);
      return p && t ? { p: p, n: vet(x.n) || [0, 1, 0], t: t } : null;
    }).filter(Boolean).slice(0, 8);
  }
  function validarDados(d) {
    if (!d || typeof d !== 'object' || !d.padaria || !Array.isArray(d.produtos)) return null;
    var p = d.padaria;
    var padaria = {
      nome: String(p.nome || PADRAO.padaria.nome),
      slogan: String(p.slogan || ''),
      abre: /^\d{2}:\d{2}$/.test(p.abre) ? p.abre : PADRAO.padaria.abre,
      fecha: /^\d{2}:\d{2}$/.test(p.fecha) ? p.fecha : PADRAO.padaria.fecha,
      dias: Array.isArray(p.dias) ? p.dias.filter(function (x) { return x >= 0 && x <= 6; }) : PADRAO.padaria.dias.slice(),
      whatsapp: String(p.whatsapp || '').replace(/\D/g, ''),
      tipo: p.tipo === 'alimentos' ? 'alimentos' : 'produtos', // produtos = catálogo (móveis etc.); alimentos = cardápio (contas antigas)
      visual: validarVisual(p.visual),
      pedido: lerPedido(p.pedido),
      plano: (function (pl) {
        pl = pl || {};
        var ck = {};
        ['fundador', 'loja', 'anual'].forEach(function (t) { var v = pl.checkouts && String(pl.checkouts[t] || ''); if (/^https:\/\/pay\.kiwify\.com\.br\/[\w-]+\/?$/.test(v)) ck[t] = v; });
        return { situacao: ['teste', 'vencido', 'bloqueado'].indexOf(pl.situacao) > -1 ? pl.situacao : 'ativo', ate: String(pl.ate || ''), suporte: String(pl.suporte || '').replace(/\D/g, ''), checkouts: ck };
      })(p.plano)
    };
    var categorias = [];
    (Array.isArray(d.categorias) ? d.categorias : CATEGORIAS_PADRAO).forEach(function (c) {
      c = String(c || '').trim().slice(0, 40);
      if (c && categorias.indexOf(c) < 0 && categorias.length < 20) categorias.push(c);
    });
    if (!categorias.length) categorias = CATEGORIAS_PADRAO.slice();
    function lerDimObj(dim) {
      dim = dim || {};
      return { largura: Number(dim.largura) || 1, profundidade: Number(dim.profundidade) || 1, altura: Number(dim.altura) || 1 };
    }
    var ids = {};
    var produtos = d.produtos.filter(function (x) { return x && x.nome; }).map(function (x) {
      var id = String(x.id || slug(x.nome));
      while (ids[id]) id += '-2';
      ids[id] = 1;
      var cat = String(x.categoria || '').trim() || categorias[0];
      if (categorias.indexOf(cat) < 0) categorias.push(cat);
      var tids = {};
      return {
        id: id,
        nome: String(x.nome),
        categoria: cat,
        preco: Math.max(0, Number(x.preco) || 0),
        descricao: String(x.descricao || ''),
        dim: lerDimObj(x.dim),
        modelo: String(x.modelo || ''),
        ilustrativo: x.ilustrativo !== false,
        ingredientes: String(x.ingredientes || '').slice(0, 600),
        alergenos: (Array.isArray(x.alergenos) ? x.alergenos : []).filter(function (a) { return ALERGENOS.indexOf(a) > -1; }),
        tamanhos: (Array.isArray(x.tamanhos) ? x.tamanhos : []).filter(function (t) { return t && t.nome; }).slice(0, 8).map(function (t) {
          var tid = String(t.id || slug(t.nome));
          while (tids[tid]) tid += '-2';
          tids[tid] = 1;
          return { id: tid, nome: String(t.nome).slice(0, 30), preco: Math.max(0, Number(t.preco) || 0), dim: lerDimObj(t.dim), modelo: String(t.modelo || '') };
        }),
        adicionais: lerAdicionais(x.adicionais),   // opcionais com preço (ex.: montagem, pés de outra cor)
        versao: String(x.versao || '').trim().slice(0, 30),   // nome da versão principal (quando há outras versões)
        esgotado: x.esgotado === true, // acabou hoje: aparece, mas não dá para pedir
        foto: /^api\/arquivo\/imagens\/[\w\/.-]+$/.test(String(x.foto || '')) ? String(x.foto) : '',   // produto ainda sem 3D
        pontos: lerPontos(x.pontos),            // pontos de informação no 3D (ex.: "tecido impermeável")
        pontosDe: String(x.pontosDe || ''),      // o 3D em que os pontos foram marcados
        planejado: x.planejado && typeof x.planejado === 'object' && Array.isArray(x.planejado.trechos) ? x.planejado : null,   // ficha do montador de planejados
        planejadoDe: String(x.planejadoDe || ''),   // o 3D gerado a partir da ficha (o Raio-X só vale para ele)
        movel: x.movel && typeof x.movel === 'object' && Array.isArray(x.movel.secoes) ? x.movel : null,   // ficha do móvel montado pela foto (IA)
        movelDe: String(x.movelDe || ''),
        pecas: lerPecas(x.pecas),                   // Raio-X: partes do .glb identificadas pelo marceneiro
        pecasDe: String(x.pecasDe || ''),
        precoDe: Math.min(1000000, Math.max(0, Math.round((Number(x.precoDe) || 0) * 100) / 100)),   // preço antigo (oferta: "de R$ X por R$ Y")
        galeria: (Array.isArray(x.galeria) ? x.galeria : []).filter(function (f) { return f && /^api\/arquivo\/imagens\/[\w\/.-]+$/.test(String(f.url || '')); })
          .map(function (f) { return { url: String(f.url), tipo: TIPOS_FOTO[f.tipo] ? f.tipo : 'outra' }; }).slice(0, 12),   // mais fotos do móvel
        acabamentos: String(x.acabamentos || '').slice(0, 400)
      };
    });
    return { padaria: padaria, categorias: categorias, produtos: produtos };
  }

  // ---------------------------------------------------------------------
  // Aparência da loja: cores, estilo de letra, logo, capa e marca MenuReal
  // ---------------------------------------------------------------------
  function validarVisual(v) {
    v = v && typeof v === 'object' ? v : {};
    var img = function (u) { u = String(u || ''); return /^api\/arquivo\/imagens\/[a-z0-9_-]+\/[\w.-]+\.(webp|png|jpg)$/.test(u) ? u : ''; };
    return {
      cor: COR_OK.test(v.cor) ? v.cor.toUpperCase() : '',
      destaque: COR_OK.test(v.destaque) ? v.destaque.toUpperCase() : '',
      fonte: FONTES_LOJA[v.fonte] ? v.fonte : 'moderno',
      logo: img(v.logo),
      capa: img(v.capa),
      og: img(v.og),
      ogAss: String(v.ogAss || '').replace(/[^a-z0-9]/g, '').slice(0, 20),
      marca: v.marca !== false,
      cenario: ['logo', 'cor', 'claro'].indexOf(v.cenario) > -1 ? v.cenario : 'logo',
      blocos: validarBlocos(v.blocos, img)
    };
  }
  // Seções que o lojista monta na página (banner, galeria, depoimentos, endereço) e a posição dos produtos
  function validarBlocos(lista, img) {
    if (!Array.isArray(lista)) return [];
    var txt = function (x, n) { return String(x == null ? '' : x).replace(/\r/g, '').slice(0, n); };
    var vistos = {}, temProdutos = false, out = [];
    lista.slice(0, 24).forEach(function (b) {
      if (!b || typeof b !== 'object') return;
      var id = /^[a-z0-9]{4,12}$/.test(b.id) && !vistos[b.id] ? b.id : Math.random().toString(36).slice(2, 10);
      vistos[id] = 1;
      if (b.tipo === 'produtos') { if (!temProdutos) { temProdutos = true; out.push({ id: 'produtos', tipo: 'produtos' }); } return; }
      if (b.tipo === 'banner') out.push({ id: id, tipo: 'banner', foto: img(b.foto), titulo: txt(b.titulo, 90), texto: txt(b.texto, 500), botao: txt(b.botao, 30), acao: ['whatsapp', 'produtos', ''].indexOf(b.acao) > -1 ? b.acao : 'whatsapp' });
      else if (b.tipo === 'galeria') out.push({ id: id, tipo: 'galeria', titulo: txt(b.titulo, 90), fotos: (Array.isArray(b.fotos) ? b.fotos : []).map(function (f) { return { url: img(f && f.url), legenda: txt(f && f.legenda, 90) }; }).filter(function (f) { return f.url; }).slice(0, 12) });
      else if (b.tipo === 'depoimentos') out.push({ id: id, tipo: 'depoimentos', titulo: txt(b.titulo, 90), itens: (Array.isArray(b.itens) ? b.itens : []).map(function (d) { return { texto: txt(d && d.texto, 320), nome: txt(d && d.nome, 60), foto: img(d && d.foto) }; }).slice(0, 8) });
      else if (b.tipo === 'endereco') out.push({ id: id, tipo: 'endereco', titulo: txt(b.titulo, 90), endereco: txt(b.endereco, 180), horario: txt(b.horario, 120), telefone: txt(b.telefone, 30), instagram: txt(b.instagram, 40).replace(/[^\w.]/g, ''), facebook: txt(b.facebook, 80).replace(/[^\w.\-\/]/g, ''), mapa: b.mapa !== false });
    });
    return out;
  }

  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex(c) { return '#' + c.map(function (x) { return ('0' + Math.round(Math.max(0, Math.min(255, x))).toString(16)).slice(-2); }).join('').toUpperCase(); }
  function misturar(a, b, t) { var x = rgb(a), y = rgb(b); return hex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function luminancia(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contraste(a, b) { var x = luminancia(a), y = luminancia(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function textoSobre(h) { return contraste(h, '#FFFFFF') >= contraste(h, '#111411') ? '#FFFFFF' : '#111411'; }
  function clarearAte(h, fundo, alvo) { var t = 0; var r = h; while (contraste(r, fundo) < alvo && t < 1) { t += 0.08; r = misturar(h, '#FFFFFF', t); } return r; }

  function cssVisual(v) {
    var css = ':root{--fonte-titulo:' + FONTES_LOJA[v.fonte].css + ';}';
    if (!v.cor && !v.destaque) return css;
    var cor = v.cor || COR_PADRAO, dest = v.destaque || DESTAQUE_PADRAO;
    var claro = {
      '--fundo': misturar('#F5F5F2', cor, 0.05), '--tinta': misturar('#131613', cor, 0.12), '--tinta-2': misturar('#585D58', cor, 0.15),
      '--verde': cor, '--verde-2': misturar(cor, '#000000', 0.18), '--sobre-verde': textoSobre(cor),
      '--limao': dest, '--sobre-limao': textoSobre(dest), '--limao-suave': misturar(dest, '#FFFFFF', 0.72),
      '--linha': misturar('#DEE0DA', cor, 0.07), '--linha-forte': misturar('#C7CAC3', cor, 0.08),
      '--palco-b': misturar('#E7E8E3', cor, 0.07),
      '--rosa': misturar(cor, '#FF3D8B', 0.45), '--hero': cor, '--hero-2': misturar(cor, '#000000', 0.32), '--sobre-hero': textoSobre(cor)
    };
    var fundoE = misturar('#0C0F0D', cor, 0.10);
    var acao = contraste(dest, fundoE) >= 3 ? dest : clarearAte(cor, fundoE, 3);
    var destE = contraste(dest, fundoE) >= 3 ? dest : acao;
    var escuro = {
      '--fundo': fundoE, '--superficie': misturar('#141915', cor, 0.10), '--tinta': '#EEF0EC', '--tinta-2': '#AEB4AE',
      '--verde': acao, '--verde-2': misturar(acao, '#FFFFFF', 0.15), '--sobre-verde': textoSobre(acao),
      '--limao': destE, '--sobre-limao': textoSobre(destE), '--limao-suave': misturar(fundoE, destE, 0.22),
      '--linha': misturar('#262C27', cor, 0.10), '--linha-forte': misturar('#38403A', cor, 0.10),
      '--palco-a': misturar('#1E241F', cor, 0.10), '--palco-b': misturar('#101411', cor, 0.10),
      '--rosa': misturar(cor, '#FF3D8B', 0.45), '--hero': cor, '--hero-2': misturar(cor, '#000000', 0.32), '--sobre-hero': textoSobre(cor)
    };
    var bloco = function (o) { return Object.keys(o).map(function (k) { return k + ':' + o[k]; }).join(';'); };
    return css + ':root{' + bloco(claro) + '}' +
      '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + bloco(escuro) + '}}' +
      ':root[data-theme="dark"]{' + bloco(escuro) + '}';
  }

  // Na página da loja o cliente nunca sai para a página do MenuReal:
  // o logo/nome volta ao começo do catálogo (fecha o que estiver aberto) e links "#" ficam na própria página.
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || !LOJA || e.ctrlKey || e.metaKey) return;
    if (a.id === 'logo') {
      e.preventDefault();
      $$('dialog[open]').forEach(function (d) { try { fecharDialogo(d); } catch (er) { d.close(); } });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    var h = a.getAttribute('href');
    if (h && h.charAt(0) === '#') {   // por causa do <base href="/">, "#algo" iria para a página inicial
      e.preventDefault();
      var alvo = h.length > 1 ? document.getElementById(h.slice(1)) : null;
      if (alvo) { alvo.setAttribute('tabindex', '-1'); alvo.focus({ preventScroll: true }); alvo.scrollIntoView({ behavior: 'smooth' }); }
    }
  });
  function aplicarVisual(p) {
    p = p || dados.padaria;
    var v = p.visual || validarVisual(null);
    var st = document.getElementById('tema-loja');
    if (!st) { st = document.createElement('style'); st.id = 'tema-loja'; document.head.appendChild(st); }
    st.textContent = cssVisual(v);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && v.cor) meta.setAttribute('content', misturar('#F5F5F2', v.cor, 0.05));
    // Topo: na página de uma loja aparece a marca dela, não a do MenuReal
    var logo = $('#logo');
    if (LOJA && logo) {
      logo.setAttribute('href', '/' + LOJA);   // dentro da loja, o logo volta para o começo da própria loja
      logo.setAttribute('aria-label', p.nome + ', início');
      logo.innerHTML = v.logo ? '<img class="logo__img" src="' + esc(v.logo) + '" alt="' + esc(p.nome) + '">' : '<span class="logo__loja">' + esc(p.nome) + '</span>';
    }
    // cenário atrás do 3D: cor da loja (realça o vidro e os recheios) e a logo ou o nome em marca d'água
    document.documentElement.setAttribute('data-cenario', v.cenario || 'logo');
    var marcaPalco = $('#palco-marca');
    if (marcaPalco) {
      marcaPalco.hidden = v.cenario !== 'logo';
      marcaPalco.innerHTML = v.logo ? '<img src="' + esc(v.logo) + '" alt="">' : '<span>' + esc(p.nome || '') + '</span>';
      marcaPalco.classList.toggle('palco__marca--texto', !v.logo);
    }
    var capa = $('#hero-capa');
    if (capa) {
      capa.hidden = !v.capa;
      var im = capa.querySelector('img');
      if (v.capa && im.getAttribute('src') !== v.capa) im.setAttribute('src', v.capa);
    }
    var rod = $('#rodape');
    if (rod && LOJA) {
      rod.hidden = !v.marca;
      rod.innerHTML = '<p>' + (ehAlimento({ padaria: p }) ? 'Cardápio' : 'Catálogo') + ' em 3D por MenuReal</p>';
    }
  }

  function lerAdicionais(lista) {
    var ids = {};
    return (Array.isArray(lista) ? lista : []).filter(function (a) { return a && a.nome; }).slice(0, 30).map(function (a, i) {
      var id = String(a.id || slug(a.nome) || 'a' + i).replace(/[^\w-]/g, '').slice(0, 40) || 'a' + i;
      while (ids[id]) id += '2';
      ids[id] = 1;
      return { id: id, nome: String(a.nome).slice(0, 40), preco: Math.max(0, Number(a.preco) || 0),
        esgotado: a.esgotado === true };
    });
  }
  // Como a loja recebe pedidos (o servidor guarda a mesma estrutura)
  function lerPedido(v) {
    v = v && typeof v === 'object' ? v : {};
    var reais = function (x, max) { return Math.min(max, Math.max(0, Math.round((Number(x) || 0) * 100) / 100)); };
    var pg = v.pagamento || {}, px = v.pix || {};
    return {
      entrega: v.entrega !== false, retirada: v.retirada !== false, local: v.local === true,
      taxa: reais(v.taxa, 999),
      bairros: (Array.isArray(v.bairros) ? v.bairros : []).filter(function (b) { return b && b.nome; }).slice(0, 60)
        .map(function (b) { return { nome: String(b.nome).trim().slice(0, 50), taxa: reais(b.taxa, 999) }; }),
      minimo: reais(v.minimo, 9999), tempo: String(v.tempo || '').slice(0, 40), endereco: String(v.endereco || '').slice(0, 160),
      pagamento: { pix: pg.pix !== false, cartao: pg.cartao !== false, dinheiro: pg.dinheiro !== false },
      pix: { tipo: TIPOS_PIX.some(function (t) { return t[0] === px.tipo; }) ? px.tipo : 'cpf', chave: String(px.chave || '').trim().slice(0, 77),
        nome: String(px.nome || '').trim().slice(0, 25), cidade: String(px.cidade || '').trim().slice(0, 15) },
      foraDoHorario: v.foraDoHorario === 'agendar' ? 'agendar' : 'bloquear',
      pausado: v.pausado === true,
      parcelas: (function (x) { x = x || {}; return { vezes: Math.max(1, Math.min(24, Math.round(Number(x.vezes) || 1))), semJuros: x.semJuros !== false, minimo: reais(x.minimo, 9999) }; })(v.parcelas)
    };
  }
  function adicionaisDe(p, sel) {
    return (p.adicionais || []).filter(function (a) { return sel.indexOf(a.id) > -1; });
  }
  function somaAdicionais(p, sel) { return adicionaisDe(p, sel).reduce(function (s, a) { return s + a.preco; }, 0); }

  function precoMontado(p, tamId, tops) { return efetivo(p, tamId).preco + somaAdicionais(p, tops || []); }

  // Vocabulário conforme o tipo de negócio
  function ehAlimento(d) { return (d || dados).padaria.tipo !== 'produtos'; }
  function orc() { return ehAlimento() ? 'pedido' : 'orçamento'; }
  function termo(d) { return ehAlimento(d) ? 'cardápio' : 'catálogo'; }

  // Produto com o tamanho escolhido aplicado (preço, medidas e modelo do tamanho)
  function efetivo(p, tamId) {
    var t = null;
    (p.tamanhos || []).forEach(function (x) { if (x.id === tamId) t = x; });
    if (!t) return { p: p, t: null, preco: p.preco, dim: p.dim, modelo: p.modelo, nome: p.nome + (temVersaoPrincipal(p) ? ' (' + (p.versao || 'Original') + ')' : '') };
    return { p: p, t: t, preco: t.preco, dim: t.dim, modelo: t.modelo || p.modelo, nome: p.nome + ' (' + t.nome + ')' };
  }
  // Em catálogos de produtos, o próprio produto é a 1ª versão (as outras ficam em "tamanhos")
  function temVersaoPrincipal(p) { return !ehAlimento() && !!(p.tamanhos && p.tamanhos.length); }
  function precoMinimo(p) {
    if (!p.tamanhos || !p.tamanhos.length) return p.preco;
    var precos = p.tamanhos.map(function (t) { return t.preco; });
    if (temVersaoPrincipal(p)) precos.push(p.preco);
    return Math.min.apply(null, precos);
  }

  // Credenciais para o servidor: conta da loja (token) ou código mestre
  function lerTokenLoja() { try { return localStorage.getItem(CHAVE_TOKEN) || ''; } catch (e) { return ''; } }
  function credenciais() {
    var t = LOJA && lerTokenLoja();
    if (t) return { authorization: 'Bearer ' + t };
    var c = lerCodigo();
    return c ? { 'x-menureal-codigo': c } : null;
  }
  function comLoja(url) { return LOJA ? url + (url.indexOf('?') > -1 ? '&' : '?') + 'loja=' + encodeURIComponent(LOJA) : url; }
  function cabecalhos(extra) { return Object.assign({ 'content-type': 'application/json' }, credenciais() || {}, extra || {}); }

  function produtoPorId(id) {
    for (var i = 0; i < dados.produtos.length; i++) if (dados.produtos[i].id === id) return dados.produtos[i];
    return null;
  }

  // ---------------------------------------------------------------------
  // Biblioteca <model-viewer>
  // ---------------------------------------------------------------------
  function comPrazo(promessa, ms) {
    return Promise.race([promessa, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('tempo esgotado')); }, ms); })]);
  }

  function carregarModelViewer() {
    if (window.customElements && customElements.get('model-viewer')) return Promise.resolve(true);
    if (window.MENUREAL_MV_EMBUTIDO) {
      return comPrazo(customElements.whenDefined('model-viewer'), 15000).then(function () { return true; }, function () { return false; });
    }
    // 3D comprimido (Draco / Meshopt): decodificadores do próprio site, sem depender de outro servidor
    try {
      window.ModelViewerElement = window.ModelViewerElement || {};
      window.ModelViewerElement.dracoDecoderLocation = new URL('vendor/three/draco/', document.baseURI).href;
      window.ModelViewerElement.meshoptDecoderLocation = new URL('vendor/three/meshopt_decoder.js', document.baseURI).href;
    } catch (e) { /* usa o padrão */ }
    var i = 0;
    function tentar() {
      if (customElements.get('model-viewer')) return Promise.resolve(true);
      if (i >= MV_FONTES.length) return Promise.resolve(false);
      var src = MV_FONTES[i++];
      return comPrazo(import(src), 12000).then(function () {
        return customElements.get('model-viewer') ? true : tentar();
      }, function (e) {
        console.warn('[MenuReal] Falha ao carregar model-viewer de', src, e);
        return tentar();
      });
    }
    return tentar();
  }

  // ---------------------------------------------------------------------
  // Cabeçalho, horário
  // ---------------------------------------------------------------------
  function diasTexto(dias) {
    var d = dias.slice().sort();
    var s = d.join(',');
    if (d.length === 7) return 'Todos os dias';
    if (s === '1,2,3,4,5,6') return 'Seg. a sáb.';
    if (s === '1,2,3,4,5') return 'Seg. a sex.';
    if (!d.length) return 'Sem dias definidos';
    return d.map(function (x) { return DIAS[x]; }).join(', ');
  }
  function horaTexto(h) { var p = h.split(':'); return Number(p[0]) + 'h' + (p[1] !== '00' ? p[1] : ''); }
  function minutos(h) { var x = h.split(':'); return Number(x[0]) * 60 + Number(x[1]); }
  // Aberto agora? Aceita horário que passa da meia-noite (ex.: 14h às 0h30) e 24h (abre = fecha)
  function estaAberto(p, d) {
    d = d || new Date();
    var min = d.getHours() * 60 + d.getMinutes(), dia = d.getDay(), a = minutos(p.abre), f = minutos(p.fecha);
    var hoje = p.dias.indexOf(dia) > -1, ontem = p.dias.indexOf((dia + 6) % 7) > -1;
    if (a === f) return hoje;
    if (a < f) return hoje && min >= a && min < f;
    return (hoje && min >= a) || (ontem && min < f);
  }
  function proximaAbertura(p) {
    var agora = new Date(), min = agora.getHours() * 60 + agora.getMinutes();
    for (var i = 0; i < 8; i++) {
      var dia = (agora.getDay() + i) % 7;
      if (p.dias.indexOf(dia) < 0 || (i === 0 && min >= minutos(p.abre))) continue;
      return (i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[dia].toLowerCase() + '.') + ' às ' + horaTexto(p.abre);
    }
    return '';
  }
  // Pode fazer pedido agora? { ok, agendado, motivo }
  function situacaoPedidos() {
    var p = dados.padaria;
    if (p.pedido.pausado) return { ok: false, motivo: 'A loja não está recebendo pedidos agora.' };
    if (!LOJA || estaAberto(p)) return { ok: true };
    var prox = proximaAbertura(p);
    if (p.pedido.foraDoHorario === 'agendar') return { ok: true, agendado: true, motivo: 'A loja está fechada. Seu pedido fica agendado' + (prox ? ' para ' + prox : '') + '.' };
    return { ok: false, motivo: 'A loja está fechada agora' + (prox ? ' e abre ' + prox : '') + '. Você pode montar o pedido e enviar quando ela abrir.' };
  }

  function renderCabecalho() {
    var p = dados.padaria;
    $('#nome-padaria').textContent = p.nome;
    $('#slogan-padaria').textContent = p.slogan;
    document.title = LOJA ? p.nome + ' — ' + (ehAlimento() ? 'Cardápio' : 'Catálogo') : 'MenuReal AR — ' + p.nome;
    aplicarVisual(p);
    $('#horario-texto').textContent = p.dias.length ? diasTexto(p.dias) + ' · ' + horaTexto(p.abre) + ' às ' + horaTexto(p.fecha) + (LOJA ? '' : ' (horário demonstrativo)') : '';
    $('#selo-texto').textContent = (ehAlimento() ? 'Cardápio' : 'Catálogo') + ' em 3D e no tamanho real';
    $('#busca').placeholder = ehAlimento() ? 'Buscar no cardápio…' : (LOJA ? 'Buscar produto ou “até 2 m”…' : 'Buscar sofá ou “até 2 m”…');
    $('#carrinho-titulo').textContent = ehAlimento() ? 'Seu pedido' : 'Seu orçamento';
    var rotCar = $('#btn-carrinho .icone-btn__rot'); if (rotCar) rotCar.textContent = ehAlimento() ? 'Pedido' : 'Orçamento';
    $('#passo-posicionar').textContent = 'Toque para posicionar. O produto aparece em escala fixa, no tamanho das medidas cadastradas.';
    var nota = $('#nota-demo');
    if (nota) nota.hidden = true;          // as explicações agora ficam no "Como usar" (?)
    $('#landing').hidden = !!LOJA;
    $('#landing-fim').hidden = !!LOJA;
    $('.hero').hidden = !LOJA;
    var aberto = estaAberto(p) && !p.pedido.pausado;
    var st = $('#status-horario');
    st.classList.toggle('aberto', aberto);
    st.classList.toggle('fechado', !aberto);
    var prox = aberto ? '' : proximaAbertura(p);
    $('#status-texto').textContent = aberto ? 'Aberto agora' : p.pedido.pausado ? 'Pedidos pausados' : 'Fechado agora' + (prox ? ' · abre ' + prox : '');
  }

  // ---------------------------------------------------------------------
  // Categorias, busca e grade
  // ---------------------------------------------------------------------
  function renderCategorias() {
    var trilho = $('#categorias');
    var cats = ['Todos'].concat(CATEGORIAS);
    trilho.innerHTML = cats.map(function (c) {
      var n = c === 'Todos' ? dados.produtos.length : dados.produtos.filter(function (p) { return p.categoria === c; }).length;
      return '<button class="chip" role="tab" type="button" data-cat="' + esc(c) + '" aria-selected="' + (filtro.cat === c) + '">' +
        esc(c) + ' <span class="chip__n">' + n + '</span></button>';
    }).join('');
  }

  // ----- Busca por medida: "largura até 2 m", "sofá até 1,80", "200x90", "profundidade menos de 90 cm" -----
  // Lê as medidas do texto da busca (sempre em cm por dentro) e devolve o que sobrou para a busca por palavras.
  var MED_DIM = { largura: 'largura|larg|comprimento|compr|frente|largo|comprido', profundidade: 'profundidade|prof|fundo|funda|profundo', altura: 'altura|alt|alto|alta' };
  var MED_MAX = 'no maximo|maximo|max|ate|menos de|menor que|menor de|abaixo de|cabe em|cabe|caiba em|caiba|<=|<';
  var MED_MIN = 'a partir de|mais de|maior que|maior de|acima de|no minimo|minimo|min|pelo menos|>=|>';
  var MED_VAZIAS = /^(de|do|da|dos|das|com|e|ou|no|na|em|um|uma|que|para|pra|por|ate|cabe|caiba|caibam|x|medida|medidas|tamanho|quero|procuro|movel|moveis|algo|cm|m|mt|mts|metro|metros|centimetro|centimetros|lado|entre|a|o)$/;
  function palavraDim(s) {
    for (var k in MED_DIM) if (new RegExp('^(' + MED_DIM[k] + ')$').test(s)) return k;
    return null;
  }
  function lerMedidas(texto) {
    var s = ' ' + semAcento(texto).replace(/×/g, 'x').replace(/([<>]=?)/g, ' $1 ').replace(/(\d),(\d)/g, '$1.$2').replace(/(\d+)\s*m\s*(\d{2})(?!\d)/g, '$1.$2 m') + ' ';
    var med = {}, achou = false;
    function cm(v, u) {
      if (u && u.charAt(0) === 'c') return v;
      if (u) return v * 100;
      return v <= 10 ? v * 100 : v;                       // "até 2" é 2 m; "até 180" é 180 cm
    }
    function por(k, tipo, v) {
      if (!(v > 0 && v < 5000)) return;
      med[k] = med[k] || {};
      med[k][tipo] = v; achou = true;
    }
    var UN = '(cm|centimetros?|m|mts?|metros?)?(?![a-z])';
    var UNX = '(cm|centimetros?|m|mts?|metros?)?(?![a-wyz])';
    // 200x90 ou 200 x 90 x 85: largura × profundidade × altura, todas "até"
    s = s.replace(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UNX + '\\s*x\\s*(\\d+(?:\\.\\d+)?)\\s*' + UNX + '(?:\\s*x\\s*(\\d+(?:\\.\\d+)?)\\s*' + UN + ')?', 'g'),
      function (_, a, ua, b, ub, c, uc) {
        var u = uc || ub || ua;
        por('largura', 'max', cm(+a, ua || u)); por('profundidade', 'max', cm(+b, ub || u));
        if (c) por('altura', 'max', cm(+c, uc || u));
        return ' ';
      });
    var reNum = new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + UN, 'g');
    var partes = [], m;
    while ((m = reNum.exec(s))) partes.push({ v: +m[1], u: m[2] || '', ini: m.index, fim: reNum.lastIndex });
    var resto = s, corte = [];
    var dimAnt = null;
    for (var i = 0; i < partes.length; i++) {
      var pt = partes[i];
      var antes = s.slice(i ? partes[i - 1].fim : 0, pt.ini);
      var depois = s.slice(pt.fim, i + 1 < partes.length ? partes[i + 1].ini : s.length);
      var palavrasAntes = antes.trim().split(/\s+/).filter(Boolean);
      var dim = null;
      for (var j = palavrasAntes.length - 1; j >= 0 && !dim; j--) dim = palavraDim(palavrasAntes[j]);
      var mDepois = depois.match(/^\s*(?:de\s+)?([a-z]+)/);
      if (!dim && mDepois) dim = palavraDim(mDepois[1]);
      var cmp = null, mc;
      var reCmp = new RegExp('(?:^|\\s)(' + MED_MAX + '|' + MED_MIN + '|entre)\\s*$');
      if ((mc = antes.match(reCmp))) cmp = mc[1] === 'entre' ? 'entre' : new RegExp('^(' + MED_MIN + ')$').test(mc[1]) ? 'min' : 'max';
      // "3 lugares", "2 portas": número sem unidade, sem medida e seguido de outra palavra não é medida
      var proxPalavra = mDepois && mDepois[1];
      if (!pt.u && !dim && (!cmp || (proxPalavra && !palavraDim(proxPalavra) && !/^(e|a)$/.test(proxPalavra)))) continue;
      // "entre 1,5 e 2 m"
      if (cmp === 'entre' && partes[i + 1] && /^\s*(e|a)\s*$/.test(s.slice(pt.fim, partes[i + 1].ini))) {
        var pt2 = partes[i + 1], u2 = pt2.u || pt.u;
        var d2 = dim || palavraDim((s.slice(pt2.fim).match(/^\s*(?:de\s+)?([a-z]+)/) || [])[1] || '') || 'largura';
        por(d2, 'min', cm(pt.v, pt.u || u2)); por(d2, 'max', cm(pt2.v, u2));
        corte.push([pt.ini, pt2.fim]); i++; dimAnt = d2;
        continue;
      }
      dim = dim || (cmp ? dimAnt : null) || 'largura';
      por(dim, cmp === 'min' ? 'min' : 'max', cm(pt.v, pt.u));
      corte.push([pt.ini, pt.fim]); dimAnt = dim;
    }
    if (!achou) return { med: null, texto: texto };
    for (var c = corte.length - 1; c >= 0; c--) resto = resto.slice(0, corte[c][0]) + ' ' + resto.slice(corte[c][1]);
    // tira as palavras de medida e as de ligação; o que sobrar ("sofá", "veludo") continua na busca normal
    var palavras = resto.replace(/[<>=]/g, ' ').split(/\s+/).filter(function (w) {
      return w && !palavraDim(w) && !MED_VAZIAS.test(w) && !/^(maximo|max|menos|menor|abaixo|partir|mais|maior|acima|minimo|min|pelo)$/.test(w);
    });
    return { med: med, texto: palavras.join(' ') };
  }
  function medTexto(v) {
    return v >= 100 ? (v / 100).toLocaleString('pt-BR', { minimumFractionDigits: v % 100 ? 2 : 0, maximumFractionDigits: 2 }) + ' m' : num(v) + ' cm';
  }
  function descMedidas(med) {
    return ['largura', 'profundidade', 'altura'].filter(function (k) { return med[k]; }).map(function (k) {
      var r = med[k];
      if (r.min && r.max) return k + ' de ' + medTexto(r.min) + ' a ' + medTexto(r.max);
      return k + (r.max ? ' até ' + medTexto(r.max) : ' a partir de ' + medTexto(r.min));
    }).join(', ');
  }
  // folga de meio centímetro para arredondamentos do cadastro
  function dimCabe(d, med) {
    for (var k in med) {
      var v = d && +d[k], r = med[k];
      if (!(v > 0)) return false;
      if (r.max && v > r.max + 0.5) return false;
      if (r.min && v < r.min - 0.5) return false;
    }
    return true;
  }
  // medidas de cada opção do produto: a versão principal (quando há) e as outras versões/tamanhos
  function dimsDoProduto(p) {
    if (!(p.tamanhos && p.tamanhos.length)) return [p.dim];
    return (temVersaoPrincipal(p) ? [p.dim] : []).concat(p.tamanhos.map(function (t) { return t.dim; }));
  }
  function produtoCabe(p, med) {
    return dimsDoProduto(p).some(function (d) { return dimCabe(d, med); });
  }
  var buscaMed = null;                                     // medidas lidas da busca atual (ou null)
  var semMedida = [];                                      // o que a busca acharia sem as medidas

  function palavraBate(hay, w) {
    if (hay.indexOf(w) > -1) return true;
    if (w.length > 4 && /oes$/.test(w) && hay.indexOf(w.slice(0, -3) + 'ao') > -1) return true;   // colchões → colchão
    return w.length > 3 && /s$/.test(w) && hay.indexOf(w.slice(0, -1)) > -1;                        // sofás → sofá
  }
  function filtrados() {
    var lido = ehAlimento() ? { med: null, texto: filtro.q } : lerMedidas(filtro.q);
    buscaMed = lido.med;
    var palavras = semAcento(lido.texto.trim()).split(/\s+/).filter(Boolean);
    semMedida = dados.produtos.filter(function (p) {
      if (filtro.cat !== 'Todos' && p.categoria !== filtro.cat) return false;
      if (!palavras.length) return true;
      var hay = semAcento(p.nome + ' ' + p.descricao + ' ' + p.categoria + ' ' + (p.ingredientes || ''));
      return palavras.every(function (w) { return palavraBate(hay, w); });
    });
    return buscaMed ? semMedida.filter(function (p) { return !p.combo && produtoCabe(p, buscaMed); }) : semMedida;
  }

  // Parcelamento e oferta
  function parcelaTexto(valor) {
    var pc = dados.padaria.pedido && dados.padaria.pedido.parcelas;
    if (!pc || pc.vezes < 2 || !(valor > 0) || ehAlimento()) return '';
    var n = pc.vezes;
    if (pc.minimo > 0) n = Math.min(n, Math.floor(valor / pc.minimo));
    if (n < 2) return '';
    return 'ou ' + n + 'x de ' + brl(Math.ceil(valor / n * 100) / 100) + (pc.semJuros ? ' sem juros' : '');
  }
  function emOferta(p) { return !ehAlimento() && p.precoDe > p.preco && !(p.tamanhos && p.tamanhos.length); }
  function descontoTexto(p) { return Math.round((1 - p.preco / p.precoDe) * 100); }
  function reguaTexto(d) { return num(d.largura) + ' × ' + num(d.altura) + ' cm'; }

  function htmlCard(p) {
    var temModelo = !!p.modelo && !SEM_3D && !(POUCA_MEMORIA && fotoPrincipal(p));
    var temTams = p.tamanhos && p.tamanhos.length;
    var temOpcoes = temTams || (p.adicionais && p.adicionais.length);
    var vitrine = temModelo
      ? '<button class="card__palco" type="button" data-acao="3d" aria-label="Girar ' + esc(p.nome) + ' em 3D">' +
          '<model-viewer src="' + esc(urlModelo(p.modelo)) + '" alt="Modelo 3D de ' + esc(p.nome) + '" loading="lazy" reveal="auto"' +
          ' camera-orbit="28deg 70deg auto" shadow-intensity="1.25" shadow-softness="0.55" tone-mapping="neutral" environment-image="' + esc(ESTUDIO()) + '" exposure="1"' +
          ' interaction-prompt="none" disable-zoom disable-tap tabindex="-1"></model-viewer>' +
          '<span class="card__estado" data-estado><span class="carregando"><span class="spinner" aria-hidden="true"></span><span class="barra"><i></i></span></span></span>' +
        '</button>' +
        '<button class="card__mesa" type="button" data-acao="ar" aria-label="Ver ' + esc(p.nome) + ' no tamanho real, pela câmera">' + ICONES.ar + '<span>' + (ehAlimento() ? 'Na mesa' : 'Ver em casa') + '</span></button>'
      : fotoPrincipal(p)
        ? '<button class="card__palco card__palco--foto" type="button" data-acao="3d" aria-label="Ver fotos e medidas de ' + esc(p.nome) + '"><img src="' + esc(urlModelo(fotoPrincipal(p))) + '" alt="' + esc(p.nome) + '" loading="lazy" decoding="async">' +
          (fotosDoProduto(p).length > 1 ? '<span class="card__nfotos">' + fotosDoProduto(p).length + ' fotos</span>' : '') + '</button>'
        : '<button class="card__palco card__palco--vazio" type="button" data-acao="3d" aria-label="Ver detalhes e medidas de ' + esc(p.nome) + '"><span>' + esc(p.nome.trim().charAt(0).toUpperCase()) + '</span></button>';
    var mostraRegua = temModelo || !(p.dim.largura <= 5 && p.dim.altura <= 5 && p.dim.profundidade <= 5);
    return '<article class="card' + (temModelo || fotoPrincipal(p) ? '' : ' card--simples') + (p.esgotado ? ' card--esgotado' : '') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card__vitrine">' + vitrine + (p.esgotado ? '<span class="selo-esgotado">Esgotado</span>'
        : emOferta(p) ? '<span class="selo-oferta">Oferta −' + descontoTexto(p) + '%</span>' : '') +
        (mostraRegua ? '<span class="regua" title="' + (temTams ? 'Largura dos tamanhos' : 'Largura × altura') + '"><span>' + esc(temTams
          ? num(Math.min.apply(null, p.tamanhos.map(function (t) { return t.dim.largura; }))) + ' a ' + num(Math.max.apply(null, p.tamanhos.map(function (t) { return t.dim.largura; }))) + ' cm'
          : reguaTexto(p.dim)) + '</span></span>' : '') +
      '</div>' +
      '<div class="card__corpo">' +
        '<h3 class="card__nome"' + (editando ? ' contenteditable="true" data-ph="Nome do produto"' : '') + '>' + esc(p.nome) + '</h3>' +
        (p.descricao || editando ? '<p class="card__desc"' + (editando ? ' contenteditable="true" data-ph="Descrição (opcional)"' : '') + '>' + esc(p.descricao) + '</p>' : '') +
        (temTams ? '<p class="card__info">' + (buscaMed
          ? (function (ds) { var n = ds.filter(function (d) { return dimCabe(d, buscaMed); }).length; return n === ds.length ? 'Todas as ' + n + ' opções cabem' : n + ' de ' + ds.length + ' opções cabem'; })(dimsDoProduto(p))
          : p.tamanhos.length + ' tamanhos') + '</p>' : '') +
        (ehAlimento() && p.alergenos && p.alergenos.length ? '<p class="card__alerg">Contém ' + esc(p.alergenos.join(', ').toLowerCase()) + '</p>' : '') +
        '<div class="card__rodape">' +
          '<span class="card__preco">' + (temTams ? '<small>a partir de</small>' : '') + (emOferta(p) ? '<s class="preco-de">' + brl(p.precoDe) + '</s>' : '') + (editando && !temTams ? '<span class="card__preco-ed" contenteditable="true" inputmode="decimal" data-ph="Preço">' + brl(p.preco) + '</span>' : brl(precoMinimo(p))) + '</span>' +
          (p.esgotado ? '<span class="card__esgotado">Esgotado</span>' :
          '<button class="card__add" type="button" data-acao="' + (temOpcoes ? 'escolher' : 'add') + '" aria-label="' +
            (temOpcoes ? 'Escolher opções de ' : 'Adicionar ao pedido: ') + esc(p.nome) + '">' + ICONES.mais + '</button>') +
        '</div>' +
        (parcelaTexto(precoMinimo(p)) ? '<p class="card__parcela">' + parcelaTexto(precoMinimo(p)) + '</p>' : '') +
      '</div>' +
    '</article>';
  }

  function renderGrade() {
    var lista = filtrados();
    var grade = $('#grade');
    var q = filtro.q.trim();
    if (!lista.length && buscaMed) {
      grade.innerHTML = '<div class="vazio"><strong>Nenhum móvel com ' + esc(descMedidas(buscaMed)) + '</strong>' + esc(maisPerto(buscaMed)) +
        '<button class="btn btn--contorno vazio__btn" type="button" data-limpar-med>Limpar medidas</button></div>';
    } else if (!lista.length) {
      grade.innerHTML = q
        ? '<div class="vazio"><strong>Nada encontrado</strong>Nenhum produto corresponde a “' + esc(q) + '”' + (filtro.cat !== 'Todos' ? ' em ' + esc(filtro.cat) : '') + '.</div>'
        : '<div class="vazio"><strong>Ainda não há itens em ' + esc(filtro.cat) + '</strong>Adicione produtos desta categoria pelo painel administrativo.</div>';
    } else {
      grade.innerHTML = lista.map(htmlCard).join('');
      $$('model-viewer', grade).forEach(ligarCardViewer);
    }
    $('#resultado').textContent = buscaMed
      ? (lista.length ? lista.length + (lista.length === 1 ? ' móvel' : ' móveis') + ' com ' + descMedidas(buscaMed) : '')
      : q ? lista.length + (lista.length === 1 ? ' produto encontrado' : ' produtos encontrados') : '';
    sincronizarMedidas();
  }
  // quando nada cabe, diz qual é o mais perto, para o cliente saber quanto falta
  function maisPerto(med) {
    var k = ['largura', 'profundidade', 'altura'].filter(function (x) { return med[x]; })[0], r = med[k];
    var vals = [];
    semMedida.forEach(function (p) {
      if (p.combo) return;
      dimsDoProduto(p).forEach(function (d) { if (d && d[k] > 0) vals.push(+d[k]); });
    });
    if (!semMedida.length) return 'Nenhum produto corresponde ao resto da busca.';
    if (!vals.length) return 'Os produtos desta lista ainda não têm essa medida cadastrada.';
    var nome = { largura: ['mais estreito', 'mais largo'], profundidade: ['mais raso', 'mais fundo'], altura: ['mais baixo', 'mais alto'] }[k];
    if (r.max && Math.min.apply(null, vals) > r.max) return 'O ' + nome[0] + ' tem ' + medTexto(Math.min.apply(null, vals)) + ' de ' + k + '.';
    if (r.min && Math.max.apply(null, vals) < r.min) return 'O ' + nome[1] + ' tem ' + medTexto(Math.max.apply(null, vals)) + ' de ' + k + '.';
    return 'Tente mudar um pouco as medidas.';
  }

  // Painel "Medidas": os campos escrevem na própria busca, então só existe um filtro
  function sincronizarMedidas() {
    var btn = $('#btn-medidas'), painel = $('#painel-medidas');
    if (!btn) return;
    btn.hidden = ehAlimento();
    if (ehAlimento()) { painel.hidden = true; return; }
    btn.classList.toggle('ativo', !!buscaMed);
    ['largura', 'profundidade', 'altura'].forEach(function (k) {
      var el = document.getElementById('med-' + k.charAt(0));
      if (el && document.activeElement !== el) el.value = buscaMed && buscaMed[k] && buscaMed[k].max && !buscaMed[k].min ? num(buscaMed[k].max) : '';
    });
    // o "Cabe no meu espaço?" do móvel já abre com as medidas que o cliente buscou
    if (buscaMed) ['largura', 'profundidade', 'altura'].forEach(function (k) {
      var r = buscaMed[k], el = document.getElementById('cabe-' + k.charAt(0));
      if (r && r.max && !r.min && el && espacoCliente) { el.value = num(r.max); espacoCliente[k.charAt(0)] = String(r.max); }
    });
  }
  function textoDosCampos() {
    var partes = [];
    ['largura', 'profundidade', 'altura'].forEach(function (k) {
      var v = lerCm(document.getElementById('med-' + k.charAt(0)).value);
      if (v) partes.push(k + ' até ' + num(v) + ' cm');
    });
    var resto = lerMedidas($('#busca').value);
    return [resto.med ? resto.texto : $('#busca').value.trim()].concat(partes).filter(Boolean).join(' ');
  }

  function ligarCardViewer(mv) {
    var estado = mv.parentNode.querySelector('[data-estado]');
    var barra = estado && estado.querySelector('.barra i');
    mv.addEventListener('progress', function (e) {
      if (barra) barra.style.width = Math.round(e.detail.totalProgress * 100) + '%';
    });
    mv.addEventListener('load', function () { if (estado) estado.hidden = true; });
    mv.addEventListener('error', function () {
      if (!estado) return;
      estado.hidden = false;
      estado.innerHTML = '<span><strong>3D indisponível</strong>O arquivo não foi encontrado.</span>';
    });
    if (mvStatus === 'falhou') marcarCardSemBiblioteca(estado);
  }

  function marcarCardSemBiblioteca(estado) {
    if (!estado) return;
    estado.hidden = false;
    estado.innerHTML = '<span><strong>3D indisponível</strong>Verifique a conexão e recarregue.</span>';
  }

  // ---------------------------------------------------------------------
  // Diálogos (com suporte ao botão "voltar" do celular)
  // ---------------------------------------------------------------------
  function abrirDialogo(dlg) {
    if (dlg.open) return;
    dlg.showModal();
    document.body.classList.add('travado');
    try { history.pushState({ menurealDlg: dlg.id }, ''); } catch (e) { /* ignora */ }
  }
  function fecharDialogo(dlg, viaHistorico) {
    if (!dlg.open) return;
    dlg.close();
  }
  function aoFechar(dlg) {
    if (!$$('dialog[open]').length) document.body.classList.remove('travado');
    if (history.state && history.state.menurealDlg === dlg.id) {
      try { history.back(); } catch (e) { /* ignora */ }
    }
  }
  window.addEventListener('popstate', function () {
    var manter = history.state && history.state.menurealDlg;
    $$('dialog[open]').forEach(function (d) { if (d.id !== manter) d.close(); });
  });
  $$('dialog.folha').forEach(function (dlg) {
    dlg.addEventListener('close', function () { aoFechar(dlg); });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg) fecharDialogo(dlg);
      if (e.target.closest('[data-fechar]')) fecharDialogo(dlg);
    });
  });

  // ---------------------------------------------------------------------
  // Visualizador 3D + Realidade aumentada
  // ---------------------------------------------------------------------
  var dlgViewer = $('#dlg-viewer');
  var palco = $('#palco');
  var palcoEstado = $('#palco-estado');

  // ---- Galeria no produto: tira com "3D" + fotos; a foto aparece por cima do 3D (o 3D não é recarregado)
  var galV = { itens: [], i: -1, tem3d: false };
  function renderGaleriaViewer(p, tem3d) {
    galV = { itens: p.combo ? [] : fotosDoProduto(p), i: -1, tem3d: tem3d };
    var tira = $('#viewer-galeria'), n = galV.itens.length;
    $('#palco-fotos').hidden = true;
    tira.hidden = n === 0 || (n === 1 && !tem3d);
    if (tira.hidden) { tira.innerHTML = ''; return; }
    tira.innerHTML = (tem3d ? '<button type="button" class="galeria-tira__item galeria-tira__item--3d" role="tab" aria-selected="true" data-gal="-1"><span>3D</span></button>' : '') +
      galV.itens.map(function (f, k) {
        return '<button type="button" class="galeria-tira__item' + (f.tipo === 'ambiente' ? ' galeria-tira__item--amb' : '') + '" role="tab" aria-selected="false" data-gal="' + k + '" aria-label="Foto ' + (k + 1) + ': ' + esc(TIPOS_FOTO[f.tipo] || 'Foto') + '"><img src="' + esc(urlModelo(f.url)) + '" alt="" loading="lazy" decoding="async"></button>';
      }).join('');
  }
  function mostrarFotoViewer(k) {
    var n = galV.itens.length, camada = $('#palco-fotos');
    if (k < 0 || !n) { if (galV.tem3d) { galV.i = -1; camada.hidden = true; marcarTira(); return; } k = 0; }
    k = (k + n) % n; galV.i = k;
    var f = galV.itens[k];
    $('#palco-fotos-img').src = urlModelo(f.url);
    $('#palco-fotos-img').alt = (produtoAtual ? produtoAtual.nome + ' — ' : '') + (TIPOS_FOTO[f.tipo] || 'foto');
    var rot = f.tipo && f.tipo !== 'outra' ? (f.tipo === 'ambiente' ? 'Ambiente' : TIPOS_FOTO[f.tipo]) : '';
    $('#palco-fotos-tipo').textContent = rot + (n > 1 ? (rot ? ' · ' : '') + (k + 1) + '/' + n : '');
    $('#palco-fotos-tipo').hidden = !$('#palco-fotos-tipo').textContent;
    $('#palco-fotos-aviso').hidden = f.tipo !== 'ambiente';
    $$('.palco-fotos__nav', camada).forEach(function (b) { b.hidden = n < 2; });
    camada.hidden = false; marcarTira();
  }
  function marcarTira() {
    $$('#viewer-galeria [data-gal]').forEach(function (b) { b.setAttribute('aria-selected', String(Number(b.getAttribute('data-gal')) === galV.i)); });
    var sel = document.querySelector('#viewer-galeria [aria-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  // =====================================================================
  // Modo Presença: barra do 3D (girar, vistas, zoom, centralizar, dimensões,
  // iluminação, cenário, tela cheia) e câmera que sempre enquadra o móvel.
  // Modo Raio-X: o móvel por dentro (raiox.mjs, carregado só quando usado).
  // =====================================================================
  var VISTAS = { inicio: [28, 72], frente: [0, 80], lado: [90, 80], tras: [180, 80], cima: [0, 12] };
  var LUZES = [
    { nome: 'Estúdio', env: 'estudio', exp: 1, sombra: 1.25, suave: 0.55 },
    { nome: 'Luz natural', env: 'neutral', exp: 1.08, sombra: 0.9, suave: 1 },
    { nome: 'Destaque', env: 'estudio', exp: 1.28, sombra: 1.8, suave: 0.22 }
  ];
  var CENARIOS = [{ id: '', nome: 'Cenário da loja' }, { id: 'claro', nome: 'Estúdio claro' }, { id: 'escuro', nome: 'Estúdio escuro' }];
  var luzAtual = 0, modo3d = 'presenca', rx = null, rxVez = 0;
  var cenarioAtual = (function () { try { var c = localStorage.getItem('menureal:cenario3d') || ''; return CENARIOS.some(function (x) { return x.id === c; }) ? c : ''; } catch (e) { return ''; } })();
  function mvAtual() { return palco.querySelector('model-viewer'); }
  function dicaBarra(txt) {
    var d = $('#barra-dica'); d.textContent = txt; d.classList.add('ver');
    clearTimeout(dicaBarra.t); dicaBarra.t = setTimeout(function () { d.classList.remove('ver'); }, 1800);
  }
  function fecharPops(exceto) {
    $$('.pop3d', palco).forEach(function (p) { if (p !== exceto && p.id !== 'rx-explodir') p.hidden = true; });
    $$('.barra3d [aria-expanded]', palco).forEach(function (b) { if (!exceto || b.getAttribute('aria-controls') !== exceto.id) b.setAttribute('aria-expanded', 'false'); });
  }
  function alternarPop(pop, botao) {
    var abrir = pop.hidden; fecharPops(abrir ? pop : null);
    pop.hidden = !abrir; if (botao) botao.setAttribute('aria-expanded', String(abrir));
    if (abrir && botao) {   // o menu abre em cima do botão
      var pr = palco.getBoundingClientRect(), br = botao.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(pr.width - pop.offsetWidth - 8, br.left - pr.left + br.width / 2 - pop.offsetWidth / 2)) + 'px';
    }
  }
  function aplicarCenario() { if (cenarioAtual) palco.setAttribute('data-fundo', cenarioAtual); else palco.removeAttribute('data-fundo'); }
  aplicarCenario();
  function aplicarLuz(mv) {
    var l = LUZES[luzAtual];
    mv.setAttribute('environment-image', l.env === 'estudio' ? ESTUDIO() : l.env);
    mv.setAttribute('exposure', String(l.exp)); mv.setAttribute('shadow-intensity', String(l.sombra)); mv.setAttribute('shadow-softness', String(l.suave));
  }
  // ponto para onde a câmera olha: o centro do móvel, um pouco abaixo (a barra de baixo cobre a base do palco)
  function alvoPresenca(mv) {
    try { var c = mv.getBoundingBoxCenter(), d = mv.getDimensions(); return c.x + 'm ' + (c.y - d.y * 0.1) + 'm ' + c.z + 'm'; } catch (e) { return 'auto auto auto'; }
  }
  // câmera inteligente: enquadra o móvel inteiro, limita o zoom e não deixa passar por baixo do chão
  function enquadrarPresenca(mv) {
    if (mv.dataset.r0) return;
    var o = mv.getCameraOrbit(), r0 = o.radius * 1.25;
    mv.dataset.r0 = String(r0);
    mv.minCameraOrbit = 'auto 4deg ' + (r0 * 0.3) + 'm';
    mv.maxCameraOrbit = 'auto 96deg ' + (r0 * 2.4) + 'm';
    var fim = o.theta + 'rad ' + o.phi + 'rad ' + r0 + 'm';
    mv.cameraTarget = alvoPresenca(mv);
    if (!reduzMovimento) {   // entrada: o móvel chega girando devagar até a posição de apresentação
      mv.cameraOrbit = (o.theta - 0.85) + 'rad ' + Math.max(0.6, o.phi - 0.28) + 'rad ' + (r0 * 1.8) + 'm';
      mv.jumpCameraToGoal();
      setTimeout(function () { if (mv.isConnected) mv.cameraOrbit = fim; }, 50);
    } else { mv.cameraOrbit = fim; mv.jumpCameraToGoal(); }
    mv.classList.add('mv-entrou');
    // arrastar com dois dedos (mover) não deixa o móvel sair do quadro
    mv.addEventListener('camera-change', function (e) {
      if (!e.detail || e.detail.source !== 'user-interaction') return;
      try {
        var t = mv.getCameraTarget(), c = mv.getBoundingBoxCenter(), d = mv.getDimensions(), mud = false;
        var lim = function (v, c0, l) { var n = Math.min(c0 + l, Math.max(c0 - l, v)); if (Math.abs(n - v) > 1e-4) mud = true; return n; };
        var x = lim(t.x, c.x, d.x * 0.55 + 0.05), y = lim(t.y, c.y, d.y * 0.55 + 0.05), z = lim(t.z, c.z, d.z * 0.55 + 0.05);
        if (mud) mv.cameraTarget = x + 'm ' + y + 'm ' + z + 'm';
      } catch (err) { /* ok */ }
    });
  }
  function girarPresenca(on) {
    var mv = mvAtual(); if (mv) mv.autoRotate = on;
    $('#barra-presenca [data-b3="girar"]').setAttribute('aria-pressed', String(on));
  }
  function vistaPresenca(nome) {
    var mv = mvAtual(); if (!mv) return;
    var v = VISTAS[nome] || VISTAS.inicio, r0 = Number(mv.dataset.r0) || 0;
    girarPresenca(false);
    // o "girar sozinho" gira o móvel (não a câmera): soma o giro para a frente ser a frente do móvel
    var yaw = mv.turntableRotation || 0;
    mv.cameraTarget = alvoPresenca(mv); mv.fieldOfView = 'auto';
    mv.cameraOrbit = (v[0] * Math.PI / 180 + yaw) + 'rad ' + v[1] + 'deg ' + (r0 ? r0 + 'm' : 'auto');
  }
  function zoomPresenca(f) {
    var mv = mvAtual(); if (!mv) return;
    var o = mv.getCameraOrbit(), r0 = Number(mv.dataset.r0) || o.radius;
    mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + Math.min(r0 * 2.4, Math.max(r0 * 0.3, o.radius * f)) + 'm';
  }
  function centralizarPresenca() {
    var mv = mvAtual(); if (!mv) return;
    var o = mv.getCameraOrbit(), r0 = Number(mv.dataset.r0) || 0;
    mv.cameraTarget = alvoPresenca(mv); mv.fieldOfView = 'auto';
    mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + (r0 ? r0 + 'm' : 'auto');
  }
  // tela cheia (no iPhone, que não deixa, o palco ocupa a tela toda)
  function telaCheiaLigada() { return document.fullscreenElement === palco || palco.classList.contains('palco--cheio'); }
  function marcarCheia() { var on = telaCheiaLigada(); $$('[data-b3="cheia"]', palco).forEach(function (b) { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia'); }); if (rx) rx.redesenhar(); }
  function alternarTelaCheia(forcarSair) {
    if (telaCheiaLigada() || forcarSair) {
      if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      palco.classList.remove('palco--cheio');
    } else if (palco.requestFullscreen && document.fullscreenEnabled) {
      palco.requestFullscreen().catch(function () { palco.classList.add('palco--cheio'); marcarCheia(); });
    } else palco.classList.add('palco--cheio');
    setTimeout(marcarCheia, 120);
  }
  document.addEventListener('fullscreenchange', marcarCheia);
  dlgViewer.addEventListener('cancel', function (e) { if (palco.classList.contains('palco--cheio')) { e.preventDefault(); alternarTelaCheia(true); } });

  // ----- Ver dimensões: só as cadastradas (conferidas com o 3D) ou as do próprio arquivo quando não há cadastro
  var CHAVE_DIM = 'menureal:dimensoes';
  var dimLigadas = (function () { try { return localStorage.getItem(CHAVE_DIM) === '1'; } catch (e) { return false; } })();
  function alternarDimensoes() {
    var mv = mvAtual(); if (!mv) return;
    dimLigadas = !dimLigadas;
    try { localStorage.setItem(CHAVE_DIM, dimLigadas ? '1' : '0'); } catch (err) { /* ignora */ }
    mostrarDimensoes(mv);
    dicaBarra(dimLigadas ? 'Dimensões visíveis' : 'Dimensões ocultas');
  }
  function mostrarDimensoes(mv) {
    var modo = mv.dataset.dimModo || '', card = $('#dim-card');
    $('#barra-presenca [data-b3="dimensoes"]').setAttribute('aria-pressed', String(dimLigadas));
    mv.classList.toggle('sem-medidas', !dimLigadas || modo !== 'linhas');
    card.hidden = !dimLigadas || modo !== 'cartao';
  }

  // ----- Raio-X
  function pecasValidas(p) {
    if (!p.pecas || !p.pecas.length || p.pecasDe !== p.modelo) return [];
    var nomes = {}; p.pecas.forEach(function (c) { nomes[c.nome.toLowerCase() + '|' + c.tipo] = 1; });
    return Object.keys(nomes).length >= 2 ? p.pecas : [];
  }
  function fonteRaioX(p) {
    if (!p || p.combo || !p.modelo || SEM_3D || mvStatus !== 'ok') return null;
    if (efetivo(p, tamAtual).modelo !== p.modelo) return null;   // outra versão com outro 3D
    if (p.planejado && (!p.planejadoDe || p.planejadoDe === p.modelo)) return { tipo: 'planejado', ficha: p.planejado, dim: p.dim };
    var pc = pecasValidas(p);
    if (pc.length) return { tipo: 'glb', url: urlModelo(p.modelo), pecas: pc };
    return null;
  }
  function mesmasMedidas(a, b) {
    return ['largura', 'altura', 'profundidade'].every(function (k) { return Math.abs(a[k] - b[k]) <= Math.max(1, b[k] * 0.02); });
  }
  function marcarModo() {
    var rxOn = modo3d === 'raiox';
    $$('#palco-modos [data-modo3d]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-modo3d') === modo3d)); });
    $('#barra-presenca').hidden = rxOn || !mvAtual() || !mvAtual().loaded;
    $('#barra-raiox').hidden = !rxOn || !rx;
    palco.classList.toggle('palco--raiox', rxOn);
    if (!rxOn) ['#rx-info', '#rx-lista', '#rx-clipes', '#rx-explodir'].forEach(function (s) { $(s).hidden = true; });
    fecharPops();
  }
  function entrarRaioX() {
    if (modo3d === 'raiox' || !produtoAtual) return;
    var fonte = fonteRaioX(produtoAtual), mv = mvAtual();
    if (!fonte || !mv || !mv.loaded) { dicaBarra('O Raio-X não está disponível para este móvel.'); return; }
    if (galV.i >= 0) mostrarFotoViewer(-1);
    modo3d = 'raiox'; marcarModo();
    $('#dim-card').hidden = true;
    var vez = ++rxVez, orb = null;
    try {
      // a câmera do Raio-X fica no mesmo ângulo em relação ao móvel (descontando o giro automático)
      var co = mv.getCameraOrbit(), ct = mv.getCameraTarget(), yaw = mv.turntableRotation || 0, cc = mv.getBoundingBoxCenter();
      var dx = ct.x - cc.x, dz = ct.z - cc.z, cs = Math.cos(-yaw), sn = Math.sin(-yaw);
      orb = { theta: co.theta - yaw, phi: co.phi, radius: co.radius, alvo: [cc.x + dx * cs + dz * sn, ct.y, cc.z - dx * sn + dz * cs], fov: mv.getFieldOfView() };
    } catch (e) { orb = null; }
    mv.autoRotate = false;
    estadoPalco('<div class="carregando"><div class="spinner" aria-hidden="true"></div><span>Preparando o Raio-X…</span></div>');
    var velha = $('#rx-camada'); if (velha) velha.remove();
    var camada = document.createElement('div'); camada.className = 'rx-camada'; camada.id = 'rx-camada';
    palco.insertBefore(camada, palcoEstado);
    import(new URL('raiox.mjs', document.baseURI).href).then(function (R) {
      if (vez !== rxVez) return null;
      return R.criarRaioX(camada, fonte, {
        orbita: orb, pouca: POUCA_MEMORIA || !!(navigator.deviceMemory && navigator.deviceMemory <= 2),
        aoSelecionar: mostrarPecaRx, aoMudar: atualizarExplodirRx,
        aoProgresso: function (f) { estadoPalco('<div class="carregando"><div class="spinner" aria-hidden="true"></div><span>Preparando o Raio-X… ' + Math.round(f * 100) + '%</span></div>'); },
        aoFalhar: function (msg) { if (vez === rxVez) { sairRaioX(); toast(msg); } }
      });
    }).then(function (api) {
      if (!api) return;
      if (vez !== rxVez) { api.destruir(); return; }
      // confere: as peças do Raio-X têm as mesmas medidas do 3D publicado
      if (fonte.tipo === 'planejado' && fonte.dim && !mesmasMedidas(api.medidas, fonte.dim)) {
        api.destruir(); camada.remove(); falhaRx('O Raio-X deste planejado não confere com o 3D publicado.'); return;
      }
      rx = api; estadoPalco('');
      api.transparencia(Number($('#rx-transp').value) / 100);
      prepararBarraRx(api);
      requestAnimationFrame(function () { camada.classList.add('ver'); });
      marcarModo();
      dicaBarra('Toque numa peça para ver os detalhes');
    }).catch(function (e) {
      console.warn('[raio-x]', e);
      if (vez !== rxVez) return;
      camada.remove(); falhaRx(e && /aparelho/.test(e.message || '') ? e.message : 'Não consegui abrir o Raio-X. Tente de novo.');
    });
  }
  function falhaRx(msg) { rxVez++; modo3d = 'presenca'; estadoPalco(''); marcarModo(); toast(msg); }
  function sairRaioX() {
    rxVez++;
    var mv = mvAtual(), camada = $('#rx-camada'), api = rx;
    rx = null;
    if (api && mv) {   // a Presença continua do mesmo ângulo em que o cliente estava no Raio-X
      try {
        var o = api.orbita();
        if (mv.resetTurntableRotation) mv.resetTurntableRotation(0);
        mv.cameraTarget = o.alvo[0] + 'm ' + o.alvo[1] + 'm ' + o.alvo[2] + 'm'; mv.fieldOfView = o.fov + 'deg';
        mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + o.radius + 'm'; mv.jumpCameraToGoal();
      } catch (e) { /* segue */ }
    }
    if (camada) { camada.classList.remove('ver'); setTimeout(function () { if (api) api.destruir(); camada.remove(); }, 280); }
    else if (api) api.destruir();
    modo3d = 'presenca'; estadoPalco(''); marcarModo();
    if (mv) girarPresenca(false);
  }
  function prepararBarraRx(api) {
    var b = $('#barra-raiox');
    b.querySelector('[data-b3="abrir"]').hidden = !api.temMovimento;
    b.querySelector('[data-b3="abrir"]').setAttribute('aria-pressed', 'false');
    b.querySelector('[data-b3="animacoes"]').hidden = !api.clipes.length;
    b.querySelector('[data-b3="explodir"]').setAttribute('aria-pressed', 'false');
    $('#rx-explodir').hidden = true; $('#rx-intens').value = 100; $('#rx-info').hidden = true;
    var porTipo = {}, ordem = ['porta', 'gaveta', 'prateleira', 'divisoria', 'lateral', 'fundo', 'tampo', 'frente', 'eletro', 'acessorio', 'estofado', 'puxador', 'ferragem', 'painel', 'estrutura', 'rodape', 'led', 'outra'];
    api.pecas.forEach(function (pc) { (porTipo[pc.tipoNome] = porTipo[pc.tipoNome] || []).push(pc); });
    var pos = function (t) { var i = ordem.indexOf(porTipo[t][0].tipo); return i < 0 ? 99 : i; };
    $('#rx-lista').innerHTML = '<p class="rx-lista__titulo">' + api.pecas.length + (api.pecas.length === 1 ? ' peça' : ' peças') + '</p>' +
      Object.keys(porTipo).sort(function (a, b) { return pos(a) - pos(b); }).map(function (t) {
        return '<p class="rx-lista__tipo">' + esc(t) + ' <small>' + porTipo[t].length + '</small></p>' +
          porTipo[t].map(function (pc) { return '<button type="button" data-peca="' + esc(pc.id) + '">' + esc(pc.nome) + (pc.grupo ? '<small>' + esc(pc.grupo) + '</small>' : '') + '</button>'; }).join('');
      }).join('');
    $('#rx-clipes').innerHTML = api.clipes.map(function (c, i) { return '<button type="button" data-clipe="' + i + '">' + esc(c) + '</button>'; }).join('');
  }
  function medidaPeca(m) {
    if (!m) return '';
    return m.slice().sort(function (a, b) { return b - a; }).map(function (v) { return num(v); }).join(' × ') + ' cm';
  }
  function mostrarPecaRx(pc) {
    var box = $('#rx-info');
    if (!pc) { box.hidden = true; return; }
    var movTxt = pc.mov === 'gaveta' ? (pc.aberto ? 'Fechar gaveta' : 'Abrir gaveta') : pc.mov ? (pc.aberto ? 'Fechar porta' : 'Abrir porta') : '';
    var dados = [pc.material, medidaPeca(pc.medidas)].filter(Boolean);
    box.innerHTML = '<div class="rx-info__cab"><span class="rx-info__tipo">' + esc(pc.tipoNome) + '</span>' +
        '<button type="button" class="rx-info__x" data-rx="limpar" aria-label="Voltar para o móvel inteiro">' + ICONES.fechar + '</button></div>' +
      '<strong class="rx-info__nome">' + esc(pc.nome) + '</strong>' +
      (pc.grupo ? '<small class="rx-info__grupo">' + esc(pc.grupo) + '</small>' : '') +
      (pc.desc ? '<p class="rx-info__desc">' + esc(pc.desc) + '</p>' : '') +
      (dados.length ? '<p class="rx-info__dados">' + dados.map(esc).join(' · ') + '</p>' : '') +
      (movTxt ? '<div class="rx-info__acoes"><button type="button" class="rx-texto rx-texto--forte" data-rx="mov" data-id="' + esc(pc.id) + '">' + movTxt + '</button></div>' : '');
    box.hidden = false;
    fecharPops();
  }
  function atualizarExplodirRx() {
    if (!rx) return;
    var e = rx.explosao(), bP = $('#rx-explodir [data-rx="pausar"]');
    bP.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (e.pausada ? 'M8 5.5v13l10-6.5z' : 'M9 5.5v13M15 5.5v13') + '"/></svg>';
    bP.setAttribute('aria-label', e.pausada ? 'Continuar a animação' : 'Pausar a animação');
    bP.disabled = !e.andando && !e.pausada;
    if (!e.andando && !e.pausada && e.atual === 0) { $('#rx-explodir').hidden = true; $('#barra-raiox [data-b3="explodir"]').setAttribute('aria-pressed', 'false'); }
  }

  // ----- cliques na barra (os dois modos)
  palco.addEventListener('click', function (e) {
    var m = e.target.closest('[data-modo3d]');
    if (m) { if (m.getAttribute('data-modo3d') === 'raiox') entrarRaioX(); else if (modo3d === 'raiox') sairRaioX(); return; }
    var v = e.target.closest('[data-vista]');
    if (v) { var nv = v.getAttribute('data-vista'); if (modo3d === 'raiox' && rx) rx.vista(nv); else { if (galV.i >= 0) mostrarFotoViewer(-1); vistaPresenca(nv); } fecharPops(); return; }
    var pcb = e.target.closest('[data-peca]');
    if (pcb && rx) { rx.selecionar(pcb.getAttribute('data-peca')); return; }
    var cl = e.target.closest('[data-clipe]');
    if (cl && rx) { var fr = rx.tocarClipe(Number(cl.getAttribute('data-clipe'))); fecharPops(); dicaBarra((fr ? '▶ ' : '◀ ') + cl.textContent + (fr ? '' : ' (voltando)')); return; }
    var r = e.target.closest('[data-rx]');
    if (r && rx) {
      var a = r.getAttribute('data-rx');
      if (a === 'limpar') rx.selecionar(null);
      else if (a === 'mov') { var ab = rx.alternarMov(r.getAttribute('data-id')); var tp = /gaveta/i.test(r.textContent) ? 'gaveta' : 'porta'; r.textContent = (ab ? 'Fechar ' : 'Abrir ') + tp; $('#barra-raiox [data-b3="abrir"]').setAttribute('aria-pressed', String(rx.algoAberto())); }
      else if (a === 'pausar') { var ex = rx.explosao(); rx.pausarExplosao(!ex.pausada); atualizarExplodirRx(); }
      else if (a === 'montar') { rx.explodir(0); $('#barra-raiox [data-b3="explodir"]').setAttribute('aria-pressed', 'false'); atualizarExplodirRx(); dicaBarra('Montando de volta'); }
      return;
    }
    var b = e.target.closest('[data-b3]');
    if (!b) { if (!e.target.closest('.pop3d, .rx-info')) fecharPops(); return; }
    var acao = b.getAttribute('data-b3'), mv = mvAtual();
    if (acao === 'vistas') { alternarPop($('#vistas-pop'), b); return; }
    if (acao === 'pecas') { alternarPop($('#rx-lista'), b); return; }
    if (acao === 'animacoes') { alternarPop($('#rx-clipes'), b); return; }
    fecharPops();
    if (acao === 'cheia') { alternarTelaCheia(); return; }
    if (acao === 'centro') { if (rx) rx.centralizar(); else centralizarPresenca(); dicaBarra('Móvel centralizado'); return; }
    if (rx) {
      if (acao === 'explodir') {
        if (!rx.temExplosao) { dicaBarra('A vista explodida ainda não está disponível para este móvel.'); return; }
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', String(on));
        if (on) { $('#rx-explodir').hidden = false; rx.explodir(Number($('#rx-intens').value) / 100 || 1); if ($('#rx-intens').value === '0') { $('#rx-intens').value = 100; rx.explodir(1); } }
        else rx.explodir(0);
        atualizarExplodirRx(); dicaBarra(on ? 'Separando as peças' : 'Montando de volta');
      } else if (acao === 'abrir') {
        var abre = b.getAttribute('aria-pressed') !== 'true';
        rx.abrirTudo(abre); b.setAttribute('aria-pressed', String(abre));
        dicaBarra(abre ? 'Portas e gavetas abertas' : 'Portas e gavetas fechadas');
        var ib = $('#rx-info [data-rx="mov"]'); if (ib) { var tp2 = /gaveta/i.test(ib.textContent) ? 'gaveta' : 'porta'; ib.textContent = (abre ? 'Fechar ' : 'Abrir ') + tp2; }
      }
      return;
    }
    if (!mv) return;
    if (acao === 'girar') { var g = b.getAttribute('aria-pressed') !== 'true'; girarPresenca(g); dicaBarra(g ? 'Girando sozinho' : 'Rotação parada'); }
    else if (acao === 'mais') zoomPresenca(0.78);
    else if (acao === 'menos') zoomPresenca(1.28);
    else if (acao === 'dimensoes') alternarDimensoes();
    else if (acao === 'luz') { luzAtual = (luzAtual + 1) % LUZES.length; aplicarLuz(mv); dicaBarra('Iluminação: ' + LUZES[luzAtual].nome); b.setAttribute('aria-label', 'Trocar a iluminação (agora: ' + LUZES[luzAtual].nome + ')'); }
    else if (acao === 'cenario') {
      var ic = 0; CENARIOS.forEach(function (c, i) { if (c.id === cenarioAtual) ic = i; });
      cenarioAtual = CENARIOS[(ic + 1) % CENARIOS.length].id; aplicarCenario();
      try { localStorage.setItem('menureal:cenario3d', cenarioAtual); } catch (err) { /* ok */ }
      dicaBarra(CENARIOS[(ic + 1) % CENARIOS.length].nome);
    }
  });
  // no computador, passar o mouse mostra o nome do botão
  palco.addEventListener('mouseover', function (e) {
    var b = e.target.closest('[data-dica]');
    if (b && window.matchMedia && matchMedia('(hover: hover)').matches) dicaBarra(b.getAttribute('data-dica'));
  });
  $('#rx-transp').addEventListener('input', function () { if (rx) rx.transparencia(Number(this.value) / 100); });
  $('#rx-intens').addEventListener('input', function () {
    if (!rx) return; var v = Number(this.value) / 100; rx.explodir(v);
    $('#barra-raiox [data-b3="explodir"]').setAttribute('aria-pressed', String(v > 0)); atualizarExplodirRx();
  });
  $('#viewer-galeria').addEventListener('click', function (e) { var b = e.target.closest('[data-gal]'); if (b) mostrarFotoViewer(Number(b.getAttribute('data-gal'))); });
  $('#palco-fotos').addEventListener('click', function (e) { var b = e.target.closest('[data-foto-nav]'); if (b) mostrarFotoViewer(galV.i + Number(b.getAttribute('data-foto-nav'))); });
  (function () {   // arrastar para os lados troca a foto
    var x0 = null;
    $('#palco-fotos').addEventListener('pointerdown', function (e) { x0 = e.clientX; });
    $('#palco-fotos').addEventListener('pointerup', function (e) { if (x0 == null) return; var d = e.clientX - x0; x0 = null; if (Math.abs(d) > 40 && galV.itens.length > 1) mostrarFotoViewer(galV.i + (d < 0 ? 1 : -1)); });
  })();
  function estadoPalco(html, erro) {
    palcoEstado.hidden = !html;
    palcoEstado.classList.toggle('erro', !!erro);
    palcoEstado.innerHTML = html || '';
  }

  function trocarAba(modo) {
    var ar = modo === 'ar';
    $('#aba-3d').setAttribute('aria-selected', String(!ar));
    $('#aba-ar').setAttribute('aria-selected', String(ar));
    $('#painel-3d').hidden = ar;
    $('#painel-ar').hidden = !ar;
    if (ar) atualizarAvisoAR();
  }

  function motivoSemAR() {
    var ua = navigator.userAgent || '';
    var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var android = /Android/i.test(ua);
    var itens = [];
    if (!window.isSecureContext) itens.push('A página precisa estar em <strong>HTTPS</strong> (ou localhost) para usar a câmera.');
    if (MODELOS_EMBUTIDOS) itens.push('A versão de arquivo único serve para testar a interface; publique o projeto em HTTPS para testar a RA.');
    if (ios) itens.push('No iPhone/iPad, abra no <strong>Safari</strong> (iOS 12 ou mais recente). Navegadores dentro de outros apps podem bloquear o Quick Look.');
    else if (android) itens.push('No Android, use o <strong>Chrome</strong> atualizado e instale/atualize o <strong>Google Play Services para RA</strong> (ARCore). Nem todo aparelho é compatível.');
    else itens.push('Computadores não abrem a câmera em RA. Abra esta página em um celular compatível — o 3D continua funcionando aqui.');
    return itens;
  }

  function atualizarAvisoAR() {
    var mv = palco.querySelector('model-viewer');
    var caixa = $('#ar-indisp');
    if (mvStatus === 'falhou' || !mv) {
      caixa.hidden = false;
      caixa.innerHTML = '<strong>Realidade aumentada indisponível</strong>A biblioteca 3D não carregou.';
      return;
    }
    if (!mv.loaded) { caixa.hidden = true; return; }
    if (mv.canActivateAR) {
      caixa.hidden = true;
    } else {
      caixa.hidden = false;
      caixa.innerHTML = '<strong>Seu aparelho ou navegador não abriu a RA aqui</strong>' + 'Use o botão “Ver numa foto da minha casa”: funciona em qualquer celular.' +
        '<ul>' + motivoSemAR().map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ul>';
    }
  }

  var tamAtual = null;
  var adicSel = []; // opcionais marcados no visualizador

  function abrirViewer(id, modo) {
    var p = produtoPorId(id);
    if (!p) return;
    registrar('produto', p.id);
    tamAtual = temVersaoPrincipal(p) ? null : p.tamanhos && p.tamanhos.length ? p.tamanhos[Math.min(1, p.tamanhos.length - 1)].id : null;
    adicSel = [];
    abrirViewerProduto(p, modo);
  }

  function preencherTextosViewer(p) {
    var ef = p.combo ? { preco: p.preco, dim: p.dim } : efetivo(p, tamAtual);
    $('#viewer-cat').textContent = p.categoria + (p.ilustrativo && p.modelo ? ' · modelo ilustrativo' : '');
    $('#viewer-nome').textContent = p.nome;
    var lojaNome = LOJA && !ehAlimento() ? dados.padaria.nome : '';
    $('#viewer-loja').textContent = lojaNome ? 'por ' + lojaNome : ''; $('#viewer-loja').hidden = !lojaNome;
    var zapV = LOJA && !p.combo ? zapDaLoja() : '';
    $('#viewer-contato').hidden = !LOJA || !!p.combo;
    $('#viewer-zap').hidden = !zapV;
    if (zapV) $('#viewer-zap').href = 'https://wa.me/' + zapV + '?text=' + encodeURIComponent('Olá! Tenho interesse no ' + p.nome + ': ' + linkProduto(p.id));
    mostrarPrecoViewer(p, ef.preco);
    $('#viewer-dim').textContent = p.combo ? (p.ambiente ? 'como você arrumou' : 'itens lado a lado') : dimTexto(ef.dim);
    $('#viewer-desc').textContent = p.descricao;
    var tams = $('#viewer-tamanhos');
    tams.hidden = !(p.tamanhos && p.tamanhos.length);
    tams.setAttribute('aria-label', ehAlimento() ? 'Tamanho' : 'Versão');
    var opcoes = (p.tamanhos || []).slice();
    if (temVersaoPrincipal(p)) opcoes.unshift({ id: '', nome: p.versao || 'Original', preco: p.preco, dim: p.dim });
    tams.innerHTML = opcoes.map(function (t) {
      return '<button type="button" class="tam" data-tam="' + esc(t.id) + '" aria-pressed="' + (t.id === (tamAtual || '')) + '">' +
        '<strong>' + esc(t.nome) + '</strong><span>' + brl(t.preco) + '</span><small>' + esc(dimTexto(t.dim)) + '</small></button>';
    }).join('');
    var info = '';
    if (p.ingredientes) info += '<div><dt>' + (ehAlimento() ? 'Ingredientes' : 'Composição') + '</dt><dd>' + esc(p.ingredientes) + '</dd></div>';
    if (!ehAlimento() && p.acabamentos) info += '<div><dt>Acabamentos</dt><dd>' + esc(p.acabamentos) + '</dd></div>';
    if (ehAlimento() && p.alergenos && p.alergenos.length) info += '<div class="alerg"><dt>Alérgicos</dt><dd>Contém ' + esc(p.alergenos.join(', ').toLowerCase()) + '.</dd></div>';
    var matPlan = !ehAlimento() && !p.acabamentos && p.planejado && p.planejado.acabamentos && (!p.planejadoDe || p.planejadoDe === p.modelo);
    if (matPlan) info += '<div><dt>Materiais do projeto</dt><dd id="viewer-mat-plan">…</dd></div>';
    $('#viewer-info').innerHTML = info;
    $('#viewer-info').hidden = !info;
    if (matPlan) carregarPlanejado().then(function (P) {   // os acabamentos que estão na ficha do planejado
      var a = p.planejado.acabamentos, el = $('#viewer-mat-plan'); if (!el || produtoAtual !== p) return;
      el.textContent = ['Portas: ' + (P.CORES[a.portas] || '—'), 'Corpo: ' + (P.CORES[a.corpo] || '—')].concat(a.tampo && P.TAMPOS[a.tampo] && (p.planejado.trechos || []).some(function (t) { return t.tampo && (t.tipo === 'baixo' || t.tipo === 'bancada'); }) ? ['Tampo: ' + P.TAMPOS[a.tampo]] : []).join(' · ');
    }).catch(function () { var el = $('#viewer-mat-plan'); if (el) el.parentNode.remove(); });
    var adic = $('#viewer-adicionais');
    var lista = p.combo ? [] : (p.adicionais || []);
    adic.hidden = !lista.length;
    if (lista.length) adic.innerHTML = '<legend>Opcionais</legend><div class="adicionais__lista">' + lista.map(htmlAdicional).join('') + '</div>';
    atualizarPrecoViewer(p);
  }

  // ----- "Cabe no meu espaço?": conta simples com as medidas que o cliente mediu -----
  var espacoCliente = { l: '', p: '', a: '' };
  function lerCm(v) { var n = parseFloat(String(v || '').replace(',', '.')); return n > 0 && n < 5000 ? n : null; }
  function atualizarCabe() {
    var p = produtoAtual, caixa = $('#viewer-cabe');
    if (!caixa) return;
    var mostrar = !!(p && !p.combo && !ehAlimento());
    caixa.hidden = !mostrar;
    if (!mostrar) return;
    var d = efetivo(p, tamAtual).dim;
    var L = lerCm(espacoCliente.l), P = lerCm(espacoCliente.p), A = lerCm(espacoCliente.a);
    var res = $('#cabe-res');
    if (!L) { res.innerHTML = ''; return; }
    var cm = function (n) { return num(Math.abs(n)) + ' cm'; };
    var cabeL = L >= d.largura, cabeP = !P || P >= d.profundidade, cabeA = !A || A >= d.altura;
    var cabe = cabeL && cabeP && cabeA;
    var virado = !cabe && cabeA && P && L >= d.profundidade && P >= d.largura;
    var linhas = [];
    if (virado) {
      linhas.push('Virado, com a lateral encostada na parede: sobram <b>' + cm(L - d.profundidade) + '</b> na largura e <b>' + cm(P - d.largura) + '</b> na frente');
      linhas.push('Na posição normal faltam <b>' + cm(d.largura - L) + '</b> na largura');
    } else linhas.push(cabeL ? 'Largura: sobram <b>' + cm(L - d.largura) + '</b>' + (L - d.largura >= 2 ? ' (' + cm((L - d.largura) / 2) + ' de cada lado)' : '') : 'Largura: faltam <b>' + cm(d.largura - L) + '</b>');
    if (P && !virado) linhas.push(cabeP ? 'Profundidade: sobram <b>' + cm(P - d.profundidade) + '</b> na frente' : 'Profundidade: faltam <b>' + cm(d.profundidade - P) + '</b>');
    if (A) linhas.push(cabeA ? 'Altura: sobram <b>' + cm(A - d.altura) + '</b>' : 'Altura: faltam <b>' + cm(d.altura - A) + '</b>');
    var titulo, classe;
    if (cabe && L - d.largura < 3) { titulo = 'Cabe, mas bem justo'; classe = 'justo'; }
    else if (cabe) { titulo = 'Cabe!'; classe = 'sim'; }
    else if (virado) { titulo = 'Só cabe virado de lado'; classe = 'justo'; }
    else { titulo = 'Não cabe'; classe = 'nao'; }
    var aviso = '';
    if (cabe && P && P - d.profundidade < 60 && d.profundidade > 30) aviso = '<p class="mini">Para passar com conforto na frente, o ideal é deixar uns 60 cm livres.</p>';
    if (cabe && L - d.largura < 3) aviso += '<p class="mini">Com menos de 3 cm de folga, confira a medida de rodapés, tomadas e janelas antes de comprar.</p>';
    res.innerHTML = '<p class="cabe__titulo cabe__titulo--' + classe + '">' + titulo + '</p>' + desenhoCabe(d, L, P, cabe || virado ? classe : 'nao', virado) +
      '<ul>' + linhas.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' + aviso;
  }
  // planta vista de cima: o espaço e o móvel encostado na parede
  function desenhoCabe(d, L, P, classe, virado) {
    var ml = virado ? d.profundidade : d.largura, mp = virado ? d.largura : d.profundidade;
    var esp = P || Math.max(mp * 1.6, mp + 40);
    var largTotal = Math.max(L, ml), profTotal = Math.max(esp, mp);
    var W = 300, H = Math.max(70, Math.min(170, W * profTotal / largTotal));
    var k = Math.min((W - 20) / largTotal, (H - 20) / profTotal);
    var ox = (W - largTotal * k) / 2, oy = 10;
    var ex = ox + (largTotal - L) / 2 * k, mx = ox + (largTotal - ml) / 2 * k;
    var cor = classe === 'nao' ? 'var(--rosa)' : 'var(--verde)';
    return '<svg class="cabe__planta" viewBox="0 0 ' + W + ' ' + Math.round(H) + '" role="img" aria-label="Planta vista de cima do espaço com o móvel">' +
      '<rect x="' + ex + '" y="' + oy + '" width="' + (L * k) + '" height="' + (esp * k) + '" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-width="1.5"' + (P ? '' : ' stroke-dasharray="5 4"') + ' rx="2"/>' +
      '<line x1="' + ex + '" y1="' + oy + '" x2="' + (ex + L * k) + '" y2="' + oy + '" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="' + mx + '" y="' + (oy + 2) + '" width="' + (ml * k) + '" height="' + (mp * k) + '" fill="' + cor + '" fill-opacity=".28" stroke="' + cor + '" stroke-width="2" rx="4"/>' +
      '<text x="' + (W / 2) + '" y="' + (oy + 2 + mp * k / 2 + 4) + '" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">' + num(ml) + ' × ' + num(mp) + ' cm</text>' +
      '</svg><p class="mini cabe__legenda">Vista de cima. A linha grossa é a parede' + (P ? '' : '; sem a profundidade, o fundo é só ilustrativo') + '.</p>';
  }
  ['l', 'p', 'a'].forEach(function (k) {
    var el = document.getElementById('cabe-' + k);
    if (el) el.addEventListener('input', function () { espacoCliente[k] = el.value; atualizarCabe(); });
  });

  function mostrarPrecoViewer(p, preco) {
    var de = !p.combo && emOferta(p) && preco === p.preco;
    $('#viewer-preco').innerHTML = (de ? '<s class="preco-de">' + brl(p.precoDe) + '</s> ' : '') + brl(preco) + (de ? ' <span class="selo-oferta selo-oferta--txt">−' + descontoTexto(p) + '%</span>' : '');
    var pa = $('#viewer-parcela'); if (pa) { var t = p.combo ? '' : parcelaTexto(preco); pa.textContent = t; pa.hidden = !t; }
  }
  function atualizarPrecoViewer(p) {
    atualizarCabe();
    var preco = p.combo ? p.preco : precoMontado(p, tamAtual, adicSel);
    mostrarPrecoViewer(p, preco);
    var add = $('#viewer-add');
    add.hidden = !!p.combo;
    add.classList.remove('feito');
    add.disabled = !!p.esgotado;
    add.textContent = p.esgotado ? 'Esgotado no momento' : (ehAlimento() ? 'Adicionar ao pedido · ' : 'Adicionar ao orçamento · ') + brl(preco);
  }

  function htmlAdicional(a) {
    var fora = a.esgotado;
    return '<label class="adic' + (fora ? ' adic--esgotado' : '') + '"><input type="checkbox" data-adic="' + esc(a.id) + '"' +
      (adicSel.indexOf(a.id) > -1 && !fora ? ' checked' : '') + (fora ? ' disabled' : '') + '>' +
      '<span class="adic__marca" aria-hidden="true">' + ICONES.ok + '</span>' +
      '<span class="adic__txt">' + esc(a.nome) + '<small>' + (fora ? 'esgotado' : '+ ' + brl(a.preco)) + '</small></span></label>';
  }
  // Pontos de informação marcados pela loja (só no 3D em que foram marcados)
  function pontosValidos(p, ef) {
    return !p.combo && p.pontos && p.pontos.length && p.modelo && p.pontosDe === p.modelo && ef.modelo === p.modelo ? p.pontos : [];
  }
  function htmlPontosViewer(p, ef) {
    return pontosValidos(p, ef).map(function (pt, i) {
      return '<button slot="hotspot-info' + i + '" class="info-ponto" type="button" data-position="' + pt.p.join('m ') + 'm" data-normal="' + pt.n.join('m ') + 'm" data-visibility-attribute="visible" aria-expanded="false" aria-label="Informação ' + (i + 1) + ': ' + esc(pt.t) + '">' +
        '<span class="info-ponto__n" aria-hidden="true">' + (i + 1) + '</span><span class="info-ponto__txt">' + esc(pt.t) + '</span></button>';
    }).join('');
  }
  $('#viewer-compartilhar').addEventListener('click', function () {
    if (!produtoAtual) return;
    var url = linkProduto(produtoAtual.id), t = produtoAtual.nome + ' — ' + dados.padaria.nome;
    if (navigator.share) { navigator.share({ title: t, text: 'Olha este móvel: ' + produtoAtual.nome, url: url }).catch(function () {}); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { toast('Link copiado'); }).catch(function () { prompt('Copie o link:', url); });
  });
  function abrirViewerProduto(p, modo) {
    produtoAtual = p;
    $('#palco-fotos').hidden = true; $('#viewer-galeria').hidden = true; galV = { itens: [], i: -1, tem3d: false };
    if (rx || modo3d === 'raiox') sairRaioX();
    $('#barra-presenca').hidden = true; $('#palco-modos').hidden = true; $('#dim-card').hidden = true; fecharPops();
    var ef0 = p.combo ? { modelo: p.modelo } : efetivo(p, tamAtual);
    $('#viewer-abas').hidden = !ef0.modelo || SEM_3D;   // sem 3D: sem as abas 3D / tamanho real
    var dica0 = $('#painel-3d .dica'); if (dica0) dica0.hidden = !ef0.modelo || SEM_3D;
    preencherTextosViewer(p);
    $('#viewer-dim-modelo').textContent = 'calculando…';
    $('#viewer-escala').hidden = true;
    $('#ar-indisp').hidden = true;
    var ef = p.combo ? { modelo: p.modelo, dim: p.dim } : efetivo(p, tamAtual);

    var antigo = palco.querySelector('model-viewer');
    if (antigo) antigo.remove();

    abrirDialogo(dlgViewer);
    trocarAba(modo);

    if ((mvStatus === 'falhou' || SEM_3D) && fotosDoProduto(p).length && !p.combo) {
      $('#aba-ar').disabled = !ef.modelo || SEM_3D;
      renderGaleriaViewer(p, false); trocarAba('3d'); estadoPalco(''); mostrarFotoViewer(0);
      $('#viewer-dim-modelo').textContent = '—';
      toast(SEM_3D ? 'Este aparelho não mostra 3D. Veja as fotos e as medidas.' : 'O 3D não carregou. Veja as fotos e as medidas.');
      return;
    }
    if (mvStatus === 'falhou' || (SEM_3D && ef.modelo)) {
      estadoPalco(SEM_3D ? '<div class="palco-sem3d"><strong>Este aparelho não mostra 3D</strong>Confira as medidas abaixo e use o “Cabe no meu espaço?”. Num computador ou outro celular, o 3D aparece normalmente.</div>' : '<div class="caixa-erro"><strong>Visualização 3D indisponível</strong>A biblioteca &lt;model-viewer&gt; não carregou. Verifique a conexão com a internet e recarregue a página.</div>', true);
      $('#viewer-dim-modelo').textContent = '—';
      atualizarAvisoAR();
      return;
    }
    $('#aba-ar').disabled = !ef.modelo;
    $('#btn-foto-amb').hidden = !ef.modelo;
    marcarSemAR();
    var dica = $('#painel-3d .dica'); if (dica) dica.hidden = !ef.modelo;
    var celModelo = $('#viewer-dim-modelo').parentNode; if (celModelo) celModelo.hidden = !ef.modelo;
    renderGaleriaViewer(p, !!ef.modelo);
    if (!ef.modelo) {
      trocarAba('3d');
      if (fotosDoProduto(p).length) { estadoPalco(''); mostrarFotoViewer(0); }
      else estadoPalco('<div class="palco-sem3d"><strong>Produto sem foto</strong>O 3D deste produto ainda não está disponível. Confira as medidas e use o “Cabe no meu espaço?” abaixo.</div>');
      $('#viewer-dim-modelo').textContent = '—';
      return;
    }

    var mv = document.createElement('model-viewer');
    var attrs = {
      src: urlModelo(ef.modelo),
      alt: 'Modelo 3D de ' + p.nome + (p.combo ? '' : ', ' + dimTexto(ef.dim)),
      ar: '',
      // Sempre o app de RA do Google primeiro: é mais leve (não trava), fixa melhor no chão e usa a
      // luz real do ambiente, então o móvel parece de verdade. As etiquetas de medida ficam no 3D.
      'ar-modes': 'scene-viewer webxr quick-look',
      'ar-scale': 'fixed',
      'ar-placement': 'floor',
      'camera-controls': '',
      'touch-action': 'pan-y',
      'camera-orbit': '28deg 72deg auto',
      'interaction-prompt': 'auto',
      'shadow-intensity': '1.25',
      'shadow-softness': '0.55',
      'tone-mapping': 'neutral',
      'environment-image': ESTUDIO(),
      exposure: '1',
      'interpolation-decay': reduzMovimento ? '20' : '120'
    };
    if (!reduzMovimento) { attrs['auto-rotate'] = ''; attrs['auto-rotate-delay'] = '2500'; attrs['rotation-per-second'] = '18deg'; }
    Object.keys(attrs).forEach(function (k) { mv.setAttribute(k, attrs[k]); });
    aplicarLuz(mv);
    $('#barra-presenca [data-b3="girar"]').setAttribute('aria-pressed', String(!reduzMovimento));
    mv.innerHTML =
      '<button slot="ar-button" class="botao-ar" type="button" aria-label="Abrir câmera e ver no tamanho real">' + ICONES.ar + (ehAlimento() ? 'Ver na mesa' : 'Ver na sua casa') + '</button>' +
      '<div slot="progress-bar" class="progresso"><i></i></div>' +
      HTML_MEDIDAS + htmlPontosViewer(p, ef);
    mv.classList.add('sem-medidas');
    palco.insertBefore(mv, palcoEstado);
    estadoPalco('<div class="carregando"><div class="spinner" aria-hidden="true"></div><span>Carregando modelo 3D…</span></div>');

    var barra = mv.querySelector('.progresso i');
    mv.addEventListener('progress', function (e) {
      var t = e.detail.totalProgress;
      barra.style.width = Math.round(t * 100) + '%';
      barra.style.opacity = t >= 1 ? '0' : '1';
    });
    mv.addEventListener('load', function () {
      estadoPalco('');
      enquadrarPresenca(mv);
      if (p.combo) {
        try { var dc = mv.getDimensions(); $('#viewer-dim-modelo').textContent = dimTexto({ largura: dc.x * 100, altura: dc.y * 100, profundidade: dc.z * 100 }); } catch (e2) { /* ignora */ }
        mv.dataset.dimModo = 'linhas'; posicionarMedidas(mv, null);
      } else {
        // "Ver dimensões": as medidas cadastradas, desenhadas no 3D só quando o arquivo confere com elas
        var dimCad = efetivo(p, tamAtual).dim, esc0 = conferirEscala(mv, { dim: dimCad });
        mv.dataset.dimModo = esc0 === 'ok' ? 'linhas' : 'cartao';
        if (esc0 === 'ok') posicionarMedidas(mv, dimCad);
        $('#dim-card').innerHTML = '<strong>Medidas cadastradas</strong><span>L ' + num(dimCad.largura) + ' · P ' + num(dimCad.profundidade) + ' · A ' + num(dimCad.altura) + ' cm</span>' +
          '<small>' + (esc0 === 'maior' ? 'O 3D segue as proporções das fotos; valem estas medidas.' : 'O arquivo 3D não confere com estas medidas; valem as cadastradas.') + '</small>';
      }
      mostrarDimensoes(mv);
      $('#palco-modos').hidden = !fonteRaioX(p);
      marcarModo();
      atualizarAvisoAR();
      if (pontosValidos(p, ef).length) toast('Toque nos números no 3D para ver os detalhes do móvel.');
    });
    mv.addEventListener('error', function () {
      $('#barra-presenca').hidden = true; $('#palco-modos').hidden = true;
      if (!p.combo && fotosDoProduto(p).length) {   // plano B: mostra as fotos
        renderGaleriaViewer(p, false); mostrarFotoViewer(0); $('#viewer-dim-modelo').textContent = '—';
        toast('O 3D não carregou. Veja as fotos e as medidas.'); return;
      }
      estadoPalco('<div class="caixa-erro"><strong>Não foi possível carregar o modelo 3D</strong>' +
        'Confira se o arquivo existe e se a página está sendo servida por um servidor (não abra o index.html direto do disco).<br><br>' +
        'Arquivo: <code>' + esc(ef.modelo) + '</code></div>', true);
      $('#viewer-dim-modelo').textContent = '—';
      $('#ar-indisp').hidden = false;
      $('#ar-indisp').innerHTML = '<strong>Realidade aumentada indisponível</strong>O modelo 3D deste produto não carregou.';
    });
    // Antes de abrir a câmera: esconde avisos na camada de cima (podem atrapalhar a tela cheia da RA)
    mv.querySelector('.botao-ar').addEventListener('click', function (ev) {
      if (p && !p.combo) registrar('ar');
      var t = $('#toast');
      clearTimeout(toastTimer);
      t.classList.remove('ver');
      try { if (t.hidePopover && t.matches(':popover-open')) t.hidePopover(); } catch (err) { /* ok */ }
    }, true);
    var tentouSemMedidas = false;
    mv.addEventListener('ar-status', function (e) {
      if (e.detail.status !== 'failed') return;
      // A RA com medidas (WebXR) falhou: tenta de novo pelo app de RA do Google, que é mais estável
      if (!tentouSemMedidas && /^webxr/.test(mv.getAttribute('ar-modes') || '')) {
        tentouSemMedidas = true;
        mv.setAttribute('ar-modes', 'scene-viewer quick-look');
        toast('Abrindo a câmera sem as etiquetas de medida…');
        setTimeout(function () { try { mv.activateAR(); } catch (err) { /* segue no 3D */ } }, 60);
        return;
      }
      toast('Não foi possível abrir a câmera em RA neste aparelho. Continue no 3D.');
      trocarAba('3d');
    });
    if (mvStatus === 'carregando') {
      estadoPalco('<div class="carregando"><div class="spinner" aria-hidden="true"></div><span>Preparando visualizador 3D…</span></div>');
    }
    // cores do tecido/acabamento que vêm no próprio arquivo (KHR_materials_variants)
    var pcAntigo = $('#palco-cores'); if (pcAntigo) pcAntigo.remove();
    mv.addEventListener('load', function () { mostrarVariantes(mv); }, { once: true });
  }

  // ---------------------------------------------------------------------
  // Opcionais e cores do produto
  // ---------------------------------------------------------------------
  $('#viewer-adicionais').addEventListener('change', function (e) {
    var c = e.target.closest('[data-adic]');
    if (!c || !produtoAtual) return;
    var id = c.getAttribute('data-adic');
    adicSel = adicSel.filter(function (x) { return x !== id; });
    if (c.checked) adicSel.push(id);
    atualizarPrecoViewer(produtoAtual);
  });
  // Cores que o próprio arquivo 3D traz (ex.: o sofá em 5 tecidos): o cliente troca e vê na hora
  var CORES_PT = { champagne: 'Champanhe', navy: 'Azul-marinho', gray: 'Cinza', grey: 'Cinza', black: 'Preto', white: 'Branco', 'pale pink': 'Rosa-claro',
    pink: 'Rosa', red: 'Vermelho', green: 'Verde', blue: 'Azul', yellow: 'Amarelo', brown: 'Marrom', beige: 'Bege', 'mango velvet': 'Veludo manga', 'peacock velvet': 'Veludo pavão' };
  function nomeCor(v) { return CORES_PT[String(v).toLowerCase()] || v; }
  // Cores prontas para o lojista (tecidos, laca e madeiras mais vendidos)
  var PALETA_CORES = {
    'Off-white': '#ECE6DA', 'Areia': '#D9C9AE', 'Bege': '#C9B392', 'Linho': '#B9A98E', 'Fendi': '#A39684', 'Cinza-claro': '#B7B7B3', 'Cinza': '#8E8E8B', 'Grafite': '#4A4B4D', 'Preto': '#232323',
    'Caramelo': '#A8723D', 'Terracota': '#B5653E', 'Mostarda': '#C99A2E', 'Rosé': '#D4A5A0', 'Vinho': '#6E2A35', 'Verde-musgo': '#6B7350', 'Verde': '#4F6E58', 'Azul': '#4F6F8F', 'Azul-marinho': '#2E3B55',
    'Branco': '#EEEEEA', 'Freijó': '#A6754A', 'Nogueira': '#6A4A33', 'Carvalho': '#C8A77C', 'Marrom': '#5C3E2E',
    'Tabaco': '#4E4039', 'Barcelona': '#E8E6E1', 'Nogal': '#8C5E3E'
  };
  function hexVariante(v) {   // cor da bolinha: a do móvel montado pela foto, senão a paleta pelo nome
    var p = produtoAtual, c = p && p.movel && p.movel.cores ? p.movel.cores.filter(function (k) { return k.nome === v; })[0] : null;
    return c && /^#[0-9a-f]{6}$/i.test(c.hex) ? c.hex : PALETA_CORES[nomeCor(v)];
  }
  function mostrarVariantes(mv) {
    var alvo = $('#viewer-cores');
    var lista = (mv.availableVariants || []).slice(0, 12);
    alvo.hidden = lista.length < 2;
    var pcV = $('#palco-cores'); if (pcV) pcV.remove();
    if (lista.length < 2) { alvo.innerHTML = ''; return; }
    // bolinhas de cor em cima do 3D: o cliente troca enquanto gira o móvel
    var bar = document.createElement('div');
    bar.id = 'palco-cores'; bar.className = 'palco-cores'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Cores');
    bar.innerHTML = lista.map(function (v) {
      var hx = hexVariante(v);
      return '<button type="button" class="palco-cor" data-variante="' + esc(v) + '" aria-pressed="' + (v === mv.variantName) + '" aria-label="' + esc(nomeCor(v)) + '" title="' + esc(nomeCor(v)) + '">' +
        (hx ? '<i style="background:' + hx + '"></i>' : '<i class="sem-cor">' + esc(nomeCor(v).slice(0, 2)) + '</i>') + '</button>';
    }).join('') + '<span class="palco-cores__nome" aria-live="polite">' + esc(nomeCor(mv.variantName || lista[0])) + '</span>';
    palco.appendChild(bar);
    alvo.innerHTML = '<legend>Cor <small>' + lista.length + ' opções</small></legend><div class="cores">' + lista.map(function (v, i) {
      var hx = hexVariante(v);
      return '<button type="button" class="cor-op" data-variante="' + esc(v) + '" aria-pressed="' + (v === mv.variantName) + '">' + (hx ? '<i class="cor-bola" style="background:' + hx + '" aria-hidden="true"></i>' : '') + esc(nomeCor(v)) + '</button>';
    }).join('') + '</div>';
  }
  // Câmera do Android (Scene Viewer) sempre abre a cor padrão do arquivo: entrega a cópia na cor escolhida (?cor=)
  palco.addEventListener('click', function (e) {
    if (!e.target.closest('.botao-ar')) return;
    var mv = palco.querySelector('model-viewer'), lista = mv ? mv.availableVariants || [] : [];
    if (!mv || lista.length < 2 || !mv.variantName || mv.variantName === lista[0]) return;
    var u = new URL(mv.getAttribute('src'), document.baseURI); u.searchParams.set('cor', mv.variantName);
    var url = u.toString();
    Object.defineProperty(mv, 'src', { configurable: true, get: function () { return url; }, set: function (v) { delete mv.src; mv.src = v; } });
    setTimeout(function () { delete mv.src; }, 1500);
  }, true);
  function escolherCor(e) {
    var b = e.target.closest('[data-variante]');
    var mv = palco.querySelector('model-viewer');
    if (!b || !mv) return;
    var v = b.getAttribute('data-variante');
    mv.variantName = v;
    $$('#viewer-cores [data-variante], #palco-cores [data-variante]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-variante') === v)); });
    var nm = $('#palco-cores .palco-cores__nome'); if (nm) nm.textContent = nomeCor(v);
    if (e.target.closest('#palco-cores')) dicaBarra('Cor: ' + nomeCor(v));
  }
  $('#viewer-cores').addEventListener('click', escolherCor);
  palco.addEventListener('click', function (e) { if (e.target.closest('#palco-cores')) escolherCor(e); });

  // ---------------------------------------------------------------------
  // Medidas no modelo (largura, altura, profundidade) — 3D e câmera (WebXR)
  // ---------------------------------------------------------------------
  var quadroMedidas = 0;
  var HTML_MEDIDAS =
    '<button slot="hotspot-pA" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<button slot="hotspot-pB" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<button slot="hotspot-pC" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<button slot="hotspot-pD" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<div slot="hotspot-mL" class="med-rotulo" data-med="largura"></div>' +
    '<div slot="hotspot-mA" class="med-rotulo" data-med="altura"></div>' +
    '<div slot="hotspot-mP" class="med-rotulo" data-med="profundidade"></div>' +
    '<svg class="med-linhas" aria-hidden="true"><line data-de="pA" data-ate="pB"></line><line data-de="pA" data-ate="pC"></line><line data-de="pB" data-ate="pD"></line></svg>';

  function cmTexto(m) { var c = m * 100; return (c < 10 ? c.toFixed(1).replace('.', ',') : String(Math.round(c))) + ' cm'; }

  // rot: medidas cadastradas (cm) já conferidas com o 3D; sem rot, as do próprio arquivo (conjuntos)
  function posicionarMedidas(mv, rot) {
    try {
      var c = mv.getBoundingBoxCenter(), d = mv.getDimensions();
      var x0 = c.x - d.x / 2, x1 = c.x + d.x / 2, y0 = c.y - d.y / 2, y1 = c.y + d.y / 2, z0 = c.z - d.z / 2, z1 = c.z + d.z / 2;
      var folga = Math.max(d.x, d.y, d.z) * 0.08;
      function pos(nome, x, y, z) { mv.updateHotspot({ name: 'hotspot-' + nome, position: x + 'm ' + y + 'm ' + z + 'm' }); }
      // largura: aresta da frente embaixo; altura: canto esquerdo da frente; profundidade: lado direito
      pos('pA', x0, y0, z1); pos('pB', x1, y0, z1); pos('pC', x0, y1, z1); pos('pD', x1, y0, z0);
      pos('mL', c.x, y0, z1 + folga);
      pos('mA', x0 - folga, c.y, z1);
      pos('mP', x1 + folga, y0, c.z);
      var t = function (cad, m) { return cad ? num(cad) + ' cm' : cmTexto(m); };
      mv.querySelector('[data-med="largura"]').textContent = 'L ' + t(rot && rot.largura, d.x);
      mv.querySelector('[data-med="altura"]').textContent = 'A ' + t(rot && rot.altura, d.y);
      mv.querySelector('[data-med="profundidade"]').textContent = 'P ' + t(rot && rot.profundidade, d.z);
      animarLinhas(mv);
    } catch (e) { /* modelo sem dimensões: sem medidas */ }
  }

  function animarLinhas(mv) {
    cancelAnimationFrame(quadroMedidas);
    var linhas = $$('.med-linhas line', mv).map(function (l) { return { el: l, de: 'hotspot-' + l.getAttribute('data-de'), ate: 'hotspot-' + l.getAttribute('data-ate'), v: [] }; });
    function quadro() {
      if (!mv.isConnected) return;
      if (!mv.classList.contains('sem-medidas')) {
        linhas.forEach(function (l) {
          var a = mv.queryHotspot(l.de), b = mv.queryHotspot(l.ate);
          if (!a || !b) return;
          // arredonda e só mexe no desenho quando a linha realmente mudou (alivia a câmera/RA)
          var n = [Math.round(a.canvasPosition.x), Math.round(a.canvasPosition.y), Math.round(b.canvasPosition.x), Math.round(b.canvasPosition.y)];
          if (n[0] === l.v[0] && n[1] === l.v[1] && n[2] === l.v[2] && n[3] === l.v[3]) return;
          l.v = n;
          l.el.setAttribute('x1', n[0]); l.el.setAttribute('y1', n[1]); l.el.setAttribute('x2', n[2]); l.el.setAttribute('y2', n[3]);
        });
      }
      quadroMedidas = requestAnimationFrame(quadro);
    }
    quadro();
  }

  palco.addEventListener('click', function (e) {
    var ip = e.target.closest('.info-ponto');
    if (ip) {
      var abrir = ip.getAttribute('aria-expanded') !== 'true';
      $$('.info-ponto', palco).forEach(function (o) { o.setAttribute('aria-expanded', 'false'); });
      ip.setAttribute('aria-expanded', String(abrir));
      girarPresenca(false);
      return;
    }
  });

  function conferirEscala(mv, p) {
    var el = $('#viewer-escala');
    try {
      var d = mv.getDimensions(); // metros
      var m = { largura: d.x * 100, altura: d.y * 100, profundidade: d.z * 100 };
      $('#viewer-dim-modelo').textContent = dimTexto(m);
      var ok = ['largura', 'profundidade', 'altura'].every(function (k) {
        return Math.abs(m[k] - p.dim[k]) / p.dim[k] <= TOLERANCIA_ESCALA;
      });
      var maiorM = Math.max(m.largura, m.profundidade, m.altura);
      var maiorP = Math.max(p.dim.largura, p.dim.profundidade, p.dim.altura);
      var okMaior = Math.abs(maiorM - maiorP) / maiorP <= TOLERANCIA_ESCALA;
      el.hidden = false;
      el.className = 'escala ' + (ok || okMaior ? 'ok' : 'aviso');
      var res = ok ? 'ok' : okMaior ? 'maior' : 'difere';
      el.textContent = ok
        ? '✓ Escala conferida: o arquivo 3D tem as medidas cadastradas. Em RA, ele aparece nesse tamanho.'
        : okMaior
          ? '✓ Tamanho real ajustado pela maior medida (' + num(maiorP) + ' cm). As outras medidas seguem as proporções das fotos.'
          : '⚠ O arquivo 3D não corresponde às medidas cadastradas. Em RA ele aparecerá com o tamanho do arquivo (' + dimTexto(m) + '). Ajuste o modelo ou as medidas.';
      return res;
    } catch (e) {
      $('#viewer-dim-modelo').textContent = '—';
      return 'difere';
    }
  }

  // ===================================================================
  // Ver numa foto da casa: funciona em qualquer celular (mesmo sem RA).
  // O cliente tira/escolhe uma foto, marca uma medida conhecida (parede,
  // porta, piso) e o móvel aparece na foto na escala certa. Depois gira,
  // posiciona e compartilha a imagem.
  // ===================================================================
  // Android no Chrome sem a RA do Google (ARCore): o botão "Ver na sua casa" abriria o app do Google,
  // que sem ARCore só mostra o 3D. Nesses celulares o botão abre direto o modo foto.
  var semARCore = false;
  (function () {
    var ua = navigator.userAgent || '';
    var chrome = /Android/i.test(ua) && /Chrome\//.test(ua) && !/SamsungBrowser|EdgA|OPR\/|Firefox|; wv\)|FBAN|FBAV|Instagram/i.test(ua);
    if (!chrome || MODELOS_EMBUTIDOS) return;
    if (!navigator.xr || !navigator.xr.isSessionSupported) { semARCore = true; return; }
    navigator.xr.isSessionSupported('immersive-ar').then(function (ok) { semARCore = !ok; marcarSemAR(); }).catch(function () {});
  })();
  function marcarSemAR() { var b = $('#btn-foto-amb'); if (b) b.classList.toggle('foto-amb-btn--principal', semARCore); }
  palco.addEventListener('click', function (e) {
    if (!semARCore || !e.target.closest('.botao-ar')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    registrar('ar', produtoAtual && produtoAtual.id);
    abrirFotoAmbiente();
  }, true);

  var fa = null;   // { p, ef, variante, foto: {img, w, h, url}, ref: {x1,y1,x2,y2,cm}, sprite, pos, theta, phi, ajuste, luz, etapa }
  function abrirFotoAmbiente() {
    var mvV = palco.querySelector('model-viewer');
    if (!produtoAtual || !mvV) return;
    var ef = produtoAtual.combo ? { modelo: produtoAtual.modelo } : efetivo(produtoAtual, tamAtual);
    fa = { p: produtoAtual, modelo: ef.modelo, variante: mvV.variantName || '', etapa: 'foto', theta: -20, phi: 76, ajuste: 1, luz: 1 };
    // o 3D baixa a resolução sozinho quando o aparelho fica lento, e a captura sairia cortada: trava em 100% enquanto a tela está aberta
    var MV = customElements.get('model-viewer');
    if (MV && fa.escalaAntes == null) { fa.escalaAntes = MV.minimumRenderScale; MV.minimumRenderScale = 1; }
    renderFoto();
    abrirDialogo($('#dlg-casa'));
  }
  function renderFoto() {
    var corpo = $('#casa-corpo'), rod = $('#casa-rodape');
    if (fa.etapa === 'foto') {
      corpo.innerHTML =
        '<p style="margin-top:0">Veja <strong>' + esc(fa.p.nome) + '</strong> numa foto do lugar onde ele vai ficar, no tamanho certo.</p>' +
        '<ol class="passos casa-passos"><li>Fique de frente para o lugar, com o celular na altura do peito.</li><li>Mostre o chão e a parede onde o móvel vai ficar.</li><li>Tire a foto com o lugar bem iluminado.</li></ol>' +
        '<label class="btn btn--primario btn--bloco casa-btn-arq">Tirar foto agora<input type="file" accept="image/*" capture="environment" data-casa-arq hidden></label>' +
        '<label class="btn btn--contorno btn--bloco casa-btn-arq">Escolher foto da galeria<input type="file" accept="image/*" data-casa-arq hidden></label>';
      rod.innerHTML = '';
      return;
    }
    if (fa.etapa === 'ref') {
      corpo.innerHTML =
        '<p style="margin-top:0"><strong>Marque algo que você sabe a medida</strong>, no lugar onde o móvel vai ficar: a largura da parede, uma porta, um piso. Arraste as duas bolinhas até as pontas.</p>' +
        '<div class="casa-palco" id="casa-palco"><img src="' + fa.foto.url + '" alt="Sua foto" draggable="false">' +
          '<svg class="casa-ref" id="casa-ref" viewBox="0 0 ' + fa.foto.w + ' ' + fa.foto.h + '" preserveAspectRatio="none"></svg></div>' +
        '<div class="casa-medida">' + campo('Quanto mede essa linha?', '<span class="casa-cm"><input id="casa-cm" type="text" inputmode="decimal" placeholder="ex.: 240" autocomplete="off"> cm</span>') + '</div>' +
        '<div class="casa-sugestoes"><span>Dica:</span><button type="button" class="chip" data-casa-cm="80">Porta: 80 cm</button><button type="button" class="chip" data-casa-cm="60">Piso: 60 cm</button><button type="button" class="chip" data-casa-cm="210">Altura da porta: 210 cm</button></div>';
      rod.innerHTML = '<div class="linha-acoes plan-rod"><button class="btn btn--fantasma btn--p" type="button" data-casa-pular>Não sei medir</button><button class="btn btn--primario" type="button" data-casa-continuar>Continuar</button></div>';
      desenharRef(); ligarRef();
      return;
    }
    // etapa 'mover'
    corpo.innerHTML =
      '<div class="casa-palco" id="casa-palco"><img src="' + fa.foto.url + '" alt="Sua foto com o móvel" draggable="false">' +
        '<div class="casa-sombra" id="casa-sombra"></div><img class="casa-movel" id="casa-movel" alt="' + esc(fa.p.nome) + '" draggable="false" hidden>' +
        '<div class="casa-carregando" id="casa-carregando"><div class="spinner" aria-hidden="true"></div></div></div>' +
      '<p class="mini casa-dica">' + (fa.ref.aprox ? '⚠ Tamanho aproximado (sem medida de referência). ' : '') + 'Arraste o móvel para posicionar.</p>' +
      '<div class="casa-ctrl">' +
        '<button type="button" class="btn btn--sec btn--p" data-casa-girar="-30" aria-label="Girar para a esquerda">↺ Girar</button>' +
        '<button type="button" class="btn btn--sec btn--p" data-casa-girar="30" aria-label="Girar para a direita">Girar ↻</button>' +
        '<button type="button" class="btn btn--fantasma btn--p" data-casa-refazer>Refazer medida</button>' +
      '</div>' +
      '<label class="campo casa-slider"><span>Ângulo da foto <small>(de frente ↔ de cima)</small></span><input type="range" id="casa-phi" min="60" max="88" value="' + (148 - fa.phi) + '"></label>' +
      '<label class="campo casa-slider"><span>Ajuste do tamanho <small>(se o móvel ficar mais à frente ou ao fundo)</small></span><input type="range" id="casa-ajuste" min="70" max="130" value="' + Math.round(fa.ajuste * 100) + '"></label>' +
      '<label class="campo casa-slider"><span>Luz</span><input type="range" id="casa-luz" min="60" max="140" value="' + Math.round(fa.luz * 100) + '"></label>' +
      '<div class="casa-render" aria-hidden="true"><model-viewer id="casa-mv" src="' + esc(urlModelo(fa.modelo)) + '" loading="eager" interaction-prompt="none" environment-image="' + esc(ESTUDIO()) + '" tone-mapping="neutral" shadow-intensity="0" field-of-view="18deg" camera-orbit="' + fa.theta + 'deg ' + fa.phi + 'deg auto" style="background:transparent"></model-viewer></div>';
    rod.innerHTML = '<div class="linha-acoes plan-rod"><button class="btn btn--contorno btn--p" type="button" data-casa-baixar>Baixar imagem</button><button class="btn btn--primario" type="button" data-casa-compartilhar>Compartilhar</button></div>';
    var mv = $('#casa-mv');
    mv.addEventListener('load', function () {
      if (fa && fa.variante && (mv.availableVariants || []).indexOf(fa.variante) > -1) mv.variantName = fa.variante;
      try { var d = mv.getDimensions(); fa.dimM = { x: d.x * 100, y: d.y * 100, z: d.z * 100 }; } catch (e) { fa.dimM = null; }
      setTimeout(renderizarMovel, 250);
    }, { once: true });
    ligarMover();
  }
  // ----- etapa da medida de referência
  function desenharRef() {
    var r = fa.ref, svg = $('#casa-ref'); if (!svg) return;
    var k = fa.foto.w / ($('#casa-palco').clientWidth || fa.foto.w), raio = 16 * k, esp = 4 * k;
    svg.innerHTML = '<line x1="' + r.x1 + '" y1="' + r.y1 + '" x2="' + r.x2 + '" y2="' + r.y2 + '" stroke="#FFD23F" stroke-width="' + esp + '" stroke-dasharray="' + (esp * 3) + ' ' + (esp * 2) + '"/>' +
      [[r.x1, r.y1, 1], [r.x2, r.y2, 2]].map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + raio + '" fill="rgba(255,210,63,.35)" stroke="#FFD23F" stroke-width="' + esp + '" data-ponta="' + q[2] + '"/>'; }).join('') +
      (r.cm ? '<text x="' + (r.x1 + r.x2) / 2 + '" y="' + ((r.y1 + r.y2) / 2 - raio * 1.4) + '" font-size="' + raio * 1.6 + '" font-weight="800" fill="#FFD23F" stroke="#000" stroke-width="' + k * 3 + '" paint-order="stroke" text-anchor="middle">' + num(r.cm) + ' cm</text>' : '');
  }
  function pontoNaFoto(e) {
    var b = $('#casa-palco').getBoundingClientRect();
    return { x: Math.max(0, Math.min(fa.foto.w, (e.clientX - b.left) / b.width * fa.foto.w)), y: Math.max(0, Math.min(fa.foto.h, (e.clientY - b.top) / b.height * fa.foto.h)) };
  }
  function ligarRef() {
    var svg = $('#casa-ref'), arr = null;
    svg.addEventListener('pointerdown', function (e) {
      var q = pontoNaFoto(e), r = fa.ref;
      var d1 = Math.hypot(q.x - r.x1, q.y - r.y1), d2 = Math.hypot(q.x - r.x2, q.y - r.y2);
      arr = d1 < d2 ? 1 : 2;
      try { svg.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
      mover(e); e.preventDefault();
    });
    function mover(e) { if (!arr) return; var q = pontoNaFoto(e); fa.ref['x' + arr] = q.x; fa.ref['y' + arr] = q.y; desenharRef(); }
    svg.addEventListener('pointermove', mover);
    svg.addEventListener('pointerup', function () { arr = null; });
    svg.addEventListener('pointercancel', function () { arr = null; });
  }
  // ----- etapa do móvel na foto
  function renderizarMovel(tentativa) {
    tentativa = tentativa || 0;
    var mv = $('#casa-mv'); if (!mv || !fa) return;
    var car = $('#casa-carregando'); if (car) car.hidden = false;
    mv.cameraOrbit = fa.theta + 'deg ' + fa.phi + 'deg auto';
    mv.jumpCameraToGoal();
    requestAnimationFrame(function () { requestAnimationFrame(function () { setTimeout(function () {
      if (!fa) return;
      mv.toBlob({ mimeType: 'image/png', idealAspect: false }).then(function (blob) { return createImageBitmap(blob); }).then(function (bmp) {
        // recorta o que é transparente em volta do móvel
        var c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        var d = g.getImageData(0, 0, c.width, c.height).data, x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
        for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) throw new Error('vazio');
        // encostou na borda = captura ainda na resolução errada: espera e tenta de novo
        if ((x0 === 0 || y0 === 0 || x1 === c.width - 1 || y1 === c.height - 1) && tentativa < 3) { setTimeout(function () { renderizarMovel(tentativa + 1); }, 450); return; }
        var w = x1 - x0 + 1, h = y1 - y0 + 1, cc = document.createElement('canvas'); cc.width = w; cc.height = h;
        cc.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
        // largura real do que aparece (vista de cima, ignorando a perspectiva): L·|cos θ| + P·|sen θ|
        var t = fa.theta * Math.PI / 180, dm = fa.dimM || { x: 100, z: 50 };
        fa.sprite = { canvas: cc, url: cc.toDataURL('image/png'), larguraCm: dm.x * Math.abs(Math.cos(t)) + dm.z * Math.abs(Math.sin(t)), proporcao: h / w };
        if (!fa.pos) fa.pos = { x: (fa.ref.x1 + fa.ref.x2) / 2, y: Math.max(fa.ref.y1, fa.ref.y2) + fa.foto.h * 0.04 };
        posicionarMovel();
        var im = $('#casa-movel'); im.src = fa.sprite.url; im.hidden = false;
        if (car) car.hidden = true;
        if (!fa.registrado) { fa.registrado = true; registrar('ar', fa.p.id); }
      }).catch(function () { if (car) car.innerHTML = '<p>Não deu para mostrar o móvel. Tente de novo.</p>'; });
    }, 120); }); });
  }
  function tamanhoNaFoto() {   // largura do móvel em pixels da foto
    var pxCm = Math.hypot(fa.ref.x2 - fa.ref.x1, fa.ref.y2 - fa.ref.y1) / fa.ref.cm;
    var w = fa.sprite.larguraCm * pxCm * fa.ajuste;
    return { w: w, h: w * fa.sprite.proporcao };
  }
  function posicionarMovel() {
    var im = $('#casa-movel'), sb = $('#casa-sombra'), pl = $('#casa-palco');
    if (!im || !fa.sprite || !pl) return;
    var k = pl.clientWidth / fa.foto.w, t = tamanhoNaFoto();
    im.style.width = t.w * k + 'px'; im.style.left = (fa.pos.x - t.w / 2) * k + 'px'; im.style.top = (fa.pos.y - t.h) * k + 'px';
    im.style.filter = 'brightness(' + fa.luz + ')';
    sb.style.width = t.w * 1.02 * k + 'px'; sb.style.height = Math.max(6, t.w * 0.09) * k + 'px';
    sb.style.left = (fa.pos.x - t.w * 0.51) * k + 'px'; sb.style.top = (fa.pos.y - Math.max(6, t.w * 0.09) * 0.55) * k + 'px';
  }
  function ligarMover() {
    var pl = $('#casa-palco'), arr = null;
    pl.addEventListener('pointerdown', function (e) {
      if (!fa.sprite || !e.target.closest('#casa-movel')) return;
      var q = pontoNaFoto(e); arr = { dx: fa.pos.x - q.x, dy: fa.pos.y - q.y };
      try { pl.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
      e.preventDefault();
    });
    pl.addEventListener('pointermove', function (e) {
      if (!arr) return;
      var q = pontoNaFoto(e); fa.pos.x = q.x + arr.dx; fa.pos.y = Math.max(10, q.y + arr.dy); posicionarMovel();
    });
    pl.addEventListener('pointerup', function () { arr = null; });
    pl.addEventListener('pointercancel', function () { arr = null; });
  }
  function montarImagemFinal() {
    var t = tamanhoNaFoto(), c = document.createElement('canvas'); c.width = fa.foto.w; c.height = fa.foto.h;
    var g = c.getContext('2d');
    g.drawImage(fa.foto.img, 0, 0, fa.foto.w, fa.foto.h);
    // sombra de contato no chão
    var sw = t.w * 1.02, sh = Math.max(6, t.w * 0.09);
    g.save(); g.translate(fa.pos.x, fa.pos.y - sh * 0.05); g.scale(1, sh / sw);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, sw / 2); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, sw / 2, 0, Math.PI * 2); g.fill(); g.restore();
    if ('filter' in g) g.filter = 'brightness(' + fa.luz + ')';
    g.drawImage(fa.sprite.canvas, fa.pos.x - t.w / 2, fa.pos.y - t.h, t.w, t.h);
    g.filter = 'none';
    // etiqueta discreta com o produto e a loja
    var txt = fa.p.nome + ' · ' + (dados.padaria.nome || ''), fs = Math.round(c.width * 0.024);
    g.font = '700 ' + fs + 'px system-ui, sans-serif';
    var tw = g.measureText(txt).width;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(fs * 0.6, c.height - fs * 2.2, tw + fs * 1.2, fs * 1.6);
    g.fillStyle = '#fff'; g.fillText(txt, fs * 1.2, c.height - fs * 0.95);
    return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.9); });
  }
  function carregarFotoAmbiente(arq) {
    var url = URL.createObjectURL(arq), img = new Image();
    img.onload = function () {
      var k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      fa.foto = { img: c, w: c.width, h: c.height, url: c.toDataURL('image/jpeg', 0.9) };
      fa.ref = { x1: c.width * 0.3, y1: c.height * 0.72, x2: c.width * 0.7, y2: c.height * 0.72, cm: 0 };
      fa.pos = null; fa.etapa = 'ref'; renderFoto();
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast('Não deu para abrir essa foto.'); };
    img.src = url;
  }
  $('#btn-foto-amb').addEventListener('click', abrirFotoAmbiente);
  $('#dlg-casa').addEventListener('close', function () {
    var MV = customElements.get('model-viewer');
    if (fa && MV && fa.escalaAntes != null) MV.minimumRenderScale = fa.escalaAntes;
    fa = null;
  });
  document.addEventListener('change', function (e) {
    if (!fa || !e.target.closest('#dlg-casa')) return;
    if (e.target.matches('[data-casa-arq]') && e.target.files && e.target.files[0]) carregarFotoAmbiente(e.target.files[0]);
  });
  document.addEventListener('input', function (e) {
    if (!fa || !e.target.closest('#dlg-casa')) return;
    if (e.target.id === 'casa-cm') { fa.ref.cm = Number(String(e.target.value).replace(',', '.')) || 0; desenharRef(); }
    if (e.target.id === 'casa-ajuste') { fa.ajuste = Number(e.target.value) / 100; posicionarMovel(); }
    if (e.target.id === 'casa-luz') { fa.luz = Number(e.target.value) / 100; posicionarMovel(); }
  });
  document.addEventListener('change', function (e) {
    if (fa && e.target.id === 'casa-phi') { fa.phi = 148 - Number(e.target.value); renderizarMovel(); }
  });
  document.addEventListener('click', function (e) {
    if (!fa || !e.target.closest('#dlg-casa')) return;
    var b;
    if ((b = e.target.closest('[data-casa-cm]'))) { $('#casa-cm').value = b.getAttribute('data-casa-cm'); fa.ref.cm = Number(b.getAttribute('data-casa-cm')); desenharRef(); return; }
    if (e.target.closest('[data-casa-continuar]')) {
      if (!(fa.ref.cm > 5)) { toast('Digite quanto mede a linha, em centímetros.'); $('#casa-cm').focus(); return; }
      if (Math.hypot(fa.ref.x2 - fa.ref.x1, fa.ref.y2 - fa.ref.y1) < fa.foto.w * 0.05) { toast('Afaste mais as duas bolinhas.'); return; }
      fa.ref.aprox = false; fa.etapa = 'mover'; renderFoto(); return;
    }
    if (e.target.closest('[data-casa-pular]')) {   // sem referência: supõe que a largura da foto, na altura da linha, tem ~3,5 m
      fa.ref = { x1: 0, y1: fa.ref.y1, x2: fa.foto.w, y2: fa.ref.y1, cm: 350, aprox: true };
      fa.etapa = 'mover'; renderFoto(); return;
    }
    if (e.target.closest('[data-casa-refazer]')) { fa.etapa = 'ref'; fa.sprite = null; if (fa.ref.aprox) fa.ref = { x1: fa.foto.w * 0.3, y1: fa.foto.h * 0.72, x2: fa.foto.w * 0.7, y2: fa.foto.h * 0.72, cm: 0 }; renderFoto(); return; }
    if ((b = e.target.closest('[data-casa-girar]'))) { fa.theta = ((fa.theta + Number(b.getAttribute('data-casa-girar')) + 540) % 360) - 180; renderizarMovel(); return; }
    var baixar = e.target.closest('[data-casa-baixar]'), comp = e.target.closest('[data-casa-compartilhar]');
    if ((baixar || comp) && fa.sprite) {
      montarImagemFinal().then(function (blob) {
        var nome = slug(fa.p.nome) + '-na-minha-casa.jpg', arq = new File([blob], nome, { type: 'image/jpeg' });
        if (comp && navigator.canShare && navigator.canShare({ files: [arq] })) {
          navigator.share({ files: [arq], title: fa.p.nome, text: 'Olha como fica o ' + fa.p.nome + ' aqui em casa! ' + enderecoLoja() + '?p=' + encodeURIComponent(fa.p.id) }).catch(function () { /* cancelado */ });
          return;
        }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        if (comp) toast('Imagem salva. Agora é só mandar no WhatsApp.');
      });
    }
  });
  window.addEventListener('resize', function () { if (fa && fa.etapa === 'mover') posicionarMovel(); if (fa && fa.etapa === 'ref') desenharRef(); });

  $('#aba-3d').addEventListener('click', function () { trocarAba('3d'); });
  $('#aba-ar').addEventListener('click', function () { trocarAba('ar'); });
  $('.abas').addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      var ar = $('#aba-ar').getAttribute('aria-selected') === 'true';
      trocarAba(ar ? '3d' : 'ar');
      (ar ? $('#aba-3d') : $('#aba-ar')).focus();
    }
  });
  $('#viewer-tamanhos').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tam]');
    if (!b || !produtoAtual) return;
    var antes = efetivo(produtoAtual, tamAtual).modelo;
    tamAtual = b.getAttribute('data-tam') || null;
    var ef = efetivo(produtoAtual, tamAtual);
    preencherTextosViewer(produtoAtual);
    var mv = palco.querySelector('model-viewer');
    if (ef.modelo !== antes || !mv) {
      abrirViewerProduto(produtoAtual, $('#aba-ar').getAttribute('aria-selected') === 'true' ? 'ar' : '3d');
    } else {
      conferirEscala(mv, { dim: ef.dim });
    }
  });

  $('#viewer-add').addEventListener('click', function () {
    if (!produtoAtual || produtoAtual.combo || produtoAtual.esgotado) return;
    var mvA = palco.querySelector('model-viewer');
    adicionar(produtoAtual.id, tamAtual, adicSel, mvA && (mvA.availableVariants || []).length > 1 ? mvA.variantName || '' : '');
    var b = this;
    b.classList.add('feito');
    b.textContent = 'Adicionado ✓';
    setTimeout(function () { if (produtoAtual) { b.classList.remove('feito'); b.textContent = 'Adicionar mais um · ' + brl(precoMontado(produtoAtual, tamAtual, adicSel)); } }, 1400);
  });
  dlgViewer.addEventListener('close', function () {
    cancelAnimationFrame(quadroMedidas);
    if (rx || modo3d === 'raiox') sairRaioX();
    if (telaCheiaLigada()) alternarTelaCheia(true);
    var mv = palco.querySelector('model-viewer');
    if (mv) mv.remove(); // libera memória da GPU
    estadoPalco('');
    produtoAtual = null;
  });

  // ---------------------------------------------------------------------
  // Carrinho
  // ---------------------------------------------------------------------
  // chave do carrinho: "idProduto", "idProduto|idTamanho", "idProduto|idTamanho|opcional+opcional", "...|...|...|cor"
  function itemDaChave(k) {
    var partes = k.split('|');
    var p = produtoPorId(partes[0]);
    if (!p) return null;
    var temTams = p.tamanhos && p.tamanhos.length;
    if (temTams && !partes[1]) return null;
    var ef = efetivo(p, partes[1]);
    if (partes[1] && !ef.t) return null;
    if (partes[2] && partes[2].indexOf('~') > -1) return null;   // montagem antiga (açaí): não existe mais
    var sel = partes[2] ? partes[2].split('+') : [];
    var adic = adicionaisDe(p, sel);
    if (adic.length !== sel.length) return null;
    var cor = partes[3] ? ' — cor ' + nomeCor(partes[3]) : '';
    return { chave: k, p: { id: k, nome: ef.nome + cor + (adic.length ? ' + ' + adic.map(function (a) { return a.nome; }).join(', ') : ''),
      preco: ef.preco + somaAdicionais(p, sel), modelo: ef.modelo, dim: ef.dim, esgotado: !!(p.esgotado || adic.some(function (a) { return a.esgotado; })) } };
  }
  function itensCarrinho() {
    return Object.keys(carrinho).map(function (k) {
      var it = itemDaChave(k);
      return it && carrinho[k] > 0 ? { p: it.p, qtd: carrinho[k] } : null;
    }).filter(Boolean);
  }
  function salvarCarrinho() {
    Object.keys(carrinho).forEach(function (k) { if (!itemDaChave(k) || carrinho[k] <= 0) delete carrinho[k]; });
    gravar(CHAVE_CARRINHO, carrinho);
    atualizarContador();
  }
  function totalCarrinho() { return itensCarrinho().reduce(function (s, i) { return s + i.p.preco * i.qtd; }, 0); }
  function qtdCarrinho() { return itensCarrinho().reduce(function (s, i) { return s + i.qtd; }, 0); }

  function atualizarContador(pular) {
    var n = qtdCarrinho();
    var c = $('#contador-carrinho');
    c.hidden = n === 0;
    c.textContent = n;
    $('#btn-carrinho').setAttribute('aria-label', 'Abrir pedido (' + n + (n === 1 ? ' item' : ' itens') + ')');
    if (pular) { c.classList.remove('pulo'); void c.offsetWidth; c.classList.add('pulo'); }
  }

  function adicionar(id, tamId, adics, cor) {
    var p = produtoPorId(id);
    if (!p || p.esgotado) return;
    var sel = (adics || []).slice().sort();
    cor = String(cor || '').replace(/\|/g, '');
    var k = id + (tamId || sel.length || cor ? '|' + (tamId || '') : '') + (sel.length || cor ? '|' + sel.join('+') : '') + (cor ? '|' + cor : '');
    carrinho[k] = (carrinho[k] || 0) + 1;
    salvarCarrinho();
    atualizarContador(true);
    toast((itemDaChave(k) || { p: { nome: p.nome } }).p.nome + ' adicionado ao ' + orc());
    if ($('#dlg-carrinho').open) renderCarrinho();
  }

  function renderCarrinho() {
    var corpo = $('#carrinho-corpo');
    var rodape = $('#carrinho-rodape');
    var itens = itensCarrinho();
    if (!itens.length) {
      corpo.innerHTML = '<div class="carrinho-vazio">' + ICONES.sacola + '<strong>Seu ' + orc() + ' está vazio</strong>Escolha um item no ' + termo() + ' para começar.</div>';
      rodape.innerHTML = '<button class="btn btn--contorno btn--bloco" type="button" data-fechar>Voltar ao ' + termo() + '</button>';
      return;
    }
    corpo.innerHTML = itens.map(function (i) {
      return '<div class="item' + (i.p.esgotado ? ' item--esgotado' : '') + '" data-id="' + esc(i.p.id) + '">' +
        '<div><p class="item__nome">' + esc(i.p.nome) + '</p><p class="item__unit">' + (i.p.esgotado ? 'Esgotado: remova para continuar' : brl(i.p.preco) + ' cada') + '</p></div>' +
        '<span class="item__sub">' + brl(i.p.preco * i.qtd) + '</span>' +
        '<div class="item__ctrl">' +
          '<div class="qtd"><button type="button" data-q="-1" aria-label="Diminuir ' + esc(i.p.nome) + '">−</button>' +
          '<output aria-live="polite" aria-label="Quantidade">' + i.qtd + '</output>' +
          '<button type="button" data-q="1" aria-label="Aumentar ' + esc(i.p.nome) + '">+</button></div>' +
          '<button class="link-remover" type="button" data-remover>Remover</button>' +
        '</div></div>';
    }).join('') +
      (itensCom3d().length >= 2
        ? (ehAlimento()
          ? '<button class="btn btn--sec btn--bloco combo-btn" type="button" id="ver-combo">' + ICONES.ar + 'Ver o pedido na mesa (3D)</button>' +
            '<p class="mini">Mostra os itens do pedido juntos, lado a lado, no tamanho real.</p>'
          : '<button class="btn btn--sec btn--bloco combo-btn" type="button" id="montar-ambiente">' + ICONES.ar + 'Montar o ambiente (3D)</button>' +
            '<p class="mini">Arrume os móveis do ' + orc() + ' como na sua sala e veja todos juntos na câmera, no tamanho real.</p>')
        : '');
    var total = totalCarrinho(), cfg = dados.padaria.pedido, sit = situacaoPedidos();
    var esgot = itens.some(function (i) { return i.p.esgotado; });
    var faltaMin = cfg.minimo > 0 && total < cfg.minimo ? cfg.minimo - total : 0;
    var bloqueio = !sit.ok ? sit.motivo : esgot ? 'Tem item esgotado no pedido. Remova para continuar.'
      : faltaMin ? 'Pedido mínimo de ' + brl(cfg.minimo) + '. Faltam ' + brl(faltaMin) + '.' : '';
    rodape.innerHTML =
      (bloqueio || sit.agendado ? '<p class="aviso-pedido' + (bloqueio ? '' : ' aviso-pedido--ok') + '" role="status">' + esc(bloqueio || sit.motivo) + '</p>' : '') +
      '<div class="totais"><div><span>Itens</span><span>' + qtdCarrinho() + '</span></div>' +
      '<div class="total"><span>Subtotal</span><span>' + brl(total) + '</span></div></div>' +
      '<button class="btn btn--primario btn--bloco" type="button" id="finalizar"' + (bloqueio ? ' disabled' : '') + '>Continuar</button>';
  }
  var sessionObs = '';

  // Combo na mesa: até 8 unidades do pedido com modelo 3D
  function itensCom3d() {
    var urls = [];
    itensCarrinho().forEach(function (i) {
      if (!i.p.modelo || MODELOS_EMBUTIDOS) return;
      for (var k = 0; k < i.qtd && urls.length < 8; k++) urls.push(i.p.modelo);
    });
    return urls;
  }
  function verCombo(botao) {
    var urls = itensCom3d();
    if (urls.length < 2) return;
    if (!servidor) { toast('O combo em 3D funciona no site publicado (Cloudflare).'); return; }
    botao.disabled = true;
    botao.textContent = 'Montando seu pedido em 3D…';
    fetch('api/combo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itens: urls }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        var nomes = itensCarrinho().map(function (i) { return i.qtd + 'x ' + i.p.nome; }).join(' · ');
        fecharDialogo($('#dlg-carrinho'));
        tamAtual = null;
        setTimeout(function () {
          abrirViewerProduto({ id: '__combo', combo: true, nome: 'Seu pedido', categoria: 'Pedido completo', preco: totalCarrinho(),
            descricao: nomes + (urls.length < qtdCarrinho() ? ' (itens sem 3D ficam de fora)' : ''), dim: null, modelo: j.url, ilustrativo: false }, '3d');
        }, 150);
      })
      .catch(function (e) { botao.disabled = false; botao.innerHTML = ICONES.ar + (ehAlimento() ? 'Ver o pedido na mesa (3D)' : 'Ver os itens juntos (3D)'); toast(e.message); });
  }

  // ---- Montar ambiente: o cliente arruma os móveis vistos de cima e vê tudo junto em 3D e na câmera
  var amb = null;   // { pecas: [{ modelo, nome, w, d, x, z, r }] (cm), sala: { w, d } (cm), sel }
  function pecasDoCarrinho() {
    var pecas = [];
    itensCarrinho().forEach(function (i) {
      if (!i.p.modelo || MODELOS_EMBUTIDOS) return;
      for (var k = 0; k < i.qtd && pecas.length < 8; k++) {
        var d = i.p.dim || {};
        pecas.push({ modelo: i.p.modelo, nome: i.p.nome, w: Math.max(10, Number(d.largura) || 60), d: Math.max(10, Number(d.profundidade) || 60), x: 0, z: 0, r: 0 });
      }
    });
    return pecas;
  }
  function pegada(pc) { return pc.r % 180 ? { w: pc.d, d: pc.w } : { w: pc.w, d: pc.d }; }
  function arrumarInicial(pecas) {
    // sala do tamanho que cabe tudo, com folga; móveis em fila encostados na parede do fundo
    var soma = pecas.reduce(function (s2, pc) { return s2 + pc.w; }, 0);
    var salaW = Math.max(300, Math.min(800, Math.ceil((Math.min(soma, 700) + 80) / 50) * 50));
    var x = -salaW / 2 + 30, z = 0, linhaD = 0, fundo = 0;
    var salaD0 = 300;
    pecas.forEach(function (pc) {
      if (x + pc.w > salaW / 2 - 20 && x > -salaW / 2 + 30) { x = -salaW / 2 + 30; z += linhaD + 30; linhaD = 0; }
      pc.x = x + pc.w / 2; pc.zRel = z + pc.d / 2; x += pc.w + 20; linhaD = Math.max(linhaD, pc.d); fundo = Math.max(fundo, z + pc.d);
    });
    var salaD = Math.max(salaD0, Math.ceil((fundo + 80) / 50) * 50);
    pecas.forEach(function (pc) { pc.z = -salaD / 2 + 25 + pc.zRel; delete pc.zRel; });
    return { w: salaW, d: salaD };
  }
  function abrirAmbiente() {
    var pecas = pecasDoCarrinho();
    if (pecas.length < 2) return;
    if (!servidor) { toast('Montar o ambiente funciona no site publicado.'); return; }
    amb = { pecas: pecas, sala: arrumarInicial(pecas), sel: 0 };
    fecharDialogo($('#dlg-carrinho'));
    setTimeout(function () { renderAmbiente(); abrirDialogo($('#dlg-ambiente')); }, 150);
  }
  function limitarPeca(pc) {
    var f = pegada(pc), s2 = amb.sala;
    pc.x = Math.max(-s2.w / 2 + f.w / 2, Math.min(s2.w / 2 - f.w / 2, pc.x));
    pc.z = Math.max(-s2.d / 2 + f.d / 2, Math.min(s2.d / 2 - f.d / 2, pc.z));
  }
  function svgAmbiente() {
    var s2 = amb.sala, m = 30, grade = '';
    for (var gx = 50; gx < s2.w; gx += 50) grade += '<line x1="' + (-s2.w / 2 + gx) + '" y1="' + (-s2.d / 2) + '" x2="' + (-s2.w / 2 + gx) + '" y2="' + (s2.d / 2) + '"/>';
    for (var gz = 50; gz < s2.d; gz += 50) grade += '<line x1="' + (-s2.w / 2) + '" y1="' + (-s2.d / 2 + gz) + '" x2="' + (s2.w / 2) + '" y2="' + (-s2.d / 2 + gz) + '"/>';
    return '<svg class="amb-planta" id="amb-planta" viewBox="' + (-s2.w / 2 - m) + ' ' + (-s2.d / 2 - m) + ' ' + (s2.w + m * 2) + ' ' + (s2.d + m * 2) + '" role="application" aria-label="Planta da sala vista de cima. Arraste os móveis.">' +
      '<rect class="amb-sala" x="' + (-s2.w / 2) + '" y="' + (-s2.d / 2) + '" width="' + s2.w + '" height="' + s2.d + '"/>' +
      '<g class="amb-grade">' + grade + '</g>' +
      '<text class="amb-cota" x="0" y="' + (-s2.d / 2 - 9) + '">' + num(s2.w / 100) + ' m</text>' +
      '<text class="amb-cota" x="' + (s2.w / 2 + 9) + '" y="0" transform="rotate(90 ' + (s2.w / 2 + 9) + ' 0)">' + num(s2.d / 100) + ' m</text>' +
      amb.pecas.map(function (pc, i) {
        var rot = pc.nome.length > 18 ? pc.nome.slice(0, 17) + '…' : pc.nome, pg = pegada(pc);
        var fs = Math.max(8, Math.min(20, pg.d / 2.6, pg.w * 1.7 / Math.max(4, rot.length)));
        return '<g class="amb-peca' + (i === amb.sel ? ' sel' : '') + '" data-peca="' + i + '" tabindex="0" role="button" aria-label="' + esc(pc.nome) + ', ' + Math.round(pc.w) + ' por ' + Math.round(pc.d) + ' cm. Use as setas para mover." transform="translate(' + pc.x + ' ' + pc.z + ') rotate(' + (-pc.r) + ')">' +
          '<rect x="' + (-pc.w / 2) + '" y="' + (-pc.d / 2) + '" width="' + pc.w + '" height="' + pc.d + '" rx="4"/>' +
          '<line class="amb-frente" x1="' + (-pc.w / 2 + 4) + '" y1="' + (pc.d / 2 - 3) + '" x2="' + (pc.w / 2 - 4) + '" y2="' + (pc.d / 2 - 3) + '"/>' +
          '<text x="0" y="' + (fs / 3) + '" font-size="' + fs.toFixed(1) + '" transform="rotate(' + pc.r + ')">' + esc(rot) + '</text></g>';
      }).join('') + '</svg>';
  }
  function renderAmbiente() {
    var pc = amb.pecas[amb.sel];
    $('#ambiente-corpo').innerHTML =
      '<p class="mini" style="margin-top:0">Vista de cima. <strong>Arraste os móveis</strong> para arrumar. Cada quadrado tem 50 cm. A linha grossa é a frente do móvel.</p>' +
      '<div class="amb-palco">' + svgAmbiente() + '</div>' +
      '<div class="amb-sel"><span>' + (pc ? '<strong>' + esc(pc.nome) + '</strong> ' + Math.round(pegada(pc).w) + ' × ' + Math.round(pegada(pc).d) + ' cm' : '') + '</span>' +
        '<button class="btn btn--sec btn--p" type="button" id="amb-girar">↻ Girar</button></div>' +
      '<div class="campos campos--2">' +
        campo('Largura da sala (m)', '<input id="amb-w" type="number" min="1.5" max="12" step="0.1" inputmode="decimal" value="' + (amb.sala.w / 100) + '">') +
        campo('Profundidade (m)', '<input id="amb-d" type="number" min="1.5" max="12" step="0.1" inputmode="decimal" value="' + (amb.sala.d / 100) + '">') +
      '</div>';
    $('#ambiente-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="amb-ver">' + ICONES.ar + 'Ver em 3D e na minha casa</button>';
    ligarArrasto();
  }
  function atualizarPlanta() {
    var palcoA = $('.amb-palco'); if (!palcoA) return;
    palcoA.innerHTML = svgAmbiente();
    var pc = amb.pecas[amb.sel], info = $('.amb-sel span');
    if (info && pc) info.innerHTML = '<strong>' + esc(pc.nome) + '</strong> ' + Math.round(pegada(pc).w) + ' × ' + Math.round(pegada(pc).d) + ' cm';
    ligarArrasto();
  }
  function ligarArrasto() {
    var svg = $('#amb-planta'); if (!svg) return;
    var arr = null;
    function ponto(e) { var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
    svg.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('[data-peca]'); if (!g) return;
      var i = Number(g.getAttribute('data-peca')), pc = amb.pecas[i], p0 = ponto(e);
      arr = { i: i, dx: pc.x - p0.x, dz: pc.z - p0.y, id: e.pointerId };
      if (amb.sel !== i) { amb.sel = i; $$('.amb-peca', svg).forEach(function (n) { n.classList.toggle('sel', n === g); }); var info = $('.amb-sel span'); if (info) info.innerHTML = '<strong>' + esc(pc.nome) + '</strong> ' + Math.round(pegada(pc).w) + ' × ' + Math.round(pegada(pc).d) + ' cm'; }
      try { svg.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
      e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!arr || e.pointerId !== arr.id) return;
      var p1 = ponto(e), pc = amb.pecas[arr.i];
      pc.x = Math.round((p1.x + arr.dx) / 5) * 5; pc.z = Math.round((p1.y + arr.dz) / 5) * 5;
      limitarPeca(pc);
      var g = svg.querySelector('[data-peca="' + arr.i + '"]');
      if (g) g.setAttribute('transform', 'translate(' + pc.x + ' ' + pc.z + ') rotate(' + (-pc.r) + ')');
    });
    var soltar = function () { arr = null; };
    svg.addEventListener('pointerup', soltar); svg.addEventListener('pointercancel', soltar);
    svg.addEventListener('keydown', function (e) {
      var g = e.target.closest('[data-peca]'); if (!g) return;
      var i = Number(g.getAttribute('data-peca')), pc = amb.pecas[i], passo = e.shiftKey ? 25 : 5;
      var mov = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key];
      if (e.key === 'r' || e.key === 'R') { amb.sel = i; girarPeca(); e.preventDefault(); return; }
      if (!mov) return;
      e.preventDefault();
      amb.sel = i; pc.x += mov[0]; pc.z += mov[1]; limitarPeca(pc);
      atualizarPlanta();
      var ng = $('#amb-planta [data-peca="' + i + '"]'); if (ng) ng.focus();
    });
  }
  function girarPeca() {
    var pc = amb.pecas[amb.sel]; if (!pc) return;
    pc.r = (pc.r + 90) % 360; limitarPeca(pc); atualizarPlanta();
  }
  function verAmbiente(botao) {
    var pecas = amb.pecas;
    botao.disabled = true; botao.textContent = 'Montando o ambiente em 3D…';
    var corpo = { itens: pecas.map(function (pc) { return pc.modelo; }), posicoes: pecas.map(function (pc) { return { x: pc.x / 100, z: pc.z / 100, r: pc.r }; }) };
    fetch('api/combo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        var nomes = itensCarrinho().map(function (i) { return i.qtd + 'x ' + i.p.nome; }).join(' · ');
        fecharDialogo($('#dlg-ambiente'));
        tamAtual = null;
        setTimeout(function () {
          abrirViewerProduto({ id: '__combo', combo: true, ambiente: true, nome: 'Seu ambiente', categoria: 'Montado por você', preco: totalCarrinho(),
            descricao: nomes + (pecas.length < qtdCarrinho() ? ' (itens sem 3D ficam de fora)' : ''), dim: null, modelo: j.url, ilustrativo: false }, '3d');
        }, 150);
      })
      .catch(function (e) { toast(e.message); })
      .then(function () { var b = $('#amb-ver'); if (b) { b.disabled = false; b.innerHTML = ICONES.ar + 'Ver em 3D e na minha casa'; } });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#montar-ambiente')) { abrirAmbiente(); return; }
    if (!amb || !e.target.closest('#dlg-ambiente')) return;
    if (e.target.closest('#amb-girar')) { girarPeca(); return; }
    var v = e.target.closest('#amb-ver'); if (v) verAmbiente(v);
  });
  document.addEventListener('change', function (e) {
    if (!amb || (e.target.id !== 'amb-w' && e.target.id !== 'amb-d')) return;
    var val = Math.round(Math.max(1.5, Math.min(12, Number(String(e.target.value).replace(',', '.')) || 3)) * 100);
    if (e.target.id === 'amb-w') amb.sala.w = val; else amb.sala.d = val;
    amb.pecas.forEach(limitarPeca);
    atualizarPlanta();
  });

  // ---- Finalizar: entrega/retirada, endereço, pagamento → WhatsApp da loja
  var CHAVE_CLIENTE = 'menureal:cliente:v1';
  var cliente = Object.assign({ nome: '', modo: '', rua: '', numero: '', bairro: '', comp: '', mesa: '', pag: '', troco: '' }, ler(CHAVE_CLIENTE) || {});
  var MODOS = [['entrega', 'Entrega'], ['retirada', 'Retirar na loja'], ['local', 'Consumir aqui']];
  var PAGAMENTOS = [['pix', 'Pix'], ['cartao', 'Cartão (na entrega/retirada)'], ['dinheiro', 'Dinheiro']];
  function modosLoja() {
    var cfg = dados.padaria.pedido;
    var m = MODOS.filter(function (x) { return cfg[x[0]]; });
    return m.length ? m : [MODOS[1]];
  }
  function pagamentosLoja() {
    var cfg = dados.padaria.pedido.pagamento;
    var m = PAGAMENTOS.filter(function (x) { return cfg[x[0]]; });
    return m.length ? m : [PAGAMENTOS[2]];
  }
  function modoAtual() { var m = modosLoja(); return m.some(function (x) { return x[0] === cliente.modo; }) ? cliente.modo : m[0][0]; }
  function pagAtual() { var m = pagamentosLoja(); return m.some(function (x) { return x[0] === cliente.pag; }) ? cliente.pag : ''; }
  // taxa de entrega: por bairro (se a loja cadastrou) ou fixa. null = escolha o bairro
  function taxaEntrega() {
    if (modoAtual() !== 'entrega') return 0;
    var cfg = dados.padaria.pedido;
    if (!cfg.bairros.length) return cfg.taxa;
    var b = cfg.bairros.filter(function (x) { return x.nome === cliente.bairro; })[0];
    return b ? b.taxa : null;
  }
  function totalFinal() { var t = taxaEntrega(); return totalCarrinho() + (t || 0); }

  function renderCheckout() {
    var cfg = dados.padaria.pedido, modo = modoAtual(), pag = pagAtual(), modos = modosLoja();
    var radio = function (nome, val, rot, marcado, extra) {
      return '<label class="opcao"><input type="radio" name="' + nome + '" value="' + val + '"' + (marcado ? ' checked' : '') + '><span>' + rot + (extra ? '<small>' + extra + '</small>' : '') + '</span></label>';
    };
    var cmp = function (rot, k, attrs) { return campo(rot, '<input data-cli="' + k + '" value="' + esc(cliente[k]) + '" ' + (attrs || '') + '>'); };
    var h = '<div class="checkout">' +
      cmp('Seu nome', 'nome', 'maxlength="60" autocomplete="name" required') +
      (modos.length > 1 ? '<fieldset class="campo"><legend>Como você quer receber?</legend><div class="opcoes">' + modos.map(function (m) {
        var extra = m[0] === 'entrega' ? (cfg.bairros.length ? 'taxa conforme o bairro' : cfg.taxa ? 'taxa ' + brl(cfg.taxa) : 'entrega grátis') + (cfg.tempo ? ' · ' + esc(cfg.tempo) : '')
          : m[0] === 'retirada' ? esc(cfg.endereco) : '';
        return radio('cli-modo', m[0], m[1], m[0] === modo, extra);
      }).join('') + '</div></fieldset>' : '<p class="mini">' + esc(modos[0][1]) + (modo === 'retirada' && cfg.endereco ? ': ' + esc(cfg.endereco) : '') + '</p>');
    if (modo === 'entrega') {
      h += '<div class="campos campos--rua">' + cmp('Rua / avenida', 'rua', 'maxlength="100" autocomplete="address-line1"') + cmp('Número', 'numero', 'maxlength="12" inputmode="numeric"') + '</div>' +
        (cfg.bairros.length
          ? campo('Bairro', '<select data-cli="bairro"><option value="">Escolha o bairro</option>' + cfg.bairros.map(function (b) {
              return '<option value="' + esc(b.nome) + '"' + (b.nome === cliente.bairro ? ' selected' : '') + '>' + esc(b.nome) + ' — ' + (b.taxa ? brl(b.taxa) : 'grátis') + '</option>';
            }).join('') + '</select>', 'Não achou seu bairro? A loja pode não entregar aí. Fale com ela pelo WhatsApp.')
          : cmp('Bairro', 'bairro', 'maxlength="60"')) +
        cmp('Complemento / referência (opcional)', 'comp', 'maxlength="100" placeholder="Ex.: apto 12, portão azul"');
    } else if (modo === 'local') {
      h += cmp('Mesa (opcional)', 'mesa', 'maxlength="12" inputmode="numeric"');
    }
    h += '<fieldset class="campo"><legend>Pagamento</legend><div class="opcoes">' + pagamentosLoja().map(function (m) {
      return radio('cli-pag', m[0], m[1], m[0] === pag, m[0] === 'pix' && cfg.pix.chave ? 'o código Pix aparece depois de enviar' : '');
    }).join('') + '</div></fieldset>' +
      (pag === 'dinheiro' ? cmp('Troco para quanto? (opcional)', 'troco', 'inputmode="decimal" maxlength="10" placeholder="Ex.: 50"') : '') +
      campo('Observações (opcional)', '<textarea class="obs" id="obs" maxlength="280" placeholder="Ex.: sem granola, caprichar na calda">' + esc(sessionObs) + '</textarea>') +
      '</div>';
    $('#carrinho-corpo').innerHTML = h;
    renderRodapeCheckout();
  }
  function renderRodapeCheckout() {
    var taxa = taxaEntrega(), zap = dados.padaria.whatsapp;
    $('#carrinho-rodape').innerHTML =
      '<div class="totais"><div><span>Subtotal</span><span>' + brl(totalCarrinho()) + '</span></div>' +
      (modoAtual() === 'entrega' ? '<div><span>Entrega</span><span>' + (taxa === null ? 'escolha o bairro' : taxa ? brl(taxa) : 'grátis') + '</span></div>' : '') +
      '<div class="total"><span>Total</span><span>' + brl(totalFinal()) + '</span></div></div>' +
      '<div class="pilha"><button class="btn btn--primario btn--bloco" type="button" id="enviar-pedido">' + (zap ? (ehAlimento() ? 'Enviar pedido pelo WhatsApp' : 'Pedir orçamento pelo WhatsApp') : 'Ver resumo do ' + orc()) + '</button>' +
      '<button class="btn btn--fantasma btn--bloco" type="button" id="voltar-pedido">Voltar aos itens</button></div>';
  }
  function validarCheckout() {
    var faltas = [];
    if (!cliente.nome.trim()) faltas.push(['nome', 'Informe seu nome.']);
    if (modoAtual() === 'entrega') {
      if (!cliente.rua.trim()) faltas.push(['rua', 'Informe a rua.']);
      if (!cliente.numero.trim()) faltas.push(['numero', 'Informe o número.']);
      if (!cliente.bairro.trim()) faltas.push(['bairro', 'Informe o bairro.']);
    }
    if (pagamentosLoja().length && !pagAtual()) faltas.push(['pag', 'Escolha como vai pagar.']);
    if (pagAtual() === 'dinheiro' && cliente.troco.trim()) {
      var t = lerPreco(cliente.troco);
      if (!(t >= totalFinal())) faltas.push(['troco', 'O troco precisa ser para um valor maior que o total (' + brl(totalFinal()) + ').']);
    }
    $$('#carrinho-corpo .erro-campo').forEach(function (e) { e.remove(); });
    $$('#carrinho-corpo [aria-invalid]').forEach(function (e) { e.removeAttribute('aria-invalid'); });
    faltas.forEach(function (f, i) {
      var el = f[0] === 'pag' ? $('#carrinho-corpo input[name="cli-pag"]') : $('#carrinho-corpo [data-cli="' + f[0] + '"]');
      if (!el) return;
      if (f[0] === 'pag') { var s = document.createElement('small'); s.className = 'erro-campo'; s.textContent = f[1]; el.closest('fieldset').appendChild(s); }
      else marcarErro(el, f[1]);
      if (i === 0) el.focus();
    });
    if (faltas.length) toast(faltas[0][1]);
    return !faltas.length;
  }

  function resumoPedido(paraZap) {
    var b = paraZap ? '*' : '';
    var cfg = dados.padaria.pedido, modo = modoAtual(), sit = situacaoPedidos(), taxa = taxaEntrega();
    var L = [b + (ehAlimento() ? 'Novo pedido — ' : 'Pedido de orçamento — ') + dados.padaria.nome + b, ''];
    if (cliente.nome.trim()) L.push('Cliente: ' + cliente.nome.trim());
    if (modo === 'entrega') {
      L.push(b + 'Entrega' + b + ': ' + cliente.rua.trim() + ', ' + cliente.numero.trim() + ' — ' + cliente.bairro.trim());
      if (cliente.comp.trim()) L.push('Ref.: ' + cliente.comp.trim());
    } else if (modo === 'retirada') L.push(b + 'Vou retirar na loja' + b);
    else L.push(b + 'Consumir no local' + b + (cliente.mesa.trim() ? ' — mesa ' + cliente.mesa.trim() : ''));
    if (sit.agendado) L.push('(Pedido feito com a loja fechada: para quando abrir)');
    L.push('');
    itensCarrinho().forEach(function (i) { L.push(i.qtd + 'x ' + i.p.nome + (i.p.dim && !ehAlimento() ? ' (' + dimTexto(i.p.dim) + ')' : '') + ' — ' + brl(i.p.preco * i.qtd)); });
    L.push('');
    if (modo === 'entrega') { L.push('Subtotal: ' + brl(totalCarrinho())); L.push('Entrega: ' + (taxa ? brl(taxa) : 'grátis')); }
    L.push(b + 'Total: ' + brl(totalFinal()) + b);
    var pt = parcelaTexto(totalFinal()); if (pt) L.push('(' + pt + ')');
    var pag = pagAtual();
    if (pag) {
      var tr = pag === 'dinheiro' && cliente.troco.trim() ? lerPreco(cliente.troco) : 0;
      L.push((ehAlimento() ? 'Pagamento: ' : 'Prefiro pagar com: ') + (pag === 'pix' ? 'Pix' + (cfg.pix.chave && ehAlimento() ? ' (envio o comprovante aqui)' : '') : pag === 'cartao' ? 'Cartão' : 'Dinheiro' + (tr ? ' — troco para ' + brl(tr) + ' (' + brl(tr - totalFinal()) + ' de troco)' : ', sem troco')));
    }
    if (sessionObs.trim()) L.push('Obs.: ' + sessionObs.trim());
    L.push('', '(' + (ehAlimento() ? 'Pedido feito' : 'Enviado') + ' pelo ' + termo() + ' MenuReal)');
    return L.join('\n');
  }

  // ---- Pix copia e cola (BR Code, padrão do Banco Central) com o valor do pedido
  function asciiPix(s, max) { return semAcento(s).toUpperCase().replace(/[^A-Z0-9 .,-]/g, '').trim().slice(0, max); }
  function chavePix(px) {
    var c = px.chave.trim();
    if (px.tipo === 'cpf' || px.tipo === 'cnpj') return c.replace(/\D/g, '');
    if (px.tipo === 'telefone') { var d = c.replace(/\D/g, ''); return '+' + (d.length >= 12 && d.indexOf('55') === 0 ? d : '55' + d); }
    if (px.tipo === 'email') return c.toLowerCase();
    return c.toLowerCase();
  }
  function crc16(s) {
    var crc = 0xFFFF;
    for (var i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
    return ('000' + crc.toString(16).toUpperCase()).slice(-4);
  }
  function codigoPix(valor) {
    var px = dados.padaria.pedido.pix;
    if (!px.chave) return '';
    var f = function (id, v) { return id + ('0' + v.length).slice(-2) + v; };
    var conta = f('00', 'br.gov.bcb.pix') + f('01', chavePix(px));
    var s = f('00', '01') + f('26', conta) + f('52', '0000') + f('53', '986') + (valor > 0 ? f('54', valor.toFixed(2)) : '') +
      f('58', 'BR') + f('59', asciiPix(px.nome || dados.padaria.nome, 25) || 'LOJA') + f('60', asciiPix(px.cidade, 15) || 'BRASIL') + f('62', f('05', '***')) + '6304';
    return s + crc16(s);
  }

  // QR Code (biblioteca qrcode-generator, MIT, em vendor/)
  var qrPronto = null;
  function carregarQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrPronto) {
      qrPronto = new Promise(function (ok, falha) {
        var sc = document.createElement('script');
        sc.src = new URL('vendor/qrcode.js', document.baseURI).href;
        sc.onload = function () { ok(window.qrcode); };
        sc.onerror = function () { qrPronto = null; falha(new Error('Não foi possível carregar o gerador de QR Code.')); };
        document.head.appendChild(sc);
      });
    }
    return qrPronto;
  }
  function qrSvg(texto, cor) {
    return carregarQr().then(function (qrcode) {
      var q = qrcode(0, 'M'); q.addData(texto); q.make();
      var n = q.getModuleCount(), d = '';
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z';
      return '<svg viewBox="0 0 ' + (n + 8) + ' ' + (n + 8) + '" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="' + (cor || '#000') + '"/></svg>';
    });
  }

  function enviarPedido() {
    if (!validarCheckout()) return;
    gravar(CHAVE_CLIENTE, cliente);
    var zap = dados.padaria.whatsapp;
    var texto = resumoPedido(!!zap);
    if (zap) { window.open('https://wa.me/' + zap + '?text=' + encodeURIComponent(texto), '_blank', 'noopener'); registrar('pedido'); }
    renderEnviado(texto);
  }
  function renderEnviado(texto) {
    var zap = dados.padaria.whatsapp, total = totalFinal();
    // Pix com o valor só no cardápio; no orçamento a loja ainda confirma preço e frete
    var pix = ehAlimento() && pagAtual() === 'pix' ? codigoPix(total) : '';
    $('#carrinho-corpo').innerHTML =
      '<div class="confirmacao">' +
        '<div class="confirmacao__selo">' + ICONES.ok + '</div>' +
        '<h3>' + (zap ? 'Falta só tocar em enviar' : 'Resumo do ' + orc()) + '</h3>' +
        '<p>' + (zap ? 'Abrimos o WhatsApp da loja com o ' + orc() + ' escrito. <strong>Toque em enviar lá</strong> para a loja receber.'
          : 'Esta loja ainda não cadastrou o WhatsApp para pedidos. Mostre este resumo no balcão.') + '</p>' +
        (pix ? '<div class="pix"><h4>Pague com Pix: ' + brl(total) + '</h4>' +
          '<div class="pix__qr" id="pix-qr"></div>' +
          '<p class="mini">No app do banco, escolha <strong>Pix copia e cola</strong>. O valor já vem preenchido. Depois mande o comprovante na conversa.</p>' +
          '<textarea class="pix__codigo" readonly rows="3" id="pix-codigo">' + esc(pix) + '</textarea>' +
          '<button class="btn btn--sec btn--bloco" type="button" id="pix-copiar">Copiar código Pix</button></div>' : '') +
        '<details class="resumo-det"><summary>Ver o que foi enviado</summary><div class="resumo">' + esc(texto.replace(/\*/g, '')) + '</div></details>' +
      '</div>';
    if (pix) qrSvg(pix).then(function (svg) { var el = $('#pix-qr'); if (el) el.innerHTML = svg; }).catch(function () { var el = $('#pix-qr'); if (el) el.remove(); });
    $('#carrinho-rodape').innerHTML = '<div class="pilha">' +
      (zap ? '<a class="btn btn--contorno btn--bloco" target="_blank" rel="noopener" href="https://wa.me/' + esc(zap) + '?text=' + encodeURIComponent(texto) + '">Abrir o WhatsApp de novo</a>' : '') +
      '<button class="btn btn--primario btn--bloco" type="button" id="novo-pedido">Concluir e limpar ' + orc() + '</button>' +
      '<button class="btn btn--fantasma btn--bloco" type="button" id="voltar-checkout">Voltar e editar</button></div>';
  }

  $('#btn-carrinho').addEventListener('click', function () { renderCarrinho(); abrirDialogo($('#dlg-carrinho')); });
  $('#dlg-carrinho').addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'obs') { sessionObs = t.value; return; }
    var k = t.getAttribute('data-cli');
    if (k) { cliente[k] = t.value; if (t.getAttribute('aria-invalid')) { t.removeAttribute('aria-invalid'); var er = t.parentNode.querySelector('.erro-campo'); if (er) er.remove(); } if (k === 'bairro') renderRodapeCheckout(); }
  });
  $('#dlg-carrinho').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'cli-modo') { cliente.modo = t.value; renderCheckout(); }
    else if (t.name === 'cli-pag') { cliente.pag = t.value; renderCheckout(); }
    else if (t.getAttribute('data-cli') === 'bairro') { cliente.bairro = t.value; renderRodapeCheckout(); }
  });
  $('#dlg-carrinho').addEventListener('click', function (e) {
    var item = e.target.closest('.item');
    var q = e.target.closest('[data-q]');
    if (item && q) {
      var id = item.getAttribute('data-id');
      carrinho[id] = (carrinho[id] || 0) + Number(q.getAttribute('data-q'));
      salvarCarrinho();
      renderCarrinho();
      var foco = $('.item[data-id="' + CSS.escape(id) + '"] [data-q="' + q.getAttribute('data-q') + '"]');
      if (foco) foco.focus();
      return;
    }
    if (item && e.target.closest('[data-remover]')) {
      delete carrinho[item.getAttribute('data-id')];
      salvarCarrinho();
      renderCarrinho();
      return;
    }
    if (e.target.closest('#ver-combo')) { verCombo(e.target.closest('#ver-combo')); return; }
    if (e.target.closest('#finalizar')) { renderCheckout(); $('#carrinho-corpo').scrollTop = 0; return; }
    if (e.target.closest('#voltar-pedido')) { renderCarrinho(); return; }
    if (e.target.closest('#enviar-pedido')) { enviarPedido(); return; }
    if (e.target.closest('#voltar-checkout')) { renderCheckout(); return; }
    if (e.target.closest('#pix-copiar')) {
      var cod = $('#pix-codigo');
      (navigator.clipboard ? navigator.clipboard.writeText(cod.value) : Promise.reject()).then(function () { toast('Código Pix copiado'); }, function () {
        cod.select(); try { document.execCommand('copy'); toast('Código Pix copiado'); } catch (er) { toast('Selecione o código e copie'); }
      });
      return;
    }
    if (e.target.closest('#novo-pedido')) {
      carrinho = {};
      sessionObs = '';
      salvarCarrinho();
      fecharDialogo($('#dlg-carrinho'));
      toast(LOJA ? 'Pronto. Obrigado!' : 'Demonstração concluída');
    }
  });

  // ---------------------------------------------------------------------
  // Administração (somente local)
  // ---------------------------------------------------------------------
  var rascunho = null;
  var abertoNoAdmin = null;

  function campo(rotulo, html, ajuda) {
    return '<label class="campo">' + rotulo + html + (ajuda ? '<small>' + ajuda + '</small>' : '') + '</label>';
  }

  function renderLogin(erro) {
    $('#form-admin').classList.add('so-login');
    $('#admin-corpo').innerHTML =
      '<div class="login">' +
        '<p class="login__loja">' + esc(dados.padaria.nome) + '</p>' +
        '<p>Entre com o e-mail e a senha da loja para editar este ' + termo() + '.</p>' +
        campo('E-mail', '<input id="login-email" type="email" autocomplete="username" maxlength="120">') +
        campo('Senha', '<input id="login-senha" type="password" autocomplete="current-password" maxlength="120">') +
        (erro ? '<div class="ar-indisp" role="alert">' + esc(erro) + '</div>' : '') +
        '<button class="btn btn--primario btn--bloco" type="button" id="login-entrar">Entrar</button>' +
        '<button class="btn btn--fantasma btn--bloco" type="button" id="login-esqueci">Esqueci minha senha</button>' +
      '</div>';
    setTimeout(function () { var el = $('#login-email'); if (el) el.focus(); }, 50);
  }

  function entrar() {
    var email = $('#login-email').value.trim(), senha = $('#login-senha').value;
    if (!email || !senha) { renderLogin('Preencha e-mail e senha.'); return; }
    $('#login-entrar').disabled = true;
    fetch('api/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email, senha: senha }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        try { localStorage.setItem('menureal:token:' + j.slug, j.token); } catch (e) { /* ignora */ }
        if (j.slug !== LOJA) { location.href = '/' + j.slug; return; }
        abrirAdminCompleto();
        toast('Bem-vindo, ' + j.nome);
      })
      .catch(function (e) { renderLogin(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); });
  }

  // Painel em abas: cada assunto numa aba, para não ficar tudo numa página só
  var abaAdmin = '';
  var ABAS = {
    inicio: 'Início', lojas: 'Lojas', produtos: 'Produtos', loja: 'Loja', pedidos: 'Pedidos',
    visual: 'Visual', divulgar: 'Divulgar', conta: 'Conta'
  };
  function abasDoPainel() {
    if (!servidor) return ['produtos', 'loja', 'pedidos', 'visual'];
    // na página inicial, o painel é só do dono do MenuReal (lojas e planos); a demonstração é fixa
    return LOJA ? ['inicio', 'produtos', 'loja', 'pedidos', 'visual', 'divulgar', 'conta'] : ['lojas'];
  }
  function renderAdmin() {
    $('#admin-restaurar').hidden = !!LOJA;
    $('.painel__rodape--admin').classList.toggle('um', !!LOJA);
    $('.painel__rodape--admin').hidden = !LOJA && servidor;
    if (servidor && LOJA && !lerTokenLoja()) { renderLogin(); return; }
    $('#form-admin').classList.remove('so-login');
    var p = rascunho.padaria, abas = abasDoPainel();
    if (abertoNoAdmin) abaAdmin = 'produtos';
    if (abas.indexOf(abaAdmin) < 0) abaAdmin = abas[0];
    var plano = LOJA && servidor ? rascunho.padaria.plano : null;
    var conteudo = {
      inicio: function () {
        return htmlAvisoPlano(plano) +
          '<section class="secao-admin"><h3>Últimos 7 dias</h3><div id="resultados"><p class="mini">Carregando os números…</p></div></section>' +
          (servidor ? '<section class="secao-admin"><h3>Resumo da semana</h3><div id="resumo-semana"><p class="mini">Carregando…</p></div></section>' : '') +
          '<div class="atalhos">' +
            '<a class="btn btn--sec" href="/' + esc(LOJA) + '" target="_blank" rel="noopener">Ver meu ' + termo(rascunho) + '</a>' +
            '<button class="btn btn--contorno" type="button" data-aba-ir="produtos">Editar produtos</button>' +
            '<button class="btn btn--contorno" type="button" data-aba-ir="divulgar">Etiquetas e cartaz com QR</button>' +
            '<button class="btn btn--contorno" type="button" data-ajuda="loja">Como usar</button>' +
          '</div>';
      },
      lojas: function () {
        return '<span class="dica">Você é o dono do MenuReal: aqui ficam as lojas clientes e a demonstração da página inicial.</span>' +
          campo('Código de acesso', '<input id="admin-codigo" type="password" autocomplete="off" maxlength="80" value="' + esc(lerCodigo()) + '">') +
          '<section class="secao-admin"><div id="lojas"><button class="btn btn--sec btn--bloco" type="button" id="lojas-abrir">Ver lojas e planos</button></div></section>';
      },
      produtos: function () {
        return '<section class="secao-admin"><h3>Produtos (' + rascunho.produtos.length + ')</h3>' +
          rascunho.produtos.map(function (x, i) { return htmlProdutoAdmin(x, i); }).join('') +
          '<div class="linha-acoes" style="margin-top:12px">' +
            '<button class="btn btn--sec" type="button" id="admin-novo">' + ICONES.mais + 'Adicionar produto</button>' +
            '<button class="btn btn--contorno" type="button" id="admin-foto">' + ICONES.camera + 'Ler catálogo por foto</button>' +
          '</div>' +
          '<details class="conta-det" style="margin-top:14px"><summary>Cópia de segurança</summary><div class="linha-acoes" style="margin-top:10px">' +
            '<button class="btn btn--fantasma btn--p" type="button" id="admin-exportar">Baixar cópia (JSON)</button>' +
            '<label class="btn btn--fantasma btn--p" style="cursor:pointer">Restaurar cópia<input type="file" accept="application/json,.json" id="admin-importar" hidden></label>' +
          '</div></details></section>';
      },
      loja: function () {
        return (!servidor ? '<div class="aviso-admin"><strong>Só neste aparelho</strong>Sem o servidor do MenuReal, as alterações ficam salvas só neste navegador.</div>' : '') +
          '<section class="secao-admin"><h3>Sua loja</h3><div class="campos">' +
          campo('Nome', '<input name="p-nome" required maxlength="60" value="' + esc(p.nome) + '">') +
          campo('Frase curta (aparece embaixo do nome)', '<input name="p-slogan" maxlength="90" value="' + esc(p.slogan) + '">') +
          campo('WhatsApp que recebe os pedidos', '<input name="p-zap" inputmode="numeric" maxlength="15" placeholder="55 + DDD + número" value="' + esc(p.whatsapp) + '">') +
          '<div class="campos campos--2">' +
            campo('Abre às', '<input type="time" name="p-abre" value="' + esc(p.abre) + '">') +
            campo('Fecha às', '<input type="time" name="p-fecha" value="' + esc(p.fecha) + '">') +
          '</div>' +
          '<fieldset class="campo" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Dias abertos</legend><div class="linha-acoes">' +
            DIAS.map(function (d, i) {
              return '<label class="checar" style="min-height:auto"><input type="checkbox" name="p-dia" value="' + i + '"' + (p.dias.indexOf(i) > -1 ? ' checked' : '') + '>' + d + '</label>';
            }).join('') +
          '</div></fieldset>' +
          campo('Categorias (separe por vírgula)', '<input name="p-cats" maxlength="400" value="' + esc(rascunho.categorias.join(', ')) + '">') +
          campo('Tipo de negócio', '<select name="p-tipo"><option value="alimentos"' + (p.tipo !== 'produtos' ? ' selected' : '') + '>Comida e bebida</option>' +
            '<option value="produtos"' + (p.tipo === 'produtos' ? ' selected' : '') + '>Produtos e objetos</option></select>') +
          '</div></section>';
      },
      pedidos: function () { return htmlPedidoAdmin(p.pedido); },
      visual: function () { return htmlAparencia(p); },
      divulgar: function () { return htmlEtiquetasAdmin() + htmlCartazAdmin(); },
      conta: function () {
        return '<div class="aviso-admin aviso-admin--ok conta"><span><strong>' + esc(dados.padaria.nome) + '</strong>' + esc(location.host + '/' + LOJA) + '</span>' +
          '<button class="btn btn--fantasma btn--p" type="button" id="admin-sair">Sair</button></div>' + htmlContaAdmin();
      }
    };
    $('#admin-corpo').innerHTML =
      '<div class="abas-admin" role="tablist" aria-label="Partes do painel">' + abas.map(function (a) {
        var ponto = a === 'inicio' && plano && plano.situacao !== 'ativo';
        return '<button class="aba-admin" type="button" role="tab" data-aba-btn="' + a + '" aria-selected="' + (a === abaAdmin) + '">' + ABAS[a] + (ponto ? '<span class="ponto" aria-hidden="true"></span>' : '') + '</button>';
      }).join('') + '</div>' +
      abas.map(function (a) {
        return '<div class="painel-aba" role="tabpanel" data-aba="' + a + '"' + (a === abaAdmin ? '' : ' hidden') + '>' + conteudo[a]() + '</div>';
      }).join('');
    if (abaAdmin === 'inicio') { carregarResultados(); carregarResumo(); }
  }
  function mostrarAba(a) {
    abaAdmin = a;
    $$('#admin-corpo [data-aba-btn]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-aba-btn') === a)); });
    $$('#admin-corpo .painel-aba').forEach(function (d) { d.hidden = d.getAttribute('data-aba') !== a; });
    var corpo = $('#admin-corpo'); if (corpo) corpo.scrollTop = 0;
    var b = $('#admin-corpo [data-aba-btn="' + a + '"]'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'center' });
    if (a === 'inicio') { carregarResultados(); carregarResumo(); }
  }

  // ---- Números da loja (contagens anônimas por dia)
  function carregarResultados() {
    var alvo = $('#resultados');
    if (!alvo || !LOJA || !servidor) return;
    fetch(comLoja('api/evento') + '&dias=14', { headers: cabecalhos(), cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) { var el = $('#resultados'); if (el) el.innerHTML = htmlResultados(j); })
      .catch(function (e) { var el = $('#resultados'); if (el) el.innerHTML = '<p class="mini">Não deu para carregar os números agora (' + esc(e.message) + ').</p>'; });
  }
  // Resumo da semana: texto pronto para mandar no WhatsApp e opção de receber por e-mail toda segunda
  var resumoAtual = null;
  function carregarResumo() {
    if (!$('#resumo-semana') || !LOJA || !servidor) return;
    fetch(comLoja('api/conta') + '&resumo=1', { headers: cabecalhos(), cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) { resumoAtual = j; renderResumo(); })
      .catch(function (e) { var el = $('#resumo-semana'); if (el) el.innerHTML = '<p class="mini">Não deu para carregar o resumo agora (' + esc(e.message) + ').</p>'; });
  }
  function renderResumo() {
    var el = $('#resumo-semana'), j = resumoAtual;
    if (!el || !j) return;
    var zap = String(rascunho.padaria.whatsapp || '').replace(/\D/g, '');
    el.innerHTML = '<pre class="resumo-texto">' + esc(j.texto) + '</pre>' +
      '<div class="linha-acoes">' +
        (zap ? '<a class="btn btn--primario btn--p" target="_blank" rel="noopener" href="https://wa.me/' + zap + '?text=' + encodeURIComponent(j.texto) + '">Mandar no meu WhatsApp</a>' : '') +
        '<button class="btn btn--contorno btn--p" type="button" id="resumo-copiar">Copiar</button>' +
      '</div>' +
      (j.emailConfigurado
        ? '<label class="checar"><input type="checkbox" id="resumo-email"' + (j.emailLigado ? ' checked' : '') + '> Receber este resumo por e-mail toda segunda (' + esc(j.email || '') + ')</label>'
        : '<p class="mini">Toda segunda o resumo da semana anterior fica pronto aqui. Mande para você ou para o seu sócio.</p>');
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('#resumo-copiar') && resumoAtual) {
      var t = resumoAtual.texto;
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('Resumo copiado.'); }, function () { toast('Não deu para copiar.'); });
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'resumo-email') return;
    var ligado = e.target.checked;
    postarJson(comLoja('api/conta'), { acao: 'resumo', ligado: ligado }, cabecalhos())
      .then(function () { if (resumoAtual) resumoAtual.emailLigado = ligado; toast(ligado ? 'Você vai receber o resumo toda segunda.' : 'Resumo por e-mail desligado.'); })
      .catch(function (err) { e.target.checked = !ligado; toast(err.message); });
  });
  function htmlResultados(j) {
    var dias = [], porDia = {}, tot = { visita: 0, produto: 0, ar: 0, pedido: 0 }, prods = {};
    for (var i = 13; i >= 0; i--) {
      var d = new Date(Date.parse(j.hoje + 'T12:00:00Z') - i * 864e5).toISOString().slice(0, 10);
      dias.push(d); porDia[d] = { visita: 0, pedido: 0 };
    }
    var sete = dias.slice(7);
    j.linhas.forEach(function (l) {
      if (porDia[l.dia] && (l.tipo === 'visita' || l.tipo === 'pedido')) porDia[l.dia][l.tipo] += l.n;
      if (sete.indexOf(l.dia) < 0) return;
      tot[l.tipo] = (tot[l.tipo] || 0) + l.n;
      if (l.tipo === 'produto') prods[l.chave] = (prods[l.chave] || 0) + l.n;
    });
    var max = Math.max.apply(null, dias.map(function (d) { return porDia[d].visita; }).concat([1]));
    var conv = tot.visita ? Math.round(tot.pedido / tot.visita * 100) : 0;
    var nomeDe = function (id) { var x = rascunho.produtos.filter(function (q) { return q.id === id; })[0]; return x ? x.nome : 'Produto removido'; };
    var top = Object.keys(prods).sort(function (a, b) { return prods[b] - prods[a]; }).slice(0, 5);
    var dataBr = function (d) { return d.slice(8, 10) + '/' + d.slice(5, 7); };
    var tile = function (v, rot) { return '<div class="numero"><strong>' + v + '</strong><span>' + rot + '</span></div>'; };
    if (!tot.visita && !tot.pedido) {
      return '<div class="numeros">' + tile(0, 'visitas') + tile(0, orc() + 's enviados') + tile(0, 'abriram a câmera') + tile('0%', 'visitas que pediram') + '</div>' +
        '<p class="mini">Ainda não há visitas. Mande o link no WhatsApp e cole o cartaz com QR nas mesas: os números aparecem aqui. (Suas próprias visitas logado não contam.)</p>';
    }
    return '<div class="numeros">' + tile(tot.visita, 'visitas') + tile(tot.pedido, orc() + 's enviados') + tile(tot.ar, 'abriram a câmera') + tile(conv + '%', 'visitas que pediram') + '</div>' +
      (tot.qr ? '<p class="mini" style="margin:0 0 8px">' + tot.qr + (tot.qr === 1 ? ' cliente abriu' : ' clientes abriram') + ' um produto pelo QR das etiquetas.</p>' : '') +
      '<p class="mini" style="margin:0">Visitas por dia (14 dias)</p>' +
      '<div class="grafico" role="img" aria-label="Visitas por dia nos últimos 14 dias: ' + dias.map(function (d) { return dataBr(d) + ' ' + porDia[d].visita; }).join(', ') + '">' +
        dias.map(function (d, k) {
          var v = porDia[d].visita;
          return '<i' + (k === dias.length - 1 ? ' class="hoje"' : '') + ' style="height:' + Math.max(2, Math.round(v / max * 100)) + '%" title="' + dataBr(d) + ': ' + v + ' visitas, ' + porDia[d].pedido + ' pedidos"></i>';
        }).join('') +
      '</div><div class="grafico-eixo"><span>' + dataBr(dias[0]) + '</span><span>hoje</span></div>' +
      (top.length ? '<p class="mini" style="margin:0 0 8px">Mais vistos</p><ol class="top-produtos">' + top.map(function (id) {
        return '<li><span>' + esc(nomeDe(id)) + '</span><span>' + prods[id] + '</span><b style="width:' + Math.round(prods[id] / prods[top[0]] * 100) + '%"></b></li>';
      }).join('') + '</ol>' : '');
  }
  // Registra uma visita/produto/câmera/pedido (anônimo; a própria loja logada não conta)
  function registrar(tipo, chave) {
    if (!LOJA || !servidor || indisponivel || lerTokenLoja()) return;
    var k = 'menureal:ev:' + LOJA + ':' + tipo + ':' + (chave || '');
    if (tipo !== 'pedido') { try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { /* conta mesmo assim */ } }
    var corpo = JSON.stringify({ loja: LOJA, tipo: tipo, chave: chave || '' });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon('api/evento', new Blob([corpo], { type: 'application/json' }))) return;
    } catch (e) { /* tenta com fetch */ }
    fetch('api/evento', { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo, keepalive: true }).catch(function () {});
  }


  // ---- Pedidos: entrega, retirada, taxas, pagamento e Pix
  function htmlPedidoAdmin(c) {
    var chk = function (k, rot, marcado) { return '<label class="checar"><input type="checkbox" data-ped="' + k + '"' + (marcado ? ' checked' : '') + '> ' + rot + '</label>'; };
    var din = function (v) { return v ? v.toFixed(2).replace('.', ',') : ''; };
    return '<section class="secao-admin" id="secao-pedidos"><h3>Pedidos, entrega e pagamento</h3><div class="campos">' +
      '<label class="checar checar--alerta"><input type="checkbox" data-ped="pausado"' + (c.pausado ? ' checked' : '') + '> <span><strong>Pausar pedidos agora</strong><br><small>Para dias de muito movimento ou imprevisto. O catálogo continua aberto para olhar.</small></span></label>' +
      '<fieldset class="campo"><legend>Como o cliente recebe</legend><div class="linha-acoes">' +
        chk('entrega', 'Entrega', c.entrega) + chk('retirada', 'Retirar na loja', c.retirada) + chk('local', 'Consumir no local', c.local) +
      '</div></fieldset>' +
      '<div class="campos campos--2">' +
        campo('Taxa de entrega (R$)', '<input data-ped="taxa" inputmode="decimal" placeholder="0,00 = grátis" value="' + din(c.taxa) + '">') +
        campo('Pedido mínimo (R$)', '<input data-ped="minimo" inputmode="decimal" placeholder="Sem mínimo" value="' + din(c.minimo) + '">') +
      '</div>' +
      campo('Taxa por bairro (opcional)', '<textarea data-ped="bairros" rows="4" maxlength="3000" placeholder="Centro = 4\nVila Nova = 6,50\nJardim América = 8">' +
        esc(c.bairros.map(function (b) { return b.nome + ' = ' + (b.taxa ? din(b.taxa) : '0'); }).join('\n')) + '</textarea>',
        'Um por linha. Com a lista, a taxa fixa acima não é usada.') +
      '<div class="campos campos--2">' +
        campo('Tempo de entrega', '<input data-ped="tempo" maxlength="40" placeholder="Ex.: 30 a 45 min" value="' + esc(c.tempo) + '">') +
        campo('Fora do horário', '<select data-ped="foraDoHorario"><option value="bloquear"' + (c.foraDoHorario !== 'agendar' ? ' selected' : '') + '>Não aceitar pedidos</option>' +
          '<option value="agendar"' + (c.foraDoHorario === 'agendar' ? ' selected' : '') + '>Aceitar para quando abrir</option></select>') +
      '</div>' +
      campo('Endereço para retirada', '<input data-ped="endereco" maxlength="160" placeholder="Rua, número — bairro" value="' + esc(c.endereco) + '">') +
      (ehAlimento(rascunho) ? '' :
      '<fieldset class="campo tams-admin"><legend>Parcelamento (aparece embaixo do preço)</legend><div class="campos campos--2">' +
        campo('Em até', '<select data-ped="parc-vezes">' + [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 24].map(function (n) { return '<option value="' + n + '"' + (n === c.parcelas.vezes ? ' selected' : '') + '>' + (n === 1 ? 'Não mostrar' : n + 'x') + '</option>'; }).join('') + '</select>') +
        campo('Parcela mínima (R$)', '<input data-ped="parc-minimo" inputmode="decimal" placeholder="Ex.: 50,00" value="' + din(c.parcelas.minimo) + '">') +
      '</div>' + chk('parc-semjuros', 'Sem juros', c.parcelas.semJuros) + '<small>Ex.: “ou 10x de R$ 199,00 sem juros”. Produtos baratos mostram menos parcelas para não ficar abaixo da parcela mínima.</small></fieldset>' +
      '') +
      '<fieldset class="campo"><legend>Formas de pagamento</legend><div class="linha-acoes">' +
        chk('pg-pix', 'Pix', c.pagamento.pix) + chk('pg-cartao', 'Cartão', c.pagamento.cartao) + chk('pg-dinheiro', 'Dinheiro', c.pagamento.dinheiro) +
      '</div></fieldset>' +
      '<fieldset class="campo tams-admin"><legend>Chave Pix (opcional)</legend>' +
        '<small>O cliente recebe o Pix <strong>já com o valor</strong>. O dinheiro cai direto na sua conta.</small>' +
        '<div class="campos campos--2">' +
          campo('Tipo', '<select data-ped="pix-tipo">' + TIPOS_PIX.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === c.pix.tipo ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>') +
          campo('Chave', '<input data-ped="pix-chave" maxlength="77" autocomplete="off" value="' + esc(c.pix.chave) + '">') +
        '</div><div class="campos campos--2">' +
          campo('Nome de quem recebe', '<input data-ped="pix-nome" maxlength="25" placeholder="Como aparece no banco" value="' + esc(c.pix.nome) + '">') +
          campo('Cidade', '<input data-ped="pix-cidade" maxlength="15" value="' + esc(c.pix.cidade) + '">') +
        '</div>' +
        '<button class="btn btn--fantasma btn--p" type="button" id="pix-testar">Testar a chave: gerar Pix de R$ 0,01</button><div id="pix-teste"></div>' +
      '</fieldset>' +
    '</div></section>';
  }
  function coletarPedido(f) {
    var c = rascunho.padaria.pedido;
    var q = function (k) { return f.querySelector('[data-ped="' + k + '"]'); };
    if (!q('taxa')) return;
    c.pausado = q('pausado').checked;
    c.entrega = q('entrega').checked; c.retirada = q('retirada').checked; c.local = q('local').checked;
    c._taxa = q('taxa').value; c.taxa = q('taxa').value.trim() ? lerPreco(q('taxa').value) : 0;
    c._minimo = q('minimo').value; c.minimo = q('minimo').value.trim() ? lerPreco(q('minimo').value) : 0;
    c._bairrosErro = '';
    c.bairros = [];
    q('bairros').value.split('\n').forEach(function (l, i) {
      l = l.trim(); if (!l) return;
      var m = l.match(/^(.+?)\s*[=:]\s*(?:R\$\s*)?([\d.,]+)\s*$/);
      if (!m) { if (!c._bairrosErro) c._bairrosErro = 'Linha ' + (i + 1) + ': use “Bairro = taxa”.'; return; }
      c.bairros.push({ nome: m[1].trim().slice(0, 50), taxa: lerPreco(m[2]) });
    });
    c.tempo = q('tempo').value.trim(); c.foraDoHorario = q('foraDoHorario').value; c.endereco = q('endereco').value.trim();
    c.pagamento = { pix: q('pg-pix').checked, cartao: q('pg-cartao').checked, dinheiro: q('pg-dinheiro').checked };
    if (q('parc-vezes')) {
      c.parcelas = { vezes: Number(q('parc-vezes').value) || 1, semJuros: q('parc-semjuros').checked, minimo: q('parc-minimo').value.trim() ? (lerPreco(q('parc-minimo').value) || 0) : 0 };
    }
    c.pix = { tipo: q('pix-tipo').value, chave: q('pix-chave').value.trim(), nome: q('pix-nome').value.trim(), cidade: q('pix-cidade').value.trim() };
  }
  function erroChavePix(px) {
    var c = px.chave, d = c.replace(/\D/g, '');
    if (!c) return '';
    if (px.tipo === 'cpf' && d.length !== 11) return 'CPF precisa ter 11 números.';
    if (px.tipo === 'cnpj' && d.length !== 14) return 'CNPJ precisa ter 14 números.';
    if (px.tipo === 'telefone' && !(d.length === 10 || d.length === 11 || ((d.length === 12 || d.length === 13) && d.indexOf('55') === 0))) return 'Celular com DDD. Ex.: 11999998888.';
    if (px.tipo === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) return 'E-mail inválido.';
    if (px.tipo === 'aleatoria' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return 'A chave aleatória tem 36 caracteres, com hífens.';
    return '';
  }

  // ---- Etiquetas com QR Code por produto (para colar no móvel da loja física)
  function linkProduto(id, qr) { return enderecoLoja() + '?p=' + encodeURIComponent(id) + (qr ? '&qr=1' : ''); }
  var etiquetasSel = null;   // ids marcados (null = todos)
  var etiquetasPreco = true;
  function htmlEtiquetasAdmin() {
    var prods = rascunho.produtos.filter(function (x) { return x.nome; });
    if (!prods.length) return '';
    return '<section class="secao-admin" id="secao-etiquetas"><h3>Etiquetas com QR Code</h3>' +
      '<p class="mini">Cole no móvel da loja. O cliente aponta a câmera e abre <strong>aquele produto</strong> em 3D, com as versões, e pode ver na casa dele. 8 etiquetas por folha A4.</p>' +
      '<div class="etq-lista">' + prods.map(function (x) {
        var marcado = !etiquetasSel || etiquetasSel.indexOf(x.id) > -1;
        return '<div class="etq-item"><label class="checar checar--p"><input type="checkbox" data-etq="' + esc(x.id) + '"' + (marcado ? ' checked' : '') + '> ' +
          '<span>' + esc(x.nome) + (x.modelo ? '' : ' <small>(sem 3D)</small>') + '</span></label>' +
          '<button class="btn btn--fantasma btn--p" type="button" data-copiar-link="' + esc(x.id) + '">Copiar link</button></div>';
      }).join('') + '</div>' +
      '<label class="checar"><input type="checkbox" id="etq-preco"' + (etiquetasPreco ? ' checked' : '') + '> Mostrar o preço na etiqueta</label>' +
      '<button class="btn btn--sec btn--bloco" type="button" id="etq-gerar">Criar etiquetas para imprimir</button>' +
      '<div id="etq-area"></div></section>';
  }
  function gerarEtiquetas(lista) {
    var p = rascunho.padaria, v = p.visual, cor = v.cor || COR_PADRAO, sobre = textoSobre(cor);
    var fonte = (FONTES_LOJA[v.fonte] || FONTES_LOJA.moderno).css.replace('var(--fonte)', 'system-ui, sans-serif');
    var W = 1240, H = 1754, CW = W / 2, CH = H / 4, comPreco = etiquetasPreco;
    return Promise.all([carregarQr(), carregarImagem(v.logo), document.fonts ? document.fonts.load('700 40px ' + fonte).catch(function () {}) : null]).then(function (r) {
      var qrcode = r[0], logo = r[1], paginas = [];
      for (var ini = 0; ini < lista.length; ini += 8) {
        var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
        lista.slice(ini, ini + 8).forEach(function (x, k) {
          var cx = (k % 2) * CW, cy = Math.floor(k / 2) * CH, pad = 34;
          // faixa com a cor da loja e o nome (ou logo)
          ctx.fillStyle = cor; ctx.fillRect(cx + pad, cy + pad, CW - pad * 2, 64);
          ctx.fillStyle = sobre; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          if (logo) {
            var k2 = Math.min(220 / logo.width, 44 / logo.height);
            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(cx + pad + 10, cy + pad + 8, logo.width * k2 + 16, 48);
            ctx.drawImage(logo, cx + pad + 18, cy + pad + 10 + (44 - logo.height * k2) / 2, logo.width * k2, logo.height * k2);
          } else {
            ctx.font = '700 28px ' + fonte; ctx.fillText(p.nome.slice(0, 32), cx + pad + 18, cy + pad + 33);
          }
          // QR
          var q = qrcode(0, 'M'); q.addData(linkProduto(x.id, true)); q.make();
          var n = q.getModuleCount(), lado = 250, m = lado / (n + 2), qx = cx + pad, qy = cy + pad + 84;
          ctx.fillStyle = '#111411';
          for (var yy = 0; yy < n; yy++) for (var xx = 0; xx < n; xx++) if (q.isDark(yy, xx)) ctx.fillRect(Math.floor(qx + (xx + 1) * m), Math.floor(qy + (yy + 1) * m), Math.ceil(m), Math.ceil(m));
          // textos
          var tx = qx + lado + 22, larg = CW - pad - (tx - cx) - 10;
          ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#111411'; ctx.font = '700 34px ' + fonte;
          var yNome = textoQuebrado(ctx, x.nome, tx, qy + 44, larg, 40);
          var y2 = yNome + 44;
          if (comPreco && x.preco > 0) { ctx.font = '800 36px system-ui, sans-serif'; ctx.fillStyle = '#111411'; ctx.fillText(brl(x.preco), tx, y2); y2 += 46; }
          ctx.font = '400 24px system-ui, sans-serif'; ctx.fillStyle = '#4A524D';
          y2 = textoQuebrado(ctx, x.modelo ? 'Aponte a câmera e veja em 3D e na sua casa' : 'Aponte a câmera e veja detalhes e medidas', tx, Math.min(y2, qy + 200), larg, 30);
          ctx.font = '600 22px system-ui, sans-serif'; ctx.fillStyle = '#111411';
          ctx.fillText(dimTexto(x.dim), tx, Math.min(y2 + 36, cy + CH - pad - 8));
          // linhas de corte
          ctx.strokeStyle = '#C9CCC8'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
          ctx.strokeRect(cx + 1, cy + 1, CW - 2, CH - 2); ctx.setLineDash([]);
        });
        paginas.push(cv.toDataURL('image/png'));
      }
      return paginas;
    });
  }
  function mostrarEtiquetas(botao) {
    var lista = rascunho.produtos.filter(function (x) { return x.nome && (!etiquetasSel || etiquetasSel.indexOf(x.id) > -1); });
    if (!lista.length) { toast('Marque pelo menos um produto.'); return; }
    botao.disabled = true; botao.textContent = 'Criando as etiquetas…';
    gerarEtiquetas(lista).then(function (pgs) {
      $('#etq-area').innerHTML = pgs.map(function (png, i) {
        return '<img class="cartaz-previa etq-previa" src="' + png + '" alt="Folha ' + (i + 1) + ' de etiquetas com QR Code">' +
          '<a class="btn btn--contorno btn--p" download="etiquetas-' + esc(LOJA || 'menureal') + '-' + (i + 1) + '.png" href="' + png + '">Baixar folha ' + (i + 1) + '</a>';
      }).join('') +
        '<div class="linha-acoes"><button class="btn btn--primario" type="button" id="etq-imprimir">Imprimir ' + (pgs.length > 1 ? 'as ' + pgs.length + ' folhas' : 'a folha') + '</button></div>' +
        '<p class="mini">Dica: imprima em papel adesivo A4 (ou comum, e cole com fita). Teste um QR com o seu celular antes de colar.</p>';
    }).catch(function (e) { toast(e.message || 'Não foi possível criar as etiquetas.'); })
      .then(function () { botao.disabled = false; botao.textContent = 'Criar de novo'; });
  }
  function imprimirImagens(srcs, titulo) {
    var fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(fr);
    var d = fr.contentDocument;
    d.open();
    d.write('<!doctype html><title>' + titulo + '</title><style>@page{size:A4;margin:0}html,body{margin:0}img{width:100%;height:100vh;object-fit:contain;display:block;break-after:page}</style>' +
      srcs.map(function (s2) { return '<img src="' + s2 + '">'; }).join(''));
    d.close();
    var ims = Array.prototype.slice.call(d.images), faltam = ims.length;
    var vai = function () { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(function () { fr.remove(); }, 60000); };
    ims.forEach(function (im) { if (im.complete) { if (!--faltam) vai(); } else im.onload = function () { if (!--faltam) vai(); }; });
  }
  document.addEventListener('change', function (e) {
    var c = e.target.closest('[data-etq]');
    if (c) {
      etiquetasSel = $$('[data-etq]').filter(function (i) { return i.checked; }).map(function (i) { return i.getAttribute('data-etq'); });
      return;
    }
    if (e.target.id === 'etq-preco') etiquetasPreco = e.target.checked;
  });
  document.addEventListener('click', function (e) {
    var g = e.target.closest('#etq-gerar'); if (g) { coletarAdmin(); mostrarEtiquetas(g); return; }
    if (e.target.closest('#etq-imprimir')) { imprimirImagens($$('.etq-previa').map(function (i) { return i.src; }), 'Etiquetas'); return; }
    var cl = e.target.closest('[data-copiar-link]');
    if (cl) {
      var url = linkProduto(cl.getAttribute('data-copiar-link'));
      var ok = function () { toast('Link copiado. Cole no WhatsApp ou no Instagram.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { window.prompt('Copie o link:', url); });
      else window.prompt('Copie o link:', url);
    }
  });

  // ---- Cartaz com QR Code para mesa e balcão
  function enderecoLoja() { return location.origin + '/' + (LOJA || ''); }
  function htmlCartazAdmin() {
    return '<section class="secao-admin"><h3>Cartaz com QR Code</h3>' +
      '<p class="mini">Para colar na loja, na vitrine ou no balcão. O cliente aponta a câmera e abre o seu ' + termo(rascunho) + ': <strong>' + esc(enderecoLoja().replace(/^https?:\/\//, '')) + '</strong></p>' +
      '<button class="btn btn--sec btn--bloco" type="button" id="cartaz-gerar">Criar cartaz com QR Code</button>' +
      '<div id="cartaz-area"></div></section>';
  }
  function carregarImagem(url) {
    return new Promise(function (ok) {
      if (!url) { ok(null); return; }
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { ok(im); }; im.onerror = function () { ok(null); };
      im.src = url;
    });
  }
  function textoQuebrado(ctx, txt, x, y, larg, alt) {
    var pal = txt.split(' '), linha = '', ys = y;
    pal.forEach(function (w) {
      var t = linha ? linha + ' ' + w : w;
      if (ctx.measureText(t).width > larg && linha) { ctx.fillText(linha, x, ys); linha = w; ys += alt; } else linha = t;
    });
    if (linha) ctx.fillText(linha, x, ys);
    return ys;
  }
  function gerarCartaz() {
    var p = rascunho.padaria, v = p.visual, url = enderecoLoja();
    var cor = v.cor || COR_PADRAO, dest = v.destaque || DESTAQUE_PADRAO, sobre = textoSobre(cor);
    var fonte = (FONTES_LOJA[v.fonte] || FONTES_LOJA.moderno).css.replace('var(--fonte)', 'system-ui, sans-serif');
    var W = 1240, H = 1754;
    return Promise.all([carregarQr(), carregarImagem(v.logo), document.fonts ? document.fonts.load('700 60px ' + fonte).catch(function () {}) : null]).then(function (r) {
      var qrcode = r[0], logo = r[1];
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = cor; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(90, 470, W - 180, 1110, 48); else ctx.rect(90, 470, W - 180, 1110); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = sobre;
      var topo = 110;
      if (logo) {
        // logo sobre um selo branco: aparece com qualquer cor de fundo
        var k = Math.min(480 / logo.width, 170 / logo.height), lw = logo.width * k, lh = logo.height * k;
        var bw = lw + 90, bh = lh + 60, bx = (W - bw) / 2, by = 80;
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 36); else ctx.rect(bx, by, bw, bh); ctx.fill();
        ctx.drawImage(logo, (W - lw) / 2, by + 30, lw, lh);
        ctx.fillStyle = sobre;
        topo = by + bh + 80;
      } else {
        ctx.font = '700 92px ' + fonte;
        topo = textoQuebrado(ctx, p.nome, W / 2, 230, W - 200, 100) + 110;
      }
      ctx.font = '600 50px ' + fonte;
      ctx.fillText(ehAlimento(rascunho) ? 'Veja o cardápio em 3D' : 'Veja o catálogo em 3D', W / 2, Math.min(topo + 10, 420));
      var q = qrcode(0, 'M'); q.addData(url); q.make();
      var n = q.getModuleCount(), lado = 760, m = lado / (n + 2), x0 = (W - lado) / 2, y0 = 560;
      ctx.fillStyle = '#111411';
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) if (q.isDark(y, x)) ctx.fillRect(Math.floor(x0 + (x + 1) * m), Math.floor(y0 + (y + 1) * m), Math.ceil(m), Math.ceil(m));
      ctx.font = '700 58px ' + fonte;
      ctx.fillText('Aponte a câmera do celular', W / 2, 1420);
      ctx.font = '400 34px system-ui, sans-serif'; ctx.fillStyle = '#55605A';
      ctx.fillText(ehAlimento(rascunho) ? 'Veja no tamanho real e peça pelo WhatsApp' : 'Veja no tamanho real e peça pelo WhatsApp', W / 2, 1482);
      ctx.font = '600 34px system-ui, sans-serif'; ctx.fillStyle = luminancia(cor) > 0.6 ? '#111411' : cor;
      ctx.fillText(url.replace(/^https?:\/\//, ''), W / 2, 1544);
      ctx.fillStyle = dest; ctx.fillRect(W / 2 - 60, 1612, 120, 8);
      ctx.fillStyle = sobre; ctx.font = '500 30px system-ui, sans-serif';
      if (v.marca) ctx.fillText((ehAlimento(rascunho) ? 'Cardápio' : 'Catálogo') + ' em 3D por MenuReal', W / 2, 1690);
      return cv;
    });
  }
  function mostrarCartaz(botao) {
    botao.disabled = true; botao.textContent = 'Criando o cartaz…';
    gerarCartaz().then(function (cv) {
      var png = cv.toDataURL('image/png');
      var nome = 'cartaz-qr-' + (LOJA || 'menureal') + '.png';
      $('#cartaz-area').innerHTML = '<img class="cartaz-previa" src="' + png + '" alt="Cartaz com QR Code">' +
        '<div class="linha-acoes"><a class="btn btn--primario" download="' + esc(nome) + '" href="' + png + '">Baixar imagem</a>' +
        '<button class="btn btn--contorno" type="button" id="cartaz-imprimir">Imprimir</button></div>' +
        '<p class="mini">Dica: imprima em A4 ou A5 e plastifique. Teste o QR com o seu celular antes de colar.</p>';
    }).catch(function (e) { toast(e.message || 'Não foi possível criar o cartaz.'); })
      .then(function () { botao.disabled = false; botao.textContent = 'Criar de novo (com as cores atuais)'; });
  }
  function imprimirCartaz() {
    var img = $('.cartaz-previa');
    if (!img) return;
    var fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    document.body.appendChild(fr);
    var d = fr.contentDocument;
    d.open();
    d.write('<!doctype html><title>Cartaz</title><style>@page{size:A4;margin:0}html,body{margin:0}img{width:100%;height:100vh;object-fit:contain;display:block}</style><img src="' + img.src + '">');
    d.close();
    var im = d.querySelector('img');
    var vai = function () { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(function () { fr.remove(); }, 60000); };
    if (im.complete) vai(); else im.onload = vai;
  }

  function htmlAparencia(p) {
    var v = p.visual;
    var podeEnviar = servidor;
    function imagem(uso, rotulo, ajuda) {
      var url = v[uso];
      return '<div class="campo"><span>' + rotulo + '</span><div class="img-loja">' +
        '<div class="img-loja__previa' + (uso === 'capa' ? ' img-loja__previa--capa' : '') + '">' + (url ? '<img src="' + esc(url) + '" alt="">' : 'Sem imagem') + '</div>' +
        '<div class="img-loja__acoes">' +
          (podeEnviar
            ? '<label class="btn btn--sec btn--p" style="cursor:pointer">' + (url ? 'Trocar' : 'Enviar') + '<input type="file" accept="image/png,image/jpeg,image/webp,image/*" data-img="' + uso + '" hidden></label>' +
              (url ? '<button class="btn btn--fantasma btn--p" type="button" data-img-remover="' + uso + '">Remover</button>' : '')
            : '<small>Disponível no site publicado.</small>') +
        '</div></div><small>' + ajuda + '</small></div>';
    }
    return '<section class="secao-admin" id="aparencia"><h3>Aparência da página</h3>' +
      (LOJA && servidor ? '<div class="ed-chamada"><div><b>Editar o site na tela</b><span>Mude textos, fotos e preços tocando neles e adicione banner, galeria, depoimentos e endereço.</span></div><button type="button" class="btn btn--primario btn--p" data-editar-site>✏️ Editar o site</button></div>' : '') +
      '<div class="campos">' +
      '<fieldset class="campo" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Cores</legend><div class="paletas">' +
        PALETAS.map(function (x, i) {
          var ativo = (x.cor || '') === (v.cor || '') && (x.destaque || '') === (v.destaque || '');
          return '<button type="button" class="paleta" data-paleta="' + i + '" aria-pressed="' + ativo + '"><span class="paleta__cores"><i style="background:' + (x.cor || COR_PADRAO) + '"></i><i style="background:' + (x.destaque || DESTAQUE_PADRAO) + '"></i></span>' + x.nome + '</button>';
        }).join('') +
      '</div></fieldset>' +
      '<div class="campos campos--2">' +
        campo('Cor principal', '<input type="color" data-v="cor" value="' + (v.cor || COR_PADRAO).toLowerCase() + '">', 'Botões e ações.') +
        campo('Cor de destaque', '<input type="color" data-v="destaque" value="' + (v.destaque || DESTAQUE_PADRAO).toLowerCase() + '">', 'Régua de medidas e detalhes.') +
      '</div>' +
      '<fieldset class="campo" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Estilo das letras dos títulos</legend><div class="fontes-op">' +
        Object.keys(FONTES_LOJA).map(function (k) {
          return '<label class="fonte-op"><input type="radio" name="v-fonte" value="' + k + '"' + (v.fonte === k ? ' checked' : '') + '>' +
            '<span class="fonte-op__amostra" style="font-family:' + esc(FONTES_LOJA[k].css) + '">' + esc(p.nome || 'Sua loja') + '</span><small>' + FONTES_LOJA[k].nome + '</small></label>';
        }).join('') +
      '</div></fieldset>' +
      imagem('logo', 'Logo', 'Aparece no topo da página. PNG com fundo transparente fica melhor.') +
      imagem('capa', 'Foto de capa', 'Foto horizontal no topo: fachada, vitrine ou um produto em destaque.') +
      '<fieldset class="campo"><legend>Cenário atrás do produto em 3D</legend><div class="cenarios">' +
        [['logo', 'Cor + logo'], ['cor', 'Só a cor'], ['claro', 'Claro']].map(function (o) {
          return '<label class="cenario-op"><input type="radio" name="v-cenario" value="' + o[0] + '"' + ((v.cenario || 'logo') === o[0] ? ' checked' : '') + '>' +
            '<span class="cenario-op__amostra cenario-op__amostra--' + o[0] + '">' + (o[0] === 'logo' ? (v.logo ? '<img src="' + esc(v.logo) + '" alt="">' : '<b>' + esc((p.nome || 'Loja').slice(0, 10)) + '</b>') : '') + '</span>' + o[1] + '</label>';
        }).join('') + '</div></fieldset>' +
      '<label class="checar"><input type="checkbox" data-v="marca"' + (v.marca ? ' checked' : '') + '> Mostrar “' + (ehAlimento(rascunho) ? 'Cardápio' : 'Catálogo') + ' em 3D por MenuReal” no rodapé</label>' +
      '<p class="mini">As mudanças aparecem na hora; toque em “Salvar alterações” para publicar.</p>' +
    '</div></section>';
  }

  function visualRascunho(mudou) {
    var v = rascunho.padaria.visual;
    if (mudou) mudou(v);
    rascunho.padaria.visual = validarVisual(v);
    aplicarVisual(rascunho.padaria);
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-editar-site]')) return;
    var dlg = $('#dlg-admin');
    var ir = function () { if (dlg && dlg.open) fecharDialogo(dlg); setTimeout(entrarEdicao, 150); };
    ir();
  });
  function renderAparencia() {
    coletarAdmin();
    var sec = $('#aparencia');
    if (!sec) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = htmlAparencia(rascunho.padaria);
    sec.replaceWith(tmp.firstChild);
  }

  function reduzirParaEnvio(arquivo, ladoMax, transparente) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var lado = ladoMax, tentativa = 0;
        function gerar() {
          var k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * k));
          c.height = Math.max(1, Math.round(img.naturalHeight * k));
          var g = c.getContext('2d');
          if (!transparente) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
          g.drawImage(img, 0, 0, c.width, c.height);
          var d = c.toDataURL('image/webp', 0.86), tipo = 'image/webp';
          if (d.indexOf('data:image/webp') !== 0) { tipo = transparente ? 'image/png' : 'image/jpeg'; d = c.toDataURL(tipo, 0.86); }
          var b64 = d.split(',')[1];
          if (b64.length > 1400000 && tentativa++ < 4) { lado = Math.round(lado * 0.75); return gerar(); }
          ok({ base64: b64, tipo: tipo });
        }
        gerar();
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Não foi possível abrir esta imagem. Use JPG ou PNG.')); };
      img.src = url;
    });
  }

  function enviarImagemLoja(uso, arquivo) {
    var cod = $('#admin-codigo');
    if (cod && cod.value.trim()) guardarCodigo(cod.value.trim());
    if (!credenciais()) { toast(LOJA ? 'Entre na conta do estabelecimento' : 'Preencha o código de acesso no topo do painel'); return; }
    toast('Enviando imagem…');
    reduzirParaEnvio(arquivo, uso === 'logo' ? 640 : 1800, uso === 'logo')
      .then(function (r) {
        return fetch(comLoja('api/imagem'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ imagem: r.base64, tipo: r.tipo, uso: uso }) });
      })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) { /* não-JSON */ }
          if (!r.ok || !j) throw new Error((j && j.erro) || 'Erro do servidor (' + r.status + ').');
          return j;
        });
      })
      .then(function (j) {
        visualRascunho(function (v) { v[uso] = j.url; });
        renderAparencia();
        toast((uso === 'logo' ? 'Logo enviada' : 'Capa enviada') + '. Toque em “Salvar alterações” para publicar.');
      })
      .catch(function (e) { toast(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); });
  }

  $('#admin-corpo').addEventListener('click', function (e) {
    if (e.target.closest('#cartaz-gerar')) { coletarAdmin(); mostrarCartaz(e.target.closest('#cartaz-gerar')); return; }
    if (e.target.closest('#cartaz-imprimir')) { imprimirCartaz(); return; }
    if (e.target.closest('#pix-testar')) {
      coletarAdmin();
      var px = rascunho.padaria.pedido.pix, er = erroChavePix(px), alvo = $('#pix-teste');
      if (!px.chave) { toast('Preencha a chave Pix primeiro.'); return; }
      if (er) { toast(er); return; }
      var salvoP = dados.padaria.pedido; dados.padaria.pedido = rascunho.padaria.pedido;
      var cod = codigoPix(0.01); dados.padaria.pedido = salvoP;
      qrSvg(cod).then(function (svg) {
        alvo.innerHTML = '<div class="pix pix--teste"><div class="pix__qr">' + svg + '</div><p class="mini">Leia com o app do seu banco: deve aparecer <strong>o seu nome</strong> e R$ 0,01. Não precisa pagar.</p>' +
          '<textarea class="pix__codigo" readonly rows="3">' + esc(cod) + '</textarea></div>';
      }).catch(function (x) { toast(x.message); });
      return;
    }
    var b = e.target.closest('[data-paleta]');
    if (b) {
      var x = PALETAS[Number(b.getAttribute('data-paleta'))];
      visualRascunho(function (v) { v.cor = x.cor; v.destaque = x.destaque; });
      renderAparencia();
      return;
    }
    var rm = e.target.closest('[data-img-remover]');
    if (rm) {
      var uso = rm.getAttribute('data-img-remover');
      visualRascunho(function (v) { v[uso] = ''; });
      renderAparencia();
    }
  });
  $('#admin-corpo').addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches('input[type="color"][data-v]')) {
      visualRascunho(function (v) {
        v[t.getAttribute('data-v')] = t.value.toUpperCase();
        if (!v.cor) v.cor = COR_PADRAO;
        if (!v.destaque) v.destaque = DESTAQUE_PADRAO;
      });
      $$('.paleta', $('#aparencia')).forEach(function (p) { p.setAttribute('aria-pressed', 'false'); });
    }
  });
  $('#admin-corpo').addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'v-fonte') { visualRascunho(function (v) { v.fonte = t.value; }); return; }
    if (t.matches('[data-v="marca"]')) { visualRascunho(function (v) { v.marca = t.checked; }); return; }
    if (t.name === 'v-cenario') { visualRascunho(function (v) { v.cenario = t.value; }); return; }
    if (t.matches('[data-img]') && t.files && t.files[0]) { enviarImagemLoja(t.getAttribute('data-img'), t.files[0]); t.value = ''; }
    if (t.matches('[data-gal-tipo]')) { var xg = produtoDoAlvo(t), kg = Number(t.closest('[data-gk]').getAttribute('data-gk')); if (xg.galeria[kg]) xg.galeria[kg].tipo = t.value; return; }
    if (t.matches('[data-up-galeria]') && t.files && t.files.length) {
      var xgal = produtoDoAlvo(t), arqs = Array.prototype.slice.call(t.files, 0, 12 - (xgal.galeria || []).length); t.value = '';
      if (!credenciais()) { toast('Entre na conta do estabelecimento'); return; }
      xgal.galeria = xgal.galeria || [];
      toast('Enviando ' + arqs.length + (arqs.length > 1 ? ' fotos…' : ' foto…'));
      arqs.reduce(function (pr, arq) {
        return pr.then(function () {
          return reduzirParaEnvio(arq, 1600, false).then(function (r) {
            return fetch(comLoja('api/imagem'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ imagem: r.base64, tipo: r.tipo, uso: 'produto' }) });
          }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.url) throw new Error(j.erro || 'Erro do servidor (' + r.status + ').'); xgal.galeria.push({ url: j.url, tipo: 'outra' }); }); });
        });
      }, Promise.resolve()).then(function () {
        coletarAdmin(); abertoNoAdmin = xgal.id; renderAdmin(); toast('Fotos enviadas. Escolha o tipo de cada uma e toque em “Salvar alterações”.');
      }).catch(function (e) { coletarAdmin(); abertoNoAdmin = xgal.id; renderAdmin(); toast(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); });
      return;
    }
    if (t.matches('[data-up-foto]') && t.files && t.files[0]) {
      var xp = produtoDoAlvo(t), arqP = t.files[0]; t.value = '';
      if (!credenciais()) { toast('Entre na conta do estabelecimento'); return; }
      toast('Enviando foto…');
      reduzirParaEnvio(arqP, 1400, false).then(function (r) {
        return fetch(comLoja('api/imagem'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ imagem: r.base64, tipo: r.tipo, uso: 'produto' }) });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.url) throw new Error(j.erro || 'Erro do servidor (' + r.status + ').'); return j; });
      }).then(function (j) {
        coletarAdmin(); xp.foto = j.url; abertoNoAdmin = xp.id; renderAdmin();
        toast('Foto enviada. Toque em “Salvar alterações” para publicar.');
      }).catch(function (e) { toast(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); });
      return;
    }
    if (t.matches('[data-forma-foto]') && t.files && t.files[0]) {
      var xf = produtoDoAlvo(t), arqF = t.files[0]; t.value = '';
      var im = new Image();
      im.onload = function () {
        var st = formaEstado[xf.id] = formaEstado[xf.id] || {};
        st.img = im; st.recorte = { x: 0, y: 0, w: 1, h: 1 }; st.glb = null; st.aberto = true; st.cor = corMedia(st); st.corManual = false;
        coletarAdmin(); abertoNoAdmin = xf.id; renderAdmin(); atualizarRecortes();
      };
      im.onerror = function () { toast('Não consegui abrir essa foto. Tente outra (JPG ou PNG).'); };
      im.src = URL.createObjectURL(arqF);
      return;
    }
    if (t.matches('[data-forma-tipo], [data-forma-metal], [data-forma-dupla], [data-forma-cor]')) {
      var xs = produtoDoAlvo(t), s2 = formaEstado[xs.id] = formaEstado[xs.id] || {};
      if (t.matches('[data-forma-tipo]')) s2.forma = t.value;
      if (t.matches('[data-forma-metal]')) s2.metal = t.checked;
      if (t.matches('[data-forma-dupla]')) s2.dupla = t.checked;
      if (t.matches('[data-forma-cor]')) { s2.cor = t.value; s2.corManual = true; }
      s2.glb = null; s2.aberto = true;
      if (t.matches('[data-forma-tipo]')) { coletarAdmin(); abertoNoAdmin = xs.id; renderAdmin(); atualizarRecortes(); }
      else { var bu = t.closest('[data-forma-det]').querySelector('[data-forma-usar]'); if (bu) bu.disabled = true; }
      return;
    }
    if (t.matches('[data-tam-up3d]') && t.files && t.files[0]) {
      coletarAdmin();
      var xv = produtoDoAlvo(t), tv = xv.tamanhos[Number(t.closest('.tam-linha').getAttribute('data-ti'))];
      if (tv) enviar3d(t.files[0], xv, tv.id);
      t.value = '';
      return;
    }
    if (t.matches('[data-up3d]') && t.files && t.files[0]) {
      coletarAdmin();
      enviar3d(t.files[0], produtoDoAlvo(t));
      t.value = '';
    }
  });
  // Fechou o painel sem salvar: volta à aparência publicada
  $('#dlg-admin').addEventListener('close', function () { aplicarVisual(dados.padaria); });

  // Envio do arquivo 3D da fábrica (.glb): confere o formato e as medidas no próprio navegador
  var moduloGlb = null;
  function carregarModuloGlb() {
    if (!moduloGlb) moduloGlb = import(new URL('glb.mjs', document.baseURI).href);
    return moduloGlb;
  }
  function mb(n) { return (n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB'; }
  // Deixa mais leve um 3D que já está no produto (ou numa versão) e envia de novo, sem mexer nas medidas
  function deixar3dLeve(x, url, tamId, automatico) {
    toast('Deixando o 3D mais leve…');
    Promise.all([import(new URL('otimizar.mjs', document.baseURI).href), fetch(urlModelo(url)).then(function (r) { if (!r.ok) throw new Error('Não deu para baixar o 3D.'); return r.arrayBuffer(); })])
      .then(function (r) { return r[0].otimizarGlb(new Uint8Array(r[1])); })
      .then(function (res) {
        if (res.depois >= res.antes) { if (!automatico) toast('Este 3D já está leve (' + mb(res.antes) + ').'); return; }
        var arq = new File([res.glb], slug(x.nome || 'movel') + '.glb', { type: 'model/gltf-binary' });
        enviar3d(arq, x, tamId, { manterMedidas: true, semOtimizar: true, reducao: res, aviso: '3D mais leve. Toque em “Salvar alterações” para publicar.' });
      })
      .catch(function (e) { if (!automatico) toast(e.message || 'Não deu para reduzir o 3D.'); });
  }
  function enviar3d(arquivo, x, tamId, opcoesEnvio) {
    opcoesEnvio = opcoesEnvio || {};
    if (!credenciais()) { toast(LOJA ? 'Entre na conta da loja' : 'Preencha o código de acesso'); return; }
    // confere pelo conteúdo (o celular às vezes salva o .glb com outro nome, sem extensão ou como .bin)
    if (!opcoesEnvio.conferido) {
      arquivo.slice(0, 4).arrayBuffer().then(function (b) {
        var m = new Uint8Array(b);
        if (m[0] === 0x67 && m[1] === 0x6C && m[2] === 0x54 && m[3] === 0x46) { // "glTF"
          var nome = /\.glb$/i.test(arquivo.name) ? arquivo.name : (arquivo.name || 'movel').replace(/\.[^.]*$/, '') + '.glb';
          opcoesEnvio.conferido = true;
          enviar3d(nome === arquivo.name ? arquivo : new File([arquivo], nome, { type: 'model/gltf-binary' }), x, tamId, opcoesEnvio);
        } else if (m[0] === 0x7B || (m[0] === 0xEF && m[3] === 0x7B) || /\.gltf$/i.test(arquivo.name)) {   // .gltf (texto): vira .glb se for arquivo único
          Promise.all([carregarModuloGlb(), arquivo.text()]).then(function (r) {
            var glb = r[0].gltfParaGlb(r[1].replace(/^\uFEFF/, ''));
            opcoesEnvio.conferido = true;
            enviar3d(new File([glb], (arquivo.name || 'movel').replace(/\.[^.]*$/, '') + '.glb', { type: 'model/gltf-binary' }), x, tamId, opcoesEnvio);
          }).catch(function (e) {
            toast(e && e.message === 'externo' ? 'Este .gltf depende de outros arquivos (.bin, texturas). Exporte como .glb (arquivo único) e envie de novo.' : 'Não consegui ler esse .gltf. Exporte como .glb e envie de novo.');
          });
        } else toast('Esse arquivo não é um 3D em .glb ou .gltf. Se a fábrica mandou outro formato (.skp, .obj, .fbx), converta no Blender: Arquivo → Exportar → glTF (.glb).');
      }).catch(function () { toast('Não consegui ler esse arquivo.'); });
      return;
    }
    if (arquivo.size > 60 * 1024 * 1024) { toast('Arquivo grande demais (máximo 60 MB). Peça uma versão mais leve à fábrica.'); return; }
    toast('Conferindo o arquivo 3D…');
    Promise.all([carregarModuloGlb(), arquivo.arrayBuffer()]).then(function (r) {
      // arquivo pesado: deixa mais leve antes de enviar (abre mais rápido no celular do cliente)
      if (opcoesEnvio.semOtimizar || r[1].byteLength < 3 * 1024 * 1024) return r;
      toast('Deixando o 3D mais leve para abrir rápido no celular…');
      return import(new URL('otimizar.mjs', document.baseURI).href).then(function (o) { return o.otimizarGlb(new Uint8Array(r[1])); })
        .then(function (res) { opcoesEnvio.reducao = res.depois < res.antes ? res : null; return [r[0], res.glb.buffer.slice(res.glb.byteOffset, res.glb.byteOffset + res.glb.byteLength)]; })
        .catch(function (e) { console.warn('otimizar', e); return r; });
    }).then(function (r) {
      var m = r[0], bytes = new Uint8Array(r[1]), med, pecasArq = [];
      if (bytes.length > 25 * 1024 * 1024) throw new Error('Mesmo reduzido, o 3D passa de 25 MB. Peça uma versão mais leve à fábrica.');
      try {
        var g = m.lerGlb(bytes), cx = m.caixaGlb(g.json);
        med = { largura: +((cx.mx[0] - cx.mn[0]) * 100).toFixed(1), profundidade: +((cx.mx[2] - cx.mn[2]) * 100).toFixed(1), altura: +((cx.mx[1] - cx.mn[1]) * 100).toFixed(1) };
        try { pecasArq = lerPecas(m.pecasDoGlb(g.json)); } catch (e2) { pecasArq = []; }
      } catch (e) { throw new Error('Este arquivo não é um .glb válido.'); }
      if (!(med.largura > 0)) throw new Error('O arquivo não tem nenhum objeto 3D.');
      toast('Enviando o 3D…');
      var nomeArq = (x.nome || arquivo.name) + (tamId ? '-' + tamId : '');
      return fetch(comLoja('api/modelo-arquivo') + (LOJA ? '&' : '?') + 'nome=' + encodeURIComponent(slug(nomeArq)), {
        method: 'POST', headers: Object.assign({ 'content-type': 'model/gltf-binary' }, credenciais()), body: bytes
      }).then(function (resp) {
        return resp.json().catch(function () { return {}; }).then(function (j) { if (!resp.ok) throw new Error(j.erro || 'Erro ' + resp.status); return j; });
      }).then(function (j) { return { url: j.url, med: med, pecas: pecasArq }; });
    }).then(function (res) {
      if (tamId) {
        // versão do produto: guarda o 3D só nela (o resto do produto não muda)
        coletarAdmin();
        var tv = (x.tamanhos || []).filter(function (v) { return v.id === tamId; })[0];
        if (!tv) throw new Error('A versão foi removida antes do envio terminar.');
        tv.modelo = res.url;
        var semMedV = tv.dim.largura <= 5 && tv.dim.profundidade <= 5 && tv.dim.altura <= 5;
        if (semMedV) tv.dim = res.med;
        abertoNoAdmin = x.id; renderAdmin();
        toast('3D da versão “' + tv.nome + '” enviado' + (semMedV ? ' (' + dimTexto(res.med) + ')' : '') + '. Toque em “Salvar alterações”.');
        return;
      }
      var modeloAntigo = x.modelo;
      x.modelo = res.url;
      x.ilustrativo = false;
      // Raio-X: as peças valem para o 3D em que foram identificadas (o mesmo móvel mais leve ou com cores continua valendo)
      if (opcoesEnvio.planejado) x.planejadoDe = res.url;
      if (opcoesEnvio.movel) x.movelDe = res.url;
      else if (x.movel) x.movelDe = opcoesEnvio.manterMedidas && (!x.movelDe || x.movelDe === modeloAntigo) ? res.url : '-';
      else if (x.planejado) x.planejadoDe = opcoesEnvio.manterMedidas && (!x.planejadoDe || x.planejadoDe === modeloAntigo) ? res.url : '-';
      if (x.pecas && x.pecas.length && x.pecasDe === modeloAntigo && opcoesEnvio.manterMedidas) x.pecasDe = res.url;
      // o arquivo já traz as peças identificadas: o Raio-X liga sozinho (o marceneiro pode revisar em “Editar peças”)
      var nomesArq = {}; (res.pecas || []).forEach(function (c) { nomesArq[c.nome.toLowerCase() + '|' + c.tipo] = 1; });
      var pecasAuto = Object.keys(nomesArq).length >= 2 && !(x.pecasDe === res.url && x.pecas && x.pecas.length);
      if (pecasAuto) { x.pecas = res.pecas; x.pecasDe = res.url; }
      var txtReducao = opcoesEnvio.reducao ? ' (ficou mais leve: ' + mb(opcoesEnvio.reducao.antes) + ' → ' + mb(opcoesEnvio.reducao.depois) + ')' : '';
      if (pecasAuto) txtReducao += ' · Raio-X ligado: o arquivo já veio com ' + Object.keys(nomesArq).length + ' peças identificadas';
      if (opcoesEnvio.manterMedidas) {   // mesmo móvel (só mudou a cor ou o peso): medidas e ajuste continuam como estavam
        abertoNoAdmin = x.id; renderAdmin();
        toast((opcoesEnvio.aviso || '3D atualizado. Toque em “Salvar alterações” para publicar.') + txtReducao);
        return;
      }
      var med = res.med, dim = x.dim;
      var estranho = Math.max(med.largura, med.altura, med.profundidade) > 1500 || Math.max(med.largura, med.altura, med.profundidade) < 2;
      var difere = ['largura', 'profundidade', 'altura'].some(function (k) { return Math.abs(med[k] - dim[k]) / Math.max(dim[k], 0.1) > 0.05; });
      var semMedidas = dim.largura <= 5 && dim.profundidade <= 5 && dim.altura <= 5;
      abertoNoAdmin = x.id;
      if (estranho) {
        renderAdmin();
        toast('3D enviado, mas ele mede ' + dimTexto(med) + ': deve estar em outra unidade. Preencha as medidas reais e toque em “Ajustar o 3D às medidas acima”.');
      } else if (semMedidas || !difere) {
        x.dim = med; renderAdmin();
        toast('3D enviado: ' + dimTexto(med) + txtReducao + '. Toque em “Salvar alterações” para publicar.');
      } else {
        confirmar('O arquivo 3D mede ' + dimTexto(med) + ', mas o cadastro diz ' + dimTexto(dim) + '. Usar as medidas do arquivo?', 'Usar as do arquivo').then(function (sim) {
          if (sim) x.dim = med;
          renderAdmin();
          toast(sim ? 'Medidas do arquivo aplicadas. Toque em “Salvar alterações”.' : 'Mantive as medidas do cadastro. Use “Ajustar o 3D às medidas acima” se o arquivo estiver errado.');
        });
      }
    }).catch(function (e) { toast(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); });
  }

  // 3D do produto: o arquivo real (da fábrica) ou gerado a partir de fotos
  function htmlProduto3dAdmin(x) {
    var arq = x.modelo ? x.modelo.split('/').pop().replace(/-[a-z0-9]{6,}(\.glb)$/, '$1') : '';
    return '<fieldset class="campo tams-admin modelo-admin"><legend>3D do produto</legend>' +
      '<p class="modelo-admin__estado' + (x.modelo ? ' ok' : '') + '">' + (x.modelo ? '✓ 3D pronto' + (arq ? ' <small>(' + esc(arq) + ')</small>' : '') : 'Sem 3D: o cliente ainda não consegue ver na casa dele.') + '</p>' +
      (servidor
        ? '<div class="linha-acoes">' +
            '<label class="btn btn--sec btn--p" style="cursor:pointer">' + ICONES.cubo + 'Enviar arquivo 3D (.glb ou .gltf)<input type="file" data-up3d hidden></label>' +
            '<button class="btn btn--contorno btn--p" type="button" data-gerar-3d>' + ICONES.camera + (x.modelo ? 'Refazer com fotos' : 'Criar com fotos') + '</button>' +
            (!ehAlimento(rascunho) ? '<button class="btn btn--sec btn--p" type="button" data-movel-ia>' + ICONES.camera + (x.movel && x.movelDe === x.modelo ? 'Editar móvel da foto' : 'Montar pela foto (IA)') + '</button>' : '') +
            (!ehAlimento(rascunho) ? '<button class="btn btn--sec btn--p" type="button" data-planejado>' + ICONES.cubo + (x.planejado ? 'Editar planejado' : 'Montar planejado (projeto)') + '</button>' : '') +
            (/^(api\/arquivo\/|assets\/)/.test(x.modelo) ? '<button class="btn btn--fantasma btn--p" type="button" data-reescalar>Ajustar o 3D às medidas acima</button>' : '') +
          '</div>' +
          (!ehAlimento(rascunho) ? '<small><strong>Armário, guarda-roupa, cômoda, rack ou estante?</strong> Use “Montar pela foto (IA)”: envie a foto do anúncio e a IA monta o 3D com as medidas, portas, gavetas, cores e Raio-X.</small>' : '') +
          (!ehAlimento(rascunho) ? '<small><strong>Móvel planejado</strong> (cozinha, guarda-roupa, painel, banheiro, escritório)? Use “Montar planejado”: envie a planta e a IA monta o 3D com as medidas do projeto, ou comece de um modelo pronto.</small>' : '') +
          '<small><strong>Melhor opção:</strong> peça à fábrica o arquivo 3D do móvel (muitas têm, para projetistas). Envie em <strong>.glb</strong>; se vier em outro formato (.skp, .obj, .fbx), dá para converter de graça no Blender. Sem arquivo? “Criar com fotos” gera o 3D a partir de 4 a 8 fotos do móvel.</small>'
        : '<small>Envio de arquivo 3D disponível no site publicado.</small>') +
      (servidor && x.modelo && !ehAlimento(rascunho) ? '<div class="pontos-admin"><div><strong>Cores do móvel</strong><small>Escolha a parte (tecido, portas…) e as cores. O cliente troca no catálogo e vê na câmera.</small></div>' +
        '<button class="btn btn--sec btn--p" type="button" data-cores-movel>' + ICONES.mais + 'Escolher cores</button></div>' : '') +
      (servidor && x.modelo && !ehAlimento(rascunho) ? htmlPontosAdmin(x) : '') +
      (servidor && x.modelo && !ehAlimento(rascunho) ? htmlRaioXAdmin(x) : '') +
      (servidor ? htmlFormaAdmin(x) : '') +
      '<details class="conta-det"><summary>Endereço do arquivo (avançado)</summary>' +
        campo('Arquivo 3D', '<input data-f="modelo" maxlength="300" placeholder="https://… .glb" value="' + esc(x.modelo) + '">', 'Caminho ou link https de um arquivo .glb em metros.') +
        '<label class="checar"><input type="checkbox" data-f="ilustrativo"' + (x.ilustrativo ? ' checked' : '') + '> Mostrar selo “Modelo ilustrativo” (use se o 3D não for fiel ao produto)</label>' +
      '</details></fieldset>';
  }

  // ----- Móvel pela foto (IA): a IA lê o anúncio e o site monta o 3D com medidas, cores e Raio-X -----
  var movelIA = null, moduloMovel = null;
  function carregarMovel() { if (!moduloMovel) moduloMovel = import(new URL('movel.mjs', document.baseURI).href); return moduloMovel; }
  function abrirMovelIA(x) {
    carregarMovel().then(function (M) {
      var d = x.dim || {};
      movelIA = { x: x, M: M, ficha: x.movel && (!x.movelDe || x.movelDe === x.modelo) ? M.normalizarMovel(x.movel) : null, arquivos: [], descricao: '', erro: '', medidasIA: true,
        med: { largura: d.largura >= 10 ? d.largura : '', altura: d.altura >= 10 ? d.altura : '', profundidade: d.profundidade >= 10 ? d.profundidade : '' } };   // medida padrão de produto novo não conta
      renderMovelIA();
      abrirDialogo($('#dlg-movel'));
      if (movelIA.ficha) gerarPreviaMovel();
    }).catch(function () { toast('Não foi possível abrir. Recarregue a página.'); });
  }
  function renderMovelIA() {
    var m = movelIA, M = m.M, corpo = $('#movel-corpo'), rod = $('#movel-rodape');
    if (m.lendo) {
      corpo.innerHTML = '<div class="carregando plan-lendo"><div class="spinner" aria-hidden="true"></div><p><strong>A IA está olhando a foto…</strong><br>Leva até 1 minuto. Não feche esta tela.</p></div>';
      rod.innerHTML = ''; return;
    }
    var nMed = function (k, rot, v) { return campo(rot, '<input type="number" inputmode="decimal" min="10" max="400" step="0.5" data-mi-med="' + k + '" value="' + esc(v) + '">'); };
    if (!m.ficha) {
      corpo.innerHTML =
        '<p class="mini" style="margin-top:0">Para <strong>armário, guarda-roupa, cômoda, rack, estante, sapateira, balcão e cristaleira</strong>. Envie a foto do anúncio (pode ser a arte com as medidas e as cores) e a IA monta o 3D com portas, gavetas, cores e Raio-X.</p>' +
        '<section class="plan-bloco"><h3>Foto do móvel</h3>' +
          '<p class="mini">Até 4 fotos: de frente, aberto ou sem portas, e a das cores disponíveis.</p>' +
          '<label class="btn btn--sec btn--p" style="cursor:pointer">' + ICONES.mais + 'Escolher fotos<input type="file" id="movel-arq" multiple accept="image/jpeg,image/png,image/webp" hidden></label>' +
          (m.arquivos.length ? '<ul class="plan-arqs">' + m.arquivos.map(function (a, i) { return '<li><span>' + esc(a.nome) + '</span><button class="link-remover" type="button" data-mi-tirar="' + i + '">Tirar</button></li>'; }).join('') + '</ul>' : '') +
          '<div class="campos campos--3">' + nMed('largura', 'Largura (cm)', m.med.largura) + nMed('altura', 'Altura (cm)', m.med.altura) + nMed('profundidade', 'Profundidade (cm)', m.med.profundidade) + '</div>' +
          '<small>Se o anúncio mostra as medidas, a IA lê sozinha. Se você preencher, valem as suas.</small>' +
          campo('Detalhes (opcional)', '<textarea id="movel-desc" rows="2" maxlength="1000" placeholder="Ex.: 6 portas, 4 gavetas, puxador de alumínio, cores Cinza, Tabaco, Barcelona e Nogal">' + esc(m.descricao) + '</textarea>') +
          (m.erro ? '<div class="ar-indisp" role="alert"><strong>Não deu certo</strong>' + esc(m.erro) + '</div>' : '') +
          '<button class="btn btn--primario btn--bloco" type="button" id="movel-ler"' + (m.arquivos.length ? '' : ' disabled') + '>Montar o 3D com IA</button>' +
        '</section>' +
        '<p class="mini">Sofá, poltrona ou mesa? Use “Criar com fotos”. Quer ver como funciona? <button class="link-remover" type="button" data-mi-acao="exemplo">Abrir um exemplo pronto</button></p>';
      rod.innerHTML = '';
      return;
    }
    var f = m.ficha, rol = corpo.scrollTop;
    var opc = function (lista_, atual) { return Object.keys(lista_).map(function (k) { return '<option value="' + k + '"' + (k === atual ? ' selected' : '') + '>' + esc(lista_[k]) + '</option>'; }).join(''); };
    var n = function (path, rot, v, min, max) { return campo(rot, '<input type="number" inputmode="decimal" min="' + min + '" max="' + max + '" step="0.5" data-mf="' + path + '" value="' + v + '">'); };
    var obs = (!m.medidasIA ? '• A IA estimou as medidas: confira e corrija abaixo.\n' : '') + (f.observacoes || '');
    corpo.innerHTML =
      '<div class="plan-palco"><model-viewer id="movel-mv" camera-controls touch-action="pan-y" loading="eager" interaction-prompt="none" environment-image="' + esc(ESTUDIO()) + '" tone-mapping="neutral" shadow-intensity="1" camera-orbit="-25deg 74deg auto" alt="Prévia do móvel"></model-viewer>' +
        '<span class="plan-medidas" id="movel-medidas">Montando…</span></div>' +
      (f.cores.length > 1 ? '<div class="movel-cores" role="group" aria-label="Ver na cor">' + f.cores.map(function (c, i) { return '<button type="button" data-mi-cor="' + esc(c.nome) + '" aria-pressed="' + (i === 0) + '"><i style="background:' + esc(c.hex) + '"></i>' + esc(c.nome) + '</button>'; }).join('') + '</div>' : '') +
      (obs.trim() ? '<div class="plan-obs"><strong>Confira com o anúncio:</strong><p>' + esc(obs.trim()).replace(/\n/g, '<br>') + '</p></div>' : '') +
      '<fieldset class="campo"><legend>Medidas e acabamento</legend>' +
        '<div class="campos campos--3">' + n('largura', 'Largura (cm)', f.largura, 20, 400) + n('altura', 'Altura (cm)', f.altura, 20, 300) + n('profundidade', 'Profundidade (cm)', f.profundidade, 15, 120) + '</div>' +
        '<div class="campos campos--3">' + campo('Nome', '<input data-mf="nome" maxlength="60" value="' + esc(f.nome) + '">') +
          campo('Material', '<input data-mf="material" maxlength="40" placeholder="MDF" value="' + esc(f.material) + '">') +
          campo('Base', '<select data-mf="base.tipo">' + opc(M.BASES, f.base.tipo) + '</select>') + '</div>' +
        '<div class="campos campos--3">' + (f.base.tipo !== 'nenhuma' ? n('base.altura', 'Altura da base (cm)', f.base.altura, 2, 40) : '') +
          campo('Puxador', '<select data-mf="puxador.tipo">' + opc(M.PUXADORES, f.puxador.tipo) + '</select>') +
          campo('Cor do puxador', '<input type="color" data-mf="puxador.hex" value="' + esc(f.puxador.hex.toLowerCase()) + '">') + '</div>' +
        '<div class="campos campos--3">' + campo('Cor da caixa', '<input data-mf="corpo.nome" maxlength="40" value="' + esc(f.corpo.nome) + '">') +
          campo('Tom', '<input type="color" data-mf="corpo.hex" value="' + esc(f.corpo.hex.toLowerCase()) + '">') +
          '<label class="checar movel-madeira"><input type="checkbox" data-mf="corpo.madeira"' + (f.corpo.madeira ? ' checked' : '') + '> Madeirado</label></div>' +
      '</fieldset>' +
      '<fieldset class="campo"><legend>Cores das portas e gavetas <small>o cliente escolhe</small></legend>' +
        f.cores.map(function (c, i) {
          return '<div class="movel-cor"><input data-mf="cores.' + i + '.nome" maxlength="30" aria-label="Nome da cor" value="' + esc(c.nome) + '">' +
            '<input type="color" data-mf="cores.' + i + '.hex" aria-label="Tom da cor ' + esc(c.nome) + '" value="' + esc(c.hex.toLowerCase()) + '">' +
            '<label class="checar"><input type="checkbox" data-mf="cores.' + i + '.madeira"' + (c.madeira ? ' checked' : '') + '> Madeirado</label>' +
            (f.cores.length > 1 ? '<button type="button" class="btn-mini btn-mini--rem" data-mi-acao="rem-cor" data-p="' + i + '" aria-label="Tirar a cor ' + esc(c.nome) + '">✕</button>' : '') + '</div>';
        }).join('') +
        (f.cores.length < 8 ? '<button class="btn btn--contorno btn--p" type="button" data-mi-acao="add-cor">' + ICONES.mais + 'Cor</button>' : '') +
      '</fieldset>' +
      f.secoes.map(function (s, i) { return htmlSecaoMovel(f, s, i); }).join('') +
      (f.secoes.length < 4 ? '<button class="btn btn--contorno btn--bloco" type="button" data-mi-acao="add-sec">' + ICONES.mais + 'Adicionar parte em cima</button>' : '');
    corpo.scrollTop = rol;
    rod.innerHTML = '<div class="linha-acoes plan-rod"><button class="btn btn--fantasma btn--p" type="button" data-mi-acao="recomecar">Ler outra foto</button>' +
      '<button class="btn btn--primario" type="button" id="movel-usar">Usar este 3D no produto</button></div>';
  }
  function htmlSecaoMovel(f, s, i) {
    var M = movelIA.M, ns = f.secoes.length;
    var onde = ns === 1 ? 'o móvel inteiro' : i === 0 ? 'embaixo' : i === ns - 1 ? 'em cima' : 'no meio';
    var opc = function (lista_, atual) { return Object.keys(lista_).map(function (k) { return '<option value="' + k + '"' + (k === atual ? ' selected' : '') + '>' + esc(lista_[k]) + '</option>'; }).join(''); };
    var p = 'secoes.' + i;
    return '<details class="plan-trecho" open><summary><strong>Parte ' + (i + 1) + '</strong> <small>' + onde + ' · ' + s.colunas.length + (s.colunas.length === 1 ? ' coluna' : ' colunas') + '</small></summary>' +
      '<div class="campos campos--3">' +
        campo('Altura (proporção, cm)', '<input type="number" inputmode="decimal" min="1" max="300" step="0.5" data-mf="' + p + '.altura" value="' + s.altura + '">') +
        campo('Profundidade (cm, 0 = igual)', '<input type="number" inputmode="decimal" min="0" max="120" step="0.5" data-mf="' + p + '.profundidade" value="' + s.profundidade + '">') +
        '<label class="checar movel-madeira"><input type="checkbox" data-mf="' + p + '.tampo"' + (s.tampo ? ' checked' : '') + '> Tampo em cima</label>' +
      '</div>' +
      '<p class="plan-sub">Colunas, da esquerda para a direita</p><ol class="movel-cols">' +
      s.colunas.map(function (c, j) {
        var pc = p + '.colunas.' + j;
        return '<li class="movel-col"><div class="movel-col__cab"><strong>Coluna ' + (j + 1) + '</strong>' +
            '<label class="movel-larg">Largura <input type="number" inputmode="decimal" min="1" max="400" step="0.5" data-mf="' + pc + '.largura" value="' + c.largura + '"> cm</label>' +
            (s.colunas.length > 1 ? '<button type="button" class="btn-mini btn-mini--rem" data-mi-acao="rem-col" data-p="' + i + '.' + j + '" aria-label="Remover coluna ' + (j + 1) + '">✕</button>' : '') + '</div>' +
          '<p class="mini">De baixo para cima:</p><ol class="movel-itens">' +
          c.itens.map(function (it, k) {
            var pi = pc + '.itens.' + k, porta = /^(porta|porta_vidro|espelho)$/.test(it.tipo);
            return '<li><select data-mf="' + pi + '.tipo" aria-label="Tipo">' + opc(M.TIPOS_ITEM, it.tipo) + '</select>' +
              '<label>Alt. <input type="number" inputmode="decimal" min="1" max="300" step="0.5" data-mf="' + pi + '.altura" value="' + it.altura + '"></label>' +
              (it.tipo !== 'gaveta' ? '<label>Prat. <input type="number" min="0" max="8" data-mf="' + pi + '.prateleiras" value="' + it.prateleiras + '"></label>' : '') +
              (it.tipo === 'nicho' ? '<label>Div. <input type="number" min="0" max="6" data-mf="' + pi + '.divisoes" value="' + it.divisoes + '"></label>' : '') +
              (porta ? '<label>Dobradiça <select data-mf="' + pi + '.dobradica">' + opc(M.DOBRADICAS, it.dobradica) + '</select></label>' : '') +
              (c.itens.length > 1 ? '<button type="button" class="btn-mini btn-mini--rem" data-mi-acao="rem-item" data-p="' + i + '.' + j + '.' + k + '" aria-label="Remover">✕</button>' : '') + '</li>';
          }).join('') + '</ol>' +
          '<button class="btn btn--fantasma btn--p" type="button" data-mi-acao="add-item" data-p="' + i + '.' + j + '">' + ICONES.mais + 'Item em cima</button></li>';
      }).join('') + '</ol>' +
      '<div class="linha-acoes"><button class="btn btn--sec btn--p" type="button" data-mi-acao="add-col" data-p="' + i + '">' + ICONES.mais + 'Coluna</button>' +
        (ns > 1 ? '<button class="btn btn--fantasma btn--p" type="button" data-mi-acao="rem-sec" data-p="' + i + '">Remover parte</button>' : '') + '</div>' +
    '</details>';
  }
  var movelTimer = null, movelGeracao = 0;
  function gerarPreviaMovel() {
    clearTimeout(movelTimer);
    movelTimer = setTimeout(function () {
      var m = movelIA; if (!m || !m.ficha) return;
      var minha = ++movelGeracao;
      m.M.montarMovel(m.ficha).then(function (r) {
        if (movelIA !== m || minha !== movelGeracao) return;
        m.res = r;
        if (m.url) URL.revokeObjectURL(m.url);
        m.url = URL.createObjectURL(new Blob([r.glb], { type: 'model/gltf-binary' }));
        var mv = $('#movel-mv'); if (mv) { var cor = mv.variantName; mv.src = m.url; if (cor) mv.addEventListener('load', function () { try { mv.variantName = cor; } catch (e) { /* ok */ } }, { once: true }); }
        var md = $('#movel-medidas');
        if (md) md.textContent = num(r.medidas.largura) + ' × ' + num(r.medidas.profundidade) + ' × ' + num(r.medidas.altura) + ' cm · ' + r.resumo.portas + ' portas · ' + r.resumo.gavetas + ' gavetas';
      }).catch(function (e) { var md = $('#movel-medidas'); if (md) md.textContent = e.message || 'Erro ao montar'; if (movelIA === m) m.res = null; });
    }, 300);
  }
  function lerMedEntrada() { $$('#movel-corpo [data-mi-med]').forEach(function (el) { movelIA.med[el.getAttribute('data-mi-med')] = el.value; }); }
  function lerMovelComIA() {
    var m = movelIA;
    m.descricao = ($('#movel-desc') || {}).value || m.descricao; lerMedEntrada();
    var med = {}, temMed = ['largura', 'altura', 'profundidade'].every(function (k) { var v = Number(String(m.med[k]).replace(',', '.')); med[k] = v; return v >= 10; });
    m.lendo = true; m.erro = ''; renderMovelIA();
    fetch(comLoja('api/movel-ia'), {
      method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, credenciais()),
      body: JSON.stringify({ arquivos: m.arquivos.map(function (a) { return { tipo: a.tipo, dados: a.dados }; }), descricao: m.descricao, medidas: temMed ? med : null })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        if (movelIA !== m) return;
        m.lendo = false;
        if (!j.ficha) { m.erro = j.aviso || 'A IA não encontrou um móvel de caixa nessa foto.'; renderMovelIA(); return; }
        m.ficha = m.M.normalizarMovel(j.ficha); m.medidasIA = !!j.medidasNaImagem; renderMovelIA(); gerarPreviaMovel();
      })
      .catch(function (e) { if (movelIA !== m) return; m.lendo = false; m.erro = e.message; renderMovelIA(); });
  }
  function caminho(obj, path) { var ks = path.split('.'), o = obj; for (var i = 0; i < ks.length - 1; i++) o = o[ks[i]]; return { o: o, k: ks[ks.length - 1] }; }
  function lerCampoMovel(el, rerender) {
    var m = movelIA, c = caminho(m.ficha, el.getAttribute('data-mf'));
    c.o[c.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (Number(String(el.value).replace(',', '.')) || 0) : el.value;
    m.ficha = m.M.normalizarMovel(m.ficha);
    if (rerender) renderMovelIA();
    gerarPreviaMovel();
  }
  function acaoMovel(a, p) {
    var m = movelIA, f = m.ficha, ix = String(p || '').split('.').map(Number);
    if (a === 'add-cor') f.cores.push({ nome: 'Cor ' + (f.cores.length + 1), hex: '#8A8D90', madeira: false });
    else if (a === 'rem-cor') f.cores.splice(ix[0], 1);
    else if (a === 'add-sec') f.secoes.push({ altura: 60, profundidade: 0, tampo: false, colunas: [{ largura: 50, itens: [{ tipo: 'porta', altura: 60, prateleiras: 1, divisoes: 0, dobradica: 'auto' }] }] });
    else if (a === 'rem-sec') f.secoes.splice(ix[0], 1);
    else if (a === 'add-col') f.secoes[ix[0]].colunas.push({ largura: 40, itens: [{ tipo: 'nicho', altura: 40, prateleiras: 0, divisoes: 0, dobradica: 'auto' }] });
    else if (a === 'rem-col') f.secoes[ix[0]].colunas.splice(ix[1], 1);
    else if (a === 'add-item') f.secoes[ix[0]].colunas[ix[1]].itens.push({ tipo: 'nicho', altura: 30, prateleiras: 0, divisoes: 0, dobradica: 'auto' });
    else if (a === 'rem-item') f.secoes[ix[0]].colunas[ix[1]].itens.splice(ix[2], 1);
    m.ficha = m.M.normalizarMovel(f);
    renderMovelIA(); gerarPreviaMovel();
  }
  function usarMovelIA() {
    var m = movelIA, x = m.x, botao = $('#movel-usar');
    if (botao) botao.disabled = true;
    var ir = function (r) {
      x.movel = r.ficha;
      x.dim = { largura: r.medidas.largura, profundidade: r.medidas.profundidade, altura: r.medidas.altura };
      if (!x.nome) x.nome = r.ficha.nome;
      var arq = new File([r.glb], slug(x.nome || 'movel') + '.glb', { type: 'model/gltf-binary' });
      fecharDialogo($('#dlg-movel'));
      enviar3d(arq, x, null, { movel: true });
    };
    m.M.montarMovel(m.ficha).then(ir).catch(function (e) { if (botao) botao.disabled = false; toast(e.message || 'Não deu para montar o 3D.'); });
  }
  document.addEventListener('change', function (e) {
    if (!movelIA || !e.target.closest('#dlg-movel')) return;
    if (e.target.id === 'movel-arq') {
      var lista_ = Array.prototype.slice.call(e.target.files || []).slice(0, 4 - movelIA.arquivos.length);
      movelIA.descricao = ($('#movel-desc') || {}).value || movelIA.descricao; lerMedEntrada();
      Promise.all(lista_.map(lerArquivoPlan)).then(function (r) {
        movelIA.arquivos = movelIA.arquivos.concat(r).slice(0, 4); movelIA.erro = ''; renderMovelIA();
      }).catch(function (err) { toast(err.message); });
      return;
    }
    if (e.target.matches('[data-mf]') && movelIA.ficha) lerCampoMovel(e.target, e.target.tagName === 'SELECT' || e.target.type === 'checkbox' || e.target.type === 'number');
  });
  document.addEventListener('input', function (e) {
    if (!movelIA || !movelIA.ficha || !e.target.closest('#dlg-movel')) return;
    if (e.target.matches('input[type="color"][data-mf]')) lerCampoMovel(e.target, false);
  });
  document.addEventListener('click', function (e) {
    if (!movelIA || !e.target.closest('#dlg-movel')) return;
    var m = movelIA;
    if (e.target.closest('#movel-ler')) { lerMovelComIA(); return; }
    if (e.target.closest('#movel-usar')) { usarMovelIA(); return; }
    var t = e.target.closest('[data-mi-tirar]');
    if (t) { lerMedEntrada(); m.descricao = ($('#movel-desc') || {}).value || m.descricao; m.arquivos.splice(Number(t.getAttribute('data-mi-tirar')), 1); renderMovelIA(); return; }
    var c = e.target.closest('[data-mi-cor]');
    if (c) {
      var mv = $('#movel-mv'); if (mv) mv.variantName = c.getAttribute('data-mi-cor');
      $$('#dlg-movel [data-mi-cor]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === c)); });
      return;
    }
    var a = e.target.closest('[data-mi-acao]');
    if (!a) return;
    var ac = a.getAttribute('data-mi-acao');
    if (ac === 'exemplo') { m.ficha = m.M.normalizarMovel(m.M.EXEMPLO_MOVEL); m.medidasIA = true; renderMovelIA(); gerarPreviaMovel(); }
    else if (ac === 'recomecar') { m.ficha = null; m.erro = ''; m.res = null; renderMovelIA(); }
    else acaoMovel(ac, a.getAttribute('data-p'));
  });
  $('#dlg-movel').addEventListener('close', function () { if (movelIA && movelIA.url) URL.revokeObjectURL(movelIA.url); movelIA = null; });

  // ----- Raio-X no painel: o marceneiro dá nome às partes do 3D (sem programar) -----
  function htmlRaioXAdmin(x) {
    var plan = x.planejado && (!x.planejadoDe || x.planejadoDe === x.modelo);
    var nomes = {}; pecasValidas(x).forEach(function (c) { nomes[c.nome.toLowerCase() + '|' + c.tipo] = 1; });
    var n = Object.keys(nomes).length, velhas = x.pecas && x.pecas.length && x.pecasDe !== x.modelo;
    var txt = plan ? 'Automático: o montador de planejados já separa portas, gavetas, prateleiras e laterais.'
      : n ? n + ' peças no Raio-X. O cliente vê o móvel por dentro.'
        : velhas ? 'O 3D mudou: identifique as peças de novo.'
          : x.pecas && x.pecas.length ? 'Dê nome a pelo menos 2 peças para o Raio-X aparecer.'
            : 'Dê nome às peças do 3D (portas, gavetas, prateleiras…) para o cliente ver o móvel por dentro.';
    return '<div class="pontos-admin"><div><strong>Raio-X</strong><small>' + txt + '</small></div>' +
      '<button class="btn btn--sec btn--p" type="button" data-pecas>' + ICONES.cubo + (plan ? 'Ver o Raio-X' : n ? 'Editar peças' : 'Identificar peças') + '</button></div>';
  }
  var pecasEd = null;
  var PALPITES_PECA = [[/porta|door/i, 'porta'], [/gaveta|drawer/i, 'gaveta'], [/prateleira|shelf|shelve/i, 'prateleira'], [/lateral|side/i, 'lateral'],
    [/divis|divider|partition/i, 'divisoria'], [/fundo|back/i, 'fundo'], [/tampo|countertop|\btop\b/i, 'tampo'], [/puxador|handle|knob/i, 'puxador'],
    [/rodap|plinth|kick/i, 'rodape'], [/dobradi|hinge|corredi|slide|rail/i, 'ferragem'], [/almofada|assento|encosto|cushion|seat|fabric|tecido/i, 'estofado'], [/frente|front/i, 'frente']];
  function palpitePeca(nomeNo) {
    var t = 'outra'; PALPITES_PECA.some(function (r) { if (r[0].test(nomeNo)) { t = r[1]; return true; } return false; });
    var nome = String(nomeNo || '').replace(/[._-]+/g, ' ').replace(/\b\d{3}\b/g, '').replace(/\s+/g, ' ').trim();
    return { tipo: t, nome: nome && !/^(mesh|object|objeto|node|cube|cubo|group|grupo)\s*\d*$/i.test(nome) ? nome.charAt(0).toUpperCase() + nome.slice(1) : '' };
  }
  function abrirPecas(x) {
    if (SEM_3D) { toast('Este aparelho não mostra 3D. Abra o painel num computador ou celular com 3D.'); return; }
    var plan = !!(x.planejado && (!x.planejadoDe || x.planejadoDe === x.modelo));
    pecasEd = { x: x, plan: plan, lista: (x.pecasDe === x.modelo ? x.pecas || [] : []).map(function (c) { return Object.assign({}, c); }), partes: [], sel: null, api: null, vez: 0, modo: plan ? 'testar' : 'identificar' };
    $('#pecas-corpo').innerHTML =
      '<p class="mini" id="pecas-ajuda" style="margin-top:0"></p>' +
      '<div class="pecas-palco" id="pecas-palco"><div class="pecas-estado" id="pecas-estado"><div class="spinner" aria-hidden="true"></div>Carregando o 3D…</div></div>' +
      '<div class="pecas-teste" id="pecas-teste" hidden>' +
        '<label>Transparência <input type="range" id="pecas-transp" min="0" max="100" value="75"></label>' +
        '<button type="button" class="btn btn--contorno btn--p" data-pecas-t="explodir" aria-pressed="false">Explodir</button>' +
        '<button type="button" class="btn btn--contorno btn--p" data-pecas-t="abrir" aria-pressed="false">Abrir portas e gavetas</button>' +
        '<p class="mini" id="pecas-sel" aria-live="polite"></p></div>' +
      '<div id="pecas-form"></div><div class="pecas-lista" id="pecas-lista"></div>';
    $('#pecas-rodape').innerHTML = plan ? '<button class="btn btn--primario btn--bloco" type="button" data-fechar>Fechar</button>'
      : '<div class="painel__rodape--admin"><button class="btn btn--sec" type="button" data-pecas-modo>Testar</button><button class="btn btn--primario" type="button" data-pecas-pronto>Pronto</button></div>';
    abrirDialogo($('#dlg-pecas'));
    montarCenaPecas();
  }
  function montarCenaPecas() {
    var ed = pecasEd, vez = ++ed.vez, palcoP = $('#pecas-palco'), est = $('#pecas-estado');
    if (ed.api) { ed.api.destruir(); ed.api = null; }
    $$('.rx-camada', palcoP).forEach(function (r) { r.remove(); });
    var camada = document.createElement('div'); camada.className = 'rx-camada ver'; palcoP.insertBefore(camada, est);
    est.hidden = false;
    $('#pecas-teste').hidden = true; $('#pecas-form').innerHTML = ''; $('#pecas-lista').innerHTML = '';
    var testar = ed.modo === 'testar';
    $('#pecas-ajuda').innerHTML = ed.plan ? 'Este é o Raio-X que o cliente vê. As peças vêm do projeto do planejado, com as medidas dele. Toque numa peça para ver o nome.'
      : testar ? 'Teste como o cliente vai ver. Toque nas peças, explodir e abrir portas.'
        : 'Toque numa parte do 3D (ou na lista) e dê um nome. <strong>Só as partes com nome aparecem no Raio-X.</strong> Partes com o mesmo nome viram uma peça só (ex.: frente e caixa da gaveta).';
    var mod = $('[data-pecas-modo]'); if (mod) mod.textContent = testar ? 'Identificar' : 'Testar';
    var lista = lerPecas(ed.lista);
    var fonte = ed.plan ? { tipo: 'planejado', ficha: ed.x.planejado } : { tipo: 'glb', url: urlModelo(ed.x.modelo), pecas: lista };
    if (testar && !ed.plan) {
      var nomes = {}; lista.forEach(function (c) { nomes[c.nome.toLowerCase() + '|' + c.tipo] = 1; });
      if (Object.keys(nomes).length < 2) { est.innerHTML = 'Dê nome a pelo menos 2 peças para testar o Raio-X.'; camada.remove(); return; }
    }
    import(new URL('raiox.mjs', document.baseURI).href).then(function (R) {
      return R.criarRaioX(camada, fonte, { editor: !testar, aoSelecionar: aoSelecionarPecaEd, aoMudar: function () {} });
    }).then(function (api) {
      if (vez !== ed.vez || pecasEd !== ed || !$('#dlg-pecas').open) { api.destruir(); return; }
      ed.api = api; est.hidden = true;
      if (testar) {
        $('#pecas-teste').hidden = false;
        api.transparencia(Number($('#pecas-transp').value) / 100);
        $('[data-pecas-t="explodir"]').hidden = !api.temExplosao; $('[data-pecas-t="abrir"]').hidden = !api.temMovimento;
        $('#pecas-sel').textContent = api.pecas.length + ' peças' + (api.temExplosao ? '' : ' · vista explodida: escolha “Vista explodida” em alguma peça') + (api.temMovimento ? '' : ' · nenhuma porta ou gaveta com movimento');
        return;
      }
      ed.partes = api.pecas.map(function (p) { return { no: p.nos[0], nomeNo: p.nomeNo, tri: p.tri }; });
      if (ed.partes.length < 2) {
        est.hidden = false;
        est.innerHTML = '<strong>Este 3D é uma peça única</strong>Acontece com 3D criado por fotos ou exportado “juntando” os objetos. Para o Raio-X, peça à fábrica o arquivo com as peças separadas (no SketchUp ou Blender, exporte sem juntar os objetos).';
        api.destruir(); ed.api = null; camada.remove();
        var bm = $('[data-pecas-modo]'); if (bm) bm.hidden = true;
        return;
      }
      renderListaPecas();
    }).catch(function (e) { console.warn('[peças]', e); est.innerHTML = 'Não consegui abrir este 3D aqui. ' + esc(e && e.message || ''); });
  }
  function e2Visivel(el) { var r = el.getBoundingClientRect(); return !(r.top >= 0 && r.bottom <= innerHeight); }
  function confPeca(no) { return pecasEd.lista.filter(function (c) { return c.no === no; })[0] || null; }
  function renderListaPecas() {
    var ed = pecasEd, max = 300;
    var com = ed.lista.filter(function (c) { return c.nome; }).length;
    $('#pecas-lista').innerHTML = '<p class="pecas-lista__cab">' + ed.partes.length + ' partes no arquivo · ' + com + ' com nome</p>' +
      ed.partes.slice(0, max).map(function (pt) {
        var c = confPeca(pt.no);
        return '<button type="button" class="pecas-item' + (c ? ' ok' : '') + (ed.sel === pt.no ? ' sel' : '') + '" data-pc-no="' + pt.no + '">' +
          '<span>Parte ' + (pt.no + 1) + '<small>' + esc(pt.nomeNo || 'sem nome no arquivo') + '</small></span>' +
          '<em>' + (c ? esc(c.nome) + ' · ' + esc(TIPOS_PECA[c.tipo]) : '—') + '</em></button>';
      }).join('') + (ed.partes.length > max ? '<p class="mini">Mostrando as primeiras ' + max + ' partes. Toque no 3D para escolher as outras.</p>' : '');
  }
  function aoSelecionarPecaEd(info) {
    var ed = pecasEd; if (!ed) return;
    if (ed.modo === 'testar') {
      $('#pecas-sel').textContent = info ? info.nome + ' · ' + info.tipoNome + (info.material ? ' · ' + info.material : '') + (info.mov ? ' (toque de novo em “Abrir portas e gavetas” para testar)' : '') : '';
      return;
    }
    ed.sel = info && info.nos ? info.nos[0] : null;
    renderFormPeca();
    $$('#pecas-lista .pecas-item').forEach(function (b) { b.classList.toggle('sel', Number(b.getAttribute('data-pc-no')) === ed.sel); });
    var it = $('#pecas-lista .pecas-item.sel'); if (it && e2Visivel(it)) it.scrollIntoView({ block: 'nearest' });
  }
  function renderFormPeca() {
    var ed = pecasEd, f = $('#pecas-form');
    if (ed.sel == null) { f.innerHTML = ''; return; }
    var pt = ed.partes.filter(function (p) { return p.no === ed.sel; })[0] || { no: ed.sel, nomeNo: '' };
    var c = confPeca(ed.sel), pal = palpitePeca(pt.nomeNo);
    var v = c || { nome: '', tipo: pal.tipo, desc: '', material: '', destacar: true, mov: '', explodir: '' };
    var op = function (obj, sel) { return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + esc(obj[k]) + '</option>'; }).join(''); };
    f.innerHTML = '<fieldset class="campo pecas-form"><legend>Parte ' + (pt.no + 1) + (pt.nomeNo ? ' <small>(' + esc(pt.nomeNo) + ')</small>' : '') + '</legend>' +
      campo('Nome da peça', '<input data-pc="nome" maxlength="60" placeholder="' + esc(pal.nome || 'ex.: Porta esquerda') + '" value="' + esc(v.nome) + '">', 'Deixe vazio para não aparecer no Raio-X.') +
      '<div class="pecas-form__2">' + campo('Tipo', '<select data-pc="tipo">' + op(TIPOS_PECA, v.tipo) + '</select>') +
        campo('Material', '<input data-pc="material" maxlength="80" placeholder="ex.: MDF branco 18 mm" value="' + esc(v.material) + '">') + '</div>' +
      campo('Descrição (opcional)', '<textarea data-pc="desc" maxlength="240" rows="2" placeholder="ex.: corrediça telescópica com amortecedor">' + esc(v.desc) + '</textarea>') +
      '<div class="pecas-form__2">' + campo('Abre / fecha', '<select data-pc="mov">' + op(MOV_PECA, v.mov) + '</select>') +
        campo('Vista explodida', '<select data-pc="explodir">' + op(EXPLODIR_PECA, v.explodir) + '</select>') + '</div>' +
      '<label class="checar"><input type="checkbox" data-pc="destacar"' + (v.destacar !== false ? ' checked' : '') + '> O cliente pode tocar e destacar esta peça</label>' +
      (pal.nome && !c ? '<button type="button" class="btn btn--fantasma btn--p" data-pc-sugestao>Usar o nome “' + esc(pal.nome) + '”</button>' : '') +
      '</fieldset>';
  }
  function salvarFormPeca(sugestao) {
    var ed = pecasEd; if (!ed || ed.sel == null) return;
    var g = function (k) { var el = $('#pecas-form [data-pc="' + k + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };
    var pt = ed.partes.filter(function (p) { return p.no === ed.sel; })[0] || { nomeNo: '' };
    var nome = String(sugestao || g('nome')).trim().slice(0, 60);
    ed.lista = ed.lista.filter(function (c) { return c.no !== ed.sel; });
    if (nome) ed.lista.push({ no: ed.sel, nomeNo: pt.nomeNo || '', nome: nome, tipo: g('tipo') || 'outra', desc: String(g('desc')).slice(0, 240), material: String(g('material')).slice(0, 80), destacar: g('destacar') !== false, mov: g('mov') || '', explodir: g('explodir') || '' });
    ed.lista.sort(function (a, b) { return a.no - b.no; });
    // só atualiza a linha desta parte (redesenhar a lista inteira engoliria o próximo toque)
    var c = confPeca(ed.sel), linha = $('#pecas-lista [data-pc-no="' + ed.sel + '"]');
    if (linha) { linha.classList.toggle('ok', !!c); linha.querySelector('em').textContent = c ? c.nome + ' · ' + TIPOS_PECA[c.tipo] : '—'; }
    var sug = $('#pecas-form [data-pc-sugestao]'); if (sug && c) sug.hidden = true;
    var cab = $('#pecas-lista .pecas-lista__cab'); if (cab) cab.textContent = ed.partes.length + ' partes no arquivo · ' + ed.lista.length + ' com nome';
  }
  document.addEventListener('input', function (e) {
    if (e.target.closest('#pecas-form [data-pc]')) salvarFormPeca();
    if (e.target.id === 'pecas-transp' && pecasEd && pecasEd.api) pecasEd.api.transparencia(Number(e.target.value) / 100);
  });
  document.addEventListener('change', function (e) { if (e.target.closest('#pecas-form [data-pc]')) salvarFormPeca(); });
  document.addEventListener('click', function (e) {
    if (!pecasEd || !e.target.closest('#dlg-pecas')) return;
    var ed = pecasEd;
    var it = e.target.closest('[data-pc-no]');
    if (it && ed.api) { ed.api.selecionar('n' + it.getAttribute('data-pc-no')); return; }
    if (e.target.closest('[data-pc-sugestao]')) { var inp = $('#pecas-form [data-pc="nome"]'); inp.value = inp.placeholder; salvarFormPeca(); renderFormPeca(); return; }
    var t = e.target.closest('[data-pecas-t]');
    if (t && ed.api) {
      var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', String(on));
      if (t.getAttribute('data-pecas-t') === 'explodir') ed.api.explodir(on ? 1 : 0); else ed.api.abrirTudo(on);
      return;
    }
    if (e.target.closest('[data-pecas-modo]')) { ed.modo = ed.modo === 'testar' ? 'identificar' : 'testar'; ed.sel = null; montarCenaPecas(); return; }
    if (e.target.closest('[data-pecas-pronto]')) {
      var x = ed.x, lista = lerPecas(ed.lista), nomes = {};
      lista.forEach(function (c) { nomes[c.nome.toLowerCase() + '|' + c.tipo] = 1; });
      x.pecas = lista; x.pecasDe = x.modelo;
      fecharDialogo($('#dlg-pecas'));
      abertoNoAdmin = x.id; renderAdmin();
      toast(Object.keys(nomes).length >= 2 ? 'Peças guardadas. Toque em “Salvar alterações” para publicar o Raio-X.' : lista.length ? 'Guardei, mas o Raio-X só aparece com pelo menos 2 peças com nome.' : 'Nenhuma peça com nome: o Raio-X fica desligado para este móvel.');
    }
  });
  $('#dlg-pecas').addEventListener('close', function () { if (pecasEd) { pecasEd.vez++; if (pecasEd.api) pecasEd.api.destruir(); pecasEd = null; } });

  // ----- Pontos de informação no 3D (ex.: "tecido impermeável", "gaveta com corrediça") -----
  function htmlPontosAdmin(x) {
    var validos = x.pontos && x.pontos.length && x.pontosDe === x.modelo;
    var velhos = x.pontos && x.pontos.length && !validos;
    return '<div class="pontos-admin"><div><strong>Pontos de informação</strong>' +
      '<small>' + (validos ? x.pontos.length + (x.pontos.length === 1 ? ' ponto marcado' : ' pontos marcados') + ' no 3D.'
        : velhos ? 'O 3D mudou: marque os pontos de novo.' : 'Marque detalhes no 3D, como “tecido impermeável” ou “gaveta com amortecedor”.') + '</small></div>' +
      '<button class="btn btn--sec btn--p" type="button" data-pontos>' + ICONES.mais + (validos ? 'Editar pontos' : 'Marcar pontos') + '</button></div>';
  }
  var pontosEd = null; // { x: produto, lista, pend: { p, n } }
  function abrirPontos(x) {
    pontosEd = { x: x, lista: x.pontosDe === x.modelo ? (x.pontos || []).map(function (p) { return { p: p.p.slice(), n: p.n.slice(), t: p.t }; }) : [], pend: null };
    $('#pontos-corpo').innerHTML =
      '<p class="mini" style="margin-top:0">Gire o 3D e <strong>toque no lugar do móvel</strong> onde quer colocar a informação. Até 8 pontos.</p>' +
      '<div class="pontos-palco"><model-viewer id="pontos-mv" src="' + esc(urlModelo(x.modelo)) + '" camera-controls touch-action="none" loading="eager" interaction-prompt="none" ' +
        'environment-image="' + esc(ESTUDIO()) + '" tone-mapping="neutral" shadow-intensity="1" camera-orbit="28deg 72deg auto" alt="3D de ' + esc(x.nome) + '"></model-viewer></div>' +
      '<div id="pontos-form"></div><ol class="pontos-lista" id="pontos-lista"></ol>';
    $('#pontos-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="pontos-pronto">Pronto</button>';
    abrirDialogo($('#dlg-pontos'));
    var mv = $('#pontos-mv'), ini = null;
    mv.addEventListener('pointerdown', function (e) { ini = { x: e.clientX, y: e.clientY }; });
    mv.addEventListener('pointerup', function (e) {
      if (!ini || Math.hypot(e.clientX - ini.x, e.clientY - ini.y) > 6 || e.target.closest('.info-ponto')) { ini = null; return; }
      ini = null;
      var r = mv.positionAndNormalFromPoint ? mv.positionAndNormalFromPoint(e.clientX, e.clientY) : null;
      if (!r) { toast('Toque em cima do móvel.'); return; }
      if (pontosEd.lista.length >= 8) { toast('Máximo de 8 pontos. Remova um para marcar outro.'); return; }
      var arr = function (v) { return [v.x, v.y, v.z].map(function (n) { return Math.round(n * 1e4) / 1e4; }); };
      pontosEd.pend = { p: arr(r.position), n: arr(r.normal) };
      renderPontos(true);
    });
    renderPontos();
  }
  function renderPontos(focar) {
    var ed = pontosEd, mv = $('#pontos-mv');
    if (!ed || !mv) return;
    $$('.info-ponto', mv).forEach(function (b) { b.remove(); });
    var todos = ed.lista.concat(ed.pend ? [Object.assign({ t: '', novo: true }, ed.pend)] : []);
    todos.forEach(function (pt, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.slot = 'hotspot-ed' + i + '-' + Date.now();
      b.className = 'info-ponto' + (pt.novo ? ' info-ponto--novo' : '');
      b.setAttribute('data-position', pt.p.join('m ') + 'm'); b.setAttribute('data-normal', pt.n.join('m ') + 'm');
      b.setAttribute('aria-label', 'Ponto ' + (i + 1));
      b.innerHTML = '<span class="info-ponto__n">' + (pt.novo ? '+' : i + 1) + '</span>';
      mv.appendChild(b);
    });
    $('#pontos-form').innerHTML = ed.pend
      ? '<div class="pontos-novo">' + campo('O que destacar neste ponto?', '<input id="pontos-texto" maxlength="80" placeholder="Ex.: Tecido impermeável">') +
        '<div class="linha-acoes"><button class="btn btn--primario btn--p" type="button" id="pontos-add">Adicionar ponto</button>' +
        '<button class="btn btn--fantasma btn--p" type="button" id="pontos-cancelar">Cancelar</button></div></div>'
      : '';
    $('#pontos-lista').innerHTML = ed.lista.length
      ? ed.lista.map(function (pt, i) { return '<li><span>' + esc(pt.t) + '</span><button class="link-remover" type="button" data-pontos-rem="' + i + '">Remover</button></li>'; }).join('')
      : '<li class="pontos-lista__vazia">Nenhum ponto ainda.</li>';
    if (focar && $('#pontos-texto')) $('#pontos-texto').focus();
  }
  document.addEventListener('click', function (e) {
    if (!pontosEd || !e.target.closest('#dlg-pontos')) return;
    if (e.target.closest('#pontos-add')) {
      var t = $('#pontos-texto').value.trim().slice(0, 80);
      if (!t) { toast('Escreva o texto do ponto.'); $('#pontos-texto').focus(); return; }
      pontosEd.lista.push({ p: pontosEd.pend.p, n: pontosEd.pend.n, t: t }); pontosEd.pend = null; renderPontos();
      return;
    }
    if (e.target.closest('#pontos-cancelar')) { pontosEd.pend = null; renderPontos(); return; }
    var rem = e.target.closest('[data-pontos-rem]');
    if (rem) { pontosEd.lista.splice(Number(rem.getAttribute('data-pontos-rem')), 1); renderPontos(); return; }
    if (e.target.closest('#pontos-pronto')) {
      var x = pontosEd.x;
      x.pontos = pontosEd.lista; x.pontosDe = x.pontos.length ? x.modelo : '';
      pontosEd = null;
      fecharDialogo($('#dlg-pontos'));
      abertoNoAdmin = x.id; renderAdmin();
      toast(x.pontos.length ? x.pontos.length + (x.pontos.length === 1 ? ' ponto pronto' : ' pontos prontos') + '. Toque em “Salvar alterações” para publicar.' : 'Pontos removidos. Toque em “Salvar alterações”.');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'pontos-texto') { e.preventDefault(); var b = $('#pontos-add'); if (b) b.click(); }
  });

  // ----- Cores do móvel: pinta a parte escolhida e grava as cores dentro do 3D -----
  var cm = null;   // { x, M (módulo), analise, parte (índice), variantes: [{nome, hex}], sens, sel, previa }
  function abrirCoresMovel(x) {
    cm = { x: x, carregando: true, variantes: [], sens: 50, sel: 0, parte: 0 };
    $('#cores-corpo').innerHTML = '<div class="carregando plan-lendo"><div class="spinner" aria-hidden="true"></div><p>Analisando as cores do 3D…</p></div>';
    $('#cores-rodape').innerHTML = '';
    abrirDialogo($('#dlg-cores'));
    Promise.all([import(new URL('cores.mjs', document.baseURI).href), fetch(urlModelo(x.modelo)).then(function (r) { if (!r.ok) throw new Error('Não deu para baixar o 3D.'); return r.arrayBuffer(); })])
      .then(function (r) { cm.M = r[0]; return r[0].analisarCores(new Uint8Array(r[1])); })
      .then(function (an) {
        if (!cm) return;
        cm.analise = an; cm.carregando = false;
        if (!an.partes.length) { $('#cores-corpo').innerHTML = '<p>Não encontrei cores para trocar neste 3D.</p>'; return; }
        var p0 = an.partes[0];
        cm.variantes = [{ nome: corMaisProxima(p0.rgb), hex: null }];
        renderCoresMovel();
      })
      .catch(function (e) { if (cm) $('#cores-corpo').innerHTML = '<p>' + esc(e.message || 'Erro ao abrir o 3D.') + '</p>'; });
  }
  function corMaisProxima(rgb) {
    var melhor = 'Original', md = Infinity;
    Object.keys(PALETA_CORES).forEach(function (n) {
      var c = cm.M.hexParaRgb(PALETA_CORES[n]), d = Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2]);
      if (d < md) { md = d; melhor = n; }
    });
    return md < 60 ? melhor : 'Original';
  }
  function renderCoresMovel() {
    var an = cm.analise, P = PALETA_CORES, usadas = cm.variantes.map(function (v) { return v.nome; });
    var parte = an.partes[cm.parte];
    $('#cores-corpo').innerHTML =
      '<div class="plan-palco"><model-viewer id="cores-mv" src="' + esc(urlModelo(cm.x.modelo)) + '" camera-controls touch-action="pan-y" loading="eager" interaction-prompt="none" environment-image="' + esc(ESTUDIO()) + '" tone-mapping="neutral" shadow-intensity="1" alt="Prévia das cores"></model-viewer>' +
        '<span class="plan-medidas" id="cores-status">' + esc(cm.variantes[cm.sel].nome) + '</span></div>' +
      '<h3 class="cores-h">1. Toque na parte que muda de cor</h3>' +
      '<div class="cores-partes">' + an.partes.map(function (p, i) {
        return '<button type="button" class="cores-parte" data-cm-parte="' + i + '" aria-pressed="' + (i === cm.parte) + '"><i style="background:' + cm.M.rgbParaHex(p.rgb) + '"></i>' + Math.max(1, Math.round(p.pct * 100)) + '%</button>';
      }).join('') + '</div>' +
      (parte.tipo === 'textura' ? '<label class="campo"><span>Quanto da cor pegar <small>(aumente se sobrar mancha da cor antiga; diminua se pintar o que não devia)</small></span><input type="range" id="cm-sens" min="0" max="100" value="' + cm.sens + '"></label>' : '') +
      '<h3 class="cores-h">2. Cores para o cliente escolher</h3>' +
      '<div class="cores-lista">' + cm.variantes.map(function (v, i) {
        return '<span class="cores-chip' + (i === cm.sel ? ' sel' : '') + '"><button type="button" data-cm-ver="' + i + '"><i style="background:' + (v.hex || cm.M.rgbParaHex(parte.rgb)) + '"></i>' + esc(v.nome) + (i ? '' : ' <small>(atual)</small>') + '</button>' +
          (i ? '<button type="button" class="cores-tirar" data-cm-tirar="' + i + '" aria-label="Tirar ' + esc(v.nome) + '">✕</button>' : '') + '</span>';
      }).join('') + '</div>' +
      campo('Nome da cor atual', '<input id="cm-nome0" maxlength="24" value="' + esc(cm.variantes[0].nome) + '">') +
      '<p class="plan-sub">Toque para adicionar</p><div class="cores-paleta">' + Object.keys(P).filter(function (n) { return usadas.indexOf(n) < 0; }).map(function (n) {
        return '<button type="button" class="cores-add" data-cm-add="' + esc(n) + '"><i style="background:' + P[n] + '"></i>' + esc(n) + '</button>';
      }).join('') + '</div>' +
      '<div class="cores-outra"><input type="color" id="cm-hex" value="#7a5c46" aria-label="Escolher outra cor"><input id="cm-outra" maxlength="24" placeholder="Nome (ex.: Veludo vinho)"><button class="btn btn--contorno btn--p" type="button" id="cm-add-outra">Adicionar</button></div>';
    $('#cores-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="cm-salvar"' + (cm.variantes.length < 2 ? ' disabled' : '') + '>' +
      (cm.variantes.length < 2 ? 'Adicione pelo menos 1 cor' : 'Salvar ' + cm.variantes.length + ' cores no 3D') + '</button>';
    var mv = $('#cores-mv');
    mv.addEventListener('load', function () { previaCor(); }, { once: true });
  }
  var cmTimer = null;
  function previaCor() {
    clearTimeout(cmTimer);
    cmTimer = setTimeout(function () {
      var mv = $('#cores-mv'); if (!mv || !mv.model || !cm) return;
      var parte = cm.analise.partes[cm.parte], v = cm.variantes[cm.sel], st = $('#cores-status');
      var alvos = parte.materiais.map(function (i) { return mv.model.materials[i]; }).filter(Boolean);
      if (st) st.textContent = v.nome;
      if (parte.tipo === 'lisa') {
        var lin = v.hex ? cm.M.corLisa(v.hex) : null;
        alvos.forEach(function (m) {
          var orig = cm.analise.json.materials[parte.materiais[0]].pbrMetallicRoughness || {}, fc = orig.baseColorFactor || [1, 1, 1, 1];
          m.pbrMetallicRoughness.setBaseColorFactor(lin ? [lin[0], lin[1], lin[2], fc[3] == null ? 1 : fc[3]] : fc);
        });
        return;
      }
      var cv = v.hex ? cm.M.recolorir(parte.canvas, parte.lab, v.hex, cm.sens, 1024) : parte.canvas;
      var orig = cm.analise.json.materials[parte.materiais[0]], ex = orig.extensions || {};
      mv.createTexture(cv.toDataURL('image/jpeg', 0.85)).then(function (t) {
        alvos.forEach(function (m) {
          m.pbrMetallicRoughness.baseColorTexture.setTexture(t);
          var fc = (orig.pbrMetallicRoughness || {}).baseColorFactor || [1, 1, 1, 1];
          m.pbrMetallicRoughness.setBaseColorFactor([1, 1, 1, fc[3]]);   // a cor base já vai na textura
          if (ex.KHR_materials_sheen && m.sheen && typeof m.sheen.setSheenColorFactor === 'function') {   // veludo na cor escolhida
            var lin = v.hex ? cm.M.corLisa(v.hex).map(function (c) { return Math.min(1, c * 0.8 + 0.04); }) : ex.KHR_materials_sheen.sheenColorFactor || [0, 0, 0];
            m.sheen.setSheenColorFactor(lin);
          }
          if (ex.KHR_materials_specular && m.specular && typeof m.specular.setSpecularColorFactor === 'function') m.specular.setSpecularColorFactor(v.hex ? [1, 1, 1] : ex.KHR_materials_specular.specularColorFactor || [1, 1, 1]);
        });
      });
    }, 120);
  }
  function salvarCoresMovel(b) {
    var x = cm.x, parte = cm.analise.partes[cm.parte];
    var nome0 = ($('#cm-nome0') || {}).value; if (nome0) cm.variantes[0].nome = nome0.trim().slice(0, 24) || 'Original';
    b.disabled = true; b.textContent = 'Pintando as cores… (pode levar alguns segundos)';
    setTimeout(function () {
      var tam0 = cm.analise.bin.length, lado = tam0 > 12e6 ? 1024 : 2048;
      cm.M.gravarCores(cm.analise, parte, cm.variantes, cm.sens, lado).then(function (glb) {
        if (glb.length > 24 * 1024 * 1024) throw new Error('Com tantas cores o 3D passaria de 25 MB. Tire algumas cores e tente de novo.');
        var arq = new File([glb], slug(x.nome || 'movel') + '-cores.glb', { type: 'model/gltf-binary' });
        var n = cm.variantes.length;
        fecharDialogo($('#dlg-cores')); cm = null;
        enviar3d(arq, x, null, { manterMedidas: true, aviso: n + ' cores gravadas no 3D. Toque em “Salvar alterações” para publicar.' });
      }).catch(function (e) { toast(e.message || 'Não deu para salvar as cores.'); b.disabled = false; b.textContent = 'Tentar de novo'; });
    }, 50);
  }
  document.addEventListener('click', function (e) {
    if (!cm || cm.carregando || !e.target.closest('#dlg-cores')) return;
    var b;
    if ((b = e.target.closest('[data-cm-parte]'))) {
      cm.parte = Number(b.getAttribute('data-cm-parte')); cm.variantes[0].nome = corMaisProxima(cm.analise.partes[cm.parte].rgb); cm.sel = 0;
      var mv0 = $('#cores-mv'); renderCoresMovel(); return;
    }
    if ((b = e.target.closest('[data-cm-ver]'))) { cm.sel = Number(b.getAttribute('data-cm-ver')); $$('#dlg-cores .cores-chip').forEach(function (c, i) { c.classList.toggle('sel', i === cm.sel); }); previaCor(); return; }
    if ((b = e.target.closest('[data-cm-tirar]'))) { cm.variantes.splice(Number(b.getAttribute('data-cm-tirar')), 1); cm.sel = 0; renderCoresMovel(); return; }
    if ((b = e.target.closest('[data-cm-add]'))) {
      if (cm.variantes.length >= 10) { toast('Máximo de 10 cores.'); return; }
      var n = b.getAttribute('data-cm-add'); cm.variantes.push({ nome: n, hex: PALETA_CORES[n] }); cm.sel = cm.variantes.length - 1; renderCoresMovel(); return;
    }
    if (e.target.closest('#cm-add-outra')) {
      var nome = $('#cm-outra').value.trim().slice(0, 24);
      if (!nome) { toast('Dê um nome para a cor.'); $('#cm-outra').focus(); return; }
      if (cm.variantes.some(function (v) { return v.nome.toLowerCase() === nome.toLowerCase(); })) { toast('Já existe uma cor com esse nome.'); return; }
      if (cm.variantes.length >= 10) { toast('Máximo de 10 cores.'); return; }
      cm.variantes.push({ nome: nome, hex: $('#cm-hex').value }); cm.sel = cm.variantes.length - 1; renderCoresMovel(); return;
    }
    if ((b = e.target.closest('#cm-salvar'))) salvarCoresMovel(b);
  });
  document.addEventListener('input', function (e) {
    if (cm && e.target.id === 'cm-sens') { cm.sens = Number(e.target.value); if (cm.sel === 0 && cm.variantes.length > 1) { cm.sel = cm.variantes.length - 1; $$('#dlg-cores .cores-chip').forEach(function (c, i) { c.classList.toggle('sel', i === cm.sel); }); } previaCor(); }
  });

  // ----- Montador de planejados: a "ficha" (trechos e módulos com medidas) vira um 3D leve e fiel -----
  var plan = null;   // { x, P (módulo), ficha, glb, medidas, url, arquivos, descricao, lendo, erro }
  var moduloPlan = null;
  function carregarPlanejado() { if (!moduloPlan) moduloPlan = import(new URL('planejado.mjs', document.baseURI).href); return moduloPlan; }
  function abrirPlanejado(x) {
    carregarPlanejado().then(function (P) {
      plan = { x: x, P: P, ficha: x.planejado ? P.normalizarFicha(x.planejado) : null, arquivos: [], descricao: '' };
      renderPlanejado();
      abrirDialogo($('#dlg-planejado'));
      if (plan.ficha) gerarPreviaPlan();
    }).catch(function () { toast('Não foi possível abrir o montador. Recarregue a página.'); });
  }
  function opcoes(lista, atual) {
    return Object.keys(lista).map(function (k) { return '<option value="' + k + '"' + (k === atual ? ' selected' : '') + '>' + esc(lista[k]) + '</option>'; }).join('');
  }
  function renderPlanejado() {
    var P = plan.P, corpo = $('#plan-corpo'), rod = $('#plan-rodape');
    if (plan.lendo) {
      corpo.innerHTML = '<div class="carregando plan-lendo"><div class="spinner" aria-hidden="true"></div><p><strong>A IA está lendo o projeto…</strong><br>Leva até 1 minuto. Não feche esta tela.</p></div>';
      rod.innerHTML = ''; return;
    }
    if (!plan.ficha) {
      corpo.innerHTML =
        '<p class="mini" style="margin-top:0">Monte o 3D do móvel planejado com as <strong>medidas do projeto</strong>. Fica leve e fiel, bem melhor que gerar por foto.</p>' +
        '<section class="plan-bloco"><h3>Ler o projeto com IA</h3>' +
          '<p class="mini">Envie a planta (PDF ou foto), as vistas com medidas e, se tiver, o render. Até 6 arquivos.</p>' +
          '<label class="btn btn--sec btn--p" style="cursor:pointer">' + ICONES.mais + 'Escolher arquivos<input type="file" id="plan-arq" multiple accept="application/pdf,image/jpeg,image/png,image/webp" hidden></label>' +
          (plan.arquivos.length ? '<ul class="plan-arqs">' + plan.arquivos.map(function (a, i) { return '<li><span>' + esc(a.nome) + '</span><button class="link-remover" type="button" data-plan-tirar="' + i + '">Tirar</button></li>'; }).join('') + '</ul>' : '') +
          campo('Descreva o móvel (opcional)', '<textarea id="plan-desc" rows="3" maxlength="1500" placeholder="Ex.: cozinha em L, portas cinza, tampo granito preto, aéreo com ripado e LED">' + esc(plan.descricao) + '</textarea>') +
          (plan.erro ? '<div class="ar-indisp" role="alert"><strong>Não deu certo</strong>' + esc(plan.erro) + '</div>' : '') +
          '<button class="btn btn--primario btn--bloco" type="button" id="plan-ler"' + (plan.arquivos.length ? '' : ' disabled') + '>Ler o projeto e montar o 3D</button>' +
        '</section>' +
        '<section class="plan-bloco"><h3>Ou comece de um modelo pronto</h3><p class="mini">Depois é só ajustar as medidas e as cores.</p><div class="plan-modelos">' +
          Object.keys(P.NOMES_MODELOS).map(function (k) { return '<button class="btn btn--contorno btn--p" type="button" data-plan-modelo="' + k + '">' + esc(P.NOMES_MODELOS[k]) + '</button>'; }).join('') +
        '</div></section>';
      rod.innerHTML = '';
      return;
    }
    var f = plan.ficha, rolagem = corpo.scrollTop;
    corpo.innerHTML =
      '<div class="plan-palco"><model-viewer id="plan-mv" camera-controls touch-action="pan-y" loading="eager" interaction-prompt="none" environment-image="' + esc(ESTUDIO()) + '" tone-mapping="neutral" shadow-intensity="1" camera-orbit="-25deg 68deg auto" alt="Prévia do móvel planejado"></model-viewer>' +
        '<span class="plan-medidas" id="plan-medidas">Montando…</span></div>' +
      (f.observacoes ? '<div class="plan-obs"><strong>Confira com o projeto:</strong><p>' + esc(f.observacoes).replace(/\n/g, '<br>') + '</p></div>' : '') +
      '<fieldset class="campo plan-acab"><legend>Acabamentos</legend><div class="campos campos--3">' +
        campo('Portas', '<select data-plan-acab="portas">' + opcoes(P.CORES, f.acabamentos.portas) + '</select>') +
        campo('Corpo e ripado', '<select data-plan-acab="corpo">' + opcoes(P.CORES, f.acabamentos.corpo) + '</select>') +
        campo('Tampo', '<select data-plan-acab="tampo">' + opcoes(P.TAMPOS, f.acabamentos.tampo) + '</select>') +
      '</div></fieldset>' +
      f.trechos.map(function (t, i) { return htmlTrechoPlan(t, i); }).join('') +
      '<button class="btn btn--contorno btn--bloco" type="button" data-plan-acao="add-trecho">' + ICONES.mais + 'Adicionar trecho (aéreo, outra parede, painel…)</button>';
    corpo.scrollTop = rolagem;
    rod.innerHTML = '<div class="linha-acoes plan-rod"><button class="btn btn--fantasma btn--p" type="button" data-plan-acao="recomecar">Recomeçar</button>' +
      '<button class="btn btn--primario" type="button" id="plan-usar">Usar este 3D no produto</button></div>';
  }
  function htmlTrechoPlan(t, i) {
    var P = plan.P, comTampo = t.tipo === 'baixo' || t.tipo === 'bancada', comp = P.comprimentoTrecho(t);
    var num_ = function (campo_, rot, v, min, max) { return campo(rot, '<input type="number" inputmode="decimal" min="' + min + '" max="' + max + '" step="0.5" data-pt="' + campo_ + '" value="' + v + '">'); };
    return '<details class="plan-trecho" data-t="' + i + '"' + (plan.abertos && plan.abertos[i] === false ? '' : ' open') + '><summary><strong>' + esc(t.nome) + '</strong> <small>' + esc(P.TIPOS_TRECHO[t.tipo].split(' (')[0]) + ' · ' + num(comp) + ' cm</small></summary>' +
      '<div class="campos campos--2">' +
        campo('Nome', '<input data-pt="nome" maxlength="40" value="' + esc(t.nome) + '">') +
        campo('Tipo', '<select data-pt="tipo">' + opcoes(P.TIPOS_TRECHO, t.tipo) + '</select>') +
        campo('Parede', '<select data-pt="parede">' + opcoes(P.PAREDES, t.parede) + '</select>') +
        num_('inicio', t.parede === 'A' ? 'Começa a (cm da ponta)' : 'Começa a (cm do canto)', t.inicio, 0, 2000) +
        num_('altura', t.tipo === 'baixo' && t.tampo ? 'Altura com tampo (cm)' : 'Altura (cm)', t.altura, 5, 320) +
        num_('profundidade', 'Profundidade (cm)', t.profundidade, 1, 120) +
        num_('elevacao', 'Distância do chão (cm)', t.elevacao, 0, 260) +
        (t.ripado ? num_('altura_ripado', 'Altura do ripado (cm)', t.altura_ripado, 5, 120) : '') +
      '</div>' +
      '<div class="plan-checks">' +
        (comTampo ? '<label class="checar"><input type="checkbox" data-pt="tampo"' + (t.tampo ? ' checked' : '') + '> Tampo</label>' : '') +
        (t.tipo !== 'painel' ? '<label class="checar"><input type="checkbox" data-pt="ripado"' + (t.ripado ? ' checked' : '') + '> Ripado em cima</label>' : '') +
        '<label class="checar"><input type="checkbox" data-pt="led"' + (t.led ? ' checked' : '') + '> LED</label>' +
      '</div>' +
      '<p class="plan-sub">Módulos, da esquerda para a direita' + (t.parede === 'A' ? '' : ' (a partir do canto)') + '</p>' +
      '<ol class="plan-mods">' + t.modulos.map(function (m, j) { return htmlModuloPlan(t, m, i, j); }).join('') + '</ol>' +
      '<div class="linha-acoes"><button class="btn btn--sec btn--p" type="button" data-plan-acao="add-mod">' + ICONES.mais + 'Módulo</button>' +
        '<button class="btn btn--fantasma btn--p" type="button" data-plan-acao="rem-trecho">Remover trecho</button></div>' +
    '</details>';
  }
  function htmlModuloPlan(t, m, i, j) {
    var P = plan.P, det = '';
    if (m.tipo === 'portas') det = campo('Portas', '<input type="number" min="1" max="6" data-pm="portas" value="' + (m.portas || 1) + '">');
    else if (m.tipo === 'gavetas') det = campo('Gavetas (cm, de cima p/ baixo)', '<input data-pm="gavetas" inputmode="decimal" placeholder="16, 15, 15, 30" value="' + esc(m.gavetas.join(', ')) + '">');
    else if (m.tipo === 'nicho') det = campo('Prateleiras', '<input type="number" min="0" max="10" data-pm="prateleiras" value="' + m.prateleiras + '">');
    else if (m.tipo === 'eletro') det = campo('Aparelho', '<select data-pm="aparelho">' + opcoes(P.APARELHOS, m.aparelho) + '</select>');
    var frente = /portas|gavetas|nicho/.test(m.tipo) ? campo('Frente', '<select data-pm="frente">' + opcoes(P.FRENTES, m.frente) + '</select>') : '';
    var tampo = (t.tipo === 'baixo' || t.tipo === 'bancada') && t.tampo && m.tipo !== 'vazio' ? campo('No tampo', '<select data-pm="item_tampo">' + opcoes(P.ITENS_TAMPO, m.item_tampo) + '</select>') : '';
    return '<li class="plan-mod" data-m="' + j + '"><div class="plan-mod__campos">' +
        campo('Tipo', '<select data-pm="tipo">' + opcoes(P.TIPOS_MODULO, m.tipo) + '</select>') +
        campo('Largura (cm)', '<input type="number" inputmode="decimal" min="5" max="400" step="0.5" data-pm="largura" value="' + m.largura + '">') +
        det + frente + tampo +
      '</div><div class="plan-mod__acoes">' +
        '<button type="button" class="btn-mini" data-plan-acao="sobe" aria-label="Mover para a esquerda"' + (j ? '' : ' disabled') + '>↑</button>' +
        '<button type="button" class="btn-mini" data-plan-acao="desce" aria-label="Mover para a direita"' + (j < t.modulos.length - 1 ? '' : ' disabled') + '>↓</button>' +
        '<button type="button" class="btn-mini" data-plan-acao="dup" aria-label="Duplicar módulo">⧉</button>' +
        '<button type="button" class="btn-mini btn-mini--rem" data-plan-acao="rem-mod" aria-label="Remover módulo">✕</button>' +
      '</div></li>';
  }
  var planTimer = null, planGeracao = 0;
  function gerarPreviaPlan() {
    clearTimeout(planTimer);
    planTimer = setTimeout(function () {
      if (!plan || !plan.ficha) return;
      var minha = ++planGeracao;
      plan.P.montarPlanejado(plan.ficha).then(function (r) {
        if (!plan || minha !== planGeracao) return;
        plan.glb = r.glb; plan.medidas = r.medidas;
        if (plan.url) URL.revokeObjectURL(plan.url);
        plan.url = URL.createObjectURL(new Blob([r.glb], { type: 'model/gltf-binary' }));
        var mv = $('#plan-mv'); if (mv) mv.src = plan.url;
        var md = $('#plan-medidas'); if (md) md.textContent = num(r.medidas.largura) + ' × ' + num(r.medidas.profundidade) + ' × ' + num(r.medidas.altura) + ' cm · ' + Math.max(1, Math.round(r.glb.length / 1024)) + ' KB';
      }).catch(function (e) { var md = $('#plan-medidas'); if (md) md.textContent = e.message || 'Erro ao montar'; plan.glb = null; });
    }, 350);
  }
  function lerArquivoPlan(arq) {
    if (arq.type === 'application/pdf') {
      if (arq.size > 6 * 1024 * 1024) return Promise.reject(new Error('O PDF “' + arq.name + '” passa de 6 MB. Envie só as páginas da planta.'));
      return new Promise(function (ok, falha) {
        var fr = new FileReader();
        fr.onload = function () { ok({ nome: arq.name, tipo: 'application/pdf', dados: String(fr.result).split(',')[1] }); };
        fr.onerror = function () { falha(new Error('Não deu para ler ' + arq.name)); };
        fr.readAsDataURL(arq);
      });
    }
    return new Promise(function (ok, falha) {   // imagem: reduz para no máximo 2000 px (as cotas continuam legíveis)
      var url = URL.createObjectURL(arq), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        ok({ nome: arq.name, tipo: 'image/jpeg', dados: c.toDataURL('image/jpeg', 0.88).split(',')[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('Não deu para abrir ' + arq.name)); };
      img.src = url;
    });
  }
  function lerProjetoIA() {
    plan.descricao = ($('#plan-desc') || {}).value || plan.descricao;
    plan.lendo = true; plan.erro = ''; renderPlanejado();
    fetch(comLoja('api/planejado'), {
      method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, credenciais()),
      body: JSON.stringify({ arquivos: plan.arquivos.map(function (a) { return { tipo: a.tipo, dados: a.dados }; }), descricao: plan.descricao })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        if (!plan) return;
        plan.lendo = false;
        if (!j.ficha || !j.ficha.trechos.length) { plan.erro = (j.ficha && j.ficha.observacoes) || 'A IA não encontrou um móvel nesses arquivos.'; renderPlanejado(); return; }
        plan.ficha = j.ficha; renderPlanejado(); gerarPreviaPlan();
      })
      .catch(function (e) { if (!plan) return; plan.lendo = false; plan.erro = e.message; renderPlanejado(); });
  }
  function lerCampoPlan(el) {
    var f = plan.ficha, td = el.closest('[data-t]'), t = td ? f.trechos[Number(td.getAttribute('data-t'))] : null;
    var v = el.type === 'checkbox' ? el.checked : el.value, estrutura = false;
    if (el.hasAttribute('data-plan-acab')) f.acabamentos[el.getAttribute('data-plan-acab')] = v;
    else if (el.hasAttribute('data-pm') && t) {
      var m = t.modulos[Number(el.closest('[data-m]').getAttribute('data-m'))], k = el.getAttribute('data-pm');
      if (k === 'gavetas') m.gavetas = String(v).split(/[;,\s]+/).map(function (n) { return Number(n.replace(',', '.')); }).filter(function (n) { return n > 0; });
      else if (k === 'largura' || k === 'portas' || k === 'prateleiras') m[k] = Number(String(v).replace(',', '.')) || 0;
      else { m[k] = v; estrutura = k === 'tipo'; }
      if (k === 'tipo') { if (v === 'portas' && !m.portas) m.portas = 1; if (v === 'gavetas' && !m.gavetas.length) m.gavetas = [20, 20, 20]; }
    } else if (el.hasAttribute('data-pt') && t) {
      var c = el.getAttribute('data-pt');
      if (el.type === 'number') t[c] = Number(String(v).replace(',', '.')) || 0; else t[c] = v;
      estrutura = c === 'tipo' || c === 'parede' || c === 'tampo' || c === 'ripado';
    }
    plan.ficha = plan.P.normalizarFicha(f);
    if (estrutura) renderPlanejado();
    else if (td) { var sm = td.querySelector('summary small'); if (sm) { var tt = plan.ficha.trechos[Number(td.getAttribute('data-t'))]; sm.textContent = plan.P.TIPOS_TRECHO[tt.tipo].split(' (')[0] + ' · ' + num(plan.P.comprimentoTrecho(tt)) + ' cm'; } }
    gerarPreviaPlan();
  }
  function usarPlanejado() {
    var x = plan.x, ir = function () {
      x.planejado = plan.ficha;
      x.dim = { largura: plan.medidas.largura, profundidade: plan.medidas.profundidade, altura: plan.medidas.altura };
      if (!x.nome) x.nome = plan.ficha.nome;
      var arq = new File([plan.glb], slug(x.nome || 'planejado') + '.glb', { type: 'model/gltf-binary' });
      fecharDialogo($('#dlg-planejado'));
      enviar3d(arq, x, null, { planejado: true });
    };
    if (plan.glb) ir();
    else plan.P.montarPlanejado(plan.ficha).then(function (r) { plan.glb = r.glb; plan.medidas = r.medidas; ir(); }).catch(function (e) { toast(e.message); });
  }
  document.addEventListener('change', function (e) {
    if (!plan || !e.target.closest('#dlg-planejado')) return;
    if (e.target.id === 'plan-arq') {
      var lista = Array.prototype.slice.call(e.target.files || []).slice(0, 6 - plan.arquivos.length);
      plan.descricao = ($('#plan-desc') || {}).value || plan.descricao;
      Promise.all(lista.map(lerArquivoPlan)).then(function (r) {
        plan.arquivos = plan.arquivos.concat(r).slice(0, 6); plan.erro = ''; renderPlanejado();
      }).catch(function (err) { toast(err.message); });
      return;
    }
    if (e.target.matches('[data-plan-acab],[data-pm],[data-pt]')) lerCampoPlan(e.target);
  });
  document.addEventListener('input', function (e) {
    if (!plan || !plan.ficha || !e.target.closest('#dlg-planejado')) return;
    if (e.target.matches('input[type="number"][data-pm],input[type="number"][data-pt],input[data-pm="gavetas"]')) lerCampoPlan(e.target);
  });
  document.addEventListener('click', function (e) {
    if (!plan || !e.target.closest('#dlg-planejado')) return;
    var mod = e.target.closest('[data-plan-modelo]');
    if (mod) { plan.ficha = plan.P.normalizarFicha(JSON.parse(JSON.stringify(plan.P.MODELOS_PRONTOS[mod.getAttribute('data-plan-modelo')]))); renderPlanejado(); gerarPreviaPlan(); return; }
    var tirar = e.target.closest('[data-plan-tirar]');
    if (tirar) { plan.descricao = ($('#plan-desc') || {}).value || plan.descricao; plan.arquivos.splice(Number(tirar.getAttribute('data-plan-tirar')), 1); renderPlanejado(); return; }
    if (e.target.closest('#plan-ler')) { lerProjetoIA(); return; }
    if (e.target.closest('#plan-usar')) { usarPlanejado(); return; }
    var ac = e.target.closest('[data-plan-acao]');
    if (!ac) return;
    var a = ac.getAttribute('data-plan-acao'), f = plan.ficha;
    if (a === 'recomecar') { confirmar('Recomeçar do zero? A ficha atual será descartada.', 'Recomeçar').then(function (ok) { if (ok) { plan.ficha = null; plan.glb = null; renderPlanejado(); } }); return; }
    if (a === 'add-trecho') { f.trechos.push({ nome: 'Trecho ' + (f.trechos.length + 1), tipo: 'aereo', parede: 'A', modulos: [{ tipo: 'portas', largura: 80, portas: 2 }] }); }
    var td = ac.closest('[data-t]'), ti = td ? Number(td.getAttribute('data-t')) : -1, t = f.trechos[ti];
    var li = ac.closest('[data-m]'), mi = li ? Number(li.getAttribute('data-m')) : -1;
    if (a === 'rem-trecho' && t) f.trechos.splice(ti, 1);
    if (a === 'add-mod' && t) t.modulos.push({ tipo: 'portas', largura: 60, portas: 1 });
    if (a === 'rem-mod' && t) t.modulos.splice(mi, 1);
    if (a === 'dup' && t) t.modulos.splice(mi + 1, 0, JSON.parse(JSON.stringify(t.modulos[mi])));
    if ((a === 'sobe' || a === 'desce') && t) { var d = a === 'sobe' ? -1 : 1, m = t.modulos.splice(mi, 1)[0]; t.modulos.splice(mi + d, 0, m); }
    plan.abertos = $$('#plan-corpo .plan-trecho').map(function (dt) { return dt.open; });
    plan.ficha = plan.P.normalizarFicha(f);
    renderPlanejado(); gerarPreviaPlan();
  });

  // ----- 3D por forma simples + foto (lata, balde, caixa, colchão…) -----
  var formaEstado = {}; // por produto: { img, recorte: {x,y,w,h} de 0 a 1, glb }
  function htmlFormaAdmin(x) {
    var st = formaEstado[x.id] || {};
    var forma = st.forma || 'cilindro';
    return '<details class="conta-det forma-det"' + (st.aberto ? ' open' : '') + ' data-forma-det><summary>Produto de formato simples? Montar com forma + foto</summary>' +
      '<p class="mini">Para latas, baldes, vasos, caixas e colchões: o 3D sai com a forma exata, nas medidas acima, e a foto vira o rótulo. Fica muito mais nítido que o “Criar com fotos”.</p>' +
      '<div class="campos campos--2">' +
        campo('Formato', '<select data-forma-tipo><option value="cilindro"' + (forma === 'cilindro' ? ' selected' : '') + '>Redondo (lata, balde, vaso)</option><option value="caixa"' + (forma === 'caixa' ? ' selected' : '') + '>Retangular (caixa, colchão)</option></select>') +
        campo('Cor do resto', '<input type="color" data-forma-cor value="' + (st.cor || '#d9d9d9') + '">') +
      '</div>' +
      '<label class="btn btn--sec btn--p" style="cursor:pointer">' + ICONES.camera + (st.img ? 'Trocar a foto' : 'Escolher a foto do rótulo / frente') + '<input type="file" accept="image/*" data-forma-foto hidden></label>' +
      (st.img ? '<p class="mini">Arraste o dedo sobre a foto para marcar só o rótulo (sem o fundo).</p><canvas class="forma-recorte" data-forma-canvas></canvas>' : '') +
      (forma === 'cilindro'
        ? '<label class="checar"><input type="checkbox" data-forma-metal' + (st.metal === false ? '' : ' checked') + '> Bordas e tampa de metal (lata de tinta)</label>' +
          '<label class="checar"><input type="checkbox" data-forma-dupla' + (st.dupla === false ? '' : ' checked') + '> Rótulo dos dois lados (frente e verso iguais)</label>'
        : '') +
      '<div class="linha-acoes"><button class="btn btn--contorno btn--p" type="button" data-forma-previa' + (st.img ? '' : ' disabled') + '>Ver prévia</button>' +
        '<button class="btn btn--primario btn--p" type="button" data-forma-usar' + (st.glb ? '' : ' disabled') + '>Usar este 3D</button></div>' +
      '<div class="forma-previa" data-forma-previa-alvo></div>' +
    '</details>';
  }
  function produtoDoAlvo(el) {
    var d = el.closest('details.prod');
    return d ? rascunho.produtos[Number(d.getAttribute('data-i'))] : null;
  }
  function desenharRecorte(canvas, st) {
    var img = st.img, larg = canvas.parentNode.clientWidth || 300;
    var esc = Math.min(larg / img.width, 320 / img.height);
    canvas.width = Math.round(img.width * esc); canvas.height = Math.round(img.height * esc);
    var c = canvas.getContext('2d'), r = st.recorte;
    c.drawImage(img, 0, 0, canvas.width, canvas.height);
    c.fillStyle = 'rgba(0,0,0,.55)';
    var X = r.x * canvas.width, Y = r.y * canvas.height, W = r.w * canvas.width, H = r.h * canvas.height;
    c.fillRect(0, 0, canvas.width, Y); c.fillRect(0, Y + H, canvas.width, canvas.height - Y - H);
    c.fillRect(0, Y, X, H); c.fillRect(X + W, Y, canvas.width - X - W, H);
    c.strokeStyle = '#FFD23F'; c.lineWidth = 2; c.strokeRect(X + 1, Y + 1, W - 2, H - 2);
  }
  function atualizarRecortes() {
    $$('#admin-corpo [data-forma-canvas]').forEach(function (cv) {
      var x = produtoDoAlvo(cv), st = x && formaEstado[x.id];
      if (st && st.img) desenharRecorte(cv, st);
    });
  }
  function corMedia(st) {
    var c = document.createElement('canvas'); c.width = c.height = 8;
    var g = c.getContext('2d'), r = st.recorte, im = st.img;
    g.drawImage(im, r.x * im.width, r.y * im.height, r.w * im.width, r.h * im.height, 0, 0, 8, 8);
    var d = g.getImageData(0, 0, 8, 8).data, s = [0, 0, 0];
    for (var i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; }
    return '#' + s.map(function (v) { return ('0' + Math.round(v / 64).toString(16)).slice(-2); }).join('');
  }
  function fotoRecortada(st) {
    var r = st.recorte, im = st.img, sw = r.w * im.width, sh = r.h * im.height;
    var k = Math.min(1, 1024 / Math.max(sw, sh));
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
    c.getContext('2d').drawImage(im, r.x * im.width, r.y * im.height, sw, sh, 0, 0, c.width, c.height);
    return new Promise(function (ok) { c.toBlob(function (b) { b.arrayBuffer().then(function (a) { ok(new Uint8Array(a)); }); }, 'image/jpeg', 0.88); });
  }
  function hexParaRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(function (v) { return Math.pow(v, 2.2); }); }
  function gerarPreviaForma(btn) {
    var x = produtoDoAlvo(btn), st = x && formaEstado[x.id];
    if (!st || !st.img) return;
    coletarAdmin(); x = produtoDoAlvo(btn);
    var d = x.dim;
    if (d.largura <= 5 && d.profundidade <= 5 && d.altura <= 5) { toast('Preencha as medidas reais do produto (em cm) antes de montar o 3D.'); return; }
    if (st.forma !== 'caixa' && Math.abs(d.profundidade - d.largura) > 0.05) { d.profundidade = d.largura; toast('Produto redondo: usei a largura como diâmetro (' + num(d.largura) + ' cm).'); }
    btn.disabled = true; btn.textContent = 'Montando…';
    Promise.all([carregarModuloGlb(), fotoRecortada(st)]).then(function (r) {
      var glb = r[0].gerarForma({ forma: st.forma || 'cilindro', medidasM: [d.largura / 100, d.altura / 100, d.profundidade / 100],
        imagem: r[1], cor: hexParaRgb(st.cor || '#d9d9d9'), bordasMetal: st.forma !== 'caixa' && st.metal !== false, repetir: st.forma !== 'caixa' && st.dupla !== false ? 2 : 1 });
      if (st.url) URL.revokeObjectURL(st.url);
      st.glb = glb; st.url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
      var det = btn.closest('[data-forma-det]');
      var alvoP = det.querySelector('[data-forma-previa-alvo]');
      alvoP.innerHTML = '<model-viewer loading="eager" interaction-prompt="none" src="' + st.url + '" camera-controls auto-rotate shadow-intensity="1" environment-image="' + ESTUDIO() + '" tone-mapping="neutral" camera-orbit="25deg 75deg auto" style="width:100%;height:280px;background:#f3eefa;border-radius:14px"></model-viewer>';
      alvoP.scrollIntoView({ block: 'center', behavior: reduzMovimento ? 'auto' : 'smooth' });
      det.querySelector('[data-forma-usar]').disabled = false;
      btn.disabled = false; btn.textContent = 'Ver prévia de novo';
    }).catch(function (e) { btn.disabled = false; btn.textContent = 'Ver prévia'; toast('Não consegui montar o 3D: ' + e.message); });
  }
  $('#admin-corpo').addEventListener('pointerdown', function (e) {
    var cv = e.target.closest('[data-forma-canvas]'); if (!cv) return;
    var x = produtoDoAlvo(cv), st = x && formaEstado[x.id]; if (!st) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    var b = cv.getBoundingClientRect(), x0 = (e.clientX - b.left) / b.width, y0 = (e.clientY - b.top) / b.height;
    function mover(ev) {
      var x1 = Math.max(0, Math.min(1, (ev.clientX - b.left) / b.width)), y1 = Math.max(0, Math.min(1, (ev.clientY - b.top) / b.height));
      var w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
      if (w > 0.03 && h > 0.03) { st.recorte = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: w, h: h }; desenharRecorte(cv, st); }
    }
    function soltar() {
      cv.removeEventListener('pointermove', mover); cv.removeEventListener('pointerup', soltar);
      st.cor = corMedia(st); var ci = cv.closest('[data-forma-det]').querySelector('[data-forma-cor]'); if (ci && !st.corManual) ci.value = st.cor;
      st.glb = null; var u = cv.closest('[data-forma-det]').querySelector('[data-forma-usar]'); if (u) u.disabled = true;
    }
    cv.addEventListener('pointermove', mover); cv.addEventListener('pointerup', soltar);
  });
  $('#admin-corpo').addEventListener('toggle', function (e) {
    if (!e.target.matches || !e.target.matches('[data-forma-det]')) return;
    var x = produtoDoAlvo(e.target); if (!x) return;
    (formaEstado[x.id] = formaEstado[x.id] || {}).aberto = e.target.open;
    if (e.target.open) atualizarRecortes();
  }, true);

  // Foto do produto: aparece no catálogo enquanto o 3D não fica pronto (a loja pode começar só com fotos)
  // Todas as fotos do móvel, na ordem: a principal e depois a galeria
  function fotosDoProduto(p) {
    var l = []; if (p.foto) l.push({ url: p.foto, tipo: 'perspectiva', principal: true });
    (p.galeria || []).forEach(function (f) { l.push(f); });
    return l;
  }
  function fotoPrincipal(p) { var f = fotosDoProduto(p)[0]; return f ? f.url : ''; }
  function htmlGaleriaAdmin(x) {
    if (!servidor || ehAlimento(rascunho)) return '';
    var g = x.galeria || [];
    return '<div class="campo gal-admin"><span class="foto-prod__rot">Mais fotos do móvel <small>(até 12: frente, lateral, traseira, detalhes, ambiente…)</small></span>' +
      '<div class="gal-admin__lista">' + g.map(function (f, k) {
        return '<figure class="gal-admin__item" data-gk="' + k + '"><img src="' + esc(urlModelo(f.url)) + '" alt="" loading="lazy">' +
          '<select data-gal-tipo aria-label="Tipo da foto">' + Object.keys(TIPOS_FOTO).map(function (t) { return '<option value="' + t + '"' + (t === f.tipo ? ' selected' : '') + '>' + TIPOS_FOTO[t] + '</option>'; }).join('') + '</select>' +
          '<div class="gal-admin__bts">' + (k > 0 ? '<button type="button" data-gal-mover="-1" aria-label="Mover para a esquerda">←</button>' : '') +
          '<button type="button" data-gal-tirar aria-label="Tirar foto">✕</button></div></figure>';
      }).join('') +
      (g.length < 12 ? '<label class="gal-admin__add">' + ICONES.camera + '<span>Pôr fotos</span><input type="file" accept="image/*" multiple data-up-galeria hidden></label>' : '') +
      '</div><small>As fotos “Ambiente” aparecem para o cliente com o aviso “imagem ilustrativa”.</small></div>';
  }
  function htmlFotoProdutoAdmin(x) {
    if (!servidor || ehAlimento(rascunho)) return '';
    return '<div class="campo foto-prod"><span class="foto-prod__rot">Foto do produto' + (x.modelo ? ' <small>(o catálogo mostra o 3D; a foto fica de reserva)</small>' : ' <small>(aparece no catálogo enquanto o 3D não fica pronto)</small>') + '</span>' +
      '<div class="foto-prod__linha">' +
        (x.foto ? '<img src="' + esc(urlModelo(x.foto)) + '" alt="">' : '<span class="foto-prod__vazia" aria-hidden="true">sem foto</span>') +
        '<label class="btn btn--sec btn--p" style="cursor:pointer">' + ICONES.camera + (x.foto ? 'Trocar foto' : 'Enviar foto') + '<input type="file" accept="image/*" data-up-foto hidden></label>' +
        (x.foto ? '<button class="btn btn--fantasma btn--p" type="button" data-tirar-foto>Remover</button>' : '') +
      '</div></div>';
  }

  function htmlProdutoAdmin(x, i) {
    var aberto = abertoNoAdmin === x.id;
    return '<details class="prod" data-i="' + i + '"' + (aberto ? ' open' : '') + '>' +
      '<summary><span>' + esc(x.nome || 'Novo produto') + (x.esgotado ? ' <span class="tag-esgotado">esgotado</span>' : '') + '<br><span class="prod__meta">' + esc(x.categoria) + ' · ' + brl(x.preco) + ' · ' + esc(dimTexto(x.dim)) + '</span></span></summary>' +
      '<div class="prod__corpo">' +
        '<label class="checar checar--alerta"><input type="checkbox" data-f="esgotado"' + (x.esgotado ? ' checked' : '') + '> <span><strong>Esgotado</strong> (acabou hoje: aparece no ' + termo(rascunho) + ', mas não dá para pedir)</span></label>' +
        campo('Nome', '<input data-f="nome" required maxlength="60" value="' + esc(x.nome) + '">') +
        '<div class="campos campos--2">' +
          campo('Preço (R$)', '<input data-f="preco" inputmode="decimal" value="' + esc(x.preco.toFixed(2).replace('.', ',')) + '">') +
          campo('Categoria', '<select data-f="categoria">' + rascunho.categorias.map(function (c) {
            return '<option' + (c === x.categoria ? ' selected' : '') + '>' + c + '</option>';
          }).join('') + '</select>') +
        '</div>' +
        (ehAlimento(rascunho) ? '' : campo('Preço antes da promoção (R$)', '<input data-f="precoDe" inputmode="decimal" placeholder="Só se estiver em oferta" value="' + (x.precoDe ? esc(x.precoDe.toFixed(2).replace('.', ',')) : '') + '">', 'Aparece riscado ao lado do preço, com o selo “Oferta”. Deixe vazio quando acabar a promoção.')) +
        campo('Descrição', '<textarea data-f="descricao" maxlength="240">' + esc(x.descricao) + '</textarea>') +
        (ehAlimento(rascunho)
          ? campo('Ingredientes', '<textarea data-f="ingredientes" maxlength="600" placeholder="Ex.: farinha de trigo, frango, requeijão, cebola">' + esc(x.ingredientes) + '</textarea>') +
            '<fieldset class="campo alerg-admin"><legend>Contém (alérgicos)</legend><div class="linha-acoes">' +
              ALERGENOS.map(function (a) {
                return '<label class="checar"><input type="checkbox" data-alerg="' + esc(a) + '"' + (x.alergenos.indexOf(a) > -1 ? ' checked' : '') + '>' + esc(a) + '</label>';
              }).join('') +
            '</div></fieldset>'
          : campo('Composição / materiais', '<textarea data-f="ingredientes" maxlength="600" placeholder="Ex.: madeira maciça, tecido linho, pés de metal">' + esc(x.ingredientes) + '</textarea>') +
            campo('Acabamentos', '<textarea data-f="acabamentos" maxlength="400" placeholder="Ex.: laca fosca, puxadores em cobre, fita de borda 2 mm">' + esc(x.acabamentos || '') + '</textarea>')) +
        '<div class="campos campos--3">' +
          campo('Largura (cm)', '<input data-f="largura" type="number" min="0.1" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.largura + '">') +
          campo('Profund. (cm)', '<input data-f="profundidade" type="number" min="0.1" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.profundidade + '">') +
          campo('Altura (cm)', '<input data-f="altura" type="number" min="0.1" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.altura + '">') +
        '</div>' +
        htmlFotoProdutoAdmin(x) +
        htmlGaleriaAdmin(x) +
        htmlProduto3dAdmin(x) +
        '<fieldset class="campo tams-admin"><legend>' + (ehAlimento(rascunho) ? 'Tamanhos (opcional)' : 'Versões: cor, tamanho ou modelo (opcional)') + '</legend>' +
          '<small>' + (ehAlimento(rascunho) ? 'Ex.: pequeno e grande. Cada tamanho tem preço e medidas próprios.'
            : 'O mesmo móvel em outras opções. Ex.: sofá cinza e azul, ou 2 e 3 lugares. Cada versão tem nome, preço, medidas e pode ter o seu próprio 3D; sem 3D próprio, usa o 3D principal ajustado às medidas.') + '</small>' +
          (ehAlimento(rascunho) ? '' : campo('Nome da versão principal (a do 3D e do preço acima)', '<input data-f="versao" maxlength="30" placeholder="Ex.: Cinza, 3 lugares… (se vazio: Original)" value="' + esc(x.versao || '') + '">')) +
          x.tamanhos.map(function (t, ti) {
            return '<div class="tam-linha" data-ti="' + ti + '">' +
              '<div class="campos campos--2">' +
                campo('Nome', '<input data-t="nome" maxlength="30" value="' + esc(t.nome) + '">') +
                campo('Preço (R$)', '<input data-t="preco" inputmode="decimal" value="' + esc(t.preco.toFixed(2).replace('.', ',')) + '">') +
              '</div>' +
              '<div class="campos campos--3">' +
                campo('Larg. (cm)', '<input data-t="largura" type="number" min="0.1" step="0.1" inputmode="decimal" value="' + t.dim.largura + '">') +
                campo('Prof. (cm)', '<input data-t="profundidade" type="number" min="0.1" step="0.1" inputmode="decimal" value="' + t.dim.profundidade + '">') +
                campo('Alt. (cm)', '<input data-t="altura" type="number" min="0.1" step="0.1" inputmode="decimal" value="' + t.dim.altura + '">') +
              '</div>' +
              '<input type="hidden" data-t="modelo" value="' + esc(t.modelo) + '">' +
              (servidor && !ehAlimento(rascunho)
                ? '<div class="tam-3d"><span class="modelo-admin__estado' + (t.modelo ? ' ok' : '') + '">' + (t.modelo ? '✓ Esta versão tem o próprio 3D' : 'Usa o 3D principal (ajustado às medidas)') + '</span>' +
                  '<div class="linha-acoes">' +
                    '<label class="btn btn--sec btn--p" style="cursor:pointer">' + ICONES.cubo + 'Enviar 3D (.glb)<input type="file" data-tam-up3d hidden></label>' +
                    '<button class="btn btn--sec btn--p" type="button" data-tam-gerar>' + ICONES.camera + 'Criar com fotos</button>' +
                    (t.modelo ? '<button class="btn btn--fantasma btn--p" type="button" data-tam-limpar>Usar o 3D principal</button>' : '') +
                  '</div></div>'
                : '') +
              '<div class="tam-rodape"><span class="mini">' + (ehAlimento(rascunho) ? (t.modelo ? '3D pronto' : 'Sem 3D próprio') : '') + '</span>' +
                '<button class="link-remover" type="button" data-tam-remover>' + (ehAlimento(rascunho) ? 'Remover tamanho' : 'Remover versão') + '</button></div>' +
            '</div>';
          }).join('') +
          '<div class="linha-acoes">' +
            '<button class="btn btn--fantasma btn--p" type="button" data-tam-novo>' + ICONES.mais + (ehAlimento(rascunho) ? 'Adicionar tamanho' : 'Adicionar versão') + '</button>' +
            (servidor && ehAlimento(rascunho) && x.tamanhos.length && x.modelo ? '<button class="btn btn--sec btn--p" type="button" data-tam-3d>' + ICONES.cubo + 'Gerar 3D de cada tamanho</button>' : '') +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="campo tams-admin adic-admin"><legend>Opcionais (opcional)</legend>' +
          '<small>O que o cliente pode marcar com preço extra. Ex.: montagem, pés em outra cor, almofadas.</small>' +
          x.adicionais.map(function (a, ai) {
            return '<div class="adic-linha" data-ai="' + ai + '">' +
              '<div class="campos campos--2">' +
                campo('Nome', '<input data-a="nome" maxlength="40" value="' + esc(a.nome) + '">') +
                campo('Preço (R$)', '<input data-a="preco" inputmode="decimal" value="' + esc(a.preco.toFixed(2).replace('.', ',')) + '">') +
              '</div>' +
              '<div class="tam-rodape"><label class="checar checar--p"><input type="checkbox" data-a="esgotado"' + (a.esgotado ? ' checked' : '') + '> Esgotado</label><button class="link-remover" type="button" data-adic-remover>Remover adicional</button></div>' +
            '</div>';
          }).join('') +
          '<div class="linha-acoes">' +
            '<button class="btn btn--fantasma btn--p" type="button" data-adic-novo>' + ICONES.mais + 'Adicionar opcional</button>' +
          '</div>' +
        '</fieldset>' +
        '<div class="linha-acoes">' +
          '<button class="btn btn--perigo btn--p" type="button" data-remover-prod>Remover produto</button></div>' +
      '</div></details>';
  }

  function coletarAdmin() {
    var f = $('#form-admin');
    var p = rascunho.padaria;
    p.nome = f.elements['p-nome'].value.trim();
    p.slogan = f.elements['p-slogan'].value.trim();
    p.abre = f.elements['p-abre'].value || p.abre;
    p.fecha = f.elements['p-fecha'].value || p.fecha;
    p.dias = $$('input[name="p-dia"]', f).filter(function (c) { return c.checked; }).map(function (c) { return Number(c.value); });
    p.whatsapp = f.elements['p-zap'].value.replace(/\D/g, '');
    p.tipo = f.elements['p-tipo'].value === 'produtos' ? 'produtos' : 'alimentos';
    coletarPedido(f);
    var cats = [];
    f.elements['p-cats'].value.split(/[,;\n]/).forEach(function (c) { c = c.trim().slice(0, 40); if (c && cats.indexOf(c) < 0 && cats.length < 20) cats.push(c); });
    rascunho.categorias = cats.length ? cats : rascunho.categorias;
    $$('details.prod', f).forEach(function (d) {
      var x = rascunho.produtos[Number(d.getAttribute('data-i'))];
      var g = function (k) { return d.querySelector('[data-f="' + k + '"]'); };
      x.nome = g('nome').value.trim();
      var gAc = g('acabamentos'); if (gAc) x.acabamentos = gAc.value.trim().slice(0, 400);
      x._preco = g('preco').value;
      x.preco = lerPreco(g('preco').value);
      var gDe = g('precoDe'); if (gDe) { var de = gDe.value.trim() ? lerPreco(gDe.value) : 0; x.precoDe = isFinite(de) && de > x.preco ? de : 0; }
      x.categoria = g('categoria').value;
      x.descricao = g('descricao').value.trim();
      x.dim = { largura: Number(g('largura').value), profundidade: Number(g('profundidade').value), altura: Number(g('altura').value) };
      x.modelo = g('modelo').value.trim();
      x.ilustrativo = g('ilustrativo').checked;
      x.esgotado = g('esgotado').checked;
      x.versao = g('versao') ? g('versao').value.trim() : (x.versao || '');
      x.ingredientes = g('ingredientes').value.trim();
      if (ehAlimento(rascunho)) x.alergenos = $$('[data-alerg]', d).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-alerg'); });
      x.tamanhos = $$('.tam-linha', d).map(function (l) {
        var t = function (k) { return l.querySelector('[data-t="' + k + '"]'); };
        var antigo = x.tamanhos[Number(l.getAttribute('data-ti'))] || {};
        return { id: antigo.id || slug(t('nome').value) || 't' + Date.now().toString(36), nome: t('nome').value.trim(), preco: lerPreco(t('preco').value),
          dim: { largura: Number(t('largura').value), profundidade: Number(t('profundidade').value), altura: Number(t('altura').value) }, modelo: t('modelo').value };
      });
      x.adicionais = $$('.adic-linha', d).map(function (l) {
        var q = function (k) { return l.querySelector('[data-a="' + k + '"]'); };
        var antigo = x.adicionais[Number(l.getAttribute('data-ai'))] || {};
        return { id: antigo.id || slug(q('nome').value) || 'a' + Date.now().toString(36), nome: q('nome').value.trim(), preco: lerPreco(q('preco').value),
          esgotado: q('esgotado').checked };
      });
      if (rascunho.categorias.indexOf(x.categoria) < 0) rascunho.categorias.push(x.categoria);
    });
  }

  function marcarErro(input, msg) {
    input.setAttribute('aria-invalid', 'true');
    var s = document.createElement('small');
    s.className = 'erro-campo';
    s.textContent = msg;
    input.parentNode.appendChild(s);
  }

  function validarAdmin() {
    var f = $('#form-admin');
    $$('.erro-campo', f).forEach(function (e) { e.remove(); });
    $$('[aria-invalid]', f).forEach(function (e) { e.removeAttribute('aria-invalid'); });
    var primeiro = null;
    function erro(input, msg) {
      marcarErro(input, msg);
      if (!primeiro) { primeiro = input; var pa = input.closest('.painel-aba'); if (pa && pa.hidden) mostrarAba(pa.getAttribute('data-aba')); }
    }
    if (!rascunho.padaria.nome) erro(f.elements['p-nome'], 'Informe o nome do estabelecimento.');
    var zap = rascunho.padaria.whatsapp;
    if (zap && (zap.length < 10 || zap.length > 15)) erro(f.elements['p-zap'], 'Número inválido. Use DDI + DDD + número (10 a 15 dígitos).');
    var ped = rascunho.padaria.pedido, qp = function (k) { return f.querySelector('[data-ped="' + k + '"]'); };
    if (qp('taxa')) {
      if (ped._taxa.trim() && !(ped.taxa >= 0 && ped.taxa <= 999)) erro(qp('taxa'), 'Valor inválido. Ex.: 5,00');
      if (ped._minimo.trim() && !(ped.minimo >= 0 && ped.minimo <= 9999)) erro(qp('minimo'), 'Valor inválido. Ex.: 20,00');
      if (ped._bairrosErro) erro(qp('bairros'), ped._bairrosErro);
      if (!ped.entrega && !ped.retirada && !ped.local) erro(qp('entrega'), 'Marque pelo menos uma forma.');
      if (!ped.pagamento.pix && !ped.pagamento.cartao && !ped.pagamento.dinheiro) erro(qp('pg-pix'), 'Marque pelo menos uma forma de pagamento.');
      var erPix = erroChavePix(ped.pix);
      if (erPix) erro(qp('pix-chave'), erPix);
      delete ped._taxa; delete ped._minimo; delete ped._bairrosErro;
    }
    $$('details.prod', f).forEach(function (d) {
      var x = rascunho.produtos[Number(d.getAttribute('data-i'))];
      var g = function (k) { return d.querySelector('[data-f="' + k + '"]'); };
      var antes = primeiro;
      if (!x.nome) erro(g('nome'), 'Informe o nome.');
      if (!isFinite(x.preco) || x.preco < 0 || x.preco > 1000000) erro(g('preco'), 'Preço inválido. Ex.: 8,50 ou 28.900,00');
      ['largura', 'profundidade', 'altura'].forEach(function (k) {
        if (!(x.dim[k] > 0 && x.dim[k] <= 1000)) erro(g(k), 'Entre 0,1 e 1000 cm.');
      });
      $$('.tam-linha', d).forEach(function (l, ti) {
        var t = x.tamanhos[ti], q = function (k) { return l.querySelector('[data-t="' + k + '"]'); };
        if (!t.nome) erro(q('nome'), 'Informe o nome do tamanho.');
        if (!isFinite(t.preco) || t.preco < 0) erro(q('preco'), 'Preço inválido.');
        ['largura', 'profundidade', 'altura'].forEach(function (k) { if (!(t.dim[k] > 0 && t.dim[k] <= 1000)) erro(q(k), 'Inválido.'); });
      });
      $$('.adic-linha', d).forEach(function (l, ai) {
        var a = x.adicionais[ai], q = function (k) { return l.querySelector('[data-a="' + k + '"]'); };
        if (!a.nome) erro(q('nome'), 'Informe o nome do adicional.');
        if (!isFinite(a.preco) || a.preco < 0 || a.preco > 9999) erro(q('preco'), 'Preço inválido.');
      });
      if (x.modelo && !/^(https:\/\/|\.{0,2}\/?[\w\-./]+\.(glb|gltf)(\?.*)?$)/i.test(x.modelo)) erro(g('modelo'), 'Use um caminho .glb/.gltf ou uma URL https://');
      if (primeiro !== antes) d.open = true;
    });
    if (primeiro) { primeiro.focus(); toast('Corrija os campos destacados'); return false; }
    return true;
  }

  $('#btn-admin').addEventListener('click', function () {
    abertoNoAdmin = null; abaAdmin = '';
    if (indisponivel && lerTokenLoja()) { abrirDialogo($('#dlg-admin')); abrirAdminCompleto(); return; }
    rascunho = clonar(dados);
    renderAdmin();
    abrirDialogo($('#dlg-admin'));
  });
  // Cardápio fora do ar (teste vencido): a loja logada busca a versão completa antes de editar
  function abrirAdminCompleto() {
    if (!indisponivel) { rascunho = clonar(dados); renderAdmin(); return; }
    $('#admin-corpo').innerHTML = '<p class="mini">Carregando o seu ' + termo() + '…</p>';
    carregarNuvem().then(function () {
      if (indisponivel) { toast('Não foi possível carregar o ' + termo() + '. Entre de novo.'); renderLogin(); return; }
      rascunho = clonar(dados); renderAdmin();
    });
  }

  $('#form-admin').addEventListener('submit', function (e) {
    e.preventDefault();
    if (indisponivel) { toast('Carregando o seu ' + termo() + '… tente de novo em instantes.'); abrirAdminCompleto(); return; }
    coletarAdmin();
    if (!validarAdmin()) return;
    rascunho.produtos.forEach(function (x) { delete x._preco; });
    dados = validarDados(rascunho);
    var salvo = gravar(CHAVE_DADOS, dados);
    var codigoAdmin = (($('#admin-codigo') || {}).value || '').trim();
    if (codigoAdmin) guardarCodigo(codigoAdmin);
    CATEGORIAS = dados.categorias;
    salvarCarrinho();
    renderTudo();
    fecharDialogo($('#dlg-admin'));
    if (!servidor || !credenciais()) {
      toast(salvo ? 'Alterações salvas só neste aparelho' : 'Não foi possível salvar (armazenamento bloqueado). As alterações valem só até recarregar.');
      return;
    }
    toast('Publicando para todos os clientes…');
    (LOJA ? prepararPrevia(dados).catch(function (er) { console.warn('[MenuReal] prévia do link', er); }) : Promise.resolve())
      .then(function () { gravar(CHAVE_DADOS, dados); return fetch(comLoja('api/cardapio'), { method: 'PUT', headers: cabecalhos(), body: JSON.stringify(dados) }); })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { toast(res.ok ? 'Publicado: todos os clientes já veem a nova versão' : 'Salvo só neste aparelho: ' + (res.j.erro || 'erro ao publicar')); })
      .catch(function () { toast('Salvo só neste aparelho: sem conexão com o servidor'); });
  });

  $('#admin-restaurar').addEventListener('click', function () {
    confirmar('Restaurar a demonstração? Todas as alterações feitas neste navegador serão perdidas.', 'Restaurar').then(function (sim) {
    if (!sim) return;
    apagar(CHAVE_DADOS);
    dados = validarDados(clonar(PADRAO));
    CATEGORIAS = dados.categorias;
    salvarCarrinho();
    renderTudo();
    fecharDialogo($('#dlg-admin'));
    toast('Cardápio de demonstração restaurado');
    });
  });

  $('#admin-corpo').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.closest('.login') && e.target.tagName === 'INPUT') { e.preventDefault(); if ($('#rec-enviar')) recuperarSenha(); else if ($('#login-entrar')) entrar(); }
  });
  $('#admin-corpo').addEventListener('click', function (e) {
    var codAdmin = $('#admin-codigo');
    if (codAdmin && codAdmin.value.trim()) guardarCodigo(codAdmin.value.trim());
    if (e.target.closest('#login-entrar')) { entrar(); return; }
    if (e.target.closest('#login-esqueci')) { renderRecuperar(); return; }
    var ab = e.target.closest('[data-aba-btn]') || e.target.closest('[data-aba-ir]');
    if (ab) { mostrarAba(ab.getAttribute('data-aba-btn') || ab.getAttribute('data-aba-ir')); return; }
    if (e.target.closest('[data-ajuda]')) { abrirAjuda(e.target.closest('[data-ajuda]').getAttribute('data-ajuda')); return; }
    if (e.target.closest('#rec-voltar')) { renderLogin(); return; }
    if (e.target.closest('#rec-enviar')) { recuperarSenha(); return; }
    if (e.target.closest('#codigo-ok')) { abrirAdminCompleto(); return; }
    if (e.target.closest('#conta-senha')) { trocarSenha(e.target.closest('#conta-senha')); return; }
    if (e.target.closest('#conta-codigo')) { novoCodigo(e.target.closest('#conta-codigo')); return; }
    if (e.target.closest('[data-copiar]')) { copiarTexto(e.target.closest('[data-copiar]').getAttribute('data-copiar')); return; }
    if (e.target.closest('#suporte-salvar')) { salvarSuporte(); return; }
    var exl = e.target.closest('[data-excluir-loja]');
    if (exl) {
      var sx = exl.getAttribute('data-excluir-loja'), nx = exl.getAttribute('data-nome');
      confirmar('Excluir a loja “' + nx + '” (/' + sx + ') para sempre? Apaga a conta, os produtos, as fotos, os modelos 3D e os números. Não dá para desfazer.', 'Excluir para sempre').then(function (sim) {
        if (!sim) return;
        exl.disabled = true;
        postarJson('api/contas', { acao: 'excluir', slug: sx, confirmacao: sx }, credenciais())
          .then(function () { toast('Loja /' + sx + ' excluída'); carregarLojas(); })
          .catch(function (er) { exl.disabled = false; toast(er.message); });
      });
      return;
    }
    var cks = e.target.closest('#ck-salvar');
    if (cks) { salvarCheckouts(cks); return; }
    var pok = e.target.closest('[data-pedido-ok]'), prem = e.target.closest('[data-pedido-rem]');
    if (pok || prem) {
      var corpoP = pok ? { acao: 'atendido', id: Number(pok.getAttribute('data-pedido-ok')), atendido: pok.getAttribute('data-v') === '1' } : { acao: 'remover', id: Number(prem.getAttribute('data-pedido-rem')) };
      (prem ? confirmar('Remover este pedido de demonstração?', 'Remover') : Promise.resolve(true)).then(function (sim) {
        if (!sim) return;
        postarJson('api/contato', corpoP, credenciais()).then(carregarPedidosDemo).catch(function (er) { toast(er.message); });
      });
      return;
    }
    var pl = e.target.closest('[data-plano]');
    if (pl) { mudarPlanoLoja(pl.getAttribute('data-slug'), pl.getAttribute('data-plano'), pl, pl.getAttribute('data-tipo')); return; }
    if (e.target.closest('#admin-sair')) {
      try { localStorage.removeItem(CHAVE_TOKEN); } catch (err) { /* ignora */ }
      renderAdmin();
      toast('Você saiu da conta');
      return;
    }
    if (e.target.closest('#lojas-abrir') || e.target.closest('#lojas-atualizar')) { carregarLojas(); return; }
    if (e.target.closest('#loja-criar')) { criarLoja(); return; }
    var tamNovo = e.target.closest('[data-tam-novo]');
    if (tamNovo) {
      coletarAdmin();
      var pn = rascunho.produtos[Number(tamNovo.closest('details.prod').getAttribute('data-i'))];
      var nomes = ['P', 'M', 'G', 'GG', 'Família', 'Extra'];
      var base = pn.tamanhos.length ? pn.tamanhos[pn.tamanhos.length - 1] : { preco: pn.preco, dim: pn.dim };
      pn.tamanhos.push({ id: 't' + Date.now().toString(36), nome: nomes[pn.tamanhos.length] || 'Tamanho ' + (pn.tamanhos.length + 1),
        preco: base.preco, dim: { largura: base.dim.largura, profundidade: base.dim.profundidade, altura: base.dim.altura }, modelo: '' });
      abertoNoAdmin = pn.id; renderAdmin();
      return;
    }
    var tamRem = e.target.closest('[data-tam-remover]');
    if (tamRem) {
      coletarAdmin();
      var pr = rascunho.produtos[Number(tamRem.closest('details.prod').getAttribute('data-i'))];
      pr.tamanhos.splice(Number(tamRem.closest('.tam-linha').getAttribute('data-ti')), 1);
      abertoNoAdmin = pr.id; renderAdmin();
      return;
    }
    var adicNovo = e.target.closest('[data-adic-novo]');
    if (adicNovo) {
      coletarAdmin();
      var pa = rascunho.produtos[Number(adicNovo.closest('details.prod').getAttribute('data-i'))];
      pa.adicionais.push({ id: 'a' + Date.now().toString(36), nome: '', preco: 0 });
      abertoNoAdmin = pa.id; renderAdmin();
      return;
    }
    var adicRem = e.target.closest('[data-adic-remover]');
    if (adicRem) {
      coletarAdmin();
      var pq = rascunho.produtos[Number(adicRem.closest('details.prod').getAttribute('data-i'))];
      pq.adicionais.splice(Number(adicRem.closest('.adic-linha').getAttribute('data-ai')), 1);
      abertoNoAdmin = pq.id; renderAdmin();
      return;
    }
    var tamG = e.target.closest('[data-tam-gerar]'), tamL = e.target.closest('[data-tam-limpar]');
    if (tamG || tamL) {
      coletarAdmin();
      var bt = tamG || tamL, ip = Number(bt.closest('details.prod').getAttribute('data-i')), xg = rascunho.produtos[ip];
      var tg = xg.tamanhos[Number(bt.closest('.tam-linha').getAttribute('data-ti'))];
      if (!tg) return;
      if (tamL) { tg.modelo = ''; abertoNoAdmin = xg.id; renderAdmin(); toast('A versão “' + tg.nome + '” volta a usar o 3D principal.'); return; }
      if (!tg.nome) { toast('Dê um nome para a versão antes (ex.: Cinza).'); return; }
      abrirGerador3D(ip, tg.id);
      return;
    }
    var tam3d = e.target.closest('[data-tam-3d]');
    if (tam3d) { coletarAdmin(); gerarTamanhos3d(tam3d, rascunho.produtos[Number(tam3d.closest('details.prod').getAttribute('data-i'))]); return; }
    if (e.target.closest('#admin-foto')) {
      coletarAdmin();
      abrirLeitorFoto();
      return;
    }
    if (e.target.closest('#admin-novo')) {
      coletarAdmin();
      var novo = { id: 'produto-' + Date.now().toString(36), nome: 'Novo produto',
        categoria: filtro.cat !== 'Todos' && rascunho.categorias.indexOf(filtro.cat) > -1 ? filtro.cat : rascunho.categorias[0],
        preco: 0, descricao: '', dim: { largura: 5, profundidade: 5, altura: 5 }, modelo: '', ilustrativo: true, ingredientes: '', alergenos: [], tamanhos: [], adicionais: [] };
      rascunho.produtos.push(novo);
      abertoNoAdmin = novo.id;
      renderAdmin();
      var d = $('details.prod[open]');
      if (d) { d.scrollIntoView({ block: 'center', behavior: reduzMovimento ? 'auto' : 'smooth' }); d.querySelector('[data-f="nome"]').select(); }
      return;
    }
    var gt = e.target.closest('[data-gal-tirar], [data-gal-mover]');
    if (gt && gt.closest('.gal-admin')) {
      var xgt = produtoDoAlvo(gt), kk = Number(gt.closest('[data-gk]').getAttribute('data-gk')); coletarAdmin();
      if (gt.hasAttribute('data-gal-tirar')) xgt.galeria.splice(kk, 1);
      else { var f0 = xgt.galeria.splice(kk, 1)[0]; xgt.galeria.splice(Math.max(0, kk - 1), 0, f0); }
      abertoNoAdmin = xgt.id; renderAdmin(); return;
    }
    var tfoto = e.target.closest('[data-tirar-foto]');
    if (tfoto) { var xt = produtoDoAlvo(tfoto); coletarAdmin(); xt.foto = ''; abertoNoAdmin = xt.id; renderAdmin(); return; }
    var fprev = e.target.closest('[data-forma-previa]');
    if (fprev) { gerarPreviaForma(fprev); return; }
    var fusar = e.target.closest('[data-forma-usar]');
    if (fusar) {
      var xu = produtoDoAlvo(fusar), su = xu && formaEstado[xu.id];
      if (!su || !su.glb) return;
      coletarAdmin(); xu = produtoDoAlvo(fusar);
      enviar3d(new File([su.glb], slug(xu.nome || 'produto') + '.glb', { type: 'model/gltf-binary' }), xu);
      return;
    }
    var bcm = e.target.closest('[data-cores-movel]');
    if (bcm) { coletarAdmin(); var xcm = produtoDoAlvo(bcm); if (xcm && xcm.modelo) abrirCoresMovel(xcm); return; }
    var bpl = e.target.closest('[data-planejado]');
    if (bpl) { coletarAdmin(); var xpl = produtoDoAlvo(bpl); if (xpl) abrirPlanejado(xpl); return; }
    var bpt = e.target.closest('[data-pontos]');
    if (bpt) { coletarAdmin(); var xpt = produtoDoAlvo(bpt); if (xpt && xpt.modelo) abrirPontos(xpt); return; }
    var bmi = e.target.closest('[data-movel-ia]');
    if (bmi) { coletarAdmin(); var xmi = produtoDoAlvo(bmi); if (xmi) abrirMovelIA(xmi); return; }
    var bpc = e.target.closest('[data-pecas]');
    if (bpc) { coletarAdmin(); var xpc = produtoDoAlvo(bpc); if (xpc && xpc.modelo) abrirPecas(xpc); return; }
    var g3d = e.target.closest('[data-gerar-3d]');
    if (g3d) {
      coletarAdmin();
      abrirGerador3D(Number(g3d.closest('details.prod').getAttribute('data-i')));
      return;
    }
    var resc = e.target.closest('[data-reescalar]');
    if (resc) {
      coletarAdmin();
      var px = produtoDoAlvo(resc);
      if (!credenciais()) { toast(LOJA ? 'Entre na conta do estabelecimento' : 'Preencha o código de acesso no topo do painel'); return; }
      if (!(px.dim.largura > 0 && px.dim.profundidade > 0 && px.dim.altura > 0)) { toast('Preencha as três medidas em cm'); return; }
      resc.disabled = true; resc.textContent = 'Ajustando…';
      fetch(comLoja('api/modelo-3d'), { method: 'POST', headers: cabecalhos(),
        body: JSON.stringify({ acao: 'reescalar', url: px.modelo, dim: px.dim, produto: slug(px.nome) }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
        .then(function (j) {
          if (px.pecasDe === px.modelo) px.pecasDe = j.url;   // mesmas partes, só o tamanho mudou
          if (px.planejado) px.planejadoDe = '-';             // o 3D deixou de ser o da ficha do planejado
          px.modelo = j.url; abertoNoAdmin = px.id; renderAdmin();
          toast('Tamanho ajustado para ' + dimTexto({ largura: j.medidasCm[0], altura: j.medidasCm[1], profundidade: j.medidasCm[2] }) + '. Salve para publicar.');
        })
        .catch(function (err) { resc.disabled = false; resc.textContent = 'Aplicar as medidas acima ao 3D'; toast(err.message); });
      return;
    }
    var rem = e.target.closest('[data-remover-prod]');
    if (rem) {
      coletarAdmin();
      var i = Number(rem.closest('details.prod').getAttribute('data-i'));
      confirmar('Remover “' + (rascunho.produtos[i].nome || 'produto') + '”? A remoção só vale depois de salvar.', 'Remover').then(function (sim) {
        if (!sim) return;
        rascunho.produtos.splice(i, 1);
        abertoNoAdmin = null;
        renderAdmin();
      });
      return;
    }
    if (e.target.closest('#admin-exportar')) {
      coletarAdmin();
      var blob = new Blob([JSON.stringify(rascunho, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'menureal-cardapio.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  });

  $('#admin-corpo').addEventListener('change', function (e) {
    if (e.target.name === 'p-tipo') { coletarAdmin(); renderAdmin(); return; }
    if (e.target.id !== 'admin-importar' || !e.target.files[0]) return;
    var leitor = new FileReader();
    leitor.onload = function () {
      try {
        var d = validarDados(JSON.parse(leitor.result));
        if (!d) throw new Error('estrutura');
        rascunho = d;
        renderAdmin();
        toast('Arquivo importado. Revise e toque em “Salvar alterações”.');
      } catch (err) {
        toast('Arquivo inválido: não é um catálogo exportado pelo MenuReal.');
      }
    };
    leitor.readAsText(e.target.files[0]);
  });

  // ---------------------------------------------------------------------
  // Criar cardápio por foto (precisa do servidor: src/api)
  // ---------------------------------------------------------------------
  var API_FOTO = 'api/ler-cardapio';
  var CHAVE_CODIGO = 'menureal:codigo-acesso';
  var LADO_MAX = 2000; // px no maior lado: legível para a IA e leve para enviar
  var foto = { imagem: null, previa: '', itens: [], aviso: '', lendo: false, controle: null };

  function lerCodigo() { try { return sessionStorage.getItem(CHAVE_CODIGO) || ''; } catch (e) { return ''; } }
  function guardarCodigo(v) { try { sessionStorage.setItem(CHAVE_CODIGO, v); } catch (e) { /* ignora */ } }

  function abrirLeitorFoto() {
    foto.imagem = null; foto.previa = ''; foto.itens = []; foto.aviso = '';
    renderFotoInicio();
    abrirDialogo($('#dlg-foto'));
  }

  function renderFotoInicio(erro) {
    $('#foto-corpo').innerHTML =
      '<div class="foto-intro">' +
        '<p>Fotografe o catálogo ou a tabela de preços, ou escolha uma foto da galeria. A leitura é feita por inteligência artificial e pode errar: você revisa cada item antes de ele entrar no ' + termo() + '.</p>' +
        '<ul class="dicas-foto"><li>Página inteira no quadro, sem cortes</li><li>Boa luz, sem reflexo</li><li>Celular reto, de frente para o papel</li><li>Cardápio grande: uma foto por página</li></ul>' +
      '</div>' +
      '<label class="seletor-foto' + (foto.previa ? ' tem' : '') + '">' +
        (foto.previa ? '<img src="' + foto.previa + '" alt="Foto selecionada">' : ICONES.camera + '<strong>Tirar foto ou escolher da galeria</strong><small>JPG, PNG ou WebP</small>') +
        '<input type="file" accept="image/jpeg,image/png,image/webp,image/*" id="foto-arquivo" hidden>' +
      '</label>' +
      (foto.previa ? '<button class="btn btn--fantasma btn--p" type="button" id="foto-trocar">Trocar foto</button>' : '') +

      (erro ? '<div class="ar-indisp" role="alert"><strong>Não foi possível ler</strong>' + esc(erro) + '</div>' : '');
    $('#foto-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="foto-ler"' + (foto.imagem ? '' : ' disabled') + '>Ler foto</button>';
  }

  function reduzirImagem(arquivo) {
    return new Promise(function (ok, falha) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () {
        var esc_ = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * esc_);
        c.height = Math.round(img.naturalHeight * esc_);
        var g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var dataUrl = c.toDataURL('image/jpeg', 0.85);
        ok({ dataUrl: dataUrl, base64: dataUrl.split(',')[1] });
      };
      img.onerror = function () { URL.revokeObjectURL(url); falha(new Error('imagem')); };
      img.src = url;
    });
  }

  function renderLendo(qtd) {
    $('#foto-corpo').innerHTML =
      '<div class="lendo">' +
        '<img src="' + foto.previa + '" alt="">' +
        '<div class="carregando"><div class="spinner" aria-hidden="true"></div>' +
        '<strong id="foto-status" aria-live="polite">' + (qtd ? qtd + (qtd === 1 ? ' item encontrado…' : ' itens encontrados…') : 'Lendo a foto…') + '</strong>' +
        '<small>Pode levar até 1 minuto em listas grandes.</small></div>' +
      '</div>';
    $('#foto-rodape').innerHTML = '<button class="btn btn--fantasma btn--bloco" type="button" id="foto-cancelar">Cancelar leitura</button>';
  }

  function lerEventos(resposta, aoTexto) {
    // Lê o fluxo SSE da API e devolve o texto (JSON) completo
    var leitor = resposta.body.getReader();
    var dec = new TextDecoder();
    var buffer = '', texto = '', parada = null;
    function passo() {
      return leitor.read().then(function (r) {
        if (r.done) return { texto: texto, parada: parada };
        buffer += dec.decode(r.value, { stream: true });
        var linhas = buffer.split('\n');
        buffer = linhas.pop();
        linhas.forEach(function (l) {
          if (l.indexOf('data:') !== 0) return;
          var ev;
          try { ev = JSON.parse(l.slice(5)); } catch (e) { return; }
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') {
            texto += ev.delta.text;
            aoTexto(texto);
          } else if (ev.type === 'message_delta' && ev.delta) {
            parada = ev.delta.stop_reason || parada;
          } else if (ev.type === 'error') {
            throw new Error((ev.error && ev.error.type === 'overloaded_error')
              ? 'O serviço de leitura está sobrecarregado. Tente de novo em alguns minutos.'
              : 'A leitura foi interrompida. Tente de novo.');
          }
        });
        return passo();
      });
    }
    return passo();
  }

  function lerFoto() {
    if (!credenciais()) { renderFotoInicio(LOJA ? 'Entre na conta do estabelecimento (feche e abra o painel).' : 'Preencha o código de acesso no topo do painel.'); return; }
    foto.lendo = true;
    foto.controle = window.AbortController ? new AbortController() : null;
    renderLendo(0);
    var contados = 0;
    fetch(comLoja(API_FOTO), {
      method: 'POST',
      headers: cabecalhos(),
      body: JSON.stringify({ imagem: foto.imagem, tipo: 'image/jpeg', categorias: rascunho.categorias }),
      signal: foto.controle ? foto.controle.signal : undefined
    }).then(function (r) {
      var tipo = r.headers.get('content-type') || '';
      if (!r.ok || tipo.indexOf('text/event-stream') === -1) {
        if (r.status === 404 || r.status === 405 || tipo.indexOf('text/html') > -1) {
          throw new Error('O servidor de leitura não foi encontrado. Este recurso só funciona no site publicado na Cloudflare a partir do GitHub, com a chave configurada (veja o README).');
        }
        return r.json().then(function (j) { throw new Error(j.erro || 'Erro ' + r.status); },
          function () { throw new Error('Erro ' + r.status + ' no servidor.'); });
      }
      return lerEventos(r, function (txt) {
        var n = (txt.match(/"nome"\s*:/g) || []).length;
        if (n !== contados) { contados = n; var st = $('#foto-status'); if (st) st.textContent = n + (n === 1 ? ' item encontrado…' : ' itens encontrados…'); }
      });
    }).then(function (res) {
      if (res.parada === 'refusal') throw new Error('A leitura desta imagem foi recusada. Tente outra foto.');
      if (res.parada === 'max_tokens') throw new Error('A lista é grande demais para uma foto só. Fotografe uma página ou metade por vez.');
      var dados;
      try { dados = JSON.parse(res.texto); } catch (e) { throw new Error('A resposta veio incompleta. Tente de novo.'); }
      foto.itens = (dados.itens || []).filter(function (x) { return x && x.nome; }).map(function (x) {
        return {
          nome: String(x.nome).trim().slice(0, 60),
          preco: typeof x.preco === 'number' && isFinite(x.preco) && x.preco >= 0 ? Math.round(x.preco * 100) / 100 : null,
          descricao: String(x.descricao || '').trim().slice(0, 240),
          categoria: rascunho.categorias.filter(function (c) { return semAcento(c) === semAcento(x.categoria); })[0] || rascunho.categorias[0],
          ingredientes: String(x.ingredientes || '').trim().slice(0, 600),
          observacao: String(x.observacao || '').trim(),
          usar: true
        };
      });
      foto.aviso = String(dados.aviso || '').trim();
      foto.lendo = false;
      renderRevisao();
    }).catch(function (e) {
      foto.lendo = false;
      if (e && e.name === 'AbortError') { renderFotoInicio(); return; }
      var msg = (e && e.message) || '';
      var rede = !msg || /failed to fetch|network|load failed|networkerror/i.test(msg);
      renderFotoInicio(rede
        ? 'A conexão com o servidor caiu antes da resposta (' + (msg || 'erro de rede') + '). Tente de novo; se repetir, abra ' + location.origin + '/api/ler-cardapio para ver o diagnóstico.'
        : msg);
    });
  }

  function renderRevisao() {
    var n = foto.itens.length;
    var existentes = {};
    rascunho.produtos.forEach(function (p) { existentes[semAcento(p.nome)] = true; });
    $('#foto-corpo').innerHTML =
      (foto.aviso ? '<div class="ar-indisp" role="status"><strong>Atenção</strong>' + esc(foto.aviso) + '</div>' : '') +
      (n ? '<p class="mini" style="margin:4px 0 12px">' + n + (n === 1 ? ' item lido.' : ' itens lidos.') + ' Corrija o que precisar e desmarque o que não quiser importar.</p>' +
        '<div class="revisao">' + foto.itens.map(function (x, i) {
          var dup = existentes[semAcento(x.nome)];
          return '<div class="rev' + (x.usar ? '' : ' rev--off') + '" data-r="' + i + '">' +
            '<label class="checar rev__usar"><input type="checkbox" data-rf="usar"' + (x.usar ? ' checked' : '') + '><span class="sr-only">Importar</span></label>' +
            '<div class="rev__campos">' +
              '<input data-rf="nome" maxlength="60" value="' + esc(x.nome) + '" aria-label="Nome">' +
              '<div class="rev__linha">' +
                '<input data-rf="preco" inputmode="decimal" placeholder="Preço" value="' + (x.preco == null ? '' : esc(x.preco.toFixed(2).replace('.', ','))) + '" aria-label="Preço em reais"' + (x.preco == null ? ' aria-invalid="true"' : '') + '>' +
                '<select data-rf="categoria" aria-label="Categoria">' + rascunho.categorias.map(function (c) { return '<option' + (c === x.categoria ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
              '</div>' +
              (x.descricao ? '<p class="rev__desc">' + esc(x.descricao) + '</p>' : '') +
              (x.preco == null ? '<p class="rev__obs">Preço não identificado: digite o valor.</p>' : '') +
              (x.observacao ? '<p class="rev__obs">' + esc(x.observacao) + '</p>' : '') +
              (dup ? '<p class="rev__obs">Já existe um produto com este nome.</p>' : '') +
            '</div></div>';
        }).join('') + '</div>'
        : '<div class="carrinho-vazio"><strong>Nenhum item encontrado</strong>Tente uma foto mais nítida, com a página inteira no quadro.</div>');
    $('#foto-rodape').innerHTML = n
      ? '<div class="pilha"><button class="btn btn--primario btn--bloco" type="button" id="foto-adicionar">Adicionar aos produtos</button>' +
        '<button class="btn btn--fantasma btn--bloco" type="button" id="foto-substituir">Substituir todos os produtos</button></div>'
      : '<button class="btn btn--primario btn--bloco" type="button" id="foto-nova">Tentar outra foto</button>';
  }

  function coletarRevisao() {
    $$('#foto-corpo .rev').forEach(function (el) {
      var x = foto.itens[Number(el.getAttribute('data-r'))];
      x.usar = el.querySelector('[data-rf="usar"]').checked;
      x.nome = el.querySelector('[data-rf="nome"]').value.trim();
      var pr = el.querySelector('[data-rf="preco"]').value.trim();
      x.preco = pr ? lerPreco(pr) : null;
      x.categoria = el.querySelector('[data-rf="categoria"]').value;
    });
  }

  function aplicarRevisao(substituir) {
    coletarRevisao();
    var escolhidos = foto.itens.filter(function (x) { return x.usar; });
    if (!escolhidos.length) { toast('Marque ao menos um item'); return; }
    var ruim = escolhidos.filter(function (x) { return !x.nome || x.preco == null || !isFinite(x.preco) || x.preco < 0; });
    if (ruim.length) {
      toast('Confira nome e preço de: ' + (ruim[0].nome || 'item sem nome'));
      var idx = foto.itens.indexOf(ruim[0]);
      var campoRuim = $('#foto-corpo .rev[data-r="' + idx + '"] [data-rf="' + (ruim[0].nome ? 'preco' : 'nome') + '"]');
      if (campoRuim) { campoRuim.setAttribute('aria-invalid', 'true'); campoRuim.focus(); }
      return;
    }
    function aplicar() {
      var base = Date.now().toString(36);
      var novos = escolhidos.map(function (x, i) {
        return { id: slug(x.nome) + '-' + base + i, nome: x.nome, categoria: x.categoria, preco: x.preco, descricao: x.descricao,
          dim: { largura: 5, profundidade: 5, altura: 5 }, modelo: '', ilustrativo: true, ingredientes: x.ingredientes || '', alergenos: [], tamanhos: [], adicionais: [] };
      });
      rascunho.produtos = substituir ? novos : rascunho.produtos.concat(novos);
      abertoNoAdmin = null;
      fecharDialogo($('#dlg-foto'));
      renderAdmin();
      toast(novos.length + (novos.length === 1 ? ' produto incluído' : ' produtos incluídos') + '. Toque em “Salvar alterações” para publicar.');
    }
    if (substituir) {
      confirmar('Substituir os ' + rascunho.produtos.length + ' produtos atuais pelos ' + escolhidos.length + ' itens lidos? Isso só vale depois de salvar.', 'Substituir')
        .then(function (sim) { if (sim) aplicar(); });
    } else {
      aplicar();
    }
  }

  $('#dlg-foto').addEventListener('change', function (e) {
    if (e.target.id === 'foto-arquivo' && e.target.files[0]) {
      var arq = e.target.files[0];
      if (!/^image\//.test(arq.type) && !/\.(jpe?g|png|webp|heic)$/i.test(arq.name)) { renderFotoInicio('Escolha um arquivo de imagem.'); return; }
      reduzirImagem(arq).then(function (r) {
        foto.imagem = r.base64; foto.previa = r.dataUrl;
        renderFotoInicio();
      }, function () {
        renderFotoInicio('Não foi possível abrir esta imagem. Se for HEIC (iPhone), tire a foto pela câmera aqui do site ou envie em JPG.');
      });
    }
    if (e.target.matches && e.target.matches('[data-rf="usar"]')) {
      e.target.closest('.rev').classList.toggle('rev--off', !e.target.checked);
    }
  });
  $('#dlg-foto').addEventListener('click', function (e) {
    if (e.target.closest('#foto-trocar')) { $('#foto-arquivo').click(); return; }
    if (e.target.closest('#foto-ler')) { lerFoto(); return; }
    if (e.target.closest('#foto-cancelar')) { if (foto.controle) foto.controle.abort(); return; }
    if (e.target.closest('#foto-adicionar')) { aplicarRevisao(false); return; }
    if (e.target.closest('#foto-substituir')) { aplicarRevisao(true); return; }
    if (e.target.closest('#foto-nova')) { foto.imagem = null; foto.previa = ''; renderFotoInicio(); }
  });
  $('#dlg-foto').addEventListener('close', function () { if (foto.lendo && foto.controle) foto.controle.abort(); });

  // ---------------------------------------------------------------------
  // Gerar modelo 3D realista a partir de fotos (servidor + Meshy)
  // ---------------------------------------------------------------------
  var CHAVE_TAREFAS = 'menureal:tarefas3d';
  var g3d = { i: null, fotos: [], timer: null, resultado: null, qualidade: 'alta' };

  function tarefas3d() { return ler(CHAVE_TAREFAS) || {}; }
  function guardarTarefa(id, t) { var x = tarefas3d(); if (t) x[id] = t; else delete x[id]; gravar(CHAVE_TAREFAS, x); }
  function produtoG3d() {
    var x = rascunho && rascunho.produtos[g3d.i];
    if (!x || !g3d.tamId) return x;
    var t = (x.tamanhos || []).filter(function (v) { return v.id === g3d.tamId; })[0];
    if (!t) return x;
    // a versão se comporta como um produto para o gerador (as medidas são as dela)
    return { id: x.id + '~' + t.id, nome: x.nome + ' — ' + t.nome, dim: t.dim, modelo: t.modelo, _prod: x, _tam: t };
  }

  function abrirGerador3D(i, tamId) {
    g3d.i = i; g3d.tamId = tamId || ''; g3d.fotos = []; g3d.resultado = null;
    abrirDialogo($('#dlg-3d'));
    var x = produtoG3d();
    var pend = tarefas3d()[x.id];
    if (pend) acompanharG3d(pend); else renderG3dInicio();
    // quanto do limite do plano a loja já usou (o servidor também confere antes de gerar)
    g3d.uso = null;
    if (LOJA && credenciais()) {
      fetch(comLoja('api/modelo-3d?uso=1'), { headers: cabecalhos(), cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (u) { g3d.uso = u; if ($('#dlg-3d').open && $('#g3d-gerar')) renderG3dInicio(); })
        .catch(function () { /* sem problema: o servidor confere ao gerar */ });
    }
  }
  function htmlUso3d() {
    var u = g3d.uso;
    if (!u) return '';
    var resta = Math.max(0, u.limite - u.usados);
    return '<div class="uso3d' + (resta ? '' : ' uso3d--fim') + '"><strong>' + esc(u.nomePlano) + ': ' + u.usados + ' de ' + u.limite + ' criações usadas' + (u.porMes ? ' este mês' : '') + '</strong>' +
      '<div class="barra"><i style="width:' + Math.min(100, u.limite ? (u.usados / u.limite) * 100 : 100) + '%"></i></div>' +
      (resta ? '<small>Restam ' + resta + (u.porMes ? '. O limite renova no dia 1º.' : '.') + '</small>'
        : '<small>' + (u.limite === 0 ? 'Seu plano não está ativo. Escolha um plano no Início do painel.' : u.porMes ? 'Limite do mês atingido. Renova no dia 1º.' : 'Limite do teste atingido. Escolha um plano no Início do painel para criar mais.') +
          ' Enquanto isso, você pode enviar o arquivo 3D da fábrica ou usar “Montar com forma + foto”, que não contam no limite.</small>') +
      '</div>';
  }
  function semCota() { return g3d.uso && g3d.uso.usados >= g3d.uso.limite; }

  function renderG3dInicio(erro) {
    var x = produtoG3d();
    $('#g3d-corpo').innerHTML =
      '<p class="g3d-prod"><strong>' + esc(x.nome) + '</strong></p>' +
      (LOJA ? htmlUso3d() : '') +
      '<fieldset class="g3d-medidas"><legend>Medidas reais do produto (cm) — definem o tamanho na câmera</legend>' +
        '<div class="campos campos--3">' +
          campo('Largura', '<input id="g3d-largura" type="number" min="0.5" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.largura + '">') +
          campo('Profund.', '<input id="g3d-profundidade" type="number" min="0.5" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.profundidade + '">') +
          campo('Altura', '<input id="g3d-altura" type="number" min="0.5" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.altura + '">') +
        '</div>' +
        (x.dim.largura === 5 && x.dim.profundidade === 5 && x.dim.altura === 5
          ? '<p class="rev__obs">Estas são as medidas padrão (5 cm). Meça o produto com uma régua: uma lata, por exemplo, tem cerca de 6 × 6 × 16 cm.</p>' : '') +
      '</fieldset>' +
      '<div class="foto-intro"><p>Tire de 1 a 4 fotos do produto <strong>real</strong>. A inteligência artificial monta o modelo 3D, e o site ajusta o tamanho pela maior medida cadastrada.</p>' +
        '<ul class="dicas-foto"><li>1ª foto de frente; as outras dos lados ou de cima</li><li>Produto inteiro no quadro, sobre fundo liso e claro</li><li>Boa luz, sem sombra forte e sem outros objetos</li><li>Confira as medidas acima antes de gerar</li></ul></div>' +
      '<div class="g3d-fotos">' +
        g3d.fotos.map(function (f, k) {
          return '<div class="g3d-foto"><img src="' + f.previa + '" alt="Foto ' + (k + 1) + '"><span>' + (k === 0 ? 'Frente' : 'Foto ' + (k + 1)) + '</span>' +
            '<button type="button" class="g3d-tirar" data-tirar="' + k + '" aria-label="Remover foto ' + (k + 1) + '">×</button></div>';
        }).join('') +
        (g3d.fotos.length < 4 ? '<label class="g3d-add">' + ICONES.camera + '<span>' + (g3d.fotos.length ? 'Adicionar foto' : 'Tirar 1ª foto (frente)') + '</span>' +
          '<input type="file" accept="image/*" id="g3d-arquivo" ' + (g3d.fotos.length ? 'multiple ' : '') + 'hidden></label>' : '') +
      '</div>' +

      '<fieldset class="campo" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Qualidade do modelo</legend><div class="fontes-op">' +
        '<label class="fonte-op"><input type="radio" name="g3d-qualidade" value="alta"' + (g3d.qualidade !== 'padrao' ? ' checked' : '') + '><span class="fonte-op__amostra" style="font-size:17px">Alta</span><small>Mais detalhe e realismo. Arquivo maior.</small></label>' +
        '<label class="fonte-op"><input type="radio" name="g3d-qualidade" value="padrao"' + (g3d.qualidade === 'padrao' ? ' checked' : '') + '><span class="fonte-op__amostra" style="font-size:17px">Padrão</span><small>Mais leve, abre rápido em internet fraca.</small></label>' +
      '</div></fieldset>' +
      (LOJA ? '<p class="mini">Cada criação leva de 2 a 5 minutos e conta uma vez no limite do seu plano, mesmo se você refizer.</p>'
        : '<p class="mini">Cada geração usa créditos da sua conta na Meshy e leva de 2 a 5 minutos.</p>') +
      (erro ? '<div class="ar-indisp" role="alert"><strong>Não foi possível gerar</strong>' + esc(erro) + '</div>' : '');
    $('#g3d-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="g3d-gerar"' + (g3d.fotos.length && !semCota() ? '' : ' disabled') + '>' + (semCota() ? 'Limite do plano atingido' : 'Gerar modelo 3D') + '</button>';
  }

  function renderG3dProgresso(pct, msg, erro) {
    $('#g3d-corpo').innerHTML =
      '<div class="lendo">' +
        (g3d.fotos[0] ? '<img src="' + g3d.fotos[0].previa + '" alt="">' : '') +
        '<div class="carregando">' + (erro ? '' : '<div class="spinner" aria-hidden="true"></div>') +
          '<strong aria-live="polite">' + esc(msg) + '</strong>' +
          '<div class="barra barra--larga"><i style="width:' + Math.max(3, pct) + '%"></i></div>' +
          '<small>Leva de 2 a 5 minutos. Pode fechar esta janela: ao voltar neste produto, o acompanhamento continua.</small>' +
        '</div>' +
      '</div>' + (erro ? '<div class="ar-indisp" role="alert"><strong>Falha ao acompanhar</strong>' + esc(erro) + '</div>' : '');
    $('#g3d-rodape').innerHTML = erro ? '<button class="btn btn--primario btn--bloco" type="button" id="g3d-retomar">Tentar de novo</button>' : '';
  }

  function iniciarG3d() {
    var x = produtoG3d();
    var dimNova = { largura: Number($('#g3d-largura').value), profundidade: Number($('#g3d-profundidade').value), altura: Number($('#g3d-altura').value) };
    if (!(dimNova.largura > 0 && dimNova.profundidade > 0 && dimNova.altura > 0)) { renderG3dInicio('Preencha as três medidas reais, em centímetros.'); return; }
    x.dim = dimNova;
    if (!credenciais()) { renderG3dInicio(LOJA ? 'Entre na conta do estabelecimento.' : 'Preencha o código de acesso no topo do painel.'); return; }
    renderG3dProgresso(2, 'Enviando fotos…');
    fetch(comLoja('api/modelo-3d'), {
      method: 'POST',
      headers: cabecalhos(),
      body: JSON.stringify({ imagens: g3d.fotos.map(function (f) { return f.base64; }), qualidade: g3d.qualidade === 'padrao' ? 'padrao' : 'alta' })
    }).then(function (r) {
      return r.json().catch(function () { return { erro: 'Servidor de modelos 3D não encontrado (' + r.status + ').' }; })
        .then(function (j) { if (j.uso) g3d.uso = j.uso; if (!r.ok || !j.tarefa) throw new Error(j.erro || 'Erro ' + r.status); return j; });
    }).then(function (j) {
      if (g3d.uso) g3d.uso.usados++;
      var pend = { tarefa: j.tarefa, dim: x.dim, inicio: Date.now() };
      guardarTarefa(x.id, pend);
      acompanharG3d(pend);
    }).catch(function (e) {
      renderG3dInicio(/failed to fetch|network|load failed/i.test(e.message) ? 'Sem conexão com o servidor. Tente de novo.' : e.message);
    });
  }

  function acompanharG3d(pend) {
    clearTimeout(g3d.timer);
    var x = produtoG3d();
    var idProd = x.id;
    renderG3dProgresso(5, 'Gerando modelo 3D…');
    function consultar() {
      if (!$('#dlg-3d').open || !produtoG3d() || produtoG3d().id !== idProd) return;
      var q = '?tarefa=' + encodeURIComponent(pend.tarefa) + '&produto=' + encodeURIComponent(slug(x.nome)) +
        '&largura=' + pend.dim.largura + '&profundidade=' + pend.dim.profundidade + '&altura=' + pend.dim.altura;
      fetch(comLoja('api/modelo-3d' + q), { headers: cabecalhos(), cache: 'no-store' })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
        .then(function (j) {
          if (j.status === 'SUCCEEDED') { guardarTarefa(idProd, null); g3d.resultado = j; renderG3dPronto(); return; }
          if (j.status === 'FAILED' || j.status === 'CANCELED') { guardarTarefa(idProd, null); renderG3dInicio(j.erro || 'A geração falhou. Tente outras fotos.'); return; }
          var pct = Math.min(97, j.progresso || 0);
          renderG3dProgresso(pct, (j.status === 'PENDING' ? 'Na fila… ' : 'Gerando modelo 3D… ') + pct + '%');
          g3d.timer = setTimeout(consultar, 5000);
        })
        .catch(function (e) {
          renderG3dProgresso(0, 'Acompanhamento interrompido', /failed to fetch|network|load failed/i.test(e.message) ? 'Sem conexão. Verifique a internet.' : e.message);
        });
    }
    consultar();
  }

  function renderG3dPronto() {
    var r = g3d.resultado;
    $('#g3d-corpo').innerHTML =
      '<div class="g3d-previa"><model-viewer src="' + esc(r.url) + '" alt="Prévia do modelo 3D gerado" camera-controls touch-action="pan-y" ' +
        (reduzMovimento ? '' : 'auto-rotate ') + 'shadow-intensity="1.25" shadow-softness="0.55" tone-mapping="neutral" environment-image="' + esc(ESTUDIO()) + '" exposure="1"></model-viewer></div>' +
      '<p class="escala ok">✓ Modelo pronto e guardado na nuvem. Medidas finais: ' +
        esc(dimTexto({ largura: r.medidasCm[0], altura: r.medidasCm[1], profundidade: r.medidasCm[2] })) + ' (' + esc(String(r.tamanhoMb)) + ' MB).</p>' +
      '<p class="mini">Gire a prévia para conferir. Se não ficou bom, gere de novo com fotos mais nítidas e fundo liso.</p>';
    $('#g3d-rodape').innerHTML = '<div class="pilha"><button class="btn btn--primario btn--bloco" type="button" id="g3d-usar">Usar este modelo</button>' +
      '<button class="btn btn--fantasma btn--bloco" type="button" id="g3d-refazer">Gerar de novo</button></div>';
  }

  $('#dlg-3d').addEventListener('change', function (e) {
    if (e.target.name === 'g3d-qualidade') { g3d.qualidade = e.target.value; return; }
    if (e.target.id !== 'g3d-arquivo' || !e.target.files.length) return;
    var arquivos = Array.prototype.slice.call(e.target.files, 0, 4 - g3d.fotos.length);
    ['largura', 'profundidade', 'altura'].forEach(function (k) { var v = Number(($('#g3d-' + k) || {}).value); if (v > 0) produtoG3d().dim[k] = v; });
    Promise.all(arquivos.map(function (a) { return reduzirImagem(a).catch(function () { return null; }); })).then(function (rs) {
      rs.forEach(function (r) { if (r) g3d.fotos.push({ base64: r.base64, previa: r.dataUrl }); });
      renderG3dInicio(rs.some(function (r) { return !r; }) ? 'Uma das fotos não abriu. Use JPG ou tire pela câmera.' : '');
    });
  });
  $('#dlg-3d').addEventListener('click', function (e) {
    var t = e.target.closest('[data-tirar]');
    if (t) { g3d.fotos.splice(Number(t.getAttribute('data-tirar')), 1); renderG3dInicio(); return; }
    if (e.target.closest('#g3d-gerar')) { iniciarG3d(); return; }
    if (e.target.closest('#g3d-retomar')) { var p = tarefas3d()[produtoG3d().id]; if (p) acompanharG3d(p); else renderG3dInicio(); return; }
    if (e.target.closest('#g3d-refazer')) { g3d.resultado = null; renderG3dInicio(); return; }
    if (e.target.closest('#g3d-usar')) {
      var x = produtoG3d();
      if (x._tam) { x._tam.modelo = g3d.resultado.url; abertoNoAdmin = x._prod.id; }
      else { x.modelo = g3d.resultado.url; x.ilustrativo = false; abertoNoAdmin = x.id; }
      fecharDialogo($('#dlg-3d'));
      renderAdmin();
      toast('Modelo aplicado. Toque em “Salvar alterações” para publicar.');
      // o 3D gerado por fotos vem pesado: reduz em seguida (abre bem mais rápido no 4G)
      if (x._tam) deixar3dLeve(x._prod, g3d.resultado.url, x._tam.id, true); else deixar3dLeve(x, g3d.resultado.url, null, true);
    }
  });
  $('#dlg-3d').addEventListener('close', function () { clearTimeout(g3d.timer); });

  function lojaNaoEncontrada(msg) {
    dados = clonar(VAZIO);
    dados.padaria.nome = 'Página não encontrada';
    dados.padaria.slogan = msg || 'Confira o endereço digitado.';
    CATEGORIAS = [];
    renderTudo();
    $('#grade').innerHTML = '<div class="vazio"><strong>Não encontramos esta loja</strong>O endereço “/' + esc(LOJA) + '” não corresponde a nenhuma loja cadastrada.</div>';
  }

  // Painel do dono da plataforma: contas dos estabelecimentos
  function carregarLojas() {
    var alvo = $('#lojas');
    if (!lerCodigo()) { toast('Preencha o código de acesso'); return; }
    alvo.innerHTML = '<p class="mini">Carregando…</p>';
    fetch('api/contas', { headers: cabecalhos(), cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        alvo.innerHTML =
          (j.contas.length
            ? '<p class="mini">' + resumoContas(j.contas) + '</p><ul class="lojas">' + j.contas.map(htmlLojaDono).join('') + '</ul>'
            : '<p class="mini">Nenhum estabelecimento ainda.</p>') +
          htmlKiwifyDono(j) +
          '<div class="nova-loja" id="pedidos-demo"><h4>Pedidos de demonstração</h4><p class="mini">Carregando…</p></div>' +
          '<div class="nova-loja"><h4>Seu WhatsApp de suporte</h4>' +
            campo('As lojas veem este número para falar com você (ativar, tirar dúvidas, recuperar senha)', '<input id="suporte-num" inputmode="numeric" maxlength="15" placeholder="DDD + número" value="' + esc(String(j.suporte || '').replace(/^55/, '')) + '">') +
            '<button class="btn btn--sec" type="button" id="suporte-salvar">Salvar WhatsApp</button></div>' +
          '<div class="nova-loja"><h4>Nova loja (ou nova senha)</h4>' +
            campo('Nome', '<input id="nl-nome" maxlength="60" placeholder="Confeitaria Doce Lar, Móveis Silva…">') +
            campo('Endereço da página', '<input id="nl-slug" maxlength="40" placeholder="doce-lar" autocapitalize="off">', location.host + '/<endereço>') +
            campo('Ramo', '<select id="nl-tipo"><option value="moveis">Loja de móveis</option><option value="planejados">Móveis planejados</option><option value="decoracao">Decoração</option><option value="outros">Outros produtos</option></select>') +
            campo('E-mail do dono', '<input id="nl-email" type="email" maxlength="120">') +
            campo('Senha inicial (8+ caracteres)', '<input id="nl-senha" type="text" maxlength="120" autocomplete="off">') +
            '<div class="linha-acoes"><button class="btn btn--primario" type="button" id="loja-criar">Criar conta</button>' +
            '<button class="btn btn--fantasma" type="button" id="lojas-atualizar">Atualizar lista</button></div>' +
          '</div>';
        carregarPedidosDemo();
        var nome = $('#nl-nome'), sl = $('#nl-slug');
        nome.addEventListener('input', function () { if (!sl.dataset.mexido) sl.value = slug(nome.value).slice(0, 40); });
        sl.addEventListener('input', function () { sl.dataset.mexido = '1'; });
      })
      .catch(function (e) { alvo.innerHTML = '<div class="ar-indisp" role="alert">' + esc(e.message) + '</div><button class="btn btn--sec btn--bloco" type="button" id="lojas-abrir">Tentar de novo</button>'; });
  }
  function htmlKiwifyDono(j) {
    var ck = j.checkouts || {}, pags = j.pagamentos || [];
    var rot = { fundador: 'Fundador (R$ 49/mês)', loja: 'Loja (R$ 99/mês)', anual: 'Loja anual (R$ 990/ano)' };
    return '<div class="nova-loja"><h4>Pagamentos automáticos (Kiwify)</h4>' +
      (j.kiwifyConfigurado
        ? '<p class="mini kiwify-ok">✓ Token da Kiwify configurado. Compras aprovadas ativam a loja sozinhas; cancelamento, atraso, reembolso ou chargeback pausam.</p>'
        : '<p class="ar-indisp">Falta o token: crie o webhook na Kiwify e salve o token na Cloudflare com o nome <code>KIWIFY_TOKEN</code> (Workers → menureal-ar → Settings → Variables and Secrets → tipo Secret).</p>') +
      campo('Endereço do webhook (cole na Kiwify)', '<input readonly value="' + esc(location.origin + '/api/kiwify') + '" onclick="this.select()">') +
      ['fundador', 'loja', 'anual'].map(function (t) {
        return campo('Link de pagamento — ' + rot[t], '<input id="ck-' + t + '" inputmode="url" placeholder="https://pay.kiwify.com.br/…" value="' + esc(ck[t] || '') + '">');
      }).join('') +
      '<button class="btn btn--sec" type="button" id="ck-salvar">Salvar links</button>' +
      '<details class="conta-det"><summary>Últimos avisos da Kiwify (' + pags.length + ')</summary>' +
        (pags.length ? '<ul class="pagamentos">' + pags.map(function (p) {
          return '<li><strong>' + esc(p.resultado || '—') + '</strong> · ' + esc(p.evento) + (p.tipo ? ' · ' + esc(p.tipo) : '') + '<small>' + esc(p.email) + (p.loja ? ' → /' + esc(p.loja) : '') + ' · ' + new Date(p.criadoEm).toLocaleString('pt-BR') + '</small></li>';
        }).join('') + '</ul>' : '<p class="mini">Nenhum aviso ainda.</p>') +
      '</details></div>';
  }
  function salvarCheckouts(btn) {
    var corpo = { acao: 'checkouts' };
    ['fundador', 'loja', 'anual'].forEach(function (t) { corpo[t] = $('#ck-' + t).value.trim(); });
    btn.disabled = true;
    postarJson('api/contas', corpo, credenciais()).then(function () { toast('Links de pagamento salvos'); })
      .catch(function (e) { toast(e.message); }).then(function () { btn.disabled = false; });
  }
  function carregarPedidosDemo() {
    var alvo = $('#pedidos-demo'); if (!alvo) return;
    fetch('api/contato', { headers: cabecalhos(), cache: 'no-store' })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        var lista = j.pedidos || [];
        var novos = lista.filter(function (x) { return !x.atendido; }).length;
        alvo.innerHTML = '<h4>Pedidos de demonstração' + (novos ? ' <span class="contador-novo">' + novos + ' novo' + (novos > 1 ? 's' : '') + '</span>' : '') + '</h4>' +
          (lista.length ? '<ul class="pedidos-demo">' + lista.map(function (x) {
            var zap = 'https://wa.me/' + (x.whatsapp.length <= 11 ? '55' : '') + x.whatsapp + '?text=' + encodeURIComponent('Olá! Aqui é do MenuReal. Recebi seu pedido de demonstração para a ' + x.loja + '. Pode me mandar fotos de 2 ou 3 móveis que vocês mais vendem?');
            return '<li class="' + (x.atendido ? 'pedido-ok' : '') + '"><div><strong>' + esc(x.loja) + '</strong><small>' + esc(x.whatsapp) + (x.cidade ? ' · ' + esc(x.cidade) : '') + ' · ' + new Date(x.criadoEm).toLocaleDateString('pt-BR') + '</small></div>' +
              '<div class="linha-acoes"><a class="btn btn--sec btn--p" href="' + esc(zap) + '" target="_blank" rel="noopener">Chamar no WhatsApp</a>' +
              '<button class="btn btn--fantasma btn--p" type="button" data-pedido-ok="' + x.id + '" data-v="' + (x.atendido ? 0 : 1) + '">' + (x.atendido ? 'Desmarcar' : 'Marcar como atendido') + '</button>' +
              '<button class="btn btn--fantasma btn--p" type="button" data-pedido-rem="' + x.id + '">Remover</button></div></li>';
          }).join('') + '</ul>' : '<p class="mini">Nenhum pedido ainda. Eles chegam pelo botão “Peça uma demonstração” da página inicial.</p>');
      })
      .catch(function (e) { alvo.innerHTML = '<h4>Pedidos de demonstração</h4><p class="mini">' + esc(e.message) + '</p>'; });
  }
  function criarLoja() {
    var corpo = { nome: $('#nl-nome').value.trim(), slug: $('#nl-slug').value.trim().toLowerCase(), email: $('#nl-email').value.trim(), senha: $('#nl-senha').value, ramo: $('#nl-tipo').value };
    var b = $('#loja-criar');
    b.disabled = true; b.textContent = 'Criando…';
    fetch('api/contas', { method: 'POST', headers: cabecalhos(), body: JSON.stringify(corpo) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) { /* resposta não-JSON */ }
          if (!r.ok || !j) throw new Error((j && j.erro) || 'Erro do servidor (' + r.status + '). Tente de novo em instantes.');
          return j;
        });
      })
      .then(function (j) {
        toast((j.atualizado ? 'Conta atualizada: ' : 'Conta criada: ') + location.host + '/' + j.slug);
        carregarLojas();
      })
      .catch(function (e) { b.disabled = false; b.textContent = 'Criar conta'; toast(e.message); });
  }

  function gerarTamanhos3d(botao, x) {
    if (!credenciais()) { toast(LOJA ? 'Entre na conta do estabelecimento' : 'Preencha o código de acesso no topo do painel'); return; }
    if (!x.modelo) { toast('Gere ou defina o 3D do produto primeiro'); return; }
    botao.disabled = true;
    var i = 0;
    function proximo() {
      if (i >= x.tamanhos.length) {
        abertoNoAdmin = x.id; renderAdmin();
        toast('3D de cada tamanho pronto. Toque em “Salvar alterações” para publicar.');
        return;
      }
      var t = x.tamanhos[i];
      botao.textContent = 'Ajustando ' + t.nome + '… (' + (i + 1) + '/' + x.tamanhos.length + ')';
      fetch(comLoja('api/modelo-3d'), { method: 'POST', headers: cabecalhos(),
        body: JSON.stringify({ acao: 'reescalar', url: x.modelo, dim: t.dim, produto: slug(x.nome + '-' + t.nome) }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
        .then(function (j) { t.modelo = j.url; i++; proximo(); })
        .catch(function (e) { abertoNoAdmin = x.id; renderAdmin(); toast('Tamanho ' + t.nome + ': ' + e.message); });
    }
    proximo();
  }

  // Cardápio publicado na nuvem (Cloudflare Worker)
  var indisponivel = false;
  function carregarNuvem() {
    if (location.protocol === 'file:' || MODELOS_EMBUTIDOS) return Promise.resolve();
    var tk = LOJA ? lerTokenLoja() : '';
    return fetch(comLoja('api/cardapio'), { cache: 'no-store', headers: tk ? { authorization: 'Bearer ' + tk } : {} }).then(function (r) {
      var ehJson = /json/.test(r.headers.get('content-type') || '');
      if (!ehJson) { if (LOJA) lojaNaoEncontrada('O servidor do MenuReal não respondeu.'); return null; }
      servidor = true;
      if (r.status === 404 && LOJA) { lojaNaoEncontrada(); return null; }
      return r.ok ? r.json() : null;
    }).then(function (d) {
      if (!LOJA) return;   // página inicial: demonstração fixa (móveis), só confirma que o servidor existe
      if (d && d.indisponivel) { lojaIndisponivel(d); return; }
      if (d) { indisponivel = false; registrar('visita'); }
      var v = d && validarDados(d);
      if (!v || JSON.stringify(v) === JSON.stringify(dados)) return;
      dados = v;
      CATEGORIAS = dados.categorias;
      gravar(CHAVE_DADOS, dados);
      salvarCarrinho();
      renderTudo();
    }).catch(function () { /* sem servidor: segue com os dados locais */ });
  }

  // ---------------------------------------------------------------------
  // Loja fora do ar (teste grátis acabou ou bloqueada pelo MenuReal)
  // ---------------------------------------------------------------------
  function lojaIndisponivel(d) {
    indisponivel = true;
    dados = validarDados(d);
    apagar(CHAVE_DADOS);
    CATEGORIAS = [];
    renderTudo();
    $('#status-texto').textContent = 'Fora do ar';
    $('#grade').innerHTML = '<div class="vazio"><strong>Cardápio fora do ar no momento</strong>Volte daqui a pouco ou fale direto com a loja.' +
      '<br><small>É o dono? Toque em <b>Admin</b> para entrar.</small></div>';
  }
  function linkSuporte(texto) {
    var n = (dados.padaria.plano && dados.padaria.plano.suporte) || suporteMenuReal;
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto) : '';
  }
  // Planos do MenuReal (usados na página inicial e no aviso do painel da loja)
  var checkoutsPublicos = {};   // links de pagamento (Kiwify) para a página inicial
  var PLANOS = [
    { id: 'fundador', nome: 'Fundador', preco: 'R$ 49', per: '/mês', selo: 'Vagas para as primeiras lojas',
      itens: ['Tudo do plano Loja', 'Preço fixo por 12 meses', 'Ajuda para montar os primeiros produtos'] },
    { id: 'loja', nome: 'Loja', preco: 'R$ 99', per: '/mês', selo: '',
      itens: ['Catálogo com endereço próprio', 'Móveis em 3D e na câmera, no tamanho real', '“Cabe no meu espaço?” e troca de cores (quando o 3D tiver as cores)', 'Orçamentos direto no WhatsApp', 'Cartaz com QR code e números de visitas', 'Até 10 criações de 3D por fotos por mês'] },
    { id: 'anual', nome: 'Loja anual', preco: 'R$ 990', per: '/ano', selo: '2 meses grátis',
      itens: ['Tudo do plano Loja', 'Sai por R$ 82,50 por mês'] }
  ];
  // loja: null na página inicial (botão abre o cadastro); no painel, monta o link de WhatsApp para contratar
  function htmlPlanos(loja) {
    return PLANOS.map(function (pl) {
      var acao;
      if (loja) {
        var ck = checkoutsDaLoja()[pl.id];
        if (ck) acao = '<a class="btn btn--primario btn--bloco btn--p" data-checkout="' + esc(ck) + '" href="' + esc(linkCheckout(ck)) + '" target="_blank" rel="noopener">Assinar agora</a>';
        else {
          var zap = linkSuporte('Olá! Quero contratar o plano ' + pl.nome + ' (' + pl.preco + pl.per + ') para a loja ' + loja + '.');
          acao = zap ? '<a class="btn btn--primario btn--bloco btn--p" href="' + esc(zap) + '" target="_blank" rel="noopener">Quero este plano</a>' : '';
        }
      } else {
        var ckp = checkoutsPublicos[pl.id];
        acao = (ckp ? '<a class="btn ' + (pl.id === 'fundador' ? 'btn--primario' : 'btn--sec') + ' btn--bloco" href="' + esc(ckp) + '" target="_blank" rel="noopener">Assinar agora</a>' : '') +
          '<button class="btn ' + (ckp ? 'btn--fantasma' : pl.id === 'fundador' ? 'btn--primario' : 'btn--contorno') + ' btn--bloco" type="button" data-plano="' + pl.id + '">Testar grátis por 7 dias</button>';
      }
      return '<article class="lp-plano' + (pl.id === 'fundador' ? ' lp-plano--destaque' : '') + '">' +
        (pl.selo ? '<span class="lp-plano__selo">' + esc(pl.selo) + '</span>' : '') +
        '<h3>' + esc(pl.nome) + '</h3><p class="lp-plano__preco">' + esc(pl.preco) + '<small>' + esc(pl.per) + '</small></p>' +
        '<ul>' + pl.itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' + acao + '</article>';
    }).join('');
  }
  function diasRestantes(iso) { return Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 864e5)); }
  // Pagamento pela Kiwify: o plano é liberado sozinho quando o e-mail da compra é o mesmo da conta
  var emailConta = '';
  function checkoutsDaLoja() { return (dados.padaria.plano && dados.padaria.plano.checkouts) || {}; }
  function linkCheckout(base) { return base + (emailConta ? (base.indexOf('?') > -1 ? '&' : '?') + 'email=' + encodeURIComponent(emailConta) : ''); }
  function buscarEmailConta() {
    if (emailConta || !LOJA || !credenciais()) return;
    fetch(comLoja('api/conta'), { headers: cabecalhos(), cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.email) return;
      emailConta = j.email;
      $$('[data-checkout]').forEach(function (a) { a.href = linkCheckout(a.getAttribute('data-checkout')); });
      $$('[data-email-conta]').forEach(function (b) { b.textContent = emailConta; });
    }).catch(function () { /* sem problema */ });
  }
  function htmlAvisoPlano(pl) {
    if (!pl || pl.situacao === 'ativo') return '';
    var loja = dados.padaria.nome + ' (' + location.host + '/' + LOJA + ')';
    var zap = linkSuporte(pl.situacao === 'teste' ? 'Olá! Quero continuar com o MenuReal na loja ' + loja + '.' : 'Olá! Quero reativar o catálogo da loja ' + loja + '.');
    var btn = zap ? '<a class="btn btn--primario btn--p" href="' + esc(zap) + '" target="_blank" rel="noopener">Falar com o MenuReal</a>' : '';
    var planos = pl.situacao === 'bloqueado' ? '' :
      '<details class="aviso-plano__planos"' + (pl.situacao === 'vencido' ? ' open' : '') + '><summary>Ver planos e contratar</summary>' +
      '<div class="lp-planos lp-planos--painel">' + htmlPlanos(loja) + '</div>' +
      (Object.keys(checkoutsDaLoja()).length
        ? '<p class="mini">Pagamento por Pix ou cartão, pela Kiwify. <strong>Use o mesmo e-mail da sua conta (<b data-email-conta>' + esc(emailConta || 'o e-mail com que você entra aqui') + '</b>)</strong> para o plano ser liberado na hora, automaticamente.</p>'
        : '<p class="mini">O pagamento é por Pix. Você escolhe o plano, a gente confirma pelo WhatsApp e libera na hora.</p>') + '</details>';
    setTimeout(buscarEmailConta, 0);
    if (pl.situacao === 'teste') {
      var d = diasRestantes(pl.ate);
      return '<div class="aviso-plano"><strong>Teste grátis: ' + (d <= 1 ? 'último dia' : 'faltam ' + d + ' dias') + '</strong>' +
        '<span>Seu ' + termo() + ' já está no ar. Para continuar depois do teste, escolha um plano.</span>' + planos + '</div>';
    }
    return '<div class="aviso-plano aviso-plano--fora"><strong>' + (pl.situacao === 'vencido' ? 'Seu teste grátis acabou' : 'Cardápio pausado pelo MenuReal') + '</strong>' +
      '<span>Os clientes veem “fora do ar”. Seus produtos e configurações continuam salvos.</span>' + (planos || btn) + '</div>';
  }

  // ---------------------------------------------------------------------
  // Recuperar senha com o código de recuperação
  // ---------------------------------------------------------------------
  // WhatsApp da empresa MenuReal (suporte). O número salvo no painel do dono tem prioridade.
  var SUPORTE_PADRAO = '5528999525125';
  var suporteMenuReal = SUPORTE_PADRAO;
  function renderRecuperar(erro) {
    $('#form-admin').classList.add('so-login');
    var zap = linkSuporte('Olá! Esqueci a senha da loja ' + (LOJA ? location.host + '/' + LOJA : '') + ' e não tenho o código de recuperação.');
    $('#admin-corpo').innerHTML =
      '<div class="login">' +
        '<p class="login__loja">Recuperar senha</p>' +
        '<p>Use o <strong>código de recuperação</strong> que apareceu quando a loja foi criada (formato ABCD-EFGH-JKLM).</p>' +
        campo('E-mail da loja', '<input id="rec-email" type="email" autocomplete="username" maxlength="120">') +
        campo('Código de recuperação', '<input id="rec-codigo" autocapitalize="characters" autocomplete="off" maxlength="20" placeholder="ABCD-EFGH-JKLM">') +
        campo('Nova senha (8+ caracteres)', '<input id="rec-senha" type="password" autocomplete="new-password" maxlength="120">') +
        (erro ? '<div class="ar-indisp" role="alert">' + esc(erro) + '</div>' : '') +
        '<button class="btn btn--primario btn--bloco" type="button" id="rec-enviar">Trocar a senha</button>' +
        '<button class="btn btn--fantasma btn--bloco" type="button" id="rec-voltar">Voltar para entrar</button>' +
        '<p class="mini">Não tem o código?' + (zap ? ' <a href="' + esc(zap) + '" target="_blank" rel="noopener">Fale com o suporte do MenuReal</a>.' : ' Fale com o suporte do MenuReal.') + '</p>' +
      '</div>';
    setTimeout(function () { var el = $('#rec-email'); if (el) el.focus(); }, 50);
  }
  function recuperarSenha() {
    var corpo = { email: $('#rec-email').value.trim(), codigo: $('#rec-codigo').value.trim(), senha: $('#rec-senha').value };
    if (!corpo.email || !corpo.codigo || !corpo.senha) { renderRecuperar('Preencha os três campos.'); return; }
    $('#rec-enviar').disabled = true;
    postarJson('api/recuperar', corpo).then(function (j) {
      try { localStorage.setItem('menureal:token:' + j.slug, j.token); } catch (e) { /* ignora */ }
      if (j.slug !== LOJA) { mostrarCodigo(j.codigo, 'Senha trocada!', '/' + j.slug + '?bemvindo=1'); return; }
      mostrarCodigo(j.codigo, 'Senha trocada!');
    }).catch(function (e) { renderRecuperar(e.message); });
  }
  // Mostra o código de recuperação (novo) para a loja guardar
  function htmlCodigo(codigo) {
    return '<div class="codigo-rec"><span>Seu código de recuperação</span><strong>' + esc(codigo) + '</strong>' +
      '<button class="btn btn--sec btn--p" type="button" data-copiar="' + esc(codigo) + '">Copiar</button></div>' +
      '<p class="mini">Guarde num lugar seguro (print, bloco de notas, papel na loja). É com ele que você troca a senha se esquecer. Cada código vale <strong>uma vez</strong>: ao usar, você recebe outro.</p>';
  }
  function mostrarCodigo(codigo, titulo, irPara) {
    $('#form-admin').classList.add('so-login');
    $('#admin-corpo').innerHTML = '<div class="login"><p class="login__loja">' + esc(titulo) + '</p>' + htmlCodigo(codigo) +
      (irPara ? '<a class="btn btn--primario btn--bloco" href="' + esc(irPara) + '">Já guardei, abrir minha loja</a>'
        : '<button class="btn btn--primario btn--bloco" type="button" id="codigo-ok">Já guardei, continuar</button>') + '</div>';
  }
  function copiarTexto(t) {
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copiado'); }, function () { toast('Selecione e copie: ' + t); });
  }
  function postarJson(url, corpo, extraHeaders) {
    return fetch(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, extraHeaders || {}), body: JSON.stringify(corpo) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) { /* não-JSON */ }
          if (!r.ok || !j) { var er = new Error((j && j.erro) || 'Erro do servidor (' + r.status + '). Tente de novo.'); er.campo = j && j.campo; throw er; }
          return j;
        });
      })
      .catch(function (e) { if (/failed to fetch|network/i.test(e.message)) throw new Error('Sem conexão com o servidor.'); throw e; });
  }

  // ---------------------------------------------------------------------
  // Sua conta: trocar senha e gerar novo código de recuperação
  // ---------------------------------------------------------------------
  function htmlContaAdmin() {
    return '<section class="secao-admin"><h3>Sua conta</h3>' +
      '<details class="conta-det"><summary>Trocar a senha</summary><div class="campos">' +
        campo('Senha atual', '<input id="conta-atual" type="password" autocomplete="current-password" maxlength="120">') +
        campo('Nova senha (8+ caracteres)', '<input id="conta-nova" type="password" autocomplete="new-password" maxlength="120">') +
        '<button class="btn btn--sec" type="button" id="conta-senha">Trocar a senha</button></div></details>' +
      '<details class="conta-det"><summary>Código de recuperação</summary><div class="campos">' +
        '<p class="mini">Perdeu o código ou nunca recebeu um? Gere um novo (o antigo deixa de valer).</p>' +
        campo('Sua senha', '<input id="conta-cod-senha" type="password" autocomplete="current-password" maxlength="120">') +
        '<button class="btn btn--sec" type="button" id="conta-codigo">Gerar novo código</button><div id="conta-cod-res"></div></div></details>' +
      '</section>';
  }
  function trocarSenha(b) {
    var atual = $('#conta-atual').value, nova = $('#conta-nova').value;
    if (nova.length < 8) { toast('A nova senha precisa ter pelo menos 8 caracteres.'); return; }
    b.disabled = true;
    postarJson(comLoja('api/conta'), { acao: 'senha', atual: atual, nova: nova }, credenciais())
      .then(function () { $('#conta-atual').value = ''; $('#conta-nova').value = ''; toast('Senha trocada.'); })
      .catch(function (e) { toast(e.message); }).then(function () { b.disabled = false; });
  }
  function novoCodigo(b) {
    b.disabled = true;
    postarJson(comLoja('api/conta'), { acao: 'codigo', senha: $('#conta-cod-senha').value }, credenciais())
      .then(function (j) { $('#conta-cod-senha').value = ''; $('#conta-cod-res').innerHTML = htmlCodigo(j.codigo); })
      .catch(function (e) { toast(e.message); }).then(function () { b.disabled = false; });
  }

  // ---------------------------------------------------------------------
  // Painel do dono: planos das lojas e WhatsApp de suporte
  // ---------------------------------------------------------------------
  var ROTULO_SITUACAO = { ativo: 'Ativa (pagante)', teste: 'Em teste', vencido: 'Teste acabou', bloqueado: 'Bloqueada' };
  function resumoContas(lista) {
    var n = { ativo: 0, teste: 0, vencido: 0, bloqueado: 0 };
    lista.forEach(function (c) { n[c.situacao] = (n[c.situacao] || 0) + 1; });
    return lista.length + ' lojas · ' + n.ativo + ' ativas · ' + n.teste + ' em teste · ' + n.vencido + ' com teste vencido' + (n.bloqueado ? ' · ' + n.bloqueado + ' bloqueadas' : '');
  }
  function htmlLojaDono(c) {
    var sit = c.situacao || 'ativo';
    var prazo = sit === 'teste' ? ' · até ' + new Date(c.testeAte).toLocaleDateString('pt-BR') : '';
    var zap = c.whatsapp ? '<a class="btn btn--fantasma btn--p" href="https://wa.me/' + esc(c.whatsapp) + '" target="_blank" rel="noopener">WhatsApp</a>' : '';
    var b = function (plano, rot, tipo) { return '<button class="btn btn--' + (plano === 'ativo' ? 'sec' : 'fantasma') + ' btn--p" type="button" data-plano="' + plano + '"' + (tipo ? ' data-tipo="' + tipo + '"' : '') + ' data-slug="' + esc(c.slug) + '">' + rot + '</button>'; };
    var nomeTipo = { fundador: 'Fundador', loja: 'Loja', anual: 'Loja anual' };
    var planoAtual = sit === 'ativo' && nomeTipo[c.planoTipo] ? ' · ' + nomeTipo[c.planoTipo] : '';
    var uso = c.limite3d != null ? '<small>3D por fotos: ' + c.usados3d + ' de ' + c.limite3d + (sit === 'teste' ? ' no teste' : ' este mês') + '</small>' : '';
    return '<li class="loja-dono"><div><strong>' + esc(c.nome) + '</strong><small>' + esc(c.email) + '</small>' +
        '<span class="situacao situacao--' + sit + '">' + ROTULO_SITUACAO[sit] + planoAtual + prazo + '</span>' + uso + '</div>' +
      '<div class="linha-acoes">' +
        '<a class="btn btn--fantasma btn--p" href="/' + esc(c.slug) + '" target="_blank" rel="noopener">/' + esc(c.slug) + '</a>' + zap +
      '</div>' +
      '<p class="mini loja-dono__rot">Pagou? Ative no plano contratado:</p>' +
      '<div class="linha-acoes">' +
        ['fundador', 'loja', 'anual'].map(function (t) { return sit === 'ativo' && c.planoTipo === t ? '' : b('ativo', 'Ativar ' + nomeTipo[t], t); }).join('') +
      '</div><div class="linha-acoes">' +
        b('teste', '+7 dias de teste') +
        (sit !== 'bloqueado' ? b('bloqueado', 'Bloquear') : '') +
        '<button class="btn btn--perigo btn--p" type="button" data-excluir-loja="' + esc(c.slug) + '" data-nome="' + esc(c.nome) + '">Excluir</button>' +
      '</div></li>';
  }
  function mudarPlanoLoja(slugLoja, plano, botao, tipo) {
    botao.disabled = true;
    postarJson('api/contas', { acao: 'plano', slug: slugLoja, plano: plano, dias: 7, tipo: tipo || '' }, credenciais())
      .then(function (j) { toast('/' + slugLoja + ': ' + ROTULO_SITUACAO[j.situacao] + (j.situacao === 'ativo' && tipo ? ' — plano ' + ({ fundador: 'Fundador', loja: 'Loja', anual: 'Loja anual' })[tipo] : '')); carregarLojas(); })
      .catch(function (e) { botao.disabled = false; toast(e.message); });
  }
  function salvarSuporte() {
    postarJson('api/contas', { acao: 'suporte', numero: $('#suporte-num').value }, credenciais())
      .then(function () { toast('WhatsApp de suporte salvo'); })
      .catch(function (e) { toast(e.message); });
  }

  // ---------------------------------------------------------------------
  // Cadastro da loja pelo próprio lojista (7 dias grátis)
  // ---------------------------------------------------------------------
  var cad = { nome: '', slug: '', tipo: 'moveis', whatsapp: '', email: '', senha: '', mexido: false };
  var cadSeq = 0;
  var cadastroPosCompra = false;
  function abrirCadastro(posCompra) {
    if (!servidor && location.protocol === 'file:') { toast('O cadastro funciona no site publicado.'); return; }
    cadastroPosCompra = posCompra === true;
    renderCadastro();
    abrirDialogo($('#dlg-cadastro'));
    fetch('api/cadastro', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { suporteMenuReal = j.suporte || SUPORTE_PADRAO; }).catch(function () { /* ok */ });
  }
  function renderCadastro(erro, campoErro) {
    var tipos = [['moveis', 'Loja de móveis', 'sofás, mesas, cadeiras, camas…'], ['planejados', 'Móveis planejados', 'cozinhas, dormitórios, armários…'], ['decoracao', 'Decoração', 'luminárias, tapetes, vasos, quadros…'], ['outros', 'Outros produtos', 'eletros, presentes, o que for…']];
    var c = function (rot, id, attrs, ajuda) { return campo(rot, '<input id="cad-' + id + '" ' + attrs + ' value="' + esc(cad[id]) + '"' + (campoErro === id ? ' aria-invalid="true"' : '') + '>', ajuda); };
    $('#cadastro-corpo').innerHTML =
      '<div class="cadastro">' +
        (cadastroPosCompra
          ? '<p class="cadastro__intro cadastro__pago"><strong>Pagamento recebido, obrigado!</strong> Agora crie a conta da sua loja. <strong>Use o mesmo e-mail da compra</strong>: assim o seu plano é liberado na hora.</p>'
          : '<p class="cadastro__intro"><strong>7 dias grátis, sem cartão.</strong> Sua loja ganha um endereço próprio com os móveis em 3D, no tamanho real, na casa do cliente, e orçamentos pelo WhatsApp.</p>') +
        c('Nome da loja', 'nome', 'maxlength="60" autocomplete="organization" placeholder="Ex.: Casa & Sala Móveis"') +
        '<label class="campo">Endereço do seu catálogo<span class="cad-slug"><span>' + esc(location.host) + '/</span><input id="cad-slug" maxlength="40" autocapitalize="off" autocomplete="off" spellcheck="false" value="' + esc(cad.slug) + '"' + (campoErro === 'slug' ? ' aria-invalid="true"' : '') + '></span>' +
          '<small id="cad-slug-st" aria-live="polite">Letras minúsculas, números e hífen.</small></label>' +
        '<fieldset class="campo"><legend>Tipo de loja</legend><div class="opcoes">' + tipos.map(function (t) {
          return '<label class="opcao"><input type="radio" name="cad-tipo" value="' + t[0] + '"' + (cad.tipo === t[0] ? ' checked' : '') + '><span>' + t[1] + '<small>' + t[2] + '</small></span></label>';
        }).join('') + '</div></fieldset>' +
        c('WhatsApp da loja (recebe os pedidos)', 'whatsapp', 'inputmode="tel" maxlength="16" autocomplete="tel" placeholder="DDD + número"') +
        c('Seu e-mail (para entrar)', 'email', 'type="email" maxlength="120" autocomplete="email"') +
        c('Crie uma senha (8+ caracteres)', 'senha', 'type="password" maxlength="120" autocomplete="new-password"') +
        '<input id="cad-site" tabindex="-1" autocomplete="off" aria-hidden="true" class="isca">' +
        (erro ? '<div class="ar-indisp" role="alert">' + esc(erro) + '</div>' : '') +
        '<p class="mini">Ao criar, você concorda com os <a href="/termos" target="_blank" rel="noopener">termos de uso e privacidade</a>.</p>' +
      '</div>';
    $('#cadastro-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="cad-criar">' + (cadastroPosCompra ? 'Criar minha conta e liberar o plano' : 'Criar meu catálogo grátis') + '</button>';
    if (cad.slug) conferirSlug();
    if (campoErro) { var el = $('#cad-' + campoErro); if (el) el.focus(); }
  }
  function conferirSlug() {
    var st = $('#cad-slug-st'), s = cad.slug, seq = ++cadSeq;
    if (!st) return;
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s)) { st.className = ''; st.textContent = s ? 'Use de 3 a 40 letras minúsculas, números e hífens.' : 'Letras minúsculas, números e hífen.'; return; }
    st.className = ''; st.textContent = 'Conferindo…';
    clearTimeout(conferirSlug.t);
    conferirSlug.t = setTimeout(function () {
      fetch('api/cadastro?slug=' + encodeURIComponent(s), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
        if (seq !== cadSeq) return;
        st.className = j.livre ? 'ok' : 'erro';
        st.textContent = j.livre ? '✓ ' + location.host + '/' + s + ' está livre' : j.valido === false ? 'Este endereço é reservado. Escolha outro.' : 'Já está em uso. Tente outro, como ' + s + '-' + (new Date().getFullYear() % 100) + '.';
      }).catch(function () { st.textContent = ''; });
    }, 350);
  }
  $('#dlg-cadastro').addEventListener('input', function (e) {
    var id = (e.target.id || '').replace(/^cad-/, '');
    if (!(id in cad)) return;
    if (id === 'slug') { cad.mexido = true; cad.slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40); if (e.target.value !== cad.slug) e.target.value = cad.slug; conferirSlug(); return; }
    cad[id] = e.target.value;
    if (id === 'nome' && !cad.mexido) { cad.slug = slug(cad.nome).slice(0, 40); $('#cad-slug').value = cad.slug; conferirSlug(); }
    if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid');
  });
  $('#dlg-cadastro').addEventListener('change', function (e) { if (e.target.name === 'cad-tipo') cad.tipo = e.target.value; });
  $('#dlg-cadastro').addEventListener('click', function (e) {
    if (e.target.closest('[data-copiar]')) { copiarTexto(e.target.closest('[data-copiar]').getAttribute('data-copiar')); return; }
    if (!e.target.closest('#cad-criar')) return;
    var b = e.target.closest('#cad-criar');
    b.disabled = true; b.textContent = 'Criando a sua loja…';
    postarJson('api/cadastro', { nome: cad.nome.trim(), slug: cad.slug, ramo: cad.tipo, whatsapp: cad.whatsapp, email: cad.email.trim(), senha: cad.senha, site: ($('#cad-site') || {}).value || '' })
      .then(function (j) {
        try { localStorage.setItem('menureal:token:' + j.slug, j.token); } catch (er) { /* ignora */ }
        $('#cadastro-titulo').textContent = 'Sua loja está pronta!';
        $('#cadastro-corpo').innerHTML = '<div class="cadastro">' +
          '<p class="cadastro__intro">Seu catálogo: <strong>' + esc(location.host + '/' + j.slug) + '</strong>' + (j.planoPago ? '<br>Pagamento identificado: <strong>plano ' + esc(({ fundador: 'Fundador', loja: 'Loja', anual: 'Loja anual' })[j.planoPago] || j.planoPago) + ' ativo</strong>.' : '<br>Teste grátis até <strong>' + esc(new Date(j.testeAte).toLocaleDateString('pt-BR')) + '</strong>.') + '</p>' +
          htmlCodigo(j.codigo) + '</div>';
        $('#cadastro-rodape').innerHTML = '<a class="btn btn--primario btn--bloco" href="/' + esc(j.slug) + '?bemvindo=1">Já guardei o código, abrir minha loja</a>';
      })
      .catch(function (er) { renderCadastro(er.message, er.campo); });
  });

  // ---------------------------------------------------------------------
  // Prévia do link (WhatsApp/Instagram): imagem 1200×630 com a cara da loja
  // ---------------------------------------------------------------------
  function assinaturaPrevia(p) {
    var v = p.visual, t = [p.nome, p.slogan, v.cor, v.destaque, v.fonte, v.logo, v.capa, p.tipo, 'v3'].join('|'), h = 5381;
    for (var i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function prepararPrevia(d) {
    var p = d.padaria, v = p.visual, ass = assinaturaPrevia(p);
    if (v.og && v.ogAss === ass) return Promise.resolve();
    var cor = v.cor || COR_PADRAO, dest = v.destaque || DESTAQUE_PADRAO;
    var fonte = (FONTES_LOJA[v.fonte] || FONTES_LOJA.moderno).css.replace('var(--fonte)', 'system-ui, sans-serif');
    var enfeite = '';   // (o desenho de açaí saiu; a prévia usa a capa ou a cor da loja)
    return Promise.all([carregarImagem(v.capa), carregarImagem(v.logo), document.fonts ? document.fonts.load('700 60px ' + fonte).catch(function () {}) : null, carregarImagem(enfeite)]).then(function (r) {
      var capa = r[0], logo = r[1], acai = r[3], W = 1200, H = 630;
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var g = cv.getContext('2d');
      g.fillStyle = cor; g.fillRect(0, 0, W, H);
      if (acai) {
        // sem foto de capa: o açaí 3D ao lado, com um brilho suave atrás
        var luz = g.createRadialGradient(940, 330, 20, 940, 330, 320);
        luz.addColorStop(0, 'rgba(255,255,255,0.22)'); luz.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = luz; g.fillRect(560, 0, 640, H);
        g.drawImage(acai, 940 - acai.width / 2, (H - acai.height) / 2, acai.width, acai.height);
      }
      if (capa) {
        var k = Math.max(W / capa.width, H / capa.height);
        g.drawImage(capa, (W - capa.width * k) / 2, (H - capa.height * k) / 2, capa.width * k, capa.height * k);
        var gr = g.createLinearGradient(0, 0, 0, H);
        gr.addColorStop(0, 'rgba(0,0,0,0.05)'); gr.addColorStop(0.45, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.78)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      var sobre = capa ? '#FFFFFF' : textoSobre(cor);
      var x = 70, y = H - 70;
      g.textAlign = 'left';
      g.fillStyle = sobre; g.globalAlpha = 0.9; g.font = '500 30px system-ui, sans-serif';
      g.fillText(ehAlimento(d) ? 'Cardápio em 3D · peça pelo WhatsApp' : 'Catálogo em 3D · peça pelo WhatsApp', x, y);
      g.globalAlpha = 1;
      if (p.slogan) { g.font = '400 34px system-ui, sans-serif'; y -= 56; g.fillText(p.slogan.slice(0, acai ? 34 : 60), x, y); }
      var larg = acai ? 640 : W - 140, tam = 76;
      g.font = '700 ' + tam + 'px ' + fonte;
      while (g.measureText(p.nome).width > larg && tam > 46) { tam -= 4; g.font = '700 ' + tam + 'px ' + fonte; }
      y -= 70;
      var nome = p.nome; while (g.measureText(nome).width > larg && nome.length > 4) nome = nome.slice(0, -2);
      g.fillText(nome === p.nome ? nome : nome + '…', x, y);
      g.fillStyle = dest; g.fillRect(x, y + 22, 90, 7);
      if (logo) {
        var lk = Math.min(300 / logo.width, 140 / logo.height), lw = logo.width * lk, lh = logo.height * lk;
        g.fillStyle = '#FFFFFF'; g.beginPath(); if (g.roundRect) g.roundRect(x - 4, 60, lw + 48, lh + 40, 26); else g.rect(x - 4, 60, lw + 48, lh + 40); g.fill();
        g.drawImage(logo, x + 20, 80, lw, lh);
      }
      var b64 = cv.toDataURL('image/jpeg', 0.86).split(',')[1];
      return fetch(comLoja('api/imagem'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ imagem: b64, tipo: 'image/jpeg', uso: 'og' }) })
        .then(function (resp) { return resp.json().then(function (j) { if (!resp.ok) throw new Error(j.erro || 'Erro ' + resp.status); return j; }); })
        .then(function (j) { v.og = j.url; v.ogAss = ass; });
    });
  }

  // ---------------------------------------------------------------------
  // Como usar: passo a passo que só abre quando a pessoa toca no "?"
  // ---------------------------------------------------------------------
  var IC = {
    toque: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 24V10a3 3 0 0 1 6 0v12"/><path d="M26 20a3 3 0 0 1 6 0v4"/><path d="M32 22a3 3 0 0 1 6 0v8c0 7-5 12-12 12h-2c-5 0-8-3-10-7l-4-8a3 3 0 0 1 5-3l5 6"/></svg>',
    copo: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M10 14h28l-4 28H14z"/><path d="M12 24h24M13 32h22" stroke-linecap="round"/><path d="M16 14c0-5 4-8 8-8s8 3 8 8"/></svg>',
    camera: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="6" y="12" width="36" height="26" rx="6"/><circle cx="24" cy="25" r="7"/><path d="M17 12l3-5h8l3 5"/></svg>',
    sacola: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M10 16h28l-2 26H12z"/><path d="M18 16v-3a6 6 0 0 1 12 0v3" stroke-linecap="round"/></svg>',
    zap: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M8 40l3-9a16 16 0 1 1 6 6z"/><path d="M18 18c0 7 5 12 12 12l2-3-4-2-2 2c-2-1-4-3-5-5l2-2-2-4z" stroke-width="2.4"/></svg>',
    chave: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="24" r="8"/><path d="M24 24h18M36 24v6M42 24v4"/></svg>',
    lista: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 12h22M18 24h22M18 36h22"/><circle cx="9" cy="12" r="2"/><circle cx="9" cy="24" r="2"/><circle cx="9" cy="36" r="2"/></svg>',
    moto: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="34" r="6"/><circle cx="37" cy="34" r="6"/><path d="M17 34h12l6-12h-8M27 14h6l4 8"/><path d="M11 28l6-8h8"/></svg>',
    pincel: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M30 8l10 10-16 16-10-10z"/><path d="M14 24c-6 0-8 4-8 8 0 4-2 6-2 6s10 2 14-2c3-3 2-6 2-6"/></svg>',
    qr: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><rect x="7" y="7" width="13" height="13" rx="2"/><rect x="28" y="7" width="13" height="13" rx="2"/><rect x="7" y="28" width="13" height="13" rx="2"/><path d="M28 28h5v5h-5zM36 36h5v5h-5zM36 28h5M28 41h3" stroke-linecap="round"/></svg>'
  };
  var TUTORIAIS = {
    cliente: [
      ['#7B2CBF', IC.toque, 'Escolha o móvel', 'Toque na foto ou no + . Dá para girar o móvel com o dedo e ver de todos os lados.'],
      ['#FF3D8B', IC.pincel, 'Escolha a cor', 'Se o móvel tiver outras cores de tecido ou acabamento, toque na cor: o 3D muda na hora.'],
      ['#0096C7', IC.camera, 'Veja na sua casa', 'Toque em “Ver na sua casa” e aponte o celular para o chão: o móvel aparece no tamanho real, com as medidas.'],
      ['#FF8A00', IC.sacola, 'Monte a lista', 'Adicione o que gostou ao orçamento. “Ver os itens juntos” mostra tudo lado a lado.'],
      ['#2E9E4F', IC.zap, 'Peça o orçamento', 'Toque em Orçamento → Continuar: a lista vai para o WhatsApp da loja, com as medidas de cada item.']
    ],
    loja: [
      ['#7B2CBF', IC.chave, 'Crie e entre', 'Toque em “Criar meu catálogo grátis”. Depois, para editar, use o botão de ajustes no topo da sua página.'],
      ['#FF3D8B', IC.lista, 'Seus produtos', 'Na aba Produtos: nome, preço e as medidas reais do móvel (largura, profundidade e altura).'],
      ['#9D4EDD', IC.copo, 'O 3D de verdade', 'Em cada produto, envie o arquivo 3D da fábrica (.glb) ou crie a partir de fotos. Sem 3D, o cliente não vê na casa dele.'],
      ['#0096C7', IC.moto, 'Entrega e orçamento', 'Na aba Pedidos: entrega ou retirada, taxa por bairro e o seu WhatsApp, que recebe os orçamentos.'],
      ['#FF8A00', IC.pincel, 'A cara da loja', 'Na aba Visual: cores, logo e foto de capa. Toque sempre em “Salvar alterações” para publicar.'],
      ['#2E9E4F', IC.qr, 'Divulgue', 'Mande o link de cada produto no WhatsApp e no Instagram. Na aba Divulgar, o cartaz com QR Code para a loja.']
    ]
  };

  var ajuda = { tipo: 'cliente', i: 0 };
  function abrirAjuda(tipo) {
    ajuda = { tipo: TUTORIAIS[tipo] ? tipo : 'cliente', i: 0 };
    $('#ajuda-titulo').textContent = ajuda.tipo === 'loja' ? 'Como usar (para a loja)' : 'Como pedir';
    renderAjuda();
    abrirDialogo($('#dlg-ajuda'));
  }
  function renderAjuda() {
    var lista = TUTORIAIS[ajuda.tipo], p = lista[ajuda.i], ultimo = ajuda.i === lista.length - 1;
    $('#ajuda-corpo').innerHTML = '<div class="ajuda">' +
      '<div class="ajuda__icone" style="background:' + p[0] + ';color:' + p[0] + '"><span style="color:#fff;display:contents">' + p[1] + '</span></div>' +
      '<span class="ajuda__passo">Passo ' + (ajuda.i + 1) + ' de ' + lista.length + '</span>' +
      '<h3>' + esc(p[2]) + '</h3><p>' + esc(p[3]) + '</p>' +
      '<div class="ajuda__pontos" aria-hidden="true">' + lista.map(function (_, k) { return '<i' + (k === ajuda.i ? ' class="ativo"' : '') + '></i>'; }).join('') + '</div>' +
      '</div>';
    $('#ajuda-rodape').innerHTML = '<div class="ajuda-nav">' +
      '<button class="btn btn--fantasma" type="button" data-ajuda-ir="-1"' + (ajuda.i ? '' : ' disabled') + '>Voltar</button>' +
      (ultimo ? '<button class="btn btn--primario" type="button" data-fechar>' + (ajuda.tipo === 'loja' && !LOJA ? 'Entendi' : 'Começar') + '</button>'
        : '<button class="btn btn--primario" type="button" data-ajuda-ir="1">Próximo</button>') + '</div>';
  }
  $('#dlg-ajuda').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ajuda-ir]');
    if (!b) return;
    ajuda.i = Math.max(0, Math.min(TUTORIAIS[ajuda.tipo].length - 1, ajuda.i + Number(b.getAttribute('data-ajuda-ir'))));
    renderAjuda();
  });
  // deslizar o dedo troca de passo
  (function () {
    var x0 = null, alvo = $('#ajuda-corpo');
    alvo.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    alvo.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 50) return;
      ajuda.i = Math.max(0, Math.min(TUTORIAIS[ajuda.tipo].length - 1, ajuda.i + (dx < 0 ? 1 : -1)));
      renderAjuda();
    }, { passive: true });
  })();

  // Confirmação dentro da página (não usa window.confirm, que alguns
  // ambientes incorporados bloqueiam)
  function confirmar(msg, rotulo) {
    var d = $('#dlg-confirmar');
    $('#confirmar-texto').textContent = msg;
    $('#confirmar-sim').textContent = rotulo || 'Confirmar';
    d.returnValue = '';
    d.showModal();
    return new Promise(function (ok) {
      d.addEventListener('close', function f() { d.removeEventListener('close', f); ok(d.returnValue === 'sim'); });
    });
  }

  // ---------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    clearTimeout(toastTimer);
    // popover = camada de cima: aparece mesmo com o painel (dialog) aberto
    if (t.showPopover) {
      try { if (t.matches(':popover-open')) t.hidePopover(); t.showPopover(); } catch (e) { /* navegador antigo */ }
      void t.offsetWidth;
    }
    t.classList.add('ver');
    toastTimer = setTimeout(function () {
      t.classList.remove('ver');
      toastTimer = setTimeout(function () { try { if (t.hidePopover) t.hidePopover(); } catch (e) { /* ok */ } }, 400);
    }, msg.length > 60 ? 5000 : 3000);
  }

  // ---------------------------------------------------------------------
  // Eventos do cardápio
  // ---------------------------------------------------------------------
  $('#grade').addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    var id = b.closest('.card').getAttribute('data-id');
    var acao = b.getAttribute('data-acao');
    if (acao === 'escolher') { abrirViewer(id, '3d'); return; }
    if (acao === 'add') {
      adicionar(id);
      var original = b.innerHTML;
      b.classList.add('feito');
      b.innerHTML = ICONES.ok + (b.classList.contains('card__add') ? '' : 'Adicionado');
      setTimeout(function () { b.classList.remove('feito'); b.innerHTML = original; }, 1200);
    } else {
      abrirViewer(id, acao);
    }
  });

  $('#categorias').addEventListener('click', function (e) {
    var c = e.target.closest('[data-cat]');
    if (!c) return;
    filtro.cat = c.getAttribute('data-cat');
    renderCategorias();
    renderGrade();
    var sel = $('#categorias [aria-selected="true"]');
    var nav = $('.categorias');
    if (sel && nav) nav.scrollTo({ left: sel.offsetLeft - (nav.clientWidth - sel.offsetWidth) / 2, behavior: reduzMovimento ? 'auto' : 'smooth' });
  });

  var tBusca;
  $('#busca').addEventListener('input', function (e) {
    clearTimeout(tBusca);
    tBusca = setTimeout(function () { filtro.q = e.target.value; renderGrade(); }, 120);
  });

  // Busca por medida: botão "Medidas", campos e "Limpar"
  $('#btn-medidas').addEventListener('click', function (e) {
    e.preventDefault();
    var painel = $('#painel-medidas'), abrir = painel.hidden;
    painel.hidden = !abrir;
    this.setAttribute('aria-expanded', String(abrir));
    if (abrir) setTimeout(function () { $('#med-l').focus(); }, 30);
  });
  var tMed;
  ['l', 'p', 'a'].forEach(function (k) {
    $('#med-' + k).addEventListener('input', function () {
      clearTimeout(tMed);
      tMed = setTimeout(function () { $('#busca').value = textoDosCampos(); filtro.q = $('#busca').value; renderGrade(); }, 250);
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-limpar-med]')) return;
    var lido = lerMedidas($('#busca').value);
    $('#busca').value = lido.med ? lido.texto : $('#busca').value;
    ['l', 'p', 'a'].forEach(function (k) { $('#med-' + k).value = ''; });
    filtro.q = $('#busca').value; renderGrade();
  });

  // ajusta o "sticky" dos filtros à altura real do topo
  var topbar = $('.topbar');
  function ajustarTopo() { $('#filtros').style.top = topbar.offsetHeight + 'px'; }
  if (window.ResizeObserver) new ResizeObserver(ajustarTopo).observe(topbar);
  ajustarTopo();
  window.addEventListener('scroll', function () { topbar.classList.toggle('rolou', window.scrollY > 8); }, { passive: true });

  function renderTudo() {
    renderCabecalho();
    renderCategorias();
    renderGrade();
    renderBlocos();
    atualizarBotaoEditar();
    atualizarContador();
  }

  // ---------------------------------------------------------------------
  // Seções da página da loja (banner, galeria, depoimentos, endereço) e
  // editor visual: o lojista edita textos, fotos e preços direto na tela.
  // ---------------------------------------------------------------------
  var editando = false;
  var TIPOS_SECAO = {
    banner: { nome: 'Banner com foto e texto', ico: '🖼️', novo: function () { return { tipo: 'banner', foto: '', titulo: 'Novidade na loja', texto: 'Escreva aqui a sua promoção, lançamento ou recado para o cliente.', botao: 'Chamar no WhatsApp', acao: 'whatsapp' }; } },
    galeria: { nome: 'Galeria de fotos', ico: '📷', novo: function () { return { tipo: 'galeria', titulo: 'Ambientes que montamos', fotos: [] }; } },
    depoimentos: { nome: 'Depoimentos de clientes', ico: '💬', novo: function () { return { tipo: 'depoimentos', titulo: 'O que os clientes dizem', itens: [{ texto: 'Escreva aqui o que o cliente falou da loja.', nome: 'Nome do cliente', foto: '' }] }; } },
    endereco: { nome: 'Endereço, mapa e redes sociais', ico: '📍', novo: function () { return { tipo: 'endereco', titulo: 'Venha nos visitar', endereco: '', horario: '', telefone: '', instagram: '', facebook: '', mapa: true }; } }
  };
  function blocosDaLoja() { var v = dados.padaria.visual || (dados.padaria.visual = validarVisual(null)); if (!Array.isArray(v.blocos)) v.blocos = []; return v.blocos; }
  function zapDaLoja() { var z = String(dados.padaria.whatsapp || '').replace(/\D/g, ''); return z.length >= 10 ? (z.length <= 11 ? '55' + z : z) : ''; }
  function campoEd(tag, campo, valor, classe, ph) {
    return '<' + tag + ' class="' + classe + '" data-campo="' + campo + '" data-ph="' + esc(ph || 'Escreva aqui') + '">' + esc(valor || '') + '</' + tag + '>';
  }
  function fotoEd(url, campo, classe, rotulo) {
    return '<div class="' + classe + (url ? '' : ' sem-foto') + '" data-foto="' + campo + '">' + (url ? '<img src="' + esc(url) + '" alt="" loading="lazy" decoding="async">' : '') +
      '<span class="so-edicao foto-troca">📷 ' + (url ? 'Trocar foto' : (rotulo || 'Pôr foto')) + '</span></div>';
  }
  function htmlBloco(b) {
    var corpo = '';
    if (b.tipo === 'banner') {
      var temBotao = b.acao && (b.acao !== 'whatsapp' || zapDaLoja());
      corpo = '<div class="sb-banner' + (b.foto ? '' : ' sb-banner--sem') + '">' + fotoEd(b.foto, 'foto', 'sb-banner__foto', 'Pôr foto do banner') +
        '<div class="sb-banner__txt">' + campoEd('h2', 'titulo', b.titulo, 'sb-titulo', 'Título') + campoEd('p', 'texto', b.texto, 'sb-texto', 'Texto') +
        (temBotao || editando ? '<span class="sb-botao-linha">' + (temBotao ? '<a class="btn btn--primario sb-botao" data-acao-banner="' + b.acao + '"' + (b.acao === 'whatsapp' ? ' href="https://wa.me/' + zapDaLoja() + '?text=' + encodeURIComponent('Olá! Vi no site: ' + (b.titulo || '')) + '" target="_blank" rel="noopener"' : ' href="#grade"') + '>' + campoEd('span', 'botao', b.botao || 'Saiba mais', '', 'Botão') + '</a>' : '') +
          '<select class="so-edicao sb-acao" data-acao-sel aria-label="O que o botão faz"><option value="whatsapp"' + (b.acao === 'whatsapp' ? ' selected' : '') + '>Botão abre o WhatsApp</option><option value="produtos"' + (b.acao === 'produtos' ? ' selected' : '') + '>Botão leva aos produtos</option><option value=""' + (!b.acao ? ' selected' : '') + '>Sem botão</option></select></span>' : '') +
        '</div></div>';
    } else if (b.tipo === 'galeria') {
      corpo = campoEd('h2', 'titulo', b.titulo, 'sb-titulo', 'Título da galeria') + '<div class="sb-galeria">' +
        b.fotos.map(function (f, i) { return '<figure class="sb-galeria__item" data-i="' + i + '"><img src="' + esc(f.url) + '" alt="' + esc(f.legenda) + '" loading="lazy" decoding="async">' + (f.legenda || editando ? campoEd('figcaption', 'legenda', f.legenda, '', 'Legenda (opcional)') : '') + '<button class="so-edicao sb-x" type="button" data-tirar-foto="' + i + '" aria-label="Tirar foto">✕</button></figure>'; }).join('') +
        '<label class="so-edicao sb-galeria__add">＋ Pôr fotos<input type="file" accept="image/*" multiple hidden data-galeria-add></label></div>';
    } else if (b.tipo === 'depoimentos') {
      corpo = campoEd('h2', 'titulo', b.titulo, 'sb-titulo', 'Título') + '<div class="sb-depo">' +
        b.itens.map(function (d, i) {
          return '<figure class="sb-depo__item" data-i="' + i + '">' + campoEd('blockquote', 'texto', d.texto, '', 'O que o cliente disse') +
            '<figcaption>' + fotoEd(d.foto, 'foto', 'sb-depo__foto', 'Foto') + campoEd('span', 'nome', d.nome, 'sb-depo__nome', 'Nome do cliente') + '</figcaption>' +
            '<button class="so-edicao sb-x" type="button" data-tirar-item="' + i + '" aria-label="Tirar depoimento">✕</button></figure>';
        }).join('') + '<button class="so-edicao sb-depo__add" type="button" data-depo-add>＋ Depoimento</button></div>';
    } else if (b.tipo === 'endereco') {
      var ig = b.instagram, fb = b.facebook;
      corpo = campoEd('h2', 'titulo', b.titulo, 'sb-titulo', 'Título') + '<div class="sb-end">' +
        '<div class="sb-end__dados">' +
          (b.endereco || editando ? '<p class="sb-end__linha"><span aria-hidden="true">📍</span>' + campoEd('span', 'endereco', b.endereco, '', 'Rua, número, bairro, cidade') + '</p>' : '') +
          (b.horario || editando ? '<p class="sb-end__linha"><span aria-hidden="true">🕘</span>' + campoEd('span', 'horario', b.horario, '', 'Ex.: Seg. a sáb., 9h às 18h') + '</p>' : '') +
          (b.telefone || editando ? '<p class="sb-end__linha"><span aria-hidden="true">📞</span>' + campoEd('span', 'telefone', b.telefone, '', 'Telefone') + '</p>' : '') +
          '<p class="sb-redes">' +
            (editando ? '<span class="sb-end__linha"><span aria-hidden="true">📸</span>@' + campoEd('span', 'instagram', ig, '', 'instagram da loja') + '</span><span class="sb-end__linha"><span aria-hidden="true">👍</span>facebook.com/' + campoEd('span', 'facebook', fb, '', 'página') + '</span>'
              : (ig ? '<a class="btn btn--sec btn--p" href="https://instagram.com/' + encodeURIComponent(ig) + '" target="_blank" rel="noopener">Instagram</a>' : '') +
                (fb ? '<a class="btn btn--sec btn--p" href="https://facebook.com/' + esc(fb) + '" target="_blank" rel="noopener">Facebook</a>' : '') +
                (b.endereco ? '<a class="btn btn--sec btn--p" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(b.endereco) + '" target="_blank" rel="noopener">Como chegar</a>' : '')) +
          '</p>' +
          '<label class="so-edicao sb-mapa-op"><input type="checkbox" data-mapa' + (b.mapa ? ' checked' : '') + '> Mostrar o mapa</label>' +
        '</div>' +
        (b.mapa && b.endereco ? '<iframe class="sb-mapa" title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + encodeURIComponent(b.endereco) + '&output=embed"></iframe>' : '') +
      '</div>';
    }
    return '<section class="sb sb--' + b.tipo + '" data-bloco="' + esc(b.id) + '">' + corpo +
      '<div class="so-edicao sb-ferramentas"><span>' + TIPOS_SECAO[b.tipo].ico + ' ' + TIPOS_SECAO[b.tipo].nome + '</span>' +
      '<button type="button" data-mover="-1" aria-label="Subir">↑</button><button type="button" data-mover="1" aria-label="Descer">↓</button><button type="button" data-apagar aria-label="Apagar seção">🗑</button></div></section>';
  }
  function botaoAdd(pos) { return editando ? '<button class="add-secao" type="button" data-add-pos="' + pos + '">＋ Adicionar seção aqui</button>' : ''; }
  function renderBlocos() {
    var antes = $('#blocos-antes'), depois = $('#blocos-depois');
    if (!antes || !depois) return;
    if (!LOJA) { antes.innerHTML = depois.innerHTML = ''; return; }
    var bl = blocosDaLoja(), ip = -1;
    bl.forEach(function (b, i) { if (b.tipo === 'produtos') ip = i; });
    if (ip < 0) ip = -0.5; // sem marcador: produtos antes de tudo
    var ha = '', hd = '';
    bl.forEach(function (b, i) {
      if (b.tipo === 'produtos') return;
      var h = botaoAdd(i) + htmlBloco(b);
      if (i < ip) ha += h; else hd += h;
    });
    antes.innerHTML = ha + (editando ? botaoAdd(ip < 0 ? 0 : ip) : '');
    depois.innerHTML = hd + (editando ? botaoAdd(bl.length) : '');
    // no modo edição, o botão logo antes dos produtos insere antes deles
    if (editando) {
      $$('[data-campo]', antes).concat($$('[data-campo]', depois)).forEach(function (el) { el.setAttribute('contenteditable', 'plaintext-only'); if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'true'); });
    }
  }
  function blocoDoAlvo(el) { var s = el.closest('[data-bloco]'); if (!s) return null; var id = s.getAttribute('data-bloco'); return blocosDaLoja().filter(function (b) { return b.id === id; })[0] || null; }
  function inserirBloco(pos, tipo) {
    var bl = blocosDaLoja();
    var b = TIPOS_SECAO[tipo].novo(); b.id = Math.random().toString(36).slice(2, 10);
    bl.splice(Math.max(0, Math.min(bl.length, pos)), 0, b);
    marcarMudanca(); renderBlocos();
    var el = document.querySelector('[data-bloco="' + b.id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function escolherTipoSecao(pos) {
    var dlg = $('#dlg-secao');
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.id = 'dlg-secao'; dlg.className = 'folha folha--ajuda';
      dlg.innerHTML = '<div class="painel"><div class="painel__topo"><h2>Adicionar seção</h2><button class="icone-btn" type="button" data-fechar aria-label="Fechar">✕</button></div>' +
        '<div class="tipos-secao">' + Object.keys(TIPOS_SECAO).map(function (k) { return '<button type="button" class="tipo-secao" data-tipo="' + k + '"><span>' + TIPOS_SECAO[k].ico + '</span>' + TIPOS_SECAO[k].nome + '</button>'; }).join('') + '</div></div>';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (e) {
        var t = e.target.closest('[data-tipo]');
        if (t) { dlg.close(); inserirBloco(Number(dlg.getAttribute('data-pos')), t.getAttribute('data-tipo')); }
        else if (e.target.closest('[data-fechar]') || e.target === dlg) dlg.close();
      });
    }
    dlg.setAttribute('data-pos', pos); dlg.showModal();
  }
  function enviarFotoSite(arquivo, uso, ladoMax) {
    if (!credenciais()) { toast('Entre na conta da loja para trocar fotos'); return Promise.reject(new Error('sem login')); }
    toast('Enviando foto…');
    return reduzirParaEnvio(arquivo, ladoMax || 1600, false).then(function (r) {
      return fetch(comLoja('api/imagem'), { method: 'POST', headers: cabecalhos(), body: JSON.stringify({ imagem: r.base64, tipo: r.tipo, uso: uso }) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.url) throw new Error(j.erro || 'Erro do servidor (' + r.status + ').'); return j.url; });
    }).catch(function (e) { toast(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); throw e; });
  }
  function escolherArquivo(multiplos) {
    return new Promise(function (ok) {
      var i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multiplos;
      i.onchange = function () { ok(Array.prototype.slice.call(i.files || [])); }; i.click();
    });
  }

  // --- modo edição ---
  var mudou = false;
  function marcarMudanca() { mudou = true; var b = $('#ed-salvar'); if (b) b.disabled = false; }
  function podeEditarSite() { return !!(LOJA && servidor && lerTokenLoja()); }
  function atualizarBotaoEditar() {
    var f = $('#btn-editar-site');
    if (!f) {
      f = document.createElement('button'); f.id = 'btn-editar-site'; f.type = 'button'; f.className = 'btn-editar-site';
      f.innerHTML = '✏️ Editar o site'; f.addEventListener('click', entrarEdicao); document.body.appendChild(f);
    }
    f.hidden = !podeEditarSite() || editando;
  }
  function entrarEdicao() {
    if (!podeEditarSite()) { toast('Entre na conta da loja (botão Admin) para editar o site.'); return; }
    editando = true; mudou = false;
    // marca a posição dos produtos na lista de seções (para dar para pôr seções antes ou depois deles)
    var bl0 = blocosDaLoja(); if (!bl0.some(function (b) { return b.tipo === 'produtos'; })) bl0.unshift({ id: 'produtos', tipo: 'produtos' });
    document.documentElement.classList.add('editando');
    var barra = $('#barra-edicao');
    if (!barra) {
      barra = document.createElement('div'); barra.id = 'barra-edicao'; barra.className = 'barra-edicao';
      barra.innerHTML = '<div class="barra-edicao__txt"><b>✏️ Editando o site</b><span>Toque em qualquer texto, preço ou foto para mudar</span></div>' +
        '<button type="button" class="btn btn--sec btn--p" id="ed-sair">Sair</button><button type="button" class="btn btn--primario btn--p" id="ed-salvar" disabled>Publicar</button>';
      document.body.appendChild(barra);
      $('#ed-sair').addEventListener('click', sairEdicao);
      $('#ed-salvar').addEventListener('click', publicarEdicao);
    }
    barra.hidden = false;
    var hero = $('.hero');
    if (hero && !$('#ed-hero')) {
      var h = document.createElement('div'); h.id = 'ed-hero'; h.className = 'so-edicao ed-hero';
      h.innerHTML = '<button type="button" class="btn btn--sec btn--p" data-ed-img="capa">📷 Foto de capa</button><button type="button" class="btn btn--sec btn--p" data-ed-img="logo">🏷️ Logo</button>' +
        '<button type="button" class="btn btn--fantasma btn--p" data-ed-img-tirar="capa">Tirar capa</button>';
      hero.appendChild(h);
    }
    ['#nome-padaria', '#slogan-padaria'].forEach(function (sel) { var el = $(sel); el.setAttribute('contenteditable', 'true'); el.setAttribute('data-ph', sel === '#nome-padaria' ? 'Nome da loja' : 'Frase da loja'); });
    renderGrade(); renderBlocos(); atualizarBotaoEditar();
    toast('Toque no que quiser mudar. No fim, toque em “Publicar”.');
  }
  function sairEdicao() {
    var sair = function () {
      editando = false; document.documentElement.classList.remove('editando');
      var barra = $('#barra-edicao'); if (barra) barra.hidden = true;
      ['#nome-padaria', '#slogan-padaria'].forEach(function (sel) { $(sel).removeAttribute('contenteditable'); });
      if (mudou) { var guardado = ler(CHAVE_DADOS); if (guardado) { var d = validarDados(guardado); if (d) dados = d; } }
      mudou = false; renderTudo(); atualizarBotaoEditar();
    };
    if (!mudou) return sair();
    confirmar('Sair sem publicar? As mudanças feitas agora serão perdidas.', 'Sair sem publicar').then(function (sim) { if (sim) sair(); });
  }
  function publicarEdicao() {
    var b = $('#ed-salvar'); b.disabled = true; b.textContent = 'Publicando…';
    var d = validarDados(dados);
    if (!d) { toast('Algo ficou inválido. Confira os textos e preços.'); b.disabled = false; b.textContent = 'Publicar'; return; }
    dados = d; CATEGORIAS = dados.categorias; gravar(CHAVE_DADOS, dados);
    fetch(comLoja('api/cardapio'), { method: 'PUT', headers: cabecalhos(), body: JSON.stringify(dados) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || 'erro ao publicar'); }); })
      .then(function () { mudou = false; toast('Publicado: todos os clientes já veem o site novo'); b.textContent = 'Publicar'; })
      .catch(function (e) { b.disabled = false; b.textContent = 'Publicar'; toast('Não publicou: ' + (/failed to fetch|network/i.test(e.message) ? 'sem conexão' : e.message)); });
  }
  // preço digitado ("R$ 2.490,00", "2490", "2.490,5") → número
  function lerPrecoDigitado(t) { var s = String(t || '').replace(/[^\d,.]/g, ''); if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.'); else if (/\.\d{3}$/.test(s)) s = s.replace(/\./g, ''); var n = parseFloat(s); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; }

  // textos: hero, produtos e seções
  document.addEventListener('input', function (e) {
    if (!editando) return;
    var el = e.target.closest('[contenteditable]'); if (!el) return;
    var t = el.innerText.replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
    if (el.id === 'nome-padaria') dados.padaria.nome = t.slice(0, 80);
    else if (el.id === 'slogan-padaria') dados.padaria.slogan = t.slice(0, 140);
    else if (el.closest('.card')) {
      var p = dados.produtos.filter(function (x) { return x.id === el.closest('.card').getAttribute('data-id'); })[0]; if (!p) return;
      if (el.classList.contains('card__nome')) p.nome = t.slice(0, 80);
      else if (el.classList.contains('card__desc')) p.descricao = t.slice(0, 400);
      else return;
    } else {
      var b = blocoDoAlvo(el), campo = el.getAttribute('data-campo'); if (!b || !campo) return;
      var item = el.closest('[data-i]');
      if (b.tipo === 'galeria' && item) b.fotos[Number(item.getAttribute('data-i'))][campo] = t;
      else if (b.tipo === 'depoimentos' && item) b.itens[Number(item.getAttribute('data-i'))][campo] = t;
      else b[campo] = t;
    }
    marcarMudanca();
  });
  // preço: confere ao sair do campo
  document.addEventListener('focusout', function (e) {
    if (!editando || !e.target.classList || !e.target.classList.contains('card__preco-ed')) return;
    var p = dados.produtos.filter(function (x) { return x.id === e.target.closest('.card').getAttribute('data-id'); })[0]; if (!p) return;
    var n = lerPrecoDigitado(e.target.innerText);
    if (n == null || n > 1000000) { toast('Preço inválido. Ex.: 2.490,00'); e.target.innerText = brl(p.preco); return; }
    if (n !== p.preco) { p.preco = n; marcarMudanca(); }
    e.target.innerText = brl(p.preco);
  });
  document.addEventListener('keydown', function (e) {
    if (!editando || e.key !== 'Enter') return;
    var el = e.target.closest && e.target.closest('[contenteditable]');
    // títulos, nomes e preços são de uma linha só
    if (el && (el.matches('h1, h2, .card__nome, .card__preco-ed, span, figcaption'))) { e.preventDefault(); el.blur(); }
  });
  // cliques do modo edição (vêm antes dos cliques normais da página)
  document.addEventListener('click', function (e) {
    if (!editando) return;
    var t = e.target;
    if (t.closest('#barra-edicao') || t.closest('dialog')) return;
    var add = t.closest('[data-add-pos]'); if (add) { e.preventDefault(); escolherTipoSecao(Number(add.getAttribute('data-add-pos'))); return; }
    var b = blocoDoAlvo(t);
    if (t.closest('[contenteditable]')) { if (t.closest('a')) e.preventDefault(); return; }
    if (t.closest('[data-ed-img]')) {
      var uso = t.closest('[data-ed-img]').getAttribute('data-ed-img');
      escolherArquivo(false).then(function (fs) { if (!fs[0]) return; return enviarFotoSite(fs[0], uso, uso === 'logo' ? 640 : 1800).then(function (u) { dados.padaria.visual[uso] = u; marcarMudanca(); aplicarVisual(dados.padaria); toast('Foto trocada. Toque em “Publicar” para salvar.'); }); }).catch(function () {});
      return;
    }
    if (t.closest('[data-ed-img-tirar]')) { dados.padaria.visual.capa = ''; marcarMudanca(); aplicarVisual(dados.padaria); return; }
    if (b) {
      e.preventDefault();
      var bl = blocosDaLoja(), i = bl.indexOf(b);
      if (t.closest('[data-mover]')) { var j = i + Number(t.closest('[data-mover]').getAttribute('data-mover')); if (j < 0 || j >= bl.length) return; bl.splice(i, 1); bl.splice(j, 0, b); marcarMudanca(); renderBlocos(); return; }
      if (t.closest('[data-apagar]')) { confirmar('Apagar esta seção?', 'Apagar').then(function (s) { if (!s) return; bl.splice(bl.indexOf(b), 1); marcarMudanca(); renderBlocos(); }); return; }
      if (t.closest('[data-tirar-foto]')) { b.fotos.splice(Number(t.closest('[data-tirar-foto]').getAttribute('data-tirar-foto')), 1); marcarMudanca(); renderBlocos(); return; }
      if (t.closest('[data-tirar-item]')) { b.itens.splice(Number(t.closest('[data-tirar-item]').getAttribute('data-tirar-item')), 1); marcarMudanca(); renderBlocos(); return; }
      if (t.closest('[data-depo-add]')) { if (b.itens.length >= 8) return toast('Até 8 depoimentos'); b.itens.push({ texto: '', nome: '', foto: '' }); marcarMudanca(); renderBlocos(); return; }
      if (t.closest('[data-galeria-add]') || t.closest('.sb-galeria__add')) { if (t.tagName !== 'INPUT') { e.preventDefault(); var inp = t.closest('[data-bloco]').querySelector('[data-galeria-add]'); inp.click(); } return; }
      var ft = t.closest('[data-foto]');
      if (ft) {
        var it = ft.closest('[data-i]');
        escolherArquivo(false).then(function (fs) { if (!fs[0]) return; return enviarFotoSite(fs[0], 'secao', b.tipo === 'depoimentos' ? 400 : 1800).then(function (u) {
          if (b.tipo === 'depoimentos' && it) b.itens[Number(it.getAttribute('data-i'))].foto = u; else b.foto = u;
          marcarMudanca(); renderBlocos();
        }); }).catch(function () {});
      }
      return;
    }
    // produtos: foto (só quem não tem 3D) e nada de abrir o produto enquanto edita
    var card = t.closest('.card');
    if (card) {
      if (t.closest('[contenteditable]')) return;
      e.preventDefault(); e.stopPropagation();
      var p = dados.produtos.filter(function (x) { return x.id === card.getAttribute('data-id'); })[0];
      if (p && !p.modelo && t.closest('.card__vitrine')) {
        escolherArquivo(false).then(function (fs) { if (!fs[0]) return; return enviarFotoSite(fs[0], 'produto', 1400).then(function (u) { p.foto = u; marcarMudanca(); renderGrade(); }); }).catch(function () {});
      } else if (p && p.modelo && t.closest('.card__vitrine')) toast('Este produto mostra o 3D. Para trocar o 3D, use o Admin → Produtos.');
      return;
    }
  }, true);
  document.addEventListener('change', function (e) {
    if (!editando) return;
    var t = e.target, b = blocoDoAlvo(t); if (!b) return;
    if (t.matches('[data-acao-sel]')) { b.acao = t.value; if (b.acao && !b.botao) b.botao = b.acao === 'whatsapp' ? 'Chamar no WhatsApp' : 'Ver os produtos'; marcarMudanca(); renderBlocos(); }
    else if (t.matches('[data-mapa]')) { b.mapa = t.checked; marcarMudanca(); renderBlocos(); }
    else if (t.matches('[data-galeria-add]') && t.files && t.files.length) {
      var fs = Array.prototype.slice.call(t.files, 0, 12 - b.fotos.length); t.value = '';
      fs.reduce(function (pr, f) { return pr.then(function () { return enviarFotoSite(f, 'secao', 1600).then(function (u) { b.fotos.push({ url: u, legenda: '' }); renderBlocos(); }); }); }, Promise.resolve())
        .then(function () { marcarMudanca(); toast('Fotos adicionadas. Toque em “Publicar” para salvar.'); }).catch(function () { marcarMudanca(); });
    }
  });
  // botão "ver os produtos" do banner rola até a grade
  document.addEventListener('click', function (e) {
    var a = !editando && e.target.closest('[data-acao-banner="produtos"]');
    if (a) { e.preventDefault(); $('#filtros').scrollIntoView({ behavior: 'smooth' }); }
  });
  window.addEventListener('beforeunload', function (e) { if (editando && mudou) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------
  renderTudo();
  carregarNuvem().then(function () {
    atualizarBotaoEditar();
    if (BEM_VINDO && LOJA && lerTokenLoja()) {
      try { history.replaceState(null, '', location.pathname); } catch (e) { /* ok */ }
      abertoNoAdmin = null;
      rascunho = clonar(dados); renderAdmin(); abrirDialogo($('#dlg-admin'));
      toast('Sua loja está no ar! Ajuste preços, horário e WhatsApp e toque em Salvar.');
      return;
    }
    abrirProdutoDoLink();
  });
  setInterval(renderCabecalho, 60000);
  // Link direto para um produto (etiqueta com QR Code): /<loja>?p=<id>&qr=1
  function abrirProdutoDoLink() {
    var m = location.search.match(/[?&]p=([^&#]+)/);
    if (!m || !LOJA || indisponivel) return;
    var id = ''; try { id = decodeURIComponent(m[1]); } catch (e) { return; }
    var veioDoQr = /[?&]qr=1/.test(location.search);
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ok */ }
    if (!produtoPorId(id)) { toast('Este produto não está mais no ' + termo() + '. Veja os outros.'); return; }
    if (veioDoQr) registrar('qr', id);
    abrirViewer(id, '3d');
  }

  // Versão nova publicada enquanto a aba estava aberta: oferece recarregar
  (function () {
    if (location.protocol === 'file:') return;
    var inicial = null, ultima = 0;
    function versao() {
      return fetch('app.js', { method: 'HEAD', cache: 'no-store' }).then(function (r) { return r.ok ? r.headers.get('etag') || r.headers.get('last-modified') : null; }).catch(function () { return null; });
    }
    versao().then(function (v) { inicial = v; ultima = Date.now(); });
    function conferir() {
      if (document.visibilityState !== 'visible' || !inicial || Date.now() - ultima < 5 * 60000 || $('.versao-nova')) return;
      ultima = Date.now();
      versao().then(function (v) {
        if (!v || v === inicial) return;
        var el = document.createElement('div');
        el.className = 'versao-nova'; el.setAttribute('role', 'status');
        el.innerHTML = '<span>Tem versão nova do ' + termo() + '</span><button type="button">Atualizar</button>';
        el.querySelector('button').addEventListener('click', function () { location.reload(); });
        document.body.appendChild(el);
      });
    }
    document.addEventListener('visibilitychange', conferir);
    window.addEventListener('focus', conferir);
  })();
  $('#land-criar').addEventListener('click', abrirCadastro);
  $('#land-criar-2').addEventListener('click', abrirCadastro);
  $('#lp-planos').innerHTML = htmlPlanos(null);
  $('#lp-planos').addEventListener('click', function (e) { if (e.target.closest('[data-plano]')) abrirCadastro(); });
  // Pedido de demonstração: o lojista deixa o nome da loja e o WhatsApp; aparece no painel do dono
  var contato = { loja: '', whatsapp: '', cidade: '' };
  function abrirContato() {
    renderContato();
    abrirDialogo($('#dlg-contato'));
  }
  function renderContato(erro, campoErro, enviado) {
    if (enviado) {
      $('#contato-corpo').innerHTML = '<div class="contato-ok"><strong>Recebemos seu pedido!</strong>' +
        '<p>Vamos chamar no WhatsApp <b>' + esc(contato.whatsapp) + '</b> para montar a demonstração com os móveis da <b>' + esc(contato.loja) + '</b>.</p>' +
        '<p class="mini">Com pressa? Fale direto com a gente pelo botão de suporte.</p></div>';
      $('#contato-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" data-fechar>Fechar</button>';
      return;
    }
    var c = function (rot, id, attrs) { return campo(rot, '<input id="ct-' + id + '" ' + attrs + ' value="' + esc(contato[id]) + '"' + (campoErro === id ? ' aria-invalid="true"' : '') + '>'); };
    $('#contato-corpo').innerHTML =
      '<p class="cadastro__intro">Deixe o contato da sua loja. A gente monta uma página de teste com <strong>2 ou 3 móveis seus</strong> em 3D e te mostra pelo WhatsApp, sem custo e sem compromisso.</p>' +
      c('Nome da loja', 'loja', 'maxlength="80" autocomplete="organization" placeholder="Ex.: Casa & Sala Móveis"') +
      c('WhatsApp (com DDD)', 'whatsapp', 'inputmode="tel" maxlength="16" autocomplete="tel" placeholder="DDD + número"') +
      c('Cidade (opcional)', 'cidade', 'maxlength="60" autocomplete="address-level2"') +
      '<input id="ct-site" tabindex="-1" autocomplete="off" aria-hidden="true" class="isca">' +
      (erro ? '<div class="ar-indisp" role="alert">' + esc(erro) + '</div>' : '');
    $('#contato-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="ct-enviar">Pedir demonstração</button>';
    if (campoErro) { var el = $('#ct-' + campoErro); if (el) el.focus(); }
  }
  function enviarContato(btn) {
    ['loja', 'whatsapp', 'cidade'].forEach(function (k) { contato[k] = $('#ct-' + k).value.trim(); });
    btn.disabled = true; btn.textContent = 'Enviando…';
    postarJson('api/contato', { loja: contato.loja, whatsapp: contato.whatsapp, cidade: contato.cidade, site: $('#ct-site').value })
      .then(function () { renderContato(null, null, true); })
      .catch(function (e) { renderContato(e.message, e.campo); });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-pedir-demo]')) { abrirContato(); return; }
    var b = e.target.closest('#ct-enviar'); if (b) enviarContato(b);
  });

  // Suporte da empresa: link no fim da página e botão flutuante (só na página inicial)
  function linkSuporteEmpresa(texto) { return 'https://wa.me/' + suporteMenuReal + '?text=' + encodeURIComponent(texto); }
  function atualizarBotoesSuporte() {
    var a = $('#lp-falar');
    if (a) { a.href = linkSuporteEmpresa('Olá! Vi o MenuReal e quero saber mais para a minha loja.'); a.target = '_blank'; a.rel = 'noopener'; }
    var f = $('#btn-suporte');
    if (f) { f.href = linkSuporteEmpresa('Olá! Preciso de ajuda com o MenuReal.'); f.hidden = !!LOJA; }
  }
  atualizarBotoesSuporte();
  if (!LOJA) {
    fetch('api/cadastro', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.suporte) { suporteMenuReal = j.suporte; atualizarBotoesSuporte(); }
      if (j.checkouts && Object.keys(j.checkouts).length) {
        Object.keys(j.checkouts).forEach(function (t) { if (/^https:\/\/pay\.kiwify\.com\.br\/[\w-]+\/?$/.test(j.checkouts[t])) checkoutsPublicos[t] = j.checkouts[t]; });
        $('#lp-planos').innerHTML = htmlPlanos(null);
        var nota = $('#lp-pagar-nota'); if (nota) nota.hidden = false;
      }
    }).catch(function () { /* fica o número padrão */ });
    // voltou da Kiwify depois de pagar: abre o cadastro pedindo o mesmo e-mail da compra
    if (/[?&]comprou=1/.test(location.search)) { setTimeout(function () { abrirCadastro(true); }, 300); }
  }
  $('#btn-ajuda').addEventListener('click', function () { abrirAjuda(LOJA ? 'cliente' : 'loja'); });
  $('#admin-ajuda').addEventListener('click', function () { abrirAjuda('loja'); });
  if (ABRIR_CADASTRO) abrirCadastro();

  carregarModelViewer().then(function (ok) {
    mvStatus = ok ? 'ok' : 'falhou';
    if (!ok) {
      console.error('[MenuReal] <model-viewer> não carregou. 3D e RA indisponíveis.');
      $$('#grade [data-estado]').forEach(marcarCardSemBiblioteca);
      toast('A visualização 3D não carregou. Verifique a conexão.');
      if (dlgViewer.open && produtoAtual) abrirViewer(produtoAtual.id, $('#aba-ar').getAttribute('aria-selected') === 'true' ? 'ar' : '3d');
    }
  });
})();
