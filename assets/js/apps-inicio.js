/* Início dos apps: saudação e um resumo de cada app, com o que importa hoje.
   Usa o que está neste aparelho na hora e, com a conta, atualiza com o que está nela. */
(function () {
  'use strict';

  var app = window.AR_APP;
  var api = app.api;
  var criar = app.criar;
  var hoje = app.hojeISO();
  var ORDEM = ['habitos', 'ocasioes', 'alimentacao', 'guarda-roupa', 'treino'];
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

  // Hábitos de hoje: quantos já foram feitos e quantos faltam
  function resumirHabitos(estado) {
    var endereco = 'apps/habitos/';
    var habitos = estado && Array.isArray(estado.habitos) ? estado.habitos : [];
    if (!habitos.length) {
      widget('habitos', 'Hábitos', 'chama', 'Comece com um só', 'Dois minutos por dia, com lembrete no celular.', endereco);
      return;
    }
    var dia = new Date().getDay();
    var registro = (estado.registros || {})[hoje] || {};
    var deHoje = habitos.filter(function (h) { return (h.criadoEm || '') <= hoje && (h.dias || []).indexOf(dia) !== -1; });
    var feitos = deHoje.filter(function (h) { return registro[h.id] === 'feito' || registro[h.id] === 'minimo'; }).length;
    if (!deHoje.length) {
      widget('habitos', 'Hábitos', 'chama', 'Dia livre', 'Nenhum hábito marcado para hoje.', endereco);
      return;
    }
    var falta = deHoje.filter(function (h) { return registro[h.id] !== 'feito' && registro[h.id] !== 'minimo'; });
    widget('habitos', 'Hábitos', 'chama', feitos === deHoje.length ? 'Dia completo' : feitos + ' de ' + deHoje.length + ' hoje',
      falta.length ? 'Falta: ' + falta.slice(0, 3).map(function (h) { return h.nome; }).join(', ') + (falta.length > 3 ? '…' : '') : 'Cada um foi um voto para quem você quer ser.', endereco);
  }

  /* --- Início ---------------------------------------------------------------------- */

  var locais = {
    alimentacao: app.lerLocal('ar-alimentacao-v1'),
    ocasioes: app.lerLocal('ar-ocasioes-v1'),
    treino: app.lerLocal('ar-treino-v1'),
    habitos: app.lerLocal('ar-habitos-v1')
  };
  resumirHabitos(locais.habitos);
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
      api.get('api/apps.php?app=treino'),
      api.get('api/apps.php?app=habitos')
    ]).then(function (r) {
      if (r[5].ok && r[5].dados.dados) resumirHabitos(maisRecente(locais.habitos, r[5].dados.dados));
      resumirGuardaRoupa(r[0].ok ? r[0].dados : null, r[1].ok ? r[1].dados : null);
      if (r[2].ok && r[2].dados.dados) resumirAlimentacao(maisRecente(locais.alimentacao, r[2].dados.dados));
      if (r[3].ok && r[3].dados.dados) resumirOcasioes(maisRecente(locais.ocasioes, r[3].dados.dados));
      if (r[4].ok && r[4].dados.dados) resumirTreino(maisRecente(locais.treino, r[4].dados.dados));
      desenhar();
    });
  });

  /* --- Tela inicial do celular ----------------------------------------------------------------- */

  // No Android, o navegador oferece instalar e o botão abre esse pedido.
  // No iPhone não existe esse pedido: o botão mostra os passos no Safari.
  var pedidoInstalar = null;
  var secaoInstalar = document.getElementById('app-instalar');
  var modalInstalar = document.getElementById('app-instalar-modal');
  var jaNaTela = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (secaoInstalar && jaNaTela) secaoInstalar.hidden = true;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    pedidoInstalar = e;
  });
  window.addEventListener('appinstalled', function () {
    if (secaoInstalar) secaoInstalar.hidden = true;
    app.avisar('Pronto: a Rauber está na sua tela inicial.');
  });

  var COMPARTILHAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/></svg>';
  var MAIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  var CERTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>';

  function passosParaEste() {
    var ua = navigator.userAgent;
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var safari = ios && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    if (ios && !safari) {
      return { passos: [[COMPARTILHAR, 'Toque em <strong>Compartilhar</strong>, no topo ou embaixo da tela.'], [MAIS, 'Escolha <strong>Adicionar à Tela de Início</strong>.'], ['', 'Se a opção não aparecer, abra esta página no <strong>Safari</strong> e faça o mesmo.']], nota: '' };
    }
    if (ios) {
      return { passos: [[COMPARTILHAR, 'Toque em <strong>Compartilhar</strong>, na barra do Safari.'], [MAIS, 'Role a lista e toque em <strong>Adicionar à Tela de Início</strong>.'], ['', 'Confirme em <strong>Adicionar</strong>. O ícone RAUBER aparece junto dos seus aplicativos.']], nota: '' };
    }
    if (/Android/.test(ua)) {
      return { passos: [[MENU, 'Toque no menu do navegador, os três pontinhos no canto.'], [MAIS, 'Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.'], ['', 'Confirme. O ícone RAUBER aparece junto dos seus aplicativos.']], nota: '' };
    }
    return { passos: [['', 'No celular, abra <strong>andrerauber.com/apps</strong> e toque neste mesmo botão.'], [MAIS, 'No computador, procure o ícone de <strong>instalar</strong> no lado direito da barra de endereço.']], nota: 'Os apps abrem em tela cheia, como um aplicativo.' };
  }

  function mostrarPassos() {
    var guia = passosParaEste();
    var lista = document.getElementById('app-instalar-passos');
    // Textos fixos deste arquivo, sem nada digitado por alguém
    lista.innerHTML = guia.passos.map(function (p) {
      return '<li><span class="app-instalar-simbolo">' + (p[0] || CERTO) + '</span><span>' + p[1] + '</span></li>';
    }).join('');
    document.getElementById('app-instalar-nota').textContent = guia.nota;
    modalInstalar.showModal();
  }

  if (secaoInstalar) {
    document.getElementById('app-instalar-botao').addEventListener('click', function () {
      if (!pedidoInstalar) { mostrarPassos(); return; }
      pedidoInstalar.prompt();
      pedidoInstalar.userChoice.then(function (escolha) {
        if (escolha && escolha.outcome === 'accepted') secaoInstalar.hidden = true;
        pedidoInstalar = null;
      });
    });
    document.getElementById('app-instalar-fechar').addEventListener('click', function () { modalInstalar.close(); });
    modalInstalar.addEventListener('click', function (e) { if (e.target === modalInstalar) modalInstalar.close(); });
  }
})();
