/* Ocasiões: eventos com data, o traje explicado, o look montado com o guarda-roupa,
   o prazo para encomendar a peça sob medida e a mala das viagens.
   Sem conta, fica neste aparelho. Com conta, também na conta. */
(function () {
  'use strict';

  var app = window.AR_APP;
  var api = app.api;
  var OC = window.AR_OC;
  var GR = window.AR_GR;
  var LOOKS = window.AR_LOOKS;
  var criar = app.criar;
  var CHAVE = 'ar-ocasioes-v1';
  var ENDERECO = 'api/apps.php?app=ocasioes';
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  var estado = completar(app.lerLocal(CHAVE));
  var conta = { logado: false, emailVerificado: false };
  var guarda = { pecas: null, decisoes: {}, carregando: false };
  var climas = {};
  var aberto = null;
  var editando = null;

  function $(id) { return document.getElementById(id); }

  function completar(e) {
    if (!e || typeof e !== 'object' || !Array.isArray(e.eventos)) e = { eventos: [], lembretes: false, alteradoEm: 0 };
    e.eventos = e.eventos.filter(function (x) { return x && x.id && x.data; });
    e.eventos.forEach(function (x) {
      if (!Array.isArray(x.atividades)) x.atividades = [];
      if (!x.mala || typeof x.mala !== 'object' || Array.isArray(x.mala)) x.mala = {};
      if (!Array.isArray(x.look)) x.look = [];
    });
    if (typeof e.lembretes !== 'boolean') e.lembretes = false;
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

  function dataCompleta(iso) {
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  function nomeDoEvento(e) {
    return e.nome || OC.porTipo[e.tipo].rotulo;
  }

  /* --- Guardar ------------------------------------------------------------------- */

  var agendado = null;

  function salvar() {
    estado.alteradoEm = Date.now();
    app.gravarLocal(CHAVE, estado);
    if (!conta.logado) return;
    window.clearTimeout(agendado);
    $('oc-situacao').textContent = 'Salvando na sua conta...';
    agendado = window.setTimeout(function () {
      api.post(ENDERECO + '&acao=salvar', { dados: estado }).then(function (r) {
        if (r.ok) $('oc-situacao').textContent = 'Salvo na sua conta.';
        else if (r.status === 401) { conta.logado = false; $('oc-situacao').textContent = 'Você saiu da conta. Os eventos ficam neste aparelho.'; }
        else $('oc-situacao').textContent = (r.erro || 'Não foi possível salvar na conta agora.') + ' Os eventos ficam neste aparelho.';
      });
    }, 900);
  }

  /* --- O que cada evento pede ------------------------------------------------------- */

  function trajeDo(e) {
    if (e.tipo === 'viagem') return null;
    if (e.traje && e.traje !== 'nao_informado') return { traje: OC.porTraje[e.traje], inferido: false };
    var tipo = OC.porTipo[e.tipo] || OC.porTipo.outro;
    return { traje: OC.porTraje[tipo.traje[e.periodo] || 'passeio'], inferido: true };
  }

  function climaDo(e, data) {
    var chave = e.id + '|' + (data || e.data);
    if (climas[chave]) return climas[chave];
    return { categoria: OC.climaProvavel(e.uf, data || e.data, e.periodo), estimado: true };
  }

  // Busca a previsão de verdade quando a data está a até 9 dias e a cidade foi informada
  function buscarClima(e, data, aoChegar) {
    var dia = data || e.data;
    var chave = e.id + '|' + dia;
    var faltam = app.diasAte(dia);
    if (climas[chave] || !e.cidade || faltam < 0 || faltam > 9) return;
    api.get('api/clima.php?cidade=' + encodeURIComponent(e.cidade) + '&uf=' + encodeURIComponent(e.uf || '') + '&data=' + dia).then(function (r) {
      if (!r.ok) return;
      climas[chave] = r.dados;
      aoChegar();
    });
  }

  function grupoDe(p) { return GR.porTipo[p.tipo] ? GR.porTipo[p.tipo].grupo : ''; }
  function tem(lista, tipos) { return lista.some(function (p) { return tipos.indexOf(p.tipo) !== -1; }); }
  var ESCURAS = ['preto', 'grafite', 'azul_marinho', 'cinza', 'marrom'];

  function cumpre(look, exige, trajeId) {
    var p = look.pecas;
    return exige.every(function (regra) {
      if (regra === 'conjunto') {
        var terno = p.filter(function (x) { return x.tipo === 'terno'; })[0];
        if (terno) return trajeId === 'black_tie' ? ['preto', 'azul_marinho'].indexOf(terno.cor) !== -1 : ESCURAS.indexOf(terno.cor) !== -1;
        return tem(p, ['blazer']) && tem(p, ['calca']);
      }
      if (regra === 'gravata') return tem(p, ['gravata']);
      if (regra === 'sapato_social') return tem(p, ['sapato']);
      if (regra === 'camada_arrumada') return tem(p, ['blazer', 'terno', 'colete', 'sobretudo']);
      if (regra === 'calcado_arrumado') return tem(p, ['sapato', 'mocassim', 'bota']);
      if (regra === 'sem_esportivo') return !p.some(function (x) { return x.formalidade === 'esportivo' || x.tipo === 'regata'; });
      return true;
    });
  }

  // O que falta no guarda-roupa para o traje, separando o que a marca faz sob medida
  function oQueFalta(traje, pecas) {
    var falta = [];
    var ternoEscuro = pecas.some(function (p) {
      return p.tipo === 'terno' && (traje.id === 'black_tie' ? ['preto', 'azul_marinho'] : ESCURAS).indexOf(p.cor) !== -1;
    });
    var exige = traje.exige;
    if (exige.indexOf('conjunto') !== -1 && !ternoEscuro && !(tem(pecas, ['blazer']) && tem(pecas, ['calca']))) {
      falta.push({ id: traje.principal, sobMedida: true });
    }
    if (exige.indexOf('camada_arrumada') !== -1 && !tem(pecas, ['blazer', 'terno', 'colete', 'sobretudo'])) {
      falta.push({ id: 'blazer', sobMedida: true });
    }
    if ((traje.id === 'social' || traje.id === 'black_tie' || traje.id === 'esporte_fino' || traje.id === 'passeio') && !tem(pecas, ['camisa'])) {
      falta.push({ id: 'camisa', sobMedida: true });
    }
    if ((traje.id === 'esporte_fino' || traje.id === 'passeio') && !tem(pecas, ['calca', 'calca_sarja', 'terno'])) {
      falta.push({ id: 'calca', sobMedida: true });
    }
    if (exige.indexOf('gravata') !== -1 && !tem(pecas, ['gravata'])) falta.push({ id: 'gravata', rotulo: traje.id === 'black_tie' ? 'gravata-borboleta' : 'gravata' });
    if (exige.indexOf('sapato_social') !== -1 && !tem(pecas, ['sapato'])) falta.push({ id: 'sapato', rotulo: 'sapato social' });
    if (exige.indexOf('calcado_arrumado') !== -1 && !tem(pecas, ['sapato', 'mocassim', 'bota'])) falta.push({ id: 'mocassim', rotulo: 'mocassim ou sapato' });
    return falta;
  }

  function rotuloDaFalta(f) {
    return f.sobMedida ? OC.SOB_MEDIDA[f.id].rotulo : f.rotulo;
  }

  // Formalidade do look com todas as peças, inclusive a gravata e os sapatos
  function nivelDoLook(pecas) {
    var soma = 0;
    pecas.forEach(function (p) { var f = GR.porFormalidade[p.formalidade]; soma += f ? f.nivel : 1; });
    return pecas.length ? soma / pecas.length : 0;
  }

  function looksPara(e, traje, clima) {
    var pecas = guarda.pecas || [];
    if (!pecas.length) return [];
    var gravatas = pecas.filter(function (p) { return p.tipo === 'gravata'; });
    var candidatos = LOOKS.sugerir(pecas, { clima: clima === 'variado' ? '' : clima }, guarda.decisoes);
    var saida = [];
    for (var i = 0; i < candidatos.length && saida.length < 3; i += 1) {
      var c = candidatos[i];
      var look = { chave: c.chave, pecas: c.pecas.slice(), motivos: c.motivos, nivel: c.nivel };
      // O motor só põe gravata em parte dos looks: o traje pode pedir
      if (traje.exige.indexOf('gravata') !== -1 && !tem(look.pecas, ['gravata']) && gravatas.length && tem(look.pecas, ['camisa'])) {
        look.pecas.push(gravatas[0]);
      }
      look.nivel = nivelDoLook(look.pecas);
      if (traje.id === 'praia' && tem(look.pecas, ['terno'])) continue;
      if (look.nivel < traje.min - 0.05 || look.nivel > traje.max + 0.05) continue;
      if (!cumpre(look, traje.exige, traje.id)) continue;
      saida.push(look);
    }
    return saida;
  }

  function analisar(e) {
    var r = { traje: null, inferido: false, clima: null, looks: [], falta: [], recomendado: null, encomendarAte: '', escolhido: null };
    if (e.tipo === 'viagem') return r;
    var t = trajeDo(e);
    r.traje = t.traje;
    r.inferido = t.inferido;
    r.clima = climaDo(e);
    var pecas = guarda.pecas;
    if (pecas) {
      var porId = {};
      pecas.forEach(function (p) { porId[p.id] = p; });
      if (e.look.length && e.look.every(function (id) { return porId[id]; })) {
        r.escolhido = { pecas: e.look.map(function (id) { return porId[id]; }) };
      }
      r.looks = looksPara(e, r.traje, r.clima.categoria);
      if (!r.looks.length && !r.escolhido) r.falta = oQueFalta(r.traje, pecas);
    }
    var papel = OC.porPapel[e.papel] || OC.porPapel.convidado;
    var sobMedida = r.falta.filter(function (f) { return f.sobMedida; });
    // Padrinho e noivo recebem a sugestão de fazer sob medida, até escolherem um look
    if (!sobMedida.length && !r.escolhido && papel.sobMedida && r.traje.principal && OC.SOB_MEDIDA[r.traje.principal]) {
      r.recomendado = { id: r.traje.principal, sobMedida: true };
      sobMedida = [r.recomendado];
    }
    if (sobMedida.length) {
      var maior = Math.max.apply(null, sobMedida.map(function (f) { return OC.SOB_MEDIDA[f.id].dias; }));
      r.encomendarAte = app.somarDias(e.data, -(maior + OC.FOLGA + (papel.folgaExtra || 0)));
    }
    return r;
  }

  // Guarda no evento o que o início dos apps e os e-mails usam
  function atualizarResumo(e, r) {
    if (e.tipo === 'viagem') return false;
    var situacao = r.escolhido ? 'pronto' : (guarda.pecas ? (r.falta.length ? 'falta' : '') : e.situacao || '');
    var mudou = e.situacao !== situacao || e.encomendarAte !== r.encomendarAte;
    e.situacao = situacao;
    e.encomendarAte = r.encomendarAte;
    return mudou;
  }

  /* --- Lista ---------------------------------------------------------------------------- */

  function cartaoDoEvento(e) {
    var b = criar('button', 'oc-evento' + (app.diasAte(e.data) < 0 ? ' oc-evento-passado' : ''));
    b.type = 'button';
    var d = app.paraData(e.data);
    var data = criar('span', 'oc-data');
    data.appendChild(criar('b', '', String(d.getDate())));
    data.appendChild(criar('span', '', MESES_CURTOS[d.getMonth()]));
    b.appendChild(data);
    var texto = criar('span');
    texto.appendChild(criar('span', 'oc-evento-titulo', nomeDoEvento(e)));
    var faltam = app.diasAte(e.data);
    var info = (faltam >= 0 ? app.textoDias(faltam).replace(/^./, function (l) { return l.toUpperCase(); }) : 'Foi em ' + dataCompleta(e.data));
    if (e.tipo === 'viagem' && e.volta) info += ' · ' + (app.diasAte(e.volta, e.data) + 1) + ' dias';
    texto.appendChild(criar('span', 'oc-evento-info', info));
    var chips = criar('span', 'app-chips');
    if (e.tipo === 'viagem') {
      chips.appendChild(criar('span', 'app-chip', 'Viagem'));
    } else {
      var t = trajeDo(e);
      chips.appendChild(criar('span', 'app-chip', t.traje.curto));
      if (e.situacao === 'pronto') chips.appendChild(criar('span', 'app-chip app-chip-verde', 'Look pronto'));
      else if (e.situacao === 'falta') chips.appendChild(criar('span', 'app-chip app-chip-alerta', 'Falta peça'));
      if (e.encomendarAte && !e.encomendado && faltam >= 0) {
        var ate = app.diasAte(e.encomendarAte);
        chips.appendChild(criar('span', 'app-chip app-chip-bordo', ate >= 0 ? 'Encomendar até ' + app.dataCurta(e.encomendarAte) : 'Prazo apertado'));
      }
    }
    texto.appendChild(chips);
    b.appendChild(texto);
    b.addEventListener('click', function () { abrirDetalhe(e.id, true); });
    return b;
  }

  function desenharLista() {
    var hoje = app.hojeISO();
    var ordenados = estado.eventos.slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    var proximos = ordenados.filter(function (e) { return (e.volta || e.data) >= hoje; });
    var passados = ordenados.filter(function (e) { return (e.volta || e.data) < hoje; }).reverse();
    $('oc-proximos').textContent = '';
    proximos.forEach(function (e) { $('oc-proximos').appendChild(cartaoDoEvento(e)); });
    $('oc-passados').textContent = '';
    passados.forEach(function (e) { $('oc-passados').appendChild(cartaoDoEvento(e)); });
    $('oc-proximos-secao').hidden = !proximos.length;
    $('oc-passados-secao').hidden = !passados.length;
    $('oc-vazio').hidden = estado.eventos.length > 0;
    mostrarLembretes();
  }

  /* --- Um evento -------------------------------------------------------------------------- */

  function cartao(titulo, classe) {
    var c = criar('section', 'app-cartao' + (classe ? ' ' + classe : ''));
    if (titulo) c.appendChild(criar('h2', 'oc-subtitulo', titulo));
    return c;
  }

  function lista(itens, classe) {
    var ul = criar('ul', classe || 'oc-lista-simples');
    itens.forEach(function (i) { ul.appendChild(criar('li', '', i)); });
    return ul;
  }

  function fotoDaPeca(p) {
    var item = criar('div');
    var fig = criar('div', 'gr-foto' + (p.fundoRemovido ? ' gr-foto-recorte' : ''));
    var img = document.createElement('img');
    img.src = p.foto;
    img.alt = GR.descrever(p);
    img.loading = 'lazy';
    fig.appendChild(img);
    item.appendChild(fig);
    item.appendChild(criar('p', '', GR.descrever(p)));
    return item;
  }

  function nomeDoClima(c) {
    return { calor: 'calor', frio: 'frio', meia_estacao: 'meia-estação', variado: 'clima variado' }[c] || c;
  }

  function cartaoDoClima(e, c, dia) {
    var caixa = cartao('Clima');
    if (c.estimado) {
      var mes = MESES[Number(dia.split('-')[1]) - 1];
      caixa.appendChild(criar('p', '', 'Em ' + mes + (e.uf ? ', em ' + e.uf : '') + ', o mais provável é ' + nomeDoClima(c.categoria) + '.'));
      caixa.appendChild(criar('p', 'app-suave', e.cidade
        ? 'A previsão de verdade aparece aqui quando faltarem 9 dias.'
        : 'Informe a cidade no evento para ver a previsão quando a data chegar perto.'));
    } else {
      caixa.appendChild(criar('p', '', Math.round(c.minima) + '° a ' + Math.round(c.maxima) + '° em ' + c.cidade + ': ' + nomeDoClima(c.categoria) + (c.chuva ? ', com chance de chuva. Leve guarda-chuva e evite camurça.' : '.')));
      caixa.appendChild(criar('p', 'app-fonte', c.fonte));
    }
    return caixa;
  }

  function cartaoDoTraje(e, r) {
    var t = r.traje;
    var tipo = OC.porTipo[e.tipo];
    var papel = OC.porPapel[e.papel];
    var caixa = cartao('O traje: ' + t.rotulo);
    if (r.inferido) {
      caixa.appendChild(criar('p', 'app-suave', 'O convite não diz o traje. Para ' + tipo.artigo + (e.periodo === 'dia' ? ' de dia' : ' à noite') + ', o mais comum é este.'));
    }
    caixa.appendChild(criar('p', '', t.resumo));
    var duas = criar('div', 'oc-duas');
    var usar = criar('div');
    usar.appendChild(criar('p', 'oc-subtitulo', 'Use'));
    usar.appendChild(lista(t.usar));
    var evitar = criar('div');
    evitar.appendChild(criar('p', 'oc-subtitulo', 'Evite'));
    evitar.appendChild(lista(t.evitar));
    duas.appendChild(usar);
    duas.appendChild(evitar);
    duas.style.marginTop = '.85rem';
    caixa.appendChild(duas);
    [tipo.dica, papel && papel.dica].filter(Boolean).forEach(function (d) {
      var p = criar('p', 'app-suave', d);
      p.style.marginTop = '.75rem';
      caixa.appendChild(p);
    });
    return caixa;
  }

  function escolherLook(e, look) {
    e.look = look.pecas.map(function (p) { return p.id; });
    salvar();
    abrirDetalhe(e.id);
    var nome = (nomeDoEvento(e) + ' ' + app.dataCurta(e.data)).slice(0, 60);
    api.post('api/guarda-roupa.php?acao=look-nota', { pecas: e.look.slice().sort(function (a, b) { return a - b; }), nome: nome, observacao: '' }).then(function (r) {
      app.avisar(r.ok ? 'Look escolhido. Ele também ficou salvo no Guarda-roupa, com o nome do evento.' : 'Look escolhido.');
    });
  }

  function cartaoDoLook(e, r) {
    var caixa = cartao('Seu look');
    if (!conta.logado) {
      caixa.appendChild(criar('p', '', 'Entre na sua conta para montarmos o look com as peças do seu Guarda-roupa.'));
      var entrar = criar('a', 'botao botao-cheio', 'Entrar');
      entrar.href = 'entrar.html?voltar=' + encodeURIComponent('apps/ocasioes/');
      var linha = criar('div', 'app-botoes');
      linha.appendChild(entrar);
      caixa.appendChild(linha);
      return caixa;
    }
    if (!guarda.pecas) {
      caixa.appendChild(criar('p', 'app-suave', guarda.carregando ? 'Abrindo seu guarda-roupa...' : 'Não foi possível abrir seu guarda-roupa agora.'));
      return caixa;
    }
    if (r.escolhido) {
      caixa.appendChild(criar('p', '', 'Este é o look que você escolheu.'));
      var grade = criar('div', 'oc-look-pecas');
      r.escolhido.pecas.forEach(function (p) { grade.appendChild(fotoDaPeca(p)); });
      caixa.appendChild(grade);
      var acoes = criar('div', 'app-botoes');
      acoes.appendChild(botao('Escolher outro', 'texto-botao', function () { e.look = []; salvar(); abrirDetalhe(e.id); }));
      caixa.appendChild(acoes);
      return caixa;
    }
    if (r.looks.length) {
      caixa.appendChild(criar('p', '', r.looks.length === 1 ? 'Com as suas peças, este look serve para o traje.' : 'Com as suas peças, estes ' + r.looks.length + ' looks servem para o traje. Escolha um.'));
      r.looks.forEach(function (look, i) {
        var bloco = criar('div');
        bloco.style.marginTop = '1rem';
        bloco.appendChild(criar('p', 'oc-subtitulo', 'Opção ' + (i + 1)));
        var grade = criar('div', 'oc-look-pecas');
        look.pecas.forEach(function (p) { grade.appendChild(fotoDaPeca(p)); });
        bloco.appendChild(grade);
        if (look.motivos && look.motivos[0]) bloco.appendChild(criar('p', 'app-suave', look.motivos[0]));
        var acoes = criar('div', 'app-botoes');
        acoes.appendChild(botao('Escolher este look', 'botao', function () { escolherLook(e, look); }));
        bloco.appendChild(acoes);
        caixa.appendChild(bloco);
      });
      return caixa;
    }
    if (r.falta.length) {
      caixa.appendChild(criar('p', '', 'Para este traje, falta no seu guarda-roupa: ' + r.falta.map(rotuloDaFalta).join(', ') + '.'));
    } else {
      caixa.appendChild(criar('p', '', 'Suas peças não formaram um look para este traje. Confira a ocasião e a cor das peças no Guarda-roupa, ou veja abaixo o que dá para fazer sob medida.'));
    }
    var link = criar('a', 'texto-botao', 'Abrir o Guarda-roupa');
    link.href = 'apps/guarda-roupa/';
    caixa.appendChild(link);
    return caixa;
  }

  function cartaoDaEncomenda(e, r) {
    var sobMedida = r.falta.filter(function (f) { return f.sobMedida; });
    if (r.recomendado) sobMedida = [r.recomendado];
    if (!sobMedida.length || !r.encomendarAte) return null;
    var caixa = cartao('', 'oc-encomenda');
    var pecas = sobMedida.map(function (f) { return OC.SOB_MEDIDA[f.id].rotulo; });
    caixa.appendChild(criar('h2', 'oc-subtitulo', r.recomendado ? 'Recomendado: sob medida' : 'Feito sob medida para você'));
    var faltam = app.diasAte(r.encomendarAte);
    caixa.appendChild(criar('p', 'oc-prazo', faltam >= 0
      ? 'Encomende até ' + dataCompleta(r.encomendarAte) + ' (' + app.textoDias(faltam) + ').'
      : 'O prazo está apertado. Fale com a gente hoje para ver se dá tempo.'));
    caixa.appendChild(criar('p', 'app-suave', 'Assim ' + (pecas.length > 1 ? 'as peças ficam prontas' : 'o ' + pecas[0] + ' fica pronto') +
      ' antes de ' + dataCompleta(e.data) + ', com tempo para a prova e os ajustes. O prazo é uma estimativa: o prazo certo é combinado na conversa.'));

    var marca = criar('label', 'campo-marcar');
    marca.style.margin = '1rem 0 .25rem';
    var caixaMarcar = document.createElement('input');
    caixaMarcar.type = 'checkbox';
    caixaMarcar.checked = Boolean(e.encomendado);
    caixaMarcar.addEventListener('change', function () {
      e.encomendado = caixaMarcar.checked;
      salvar();
      app.avisar(e.encomendado ? 'Anotado: encomenda feita.' : 'Encomenda desmarcada.');
    });
    marca.appendChild(caixaMarcar);
    marca.appendChild(criar('span', '', 'Já encomendei'));
    caixa.appendChild(marca);

    var acoes = criar('div', 'app-botoes');
    var zap = criar('a', 'botao botao-cheio', 'Encomendar pelo WhatsApp');
    zap.href = app.linkWhatsapp('Olá! Tenho ' + nomeDoEvento(e).toLowerCase() + ' em ' + dataCompleta(e.data) + ' e queria fazer ' +
      (pecas.length > 1 ? pecas.slice(0, -1).join(', ') + ' e ' + pecas[pecas.length - 1] : 'um ' + pecas[0]) + ' sob medida.');
    zap.target = '_blank';
    zap.rel = 'noopener';
    acoes.appendChild(zap);
    var medidas = criar('a', 'texto-botao', 'Preencher minhas medidas');
    medidas.href = 'medidas.html';
    medidas.style.color = '#f4c3cd';
    acoes.appendChild(medidas);
    caixa.appendChild(acoes);
    return caixa;
  }

  /* --- Viagem: a mala ------------------------------------------------------------------------ */

  function diasDaViagem(e) {
    return Math.max(1, Math.min(30, (e.volta ? app.diasAte(e.volta, e.data) : 0) + 1));
  }

  function climaDaViagem(e) {
    if (e.climaViagem && e.climaViagem !== 'auto') return { categoria: e.climaViagem, escolhido: true };
    return climaDo(e, e.data);
  }

  function limitar(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // Escolhe poucas peças que combinam entre si: as que aparecem em mais looks
  function montarMala(e, clima) {
    var dias = diasDaViagem(e);
    var atividades = e.atividades;
    var climaMotor = clima === 'variado' ? '' : clima;
    var pecas = (guarda.pecas || []).filter(function (p) {
      if (p.formalidade === 'esportivo' && atividades.indexOf('esporte') === -1) return false;
      if (!climaMotor) return true;
      return clima === 'calor' ? p.clima !== 'frio' : (clima === 'frio' ? p.clima !== 'calor' : true);
    });
    var looks = LOOKS.sugerir(pecas, { clima: climaMotor }, guarda.decisoes).slice(0, 120);
    var vezes = {};
    looks.forEach(function (l) { l.pecas.forEach(function (p) { vezes[p.id] = (vezes[p.id] || 0) + 1; }); });
    function melhores(grupo, n, filtro) {
      return pecas.filter(function (p) { return grupoDe(p) === grupo && (!filtro || filtro(p)); })
        .sort(function (a, b) { return (vezes[b.id] || 0) - (vezes[a.id] || 0); }).slice(0, n);
    }
    var formal = atividades.indexOf('formal') !== -1;
    var noite = formal || atividades.indexOf('jantar') !== -1 || atividades.indexOf('trabalho') !== -1;
    var escolhidas = [];
    escolhidas = escolhidas.concat(melhores('baixo', limitar(Math.ceil(dias / 3), 1, 3), function (p) { return p.tipo !== 'short_esportivo'; }));
    escolhidas = escolhidas.concat(melhores('cima', limitar(Math.ceil(dias * 0.7), 2, 7)));
    if (clima !== 'calor' || noite) escolhidas = escolhidas.concat(melhores('camada', clima === 'frio' && dias > 5 ? 2 : 1));
    if (formal) {
      escolhidas = escolhidas.concat(melhores('conjunto', 1));
      escolhidas = escolhidas.concat(melhores('acessorio', 1, function (p) { return p.tipo === 'gravata'; }));
    }
    escolhidas = escolhidas.concat(melhores('calcado', 1, function (p) { return ['tenis', 'mocassim', 'bota'].indexOf(p.tipo) !== -1; }));
    if (noite) escolhidas = escolhidas.concat(melhores('calcado', 1, function (p) { return ['sapato', 'mocassim'].indexOf(p.tipo) !== -1; }));
    if (atividades.indexOf('praia') !== -1) {
      escolhidas = escolhidas.concat(melhores('baixo', 1, function (p) { return p.tipo === 'bermuda'; }));
      escolhidas = escolhidas.concat(melhores('calcado', 1, function (p) { return ['sandalia', 'chinelo'].indexOf(p.tipo) !== -1; }));
    }
    if (atividades.indexOf('esporte') !== -1) {
      escolhidas = escolhidas.concat(melhores('baixo', 1, function (p) { return p.tipo === 'short_esportivo'; }));
    }
    escolhidas = escolhidas.concat(melhores('acessorio', 1, function (p) { return p.tipo === 'cinto'; }));
    var unicas = [];
    escolhidas.forEach(function (p) { if (unicas.indexOf(p) === -1) unicas.push(p); });
    var ids = unicas.map(function (p) { return p.id; });
    var combinacoes = looks.filter(function (l) {
      return l.pecas.every(function (p) { return grupoDe(p) === 'acessorio' || ids.indexOf(p.id) !== -1; });
    }).length;
    return { pecas: unicas, combinacoes: combinacoes, dias: dias };
  }

  function essenciais(e, clima) {
    var dias = diasDaViagem(e);
    var a = e.atividades;
    var itens = [
      ['e-intimas', (dias + 1) + ' cuecas'],
      ['e-meias', (dias + 1) + ' pares de meia'],
      ['e-pijama', 'Pijama'],
      ['e-necessaire', 'Escova e pasta de dente, desodorante e barbeador'],
      ['e-remedios', 'Remédios de uso contínuo'],
      ['e-carregador', 'Carregador do celular'],
      ['e-documentos', 'Documento com foto']
    ];
    if (clima === 'frio' || clima === 'variado') itens.push(['e-frio', 'Casaco quente e uma malha extra']);
    if (a.indexOf('praia') !== -1) itens.push(['e-praia', 'Sunga, protetor solar e óculos de sol']);
    if (a.indexOf('esporte') !== -1) itens.push(['e-esporte', 'Roupa e tênis de treino']);
    if (a.indexOf('formal') !== -1) itens.push(['e-capa', 'Capa para o terno e cabide']);
    return itens;
  }

  // Sem guarda-roupa: uma mala genérica, pelo número de dias
  function malaGenerica(e, clima) {
    var dias = diasDaViagem(e);
    var a = e.atividades;
    var itens = [
      ['g-cima', limitar(Math.ceil(dias * 0.7), 2, 7) + ' camisetas, polos ou camisas, em cores que combinem'],
      ['g-baixo', limitar(Math.ceil(dias / 3), 1, 3) + (dias > 3 ? ' calças neutras' : ' calça neutra') + ', como jeans escuro e sarja'],
      ['g-calcado', '1 tênis limpo ou mocassim']
    ];
    if (clima !== 'calor') itens.push(['g-camada', '1 jaqueta ou blazer neutro']);
    if (a.indexOf('formal') !== -1) itens.push(['g-formal', 'Terno escuro, camisa clara, gravata e sapato social']);
    if (a.indexOf('jantar') !== -1 || a.indexOf('trabalho') !== -1) itens.push(['g-noite', '1 camisa social e 1 sapato ou mocassim']);
    if (a.indexOf('praia') !== -1) itens.push(['g-praia', '1 bermuda e 1 chinelo ou sandália']);
    return itens;
  }

  function itemDaMala(e, chave, texto, peca) {
    var li = criar('li');
    var caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = Boolean(e.mala[chave]);
    caixa.setAttribute('aria-label', 'Na mala: ' + texto);
    caixa.addEventListener('change', function () {
      if (caixa.checked) e.mala[chave] = true; else delete e.mala[chave];
      li.classList.toggle('oc-mala-feito', caixa.checked);
      salvar();
    });
    li.appendChild(caixa);
    if (peca) {
      var fig = criar('div', 'gr-foto' + (peca.fundoRemovido ? ' gr-foto-recorte' : ''));
      var img = document.createElement('img');
      img.src = peca.foto;
      img.alt = '';
      img.loading = 'lazy';
      fig.appendChild(img);
      li.appendChild(fig);
    }
    li.appendChild(criar('span', 'app-lista-texto', texto));
    li.classList.toggle('oc-mala-feito', caixa.checked);
    return li;
  }

  function desenharViagem(e, caixa) {
    var c = climaDaViagem(e);
    var dias = diasDaViagem(e);
    var resumo = cartao('A viagem');
    resumo.appendChild(criar('p', '', dias + (dias === 1 ? ' dia' : ' dias') + (e.cidade ? ' em ' + e.cidade + (e.uf ? ' (' + e.uf + ')' : '') : '') + ', ' +
      (c.escolhido ? 'com ' + nomeDoClima(c.categoria) + ', como você marcou.' : (c.estimado ? 'com ' + nomeDoClima(c.categoria) + ' provável para a época.' : 'com previsão de ' + Math.round(c.minima) + '° a ' + Math.round(c.maxima) + '°.'))));
    if (e.atividades.length) {
      resumo.appendChild(criar('p', 'app-suave', 'Programa: ' + e.atividades.map(function (id) {
        return OC.ATIVIDADES.filter(function (x) { return x.id === id; })[0].rotulo.toLowerCase();
      }).join(', ') + '.'));
    }
    caixa.appendChild(resumo);

    var mala = cartao('Roupas para a mala');
    var ul = criar('ul', 'oc-mala');
    if (guarda.pecas && guarda.pecas.length) {
      var m = montarMala(e, c.categoria);
      mala.appendChild(criar('p', '', m.pecas.length + ' peças do seu guarda-roupa' + (m.combinacoes > 1 ? ', que formam ' + m.combinacoes + ' looks diferentes.' : '.')));
      m.pecas.forEach(function (p) { ul.appendChild(itemDaMala(e, 'p' + p.id, p.apelido || GR.descrever(p), p)); });
    } else {
      mala.appendChild(criar('p', 'app-suave', conta.logado ? 'Cadastre peças no Guarda-roupa para a mala sair com as suas roupas.' : 'Com a conta e o Guarda-roupa, a mala sai com as suas próprias peças.'));
      malaGenerica(e, c.categoria).forEach(function (x) { ul.appendChild(itemDaMala(e, x[0], x[1])); });
    }
    ul.style.marginTop = '.75rem';
    mala.appendChild(ul);
    caixa.appendChild(mala);

    var extra = cartao('Não esqueça');
    var ul2 = criar('ul', 'oc-mala');
    essenciais(e, c.categoria).forEach(function (x) { ul2.appendChild(itemDaMala(e, x[0], x[1])); });
    extra.appendChild(ul2);
    caixa.appendChild(extra);
  }

  /* --- Navegação entre a lista e um evento -------------------------------------------------------- */

  function mostrarTela(detalhe) {
    $('oc-lista-tela').hidden = detalhe;
    $('oc-detalhe-tela').hidden = !detalhe;
    $('oc-fab').hidden = detalhe;
    $('oc-voltar-texto').textContent = detalhe ? 'Ocasiões' : 'Apps';
    $('oc-voltar').href = detalhe ? 'apps/ocasioes/' : 'apps/';
    window.scrollTo(0, 0);
  }

  function abrirDetalhe(id, empilhar) {
    var e = estado.eventos.filter(function (x) { return x.id === id; })[0];
    if (!e) { fecharDetalhe(); return; }
    aberto = e;
    if (empilhar) history.pushState({ evento: id }, '', location.pathname + '#' + id);
    mostrarTela(true);
    $('oc-d-data').textContent = app.dataLonga(e.data) + (e.tipo === 'viagem' && e.volta ? ' até ' + app.dataLonga(e.volta) : '');
    $('oc-d-nome').textContent = nomeDoEvento(e);
    $('oc-barra-titulo').textContent = nomeDoEvento(e);
    var chips = $('oc-d-chips');
    chips.textContent = '';
    var faltam = app.diasAte(e.data);
    chips.appendChild(criar('span', 'app-chip app-chip-bordo', faltam >= 0 ? app.textoDias(faltam).replace(/^./, function (l) { return l.toUpperCase(); }) : 'Já passou'));
    chips.appendChild(criar('span', 'app-chip', OC.porTipo[e.tipo].rotulo));
    if (e.tipo !== 'viagem') {
      chips.appendChild(criar('span', 'app-chip', e.periodo === 'dia' ? 'De dia' : 'À noite'));
      if (e.papel && e.papel !== 'convidado') chips.appendChild(criar('span', 'app-chip', OC.porPapel[e.papel].rotulo));
    }

    var caixa = $('oc-d-conteudo');
    caixa.textContent = '';
    if (e.tipo === 'viagem') {
      desenharViagem(e, caixa);
      buscarClima(e, e.data, function () { if (aberto === e) abrirDetalhe(e.id); });
      return;
    }
    var r = analisar(e);
    if (atualizarResumo(e, r)) salvar();
    caixa.appendChild(cartaoDoClima(e, r.clima, e.data));
    caixa.appendChild(cartaoDoTraje(e, r));
    caixa.appendChild(cartaoDoLook(e, r));
    var encomenda = cartaoDaEncomenda(e, r);
    if (encomenda) caixa.appendChild(encomenda);
    buscarClima(e, e.data, function () { if (aberto === e) abrirDetalhe(e.id); });
  }

  function fecharDetalhe() {
    aberto = null;
    mostrarTela(false);
    $('oc-barra-titulo').textContent = 'Ocasiões';
    desenharLista();
  }

  $('oc-voltar').addEventListener('click', function (ev) {
    if (!aberto) return;
    ev.preventDefault();
    if (history.state && history.state.evento) history.back();
    else { history.replaceState(null, '', location.pathname); fecharDetalhe(); }
  });
  window.addEventListener('popstate', function () {
    var id = location.hash.slice(1);
    if (id) abrirDetalhe(id); else fecharDetalhe();
  });

  /* --- Formulário ----------------------------------------------------------------------------------- */

  function preencher(id, itens, vazio) {
    var s = $(id);
    if (vazio) s.appendChild(new Option(vazio, ''));
    itens.forEach(function (i) { s.appendChild(new Option(i.rotulo, i.id)); });
  }

  preencher('oc-tipo', OC.TIPOS);
  preencher('oc-traje', [{ id: 'nao_informado', rotulo: 'Não sei ou não está no convite' }].concat(OC.TRAJES));
  preencher('oc-papel', OC.PAPEIS);
  preencher('oc-clima-viagem', OC.CLIMAS);
  preencher('oc-uf', OC.UFS.map(function (uf) { return { id: uf, rotulo: uf }; }), '—');
  OC.ATIVIDADES.forEach(function (a) {
    var rotulo = criar('label');
    var caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.value = a.id;
    rotulo.appendChild(caixa);
    rotulo.appendChild(criar('span', '', a.rotulo));
    $('oc-atividades').appendChild(rotulo);
  });

  function ajustarFormulario() {
    var viagem = $('oc-tipo').value === 'viagem';
    $('oc-campo-volta').hidden = !viagem;
    $('oc-campo-atividades').hidden = !viagem;
    $('oc-campo-clima').hidden = !viagem;
    $('oc-campo-periodo').hidden = viagem;
    $('oc-campo-traje').hidden = viagem;
    $('oc-campo-papel').hidden = viagem;
    $('oc-data-rotulo').textContent = viagem ? 'Ida' : 'Data';
  }
  $('oc-tipo').addEventListener('change', ajustarFormulario);

  function abrirFormulario(e) {
    editando = e || null;
    $('oc-form-titulo').textContent = e ? 'Editar evento' : 'Novo evento';
    $('oc-salvar').textContent = e ? 'Salvar alterações' : 'Salvar evento';
    $('oc-tipo').value = e ? e.tipo : 'casamento';
    $('oc-nome').value = e ? e.nome : '';
    $('oc-data').value = e ? e.data : '';
    $('oc-data').min = e ? '' : app.hojeISO();
    $('oc-volta').value = e ? e.volta : '';
    $('oc-periodo').value = e ? e.periodo : 'noite';
    $('oc-traje').value = e ? e.traje : 'nao_informado';
    $('oc-papel').value = e ? e.papel : 'convidado';
    $('oc-clima-viagem').value = e ? e.climaViagem || 'auto' : 'auto';
    $('oc-cidade').value = e ? e.cidade : '';
    $('oc-uf').value = e ? e.uf : '';
    $('oc-atividades').querySelectorAll('input').forEach(function (c) { c.checked = Boolean(e && e.atividades.indexOf(c.value) !== -1); });
    ['oc-erro-data', 'oc-erro-volta', 'oc-form-erro'].forEach(function (id) { $(id).textContent = ''; });
    ajustarFormulario();
    $('oc-modal').showModal();
  }

  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  $('oc-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    ['oc-erro-data', 'oc-erro-volta', 'oc-form-erro'].forEach(function (id) { $(id).textContent = ''; });
    var tipo = $('oc-tipo').value;
    var data = $('oc-data').value;
    var volta = tipo === 'viagem' ? $('oc-volta').value : '';
    if (!data) { $('oc-erro-data').textContent = 'Escolha a data.'; return; }
    if (tipo === 'viagem') {
      if (!volta) volta = data;
      if (volta < data) { $('oc-erro-volta').textContent = 'A volta precisa ser depois da ida.'; return; }
      if (app.diasAte(volta, data) > 29) { $('oc-erro-volta').textContent = 'Para viagens de até 30 dias.'; return; }
    }
    if (!editando && estado.eventos.length >= 60) { $('oc-form-erro').textContent = 'Você chegou ao limite de 60 eventos. Apague os antigos para adicionar outro.'; return; }
    var e = editando || { id: novoId(), criadoEm: Date.now(), mala: {}, look: [], encomendado: false, situacao: '', encomendarAte: '' };
    var mudouTraje = editando && (editando.tipo !== tipo || editando.traje !== $('oc-traje').value || editando.periodo !== $('oc-periodo').value);
    e.tipo = tipo;
    e.nome = $('oc-nome').value.trim().slice(0, 60);
    e.data = data;
    e.volta = volta;
    e.periodo = $('oc-periodo').value;
    e.traje = tipo === 'viagem' ? 'nao_informado' : $('oc-traje').value;
    e.papel = tipo === 'viagem' ? 'convidado' : $('oc-papel').value;
    e.climaViagem = $('oc-clima-viagem').value;
    e.cidade = $('oc-cidade').value.trim().slice(0, 80);
    e.uf = $('oc-uf').value;
    e.atividades = Array.prototype.slice.call($('oc-atividades').querySelectorAll('input:checked')).map(function (c) { return c.value; });
    if (mudouTraje) e.look = [];
    if (!editando) estado.eventos.push(e);
    Object.keys(climas).forEach(function (k) { if (k.indexOf(e.id + '|') === 0) delete climas[k]; });
    salvar();
    $('oc-modal').close();
    if (editando) abrirDetalhe(e.id);
    else abrirDetalhe(e.id, true);
    app.avisar(editando ? 'Evento atualizado.' : 'Evento adicionado.');
  });

  $('oc-fechar').addEventListener('click', function () { $('oc-modal').close(); });
  $('oc-fab').addEventListener('click', function () { abrirFormulario(); });
  $('oc-primeiro').addEventListener('click', function () { abrirFormulario(); });
  $('oc-d-editar').addEventListener('click', function () { if (aberto) abrirFormulario(aberto); });
  $('oc-d-apagar').addEventListener('click', function () {
    if (!aberto) return;
    var e = aberto;
    var posicao = estado.eventos.indexOf(e);
    estado.eventos.splice(posicao, 1);
    salvar();
    history.replaceState(null, '', location.pathname);
    fecharDetalhe();
    app.avisar('Evento apagado.', function () {
      estado.eventos.splice(posicao, 0, e);
      salvar();
      desenharLista();
    });
  });

  /* --- Lembretes por e-mail ---------------------------------------------------------------------- */

  function mostrarLembretes() {
    var caixa = $('oc-lembretes');
    var pode = conta.logado && conta.emailVerificado;
    caixa.disabled = !pode;
    caixa.checked = Boolean(pode && estado.lembretes);
    $('oc-lembretes-texto').textContent = !conta.logado
      ? 'Entre na sua conta para receber um e-mail quando o prazo de encomenda estiver chegando e uma semana antes de cada evento.'
      : (!conta.emailVerificado
        ? 'Confirme seu e-mail em Minha conta para receber os lembretes.'
        : 'Um e-mail quando faltarem 3 dias para o prazo de encomenda e outro uma semana antes de cada evento.');
  }

  $('oc-lembretes').addEventListener('change', function () {
    estado.lembretes = $('oc-lembretes').checked;
    salvar();
    app.avisar(estado.lembretes ? 'Lembretes por e-mail ligados.' : 'Lembretes por e-mail desligados.');
  });

  /* --- Início ------------------------------------------------------------------------------------- */

  // Com o guarda-roupa aberto, cada evento sabe se o look está pronto e até quando encomendar
  function aoMudarDados() {
    var mudou = false;
    estado.eventos.forEach(function (e) {
      if (e.tipo !== 'viagem' && atualizarResumo(e, analisar(e))) mudou = true;
    });
    if (mudou) salvar();
    if (aberto) abrirDetalhe(aberto.id); else desenharLista();
  }

  desenharLista();
  if (location.hash.length > 1) abrirDetalhe(location.hash.slice(1));

  app.sessao.then(function (usuario) {
    conta.logado = Boolean(usuario);
    conta.emailVerificado = Boolean(usuario && usuario.emailVerificado);
    mostrarLembretes();
    if (!usuario) {
      $('oc-situacao').textContent = estado.eventos.length ? 'Seus eventos estão guardados neste aparelho.' : '';
      return;
    }
    guarda.carregando = true;
    api.get('api/guarda-roupa.php').then(function (r) {
      guarda.carregando = false;
      if (r.ok) {
        guarda.pecas = r.dados.pecas;
        r.dados.looks.forEach(function (l) { guarda.decisoes[l.chave] = l.situacao; });
      }
      aoMudarDados();
    });
    api.get(ENDERECO).then(function (r) {
      if (!r.ok) return;
      var daConta = r.dados.dados;
      if (daConta && (daConta.alteradoEm || 0) > (estado.alteradoEm || 0)) {
        estado = completar(daConta);
        app.gravarLocal(CHAVE, estado);
        $('oc-situacao').textContent = 'Seus eventos estão guardados na sua conta.';
        aoMudarDados();
      } else if (estado.eventos.length && (!daConta || (estado.alteradoEm || 0) > (daConta.alteradoEm || 0))) {
        salvar();
      } else {
        $('oc-situacao').textContent = 'Seus eventos estão guardados na sua conta.';
      }
    });
  });
})();
