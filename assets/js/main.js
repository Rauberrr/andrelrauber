/* Comportamentos comuns a todas as páginas: cabeçalho, menu e entrada suave */
(function () {
  'use strict';

  var topo = document.querySelector('.topo');
  var botaoMenu = document.querySelector('.menu-botao');

  function aoRolar() {
    if (topo) topo.classList.toggle('rolou', window.scrollY > 40);
  }
  aoRolar();
  window.addEventListener('scroll', aoRolar, { passive: true });

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

  var elementos = document.querySelectorAll('.revelar');
  if ('IntersectionObserver' in window) {
    var observador = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (entrada) {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('visivel');
          observador.unobserve(entrada.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    elementos.forEach(function (el) { observador.observe(el); });
  } else {
    elementos.forEach(function (el) { el.classList.add('visivel'); });
  }

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
