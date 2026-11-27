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

  /* --- Sorteador de looks ---------------------------------------------------------------------- */

  var F = 'assets/img/sugeridas/';
  var LOOKS = [
    { ocasiao: 'Trabalho', pecas: ['camisa-azul-clara', 'calca-alfaiataria-azul-marinho', 'sapato-derby-marrom', 'relogio-couro-marrom'] },
    { ocasiao: 'Date', pecas: ['blazer-bege', 'calca-jeans-preta', 'sapato-social', 'relogio-dourado-couro-preto'] },
    { ocasiao: 'Fim de semana', pecas: ['moletom-off-white', 'calca-jeans-lavagem-clara', 'tenis-new-balance', 'oculos-sol-aviador-dourado'] },
    { ocasiao: 'Inverno', pecas: ['sueter-verde-oliva', 'calca-alfaiataria-cinza', 'tenis-nike-preto', 'oculos-grau-redondo-tartaruga'] },
    { ocasiao: 'Casamento', pecas: ['blazer-azul-marinho', 'camisa-branca', 'calca-alfaiataria-azul-marinho', 'sapato-social'] },
    { ocasiao: 'Viagem', pecas: ['camiseta-azul-marinho', 'calca-alfaiataria-bege', 'tenis-nike', 'oculos-sol-quadrado-preto'] }
  ];
  var vez = 0;
  var caixa = $('dc-sorteio-pecas');

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
      var trocar = function () { img.src = F + look.pecas[n] + '.webp'; };
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

  // O início chama quando descobre que a pessoa já tem peças: os números viram a primeira tela
  window.AR_CARROSSEL_CLOSET = {
    atualizar: function () { montarBolinhas(); irPara(0, false); andar(); }
  };

  montarBolinhas();
  andar();
})();
