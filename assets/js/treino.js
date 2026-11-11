/* Treino: monta um plano simples a partir do objetivo, do local, do tempo e do foco,
   com 3 opções de exercícios para cada treino, guia o treino do dia com séries e descanso
   e guarda as cargas e a semana. As medidas são as mesmas da Alimentação.
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
  var conta = { logado: false, temNaConta: false, cadastro: null };
  var sessao = null;
  var cronometro = null;

  function $(id) { return document.getElementById(id); }

  function completar(e) {
    if (!e || typeof e !== 'object') e = {};
    if (!e.perfil || typeof e.perfil !== 'object' || !e.perfil.dias) e.perfil = null;
    if (e.perfil) {
      if (!Array.isArray(e.perfil.foco)) e.perfil.foco = [];
      e.perfil.foco = e.perfil.foco.filter(function (f) { return T.porFoco[f]; }).slice(0, T.MAXIMO_FOCOS);
      if (!Array.isArray(e.perfil.cuidados)) e.perfil.cuidados = [];
      if (!e.perfil.medidas || typeof e.perfil.medidas !== 'object') e.perfil.medidas = {};
    }
    if (!Array.isArray(e.sessoes)) e.sessoes = [];
    if (!e.trocas || typeof e.trocas !== 'object' || Array.isArray(e.trocas)) e.trocas = {};
    // Trocas do formato antigo, por movimento, não valem para as opções novas
    Object.keys(e.trocas).forEach(function (k) {
      if (!/^[a-f][0-2]-[a-z_]+$/.test(k) || !T.porExercicio[e.trocas[k]]) delete e.trocas[k];
    });
    if (!e.variacoes || typeof e.variacoes !== 'object' || Array.isArray(e.variacoes)) e.variacoes = {};
    if (typeof e.alternar !== 'boolean') e.alternar = false;
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

  function minusculo(texto) { return texto.charAt(0).toLowerCase() + texto.slice(1); }

  function juntar(lista) {
    if (lista.length < 2) return lista.join('');
    return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
  }

  /* --- Guardar ------------------------------------------------------------------- */

  var agendado = null;

  function salvar() {
    var proximo = proximoTreino();
    estado.resumo = { proximo: proximo ? 'Treino ' + proximo.letra + ' · ' + proximo.nome : '' };
    estado.alteradoEm = Date.now();
    app.gravarLocal(CHAVE, estado);
    compartilhar();
    if (!conta.logado || !estado.guardarNaConta) return;
    window.clearTimeout(agendado);
    agendado = window.setTimeout(function () {
      api.post(ENDERECO + '&acao=salvar', { dados: estado, consentimento: true }).then(function (r) {
        if (r.ok) { conta.temNaConta = true; mostrarGuardar(); }
        else if (r.status !== 401) app.avisar(r.erro || 'Não foi possível salvar na conta agora. Fica neste aparelho.');
      });
    }, 900);
  }

  // O que a Alimentação mostra do treino, e as medidas para ela não pedir de novo
  function compartilhar() {
    var p = estado.perfil;
    if (!p) return;
    app.guardarComum('treino', p.medidas, {
      objetivo: p.objetivo, dias: p.dias, tempo: p.tempo, local: p.local,
      proximo: estado.resumo.proximo, em: Date.now()
    });
  }

  /* --- O plano ---------------------------------------------------------------------- */

  function divisao(perfil) {
    if (perfil.dias <= 3) return T.DIVISOES.corpo_inteiro;
    if (perfil.dias === 4) return T.DIVISOES.superior_inferior;
    return T.DIVISOES.empurrar_puxar_pernas;
  }

  function permitido(ex, perfil) {
    return ex && ex.locais.indexOf(perfil.local) !== -1 &&
      !ex.evitar.some(function (c) { return perfil.cuidados.indexOf(c) !== -1; });
  }

  function opcoesDo(movimento, perfil) {
    return T.MOVIMENTOS[movimento].filter(function (id) { return permitido(T.porExercicio[id], perfil); });
  }

  function gruposDoFoco(perfil) {
    return perfil.foco.reduce(function (g, f) { return g.concat(T.porFoco[f].grupos); }, []);
  }

  function variacaoDe(letra) {
    var v = estado.variacoes[letra];
    return v === 1 || v === 2 ? v : 0;
  }

  function chaveDaTroca(letra, v, movimento) { return letra.toLowerCase() + v + '-' + movimento; }

  // Escolhe o exercício de um movimento para a opção v: a 1ª, a 2ª ou a 3ª que servem
  function escolher(letra, v, movimento, perfil, usados, grupos) {
    var opcoes = opcoesDo(movimento, perfil).filter(function (id) { return usados.indexOf(id) === -1; });
    if (!opcoes.length) return null;
    var sugerido = opcoes[v % opcoes.length];
    var chave = chaveDaTroca(letra, v, movimento);
    var trocado = estado.trocas[chave];
    var id = trocado && permitido(T.porExercicio[trocado], perfil) && usados.indexOf(trocado) === -1 ? trocado : sugerido;
    usados.push(id);
    var ex = T.porExercicio[id];
    return {
      movimento: movimento, chave: chave, exercicio: ex, sugerido: sugerido, trocado: id !== sugerido,
      foco: grupos.indexOf(ex.grupo) !== -1
    };
  }

  // Movimentos a mais para o foco: só nos treinos que já trabalham aquele grupo,
  // ou em todos, quando o treino é de corpo inteiro. No máximo 2 por treino.
  function extrasDo(modelo, perfil, inteiro) {
    var gruposDoTreino = modelo.movimentos.map(function (m) { return T.GRUPO_DO_MOVIMENTO[m]; });
    var extras = [];
    perfil.foco.forEach(function (f) {
      T.porFoco[f].extras.forEach(function (mov) {
        if (inteiro || gruposDoTreino.indexOf(T.GRUPO_DO_MOVIMENTO[mov]) !== -1) extras.push(mov);
      });
    });
    return extras.slice(0, 2);
  }

  function montarTreino(modelo, perfil, v) {
    var inteiro = divisao(perfil) === T.DIVISOES.corpo_inteiro;
    var maximo = T.porTempo[perfil.tempo].exercicios;
    var grupos = gruposDoFoco(perfil);
    var doFoco = function (m) { return grupos.indexOf(T.GRUPO_DO_MOVIMENTO[m]) !== -1; };
    // Com foco, os movimentos do foco entram primeiro quando o tempo é curto
    var prioridade = modelo.movimentos.filter(doFoco).concat(modelo.movimentos.filter(function (m) { return !doFoco(m); }));
    var usados = [];
    var escolhidos = {};
    var n = 0;
    prioridade.forEach(function (mov) {
      if (n >= maximo) return;
      var item = escolher(modelo.letra, v, mov, perfil, usados, grupos);
      if (item) { escolhidos[mov] = item; n += 1; }
    });
    var lista = modelo.movimentos.filter(function (m) { return escolhidos[m]; }).map(function (m) { return escolhidos[m]; });

    var extras = 0;
    extrasDo(modelo, perfil, inteiro).forEach(function (mov) {
      var item = escolher(modelo.letra, v, mov, perfil, usados, grupos);
      if (!item) return;
      item.foco = true;
      item.extra = true;
      extras += 1;
      // Logo depois do último exercício do mesmo grupo, ou antes do abdômen e da panturrilha
      var grupo = item.exercicio.grupo;
      var pos = -1;
      lista.forEach(function (x, i) { if (x.exercicio.grupo === grupo) pos = i; });
      if (pos === -1) {
        pos = lista.length - 1;
        for (var i = 0; i < lista.length; i += 1) {
          if (lista[i].exercicio.grupo === 'abdomen' || lista[i].exercicio.grupo === 'panturrilha') { pos = i - 1; break; }
        }
      }
      lista.splice(pos + 1, 0, item);
    });
    return { letra: modelo.letra, nome: modelo.nome, variacao: v, exercicios: lista, minutos: perfil.tempo + extras * 5 };
  }

  function treinoDe(letra, v) {
    var modelo = divisao(estado.perfil).filter(function (m) { return m.letra === letra; })[0] || divisao(estado.perfil)[0];
    return montarTreino(modelo, estado.perfil, v === undefined ? variacaoDe(modelo.letra) : v);
  }

  function plano() {
    if (!estado.perfil) return [];
    return divisao(estado.perfil).map(function (m) { return treinoDe(m.letra); });
  }

  function series(perfil) {
    return T.porNivel[perfil.nivel].series + (perfil.nivel === 'intermediario' && perfil.tempo === 60 ? 1 : 0);
  }

  // Os exercícios do foco ganham uma série a mais
  function seriesDe(item, perfil) { return series(perfil) + (item.foco ? 1 : 0); }

  function repeticoes(ex, perfil) {
    if (ex.tempo) return perfil.nivel === 'iniciante' ? '20 a 30 s' : '30 a 45 s';
    if (!ex.carga && perfil.objetivo === 'massa') return '10 a 15';
    return T.porObjetivo[perfil.objetivo].reps;
  }

  // Em casa, sem equipamento, não há peso para anotar
  // Todo exercício tem o campo de peso. Nos de peso do corpo, é o peso extra, como uma mochila
  function pesoDoCorpo(ex, perfil) { return !ex.carga || perfil.local === 'casa'; }

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

  // Gasto aproximado de um treino de musculação: cerca de 5 vezes o gasto em repouso (MET 5)
  function gastoDoTreino(minutos) {
    var peso = estado.perfil.medidas.peso;
    if (!peso) return 0;
    return Math.round(5 * peso * minutos / 60 / 10) * 10;
  }

  /* --- Trocar um exercício ------------------------------------------------------------------ */

  // Até 3 exercícios do mesmo grupo muscular que servem para o local e os cuidados,
  // primeiro os do mesmo movimento, sem repetir o que já está no treino
  function alternativas(item, treino) {
    var perfil = estado.perfil;
    var noTreino = treino.exercicios.map(function (x) { return x.exercicio.id; });
    var grupo = item.exercicio.grupo;
    var candidatos = T.MOVIMENTOS[item.movimento].concat(
      T.EXERCICIOS.filter(function (e) { return e.grupo === grupo; }).map(function (e) { return e.id; }));
    var lista = [];
    candidatos.forEach(function (id) {
      var ex = T.porExercicio[id];
      if (lista.indexOf(id) !== -1 || noTreino.indexOf(id) !== -1 || ex.grupo !== grupo || !permitido(ex, perfil)) return;
      lista.push(id);
    });
    return lista.slice(0, 3).map(function (id) { return T.porExercicio[id]; });
  }

  function trocar(item, treino, id, depois) {
    var antes = estado.trocas[item.chave];
    if (id === item.sugerido) delete estado.trocas[item.chave];
    else estado.trocas[item.chave] = id;
    salvar();
    depois();
    app.avisar('Trocado por ' + minusculo(T.porExercicio[id].nome) + ' no treino ' + treino.letra + ', opção ' + (treino.variacao + 1) + '.', function () {
      if (antes) estado.trocas[item.chave] = antes; else delete estado.trocas[item.chave];
      salvar();
      depois();
    });
  }

  function abrirTrocas(item, treino, depoisDe, depois) {
    var aberta = document.querySelector('.tr-trocas');
    var mesma = aberta && aberta.dataset.chave === item.chave;
    if (aberta) aberta.remove();
    if (mesma) return;
    var caixa = criar(depoisDe.parentNode.tagName === 'UL' ? 'li' : 'div', 'tr-trocas');
    caixa.dataset.chave = item.chave;
    var grupo = T.porGrupo[item.exercicio.grupo].rotulo;
    caixa.appendChild(criar('p', 'tr-trocas-titulo', 'Outros exercícios para ' + minusculo(grupo)));
    var opcoes = alternativas(item, treino);
    if (!opcoes.length) caixa.appendChild(criar('p', 'app-suave', 'Não há outro exercício deste grupo para o seu local e os seus cuidados.'));
    opcoes.forEach(function (ex) {
      var b = criar('button', 'tr-troca-opcao');
      b.type = 'button';
      b.appendChild(criar('strong', '', ex.nome));
      b.appendChild(criar('span', '', ex.dica));
      b.addEventListener('click', function () { trocar(item, treino, ex.id, depois); });
      caixa.appendChild(b);
    });
    var acoes = criar('div', 'app-botoes');
    if (item.trocado) {
      acoes.appendChild(botao('Voltar para ' + minusculo(T.porExercicio[item.sugerido].nome), 'texto-botao', function () {
        trocar(item, treino, item.sugerido, depois);
      }));
    }
    acoes.appendChild(botao('Cancelar', 'texto-botao', function () { caixa.remove(); }));
    caixa.appendChild(acoes);
    depoisDe.parentNode.insertBefore(caixa, depoisDe.nextSibling);
    caixa.querySelector('button').focus();
  }

  function botaoTrocar(item, treino, onde, depois) {
    var b = criar('button', 'app-icone-botao plano tr-trocar');
    b.type = 'button';
    b.setAttribute('aria-label', 'Trocar ' + minusculo(item.exercicio.nome));
    b.title = 'Trocar exercício';
    b.appendChild(app.icone('girar'));
    b.addEventListener('click', function () { abrirTrocas(item, treino, onde(), depois); });
    return b;
  }

  function seloFoco() { return criar('span', 'tr-foco', 'Foco'); }

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
  escolhas('tr-foco', 'foco', [{ id: '', rotulo: 'Corpo equilibrado' }].concat(T.FOCOS), true);
  escolhas('tr-cuidados', 'cuidados', T.CUIDADOS, true);

  // "Corpo equilibrado" desmarca os focos; no máximo 2 focos
  $('tr-foco').addEventListener('change', function (e) {
    var caixas = Array.prototype.slice.call(document.querySelectorAll('input[name="foco"]'));
    var equilibrado = caixas[0];
    var focos = caixas.slice(1);
    if (e.target === equilibrado) {
      if (equilibrado.checked) focos.forEach(function (c) { c.checked = false; });
      else equilibrado.checked = true;
    } else {
      var marcados = focos.filter(function (c) { return c.checked; });
      if (marcados.length > T.MAXIMO_FOCOS) {
        e.target.checked = false;
        app.avisar('Escolha até dois grupos. Com mais, o foco deixa de ser foco.');
      }
      equilibrado.checked = !focos.some(function (c) { return c.checked; });
    }
    mostrarExplicacaoFoco();
  });

  function focosMarcados() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="foco"]:checked'))
      .map(function (c) { return c.value; }).filter(Boolean);
  }

  function mostrarExplicacaoFoco() {
    var f = focosMarcados();
    $('tr-foco-texto').textContent = f.length
      ? 'O treino ganha exercícios a mais de ' + juntar(f.map(function (x) { return minusculo(T.porFoco[x].rotulo); })) +
        ' e uma série a mais em cada um deles. Eles aparecem marcados com Foco. Os outros grupos continuam no treino, para o corpo ficar equilibrado.'
      : 'Todos os grupos recebem a mesma atenção. Bom para quem está começando.';
  }

  function marcar(nome, valor) {
    var c = document.querySelector('input[name="' + nome + '"][value="' + valor + '"]');
    if (c) c.checked = true;
  }

  function valor(nome) {
    var c = document.querySelector('input[name="' + nome + '"]:checked');
    return c ? c.value : '';
  }

  // O objetivo da Alimentação serve de ponto de partida
  function alimentacao() { return app.lerLocal('ar-alimentacao-v1') || {}; }
  function objetivoDaAlimentacao() {
    var a = alimentacao();
    return { perder: 'emagrecer', ganhar: 'massa', manter: 'saude' }[a.perfil && a.perfil.objetivo] || '';
  }

  // Medidas: as do treino, senão as da Alimentação, senão as do cadastro
  function medidasIniciais() {
    if (estado.perfil && estado.perfil.medidas && estado.perfil.medidas.peso) return { medidas: estado.perfil.medidas, de: '' };
    var c = app.comum().medidas;
    if (c.peso || c.altura) return { medidas: c, de: 'alimentacao' };
    var cad = conta.cadastro;
    if (cad && (cad.peso || cad.altura)) {
      return { medidas: { altura: cad.altura ? Math.round(Number(cad.altura)) : '', peso: cad.peso ? Math.round(Number(cad.peso) * 10) / 10 : '' }, de: 'cadastro' };
    }
    return { medidas: {}, de: '' };
  }

  function mostrarMedidas() {
    var m = medidasIniciais();
    var d = m.medidas;
    document.querySelectorAll('input[name="tr-sexo"]').forEach(function (r) { r.checked = r.value === (d.sexo || ''); });
    $('tr-idade').value = d.idade || '';
    $('tr-altura').value = d.altura || '';
    $('tr-peso').value = d.peso ? String(d.peso).replace('.', ',') : '';
    $('tr-medidas-de').hidden = !m.de;
    $('tr-medidas-de').textContent = m.de === 'alimentacao'
      ? 'Trouxemos suas medidas da Alimentação. Se mudar aqui, muda lá também.'
      : 'Trouxemos altura e peso do seu cadastro. Confira se continuam certos.';
  }

  function lerMedidas() {
    var sexo = valor('tr-sexo');
    var idade = Number($('tr-idade').value) || '';
    var altura = Number(String($('tr-altura').value).replace(',', '.')) || '';
    var peso = Number(String($('tr-peso').value).replace(',', '.')) || '';
    var erros = {};
    if (idade !== '' && !(idade >= 18 && idade <= 80)) erros.idade = 'O treino é para adultos de 18 a 80 anos.';
    if (altura !== '' && !(altura >= 140 && altura <= 220)) erros.altura = 'Em centímetros, como 178.';
    if (peso !== '' && !(peso >= 40 && peso <= 250)) erros.peso = 'Em quilos, como 82.';
    ['idade', 'altura', 'peso'].forEach(function (c) { $('erro-tr-' + c).textContent = erros[c] || ''; });
    if (Object.keys(erros).length) return null;
    var m = {};
    if (sexo) m.sexo = sexo;
    if (idade) m.idade = Math.round(idade);
    if (altura) m.altura = Math.round(altura);
    if (peso) m.peso = Math.round(peso * 10) / 10;
    return m;
  }

  function abrirConfiguracao() {
    var p = estado.perfil || { objetivo: objetivoDaAlimentacao() || 'saude', nivel: 'iniciante', local: 'academia', dias: 3, tempo: 45, cuidados: [], foco: [] };
    marcar('objetivo', p.objetivo);
    marcar('nivel', p.nivel);
    marcar('local', p.local);
    marcar('dias', p.dias);
    marcar('tempo', p.tempo);
    document.querySelectorAll('input[name="cuidados"]').forEach(function (c) { c.checked = p.cuidados.indexOf(c.value) !== -1; });
    document.querySelectorAll('input[name="foco"]').forEach(function (c) {
      c.checked = c.value ? p.foco.indexOf(c.value) !== -1 : !p.foco.length;
    });
    mostrarExplicacaoFoco();
    mostrarMedidas();
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
      cuidados: Array.prototype.slice.call(document.querySelectorAll('input[name="cuidados"]:checked')).map(function (c) { return c.value; }),
      foco: focosMarcados()
    };
    if (!p.objetivo || !p.nivel || !p.local || !p.dias || !p.tempo) {
      $('tr-config-erro').textContent = 'Escolha uma opção em cada pergunta.';
      return;
    }
    p.medidas = lerMedidas();
    if (!p.medidas) {
      $('tr-config-erro').textContent = 'Confira as medidas marcadas, ou deixe em branco.';
      return;
    }
    var mudouDivisao = estado.perfil && (estado.perfil.local !== p.local || estado.perfil.dias !== p.dias);
    if (mudouDivisao) { estado.trocas = {}; estado.variacoes = {}; }
    var era = Boolean(estado.perfil);
    estado.perfil = p;
    salvar();
    desenharPainel();
    mostrar('painel');
    app.avisar(era ? 'Treino ajustado.' : 'Pronto: seu treino está montado, com 3 opções para cada dia.');
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
    return estado.sessoes.filter(function (s) { return s.data >= inicio && s.data <= hoje; }).length;
  }

  function textoDoPlano(p) {
    var obj = T.porObjetivo[p.objetivo];
    var focos = p.foco.map(function (f) { return minusculo(T.porFoco[f].rotulo); });
    return [
      T.LOCAIS.filter(function (l) { return l.id === p.local; })[0].rotulo + ', ' + p.dias + ' dias por semana, ' +
        series(p) + ' séries de ' + obj.reps + ' repetições, com ' + obj.descanso + ' segundos de descanso.',
      focos.length ? 'Foco em ' + juntar(focos) + ': exercícios a mais e uma série extra nesses grupos, marcados com Foco.' : '',
      obj.cardio,
      p.cuidados.length ? 'Sem exercícios que forçam: ' + p.cuidados.join(', ') + '.' : ''
    ].filter(Boolean).join(' ');
  }

  function desenharPainel() {
    var p = estado.perfil;
    var proximo = proximoTreino();
    var hoje = app.hojeISO();
    var feitoHoje = estado.sessoes.filter(function (s) { return s.data === hoje; })[0];
    var naSemana = desenharSemana();
    var gasto = gastoDoTreino(proximo.minutos);
    $('tr-hoje-rotulo').textContent = feitoHoje ? 'Treino de hoje feito' : 'Treino de hoje';
    $('tr-hoje-titulo').textContent = feitoHoje ? 'Bom trabalho' : 'Treino ' + proximo.letra + ': ' + proximo.nome;
    $('tr-hoje-detalhe').textContent = (feitoHoje
      ? 'O próximo é o treino ' + proximo.letra + '. '
      : 'Opção ' + (proximo.variacao + 1) + ', ' + proximo.exercicios.length + ' exercícios, cerca de ' + proximo.minutos + ' minutos' +
        (gasto ? ' e ' + gasto + ' kcal' : '') + '. ') +
      naSemana + ' de ' + p.dias + ' treinos nesta semana.';
    $('tr-comecar').textContent = feitoHoje ? 'Treinar de novo' : 'Começar treino';
    $('tr-plano-texto').textContent = textoDoPlano(p);
    $('tr-alternar').checked = estado.alternar;

    var caixa = $('tr-treinos');
    caixa.textContent = '';
    plano().forEach(function (t) { caixa.appendChild(cartaoDoTreino(t)); });
    desenharEstrategia(p);
    desenharAlimentacao();
    desenharHistorico();
    mostrarGuardar();
  }

  function cartaoDoTreino(t) {
    var p = estado.perfil;
    var c = criar('article', 'app-cartao tr-treino');
    var cab = criar('div', 'tr-treino-cab');
    var titulo = criar('h3', 'app-cartao-titulo');
    titulo.appendChild(criar('span', 'tr-letra', t.letra));
    titulo.appendChild(document.createTextNode(t.nome));
    cab.appendChild(titulo);
    cab.appendChild(botao('Fazer', 'texto-botao', function () { comecar(t.letra); }));
    c.appendChild(cab);

    var opcoes = criar('div', 'app-segmentos tr-opcoes');
    opcoes.setAttribute('role', 'group');
    opcoes.setAttribute('aria-label', 'Opções do treino ' + t.letra);
    for (var v = 0; v < T.VARIACOES; v += 1) {
      (function (v) {
        var b = botao('Opção ' + (v + 1), '', function () {
          if (variacaoDe(t.letra) === v) return;
          estado.variacoes[t.letra] = v;
          salvar();
          desenharPainel();
          var novo = document.querySelector('[data-treino="' + t.letra + '"] .tr-opcoes button[aria-pressed="true"]');
          if (novo) novo.focus();
          app.avisar('Treino ' + t.letra + ': opção ' + (v + 1) + ' escolhida.');
        });
        b.setAttribute('aria-pressed', String(v === t.variacao));
        opcoes.appendChild(b);
      })(v);
    }
    c.dataset.treino = t.letra;
    c.appendChild(opcoes);

    var ul = criar('ul', 'tr-exercicios');
    t.exercicios.forEach(function (x) {
      var li = criar('li');
      var nome = criar('span', 'tr-ex-nome', x.exercicio.nome);
      if (x.foco) nome.appendChild(seloFoco());
      li.appendChild(nome);
      li.appendChild(criar('span', 'tr-series', seriesDe(x, p) + ' × ' + repeticoes(x.exercicio, p)));
      li.appendChild(botaoTrocar(x, t, function () { return li; }, desenharPainel));
      var notas = [T.porGrupo[x.exercicio.grupo].rotulo];
      if (x.trocado) notas.push('trocado por você');
      var carga = ultimaCarga(x.exercicio.id);
      if (carga) notas.push('última carga: ' + String(carga.kg).replace('.', ',') + ' kg');
      li.appendChild(criar('small', '', notas.join(' · ')));
      ul.appendChild(li);
    });
    c.appendChild(ul);
    return c;
  }

  $('tr-alternar').addEventListener('change', function () {
    estado.alternar = $('tr-alternar').checked;
    salvar();
    app.avisar(estado.alternar ? 'Cada treino vai passar para a próxima opção depois de feito.' : 'Cada treino fica na opção escolhida.');
  });

  /* --- A estratégia, explicada ---------------------------------------------------------------------- */

  function estrategia(p) {
    var itens = [];
    var obj = T.porObjetivo[p.objetivo];
    if (p.dias <= 3) {
      itens.push(['Corpo inteiro, alternando A e B', 'Com ' + p.dias + ' dias por semana, cada músculo trabalha 2 ou 3 vezes. Treinar cada grupo pelo menos duas vezes por semana rende mais força e massa do que uma vez só, e o corpo tem 48 horas para se recuperar entre um treino e outro.']);
    } else if (p.dias === 4) {
      itens.push(['Parte de cima e pernas', 'Com 4 dias, cada parte do corpo treina duas vezes por semana, com descanso entre um treino e outro da mesma parte. Dá para colocar mais exercícios em cada grupo sem treinos longos demais.']);
    } else {
      itens.push(['Empurrar, puxar e pernas', 'Com ' + p.dias + ' dias, os músculos que trabalham juntos treinam no mesmo dia: peito, ombros e tríceps empurram; costas e bíceps puxam; as pernas ficam sozinhas. Cada grupo descansa enquanto os outros trabalham.']);
    }
    var porObjetivo = {
      massa: 'De ' + obj.reps + ' repetições, com ' + obj.descanso + ' segundos de descanso: a faixa que mais estimula o músculo a crescer, com carga pesada o bastante e tempo para recuperar o fôlego entre as séries.',
      emagrecer: 'De ' + obj.reps + ' repetições, com ' + obj.descanso + ' segundos de descanso: o treino fica mais intenso, gasta mais energia e preserva o músculo enquanto você perde gordura. O cardio no fim ajuda a fechar a conta.',
      saude: 'De ' + obj.reps + ' repetições, com ' + obj.descanso + ' segundos de descanso: força e disposição sem exagero, num ritmo que dá para manter por muito tempo.'
    };
    itens.push(['Repetições para o seu objetivo', porObjetivo[p.objetivo]]);
    itens.push([p.nivel === 'iniciante' ? '2 séries por exercício, para começar' : 'Mais séries, para quem já treina',
      p.nivel === 'iniciante'
        ? 'É o suficiente para evoluir rápido nas primeiras semanas, com menos dor muscular e tempo para aprender bem cada movimento.'
        : series(p) + ' séries por exercício: mais volume, porque o corpo já se acostumou e precisa de mais estímulo para continuar evoluindo.']);
    itens.push(['Os exercícios grandes primeiro', 'Agachamento, supino, remada e puxada vêm no começo, quando você está com mais energia. Os menores, como bíceps, tríceps e panturrilha, ficam para o fim.']);
    if (p.foco.length) {
      var nomes = p.foco.map(function (f) { return T.porFoco[f].rotulo.toLowerCase(); });
      itens.push(['Foco em ' + juntar(nomes), 'Os grupos que você escolheu ganham exercícios e séries a mais. Mais volume na semana é o que mais faz um músculo crescer. Os outros continuam no treino, para o corpo ficar equilibrado.']);
    }
    itens.push(['Carga que sobe aos poucos', 'Anote o peso de cada exercício. Quando o treino fica leve duas vezes seguidas, o app sugere subir 1 a 2 kg ou fazer mais repetições. Essa sobrecarga progressiva é o que faz o corpo continuar mudando.']);
    itens.push(['Três opções para não cansar', 'Cada treino tem 3 opções com exercícios diferentes para os mesmos músculos. Fique numa por 4 a 6 semanas para ver a carga subir e depois troque, para variar o estímulo.']);
    if (p.cuidados.length) {
      itens.push(['Respeitando o seu corpo', 'Os exercícios que costumam forçar ' + juntar(p.cuidados.map(function (c) { return (T.CUIDADOS.filter(function (x) { return x.id === c; })[0] || { rotulo: c }).rotulo.toLowerCase(); })) + ' saíram do treino e foram trocados por outros do mesmo grupo.']);
    }
    return itens;
  }

  function desenharEstrategia(p) {
    var lista = $('tr-estrategia');
    lista.textContent = '';
    estrategia(p).forEach(function (i) {
      var li = criar('li');
      li.appendChild(criar('strong', '', i[0]));
      li.appendChild(criar('span', '', i[1]));
      lista.appendChild(li);
    });
  }

  /* --- Ligação com a Alimentação ----------------------------------------------------------------- */

  function desenharAlimentacao() {
    var a = alimentacao();
    var resumo = app.comum().alimentacao;
    var feito = Boolean(a.concluido && resumo && resumo.meta);
    var objetivos = { perder: 'emagrecer', ganhar: 'massa', manter: 'saude' };
    var p = estado.perfil;
    $('tr-alim-titulo').textContent = feito ? 'Seu plano alimentar' : 'Próximo passo: a alimentação';
    var texto;
    if (feito) {
      texto = 'Na Alimentação, sua meta é de ' + resumo.meta.toLocaleString('pt-BR') + ' kcal e cerca de ' + resumo.proteina + ' g de proteína por dia.';
      if (objetivos[resumo.objetivo] && objetivos[resumo.objetivo] !== p.objetivo) {
        texto += ' O objetivo lá é diferente do treino: vale deixar os dois iguais.';
      } else if (p.objetivo === 'massa') {
        texto += ' Para ganhar massa, comer a proteína todo dia conta tanto quanto o treino.';
      } else if (p.objetivo === 'emagrecer') {
        texto += ' O treino ajuda a perder gordura sem perder músculo.';
      }
    } else {
      texto = 'Treino e comida andam juntos. Monte um plano alimentar com o mesmo objetivo e veja quanto custa no mercado.' +
        (p.medidas.peso ? ' Suas medidas já vão preenchidas.' : '');
    }
    $('tr-alim-texto').textContent = texto;
    $('tr-alim-ir').textContent = feito ? 'Abrir a Alimentação' : 'Montar meu plano alimentar';
  }

  /* --- Histórico ----------------------------------------------------------------------------------- */

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
      var texto = criar('span', 'app-lista-texto', app.dataCurta(s.data) + ' · Treino ' + s.treino + (s.variacao !== undefined ? ', opção ' + (s.variacao + 1) : ''));
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
    var t = treinoDe(letra);
    sessao = { letra: t.letra, variacao: t.variacao, marcas: {}, cargas: {}, esforco: 'ok' };
    desenharSessao();
    mostrar('sessao');
    $('tr-sessao-titulo').focus();
  }

  function desenharSessao() {
    var p = estado.perfil;
    var t = treinoDe(sessao.letra, sessao.variacao);
    $('tr-sessao-rotulo').textContent = 'Treino ' + t.letra + ' · opção ' + (t.variacao + 1);
    $('tr-sessao-titulo').textContent = t.nome;
    var dica = conselho(t.letra);
    $('tr-sessao-texto').textContent = 'Comece com 5 minutos de aquecimento leve. Marque cada série ao terminar: o descanso começa sozinho.' + (dica ? ' ' + dica : '');
    var caixa = $('tr-sessao-exercicios');
    caixa.textContent = '';
    t.exercicios.forEach(function (x) {
      var ex = x.exercicio;
      var n = seriesDe(x, p);
      var c = criar('article', 'app-cartao tr-sessao-ex' + (x.foco ? ' tr-com-foco' : ''));
      var cab = criar('div', 'tr-treino-cab');
      var titulo = criar('h3', 'app-cartao-titulo', ex.nome);
      if (x.foco) titulo.appendChild(seloFoco());
      cab.appendChild(titulo);
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
      var campo = criar('label', 'tr-carga');
      campo.appendChild(document.createTextNode(pesoDoCorpo(ex, p) ? 'Peso extra' : 'Carga'));
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
      campo.appendChild(document.createTextNode(ultima ? 'kg · da última vez: ' + String(ultima.kg).replace('.', ',') + ' kg'
        : (pesoDoCorpo(ex, p) ? 'kg · 0 se for só o peso do corpo' : 'kg')));
      c.appendChild(campo);
      var acoes = criar('div', 'tr-sessao-acoes');
      var trocarBotao = botao('Trocar exercício', 'texto-botao', null, 'girar');
      trocarBotao.addEventListener('click', function () { abrirTrocas(x, t, acoes, desenharSessao); });
      acoes.appendChild(trocarBotao);
      c.appendChild(acoes);
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
    var t = treinoDe(sessao.letra, sessao.variacao);
    var feitos = t.exercicios.filter(function (x) {
      var m = sessao.marcas[x.exercicio.id] || [];
      return m.filter(Boolean).length >= seriesDe(x, estado.perfil);
    }).length;
    var algum = Object.keys(sessao.marcas).some(function (k) { return sessao.marcas[k].some(Boolean); });
    if (!algum && !window.confirm('Nenhuma série marcada. Registrar o treino mesmo assim?')) return;
    estado.sessoes.push({ data: app.hojeISO(), treino: sessao.letra, variacao: sessao.variacao, esforco: sessao.esforco, feitos: feitos, cargas: sessao.cargas });
    if (estado.sessoes.length > 500) estado.sessoes = estado.sessoes.slice(-500);
    var mudou = '';
    if (estado.alternar) {
      estado.variacoes[sessao.letra] = (sessao.variacao + 1) % T.VARIACOES;
      mudou = ' Da próxima vez, o treino ' + sessao.letra + ' vem na opção ' + (estado.variacoes[sessao.letra] + 1) + '.';
    }
    pararDescanso();
    sessao = null;
    salvar();
    desenharPainel();
    mostrar('painel');
    app.avisar('Treino registrado. ' + (feitos === t.exercicios.length ? 'Todos os exercícios completos.' : feitos + ' de ' + t.exercicios.length + ' exercícios completos.') + mudou);
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
        : 'Ao ligar, você autoriza guardar o treino, as medidas e o histórico na sua conta, visíveis só para você. Dá para desligar e apagar quando quiser.');
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

  // Medidas novas vindas da Alimentação valem também aqui
  function trazerMedidasDaAlimentacao() {
    var c = app.comum();
    if (!estado.perfil || c.medidasDe !== 'alimentacao' || !(c.medidasEm > (estado.alteradoEm || 0))) return false;
    var m = estado.perfil.medidas;
    var mudou = false;
    ['sexo', 'idade', 'altura', 'peso'].forEach(function (k) {
      if (c.medidas[k] && c.medidas[k] !== m[k]) { m[k] = c.medidas[k]; mudou = true; }
    });
    return mudou;
  }

  if (trazerMedidasDaAlimentacao()) salvar();
  inicio();

  app.sessao.then(function (usuario) {
    conta.logado = Boolean(usuario);
    mostrarGuardar();
    if (!usuario) return;
    api.get('api/perfil.php').then(function (r) {
      if (!r.ok) return;
      conta.cadastro = r.dados.cadastro || null;
      if (!$('tr-config').hidden && !$('tr-peso').value && !$('tr-altura').value) mostrarMedidas();
    });
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
