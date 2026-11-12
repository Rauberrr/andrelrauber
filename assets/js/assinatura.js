/* Assinatura: mostra o plano conforme o modo escolhido no painel.
   oculta: só o gestor vê (prévia); aviso: os apps estão em teste gratuito; cobrando: é preciso assinar. */
(function () {
  'use strict';

  var app = window.AR_APP;
  var api = app.api;
  var criar = app.criar;
  function $(id) { return document.getElementById(id); }

  var MODOS = {
    oculta: 'oculta: os apps são grátis e só você vê esta página',
    aviso: 'aviso de teste: todos veem esta página e os apps continuam grátis',
    cobrando: 'cobrando: quem não assina é trazido para esta página'
  };

  function reais(centavos) {
    var inteiro = Math.floor(centavos / 100);
    return { inteiro: inteiro.toLocaleString('pt-BR'), centavos: ',' + String(centavos % 100).padStart(2, '0') };
  }

  function voltar() {
    var p = new URLSearchParams(location.search).get('voltar') || '';
    return /^apps\/[a-z-]*\/?$/.test(p) ? p : 'apps/';
  }

  function whatsapp(plano) {
    var numero = window.AR_CONFIG && window.AR_CONFIG.whatsapp;
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent('Olá! Quero assinar o ' + plano.nome + '.');
  }

  api.get('api/assinatura.php?acao=publica').then(function (r) {
    $('assin-carregando').hidden = true;
    if (!r.ok) {
      $('assin-carregando').hidden = false;
      $('assin-carregando').textContent = 'Não foi possível carregar agora. Tente de novo em instantes.';
      return;
    }
    var d = r.dados;
    var plano = d.plano;
    if (plano.modo === 'oculta' && !d.gestor) {
      $('assin-gratis').hidden = false;
      return;
    }
    if (d.gestor) {
      var previa = $('assin-previa');
      previa.textContent = '';
      previa.appendChild(criar('strong', '', 'Prévia do gestor. '));
      previa.appendChild(document.createTextNode('Modo atual: ' + MODOS[plano.modo] + '. Mude em '));
      var link = criar('a', '', 'Painel → Assinatura');
      link.href = 'painel.html#assinatura';
      previa.appendChild(link);
      previa.appendChild(document.createTextNode('.'));
      previa.hidden = false;
    }

    $('assin-pagina').hidden = false;
    var cobrando = plano.modo === 'cobrando';
    var minha = d.minha;
    $('assin-selo').textContent = cobrando ? 'Assinatura' : 'Teste gratuito';
    $('assin-texto').textContent = cobrando
      ? (minha && minha.liberado
        ? 'Sua assinatura está ativa. Obrigado por fazer parte.'
        : 'O teste gratuito terminou. Assine para continuar usando todos os apps, com tudo o que você já anotou.')
      : 'Os apps estão em teste gratuito: tudo liberado para quem tem conta. Depois do teste, eles passam a ser por assinatura mensal, por um valor simples.';
    $('assin-nome').textContent = plano.nome;
    var valor = reais(plano.precoCentavos);
    $('assin-valor').textContent = valor.inteiro;
    $('assin-centavos').textContent = valor.centavos;
    $('assin-preco-nota').textContent = cobrando ? 'Cobrança mensal. Cancele quando quiser.' : 'Valor depois do teste. Até lá, é grátis.';
    var lista = $('assin-beneficios');
    lista.textContent = '';
    plano.beneficios.forEach(function (b) {
      var li = criar('li');
      li.appendChild(app.icone('check'));
      li.appendChild(document.createTextNode(b));
      lista.appendChild(li);
    });

    var botao = $('assin-assinar');
    var nota = $('assin-acao-nota');
    if (!cobrando) {
      botao.textContent = 'Usar grátis durante o teste';
      botao.addEventListener('click', function () { location.href = voltar(); });
      nota.textContent = 'Nada é cobrado agora. Avisamos antes de a assinatura começar.';
    } else if (minha && minha.liberado) {
      botao.textContent = 'Abrir os apps';
      botao.addEventListener('click', function () { location.href = voltar(); });
      nota.textContent = minha.validaAte ? 'Assinatura válida até ' + app.dataCurta(minha.validaAte) + '.' : '';
    } else if (!d.logado) {
      botao.textContent = 'Entrar para assinar';
      botao.addEventListener('click', function () { location.href = 'entrar.html?voltar=assinatura.html'; });
      nota.textContent = 'Já tem conta? Entre para assinar. Ainda não tem? Crie a sua em menos de um minuto.';
    } else {
      botao.textContent = 'Assinar por R$ ' + valor.inteiro + valor.centavos + ' por mês';
      botao.addEventListener('click', function () {
        botao.disabled = true;
        api.post('api/assinatura.php?acao=assinar', {}).then(function (resposta) {
          botao.disabled = false;
          if (resposta.ok) { location.reload(); return; }
          if (resposta.dados && resposta.dados.whatsapp) {
            nota.textContent = '';
            nota.appendChild(document.createTextNode('O pagamento online está quase pronto. Por enquanto, '));
            var w = criar('a', '', 'fale com a gente pelo WhatsApp');
            w.href = whatsapp(plano);
            w.target = '_blank';
            w.rel = 'noopener';
            nota.appendChild(w);
            nota.appendChild(document.createTextNode(' que liberamos o seu acesso.'));
            return;
          }
          app.avisar(resposta.erro || 'Não foi possível agora. Tente de novo.');
        });
      });
    }
  });
})();
