/* Guarda-roupa: cadastro de várias peças de uma vez.
   Primeiro todas as fotos, depois a descrição de cada uma, e por fim o envio de todas juntas.
   O fundo sai em segundo plano, uma foto por vez, enquanto a pessoa descreve. */
(function () {
  'use strict';

  var api = window.AR_API;
  var gr = window.AR_GR;
  var foto = window.AR_FOTO;
  var tela = window.AR_GR_TELA;
  var ENDERECO = 'api/guarda-roupa.php?acao=adicionar';
  var MAXIMO_POR_VEZ = 20;
  var PASSOS = ['lote-passo-fotos', 'lote-passo-descricao', 'lote-passo-revisao'];

  var itens = [];
  var atual = 0;
  var tarefa = null;
  var filaAtiva = false;
  var enviando = false;
  var enviarAoTerminar = false;
  var proximoId = 1;

  function $(id) { return document.getElementById(id); }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function mostrarPasso(id) {
    PASSOS.forEach(function (p) { $(p).hidden = p !== id; });
    $('lote-modal').scrollTop = 0;
  }

  function preencher(id, lista, vazio) {
    var s = $(id);
    if (vazio !== undefined) s.appendChild(new Option(vazio, ''));
    lista.forEach(function (item) { s.appendChild(new Option(item.rotulo, item.id)); });
  }

  preencher('lote-cor', gr.CORES, 'Escolha');
  preencher('lote-corte', gr.CORTES, 'Escolha');
  preencher('lote-tecido', gr.TECIDOS, 'Não sei ou prefiro não informar');
  preencher('lote-formalidade', gr.FORMALIDADES);
  preencher('lote-clima', gr.CLIMAS);
  $('lote-tipo').appendChild(new Option('Escolha', ''));
  gr.GRUPOS.forEach(function (g) {
    var grupo = document.createElement('optgroup');
    grupo.label = g.rotulo;
    gr.TIPOS.filter(function (t) { return t.grupo === g.id; }).forEach(function (t) {
      grupo.appendChild(new Option(t.rotulo, t.id));
    });
    $('lote-tipo').appendChild(grupo);
  });

  /* --- Fotos -------------------------------------------------------------------------- */

  function vagas() {
    return Math.min(MAXIMO_POR_VEZ, tela.vagas());
  }

  function liberar(item) {
    if (item.url) URL.revokeObjectURL(item.url);
    if (item.urlRecorte) URL.revokeObjectURL(item.urlRecorte);
  }

  function zerar() {
    if (tarefa) tarefa.cancelar();
    tarefa = null;
    filaAtiva = false;
    enviarAoTerminar = false;
    itens.forEach(liberar);
    itens = [];
    atual = 0;
  }

  function abrir() {
    zerar();
    $('lote-fotos-erro').textContent = '';
    var pode = foto.podeRemover();
    $('lote-campo-fundo').hidden = !pode;
    $('lote-tirar-fundo').checked = pode;
    $('lote-fundo-texto').textContent = foto.jaBaixou()
      ? 'Tirar o fundo das fotos enquanto eu descrevo'
      : 'Tirar o fundo das fotos enquanto eu descrevo. Na primeira vez, baixa cerca de 45 MB: prefira o Wi-Fi.';
    desenharMiniaturas();
    mostrarPasso('lote-passo-fotos');
    $('lote-modal').showModal();
  }

  $('gr-adicionar-varias').addEventListener('click', abrir);
  $('lote-tirar').addEventListener('click', function () { $('lote-camera').click(); });
  $('lote-escolher').addEventListener('click', function () { $('lote-galeria').click(); });

  function aoEscolher(e) {
    var arquivos = Array.prototype.slice.call(e.target.files || []);
    e.target.value = '';
    $('lote-fotos-erro').textContent = '';
    var espaco = vagas() - itens.length;
    if (arquivos.length > espaco) {
      $('lote-fotos-erro').textContent = 'Cabem ' + vagas() + ' fotos de cada vez. As demais ficaram de fora.';
      arquivos = arquivos.slice(0, Math.max(0, espaco));
    }
    // Uma por vez, para o celular não abrir várias fotos grandes ao mesmo tempo
    arquivos.reduce(function (caminho, arquivo) {
      return caminho.then(function () { return acrescentar(arquivo); });
    }, Promise.resolve()).then(function () {
      desenharMiniaturas();
      $('lote-tirar').textContent = itens.length ? 'Tirar outra foto' : 'Tirar foto';
      if (!$('lote-passo-revisao').hidden) desenharRevisao();
    });
  }

  $('lote-camera').addEventListener('change', aoEscolher);
  $('lote-galeria').addEventListener('change', aoEscolher);

  function paraJpeg(canvas) {
    return new Promise(function (ok, erro) {
      canvas.toBlob(function (blob) {
        if (blob) ok(blob); else erro(new Error('foto'));
      }, 'image/jpeg', 0.88);
    });
  }

  // Guarda a foto como arquivo, e não aberta na memória: 20 fotos abertas derrubariam o celular
  function acrescentar(arquivo) {
    return foto.abrir(arquivo).then(function (canvas) {
      var cor = foto.corPrincipal(canvas, false);
      return paraJpeg(canvas).then(function (blob) {
        canvas.width = 0;
        canvas.height = 0;
        itens.push({
          id: proximoId++, original: blob, url: URL.createObjectURL(blob), recorte: null, urlRecorte: '',
          // sem: fica como está. fila, tirando, pronto, falhou: etapas de tirar o fundo
          fundo: 'sem', usarOriginal: false, suspeito: false, corSugerida: cor,
          valores: { tipo: '', cor: cor, corte: '', tecido: '', formalidade: 'casual', clima: 'qualquer' },
          descrita: false, corTocada: false, tocouOcasiao: false, tocouClima: false, erro: ''
        });
      });
    }).catch(function () {
      $('lote-fotos-erro').textContent = 'Uma das fotos não abriu. Tente outra, em JPG ou PNG.';
    });
  }

  function desenharMiniaturas() {
    var lista = $('lote-miniaturas');
    lista.textContent = '';
    itens.forEach(function (item, i) {
      var li = criar('li', 'lote-miniatura');
      var img = document.createElement('img');
      img.src = item.url;
      img.alt = 'Foto ' + (i + 1);
      li.appendChild(img);
      var tirar = criar('button', 'lote-miniatura-tirar', '×');
      tirar.type = 'button';
      tirar.setAttribute('aria-label', 'Tirar a foto ' + (i + 1) + ' da lista');
      tirar.addEventListener('click', function () { removerItem(item); desenharMiniaturas(); });
      li.appendChild(tirar);
      lista.appendChild(li);
    });
    var n = itens.length;
    $('lote-continuar').hidden = n === 0;
    $('lote-continuar').textContent = n === 1 ? 'Continuar com 1 foto' : 'Continuar com ' + n + ' fotos';
    $('lote-tirar').disabled = n >= vagas();
    $('lote-escolher').disabled = n >= vagas();
  }

  function removerItem(item) {
    if (item.fundo === 'tirando' && tarefa) {
      tarefa.cancelar();
      tarefa = null;
    }
    liberar(item);
    itens = itens.filter(function (x) { return x !== item; });
    $('lote-tirar').textContent = itens.length ? 'Tirar outra foto' : 'Tirar foto';
  }

  $('lote-continuar').addEventListener('click', function () {
    if (!itens.length) return;
    if ($('lote-tirar-fundo').checked) {
      itens.forEach(function (item) { if (item.fundo === 'sem') item.fundo = 'fila'; });
      processarFila();
    }
    var primeira = itens.map(function (x) { return x.descrita; }).indexOf(false);
    if (primeira === -1) { irParaRevisao(); return; }
    abrirItem(primeira);
  });

  /* --- Tirar o fundo em segundo plano -------------------------------------------------- */

  function processarFila() {
    if (filaAtiva) return;
    var item = itens.filter(function (x) { return x.fundo === 'fila'; })[0];
    if (!item) { aoTerminarFila(); return; }
    filaAtiva = true;
    item.fundo = 'tirando';
    atualizarEstado();

    function fim() {
      filaAtiva = false;
      tarefa = null;
      atualizarEstado();
      if (!$('lote-passo-revisao').hidden) desenharRevisao();
      processarFila();
    }

    foto.abrir(item.original).then(function (canvas) {
      tarefa = foto.removerFundo(canvas, function () {});
      return tarefa.resultado;
    }).then(foto.enquadrar).then(function (final) {
      if (!final) { item.fundo = 'falhou'; return null; }
      var cor = foto.corPrincipal(final, true);
      if (!item.corTocada && cor) {
        item.corSugerida = cor;
        item.valores.cor = cor;
        if (itens[atual] === item && !$('lote-passo-descricao').hidden) $('lote-cor').value = cor;
      }
      item.suspeito = final.fundoSuspeito;
      return foto.exportar(final, true).then(function (blob) {
        item.recorte = blob;
        item.urlRecorte = URL.createObjectURL(blob);
        item.fundo = 'pronto';
      });
    }).then(fim).catch(function (erro) {
      // Cancelou porque a foto saiu da lista ou porque a pessoa decidiu não esperar
      if (!erro || erro.message !== 'cancelado') item.fundo = 'falhou';
      else if (item.fundo === 'tirando') item.fundo = 'sem';
      fim();
    });
  }

  function pendentes() {
    return itens.filter(function (x) { return x.fundo === 'fila' || x.fundo === 'tirando'; }).length;
  }

  function aoTerminarFila() {
    if (enviarAoTerminar) {
      enviarAoTerminar = false;
      enviarTodas();
    }
  }

  function textoDoFundo(item) {
    if (item.usarOriginal) return 'Foto original.';
    var seguir = $('lote-passo-revisao').hidden ? ' Pode continuar descrevendo.' : '';
    if (item.fundo === 'tirando') return 'Tirando o fundo desta foto.' + seguir;
    if (item.fundo === 'fila') return 'O fundo desta foto sai em breve.' + seguir;
    if (item.fundo === 'falhou') return 'Não deu para tirar o fundo desta foto. Ela será guardada como está.';
    if (item.fundo === 'pronto') {
      return item.suspeito ? 'Parte do fundo pode ter ficado. Confira a imagem.' : 'Fundo retirado.';
    }
    return '';
  }

  function atualizarEstado() {
    var item = itens[atual];
    if (!item || $('lote-passo-descricao').hidden) return;
    $('lote-estado').textContent = textoDoFundo(item);
    var comRecorte = item.fundo === 'pronto' && !item.usarOriginal;
    $('lote-previa').classList.toggle('gr-foto-recorte', comRecorte);
    var url = comRecorte ? item.urlRecorte : item.url;
    if ($('lote-previa-img').getAttribute('src') !== url) $('lote-previa-img').src = url;
    $('lote-usar-original').hidden = item.fundo !== 'pronto';
    $('lote-usar-original').textContent = item.usarOriginal ? 'Usar a foto sem fundo' : 'Usar a foto original';
  }

  $('lote-usar-original').addEventListener('click', function () {
    var item = itens[atual];
    item.usarOriginal = !item.usarOriginal;
    atualizarEstado();
  });

  /* --- Descrever uma foto de cada vez ------------------------------------------------------- */

  function lerForm() {
    var tipo = $('lote-tipo').value;
    return {
      tipo: tipo,
      cor: $('lote-cor').value,
      corte: gr.temCorte(tipo) ? $('lote-corte').value : '',
      tecido: $('lote-tecido').value,
      formalidade: $('lote-formalidade').value,
      clima: $('lote-clima').value
    };
  }

  function guardarForm() {
    var item = itens[atual];
    if (item) item.valores = lerForm();
  }

  function atualizarResumo() {
    var v = lerForm();
    $('lote-campo-corte').hidden = !gr.temCorte(v.tipo);
    $('lote-resumo').textContent = gr.descrever(v) || 'Escolha o tipo, a cor e o corte.';
  }

  function limparErros() {
    ['tipo', 'cor', 'corte'].forEach(function (c) { $('lote-erro-' + c).textContent = ''; });
  }

  function abrirItem(indice) {
    atual = indice;
    var item = itens[indice];
    var v = item.valores;
    $('lote-tipo').value = v.tipo;
    $('lote-cor').value = v.cor;
    $('lote-corte').value = v.corte;
    $('lote-tecido').value = v.tecido;
    $('lote-formalidade').value = v.formalidade;
    $('lote-clima').value = v.clima;
    $('lote-cor-dica').hidden = item.corTocada || !item.corSugerida;
    limparErros();
    atualizarResumo();
    $('lote-posicao').textContent = 'Peça ' + (indice + 1) + ' de ' + itens.length;
    $('lote-anterior').hidden = indice === 0;
    $('lote-proxima').textContent = indice === itens.length - 1 ? 'Conferir e guardar' : 'Próxima peça';
    mostrarPasso('lote-passo-descricao');
    atualizarEstado();
  }

  $('lote-tipo').addEventListener('change', function () {
    var item = itens[atual];
    var tipo = $('lote-tipo').value;
    if (!item.tocouOcasiao) $('lote-formalidade').value = gr.formalidadePadrao(tipo);
    if (!item.tocouClima) $('lote-clima').value = gr.climaPadrao(tipo, $('lote-tecido').value);
    atualizarResumo();
  });
  $('lote-tecido').addEventListener('change', function () {
    if (!itens[atual].tocouClima) $('lote-clima').value = gr.climaPadrao($('lote-tipo').value, $('lote-tecido').value);
    atualizarResumo();
  });
  $('lote-cor').addEventListener('change', function () {
    itens[atual].corTocada = true;
    $('lote-cor-dica').hidden = true;
    atualizarResumo();
  });
  $('lote-corte').addEventListener('change', atualizarResumo);
  $('lote-formalidade').addEventListener('change', function () { itens[atual].tocouOcasiao = true; });
  $('lote-clima').addEventListener('change', function () { itens[atual].tocouClima = true; });

  function validar(v) {
    var ok = true;
    if (!v.tipo) { $('lote-erro-tipo').textContent = 'Escolha o tipo da peça.'; ok = false; }
    if (!v.cor) { $('lote-erro-cor').textContent = 'Escolha a cor.'; ok = false; }
    if (gr.temCorte(v.tipo) && !v.corte) { $('lote-erro-corte').textContent = 'Escolha o corte.'; ok = false; }
    return ok;
  }

  $('lote-passo-descricao').addEventListener('submit', function (e) {
    e.preventDefault();
    limparErros();
    var v = lerForm();
    if (!validar(v)) return;
    var item = itens[atual];
    item.valores = v;
    item.descrita = true;
    var seguinte = itens.map(function (x) { return x.descrita; }).indexOf(false);
    if (atual + 1 < itens.length) abrirItem(atual + 1);
    else if (seguinte !== -1) abrirItem(seguinte);
    else irParaRevisao();
  });

  $('lote-anterior').addEventListener('click', function () {
    guardarForm();
    abrirItem(atual - 1);
  });

  $('lote-tirar-esta').addEventListener('click', function () {
    removerItem(itens[atual]);
    if (!itens.length) {
      desenharMiniaturas();
      mostrarPasso('lote-passo-fotos');
      return;
    }
    var seguinte = itens.map(function (x) { return x.descrita; }).indexOf(false);
    if (seguinte === -1) irParaRevisao();
    else abrirItem(seguinte);
  });

  /* --- Conferir e guardar --------------------------------------------------------------------- */

  function irParaRevisao() {
    mostrarPasso('lote-passo-revisao');
    $('lote-campo-consentimento').hidden = tela.jaConsentiu();
    $('lote-erro').textContent = '';
    desenharRevisao();
  }

  function desenharRevisao() {
    var lista = $('lote-revisao');
    lista.textContent = '';
    itens.forEach(function (item, i) {
      var li = criar('li', 'lote-revisao-item');
      var usaRecorte = item.fundo === 'pronto' && !item.usarOriginal;
      var fig = criar('div', 'gr-foto' + (usaRecorte ? ' gr-foto-recorte' : ''));
      var img = document.createElement('img');
      img.src = usaRecorte ? item.urlRecorte : item.url;
      img.alt = '';
      fig.appendChild(img);
      li.appendChild(fig);
      var texto = criar('div');
      texto.appendChild(criar('p', 'gr-descricao', gr.descrever(item.valores)));
      texto.appendChild(criar('p', 'gr-suave', textoDoFundo(item)));
      if (item.erro) texto.appendChild(criar('p', 'erro', item.erro));
      if (!enviando) {
        var editar = criar('button', 'texto-botao', 'Editar');
        editar.type = 'button';
        editar.setAttribute('aria-label', 'Editar a peça ' + (i + 1));
        editar.addEventListener('click', function () { abrirItem(i); });
        texto.appendChild(editar);
      }
      li.appendChild(texto);
      lista.appendChild(li);
    });

    var n = itens.length;
    $('lote-revisao-titulo').textContent = n === 1 ? 'Confira e guarde a peça' : 'Confira e guarde as ' + n + ' peças';
    $('lote-guardar').textContent = n === 1 ? 'Guardar peça' : 'Guardar todas as ' + n;
    var falta = pendentes();
    var esperando = enviarAoTerminar && falta > 0;
    $('lote-guardar').disabled = enviando || esperando;
    $('lote-sem-esperar').hidden = !esperando;
    $('lote-mais-fotos').hidden = enviando || esperando || n >= vagas();
    if (!enviando) {
      $('lote-progresso-texto').textContent = falta
        ? (falta === 1 ? 'Falta tirar o fundo de 1 foto.' : 'Falta tirar o fundo de ' + falta + ' fotos.') +
          (esperando ? ' As peças são guardadas assim que terminar.' : ' Você já pode guardar: elas são enviadas quando terminar.')
        : '';
    }
  }

  $('lote-mais-fotos').addEventListener('click', function () {
    desenharMiniaturas();
    mostrarPasso('lote-passo-fotos');
  });

  $('lote-guardar').addEventListener('click', function () {
    $('lote-erro').textContent = '';
    $('lote-erro-consentimento').textContent = '';
    if (!tela.jaConsentiu() && !$('lote-consentimento').checked) {
      $('lote-erro-consentimento').textContent = 'É preciso concordar para continuar.';
      return;
    }
    if (pendentes()) {
      enviarAoTerminar = true;
      desenharRevisao();
      return;
    }
    enviarTodas();
  });

  // Para de esperar: as fotos que ainda não perderam o fundo vão como estão
  $('lote-sem-esperar').addEventListener('click', function () {
    enviarAoTerminar = false;
    if (tarefa) tarefa.cancelar();
    tarefa = null;
    itens.forEach(function (x) { if (x.fundo === 'fila' || x.fundo === 'tirando') x.fundo = 'sem'; });
    filaAtiva = false;
    enviarTodas();
  });

  function enviarUma(item) {
    var usaRecorte = item.fundo === 'pronto' && !item.usarOriginal;
    var blob = usaRecorte ? item.recorte : item.original;
    var f = new FormData();
    var v = item.valores;
    Object.keys(v).forEach(function (c) { f.append(c, v[c]); });
    f.append('apelido', '');
    f.append('fundo_removido', usaRecorte ? '1' : '0');
    if ($('lote-consentimento').checked) f.append('consentimento', '1');
    f.append('foto', blob, blob.type === 'image/webp' ? 'peca.webp' : (blob.type === 'image/png' ? 'peca.png' : 'peca.jpg'));
    return api.enviar(ENDERECO, f);
  }

  // Uma de cada vez: a hospedagem limita o tamanho de cada envio, e uma falha não derruba as outras
  function enviarTodas() {
    enviando = true;
    var total = itens.length;
    var guardadas = 0;
    var pendencias = itens.slice();
    $('lote-progresso').hidden = false;
    desenharRevisao();

    function proxima() {
      var item = pendencias.shift();
      if (!item) { terminarEnvio(guardadas, total); return; }
      $('lote-progresso-texto').textContent = 'Guardando ' + (guardadas + 1) + ' de ' + total + '...';
      $('lote-progresso-barra').style.setProperty('--p', Math.max(0.03, guardadas / total));
      enviarUma(item).then(function (r) {
        if (r.status === 401) { api.irParaLogin('guarda-roupa.html'); return; }
        if (r.ok) {
          item.erro = '';
          guardadas += 1;
          tela.aoGuardar(r.dados.peca);
          removerItem(item);
        } else {
          item.erro = r.erro || 'Não foi possível guardar esta peça.';
        }
        proxima();
      });
    }
    proxima();
  }

  function terminarEnvio(guardadas, total) {
    enviando = false;
    $('lote-progresso').hidden = true;
    $('lote-progresso-texto').textContent = '';
    if (!itens.length) {
      $('lote-modal').close();
      tela.avisar(guardadas === 1 ? 'Peça guardada no seu guarda-roupa.' : guardadas + ' peças guardadas no seu guarda-roupa.');
      return;
    }
    $('lote-campo-consentimento').hidden = tela.jaConsentiu();
    $('lote-erro').textContent = guardadas
      ? guardadas + ' de ' + total + ' peças guardadas. As que ficaram abaixo não foram enviadas: tente de novo.'
      : 'Nenhuma peça foi guardada. Tente de novo.';
    desenharRevisao();
  }

  /* --- Fechar --------------------------------------------------------------------------------- */

  $('lote-fechar').addEventListener('click', function () {
    if (enviando) return;
    if (itens.length && !window.confirm('Sair sem guardar? As fotos desta lista serão perdidas.')) return;
    zerar();
    $('lote-modal').close();
  });

  $('lote-modal').addEventListener('cancel', function (e) {
    // A tecla Esc e o botão de voltar do celular não podem jogar fora as fotos sem perguntar
    if (enviando || (itens.length && !window.confirm('Sair sem guardar? As fotos desta lista serão perdidas.'))) {
      e.preventDefault();
      return;
    }
    zerar();
  });

  window.addEventListener('beforeunload', function (e) {
    if (itens.length && $('lote-modal').open) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
})();
