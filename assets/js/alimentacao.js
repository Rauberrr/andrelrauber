/* Alimentação: a tela. Sem autorização, os dados ficam só neste aparelho.
   Com autorização, também ficam na conta da pessoa, para abrir em qualquer aparelho. */
(function () {
  'use strict';

  var D = window.AR_ALIM;
  var C = window.AR_ALIM_CALC;
  var api = window.AR_API;
  var app = window.AR_APP;
  var CHAVE = 'ar-alimentacao-v1';
  var ENDERECO = 'api/alimentacao.php';
  var PASSOS = ['resumo', 'voce', 'comida', 'plano', 'compras', 'acompanhamento'];

  var estado = completar(carregar() || novoEstado());
  var conta = { logado: false, temNaConta: false, salvoEm: null, situacao: '', medidas: null, emailVerificado: false };
  var precos = null;

  function novoEstado() {
    return {
      perfil: { sexo: 'm', idade: '', altura: '', peso: '', atividade: 'leve', objetivo: 'manter', uf: '' },
      itens: [], modo: 'ajustar', listaDe: 'plano', concluido: false, guardarNaConta: false, alteradoEm: 0,
      trocas: {}, despensa: {}, inicioPlano: '', registros: [], lembretes: false, resumoLista: null
    };
  }

  // Dados guardados antes destas partes existirem ganham os campos que faltam
  function completar(e) {
    if (!e || typeof e !== 'object') return novoEstado();
    if (!e.trocas || typeof e.trocas !== 'object' || Array.isArray(e.trocas)) e.trocas = {};
    if (!e.despensa || typeof e.despensa !== 'object' || Array.isArray(e.despensa)) e.despensa = {};
    if (!Array.isArray(e.registros)) e.registros = [];
    if (typeof e.inicioPlano !== 'string') e.inicioPlano = '';
    if (typeof e.lembretes !== 'boolean') e.lembretes = false;
    return e;
  }

  function $(id) { return document.getElementById(id); }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function botao(texto, classe, aoClicar) {
    var b = criar('button', classe, texto);
    b.type = 'button';
    if (aoClicar) b.addEventListener('click', aoClicar);
    return b;
  }

  function carregar() {
    try { return JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { return null; }
  }

  function reais(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function kcal(v) { return Math.round(v).toLocaleString('pt-BR') + ' kcal'; }
  function minusculo(texto) { return texto.charAt(0).toLowerCase() + texto.slice(1); }

  /* --- Resposta a cada toque ------------------------------------------------------------- */

  var temporizador = null;

  function retorno(texto, desfazer) {
    var caixa = $('alim-retorno');
    caixa.textContent = '';
    window.clearTimeout(temporizador);
    caixa.appendChild(criar('span', '', texto));
    if (desfazer) {
      caixa.appendChild(botao('Desfazer', 'texto-botao', function () { caixa.textContent = ''; desfazer(); }));
    }
    temporizador = window.setTimeout(function () { caixa.textContent = ''; }, desfazer ? 9000 : 4500);
  }

  /* --- Guardar: no aparelho e, com autorização, na conta ------------------------------------ */

  var agendado = null;

  // Resumo da lista para os avisos por e-mail e para o início dos apps: o que tem em casa
  // e quando acaba. Itens que a pessoa nunca marcou como comprados ficam sem data.
  function resumirLista() {
    if (!estado.concluido || !perfilValido()) return null;
    try {
      return {
        itens: linhasDaDespensa(contas().doPlano).slice(0, 80).map(function (x) {
          var r = x.registro;
          var acabaEm = '';
          if (r && r.compradoEm) acabaEm = r.acabouEm || x.situacao.acabaEm || '';
          return { id: x.linha.produto.id, nome: x.linha.produto.nome.slice(0, 60), acabaEm: acabaEm };
        })
      };
    } catch (e) {
      return null;
    }
  }

  function salvar() {
    estado.alteradoEm = Date.now();
    estado.resumoLista = resumirLista();
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* segue sem guardar */ }
    compartilhar();
    if (conta.logado && estado.guardarNaConta) {
      window.clearTimeout(agendado);
      mostrarSituacao('salvando');
      agendado = window.setTimeout(enviarParaConta, 1200);
    }
  }

  function enviarParaConta() {
    api.post(ENDERECO + '?acao=salvar', { dados: estado, consentimento: true }).then(function (r) {
      if (r.ok) {
        conta.temNaConta = true;
        conta.salvoEm = new Date();
        mostrarSituacao('salvo');
      } else if (r.status === 401) {
        conta.logado = false;
        mostrarSituacao('saiu');
      } else {
        mostrarSituacao('erro', r.erro);
      }
    });
  }

  function mostrarSituacao(situacao, erro) {
    conta.situacao = situacao;
    var texto = '';
    if (!conta.logado) {
      texto = situacao === 'saiu' ? 'Você saiu da conta. As mudanças ficam neste aparelho.' : '';
    } else if (!estado.guardarNaConta) {
      texto = 'Guardado só neste aparelho.';
    } else if (situacao === 'salvando') {
      texto = 'Salvando na sua conta...';
    } else if (situacao === 'salvo' && conta.salvoEm) {
      texto = 'Salvo na sua conta às ' + conta.salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.';
    } else if (situacao === 'erro') {
      texto = (erro || 'Não foi possível salvar na sua conta agora.') + ' As mudanças ficam neste aparelho e tentamos de novo na próxima alteração.';
    } else {
      texto = 'Guardado na sua conta.';
    }
    $('alim-status').textContent = texto;
    $('alim-resumo-status').textContent = texto || 'Guardado só neste aparelho.';
    $('alim-privacidade-texto').textContent = conta.logado && estado.guardarNaConta
      ? 'Suas respostas ficam neste aparelho e na sua conta, protegidas e visíveis só para você.'
      : 'Suas respostas ficam guardadas só neste aparelho, no navegador.';
  }

  $('alim-guardar').addEventListener('change', function () {
    var caixa = $('alim-guardar');
    if (caixa.checked) {
      estado.guardarNaConta = true;
      salvar();
      mostrarLembrete();
      retorno('Pronto: suas informações vão ficar salvas na sua conta.');
      return;
    }
    if (conta.temNaConta && !window.confirm('Apagar da sua conta as informações de alimentação? Elas continuam neste aparelho.')) {
      caixa.checked = true;
      return;
    }
    estado.guardarNaConta = false;
    estado.lembretes = false;
    salvar();
    mostrarLembrete();
    if (!conta.temNaConta) { mostrarSituacao(''); return; }
    api.post(ENDERECO + '?acao=apagar').then(function (r) {
      if (r.ok) {
        conta.temNaConta = false;
        retorno('Apagado da sua conta. Continua só neste aparelho.');
      } else {
        retorno(r.erro || 'Não foi possível apagar agora. Tente de novo.');
      }
      mostrarSituacao('');
    });
  });

  // Ao abrir: vale a versão alterada por último, seja a deste aparelho ou a da conta
  function iniciarConta() {
    if (!api) return Promise.resolve();
    return api.get('api/auth.php?acao=sessao').then(function (r) {
      conta.logado = Boolean(r.ok && r.dados.logado);
      conta.emailVerificado = Boolean(conta.logado && r.dados.usuario && r.dados.usuario.emailVerificado);
      mostrarLembrete();
      $('alim-guardar-logado').hidden = !conta.logado;
      $('alim-guardar-visitante').hidden = conta.logado;
      if (!conta.logado) { mostrarSituacao(''); return null; }
      return api.get(ENDERECO).then(function (resposta) {
        if (!resposta.ok) { mostrarSituacao(''); return; }
        var daConta = resposta.dados.dados;
        conta.temNaConta = Boolean(daConta);
        if (daConta && (daConta.alteradoEm || 0) >= (estado.alteradoEm || 0)) {
          estado = completar(daConta);
          estado.guardarNaConta = true;
          conta.salvoEm = resposta.dados.atualizadoEm ? new Date(resposta.dados.atualizadoEm.replace(' ', 'T')) : null;
          try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* segue */ }
          mostrarTudo();
          retorno('Trouxemos suas informações da sua conta.');
        } else if (daConta) {
          estado.guardarNaConta = true;
          salvar();
        }
        $('alim-guardar').checked = Boolean(estado.guardarNaConta);
        mostrarSituacao(conta.temNaConta ? 'salvo' : '');
        mostrarLembrete();
        return puxarDaConta();
      });
    });
  }

  // Quem tem conta não precisa digitar de novo a altura, o peso e o estado
  function puxarDaConta() {
    return api.get('api/perfil.php').then(function (r) {
      if (!r.ok) return;
      var c = r.dados.cadastro || {};
      var p = estado.perfil;
      var usou = false;
      // Medidas do cadastro de roupas servem de ponto de partida no acompanhamento
      var medidas = { peso: c.peso, cintura: c.cintura_cima || c.cintura_baixo, torax: c.torax, braco: c.braco, coxa: c.coxa };
      if (Object.keys(medidas).some(function (k) { return medidas[k]; })) {
        conta.medidas = medidas;
        $('reg-do-cadastro').hidden = false;
      }
      if (!p.altura && c.altura) { p.altura = Math.round(Number(c.altura)); usou = true; }
      if (!p.peso && c.peso) { p.peso = Math.round(Number(c.peso) * 10) / 10; usou = true; }
      if (!p.uf && c.uf && D.porEstado[c.uf]) { p.uf = c.uf; usou = true; }
      if (usou) {
        mostrarPerfil();
        salvar();
        $('alim-da-conta').hidden = false;
      }
    });
  }

  /* --- Ligação com o Treino ---------------------------------------------------------------------- */

  var OBJETIVO_DO_TREINO = { emagrecer: 'perder', massa: 'ganhar', saude: 'manter' };
  var ROTULO_DO_TREINO = { emagrecer: 'emagrecer', massa: 'ganhar massa muscular', saude: 'saúde e disposição' };

  // Quem treina tantos dias por semana tem esta rotina
  function atividadeDoTreino(dias) {
    if (dias >= 6) return 'intenso';
    if (dias >= 3) return 'moderado';
    return 'leve';
  }

  // As medidas e o plano ficam disponíveis para o Treino, neste aparelho
  function compartilhar() {
    if (!app) return;
    var p = estado.perfil;
    var medidas = {};
    if (p.idade >= 18 && p.idade <= 80) { medidas.idade = p.idade; medidas.sexo = p.sexo; }
    if (p.altura >= 140 && p.altura <= 220) medidas.altura = p.altura;
    if (p.peso >= 40 && p.peso <= 250) medidas.peso = p.peso;
    var resumo = { objetivo: p.objetivo, atividade: p.atividade, concluido: Boolean(estado.concluido), em: Date.now() };
    if (perfilValido()) {
      var metas = C.gasto(p);
      resumo.meta = metas.meta;
      resumo.proteina = metas.proteina;
    }
    app.guardarComum('alimentacao', medidas, resumo);
  }

  // Quem começou pelo Treino não precisa digitar as medidas de novo
  function trazerDoTreino() {
    if (!app) return false;
    var c = app.comum();
    var p = estado.perfil;
    var novo = !p.idade && !estado.concluido;
    var maisNovas = c.medidasDe === 'treino' && c.medidasEm > (estado.alteradoEm || 0);
    var usou = false;
    ['sexo', 'idade', 'altura', 'peso'].forEach(function (k) {
      var v = c.medidas[k];
      if (!v || p[k] === v) return;
      if (maisNovas || (k === 'sexo' ? novo : !p[k])) { p[k] = v; usou = true; }
    });
    if (novo && c.treino && OBJETIVO_DO_TREINO[c.treino.objetivo]) {
      p.objetivo = OBJETIVO_DO_TREINO[c.treino.objetivo];
      p.atividade = atividadeDoTreino(c.treino.dias);
      usou = true;
    }
    if (usou) {
      $('alim-da-conta').textContent = 'Trouxemos o que você informou no Treino. Confira se continua certo.';
      $('alim-da-conta').hidden = false;
    }
    return usou;
  }

  // Sugere a rotina que combina com os dias de treino
  function mostrarRotinaDoTreino() {
    var caixa = $('alim-do-treino');
    var t = app && app.comum().treino;
    caixa.textContent = '';
    caixa.hidden = true;
    if (!t || !t.dias) return;
    var sugerida = atividadeDoTreino(t.dias);
    if (sugerida === estado.perfil.atividade) return;
    var rotulo = C.ATIVIDADES.filter(function (a) { return a.id === sugerida; })[0].rotulo;
    caixa.appendChild(document.createTextNode('No Treino, você marcou ' + t.dias + ' dias por semana. A rotina “' + rotulo + '” combina mais com isso. '));
    caixa.appendChild(botao('Usar essa', 'texto-botao', function () {
      $('passo-voce').elements.atividade.value = sugerida;
      lerPerfil();
      mostrarRotinaDoTreino();
      retorno('Rotina ajustada. O gasto do dia foi recalculado.');
    }));
    caixa.hidden = false;
  }

  function treinoGuardado() {
    var t = app && app.lerLocal('ar-treino-v1');
    return t && t.perfil && t.perfil.dias ? t : null;
  }

  // Ao terminar o plano, o convite para o treino
  function desenharPonteTreino() {
    var t = treinoGuardado();
    var texto;
    if (t) {
      var p = t.perfil;
      texto = p.dias + ' dias por semana, para ' + (ROTULO_DO_TREINO[p.objetivo] || 'saúde') + '.' +
        (t.resumo && t.resumo.proximo ? ' Próximo: ' + t.resumo.proximo + '.' : '');
      if (OBJETIVO_DO_TREINO[p.objetivo] && OBJETIVO_DO_TREINO[p.objetivo] !== estado.perfil.objetivo) {
        texto += ' O objetivo do treino é diferente do plano alimentar: vale deixar os dois iguais.';
      }
    } else {
      texto = 'Com o plano alimentar pronto, monte um treino para o mesmo objetivo, na academia ou em casa. Suas medidas e o objetivo já vão preenchidos.';
    }
    $('alim-ponte-titulo').textContent = t ? 'Seu treino' : 'Próximo passo: o treino';
    $('alim-ponte-texto').textContent = texto;
    $('alim-ponte-ir').textContent = t ? 'Abrir meu treino' : 'Montar meu treino';
    $('alim-plano-treino').textContent = t ? 'Abrir meu treino' : 'Montar meu treino';
  }

  /* --- Passos --------------------------------------------------------------------------------- */

  function irPara(passo) {
    if (passo !== 'voce' && passo !== 'resumo' && !perfilValido()) {
      mostrarErrosPerfil();
      passo = 'voce';
      retorno('Preencha seus dados primeiro. Os campos que faltam estão marcados.');
    }
    if (passo === 'resumo' && !estado.concluido) passo = 'compras';
    PASSOS.forEach(function (p) {
      $('passo-' + p).hidden = p !== passo;
      $('ir-' + p).setAttribute('aria-current', p === passo ? 'step' : 'false');
    });
    $('item-resumo').hidden = !estado.concluido;
    if (passo === 'resumo') desenharResumo();
    if (passo === 'plano') desenharPlano();
    if (passo === 'compras') desenharCompras();
    if (passo === 'compras' || passo === 'plano') desenharPonteTreino();
    if (passo === 'acompanhamento') desenharAcompanhamento();
    $('passo-' + passo).focus({ preventScroll: true });
    window.scrollTo({ top: $('alim-topo').getBoundingClientRect().top + window.scrollY - 90 });
  }

  PASSOS.forEach(function (p) {
    $('ir-' + p).addEventListener('click', function () { irPara(p); });
  });

  /* --- Passo 1: você ------------------------------------------------------------------------- */

  function preencherOpcoes() {
    var estados = $('alim-uf');
    estados.appendChild(new Option('Escolha', ''));
    D.ESTADOS.forEach(function (e) { estados.appendChild(new Option(e.nome, e.uf)); });
    function radios(caixaId, nome, lista) {
      var caixa = $(caixaId);
      lista.forEach(function (op) {
        var rotulo = criar('label', 'campo-marcar');
        var r = document.createElement('input');
        r.type = 'radio';
        r.name = nome;
        r.value = op.id;
        rotulo.appendChild(r);
        rotulo.appendChild(criar('span', '', op.rotulo));
        caixa.appendChild(rotulo);
      });
    }
    radios('alim-atividade', 'atividade', C.ATIVIDADES);
    radios('alim-objetivo', 'objetivo', C.OBJETIVOS);
  }

  function mostrarPerfil() {
    var p = estado.perfil;
    var form = $('passo-voce');
    form.elements.sexo.value = p.sexo;
    $('alim-idade').value = p.idade;
    $('alim-altura').value = p.altura;
    $('alim-peso').value = p.peso;
    form.elements.atividade.value = p.atividade;
    form.elements.objetivo.value = p.objetivo;
    $('alim-uf').value = p.uf;
    mostrarRotinaDoTreino();
  }

  function lerPerfil() {
    var form = $('passo-voce');
    estado.perfil = {
      sexo: form.elements.sexo.value || 'm',
      idade: Number($('alim-idade').value) || '',
      altura: Number(String($('alim-altura').value).replace(',', '.')) || '',
      peso: Number(String($('alim-peso').value).replace(',', '.')) || '',
      atividade: form.elements.atividade.value || 'leve',
      objetivo: form.elements.objetivo.value || 'manter',
      uf: $('alim-uf').value
    };
    salvar();
  }

  function problemasDoPerfil() {
    var p = estado.perfil;
    var erros = {};
    if (!(p.idade >= 18 && p.idade <= 80)) erros.idade = 'Esta ferramenta é para adultos de 18 a 80 anos.';
    if (!(p.altura >= 140 && p.altura <= 220)) erros.altura = 'Informe a altura em centímetros, como 178.';
    if (!(p.peso >= 40 && p.peso <= 250)) erros.peso = 'Informe o peso em quilos, como 82.';
    if (!p.uf) erros.uf = 'Escolha o estado, para calcularmos os preços da sua região.';
    return erros;
  }

  function perfilValido() { return Object.keys(problemasDoPerfil()).length === 0; }

  function mostrarErrosPerfil() {
    var erros = problemasDoPerfil();
    ['idade', 'altura', 'peso', 'uf'].forEach(function (c) { $('erro-alim-' + c).textContent = erros[c] || ''; });
    return Object.keys(erros)[0];
  }

  ['alim-idade', 'alim-altura', 'alim-peso', 'alim-uf'].forEach(function (id) {
    $(id).addEventListener('change', lerPerfil);
  });
  $('passo-voce').addEventListener('change', function (e) {
    if (e.target.type === 'radio') { lerPerfil(); mostrarRotinaDoTreino(); }
  });
  $('passo-voce').addEventListener('submit', function (e) {
    e.preventDefault();
    lerPerfil();
    var primeiro = mostrarErrosPerfil();
    if (primeiro) {
      $('alim-' + primeiro).focus();
      retorno('Falta corrigir os campos marcados.');
      return;
    }
    retorno('Dados guardados.');
    irPara('comida');
  });

  /* --- Passo 2: o que você come ------------------------------------------------------------------ */

  var SUGESTOES = {
    cafe: [['pao_frances', 1], ['manteiga', 1], ['cafe', 1], ['cafe_leite', 1], ['leite', 1, 1], ['acucar', 2], ['ovo', 2], ['banana', 1], ['cuscuz', 1], ['tapioca', 1]],
    almoco: [['arroz', 4], ['feijao', 1], ['frango', 1], ['carne', 1], ['salada', 1], ['macarrao', 1], ['batata_frita', 1], ['refrigerante', 1], ['marmita', 1]],
    lanche: [['pao_frances', 1], ['cafe', 1], ['biscoito', 4], ['iogurte', 1], ['banana', 1], ['salgado', 1], ['suco_caixa', 1]],
    jantar: [['arroz', 3], ['feijao', 1], ['carne', 1], ['ovo', 2], ['macarrao', 1], ['pizza', 2], ['lanche', 1], ['salada', 1]],
    outros: [['oleo', 2], ['refrigerante', 1], ['cerveja', 2], ['chocolate', 3], ['biscoito', 4], ['agua', 6]]
  };

  var editorAberto = null;

  function opcoesDeMedidas(select, alimentoId, escolhida) {
    select.textContent = '';
    var a = D.porAlimento[alimentoId];
    if (!a) { select.appendChild(new Option('Escolha o alimento primeiro', '0')); return; }
    var unidade = a.grupo === 'bebidas' ? ' ml' : ' g';
    a.medidas.forEach(function (m, i) { select.appendChild(new Option(m.rotulo + ' (' + m.g + unidade + ')', String(i))); });
    select.value = String(Math.min(escolhida || 0, a.medidas.length - 1));
  }

  function fecharEditor() {
    if (!editorAberto) return;
    editorAberto.caixa.textContent = '';
    editorAberto.caixa.hidden = true;
    if (editorAberto.atalho) editorAberto.atalho.classList.remove('ativo');
    editorAberto = null;
  }

  // Editor de um item: tipo, quantidade, medida e frequência. Serve para incluir e para alterar.
  function abrirEditor(ref, opcoes) {
    fecharEditor();
    var caixa = $('editor-' + ref.id);
    var editando = typeof opcoes.indice === 'number';
    var base = editando ? estado.itens[opcoes.indice] : null;
    var alimentoId = base ? base.alimento : (opcoes.alimento || '');
    editorAberto = { caixa: caixa, atalho: opcoes.atalho || null };
    if (opcoes.atalho) opcoes.atalho.classList.add('ativo');

    caixa.hidden = false;
    caixa.appendChild(criar('p', 'alim-editor-titulo', editando ? 'Alterar item' : 'Quanto você come?'));

    // Tipo: lista completa para "outro alimento", ou a família do alimento escolhido
    var tipo = document.createElement('select');
    if (!alimentoId) {
      tipo.appendChild(new Option('Escolha um alimento', ''));
      D.GRUPOS.forEach(function (g) {
        var grupo = document.createElement('optgroup');
        grupo.label = g.rotulo;
        D.ALIMENTOS.filter(function (a) { return a.grupo === g.id; }).forEach(function (a) {
          grupo.appendChild(new Option(a.nome, a.id));
        });
        tipo.appendChild(grupo);
      });
    } else {
      (D.familiaDe[alimentoId] || [alimentoId]).forEach(function (id) {
        tipo.appendChild(new Option(D.porAlimento[id].nome, id));
      });
      tipo.value = alimentoId;
    }

    var qtd = document.createElement('input');
    qtd.type = 'number';
    qtd.min = '0.5';
    qtd.max = '30';
    qtd.step = '0.5';
    qtd.inputMode = 'decimal';
    qtd.value = String(base ? base.qtd : (opcoes.qtd || 1));
    var menos = botao('−', 'alim-passo-qtd', function () { qtd.value = String(Math.max(0.5, (Number(qtd.value) || 1) - 0.5)); atualizarPrevia(); });
    var mais = botao('+', 'alim-passo-qtd', function () { qtd.value = String(Math.min(30, (Number(qtd.value) || 0) + 0.5)); atualizarPrevia(); });
    menos.setAttribute('aria-label', 'Diminuir quantidade');
    mais.setAttribute('aria-label', 'Aumentar quantidade');

    var medida = document.createElement('select');
    opcoesDeMedidas(medida, alimentoId, base ? base.medida : (opcoes.medida || 0));

    var freq = document.createElement('select');
    C.FREQUENCIAS.forEach(function (f) { freq.appendChild(new Option(f.rotulo, f.id)); });
    freq.value = base ? base.freq : 'diario';

    var previa = criar('p', 'alim-editor-previa');
    var erro = criar('p', 'erro');
    erro.setAttribute('role', 'alert');

    function lerItem() {
      return C.novoItem(ref.id, tipo.value, Number(String(qtd.value).replace(',', '.')), Number(medida.value), { freq: freq.value });
    }

    function atualizarPrevia() {
      var item = lerItem();
      if (!D.porAlimento[item.alimento] || !(item.qtd > 0)) { previa.textContent = ''; return; }
      previa.textContent = C.descreverItem(item) + ': cerca de ' + kcal(C.nutrientes([C.novoItem(ref.id, item.alimento, item.qtd, item.medida)]).kcal) + '.';
    }

    tipo.addEventListener('change', function () { opcoesDeMedidas(medida, tipo.value, Number(medida.value)); atualizarPrevia(); });
    [qtd, medida, freq].forEach(function (campo) { campo.addEventListener('input', atualizarPrevia); campo.addEventListener('change', atualizarPrevia); });

    var campos = criar('div', 'alim-editor-campos');
    function campo(rotulo, elemento) {
      var c = criar('label', 'alim-campo');
      c.appendChild(criar('span', '', rotulo));
      c.appendChild(elemento);
      campos.appendChild(c);
      return c;
    }
    campo(alimentoId ? 'Tipo' : 'Alimento', tipo);
    var linhaQtd = criar('div', 'alim-qtd');
    linhaQtd.appendChild(menos);
    linhaQtd.appendChild(qtd);
    linhaQtd.appendChild(mais);
    var campoQtd = campo('Quantidade', linhaQtd);
    campoQtd.htmlFor = '';
    qtd.setAttribute('aria-label', 'Quantidade');
    campo('Medida', medida);
    campo('Frequência', freq);
    caixa.appendChild(campos);
    caixa.appendChild(previa);
    caixa.appendChild(erro);

    var acoes = criar('div', 'alim-editor-acoes');
    acoes.appendChild(botao(editando ? 'Salvar alteração' : 'Incluir', 'botao botao-cheio', function () {
      var item = lerItem();
      if (!D.porAlimento[item.alimento]) { erro.textContent = 'Escolha o alimento.'; tipo.focus(); return; }
      if (!(item.qtd >= 0.5 && item.qtd <= 30)) { erro.textContent = 'Escolha uma quantidade entre meia e 30.'; qtd.focus(); return; }
      var indice;
      if (editando) {
        estado.itens[opcoes.indice] = item;
        indice = opcoes.indice;
      } else {
        estado.itens.push(item);
        indice = estado.itens.length - 1;
      }
      fecharEditor();
      salvar();
      desenharItens(indice);
      retorno((editando ? 'Alterado: ' : 'Incluído: ') + C.descreverItem(item) + ', no ' + minusculo(ref.rotulo) + '.');
    }));
    acoes.appendChild(botao('Cancelar', 'texto-botao', function () {
      var atalho = editorAberto && editorAberto.atalho;
      fecharEditor();
      if (atalho) atalho.focus();
    }));
    caixa.appendChild(acoes);
    atualizarPrevia();
    caixa.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    (alimentoId ? qtd : tipo).focus({ preventScroll: true });
  }

  function montarRefeicoes() {
    var caixa = $('alim-refeicoes');
    C.REFEICOES.forEach(function (ref) {
      var bloco = criar('fieldset', 'alim-refeicao');
      bloco.appendChild(criar('legend', 'titulo-s', ref.rotulo));
      var lista = criar('ul', 'alim-itens');
      lista.id = 'itens-' + ref.id;
      bloco.appendChild(lista);

      var atalhos = criar('div', 'alim-atalhos');
      atalhos.appendChild(criar('span', 'alim-atalhos-rotulo', 'Toque para incluir:'));
      SUGESTOES[ref.id].forEach(function (s) {
        var b = botao(D.porAlimento[s[0]].nome, 'alim-atalho');
        b.addEventListener('click', function () {
          abrirEditor(ref, { alimento: s[0], qtd: s[1], medida: s[2] || 0, atalho: b });
        });
        atalhos.appendChild(b);
      });
      var outro = botao('Outro alimento', 'alim-atalho alim-atalho-outro');
      outro.addEventListener('click', function () { abrirEditor(ref, { atalho: outro }); });
      atalhos.appendChild(outro);
      bloco.appendChild(atalhos);

      var editor = criar('div', 'alim-editor');
      editor.id = 'editor-' + ref.id;
      editor.hidden = true;
      bloco.appendChild(editor);
      caixa.appendChild(bloco);
    });
  }

  function desenharItens(destacar) {
    C.REFEICOES.forEach(function (ref) {
      var lista = $('itens-' + ref.id);
      lista.textContent = '';
      estado.itens.forEach(function (item, indice) {
        if (item.refeicao !== ref.id || !D.porAlimento[item.alimento]) return;
        var li = criar('li', 'alim-item' + (indice === destacar ? ' alim-item-destaque' : ''));
        var freq = C.FREQUENCIAS.filter(function (f) { return f.id === item.freq; })[0] || C.FREQUENCIAS[0];
        var descricao = C.descreverItem(item);
        li.appendChild(criar('span', 'alim-item-texto', descricao + (item.freq !== 'diario' ? ' · ' + freq.rotulo.toLowerCase() : '')));
        var acoes = criar('span', 'alim-item-acoes');
        var editar = botao('Editar', 'texto-botao', function () { abrirEditor(ref, { indice: indice }); });
        editar.setAttribute('aria-label', 'Editar ' + descricao);
        var tirar = botao('Tirar', 'texto-botao', function () {
          var removido = estado.itens.splice(indice, 1)[0];
          fecharEditor();
          salvar();
          desenharItens();
          retorno('Tirado: ' + descricao + '.', function () {
            estado.itens.splice(indice, 0, removido);
            salvar();
            desenharItens(indice);
          });
        });
        tirar.setAttribute('aria-label', 'Tirar ' + descricao);
        acoes.appendChild(editar);
        acoes.appendChild(tirar);
        li.appendChild(acoes);
        lista.appendChild(li);
      });
    });
    var n = C.nutrientes(estado.itens.filter(function (i) { return D.porAlimento[i.alimento]; }));
    $('alim-total-hoje').textContent = estado.itens.length
      ? 'Pelo que você marcou, são cerca de ' + kcal(n.kcal) + ' por dia.'
      : 'Nada marcado ainda.';
  }

  $('alim-ir-plano').addEventListener('click', function () { irPara('plano'); });
  $('alim-limpar').addEventListener('click', function () {
    if (!estado.itens.length) { retorno('Não há nada marcado para apagar.'); return; }
    if (!window.confirm('Apagar tudo o que você marcou?')) return;
    var antes = estado.itens;
    estado.itens = [];
    fecharEditor();
    salvar();
    desenharItens();
    retorno('Tudo apagado.', function () { estado.itens = antes; salvar(); desenharItens(); });
  });

  /* --- Passo 3: plano -------------------------------------------------------------------------- */

  function itensValidos() {
    return estado.itens.filter(function (i) { return D.porAlimento[i.alimento]; });
  }

  function planoAtual(metas) {
    var itens = itensValidos();
    var base = estado.modo === 'novo' || !itens.length ? C.planoNovo(metas) : C.planoAjustado(itens, metas);
    return C.aplicarPreferencias(base, estado.trocas);
  }

  /* Trocar um alimento do plano por outro de calorias parecidas */

  function abrirTrocas(item, li) {
    var aberta = li.querySelector('.alim-trocas');
    if (aberta) { aberta.remove(); return; }
    document.querySelectorAll('#alim-plano .alim-trocas').forEach(function (t) { t.remove(); });
    var caixa = criar('div', 'alim-trocas');
    var original = item.origem || item.alimento;
    caixa.appendChild(criar('p', 'alim-trocas-titulo', 'Trocar ' + minusculo(D.porAlimento[item.alimento].nome) + ' por:'));
    var opcoes = C.opcoesDeTroca(item, estado.perfil.uf, 5);
    if (!opcoes.length) caixa.appendChild(criar('p', 'alim-suave', 'Não encontramos uma troca com calorias parecidas para este item.'));
    var lista = criar('ul', 'alim-trocas-lista');
    opcoes.forEach(function (o) {
      var custo = Math.abs(o.diferencaMes) < 1 ? 'mesmo custo' : (o.diferencaMes > 0 ? reais(o.diferencaMes) + ' a mais por mês' : reais(-o.diferencaMes) + ' a menos por mês');
      var b = botao('', 'alim-troca');
      b.appendChild(criar('span', 'alim-troca-nome', C.descreverItem(o.item)));
      b.appendChild(criar('span', 'alim-suave', kcal(o.kcal) + ' · ' + custo));
      b.addEventListener('click', function () {
        var antes = estado.trocas[original];
        estado.trocas[original] = o.item.alimento === original ? undefined : o.item.alimento;
        if (!estado.trocas[original]) delete estado.trocas[original];
        salvar();
        desenharPlano();
        retorno('Trocado: ' + minusculo(D.porAlimento[original].nome) + ' por ' + minusculo(D.porAlimento[o.item.alimento].nome) + ' no plano todo.', function () {
          if (antes) estado.trocas[original] = antes; else delete estado.trocas[original];
          salvar();
          desenharPlano();
        });
      });
      var itemLista = criar('li');
      itemLista.appendChild(b);
      lista.appendChild(itemLista);
    });
    caixa.appendChild(lista);
    if (item.origem) {
      caixa.appendChild(botao('Voltar para ' + minusculo(D.porAlimento[item.origem].nome), 'texto-botao', function () {
        delete estado.trocas[item.origem];
        salvar();
        desenharPlano();
        retorno('Voltou para ' + minusculo(D.porAlimento[item.origem].nome) + '.');
      }));
    }
    li.appendChild(caixa);
    caixa.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function desenharTrocasEscolhidas() {
    var caixa = $('alim-minhas-trocas');
    caixa.textContent = '';
    var chaves = Object.keys(estado.trocas).filter(function (k) { return D.porAlimento[k] && D.porAlimento[estado.trocas[k]]; });
    caixa.hidden = !chaves.length;
    if (!chaves.length) return;
    caixa.appendChild(criar('p', 'alim-trocas-titulo', 'Suas trocas'));
    var lista = criar('ul', 'alim-minhas-trocas-lista');
    chaves.forEach(function (k) {
      var li = criar('li');
      li.appendChild(criar('span', '', D.porAlimento[k].nome + ' → ' + D.porAlimento[estado.trocas[k]].nome));
      li.appendChild(botao('Desfazer', 'texto-botao', function () {
        delete estado.trocas[k];
        salvar();
        desenharPlano();
        retorno('Voltou para ' + minusculo(D.porAlimento[k].nome) + '.');
      }));
      lista.appendChild(li);
    });
    caixa.appendChild(lista);
  }

  function numeroDestaque(rotulo, valor, detalhe) {
    var bloco = criar('div', 'alim-numero');
    bloco.appendChild(criar('dt', 'etiqueta', rotulo));
    bloco.appendChild(criar('dd', 'titulo-m', valor));
    if (detalhe) bloco.appendChild(criar('dd', 'alim-numero-detalhe', detalhe));
    return bloco;
  }

  function rotuloObjetivo() {
    return (C.OBJETIVOS.filter(function (o) { return o.id === estado.perfil.objetivo; })[0] || C.OBJETIVOS[1]).rotulo;
  }

  function desenharPlano() {
    var metas = C.gasto(estado.perfil);
    var hoje = C.nutrientes(itensValidos());
    var plano = planoAtual(metas);
    var noPlano = C.nutrientes(plano);
    var temItens = itensValidos().length > 0;

    var numeros = $('alim-numeros');
    numeros.textContent = '';
    numeros.appendChild(numeroDestaque('Seu gasto por dia', kcal(metas.total), 'Em repouso, ' + kcal(metas.basal) + '.'));
    numeros.appendChild(numeroDestaque('Meta para o seu objetivo', kcal(metas.meta), rotuloObjetivo() + '.'));
    if (temItens) {
      var dif = hoje.kcal - metas.meta;
      numeros.appendChild(numeroDestaque('O que você come hoje', kcal(hoje.kcal),
        Math.abs(dif) < 100 ? 'Perto da meta.' : (dif > 0 ? kcal(dif) + ' acima da meta.'
          : kcal(-dif) + ' abaixo da meta. É comum esquecer beliscos e o óleo da comida: confira se marcou tudo.')));
    }
    numeros.appendChild(numeroDestaque('Proteína no plano', noPlano.p + ' g', 'Meta: cerca de ' + metas.proteina + ' g por dia.'));

    $('alim-modo').hidden = !temItens;
    var novo = estado.modo === 'novo' || !temItens;
    $('alim-modo-ajustar').setAttribute('aria-pressed', String(!novo));
    $('alim-modo-novo').setAttribute('aria-pressed', String(novo));
    $('alim-plano-titulo').textContent = novo ? 'Plano novo, montado para a sua meta' : 'O que você já come, com ajustes';

    desenharTrocasEscolhidas();
    var caixa = $('alim-plano');
    caixa.textContent = '';
    C.REFEICOES.forEach(function (ref) {
      var itens = plano.filter(function (i) { return i.refeicao === ref.id; });
      if (!itens.length) return;
      var bloco = criar('section', 'alim-plano-refeicao');
      var cab = criar('header', 'alim-plano-cab');
      cab.appendChild(criar('h3', 'titulo-s', ref.rotulo));
      cab.appendChild(criar('span', 'etiqueta', kcal(C.nutrientes(itens).kcal)));
      bloco.appendChild(cab);
      var lista = criar('ul', 'alim-plano-itens');
      itens.forEach(function (item) {
        var li = criar('li');
        var linha = criar('p', 'alim-plano-linha');
        linha.appendChild(criar('span', '', C.descreverItem(item)));
        if (item.freq && item.freq !== 'diario') {
          linha.appendChild(criar('span', 'alim-suave', ' · ' + C.FREQUENCIAS.filter(function (f) { return f.id === item.freq; })[0].rotulo.toLowerCase()));
        }
        if (item.preferencia) linha.appendChild(criar('span', 'alim-selo', 'Sua troca'));
        else if (item.novo) linha.appendChild(criar('span', 'alim-selo', 'Novo'));
        else if (item.antes) linha.appendChild(criar('span', 'alim-selo', 'Trocado'));
        else if (item.porcao) linha.appendChild(criar('span', 'alim-selo alim-selo-claro', item.porcao === 'menos' ? 'Porção menor' : 'Porção maior'));
        var trocar = botao('Não gosto: trocar', 'texto-botao alim-trocar');
        trocar.setAttribute('aria-label', 'Trocar ' + C.descreverItem(item));
        trocar.addEventListener('click', function () { abrirTrocas(item, li); });
        linha.appendChild(trocar);
        li.appendChild(linha);
        if (item.preferencia) li.appendChild(criar('p', 'alim-suave', 'No lugar de ' + minusculo(item.preferencia) + ', como você escolheu.'));
        if (item.antes) li.appendChild(criar('p', 'alim-suave', 'Antes: ' + item.antes + '.'));
        if (item.motivo) li.appendChild(criar('p', 'alim-suave', item.motivo));
        lista.appendChild(li);
      });
      bloco.appendChild(lista);
      caixa.appendChild(bloco);
    });

    var dif2 = noPlano.kcal - metas.meta;
    var fim = ', perto da meta.';
    if (dif2 > 150) {
      fim = ', ' + kcal(dif2) + ' acima da meta. Para chegar mais perto, diminua um pouco o arroz, o pão ou a massa.';
    } else if (dif2 < -150 && estado.perfil.objetivo === 'perder' && noPlano.kcal >= metas.basal) {
      fim = ', ' + kcal(-dif2) + ' abaixo da meta, o que também funciona para perder peso. Se bater fome, aumente um pouco o arroz, o pão ou a massa.';
    } else if (dif2 < -150) {
      fim = ', ' + kcal(-dif2) + ' abaixo da meta. Para chegar mais perto, aumente um pouco o arroz, o pão ou a massa.';
    }
    $('alim-plano-total').textContent = 'Total do plano: ' + kcal(noPlano.kcal) + ' por dia' + fim;
  }

  function escolherModo(modo, texto) {
    if (estado.modo === modo) { retorno('Este plano já está aberto.'); return; }
    estado.modo = modo;
    salvar();
    desenharPlano();
    retorno(texto);
  }

  $('alim-modo-ajustar').addEventListener('click', function () { escolherModo('ajustar', 'Mostrando o que você já come, com ajustes.'); });
  $('alim-modo-novo').addEventListener('click', function () { escolherModo('novo', 'Mostrando um plano novo, montado para a sua meta.'); });
  $('alim-ir-compras').addEventListener('click', function () { irPara('compras'); });

  /* --- Passo 4: compras ------------------------------------------------------------------------ */

  var FREQ_COMPRA = [
    { id: 'mes', rotulo: 'Compra do mês' },
    { id: 'quinzena', rotulo: 'A cada 15 dias, mais ou menos' },
    { id: 'semana', rotulo: 'Toda semana' },
    { id: 'dias', rotulo: 'A cada 2 ou 3 dias' },
    { id: 'fora', rotulo: 'Comida pronta, comprada na hora' }
  ];

  // Alternativas mais baratas com o mesmo papel no prato
  var ECONOMIAS = [
    ['frango', 'coxa', 'Coxa e sobrecoxa no lugar do peito de frango'],
    ['carne', 'coxa', 'Frango no lugar da carne bovina em parte dos dias'],
    ['peixe', 'sardinha', 'Sardinha no lugar do filé de peixe'],
    ['maca', 'banana', 'Banana no lugar da maçã'],
    ['azeite', 'oleo', 'Óleo para cozinhar e azeite só para temperar'],
    ['pao_integral', 'pao_frances', 'Pão francês em parte dos dias, se o orçamento apertar']
  ];

  function quantidadeLegivel(gramas, produto) {
    var bebida = /litro|ml/.test(produto.embalagem);
    function contar(n, um, varios) {
      var arredondado = Math.round(n * 2) / 2;
      return arredondado.toLocaleString('pt-BR') + ' ' + (arredondado <= 1 ? um : varios);
    }
    if (produto.id === 'ovos') return contar(gramas / 50, 'ovo', 'ovos');
    if (produto.id === 'banana') return contar(gramas / 70, 'banana', 'bananas');
    if (gramas >= 1000) return (gramas / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + (bebida ? ' litro' : ' kg');
    return Math.round(gramas) + (bebida ? ' ml' : ' g');
  }

  function textoIntervalo(dias) {
    if (dias < 1) return Math.round(7 / dias) + ' por semana';
    var d = Math.round(dias);
    if (d <= 1) return 'todo dia';
    if (d < 14) return 'a cada ' + d + ' dias';
    if (d < 45) return 'a cada ' + Math.round(d / 7) + ' semanas';
    return 'a cada ' + Math.round(d / 30) + ' meses';
  }

  function linhaDeCompra(l) {
    var li = criar('li', 'alim-compra');
    var cab = criar('div', 'alim-compra-cab');
    var nome = criar('p', 'alim-compra-nome', l.produto.nome);
    nome.appendChild(criar('span', 'alim-suave', ' · ' + l.produto.embalagem));
    cab.appendChild(nome);
    cab.appendChild(criar('p', 'alim-compra-valor', reais(l.custoMes) + ' por mês'));
    li.appendChild(cab);

    var detalhes = [];
    if (l.granel) {
      detalhes.push(reais(l.preco.valor) + ' por ' + l.produto.embalagem.replace(/^1 /, ''));
      detalhes.push('você usa ' + quantidadeLegivel(l.porDia, l.produto) + ' por dia');
      detalhes.push('leve cerca de ' + quantidadeLegivel(l.porCompra, l.produto) + ' por semana');
    } else if (l.pronto) {
      detalhes.push(reais(l.preco.valor) + ' cada');
      detalhes.push('cerca de ' + Math.round(l.porcoesMes) + ' por mês');
    } else {
      var dias = Math.round(l.diasParaAcabar);
      detalhes.push(reais(l.preco.valor) + ' cada');
      detalhes.push('você usa ' + quantidadeLegivel(l.porDia, l.produto) + ' por dia');
      detalhes.push(l.diasParaAcabar >= 1
        ? 'uma embalagem dá para ' + (dias === 1 ? '1 dia' : dias + ' dias')
        : 'uma embalagem dá para menos de um dia');
      detalhes.push('compre ' + textoIntervalo(l.intervalo));
    }
    li.appendChild(criar('p', 'alim-suave', detalhes.join(' · ') + '.'));
    if (l.perda > 0.15) {
      li.appendChild(criar('p', 'alim-alerta', 'Estraga antes de acabar: cerca de ' + Math.round(l.perda * 100) +
        '% vai para o lixo. Prefira embalagens menores ou congele em porções.'));
    }
    li.appendChild(criar('p', 'alim-fonte', l.preco.fonte === 'dieese' ? 'Preço médio do DIEESE' : 'Preço estimado para a região'));
    return li;
  }

  function contas() {
    var metas = C.gasto(estado.perfil);
    var plano = planoAtual(metas);
    var hoje = itensValidos();
    return {
      metas: metas, plano: plano,
      doPlano: C.compras(plano, estado.perfil.uf),
      deHoje: hoje.length ? C.compras(hoje, estado.perfil.uf) : null
    };
  }

  function textoVeredito(doPlano, deHoje) {
    if (!deHoje) return 'Marque o que você come hoje para comparar com o que gasta atualmente.';
    var dif = doPlano.totalMes - deHoje.totalMes;
    var pct = deHoje.totalMes ? dif / deHoje.totalMes : 0;
    if (pct <= -0.05) return 'Comer melhor sai mais barato: você economiza ' + reais(-dif) + ' por mês, ou ' + reais(-dif / 30) + ' por dia.';
    if (pct < 0.05) return 'O plano custa praticamente o mesmo que você gasta hoje: diferença de ' + reais(Math.abs(dif)) + ' por mês.';
    return 'O plano custa ' + reais(dif) + ' a mais por mês, ' + reais(dif / 30) + ' por dia.';
  }

  function desenharCompras() {
    var uf = estado.perfil.uf;
    var estadoNome = D.porEstado[uf];
    var c = contas();
    var doPlano = c.doPlano;
    var deHoje = c.deHoje;

    if (!estado.concluido) {
      estado.concluido = true;
      salvar();
      $('item-resumo').hidden = false;
    }

    desenharDespensa(doPlano);

    var resumo = $('alim-custo');
    resumo.textContent = '';
    if (deHoje) resumo.appendChild(numeroDestaque('O que você come hoje', reais(deHoje.totalMes), reais(deHoje.totalDia) + ' por dia.'));
    resumo.appendChild(numeroDestaque('Com o plano', reais(doPlano.totalMes), reais(doPlano.totalDia) + ' por dia.'));
    resumo.appendChild(numeroDestaque('Do salário mínimo', Math.round(doPlano.totalMes / D.SALARIO_MINIMO * 100) + '%',
      'O mínimo de 2026 é ' + reais(D.SALARIO_MINIMO) + '.'));
    $('alim-veredito').textContent = textoVeredito(doPlano, deHoje) +
      (deHoje && doPlano.totalMes > deHoje.totalMes * 1.05 ? ' Veja abaixo onde dá para economizar.' : '');

    var dicas = $('alim-economia');
    dicas.textContent = '';
    var porProduto = {};
    doPlano.lista.forEach(function (l) { porProduto[l.produto.id] = l; });
    ECONOMIAS.forEach(function (e) {
      var linha = porProduto[e[0]];
      if (!linha || linha.pronto) return;
      var caro = C.precoDe(D.porProduto[e[0]], uf).valor / D.porProduto[e[0]].qtd;
      var barato = C.precoDe(D.porProduto[e[1]], uf).valor / D.porProduto[e[1]].qtd;
      var economia = (caro - barato) * linha.porDia * 30;
      if (economia >= 5) dicas.appendChild(criar('li', '', e[2] + ': cerca de ' + reais(economia) + ' a menos por mês.'));
    });
    $('alim-economia-bloco').hidden = !dicas.children.length;

    var lista = estado.listaDe === 'hoje' && deHoje ? deHoje : doPlano;
    $('alim-lista-hoje').hidden = !deHoje;
    $('alim-lista-plano').setAttribute('aria-pressed', String(lista === doPlano));
    $('alim-lista-hoje').setAttribute('aria-pressed', String(lista !== doPlano));
    var caixa = $('alim-compras');
    caixa.textContent = '';
    FREQ_COMPRA.forEach(function (f) {
      var linhas = lista.lista.filter(function (l) { return C.frequenciaDeCompra(l) === f.id; });
      if (!linhas.length) return;
      var bloco = criar('section', 'alim-compras-grupo');
      var cab = criar('header', 'alim-plano-cab');
      cab.appendChild(criar('h3', 'titulo-s', f.rotulo));
      cab.appendChild(criar('span', 'etiqueta', reais(linhas.reduce(function (t, l) { return t + l.custoMes; }, 0)) + ' por mês'));
      bloco.appendChild(cab);
      var ul = criar('ul', 'alim-compras-lista');
      linhas.forEach(function (l) { ul.appendChild(linhaDeCompra(l)); });
      bloco.appendChild(ul);
      caixa.appendChild(bloco);
    });

    var diferenca = Math.round((C.indiceRegional(uf) - 1) * 100);
    $('alim-fontes').textContent = 'Preços de ' + estadoNome.capital + '. Arroz, feijão, carne, leite, tomate, batata, pão francês, café, banana, açúcar, óleo e manteiga usam o preço médio do DIEESE de ' +
      D.DIEESE_DATA + ', coletado em supermercados, sem promoções. Os demais usam um preço comum de prateleira, ajustado para ' + estadoNome.capital +
      (diferenca === 0 ? ', que está na média das capitais.' : ', onde a comida custa cerca de ' + Math.abs(diferenca) + '% ' + (diferenca > 0 ? 'a mais' : 'a menos') + ' que a média das capitais.') +
      textoDaCorrecao() + ' No interior, os preços podem ser diferentes. Tudo é estimativa para uma pessoa.';
  }

  // Todo mês o IBGE divulga quanto a comida subiu ou caiu, e os preços acompanham
  function textoDaCorrecao() {
    if (!precos || !precos.ate) return '';
    var variacao = Math.round((precos.fator - 1) * 1000) / 10;
    return ' Os preços foram corrigidos pela inflação dos alimentos do IBGE até ' + precos.ateTexto +
      (variacao === 0 ? ', sem variação no período' : ' (' + (variacao > 0 ? '+' : '') + String(variacao).replace('.', ',') + '%)') + '.';
  }

  function carregarPrecos() {
    if (!api) return;
    api.get('api/precos.php').then(function (r) {
      if (!r.ok || !r.dados.fator) return;
      precos = r.dados;
      D.CORRECAO = precos.fator;
      if (!$('passo-compras').hidden) desenharCompras();
      if (!$('passo-plano').hidden) desenharPlano();
      if (!$('passo-resumo').hidden) desenharResumo();
    });
  }

  /* --- Avisos por e-mail ---------------------------------------------------------------------------- */

  function mostrarLembrete() {
    var caixa = $('alim-lembrete-email');
    var texto = $('alim-lembrete-texto');
    var pode = conta.logado && estado.guardarNaConta && conta.emailVerificado;
    caixa.disabled = !pode;
    caixa.checked = Boolean(pode && estado.lembretes);
    if (!conta.logado) {
      texto.textContent = 'Para receber um e-mail quando algo estiver para acabar, entre na sua conta e marque, no passo 1, a opção de guardar na conta.';
    } else if (!estado.guardarNaConta) {
      texto.textContent = 'Para receber os avisos, marque no passo 1 a opção de guardar suas informações na conta.';
    } else if (!conta.emailVerificado) {
      texto.textContent = 'Confirme seu e-mail em Minha conta para receber os avisos.';
    } else {
      texto.textContent = estado.lembretes
        ? 'Ligado. Quando um item que você comprou estiver para acabar, mandamos um e-mail dois dias antes.'
        : 'Quando um item que você comprou estiver para acabar, mandamos um e-mail dois dias antes.';
    }
  }

  $('alim-lembrete-email').addEventListener('change', function () {
    estado.lembretes = $('alim-lembrete-email').checked;
    salvar();
    mostrarLembrete();
    retorno(estado.lembretes ? 'Pronto: avisamos por e-mail quando algo estiver para acabar.' : 'Avisos por e-mail desligados.');
  });

  /* --- Lista de compras: o que tem em casa e quando comprar ------------------------------------- */

  function dataCurta(iso) {
    var p = String(iso).split('-');
    return p[2] + '/' + p[1];
  }

  function textoFaltam(dias) {
    if (dias <= 0) return 'hoje';
    return dias === 1 ? 'amanhã' : 'em ' + dias + ' dias';
  }

  // Lista do plano, sem a comida pronta, com a situação de cada produto em casa
  function linhasDaDespensa(doPlano) {
    return doPlano.lista.filter(function (l) { return !l.pronto; }).map(function (l) {
      var registro = estado.despensa[l.produto.id];
      return { linha: l, registro: registro, situacao: C.situacaoNoEstoque(l, registro) };
    });
  }

  function avisosDaDespensa(doPlano) {
    return linhasDaDespensa(doPlano).filter(function (x) {
      return x.situacao.situacao !== 'ok' && x.registro && x.registro.compradoEm;
    });
  }

  function descreverSugestao(l, sugestao) {
    var preco = l.preco.valor;
    if (sugestao.granel) {
      return 'Para a semana, leve cerca de ' + quantidadeLegivel(sugestao.gramas, l.produto) + ' (' + reais(preco * sugestao.gramas / l.produto.qtd) + ').';
    }
    var texto = '';
    if (sugestao.mes) texto = 'Você precisa de cerca de ' + quantidadeLegivel(sugestao.mes, l.produto) + ' por mês. ';
    texto += 'Leve ' + (sugestao.embalagens === 1 ? '1 ' + l.produto.embalagem : sugestao.embalagens + ' × ' + l.produto.embalagem) +
      ', por ' + reais(preco * sugestao.embalagens) + '. Dá para cerca de ' + Math.max(1, Math.round(sugestao.dias)) + ' dias.';
    return texto;
  }

  function marcarComprado(l, embalagens, gramas) {
    var id = l.produto.id;
    var antes = estado.despensa[id] ? JSON.parse(JSON.stringify(estado.despensa[id])) : null;
    estado.despensa[id] = {
      compradoEm: C.hojeISO(), embalagens: embalagens, gramas: gramas,
      ritmo: antes && antes.ritmo ? antes.ritmo : 1, acabouEm: ''
    };
    salvar();
    desenharCompras();
    var sit = C.situacaoNoEstoque(l, estado.despensa[id]);
    retorno('Comprado: ' + minusculo(l.produto.nome) + '. Deve durar até ' + dataCurta(sit.acabaEm) + '.', function () {
      if (antes) estado.despensa[id] = antes; else delete estado.despensa[id];
      salvar();
      desenharCompras();
    });
  }

  function marcarAcabou(l) {
    var id = l.produto.id;
    var antes = JSON.parse(JSON.stringify(estado.despensa[id]));
    var ritmo = C.novoRitmo(l, antes);
    estado.despensa[id] = { compradoEm: antes.compradoEm, embalagens: antes.embalagens, gramas: antes.gramas, ritmo: ritmo, acabouEm: C.hojeISO() };
    salvar();
    desenharCompras();
    var aviso = Math.abs(ritmo - (antes.ritmo || 1)) < 0.05 ? '' :
      (ritmo > (antes.ritmo || 1) ? ' Você usa mais que o previsto: as próximas datas vêm mais cedo.' : ' Você usa menos que o previsto: as próximas datas vêm mais tarde.');
    retorno('Anotado: ' + minusculo(l.produto.nome) + ' acabou.' + aviso, function () {
      estado.despensa[id] = antes;
      salvar();
      desenharCompras();
    });
  }

  function linhaDaDespensa(x) {
    var l = x.linha;
    var sit = x.situacao;
    var li = criar('li', 'alim-despensa-item alim-despensa-' + sit.situacao);
    var cab = criar('div', 'alim-despensa-linha');
    var marca = criar('label', 'campo-marcar alim-despensa-marca');
    var caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.checked = sit.situacao !== 'comprar';
    marca.appendChild(caixa);
    marca.appendChild(criar('span', 'alim-compra-nome', l.produto.nome));
    cab.appendChild(marca);

    var sugestao = C.sugestaoDeCompra(l, sit.ritmo);
    var quantas = null;
    if (sit.situacao === 'comprar' && !sugestao.granel) {
      quantas = document.createElement('select');
      quantas.setAttribute('aria-label', 'Quantas embalagens de ' + l.produto.nome);
      for (var n = 1; n <= Math.max(6, sugestao.embalagens); n += 1) {
        quantas.appendChild(new Option(n + ' × ' + l.produto.embalagem, String(n)));
      }
      quantas.value = String(sugestao.embalagens);
      cab.appendChild(quantas);
    }
    li.appendChild(cab);

    var detalhe = criar('p', 'alim-suave');
    if (sit.situacao === 'comprar') {
      var porque = '';
      if (sit.motivo === 'acabou') porque = 'Acabou em ' + dataCurta(x.registro.acabouEm) + '. ';
      if (sit.motivo === 'deve-ter-acabado') porque = 'Pela previsão, acabou em ' + dataCurta(sit.acabaEm) + '. Se ainda tem, toque em Ainda tenho. ';
      detalhe.textContent = porque + descreverSugestao(l, sugestao);
    } else {
      detalhe.textContent = 'Em casa desde ' + dataCurta(x.registro.compradoEm) + '. Resta cerca de ' + quantidadeLegivel(sit.resta, l.produto) +
        ', que acaba ' + textoFaltam(sit.faltam) + ' (' + dataCurta(sit.acabaEm) + ').' +
        (sit.situacao === 'breve' ? ' Já coloque na lista.' : '') +
        (sit.estraga ? ' Parte pode estragar antes de acabar.' : '');
    }
    li.appendChild(detalhe);

    caixa.addEventListener('change', function () {
      if (caixa.checked) {
        var emb = quantas ? Number(quantas.value) : 0;
        marcarComprado(l, emb, sugestao.granel ? sugestao.gramas : emb * l.produto.qtd);
      } else {
        var antes = estado.despensa[l.produto.id];
        delete estado.despensa[l.produto.id];
        salvar();
        desenharCompras();
        retorno('Desmarcado: ' + minusculo(l.produto.nome) + '.', function () {
          estado.despensa[l.produto.id] = antes;
          salvar();
          desenharCompras();
        });
      }
    });

    var acoes = criar('div', 'alim-despensa-acoes');
    if (sit.situacao !== 'comprar') {
      acoes.appendChild(botao('Acabou', 'texto-botao', function () { marcarAcabou(l); }));
    } else if (sit.motivo === 'deve-ter-acabado') {
      // A previsão errou para menos: a pessoa ainda tem o produto
      acoes.appendChild(botao('Ainda tenho', 'texto-botao', function () {
        var r = estado.despensa[l.produto.id];
        r.ritmo = Math.max(0.5, (r.ritmo || 1) * 0.8);
        salvar();
        desenharCompras();
        retorno('Certo: a previsão de ' + minusculo(l.produto.nome) + ' ficou mais longa.');
      }));
    }
    if (acoes.children.length) li.appendChild(acoes);
    return li;
  }

  function desenharDespensa(doPlano) {
    var caixa = $('alim-despensa');
    caixa.textContent = '';
    var linhas = linhasDaDespensa(doPlano);
    var grupos = [
      { id: 'comprar', titulo: 'Para comprar', vazio: 'Nada para comprar agora.' },
      { id: 'breve', titulo: 'Acaba em breve' },
      { id: 'ok', titulo: 'Em casa' }
    ];
    grupos.forEach(function (g) {
      var doGrupo = linhas.filter(function (x) { return x.situacao.situacao === g.id; });
      if (!doGrupo.length && !g.vazio) return;
      var bloco = criar('section', 'alim-despensa-grupo');
      bloco.appendChild(criar('h4', 'etiqueta', g.titulo + (doGrupo.length ? ' (' + doGrupo.length + ')' : '')));
      if (!doGrupo.length) {
        bloco.appendChild(criar('p', 'alim-suave', g.vazio));
      } else {
        doGrupo.sort(function (a, b) { return (a.situacao.faltam || 0) - (b.situacao.faltam || 0); });
        var ul = criar('ul', 'alim-despensa-lista');
        doGrupo.forEach(function (x) { ul.appendChild(linhaDaDespensa(x)); });
        bloco.appendChild(ul);
      }
      caixa.appendChild(bloco);
    });
  }

  $('alim-copiar-lista').addEventListener('click', function () {
    var c = contas();
    var linhas = linhasDaDespensa(c.doPlano).filter(function (x) { return x.situacao.situacao !== 'ok'; });
    if (!linhas.length) { retorno('Sua lista está vazia: você tem tudo em casa.'); return; }
    var texto = 'Lista de compras\n' + linhas.map(function (x) {
      var s = C.sugestaoDeCompra(x.linha, x.situacao.ritmo);
      return '- ' + x.linha.produto.nome + ': ' + (s.granel ? quantidadeLegivel(s.gramas, x.linha.produto) : s.embalagens + ' × ' + x.linha.produto.embalagem);
    }).join('\n');
    function copiado() { retorno('Lista copiada. Cole no WhatsApp ou nas notas do celular.'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(copiado, function () { window.prompt('Copie a lista:', texto); });
    } else {
      window.prompt('Copie a lista:', texto);
    }
  });

  /* --- Acompanhamento: peso e medidas ------------------------------------------------------------ */

  var MEDIDAS_REGISTRO = [
    { id: 'peso', rotulo: 'Peso', unidade: 'kg', min: 40, max: 250 },
    { id: 'cintura', rotulo: 'Cintura', unidade: 'cm', min: 40, max: 200 },
    { id: 'torax', rotulo: 'Tórax', unidade: 'cm', min: 50, max: 200 },
    { id: 'braco', rotulo: 'Braço', unidade: 'cm', min: 15, max: 70 },
    { id: 'coxa', rotulo: 'Coxa', unidade: 'cm', min: 30, max: 100 }
  ];

  function numeroDe(texto) {
    var n = Number(String(texto || '').replace(',', '.'));
    return isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : '';
  }

  function formatarMedida(v, unidade) {
    return v === '' || v === undefined || v === null ? '—' : String(v).replace('.', ',') + ' ' + unidade;
  }

  function desenharAcompanhamento() {
    if (!estado.inicioPlano) {
      estado.inicioPlano = C.hojeISO();
      salvar();
    }
    $('alim-inicio').value = estado.inicioPlano;
    if (!$('reg-data').value) $('reg-data').value = C.hojeISO();
    if (!estado.registros.length && !$('reg-peso').value && estado.perfil.peso) {
      $('reg-peso').value = String(estado.perfil.peso).replace('.', ',');
    }

    var corpo = $('alim-registros');
    corpo.textContent = '';
    estado.registros.forEach(function (r, i) {
      var tr = criar('tr');
      tr.appendChild(criar('td', '', dataCurta(r.data) + '/' + r.data.slice(2, 4)));
      MEDIDAS_REGISTRO.forEach(function (m) { tr.appendChild(criar('td', '', formatarMedida(r[m.id], m.unidade))); });
      var td = criar('td');
      td.appendChild(botao('Apagar', 'texto-botao', function () {
        var removido = estado.registros.splice(i, 1)[0];
        salvar();
        desenharAcompanhamento();
        retorno('Registro de ' + dataCurta(removido.data) + ' apagado.', function () {
          estado.registros.splice(i, 0, removido);
          salvar();
          desenharAcompanhamento();
        });
      }));
      tr.appendChild(td);
      corpo.appendChild(tr);
    });
    $('alim-tabela').hidden = !estado.registros.length;
    desenharEvolucao();
  }

  function variacao(primeiro, ultimo, id) {
    var lista = estado.registros.filter(function (r) { return r[id] !== '' && r[id] !== undefined; });
    if (lista.length < 2) return null;
    return Math.round((lista[lista.length - 1][id] - lista[0][id]) * 10) / 10;
  }

  // Lê os números como um treinador leria: peso e cintura juntos dizem mais que o peso sozinho
  function leituraDaEvolucao() {
    var r = estado.registros;
    var dPeso = variacao(r[0], r[r.length - 1], 'peso');
    var dCintura = variacao(r[0], r[r.length - 1], 'cintura');
    var dBraco = variacao(r[0], r[r.length - 1], 'braco');
    var dTorax = variacao(r[0], r[r.length - 1], 'torax');
    var musculo = (dBraco !== null && dBraco > 0.3) || (dTorax !== null && dTorax > 0.5);
    if (dPeso === null && dCintura === null) return 'Faça um segundo registro para ver a sua evolução.';
    if (dPeso !== null && dPeso < -0.3 && dCintura !== null && dCintura < -0.3) {
      return 'Você está emagrecendo: ' + String(-dPeso).replace('.', ',') + ' kg e ' + String(-dCintura).replace('.', ',') + ' cm de cintura a menos.';
    }
    if (dPeso !== null && dPeso > 0.3 && dCintura !== null && dCintura <= 0.5 && musculo) {
      return 'Sinais de ganho de massa muscular: peso e ' + (dBraco > 0.3 ? 'braço' : 'tórax') + ' subindo, com a cintura estável.';
    }
    if (dPeso !== null && dPeso > 0.3 && dCintura !== null && dCintura > 0.5) {
      return 'Peso e cintura subindo juntos: parte do ganho pode ser gordura. Vale rever as porções com o objetivo.';
    }
    if (dPeso !== null && Math.abs(dPeso) <= 0.3 && dCintura !== null && dCintura < -0.3) {
      return 'Peso estável e cintura diminuindo: você está trocando gordura por massa magra.';
    }
    if (dPeso !== null && dPeso < -0.3) return 'Você perdeu ' + String(-dPeso).replace('.', ',') + ' kg. Registre a cintura para saber se é gordura que está saindo.';
    if (dPeso !== null && dPeso > 0.3) return 'Você ganhou ' + String(dPeso).replace('.', ',') + ' kg. Registre cintura e braço para saber se é músculo ou gordura.';
    return 'Medidas estáveis até aqui. Mudanças aparecem em duas a quatro semanas.';
  }

  function desenharEvolucao() {
    var caixa = $('alim-evolucao');
    caixa.textContent = '';
    var r = estado.registros;
    if (!r.length) {
      caixa.appendChild(criar('p', 'alim-suave', 'Nenhum registro ainda. Comece hoje: é o ponto de partida.'));
      return;
    }
    var dias = C.diasEntre(estado.inicioPlano || r[0].data, C.hojeISO());
    var numeros = criar('dl', 'alim-numeros');
    numeros.appendChild(numeroDestaque('Desde o início', Math.max(0, dias) + (dias === 1 ? ' dia' : ' dias'), 'Começou em ' + dataCurta(estado.inicioPlano || r[0].data) + '.'));
    MEDIDAS_REGISTRO.forEach(function (m) {
      var d = variacao(null, null, m.id);
      if (d === null) return;
      numeros.appendChild(numeroDestaque(m.rotulo, (d > 0 ? '+' : '') + String(d).replace('.', ',') + ' ' + m.unidade, 'Do primeiro ao último registro.'));
    });
    caixa.appendChild(numeros);
    var leitura = criar('p', 'alim-veredito', leituraDaEvolucao());
    caixa.appendChild(leitura);

    // Perder mais de 1 kg por semana costuma levar músculo junto
    var comPeso = r.filter(function (x) { return x.peso; });
    if (comPeso.length >= 2) {
      var semanas = Math.max(1, C.diasEntre(comPeso[0].data, comPeso[comPeso.length - 1].data) / 7);
      var porSemana = (comPeso[comPeso.length - 1].peso - comPeso[0].peso) / semanas;
      if (porSemana < -1) caixa.appendChild(criar('p', 'alim-alerta', 'Você está perdendo mais de 1 kg por semana. É rápido demais: aumente um pouco as porções para não perder músculo.'));
    }
  }

  $('alim-inicio').addEventListener('change', function () {
    if (!$('alim-inicio').value) return;
    estado.inicioPlano = $('alim-inicio').value;
    salvar();
    desenharEvolucao();
    retorno('Início do plano: ' + dataCurta(estado.inicioPlano) + '.');
  });

  $('reg-do-cadastro').addEventListener('click', function () {
    var m = conta.medidas || {};
    ['peso', 'cintura', 'torax', 'braco', 'coxa'].forEach(function (id) {
      if (m[id]) $('reg-' + id).value = String(Math.round(Number(m[id]) * 10) / 10).replace('.', ',');
    });
    retorno('Trouxemos as medidas do seu cadastro. Confira antes de registrar.');
  });

  $('alim-registro').addEventListener('submit', function (e) {
    e.preventDefault();
    var erro = $('reg-erro');
    erro.textContent = '';
    var data = $('reg-data').value;
    if (!data) { erro.textContent = 'Escolha a data.'; return; }
    if (data > C.hojeISO()) { erro.textContent = 'A data não pode ser no futuro.'; return; }
    var registro = { data: data };
    var algum = false;
    for (var i = 0; i < MEDIDAS_REGISTRO.length; i += 1) {
      var m = MEDIDAS_REGISTRO[i];
      var v = numeroDe($('reg-' + m.id).value);
      if ($('reg-' + m.id).value.trim() && (v === '' || v < m.min || v > m.max)) {
        erro.textContent = m.rotulo + ': informe um valor entre ' + m.min + ' e ' + m.max + ' ' + m.unidade + '.';
        $('reg-' + m.id).focus();
        return;
      }
      registro[m.id] = v;
      if (v !== '') algum = true;
    }
    if (!algum) { erro.textContent = 'Informe pelo menos o peso ou uma medida.'; return; }
    // Um registro por dia: registrar de novo na mesma data substitui
    estado.registros = estado.registros.filter(function (r) { return r.data !== data; });
    estado.registros.push(registro);
    estado.registros.sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (estado.registros.length > 200) estado.registros = estado.registros.slice(-200);
    var ultimo = estado.registros[estado.registros.length - 1];
    var mudouPeso = ultimo === registro && registro.peso && registro.peso !== estado.perfil.peso;
    if (mudouPeso) {
      estado.perfil.peso = registro.peso;
      mostrarPerfil();
    }
    salvar();
    ['peso', 'cintura', 'torax', 'braco', 'coxa'].forEach(function (id) { $('reg-' + id).value = ''; });
    $('reg-data').value = C.hojeISO();
    desenharAcompanhamento();
    retorno('Registrado em ' + dataCurta(data) + '.' + (mudouPeso ? ' Atualizamos seu peso no cálculo do plano.' : ''));
  });

  $('alim-ir-acompanhamento').addEventListener('click', function () { irPara('acompanhamento'); });
  $('alim-acomp-resumo').addEventListener('click', function () { irPara('resumo'); });

  function escolherLista(qual) {
    if (estado.listaDe === qual) { retorno('Esta lista já está aberta.'); return; }
    estado.listaDe = qual;
    salvar();
    desenharCompras();
    retorno(qual === 'hoje' ? 'Mostrando as compras do que você come hoje.' : 'Mostrando as compras do plano.');
  }

  $('alim-lista-plano').addEventListener('click', function () { escolherLista('plano'); });
  $('alim-lista-hoje').addEventListener('click', function () { escolherLista('hoje'); });
  $('alim-voltar-plano').addEventListener('click', function () { irPara('plano'); });
  $('alim-ir-resumo').addEventListener('click', function () { irPara('resumo'); });

  /* --- Resumo: o painel para voltar e alterar ------------------------------------------------------ */

  function cartao(titulo, linhas, rotuloBotao, passo) {
    var bloco = criar('section', 'alim-cartao');
    bloco.appendChild(criar('h3', 'titulo-s', titulo));
    var lista = criar('dl', 'alim-cartao-lista');
    linhas.forEach(function (l) {
      var linha = criar('div', 'alim-cartao-linha');
      linha.appendChild(criar('dt', '', l[0]));
      linha.appendChild(criar('dd', '', l[1]));
      lista.appendChild(linha);
    });
    bloco.appendChild(lista);
    bloco.appendChild(botao(rotuloBotao, 'botao', function () { irPara(passo); }));
    return bloco;
  }

  function desenharResumo() {
    var p = estado.perfil;
    var c = contas();
    var hoje = C.nutrientes(itensValidos());
    var noPlano = C.nutrientes(c.plano);
    var atividade = (C.ATIVIDADES.filter(function (a) { return a.id === p.atividade; })[0] || C.ATIVIDADES[0]).rotulo;
    var caixa = $('alim-cartoes');
    caixa.textContent = '';
    caixa.appendChild(cartao('Seus dados', [
      ['Sexo e idade', (p.sexo === 'f' ? 'Feminino' : 'Masculino') + ', ' + p.idade + ' anos'],
      ['Altura e peso', p.altura + ' cm, ' + String(p.peso).replace('.', ',') + ' kg'],
      ['Rotina', atividade],
      ['Objetivo', rotuloObjetivo()],
      ['Região', D.porEstado[p.uf].nome]
    ], 'Alterar meus dados', 'voce'));
    caixa.appendChild(cartao('Energia', [
      ['Gasto por dia', kcal(c.metas.total)],
      ['Meta', kcal(c.metas.meta)],
      ['Proteína', 'cerca de ' + c.metas.proteina + ' g por dia']
    ], 'Ver meu plano', 'plano'));
    caixa.appendChild(cartao('O que você come hoje', itensValidos().length ? [
      ['Itens marcados', String(itensValidos().length)],
      ['Por dia', 'cerca de ' + kcal(hoje.kcal)]
    ] : [['Itens marcados', 'Nenhum ainda']], 'Alterar o que eu como', 'comida'));
    caixa.appendChild(cartao('Plano', [
      ['Tipo', estado.modo === 'novo' || !itensValidos().length ? 'Plano novo' : 'O que você já come, com ajustes'],
      ['Por dia', kcal(noPlano.kcal) + ', ' + noPlano.p + ' g de proteína']
    ], 'Ver meu plano', 'plano'));
    caixa.appendChild(cartao('Compras', [
      ['Com o plano', reais(c.doPlano.totalMes) + ' por mês'],
      c.deHoje ? ['Hoje', reais(c.deHoje.totalMes) + ' por mês'] : ['Hoje', 'Marque o que você come para comparar'],
      ['Do salário mínimo', Math.round(c.doPlano.totalMes / D.SALARIO_MINIMO * 100) + '%']
    ], 'Ver os custos', 'compras'));

    var linhas = linhasDaDespensa(c.doPlano);
    var paraComprar = linhas.filter(function (x) { return x.situacao.situacao === 'comprar'; });
    var emCasa = linhas.filter(function (x) { return x.situacao.situacao !== 'comprar'; })
      .sort(function (a, b) { return a.situacao.faltam - b.situacao.faltam; });
    caixa.appendChild(cartao('Lista de compras', [
      ['Para comprar', paraComprar.length ? paraComprar.length + (paraComprar.length === 1 ? ' item' : ' itens') : 'Nada agora'],
      ['Em casa', emCasa.length ? emCasa.length + (emCasa.length === 1 ? ' item' : ' itens') : 'Nada marcado ainda'],
      ['Próximo a acabar', emCasa.length ? emCasa[0].linha.produto.nome + ', ' + textoFaltam(emCasa[0].situacao.faltam) : '—']
    ], 'Abrir a lista', 'compras'));

    var r = estado.registros;
    var dPeso = variacao(null, null, 'peso');
    var dCintura = variacao(null, null, 'cintura');
    caixa.appendChild(cartao('Acompanhamento', [
      ['Início do plano', estado.inicioPlano ? dataCurta(estado.inicioPlano) : 'Ainda não definido'],
      ['Registros', r.length ? String(r.length) : 'Nenhum ainda'],
      ['Peso', dPeso === null ? (r.length && r[r.length - 1].peso ? formatarMedida(r[r.length - 1].peso, 'kg') : '—') : (dPeso > 0 ? '+' : '') + String(dPeso).replace('.', ',') + ' kg'],
      ['Cintura', dCintura === null ? '—' : (dCintura > 0 ? '+' : '') + String(dCintura).replace('.', ',') + ' cm']
    ], 'Registrar peso e medidas', 'acompanhamento'));

    var t = treinoGuardado();
    var objetivoTreino = t && ROTULO_DO_TREINO[t.perfil.objetivo];
    var cartaoTreino = cartao('Treino', t ? [
      ['Plano', t.perfil.dias + ' dias por semana'],
      ['Objetivo', objetivoTreino ? objetivoTreino.charAt(0).toUpperCase() + objetivoTreino.slice(1) : '—'],
      ['Próximo', t.resumo && t.resumo.proximo ? t.resumo.proximo : '—']
    ] : [['Treino', 'Ainda não montado'], ['Medidas', 'Vão preenchidas']], 'Treino', 'resumo');
    var link = criar('a', 'botao', t ? 'Abrir meu treino' : 'Montar meu treino');
    link.href = 'apps/treino/';
    cartaoTreino.replaceChild(link, cartaoTreino.querySelector('.botao'));
    caixa.appendChild(cartaoTreino);

    var avisos = avisosDaDespensa(c.doPlano);
    if (avisos.length) {
      var aviso = criar('div', 'alim-avisos');
      aviso.appendChild(criar('p', 'alim-trocas-titulo', 'Avisos da sua lista'));
      var ul = criar('ul');
      avisos.forEach(function (x) {
        var s = x.situacao;
        ul.appendChild(criar('li', '', x.linha.produto.nome + ': ' + (s.situacao === 'breve'
          ? 'acaba ' + textoFaltam(s.faltam) + ' (' + dataCurta(s.acabaEm) + ')'
          : (s.motivo === 'acabou' ? 'acabou' : 'deve ter acabado em ' + dataCurta(s.acabaEm))) + '.'));
      });
      aviso.appendChild(ul);
      aviso.appendChild(botao('Ver a lista de compras', 'botao', function () { irPara('compras'); }));
      caixa.insertBefore(aviso, caixa.firstChild);
    }
    var veredito = criar('p', 'alim-veredito', textoVeredito(c.doPlano, c.deHoje));
    caixa.insertBefore(veredito, caixa.firstChild);
    mostrarSituacao(conta.situacao);
  }

  /* --- Apagar tudo ------------------------------------------------------------------------------- */

  $('alim-apagar').addEventListener('click', function () {
    var naConta = conta.logado && conta.temNaConta;
    if (!window.confirm(naConta
      ? 'Apagar seus dados desta página deste aparelho e da sua conta? Não dá para desfazer.'
      : 'Apagar seus dados desta página deste aparelho?')) return;
    function limpar() {
      try { localStorage.removeItem(CHAVE); } catch (e) { /* nada guardado */ }
      location.reload();
    }
    if (!naConta) { limpar(); return; }
    api.post(ENDERECO + '?acao=apagar').then(function (r) {
      if (!r.ok) { retorno(r.erro || 'Não foi possível apagar da conta agora. Tente de novo.'); return; }
      limpar();
    });
  });

  /* --- Início ---------------------------------------------------------------------------------------- */

  function mostrarTudo() {
    mostrarPerfil();
    desenharItens();
    $('item-resumo').hidden = !estado.concluido;
    var aberto = PASSOS.filter(function (p) { return !$('passo-' + p).hidden; })[0];
    if (estado.concluido && perfilValido()) irPara(aberto && aberto !== 'voce' ? aberto : 'resumo');
  }

  // Ao abrir, avisa se algo da lista acabou ou está acabando
  function avisarAoAbrir() {
    if (!estado.concluido || !perfilValido()) return;
    var n = avisosDaDespensa(contas().doPlano).length;
    if (n) retorno(n === 1 ? '1 item da sua lista de compras está acabando ou acabou.' : n + ' itens da sua lista de compras estão acabando ou acabaram.');
  }

  preencherOpcoes();
  montarRefeicoes();
  if (trazerDoTreino()) salvar();
  mostrarPerfil();
  desenharItens();
  if (estado.concluido && perfilValido()) irPara('resumo');
  else $('item-resumo').hidden = true;
  mostrarSituacao('');
  mostrarLembrete();
  avisarAoAbrir();
  iniciarConta();
  carregarPrecos();
})();
