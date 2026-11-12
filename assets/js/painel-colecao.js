/* Painel: abas, peças da coleção, coleções agendadas e pedidos exclusivos.
   O que veio de um cliente é escrito como texto, nunca como HTML. */
(function () {
  'use strict';

  var api = window.AR_API;
  var C = window.AR_COLECAO;
  var ENDERECO = 'api/produtos.php';
  var dados = { produtos: [], colecoes: [], exclusivos: [] };
  var editando = null;
  var colecaoEditando = null;
  var carregou = false;

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
    b.addEventListener('click', aoClicar);
    return b;
  }

  // "2026-12-01 19:00:00" vira "1/12/2026, 19:00"
  function quando(texto) {
    if (!texto) return '';
    var p = texto.split(/[- :]/);
    return Number(p[2]) + '/' + Number(p[1]) + '/' + p[0] + (p[3] ? ', ' + p[3] + ':' + p[4] : '');
  }

  /* --- Abas -------------------------------------------------------------------------------------- */

  var ABAS = ['clientes', 'colecao', 'exclusivos', 'catalogo', 'assinatura'];
  function abrirAba(nome) {
    ABAS.forEach(function (a) {
      var ativa = a === nome;
      $('aba-' + a).setAttribute('aria-selected', String(ativa));
      $('aba-' + a).tabIndex = ativa ? 0 : -1;
      $('painel-' + a).hidden = !ativa;
    });
    if ((nome === 'colecao' || nome === 'exclusivos') && !carregou) carregar();
    // As abas do catálogo e da assinatura ficam em painel-extras.js
    document.dispatchEvent(new CustomEvent('painel-aba', { detail: nome }));
    history.replaceState(null, '', nome === 'clientes' ? location.pathname : '#' + nome);
  }
  ABAS.forEach(function (a, i) {
    var aba = $('aba-' + a);
    aba.addEventListener('click', function () { abrirAba(a); });
    aba.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var proxima = ABAS[(i + (e.key === 'ArrowRight' ? 1 : ABAS.length - 1)) % ABAS.length];
      abrirAba(proxima);
      $('aba-' + proxima).focus();
    });
  });

  /* --- Carregar ---------------------------------------------------------------------------------- */

  function carregar() {
    return api.get(ENDERECO + '?acao=gestor').then(function (r) {
      $('colecao-carregando').hidden = true;
      if (!r.ok) { $('colecao-carregando').hidden = false; $('colecao-carregando').textContent = r.erro || 'Não foi possível carregar.'; return; }
      carregou = true;
      dados = r.dados;
      desenharColecoes();
      desenharProdutos();
      desenharExclusivos();
    });
  }

  /* --- Coleções ---------------------------------------------------------------------------------- */

  // O que o cliente vê: rascunho nunca aparece; peça de coleção futura espera o lançamento
  function situacaoParaCliente(p, porColecao) {
    if (p.situacao === 'rascunho') return 'Rascunho: não aparece no site';
    var c = p.colecaoId && porColecao[p.colecaoId];
    if (c && c.lancaEm > dados.agora) return 'Agendada para ' + quando(c.lancaEm);
    return p.situacao === 'esgotado' ? 'Esgotada, aparece sem compra' : 'No ar';
  }

  function desenharColecoes() {
    var lista = $('painel-colecoes');
    lista.textContent = '';
    if (!dados.colecoes.length) lista.appendChild(criar('li', 'painel-ajuda', 'Nenhuma coleção agendada.'));
    dados.colecoes.forEach(function (c) {
      var li = criar('li');
      var texto = criar('div');
      texto.appendChild(criar('strong', '', c.nome));
      var noAr = c.lancaEm <= dados.agora;
      var visiveis = dados.produtos.filter(function (p) { return p.colecaoId === c.id && p.situacao !== 'rascunho'; }).length;
      var rascunhos = dados.produtos.filter(function (p) { return p.colecaoId === c.id && p.situacao === 'rascunho'; }).length;
      texto.appendChild(criar('span', '', (noAr ? 'No ar desde ' : 'Lança em ') + quando(c.lancaEm) + ' · ' + visiveis + (visiveis === 1 ? ' peça no lançamento' : ' peças no lançamento') +
        (rascunhos ? ' · ' + rascunhos + (rascunhos === 1 ? ' em rascunho, que não aparece' : ' em rascunho, que não aparecem') : '')));
      li.appendChild(texto);
      li.appendChild(botao('Editar', 'texto-botao', function () { abrirColecao(c); }));
      lista.appendChild(li);
    });
    var sel = $('pf-colecao');
    var escolhida = sel.value;
    sel.textContent = '';
    sel.appendChild(new Option('Nenhuma, aparece quando estiver no ar', ''));
    dados.colecoes.forEach(function (c) { sel.appendChild(new Option(c.nome + ' (' + quando(c.lancaEm) + ')', String(c.id))); });
    sel.value = escolhida;
  }

  function abrirColecao(c) {
    colecaoEditando = c || null;
    $('colecao-modal-titulo').textContent = c ? 'Editar coleção' : 'Agendar coleção';
    $('cf-nome').value = c ? c.nome : '';
    $('cf-descricao').value = c ? c.descricao : '';
    $('cf-lanca').value = c ? c.lancaEm.slice(0, 16).replace(' ', 'T') : '';
    $('cf-apagar').hidden = !c;
    limparErros($('colecao-form'));
    $('colecao-modal').showModal();
  }

  $('nova-colecao').addEventListener('click', function () { abrirColecao(null); });
  $('colecao-form').addEventListener('submit', function (e) {
    e.preventDefault();
    limparErros($('colecao-form'));
    api.post(ENDERECO + '?acao=colecao', {
      id: colecaoEditando ? colecaoEditando.id : 0, nome: $('cf-nome').value, descricao: $('cf-descricao').value, lancaEm: $('cf-lanca').value
    }).then(function (r) {
      if (!r.ok) { mostrarErros($('colecao-form'), r); return; }
      $('colecao-modal').close();
      carregar();
    });
  });
  $('cf-apagar').addEventListener('click', function () {
    if (!window.confirm('Apagar esta coleção? As peças continuam cadastradas, sem coleção.')) return;
    api.post(ENDERECO + '?acao=apagar-colecao', { id: colecaoEditando.id }).then(function () { $('colecao-modal').close(); carregar(); });
  });

  /* --- Peças -------------------------------------------------------------------------------------- */

  function desenharProdutos() {
    var corpo = $('produtos-linhas');
    corpo.textContent = '';
    $('produtos-vazio').hidden = dados.produtos.length > 0;
    var porColecao = {};
    dados.colecoes.forEach(function (c) { porColecao[c.id] = c; });
    dados.produtos.forEach(function (p) {
      var tr = criar('tr');
      var nome = criar('td', 'painel-produto');
      if (p.fotos[0]) {
        var img = document.createElement('img');
        img.src = p.fotos[0];
        img.alt = '';
        nome.appendChild(img);
      }
      var texto = criar('span');
      texto.appendChild(criar('strong', '', p.nome));
      texto.appendChild(criar('small', '', (C.porCategoria[p.categoria] || {}).rotulo || p.categoria));
      nome.appendChild(texto);
      tr.appendChild(nome);
      tr.appendChild(criar('td', '', C.reais(p.precoCentavos)));
      tr.appendChild(criar('td', 'painel-situacao-' + p.situacao, situacaoParaCliente(p, porColecao)));
      tr.appendChild(criar('td', '', p.colecaoId && porColecao[p.colecaoId] ? porColecao[p.colecaoId].nome : '—'));
      tr.appendChild(criar('td', '', String(p.fotos.length)));
      var acoes = criar('td');
      acoes.appendChild(botao('Editar', 'texto-botao', function () { abrirProduto(p); }));
      tr.appendChild(acoes);
      corpo.appendChild(tr);
    });
  }

  function opcoes(sel, lista) {
    sel.textContent = '';
    lista.forEach(function (i) { sel.appendChild(new Option(i.rotulo, i.id)); });
  }
  opcoes($('pf-categoria'), C.CATEGORIAS);
  opcoes($('pf-situacao'), C.SITUACOES);
  opcoes($('pf-modelagem'), C.MODELAGENS);
  $('pf-modelagem').value = 'regular';

  function linhaDeCor(cor) {
    var linha = criar('div', 'painel-cor');
    var amostra = document.createElement('input');
    amostra.type = 'color';
    amostra.value = cor ? cor.hex : '#111111';
    amostra.setAttribute('aria-label', 'Cor');
    var nome = document.createElement('input');
    nome.type = 'text';
    nome.maxLength = 30;
    nome.placeholder = 'Nome da cor, como Preto';
    nome.value = cor ? cor.nome : '';
    nome.setAttribute('aria-label', 'Nome da cor');
    linha.appendChild(amostra);
    linha.appendChild(nome);
    linha.appendChild(botao('Tirar', 'texto-botao', function () { linha.remove(); }));
    $('pf-cores').appendChild(linha);
    return nome;
  }
  $('pf-cor-mais').addEventListener('click', function () { linhaDeCor(null).focus(); });

  function avisoDaSituacao() {
    var colecao = $('pf-colecao').value;
    var situacao = $('pf-situacao').value;
    var aviso = $('pf-situacao-aviso');
    if (situacao === 'rascunho') aviso.textContent = colecao ? 'Em rascunho, a peça não aparece nem depois do lançamento da coleção.' : 'Em rascunho, só você vê a peça.';
    else if (colecao) aviso.textContent = 'A peça aparece no site junto com o lançamento da coleção.';
    else aviso.textContent = situacao === 'esgotado' ? 'A peça aparece no site, sem o botão de compra.' : 'A peça aparece no site assim que você salvar.';
  }
  $('pf-colecao').addEventListener('change', function () {
    if ($('pf-colecao').value && $('pf-situacao').value === 'rascunho') $('pf-situacao').value = 'publicado';
    avisoDaSituacao();
  });
  $('pf-situacao').addEventListener('change', avisoDaSituacao);

  function centavosParaTexto(c) { return c ? (c / 100).toFixed(2).replace('.', ',') : ''; }

  function abrirProduto(p) {
    editando = p || null;
    var f = $('produto-form');
    limparErros(f);
    $('produto-modal-titulo').textContent = p ? 'Editar peça' : 'Nova peça';
    $('pf-nome').value = p ? p.nome : '';
    $('pf-categoria').value = p ? p.categoria : 'camiseta';
    $('pf-situacao').value = p ? p.situacao : 'rascunho';
    $('pf-preco').value = p ? centavosParaTexto(p.precoCentavos) : '';
    $('pf-frete').value = p ? centavosParaTexto(p.freteCentavos) : '';
    $('pf-prazo').value = p ? p.prazoDias : 20;
    $('pf-modelagem').value = p ? p.modelagem : 'regular';
    $('pf-colecao').value = p && p.colecaoId ? String(p.colecaoId) : '';
    avisoDaSituacao();
    $('pf-ordem').value = p ? p.ordem : 0;
    $('pf-resumo').value = p ? p.resumo : '';
    $('pf-descricao').value = p ? p.descricao : '';
    $('pf-tecido').value = p ? p.tecido : '';
    $('pf-composicao').value = p ? p.composicao : '';
    $('pf-gramatura').value = p ? p.gramatura : '';
    $('pf-cuidados').value = p ? p.cuidados : '';
    $('pf-detalhes').value = p ? p.detalhes.join('\n') : '';
    $('pf-cores').textContent = '';
    (p ? p.cores : []).forEach(linhaDeCor);
    $('pf-fotos-estado').textContent = '';
    desenharFotos();
    $('produto-modal').showModal();
    $('produto-modal').scrollTop = 0;
  }

  function desenharFotos() {
    var p = editando;
    var lista = $('pf-fotos');
    lista.textContent = '';
    $('pf-foto-botao').hidden = !p || p.arquivos.length >= 8;
    $('pf-fotos-ajuda').textContent = p
      ? 'A primeira foto é a capa. Use fotos em pé, com fundo claro e a mesma luz. Até 8 fotos.'
      : 'Salve a peça para enviar as fotos.';
    $('pf-ver').hidden = !p;
    $('pf-apagar').hidden = !p;
    if (!p) return;
    $('pf-ver').href = 'produto.html?p=' + encodeURIComponent(p.slug);
    p.arquivos.forEach(function (arquivo, i) {
      var item = criar('div', 'painel-foto');
      var img = document.createElement('img');
      img.src = p.fotos[i];
      img.alt = 'Foto ' + (i + 1);
      item.appendChild(img);
      if (i === 0) item.appendChild(criar('span', 'painel-foto-capa', 'Capa'));
      var acoes = criar('div', 'painel-foto-acoes');
      function mover(d) {
        var ordem = p.arquivos.slice();
        var j = i + d;
        if (j < 0 || j >= ordem.length) return;
        ordem.splice(j, 0, ordem.splice(i, 1)[0]);
        mudarFotos(ordem);
      }
      acoes.appendChild(botao('←', 'texto-botao', function () { mover(-1); }));
      acoes.appendChild(botao('Tirar', 'texto-botao', function () {
        if (window.confirm('Tirar esta foto?')) mudarFotos(p.arquivos.filter(function (x) { return x !== arquivo; }));
      }));
      acoes.appendChild(botao('→', 'texto-botao', function () { mover(1); }));
      item.appendChild(acoes);
      lista.appendChild(item);
    });
  }

  function atualizarProduto(novo) {
    editando = novo;
    var i = dados.produtos.map(function (x) { return x.id; }).indexOf(novo.id);
    if (i === -1) dados.produtos.unshift(novo); else dados.produtos[i] = novo;
    desenharProdutos();
    desenharColecoes();
    desenharFotos();
  }

  function mudarFotos(ordem) {
    api.post(ENDERECO + '?acao=fotos', { id: editando.id, ordem: ordem }).then(function (r) {
      if (r.ok) atualizarProduto(r.dados.produto);
      else $('pf-fotos-estado').textContent = r.erro;
    });
  }

  $('pf-foto').addEventListener('change', function () {
    var arquivos = Array.prototype.slice.call($('pf-foto').files);
    $('pf-foto').value = '';
    var estado = $('pf-fotos-estado');
    var feitos = 0;
    function proximo() {
      var arquivo = arquivos.shift();
      if (!arquivo) { estado.textContent = feitos ? 'Fotos enviadas.' : estado.textContent; return; }
      estado.textContent = 'Enviando foto ' + (feitos + 1) + '...';
      var dadosForm = new FormData();
      dadosForm.append('id', String(editando.id));
      dadosForm.append('foto', arquivo);
      api.enviar(ENDERECO + '?acao=enviar-foto', dadosForm).then(function (r) {
        if (!r.ok) { estado.textContent = r.erro || 'Não foi possível enviar a foto.'; return; }
        feitos += 1;
        atualizarProduto(r.dados.produto);
        proximo();
      });
    }
    proximo();
  });

  $('novo-produto').addEventListener('click', function () { abrirProduto(null); });

  $('produto-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('produto-form');
    limparErros(f);
    var cores = Array.prototype.slice.call($('pf-cores').querySelectorAll('.painel-cor')).map(function (l) {
      var campos = l.querySelectorAll('input');
      return { hex: campos[0].value, nome: campos[1].value.trim() };
    }).filter(function (c) { return c.nome; });
    var colecao = $('pf-colecao').value;
    api.post(ENDERECO + '?acao=salvar', {
      id: editando ? editando.id : 0,
      nome: $('pf-nome').value, categoria: $('pf-categoria').value, situacao: $('pf-situacao').value,
      preco: $('pf-preco').value, frete: $('pf-frete').value, prazoDias: Number($('pf-prazo').value) || 0,
      modelagem: $('pf-modelagem').value, colecaoId: colecao ? Number(colecao) : null, ordem: Number($('pf-ordem').value) || 0,
      resumo: $('pf-resumo').value, descricao: $('pf-descricao').value, tecido: $('pf-tecido').value,
      composicao: $('pf-composicao').value, gramatura: $('pf-gramatura').value, cuidados: $('pf-cuidados').value,
      detalhes: $('pf-detalhes').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean),
      cores: cores
    }).then(function (r) {
      if (!r.ok) { mostrarErros(f, r); return; }
      var novo = !editando;
      atualizarProduto(r.dados.produto);
      $('produto-modal-titulo').textContent = 'Editar peça';
      $('pf-fotos-estado').textContent = novo ? 'Peça salva. Agora envie as fotos.' : 'Alterações salvas.';
      if (novo) $('pf-fotos-caixa').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  $('pf-apagar').addEventListener('click', function () {
    if (!window.confirm('Apagar esta peça e as fotos dela? Não dá para desfazer.')) return;
    api.post(ENDERECO + '?acao=apagar', { id: editando.id }).then(function (r) {
      if (!r.ok) { $('produto-form-erro').textContent = r.erro; return; }
      dados.produtos = dados.produtos.filter(function (x) { return x.id !== editando.id; });
      editando = null;
      $('produto-modal').close();
      desenharProdutos();
      desenharColecoes();
    });
  });

  /* --- Pedidos exclusivos -------------------------------------------------------------------------- */

  function desenharExclusivos() {
    var lista = $('exclusivos-lista');
    lista.textContent = '';
    $('exclusivos-vazio').hidden = dados.exclusivos.length > 0;
    var novos = dados.exclusivos.filter(function (x) { return x.situacao === 'novo'; }).length;
    $('exclusivos-novos').hidden = !novos;
    $('exclusivos-novos').textContent = String(novos);
    dados.exclusivos.forEach(function (x) {
      var li = criar('li', 'painel-exclusivo');
      var cab = criar('div', 'painel-exclusivo-cab');
      var peca = C.porPeca[x.peca];
      var titulo = criar('div');
      titulo.appendChild(criar('strong', '', (peca ? peca.rotulo : x.peca) + (x.quantidade > 1 ? ' × ' + x.quantidade : '')));
      titulo.appendChild(criar('span', '', x.pessoa.nome + ' · ' + quando(x.criadoEm)));
      cab.appendChild(titulo);
      var sel = document.createElement('select');
      sel.setAttribute('aria-label', 'Situação do pedido');
      C.SITUACOES_EXCLUSIVO.forEach(function (s) { sel.appendChild(new Option(s.rotulo, s.id)); });
      sel.value = x.situacao;
      sel.addEventListener('change', function () {
        api.post(ENDERECO + '?acao=exclusivo-situacao', { id: x.id, situacao: sel.value }).then(function (r) {
          if (r.ok) { x.situacao = sel.value; desenharExclusivos(); }
        });
      });
      cab.appendChild(sel);
      li.appendChild(cab);

      var ficha = criar('dl', 'painel-exclusivo-ficha');
      function linha(r, v) {
        if (!v) return;
        var d = criar('div');
        d.appendChild(criar('dt', '', r));
        d.appendChild(criar('dd', '', v));
        ficha.appendChild(d);
      }
      linha('Ocasião', x.ocasiao && C.porOcasiao[x.ocasiao] ? C.porOcasiao[x.ocasiao].rotulo : '');
      linha('Tecido', C.porTecido[x.tecido] ? C.porTecido[x.tecido].rotulo : x.tecido);
      linha('Cor', x.cor);
      linha('Caimento', C.porModelagem[x.caimento] ? C.porModelagem[x.caimento].rotulo : '');
      linha('Detalhes', Object.keys(x.detalhes || {}).map(function (k) { return C.textoDoDetalhe(x.peca, k, x.detalhes[k]); }).join(' · '));
      linha('Investimento', x.orcamento && C.porOrcamento[x.orcamento] ? C.porOrcamento[x.orcamento].rotulo : '');
      linha('Prazo', x.prazo ? x.prazo.split('-').reverse().join('/') : '');
      linha('Referência', x.referencia);
      linha('Observações', x.observacoes);
      linha('Contato', x.pessoa.email + (x.pessoa.telefone ? ' · ' + api.mascaraTelefone(x.pessoa.telefone) : ''));
      li.appendChild(ficha);

      var acoes = criar('div', 'painel-exclusivo-acoes');
      if (x.pessoa.telefone) {
        var zap = criar('a', 'texto-botao', 'Responder pelo WhatsApp');
        zap.href = 'https://wa.me/55' + x.pessoa.telefone + '?text=' + encodeURIComponent('Olá, ' + x.pessoa.nome.split(' ')[0] + '! Recebemos o seu pedido exclusivo de ' + (peca ? peca.rotulo.toLowerCase() : 'peça') + '.');
        zap.target = '_blank';
        zap.rel = 'noopener';
        acoes.appendChild(zap);
      }
      acoes.appendChild(botao('Abrir a ficha do cliente', 'texto-botao', function () {
        abrirAba('clientes');
        if (window.AR_PAINEL && window.AR_PAINEL.abrirPessoa) window.AR_PAINEL.abrirPessoa(x.pessoa.id);
      }));
      li.appendChild(acoes);
      lista.appendChild(li);
    });
  }

  /* --- Formulários --------------------------------------------------------------------------------- */

  function limparErros(f) {
    f.querySelectorAll('[data-erro]').forEach(function (p) { p.textContent = ''; });
    var geral = f.querySelector('.erro[role="alert"]');
    if (geral) geral.textContent = '';
  }

  function mostrarErros(f, r) {
    var campos = (r.dados && r.dados.campos) || {};
    Object.keys(campos).forEach(function (k) {
      var p = f.querySelector('[data-erro="' + k + '"]');
      if (p) p.textContent = campos[k];
    });
    f.querySelector('.erro[role="alert"]').textContent = r.erro || 'Não foi possível salvar.';
  }

  document.querySelectorAll('.painel-modal').forEach(function (m) {
    m.querySelector('[data-fechar]').addEventListener('click', function () { m.close(); });
    m.addEventListener('click', function (e) { if (e.target === m) m.close(); });
  });

  var inicial = location.hash.replace('#', '');
  if (ABAS.indexOf(inicial) !== -1 && inicial !== 'clientes') abrirAba(inicial);
  else carregar();
})();
