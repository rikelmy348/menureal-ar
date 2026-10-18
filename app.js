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
  var CHAVE_DADOS = 'menureal:dados:v1';
  var CHAVE_CARRINHO = 'menureal:carrinho:v1';
  var CATEGORIAS = ['Salgados', 'Doces', 'Pães', 'Bebidas'];
  var DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  var TOLERANCIA_ESCALA = 0.05; // 5% de diferença aceitável entre arquivo e cadastro

  // Na versão de arquivo único, os GLBs vêm embutidos como data: URI
  var MODELOS_EMBUTIDOS = window.MENUREAL_MODELOS || null;
  var reduzMovimento = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Dados de demonstração. Preços e medidas são FICTÍCIOS.
  // Medidas em centímetros: largura (X), profundidade (Z), altura (Y).
  var PADRAO = {
    padaria: {
      nome: 'Padaria Sabor da Vila',
      slogan: 'Veja antes de pedir',
      abre: '06:00',
      fecha: '20:00',
      dias: [1, 2, 3, 4, 5, 6],
      whatsapp: '' // ex.: 5511999999999 (DDI + DDD + número). Vazio = desativado.
    },
    produtos: [
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
  var dados = validarDados(ler(CHAVE_DADOS)) || clonar(PADRAO);
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
      whatsapp: String(p.whatsapp || '').replace(/\D/g, '')
    };
    var ids = {};
    var produtos = d.produtos.filter(function (x) { return x && x.nome; }).map(function (x) {
      var id = String(x.id || slug(x.nome));
      while (ids[id]) id += '-2';
      ids[id] = 1;
      var dim = x.dim || {};
      return {
        id: id,
        nome: String(x.nome),
        categoria: CATEGORIAS.indexOf(x.categoria) > -1 ? x.categoria : 'Salgados',
        preco: Math.max(0, Number(x.preco) || 0),
        descricao: String(x.descricao || ''),
        dim: { largura: Number(dim.largura) || 1, profundidade: Number(dim.profundidade) || 1, altura: Number(dim.altura) || 1 },
        modelo: String(x.modelo || ''),
        ilustrativo: x.ilustrativo !== false
      };
    });
    return { padaria: padaria, produtos: produtos };
  }

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

  function renderCabecalho() {
    var p = dados.padaria;
    $('#nome-padaria').textContent = p.nome;
    $('#slogan-padaria').textContent = p.slogan;
    document.title = 'MenuReal AR — ' + p.nome;
    $('#horario-texto').textContent = diasTexto(p.dias) + ' · ' + horaTexto(p.abre) + ' às ' + horaTexto(p.fecha) + ' (horário demonstrativo)';
    var agora = new Date();
    var min = agora.getHours() * 60 + agora.getMinutes();
    function m(h) { var x = h.split(':'); return Number(x[0]) * 60 + Number(x[1]); }
    var aberto = p.dias.indexOf(agora.getDay()) > -1 && min >= m(p.abre) && min < m(p.fecha);
    var st = $('#status-horario');
    st.classList.toggle('aberto', aberto);
    st.classList.toggle('fechado', !aberto);
    $('#status-texto').textContent = aberto ? 'Aberto agora' : 'Fechado agora';
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
      return semAcento(p.nome + ' ' + p.descricao + ' ' + p.categoria).indexOf(q) > -1;
    });
  }

  function htmlCard(p) {
    var temModelo = !!p.modelo;
    var corpo =
      '<div class="card__corpo">' +
        '<div class="card__linha"><div><p class="card__cat">' + esc(p.categoria) + '</p><h3 class="card__nome">' + esc(p.nome) + '</h3></div>' +
        '<span class="card__preco">' + brl(p.preco) + '</span></div>' +
        (p.descricao ? '<p class="card__desc">' + esc(p.descricao) + '</p>' : '') +
        '<div class="card__acoes">' +
          (temModelo
            ? '<button class="btn btn--sec btn--p" type="button" data-acao="3d">' + ICONES.cubo + 'Ver em 3D</button>' +
              '<button class="btn btn--contorno btn--p" type="button" data-acao="ar">' + ICONES.ar + 'Ver em tamanho real</button>'
            : '') +
          '<button class="btn btn--primario" type="button" data-acao="add">' + ICONES.mais + 'Adicionar ao pedido</button>' +
        '</div>' +
      '</div>';
    // Produto sem modelo 3D: card compacto, só com texto e botão de pedido
    if (!temModelo) return '<article class="card card--simples" data-id="' + esc(p.id) + '">' + corpo + '</article>';
    return '<article class="card" data-id="' + esc(p.id) + '">' +
      '<button class="card__palco" type="button" data-acao="3d" aria-label="Ver ' + esc(p.nome) + ' em 3D">' +
        '<model-viewer src="' + esc(urlModelo(p.modelo)) + '" alt="Modelo 3D ilustrativo: ' + esc(p.nome) + '" loading="lazy" reveal="auto"' +
        ' camera-orbit="28deg 68deg auto" shadow-intensity="1" shadow-softness="0.9" environment-image="neutral" exposure="1.05"' +
        ' interaction-prompt="none" disable-zoom disable-tap tabindex="-1"></model-viewer>' +
        '<div class="card__estado" data-estado><div class="carregando"><div class="spinner" aria-hidden="true"></div><span>Carregando 3D…</span><div class="barra"><i></i></div></div></div>' +
        '<span class="card__tags"><span class="tag tag--3d">3D · RA</span>' + (p.ilustrativo ? '<span class="tag">Modelo ilustrativo</span>' : '') + '</span>' +
        '<span class="card__dim" title="Largura × profundidade × altura">' + esc(dimTexto(p.dim)) + '</span>' +
      '</button>' + corpo +
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
      estado.innerHTML = '<div><strong>Modelo 3D indisponível</strong>O arquivo não foi encontrado ou está corrompido.</div>';
    });
    if (mvStatus === 'falhou') marcarCardSemBiblioteca(estado);
  }

  function marcarCardSemBiblioteca(estado) {
    if (!estado) return;
    estado.hidden = false;
    estado.innerHTML = '<div><strong>3D indisponível</strong>A biblioteca 3D não carregou. Verifique a conexão e recarregue a página.</div>';
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
    else itens.push('Computadores não abrem a câmera em RA. Abra este cardápio em um celular compatível — o 3D continua funcionando aqui.');
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

  function abrirViewer(id, modo) {
    var p = produtoPorId(id);
    if (!p) return;
    produtoAtual = p;
    $('#viewer-cat').textContent = p.categoria + (p.ilustrativo ? ' · modelo ilustrativo' : '');
    $('#viewer-nome').textContent = p.nome;
    $('#viewer-preco').textContent = brl(p.preco);
    $('#viewer-dim').textContent = dimTexto(p.dim);
    $('#viewer-dim-modelo').textContent = 'calculando…';
    $('#viewer-desc').textContent = p.descricao;
    $('#viewer-escala').hidden = true;
    $('#ar-indisp').hidden = true;
    var add = $('#viewer-add');
    add.classList.remove('feito');
    add.textContent = 'Adicionar ao pedido · ' + brl(p.preco);

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
    if (!p.modelo) {
      estadoPalco('<div class="caixa-erro"><strong>Este produto ainda não tem modelo 3D</strong>Defina o caminho do arquivo .glb no painel administrativo.</div>', true);
      $('#viewer-dim-modelo').textContent = '—';
      return;
    }

    var mv = document.createElement('model-viewer');
    var attrs = {
      src: urlModelo(p.modelo),
      alt: 'Modelo 3D ilustrativo de ' + p.nome + ', ' + dimTexto(p.dim),
      ar: '',
      // Scene Viewer primeiro: no Android ele fixa o objeto na mesa com mais estabilidade
      // Com medidas ligadas, a RA abre dentro do Chrome (WebXR), único modo que mostra as etiquetas
      'ar-modes': medidasLigadas ? 'webxr scene-viewer quick-look' : 'scene-viewer webxr quick-look',
      'ar-scale': 'fixed',
      'ar-placement': 'floor',
      'camera-controls': '',
      'touch-action': 'pan-y',
      'camera-orbit': '28deg 68deg auto',
      'interaction-prompt': 'auto',
      'shadow-intensity': '1',
      'shadow-softness': '0.85',
      'environment-image': 'neutral',
      exposure: '1.05',
      'interpolation-decay': reduzMovimento ? '20' : '120'
    };
    if (!reduzMovimento) { attrs['auto-rotate'] = ''; attrs['auto-rotate-delay'] = '2500'; attrs['rotation-per-second'] = '18deg'; }
    Object.keys(attrs).forEach(function (k) { mv.setAttribute(k, attrs[k]); });
    mv.innerHTML =
      '<button slot="ar-button" class="botao-ar" type="button">' + ICONES.ar + 'Abrir câmera · tamanho real</button>' +
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
      conferirEscala(mv, p);
      atualizarAvisoAR();
    });
    mv.addEventListener('error', function () {
      estadoPalco('<div class="caixa-erro"><strong>Não foi possível carregar o modelo 3D</strong>' +
        'Confira se o arquivo existe e se a página está sendo servida por um servidor (não abra o index.html direto do disco).<br><br>' +
        'Arquivo: <code>' + esc(p.modelo) + '</code></div>', true);
      $('#viewer-dim-modelo').textContent = '—';
      $('#ar-indisp').hidden = false;
      $('#ar-indisp').innerHTML = '<strong>Realidade aumentada indisponível</strong>O modelo 3D deste produto não carregou.';
    });
    mv.addEventListener('ar-status', function (e) {
      if (e.detail.status === 'failed') {
        toast('Não foi possível abrir a câmera em RA neste aparelho. Continue no 3D.');
        trocarAba('3d');
      }
    });
    if (mvStatus === 'carregando') {
      estadoPalco('<div class="carregando"><div class="spinner" aria-hidden="true"></div><span>Preparando visualizador 3D…</span></div>');
    }
  }

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
    var linhas = $$('.med-linhas line', mv);
    function quadro() {
      if (!mv.isConnected) return;
      if (!mv.classList.contains('sem-medidas')) {
        linhas.forEach(function (l) {
          var a = mv.queryHotspot('hotspot-' + l.getAttribute('data-de'));
          var b = mv.queryHotspot('hotspot-' + l.getAttribute('data-ate'));
          if (!a || !b) return;
          l.setAttribute('x1', a.canvasPosition.x); l.setAttribute('y1', a.canvasPosition.y);
          l.setAttribute('x2', b.canvasPosition.x); l.setAttribute('y2', b.canvasPosition.y);
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
  $('#viewer-add').addEventListener('click', function () {
    if (!produtoAtual) return;
    adicionar(produtoAtual.id);
    var b = this;
    b.classList.add('feito');
    b.textContent = 'Adicionado ✓';
    setTimeout(function () { b.classList.remove('feito'); b.textContent = 'Adicionar mais um · ' + brl(produtoAtual.preco); }, 1400);
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
  function itensCarrinho() {
    return Object.keys(carrinho).map(function (id) {
      var p = produtoPorId(id);
      return p && carrinho[id] > 0 ? { p: p, qtd: carrinho[id] } : null;
    }).filter(Boolean);
  }
  function salvarCarrinho() {
    Object.keys(carrinho).forEach(function (id) { if (!produtoPorId(id) || carrinho[id] <= 0) delete carrinho[id]; });
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

  function adicionar(id) {
    var p = produtoPorId(id);
    if (!p) return;
    carrinho[id] = (carrinho[id] || 0) + 1;
    salvarCarrinho();
    atualizarContador(true);
    toast(p.nome + ' adicionado ao pedido');
    if ($('#dlg-carrinho').open) renderCarrinho();
  }

  function renderCarrinho() {
    var corpo = $('#carrinho-corpo');
    var rodape = $('#carrinho-rodape');
    var itens = itensCarrinho();
    if (!itens.length) {
      corpo.innerHTML = '<div class="carrinho-vazio">' + ICONES.sacola + '<strong>Seu pedido está vazio</strong>Escolha um item no cardápio para começar.</div>';
      rodape.innerHTML = '<button class="btn btn--contorno btn--bloco" type="button" data-fechar>Voltar ao cardápio</button>';
      return;
    }
    corpo.innerHTML = itens.map(function (i) {
      return '<div class="item" data-id="' + esc(i.p.id) + '">' +
        '<div><p class="item__nome">' + esc(i.p.nome) + '</p><p class="item__unit">' + brl(i.p.preco) + ' cada</p></div>' +
        '<span class="item__sub">' + brl(i.p.preco * i.qtd) + '</span>' +
        '<div class="item__ctrl">' +
          '<div class="qtd"><button type="button" data-q="-1" aria-label="Diminuir ' + esc(i.p.nome) + '">−</button>' +
          '<output aria-live="polite" aria-label="Quantidade">' + i.qtd + '</output>' +
          '<button type="button" data-q="1" aria-label="Aumentar ' + esc(i.p.nome) + '">+</button></div>' +
          '<button class="link-remover" type="button" data-remover>Remover</button>' +
        '</div></div>';
    }).join('') +
      '<label class="campo" style="margin-top:14px">Observações (opcional)<textarea class="obs" id="obs" maxlength="280" placeholder="Ex.: sem azeitona na empada">' + esc(sessionObs) + '</textarea></label>';
    var total = totalCarrinho();
    rodape.innerHTML =
      '<div class="totais"><div><span>Itens</span><span>' + qtdCarrinho() + '</span></div>' +
      '<div class="total"><span>Total</span><span>' + brl(total) + '</span></div></div>' +
      '<button class="btn btn--primario btn--bloco" type="button" id="finalizar">Finalizar pedido</button>';
  }
  var sessionObs = '';

  function resumoPedido() {
    var linhas = ['Pedido — ' + dados.padaria.nome, ''];
    itensCarrinho().forEach(function (i) { linhas.push(i.qtd + 'x ' + i.p.nome + ' — ' + brl(i.p.preco * i.qtd)); });
    linhas.push('', 'Total: ' + brl(totalCarrinho()));
    if (sessionObs.trim()) linhas.push('Obs.: ' + sessionObs.trim());
    linhas.push('', '(Pedido demonstrativo gerado pelo MenuReal AR)');
    return linhas.join('\n');
  }

  function renderConfirmacao() {
    var resumo = resumoPedido();
    var zap = dados.padaria.whatsapp;
    $('#carrinho-corpo').innerHTML =
      '<div class="confirmacao">' +
        '<div class="confirmacao__selo">' + ICONES.ok + '</div>' +
        '<h3>Pedido demonstrativo</h3>' +
        '<p>Esta é uma versão de demonstração: <strong>o pedido não foi enviado à padaria e nenhum pagamento foi processado</strong>. Confira o resumo:</p>' +
        '<div class="resumo">' + esc(resumo) + '</div>' +
        (zap ? '' : '<p class="mini">Integração com WhatsApp: cadastre o número da padaria no painel administrativo para enviar este resumo por mensagem.</p>') +
      '</div>';
    $('#carrinho-rodape').innerHTML = '<div class="pilha">' +
      (zap ? '<a class="btn btn--primario btn--bloco" target="_blank" rel="noopener" href="https://wa.me/' + esc(zap) + '?text=' + encodeURIComponent(resumo) + '">Enviar resumo pelo WhatsApp</a>' : '') +
      '<button class="btn ' + (zap ? 'btn--contorno' : 'btn--primario') + ' btn--bloco" type="button" id="novo-pedido">Concluir e limpar pedido</button>' +
      '<button class="btn btn--fantasma btn--bloco" type="button" id="voltar-pedido">Voltar e editar</button></div>';
  }

  $('#btn-carrinho').addEventListener('click', function () { renderCarrinho(); abrirDialogo($('#dlg-carrinho')); });
  $('#dlg-carrinho').addEventListener('input', function (e) { if (e.target.id === 'obs') sessionObs = e.target.value; });
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
    if (e.target.closest('#finalizar')) { renderConfirmacao(); return; }
    if (e.target.closest('#voltar-pedido')) { renderCarrinho(); return; }
    if (e.target.closest('#novo-pedido')) {
      carrinho = {};
      sessionObs = '';
      salvarCarrinho();
      fecharDialogo($('#dlg-carrinho'));
      toast('Pedido demonstrativo concluído');
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

  function renderAdmin() {
    var p = rascunho.padaria;
    var h =
      (servidor
        ? '<div class="aviso-admin aviso-admin--ok"><strong>Publicação para todos os clientes</strong>Com o código de acesso correto, “Salvar alterações” publica o cardápio na nuvem e todos os clientes passam a ver a nova versão.</div>' +
          campo('Código de acesso', '<input id="admin-codigo" type="password" autocomplete="off" maxlength="80" value="' + esc(lerCodigo()) + '">', 'O mesmo definido na Netlify (MENUREAL_CODIGO). Sem ele, as alterações ficam só neste aparelho.')
        : '<div class="aviso-admin"><strong>Administração apenas local</strong>Este endereço não tem o servidor do MenuReal: as alterações ficam salvas só neste navegador. Publique pelo GitHub na Netlify para salvar na nuvem.</div>') +
      '<section class="secao-admin"><h3>Padaria</h3><div class="campos">' +
        campo('Nome da padaria', '<input name="p-nome" required maxlength="60" value="' + esc(p.nome) + '">') +
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
        campo('WhatsApp da padaria (opcional)', '<input name="p-zap" inputmode="numeric" maxlength="15" placeholder="Somente números, com DDI e DDD" value="' + esc(p.whatsapp) + '">',
          'Deixe vazio para desativar. Use o número comercial real da padaria; nada é enviado automaticamente.') +
      '</div></section>' +
      '<section class="secao-admin"><h3>Produtos (' + rascunho.produtos.length + ')</h3>' +
        '<button class="btn btn--contorno btn--bloco destaque-foto" type="button" id="admin-foto">' + ICONES.camera +
          '<span><strong>Criar a partir de uma foto do cardápio</strong><small>Tire uma foto do cardápio impresso e revise os itens lidos</small></span></button>' +
        rascunho.produtos.map(function (x, i) { return htmlProdutoAdmin(x, i); }).join('') +
        '<div class="linha-acoes" style="margin-top:12px">' +
          '<button class="btn btn--sec" type="button" id="admin-novo">' + ICONES.mais + 'Adicionar produto</button>' +
          '<button class="btn btn--fantasma" type="button" id="admin-exportar">Exportar JSON</button>' +
          '<label class="btn btn--fantasma" style="cursor:pointer">Importar JSON<input type="file" accept="application/json,.json" id="admin-importar" hidden></label>' +
        '</div>' +
      '</section>';
    $('#admin-corpo').innerHTML = h;
  }

  function htmlProdutoAdmin(x, i) {
    var aberto = abertoNoAdmin === x.id;
    return '<details class="prod" data-i="' + i + '"' + (aberto ? ' open' : '') + '>' +
      '<summary><span>' + esc(x.nome || 'Novo produto') + '<br><span class="prod__meta">' + esc(x.categoria) + ' · ' + brl(x.preco) + ' · ' + esc(dimTexto(x.dim)) + '</span></span></summary>' +
      '<div class="prod__corpo">' +
        campo('Nome', '<input data-f="nome" required maxlength="60" value="' + esc(x.nome) + '">') +
        '<div class="campos campos--2">' +
          campo('Preço (R$)', '<input data-f="preco" inputmode="decimal" value="' + esc(x.preco.toFixed(2).replace('.', ',')) + '">') +
          campo('Categoria', '<select data-f="categoria">' + CATEGORIAS.map(function (c) {
            return '<option' + (c === x.categoria ? ' selected' : '') + '>' + c + '</option>';
          }).join('') + '</select>') +
        '</div>' +
        campo('Descrição', '<textarea data-f="descricao" maxlength="240">' + esc(x.descricao) + '</textarea>') +
        '<div class="campos campos--3">' +
          campo('Largura (cm)', '<input data-f="largura" type="number" min="0.1" max="200" step="0.1" inputmode="decimal" value="' + x.dim.largura + '">') +
          campo('Profund. (cm)', '<input data-f="profundidade" type="number" min="0.1" max="200" step="0.1" inputmode="decimal" value="' + x.dim.profundidade + '">') +
          campo('Altura (cm)', '<input data-f="altura" type="number" min="0.1" max="200" step="0.1" inputmode="decimal" value="' + x.dim.altura + '">') +
        '</div>' +
        campo('Arquivo 3D (.glb)', '<input data-f="modelo" maxlength="300" placeholder="assets/models/produto.glb" value="' + esc(x.modelo) + '">',
          'Caminho relativo ao index.html ou URL HTTPS com CORS liberado. O modelo deve estar em metros, com as medidas acima.') +
        '<label class="checar"><input type="checkbox" data-f="ilustrativo"' + (x.ilustrativo ? ' checked' : '') + '> Exibir selo “Modelo ilustrativo”</label>' +
        '<div class="linha-acoes">' +
          (servidor ? '<button class="btn btn--sec btn--p" type="button" data-gerar-3d>' + ICONES.cubo + (x.modelo ? 'Refazer 3D com fotos' : 'Gerar 3D realista com fotos') + '</button>' : '') +
          (servidor && /^api\/arquivo\//.test(x.modelo) ? '<button class="btn btn--contorno btn--p" type="button" data-reescalar>Aplicar as medidas acima ao 3D</button>' : '') +
          '<button class="btn btn--perigo btn--p" type="button" data-remover-prod>Remover produto</button></div>' +
      '</div></details>';
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
    if (!rascunho.padaria.nome) erro(f.elements['p-nome'], 'Informe o nome da padaria.');
    var zap = rascunho.padaria.whatsapp;
    if (zap && (zap.length < 10 || zap.length > 15)) erro(f.elements['p-zap'], 'Número inválido. Use DDI + DDD + número (10 a 15 dígitos).');
    $$('details.prod', f).forEach(function (d) {
      var x = rascunho.produtos[Number(d.getAttribute('data-i'))];
      var g = function (k) { return d.querySelector('[data-f="' + k + '"]'); };
      var antes = primeiro;
      if (!x.nome) erro(g('nome'), 'Informe o nome.');
      if (!isFinite(x.preco) || x.preco < 0 || x.preco > 10000) erro(g('preco'), 'Preço inválido. Ex.: 8,50');
      ['largura', 'profundidade', 'altura'].forEach(function (k) {
        if (!(x.dim[k] > 0 && x.dim[k] <= 200)) erro(g(k), 'Entre 0,1 e 200.');
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
    salvarCarrinho();
    renderTudo();
    fecharDialogo($('#dlg-admin'));
    if (!servidor || !codigoAdmin) {
      toast(salvo ? 'Alterações salvas só neste aparelho' : 'Não foi possível salvar (armazenamento bloqueado). As alterações valem só até recarregar.');
      return;
    }
    toast('Publicando para todos os clientes…');
    fetch('api/cardapio', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-menureal-codigo': codigoAdmin }, body: JSON.stringify(dados) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { toast(res.ok ? 'Publicado: todos os clientes já veem a nova versão' : 'Salvo só neste aparelho: ' + (res.j.erro || 'erro ao publicar')); })
      .catch(function () { toast('Salvo só neste aparelho: sem conexão com o servidor'); });
  });

  $('#admin-restaurar').addEventListener('click', function () {
    confirmar('Restaurar o cardápio de demonstração? Todas as alterações feitas neste navegador serão perdidas.', 'Restaurar').then(function (sim) {
    if (!sim) return;
    apagar(CHAVE_DADOS);
    dados = clonar(PADRAO);
    salvarCarrinho();
    renderTudo();
    fecharDialogo($('#dlg-admin'));
    toast('Cardápio de demonstração restaurado');
    });
  });

  $('#admin-corpo').addEventListener('click', function (e) {
    var codAdmin = $('#admin-codigo');
    if (codAdmin && codAdmin.value.trim()) guardarCodigo(codAdmin.value.trim());
    if (e.target.closest('#admin-foto')) {
      coletarAdmin();
      abrirLeitorFoto();
      return;
    }
    if (e.target.closest('#admin-novo')) {
      coletarAdmin();
      var novo = { id: 'produto-' + Date.now().toString(36), nome: 'Novo produto', categoria: filtro.cat !== 'Todos' ? filtro.cat : 'Salgados',
        preco: 0, descricao: '', dim: { largura: 5, profundidade: 5, altura: 5 }, modelo: '', ilustrativo: true };
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
      var cod = lerCodigo();
      if (!cod) { toast('Preencha o código de acesso no topo do painel'); return; }
      if (!(px.dim.largura > 0 && px.dim.profundidade > 0 && px.dim.altura > 0)) { toast('Preencha as três medidas em cm'); return; }
      resc.disabled = true; resc.textContent = 'Ajustando…';
      fetch('api/modelo-3d', { method: 'POST', headers: { 'content-type': 'application/json', 'x-menureal-codigo': cod },
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
  // Criar cardápio por foto (precisa do servidor: netlify/functions)
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
        '<p>Fotografe o cardápio impresso ou escolha uma foto da galeria. A leitura é feita por inteligência artificial e pode errar: você revisa cada item antes de ele entrar no cardápio.</p>' +
        '<ul class="dicas-foto"><li>Cardápio inteiro no quadro, sem cortes</li><li>Boa luz, sem reflexo</li><li>Celular reto, de frente para o papel</li><li>Cardápio grande: uma foto por página</li></ul>' +
      '</div>' +
      '<label class="seletor-foto' + (foto.previa ? ' tem' : '') + '">' +
        (foto.previa ? '<img src="' + foto.previa + '" alt="Foto do cardápio selecionada">' : ICONES.camera + '<strong>Tirar foto ou escolher da galeria</strong><small>JPG, PNG ou WebP</small>') +
        '<input type="file" accept="image/jpeg,image/png,image/webp,image/*" id="foto-arquivo" hidden>' +
      '</label>' +
      (foto.previa ? '<button class="btn btn--fantasma btn--p" type="button" id="foto-trocar">Trocar foto</button>' : '') +
      campo('Código de acesso', '<input id="foto-codigo" type="password" autocomplete="off" maxlength="80" value="' + esc(lerCodigo()) + '">',
        'Definido por você na Netlify (variável MENUREAL_CODIGO). Protege a leitura contra uso por estranhos.') +
      (erro ? '<div class="ar-indisp" role="alert"><strong>Não foi possível ler</strong>' + esc(erro) + '</div>' : '');
    $('#foto-rodape').innerHTML = '<button class="btn btn--primario btn--bloco" type="button" id="foto-ler"' + (foto.imagem ? '' : ' disabled') + '>Ler cardápio</button>';
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
        '<strong id="foto-status" aria-live="polite">' + (qtd ? qtd + (qtd === 1 ? ' item encontrado…' : ' itens encontrados…') : 'Lendo o cardápio…') + '</strong>' +
        '<small>Pode levar até 1 minuto em cardápios grandes.</small></div>' +
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
    var codigo = ($('#foto-codigo') || {}).value || '';
    if (!codigo.trim()) { renderFotoInicio('Digite o código de acesso.'); $('#foto-codigo').focus(); return; }
    guardarCodigo(codigo.trim());
    foto.lendo = true;
    foto.controle = window.AbortController ? new AbortController() : null;
    renderLendo(0);
    var contados = 0;
    fetch(API_FOTO, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-menureal-codigo': codigo.trim() },
      body: JSON.stringify({ imagem: foto.imagem, tipo: 'image/jpeg' }),
      signal: foto.controle ? foto.controle.signal : undefined
    }).then(function (r) {
      var tipo = r.headers.get('content-type') || '';
      if (!r.ok || tipo.indexOf('text/event-stream') === -1) {
        if (r.status === 404 || r.status === 405 || tipo.indexOf('text/html') > -1) {
          throw new Error('O servidor de leitura não foi encontrado. Este recurso só funciona no site publicado na Netlify a partir do GitHub, com a chave configurada (veja o README).');
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
      if (res.parada === 'max_tokens') throw new Error('O cardápio é grande demais para uma foto só. Fotografe uma página ou metade por vez.');
      var dados;
      try { dados = JSON.parse(res.texto); } catch (e) { throw new Error('A resposta veio incompleta. Tente de novo.'); }
      foto.itens = (dados.itens || []).filter(function (x) { return x && x.nome; }).map(function (x) {
        return {
          nome: String(x.nome).trim().slice(0, 60),
          preco: typeof x.preco === 'number' && isFinite(x.preco) && x.preco >= 0 ? Math.round(x.preco * 100) / 100 : null,
          descricao: String(x.descricao || '').trim().slice(0, 240),
          categoria: CATEGORIAS.filter(function (c) { return semAcento(c) === semAcento(x.categoria); })[0] || 'Salgados',
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
                '<select data-rf="categoria" aria-label="Categoria">' + CATEGORIAS.map(function (c) { return '<option' + (c === x.categoria ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select>' +
              '</div>' +
              (x.descricao ? '<p class="rev__desc">' + esc(x.descricao) + '</p>' : '') +
              (x.preco == null ? '<p class="rev__obs">Preço não identificado: digite o valor.</p>' : '') +
              (x.observacao ? '<p class="rev__obs">' + esc(x.observacao) + '</p>' : '') +
              (dup ? '<p class="rev__obs">Já existe um produto com este nome no cardápio.</p>' : '') +
            '</div></div>';
        }).join('') + '</div>'
        : '<div class="carrinho-vazio"><strong>Nenhum item encontrado</strong>Tente uma foto mais nítida, com o cardápio inteiro no quadro.</div>');
    $('#foto-rodape').innerHTML = n
      ? '<div class="pilha"><button class="btn btn--primario btn--bloco" type="button" id="foto-adicionar">Adicionar ao cardápio</button>' +
        '<button class="btn btn--fantasma btn--bloco" type="button" id="foto-substituir">Substituir o cardápio atual</button></div>'
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
          dim: { largura: 5, profundidade: 5, altura: 5 }, modelo: '', ilustrativo: true };
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
      var cod = ($('#foto-codigo') || {}).value;
      if (cod) guardarCodigo(cod);
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
  var g3d = { i: null, fotos: [], timer: null, resultado: null };

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
          campo('Largura', '<input id="g3d-largura" type="number" min="0.5" max="200" step="0.1" inputmode="decimal" value="' + x.dim.largura + '">') +
          campo('Profund.', '<input id="g3d-profundidade" type="number" min="0.5" max="200" step="0.1" inputmode="decimal" value="' + x.dim.profundidade + '">') +
          campo('Altura', '<input id="g3d-altura" type="number" min="0.5" max="200" step="0.1" inputmode="decimal" value="' + x.dim.altura + '">') +
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
      campo('Código de acesso', '<input id="g3d-codigo" type="password" autocomplete="off" maxlength="80" value="' + esc(lerCodigo()) + '">') +
      '<p class="mini">Cada geração usa créditos da sua conta na Meshy e leva de 2 a 5 minutos.</p>' +
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
    var codigo = (($('#g3d-codigo') || {}).value || '').trim();
    var x = produtoG3d();
    var dimNova = { largura: Number($('#g3d-largura').value), profundidade: Number($('#g3d-profundidade').value), altura: Number($('#g3d-altura').value) };
    if (!(dimNova.largura > 0 && dimNova.profundidade > 0 && dimNova.altura > 0)) { renderG3dInicio('Preencha as três medidas reais, em centímetros.'); return; }
    x.dim = dimNova;
    if (!codigo) { renderG3dInicio('Digite o código de acesso.'); $('#g3d-codigo').focus(); return; }
    guardarCodigo(codigo);
    renderG3dProgresso(2, 'Enviando fotos…');
    fetch('api/modelo-3d', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-menureal-codigo': codigo },
      body: JSON.stringify({ imagens: g3d.fotos.map(function (f) { return f.base64; }) })
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
      fetch('api/modelo-3d' + q, { headers: { 'x-menureal-codigo': lerCodigo() }, cache: 'no-store' })
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
        (reduzMovimento ? '' : 'auto-rotate ') + 'shadow-intensity="1" environment-image="neutral" exposure="1.05"></model-viewer></div>' +
      '<p class="escala ok">✓ Modelo pronto e guardado na nuvem. Medidas finais: ' +
        esc(dimTexto({ largura: r.medidasCm[0], altura: r.medidasCm[1], profundidade: r.medidasCm[2] })) + ' (' + esc(String(r.tamanhoMb)) + ' MB).</p>' +
      '<p class="mini">Gire a prévia para conferir. Se não ficou bom, gere de novo com fotos mais nítidas e fundo liso.</p>';
    $('#g3d-rodape').innerHTML = '<div class="pilha"><button class="btn btn--primario btn--bloco" type="button" id="g3d-usar">Usar este modelo</button>' +
      '<button class="btn btn--fantasma btn--bloco" type="button" id="g3d-refazer">Gerar de novo</button></div>';
  }

  $('#dlg-3d').addEventListener('change', function (e) {
    if (e.target.id !== 'g3d-arquivo' || !e.target.files.length) return;
    var arquivos = Array.prototype.slice.call(e.target.files, 0, 4 - g3d.fotos.length);
    ['largura', 'profundidade', 'altura'].forEach(function (k) { var v = Number(($('#g3d-' + k) || {}).value); if (v > 0) produtoG3d().dim[k] = v; });
    var cod = ($('#g3d-codigo') || {}).value;
    if (cod) guardarCodigo(cod);
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

  // Cardápio publicado na nuvem (site na Netlify com funções)
  function carregarNuvem() {
    if (location.protocol === 'file:' || MODELOS_EMBUTIDOS) return;
    fetch('api/cardapio', { cache: 'no-store' }).then(function (r) {
      var ehJson = /json/.test(r.headers.get('content-type') || '');
      if (!ehJson) return null;
      servidor = true;
      return r.ok ? r.json() : null;
    }).then(function (d) {
      var v = d && validarDados(d);
      if (!v || JSON.stringify(v) === JSON.stringify(dados)) return;
      dados = v;
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
    t.classList.add('ver');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('ver'); }, 2600);
  }

  // ---------------------------------------------------------------------
  // Eventos do cardápio
  // ---------------------------------------------------------------------
  $('#grade').addEventListener('click', function (e) {
    var b = e.target.closest('[data-acao]');
    if (!b || b.disabled) return;
    var id = b.closest('.card').getAttribute('data-id');
    var acao = b.getAttribute('data-acao');
    if (acao === 'add') {
      adicionar(id);
      var original = b.innerHTML;
      b.classList.add('feito');
      b.innerHTML = ICONES.ok + 'Adicionado';
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
