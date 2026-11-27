/* Digital Closet, início: o carrossel do topo (vitrine, sorteador de looks e, para quem já tem peças,
   os números). Desliza com o dedo, troca sozinho de tempos em tempos e tem as bolinhas embaixo. */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  var trilho = $('dc-trilho');
  var bolinhas = $('dc-bolinhas');
  if (!trilho || !bolinhas) return;

  var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var INTERVALO = 7000;
  var relogio = null;
  var mexeu = false;

  function slides() {
    return Array.prototype.filter.call(trilho.querySelectorAll('.dc-slide'), function (s) { return !s.hidden; });
  }

  function atual() {
    var lista = slides();
    var largura = trilho.clientWidth || 1;
    return Math.max(0, Math.min(lista.length - 1, Math.round(trilho.scrollLeft / largura)));
  }

  function irPara(i, suave) {
    var lista = slides();
    if (!lista.length) return;
    var n = (i + lista.length) % lista.length;
    trilho.scrollTo({ left: n * trilho.clientWidth, behavior: suave === false || calmo ? 'auto' : 'smooth' });
  }

  function marcar() {
    var i = atual();
    Array.prototype.forEach.call(bolinhas.children, function (b, n) {
      b.setAttribute('aria-selected', String(n === i));
      b.tabIndex = n === i ? 0 : -1;
    });
    slides().forEach(function (s, n) { s.classList.toggle('dc-ativo', n === i); });
    var ativo = slides()[i];
    if (ativo && ativo.id === 'dc-slide-sorteio' && !ativo.dataset.sorteou) {
      ativo.dataset.sorteou = '1';
      window.setTimeout(sortear, 450);
    }
  }

  function montarBolinhas() {
    bolinhas.textContent = '';
    var lista = slides();
    bolinhas.hidden = lista.length < 2;
    lista.forEach(function (s, n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dc-bolinha';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', s.getAttribute('aria-label') || 'Tela ' + (n + 1));
      b.addEventListener('click', function () { parar(); irPara(n); });
      bolinhas.appendChild(b);
    });
    marcar();
  }

  function parar() {
    mexeu = true;
    window.clearInterval(relogio);
    relogio = null;
  }

  function andar() {
    if (calmo || mexeu || slides().length < 2) return;
    window.clearInterval(relogio);
    relogio = window.setInterval(function () {
      if (document.hidden) return;
      irPara(atual() + 1);
    }, INTERVALO);
  }

  var agendado = null;
  trilho.addEventListener('scroll', function () {
    window.cancelAnimationFrame(agendado);
    agendado = window.requestAnimationFrame(marcar);
  }, { passive: true });
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (ev) {
    trilho.addEventListener(ev, parar, { passive: true });
  });
  bolinhas.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    parar();
    var i = atual() + (e.key === 'ArrowRight' ? 1 : -1);
    irPara(i);
    window.setTimeout(function () { var b = bolinhas.children[atual()]; if (b) b.focus(); }, 350);
  });
  window.addEventListener('resize', function () { irPara(atual(), false); });

  /* --- Fundo com as roupas da pessoa ------------------------------------------------------------ */

  // As peças do catálogo usam a miniatura leve; as fotos da pessoa vão como estão
  function miniatura(foto) {
    var m = /^assets\/img\/sugeridas\/([a-z0-9-]+)\.webp/.exec(foto || '');
    return m ? 'assets/img/sugeridas/mini/' + m[1] + '.webp' : foto;
  }

  // As de sempre, tiradas da vitrine que já vem na página
  var PADRAO = [];
  Array.prototype.forEach.call(document.querySelectorAll('#dc-slide-vitrine .dc-faixa img'), function (img) {
    var src = img.getAttribute('src');
    if (PADRAO.indexOf(src) === -1) PADRAO.push(src);
  });

  function embaralhar(lista, semente) {
    var a = lista.slice();
    var s = semente || 7;
    for (var i = a.length - 1; i > 0; i -= 1) {
      s = (s * 9301 + 49297) % 233280;
      var j = Math.floor(s / 233280 * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // As roupas da pessoa primeiro; se forem poucas, o catálogo completa
  var MAXIMO_DA_PESSOA = 18;
  var MINIMO_NO_FUNDO = 15;
  function fotosDoFundo(pecas) {
    var dela = [];
    (pecas || []).forEach(function (p) {
      var f = miniatura(p.foto);
      if (f && dela.indexOf(f) === -1) dela.push(f);
    });
    dela = embaralhar(dela, dela.length + 3).slice(0, MAXIMO_DA_PESSOA);
    var lista = dela.slice();
    embaralhar(PADRAO, 11).forEach(function (f) { if (lista.length < MINIMO_NO_FUNDO && lista.indexOf(f) === -1) lista.push(f); });
    return { fotos: lista, daPessoa: dela.length };
  }

  function preencherFaixas(caixa, fotos) {
    caixa.textContent = '';
    var classes = ['', 'dc-faixa-volta', 'dc-faixa-lenta'];
    var porFaixa = Math.max(5, Math.ceil(fotos.length / 3));
    classes.forEach(function (classe, n) {
      var faixa = document.createElement('div');
      faixa.className = 'dc-faixa' + (classe ? ' ' + classe : '');
      var trilhoFaixa = document.createElement('div');
      trilhoFaixa.className = 'dc-faixa-trilho';
      // Cada faixa começa num ponto da lista; repete até encher e duplica para o movimento não ter emenda
      var daFaixa = [];
      for (var i = 0; daFaixa.length < Math.max(porFaixa, 8); i += 1) daFaixa.push(fotos[(n * porFaixa + i) % fotos.length]);
      daFaixa.concat(daFaixa).forEach(function (src) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.width = 240;
        img.height = 300;
        img.decoding = 'async';
        img.addEventListener('error', function () { img.remove(); });
        trilhoFaixa.appendChild(img);
      });
      faixa.appendChild(trilhoFaixa);
      caixa.appendChild(faixa);
    });
  }

  // Números que sobem do zero quando a tela aparece
  function contar(el, valor, prefixo) {
    if (!el) return;
    var fim = Number(valor) || 0;
    if (calmo || fim <= 0) { el.textContent = (prefixo || '') + fim; return; }
    var inicio = null;
    function passo(t) {
      if (inicio === null) inicio = t;
      var p = Math.min(1, (t - inicio) / 1100);
      var suave = 1 - Math.pow(1 - p, 3);
      el.textContent = (prefixo || '') + Math.round(fim * suave);
      if (p < 1) window.requestAnimationFrame(passo);
    }
    window.requestAnimationFrame(passo);
  }

  /* --- Sorteador de looks ---------------------------------------------------------------------- */

  var F = 'assets/img/sugeridas/';
  var LOOKS_DEMO = [
    { ocasiao: 'Trabalho', pecas: ['camisa-azul-clara', 'calca-alfaiataria-azul-marinho', 'sapato-derby-marrom', 'relogio-couro-marrom'] },
    { ocasiao: 'Date', pecas: ['blazer-bege', 'calca-jeans-preta', 'sapato-social', 'relogio-dourado-couro-preto'] },
    { ocasiao: 'Fim de semana', pecas: ['moletom-off-white', 'calca-jeans-lavagem-clara', 'tenis-new-balance', 'oculos-sol-aviador-dourado'] },
    { ocasiao: 'Inverno', pecas: ['sueter-verde-oliva', 'calca-alfaiataria-cinza', 'tenis-nike-preto', 'oculos-grau-redondo-tartaruga'] },
    { ocasiao: 'Casamento', pecas: ['blazer-azul-marinho', 'camisa-branca', 'calca-alfaiataria-azul-marinho', 'sapato-social'] },
    { ocasiao: 'Viagem', pecas: ['camiseta-azul-marinho', 'calca-alfaiataria-bege', 'tenis-nike', 'oculos-sol-quadrado-preto'] }
  ];
  var LOOKS = LOOKS_DEMO;
  var vez = 0;
  var caixa = $('dc-sorteio-pecas');
  var dasPessoa = false;

  function desenharLook(look, animar) {
    if (!caixa) return;
    if (!caixa.children.length) {
      look.pecas.forEach(function () {
        var fig = document.createElement('span');
        fig.className = 'dc-sorteio-peca';
        var img = document.createElement('img');
        img.alt = '';
        img.width = 1000;
        img.height = 1250;
        img.decoding = 'async';
        fig.appendChild(img);
        caixa.appendChild(fig);
      });
    }
    $('dc-sorteio-ocasiao').textContent = look.ocasiao;
    Array.prototype.forEach.call(caixa.children, function (fig, n) {
      var img = fig.firstChild;
      var foto = look.pecas[n];
      var trocar = function () {
        fig.hidden = !foto;
        if (foto) img.src = foto.indexOf('/') === -1 ? F + foto + '.webp' : foto;
      };
      if (!animar || calmo) { trocar(); return; }
      window.setTimeout(function () {
        fig.classList.remove('dc-pula');
        fig.classList.add('dc-sai');
        window.setTimeout(function () {
          trocar();
          fig.classList.remove('dc-sai');
          void fig.offsetWidth;
          fig.classList.add('dc-pula');
        }, 160);
      }, n * 90);
    });
    $('dc-sorteio').classList.remove('dc-brilha');
    void $('dc-sorteio').offsetWidth;
    $('dc-sorteio').classList.add('dc-brilha');
  }

  function sortear() {
    vez = (vez + 1 + Math.floor(Math.random() * (LOOKS.length - 1))) % LOOKS.length;
    desenharLook(LOOKS[vez], true);
  }

  if ($('dc-sortear')) {
    desenharLook(LOOKS[0], false);
    $('dc-sortear').addEventListener('click', function () { parar(); sortear(); });
  }

  // Com peças suficientes, o sorteador usa looks de verdade, montados com as roupas da pessoa
  var ORDEM = { camada: 0, cima: 1, conjunto: 1, vestido: 1, baixo: 2, calcado: 3, acessorio: 4 };
  function looksDaPessoa(pecas) {
    var motor = window.AR_LOOKS;
    var gr = window.AR_GR;
    if (!motor || !gr || !pecas || pecas.length < 3) return [];
    var sugeridos = [];
    try { sugeridos = motor.sugerir(pecas, {}, {}) || []; } catch (erro) { return []; }
    return sugeridos.slice(0, 8).map(function (l) {
      var ordenadas = l.pecas.slice().sort(function (a, b) {
        var ga = gr.porTipo[a.tipo] ? gr.porTipo[a.tipo].grupo : 'acessorio';
        var gb = gr.porTipo[b.tipo] ? gr.porTipo[b.tipo].grupo : 'acessorio';
        return (ORDEM[ga] || 5) - (ORDEM[gb] || 5);
      });
      return { ocasiao: l.ocasiao || motor.rotuloDaOcasiao(l.pecas) || 'Seu look', pecas: ordenadas.slice(0, 4).map(function (p) { return p.foto; }) };
    }).filter(function (l) { return l.pecas.length >= 2; });
  }

  window.AR_CARROSSEL_CLOSET = {
    // O início chama quando descobre que a pessoa já tem peças: os números viram a primeira tela
    atualizar: function () { montarBolinhas(); irPara(0, false); andar(); },
    // Cada pessoa vê o fundo com as próprias roupas (o catálogo completa quando são poucas)
    personalizar: function (pecas) {
      var fundo = fotosDoFundo(pecas);
      document.querySelectorAll('#dc-hero [data-faixas]').forEach(function (c) { preencherFaixas(c, fundo.fotos); });
      var dela = looksDaPessoa(pecas);
      if (dela.length >= 2) {
        LOOKS = dela;
        vez = 0;
        dasPessoa = true;
        desenharLook(LOOKS[0], false);
        $('dc-sorteio-titulo').textContent = 'Toque e ganhe um look seu';
        $('dc-sorteio-nota').textContent = 'Montados com as roupas do seu closet. Toque de novo para outra combinação.';
      }
    },
    contar: contar
  };

  document.querySelectorAll('#dc-hero [data-faixas]').forEach(function (c) { if (!c.children.length) preencherFaixas(c, embaralhar(PADRAO, 5)); });
  montarBolinhas();
  andar();
})();
