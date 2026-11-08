/* Alimentação: a tela. Sem autorização, os dados ficam só neste aparelho.
   Com autorização, também ficam na conta da pessoa, para abrir em qualquer aparelho. */
(function () {
  'use strict';

  var D = window.AR_ALIM;
  var C = window.AR_ALIM_CALC;
  var api = window.AR_API;
  var CHAVE = 'ar-alimentacao-v1';
  var ENDERECO = 'api/alimentacao.php';
  var PASSOS = ['resumo', 'voce', 'comida', 'plano', 'compras'];

  var estado = carregar() || novoEstado();
  var conta = { logado: false, temNaConta: false, salvoEm: null, situacao: '' };

  function novoEstado() {
    return {
      perfil: { sexo: 'm', idade: '', altura: '', peso: '', atividade: 'leve', objetivo: 'manter', uf: '' },
      itens: [], modo: 'ajustar', listaDe: 'plano', concluido: false, guardarNaConta: false, alteradoEm: 0
    };
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

  function salvar() {
    estado.alteradoEm = Date.now();
    try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch (e) { /* segue sem guardar */ }
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
      retorno('Pronto: suas informações vão ficar salvas na sua conta.');
      return;
    }
    if (conta.temNaConta && !window.confirm('Apagar da sua conta as informações de alimentação? Elas continuam neste aparelho.')) {
      caixa.checked = true;
      return;
    }
    estado.guardarNaConta = false;
    salvar();
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
      $('alim-guardar-logado').hidden = !conta.logado;
      $('alim-guardar-visitante').hidden = conta.logado;
      if (!conta.logado) { mostrarSituacao(''); return null; }
      return api.get(ENDERECO).then(function (resposta) {
        if (!resposta.ok) { mostrarSituacao(''); return; }
        var daConta = resposta.dados.dados;
        conta.temNaConta = Boolean(daConta);
        if (daConta && (daConta.alteradoEm || 0) >= (estado.alteradoEm || 0)) {
          estado = daConta;
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
    if (e.target.type === 'radio') lerPerfil();
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
    if (estado.modo === 'novo' || !itens.length) return C.planoNovo(metas);
    return C.planoAjustado(itens, metas);
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
        if (item.novo) linha.appendChild(criar('span', 'alim-selo', 'Novo'));
        else if (item.antes) linha.appendChild(criar('span', 'alim-selo', 'Trocado'));
        else if (item.porcao) linha.appendChild(criar('span', 'alim-selo alim-selo-claro', item.porcao === 'menos' ? 'Porção menor' : 'Porção maior'));
        li.appendChild(linha);
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
      ' No interior, os preços podem ser diferentes. Tudo é estimativa para uma pessoa.';
  }

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
    ], 'Ver a lista de compras', 'compras'));
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

  preencherOpcoes();
  montarRefeicoes();
  mostrarPerfil();
  desenharItens();
  if (estado.concluido && perfilValido()) irPara('resumo');
  else $('item-resumo').hidden = true;
  mostrarSituacao('');
  iniciarConta();
})();
