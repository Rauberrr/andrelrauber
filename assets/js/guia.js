/* Guia de medidas: gera os cartões a partir de medidas-dados.js */
(function () {
  'use strict';

  var dados = window.AR_MEDIDAS;
  var figura = window.AR_FIGURA;

  function cartao(m) {
    return '<article class="guia-item revelar">' +
      '<div class="guia-figura">' + figura.desenhar(m, m.recorte) + '</div>' +
      '<div>' +
        '<h3 class="titulo-s">' + m.rotulo + '</h3>' +
        '<p>' + m.como + '</p>' +
        '<p class="guia-erro"><strong>Erro comum:</strong> ' + m.erro + '</p>' +
      '</div>' +
    '</article>';
  }

  function preencher(id, lista) {
    document.getElementById(id).innerHTML = lista.map(cartao).join('');
  }

  preencher('guia-cima', dados.cima);
  preencher('guia-baixo', dados.baixo);
  preencher('guia-geral', dados.geral);
})();
