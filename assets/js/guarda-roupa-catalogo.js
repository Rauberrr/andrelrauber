/* Guarda-roupa: o catálogo de peças. As da marca em várias cores e as que o gestor cadastra
   no painel. A pessoa toca nas que tem e elas entram no guarda-roupa, prontas para os looks. */
(function () {
  'use strict';

  var tela = window.AR_GR_TELA;
  var gr = window.AR_GR;
  var api = window.AR_API;
  if (!tela || !gr || !api) return;
  var ENDERECO = 'api/guarda-roupa.php?acao=';
  var itens = null;
  var grupo = '';

  function $(id) { return document.getElementById(id); }
  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function tipoDe(id) { return gr.TIPOS.filter(function (t) { return t.id === id; })[0] || { grupo: 'acessorio', rotulo: id }; }
  function corDe(id) { return gr.CORES.filter(function (c) { return c.id === id; })[0] || { rotulo: id, hex: null }; }

  function abrir() {
    $('cat-modal').showModal();
    if (itens) { desenhar(); return; }
    $('cat-estado').textContent = 'Carregando o catálogo...';
    $('cat-estado').hidden = false;
    api.get(ENDERECO + 'catalogo').then(function (r) {
      if (!r.ok) { $('cat-estado').textContent = r.erro || 'Não foi possível abrir o catálogo agora.'; return; }
      itens = r.dados.itens;
      $('cat-estado').hidden = true;
      montarFiltros();
      desenhar();
    });
  }

  function montarFiltros() {
    var caixa = $('cat-filtros');
    caixa.textContent = '';
    var grupos = [{ id: '', rotulo: 'Todas' }].concat(gr.GRUPOS.filter(function (g) {
      return itens.some(function (i) { return tipoDe(i.tipo).grupo === g.id; });
    }));
    grupos.forEach(function (g) {
      var b = criar('button', 'cat-filtro', g.rotulo);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(g.id === grupo));
      b.addEventListener('click', function () {
        grupo = g.id;
        caixa.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        desenhar();
      });
      caixa.appendChild(b);
    });
  }

  function desenhar() {
    var lista = $('cat-lista');
    lista.textContent = '';
    var mostrar = itens.filter(function (i) { return !grupo || tipoDe(i.tipo).grupo === grupo; });
    // As que a pessoa ainda não tem primeiro; as novidades do gestor no topo
    mostrar.sort(function (a, b) {
      var pa = (a.situacao === 'tem' ? 2 : 0) - (a.novo ? 1 : 0);
      var pb = (b.situacao === 'tem' ? 2 : 0) - (b.novo ? 1 : 0);
      return pa - pb;
    });
    mostrar.forEach(function (i, n) { lista.appendChild(cartao(i, n < 9)); });
    var tem = itens.filter(function (i) { return i.situacao === 'tem'; }).length;
    $('cat-resumo').textContent = itens.length + ' peças no catálogo · ' + tem + ' no seu guarda-roupa';
  }

  function cartao(i, logo) {
    var li = criar('li', 'cat-item' + (i.situacao === 'tem' ? ' cat-tem' : ''));
    var b = criar('button', 'cat-botao');
    b.type = 'button';
    var fig = criar('span', 'cat-foto');
    var img = document.createElement('img');
    img.src = i.foto;
    img.alt = '';
    img.loading = logo ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.width = 1000;
    img.height = 1250;
    fig.appendChild(img);
    if (i.novo) fig.appendChild(criar('span', 'cat-novo', 'Novo'));
    b.appendChild(fig);
    var nome = criar('span', 'cat-nome');
    var cor = corDe(i.cor);
    var bolinha = criar('i', 'cat-cor' + (cor.hex ? '' : ' cat-cor-estampa'));
    if (cor.hex) bolinha.style.background = cor.hex;
    nome.appendChild(bolinha);
    nome.appendChild(document.createTextNode(i.nome));
    b.appendChild(nome);
    var estado = criar('span', 'cat-estado-peca', i.situacao === 'tem' ? '✓ No seu guarda-roupa' : (i.situacao === 'excluida' ? 'Trazer de volta' : 'Tenho esta'));
    b.appendChild(estado);
    b.setAttribute('aria-label', i.nome + ': ' + (i.situacao === 'tem' ? 'já está no seu guarda-roupa' : 'adicionar ao meu guarda-roupa'));
    if (i.situacao === 'tem') b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', function () { if (i.situacao !== 'tem') adicionar(i, b); });
    li.appendChild(b);
    return li;
  }

  function adicionar(i, b) {
    if (b.classList.contains('cat-enviando')) return;
    b.classList.add('cat-enviando');
    api.post(ENDERECO + 'do-catalogo', { codigo: i.codigo }).then(function (r) {
      b.classList.remove('cat-enviando');
      if (!r.ok) { tela.avisar(r.erro || 'Não foi possível adicionar agora.'); return; }
      i.situacao = 'tem';
      tela.aoTrazerDoCatalogo(r.dados.peca);
      desenhar();
      tela.avisar(i.nome + ' entrou no seu guarda-roupa.');
    });
  }

  $('cat-fechar').addEventListener('click', function () { $('cat-modal').close(); });
  ['gr-do-catalogo', 'gr-abrir-catalogo'].forEach(function (id) {
    var b = $(id);
    if (b) b.addEventListener('click', abrir);
  });
  if (location.hash === '#catalogo') window.setTimeout(abrir, 600);
})();
