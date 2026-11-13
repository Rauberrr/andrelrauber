/* Hábitos: para quem já tentou e desistiu. Três regras guiam o app:
   1. comece ridiculamente pequeno (a versão de 2 minutos também conta);
   2. prenda o hábito novo a algo que você já faz (a âncora);
   3. nunca falhe duas vezes (o app destaca o hábito e avisa à noite).
   Cada hábito cumprido é um "voto" para a identidade que a pessoa escolheu.
   Lembretes: Web Push pelo sw.js, mesmo com o navegador fechado, e avisos na própria
   página enquanto ela estiver aberta. Sem autorização, os hábitos ficam neste aparelho.
   Além dos hábitos, lembretes simples: só o texto e a hora (uma vez, todo dia ou em alguns dias). */
(function () {
  'use strict';

  var app = window.AR_APP;
  var api = app.api;
  var criar = app.criar;
  var CHAVE = 'ar-habitos-v1';
  var ENDERECO = 'api/apps.php?app=habitos';
  var PUSH = 'api/habitos.php?acao=';
  var MAXIMO = 20;
  var MAXIMO_LEMBRETES = 30;
  var DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  var DIAS_NOME = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  var CORES = [
    { id: 'bordo', rotulo: 'Bordô' }, { id: 'ouro', rotulo: 'Caramelo' }, { id: 'oliva', rotulo: 'Oliva' },
    { id: 'azul', rotulo: 'Azul' }, { id: 'grafite', rotulo: 'Grafite' }
  ];
  var TODOS = [0, 1, 2, 3, 4, 5, 6];
  var UTEIS = [1, 2, 3, 4, 5];
  // cat: corpo, mente, rotina, dinheiro, relacoes
  var CATEGORIAS = [
    { id: '', rotulo: 'Todos' }, { id: 'corpo', rotulo: 'Corpo' }, { id: 'mente', rotulo: 'Mente' },
    { id: 'rotina', rotulo: 'Rotina' }, { id: 'dinheiro', rotulo: 'Dinheiro' }, { id: 'relacoes', rotulo: 'Pessoas' }
  ];
  var MODELOS = [
    { cat: 'mente', nome: 'Ler', identidade: 'lê todos os dias', minima: 'Ler uma página', ancora: 'deitar na cama', hora: '22:00', dias: TODOS, cor: 'bordo' },
    { cat: 'corpo', nome: 'Beber água', identidade: 'cuida do próprio corpo', minima: 'Um copo cheio ao acordar', ancora: 'levantar da cama', hora: '07:00', dias: TODOS, cor: 'azul' },
    { cat: 'corpo', nome: 'Treinar', identidade: 'treina', minima: 'Colocar a roupa de treino e fazer uma série', ancora: 'sair do trabalho', hora: '18:30', dias: [1, 3, 5], cor: 'ouro' },
    { cat: 'corpo', nome: 'Caminhar', identidade: 'se movimenta todo dia', minima: 'Calçar o tênis e sair de casa', ancora: 'almoçar', hora: '12:40', dias: TODOS, cor: 'oliva' },
    { cat: 'mente', nome: 'Meditar', identidade: 'tem a cabeça no lugar', minima: 'Respirar fundo por um minuto', ancora: 'escovar os dentes de manhã', hora: '07:20', dias: TODOS, cor: 'grafite' },
    { cat: 'corpo', nome: 'Alongar', identidade: 'cuida do próprio corpo', minima: 'Alongar por dois minutos', ancora: 'tomar banho', hora: '07:40', dias: TODOS, cor: 'oliva' },
    { cat: 'rotina', nome: 'Dormir no horário', identidade: 'acorda descansado', minima: 'Deixar o celular fora do quarto', ancora: 'jantar', hora: '22:30', dias: TODOS, cor: 'azul' },
    { cat: 'mente', nome: 'Estudar inglês', identidade: 'fala inglês', minima: 'Revisar cinco palavras', ancora: 'passar o café', hora: '08:00', dias: UTEIS, cor: 'bordo' },
    { cat: 'mente', nome: 'Gratidão', identidade: 'repara no que tem de bom', minima: 'Escrever uma coisa boa do dia', ancora: 'deitar na cama', hora: '21:45', dias: TODOS, cor: 'ouro' },
    { cat: 'rotina', nome: 'Organizar a casa', identidade: 'vive num lugar em ordem', minima: 'Guardar uma coisa fora do lugar', ancora: 'chegar em casa', hora: '19:00', dias: TODOS, cor: 'grafite' },
    { cat: 'corpo', nome: 'Correr', identidade: 'corre', minima: 'Correr 5 minutos', ancora: 'acordar', hora: '06:30', dias: [1, 3, 5], cor: 'ouro' },
    { cat: 'corpo', nome: 'Comer uma fruta', identidade: 'come bem', minima: 'Uma fruta no lanche', ancora: 'almoçar', hora: '15:30', dias: TODOS, cor: 'oliva' },
    { cat: 'corpo', nome: 'Tomar o remédio ou a vitamina', identidade: 'cuida da saúde', minima: 'Tomar com um copo de água', ancora: 'tomar o café da manhã', hora: '08:00', dias: TODOS, cor: 'azul' },
    { cat: 'corpo', nome: 'Cuidar da pele', identidade: 'se cuida', minima: 'Lavar o rosto e passar hidratante', ancora: 'escovar os dentes à noite', hora: '22:15', dias: TODOS, cor: 'bordo' },
    { cat: 'rotina', nome: 'Arrumar a cama', identidade: 'começa o dia em ordem', minima: 'Esticar o lençol', ancora: 'levantar da cama', hora: '07:00', dias: TODOS, cor: 'grafite' },
    { cat: 'rotina', nome: 'Desligar as telas antes de dormir', identidade: 'dorme bem', minima: 'Celular fora do quarto 30 minutos antes', ancora: 'escovar os dentes à noite', hora: '22:00', dias: TODOS, cor: 'azul' },
    { cat: 'rotina', nome: 'Planejar o dia', identidade: 'sabe aonde está indo', minima: 'Escrever as 3 tarefas mais importantes', ancora: 'passar o café', hora: '08:30', dias: UTEIS, cor: 'grafite' },
    { cat: 'mente', nome: 'Escrever um diário', identidade: 'se conhece', minima: 'Escrever uma frase sobre o dia', ancora: 'jantar', hora: '21:30', dias: TODOS, cor: 'ouro' },
    { cat: 'mente', nome: 'Orar', identidade: 'tem fé', minima: 'Um minuto em silêncio', ancora: 'acordar', hora: '06:45', dias: TODOS, cor: 'grafite' },
    { cat: 'dinheiro', nome: 'Anotar os gastos', identidade: 'cuida do próprio dinheiro', minima: 'Anotar o gasto do dia', ancora: 'jantar', hora: '21:00', dias: TODOS, cor: 'oliva' },
    { cat: 'dinheiro', nome: 'Guardar dinheiro', identidade: 'pensa no futuro', minima: 'Separar R$ 5', ancora: 'receber o salário', hora: '19:00', dias: [5], cor: 'oliva' },
    { cat: 'relacoes', nome: 'Falar com a família', identidade: 'está presente para quem ama', minima: 'Mandar uma mensagem', ancora: 'almoçar', hora: '12:30', dias: TODOS, cor: 'bordo' },
    { cat: 'relacoes', nome: 'Elogiar alguém', identidade: 'deixa os outros melhores', minima: 'Um elogio sincero', ancora: 'chegar no trabalho', hora: '09:00', dias: UTEIS, cor: 'ouro' }
  ];
  // Sugestões rápidas para os campos que mais confundem
  var EXEMPLOS = {
    'hb-minima': ['Ler uma página', 'Calçar o tênis', 'Um copo de água', 'Respirar fundo por 1 minuto', 'Uma série só'],
    'hb-ancora': ['acordar', 'passar o café', 'almoçar', 'chegar em casa', 'escovar os dentes à noite']
  };
  // Sequências que merecem comemoração
  var MARCOS = { 3: 'Três seguidos: o começo de tudo.', 7: 'Uma semana inteira.', 14: 'Duas semanas sem falhar.', 21: 'Três semanas: já é parte da rotina.', 30: 'Um mês. Isso já é você.', 66: '66 dias: em média, é quando o hábito fica automático.', 100: 'Cem dias. Poucos chegam aqui.' };

  var estado = completar(app.lerLocal(CHAVE));
  var conta = { logado: false, temNaConta: false };
  var editando = null;
  var agendado = null;

  function $(id) { return document.getElementById(id); }
  function hoje() { return app.hojeISO(); }
  function diaDaSemana(iso) { return app.paraData(iso).getDay(); }
  function fusoLocal() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'; } catch (e) { return 'America/Sao_Paulo'; }
  }

  function completar(e) {
    if (!e || typeof e !== 'object') e = {};
    if (!Array.isArray(e.habitos)) e.habitos = [];
    e.habitos = e.habitos.filter(function (h) { return h && /^h_[a-z0-9]{3,16}$/.test(h.id) && typeof h.nome === 'string'; }).slice(0, MAXIMO);
    e.habitos.forEach(function (h) {
      if (!Array.isArray(h.dias) || !h.dias.length) h.dias = TODOS.slice();
      if (!h.criadoEm) h.criadoEm = hoje();
      if (!h.cor) h.cor = 'bordo';
    });
    if (!e.registros || typeof e.registros !== 'object' || Array.isArray(e.registros)) e.registros = {};
    if (!Array.isArray(e.lembretes)) e.lembretes = [];
    e.lembretes = e.lembretes.filter(function (l) { return l && /^l_[a-z0-9]{3,16}$/.test(l.id) && typeof l.texto === 'string' && /^\d{2}:\d{2}$/.test(l.hora || ''); }).slice(0, MAXIMO_LEMBRETES);
    if (typeof e.avisos !== 'boolean') e.avisos = false;
    if (typeof e.guardarNaConta !== 'boolean') e.guardarNaConta = false;
    return e;
  }

  /* --- Guardar ----------------------------------------------------------------------------- */

  function salvar(jaNaConta) {
    estado.alteradoEm = Date.now();
    estado.fuso = fusoLocal();
    app.gravarLocal(CHAVE, estado);
    if (!conta.logado || !estado.guardarNaConta) return Promise.resolve(null);
    window.clearTimeout(agendado);
    var enviar = function () {
      return api.post(ENDERECO + '&acao=salvar', { dados: estado, consentimento: true }).then(function (r) {
        if (r.ok) { conta.temNaConta = true; mostrarGuardar(); }
        else if (r.status !== 401) app.avisar(r.erro || 'Não foi possível salvar na conta agora. Fica neste aparelho.');
        return r;
      });
    };
    if (jaNaConta) return enviar();
    agendado = window.setTimeout(enviar, 900);
    return Promise.resolve(null);
  }

  /* --- Contas do dia a dia ----------------------------------------------------------------- */

  function situacao(h, iso) { return (estado.registros[iso] || {})[h.id] || ''; }
  function conta1(s) { return s === 'feito' || s === 'minimo'; }
  function marcadoNoDia(h, iso) { return iso >= h.criadoEm && h.dias.indexOf(diaDaSemana(iso)) !== -1; }

  // Dias seguidos cumpridos. Hoje ainda em aberto não quebra a sequência.
  function sequencia(h) {
    var d = hoje();
    if (!conta1(situacao(h, d))) d = app.somarDias(d, -1);
    var n = 0;
    for (var i = 0; i < 800 && d >= h.criadoEm; i += 1) {
      if (marcadoNoDia(h, d)) {
        if (!conta1(situacao(h, d))) break;
        n += 1;
      }
      d = app.somarDias(d, -1);
    }
    return n;
  }

  function recorde(h) {
    var melhor = 0;
    var atual = 0;
    var d = h.criadoEm;
    var fim = hoje();
    for (var i = 0; i < 800 && d <= fim; i += 1) {
      if (marcadoNoDia(h, d)) {
        if (conta1(situacao(h, d))) { atual += 1; melhor = Math.max(melhor, atual); }
        else if (d !== fim) atual = 0;
      }
      d = app.somarDias(d, 1);
    }
    return melhor;
  }

  // Quanto foi cumprido dos dias marcados nos últimos 30 dias (hoje só conta se já foi feito)
  function taxa(h) {
    var total = 0;
    var feitos = 0;
    for (var i = 0; i < 30; i += 1) {
      var d = app.somarDias(hoje(), -i);
      if (!marcadoNoDia(h, d)) continue;
      var cumpriu = conta1(situacao(h, d));
      if (i === 0 && !cumpriu) continue;
      total += 1;
      if (cumpriu) feitos += 1;
    }
    return total ? Math.round(feitos / total * 100) : null;
  }

  // O último dia marcado antes de hoje ficou para trás?
  function falhouAntes(h) {
    for (var i = 1; i <= 7; i += 1) {
      var d = app.somarDias(hoje(), -i);
      if (d < h.criadoEm) return false;
      if (marcadoNoDia(h, d)) return !conta1(situacao(h, d));
    }
    return false;
  }

  function horaDe(h) { return h.hora ? h.hora.replace(':', 'h') : ''; }
  function diasTexto(h) {
    if (h.dias.length === 7) return 'todo dia';
    if (h.dias.join() === UTEIS.join()) return 'de segunda a sexta';
    return h.dias.map(function (d) { return DIAS_NOME[d]; }).join(', ');
  }

  /* --- Desenhar ---------------------------------------------------------------------------- */

  function desenhar() {
    var tem = estado.habitos.length > 0;
    $('hb-vazio').hidden = tem;
    $('hb-painel').hidden = !tem;
    $('hb-graficos').hidden = !tem;
    desenharListaLembretes();
    desenharLembretes();
    mostrarGuardar();
    if (!tem) return;
    var dia = hoje();
    var deHoje = estado.habitos.filter(function (h) { return marcadoNoDia(h, dia); });
    var feitos = deHoje.filter(function (h) { return conta1(situacao(h, dia)); }).length;

    $('hb-data').textContent = app.dataLonga(dia);
    var anel = $('hb-anel');
    var volta = 2 * Math.PI * 52;
    anel.style.strokeDasharray = volta.toFixed(1);
    anel.style.strokeDashoffset = (volta * (1 - (deHoje.length ? feitos / deHoje.length : 0))).toFixed(1);
    $('hb-anel-texto').textContent = feitos + '/' + deHoje.length;
    $('hb-hoje-titulo').textContent = !deHoje.length ? 'Dia livre' : (feitos === deHoje.length ? 'Dia completo' : 'Hoje');
    var emRisco = deHoje.filter(function (h) { return !conta1(situacao(h, dia)) && falhouAntes(h); }).length;
    $('hb-frase').textContent = !deHoje.length
      ? 'Nenhum hábito marcado para hoje. Aproveite para descansar.'
      : (feitos === deHoje.length
        ? 'Tudo feito. Cada um foi um voto para quem você quer ser.'
        : (emRisco
          ? (emRisco === 1 ? 'Um hábito ficou para trás da última vez. Hoje é o dia que importa.' : emRisco + ' hábitos ficaram para trás da última vez. Hoje é o dia que importa.')
          : 'Falta ' + (deHoje.length - feitos) + '. Comece pelo mais fácil.'));

    var lista = $('hb-lista');
    lista.textContent = '';
    deHoje.forEach(function (h) { lista.appendChild(cartao(h)); });

    var outros = estado.habitos.filter(function (h) { return !marcadoNoDia(h, dia); });
    var caixaOutros = $('hb-outros');
    caixaOutros.textContent = '';
    outros.forEach(function (h) {
      var li = criar('li');
      var texto = criar('span', 'app-lista-texto', h.nome);
      texto.appendChild(criar('small', '', diasTexto(h) + (h.hora ? ', às ' + horaDe(h) : '')));
      li.appendChild(texto);
      li.appendChild(botaoEditar(h));
      caixaOutros.appendChild(li);
    });
    $('hb-outros-secao').hidden = !outros.length;
    desenharMapa();
    desenharNumeros();
  }

  function botaoEditar(h) {
    var b = criar('button', 'app-icone-botao plano');
    b.type = 'button';
    b.setAttribute('aria-label', 'Editar ' + h.nome);
    b.appendChild(app.icone('lapis'));
    b.addEventListener('click', function () { abrir(h); });
    return b;
  }

  function cartao(h) {
    var dia = hoje();
    var s = situacao(h, dia);
    var resgate = !conta1(s) && falhouAntes(h);
    var c = criar('article', 'hb-habito hb-cor-' + h.cor + (conta1(s) ? ' hb-cumprido' : '') + (s === 'pulado' ? ' hb-pulado' : '') + (resgate ? ' hb-resgate' : ''));
    c.dataset.id = h.id;
    var topo = criar('div', 'hb-habito-topo');
    var textos = criar('div', 'hb-habito-textos');
    textos.appendChild(criar('h3', 'hb-habito-nome', h.nome));
    var detalhe = [];
    if (h.ancora) detalhe.push('Depois de ' + h.ancora);
    if (h.hora) detalhe.push(horaDe(h));
    if (detalhe.length) textos.appendChild(criar('p', 'hb-habito-ancora', detalhe.join(' · ')));
    topo.appendChild(textos);
    topo.appendChild(botaoEditar(h));
    c.appendChild(topo);

    if (resgate) c.appendChild(criar('p', 'hb-resgate-texto', 'Ficou para trás da última vez. Não falhe duas vezes: hoje vale até o mínimo.'));
    if (h.minima) {
      var minima = criar('p', 'hb-minima');
      minima.appendChild(criar('span', '', '2 minutos'));
      minima.appendChild(document.createTextNode(h.minima));
      c.appendChild(minima);
    }

    var acoes = criar('div', 'hb-acoes');
    var feito = criar('button', 'hb-feito');
    feito.type = 'button';
    feito.setAttribute('aria-pressed', String(s === 'feito'));
    feito.appendChild(app.icone('check'));
    feito.appendChild(document.createTextNode(s === 'feito' ? 'Feito' : 'Fiz'));
    feito.addEventListener('click', function () { marcar(h, 'feito'); });
    acoes.appendChild(feito);
    if (h.minima) {
      var pouco = criar('button', 'hb-pouco', s === 'minimo' ? 'Fiz o mínimo' : 'Só o mínimo');
      pouco.type = 'button';
      pouco.setAttribute('aria-pressed', String(s === 'minimo'));
      pouco.addEventListener('click', function () { marcar(h, 'minimo'); });
      acoes.appendChild(pouco);
    }
    var pular = criar('button', 'hb-pular', 'Hoje não');
    pular.type = 'button';
    pular.setAttribute('aria-pressed', String(s === 'pulado'));
    pular.addEventListener('click', function () { marcar(h, 'pulado'); });
    acoes.appendChild(pular);
    c.appendChild(acoes);

    var rodape = criar('div', 'hb-rodape');
    var seq = sequencia(h);
    var chama = criar('span', 'hb-sequencia' + (seq ? '' : ' hb-sequencia-zero'));
    chama.appendChild(app.icone('chama'));
    chama.appendChild(document.createTextNode(seq ? seq + (seq === 1 ? ' dia seguido' : ' dias seguidos') : 'Comece a sequência'));
    rodape.appendChild(chama);
    rodape.appendChild(pontos(h));
    c.appendChild(rodape);
    return c;
  }

  // Os últimos 7 dias marcados do hábito, do mais antigo ao de hoje
  function pontos(h) {
    var caixa = criar('span', 'hb-pontos');
    var dias = [];
    for (var i = 0; i < 60 && dias.length < 7; i += 1) {
      var d = app.somarDias(hoje(), -i);
      if (d < h.criadoEm) break;
      if (marcadoNoDia(h, d)) dias.unshift(d);
    }
    var rotulo = [];
    dias.forEach(function (d) {
      var s = situacao(h, d);
      var classe = conta1(s) ? (s === 'minimo' ? 'hb-ponto-minimo' : 'hb-ponto-feito') : (d === hoje() ? 'hb-ponto-hoje' : 'hb-ponto-falta');
      caixa.appendChild(criar('i', classe));
      rotulo.push(app.dataCurta(d) + ': ' + (conta1(s) ? (s === 'minimo' ? 'mínimo' : 'feito') : (d === hoje() ? 'em aberto' : 'não feito')));
    });
    caixa.setAttribute('role', 'img');
    caixa.setAttribute('aria-label', 'Últimos dias: ' + rotulo.join(', '));
    return caixa;
  }

  function marcar(h, nova) {
    var dia = hoje();
    var antes = situacao(h, dia);
    var registro = estado.registros[dia] || (estado.registros[dia] = {});
    var depois = antes === nova ? '' : nova;
    if (depois) registro[h.id] = depois; else delete registro[h.id];
    if (!Object.keys(registro).length) delete estado.registros[dia];
    salvar();
    desenhar();
    var desfazer = function () {
      var r = estado.registros[dia] || (estado.registros[dia] = {});
      if (antes) r[h.id] = antes; else delete r[h.id];
      if (!Object.keys(r).length) delete estado.registros[dia];
      salvar();
      desenhar();
    };
    if (conta1(depois) && !conta1(antes)) {
      comemorar(h);
      var seq = sequencia(h);
      var frase = MARCOS[seq] || (depois === 'minimo'
        ? 'O mínimo também conta. O que importa é não quebrar a corrente.'
        : (h.identidade ? 'Mais um voto para ser alguém que ' + h.identidade + '.' : 'Feito. Mais um dia na conta.'));
      app.avisar(frase, desfazer);
    } else if (depois === 'pulado') {
      app.avisar('Tudo bem. A regra é uma só: amanhã não falhe de novo.', desfazer);
    }
  }

  function comemorar(h) {
    var c = document.querySelector('.hb-habito[data-id="' + h.id + '"]');
    if (!c) return;
    c.classList.add('hb-comemora');
    if (navigator.vibrate) navigator.vibrate(18);
    window.setTimeout(function () { c.classList.remove('hb-comemora'); }, 900);
  }

  // Mapa das últimas 12 semanas: cada quadrado é um dia, mais escuro quanto mais foi cumprido
  function desenharMapa() {
    var mapa = $('hb-mapa');
    mapa.textContent = '';
    var dia = hoje();
    var fimDaSemana = app.somarDias(dia, 6 - diaDaSemana(dia));
    var inicio = app.somarDias(fimDaSemana, -83);
    var completos = 0;
    var comHabito = 0;
    for (var i = 0; i < 84; i += 1) {
      var d = app.somarDias(inicio, i);
      var celula = criar('i');
      if (d > dia) { celula.className = 'hb-futuro'; mapa.appendChild(celula); continue; }
      var marcados = estado.habitos.filter(function (h) { return marcadoNoDia(h, d); });
      var feitos = marcados.filter(function (h) { return conta1(situacao(h, d)); }).length;
      var parte = marcados.length ? feitos / marcados.length : -1;
      celula.className = parte < 0 ? 'hb-sem' : (parte === 0 ? 'n0' : (parte < 0.5 ? 'n1' : (parte < 1 ? 'n2' : 'n3')));
      if (d === dia) celula.classList.add('hb-dia-hoje');
      celula.title = app.dataCurta(d) + (marcados.length ? ': ' + feitos + ' de ' + marcados.length : '');
      if (marcados.length && d !== dia) { comHabito += 1; if (parte === 1) completos += 1; }
      mapa.appendChild(celula);
    }
    mapa.setAttribute('aria-label', 'Nas últimas 12 semanas, ' + completos + ' de ' + comHabito + ' dias com todos os hábitos cumpridos.');
  }

  function desenharNumeros() {
    var lista = $('hb-numeros');
    lista.textContent = '';
    estado.habitos.forEach(function (h) {
      var li = criar('li');
      li.appendChild(criar('span', 'hb-bolinha hb-cor-' + h.cor));
      var texto = criar('span', 'app-lista-texto', h.nome);
      var t = taxa(h);
      texto.appendChild(criar('small', '', 'Sequência ' + sequencia(h) + ' · recorde ' + recorde(h) + (t === null ? '' : ' · ' + t + '% nos últimos 30 dias')));
      li.appendChild(texto);
      lista.appendChild(li);
    });
  }

  /* --- Criar e editar ---------------------------------------------------------------------- */

  function montarEscolhas() {
    var dias = $('hb-dias');
    DIAS.forEach(function (letra, i) {
      var r = criar('label');
      var c = document.createElement('input');
      c.type = 'checkbox';
      c.name = 'hb-dia';
      c.value = String(i);
      c.setAttribute('aria-label', DIAS_NOME[i]);
      r.appendChild(c);
      r.appendChild(criar('span', '', letra));
      dias.appendChild(r);
    });
    var cores = $('hb-cores');
    CORES.forEach(function (cor) {
      var r = criar('label', 'hb-cor-' + cor.id);
      var c = document.createElement('input');
      c.type = 'radio';
      c.name = 'hb-cor';
      c.value = cor.id;
      c.setAttribute('aria-label', cor.rotulo);
      r.appendChild(c);
      r.appendChild(criar('span'));
      cores.appendChild(r);
    });
    var modelos = $('hb-modelos');
    MODELOS.forEach(function (m) {
      var b = criar('button', 'gr-chip', m.nome);
      b.type = 'button';
      b.dataset.cat = m.cat;
      b.addEventListener('click', function () {
        preencher(m);
        modelos.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      modelos.appendChild(b);
    });
    var categorias = $('hb-categorias');
    CATEGORIAS.forEach(function (c) {
      var b = criar('button', 'hb-categoria', c.rotulo);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(c.id === ''));
      b.addEventListener('click', function () {
        categorias.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        modelos.querySelectorAll('button').forEach(function (x) { x.hidden = Boolean(c.id) && x.dataset.cat !== c.id; });
      });
      categorias.appendChild(b);
    });
    document.querySelectorAll('.hb-exemplos').forEach(function (caixa) {
      var alvo = caixa.getAttribute('data-alvo');
      (EXEMPLOS[alvo] || []).forEach(function (texto) {
        var b = criar('button', 'hb-exemplo', texto);
        b.type = 'button';
        b.addEventListener('click', function () { $(alvo).value = texto; $(alvo).focus(); });
        caixa.appendChild(b);
      });
    });
  }

  function preencher(h) {
    $('hb-nome').value = h.nome || '';
    $('hb-identidade').value = h.identidade || '';
    $('hb-minima').value = h.minima || '';
    $('hb-ancora').value = h.ancora || '';
    $('hb-hora').value = h.hora || '';
    $('hb-lembrete').checked = h.lembrete !== false;
    var dias = h.dias || TODOS;
    document.querySelectorAll('input[name="hb-dia"]').forEach(function (c) { c.checked = dias.indexOf(Number(c.value)) !== -1; });
    var cor = h.cor || 'bordo';
    document.querySelectorAll('input[name="hb-cor"]').forEach(function (c) { c.checked = c.value === cor; });
  }

  function abrir(h) {
    editando = h || null;
    ['hb-erro', 'hb-erro-nome', 'hb-erro-dias', 'hb-erro-hora'].forEach(function (id) { $(id).textContent = ''; });
    $('hb-modal-titulo').textContent = h ? 'Editar hábito' : 'Novo hábito';
    $('hb-salvar').textContent = h ? 'Salvar' : 'Criar hábito';
    $('hb-excluir').hidden = !h;
    $('hb-modelos-caixa').hidden = Boolean(h);
    $('hb-modelos').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    $('hb-modelos').querySelectorAll('button').forEach(function (x) { x.hidden = false; });
    $('hb-categorias').querySelectorAll('button').forEach(function (x, i) { x.setAttribute('aria-pressed', String(i === 0)); });
    document.querySelectorAll('.hb-porque').forEach(function (d) { d.open = false; });
    // Quem está começando vai melhor com poucos hábitos
    var dica = $('hb-dica');
    dica.hidden = Boolean(h) || estado.habitos.length < 3;
    dica.textContent = 'Você já tem ' + estado.habitos.length + ' hábitos. Quem está começando vai melhor com poucos: firme estes antes de somar outro.';
    preencher(h || { dias: TODOS, cor: CORES[estado.habitos.length % CORES.length].id, lembrete: true });
    $('hb-modal').showModal();
  }

  $('hb-form').addEventListener('submit', function (e) {
    e.preventDefault();
    ['hb-erro', 'hb-erro-nome', 'hb-erro-dias', 'hb-erro-hora'].forEach(function (id) { $(id).textContent = ''; });
    var nome = $('hb-nome').value.trim();
    var dias = Array.prototype.slice.call(document.querySelectorAll('input[name="hb-dia"]:checked')).map(function (c) { return Number(c.value); });
    var hora = $('hb-hora').value;
    var lembrete = $('hb-lembrete').checked;
    if (nome.length < 2) { $('hb-erro-nome').textContent = 'Dê um nome ao hábito.'; $('hb-nome').focus(); return; }
    if (!dias.length) { $('hb-erro-dias').textContent = 'Escolha pelo menos um dia.'; return; }
    if (lembrete && !hora) { $('hb-erro-hora').textContent = 'Escolha a hora do lembrete ou desmarque "Lembrar nessa hora".'; return; }
    if (!editando && estado.habitos.length >= MAXIMO) { $('hb-erro').textContent = 'Você chegou a ' + MAXIMO + ' hábitos. Apague um para criar outro.'; return; }
    var dados = {
      nome: nome.slice(0, 60),
      identidade: $('hb-identidade').value.trim().slice(0, 80),
      minima: $('hb-minima').value.trim().slice(0, 80),
      ancora: $('hb-ancora').value.trim().slice(0, 80),
      dias: dias,
      hora: hora,
      lembrete: Boolean(lembrete && hora),
      cor: (document.querySelector('input[name="hb-cor"]:checked') || {}).value || 'bordo'
    };
    var primeiro = !estado.habitos.length;
    if (editando) {
      Object.keys(dados).forEach(function (k) { editando[k] = dados[k]; });
    } else {
      dados.id = 'h_' + Date.now().toString(36);
      dados.criadoEm = hoje();
      estado.habitos.push(dados);
    }
    salvar();
    $('hb-modal').close();
    desenhar();
    if (!editando) {
      app.avisar(primeiro && !estado.avisos && dados.lembrete
        ? 'Hábito criado. Ative os lembretes abaixo para ele chamar você na hora.'
        : 'Hábito criado. Comece hoje mesmo, nem que seja o mínimo.');
    }
  });

  $('hb-excluir').addEventListener('click', function () {
    var h = editando;
    if (!h || !window.confirm('Apagar “' + h.nome + '” e o histórico dele? Não dá para desfazer.')) return;
    estado.habitos = estado.habitos.filter(function (x) { return x.id !== h.id; });
    Object.keys(estado.registros).forEach(function (d) {
      delete estado.registros[d][h.id];
      if (!Object.keys(estado.registros[d]).length) delete estado.registros[d];
    });
    salvar();
    $('hb-modal').close();
    desenhar();
  });

  $('hb-fechar').addEventListener('click', function () { $('hb-modal').close(); });
  $('hb-novo').addEventListener('click', function () { abrir(null); });
  $('hb-primeiro').addEventListener('click', function () { abrir(null); });

  /* --- Lembretes simples ------------------------------------------------------------------- */

  var lembreteEditando = null;
  var DIAS_LONGOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  function novoId(prefixo) { return prefixo + Math.random().toString(36).slice(2, 10); }

  // Quando o lembrete toca de novo, em texto: "Hoje às 14h", "Todo dia às 8h", "Seg, qua às 9h"
  function quandoDoLembrete(l) {
    var hora = l.hora.replace(':', 'h');
    if (l.repetir === 'diario') return 'Todo dia às ' + hora;
    if (l.repetir === 'dias') {
      var nomes = l.dias.map(function (d) { return DIAS_NOME[d]; }).join(', ');
      return nomes.charAt(0).toUpperCase() + nomes.slice(1) + ' às ' + hora;
    }
    var amanha = app.somarDias(hoje(), 1);
    if (l.data === hoje()) return 'Hoje às ' + hora;
    if (l.data === amanha) return 'Amanhã às ' + hora;
    return app.dataCurta(l.data) + ' às ' + hora;
  }

  function lembretePassou(l) {
    if (l.repetir !== 'uma') return false;
    var agora = new Date();
    var horaAgora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    return l.data < hoje() || (l.data === hoje() && l.hora < horaAgora);
  }

  function ordemDoLembrete(l) {
    if (lembretePassou(l)) return '9' + l.data + l.hora;
    return (l.repetir === 'uma' ? '1' + l.data : '0') + l.hora;
  }

  function desenharListaLembretes() {
    // Os de uma vez só que passaram há mais de uma semana saem sozinhos
    var limite = app.somarDias(hoje(), -7);
    var antes = estado.lembretes.length;
    estado.lembretes = estado.lembretes.filter(function (l) { return l.repetir !== 'uma' || l.data >= limite; });
    if (estado.lembretes.length !== antes) salvar();
    var lista = $('lb-lista');
    lista.textContent = '';
    estado.lembretes.slice().sort(function (a, b) { return ordemDoLembrete(a) < ordemDoLembrete(b) ? -1 : 1; }).forEach(function (l) {
      var passou = lembretePassou(l);
      var li = criar('li', 'lb-item' + (passou ? ' lb-passou' : ''));
      var abrirBotao = criar('button', 'lb-abrir');
      abrirBotao.type = 'button';
      abrirBotao.setAttribute('aria-label', 'Editar o lembrete: ' + l.texto);
      var icone = criar('span', 'lb-icone');
      icone.setAttribute('aria-hidden', 'true');
      icone.appendChild(app.icone(passou ? 'check' : 'sino'));
      abrirBotao.appendChild(icone);
      var textos = criar('span', 'lb-textos');
      textos.appendChild(criar('strong', '', l.texto));
      textos.appendChild(criar('small', '', passou ? 'Já passou · ' + quandoDoLembrete(l) : quandoDoLembrete(l)));
      abrirBotao.appendChild(textos);
      abrirBotao.addEventListener('click', function () { abrirLembrete(l); });
      li.appendChild(abrirBotao);
      var apagar = criar('button', 'app-icone-botao plano');
      apagar.type = 'button';
      apagar.setAttribute('aria-label', 'Apagar o lembrete: ' + l.texto);
      apagar.appendChild(app.icone('lixeira'));
      apagar.addEventListener('click', function () { apagarLembrete(l); });
      li.appendChild(apagar);
      lista.appendChild(li);
    });
    $('lb-vazio').hidden = estado.lembretes.length > 0;
  }

  function montarDiasDoLembrete() {
    var dias = $('lb-dias');
    DIAS.forEach(function (letra, i) {
      var r = criar('label');
      var c = document.createElement('input');
      c.type = 'checkbox';
      c.name = 'lb-dia';
      c.value = String(i);
      c.setAttribute('aria-label', DIAS_LONGOS[i]);
      r.appendChild(c);
      r.appendChild(criar('span', '', letra));
      dias.appendChild(r);
    });
    document.querySelectorAll('input[name="lb-repetir"]').forEach(function (r) {
      r.addEventListener('change', mostrarCamposDoLembrete);
    });
  }

  function repetirEscolhido() {
    var r = document.querySelector('input[name="lb-repetir"]:checked');
    return r ? r.value : 'uma';
  }

  function mostrarCamposDoLembrete() {
    var repetir = repetirEscolhido();
    $('lb-campo-data').hidden = repetir !== 'uma';
    $('lb-campo-dias').hidden = repetir !== 'dias';
  }

  function abrirLembrete(l) {
    lembreteEditando = l || null;
    ['lb-erro', 'lb-erro-texto'].forEach(function (id) { $(id).textContent = ''; });
    $('lb-modal-titulo').textContent = l ? 'Editar lembrete' : 'Novo lembrete';
    $('lb-salvar').textContent = l ? 'Salvar' : 'Criar lembrete';
    $('lb-excluir').hidden = !l;
    $('lb-texto').value = l ? l.texto : '';
    var daquiAPouco = new Date(Date.now() + 60 * 60 * 1000);
    $('lb-hora').value = l ? l.hora : String(daquiAPouco.getHours()).padStart(2, '0') + ':00';
    // Daqui a uma hora pode já ser amanhã
    $('lb-data').value = l && l.data ? l.data : (daquiAPouco.getDate() !== new Date().getDate() ? app.somarDias(hoje(), 1) : hoje());
    $('lb-data').min = hoje();
    var repetir = l ? l.repetir : 'uma';
    document.querySelectorAll('input[name="lb-repetir"]').forEach(function (r) { r.checked = r.value === repetir; });
    var dias = l && l.dias && l.dias.length ? l.dias : UTEIS;
    document.querySelectorAll('input[name="lb-dia"]').forEach(function (c) { c.checked = dias.indexOf(Number(c.value)) !== -1; });
    mostrarCamposDoLembrete();
    $('lb-modal').showModal();
    $('lb-texto').focus();
  }

  function apagarLembrete(l) {
    var copia = estado.lembretes.slice();
    estado.lembretes = estado.lembretes.filter(function (x) { return x.id !== l.id; });
    salvar();
    desenharListaLembretes();
    app.avisar('Lembrete apagado.', function () {
      estado.lembretes = copia;
      salvar();
      desenharListaLembretes();
    });
  }

  $('lb-form').addEventListener('submit', function (e) {
    e.preventDefault();
    ['lb-erro', 'lb-erro-texto'].forEach(function (id) { $(id).textContent = ''; });
    var texto = $('lb-texto').value.trim();
    var hora = $('lb-hora').value;
    var repetir = repetirEscolhido();
    var data = $('lb-data').value;
    var dias = Array.prototype.slice.call(document.querySelectorAll('input[name="lb-dia"]:checked')).map(function (c) { return Number(c.value); });
    if (texto.length < 2) { $('lb-erro-texto').textContent = 'Escreva do que você quer ser lembrado.'; $('lb-texto').focus(); return; }
    if (!/^\d{2}:\d{2}$/.test(hora)) { $('lb-erro').textContent = 'Escolha a hora.'; return; }
    if (repetir === 'uma' && (!data || data < hoje())) { $('lb-erro').textContent = 'Escolha um dia a partir de hoje.'; return; }
    if (repetir === 'dias' && !dias.length) { $('lb-erro').textContent = 'Escolha pelo menos um dia da semana.'; return; }
    if (!lembreteEditando && estado.lembretes.length >= MAXIMO_LEMBRETES) { $('lb-erro').textContent = 'Você chegou a ' + MAXIMO_LEMBRETES + ' lembretes. Apague algum que já passou.'; return; }
    var dados = { texto: texto, hora: hora, repetir: repetir, data: repetir === 'uma' ? data : '', dias: repetir === 'dias' ? dias : [] };
    var primeiro = !estado.lembretes.length;
    if (lembreteEditando) {
      Object.keys(dados).forEach(function (k) { lembreteEditando[k] = dados[k]; });
    } else {
      dados.id = novoId('l_');
      dados.criadoEm = hoje();
      estado.lembretes.push(dados);
    }
    // Lembrete editado volta a tocar hoje, se a hora ainda não passou
    try { sessionStorage.removeItem('lb-avisado-' + (lembreteEditando ? lembreteEditando.id : dados.id) + '-' + hoje()); } catch (erro) { /* sem sessionStorage */ }
    $('lb-modal').close();
    salvar();
    desenharListaLembretes();
    inscricaoAtual().then(function (inscricao) {
      if (inscricao && estado.avisos) { app.avisar(lembreteEditando ? 'Lembrete salvo.' : 'Lembrete criado. Ele chega na hora, mesmo com o site fechado.'); return; }
      app.avisar(primeiro ? 'Lembrete criado. Para ele chegar com o site fechado, ative as notificações logo abaixo.' : 'Lembrete salvo.');
      if (primeiro) $('hb-lembretes-titulo').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  $('lb-excluir').addEventListener('click', function () {
    var l = lembreteEditando;
    $('lb-modal').close();
    if (l) apagarLembrete(l);
  });
  $('lb-fechar').addEventListener('click', function () { $('lb-modal').close(); });
  $('lb-novo').addEventListener('click', function () { abrirLembrete(null); });

  /* --- Notificações ------------------------------------------------------------------------ */

  function temPush() { return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext; }
  function ehIPhone() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function naTelaDeInicio() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

  function inscricaoAtual() {
    if (!temPush()) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration('/').then(function (reg) {
      return reg ? reg.pushManager.getSubscription() : null;
    }).catch(function () { return null; });
  }

  function chaveEmBytes(texto) {
    var b = (texto + '='.repeat((4 - texto.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var bruto = window.atob(b);
    var bytes = new Uint8Array(bruto.length);
    for (var i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
    return bytes;
  }

  function botaoLembrete(texto, classe, acao) {
    var b = criar('button', classe, texto);
    b.type = 'button';
    b.addEventListener('click', function () {
      b.disabled = true;
      Promise.resolve(acao()).then(function () { b.disabled = false; }, function () { b.disabled = false; });
    });
    return b;
  }

  function desenharLembretes() {
    var estadoTexto = $('hb-lembretes-estado');
    var texto = $('hb-lembretes-texto');
    var botoes = $('hb-lembretes-botoes');
    botoes.textContent = '';
    var semHora = !estado.habitos.some(function (h) { return h.lembrete && h.hora; }) && !estado.lembretes.length;

    if (ehIPhone() && !naTelaDeInicio()) {
      estadoTexto.textContent = 'No iPhone, primeiro coloque o Rauber na Tela de Início';
      texto.textContent = 'O iPhone só entrega notificações de sites que estão na Tela de Início. No Safari, toque em Compartilhar e em “Adicionar à Tela de Início”. Depois abra o Rauber pelo ícone, entre na conta e ative aqui. A partir daí, chega igual a um aplicativo, mesmo com tudo fechado.';
      return;
    }
    if (!temPush()) {
      estadoTexto.textContent = 'Este navegador não recebe lembretes com o site fechado';
      texto.textContent = 'Enquanto o app estiver aberto, ele avisa na hora de cada hábito. Para receber com o navegador fechado, use o Chrome, o Edge, o Firefox ou o Safari atualizados.';
      return;
    }
    if (Notification.permission === 'denied') {
      estadoTexto.textContent = 'Os avisos estão bloqueados para este site';
      texto.textContent = 'Libere nas configurações do navegador: toque no cadeado ao lado do endereço, em Permissões, e ative Notificações. Depois volte aqui.';
      return;
    }
    inscricaoAtual().then(function (inscricao) {
      if (inscricao && estado.avisos) {
        // Inscrições antigas não mandavam as chaves: manda de novo, em silêncio
        atualizarInscricao(inscricao);
        estadoTexto.textContent = 'Notificações ligadas neste aparelho';
        texto.textContent = semHora
          ? 'Nada com hora marcada ainda. Crie um lembrete ou escolha a hora de um hábito para ele chamar você.'
          : 'Chegam na hora, mesmo com o site e o navegador fechados. Às 20h, se algum hábito ficou para trás dois dias seguidos, vem o aviso do resgate.';
        botoes.appendChild(botaoLembrete('Testar com o site fechado', 'botao', testarFechado));
        botoes.appendChild(botaoLembrete('Desligar neste aparelho', 'texto-botao', desligar));
      } else {
        estadoTexto.textContent = 'Receba um aviso na hora certa';
        texto.textContent = 'Dos seus hábitos e lembretes, mesmo com o site fechado. É o que mais ajuda quem esquece.';
        botoes.appendChild(botaoLembrete('Ativar notificações', 'botao botao-cheio', ativar));
      }
    });
  }

  function ativar() {
    if (!conta.logado) { api.irParaLogin('apps/habitos/'); return null; }
    if (!estado.guardarNaConta) {
      var ok = window.confirm('Para os lembretes chegarem com o navegador fechado, os seus hábitos e horários ficam guardados na sua conta, visíveis só para você. Autorizar?');
      if (!ok) return null;
      estado.guardarNaConta = true;
    }
    estado.avisos = true;
    return Notification.requestPermission().then(function (permissao) {
      if (permissao !== 'granted') {
        estado.avisos = false;
        salvar();
        desenharLembretes();
        app.avisar('Sem permissão, o navegador não deixa avisar. Dá para liberar depois nas configurações.');
        return null;
      }
      return salvar(true).then(function () {
        return navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }).then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
        return api.get(PUSH + 'chave').then(function (r) {
          if (!r.ok) throw new Error(r.erro || 'sem chave');
          return reg.pushManager.getSubscription().then(function (atual) {
            return atual || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(r.dados.chave) });
          });
        });
      }).then(function (inscricao) {
        return api.post(PUSH + 'inscrever', dadosDaInscricao(inscricao));
      }).then(function (r) {
        if (!r.ok) throw new Error(r.erro || 'sem inscrição');
        try { sessionStorage.setItem('hb-inscricao-enviada', '1'); } catch (erro) { /* sem sessionStorage */ }
        desenharLembretes();
        app.avisar('Notificações ligadas. Toque em “Testar com o site fechado” para ver como chegam.');
      }).catch(function (erro) {
        desenharLembretes();
        app.avisar('Não foi possível ligar os lembretes agora. ' + (erro && erro.message && erro.message.length < 120 ? erro.message : 'Tente de novo.'));
      });
    });
  }

  function desligar() {
    return inscricaoAtual().then(function (inscricao) {
      if (!inscricao) return null;
      var endereco = inscricao.endpoint;
      return inscricao.unsubscribe().then(function () { return api.post(PUSH + 'cancelar', { endpoint: endereco }); });
    }).then(function () {
      desenharLembretes();
      app.avisar('Lembretes desligados neste aparelho.');
    });
  }

  function dadosDaInscricao(inscricao) {
    var json = inscricao && inscricao.toJSON ? inscricao.toJSON() : {};
    return { endpoint: inscricao.endpoint, keys: json.keys || {} };
  }

  function atualizarInscricao(inscricao) {
    try { if (sessionStorage.getItem('hb-inscricao-enviada')) return; sessionStorage.setItem('hb-inscricao-enviada', '1'); } catch (erro) { /* sem sessionStorage */ }
    if (conta.logado) api.post(PUSH + 'inscrever', dadosDaInscricao(inscricao));
  }

  // Manda o teste daqui a 20 segundos: dá tempo de fechar o site e ver chegar
  function testarFechado() {
    return api.post(PUSH + 'testar', { atraso: 20 }).then(function (r) {
      app.avisar(r.ok ? 'Pronto. Feche o site agora: em uns 20 segundos chega a notificação.' : (r.erro || 'Não foi possível enviar agora.'));
    });
  }

  function avisarNaPagina(titulo, texto, tag) {
    if ('Notification' in window && Notification.permission === 'granted' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/').then(function (reg) {
        if (reg) reg.showNotification(titulo, { body: texto, icon: '/assets/img/icone-192.png', tag: tag, data: { url: '/apps/habitos/' } });
        else app.avisar(titulo + ': ' + texto);
      });
    } else {
      app.avisar(titulo + ': ' + texto);
    }
  }

  // Com a página aberta, o próprio app avisa na hora (útil onde não há Web Push)
  function conferirAgora() {
    var agora = new Date();
    var hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    var dia = hoje();
    var semana = agora.getDay();
    estado.lembretes.forEach(function (l) {
      if (l.hora !== hora) return;
      var vale = (l.repetir === 'uma' && l.data === dia) || l.repetir === 'diario' || (l.repetir === 'dias' && l.dias.indexOf(semana) !== -1);
      if (!vale) return;
      var chave = 'lb-avisado-' + l.id + '-' + dia;
      try { if (sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, '1'); } catch (e) { /* sem sessionStorage */ }
      avisarNaPagina(l.texto, 'Lembrete das ' + l.hora.replace(':', 'h') + '.', 'lembrete-' + l.id);
      if (l.repetir === 'uma') desenharListaLembretes();
    });
    estado.habitos.forEach(function (h) {
      if (!h.lembrete || h.hora !== hora || !marcadoNoDia(h, dia) || conta1(situacao(h, dia))) return;
      var chave = 'hb-avisado-' + h.id + '-' + dia;
      try { if (sessionStorage.getItem(chave)) return; sessionStorage.setItem(chave, '1'); } catch (e) { /* sem sessionStorage */ }
      var texto = h.minima ? 'Comece pelo mínimo: ' + h.minima + '.' : 'É hora. Comece pequeno, mas comece.';
      avisarNaPagina(h.nome, texto, 'habitos-' + h.nome);
    });
  }

  /* --- Conta ------------------------------------------------------------------------------- */

  function mostrarGuardar() {
    var caixa = $('hb-guardar');
    caixa.disabled = !conta.logado;
    caixa.checked = Boolean(conta.logado && estado.guardarNaConta);
    $('hb-guardar-texto').textContent = !conta.logado
      ? 'Entre na sua conta para guardar os hábitos e abrir em qualquer aparelho.'
      : (estado.guardarNaConta
        ? 'Seus hábitos ficam neste aparelho e na sua conta, visíveis só para você. É o que permite os lembretes com o navegador fechado.'
        : 'Ao ligar, você autoriza guardar os hábitos e o histórico na sua conta, visíveis só para você. Dá para desligar e apagar quando quiser.');
  }

  $('hb-guardar').addEventListener('change', function () {
    if ($('hb-guardar').checked) {
      estado.guardarNaConta = true;
      salvar(true);
      app.avisar('Pronto: os hábitos vão ficar salvos na sua conta.');
      mostrarGuardar();
      return;
    }
    if (!window.confirm('Apagar os hábitos e lembretes da sua conta? Eles continuam neste aparelho, e as notificações com o site fechado param.')) {
      $('hb-guardar').checked = true;
      return;
    }
    estado.guardarNaConta = false;
    estado.avisos = false;
    salvar();
    api.post(ENDERECO + '&acao=apagar').then(function (r) {
      if (r.ok) { conta.temNaConta = false; app.avisar('Apagado da sua conta. Continua neste aparelho.'); }
    });
    desligar();
    mostrarGuardar();
  });

  $('hb-apagar').addEventListener('click', function () {
    var naConta = conta.logado && conta.temNaConta;
    if (!window.confirm(naConta ? 'Apagar todos os hábitos, lembretes e o histórico deste aparelho e da sua conta? Não dá para desfazer.' : 'Apagar todos os hábitos, lembretes e o histórico deste aparelho?')) return;
    function limpar() {
      try { localStorage.removeItem(CHAVE); } catch (e) { /* nada guardado */ }
      location.reload();
    }
    desligar().then(function () {
      if (!naConta) { limpar(); return; }
      api.post(ENDERECO + '&acao=apagar').then(function (r) {
        if (!r.ok) { app.avisar(r.erro || 'Não foi possível apagar da conta agora.'); return; }
        limpar();
      });
    });
  });

  /* --- Começo ------------------------------------------------------------------------------ */

  montarEscolhas();
  montarDiasDoLembrete();
  desenhar();
  window.setInterval(conferirAgora, 30000);
  // Virou o dia com a página aberta: redesenha
  var diaAberto = hoje();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && hoje() !== diaAberto) { diaAberto = hoje(); desenhar(); }
  });

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
        desenhar();
        app.avisar('Trouxemos seus hábitos da sua conta.');
      } else if (daConta) {
        estado.guardarNaConta = true;
        salvar();
      }
      mostrarGuardar();
    });
  });
})();
