/* Guarda-roupa: peças, cadastro com foto, looks com o clima do dia e o diário do que foi usado.
   Tudo que a pessoa digita é escrito como texto, nunca como HTML. */
(function () {
  'use strict';

  var api = window.AR_API;
  var app = window.AR_APP;
  var gr = window.AR_GR;
  var foto = window.AR_FOTO;
  var motor = window.AR_LOOKS;
  var ENDERECO = 'api/guarda-roupa.php';
  var PAGINA = 'apps/guarda-roupa/';
  var CIDADE = 'ar-clima-cidade';
  var DIAS_PARADA = 180;
  var DIAS_RECENTE = 14;
  var UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

  var pecas = [];
  var excluidas = [];
  var decisoes = {};
  var notas = {};
  var usos = [];
  // Looks que acabaram de sair de Rejeitados: aparecem primeiro nas sugestões
  var recuperados = [];
  var maximo = 60;
  var consentiu = false;
  var paginaLooks = 1;
  var paginaDiario = 1;
  var rascunho = null;
  var clima = null;
  var climaPedido = false;
  var escolheuClimaDosLooks = false;

  function $(id) { return document.getElementById(id); }
  var criar = app.criar;

  function preencherSelect(id, lista, vazio) {
    var s = $(id);
    if (vazio !== undefined) s.appendChild(new Option(vazio, ''));
    lista.forEach(function (item) { s.appendChild(new Option(item.rotulo, item.id)); });
  }

  function reais(centavos) {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function porId() {
    var mapa = {};
    pecas.forEach(function (p) { mapa[p.id] = p; });
    return mapa;
  }

  function nomeDaPeca(p) {
    return p.apelido || gr.descrever(p);
  }

  function irParaLogin() { api.irParaLogin(PAGINA); }

  /* --- Abas -------------------------------------------------------------------- */

  var ABAS = ['pecas', 'looks', 'diario', 'excluidas'];

  function abrirAba(nome, foco) {
    ABAS.forEach(function (a) {
      var ativa = a === nome;
      var botao = $('aba-' + a);
      botao.setAttribute('aria-selected', String(ativa));
      botao.tabIndex = ativa ? 0 : -1;
      $('painel-' + a).hidden = !ativa;
    });
    if (foco) $('aba-' + nome).focus();
    $('gr-aviso').textContent = '';
    if (nome === 'looks') { desenharLooks(); carregarClima(); }
    if (nome === 'diario') desenharDiario();
    if (nome === 'excluidas') desenharExcluidas();
    // Com o <base> da página, só o fragmento mudaria o endereço inteiro
    var hash = '#' + nome;
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  }

  ABAS.forEach(function (nome, i) {
    var botao = $('aba-' + nome);
    botao.addEventListener('click', function () { abrirAba(nome); });
    botao.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var passo = e.key === 'ArrowRight' ? 1 : ABAS.length - 1;
      abrirAba(ABAS[(i + passo) % ABAS.length], true);
    });
  });

  /* --- Botão de adicionar ------------------------------------------------------------ */

  function definirMenu(aberto) {
    $('gr-fab').setAttribute('aria-expanded', String(aberto));
    $('gr-fab-menu').hidden = !aberto;
  }
  $('gr-fab').addEventListener('click', function (e) {
    e.stopPropagation();
    definirMenu($('gr-fab-menu').hidden);
    if (!$('gr-fab-menu').hidden) $('gr-adicionar').focus();
  });
  document.addEventListener('click', function (e) {
    if (!$('gr-fab-menu').hidden && !$('gr-fab-menu').contains(e.target)) definirMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('gr-fab-menu').hidden) { definirMenu(false); $('gr-fab').focus(); }
  });
  ['gr-adicionar', 'gr-adicionar-varias', 'gr-fab-uso'].forEach(function (id) {
    $(id).addEventListener('click', function () { definirMenu(false); });
  });

  /* --- Fotos e descrição ------------------------------------------------------------ */

  function figuraDaPeca(p) {
    var fig = criar('div', 'gr-foto' + (p.fundoRemovido ? ' gr-foto-recorte' : ''));
    var img = document.createElement('img');
    img.src = p.foto;
    img.alt = gr.descrever(p);
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 1000;
    img.height = 1250;
    fig.appendChild(img);
    return fig;
  }

  function botaoIcone(nomeIcone, rotulo, aoClicar, classe) {
    var b = criar('button', 'app-icone-botao' + (classe ? ' ' + classe : ''));
    b.type = 'button';
    b.setAttribute('aria-label', rotulo);
    b.title = rotulo.split(':')[0];
    b.appendChild(app.icone(nomeIcone));
    b.addEventListener('click', aoClicar);
    return b;
  }

  /* --- Uso de cada peça, a partir do diário ------------------------------------------- */

  function usoDasPecas() {
    var mapa = {};
    usos.forEach(function (u) {
      u.pecas.forEach(function (id) {
        var m = mapa[id] || (mapa[id] = { vezes: 0, ultima: '' });
        m.vezes += 1;
        if (u.data > m.ultima) m.ultima = u.data;
      });
    });
    return mapa;
  }

  function textoDeUso(p, uso) {
    var u = uso[p.id];
    var partes = [];
    if (u) partes.push('Usada ' + u.vezes + (u.vezes === 1 ? ' vez' : ' vezes'));
    if (p.preco) partes.push(u ? reais(Math.round(p.preco / u.vezes)) + ' por uso' : 'Paga ' + reais(p.preco));
    return partes.join(' · ');
  }

  /* --- Minhas peças ------------------------------------------------------------------ */

  function desenharPecas() {
    var grade = $('gr-pecas');
    grade.textContent = '';
    var grupo = $('gr-filtro-grupo').value;
    var uso = usoDasPecas();
    var lista = pecas.filter(function (p) {
      if (grupo === 'sugeridas') return p.sugerida;
      if (grupo === 'minhas') return !p.sugerida;
      return !grupo || (gr.porTipo[p.tipo] && gr.porTipo[p.tipo].grupo === grupo);
    });

    lista.forEach(function (p) {
      var item = criar('li', 'gr-peca');
      var abrir = criar('button', 'gr-peca-botao');
      abrir.type = 'button';
      abrir.setAttribute('aria-label', 'Editar: ' + gr.descrever(p));
      abrir.appendChild(figuraDaPeca(p));
      abrir.addEventListener('click', function () { abrirEdicao(p.id); });
      item.appendChild(abrir);
      if (p.sugerida) item.appendChild(criar('span', 'etiqueta gr-selo', 'Sugerida'));

      var icones = criar('div', 'gr-peca-icones');
      icones.appendChild(botaoIcone('lapis', 'Editar: ' + gr.descrever(p), function () { abrirEdicao(p.id); }));
      icones.appendChild(botaoIcone('camera', 'Trocar a foto: ' + gr.descrever(p), function () { abrirEdicao(p.id, 'foto'); }));
      icones.appendChild(botaoIcone('lixeira', 'Excluir: ' + gr.descrever(p), function () { excluirPeca(p.id); }, 'perigo'));
      item.appendChild(icones);

      item.appendChild(criar('p', 'gr-descricao', gr.descrever(p)));
      if (p.apelido) item.appendChild(criar('p', 'gr-apelido', p.apelido));
      var textoUso = textoDeUso(p, uso);
      if (textoUso) item.appendChild(criar('p', 'gr-peca-uso', textoUso));
      grade.appendChild(item);
    });

    var proprias = pecasProprias();
    var temSugeridas = pecas.length > proprias;
    $('gr-contagem').textContent = pecas.length === 1 ? '1 peça' : pecas.length + ' peças';
    $('gr-vazio').hidden = pecas.length > 0;
    $('gr-pecas-filtro').hidden = pecas.length === 0;
    $('gr-filtro-vazio').hidden = pecas.length === 0 || lista.length > 0;
    $('gr-adicionar').disabled = proprias >= maximo;
    $('gr-adicionar-varias').disabled = proprias >= maximo;
    $('gr-limite').hidden = proprias < maximo;
    $('gr-sem-sugeridas').hidden = !temSugeridas;
    atualizarContagemExcluidas();
  }

  function pecasProprias() {
    return pecas.filter(function (p) { return !p.sugerida; }).length;
  }

  function atualizarContagemExcluidas() {
    $('aba-excluidas').textContent = excluidas.length ? 'Excluídas (' + excluidas.length + ')' : 'Excluídas';
  }

  $('gr-filtro-grupo').addEventListener('change', desenharPecas);

  /* --- Excluir e adicionar de novo --------------------------------------------------------- */

  function falhaAoSalvar(r) {
    if (r.status === 401) { irParaLogin(); return; }
    avisar(r.erro || 'Não foi possível salvar. Tente de novo.');
  }

  function excluirPeca(id, aoConcluir) {
    return api.post(ENDERECO + '?acao=excluir', { id: id }).then(function (r) {
      if (!r.ok) { falhaAoSalvar(r); return; }
      var peca = pecas.filter(function (p) { return p.id === id; })[0];
      pecas = pecas.filter(function (p) { return p.id !== id; });
      if (peca) excluidas.unshift(peca);
      desenharPecas();
      if (aoConcluir) aoConcluir();
      avisar('Peça excluída. Ela fica na aba Excluídas.', function () { restaurarPeca(id); });
    });
  }

  function restaurarPeca(id) {
    return api.post(ENDERECO + '?acao=restaurar', { id: id }).then(function (r) {
      if (!r.ok) { falhaAoSalvar(r); return; }
      excluidas = excluidas.filter(function (p) { return p.id !== id; });
      pecas.unshift(r.dados.peca);
      paginaLooks = 1;
      desenharPecas();
      desenharExcluidas();
      avisar('Peça de volta no seu guarda-roupa.');
    });
  }

  function apagarDeVez(id) {
    if (!window.confirm('Apagar esta peça e a foto dela de vez? Os looks salvos com ela também saem. Não dá para desfazer.')) return;
    api.post(ENDERECO + '?acao=apagar', { id: id }).then(function (r) {
      if (!r.ok) { falhaAoSalvar(r); return; }
      excluidas = excluidas.filter(function (p) { return p.id !== id; });
      [decisoes, notas].forEach(function (mapa) {
        Object.keys(mapa).forEach(function (chave) {
          if (chave.split('-').indexOf(String(id)) !== -1) delete mapa[chave];
        });
      });
      usos = usos.map(function (u) {
        return { id: u.id, data: u.data, ocasiao: u.ocasiao, observacao: u.observacao, pecas: u.pecas.filter(function (x) { return x !== id; }) };
      }).filter(function (u) { return u.pecas.length; });
      desenharExcluidas();
      atualizarContagemExcluidas();
      avisar('Peça apagada de vez.');
    });
  }

  $('gr-sem-sugeridas').addEventListener('click', function () {
    var quantas = pecas.length - pecasProprias();
    if (!window.confirm('Tirar as ' + quantas + ' peças sugeridas? Elas ficam na aba Excluídas, caso queira alguma de volta.')) return;
    api.post(ENDERECO + '?acao=excluir-sugeridas').then(function (r) {
      if (!r.ok) { falhaAoSalvar(r); return; }
      excluidas = pecas.filter(function (p) { return p.sugerida; }).concat(excluidas);
      pecas = pecas.filter(function (p) { return !p.sugerida; });
      paginaLooks = 1;
      desenharPecas();
      avisar('Peças sugeridas retiradas. Elas ficam na aba Excluídas.');
    });
  });

  function desenharExcluidas() {
    var grade = $('gr-excluidas');
    grade.textContent = '';
    excluidas.forEach(function (p) {
      var item = criar('li', 'gr-peca');
      item.appendChild(figuraDaPeca(p));
      if (p.sugerida) item.appendChild(criar('span', 'etiqueta gr-selo', 'Sugerida'));
      var icones = criar('div', 'gr-peca-icones');
      icones.appendChild(botaoIcone('restaurar', 'Adicionar de novo: ' + gr.descrever(p), function () { restaurarPeca(p.id); }));
      if (!p.sugerida) icones.appendChild(botaoIcone('lixeira', 'Apagar de vez: ' + gr.descrever(p), function () { apagarDeVez(p.id); }, 'perigo'));
      item.appendChild(icones);
      item.appendChild(criar('p', 'gr-descricao', gr.descrever(p)));
      if (p.apelido) item.appendChild(criar('p', 'gr-apelido', p.apelido));
      var acoes = criar('div', 'gr-peca-acoes');
      var voltar = criar('button', 'botao', 'Adicionar de novo');
      voltar.type = 'button';
      voltar.addEventListener('click', function () { restaurarPeca(p.id); });
      acoes.appendChild(voltar);
      item.appendChild(acoes);
      grade.appendChild(item);
    });
    $('gr-excluidas-vazio').hidden = excluidas.length > 0;
    $('gr-excluidas-texto').hidden = excluidas.length === 0;
  }

  /* --- Cadastro: etapas ---------------------------------------------------------------- */

  var PASSOS = ['gr-passo-foto', 'gr-passo-fundo', 'gr-passo-descricao'];

  function mostrarPasso(id) {
    PASSOS.forEach(function (p) { $(p).hidden = p !== id; });
    $('gr-modal').scrollTop = 0;
  }

  function limparRascunho() {
    if (rascunho && rascunho.tarefa) rascunho.tarefa.cancelar();
    if (rascunho && rascunho.url) URL.revokeObjectURL(rascunho.url);
    rascunho = null;
  }

  function abrirNovo() {
    limparRascunho();
    rascunho = { id: null };
    estadoFundo('', '', {});
    $('gr-foto-erro').textContent = '';
    $('gr-foto-titulo').textContent = 'Fotografe a peça';
    $('gr-foto-voltar').hidden = true;
    mostrarPasso('gr-passo-foto');
    $('gr-modal').showModal();
  }

  $('gr-adicionar').addEventListener('click', abrirNovo);
  $('gr-primeira').addEventListener('click', abrirNovo);

  $('gr-fechar').addEventListener('click', function () { $('gr-modal').close(); });
  // O aviso de fechamento chega depois: não pode apagar uma peça que já foi reaberta
  $('gr-modal').addEventListener('close', function () {
    if (!$('gr-modal').open) limparRascunho();
  });

  $('gr-tirar').addEventListener('click', function () { $('gr-camera').click(); });
  $('gr-escolher').addEventListener('click', function () { $('gr-galeria').click(); });
  $('gr-foto-voltar').addEventListener('click', function () { voltarParaEdicao(); });

  function aoEscolherFoto(e) {
    var arquivo = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!arquivo) return;
    $('gr-foto-erro').textContent = '';
    foto.abrir(arquivo).then(function (canvas) {
      if (!rascunho) return;
      rascunho.original = canvas;
      prepararFundo();
    }).catch(function () {
      $('gr-foto-erro').textContent = 'Não foi possível abrir esta foto. Tente outra, em JPG ou PNG.';
    });
  }

  $('gr-camera').addEventListener('change', aoEscolherFoto);
  $('gr-galeria').addEventListener('change', aoEscolherFoto);

  /* --- Cadastro: tirar o fundo ------------------------------------------------------------ */

  function mostrarPrevia(canvas, recorte) {
    var caixa = $('gr-previa');
    caixa.classList.toggle('gr-foto-recorte', Boolean(recorte));
    canvas.toBlob(function (blob) {
      if (!rascunho || !blob) return;
      if (rascunho.url) URL.revokeObjectURL(rascunho.url);
      rascunho.url = URL.createObjectURL(blob);
      $('gr-previa-img').src = rascunho.url;
    }, recorte ? 'image/png' : 'image/jpeg', 0.9);
  }

  function estadoFundo(titulo, texto, opcoes) {
    if (!opcoes.aceitar) $('gr-ajuste').hidden = true;
    $('gr-fundo-titulo').textContent = titulo;
    $('gr-fundo-texto').textContent = texto;
    $('gr-fundo-erro').textContent = '';
    $('gr-fundo-progresso').hidden = !opcoes.progresso;
    $('gr-fundo-iniciar').hidden = !opcoes.iniciar;
    $('gr-fundo-aceitar').hidden = !opcoes.aceitar;
    var soFundo = rascunho && rascunho.soFundo;
    $('gr-fundo-original').textContent = soFundo ? 'Manter a foto como está' : (opcoes.aceitar ? 'Usar a foto original' : 'Usar a foto como está');
    $('gr-fundo-outra').hidden = Boolean(soFundo);
  }

  function definirProgresso(parte) {
    $('gr-fundo-barra').style.setProperty('--p', Math.max(0.03, parte));
  }

  function prepararFundo() {
    mostrarPrevia(rascunho.original, false);
    mostrarPasso('gr-passo-fundo');
    if (!foto.podeRemover()) {
      estadoFundo('Foto recebida', 'Este aparelho não consegue tirar o fundo, mas você pode cadastrar a foto como está.', {});
      return;
    }
    if (foto.jaBaixou() || rascunho.soFundo) {
      iniciarRemocao();
      return;
    }
    estadoFundo(
      'Tirar o fundo da foto?',
      'A ferramenta roda no seu aparelho e sua foto não é enviada para esse processo. Na primeira vez, ela baixa cerca de 90 MB, então prefira usar Wi-Fi. Nas próximas, começa mais rápido.',
      { iniciar: true }
    );
  }

  function iniciarRemocao() {
    var atual = rascunho;
    estadoFundo('Tirando o fundo...', 'Pode levar até um minuto. Deixe esta tela aberta.', { progresso: true });
    definirProgresso(0);
    atual.tarefa = foto.removerFundo(atual.original, function (p) {
      if (rascunho !== atual) return;
      definirProgresso(p.parte);
      $('gr-fundo-texto').textContent = p.fase === 'baixando'
        ? (foto.jaBaixou() ? 'Preparando a ferramenta: ' : 'Baixando a ferramenta (cerca de 90 MB): ') + Math.round(p.parte * 100) + '%.'
        : 'Separando a peça do fundo. Deixe esta tela aberta.';
    });
    atual.tarefa.resultado.then(function (recorte) { return foto.enquadrar(recorte, atual.original); }).then(function (final) {
      if (rascunho !== atual) return;
      atual.tarefa = null;
      if (!final) {
        falhaNoFundo('Não encontramos a peça nesta foto. Com a peça estendida sobre um fundo liso, costuma dar certo.');
        return;
      }
      atual.recorte = final;
      atual.recorteBase = final;
      mostrarPrevia(final, true);
      $('gr-ajuste-angulo').value = '0';
      $('gr-ajuste').hidden = false;
      estadoFundo('Ficou bom?', final.fundoSuspeito
        ? 'Parte do fundo pode ter ficado na imagem. Confira e, se precisar, tire outra foto com a peça sobre um fundo liso de outra cor.'
        : (final.giroAutomatico
          ? 'A peça foi centralizada, endireitada e o fundo foi removido. Se ainda estiver torta, ajuste o ângulo abaixo.'
          : 'A peça foi centralizada e o fundo foi removido. Se estiver torta, ajuste o ângulo abaixo.'), { aceitar: true });
    }).catch(function (erro) {
      if (rascunho !== atual || (erro && erro.message === 'cancelado')) return;
      atual.tarefa = null;
      falhaNoFundo(erro && erro.message === 'demorou'
        ? 'Demorou mais que o esperado neste aparelho. Você pode cadastrar a foto como está.'
        : 'Não foi possível tirar o fundo agora. Você pode tentar de novo ou cadastrar a foto como está.');
    });
  }

  function falhaNoFundo(texto) {
    mostrarPrevia(rascunho.original, false);
    estadoFundo('Não deu para tirar o fundo', texto, { iniciar: true });
  }

  $('gr-fundo-iniciar').addEventListener('click', iniciarRemocao);

  // Ajuste fino do ângulo: a prévia acompanha o controle
  var ajusteAgendado = null;
  $('gr-ajuste-angulo').addEventListener('input', function () {
    var graus = Number($('gr-ajuste-angulo').value) || 0;
    $('gr-ajuste-valor').textContent = (graus > 0 ? '+' : '') + String(graus).replace('.', ',') + '°';
    window.clearTimeout(ajusteAgendado);
    ajusteAgendado = window.setTimeout(function () {
      if (!rascunho || !rascunho.recorteBase) return;
      rascunho.recorte = foto.ajustarAngulo(rascunho.recorteBase, graus);
      mostrarPrevia(rascunho.recorte, true);
    }, 60);
  });
  $('gr-ajuste-zerar').addEventListener('click', function () {
    $('gr-ajuste-angulo').value = '0';
    $('gr-ajuste-angulo').dispatchEvent(new Event('input'));
  });

  function cancelarTarefa() {
    if (rascunho.tarefa) {
      rascunho.tarefa.cancelar();
      rascunho.tarefa = null;
    }
  }

  $('gr-fundo-aceitar').addEventListener('click', function () {
    rascunho.final = rascunho.recorte;
    rascunho.transparente = true;
    if (rascunho.trocarFoto) enviarFotoNova();
    else irParaDescricao();
  });

  $('gr-fundo-original').addEventListener('click', function () {
    cancelarTarefa();
    if (rascunho.soFundo) { voltarParaEdicao(); return; }
    rascunho.final = rascunho.original;
    rascunho.transparente = false;
    if (rascunho.trocarFoto) enviarFotoNova();
    else irParaDescricao();
  });

  $('gr-fundo-outra').addEventListener('click', function () {
    cancelarTarefa();
    mostrarPasso('gr-passo-foto');
  });

  /* --- Foto de uma peça que já existe: trocar, girar, tirar o fundo ---------------------------- */

  function pecaDoRascunho() {
    return rascunho && rascunho.id ? pecas.filter(function (x) { return x.id === rascunho.id; })[0] : null;
  }

  function comecarTrocaDeFoto() {
    var p = pecaDoRascunho();
    if (!p) return;
    if (p.sugerida && pecasProprias() >= maximo) {
      avisar('Você chegou ao limite de peças suas. Exclua uma para trocar a foto de uma sugerida.');
      return;
    }
    rascunho.trocarFoto = true;
    rascunho.soFundo = false;
    $('gr-foto-titulo').textContent = 'Nova foto da peça';
    $('gr-foto-voltar').hidden = false;
    $('gr-foto-erro').textContent = '';
    mostrarPasso('gr-passo-foto');
  }

  // A foto guardada vira um desenho na tela, para girar ou tirar o fundo
  function abrirFotoGuardada(p) {
    return fetch(p.foto, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('foto');
      return r.blob();
    }).then(foto.abrir);
  }

  function girar(canvas) {
    var novo = document.createElement('canvas');
    novo.width = canvas.height;
    novo.height = canvas.width;
    var ctx = novo.getContext('2d');
    ctx.translate(novo.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, 0, 0);
    return novo;
  }

  function estadoEdicao(texto, ocupado) {
    $('gr-edicao-estado').textContent = texto;
    ['gr-trocar-foto', 'gr-girar-foto', 'gr-fundo-foto', 'gr-excluir', 'gr-salvar'].forEach(function (id) { $(id).disabled = Boolean(ocupado); });
  }

  $('gr-trocar-foto').addEventListener('click', comecarTrocaDeFoto);

  $('gr-girar-foto').addEventListener('click', function () {
    var p = pecaDoRascunho();
    if (!p) return;
    estadoEdicao('Girando a foto...', true);
    abrirFotoGuardada(p).then(function (canvas) {
      if (!rascunho || rascunho.id !== p.id) return null;
      rascunho.final = girar(canvas);
      rascunho.transparente = p.fundoRemovido;
      return enviarFotoNova(true);
    }).catch(function () {
      estadoEdicao('Não foi possível girar a foto agora. Tente de novo.', false);
    });
  });

  $('gr-fundo-foto').addEventListener('click', function () {
    var p = pecaDoRascunho();
    if (!p) return;
    estadoEdicao('Abrindo a foto...', true);
    abrirFotoGuardada(p).then(function (canvas) {
      if (!rascunho || rascunho.id !== p.id) return;
      estadoEdicao('', false);
      rascunho.original = canvas;
      rascunho.trocarFoto = true;
      rascunho.soFundo = true;
      prepararFundo();
    }).catch(function () {
      estadoEdicao('Não foi possível abrir a foto agora. Tente de novo.', false);
    });
  });

  function voltarParaEdicao() {
    var p = pecaDoRascunho();
    if (!p) { $('gr-modal').close(); return; }
    rascunho.trocarFoto = false;
    rascunho.soFundo = false;
    mostrarEdicao(p);
    mostrarPasso('gr-passo-descricao');
  }

  function enviarFotoNova(naTelaDaPeca) {
    var p = pecaDoRascunho();
    if (!p) return Promise.resolve();
    if (!naTelaDaPeca) {
      mostrarEdicao(p);
      mostrarPasso('gr-passo-descricao');
    }
    estadoEdicao('Enviando a foto...', true);
    return foto.exportar(rascunho.final, rascunho.transparente).then(function (blob) {
      var f = new FormData();
      f.append('id', String(p.id));
      f.append('fundo_removido', rascunho.transparente ? '1' : '0');
      if (!consentiu) f.append('consentimento', '1');
      f.append('foto', blob, blob.type === 'image/webp' ? 'peca.webp' : (blob.type === 'image/png' ? 'peca.png' : 'peca.jpg'));
      return api.enviar(ENDERECO + '?acao=trocar-foto', f);
    }).then(function (r) {
      if (!r.ok) {
        if (r.status === 401) { irParaLogin(); return; }
        estadoEdicao(r.erro || 'Não foi possível trocar a foto. Tente de novo.', false);
        return;
      }
      consentiu = true;
      pecas = pecas.map(function (x) { return x.id === p.id ? r.dados.peca : x; });
      desenharPecas();
      if (rascunho) {
        rascunho.trocarFoto = false;
        rascunho.soFundo = false;
        mostrarEdicao(r.dados.peca);
      }
      estadoEdicao('Foto atualizada.', false);
      avisar(p.sugerida ? 'Foto trocada. A peça agora é sua.' : 'Foto atualizada.');
    }).catch(function () {
      estadoEdicao('Não foi possível preparar a foto. Tente de novo.', false);
    });
  }

  /* --- Cadastro: descrição ------------------------------------------------------------------ */

  var CAMPOS = ['foto', 'tipo', 'cor', 'corte', 'tecido', 'formalidade', 'clima', 'preco', 'consentimento'];

  function limparErros() {
    CAMPOS.forEach(function (c) {
      var e = $('erro-' + c);
      if (e) e.textContent = '';
    });
    $('gr-form-erro').textContent = '';
  }

  // "189,90", "1.299" ou "R$ 50" viram centavos. Vazio é null; texto errado, NaN.
  function lerPreco(texto) {
    var t = String(texto).replace(/R\$|\s/g, '');
    if (!t) return null;
    if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    var centavos = Math.round(Number(t) * 100);
    return centavos > 0 && centavos <= 5000000 ? centavos : NaN;
  }

  function escreverPreco(centavos) {
    return centavos ? (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  }

  function valoresDoForm() {
    return {
      tipo: $('gr-tipo').value,
      cor: $('gr-cor').value,
      corte: gr.temCorte($('gr-tipo').value) ? $('gr-corte').value : '',
      tecido: $('gr-tecido').value,
      formalidade: $('gr-formalidade').value,
      clima: $('gr-clima').value,
      apelido: $('gr-apelido').value.trim()
    };
  }

  function atualizarResumo() {
    var v = valoresDoForm();
    $('gr-campo-corte').hidden = !gr.temCorte(v.tipo);
    $('gr-resumo').textContent = gr.descrever(v) || 'Escolha o tipo, a cor e o corte.';
  }

  // Formalidade e clima acompanham o tipo até a pessoa escolher por conta própria
  var escolheuFormalidade = false;
  var escolheuClima = false;

  $('gr-tipo').addEventListener('change', function () {
    if (!escolheuFormalidade) $('gr-formalidade').value = gr.formalidadePadrao($('gr-tipo').value);
    if (!escolheuClima) $('gr-clima').value = gr.climaPadrao($('gr-tipo').value, $('gr-tecido').value);
    atualizarResumo();
  });
  $('gr-tecido').addEventListener('change', function () {
    if (!escolheuClima) $('gr-clima').value = gr.climaPadrao($('gr-tipo').value, $('gr-tecido').value);
    atualizarResumo();
  });
  $('gr-cor').addEventListener('change', function () {
    $('gr-cor-dica').hidden = true;
    atualizarResumo();
  });
  $('gr-corte').addEventListener('change', atualizarResumo);
  $('gr-formalidade').addEventListener('change', function () { escolheuFormalidade = true; });
  $('gr-clima').addEventListener('change', function () { escolheuClima = true; });

  function encherForm(p) {
    $('gr-tipo').value = p.tipo || '';
    $('gr-cor').value = p.cor || '';
    $('gr-corte').value = p.corte || '';
    $('gr-tecido').value = p.tecido || '';
    $('gr-formalidade').value = p.formalidade || 'casual';
    $('gr-clima').value = p.clima || 'qualquer';
    $('gr-apelido').value = p.apelido || '';
    $('gr-preco').value = escreverPreco(p.preco);
    limparErros();
    atualizarResumo();
  }

  function irParaDescricao() {
    var sugestao = foto.corPrincipal(rascunho.final, rascunho.transparente);
    escolheuFormalidade = false;
    escolheuClima = false;
    encherForm({ cor: sugestao });
    $('gr-cor-dica').hidden = !sugestao;
    $('gr-descricao-titulo').textContent = 'Descreva a peça';
    mostrarPrevia(rascunho.final, rascunho.transparente);
    $('gr-edicao').hidden = true;
    $('gr-campo-consentimento').hidden = consentiu;
    $('gr-consentimento').checked = false;
    $('gr-salvar').textContent = 'Guardar peça';
    mostrarPasso('gr-passo-descricao');
  }

  function mostrarEdicao(p) {
    var caixa = $('gr-edicao-foto');
    caixa.textContent = '';
    caixa.appendChild(figuraDaPeca(p));
    $('gr-edicao').hidden = false;
    $('gr-girar-foto').hidden = p.sugerida;
    $('gr-fundo-foto').hidden = p.sugerida || p.fundoRemovido || !foto.podeRemover();
    $('gr-trocar-foto').lastChild.textContent = p.sugerida ? 'Usar minha foto' : 'Trocar foto';
  }

  function abrirEdicao(id, modo) {
    var p = pecas.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    limparRascunho();
    rascunho = { id: id };
    escolheuFormalidade = true;
    escolheuClima = true;
    encherForm(p);
    $('gr-cor-dica').hidden = true;
    $('gr-descricao-titulo').textContent = 'Editar peça';
    mostrarEdicao(p);
    estadoEdicao('', false);
    $('gr-campo-consentimento').hidden = true;
    $('gr-salvar').textContent = 'Salvar alterações';
    mostrarPasso('gr-passo-descricao');
    $('gr-modal').showModal();
    if (modo === 'foto') comecarTrocaDeFoto();
  }

  function mostrarErros(r) {
    if (r.status === 401) { irParaLogin(); return; }
    var campos = r.dados.campos || {};
    Object.keys(campos).forEach(function (c) {
      var e = $('erro-' + c);
      if (e) e.textContent = campos[c];
    });
    $('gr-form-erro').textContent = r.erro || 'Não foi possível salvar. Tente de novo.';
  }

  function validarLocal(v) {
    var ok = true;
    if (!v.tipo) { $('erro-tipo').textContent = 'Escolha o tipo da peça.'; ok = false; }
    if (!v.cor) { $('erro-cor').textContent = 'Escolha a cor.'; ok = false; }
    if (gr.temCorte(v.tipo) && !v.corte) { $('erro-corte').textContent = 'Escolha o corte.'; ok = false; }
    if (typeof v.preco === 'number' && isNaN(v.preco)) { $('erro-preco').textContent = 'Informe o valor em reais, como 189,90.'; ok = false; }
    if (!consentiu && !rascunho.id && !$('gr-consentimento').checked) {
      $('erro-consentimento').textContent = 'É preciso concordar para continuar.';
      ok = false;
    }
    return ok;
  }

  $('gr-passo-descricao').addEventListener('submit', function (e) {
    e.preventDefault();
    limparErros();
    var v = valoresDoForm();
    v.preco = lerPreco($('gr-preco').value);
    if (!validarLocal(v)) {
      $('gr-form-erro').textContent = 'Confira os campos marcados.';
      return;
    }
    var botao = $('gr-salvar');
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    var pedido = rascunho.id ? salvarEdicao(v) : salvarNova(v);
    pedido.then(function () {
      botao.disabled = false;
      botao.removeAttribute('aria-busy');
    });
  });

  function salvarNova(v) {
    return foto.exportar(rascunho.final, rascunho.transparente).then(function (blob) {
      var f = new FormData();
      Object.keys(v).forEach(function (c) { if (c !== 'preco') f.append(c, v[c]); });
      f.append('preco', v.preco ? String(v.preco) : '');
      f.append('fundo_removido', rascunho.transparente ? '1' : '0');
      if ($('gr-consentimento').checked) f.append('consentimento', '1');
      f.append('foto', blob, blob.type === 'image/webp' ? 'peca.webp' : (blob.type === 'image/png' ? 'peca.png' : 'peca.jpg'));
      return api.enviar(ENDERECO + '?acao=adicionar', f);
    }).then(function (r) {
      if (!r.ok) { mostrarErros(r); return; }
      consentiu = true;
      pecas.unshift(r.dados.peca);
      paginaLooks = 1;
      desenharPecas();
      $('gr-modal').close();
      avisar('Peça guardada no seu guarda-roupa.');
    }).catch(function () {
      $('gr-form-erro').textContent = 'Não foi possível preparar a foto. Tente de novo.';
    });
  }

  function salvarEdicao(v) {
    var id = rascunho.id;
    v.id = id;
    v.preco = v.preco || 0;
    return api.post(ENDERECO + '?acao=editar', v).then(function (r) {
      if (!r.ok) { mostrarErros(r); return; }
      pecas = pecas.map(function (p) { return p.id === id ? r.dados.peca : p; });
      desenharPecas();
      $('gr-modal').close();
      avisar('Peça atualizada.');
    });
  }

  $('gr-excluir').addEventListener('click', function () {
    excluirPeca(rascunho.id, function () { $('gr-modal').close(); });
  });

  /* --- Avisos ------------------------------------------------------------------------------ */

  var temporizadorDoAviso = null;

  function avisar(texto, desfazer) {
    var caixa = $('gr-aviso');
    caixa.textContent = '';
    window.clearTimeout(temporizadorDoAviso);
    // O aviso cobre parte da tela, então não fica lá para sempre
    temporizadorDoAviso = window.setTimeout(function () { caixa.textContent = ''; }, desfazer ? 12000 : 5000);
    caixa.appendChild(criar('span', '', texto));
    if (desfazer) {
      var b = criar('button', 'texto-botao', 'Desfazer');
      b.type = 'button';
      b.addEventListener('click', function () {
        caixa.textContent = '';
        desfazer();
      });
      caixa.appendChild(b);
    }
  }

  /* --- Clima do dia -------------------------------------------------------------------------- */

  var ICONE_CLIMA = { calor: 'sol', frio: 'floco', meia_estacao: 'nuvem' };
  var NOME_CLIMA = { calor: 'dia quente', frio: 'dia frio', meia_estacao: 'meia-estação' };

  function mostrarFormCidade(mensagem) {
    var salva = app.lerLocal(CIDADE) || {};
    $('gr-tempo').hidden = true;
    $('gr-tempo-form').hidden = false;
    $('gr-tempo-nome').value = salva.cidade || (clima && clima.cidade) || '';
    $('gr-tempo-uf').value = salva.uf || (clima && clima.uf) || '';
    $('gr-tempo-erro').textContent = mensagem || '';
  }

  function mostrarClima() {
    $('gr-tempo-form').hidden = true;
    $('gr-tempo-erro').textContent = '';
    if (!clima) { $('gr-tempo').hidden = true; return; }
    var icone = $('gr-tempo-icone');
    icone.textContent = '';
    icone.className = 'gr-clima-icone' + (clima.categoria === 'frio' ? ' frio' : (clima.categoria === 'meia_estacao' ? ' meia' : ''));
    icone.appendChild(app.icone(ICONE_CLIMA[clima.categoria]));
    var texto = $('gr-tempo-texto');
    texto.textContent = '';
    var quando = clima.quando === 'amanhã' ? 'Amanhã' : 'Hoje';
    texto.appendChild(criar('strong', '', quando + ' em ' + clima.cidade + ': ' + Math.round(clima.minima) + '° a ' + Math.round(clima.maxima) + '°'));
    texto.appendChild(criar('span', '', (clima.quando === 'amanhã' ? 'Vai ser ' : 'É ') + NOME_CLIMA[clima.categoria] + (clima.chuva ? ', com chance de chuva' : '') +
      '. ' + ($('gr-filtro-clima').value === clima.categoria ? 'Os looks abaixo são para esse clima.' : 'Escolha o clima no filtro para ver looks para ' + quando.toLowerCase() + '.')));
    texto.appendChild(criar('span', 'app-fonte', ' ' + clima.fonte));
    $('gr-tempo').hidden = false;
  }

  function carregarClima(forcar) {
    if (climaPedido && !forcar) return;
    climaPedido = true;
    var salva = app.lerLocal(CIDADE);
    var endereco = 'api/clima.php' + (salva && salva.cidade ? '?cidade=' + encodeURIComponent(salva.cidade) + '&uf=' + encodeURIComponent(salva.uf || '') : '');
    api.get(endereco).then(function (r) {
      if (!r.ok) {
        clima = null;
        if (r.dados.semCidade) mostrarFormCidade(r.status === 404 ? r.erro : '');
        else { $('gr-tempo').hidden = true; $('gr-tempo-erro').textContent = forcar ? r.erro : ''; }
        return;
      }
      clima = r.dados;
      if (!escolheuClimaDosLooks && $('gr-filtro-mostrar').value === 'sugeridos') {
        $('gr-filtro-clima').value = clima.categoria;
        paginaLooks = 1;
        desenharLooks();
      }
      mostrarClima();
    });
  }

  $('gr-tempo-cidade').addEventListener('click', function () { mostrarFormCidade(''); $('gr-tempo-nome').focus(); });
  $('gr-tempo-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var cidade = $('gr-tempo-nome').value.trim();
    if (!cidade) { $('gr-tempo-erro').textContent = 'Informe a cidade.'; return; }
    app.gravarLocal(CIDADE, { cidade: cidade, uf: $('gr-tempo-uf').value });
    escolheuClimaDosLooks = false;
    carregarClima(true);
  });

  /* --- Looks -------------------------------------------------------------------------------- */

  function idsDoLook(look) {
    return look.pecas.map(function (p) { return p.id; });
  }

  function roupaDoLook(ids) {
    var mapa = porId();
    return ids.filter(function (id) {
      var p = mapa[id];
      return p && gr.porTipo[p.tipo] && gr.porTipo[p.tipo].grupo !== 'acessorio' && gr.porTipo[p.tipo].grupo !== 'calcado';
    });
  }

  // O look conta como usado quando todas as roupas dele aparecem numa anotação do diário
  function usosDoLook(look) {
    var roupa = roupaDoLook(idsDoLook(look));
    if (!roupa.length) return [];
    return usos.filter(function (u) {
      return roupa.every(function (id) { return u.pecas.indexOf(id) !== -1; });
    });
  }

  function decidir(look, situacao) {
    var antes = decisoes[look.chave];
    return api.post(ENDERECO + '?acao=look', { pecas: idsDoLook(look), situacao: situacao }).then(function (r) {
      if (!r.ok) {
        if (r.status === 401) { irParaLogin(); return; }
        avisar(r.erro || 'Não foi possível salvar. Tente de novo.');
        return;
      }
      if (situacao === 'nenhum') delete decisoes[r.dados.chave];
      else decisoes[r.dados.chave] = situacao;
      if (situacao === 'nenhum' && antes === 'descartado') recuperados.unshift(r.dados.chave);
      desenharLooks();
      if (situacao === 'salvo') {
        if (antes === 'descartado') avisar('Look salvo.', function () { decidir(look, 'descartado'); });
        else avisar('Look salvo.');
      } else if (situacao === 'descartado') {
        avisar('Look rejeitado. Para recuperar depois, escolha Rejeitados em Mostrar.', function () { decidir(look, antes || 'nenhum'); });
      } else if (antes === 'descartado') {
        avisar('O look voltou para as sugestões.', function () { decidir(look, 'descartado'); });
      } else if (antes === 'salvo') {
        avisar('Look retirado dos salvos.', function () { decidir(look, 'salvo'); });
      }
    });
  }

  function campoDaNota(id, rotulo, elemento) {
    var campo = criar('div', 'campo');
    var etiqueta = criar('label', '', rotulo);
    etiqueta.htmlFor = id;
    elemento.id = id;
    var entrada = criar('div', 'campo-entrada');
    entrada.appendChild(elemento);
    campo.appendChild(etiqueta);
    campo.appendChild(entrada);
    return campo;
  }

  function formularioDaNota(look, aoFechar) {
    var nota = notas[look.chave] || {};
    var form = criar('form', 'gr-look-nota');
    form.noValidate = true;

    var nome = document.createElement('input');
    nome.type = 'text';
    nome.maxLength = 60;
    nome.placeholder = 'Ex.: Jantar de sexta';
    nome.value = nota.nome || '';
    form.appendChild(campoDaNota('look-nome-' + look.chave, 'Nome do look', nome));

    var observacao = document.createElement('textarea');
    observacao.maxLength = 300;
    observacao.rows = 3;
    observacao.placeholder = 'Ex.: Levar o casaco se esfriar';
    observacao.value = nota.observacao || '';
    form.appendChild(campoDaNota('look-obs-' + look.chave, 'Observação', observacao));

    var erro = criar('p', 'erro');
    erro.setAttribute('role', 'alert');
    form.appendChild(erro);

    var acoes = criar('div', 'gr-look-acoes');
    var salvar = criar('button', 'botao botao-cheio', 'Guardar');
    salvar.type = 'submit';
    var cancelar = criar('button', 'texto-botao', 'Cancelar');
    cancelar.type = 'button';
    cancelar.addEventListener('click', aoFechar);
    acoes.appendChild(salvar);
    acoes.appendChild(cancelar);
    form.appendChild(acoes);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      erro.textContent = '';
      salvar.disabled = true;
      salvar.setAttribute('aria-busy', 'true');
      var eraSalvo = decisoes[look.chave] === 'salvo';
      api.post(ENDERECO + '?acao=look-nota', {
        pecas: idsDoLook(look),
        nome: nome.value.trim(),
        observacao: observacao.value.trim()
      }).then(function (r) {
        salvar.disabled = false;
        salvar.removeAttribute('aria-busy');
        if (!r.ok) {
          if (r.status === 401) { irParaLogin(); return; }
          erro.textContent = r.erro || 'Não foi possível salvar. Tente de novo.';
          return;
        }
        if (r.dados.nome || r.dados.observacao) {
          notas[r.dados.chave] = { nome: r.dados.nome, observacao: r.dados.observacao };
        } else {
          delete notas[r.dados.chave];
        }
        if (r.dados.situacao !== 'nenhum') decisoes[r.dados.chave] = r.dados.situacao;
        desenharLooks();
        avisar(!eraSalvo && r.dados.situacao === 'salvo'
          ? 'Pronto. O look também foi para os Salvos.'
          : 'Nome e observação atualizados.');
      });
    });
    return { elemento: form, foco: nome };
  }

  function cartaoDeLook(look, numero) {
    var nota = notas[look.chave] || {};
    var decisao = decisoes[look.chave];
    var cartao = criar('article', 'gr-look');
    var cab = criar('header', 'gr-look-cab');
    cab.appendChild(criar('h3', 'titulo-s', nota.nome || 'Look ' + numero));
    var ocasiao = look.ocasiao || motor.rotuloDaOcasiao(look.pecas);
    if (ocasiao) cab.appendChild(criar('span', 'etiqueta', ocasiao));
    cartao.appendChild(cab);
    var usado = usosDoLook(look)[0];
    if (usado) {
      cartao.appendChild(criar('p', 'gr-look-uso', 'Você usou em ' + app.dataCurta(usado.data) + (usado.ocasiao ? ', ' + usado.ocasiao : '') + '.'));
    }
    if (nota.observacao) cartao.appendChild(criar('p', 'gr-look-obs', nota.observacao));

    var grade = criar('ul', 'gr-look-pecas');
    look.pecas.forEach(function (p) {
      var item = criar('li', 'gr-look-peca');
      item.appendChild(figuraDaPeca(p));
      item.appendChild(criar('p', 'gr-descricao', gr.descrever(p)));
      grade.appendChild(item);
    });
    cartao.appendChild(grade);

    if (look.motivos && look.motivos.length) {
      var motivos = criar('ul', 'gr-look-motivos');
      look.motivos.forEach(function (m) { motivos.appendChild(criar('li', '', m)); });
      cartao.appendChild(motivos);
    }

    var acoes = criar('div', 'gr-look-acoes');
    var salvo = decisao === 'salvo';
    var rejeitado = decisao === 'descartado';
    var salvar = criar('button', salvo ? 'botao botao-cheio' : 'botao', salvo ? 'Salvo' : 'Salvar look');
    salvar.type = 'button';
    salvar.setAttribute('aria-pressed', String(salvo));
    salvar.addEventListener('click', function () {
      decidir(look, salvo ? 'nenhum' : 'salvo');
    });
    acoes.appendChild(salvar);
    if (!rejeitado) {
      var usei = criar('button', 'botao', 'Usei hoje');
      usei.type = 'button';
      usei.addEventListener('click', function () { abrirUso({ pecas: look.pecas }); });
      acoes.appendChild(usei);
    }
    if (rejeitado) {
      var voltar = criar('button', 'texto-botao', 'Voltar para sugestões');
      voltar.type = 'button';
      voltar.addEventListener('click', function () { decidir(look, 'nenhum'); });
      acoes.appendChild(voltar);
    } else {
      if (!salvo) {
        var fora = criar('button', 'texto-botao', 'Não gostei');
        fora.type = 'button';
        fora.addEventListener('click', function () { decidir(look, 'descartado'); });
        acoes.appendChild(fora);
      }
      var editar = criar('button', 'texto-botao', nota.nome || nota.observacao ? 'Editar nome e observação' : 'Dar nome ou observação');
      editar.type = 'button';
      editar.setAttribute('aria-expanded', 'false');
      var aberto = null;
      var fecharNota = function () {
        cartao.removeChild(aberto.elemento);
        aberto = null;
        editar.setAttribute('aria-expanded', 'false');
        editar.focus();
      };
      editar.addEventListener('click', function () {
        if (aberto) { fecharNota(); return; }
        aberto = formularioDaNota(look, fecharNota);
        cartao.appendChild(aberto.elemento);
        editar.setAttribute('aria-expanded', 'true');
        aberto.foco.focus();
      });
      acoes.appendChild(editar);
    }
    cartao.appendChild(acoes);
    return cartao;
  }

  function looksComDecisao(situacao) {
    var mapa = porId();
    return Object.keys(decisoes).filter(function (chave) {
      return decisoes[chave] === situacao;
    }).map(function (chave) {
      var ids = chave.split('-');
      var lista = ids.map(function (id) { return mapa[id]; }).filter(Boolean);
      // Com alguma peça em Excluídas, o look fica guardado e volta junto com ela
      return { chave: chave, pecas: lista, motivos: [], completo: lista.length === ids.length };
    }).filter(function (l) { return l.completo; }).reverse();
  }

  function usadoHaPouco(look) {
    var desde = app.somarDias(app.hojeISO(), -DIAS_RECENTE);
    return usosDoLook(look).some(function (u) { return u.data >= desde; });
  }

  /* --- Sugestão de compra: a peça que mais abriria looks novos -------------------------------- */

  // Peças clássicas que a marca pode fazer. Enquanto a coleção não tem a peça,
  // a compra vai para o pedido exclusivo, já com a peça escolhida.
  var PARA_COMPRAR = [
    { id: 'camisa-branca', tipo: 'camisa', cor: 'branco', corte: 'regular', formalidade: 'misto', clima: 'qualquer', nome: 'uma camisa branca', foto: 'camisa-branca', peca: 'camisa', categoria: 'camisa' },
    { id: 'blazer-preto', tipo: 'blazer', cor: 'preto', corte: 'regular', formalidade: 'social', clima: 'qualquer', nome: 'um blazer preto', foto: 'blazer-transpassado-preto', peca: 'blazer', categoria: 'blazer' },
    { id: 'calca-alfaiataria', tipo: 'calca', cor: 'preto', corte: 'reto', formalidade: 'misto', clima: 'qualquer', nome: 'uma calça de alfaiataria preta', foto: 'calca-alfaiataria-preta', peca: 'calca', categoria: 'calca' },
    { id: 'jeans-escuro', tipo: 'jeans', cor: 'azul_marinho', corte: 'reto', formalidade: 'casual', clima: 'qualquer', nome: 'um jeans escuro', foto: 'calca-jeans-lavagem-escura', peca: 'calca', categoria: 'calca' },
    { id: 'camiseta-branca', tipo: 'camiseta', cor: 'branco', corte: 'regular', formalidade: 'casual', clima: 'qualquer', nome: 'uma camiseta branca', foto: 'camiseta-branca', peca: 'camiseta', categoria: 'camiseta' },
    { id: 'camiseta-preta', tipo: 'camiseta', cor: 'preto', corte: 'regular', formalidade: 'casual', clima: 'qualquer', nome: 'uma camiseta preta', foto: 'camiseta-preta', peca: 'camiseta', categoria: 'camiseta' },
    { id: 'sueter-preto', tipo: 'malha', cor: 'preto', corte: 'regular', formalidade: 'misto', clima: 'frio', nome: 'um suéter preto', foto: 'sueter-preto', peca: '', categoria: '' },
    // Sem foto: aparecem num desenho da peça, na cor certa
    { id: 'camisa-azul-clara', tipo: 'camisa', cor: 'azul_claro', corte: 'regular', formalidade: 'misto', clima: 'qualquer', nome: 'uma camisa azul-clara', desenho: 'camisa', peca: 'camisa', categoria: 'camisa' },
    { id: 'polo-marinho', tipo: 'polo', cor: 'azul_marinho', corte: 'regular', formalidade: 'casual', clima: 'qualquer', nome: 'uma polo azul-marinho', desenho: 'polo', peca: 'polo', categoria: 'polo' },
    { id: 'blazer-marinho', tipo: 'blazer', cor: 'azul_marinho', corte: 'regular', formalidade: 'misto', clima: 'qualquer', nome: 'um blazer azul-marinho', desenho: 'blazer', peca: 'blazer', categoria: 'blazer' },
    { id: 'sarja-bege', tipo: 'calca_sarja', cor: 'bege', corte: 'reto', formalidade: 'misto', clima: 'qualquer', nome: 'uma calça de sarja bege', desenho: 'calca', peca: 'calca', categoria: 'calca' },
    { id: 'calca-cinza', tipo: 'calca', cor: 'cinza', corte: 'reto', formalidade: 'misto', clima: 'qualquer', nome: 'uma calça de alfaiataria cinza', desenho: 'calca', peca: 'calca', categoria: 'calca' },
    { id: 'bermuda-bege', tipo: 'bermuda', cor: 'bege', corte: 'regular', formalidade: 'casual', clima: 'calor', nome: 'uma bermuda bege', desenho: 'bermuda', peca: 'bermuda', categoria: 'bermuda' },
    { id: 'camiseta-off', tipo: 'camiseta', cor: 'off_white', corte: 'regular', formalidade: 'casual', clima: 'qualquer', nome: 'uma camiseta off-white', desenho: 'camiseta', peca: 'camiseta', categoria: 'camiseta' },
    { id: 'mocassim-marrom', tipo: 'mocassim', cor: 'marrom', corte: '', formalidade: 'misto', clima: 'qualquer', nome: 'um mocassim marrom', desenho: 'sapato', peca: '', categoria: '' }
  ];

  // Desenhos simples das peças, para as sugestões sem foto
  var DESENHOS_SUGESTAO = {
    camisa: 'M24 9l-12 5-5 38h8l3-26v32h28V26l3 26h8l-5-38-12-5-8 10zM32 19v35',
    polo: 'M24 10l-12 6-6 12 8 4 4-6v28h28V26l4 6 8-4-6-12-12-6-8 6zM32 16v10',
    blazer: 'M24 8l-13 6-5 40h8l3-26v30h30V28l3 26h8l-5-40-13-6-8 22zM24 8l4 12M40 8l-4 12',
    calca: 'M20 8h24l3 48h-10l-5-32-5 32H17z',
    bermuda: 'M18 12h28l4 26H36l-4-14-4 14H14z',
    camiseta: 'M24 10l-12 6-6 12 8 4 4-6v28h28V26l4 6 8-4-6-12-12-6c-2 4-14 4-16 0z',
    sapato: 'M8 40c0-6 4-10 10-10l14 2c6 1 10 4 16 4h6c3 0 4 2 4 4v4H8z'
  };

  function desenhoDaSugestao(s) {
    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', DESENHOS_SUGESTAO[s.desenho] || DESENHOS_SUGESTAO.camiseta);
    path.setAttribute('fill', (gr.porCor[s.cor] || {}).hex || '#888');
    path.setAttribute('stroke', 'rgba(11, 11, 10, .55)');
    path.setAttribute('stroke-width', '1');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }
  var DESCARTADAS = 'ar-gr-sugestoes-fora';
  var produtosDaColecao = null;
  var sugestaoAtual = null;

  function descartadas() {
    try { return JSON.parse(localStorage.getItem(DESCARTADAS)) || []; } catch (e) { return []; }
  }

  function melhorSugestao() {
    var fora = descartadas();
    var melhor = null;
    PARA_COMPRAR.forEach(function (s) {
      if (fora.indexOf(s.id) !== -1) return;
      if (pecas.some(function (p) { return p.tipo === s.tipo && p.cor === s.cor; })) return;
      var nova = { id: 'sugestao-' + s.id, tipo: s.tipo, cor: s.cor, corte: s.corte, formalidade: s.formalidade, clima: s.clima, tecido: '' };
      var looks = motor.looksCom(pecas, nova);
      if (looks.length >= 2 && (!melhor || looks.length > melhor.looks.length)) melhor = { item: s, looks: looks, nova: nova };
    });
    return melhor;
  }

  function linkDeCompra(s) {
    var produto = (produtosDaColecao || []).filter(function (p) { return s.categoria && p.categoria === s.categoria && p.situacao === 'publicado'; })[0];
    if (produto) return { href: 'produto.html?p=' + encodeURIComponent(produto.slug), texto: 'Ver na coleção' };
    if (s.peca) return { href: 'pedido-exclusivo.html?peca=' + s.peca, texto: 'Encomendar sob medida' };
    return { href: app.linkWhatsapp('Olá! Quero ' + s.nome + ' sob medida.'), texto: 'Pedir pelo WhatsApp' };
  }

  function desenharSugestao(ativa) {
    var caixa = $('gr-sugestao');
    sugestaoAtual = ativa ? melhorSugestao() : null;
    caixa.hidden = !sugestaoAtual;
    if (!sugestaoAtual) return;
    var s = sugestaoAtual.item;
    var total = motor.totalDeLooks(pecas);
    var n = sugestaoAtual.looks.length;
    var moldura = $('gr-sugestao-img').parentNode;
    var antigo = moldura.querySelector('svg');
    if (antigo) antigo.remove();
    $('gr-sugestao-img').hidden = !s.foto;
    if (s.foto) $('gr-sugestao-img').src = 'assets/img/sugeridas/' + s.foto + '.webp';
    else moldura.appendChild(desenhoDaSugestao(s));
    $('gr-sugestao-titulo').textContent = 'Encontramos uma peça que combina com o seu guarda-roupa';
    $('gr-sugestao-detalhe').textContent = 'Com ' + s.nome + ', você teria mais ' + n + (n === 1 ? ' look' : ' looks') +
      ' além dos ' + total + ' que já tem.';
    var compra = linkDeCompra(s);
    $('gr-sugestao-comprar').href = compra.href;
    $('gr-sugestao-comprar').textContent = compra.texto;
    if (compra.href.indexOf('https://') === 0) { $('gr-sugestao-comprar').target = '_blank'; $('gr-sugestao-comprar').rel = 'noopener'; }
    else { $('gr-sugestao-comprar').removeAttribute('target'); }
    var lista = $('gr-sugestao-lista');
    lista.textContent = '';
    sugestaoAtual.looks.slice(0, 5).forEach(function (look) {
      var nomes = look.pecas.map(function (p) {
        return p.id === sugestaoAtual.nova.id ? s.nome.replace(/^(um|uma) /, '').replace(/^./, function (l) { return l.toUpperCase(); }) : (p.apelido || gr.descrever(p));
      });
      var li = criar('li');
      li.appendChild(criar('span', '', nomes.join(' + ')));
      lista.appendChild(li);
    });
    $('gr-sugestao-ver').setAttribute('aria-expanded', String(!lista.hidden));
  }

  $('gr-sugestao-ver').addEventListener('click', function () {
    var lista = $('gr-sugestao-lista');
    lista.hidden = !lista.hidden;
    $('gr-sugestao-ver').setAttribute('aria-expanded', String(!lista.hidden));
    $('gr-sugestao-ver').textContent = lista.hidden ? 'Ver combinações' : 'Esconder combinações';
  });

  $('gr-sugestao-descartar').addEventListener('click', function () {
    if (!sugestaoAtual) return;
    var fora = descartadas();
    fora.push(sugestaoAtual.item.id);
    try { localStorage.setItem(DESCARTADAS, JSON.stringify(fora)); } catch (e) { /* segue sem lembrar */ }
    $('gr-sugestao-lista').hidden = true;
    $('gr-sugestao-ver').textContent = 'Ver combinações';
    desenharSugestao(true);
    app.avisar(sugestaoAtual ? 'Sugestão descartada. Esta é a próxima.' : 'Sugestão descartada.');
  });

  // As peças da coleção, para a compra levar direto à página da peça
  api.get('api/produtos.php').then(function (r) {
    if (r.ok) produtosDaColecao = r.dados.produtos;
  });

  function desenharLooks() {
    var caixa = $('gr-looks');
    caixa.textContent = '';
    var mostrar = $('gr-filtro-mostrar').value;
    var falta = motor.oQueFalta(pecas);
    var mensagem = '';
    var lista;

    $('gr-looks-filtros').hidden = falta.length > 0;
    $('gr-montar-chamada').hidden = pecas.length < 2;
    var soSugestoes = mostrar === 'sugeridos';
    $('gr-filtro-nivel').closest('.campo').hidden = !soSugestoes;
    $('gr-filtro-clima').closest('.campo').hidden = !soSugestoes;
    $('gr-filtro-recentes-campo').hidden = !soSugestoes || falta.length > 0 || !usos.length;

    if (falta.length) {
      lista = [];
      mensagem = 'Para montar looks, adicione ' + falta.join(' e ') + '.';
    } else if (mostrar === 'salvos') {
      lista = looksComDecisao('salvo');
      if (!lista.length) mensagem = 'Você ainda não salvou nenhum look.';
    } else if (mostrar === 'rejeitados') {
      lista = looksComDecisao('descartado');
      if (!lista.length) mensagem = 'Nenhum look rejeitado. Os que você marcar com Não gostei ficam aqui.';
    } else {
      lista = motor.sugerir(pecas, { ocasiao: $('gr-filtro-nivel').value, clima: $('gr-filtro-clima').value }, decisoes);
      lista = lista.filter(function (l) { return recuperados.indexOf(l.chave) !== -1; }).concat(
        lista.filter(function (l) { return recuperados.indexOf(l.chave) === -1; })
      );
      if ($('gr-filtro-recentes').checked) lista = lista.filter(function (l) { return !usadoHaPouco(l); });
      if (!lista.length) mensagem = 'Nenhuma combinação com esses filtros. Experimente outro filtro ou adicione mais peças.';
    }

    var limite = soSugestoes ? paginaLooks * motor.POR_PAGINA : lista.length;
    lista.slice(0, limite).forEach(function (look, i) {
      caixa.appendChild(cartaoDeLook(look, i + 1));
    });

    $('gr-looks-vazio').textContent = mensagem;
    $('gr-looks-vazio').hidden = !mensagem;
    desenharSugestao(soSugestoes && !falta.length);
    $('gr-looks-mais').hidden = lista.length <= limite;

    var convite = $('gr-convite-texto');
    convite.textContent = motor.temSobreposicao(pecas)
      ? 'Sentiu falta de uma peça para completar seus looks? Podemos fazê-la nas suas medidas.'
      : 'Um blazer sob medida abriria novas combinações para o seu guarda-roupa.';
    $('gr-convite').hidden = falta.length > 0;
    if (clima) mostrarClima();
  }

  ['gr-filtro-mostrar', 'gr-filtro-nivel', 'gr-filtro-clima', 'gr-filtro-recentes'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      if (id === 'gr-filtro-clima') escolheuClimaDosLooks = true;
      paginaLooks = 1;
      desenharLooks();
    });
  });

  $('gr-looks-mais').addEventListener('click', function () {
    paginaLooks += 1;
    desenharLooks();
  });

  /* --- Diário: anotar o que foi usado ----------------------------------------------------------- */

  var usoAtual = null;

  function preencherOcasioesConhecidas() {
    var lista = $('uso-ocasioes');
    lista.textContent = '';
    var vistas = {};
    usos.forEach(function (u) {
      var chave = u.ocasiao.trim().toLowerCase();
      if (!chave || vistas[chave]) return;
      vistas[chave] = true;
      lista.appendChild(new Option(u.ocasiao));
    });
  }

  function idsEscolhidos() {
    if (usoAtual && usoAtual.pecas) return usoAtual.pecas.map(function (p) { return p.id; });
    return Array.prototype.slice.call($('uso-pecas').querySelectorAll('input:checked')).map(function (c) { return Number(c.value); });
  }

  // Avisa quando um look parecido já foi usado com as mesmas pessoas
  function conferirRepeticao() {
    var aviso = $('uso-repetido');
    var ocasiao = $('uso-ocasiao').value.trim().toLowerCase();
    var roupa = roupaDoLook(idsEscolhidos());
    aviso.hidden = true;
    if (!ocasiao || roupa.length < 2) return;
    var desde = app.somarDias(app.hojeISO(), -60);
    var igual = usos.filter(function (u) {
      if (u.ocasiao.trim().toLowerCase() !== ocasiao || u.data < desde) return false;
      var emComum = roupa.filter(function (id) { return u.pecas.indexOf(id) !== -1; }).length;
      return emComum >= Math.min(2, roupa.length);
    })[0];
    if (igual) {
      aviso.textContent = 'Você usou um look parecido em "' + igual.ocasiao + '" no dia ' + app.dataCurta(igual.data) + '. Se for com as mesmas pessoas, vale trocar uma peça.';
      aviso.hidden = false;
    }
  }

  /* --- Escolher peças: filtros por tipo, busca e só as escolhidas ------------------------------------ */

  function semAcento(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function grupoDaPeca(p) { return (gr.porTipo[p.tipo] || {}).grupo || 'acessorio'; }

  // Monta a grade de peças com filtros em cima. Quem tem muita roupa filtra pelo tipo
  // (parte de cima, de baixo, calçados...) ou procura pela cor e pelo nome.
  function seletorDePecas(filtros, grade, aoMudar) {
    var filtro = 'todas';
    var busca = '';
    filtros.textContent = '';
    grade.textContent = '';
    var itens = [];

    pecas.forEach(function (p) {
      var rotulo = criar('label');
      var caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.value = String(p.id);
      caixa.setAttribute('aria-label', gr.descrever(p));
      caixa.addEventListener('change', function () { contar(); if (aoMudar) aoMudar(); });
      rotulo.appendChild(caixa);
      rotulo.appendChild(figuraDaPeca(p));
      var marca = criar('span', 'gr-escolher-marca');
      marca.appendChild(app.icone('check'));
      rotulo.appendChild(marca);
      grade.appendChild(rotulo);
      itens.push({ peca: p, rotulo: rotulo, caixa: caixa, texto: semAcento(gr.descrever(p) + ' ' + (p.nome || '') + ' ' + (p.marca || '')), grupo: grupoDaPeca(p) });
    });

    // Só os grupos que a pessoa tem, na ordem do guarda-roupa
    var chips = criar('div', 'gr-filtro-chips');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Filtrar peças');
    var opcoes = [{ id: 'todas', rotulo: 'Todas' }].concat(gr.GRUPOS.filter(function (g) {
      return itens.some(function (i) { return i.grupo === g.id; });
    })).concat([{ id: 'escolhidas', rotulo: 'Escolhidas' }]);
    var botoes = {};
    opcoes.forEach(function (o) {
      var b = criar('button', 'gr-chip', o.rotulo);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(o.id === filtro));
      b.addEventListener('click', function () {
        filtro = o.id;
        Object.keys(botoes).forEach(function (k) { botoes[k].setAttribute('aria-pressed', String(k === filtro)); });
        aplicar();
      });
      botoes[o.id] = b;
      chips.appendChild(b);
    });
    filtros.appendChild(chips);

    if (pecas.length > 8) {
      var procura = document.createElement('input');
      procura.type = 'search';
      procura.className = 'gr-filtro-busca';
      procura.placeholder = 'Procurar: cor, tipo, tecido';
      procura.setAttribute('aria-label', 'Procurar peça');
      procura.addEventListener('input', function () { busca = semAcento(procura.value.trim()); aplicar(); });
      filtros.appendChild(procura);
    }
    var vazio = criar('p', 'gr-suave gr-filtro-nada', 'Nenhuma peça com esse filtro.');
    vazio.hidden = true;
    filtros.appendChild(vazio);

    function aplicar() {
      var palavras = busca ? busca.split(/\s+/) : [];
      var algum = false;
      itens.forEach(function (i) {
        var ok = (filtro === 'todas' || (filtro === 'escolhidas' ? i.caixa.checked : i.grupo === filtro)) &&
          palavras.every(function (w) { return i.texto.indexOf(w) !== -1; });
        i.rotulo.hidden = !ok;
        if (ok) algum = true;
      });
      vazio.hidden = algum;
    }

    function contar() {
      var n = itens.filter(function (i) { return i.caixa.checked; }).length;
      botoes.escolhidas.textContent = n ? 'Escolhidas (' + n + ')' : 'Escolhidas';
    }

    return {
      escolhidas: function () { return itens.filter(function (i) { return i.caixa.checked; }).map(function (i) { return i.peca.id; }); },
      marcar: function (ids) {
        itens.forEach(function (i) { i.caixa.checked = ids.indexOf(i.peca.id) !== -1; });
        filtro = 'escolhidas';
        Object.keys(botoes).forEach(function (k) { botoes[k].setAttribute('aria-pressed', String(k === filtro)); });
        aplicar();
        contar();
        if (aoMudar) aoMudar();
      }
    };
  }

  // Looks prontos para o diário: os salvos e os que a pessoa já usou, sem repetir
  function desenharProntos(seletor) {
    var lista = $('uso-prontos-lista');
    lista.textContent = '';
    var mapa = porId();
    var vistos = {};
    var prontos = [];
    looksComDecisao('salvo').forEach(function (l) {
      if (!l.completo || vistos[l.chave]) return;
      vistos[l.chave] = true;
      prontos.push({ nome: (notas[l.chave] || {}).nome || 'Look salvo', pecas: l.pecas });
    });
    usos.slice().sort(function (a, b) { return a.data < b.data ? 1 : -1; }).forEach(function (u) {
      var ids = u.pecas.filter(function (id) { return mapa[id]; });
      var chave = ids.slice().sort(function (a, b) { return a - b; }).join('-');
      if (ids.length < 2 || vistos[chave]) return;
      vistos[chave] = true;
      prontos.push({ nome: 'Usado em ' + app.dataCurta(u.data), pecas: ids.map(function (id) { return mapa[id]; }) });
    });
    prontos = prontos.slice(0, 12);
    $('uso-prontos').hidden = !prontos.length;
    prontos.forEach(function (l) {
      var b = criar('button', 'gr-pronto');
      b.type = 'button';
      var fotos = criar('span', 'gr-pronto-fotos');
      l.pecas.slice(0, 4).forEach(function (p) { fotos.appendChild(figuraDaPeca(p)); });
      b.appendChild(fotos);
      b.appendChild(criar('span', 'gr-pronto-nome', l.nome));
      b.setAttribute('aria-label', l.nome + ': ' + l.pecas.map(function (p) { return gr.descrever(p); }).join(', '));
      b.addEventListener('click', function () {
        seletor.marcar(l.pecas.map(function (p) { return p.id; }));
        lista.querySelectorAll('.gr-pronto').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
      lista.appendChild(b);
    });
  }

  /* --- Montar um look à mão ------------------------------------------------------------------------- */

  var montador = null;

  function abrirMontar() {
    $('montar-erro').textContent = '';
    $('montar-erro-pecas').textContent = '';
    $('montar-nome').value = '';
    $('montar-obs').value = '';
    montador = seletorDePecas($('montar-filtro'), $('montar-pecas'), previaDoMontado);
    previaDoMontado();
    $('montar-modal').showModal();
  }

  function previaDoMontado() {
    var ids = montador.escolhidas();
    var mapa = porId();
    var caixa = $('montar-previa');
    caixa.textContent = '';
    if (!ids.length) { caixa.appendChild(criar('p', 'gr-suave', 'As peças escolhidas aparecem aqui.')); return; }
    var fila = criar('div', 'gr-montado-fila');
    ids.forEach(function (id) { fila.appendChild(figuraDaPeca(mapa[id])); });
    caixa.appendChild(fila);
    var grupos = ids.map(function (id) { return grupoDaPeca(mapa[id]); });
    var falta = [];
    if (grupos.indexOf('conjunto') === -1) {
      if (grupos.indexOf('cima') === -1 && grupos.indexOf('camada') === -1) falta.push('uma peça de cima');
      if (grupos.indexOf('baixo') === -1) falta.push('uma de baixo');
    }
    var texto = ids.length + (ids.length === 1 ? ' peça' : ' peças') + (falta.length ? '. Falta ' + falta.join(' e ') + '?' : '. Look completo.');
    caixa.appendChild(criar('p', 'gr-suave', texto));
  }

  function salvarMontado(usouHoje) {
    var ids = montador.escolhidas();
    $('montar-erro').textContent = '';
    $('montar-erro-pecas').textContent = '';
    if (ids.length < 2 || ids.length > 6) { $('montar-erro-pecas').textContent = 'Escolha de 2 a 6 peças.'; return; }
    var nome = $('montar-nome').value.trim();
    var obs = $('montar-obs').value.trim();
    var botoes = [$('montar-salvar'), $('montar-usei')];
    botoes.forEach(function (b) { b.disabled = true; });
    api.post(ENDERECO + '?acao=look', { pecas: ids, situacao: 'salvo' }).then(function (r) {
      if (!r.ok || (!nome && !obs)) return r;
      return api.post(ENDERECO + '?acao=look-nota', { pecas: ids, nome: nome, observacao: obs }).then(function (n) {
        if (n.ok && (n.dados.nome || n.dados.observacao)) notas[n.dados.chave] = { nome: n.dados.nome, observacao: n.dados.observacao };
        return n.ok ? r : n;
      });
    }).then(function (r) {
      botoes.forEach(function (b) { b.disabled = false; });
      if (!r.ok) {
        if (r.status === 401) { irParaLogin(); return; }
        $('montar-erro').textContent = r.erro || 'Não foi possível salvar. Tente de novo.';
        return;
      }
      decisoes[r.dados.chave] = 'salvo';
      $('montar-modal').close();
      $('gr-filtro-mostrar').value = 'salvos';
      paginaLooks = 1;
      desenharLooks();
      if (usouHoje) {
        var mapa = porId();
        abrirUso({ pecas: ids.map(function (id) { return mapa[id]; }) });
      } else {
        avisar('Look salvo. Ele está em Salvos e aparece no Diário como look pronto.');
      }
    });
  }

  $('gr-montar').addEventListener('click', abrirMontar);
  $('montar-fechar').addEventListener('click', function () { $('montar-modal').close(); });
  $('montar-form').addEventListener('submit', function (e) { e.preventDefault(); salvarMontado(false); });
  $('montar-usei').addEventListener('click', function () { salvarMontado(true); });

  function abrirUso(opcoes) {
    usoAtual = opcoes || {};
    $('uso-erro').textContent = '';
    $('uso-erro-pecas').textContent = '';
    $('uso-erro-data').textContent = '';
    $('uso-repetido').hidden = true;
    $('uso-data').value = app.hojeISO();
    $('uso-data').max = app.hojeISO();
    $('uso-ocasiao').value = '';
    $('uso-observacao').value = '';
    preencherOcasioesConhecidas();

    var previa = $('uso-look');
    previa.textContent = '';
    var escolha = $('uso-pecas');
    escolha.textContent = '';
    if (usoAtual.pecas) {
      usoAtual.pecas.forEach(function (p) {
        var item = criar('div');
        item.appendChild(figuraDaPeca(p));
        item.appendChild(criar('p', '', gr.descrever(p)));
        previa.appendChild(item);
      });
      $('uso-titulo').textContent = 'Anotar este look';
    } else {
      var seletor = seletorDePecas($('uso-filtro'), escolha, conferirRepeticao);
      desenharProntos(seletor);
      $('uso-titulo').textContent = 'O que você usou?';
    }
    previa.hidden = !usoAtual.pecas;
    $('uso-escolha').hidden = Boolean(usoAtual.pecas);
    $('uso-modal').showModal();
  }

  $('uso-fechar').addEventListener('click', function () { $('uso-modal').close(); });
  $('uso-ocasiao').addEventListener('input', conferirRepeticao);
  $('gr-registrar-uso').addEventListener('click', function () { abrirUso(); });
  $('gr-fab-uso').addEventListener('click', function () { abrirUso(); });

  $('uso-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var ids = idsEscolhidos();
    $('uso-erro-pecas').textContent = '';
    $('uso-erro-data').textContent = '';
    $('uso-erro').textContent = '';
    if (!ids.length) { $('uso-erro-pecas').textContent = 'Toque em pelo menos uma peça.'; return; }
    if (ids.length > 8) { $('uso-erro-pecas').textContent = 'Escolha até 8 peças.'; return; }
    var data = $('uso-data').value;
    if (!data || data > app.hojeISO()) { $('uso-erro-data').textContent = 'Escolha uma data até hoje.'; return; }
    var botao = $('uso-salvar');
    botao.disabled = true;
    api.post(ENDERECO + '?acao=uso', {
      pecas: ids, data: data, ocasiao: $('uso-ocasiao').value.trim(), observacao: $('uso-observacao').value.trim()
    }).then(function (r) {
      botao.disabled = false;
      if (!r.ok) {
        if (r.status === 401) { irParaLogin(); return; }
        var campos = r.dados.campos || {};
        if (campos.pecas) $('uso-erro-pecas').textContent = campos.pecas;
        if (campos.data) $('uso-erro-data').textContent = campos.data;
        $('uso-erro').textContent = r.erro || 'Não foi possível anotar. Tente de novo.';
        return;
      }
      var novo = r.dados.uso;
      usos.unshift(novo);
      usos.sort(function (a, b) { return a.data === b.data ? b.id - a.id : (a.data < b.data ? 1 : -1); });
      $('uso-modal').close();
      redesenharComUso();
      avisar('Anotado no diário.', function () { apagarUso(novo.id, true); });
    });
  });

  function apagarUso(id, semAviso) {
    var antes = usos.slice();
    var uso = usos.filter(function (u) { return u.id === id; })[0];
    usos = usos.filter(function (u) { return u.id !== id; });
    redesenharComUso();
    api.post(ENDERECO + '?acao=apagar-uso', { id: id }).then(function (r) {
      if (!r.ok) {
        usos = antes;
        redesenharComUso();
        falhaAoSalvar(r);
        return;
      }
      if (semAviso || !uso) return;
      avisar('Anotação apagada.', function () {
        api.post(ENDERECO + '?acao=uso', { pecas: uso.pecas, data: uso.data, ocasiao: uso.ocasiao, observacao: uso.observacao }).then(function (r2) {
          if (!r2.ok) { falhaAoSalvar(r2); return; }
          usos.push(r2.dados.uso);
          usos.sort(function (a, b) { return a.data === b.data ? b.id - a.id : (a.data < b.data ? 1 : -1); });
          redesenharComUso();
        });
      });
    });
  }

  function redesenharComUso() {
    desenharPecas();
    if (!$('painel-looks').hidden) desenharLooks();
    if (!$('painel-diario').hidden) desenharDiario();
  }

  /* --- Diário: o que aparece na aba ------------------------------------------------------------ */

  function numero(rotulo, valor) {
    var caixa = criar('div', 'gr-numero');
    caixa.appendChild(criar('span', '', rotulo));
    caixa.appendChild(criar('strong', '', valor));
    return caixa;
  }

  function desenharDiario() {
    var mapa = porId();
    var uso = usoDasPecas();
    var hoje = app.hojeISO();
    var mes = hoje.slice(0, 7);
    var noMes = usos.filter(function (u) { return u.data.slice(0, 7) === mes; }).length;
    var maisUsada = pecas.filter(function (p) { return uso[p.id]; }).sort(function (a, b) { return uso[b.id].vezes - uso[a.id].vezes; })[0];
    var desde90 = app.somarDias(hoje, -90);
    var usadas90 = pecas.filter(function (p) { return uso[p.id] && uso[p.id].ultima >= desde90; }).length;

    var numeros = $('gr-diario-numeros');
    numeros.textContent = '';
    numeros.appendChild(numero('Neste mês', noMes === 1 ? '1 look' : noMes + ' looks'));
    numeros.appendChild(numero('Mais usada', maisUsada ? nomeDaPeca(maisUsada) : '—'));
    numeros.appendChild(numero('Usadas em 90 dias', pecas.length ? Math.round(usadas90 / pecas.length * 100) + '% das peças' : '—'));
    numeros.hidden = !usos.length;
    $('gr-diario-vazio').hidden = usos.length > 0;

    var lista = $('gr-diario-lista');
    lista.textContent = '';
    var mostrar = usos.slice(0, paginaDiario * 20);
    mostrar.forEach(function (u) {
      var item = criar('article', 'gr-uso');
      var texto = criar('div');
      var dias = app.diasAte(u.data);
      texto.appendChild(criar('p', 'gr-uso-data', app.dataCurta(u.data) + (dias >= -1 ? ' · ' + app.textoDias(dias) : '')));
      var info = [u.ocasiao, u.observacao].filter(Boolean).join(' · ');
      if (info) texto.appendChild(criar('p', 'gr-uso-info', info));
      item.appendChild(texto);
      item.appendChild(botaoIcone('lixeira', 'Apagar a anotação de ' + app.dataCurta(u.data), function () { apagarUso(u.id); }, 'plano perigo'));
      var fotos = criar('div', 'gr-uso-fotos');
      u.pecas.forEach(function (id) { if (mapa[id]) fotos.appendChild(figuraDaPeca(mapa[id])); });
      item.appendChild(fotos);
      lista.appendChild(item);
    });
    $('gr-diario-mais').hidden = usos.length <= mostrar.length;

    desenharParadas(uso, hoje);
    desenharCustoPorUso(uso);
  }

  $('gr-diario-mais').addEventListener('click', function () { paginaDiario += 1; desenharDiario(); });

  function desenharParadas(uso, hoje) {
    var limite = app.somarDias(hoje, -DIAS_PARADA);
    var paradas = pecas.filter(function (p) {
      if (p.sugerida) return false;
      var u = uso[p.id];
      return u ? u.ultima < limite : (p.criadoEm && p.criadoEm < limite);
    });
    var grade = $('gr-paradas');
    grade.textContent = '';
    paradas.forEach(function (p) {
      var item = criar('li', 'gr-peca');
      item.appendChild(figuraDaPeca(p));
      item.appendChild(criar('p', 'gr-descricao', nomeDaPeca(p)));
      var u = uso[p.id];
      item.appendChild(criar('p', 'gr-peca-uso', u ? 'Última vez em ' + app.dataCurta(u.ultima) + '/' + u.ultima.slice(0, 4) : 'Nunca anotada no diário'));
      grade.appendChild(item);
    });
    var texto = $('gr-paradas-texto');
    texto.textContent = '';
    if (!paradas.length) {
      texto.textContent = 'Quando uma peça sua passar 6 meses sem aparecer no diário, ela aparece aqui, com ideias do que fazer com ela.';
      return;
    }
    texto.appendChild(document.createTextNode(
      (paradas.length === 1 ? 'Esta peça está parada' : 'Estas ' + paradas.length + ' peças estão paradas') +
      ' há mais de 6 meses. Dá para doar, vender ou reformar. Às vezes, um ajuste no caimento faz a peça voltar ao uso. '));
    var link = criar('a', 'texto-botao', 'Falar sobre um ajuste');
    link.href = app.linkWhatsapp('Olá! Tenho uma peça parada no guarda-roupa e queria saber se dá para ajustar.');
    link.target = '_blank';
    link.rel = 'noopener';
    texto.appendChild(link);
  }

  function desenharCustoPorUso(uso) {
    var comPreco = pecas.filter(function (p) { return p.preco; });
    var lista = $('gr-custo');
    lista.textContent = '';
    comPreco.map(function (p) {
      var vezes = uso[p.id] ? uso[p.id].vezes : 0;
      return { peca: p, vezes: vezes, porUso: vezes ? p.preco / vezes : Infinity };
    }).sort(function (a, b) { return a.porUso - b.porUso; }).forEach(function (x) {
      var li = criar('li');
      var miniatura = figuraDaPeca(x.peca);
      miniatura.style.width = '44px';
      miniatura.style.flex = 'none';
      miniatura.style.borderRadius = '9px';
      li.appendChild(miniatura);
      var texto = criar('span', 'app-lista-texto', nomeDaPeca(x.peca));
      texto.appendChild(criar('small', '', reais(x.peca.preco) + (x.vezes ? ', usada ' + x.vezes + (x.vezes === 1 ? ' vez' : ' vezes') : ', ainda não anotada no diário')));
      li.appendChild(texto);
      li.appendChild(criar('strong', '', x.vezes ? reais(Math.round(x.porUso)) + ' por uso' : '—'));
      lista.appendChild(li);
    });
    lista.hidden = !comPreco.length;
    $('gr-custo-texto').textContent = comPreco.length
      ? 'O valor que você pagou dividido pelas vezes que usou. Peça boa e versátil fica barata com o tempo: um terno de R$ 1.500 usado 60 vezes sai a R$ 25 por uso.'
      : 'Informe quanto pagou ao editar uma peça (no ícone de lápis). Com o diário, você vê quanto cada uma custa por uso.';
  }

  /* --- Início --------------------------------------------------------------------------------- */

  preencherSelect('gr-filtro-grupo', [
    { id: 'minhas', rotulo: 'Só as minhas' }, { id: 'sugeridas', rotulo: 'Só as sugeridas' }
  ].concat(gr.GRUPOS), 'Todas as peças');
  preencherSelect('gr-filtro-nivel', gr.FORMALIDADES, 'Todas');
  preencherSelect('gr-filtro-clima', gr.CLIMAS.filter(function (c) { return c.id !== 'qualquer'; }), 'Qualquer');
  preencherSelect('gr-tecido', gr.TECIDOS, 'Não sei ou prefiro não informar');
  preencherSelect('gr-cor', gr.CORES, 'Escolha');
  preencherSelect('gr-corte', gr.CORTES, 'Escolha');
  preencherSelect('gr-formalidade', gr.FORMALIDADES);
  preencherSelect('gr-clima', gr.CLIMAS);
  $('gr-tempo-uf').appendChild(new Option('—', ''));
  UFS.forEach(function (uf) { $('gr-tempo-uf').appendChild(new Option(uf, uf)); });
  $('gr-tipo').appendChild(new Option('Escolha', ''));
  gr.GRUPOS.forEach(function (g) {
    var grupo = document.createElement('optgroup');
    grupo.label = g.rotulo;
    gr.TIPOS.filter(function (t) { return t.grupo === g.id; }).forEach(function (t) {
      grupo.appendChild(new Option(t.rotulo, t.id));
    });
    $('gr-tipo').appendChild(grupo);
  });

  // O cadastro de várias peças, em outro arquivo, conversa com esta tela por aqui
  window.AR_GR_TELA = {
    vagas: function () { return Math.max(0, maximo - pecasProprias()); },
    jaConsentiu: function () { return consentiu; },
    aoGuardar: function (peca) {
      consentiu = true;
      pecas.unshift(peca);
      paginaLooks = 1;
      desenharPecas();
    },
    avisar: avisar,
    pagina: PAGINA
  };

  api.get(ENDERECO).then(function (r) {
    $('carregando').hidden = true;
    if (r.status === 401) {
      $('gr-fora').hidden = false;
      return;
    }
    if (!r.ok) {
      $('carregando').hidden = false;
      $('carregando').textContent = 'Não foi possível abrir seu guarda-roupa. Tente novamente em instantes.';
      return;
    }
    pecas = r.dados.pecas;
    excluidas = r.dados.excluidas;
    usos = r.dados.usos || [];
    maximo = r.dados.maximoPecas;
    consentiu = r.dados.consentiu;
    $('gr-maximo').textContent = String(maximo);
    r.dados.looks.slice().reverse().forEach(function (l) { decisoes[l.chave] = l.situacao; });
    r.dados.notas.forEach(function (n) { notas[n.chave] = { nome: n.nome, observacao: n.observacao }; });
    $('gr-dentro').hidden = false;
    $('gr-fab').hidden = false;
    desenharPecas();
    var inicial = location.hash.slice(1);
    abrirAba(ABAS.indexOf(inicial) !== -1 ? inicial : 'pecas');
  });
})();
