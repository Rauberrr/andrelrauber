/* Assinatura: benefícios primeiro, o teste grátis em destaque e o valor discreto.
   Modo oculta: só o gestor vê (prévia). Aviso: os apps estão em teste. Cobrando: teste de alguns dias e depois assinatura. */
(function () {
  'use strict';

  var app = window.AR_APP;
  var api = app.api;
  var criar = app.criar;
  function $(id) { return document.getElementById(id); }

  var MODOS = {
    oculta: 'oculta: os apps são grátis e só você vê esta página',
    aviso: 'aviso de teste: todos veem esta página e os apps continuam grátis',
    cobrando: 'cobrando: depois do teste grátis, quem não assina é trazido para esta página'
  };

  function reais(c) { return 'R$ ' + (c / 100).toFixed(2).replace('.', ','); }
  function dias(n) { return n === 1 ? '1 dia' : n + ' dias'; }

  function voltar() {
    var p = new URLSearchParams(location.search).get('voltar') || '';
    return /^apps\/[a-z-]*\/?$/.test(p) ? p : 'apps/';
  }

  function whatsapp(plano) {
    var numero = window.AR_CONFIG && window.AR_CONFIG.whatsapp;
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent('Olá! Quero assinar o ' + plano.nome + '.');
  }

  // Abre a tela do Mercado Pago, onde a pessoa cadastra o cartão
  function assinar(botao, nota, plano) {
    botao.disabled = true;
    var textoAntes = botao.textContent;
    botao.textContent = 'Abrindo o Mercado Pago...';
    api.post('api/assinatura.php?acao=assinar', {}).then(function (resposta) {
      if (resposta.ok && resposta.dados.link) { location.href = resposta.dados.link; return; }
      botao.disabled = false;
      botao.textContent = textoAntes;
      if (resposta.dados && resposta.dados.whatsapp) {
        nota.textContent = 'O pagamento online ainda não está ligado. Por enquanto, ';
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
  }

  function cancelar(link, minha) {
    if (!window.confirm('Cancelar a assinatura? Você continua usando até ' + app.dataCurta(minha.validaAte) + ', e nada do que anotou se perde.')) return;
    link.disabled = true;
    api.post('api/assinatura.php?acao=cancelar', {}).then(function (r) {
      if (!r.ok) { link.disabled = false; app.avisar(r.erro || 'Não foi possível cancelar agora.'); return; }
      location.replace('assinatura.html?cancelada=1');
    });
  }

  // Na volta do Mercado Pago, o site confere a assinatura lá antes de mostrar a página
  var parametros = new URLSearchParams(location.search);
  var voltou = parametros.get('assinatura') === 'voltou';
  var conferido = voltou
    ? api.post('api/assinatura.php?acao=conferir', {}).then(function (r) { return r.ok ? r.dados.minha : null; }, function () { return null; })
    : Promise.resolve(null);

  conferido.then(function () { return api.get('api/assinatura.php?acao=publica'); }).then(function (r) {
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
    var minha = d.minha || {};
    var teste = plano.testeDias;
    var preco = reais(plano.precoCentavos);

    // Como funciona e o plano
    $('assin-passo-1').textContent = teste > 0 ? 'Use tudo grátis por ' + dias(teste) : 'Use tudo grátis durante o teste';
    $('assin-passo-2').textContent = 'Por ' + preco + ' por mês, no cartão, renovando sozinho. Menos que um café por semana.';
    $('assin-nome').textContent = plano.nome;
    $('assin-preco').textContent = preco;
    $('assin-faq-teste').textContent = teste > 0
      ? 'Você usa todos os apps por ' + dias(teste) + ', sem pagar e sem cadastrar cartão. No fim do teste, escolhe se quer assinar por ' + preco + ' por mês.'
      : 'Enquanto os apps estão em teste, quem tem conta usa tudo sem pagar. Avisamos antes de a assinatura começar.';
    var incluso = $('assin-incluso');
    incluso.textContent = '';
    plano.beneficios.forEach(function (b) {
      var li = criar('li');
      li.appendChild(app.icone('check'));
      li.appendChild(document.createTextNode(b));
      incluso.appendChild(li);
    });

    // O texto do topo e o botão, conforme a situação de quem está vendo
    var texto = $('assin-texto');
    var botao = $('assin-assinar');
    var nota = $('assin-acao-nota');
    var abrirApps = function () { location.href = voltar(); };
    if (!cobrando) {
      texto.textContent = 'Seu guarda-roupa, seu treino, sua alimentação e seus hábitos, num lugar só. Estamos em teste: experimente tudo, sem pagar nada.';
      botao.textContent = teste > 0 ? 'Começar meus ' + dias(teste) + ' grátis' : 'Usar grátis agora';
      botao.addEventListener('click', abrirApps);
      nota.textContent = 'Depois do teste, ' + preco + ' por mês. Sem cartão agora.';
    } else if (minha.assinante) {
      var mp = minha.mercadoPago;
      var cancelada = mp && mp.status !== 'authorized';
      texto.textContent = cancelada
        ? 'Sua assinatura foi cancelada. Você continua usando todos os apps até ' + app.dataCurta(minha.validaAte) + '.'
        : (voltou ? 'Pronto, assinatura confirmada! ' : '') + 'Sua assinatura está ativa. Obrigado por fazer parte.';
      botao.textContent = 'Abrir os apps';
      botao.addEventListener('click', abrirApps);
      nota.textContent = '';
      if (mp && !cancelada) {
        nota.appendChild(document.createTextNode('Renova todo mês, no cartão, pelo Mercado Pago. '));
        var sair = criar('button', 'assin-cancelar', 'Cancelar assinatura');
        sair.type = 'button';
        sair.addEventListener('click', function () { cancelar(sair, minha); });
        nota.appendChild(sair);
      } else if (cancelada) {
        var denovo = criar('button', 'assin-cancelar', 'Assinar de novo');
        denovo.type = 'button';
        denovo.addEventListener('click', function () { assinar(botao, nota, plano); });
        nota.appendChild(denovo);
      } else if (minha.validaAte) {
        nota.textContent = 'Válida até ' + app.dataCurta(minha.validaAte) + '.';
      }
    } else if (minha.jaUsava) {
      texto.textContent = 'Você já usava os apps antes da assinatura começar. Para você, tudo continua grátis. Obrigado por estar com a gente desde o início.';
      botao.textContent = 'Abrir os apps';
      botao.addEventListener('click', abrirApps);
      nota.textContent = '';
    } else if (minha.emTeste) {
      texto.textContent = 'Você está no teste grátis: ' + (minha.diasDeTeste === 1 ? 'falta 1 dia' : 'faltam ' + minha.diasDeTeste + ' dias') + '. Aproveite todos os apps.';
      botao.textContent = 'Continuar usando';
      botao.addEventListener('click', abrirApps);
      nota.textContent = 'Depois do teste, ' + preco + ' por mês. Assinando agora, a primeira cobrança só vem quando o teste acabar. ';
      var ja = criar('button', 'assin-cancelar', 'Assinar agora');
      ja.type = 'button';
      ja.addEventListener('click', function () { assinar(botao, nota, plano); });
      nota.appendChild(ja);
    } else if (!d.logado) {
      texto.textContent = 'Seu guarda-roupa, seu treino, sua alimentação e seus hábitos, num lugar só.' + (teste > 0 ? ' Comece com ' + dias(teste) + ' grátis.' : '');
      botao.textContent = teste > 0 ? 'Criar conta e começar o teste' : 'Criar minha conta';
      botao.addEventListener('click', function () { location.href = 'criar-conta.html?voltar=apps%2F'; });
      nota.textContent = 'Já tem conta? ';
      var entrar = criar('a', '', 'Entrar');
      entrar.href = 'entrar.html?voltar=assinatura.html';
      nota.appendChild(entrar);
    } else {
      texto.textContent = voltou
        ? 'Ainda não recebemos a confirmação do Mercado Pago. Se você terminou de assinar, ela chega em alguns minutos: atualize a página.'
        : (minha.testeAcabou ? 'Seu teste grátis terminou. ' : '') + 'Assine para continuar com todos os apps e tudo o que você já anotou.';
      botao.textContent = 'Assinar por ' + preco + ' por mês';
      nota.textContent = 'No cartão de crédito, renovando todo mês pelo Mercado Pago. Cancele quando quiser.';
      botao.addEventListener('click', function () { assinar(botao, nota, plano); });
    }
    if (parametros.get('cancelada') === '1') app.avisar('Assinatura cancelada. Você continua usando até o fim do mês pago.');
    app.desenharIcones();
  });
})();
