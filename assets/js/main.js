/* Comportamentos comuns a todas as páginas: cabeçalho, menu e movimento */
(function () {
  'use strict';

  var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Cabeçalho e menu ------------------------------------------------------ */

  var topo = document.querySelector('.topo');
  var botaoMenu = document.querySelector('.menu-botao');

  function definirMenu(aberto) {
    document.body.classList.toggle('menu-aberto', aberto);
    botaoMenu.setAttribute('aria-expanded', String(aberto));
    botaoMenu.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
  }

  if (botaoMenu) {
    botaoMenu.addEventListener('click', function () {
      definirMenu(!document.body.classList.contains('menu-aberto'));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('menu-aberto')) {
        definirMenu(false);
        botaoMenu.focus();
      }
    });
    document.querySelectorAll('.nav a').forEach(function (link) {
      link.addEventListener('click', function () { definirMenu(false); });
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', function (e) {
      if (e.matches) definirMenu(false);
    });
  }

  // Grupo "Apps": abre ao clicar e fecha ao clicar fora, sair com o Tab ou apertar Esc
  document.querySelectorAll('.nav-grupo').forEach(function (grupo) {
    var botao = grupo.querySelector('.nav-grupo-botao');
    if (!botao) return;
    function definir(aberto) {
      grupo.classList.toggle('aberto', aberto);
      botao.setAttribute('aria-expanded', String(aberto));
    }
    botao.addEventListener('click', function () { definir(!grupo.classList.contains('aberto')); });
    document.addEventListener('click', function (e) { if (!grupo.contains(e.target)) definir(false); });
    grupo.addEventListener('focusout', function (e) { if (!grupo.contains(e.relatedTarget)) definir(false); });
    grupo.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && grupo.classList.contains('aberto')) {
        e.stopPropagation();
        definir(false);
        botao.focus();
      }
    });
  });

  /* --- Abertura da home: o nome entra em câmera lenta --------------------------- */

  var hero = document.querySelector('.hero');

  // A logo é uma imagem: cada letra vira uma camada recortada dela.
  // data-letras guarda onde cada letra começa e termina, em % da largura da logo.
  function montarLogo() {
    var nome = document.querySelector('[data-letras]');
    if (!nome) return;
    var cortes = nome.getAttribute('data-letras').split(',').map(Number);
    var base = nome.querySelector('img');
    var total = cortes.length - 1;
    var meio = (total - 1) / 2;

    for (var i = 0; i < total; i++) {
      var camada = document.createElement('span');
      camada.className = 'nome-letra';
      camada.setAttribute('aria-hidden', 'true');
      // As letras nascem afastadas do centro e se aproximam devagar
      camada.style.setProperty('--dx', (semMovimento ? 0 : (i - meio) * .9).toFixed(2) + '%');
      camada.style.setProperty('--atraso', (.5 + Math.abs(i - meio) * .1).toFixed(2) + 's');
      var recorte = base.cloneNode();
      recorte.alt = '';
      recorte.style.clipPath = 'inset(0 ' + (100 - cortes[i + 1]) + '% 0 ' + cortes[i] + '%)';
      camada.appendChild(recorte);
      nome.appendChild(camada);
    }
    base.classList.add('nome-base');
  }

  function iniciarHero() {
    if (!hero) return;
    montarLogo();
    var imagens = [hero.querySelector('.hero-foto'), hero.querySelector('.nome-base')].filter(Boolean);
    var iniciado = false;
    function comecar() {
      if (iniciado) return;
      iniciado = true;
      hero.classList.add('hero-pronto');
    }
    if (window.Promise && imagens.length && imagens[0].decode) {
      Promise.all(imagens.map(function (img) { return img.decode(); })).then(comecar, comecar);
    } else {
      comecar();
    }
    // Conexão lenta não segura o texto: depois de 1,8s a abertura começa de todo modo
    setTimeout(comecar, 1800);
  }
  iniciarHero();

  /* --- Títulos: palavras saem de trás de uma máscara ----------------------------- */

  function separarPalavras(el, classeCaixa, classeInterna) {
    var contador = 0;
    Array.prototype.slice.call(el.childNodes).forEach(function trocar(no) {
      if (no.nodeType === 3) {
        var frag = document.createDocumentFragment();
        no.textContent.split(/(\s+)/).forEach(function (pedaco) {
          if (!pedaco) return;
          if (/^\s+$/.test(pedaco)) { frag.appendChild(document.createTextNode(' ')); return; }
          var caixa = document.createElement('span');
          caixa.className = classeCaixa;
          caixa.style.setProperty('--p', contador);
          contador += 1;
          if (classeInterna) {
            var dentro = document.createElement('span');
            dentro.className = classeInterna;
            dentro.textContent = pedaco;
            caixa.appendChild(dentro);
          } else {
            caixa.textContent = pedaco;
          }
          frag.appendChild(caixa);
        });
        no.parentNode.replaceChild(frag, no);
      } else if (no.nodeType === 1) {
        Array.prototype.slice.call(no.childNodes).forEach(trocar);
      }
    });
  }

  document.querySelectorAll('.titulo-l:not([data-rolagem]):not(.etapa-titulo), .titulo-xl').forEach(function (titulo) {
    separarPalavras(titulo, 'pal', 'pal-in');
    titulo.classList.add('com-palavras');
  });

  /* --- Entrada dos elementos ao rolar: quem chega junto entra em fila ------------- */

  var alvos = document.querySelectorAll('.revelar, .com-palavras, .fio, .peca');
  if ('IntersectionObserver' in window) {
    var observador = new IntersectionObserver(function (entradas) {
      var fila = 0;
      entradas.forEach(function (entrada) {
        if (!entrada.isIntersecting) return;
        var el = entrada.target;
        el.style.setProperty('--fila', (fila * .12).toFixed(2) + 's');
        fila += 1;
        el.classList.add('visivel');
        observador.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    alvos.forEach(function (el) { observador.observe(el); });
  } else {
    alvos.forEach(function (el) { el.classList.add('visivel'); });
  }

  /* --- Texto que acende e foto que desliza conforme a rolagem ---------------------- */

  var textosRolagem = [];
  document.querySelectorAll('[data-rolagem]').forEach(function (el) {
    separarPalavras(el, 'rolagem-pal');
    textosRolagem.push({ el: el, palavras: el.querySelectorAll('.rolagem-pal') });
  });

  var midia = hero ? hero.querySelector('.hero-midia') : null;
  var conteudoHero = hero ? hero.querySelector('.hero-conteudo') : null;
  var rolagemSuave = window.scrollY;
  var quadro = null;

  function atualizarTextos() {
    var alturaTela = window.innerHeight;
    textosRolagem.forEach(function (item) {
      var caixa = item.el.getBoundingClientRect();
      var inicio = alturaTela * .88;
      var fim = alturaTela * .42;
      var avanco = (inicio - caixa.top) / (inicio - fim + caixa.height);
      avanco = Math.max(0, Math.min(1, avanco));
      var n = item.palavras.length;
      item.palavras.forEach(function (palavra, i) {
        var local = (avanco * (n + 4) - i) / 4;
        palavra.style.setProperty('--acesa', (.16 + .84 * Math.max(0, Math.min(1, local))).toFixed(3));
      });
    });
  }

  function animar() {
    quadro = null;
    var y = window.scrollY;
    rolagemSuave += (y - rolagemSuave) * .12;
    if (Math.abs(y - rolagemSuave) < .2) rolagemSuave = y;

    if (midia && !semMovimento) {
      var altura = hero.offsetHeight;
      if (rolagemSuave < altura * 1.1) {
        midia.style.setProperty('--paralaxe', (rolagemSuave * .24).toFixed(1) + 'px');
        conteudoHero.style.setProperty('--hero-sobe', (rolagemSuave * -.08).toFixed(1) + 'px');
        conteudoHero.style.setProperty('--hero-opacidade', Math.max(0, 1 - rolagemSuave / (altura * .75)).toFixed(3));
      }
    }
    atualizarTextos();
    if (rolagemSuave !== y) quadro = requestAnimationFrame(animar);
  }

  function aoRolar() {
    if (topo) topo.classList.toggle('rolou', window.scrollY > 40);
    if (!quadro) quadro = requestAnimationFrame(animar);
  }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', aoRolar, { passive: true });

  /* --- Pequenos ajustes ------------------------------------------------------------ */

  // Links de WhatsApp sempre usam o número definido em config.js
  if (window.AR_CONFIG) {
    document.querySelectorAll('[data-whatsapp]').forEach(function (link) {
      var texto = link.getAttribute('data-whatsapp');
      link.href = 'https://wa.me/' + window.AR_CONFIG.whatsapp + (texto ? '?text=' + encodeURIComponent(texto) : '');
    });
  }

  document.querySelectorAll('[data-ano]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
