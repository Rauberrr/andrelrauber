/* Início dos apps: saudação e um resumo de cada app, com o que importa hoje.
   Usa o que está neste aparelho na hora e, com a conta, atualiza com o que está nela. */
(function () {
  'use strict';

  var app = window.AR_APP;
  var api = app.api;
  var criar = app.criar;
  var hoje = app.hojeISO();
  var ORDEM = ['ocasioes', 'alimentacao', 'guarda-roupa', 'treino'];
  var widgets = {};

  function $(id) { return document.getElementById(id); }

  $('inicio-data').textContent = app.dataLonga(hoje);

  function widget(id, rotulo, nomeIcone, valor, detalhe, endereco) {
    var a = criar('a', 'app-widget app-widget-' + id);
    a.href = endereco;
    var cab = criar('p', 'app-widget-rotulo');
    cab.appendChild(app.icone(nomeIcone));
    cab.appendChild(document.createTextNode(rotulo));
    a.appendChild(cab);
    a.appendChild(criar('p', 'app-widget-valor', valor));
    if (detalhe) a.appendChild(criar('p', 'app-widget-detalhe', detalhe));
    widgets[id] = a;
  }

  function desenhar() {
    var caixa = $('inicio-widgets');
    caixa.textContent = '';
    ORDEM.forEach(function (id) { if (widgets[id]) caixa.appendChild(widgets[id]); });
  }

  function maisRecente(local, daConta) {
    if (!daConta) return local;
    if (!local) return daConta;
    return (daConta.alteradoEm || 0) >= (local.alteradoEm || 0) ? daConta : local;
  }

  /* --- Cada app ----------------------------------------------------------------- */

  function resumirAlimentacao(estado) {
    var endereco = 'apps/alimentacao/';
    if (!estado || !estado.concluido) {
      widget('alimentacao', 'Alimentação', 'folha', 'Seu plano em 3 minutos', 'Descubra seu gasto de energia e quanto custa comer melhor na sua região.', endereco);
      return;
    }
    var itens = estado.resumoLista && Array.isArray(estado.resumoLista.itens) ? estado.resumoLista.itens : [];
    var comprar = itens.filter(function (i) { return !i.acabaEm || app.diasAte(i.acabaEm) <= 0; });
    var breve = itens.filter(function (i) { return i.acabaEm && app.diasAte(i.acabaEm) > 0; })
      .sort(function (a, b) { return a.acabaEm < b.acabaEm ? -1 : 1; });
    var valor = comprar.length
      ? comprar.length + (comprar.length === 1 ? ' item para comprar' : ' itens para comprar')
      : (itens.length ? 'Despensa em dia' : 'Plano pronto');
    var detalhe = breve.length
      ? breve[0].nome + ' acaba ' + app.textoDias(app.diasAte(breve[0].acabaEm)) + '.'
      : 'Abra a lista de compras e marque o que já tem em casa.';
    widget('alimentacao', 'Lista de compras', 'carrinho', valor, detalhe, endereco);
  }

  function resumirOcasioes(estado) {
    var endereco = 'apps/ocasioes/';
    var eventos = estado && Array.isArray(estado.eventos) ? estado.eventos : [];
    var proximos = eventos.filter(function (e) { return e.data && app.diasAte(e.data) >= 0; })
      .sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (!proximos.length) {
      widget('ocasioes', 'Ocasiões', 'calendario', 'Tem um evento chegando?', 'Casamento, formatura, entrevista ou viagem: veja o traje e monte o look com o que você tem.', endereco);
      return;
    }
    var e = proximos[0];
    var detalhe = app.textoDias(app.diasAte(e.data)).replace(/^./, function (l) { return l.toUpperCase(); });
    if (e.encomendarAte && !e.encomendado) {
      var faltam = app.diasAte(e.encomendarAte);
      detalhe += faltam >= 0 ? '. Encomende até ' + app.dataCurta(e.encomendarAte) + '.' : '. O prazo para encomendar está apertado.';
    } else if (e.situacao === 'pronto') {
      detalhe += '. Look pronto.';
    } else {
      detalhe += '.';
    }
    widget('ocasioes', 'Próxima ocasião', 'calendario', e.nome || 'Evento', detalhe, endereco);
  }

  function inicioDaSemana() {
    var d = app.paraData(hoje);
    var dia = (d.getDay() + 6) % 7;
    return app.somarDias(hoje, -dia);
  }

  function resumirTreino(estado) {
    var endereco = 'apps/treino/';
    if (!estado || !estado.perfil || !estado.perfil.dias) {
      widget('treino', 'Treino', 'haltere', 'Monte seu treino', 'Em casa ou na academia, no tempo que você tem.', endereco);
      return;
    }
    var desde = inicioDaSemana();
    var semana = (estado.sessoes || []).filter(function (s) { return s.data >= desde && s.data <= hoje; }).length;
    var feitoHoje = (estado.sessoes || []).some(function (s) { return s.data === hoje; });
    var proximo = estado.resumo && estado.resumo.proximo ? estado.resumo.proximo : 'Treino A';
    widget('treino', feitoHoje ? 'Treino de hoje feito' : 'Treino de hoje', 'haltere',
      feitoHoje ? 'Bom trabalho' : proximo,
      semana + ' de ' + estado.perfil.dias + ' treinos nesta semana.', endereco);
  }

  function resumirGuardaRoupa(dados, clima) {
    var endereco = 'apps/guarda-roupa/';
    if (!dados) {
      widget('guarda-roupa', 'Guarda-roupa', 'cabide', 'Looks com o que você tem', 'Fotografe suas peças e receba sugestões de combinações.', endereco);
      return;
    }
    var salvos = dados.looks.filter(function (l) { return l.situacao === 'salvo'; }).length;
    var contagem = dados.pecas.length + (dados.pecas.length === 1 ? ' peça' : ' peças') + ', ' + salvos + (salvos === 1 ? ' look salvo' : ' looks salvos') + '.';
    if (clima) {
      var palavra = { calor: 'Dia quente', frio: 'Dia frio', meia_estacao: 'Meia-estação' }[clima.categoria];
      var amanha = clima.quando === 'amanhã';
      widget('guarda-roupa', amanha ? 'O que vestir amanhã' : 'O que vestir hoje', clima.categoria === 'calor' ? 'sol' : (clima.categoria === 'frio' ? 'floco' : 'nuvem'),
        Math.round(clima.minima) + '° a ' + Math.round(clima.maxima) + '° em ' + clima.cidade, palavra + ': veja os looks para ' + (amanha ? 'amanhã' : 'hoje') + '. ' + contagem, endereco + '#looks');
      return;
    }
    widget('guarda-roupa', 'Guarda-roupa', 'cabide', dados.pecas.length ? 'Escolha o look de hoje' : 'Comece pelas suas peças', contagem, endereco + '#looks');
  }

  /* --- Início ---------------------------------------------------------------------- */

  var locais = {
    alimentacao: app.lerLocal('ar-alimentacao-v1'),
    ocasioes: app.lerLocal('ar-ocasioes-v1'),
    treino: app.lerLocal('ar-treino-v1')
  };
  resumirAlimentacao(locais.alimentacao);
  resumirOcasioes(locais.ocasioes);
  resumirTreino(locais.treino);
  resumirGuardaRoupa(null, null);
  desenhar();

  function saudacao() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Bom dia';
    if (h >= 12 && h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  app.sessao.then(function (usuario) {
    $('inicio-convite').hidden = Boolean(usuario);
    if (!usuario) return;
    var nome = String(usuario.nome || '').trim().split(/\s+/)[0];
    $('inicio-ola').textContent = saudacao() + (nome ? ', ' + nome : '');

    var cidade = app.lerLocal('ar-clima-cidade');
    var enderecoClima = 'api/clima.php' + (cidade && cidade.cidade ? '?cidade=' + encodeURIComponent(cidade.cidade) + '&uf=' + encodeURIComponent(cidade.uf || '') : '');
    Promise.all([
      api.get('api/guarda-roupa.php'),
      api.get(enderecoClima),
      api.get('api/alimentacao.php'),
      api.get('api/apps.php?app=ocasioes'),
      api.get('api/apps.php?app=treino')
    ]).then(function (r) {
      resumirGuardaRoupa(r[0].ok ? r[0].dados : null, r[1].ok ? r[1].dados : null);
      if (r[2].ok && r[2].dados.dados) resumirAlimentacao(maisRecente(locais.alimentacao, r[2].dados.dados));
      if (r[3].ok && r[3].dados.dados) resumirOcasioes(maisRecente(locais.ocasioes, r[3].dados.dados));
      if (r[4].ok && r[4].dados.dados) resumirTreino(maisRecente(locais.treino, r[4].dados.dados));
      desenhar();
    });
  });
})();
