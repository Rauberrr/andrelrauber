/* Pedido exclusivo: a pessoa descreve a peça em poucos passos. O rascunho fica neste aparelho,
   e o envio pede a conta: quem não entrou volta para cá com tudo preenchido. */
(function () {
  'use strict';

  var api = window.AR_API;
  var C = window.AR_COLECAO;
  var RASCUNHO = 'ar-exclusivo-rascunho';
  var PASSOS = ['peca', 'ocasiao', 'tecido', 'cor', 'caimento', 'extras', 'revisao'];
  var TITULOS = {
    peca: 'A peça', ocasiao: 'A ocasião', tecido: 'O tecido', cor: 'A cor', caimento: 'Caimento e detalhes', extras: 'Referência e prazo', revisao: 'Revisão'
  };

  var form = document.getElementById('exclusivo-form');
  var caixa = document.getElementById('exclusivo-passos');
  var estado = ler() || { peca: '', ocasiao: '', quantidade: 1, tecido: '', cor: '', caimento: 'regular', detalhes: {}, referencia: '', observacoes: '', orcamento: '', prazo: '' };
  var atual = 'peca';
  var logado = null;

  function $(id) { return document.getElementById(id); }
  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function ler() {
    try {
      var r = JSON.parse(localStorage.getItem(RASCUNHO));
      return r && typeof r === 'object' && r.detalhes ? r : null;
    } catch (e) { return null; }
  }
  function guardar() {
    try { localStorage.setItem(RASCUNHO, JSON.stringify(estado)); } catch (e) { /* segue sem rascunho */ }
  }

  /* --- Peças de montar os passos ---------------------------------------------------------------- */

  function titulo(texto, ajuda) {
    var f = document.createDocumentFragment();
    var h = criar('h2', 'titulo-m exclusivo-titulo', texto);
    h.tabIndex = -1;
    f.appendChild(h);
    if (ajuda) f.appendChild(criar('p', 'exclusivo-ajuda', ajuda));
    return f;
  }

  // Cartões de escolha única, com desenho, título e texto
  function cartoes(nome, itens, valor, aoEscolher, classe) {
    var grade = criar('div', 'escolha-cartoes ' + (classe || ''));
    grade.setAttribute('role', 'radiogroup');
    itens.forEach(function (i) {
      var rotulo = criar('label', 'escolha-cartao');
      var r = document.createElement('input');
      r.type = 'radio';
      r.name = nome;
      r.value = i.id;
      r.checked = valor === i.id;
      r.addEventListener('change', function () { aoEscolher(i.id); guardar(); });
      rotulo.appendChild(r);
      var corpo = criar('span', 'escolha-cartao-corpo');
      if (i.desenho) corpo.appendChild(C.desenho(i.id));
      if (i.cor) { var amostra = criar('i', 'escolha-amostra'); amostra.style.background = i.cor; corpo.appendChild(amostra); }
      corpo.appendChild(criar('strong', '', i.rotulo));
      if (i.texto) corpo.appendChild(criar('small', '', i.texto));
      if (i.selo) corpo.appendChild(criar('em', 'escolha-selo', i.selo));
      rotulo.appendChild(corpo);
      grade.appendChild(rotulo);
    });
    return grade;
  }

  function fichas(nome, itens, valor, aoEscolher) {
    var grupo = criar('div', 'escolha-fichas');
    grupo.setAttribute('role', 'radiogroup');
    itens.forEach(function (i) {
      var rotulo = criar('label');
      var r = document.createElement('input');
      r.type = 'radio';
      r.name = nome;
      r.value = i.id;
      r.checked = valor === i.id;
      r.addEventListener('change', function () { aoEscolher(i.id); guardar(); });
      rotulo.appendChild(r);
      rotulo.appendChild(criar('span', '', i.rotulo));
      grupo.appendChild(rotulo);
    });
    return grupo;
  }

  function grupo(legenda, conteudo) {
    var f = criar('fieldset', 'exclusivo-grupo');
    f.appendChild(criar('legend', '', legenda));
    f.appendChild(conteudo);
    return f;
  }

  /* --- Cada passo ---------------------------------------------------------------------------------- */

  var desenhar = {
    peca: function () {
      caixa.appendChild(titulo('Qual peça você quer?', 'Escolha uma. Se quiser mais de uma peça diferente, faça um pedido para cada.'));
      caixa.appendChild(cartoes('peca', C.PECAS.map(function (p) { return { id: p.id, rotulo: p.rotulo, texto: p.texto, desenho: true }; }), estado.peca, function (v) {
        if (estado.peca !== v) { estado.detalhes = {}; if (C.porPeca[v].tecidos.indexOf(estado.tecido) === -1 && estado.tecido !== 'indicacao') estado.tecido = ''; }
        estado.peca = v;
      }, 'escolha-pecas'));
    },
    ocasiao: function () {
      caixa.appendChild(titulo('Para que ocasião?', 'Ajuda a acertar o tecido, a cor e o acabamento.'));
      caixa.appendChild(grupo('Ocasião', fichas('ocasiao', C.OCASIOES, estado.ocasiao, function (v) { estado.ocasiao = v; })));
      var qtd = criar('div', 'exclusivo-quantidade');
      var menos = criar('button', 'botao', '−');
      menos.type = 'button';
      menos.setAttribute('aria-label', 'Uma peça a menos');
      var mais = criar('button', 'botao', '+');
      mais.type = 'button';
      mais.setAttribute('aria-label', 'Uma peça a mais');
      var valor = criar('output', '', String(estado.quantidade));
      valor.setAttribute('aria-live', 'polite');
      function mudar(d) { estado.quantidade = Math.max(1, Math.min(10, estado.quantidade + d)); valor.textContent = String(estado.quantidade); guardar(); }
      menos.addEventListener('click', function () { mudar(-1); });
      mais.addEventListener('click', function () { mudar(1); });
      qtd.appendChild(menos);
      qtd.appendChild(valor);
      qtd.appendChild(mais);
      caixa.appendChild(grupo('Quantas peças iguais?', qtd));
    },
    tecido: function () {
      var peca = C.porPeca[estado.peca];
      caixa.appendChild(titulo('Qual tecido?', 'Trabalhamos com tecidos tradicionais, que caem bem e duram. Se tiver dúvida, deixe a indicação com a gente.'));
      var recomendados = peca.tecidos.map(function (id) { var t = C.porTecido[id]; return { id: t.id, rotulo: t.rotulo, texto: t.texto, selo: 'Indicado para ' + peca.rotulo.toLowerCase() }; });
      var outros = C.TECIDOS.filter(function (t) { return t.id !== 'indicacao' && peca.tecidos.indexOf(t.id) === -1; })
        .map(function (t) { return { id: t.id, rotulo: t.rotulo, texto: t.texto }; });
      function escolher(v) { estado.tecido = v; }
      caixa.appendChild(cartoes('tecido', recomendados.concat([{ id: 'indicacao', rotulo: C.porTecido.indicacao.rotulo, texto: C.porTecido.indicacao.texto }]), estado.tecido, escolher, 'escolha-tecidos'));
      var mais = criar('details', 'exclusivo-mais');
      mais.appendChild(criar('summary', '', 'Ver outros tecidos'));
      mais.appendChild(cartoes('tecido', outros, estado.tecido, escolher, 'escolha-tecidos'));
      if (outros.some(function (t) { return t.id === estado.tecido; })) mais.open = true;
      caixa.appendChild(mais);
      caixa.appendChild(criar('p', 'exclusivo-fora', 'Por enquanto, não trabalhamos com ' + C.FORA + '.'));
    },
    cor: function () {
      caixa.appendChild(titulo('Qual cor?', 'Escolha uma das cores mais pedidas, ou descreva outra.'));
      var lista = C.CORES.map(function (c) { return { id: c.nome, rotulo: c.nome, cor: c.hex }; })
        .concat([{ id: 'Sem preferência', rotulo: 'Sem preferência', texto: 'Quero uma sugestão' }]);
      var conhecida = lista.some(function (c) { return c.id === estado.cor; });
      var campo = document.createElement('input');
      caixa.appendChild(cartoes('cor', lista, conhecida ? estado.cor : '', function (v) { estado.cor = v; campo.value = ''; }, 'escolha-cores'));
      var outra = criar('div', 'campo');
      var rotulo = criar('label', '', 'Outra cor');
      rotulo.htmlFor = 'exclusivo-cor-outra';
      campo.id = 'exclusivo-cor-outra';
      campo.type = 'text';
      campo.maxLength = 60;
      campo.placeholder = 'Como cinza-chumbo ou azul petróleo';
      campo.value = conhecida ? '' : estado.cor;
      campo.addEventListener('input', function () {
        estado.cor = campo.value.trim();
        caixa.querySelectorAll('input[name="cor"]').forEach(function (r) { r.checked = false; });
        guardar();
      });
      var entrada = criar('div', 'campo-entrada');
      entrada.appendChild(campo);
      outra.appendChild(rotulo);
      outra.appendChild(entrada);
      caixa.appendChild(outra);
    },
    caimento: function () {
      caixa.appendChild(titulo('Como você quer que a peça vista?', 'O molde parte das suas medidas. Aqui você escolhe a folga e os detalhes.'));
      caixa.appendChild(grupo('Caimento', cartoes('caimento', C.MODELAGENS.map(function (m) { return { id: m.id, rotulo: m.rotulo, texto: m.texto }; }), estado.caimento, function (v) { estado.caimento = v; }, 'escolha-caimentos')));
      (C.DETALHES[estado.peca] || []).forEach(function (d) {
        if (!estado.detalhes[d[0]]) estado.detalhes[d[0]] = d[2][0][0];
        caixa.appendChild(grupo(d[1], fichas('detalhe-' + d[0], d[2].map(function (o) { return { id: o[0], rotulo: o[1] }; }), estado.detalhes[d[0]], function (v) { estado.detalhes[d[0]] = v; })));
      });
      guardar();
    },
    extras: function () {
      caixa.appendChild(titulo('Mais alguma coisa?', 'Tudo aqui é opcional, mas ajuda a responder mais rápido.'));
      function campo(id, rotulo, tipo, valor, extra) {
        var c = criar('div', 'campo');
        var l = criar('label', '', rotulo);
        l.htmlFor = id;
        var e = document.createElement(tipo === 'textarea' ? 'textarea' : 'input');
        e.id = id;
        if (tipo !== 'textarea') e.type = tipo;
        e.value = valor || '';
        Object.keys(extra || {}).forEach(function (k) { e[k] = extra[k]; });
        var caixaEntrada = criar('div', 'campo-entrada');
        caixaEntrada.appendChild(e);
        c.appendChild(l);
        c.appendChild(caixaEntrada);
        return { bloco: c, entrada: e };
      }
      var ref = campo('exclusivo-referencia', 'Uma referência (link de foto, perfil ou loja)', 'text', estado.referencia, { maxLength: 300, placeholder: 'https://...' });
      ref.entrada.addEventListener('input', function () { estado.referencia = ref.entrada.value; guardar(); });
      caixa.appendChild(ref.bloco);
      caixa.appendChild(grupo('Quanto pretende investir?', fichas('orcamento', C.ORCAMENTOS, estado.orcamento, function (v) { estado.orcamento = v; })));
      var hoje = new Date();
      var prazo = campo('exclusivo-prazo', 'Precisa da peça até quando?', 'date', estado.prazo, { min: hoje.toISOString().slice(0, 10) });
      prazo.entrada.addEventListener('change', function () { estado.prazo = prazo.entrada.value; guardar(); });
      caixa.appendChild(prazo.bloco);
      var obs = campo('exclusivo-observacoes', 'Observações', 'textarea', estado.observacoes, { maxLength: 1000, rows: 4, placeholder: 'Como a peça vai ser usada, um detalhe que você faz questão, algo que não gosta...' });
      obs.entrada.addEventListener('input', function () { estado.observacoes = obs.entrada.value; guardar(); });
      caixa.appendChild(obs.bloco);
    },
    revisao: function () {
      caixa.appendChild(titulo('Confira o seu pedido', logado === false ? 'Para enviar, vamos pedir para você entrar na sua conta. Nada do que você preencheu se perde.' : 'Se estiver tudo certo, é só enviar.'));
      var lista = criar('dl', 'exclusivo-revisao');
      function linha(rotulo, valor, passo) {
        var d = criar('div');
        d.appendChild(criar('dt', '', rotulo));
        var dd = criar('dd', '', valor || 'Não informado');
        var alterar = criar('button', 'texto-botao', 'Alterar');
        alterar.type = 'button';
        alterar.setAttribute('aria-label', 'Alterar ' + rotulo.toLowerCase());
        alterar.addEventListener('click', function () { ir(passo); });
        d.appendChild(dd);
        d.appendChild(alterar);
        lista.appendChild(d);
      }
      var peca = C.porPeca[estado.peca];
      linha('Peça', peca.rotulo + (estado.quantidade > 1 ? ', ' + estado.quantidade + ' unidades' : ''), 'peca');
      linha('Ocasião', estado.ocasiao ? C.porOcasiao[estado.ocasiao].rotulo : '', 'ocasiao');
      linha('Tecido', estado.tecido ? C.porTecido[estado.tecido].rotulo : '', 'tecido');
      linha('Cor', estado.cor, 'cor');
      linha('Caimento', C.porModelagem[estado.caimento] ? C.porModelagem[estado.caimento].rotulo : '', 'caimento');
      var detalhes = Object.keys(estado.detalhes).map(function (k) { return C.textoDoDetalhe(estado.peca, k, estado.detalhes[k]); });
      if (detalhes.length) linha('Detalhes', detalhes.join(' · '), 'caimento');
      linha('Investimento', estado.orcamento ? C.porOrcamento[estado.orcamento].rotulo : '', 'extras');
      linha('Prazo', estado.prazo ? estado.prazo.split('-').reverse().join('/') : '', 'extras');
      if (estado.referencia) linha('Referência', estado.referencia, 'extras');
      if (estado.observacoes) linha('Observações', estado.observacoes, 'extras');
      caixa.appendChild(lista);
    }
  };

  /* --- Navegação ----------------------------------------------------------------------------------- */

  function ir(passo, semFoco) {
    atual = passo;
    var i = PASSOS.indexOf(passo);
    caixa.textContent = '';
    $('exclusivo-erro').textContent = '';
    desenhar[passo]();
    $('exclusivo-barra').style.width = Math.round((i + 1) / PASSOS.length * 100) + '%';
    $('exclusivo-passo-texto').textContent = 'Passo ' + (i + 1) + ' de ' + PASSOS.length + ' · ' + TITULOS[passo];
    $('exclusivo-voltar').hidden = i === 0;
    $('exclusivo-seguir').textContent = passo === 'revisao' ? (logado === false ? 'Entrar e enviar' : 'Enviar pedido') : 'Continuar';
    if (!semFoco) {
      var h = caixa.querySelector('h2');
      if (h) h.focus({ preventScroll: true });
      var topo = form.getBoundingClientRect().top + window.scrollY - 100;
      if (window.scrollY > topo) window.scrollTo({ top: topo, behavior: 'smooth' });
    }
  }

  function falta() {
    if (atual === 'peca' && !estado.peca) return 'Escolha a peça para continuar.';
    if (atual === 'tecido' && !estado.tecido) return 'Escolha o tecido, ou toque em Quero uma indicação.';
    return '';
  }

  $('exclusivo-voltar').addEventListener('click', function () {
    var i = PASSOS.indexOf(atual);
    if (i > 0) ir(PASSOS[i - 1]);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var problema = falta();
    if (problema) { $('exclusivo-erro').textContent = problema; return; }
    if (atual !== 'revisao') { ir(PASSOS[PASSOS.indexOf(atual) + 1]); return; }
    enviar();
  });

  function enviar() {
    var botao = $('exclusivo-seguir');
    botao.disabled = true;
    api.post('api/produtos.php?acao=exclusivo', estado).then(function (r) {
      botao.disabled = false;
      if (r.status === 401) {
        guardar();
        location.href = 'entrar.html?voltar=' + encodeURIComponent('pedido-exclusivo.html');
        return;
      }
      if (!r.ok) {
        var campos = r.dados && r.dados.campos ? Object.keys(r.dados.campos) : [];
        if (campos[0] === 'peca' || campos[0] === 'tecido') ir(campos[0]);
        $('exclusivo-erro').textContent = r.erro || 'Não foi possível enviar agora. Tente de novo.';
        return;
      }
      try { localStorage.removeItem(RASCUNHO); } catch (erro) { /* nada guardado */ }
      form.hidden = true;
      $('exclusivo-feito').hidden = false;
      $('exclusivo-feito').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      api.get('api/perfil.php').then(function (p) {
        var semMedidas = !(p.ok && p.dados.cadastro && p.dados.cadastro.concluido_em);
        $('exclusivo-medidas').hidden = !semMedidas;
        $('exclusivo-medidas-botao').hidden = !semMedidas;
      });
    });
  }

  // Quem chega de uma sugestão do Guarda-roupa já vem com a peça escolhida
  var pedida = new URLSearchParams(location.search).get('peca');
  if (!ler() && C.porPeca[pedida]) estado.peca = pedida;

  // Quem volta da tela de entrar com o rascunho cai direto na revisão
  var temRascunho = Boolean(ler() && estado.peca && estado.tecido);
  ir(temRascunho ? 'revisao' : 'peca', true);
  api.get('api/auth.php?acao=sessao').then(function (r) {
    logado = Boolean(r.ok && r.dados.logado);
    if (atual === 'revisao') ir('revisao', true);
  });
})();
