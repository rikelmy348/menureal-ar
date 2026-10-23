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
  var LOJA = (function () {
    var s = decodeURIComponent(location.pathname).replace(/^\/+|\/+$/g, '').toLowerCase();
    return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s) ? s : '';
  })();
  var SUFIXO = LOJA ? ':' + LOJA : '';
  var CHAVE_DADOS = 'menureal:dados:v1' + SUFIXO;
  var CHAVE_CARRINHO = 'menureal:carrinho:v1' + SUFIXO;
  var CHAVE_TOKEN = 'menureal:token' + SUFIXO;
  var CATEGORIAS_PADRAO = ['Salgados', 'Doces', 'Pães', 'Bebidas'];
  var CATEGORIAS = CATEGORIAS_PADRAO.slice();
  // Alérgenos de declaração obrigatória no Brasil (RDC Anvisa 26/2015), agrupados
  var ALERGENOS = ['Glúten', 'Leite', 'Ovos', 'Soja', 'Amendoim', 'Castanhas e nozes', 'Peixes', 'Crustáceos', 'Látex natural'];
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var TOLERANCIA_ESCALA = 0.05; // 5% de diferença aceitável entre arquivo e cadastro

  // Na versão de arquivo único, os GLBs vêm embutidos como data: URI
  var MODELOS_EMBUTIDOS = window.MENUREAL_MODELOS || null;
  var reduzMovimento = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Dados de demonstração. Preços e medidas são FICTÍCIOS.
  // Medidas em centímetros: largura (X), profundidade (Z), altura (Y).
  var TIPOS_3D = [
    ['', 'Não aparece no 3D'], ['granola', 'Granola'], ['banana', 'Banana'], ['morango', 'Morango em fatias'], ['morango_picado', 'Morango picado'],
    ['leite_condensado', 'Leite condensado'], ['leite_po', 'Leite em pó'], ['pacoca', 'Paçoca'], ['confete', 'Confete'],
    ['calda_chocolate', 'Calda de chocolate'], ['nutella', 'Nutella (por cima)'],
    ['camada_creme', 'Camada de creme (dentro do copo)'], ['camada_morango', 'Camada de morango picado (dentro do copo)'],
    ['camada_nutella', 'Camada de Nutella (dentro do copo)']
  ];
  var TIPOS_PIX = [['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['telefone', 'Celular'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']];
  var ADICIONAIS_ACAI = [
    { id: 'creme-ninho', nome: 'Creme de ninho', preco: 4.00, tipo3d: 'camada_creme' },
    { id: 'morango', nome: 'Morango', preco: 3.00, tipo3d: 'morango_picado' },
    { id: 'banana', nome: 'Banana', preco: 2.00, tipo3d: 'banana' },
    { id: 'nutella', nome: 'Nutella', preco: 5.00, tipo3d: 'nutella' },
    { id: 'leite-condensado', nome: 'Leite condensado', preco: 2.50, tipo3d: 'leite_condensado' },
    { id: 'leite-po', nome: 'Leite em pó', preco: 2.50, tipo3d: 'leite_po' },
    { id: 'granola', nome: 'Granola', preco: 2.00, tipo3d: 'granola' },
    { id: 'pacoca', nome: 'Paçoca', preco: 2.00, tipo3d: 'pacoca' },
    { id: 'confete', nome: 'Confete', preco: 2.50, tipo3d: 'confete' },
    { id: 'calda-chocolate', nome: 'Calda de chocolate', preco: 3.00, tipo3d: 'calda_chocolate' }
  ];

  var PADRAO = {
    padaria: {
      nome: 'Padaria Sabor da Vila',
      slogan: 'Veja antes de pedir',
      abre: '06:00',
      fecha: '20:00',
      dias: [1, 2, 3, 4, 5, 6],
      whatsapp: '', // ex.: 5511999999999 (DDI + DDD + número). Vazio = desativado.
      pedido: { entrega: true, retirada: true, taxa: 5, bairros: [{ nome: 'Centro', taxa: 4 }, { nome: 'Vila Nova', taxa: 6 }], minimo: 15, tempo: '30 a 45 min',
        endereco: 'Rua das Flores, 100 — Centro', pix: { tipo: 'email', chave: '', nome: '', cidade: '' } }
    },
    produtos: [
      { id: 'acai', nome: 'Açaí — monte o seu', categoria: 'Açaí', preco: 16.00,
        descricao: 'Escolha o copo e os adicionais: cada um cai em cima do açaí. Depois veja na mesa, no tamanho real.',
        dim: { largura: 9.6, profundidade: 9.6, altura: 11.7 }, modelo: 'assets/models/acai-pet-500.glb', ilustrativo: true,
        tamanhos: [
          { id: '300', nome: '300 ml', preco: 13.00, dim: { largura: 8.6, profundidade: 8.6, altura: 9.6 }, modelo: 'assets/models/acai-pet-300.glb' },
          { id: '500', nome: '500 ml', preco: 16.00, dim: { largura: 9.6, profundidade: 9.6, altura: 11.7 }, modelo: 'assets/models/acai-pet-500.glb' },
          { id: '700', nome: '700 ml', preco: 20.00, dim: { largura: 10.6, profundidade: 10.6, altura: 13.5 }, modelo: 'assets/models/acai-pet-700.glb' }
        ],
        adicionais: ADICIONAIS_ACAI, montar: true },
      { id: 'coxinha', nome: 'Coxinha de frango', categoria: 'Salgados', preco: 8.00,
        descricao: 'Massa de batata com recheio de frango desfiado temperado, empanada e frita na hora.',
        dim: { largura: 5, profundidade: 5, altura: 9 }, modelo: 'assets/models/coxinha.glb', ilustrativo: true },
      { id: 'pao-de-queijo', nome: 'Pão de queijo', categoria: 'Pães', preco: 4.50,
        descricao: 'Feito com polvilho e queijo meia-cura. Casquinha crocante e miolo macio.',
        dim: { largura: 5, profundidade: 5, altura: 4 }, modelo: 'assets/models/pao-de-queijo.glb', ilustrativo: true },
      { id: 'pastel', nome: 'Pastel assado', categoria: 'Salgados', preco: 7.00,
        descricao: 'Massa amanteigada assada, pincelada com gema. Recheio de carne moída.',
        dim: { largura: 12, profundidade: 8, altura: 3 }, modelo: 'assets/models/pastel.glb', ilustrativo: true },
      { id: 'croissant', nome: 'Croissant', categoria: 'Pães', preco: 9.00,
        descricao: 'Massa folhada na manteiga, dourada e crocante por fora, leve por dentro.',
        dim: { largura: 12, profundidade: 7, altura: 5 }, modelo: 'assets/models/croissant.glb', ilustrativo: true },
      { id: 'empada', nome: 'Empada de frango', categoria: 'Salgados', preco: 7.50,
        descricao: 'Massa podre que derrete na boca, recheada com frango cremoso e azeitona.',
        dim: { largura: 8, profundidade: 8, altura: 4 }, modelo: 'assets/models/empada.glb', ilustrativo: true },
      { id: 'brigadeiro', nome: 'Brigadeiro', categoria: 'Doces', preco: 3.50,
        descricao: 'Chocolate e leite condensado no ponto, coberto com granulado.',
        dim: { largura: 3, profundidade: 3, altura: 3 }, modelo: 'assets/models/brigadeiro.glb', ilustrativo: true }
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
    { nome: 'Padrão', cor: '', destaque: '' },
    { nome: 'Vinho', cor: '#6B1E2E', destaque: '#E8B04A' },
    { nome: 'Café', cor: '#4A2C1D', destaque: '#F2C14E' },
    { nome: 'Oceano', cor: '#1D3B6E', destaque: '#FF8A3D' },
    { nome: 'Confeitaria', cor: '#B83A6B', destaque: '#FFC7DA' },
    { nome: 'Oliva', cor: '#4B5A2A', destaque: '#EBDDA8' },
    { nome: 'Noite', cor: '#161616', destaque: '#FFD23F' },
    { nome: 'Terracota', cor: '#B5502F', destaque: '#F6D6A8' },
    { nome: 'Uva', cor: '#4B2A7B', destaque: '#8FF0C8' }
  ];
  var COR_PADRAO = '#10402D', DESTAQUE_PADRAO = '#C6F25A';

  var VAZIO = { padaria: { nome: 'Carregando cardápio…', slogan: '', abre: '00:00', fecha: '00:00', dias: [], whatsapp: '' }, categorias: [], produtos: [] };
  var dados = validarDados(ler(CHAVE_DADOS)) || (LOJA ? validarDados(clonar(VAZIO)) : validarDados(clonar(PADRAO)));
  CATEGORIAS = dados.categorias;
  var carrinho = ler(CHAVE_CARRINHO) || {};
  var filtro = { cat: 'Todos', q: '' };
  var mvStatus = 'carregando'; // 'carregando' | 'ok' | 'falhou'
  var produtoAtual = null;
  var servidor = false; // true quando /api/cardapio existe (site publicado com funções)

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
      tipo: p.tipo === 'produtos' ? 'produtos' : 'alimentos', // alimentos = cardápio; produtos = catálogo de objetos
      visual: validarVisual(p.visual),
      pedido: lerPedido(p.pedido)
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
        adicionais: lerAdicionais(x.adicionais),
        montar: x.montar === true,   // o cliente monta o copo em camadas
        copo: lerCopo(x.copo),        // copo 3D sob medida (estilo, logo, medidas por tamanho)
        esgotado: x.esgotado === true // acabou hoje: aparece, mas não dá para pedir
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
      marca: v.marca !== false
    };
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
      '--palco-b': misturar('#E7E8E3', cor, 0.07)
    };
    var fundoE = misturar('#0C0F0D', cor, 0.10);
    var acao = contraste(dest, fundoE) >= 3 ? dest : clarearAte(cor, fundoE, 3);
    var destE = contraste(dest, fundoE) >= 3 ? dest : acao;
    var escuro = {
      '--fundo': fundoE, '--superficie': misturar('#141915', cor, 0.10), '--tinta': '#EEF0EC', '--tinta-2': '#AEB4AE',
      '--verde': acao, '--verde-2': misturar(acao, '#FFFFFF', 0.15), '--sobre-verde': textoSobre(acao),
      '--limao': destE, '--sobre-limao': textoSobre(destE), '--limao-suave': misturar(fundoE, destE, 0.22),
      '--linha': misturar('#262C27', cor, 0.10), '--linha-forte': misturar('#38403A', cor, 0.10),
      '--palco-a': misturar('#1E241F', cor, 0.10), '--palco-b': misturar('#101411', cor, 0.10)
    };
    var bloco = function (o) { return Object.keys(o).map(function (k) { return k + ':' + o[k]; }).join(';'); };
    return css + ':root{' + bloco(claro) + '}' +
      '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){' + bloco(escuro) + '}}' +
      ':root[data-theme="dark"]{' + bloco(escuro) + '}';
  }

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
      logo.setAttribute('aria-label', p.nome + ', início');
      logo.innerHTML = v.logo ? '<img class="logo__img" src="' + esc(v.logo) + '" alt="' + esc(p.nome) + '">' : '<span class="logo__loja">' + esc(p.nome) + '</span>';
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
      rod.innerHTML = '<p>' + (ehAlimento({ padaria: p }) ? 'Cardápio' : 'Catálogo') + ' em 3D por <a href="/">MenuReal</a></p>';
    }
  }

  function lerAdicionais(lista) {
    var ids = {};
    return (Array.isArray(lista) ? lista : []).filter(function (a) { return a && a.nome; }).slice(0, 30).map(function (a, i) {
      var id = String(a.id || slug(a.nome) || 'a' + i).replace(/[^\w-]/g, '').slice(0, 40) || 'a' + i;
      while (ids[id]) id += '2';
      ids[id] = 1;
      var t3 = String(a.tipo3d || '');
      return { id: id, nome: String(a.nome).slice(0, 40), preco: Math.max(0, Number(a.preco) || 0),
        tipo3d: TIPOS_3D.some(function (t) { return t[0] && t[0] === t3; }) ? t3 : '', esgotado: a.esgotado === true };
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
      pausado: v.pausado === true
    };
  }
  function lerCopo(c) {
    c = c && typeof c === 'object' ? c : {};
    var med = {};
    Object.keys(c.medidas || {}).slice(0, 10).forEach(function (k) {
      var m = c.medidas[k] || {};
      var n = function (v, a, b) { v = Number(v); return v >= a && v <= b ? Math.round(v * 10) / 10 : 0; };
      med[String(k).slice(0, 60)] = { ml: n(m.ml, 50, 3000), boca: n(m.boca, 2, 40), fundo: n(m.fundo, 2, 40), altura: n(m.altura, 3, 60) };
    });
    return { estilo: c.estilo === 'vidro' ? 'vidro' : 'pet', logo: c.logo !== false, medidas: med };
  }

  function adicionaisDe(p, sel) {
    return (p.adicionais || []).filter(function (a) { return sel.indexOf(a.id) > -1; });
  }
  function somaAdicionais(p, sel) { return adicionaisDe(p, sel).reduce(function (s, a) { return s + a.preco; }, 0); }

  // ---- Montagem em camadas pelo cliente (açaí, banana, açaí, creme… até encher o copo)
  // Pesos iguais a VISUAL_CAMADA em public/glb.mjs (altura de cada camada no copo).
  var CAPACIDADE_COPO = 5.5;
  var PESO_CAMADA = { acai: 1, camada_creme: 0.55, creme: 0.55, camada_nutella: 0.5, nutella: 0.5, leite_condensado: 0.42,
    calda_chocolate: 0.38, leite_po: 0.42, camada_morango: 0.62, morango: 0.45, morango_picado: 0.45, banana: 0.45,
    granola: 0.4, pacoca: 0.38, confete: 0.32 };
  var ACAI = '_acai';   // camada de açaí (já inclusa no preço do tamanho)
  function camadaDe(p, token) {
    if (token === ACAI) return { id: ACAI, nome: 'Açaí', preco: 0, tipo3d: 'acai' };
    var a = adicionaisDe(p, [token])[0];
    return a && PESO_CAMADA[a.tipo3d] ? a : null;
  }
  function podeSerCamada(a) { return !!(a && PESO_CAMADA[a.tipo3d]); }
  function enchimento(p, pilha) {
    var soma = 0;
    pilha.forEach(function (t) { var c = camadaDe(p, t); if (c) soma += PESO_CAMADA[c.tipo3d]; });
    return Math.min(1, soma / CAPACIDADE_COPO);
  }
  function copoCheio(p, pilha) { return enchimento(p, pilha) >= (CAPACIDADE_COPO - 0.05) / CAPACIDADE_COPO; }
  function somaPilha(p, pilha) { return pilha.reduce(function (s, t) { var c = camadaDe(p, t); return s + (c ? c.preco : 0); }, 0); }
  function precoMontado(p, tamId, pilha, tops) { return efetivo(p, tamId).preco + somaPilha(p, pilha || []) + somaAdicionais(p, tops || []); }
  function nomeMontado(p, pilha, tops) {
    var cam = pilha.map(function (t) { var c = camadaDe(p, t); return c ? c.nome.toLowerCase() : ''; }).filter(Boolean);
    var cob = adicionaisDe(p, tops).map(function (a) { return a.nome.toLowerCase(); });
    // camadas iguais seguidas viram "açaí (3x)"
    var junto = [];
    cam.forEach(function (n) { var u = junto[junto.length - 1]; if (u && u.n === n) u.q++; else junto.push({ n: n, q: 1 }); });
    cam = junto.map(function (x) { return x.n + (x.q > 1 ? ' (' + x.q + 'x)' : ''); });
    return (cam.length ? ' — camadas: ' + cam.join(', ') : '') + (cob.length ? ' · por cima: ' + cob.join(', ') : '');
  }

  // Vocabulário conforme o tipo de negócio
  function ehAlimento(d) { return (d || dados).padaria.tipo !== 'produtos'; }
  function termo(d) { return ehAlimento(d) ? 'cardápio' : 'catálogo'; }

  // Produto com o tamanho escolhido aplicado (preço, medidas e modelo do tamanho)
  function efetivo(p, tamId) {
    var t = null;
    (p.tamanhos || []).forEach(function (x) { if (x.id === tamId) t = x; });
    if (!t) return { p: p, t: null, preco: p.preco, dim: p.dim, modelo: p.modelo, nome: p.nome };
    return { p: p, t: t, preco: t.preco, dim: t.dim, modelo: t.modelo || p.modelo, nome: p.nome + ' (' + t.nome + ')' };
  }
  function precoMinimo(p) {
    if (!p.tamanhos || !p.tamanhos.length) return p.preco;
    return Math.min.apply(null, p.tamanhos.map(function (t) { return t.preco; }));
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
    $('#busca').placeholder = ehAlimento() ? (LOJA ? 'Buscar no cardápio…' : 'Buscar coxinha, pão de queijo…') : 'Buscar produtos…';
    $('#passo-posicionar').textContent = 'Toque para posicionar. O produto aparece em escala fixa, no tamanho das medidas cadastradas.';
    var nota = $('#nota-demo');
    if (nota) nota.hidden = !!LOJA;
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

  function filtrados() {
    var q = semAcento(filtro.q.trim());
    return dados.produtos.filter(function (p) {
      if (filtro.cat !== 'Todos' && p.categoria !== filtro.cat) return false;
      if (!q) return true;
      return semAcento(p.nome + ' ' + p.descricao + ' ' + p.categoria + ' ' + (p.ingredientes || '')).indexOf(q) > -1;
    });
  }

  function reguaTexto(d) { return num(d.largura) + ' × ' + num(d.altura) + ' cm'; }

  function htmlCard(p) {
    var temModelo = !!p.modelo;
    var temTams = p.tamanhos && p.tamanhos.length;
    var temOpcoes = temTams || (p.adicionais && p.adicionais.length);
    var vitrine = temModelo
      ? '<button class="card__palco" type="button" data-acao="3d" aria-label="Girar ' + esc(p.nome) + ' em 3D">' +
          '<model-viewer src="' + esc(urlModelo(p.modelo)) + '" alt="Modelo 3D de ' + esc(p.nome) + '" loading="lazy" reveal="auto"' +
          ' camera-orbit="28deg 70deg auto" shadow-intensity="1.25" shadow-softness="0.55" tone-mapping="neutral" environment-image="' + esc(ESTUDIO()) + '" exposure="1"' +
          ' interaction-prompt="none" disable-zoom disable-tap tabindex="-1"></model-viewer>' +
          '<span class="card__estado" data-estado><span class="carregando"><span class="spinner" aria-hidden="true"></span><span class="barra"><i></i></span></span></span>' +
        '</button>' +
        '<button class="card__mesa" type="button" data-acao="ar" aria-label="Ver ' + esc(p.nome) + ' na mesa, em tamanho real">' + ICONES.ar + '<span>Na mesa</span></button>'
      : '<span class="card__palco card__palco--vazio" aria-hidden="true"><span>' + esc(p.nome.trim().charAt(0).toUpperCase()) + '</span></span>';
    return '<article class="card' + (temModelo ? '' : ' card--simples') + (p.esgotado ? ' card--esgotado' : '') + '" data-id="' + esc(p.id) + '">' +
      '<div class="card__vitrine">' + vitrine + (p.esgotado ? '<span class="selo-esgotado">Esgotado</span>' : '') +
        (temModelo ? '<span class="regua" title="' + (temTams ? 'Largura dos tamanhos' : 'Largura × altura') + '"><span>' + esc(temTams
          ? num(Math.min.apply(null, p.tamanhos.map(function (t) { return t.dim.largura; }))) + ' a ' + num(Math.max.apply(null, p.tamanhos.map(function (t) { return t.dim.largura; }))) + ' cm'
          : reguaTexto(p.dim)) + '</span></span>' : '') +
      '</div>' +
      '<div class="card__corpo">' +
        '<h3 class="card__nome">' + esc(p.nome) + '</h3>' +
        (p.descricao ? '<p class="card__desc">' + esc(p.descricao) + '</p>' : '') +
        (temTams ? '<p class="card__tams">' + p.tamanhos.map(function (t) { return '<span>' + esc(t.nome) + '</span>'; }).join('') + '</p>' : '') +
        (p.adicionais && p.adicionais.length ? '<p class="card__tams"><span>+ ' + p.adicionais.length + ' adicionais · monte o seu</span></p>' : '') +
        (ehAlimento() && p.alergenos && p.alergenos.length ? '<p class="card__alerg">Contém ' + esc(p.alergenos.join(', ').toLowerCase()) + '</p>' : '') +
        (temModelo && p.ilustrativo ? '<p class="card__nota">Modelo ilustrativo</p>' : '') +
        '<div class="card__rodape">' +
          '<span class="card__preco">' + (temTams ? '<small>a partir de</small>' : '') + brl(precoMinimo(p)) + '</span>' +
          (p.esgotado ? '<span class="card__esgotado">Esgotado</span>' :
          '<button class="card__add" type="button" data-acao="' + (temOpcoes ? 'escolher' : 'add') + '" aria-label="' +
            (temOpcoes ? 'Escolher opções de ' : 'Adicionar ao pedido: ') + esc(p.nome) + '">' + ICONES.mais + '</button>') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderGrade() {
    var lista = filtrados();
    var grade = $('#grade');
    var q = filtro.q.trim();
    if (!lista.length) {
      grade.innerHTML = q
        ? '<div class="vazio"><strong>Nada encontrado</strong>Nenhum produto corresponde a “' + esc(q) + '”' + (filtro.cat !== 'Todos' ? ' em ' + esc(filtro.cat) : '') + '.</div>'
        : '<div class="vazio"><strong>Ainda não há itens em ' + esc(filtro.cat) + '</strong>Adicione produtos desta categoria pelo painel administrativo.</div>';
    } else {
      grade.innerHTML = lista.map(htmlCard).join('');
      $$('model-viewer', grade).forEach(ligarCardViewer);
    }
    $('#resultado').textContent = q
      ? lista.length + (lista.length === 1 ? ' produto encontrado' : ' produtos encontrados')
      : (filtro.cat === 'Todos' ? 'Toque em um produto para girar em 3D ou vê-lo em tamanho real.' : filtro.cat);
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
      caixa.innerHTML = '<strong>Seu aparelho ou navegador não abriu a RA aqui</strong>Continue explorando em 3D na aba ao lado.' +
        '<ul>' + motivoSemAR().map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ul>';
    }
  }

  var tamAtual = null;
  var adicSel = []; // ids dos adicionais marcados no visualizador (por cima)
  var pilhaSel = []; // camadas montadas pelo cliente, de baixo para cima (pode repetir)

  function abrirViewer(id, modo) {
    var p = produtoPorId(id);
    if (!p) return;
    tamAtual = p.tamanhos && p.tamanhos.length ? p.tamanhos[Math.min(1, p.tamanhos.length - 1)].id : null;
    adicSel = [];
    pilhaSel = [];
    abrirViewerProduto(p, modo);
  }

  function preencherTextosViewer(p) {
    var ef = p.combo ? { preco: p.preco, dim: p.dim } : efetivo(p, tamAtual);
    $('#viewer-cat').textContent = p.categoria + (p.ilustrativo ? ' · modelo ilustrativo' : '');
    $('#viewer-nome').textContent = p.nome;
    $('#viewer-preco').textContent = brl(ef.preco);
    $('#viewer-dim').textContent = p.combo ? 'itens lado a lado' : dimTexto(ef.dim);
    $('#viewer-desc').textContent = p.descricao;
    var tams = $('#viewer-tamanhos');
    tams.hidden = !(p.tamanhos && p.tamanhos.length);
    tams.innerHTML = (p.tamanhos || []).map(function (t) {
      return '<button type="button" class="tam" data-tam="' + esc(t.id) + '" aria-pressed="' + (t.id === tamAtual) + '">' +
        '<strong>' + esc(t.nome) + '</strong><span>' + brl(t.preco) + '</span><small>' + esc(dimTexto(t.dim)) + '</small></button>';
    }).join('');
    var info = '';
    if (p.ingredientes) info += '<div><dt>' + (ehAlimento() ? 'Ingredientes' : 'Composição') + '</dt><dd>' + esc(p.ingredientes) + '</dd></div>';
    if (ehAlimento() && p.alergenos && p.alergenos.length) info += '<div class="alerg"><dt>Alérgicos</dt><dd>Contém ' + esc(p.alergenos.join(', ').toLowerCase()) + '.</dd></div>';
    $('#viewer-info').innerHTML = info;
    $('#viewer-info').hidden = !info;
    var adic = $('#viewer-adicionais');
    var lista = p.combo ? [] : (p.adicionais || []);
    adic.hidden = !lista.length && !p.montar;
    if (p.montar && !p.combo) {
      adic.innerHTML = htmlMontador(p);
    } else if (lista.length) {
      adic.innerHTML = '<legend>Monte o seu <small>' + (lista.some(function (a) { return a.tipo3d; }) ? 'cada adicional aparece no 3D' : 'escolha os adicionais') + '</small></legend>' +
        '<div class="adicionais__lista">' + lista.map(htmlAdicional).join('') + '</div>';
    }
    atualizarPrecoViewer(p);
  }

  function atualizarPrecoViewer(p) {
    var preco = p.combo ? p.preco : precoMontado(p, tamAtual, p.montar ? pilhaSel : [], adicSel);
    $('#viewer-preco').textContent = brl(preco);
    var add = $('#viewer-add');
    add.hidden = !!p.combo;
    add.classList.remove('feito');
    var falta = p.montar && !p.combo && !copoCheio(p, pilhaSel);
    add.disabled = falta || !!p.esgotado;
    add.textContent = p.esgotado ? 'Esgotado no momento' : falta
      ? (pilhaSel.length ? 'Complete o copo (faltam ' + Math.round((1 - enchimento(p, pilhaSel)) * 100) + '%)' : 'Monte seu copo para adicionar')
      : 'Adicionar ao pedido · ' + brl(preco);
  }

  function htmlAdicional(a) {
    var fora = a.esgotado;
    return '<label class="adic' + (fora ? ' adic--esgotado' : '') + '"><input type="checkbox" data-adic="' + esc(a.id) + '"' +
      (adicSel.indexOf(a.id) > -1 && !fora ? ' checked' : '') + (fora ? ' disabled' : '') + '>' +
      '<span class="adic__marca" aria-hidden="true">' + ICONES.ok + '</span>' +
      '<span class="adic__txt">' + esc(a.nome) + '<small>' + (fora ? 'esgotado' : '+ ' + brl(a.preco)) + '</small></span></label>';
  }
  function htmlMontador(p) {
    var cheio = copoCheio(p, pilhaSel), pct = Math.round(enchimento(p, pilhaSel) * 100);
    var camadas = [{ id: ACAI, nome: 'Açaí', preco: 0 }].concat((p.adicionais || []).filter(podeSerCamada));
    var chips = pilhaSel.map(function (t) { var c = camadaDe(p, t); return c ? '<span>' + esc(c.nome) + '</span>' : ''; }).join('');
    var botao = function (c) {
      return '<button type="button" class="adic adic--camada' + (c.esgotado ? ' adic--esgotado' : '') + '" data-camada="' + esc(c.id) + '"' + (c.esgotado ? ' disabled' : '') + '>' +
        '<span class="adic__marca adic__marca--mais" aria-hidden="true">' + ICONES.mais + '</span>' +
        '<span class="adic__txt">' + esc(c.nome) + '<small>' + (c.esgotado ? 'esgotado' : c.id === ACAI ? 'incluso' : '+ ' + brl(c.preco)) + '</small></span></button>';
    };
    return '<legend>Monte seu copo <small>' + (cheio ? 'copo cheio' : pct + '% cheio') + '</small></legend>' +
      '<div class="medidor" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
      '<p class="pilha">' + (chips ? '<span class="pilha__rot">De baixo para cima:</span>' + chips : 'Comece pelo açaí e vá adicionando camadas até encher o copo.') + '</p>' +
      (cheio
        ? '<p class="montador__dica">Copo cheio! Agora escolha o que vai <strong>por cima</strong>:</p>' +
          '<div class="adicionais__lista">' + (p.adicionais || []).map(htmlAdicional).join('') + '</div>'
        : '<div class="adicionais__lista">' + camadas.map(botao).join('') + '</div>') +
      '<div class="linha-acoes montador__acoes">' +
        (pilhaSel.length ? '<button type="button" class="btn btn--fantasma btn--p" data-desfazer>Desfazer última camada</button>' : '') +
        (!cheio && pilhaSel.length ? '<button type="button" class="btn btn--sec btn--p" data-completar>Completar com açaí</button>' : '') +
      '</div>';
  }

  function abrirViewerProduto(p, modo) {
    produtoAtual = p;
    preencherTextosViewer(p);
    $('#viewer-dim-modelo').textContent = 'calculando…';
    $('#viewer-escala').hidden = true;
    $('#ar-indisp').hidden = true;
    var ef = p.combo ? { modelo: p.modelo, dim: p.dim } : efetivo(p, tamAtual);

    var antigo = palco.querySelector('model-viewer');
    if (antigo) antigo.remove();

    abrirDialogo(dlgViewer);
    trocarAba(modo);

    if (mvStatus === 'falhou') {
      estadoPalco('<div class="caixa-erro"><strong>Visualização 3D indisponível</strong>A biblioteca &lt;model-viewer&gt; não carregou. Verifique a conexão com a internet e recarregue a página.</div>', true);
      $('#viewer-dim-modelo').textContent = '—';
      atualizarAvisoAR();
      return;
    }
    if (!ef.modelo) {
      estadoPalco('<div class="caixa-erro"><strong>Sem visualização 3D</strong>Este produto ainda não tem modelo 3D. ' +
        (p.tamanhos && p.tamanhos.length ? 'Escolha o tamanho abaixo e adicione ao pedido.' : 'Você pode adicioná-lo ao pedido normalmente.') + '</div>', true);
      $('#viewer-dim-modelo').textContent = '—';
      return;
    }

    var mv = document.createElement('model-viewer');
    var attrs = {
      src: urlModelo(ef.modelo),
      alt: 'Modelo 3D de ' + p.nome + (p.combo ? '' : ', ' + dimTexto(ef.dim)),
      ar: '',
      // Scene Viewer primeiro: no Android ele fixa o objeto na mesa com mais estabilidade
      // Com medidas ligadas, a RA abre dentro do Chrome (WebXR), único modo que mostra as etiquetas
      'ar-modes': medidasLigadas ? 'webxr scene-viewer quick-look' : 'scene-viewer webxr quick-look',
      'ar-scale': 'fixed',
      'ar-placement': 'floor',
      'camera-controls': '',
      'touch-action': 'pan-y',
      // produto com adicionais: câmera mais de cima, para ver a cobertura
      'camera-orbit': p.adicionais && p.adicionais.length && !p.combo ? '28deg 50deg auto' : '28deg 68deg auto',
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
    mv.innerHTML =
      '<button slot="ar-button" class="botao-ar" type="button" aria-label="Abrir câmera e ver no tamanho real">' + ICONES.ar + 'Ver na mesa</button>' +
      '<div slot="progress-bar" class="progresso"><i></i></div>' +
      HTML_MEDIDAS;
    mv.classList.toggle('sem-medidas', !medidasLigadas);
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
      posicionarMedidas(mv);
      if (p.combo || mv.dataset.montagem === '1') {
        try { var dc = mv.getDimensions(); $('#viewer-dim-modelo').textContent = dimTexto({ largura: dc.x * 100, altura: dc.y * 100, profundidade: dc.z * 100 }); } catch (e2) { /* ignora */ }
      } else {
        conferirEscala(mv, { dim: efetivo(p, tamAtual).dim });
      }
      if (mv.dataset.animar) {
        delete mv.dataset.animar;
        try {
          mv.animationName = 'entrada'; mv.currentTime = 0; mv.play({ repetitions: 1 });
          // afasta a câmera para mostrar a mão/o frasco chegando e depois volta, com zoom suave no açaí
          var o = mv.getCameraOrbit(), alvo = mv.getCameraTarget();
          mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + (o.radius * 1.75) + 'm';
          mv.cameraTarget = alvo.x + 'm ' + (alvo.y + 0.045) + 'm ' + alvo.z + 'm';
          clearTimeout(mv._voltaCamera);
          mv._voltaCamera = setTimeout(function () {
            if (!mv.isConnected) return;
            mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + o.radius + 'm';
            mv.cameraTarget = alvo.x + 'm ' + alvo.y + 'm ' + alvo.z + 'm';
          }, Math.max(800, (mv.duration || 1.6) * 1000 - 200));
        } catch (e3) { /* sem animação */ }
      }
      if (mv.dataset.abrirAR) {
        delete mv.dataset.abrirAR;
        try { mv.activateAR(); } catch (e4) { toast('Toque de novo em “Ver na mesa”.'); }
      }
      atualizarAvisoAR();
    });
    mv.addEventListener('error', function () {
      estadoPalco('<div class="caixa-erro"><strong>Não foi possível carregar o modelo 3D</strong>' +
        'Confira se o arquivo existe e se a página está sendo servida por um servidor (não abra o index.html direto do disco).<br><br>' +
        'Arquivo: <code>' + esc(ef.modelo) + '</code></div>', true);
      $('#viewer-dim-modelo').textContent = '—';
      $('#ar-indisp').hidden = false;
      $('#ar-indisp').innerHTML = '<strong>Realidade aumentada indisponível</strong>O modelo 3D deste produto não carregou.';
    });
    // Antes de abrir a câmera: esconde avisos na camada de cima (podem atrapalhar a tela cheia da RA)
    mv.querySelector('.botao-ar').addEventListener('click', function (ev) {
      var t = $('#toast');
      clearTimeout(toastTimer);
      t.classList.remove('ver');
      try { if (t.hidePopover && t.matches(':popover-open')) t.hidePopover(); } catch (err) { /* ok */ }
      // Açaí montado: a câmera precisa de um arquivo publicado (o da tela é só deste navegador)
      if (mv.dataset.montagem !== '1' || mv.dataset.arPronto === '1') return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!servidor) { toast('Ver o produto montado na câmera funciona no site publicado.'); return; }
      prepararMontagemAR(mv, this);
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
    if (!p.combo && (p.montar || tiposMontagem(p).length)) atualizarMontagem(null);
  }

  // ---------------------------------------------------------------------
  // Monte o seu: adicionais caem em cima do produto (montado neste navegador)
  // ---------------------------------------------------------------------
  var moduloGlb = null, cacheArquivos = {}, seqMontagem = 0, blobAtual = null;
  function carregarModuloGlb() {
    if (!moduloGlb) moduloGlb = import(new URL('glb.mjs', document.baseURI).href);
    return moduloGlb;
  }
  function baixarArquivo(url) {
    if (!cacheArquivos[url]) {
      cacheArquivos[url] = fetch(url).then(function (r) { if (!r.ok) throw new Error('Arquivo 3D indisponível'); return r.arrayBuffer(); });
      cacheArquivos[url].catch(function () { delete cacheArquivos[url]; });
    }
    return cacheArquivos[url];
  }
  function tiposMontagem(p) {
    var tipos = [];
    if (p.montar && !copoCheio(p, pilhaSel)) return tipos;
    adicionaisDe(p, adicSel).forEach(function (a) {
      // no montador, "camada de…" escolhida por cima não tem 3D próprio de cobertura
      if (p.montar && /^camada_/.test(a.tipo3d)) return;
      if (a.tipo3d && tipos.indexOf(a.tipo3d) < 0) tipos.push(a.tipo3d);
    });
    return tipos;
  }
  function pilhaTipos(p) { return pilhaSel.map(function (t) { var c = camadaDe(p, t); return c ? c.tipo3d : null; }).filter(Boolean); }
  function atualizarMontagem(animarTipo, animarCamada) {
    var p = produtoAtual, mv = palco.querySelector('model-viewer');
    if (!p || !mv || p.combo) return;
    var ef = efetivo(p, tamAtual);
    if (!ef.modelo) return;
    var tipos = tiposMontagem(p);
    var pilha = p.montar ? pilhaTipos(p) : null;
    var seq = ++seqMontagem;
    delete mv.dataset.arPronto;
    if (!tipos.length && !pilha) {
      if (mv.dataset.montagem === '1') { mv.dataset.montagem = ''; mv.src = urlModelo(ef.modelo); }
      return;
    }
    if (MODELOS_EMBUTIDOS) return; // versão de arquivo único: sem montagem
    var animar = animarTipo && tipos.indexOf(animarTipo) > -1 && !reduzMovimento ? animarTipo : null;
    carregarModuloGlb().then(function (m) {
      // ajudante da animação: mão que coloca os pedaços ou frasco de vidro que despeja a calda
      // (camadas dentro do copo não usam ajudante: o copo enche sozinho)
      var ajuda = animar && !(m.ADICIONAIS_3D[animar] || {}).camada ? baixarArquivo('assets/adicionais/' + m.ajudanteDe(animar) + '.glb').catch(function () { return null; }) : null;
      var libs = pilha ? m.bibliotecasDe(pilha) : [];
      return Promise.all([m, baixarArquivo(urlModelo(ef.modelo)), ajuda,
        Promise.all(libs.map(function (n) { return baixarArquivo('assets/adicionais/' + n + '.glb'); })).then(function (bufs) {
          var o = {}; libs.forEach(function (n, i) { o[n] = new Uint8Array(bufs[i]); }); return o;
        })].concat(tipos.map(function (t) {
        var arq = m.arquivoDe(t);   // camadas de creme/Nutella dentro do copo não têm arquivo próprio
        return arq ? baixarArquivo('assets/adicionais/' + arq + '.glb') : null;
      })));
    })
      .then(function (r) {
        if (seq !== seqMontagem || !mv.isConnected) return;
        var camadas = tipos.map(function (t, i) { return { tipo: t, buf: r[i + 4] ? new Uint8Array(r[i + 4]) : null }; });
        var glb = r[0].montarAcai(new Uint8Array(r[1]), camadas, { animar: animar, ajudante: r[2] ? new Uint8Array(r[2]) : null,
          pilha: pilha, libs: r[3], animarCamada: !reduzMovimento && Number.isInteger(animarCamada) ? animarCamada : undefined });
        var url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
        var antigo = blobAtual;
        blobAtual = url;
        if (antigo) setTimeout(function () { URL.revokeObjectURL(antigo); }, 5000);
        mv.dataset.montagem = '1';
        if (animar || (!reduzMovimento && Number.isInteger(animarCamada))) mv.dataset.animar = '1';
        mv.src = url;
      })
      .catch(function (e) { console.warn('[MenuReal] montagem', e); if (seq === seqMontagem) toast('Não foi possível montar o 3D agora.'); });
  }
  function prepararMontagemAR(mv, botao) {
    var p = produtoAtual;
    if (!p) return;
    var ef = efetivo(p, tamAtual);
    var html = botao.innerHTML;
    botao.disabled = true;
    botao.textContent = 'Preparando para a câmera…';
    fetch('api/montagem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ base: ef.modelo, camadas: tiposMontagem(p), pilha: p.montar ? pilhaTipos(p) : undefined }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
      .then(function (j) {
        if (!mv.isConnected) return;
        mv.dataset.arPronto = '1';
        mv.dataset.abrirAR = '1';
        mv.src = j.url;
      })
      .catch(function (e) { toast(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); })
      .then(function () { botao.disabled = false; botao.innerHTML = html; });
  }
  $('#viewer-adicionais').addEventListener('change', function (e) {
    var c = e.target.closest('[data-adic]');
    if (!c || !produtoAtual) return;
    var id = c.getAttribute('data-adic');
    adicSel = adicSel.filter(function (x) { return x !== id; });
    if (c.checked) adicSel.push(id);
    var a = adicionaisDe(produtoAtual, [id])[0];
    atualizarPrecoViewer(produtoAtual);
    if (a && a.tipo3d) atualizarMontagem(c.checked ? a.tipo3d : null);
  });
  function redesenharMontador() {
    var p = produtoAtual, adic = $('#viewer-adicionais');
    adic.innerHTML = htmlMontador(p);
    atualizarPrecoViewer(p);
  }
  $('#viewer-adicionais').addEventListener('click', function (e) {
    var p = produtoAtual;
    if (!p || !p.montar) return;
    var b = e.target.closest('[data-camada]');
    if (b) {
      if (copoCheio(p, pilhaSel)) return;
      pilhaSel.push(b.getAttribute('data-camada'));
      if (copoCheio(p, pilhaSel)) toast('Copo cheio! Agora escolha o que vai por cima.');
      redesenharMontador();
      atualizarMontagem(null, pilhaSel.length - 1);
      return;
    }
    if (e.target.closest('[data-desfazer]')) {
      var estavaCheio = copoCheio(p, pilhaSel);
      pilhaSel.pop();
      if (estavaCheio) adicSel = [];   // coberturas só existem com o copo cheio
      redesenharMontador();
      atualizarMontagem(null);
      return;
    }
    if (e.target.closest('[data-completar]')) {
      while (!copoCheio(p, pilhaSel) && pilhaSel.length < 30) pilhaSel.push(ACAI);
      toast('Copo cheio! Agora escolha o que vai por cima.');
      redesenharMontador();
      atualizarMontagem(null, pilhaSel.length - 1);
    }
  });

  // ---------------------------------------------------------------------
  // Medidas no modelo (largura, altura, profundidade) — 3D e câmera (WebXR)
  // ---------------------------------------------------------------------
  var CHAVE_MEDIDAS = 'menureal:medidas';
  var medidasLigadas = (function () { try { return localStorage.getItem(CHAVE_MEDIDAS) !== '0'; } catch (e) { return true; } })();
  var quadroMedidas = 0;
  var HTML_MEDIDAS =
    '<button slot="hotspot-pA" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<button slot="hotspot-pB" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<button slot="hotspot-pC" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<button slot="hotspot-pD" class="med-ponto" tabindex="-1" aria-hidden="true"></button>' +
    '<div slot="hotspot-mL" class="med-rotulo" data-med="largura"></div>' +
    '<div slot="hotspot-mA" class="med-rotulo" data-med="altura"></div>' +
    '<div slot="hotspot-mP" class="med-rotulo" data-med="profundidade"></div>' +
    '<svg class="med-linhas" aria-hidden="true"><line data-de="pA" data-ate="pB"></line><line data-de="pA" data-ate="pC"></line><line data-de="pB" data-ate="pD"></line></svg>' +
    '<button type="button" class="med-alternar" aria-pressed="' + medidasLigadas + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17 17 3l4 4L7 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      '<span>Medidas</span></button>';

  function cmTexto(m) { var c = m * 100; return (c < 10 ? c.toFixed(1).replace('.', ',') : String(Math.round(c))) + ' cm'; }

  function posicionarMedidas(mv) {
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
      // afasta um pouco a câmera para as etiquetas caberem na tela
      if (!mv.dataset.enquadrado) {
        mv.dataset.enquadrado = '1';
        var o = mv.getCameraOrbit();
        mv.maxCameraOrbit = 'auto auto ' + (o.radius * 2.5) + 'm';
        mv.cameraOrbit = o.theta + 'rad ' + o.phi + 'rad ' + (o.radius * 1.3) + 'm';
        mv.jumpCameraToGoal();
      }
      mv.querySelector('[data-med="largura"]').textContent = 'L ' + cmTexto(d.x);
      mv.querySelector('[data-med="altura"]').textContent = 'A ' + cmTexto(d.y);
      mv.querySelector('[data-med="profundidade"]').textContent = 'P ' + cmTexto(d.z);
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
    var b = e.target.closest('.med-alternar');
    if (!b) return;
    medidasLigadas = !medidasLigadas;
    try { localStorage.setItem(CHAVE_MEDIDAS, medidasLigadas ? '1' : '0'); } catch (err) { /* ignora */ }
    var mv = palco.querySelector('model-viewer');
    if (!mv) return;
    mv.classList.toggle('sem-medidas', !medidasLigadas);
    mv.setAttribute('ar-modes', medidasLigadas ? 'webxr scene-viewer quick-look' : 'scene-viewer webxr quick-look');
    b.setAttribute('aria-pressed', String(medidasLigadas));
    toast(medidasLigadas ? 'Medidas visíveis no 3D e na câmera' : 'Medidas ocultas');
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
      el.textContent = ok
        ? '✓ Escala conferida: o arquivo 3D tem as medidas cadastradas. Em RA, ele aparece nesse tamanho.'
        : okMaior
          ? '✓ Tamanho real ajustado pela maior medida (' + num(maiorP) + ' cm). As outras medidas seguem as proporções das fotos.'
          : '⚠ O arquivo 3D não corresponde às medidas cadastradas. Em RA ele aparecerá com o tamanho do arquivo (' + dimTexto(m) + '). Ajuste o modelo ou as medidas.';
    } catch (e) {
      $('#viewer-dim-modelo').textContent = '—';
    }
  }

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
    tamAtual = b.getAttribute('data-tam');
    var ef = efetivo(produtoAtual, tamAtual);
    preencherTextosViewer(produtoAtual);
    var mv = palco.querySelector('model-viewer');
    if (ef.modelo !== antes || !mv) {
      abrirViewerProduto(produtoAtual, $('#aba-ar').getAttribute('aria-selected') === 'true' ? 'ar' : '3d');
    } else if (mv.dataset.montagem !== '1') {
      conferirEscala(mv, { dim: ef.dim });
    }
  });

  $('#viewer-add').addEventListener('click', function () {
    if (!produtoAtual || produtoAtual.combo || produtoAtual.esgotado) return;
    if (produtoAtual.montar && !copoCheio(produtoAtual, pilhaSel)) { toast('Complete o copo antes de adicionar.'); return; }
    adicionar(produtoAtual.id, tamAtual, adicSel, produtoAtual.montar ? pilhaSel.slice() : null);
    var b = this;
    b.classList.add('feito');
    b.textContent = 'Adicionado ✓';
    setTimeout(function () { if (produtoAtual) { b.classList.remove('feito'); b.textContent = 'Adicionar mais um · ' + brl(precoMontado(produtoAtual, tamAtual, produtoAtual.montar ? pilhaSel : [], adicSel)); } }, 1400);
  });
  dlgViewer.addEventListener('close', function () {
    cancelAnimationFrame(quadroMedidas);
    var mv = palco.querySelector('model-viewer');
    if (mv) mv.remove(); // libera memória da GPU
    estadoPalco('');
    produtoAtual = null;
  });

  // ---------------------------------------------------------------------
  // Carrinho
  // ---------------------------------------------------------------------
  // chave do carrinho: "idProduto", "idProduto|idTamanho", "idProduto|idTamanho|adicional+adicional"
  // ou, montado em camadas, "idProduto|idTamanho|camada.camada.camada~cobertura.cobertura"
  function itemDaChave(k) {
    var partes = k.split('|');
    var p = produtoPorId(partes[0]);
    if (!p) return null;
    var temTams = p.tamanhos && p.tamanhos.length;
    if (temTams && !partes[1]) return null;
    var ef = efetivo(p, partes[1]);
    if (partes[1] && !ef.t) return null;
    if (partes[2] && partes[2].indexOf('~') > -1) {
      var mt = partes[2].split('~');
      var pilha = mt[0] ? mt[0].split('.') : [], tops = mt[1] ? mt[1].split('.') : [];
      if (pilha.some(function (t) { return !camadaDe(p, t); }) || adicionaisDe(p, tops).length !== tops.length) return null;
      var fora = p.esgotado || adicionaisDe(p, tops).some(function (a) { return a.esgotado; }) || pilha.some(function (t) { return camadaDe(p, t).esgotado; });
      return { chave: k, p: { id: k, nome: ef.nome + nomeMontado(p, pilha, tops), preco: precoMontado(p, partes[1], pilha, tops), modelo: ef.modelo, esgotado: !!fora } };
    }
    var sel = partes[2] ? partes[2].split('+') : [];
    var adic = adicionaisDe(p, sel);
    if (adic.length !== sel.length) return null;
    return { chave: k, p: { id: k, nome: ef.nome + (adic.length ? ' + ' + adic.map(function (a) { return a.nome; }).join(', ') : ''),
      preco: ef.preco + somaAdicionais(p, sel), modelo: ef.modelo, esgotado: !!(p.esgotado || adic.some(function (a) { return a.esgotado; })) } };
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

  function adicionar(id, tamId, adics, pilha) {
    var p = produtoPorId(id);
    if (!p || p.esgotado) return;
    var sel = (adics || []).slice().sort();
    var k = pilha
      ? id + '|' + (tamId || '') + '|' + pilha.join('.') + '~' + sel.join('.')
      : id + (tamId || sel.length ? '|' + (tamId || '') : '') + (sel.length ? '|' + sel.join('+') : '');
    carrinho[k] = (carrinho[k] || 0) + 1;
    salvarCarrinho();
    atualizarContador(true);
    toast((itemDaChave(k) || { p: { nome: p.nome } }).p.nome + ' adicionado ao pedido');
    if ($('#dlg-carrinho').open) renderCarrinho();
  }

  function renderCarrinho() {
    var corpo = $('#carrinho-corpo');
    var rodape = $('#carrinho-rodape');
    var itens = itensCarrinho();
    if (!itens.length) {
      corpo.innerHTML = '<div class="carrinho-vazio">' + ICONES.sacola + '<strong>Seu pedido está vazio</strong>Escolha um item no ' + termo() + ' para começar.</div>';
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
        ? '<button class="btn btn--sec btn--bloco combo-btn" type="button" id="ver-combo">' + ICONES.ar + 'Ver o pedido na mesa (3D)</button>' +
          '<p class="mini">Mostra os itens do pedido juntos, lado a lado, no tamanho real.</p>'
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
      .catch(function (e) { botao.disabled = false; botao.innerHTML = ICONES.ar + 'Ver o pedido na mesa (3D)'; toast(e.message); });
  }

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
      '<div class="pilha"><button class="btn btn--primario btn--bloco" type="button" id="enviar-pedido">' + (zap ? 'Enviar pedido pelo WhatsApp' : 'Ver resumo do pedido') + '</button>' +
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
    var L = [b + 'Novo pedido — ' + dados.padaria.nome + b, ''];
    if (cliente.nome.trim()) L.push('Cliente: ' + cliente.nome.trim());
    if (modo === 'entrega') {
      L.push(b + 'Entrega' + b + ': ' + cliente.rua.trim() + ', ' + cliente.numero.trim() + ' — ' + cliente.bairro.trim());
      if (cliente.comp.trim()) L.push('Ref.: ' + cliente.comp.trim());
    } else if (modo === 'retirada') L.push(b + 'Vou retirar na loja' + b);
    else L.push(b + 'Consumir no local' + b + (cliente.mesa.trim() ? ' — mesa ' + cliente.mesa.trim() : ''));
    if (sit.agendado) L.push('(Pedido feito com a loja fechada: para quando abrir)');
    L.push('');
    itensCarrinho().forEach(function (i) { L.push(i.qtd + 'x ' + i.p.nome + ' — ' + brl(i.p.preco * i.qtd)); });
    L.push('');
    if (modo === 'entrega') { L.push('Subtotal: ' + brl(totalCarrinho())); L.push('Entrega: ' + (taxa ? brl(taxa) : 'grátis')); }
    L.push(b + 'Total: ' + brl(totalFinal()) + b);
    var pag = pagAtual();
    if (pag) {
      var tr = pag === 'dinheiro' && cliente.troco.trim() ? lerPreco(cliente.troco) : 0;
      L.push('Pagamento: ' + (pag === 'pix' ? 'Pix' + (cfg.pix.chave ? ' (envio o comprovante aqui)' : '') : pag === 'cartao' ? 'Cartão' : 'Dinheiro' + (tr ? ' — troco para ' + brl(tr) + ' (' + brl(tr - totalFinal()) + ' de troco)' : ', sem troco')));
    }
    if (sessionObs.trim()) L.push('Obs.: ' + sessionObs.trim());
    L.push('', '(Pedido feito pelo ' + termo() + ' MenuReal)');
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
    if (zap) window.open('https://wa.me/' + zap + '?text=' + encodeURIComponent(texto), '_blank', 'noopener');
    renderEnviado(texto);
  }
  function renderEnviado(texto) {
    var zap = dados.padaria.whatsapp, total = totalFinal();
    var pix = pagAtual() === 'pix' ? codigoPix(total) : '';
    $('#carrinho-corpo').innerHTML =
      '<div class="confirmacao">' +
        '<div class="confirmacao__selo">' + ICONES.ok + '</div>' +
        '<h3>' + (zap ? 'Falta só tocar em enviar' : 'Resumo do pedido') + '</h3>' +
        '<p>' + (zap ? 'Abrimos o WhatsApp da loja com o pedido escrito. <strong>Toque em enviar lá</strong> para a loja receber.'
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
      '<button class="btn btn--primario btn--bloco" type="button" id="novo-pedido">Concluir e limpar pedido</button>' +
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
      toast(LOJA ? 'Pedido concluído. Obrigado!' : 'Pedido demonstrativo concluído');
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
        '<p class="mini">Esqueceu a senha? Fale com quem criou a sua conta no MenuReal.</p>' +
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
        rascunho = clonar(dados);
        renderAdmin();
        toast('Bem-vindo, ' + j.nome);
      })
      .catch(function (e) { renderLogin(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message); });
  }

  function renderAdmin() {
    $('#admin-restaurar').hidden = !!LOJA;
    $('.painel__rodape--admin').classList.toggle('um', !!LOJA);
    if (servidor && LOJA && !lerTokenLoja()) { renderLogin(); return; }
    $('#form-admin').classList.remove('so-login');
    var p = rascunho.padaria;
    var h =
      (!servidor
        ? '<div class="aviso-admin"><strong>Administração apenas local</strong>Este endereço não tem o servidor do MenuReal: as alterações ficam salvas só neste navegador. Publique pelo GitHub na Cloudflare para salvar na nuvem.</div>'
        : LOJA
          ? '<div class="aviso-admin aviso-admin--ok conta"><span><strong>' + esc(dados.padaria.nome) + '</strong>“Salvar alterações” publica o ' + termo() + ' para todos os clientes.</span>' +
              '<button class="btn btn--fantasma btn--p" type="button" id="admin-sair">Sair</button></div>'
          : '<div class="aviso-admin aviso-admin--ok"><strong>Painel do dono do MenuReal</strong>Aqui você edita a demonstração e cria as contas das lojas clientes (comida, objetos, móveis, o que for).</div>' +
            campo('Código de acesso', '<input id="admin-codigo" type="password" autocomplete="off" maxlength="80" value="' + esc(lerCodigo()) + '">', 'O mesmo definido na Cloudflare (MENUREAL_CODIGO).') +
            '<section class="secao-admin"><h3>Estabelecimentos clientes</h3><div id="lojas"><button class="btn btn--sec btn--bloco" type="button" id="lojas-abrir">Ver e criar estabelecimentos</button></div></section>') +
      '<section class="secao-admin"><h3>Estabelecimento</h3><div class="campos">' +
        campo('Nome do estabelecimento', '<input name="p-nome" required maxlength="60" value="' + esc(p.nome) + '">') +
        campo('Descrição / slogan', '<input name="p-slogan" maxlength="90" value="' + esc(p.slogan) + '">') +
        '<div class="campos campos--2">' +
          campo('Abre às', '<input type="time" name="p-abre" value="' + esc(p.abre) + '">') +
          campo('Fecha às', '<input type="time" name="p-fecha" value="' + esc(p.fecha) + '">') +
        '</div>' +
        '<fieldset class="campo" style="border:0;padding:0;margin:0"><legend style="margin-bottom:6px">Dias de funcionamento</legend><div class="linha-acoes">' +
          DIAS.map(function (d, i) {
            return '<label class="checar" style="min-height:auto"><input type="checkbox" name="p-dia" value="' + i + '"' + (p.dias.indexOf(i) > -1 ? ' checked' : '') + '>' + d + '</label>';
          }).join('') +
        '</div></fieldset>' +
        campo('WhatsApp para pedidos (opcional)', '<input name="p-zap" inputmode="numeric" maxlength="15" placeholder="Somente números, com DDI e DDD" value="' + esc(p.whatsapp) + '">',
          'Deixe vazio para desativar. O cliente envia o resumo do pedido para este número.') +
        campo('Tipo de negócio', '<select name="p-tipo"><option value="alimentos"' + (p.tipo !== 'produtos' ? ' selected' : '') + '>Comida e bebida (cardápio, ingredientes e alérgicos)</option>' +
          '<option value="produtos"' + (p.tipo === 'produtos' ? ' selected' : '') + '>Produtos e objetos (catálogo)</option></select>') +
        campo('Categorias', '<input name="p-cats" maxlength="400" value="' + esc(rascunho.categorias.join(', ')) + '">',
          'Separe por vírgulas, na ordem em que devem aparecer. Ex.: Bolos, Doces, Bebidas · Sofás, Mesas, Decoração.') +
      '</div></section>' +
      htmlPedidoAdmin(p.pedido) +
      htmlAparencia(p) +
      htmlCartazAdmin() +
      '<section class="secao-admin"><h3>Produtos (' + rascunho.produtos.length + ')</h3>' +
        '<button class="btn btn--contorno btn--bloco destaque-foto" type="button" id="admin-foto">' + ICONES.camera +
          '<span><strong>Criar a partir de uma foto</strong><small>Fotografe um cardápio, catálogo ou tabela de preços e revise os itens lidos</small></span></button>' +
        rascunho.produtos.map(function (x, i) { return htmlProdutoAdmin(x, i); }).join('') +
        '<div class="linha-acoes" style="margin-top:12px">' +
          '<button class="btn btn--sec" type="button" id="admin-novo">' + ICONES.mais + 'Adicionar produto</button>' +
          '<button class="btn btn--fantasma" type="button" id="admin-exportar">Exportar JSON</button>' +
          '<label class="btn btn--fantasma" style="cursor:pointer">Importar JSON<input type="file" accept="application/json,.json" id="admin-importar" hidden></label>' +
        '</div>' +
      '</section>';
    $('#admin-corpo').innerHTML = h;
  }

  // ---- Pedidos: entrega, retirada, taxas, pagamento e Pix
  function htmlPedidoAdmin(c) {
    var chk = function (k, rot, marcado) { return '<label class="checar"><input type="checkbox" data-ped="' + k + '"' + (marcado ? ' checked' : '') + '> ' + rot + '</label>'; };
    var din = function (v) { return v ? v.toFixed(2).replace('.', ',') : ''; };
    return '<section class="secao-admin" id="secao-pedidos"><h3>Pedidos, entrega e pagamento</h3><div class="campos">' +
      '<label class="checar checar--alerta"><input type="checkbox" data-ped="pausado"' + (c.pausado ? ' checked' : '') + '> <span><strong>Pausar pedidos agora</strong><br><small>Para dias de muito movimento ou imprevisto. O cardápio continua aberto para olhar.</small></span></label>' +
      '<fieldset class="campo"><legend>Como o cliente recebe</legend><div class="linha-acoes">' +
        chk('entrega', 'Entrega', c.entrega) + chk('retirada', 'Retirar na loja', c.retirada) + chk('local', 'Consumir no local', c.local) +
      '</div></fieldset>' +
      '<div class="campos campos--2">' +
        campo('Taxa de entrega (R$)', '<input data-ped="taxa" inputmode="decimal" placeholder="0,00 = grátis" value="' + din(c.taxa) + '">', 'Usada quando não há lista de bairros.') +
        campo('Pedido mínimo (R$)', '<input data-ped="minimo" inputmode="decimal" placeholder="Sem mínimo" value="' + din(c.minimo) + '">') +
      '</div>' +
      campo('Taxa por bairro (opcional)', '<textarea data-ped="bairros" rows="4" maxlength="3000" placeholder="Centro = 4\nVila Nova = 6,50\nJardim América = 8">' +
        esc(c.bairros.map(function (b) { return b.nome + ' = ' + (b.taxa ? din(b.taxa) : '0'); }).join('\n')) + '</textarea>',
        'Um bairro por linha: nome = taxa. Com a lista, o cliente escolhe o bairro e só entrega onde estiver nela.') +
      '<div class="campos campos--2">' +
        campo('Tempo de entrega', '<input data-ped="tempo" maxlength="40" placeholder="Ex.: 30 a 45 min" value="' + esc(c.tempo) + '">') +
        campo('Fora do horário', '<select data-ped="foraDoHorario"><option value="bloquear"' + (c.foraDoHorario !== 'agendar' ? ' selected' : '') + '>Não aceitar pedidos</option>' +
          '<option value="agendar"' + (c.foraDoHorario === 'agendar' ? ' selected' : '') + '>Aceitar para quando abrir</option></select>') +
      '</div>' +
      campo('Endereço para retirada', '<input data-ped="endereco" maxlength="160" placeholder="Rua, número — bairro" value="' + esc(c.endereco) + '">') +
      '<fieldset class="campo"><legend>Formas de pagamento</legend><div class="linha-acoes">' +
        chk('pg-pix', 'Pix', c.pagamento.pix) + chk('pg-cartao', 'Cartão', c.pagamento.cartao) + chk('pg-dinheiro', 'Dinheiro', c.pagamento.dinheiro) +
      '</div></fieldset>' +
      '<fieldset class="campo tams-admin"><legend>Chave Pix (opcional)</legend>' +
        '<small>Com a chave, o cliente recebe o Pix copia e cola <strong>já com o valor do pedido</strong>. O dinheiro cai direto na sua conta; o MenuReal não passa por ele. Confira o comprovante antes de preparar.</small>' +
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

  // ---- Cartaz com QR Code para mesa e balcão
  function enderecoLoja() { return location.origin + '/' + (LOJA || ''); }
  function htmlCartazAdmin() {
    return '<section class="secao-admin"><h3>Cartaz com QR Code</h3>' +
      '<p class="mini">Para colar na mesa, no balcão ou na vitrine. O cliente aponta a câmera e abre o seu ' + termo(rascunho) + ': <strong>' + esc(enderecoLoja().replace(/^https?:\/\//, '')) + '</strong></p>' +
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
      if (v.marca) ctx.fillText('Cardápio em 3D por MenuReal', W / 2, 1690);
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
    return '<section class="secao-admin" id="aparencia"><h3>Aparência da página</h3><div class="campos">' +
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
    // copo sob medida: os ml preenchem as medidas (mesma conta de medidasPorMl em glb.mjs)
    if (e.target.matches('[data-cm="ml"]')) {
      var ml = Number(e.target.value);
      if (ml >= 50 && ml <= 3000) {
        var rt = Math.cbrt((1.1 * ml) / 5.195), l = e.target.closest('.copo-linha');
        l.querySelector('[data-cm="boca"]').value = (2 * rt).toFixed(1);
        l.querySelector('[data-cm="fundo"]').value = (2 * rt * 0.69).toFixed(1);
        l.querySelector('[data-cm="altura"]').value = (2.29 * rt).toFixed(1);
      }
    }
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
    if (t.matches('[data-img]') && t.files && t.files[0]) { enviarImagemLoja(t.getAttribute('data-img'), t.files[0]); t.value = ''; }
  });
  // Fechou o painel sem salvar: volta à aparência publicada
  $('#dlg-admin').addEventListener('close', function () { aplicarVisual(dados.padaria); });

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
        campo('Descrição', '<textarea data-f="descricao" maxlength="240">' + esc(x.descricao) + '</textarea>') +
        (ehAlimento(rascunho)
          ? campo('Ingredientes', '<textarea data-f="ingredientes" maxlength="600" placeholder="Ex.: farinha de trigo, frango, requeijão, cebola">' + esc(x.ingredientes) + '</textarea>') +
            '<fieldset class="campo alerg-admin"><legend>Contém (alérgicos)</legend><div class="linha-acoes">' +
              ALERGENOS.map(function (a) {
                return '<label class="checar"><input type="checkbox" data-alerg="' + esc(a) + '"' + (x.alergenos.indexOf(a) > -1 ? ' checked' : '') + '>' + esc(a) + '</label>';
              }).join('') +
            '</div></fieldset>'
          : campo('Composição / materiais', '<textarea data-f="ingredientes" maxlength="600" placeholder="Ex.: madeira maciça, tecido linho, pés de metal">' + esc(x.ingredientes) + '</textarea>')) +
        '<div class="campos campos--3">' +
          campo('Largura (cm)', '<input data-f="largura" type="number" min="0.1" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.largura + '">') +
          campo('Profund. (cm)', '<input data-f="profundidade" type="number" min="0.1" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.profundidade + '">') +
          campo('Altura (cm)', '<input data-f="altura" type="number" min="0.1" max="1000" step="0.1" inputmode="decimal" value="' + x.dim.altura + '">') +
        '</div>' +
        campo('Arquivo 3D (.glb)', '<input data-f="modelo" maxlength="300" placeholder="assets/models/produto.glb" value="' + esc(x.modelo) + '">',
          'Caminho relativo ao index.html ou URL HTTPS com CORS liberado. O modelo deve estar em metros, com as medidas acima.') +
        '<label class="checar"><input type="checkbox" data-f="ilustrativo"' + (x.ilustrativo ? ' checked' : '') + '> Exibir selo “Modelo ilustrativo”</label>' +
        '<label class="checar"><input type="checkbox" data-f="montar"' + (x.montar ? ' checked' : '') + '> O cliente monta o copo em camadas (açaí, fruta, creme… até encher)</label>' +
        '<fieldset class="campo tams-admin"><legend>Tamanhos (opcional)</legend>' +
          '<small>Ex.: bolo P, M e G. Cada tamanho tem preço e medidas próprios; o 3D é ajustado para cada um.</small>' +
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
              '<div class="tam-rodape"><span class="mini">' + (t.modelo ? '3D pronto' : 'Sem 3D próprio') + '</span>' +
                '<button class="link-remover" type="button" data-tam-remover>Remover tamanho</button></div>' +
            '</div>';
          }).join('') +
          '<div class="linha-acoes">' +
            '<button class="btn btn--fantasma btn--p" type="button" data-tam-novo>' + ICONES.mais + 'Adicionar tamanho</button>' +
            (servidor && x.tamanhos.length && x.modelo ? '<button class="btn btn--sec btn--p" type="button" data-tam-3d>' + ICONES.cubo + 'Gerar 3D de cada tamanho</button>' : '') +
          '</div>' +
        '</fieldset>' +
        '<fieldset class="campo tams-admin adic-admin"><legend>Adicionais (opcional)</legend>' +
          '<small>Complementos que o cliente marca, como granola ou leite condensado. Com “Aparece no 3D”, o adicional cai em cima do produto na tela e vai junto para a câmera.</small>' +
          x.adicionais.map(function (a, ai) {
            return '<div class="adic-linha" data-ai="' + ai + '">' +
              '<div class="campos campos--2">' +
                campo('Nome', '<input data-a="nome" maxlength="40" value="' + esc(a.nome) + '">') +
                campo('Preço (R$)', '<input data-a="preco" inputmode="decimal" value="' + esc(a.preco.toFixed(2).replace('.', ',')) + '">') +
              '</div>' +
              campo('Aparece no 3D como', '<select data-a="tipo3d">' + TIPOS_3D.map(function (t) {
                return '<option value="' + t[0] + '"' + (t[0] === a.tipo3d ? ' selected' : '') + '>' + t[1] + '</option>';
              }).join('') + '</select>') +
              '<div class="tam-rodape"><label class="checar checar--p"><input type="checkbox" data-a="esgotado"' + (a.esgotado ? ' checked' : '') + '> Esgotado</label><button class="link-remover" type="button" data-adic-remover>Remover adicional</button></div>' +
            '</div>';
          }).join('') +
          '<div class="linha-acoes">' +
            '<button class="btn btn--fantasma btn--p" type="button" data-adic-novo>' + ICONES.mais + 'Adicionar adicional</button>' +
            '<button class="btn btn--sec btn--p" type="button" data-adic-acai>Lista pronta de açaí</button>' +
          '</div>' +
        '</fieldset>' +
        (ehAlimento(rascunho) ? htmlCopoAdmin(x) : '') +
        '<div class="linha-acoes">' +
          (servidor ? '<button class="btn btn--sec btn--p" type="button" data-gerar-3d>' + ICONES.cubo + (x.modelo ? 'Refazer 3D com fotos' : 'Gerar 3D realista com fotos') + '</button>' : '') +
          (servidor && /^(api\/arquivo\/|assets\/models\/)/.test(x.modelo) ? '<button class="btn btn--contorno btn--p" type="button" data-reescalar>Aplicar as medidas acima ao 3D</button>' : '') +
          '<button class="btn btn--perigo btn--p" type="button" data-remover-prod>Remover produto</button></div>' +
      '</div></details>';
  }

  // Copo 3D sob medida: a loja informa os ml (ou as medidas) do copo dela
  function htmlCopoAdmin(x) {
    var c = x.copo || lerCopo(null);
    var linhas = x.tamanhos.length ? x.tamanhos.map(function (t) { return { id: t.id, nome: t.nome }; }) : [{ id: '_', nome: 'Copo' }];
    var temLogo = !!(rascunho.padaria.visual && rascunho.padaria.visual.logo);
    return '<fieldset class="campo tams-admin copo-admin"><legend>Copo 3D sob medida (açaí, sorvete, milkshake)</legend>' +
      '<small>Informe o tamanho do copo da sua loja: o 3D sai nas mesmas medidas, pronto para o cliente montar em camadas' + (temLogo ? ' e com a sua logo estampada' : '') + '.</small>' +
      '<div class="campos campos--2">' +
        campo('Material', '<select data-copo="estilo"><option value="pet"' + (c.estilo !== 'vidro' ? ' selected' : '') + '>Plástico transparente</option><option value="vidro"' + (c.estilo === 'vidro' ? ' selected' : '') + '>Vidro</option></select>') +
        (temLogo ? '<label class="checar" style="align-self:end"><input type="checkbox" data-copo="logo"' + (c.logo ? ' checked' : '') + '> Logo da loja no copo</label>'
          : '<small style="align-self:end">Envie a logo em “Aparência da página” para estampar no copo.</small>') +
      '</div>' +
      linhas.map(function (l) {
        var m = c.medidas[l.id] || {};
        return '<div class="copo-linha" data-copo-tam="' + esc(l.id) + '"><strong>' + esc(l.nome) + '</strong>' +
          '<div class="campos campos--4">' +
            campo('ml', '<input data-cm="ml" type="number" min="50" max="3000" step="10" inputmode="numeric" value="' + (m.ml || '') + '" placeholder="500">') +
            campo('Boca (cm)', '<input data-cm="boca" type="number" min="2" max="40" step="0.1" inputmode="decimal" value="' + (m.boca || '') + '">') +
            campo('Fundo (cm)', '<input data-cm="fundo" type="number" min="2" max="40" step="0.1" inputmode="decimal" value="' + (m.fundo || '') + '">') +
            campo('Altura (cm)', '<input data-cm="altura" type="number" min="3" max="60" step="0.1" inputmode="decimal" value="' + (m.altura || '') + '">') +
          '</div></div>';
      }).join('') +
      '<small>Só sabe os ml? Preencha e as medidas vêm sozinhas. Tem uma régua? Meça o diâmetro da boca, do fundo e a altura do copo.</small>' +
      (servidor ? '<button class="btn btn--sec btn--p" type="button" data-copo-gerar>' + ICONES.cubo + 'Gerar copo 3D e ligar o montador</button>' : '<small>Disponível no site publicado.</small>') +
    '</fieldset>';
  }
  function coletarCopo(d, x) {
    var est = d.querySelector('[data-copo="estilo"]');
    if (!est) return;
    var logo = d.querySelector('[data-copo="logo"]');
    var med = {};
    $$('.copo-linha', d).forEach(function (l) {
      var q = function (k) { return Number(l.querySelector('[data-cm="' + k + '"]').value) || 0; };
      med[l.getAttribute('data-copo-tam')] = { ml: q('ml'), boca: q('boca'), fundo: q('fundo'), altura: q('altura') };
    });
    x.copo = lerCopo({ estilo: est.value, logo: logo ? logo.checked : (x.copo || {}).logo, medidas: med });
  }

  // logo da loja em PNG (para estampar no copo 3D)
  function logoPng() {
    var url = rascunho.padaria.visual && rascunho.padaria.visual.logo;
    if (!url) return Promise.resolve(null);
    return new Promise(function (ok) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        var k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function (b) {
          if (!b) { ok(null); return; }
          b.arrayBuffer().then(function (ab) { ok({ bytes: new Uint8Array(ab), tipo: 'image/png', largura: cv.width, altura: cv.height }); });
        }, 'image/png');
      };
      img.onerror = function () { ok(null); };
      img.src = url;
    });
  }

  function gerarCopos(botao, x) {
    if (!credenciais()) { toast(LOJA ? 'Entre na conta do estabelecimento' : 'Preencha o código de acesso no topo do painel'); return; }
    var c = x.copo || lerCopo(null);
    var linhas = x.tamanhos.length ? x.tamanhos : [null];
    var faltando = linhas.filter(function (t) { var m = c.medidas[t ? t.id : '_'] || {}; return !(m.boca && m.fundo && m.altura); });
    if (faltando.length) { toast('Preencha os ml ou as medidas de cada copo'); return; }
    botao.disabled = true;
    var txt = botao.innerHTML;
    botao.textContent = 'Gerando copos…';
    var modelo = 'assets/models/' + (c.estilo === 'vidro' ? 'acai-500.glb' : 'acai-pet-500.glb');
    Promise.all([carregarModuloGlb(), baixarArquivo(modelo), c.logo ? logoPng() : null]).then(function (r) {
      var m = r[0], base = new Uint8Array(r[1]), logo = r[2];
      var i = 0;
      function proximo() {
        if (i >= linhas.length) return Promise.resolve();
        var t = linhas[i++];
        var med = c.medidas[t ? t.id : '_'];
        botao.textContent = 'Gerando copo ' + (t ? t.nome : '') + '… (' + i + '/' + linhas.length + ')';
        var res = m.gerarCopo(base, med, logo);
        var nome = slug(x.nome + (t ? '-' + t.nome : '') + '-copo');
        return fetch(comLoja('api/copo') + (LOJA ? '&' : '?') + 'nome=' + encodeURIComponent(nome), {
          method: 'POST', headers: Object.assign({ 'content-type': 'model/gltf-binary' }, credenciais()), body: res.glb
        }).then(function (resp) {
          return resp.json().then(function (j) { if (!resp.ok) throw new Error(j.erro || 'Erro ' + resp.status); return j; });
        }).then(function (j) {
          var dim = { largura: res.medidasCm.largura, profundidade: res.medidasCm.profundidade, altura: res.medidasCm.altura };
          if (t) { t.modelo = j.url; t.dim = dim; } else { x.modelo = j.url; x.dim = dim; }
          return proximo();
        });
      }
      return proximo();
    }).then(function () {
      if (x.tamanhos.length) {   // o produto mostra o copo do meio
        var meio = x.tamanhos[Math.min(1, x.tamanhos.length - 1)];
        x.modelo = meio.modelo; x.dim = { largura: meio.dim.largura, profundidade: meio.dim.profundidade, altura: meio.dim.altura };
      }
      x.ilustrativo = true;
      x.montar = true;
      if (!x.adicionais.length) ADICIONAIS_ACAI.forEach(function (a) { x.adicionais.push(clonar(a)); });
      abertoNoAdmin = x.id; renderAdmin();
      toast('Copos 3D prontos e montador ligado. Toque em “Salvar alterações” para publicar.');
    }).catch(function (e) {
      botao.disabled = false; botao.innerHTML = txt;
      toast(/failed to fetch|network/i.test(e.message) ? 'Sem conexão com o servidor.' : e.message);
    });
  }

  // lê o formulário para o rascunho (sem validar)
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
      x._preco = g('preco').value;
      x.preco = lerPreco(g('preco').value);
      x.categoria = g('categoria').value;
      x.descricao = g('descricao').value.trim();
      x.dim = { largura: Number(g('largura').value), profundidade: Number(g('profundidade').value), altura: Number(g('altura').value) };
      x.modelo = g('modelo').value.trim();
      x.ilustrativo = g('ilustrativo').checked;
      x.montar = g('montar').checked;
      x.esgotado = g('esgotado').checked;
      coletarCopo(d, x);
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
        return { id: antigo.id || slug(q('nome').value) || 'a' + Date.now().toString(36), nome: q('nome').value.trim(), preco: lerPreco(q('preco').value), tipo3d: q('tipo3d').value,
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
    function erro(input, msg) { marcarErro(input, msg); if (!primeiro) primeiro = input; }
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
      if (!isFinite(x.preco) || x.preco < 0 || x.preco > 10000) erro(g('preco'), 'Preço inválido. Ex.: 8,50');
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
    rascunho = clonar(dados);
    abertoNoAdmin = null;
    renderAdmin();
    abrirDialogo($('#dlg-admin'));
  });

  $('#form-admin').addEventListener('submit', function (e) {
    e.preventDefault();
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
    fetch(comLoja('api/cardapio'), { method: 'PUT', headers: cabecalhos(), body: JSON.stringify(dados) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { toast(res.ok ? 'Publicado: todos os clientes já veem a nova versão' : 'Salvo só neste aparelho: ' + (res.j.erro || 'erro ao publicar')); })
      .catch(function () { toast('Salvo só neste aparelho: sem conexão com o servidor'); });
  });

  $('#admin-restaurar').addEventListener('click', function () {
    confirmar('Restaurar o cardápio de demonstração? Todas as alterações feitas neste navegador serão perdidas.', 'Restaurar').then(function (sim) {
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
    if (e.key === 'Enter' && e.target.closest('.login')) { e.preventDefault(); entrar(); }
  });
  $('#admin-corpo').addEventListener('click', function (e) {
    var codAdmin = $('#admin-codigo');
    if (codAdmin && codAdmin.value.trim()) guardarCodigo(codAdmin.value.trim());
    if (e.target.closest('#login-entrar')) { entrar(); return; }
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
      var pn = rascunho.produtos[Number(tamNovo.closest('details').getAttribute('data-i'))];
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
      var pr = rascunho.produtos[Number(tamRem.closest('details').getAttribute('data-i'))];
      pr.tamanhos.splice(Number(tamRem.closest('.tam-linha').getAttribute('data-ti')), 1);
      abertoNoAdmin = pr.id; renderAdmin();
      return;
    }
    var adicNovo = e.target.closest('[data-adic-novo]') || e.target.closest('[data-adic-acai]');
    if (adicNovo) {
      coletarAdmin();
      var pa = rascunho.produtos[Number(adicNovo.closest('details').getAttribute('data-i'))];
      if (adicNovo.hasAttribute('data-adic-acai')) {
        ADICIONAIS_ACAI.forEach(function (a) {
          if (!pa.adicionais.some(function (b) { return b.id === a.id || (a.tipo3d && b.tipo3d === a.tipo3d); })) pa.adicionais.push(clonar(a));
        });
      } else {
        pa.adicionais.push({ id: 'a' + Date.now().toString(36), nome: '', preco: 0, tipo3d: '' });
      }
      abertoNoAdmin = pa.id; renderAdmin();
      return;
    }
    var adicRem = e.target.closest('[data-adic-remover]');
    if (adicRem) {
      coletarAdmin();
      var pq = rascunho.produtos[Number(adicRem.closest('details').getAttribute('data-i'))];
      pq.adicionais.splice(Number(adicRem.closest('.adic-linha').getAttribute('data-ai')), 1);
      abertoNoAdmin = pq.id; renderAdmin();
      return;
    }
    var tam3d = e.target.closest('[data-tam-3d]');
    if (tam3d) { coletarAdmin(); gerarTamanhos3d(tam3d, rascunho.produtos[Number(tam3d.closest('details').getAttribute('data-i'))]); return; }
    var copoGerar = e.target.closest('[data-copo-gerar]');
    if (copoGerar) { coletarAdmin(); gerarCopos(copoGerar, rascunho.produtos[Number(copoGerar.closest('details').getAttribute('data-i'))]); return; }
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
    var g3d = e.target.closest('[data-gerar-3d]');
    if (g3d) {
      coletarAdmin();
      abrirGerador3D(Number(g3d.closest('details').getAttribute('data-i')));
      return;
    }
    var resc = e.target.closest('[data-reescalar]');
    if (resc) {
      coletarAdmin();
      var px = rascunho.produtos[Number(resc.closest('details').getAttribute('data-i'))];
      if (!credenciais()) { toast(LOJA ? 'Entre na conta do estabelecimento' : 'Preencha o código de acesso no topo do painel'); return; }
      if (!(px.dim.largura > 0 && px.dim.profundidade > 0 && px.dim.altura > 0)) { toast('Preencha as três medidas em cm'); return; }
      resc.disabled = true; resc.textContent = 'Ajustando…';
      fetch(comLoja('api/modelo-3d'), { method: 'POST', headers: cabecalhos(),
        body: JSON.stringify({ acao: 'reescalar', url: px.modelo, dim: px.dim, produto: slug(px.nome) }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); })
        .then(function (j) {
          px.modelo = j.url; abertoNoAdmin = px.id; renderAdmin();
          toast('Tamanho ajustado para ' + dimTexto({ largura: j.medidasCm[0], altura: j.medidasCm[1], profundidade: j.medidasCm[2] }) + '. Salve para publicar.');
        })
        .catch(function (err) { resc.disabled = false; resc.textContent = 'Aplicar as medidas acima ao 3D'; toast(err.message); });
      return;
    }
    var rem = e.target.closest('[data-remover-prod]');
    if (rem) {
      coletarAdmin();
      var i = Number(rem.closest('details').getAttribute('data-i'));
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
        toast('Arquivo inválido: não é um cardápio exportado pelo MenuReal AR.');
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
        '<p>Fotografe o cardápio, catálogo ou tabela de preços, ou escolha uma foto da galeria. A leitura é feita por inteligência artificial e pode errar: você revisa cada item antes de ele entrar no cardápio.</p>' +
        '<ul class="dicas-foto"><li>Página inteira no quadro, sem cortes</li><li>Boa luz, sem reflexo</li><li>Celular reto, de frente para o papel</li><li>Cardápio grande: uma foto por página</li></ul>' +
      '</div>' +
      '<label class="seletor-foto' + (foto.previa ? ' tem' : '') + '">' +
        (foto.previa ? '<img src="' + foto.previa + '" alt="Foto do cardápio selecionada">' : ICONES.camera + '<strong>Tirar foto ou escolher da galeria</strong><small>JPG, PNG ou WebP</small>') +
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
  function produtoG3d() { return rascunho && rascunho.produtos[g3d.i]; }

  function abrirGerador3D(i) {
    g3d.i = i; g3d.fotos = []; g3d.resultado = null;
    abrirDialogo($('#dlg-3d'));
    var x = produtoG3d();
    var pend = tarefas3d()[x.id];
    if (pend) acompanharG3d(pend); else renderG3dInicio();
  }

  function renderG3dInicio(erro) {
    var x = produtoG3d();
    $('#g3d-corpo').innerHTML =
      '<p class="g3d-prod"><strong>' + esc(x.nome) + '</strong></p>' +
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
      '<p class="mini">Cada geração usa créditos da sua conta na Meshy (a qualidade alta pode custar mais; confira no painel da Meshy) e leva de 2 a 5 minutos.</p>' +
      (erro ? '<div class="ar-indisp" role="alert"><strong>Não foi possível gerar</strong>' + esc(erro) + '</div>' : '');
    $('#g3d-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="g3d-gerar"' + (g3d.fotos.length ? '' : ' disabled') + '>Gerar modelo 3D</button>';
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
        .then(function (j) { if (!r.ok || !j.tarefa) throw new Error(j.erro || 'Erro ' + r.status); return j; });
    }).then(function (j) {
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
      x.modelo = g3d.resultado.url;
      x.ilustrativo = false;
      abertoNoAdmin = x.id;
      fecharDialogo($('#dlg-3d'));
      renderAdmin();
      toast('Modelo aplicado. Toque em “Salvar alterações” para publicar.');
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
            ? '<ul class="lojas">' + j.contas.map(function (c) {
                return '<li><div><strong>' + esc(c.nome) + '</strong><small>' + esc(c.email) + '</small></div>' +
                  '<a class="btn btn--fantasma btn--p" href="/' + esc(c.slug) + '" target="_blank" rel="noopener">/' + esc(c.slug) + '</a></li>';
              }).join('') + '</ul>'
            : '<p class="mini">Nenhum estabelecimento ainda.</p>') +
          '<div class="nova-loja"><h4>Nova loja (ou nova senha)</h4>' +
            campo('Nome', '<input id="nl-nome" maxlength="60" placeholder="Confeitaria Doce Lar, Móveis Silva…">') +
            campo('Endereço da página', '<input id="nl-slug" maxlength="40" placeholder="doce-lar" autocapitalize="off">', location.host + '/<endereço>') +
            campo('Tipo de negócio', '<select id="nl-tipo"><option value="alimentos">Comida e bebida (cardápio)</option><option value="sorveteria">Sorveteria e açaí (cardápio pronto para montar)</option><option value="produtos">Produtos e objetos (catálogo)</option></select>') +
            campo('E-mail do dono', '<input id="nl-email" type="email" maxlength="120">') +
            campo('Senha inicial (8+ caracteres)', '<input id="nl-senha" type="text" maxlength="120" autocomplete="off">') +
            '<div class="linha-acoes"><button class="btn btn--primario" type="button" id="loja-criar">Criar conta</button>' +
            '<button class="btn btn--fantasma" type="button" id="lojas-atualizar">Atualizar lista</button></div>' +
          '</div>';
        var nome = $('#nl-nome'), sl = $('#nl-slug');
        nome.addEventListener('input', function () { if (!sl.dataset.mexido) sl.value = slug(nome.value).slice(0, 40); });
        sl.addEventListener('input', function () { sl.dataset.mexido = '1'; });
      })
      .catch(function (e) { alvo.innerHTML = '<div class="ar-indisp" role="alert">' + esc(e.message) + '</div><button class="btn btn--sec btn--bloco" type="button" id="lojas-abrir">Tentar de novo</button>'; });
  }
  function criarLoja() {
    var corpo = { nome: $('#nl-nome').value.trim(), slug: $('#nl-slug').value.trim().toLowerCase(), email: $('#nl-email').value.trim(), senha: $('#nl-senha').value, tipo: $('#nl-tipo').value };
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
  function carregarNuvem() {
    if (location.protocol === 'file:' || MODELOS_EMBUTIDOS) return;
    fetch(comLoja('api/cardapio'), { cache: 'no-store' }).then(function (r) {
      var ehJson = /json/.test(r.headers.get('content-type') || '');
      if (!ehJson) { if (LOJA) lojaNaoEncontrada('O servidor do MenuReal não respondeu.'); return null; }
      servidor = true;
      if (r.status === 404 && LOJA) { lojaNaoEncontrada(); return null; }
      return r.ok ? r.json() : null;
    }).then(function (d) {
      var v = d && validarDados(d);
      if (!v || JSON.stringify(v) === JSON.stringify(dados)) return;
      dados = v;
      CATEGORIAS = dados.categorias;
      gravar(CHAVE_DADOS, dados);
      salvarCarrinho();
      renderTudo();
    }).catch(function () { /* sem servidor: segue com os dados locais */ });
  }

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
    atualizarContador();
  }

  // ---------------------------------------------------------------------
  // Início
  // ---------------------------------------------------------------------
  renderTudo();
  carregarNuvem();
  setInterval(renderCabecalho, 60000);

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
