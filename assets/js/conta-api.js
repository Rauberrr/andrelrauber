/* Conversa com o servidor e utilidades das páginas de conta */
window.AR_API = (function () {
  'use strict';

  var INDISPONIVEL = 'Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.';

  function ler(resposta) {
    return resposta.json().catch(function () { return {}; }).then(function (dados) {
      // Resposta sem JSON significa que o servidor não está disponível
      var valida = Object.prototype.hasOwnProperty.call(dados, 'ok');
      return {
        status: resposta.status,
        ok: valida && dados.ok === true,
        dados: dados,
        erro: valida ? (dados.erro || '') : INDISPONIVEL
      };
    });
  }

  function falhaDeRede() {
    return { status: 0, ok: false, dados: {}, erro: INDISPONIVEL };
  }

  // Um servidor que não responde vira erro, em vez de deixar a tela esperando para sempre
  var LIMITE_MS = 15000;
  var LIMITE_ENVIO_MS = 90000;

  function pedir(url, opcoes, limiteMs) {
    var controle = new AbortController();
    var limite = setTimeout(function () { controle.abort(); }, limiteMs || LIMITE_MS);
    opcoes.signal = controle.signal;
    opcoes.credentials = 'same-origin';
    return fetch(url, opcoes).then(ler).catch(falhaDeRede).then(function (resposta) {
      clearTimeout(limite);
      return resposta;
    });
  }

  function get(url) {
    return pedir(url, { headers: { Accept: 'application/json' } });
  }

  function post(url, corpo, opcoes) {
    return pedir(url, {
      method: 'POST',
      keepalive: Boolean(opcoes && opcoes.keepalive),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corpo || {})
    });
  }

  // Envio de arquivo: rede de celular pode demorar mais que um pedido comum
  function enviar(url, formulario) {
    return pedir(url, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formulario
    }, LIMITE_ENVIO_MS);
  }

  function mascaraTelefone(valor) {
    var d = String(valor).replace(/\D/g, '').slice(0, 11);
    if (d.length > 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length > 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    if (d.length > 2) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    return d;
  }

  function mascaraCep(valor) {
    var d = String(valor).replace(/\D/g, '').slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }

  // Só volta para páginas do próprio site, para o link não levar a outro lugar
  var DESTINOS = [
    'medidas.html', 'minha-conta.html', 'painel.html', 'guarda-roupa.html', 'alimentacao.html',
    'apps/', 'apps/guarda-roupa/', 'apps/alimentacao/', 'apps/ocasioes/', 'apps/treino/'
  ];
  function destino(padrao) {
    var pedido = new URLSearchParams(location.search).get('voltar');
    return DESTINOS.indexOf(pedido) !== -1 ? pedido : padrao;
  }

  function irParaLogin(pagina) {
    location.replace('entrar.html?voltar=' + encodeURIComponent(pagina));
  }

  return {
    get: get, post: post, enviar: enviar, mascaraTelefone: mascaraTelefone, mascaraCep: mascaraCep,
    destino: destino, irParaLogin: irParaLogin
  };
})();
