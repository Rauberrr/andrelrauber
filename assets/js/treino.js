/* Treino (beta): monta um plano simples a partir do objetivo, do local e do tempo,
   guia o treino do dia com séries e descanso e guarda as cargas e a semana.
   Sem autorização, fica neste aparelho. Com autorização, também na conta. */
(function () {
  'use strict';

  var app = window.AR_APP;
  var api = app.api;
  var T = window.AR_TREINO_DADOS;
  var criar = app.criar;
  var CHAVE = 'ar-treino-v1';
  var ENDERECO = 'api/apps.php?app=treino';

  var estado = completar(app.lerLocal(CHAVE));
  var conta = { logado: false, temNaConta: false };
  var sessao = null;
  var cronometro = null;

  function $(id) { return document.getElementById(id); }

  function completar(e) {
    if (!e || typeof e !== 'object') e = {};
    if (!e.perfil || typeof e.perfil !== 'object' || !e.perfil.dias) e.perfil = null;
    if (!Array.isArray(e.sessoes)) e.sessoes = [];
    if (!e.trocas || typeof e.trocas !== 'object' || Array.isArray(e.trocas)) e.trocas = {};
    if (!e.resumo || typeof e.resumo !== 'object') e.resumo = { proximo: '' };
    if (typeof e.guardarNaConta !== 'boolean') e.guardarNaConta = false;
    return e;
  }

  function botao(texto, classe, aoClicar, icone) {
    var b = criar('button', classe);
    b.type = 'button';
    if (icone) b.appendChild(app.icone(icone));
    b.appendChild(document.createTextNode(texto));
    if (aoClicar) b.addEventListener('click', aoClicar);
    return b;
  }

  /* --- Guardar ------------------------------------------------------------------- */

  var agendado = null;

  function salvar() {
    var proximo = proximoTreino();
    estado.resumo = { proximo: proximo ? 'Treino ' + proximo.letra + ' · ' + proximo.nome : '' };
    estado.alteradoEm = Date.now();
    app.gravarLocal(CHAVE, estado);
    if (!conta.logado || !estado.guardarNaConta) return;
    window.clearTimeout(agendado);
    agendado = window.setTimeout(function () {
      api.post(ENDERECO + '&acao=salvar', { dados: estado, consentimento: true }).then(function (r) {
        if (r.ok) { conta.temNaConta = true; mostrarGuardar(); }
        else if (r.status !== 401) app.avisar(r.erro || 'Não foi possível salvar na conta agora. Fica neste aparelho.');
      });
    }, 900);
  }

  /* --- O plano ---------------------------------------------------------------------- */

  function divisao(perfil) {
    if (perfil.dias <= 3) return T.DIVISOES.corpo_inteiro;
    if (perfil.dias === 4) return T.DIVISOES.superior_inferior;
    return T.DIVISOES.empurrar_puxar_pernas;
  }

  function opcoesDo(movimento, perfil) {
    return T.MOVIMENTOS[movimento].filter(function (id) {
      var ex = T.porExercicio[id];
      return ex.locais.indexOf(perfil.local) !== -1 && !ex.evitar.some(function (c) { return perfil.cuidados.indexOf(c) !== -1; });
    });
  }

  function montarTreino(modelo, perfil) {
    var usados = [];
    var lista = [];
    var maximo = T.porTempo[perfil.tempo].exercicios;
    modelo.movimentos.forEach(function (mov) {
      if (lista.length >= maximo) return;
      var opcoes = opcoesDo(mov, perfil).filter(function (id) { return usados.indexOf(id) === -1; });
      if (!opcoes.length) return;
      var escolhido = estado.trocas[mov] && opcoes.indexOf(estado.trocas[mov]) !== -1 ? estado.trocas[mov] : opcoes[0];
      usados.push(escolhido);
      lista.push({ movimento: mov, exercicio: T.porExercicio[escolhido], opcoes: opcoes });
    });
    return { letra: modelo.letra, nome: modelo.nome, exercicios: lista };
  }

  function plano() {
    if (!estado.perfil) return [];
    return divisao(estado.perfil).map(function (m) { return montarTreino(m, estado.perfil); });
  }

  function series(perfil) {
    return T.porNivel[perfil.nivel].series + (perfil.nivel === 'intermediario' && perfil.tempo === 60 ? 1 : 0);
  }

  function repeticoes(ex, perfil) {
    if (ex.tempo) return perfil.nivel === 'iniciante' ? '20 a 30 s' : '30 a 45 s';
    if (!ex.carga && perfil.objetivo === 'massa') return '10 a 15';
    return T.porObjetivo[perfil.objetivo].reps;
  }

  function proximoTreino() {
    var p = plano();
    if (!p.length) return null;
    var ultima = estado.sessoes[estado.sessoes.length - 1];
    if (!ultima) return p[0];
    var i = p.map(function (t) { return t.letra; }).indexOf(ultima.treino);
    return p[(i + 1) % p.length];
  }

  function ultimaCarga(exId) {
    for (var i = estado.sessoes.length - 1; i >= 0; i -= 1) {
      var c = estado.sessoes[i].cargas;
      if (c && c[exId] !== undefined) return { kg: c[exId], data: estado.sessoes[i].data };
    }
    return null;
  }

  // Duas vezes seguidas leve: hora de subir. Pesado: segurar a carga.
  function conselho(letra) {
    var desse = estado.sessoes.filter(function (s) { return s.treino === letra; }).slice(-2);
    if (desse.length === 2 && desse.every(function (s) { return s.esforco === 'leve'; })) {
      return 'Nas duas últimas vezes ficou leve: suba 1 a 2 kg ou faça 2 repetições a mais.';
    }
    if (desse.length && desse[desse.length - 1].esforco === 'pesado') {
      return 'Da última vez ficou pesado: mantenha a carga ou tire um pouco, e capriche no movimento.';
    }
    return '';
  }

  /* --- Configuração ----------------------------------------------------------------------- */

  function escolhas(caixaId, nome, itens, multiplo) {
    var caixa = $(caixaId);
    caixa.textContent = '';
    itens.forEach(function (i) {
      var rotulo = criar('label');
      var entrada = document.createElement('input');
      entrada.type = multiplo ? 'checkbox' : 'radio';
      entrada.name = nome;
      entrada.value = String(i.id);
      rotulo.appendChild(entrada);
      rotulo.appendChild(criar('span', '', i.rotulo));
      caixa.appendChild(rotulo);
    });
  }

  escolhas('tr-objetivo', 'objetivo', T.OBJETIVOS);
  escolhas('tr-nivel', 'nivel', T.NIVEIS);
  escolhas('tr-local', 'local', T.LOCAIS);
  escolhas('tr-dias', 'dias', [2, 3, 4, 5, 6].map(function (n) { return { id: n, rotulo: n + ' dias' }; }));
  escolhas('tr-tempo', 'tempo', T.TEMPOS);
  escolhas('tr-cuidados', 'cuidados', T.CUIDADOS, true);

  function marcar(nome, valor) {
    var c = document.querySelector('input[name="' + nome + '"][value="' + valor + '"]');
    if (c) c.checked = true;
  }

  function valor(nome) {
    var c = document.querySelector('input[name="' + nome + '"]:checked');
    return c ? c.value : '';
  }

  // O objetivo da Alimentação serve de ponto de partida
  function objetivoDaAlimentacao() {
    var a = app.lerLocal('ar-alimentacao-v1');
    var o = a && a.perfil && a.perfil.objetivo;
    return { perder: 'emagrecer', ganhar: 'massa', manter: 'saude' }[o] || '';
  }

  function abrirConfiguracao() {
    var p = estado.perfil || { objetivo: objetivoDaAlimentacao() || 'saude', nivel: 'iniciante', local: 'academia', dias: 3, tempo: 45, cuidados: [] };
    marcar('objetivo', p.objetivo);
    marcar('nivel', p.nivel);
    marcar('local', p.local);
    marcar('dias', p.dias);
    marcar('tempo', p.tempo);
    document.querySelectorAll('input[name="cuidados"]').forEach(function (c) { c.checked = p.cuidados.indexOf(c.value) !== -1; });
    var daAlimentacao = !estado.perfil && objetivoDaAlimentacao();
    $('tr-da-alimentacao').hidden = !daAlimentacao;
    if (daAlimentacao) $('tr-da-alimentacao').textContent = 'Já marcamos o objetivo do seu plano na Alimentação. Pode trocar se quiser.';
    $('tr-config-titulo').textContent = estado.perfil ? 'Ajustar o treino' : 'Monte seu treino';
    $('tr-config-salvar').textContent = estado.perfil ? 'Salvar' : 'Montar meu treino';
    $('tr-config-cancelar').hidden = !estado.perfil;
    $('tr-config-erro').textContent = '';
    mostrar('config');
  }

  $('tr-config').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = {
      objetivo: valor('objetivo'), nivel: valor('nivel'), local: valor('local'),
      dias: Number(valor('dias')), tempo: Number(valor('tempo')),
      cuidados: Array.prototype.slice.call(document.querySelectorAll('input[name="cuidados"]:checked')).map(function (c) { return c.value; })
    };
    if (!p.objetivo || !p.nivel || !p.local || !p.dias || !p.tempo) {
      $('tr-config-erro').textContent = 'Escolha uma opção em cada pergunta.';
      return;
    }
    var mudouLocal = estado.perfil && (estado.perfil.local !== p.local || estado.perfil.dias !== p.dias);
    if (mudouLocal) estado.trocas = {};
    var era = Boolean(estado.perfil);
    estado.perfil = p;
    salvar();
    desenharPainel();
    mostrar('painel');
    app.avisar(era ? 'Treino ajustado.' : 'Pronto: seu treino está montado.');
  });
  $('tr-config-cancelar').addEventListener('click', function () { mostrar('painel'); });
  $('tr-editar').addEventListener('click', abrirConfiguracao);

  /* --- Painel ----------------------------------------------------------------------------------- */

  function inicioDaSemana(iso) {
    var d = app.paraData(iso);
    return app.somarDias(iso, -((d.getDay() + 6) % 7));
  }

  function desenharSemana() {
    var hoje = app.hojeISO();
    var inicio = inicioDaSemana(hoje);
    var caixa = $('tr-semana');
    caixa.textContent = '';
    ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].forEach(function (letra, i) {
      var dia = app.somarDias(inicio, i);
      var feito = estado.sessoes.some(function (s) { return s.data === dia; });
      var item = criar('span', 'tr-dia' + (feito ? ' feito' : '') + (dia === hoje ? ' hoje' : ''));
      item.appendChild(criar('i'));
      item.appendChild(document.createTextNode(letra));
      item.setAttribute('aria-label', app.dataLonga(dia) + (feito ? ': treinou' : ''));
      caixa.appendChild(item);
    });
    var feitos = estado.sessoes.filter(function (s) { return s.data >= inicio && s.data <= hoje; }).length;
    return feitos;
  }

  function desenharPainel() {
    var p = estado.perfil;
    var treinos = plano();
    var proximo = proximoTreino();
    var hoje = app.hojeISO();
    var feitoHoje = estado.sessoes.filter(function (s) { return s.data === hoje; })[0];
    var naSemana = desenharSemana();
    $('tr-hoje-rotulo').textContent = feitoHoje ? 'Treino de hoje feito' : 'Treino de hoje';
    $('tr-hoje-titulo').textContent = feitoHoje ? 'Bom trabalho' : 'Treino ' + proximo.letra + ': ' + proximo.nome;
    $('tr-hoje-detalhe').textContent = (feitoHoje ? 'O próximo é o treino ' + proximo.letra + '. ' : proximo.exercicios.length + ' exercícios, cerca de ' + p.tempo + ' minutos. ') +
      naSemana + ' de ' + p.dias + ' treinos nesta semana.';
    $('tr-comecar').textContent = feitoHoje ? 'Treinar de novo' : 'Começar treino';

    var obj = T.porObjetivo[p.objetivo];
    $('tr-plano-texto').textContent = [
      T.LOCAIS.filter(function (l) { return l.id === p.local; })[0].rotulo + ', ' + p.dias + ' dias por semana, ' +
        series(p) + ' séries de ' + obj.reps + ' repetições, com ' + obj.descanso + ' segundos de descanso.',
      obj.cardio,
      p.cuidados.length ? 'Sem exercícios que forçam: ' + p.cuidados.join(', ') + '.' : ''
    ].filter(Boolean).join(' ');

    var caixa = $('tr-treinos');
    caixa.textContent = '';
    treinos.forEach(function (t) {
      var c = criar('article', 'app-cartao');
      var cab = criar('div', 'tr-treino-cab');
      var titulo = criar('h3', 'app-cartao-titulo');
      titulo.appendChild(criar('span', 'tr-letra', t.letra));
      titulo.appendChild(document.createTextNode(t.nome));
      cab.appendChild(titulo);
      cab.appendChild(botao('Fazer', 'texto-botao', function () { comecar(t.letra); }));
      c.appendChild(cab);
      var ul = criar('ul', 'tr-exercicios');
      t.exercicios.forEach(function (x) {
        var li = criar('li');
        li.appendChild(criar('span', '', x.exercicio.nome));
        li.appendChild(criar('span', 'tr-series', series(p) + ' × ' + repeticoes(x.exercicio, p)));
        var carga = ultimaCarga(x.exercicio.id);
        if (carga) li.appendChild(criar('small', '', 'Última carga: ' + String(carga.kg).replace('.', ',') + ' kg'));
        ul.appendChild(li);
      });
      c.appendChild(ul);
      caixa.appendChild(c);
    });
    desenharHistorico();
    mostrarGuardar();
  }

  function desenharHistorico() {
    var hoje = app.hojeISO();
    var inicio = inicioDaSemana(hoje);
    var barras = $('tr-barras');
    barras.textContent = '';
    var contagens = [];
    for (var s = 7; s >= 0; s -= 1) {
      var de = app.somarDias(inicio, -7 * s);
      var ate = app.somarDias(de, 6);
      var n = estado.sessoes.filter(function (x) { return x.data >= de && x.data <= ate; }).length;
      contagens.push({ de: de, n: n });
    }
    var maior = Math.max(estado.perfil ? estado.perfil.dias : 3, Math.max.apply(null, contagens.map(function (c) { return c.n; })));
    contagens.forEach(function (c) {
      var b = criar('span', 'tr-barra');
      var i = criar('i');
      i.style.height = Math.max(3, Math.round(c.n / maior * 70)) + 'px';
      b.appendChild(i);
      b.appendChild(document.createTextNode(app.dataCurta(c.de)));
      barras.appendChild(b);
    });
    var total = estado.sessoes.length;
    $('tr-historico-resumo').textContent = total
      ? total + (total === 1 ? ' treino registrado.' : ' treinos registrados.') + ' Cada barra é uma semana, a partir da segunda-feira.'
      : 'Seus treinos aparecem aqui assim que você concluir o primeiro.';
    var lista = $('tr-historico');
    lista.textContent = '';
    estado.sessoes.slice(-10).reverse().forEach(function (s) {
      var li = criar('li');
      var texto = criar('span', 'app-lista-texto', app.dataCurta(s.data) + ' · Treino ' + s.treino);
      var esforco = T.ESFORCOS.filter(function (e) { return e.id === s.esforco; })[0];
      texto.appendChild(criar('small', '', (esforco ? esforco.rotulo : '') + (s.feitos ? ', ' + s.feitos + (s.feitos === 1 ? ' exercício completo' : ' exercícios completos') : '')));
      li.appendChild(texto);
      var indice = estado.sessoes.indexOf(s);
      var apagar = criar('button', 'app-icone-botao plano perigo');
      apagar.type = 'button';
      apagar.setAttribute('aria-label', 'Apagar o treino de ' + app.dataCurta(s.data));
      apagar.appendChild(app.icone('lixeira'));
      apagar.addEventListener('click', function () {
        estado.sessoes.splice(indice, 1);
        salvar();
        desenharPainel();
        app.avisar('Treino apagado.', function () { estado.sessoes.splice(indice, 0, s); salvar(); desenharPainel(); });
      });
      li.appendChild(apagar);
      lista.appendChild(li);
    });
    lista.hidden = !estado.sessoes.length;
  }

  /* --- Treino do dia ---------------------------------------------------------------------------- */

  function comecar(letra) {
    var t = plano().filter(function (x) { return x.letra === letra; })[0] || proximoTreino();
    sessao = { letra: t.letra, marcas: {}, cargas: {}, esforco: 'ok' };
    desenharSessao();
    mostrar('sessao');
    $('tr-sessao-titulo').focus();
  }

  function desenharSessao() {
    var p = estado.perfil;
    var t = plano().filter(function (x) { return x.letra === sessao.letra; })[0];
    var n = series(p);
    $('tr-sessao-rotulo').textContent = 'Treino ' + t.letra;
    $('tr-sessao-titulo').textContent = t.nome;
    var dica = conselho(t.letra);
    $('tr-sessao-texto').textContent = 'Comece com 5 minutos de aquecimento leve. Marque cada série ao terminar: o descanso começa sozinho.' + (dica ? ' ' + dica : '');
    var caixa = $('tr-sessao-exercicios');
    caixa.textContent = '';
    t.exercicios.forEach(function (x) {
      var ex = x.exercicio;
      var c = criar('article', 'app-cartao tr-sessao-ex');
      var cab = criar('div', 'tr-treino-cab');
      cab.appendChild(criar('h3', 'app-cartao-titulo', ex.nome));
      cab.appendChild(criar('span', 'tr-series', n + ' × ' + repeticoes(ex, p)));
      c.appendChild(cab);
      c.appendChild(criar('p', 'app-suave', ex.dica));
      var marcas = sessao.marcas[ex.id] || (sessao.marcas[ex.id] = []);
      var linha = criar('div', 'tr-marcas');
      for (var i = 0; i < n; i += 1) {
        (function (i) {
          var rotulo = criar('label', 'tr-marca');
          var caixaMarca = document.createElement('input');
          caixaMarca.type = 'checkbox';
          caixaMarca.checked = Boolean(marcas[i]);
          caixaMarca.setAttribute('aria-label', ex.nome + ', série ' + (i + 1));
          caixaMarca.addEventListener('change', function () {
            marcas[i] = caixaMarca.checked;
            if (caixaMarca.checked && i < n - 1) iniciarDescanso(T.porObjetivo[p.objetivo].descanso);
          });
          rotulo.appendChild(caixaMarca);
          rotulo.appendChild(criar('span', '', (i + 1) + 'ª'));
          linha.appendChild(rotulo);
        })(i);
      }
      c.appendChild(linha);
      if (ex.carga) {
        var campo = criar('label', 'tr-carga');
        campo.appendChild(document.createTextNode('Carga'));
        var entrada = document.createElement('input');
        entrada.type = 'text';
        entrada.inputMode = 'decimal';
        entrada.maxLength = 6;
        var ultima = ultimaCarga(ex.id);
        entrada.placeholder = ultima ? String(ultima.kg).replace('.', ',') : 'kg';
        if (sessao.cargas[ex.id] !== undefined) entrada.value = String(sessao.cargas[ex.id]).replace('.', ',');
        entrada.addEventListener('change', function () {
          var kg = Number(entrada.value.replace(',', '.'));
          if (entrada.value.trim() === '') { delete sessao.cargas[ex.id]; return; }
          if (!isFinite(kg) || kg < 0 || kg > 500) { entrada.value = ''; delete sessao.cargas[ex.id]; app.avisar('Informe a carga em quilos, como 12,5.'); return; }
          sessao.cargas[ex.id] = Math.round(kg * 10) / 10;
        });
        campo.appendChild(entrada);
        campo.appendChild(document.createTextNode(ultima ? 'kg · da última vez: ' + String(ultima.kg).replace('.', ',') + ' kg' : 'kg'));
        c.appendChild(campo);
      }
      if (x.opcoes.length > 1) {
        var trocar = botao('Trocar exercício', 'texto-botao', function () {
          var i = x.opcoes.indexOf(ex.id);
          estado.trocas[x.movimento] = x.opcoes[(i + 1) % x.opcoes.length];
          salvar();
          desenharSessao();
          app.avisar('Exercício trocado. A troca vale para as próximas vezes.');
        });
        trocar.style.marginTop = '.5rem';
        c.appendChild(trocar);
      }
      caixa.appendChild(c);
    });
    var esforcos = $('tr-esforco');
    esforcos.textContent = '';
    T.ESFORCOS.forEach(function (e) {
      var b = botao(e.rotulo, '', function () {
        sessao.esforco = e.id;
        esforcos.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      b.setAttribute('aria-pressed', String(e.id === sessao.esforco));
      esforcos.appendChild(b);
    });
    $('tr-cardio').textContent = T.porObjetivo[p.objetivo].cardio;
  }

  $('tr-comecar').addEventListener('click', function () { comecar(proximoTreino().letra); });
  $('tr-escolher-outro').addEventListener('click', function () {
    $('tr-treinos').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('tr-concluir').addEventListener('click', function () {
    var t = plano().filter(function (x) { return x.letra === sessao.letra; })[0];
    var n = series(estado.perfil);
    var feitos = t.exercicios.filter(function (x) {
      var m = sessao.marcas[x.exercicio.id] || [];
      return m.filter(Boolean).length >= n;
    }).length;
    var algum = Object.keys(sessao.marcas).some(function (k) { return sessao.marcas[k].some(Boolean); });
    if (!algum && !window.confirm('Nenhuma série marcada. Registrar o treino mesmo assim?')) return;
    estado.sessoes.push({ data: app.hojeISO(), treino: sessao.letra, esforco: sessao.esforco, feitos: feitos, cargas: sessao.cargas });
    if (estado.sessoes.length > 500) estado.sessoes = estado.sessoes.slice(-500);
    pararDescanso();
    sessao = null;
    salvar();
    desenharPainel();
    mostrar('painel');
    app.avisar('Treino registrado. ' + (feitos === t.exercicios.length ? 'Todos os exercícios completos.' : feitos + ' de ' + t.exercicios.length + ' exercícios completos.'));
  });

  $('tr-sair').addEventListener('click', function () {
    var algum = sessao && Object.keys(sessao.marcas).some(function (k) { return sessao.marcas[k].some(Boolean); });
    if (algum && !window.confirm('Sair sem salvar este treino?')) return;
    pararDescanso();
    sessao = null;
    mostrar('painel');
  });

  /* --- Descanso entre séries ------------------------------------------------------------------- */

  function iniciarDescanso(segundos) {
    pararDescanso();
    var fim = Date.now() + segundos * 1000;
    $('tr-cronometro').hidden = false;
    function passo() {
      var resta = Math.max(0, Math.round((fim - Date.now()) / 1000));
      $('tr-cronometro-tempo').textContent = Math.floor(resta / 60) + ':' + String(resta % 60).padStart(2, '0');
      if (resta <= 0) {
        pararDescanso();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        app.avisar('Descanso terminado. Próxima série.');
      }
    }
    passo();
    cronometro = window.setInterval(passo, 500);
  }

  function pararDescanso() {
    window.clearInterval(cronometro);
    cronometro = null;
    $('tr-cronometro').hidden = true;
  }

  $('tr-cronometro-parar').addEventListener('click', pararDescanso);

  /* --- Conta ----------------------------------------------------------------------------------- */

  function mostrarGuardar() {
    var caixa = $('tr-guardar');
    caixa.disabled = !conta.logado;
    caixa.checked = Boolean(conta.logado && estado.guardarNaConta);
    $('tr-guardar-texto').textContent = !conta.logado
      ? 'Entre na sua conta para guardar o treino e abrir em qualquer aparelho. Sem conta, fica só neste aparelho.'
      : (estado.guardarNaConta
        ? 'Seu treino fica neste aparelho e na sua conta, visível só para você.'
        : 'Ao ligar, você autoriza guardar o treino e o histórico na sua conta, visíveis só para você. Dá para desligar e apagar quando quiser.');
  }

  $('tr-guardar').addEventListener('change', function () {
    if ($('tr-guardar').checked) {
      estado.guardarNaConta = true;
      salvar();
      app.avisar('Pronto: o treino vai ficar salvo na sua conta.');
      mostrarGuardar();
      return;
    }
    if (conta.temNaConta && !window.confirm('Apagar o treino da sua conta? Ele continua neste aparelho.')) {
      $('tr-guardar').checked = true;
      return;
    }
    estado.guardarNaConta = false;
    salvar();
    mostrarGuardar();
    if (!conta.temNaConta) return;
    api.post(ENDERECO + '&acao=apagar').then(function (r) {
      if (r.ok) { conta.temNaConta = false; app.avisar('Apagado da sua conta. Continua neste aparelho.'); }
      else app.avisar(r.erro || 'Não foi possível apagar agora. Tente de novo.');
    });
  });

  $('tr-apagar').addEventListener('click', function () {
    var naConta = conta.logado && conta.temNaConta;
    if (!window.confirm(naConta ? 'Apagar o treino e o histórico deste aparelho e da sua conta? Não dá para desfazer.' : 'Apagar o treino e o histórico deste aparelho?')) return;
    function limpar() {
      try { localStorage.removeItem(CHAVE); } catch (e) { /* nada guardado */ }
      location.reload();
    }
    if (!naConta) { limpar(); return; }
    api.post(ENDERECO + '&acao=apagar').then(function (r) {
      if (!r.ok) { app.avisar(r.erro || 'Não foi possível apagar da conta agora.'); return; }
      limpar();
    });
  });

  /* --- Telas -------------------------------------------------------------------------------------- */

  function mostrar(tela) {
    $('tr-config').hidden = tela !== 'config';
    $('tr-painel').hidden = tela !== 'painel';
    $('tr-sessao').hidden = tela !== 'sessao';
    window.scrollTo(0, 0);
  }

  function inicio() {
    if (estado.perfil) { desenharPainel(); mostrar('painel'); } else abrirConfiguracao();
  }

  inicio();

  app.sessao.then(function (usuario) {
    conta.logado = Boolean(usuario);
    mostrarGuardar();
    if (!usuario) return;
    api.get(ENDERECO).then(function (r) {
      if (!r.ok) return;
      var daConta = r.dados.dados;
      conta.temNaConta = Boolean(daConta);
      if (daConta && (daConta.alteradoEm || 0) > (estado.alteradoEm || 0)) {
        estado = completar(daConta);
        estado.guardarNaConta = true;
        app.gravarLocal(CHAVE, estado);
        if (!sessao) inicio();
        app.avisar('Trouxemos seu treino da sua conta.');
      } else if (daConta) {
        estado.guardarNaConta = true;
        salvar();
      }
      mostrarGuardar();
    });
  });
})();
