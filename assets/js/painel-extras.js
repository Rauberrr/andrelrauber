/* Painel: o catálogo do guarda-roupa (peças para todos os clientes) e a assinatura dos apps.
   As abas são abertas por painel-colecao.js, que avisa com o evento "painel-aba". */
(function () {
  'use strict';

  var api = window.AR_API;
  var gr = window.AR_GR;
  var CATALOGO = 'api/guarda-roupa.php?acao=';
  var ASSINATURA = 'api/assinatura.php?acao=';
  var carregados = {};

  function $(id) { return document.getElementById(id); }
  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function rotuloDe(lista, id) { return (lista.filter(function (x) { return x.id === id; })[0] || { rotulo: id }).rotulo; }
  function dataBr(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? Number(p[2]) + '/' + Number(p[1]) + '/' + p[0] : ''; }
  function mostrarErros(form, r) {
    form.querySelectorAll('[data-erro]').forEach(function (p) { p.textContent = ''; });
    var campos = (r.dados && r.dados.campos) || {};
    Object.keys(campos).forEach(function (k) {
      var p = form.querySelector('[data-erro="' + k + '"]');
      if (p) p.textContent = campos[k];
    });
  }

  function abriu(nome) {
    if (nome === 'catalogo' && !carregados.catalogo) carregarCatalogo();
    if (nome === 'assinatura' && !carregados.assinatura) carregarAssinatura();
  }
  document.addEventListener('painel-aba', function (e) { abriu(e.detail); });
  ['catalogo', 'assinatura'].forEach(function (nome) {
    var aba = $('aba-' + nome);
    if (aba && aba.getAttribute('aria-selected') === 'true') abriu(nome);
  });

  /* --- Tarefas do Cron ---------------------------------------------------------------------------- */

  var TAREFAS = {
    habitos: ['Lembretes e hábitos', 'a cada 5 minutos'],
    videos: ['Vídeos agendados', 'a cada 5 minutos'],
    lembretes: ['E-mails de lembrete', 'uma vez por dia']
  };
  function tempo(min) {
    if (min === null) return 'nunca rodou';
    if (min < 1) return 'rodou agora há pouco';
    if (min < 60) return 'rodou há ' + min + ' min';
    if (min < 48 * 60) return 'rodou há ' + Math.floor(min / 60) + ' h';
    return 'rodou há ' + Math.floor(min / 1440) + ' dias';
  }
  api.get(ASSINATURA + 'tarefas').then(function (r) {
    if (!r.ok) { $('painel-tarefas').hidden = true; return; }
    var lista = $('painel-tarefas-lista');
    lista.textContent = '';
    var paradas = 0;
    r.dados.tarefas.forEach(function (t) {
      var info = TAREFAS[t.nome] || [t.nome, ''];
      if (!t.ok) paradas += 1;
      var li = criar('li', t.ok ? 'tarefa-ok' : 'tarefa-parada');
      li.appendChild(criar('strong', '', info[0]));
      li.appendChild(criar('span', '', tempo(t.minutos) + ' · deve rodar ' + info[1]));
      lista.appendChild(li);
    });
    $('painel-tarefas-luz').className = 'painel-tarefas-luz ' + (paradas ? 'parada' : 'ok');
    $('painel-tarefas-resumo').textContent = paradas ? 'Tarefas automáticas: ' + paradas + (paradas === 1 ? ' parada' : ' paradas') : 'Tarefas automáticas: todas rodando';
    if (paradas) $('painel-tarefas').open = true;
  });

  /* --- Catálogo do guarda-roupa ------------------------------------------------------------------ */

  var pecasCatalogo = [];
  var editando = null;
  var fotoEscolhida = null;

  function preencher(id, lista, vazio) {
    var s = $(id);
    s.textContent = '';
    if (vazio) s.appendChild(new Option(vazio, ''));
    lista.forEach(function (i) { s.appendChild(new Option(i.rotulo, i.id)); });
  }

  if (gr) {
    var tipo = $('cat-tipo');
    tipo.appendChild(new Option('Escolha', ''));
    gr.GRUPOS.forEach(function (g) {
      var grupo = document.createElement('optgroup');
      grupo.label = g.rotulo;
      gr.TIPOS.filter(function (t) { return t.grupo === g.id; }).forEach(function (t) { grupo.appendChild(new Option(t.rotulo, t.id)); });
      tipo.appendChild(grupo);
    });
    preencher('cat-cor', gr.CORES, 'Escolha');
    preencher('cat-corte', gr.CORTES, 'Escolha');
    preencher('cat-tecido', gr.TECIDOS, 'Não informar');
    preencher('cat-formalidade', gr.FORMALIDADES);
    preencher('cat-clima', gr.CLIMAS);
    tipo.addEventListener('change', function () {
      var semCorte = !gr.temCorte(tipo.value);
      $('cat-corte').disabled = semCorte;
      if (tipo.value && !editando) {
        $('cat-formalidade').value = gr.formalidadePadrao(tipo.value);
        $('cat-clima').value = gr.climaPadrao(tipo.value, $('cat-tecido').value);
      }
    });
  }

  function carregarCatalogo() {
    carregados.catalogo = true;
    api.get(CATALOGO + 'catalogo-gestor').then(function (r) {
      $('cat-carregando').hidden = true;
      if (!r.ok) { carregados.catalogo = false; $('cat-carregando').hidden = false; $('cat-carregando').textContent = r.erro || 'Não foi possível carregar.'; return; }
      pecasCatalogo = r.dados.pecas;
      daMarca = r.dados.daMarca;
      desenharCatalogo();
    });
  }

  var daMarca = 0;
  function desenharCatalogo() {
    $('cat-resumo-gestor').textContent = 'O catálogo tem ' + daMarca + ' peças da marca, em várias cores, e ' + pecasCatalogo.length + (pecasCatalogo.length === 1 ? ' cadastrada' : ' cadastradas') + ' por você.';
    var lista = $('cat-gestor-lista');
    lista.textContent = '';
    pecasCatalogo.forEach(function (p) {
      var li = criar('li', 'painel-cat-item' + (p.ativa ? '' : ' painel-cat-inativa'));
      var fig = criar('div', 'painel-cat-foto');
      var img = document.createElement('img');
      img.src = p.foto;
      img.alt = '';
      img.loading = 'lazy';
      fig.appendChild(img);
      li.appendChild(fig);
      var texto = criar('div', 'painel-cat-texto');
      texto.appendChild(criar('strong', '', p.nome));
      texto.appendChild(criar('span', '', gr ? rotuloDe(gr.TIPOS, p.tipo) + ' · ' + rotuloDe(gr.CORES, p.cor) : p.tipo));
      var selos = criar('span', 'painel-cat-selos');
      if (!p.ativa) selos.appendChild(criar('span', 'painel-cat-selo', 'Fora do catálogo'));
      else if (p.automatica) selos.appendChild(criar('span', 'painel-cat-selo painel-cat-selo-todos', 'No guarda-roupa de todos'));
      selos.appendChild(criar('span', 'painel-cat-selo', p.pessoas === 1 ? '1 pessoa tem' : p.pessoas + ' pessoas têm'));
      texto.appendChild(selos);
      li.appendChild(texto);
      var acoes = criar('div', 'painel-cat-acoes');
      var editar = criar('button', 'texto-botao', 'Editar');
      editar.type = 'button';
      editar.addEventListener('click', function () { abrirPeca(p); });
      acoes.appendChild(editar);
      var ativar = criar('button', 'texto-botao' + (p.ativa ? ' painel-perigo' : ''), p.ativa ? 'Tirar do catálogo' : 'Voltar ao catálogo');
      ativar.type = 'button';
      ativar.addEventListener('click', function () {
        if (p.ativa && !window.confirm('Tirar "' + p.nome + '" do catálogo? Quem já tem a peça continua com ela.')) return;
        api.post(CATALOGO + 'catalogo-ativar', { id: p.id, ativa: !p.ativa }).then(function (r) {
          if (!r.ok) { window.alert(r.erro || 'Não foi possível agora.'); return; }
          pecasCatalogo = pecasCatalogo.map(function (x) { return x.id === p.id ? r.dados.peca : x; });
          desenharCatalogo();
        });
      });
      acoes.appendChild(ativar);
      li.appendChild(acoes);
      lista.appendChild(li);
    });
    $('cat-gestor-vazio').hidden = pecasCatalogo.length > 0;
  }

  function mostrarPrevia(src) {
    var caixa = $('cat-previa');
    caixa.textContent = '';
    if (!src) { caixa.appendChild(criar('span', '', 'Sem foto')); return; }
    var img = document.createElement('img');
    img.src = src;
    img.alt = 'Prévia da foto';
    caixa.appendChild(img);
  }

  function abrirPeca(p) {
    editando = p || null;
    fotoEscolhida = null;
    var f = $('cat-form');
    f.reset();
    mostrarErros(f, {});
    $('cat-form-erro').textContent = '';
    $('cat-modal-titulo').textContent = p ? 'Editar peça do catálogo' : 'Nova peça no catálogo';
    $('cat-nome').value = p ? p.nome : '';
    $('cat-tipo').value = p ? p.tipo : '';
    $('cat-cor').value = p ? p.cor : '';
    $('cat-corte').value = p ? p.corte : '';
    $('cat-tecido').value = p ? p.tecido : '';
    $('cat-formalidade').value = p ? p.formalidade : 'casual';
    $('cat-clima').value = p ? p.clima : 'qualquer';
    $('cat-corte').disabled = Boolean(p && gr && !gr.temCorte(p.tipo));
    $('cat-automatica').checked = Boolean(p && p.automatica);
    mostrarPrevia(p ? p.foto : '');
    $('cat-modal-gestor').showModal();
  }

  $('cat-nova').addEventListener('click', function () { abrirPeca(null); });
  $('cat-foto').addEventListener('change', function (e) {
    var arquivo = e.target.files && e.target.files[0];
    if (!arquivo) return;
    fotoEscolhida = arquivo;
    mostrarPrevia(URL.createObjectURL(arquivo));
  });

  $('cat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('cat-form');
    mostrarErros(f, {});
    $('cat-form-erro').textContent = '';
    if (!editando && !fotoEscolhida) { f.querySelector('[data-erro="foto"]').textContent = 'Escolha a foto da peça.'; return; }
    var dados = new FormData();
    if (editando) dados.append('id', String(editando.id));
    dados.append('nome', $('cat-nome').value.trim());
    ['tipo', 'cor', 'corte', 'tecido', 'formalidade', 'clima'].forEach(function (c) { dados.append(c, $('cat-' + c).value); });
    dados.append('automatica', $('cat-automatica').checked ? '1' : '0');
    if (fotoEscolhida) dados.append('foto', fotoEscolhida);
    var botao = $('cat-salvar');
    botao.disabled = true;
    botao.textContent = 'Salvando...';
    api.enviar(CATALOGO + 'catalogo-salvar', dados).then(function (r) {
      botao.disabled = false;
      botao.textContent = 'Salvar';
      if (!r.ok) {
        mostrarErros(f, r);
        $('cat-form-erro').textContent = r.erro || 'Não foi possível salvar.';
        return;
      }
      var peca = r.dados.peca;
      var existe = pecasCatalogo.some(function (x) { return x.id === peca.id; });
      pecasCatalogo = existe ? pecasCatalogo.map(function (x) { return x.id === peca.id ? peca : x; }) : [peca].concat(pecasCatalogo);
      $('cat-modal-gestor').close();
      desenharCatalogo();
    });
  });

  /* --- Assinatura -------------------------------------------------------------------------------- */

  function lerPreco(texto) {
    var limpo = String(texto || '').replace(/[^\d,.]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    var n = Math.round(parseFloat(limpo) * 100);
    return isFinite(n) ? n : null;
  }
  function precoTexto(c) { return (c / 100).toFixed(2).replace('.', ','); }

  function modoMarcado() {
    var r = document.querySelector('input[name="as-modo"]:checked');
    return r ? r.value : 'oculta';
  }
  function mostrarAlerta() { $('as-alerta').hidden = modoMarcado() !== 'cobrando'; }
  document.querySelectorAll('input[name="as-modo"]').forEach(function (r) { r.addEventListener('change', mostrarAlerta); });

  var modoSalvo = 'oculta';
  function carregarAssinatura() {
    carregados.assinatura = true;
    api.get(ASSINATURA + 'gestor').then(function (r) {
      $('as-carregando').hidden = true;
      if (!r.ok) { carregados.assinatura = false; $('as-carregando').hidden = false; $('as-carregando').textContent = r.erro || 'Não foi possível carregar.'; return; }
      var plano = r.dados.plano;
      modoSalvo = plano.modo;
      document.querySelectorAll('input[name="as-modo"]').forEach(function (x) { x.checked = x.value === plano.modo; });
      $('as-nome').value = plano.nome;
      $('as-preco').value = precoTexto(plano.precoCentavos);
      $('as-teste').value = String(plano.testeDias);
      $('as-antigos').checked = r.dados.liberarAntigos !== false;
      $('as-testadores-caixa').hidden = false;
      desenharTestadores(r.dados.testadores || []);
      $('as-beneficios').value = plano.beneficios.join('\n');
      mostrarAlerta();
      $('as-form').hidden = false;
      $('as-liberados-caixa').hidden = false;
      desenharLiberados(r.dados.liberados);
    });
  }

  $('as-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('as-form');
    mostrarErros(f, {});
    $('as-erro').textContent = '';
    var modo = modoMarcado();
    var preco = lerPreco($('as-preco').value);
    if (preco === null) { f.querySelector('[data-erro="preco"]').textContent = 'Escreva o valor, como 19,90.'; return; }
    if (modo === 'cobrando' && modoSalvo !== 'cobrando' &&
      !window.confirm($('as-antigos').checked
        ? 'Ligar a cobrança? Quem já tem conta continua usando grátis. As contas novas ganham os dias de teste e, depois, precisam assinar.'
        : 'Ligar a cobrança? Todo mundo, inclusive quem já usa, ganha os dias de teste a partir de hoje. Depois, só quem assina ou tem acesso liberado usa os apps.')) return;
    api.post(ASSINATURA + 'salvar', {
      modo: modo,
      nome: $('as-nome').value.trim(),
      precoCentavos: preco,
      testeDias: Math.max(0, Math.round(Number($('as-teste').value) || 0)),
      liberarAntigos: $('as-antigos').checked,
      beneficios: $('as-beneficios').value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean)
    }).then(function (r) {
      if (!r.ok) { mostrarErros(f, r); $('as-erro').textContent = r.erro || 'Não foi possível salvar.'; return; }
      modoSalvo = r.dados.plano.modo;
      $('as-erro').textContent = '';
      var aviso = { oculta: 'Salvo. Os apps estão grátis e a página só aparece para você.', aviso: 'Salvo. Todos veem a página com o teste grátis e o valor.', cobrando: 'Salvo. A cobrança está ligada, com ' + r.dados.plano.testeDias + ' dias de teste grátis para cada pessoa.' }[modoSalvo];
      window.alert(aviso);
    });
  });

  var SITUACAO_TESTE = { teste: 'no teste grátis', bloqueado: 'teste acabou: vê a página para assinar', assinante: 'assinante' };
  function desenharTestadores(lista) {
    var ul = $('as-testadores');
    ul.textContent = '';
    if (!lista.length) { ul.appendChild(criar('li', 'as-item as-item-vazio', 'Nenhuma conta de teste ainda.')); return; }
    lista.forEach(function (t) {
      var li = criar('li', 'as-item');
      var texto = criar('div');
      texto.appendChild(criar('strong', '', t.nome));
      texto.appendChild(criar('span', '', t.email + ' · ' + (t.situacao === 'teste' ? (t.diasDeTeste === 1 ? 'falta 1 dia de teste' : 'faltam ' + t.diasDeTeste + ' dias de teste') : SITUACAO_TESTE[t.situacao])));
      li.appendChild(texto);
      var acoes = criar('div', 'as-acoes');
      [['recomecar', 'Recomeçar o teste'], ['encerrar', 'Ver depois do teste'], ['tirar', 'Tirar']].forEach(function (a) {
        var b = criar('button', 'texto-botao' + (a[0] === 'tirar' ? ' painel-perigo' : ''), a[1]);
        b.type = 'button';
        b.addEventListener('click', function () {
          api.post(ASSINATURA + 'testador', { acao: a[0], usuarioId: t.usuarioId }).then(function (r) {
            if (!r.ok) { $('as-testador-erro').textContent = r.erro || 'Não foi possível agora.'; return; }
            carregados.assinatura = false;
            carregarAssinatura();
          });
        });
        acoes.appendChild(b);
      });
      li.appendChild(acoes);
      ul.appendChild(li);
    });
  }

  $('as-testador-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('as-testador-erro').textContent = '';
    api.post(ASSINATURA + 'testador', { acao: 'incluir', email: $('as-testador-email').value.trim() }).then(function (r) {
      if (!r.ok) { $('as-testador-erro').textContent = r.erro || 'Não foi possível incluir.'; return; }
      $('as-testador-form').reset();
      carregados.assinatura = false;
      carregarAssinatura();
    });
  });

  function desenharLiberados(lista) {
    var ul = $('as-lista');
    ul.textContent = '';
    lista.forEach(function (a) {
      var li = criar('li', 'as-item' + (a.valida ? '' : ' as-item-inativo'));
      var texto = criar('div');
      texto.appendChild(criar('strong', '', a.nome));
      texto.appendChild(criar('span', '', a.email + ' · ' + (a.valida ? (a.validaAte ? 'até ' + dataBr(a.validaAte) : 'sem prazo') : 'sem acesso') + (a.origem === 'mercadopago' ? ' · Mercado Pago' : '')));
      li.appendChild(texto);
      if (a.valida) {
        var tirar = criar('button', 'texto-botao painel-perigo', 'Tirar acesso');
        tirar.type = 'button';
        tirar.addEventListener('click', function () {
          if (!window.confirm('Tirar o acesso de ' + a.nome + '?')) return;
          api.post(ASSINATURA + 'revogar', { usuarioId: a.usuarioId }).then(function () { carregados.assinatura = false; carregarAssinatura(); });
        });
        li.appendChild(tirar);
      }
      ul.appendChild(li);
    });
  }

  $('as-liberar').addEventListener('submit', function (e) {
    e.preventDefault();
    $('as-liberar-erro').textContent = '';
    api.post(ASSINATURA + 'liberar', { email: $('as-email').value.trim(), ate: $('as-ate').value }).then(function (r) {
      if (!r.ok) {
        var campos = (r.dados && r.dados.campos) || {};
        $('as-liberar-erro').textContent = campos.email || campos.ate || r.erro || 'Não foi possível liberar.';
        return;
      }
      $('as-liberar').reset();
      carregados.assinatura = false;
      carregarAssinatura();
    });
  });
})();
