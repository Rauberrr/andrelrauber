/* Guarda-roupa: tela das peças, cadastro com foto e aba de looks.
   Tudo que a pessoa digita é escrito como texto, nunca como HTML. */
(function () {
  'use strict';

  var api = window.AR_API;
  var gr = window.AR_GR;
  var foto = window.AR_FOTO;
  var motor = window.AR_LOOKS;
  var ENDERECO = 'api/guarda-roupa.php';

  var pecas = [];
  var decisoes = {};
  var notas = {};
  // Looks que acabaram de sair de Rejeitados: aparecem primeiro nas sugestões
  var recuperados = [];
  var maximo = 60;
  var consentiu = false;
  var paginaLooks = 1;
  var rascunho = null;

  function $(id) { return document.getElementById(id); }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function preencherSelect(id, lista, vazio) {
    var s = $(id);
    if (vazio !== undefined) s.appendChild(new Option(vazio, ''));
    lista.forEach(function (item) { s.appendChild(new Option(item.rotulo, item.id)); });
  }

  /* --- Abas -------------------------------------------------------------------- */

  var ABAS = ['pecas', 'looks'];

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
    if (nome === 'looks') desenharLooks();
    var hash = nome === 'looks' ? '#looks' : '#pecas';
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  ABAS.forEach(function (nome, i) {
    var botao = $('aba-' + nome);
    botao.addEventListener('click', function () { abrirAba(nome); });
    botao.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      abrirAba(ABAS[(i + 1) % ABAS.length], true);
    });
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

  /* --- Minhas peças ------------------------------------------------------------------ */

  function desenharPecas() {
    var grade = $('gr-pecas');
    grade.textContent = '';
    var grupo = $('gr-filtro-grupo').value;
    var lista = pecas.filter(function (p) {
      return !grupo || (gr.porTipo[p.tipo] && gr.porTipo[p.tipo].grupo === grupo);
    });

    lista.forEach(function (p) {
      var item = criar('li', 'gr-peca');
      var botao = criar('button', 'gr-peca-botao');
      botao.type = 'button';
      botao.setAttribute('aria-label', 'Editar: ' + gr.descrever(p));
      botao.appendChild(figuraDaPeca(p));
      botao.addEventListener('click', function () { abrirEdicao(p.id); });
      item.appendChild(botao);
      item.appendChild(criar('p', 'gr-descricao', gr.descrever(p)));
      if (p.apelido) item.appendChild(criar('p', 'gr-apelido', p.apelido));
      grade.appendChild(item);
    });

    $('gr-contagem').textContent = pecas.length === 1 ? '1 peça' : pecas.length + ' peças';
    $('gr-vazio').hidden = pecas.length > 0;
    $('gr-pecas-filtro').hidden = pecas.length === 0;
    $('gr-filtro-vazio').hidden = pecas.length === 0 || lista.length > 0;
    $('gr-adicionar').disabled = pecas.length >= maximo;
    $('gr-limite').hidden = pecas.length < maximo;
  }

  $('gr-filtro-grupo').addEventListener('change', desenharPecas);

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
    $('gr-fundo-titulo').textContent = titulo;
    $('gr-fundo-texto').textContent = texto;
    $('gr-fundo-progresso').hidden = !opcoes.progresso;
    $('gr-fundo-iniciar').hidden = !opcoes.iniciar;
    $('gr-fundo-aceitar').hidden = !opcoes.aceitar;
    $('gr-fundo-original').textContent = opcoes.aceitar ? 'Usar a foto original' : 'Usar a foto como está';
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
    if (foto.jaBaixou()) {
      iniciarRemocao();
      return;
    }
    estadoFundo(
      'Tirar o fundo da foto?',
      'A ferramenta roda no seu aparelho e sua foto não é enviada para esse processo. Na primeira vez, ela baixa cerca de 45 MB, então prefira usar Wi-Fi. Nas próximas, começa mais rápido.',
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
        ? (foto.jaBaixou() ? 'Preparando a ferramenta: ' : 'Baixando a ferramenta: ') + Math.round(p.parte * 100) + '%.'
        : 'Separando a peça do fundo. Deixe esta tela aberta.';
    });
    atual.tarefa.resultado.then(foto.enquadrar).then(function (final) {
      if (rascunho !== atual) return;
      atual.tarefa = null;
      if (!final) {
        falhaNoFundo('Não encontramos a peça nesta foto. Com a peça estendida sobre um fundo liso, costuma dar certo.');
        return;
      }
      atual.recorte = final;
      mostrarPrevia(final, true);
      estadoFundo('Ficou bom?', final.fundoSuspeito
        ? 'Parte do fundo pode ter ficado na imagem. Confira e, se precisar, tire outra foto com a peça sobre um fundo liso de outra cor.'
        : 'A peça foi centralizada e o fundo foi removido.', { aceitar: true });
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

  $('gr-fundo-aceitar').addEventListener('click', function () {
    rascunho.final = rascunho.recorte;
    rascunho.transparente = true;
    irParaDescricao();
  });

  $('gr-fundo-original').addEventListener('click', function () {
    if (rascunho.tarefa) {
      rascunho.tarefa.cancelar();
      rascunho.tarefa = null;
    }
    rascunho.final = rascunho.original;
    rascunho.transparente = false;
    irParaDescricao();
  });

  $('gr-fundo-outra').addEventListener('click', function () {
    if (rascunho.tarefa) {
      rascunho.tarefa.cancelar();
      rascunho.tarefa = null;
    }
    mostrarPasso('gr-passo-foto');
  });

  /* --- Cadastro: descrição ------------------------------------------------------------------ */

  var CAMPOS = ['foto', 'tipo', 'cor', 'corte', 'tecido', 'formalidade', 'clima', 'consentimento'];

  function limparErros() {
    CAMPOS.forEach(function (c) {
      var e = $('erro-' + c);
      if (e) e.textContent = '';
    });
    $('gr-form-erro').textContent = '';
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
    $('gr-resumo-img').hidden = true;
    $('gr-excluir').hidden = true;
    $('gr-campo-consentimento').hidden = consentiu;
    $('gr-consentimento').checked = false;
    $('gr-salvar').textContent = 'Guardar peça';
    mostrarPasso('gr-passo-descricao');
  }

  function abrirEdicao(id) {
    var p = pecas.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    limparRascunho();
    rascunho = { id: id };
    escolheuFormalidade = true;
    escolheuClima = true;
    encherForm(p);
    $('gr-cor-dica').hidden = true;
    $('gr-descricao-titulo').textContent = 'Editar peça';
    var miniatura = $('gr-resumo-img');
    miniatura.textContent = '';
    miniatura.appendChild(figuraDaPeca(p));
    miniatura.hidden = false;
    $('gr-excluir').hidden = false;
    $('gr-campo-consentimento').hidden = true;
    $('gr-salvar').textContent = 'Salvar alterações';
    mostrarPasso('gr-passo-descricao');
    $('gr-modal').showModal();
  }

  function mostrarErros(r) {
    if (r.status === 401) { api.irParaLogin('guarda-roupa.html'); return; }
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
      Object.keys(v).forEach(function (c) { f.append(c, v[c]); });
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
    return api.post(ENDERECO + '?acao=editar', v).then(function (r) {
      if (!r.ok) { mostrarErros(r); return; }
      pecas = pecas.map(function (p) { return p.id === id ? r.dados.peca : p; });
      desenharPecas();
      $('gr-modal').close();
      avisar('Peça atualizada.');
    });
  }

  $('gr-excluir').addEventListener('click', function () {
    if (!window.confirm('Excluir esta peça e a foto dela? Os looks salvos com ela também saem.')) return;
    var id = rascunho.id;
    api.post(ENDERECO + '?acao=excluir', { id: id }).then(function (r) {
      if (!r.ok) { mostrarErros(r); return; }
      pecas = pecas.filter(function (p) { return p.id !== id; });
      [decisoes, notas].forEach(function (mapa) {
        Object.keys(mapa).forEach(function (chave) {
          if (chave.split('-').indexOf(String(id)) !== -1) delete mapa[chave];
        });
      });
      desenharPecas();
      $('gr-modal').close();
      avisar('Peça excluída.');
    });
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

  /* --- Looks -------------------------------------------------------------------------------- */

  function rotuloNivel(n) {
    return gr.FORMALIDADES.filter(function (f) { return f.nivel === n; })[0].rotulo;
  }

  function idsDoLook(look) {
    return look.pecas.map(function (p) { return p.id; });
  }

  function decidir(look, situacao) {
    var antes = decisoes[look.chave];
    return api.post(ENDERECO + '?acao=look', { pecas: idsDoLook(look), situacao: situacao }).then(function (r) {
      if (!r.ok) {
        if (r.status === 401) { api.irParaLogin('guarda-roupa.html'); return; }
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
          if (r.status === 401) { api.irParaLogin('guarda-roupa.html'); return; }
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
    if (look.nivel) cab.appendChild(criar('span', 'etiqueta', rotuloNivel(look.nivel)));
    cartao.appendChild(cab);
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
    var porId = {};
    pecas.forEach(function (p) { porId[p.id] = p; });
    return Object.keys(decisoes).filter(function (chave) {
      return decisoes[chave] === situacao;
    }).map(function (chave) {
      var lista = chave.split('-').map(function (id) { return porId[id]; }).filter(Boolean);
      return { chave: chave, pecas: lista, motivos: [] };
    }).filter(function (l) { return l.pecas.length >= 2; }).reverse();
  }

  function desenharLooks() {
    var caixa = $('gr-looks');
    caixa.textContent = '';
    var mostrar = $('gr-filtro-mostrar').value;
    var falta = motor.oQueFalta(pecas);
    var mensagem = '';
    var lista;

    $('gr-looks-filtros').hidden = falta.length > 0;
    var soSugestoes = mostrar === 'sugeridos';
    $('gr-filtro-nivel').closest('.campo').hidden = !soSugestoes;
    $('gr-filtro-clima').closest('.campo').hidden = !soSugestoes;

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
      var nivel = Number($('gr-filtro-nivel').value) || null;
      lista = motor.sugerir(pecas, { nivel: nivel, clima: $('gr-filtro-clima').value }, decisoes);
      lista = lista.filter(function (l) { return recuperados.indexOf(l.chave) !== -1; }).concat(
        lista.filter(function (l) { return recuperados.indexOf(l.chave) === -1; })
      );
      if (!lista.length) mensagem = 'Nenhuma combinação com esses filtros. Experimente outro filtro ou adicione mais peças.';
    }

    var limite = soSugestoes ? paginaLooks * motor.POR_PAGINA : lista.length;
    lista.slice(0, limite).forEach(function (look, i) {
      caixa.appendChild(cartaoDeLook(look, i + 1));
    });

    $('gr-looks-vazio').textContent = mensagem;
    $('gr-looks-vazio').hidden = !mensagem;
    $('gr-looks-mais').hidden = lista.length <= limite;

    var convite = $('gr-convite-texto');
    convite.textContent = motor.temSobreposicao(pecas)
      ? 'Sentiu falta de uma peça para completar seus looks? Podemos fazê-la nas suas medidas.'
      : 'Um blazer sob medida abriria novas combinações para o seu guarda-roupa.';
    $('gr-convite').hidden = falta.length > 0;
  }

  ['gr-filtro-mostrar', 'gr-filtro-nivel', 'gr-filtro-clima'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      paginaLooks = 1;
      desenharLooks();
    });
  });

  $('gr-looks-mais').addEventListener('click', function () {
    paginaLooks += 1;
    desenharLooks();
  });

  /* --- Início --------------------------------------------------------------------------------- */

  preencherSelect('gr-filtro-grupo', gr.GRUPOS, 'Todas as peças');
  preencherSelect('gr-tecido', gr.TECIDOS, 'Não sei ou prefiro não informar');
  preencherSelect('gr-cor', gr.CORES, 'Escolha');
  preencherSelect('gr-corte', gr.CORTES, 'Escolha');
  preencherSelect('gr-formalidade', gr.FORMALIDADES);
  preencherSelect('gr-clima', gr.CLIMAS);
  $('gr-tipo').appendChild(new Option('Escolha', ''));
  gr.GRUPOS.forEach(function (g) {
    var grupo = document.createElement('optgroup');
    grupo.label = g.rotulo;
    gr.TIPOS.filter(function (t) { return t.grupo === g.id; }).forEach(function (t) {
      grupo.appendChild(new Option(t.rotulo, t.id));
    });
    $('gr-tipo').appendChild(grupo);
  });

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
    maximo = r.dados.maximoPecas;
    consentiu = r.dados.consentiu;
    $('gr-maximo').textContent = String(maximo);
    r.dados.looks.slice().reverse().forEach(function (l) { decisoes[l.chave] = l.situacao; });
    r.dados.notas.forEach(function (n) { notas[n.chave] = { nome: n.nome, observacao: n.observacao }; });
    $('gr-dentro').hidden = false;
    desenharPecas();
    abrirAba(location.hash === '#looks' ? 'looks' : 'pecas');
  });
})();
