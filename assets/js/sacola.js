/* Sacola da coleção: guarda as peças neste aparelho, mostra a gaveta com o total
   e fecha tudo num pedido só, pago pelo Mercado Pago. */
(function () {
  'use strict';

  var api = window.AR_API;
  var CHAVE = 'ar-sacola-v1';
  var MAXIMO_ITENS = 10;
  var MAXIMO_QUANTIDADE = 5;
  var itens = ler();
  var gaveta = null;
  var ultimoFoco = null;

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }
  function reais(c) { return 'R$ ' + (c / 100).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function ler() {
    try {
      var l = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      return Array.isArray(l) ? l.filter(function (i) { return i && /^[a-z0-9-]{1,90}$/.test(i.slug); }).slice(0, MAXIMO_ITENS) : [];
    } catch (e) { return []; }
  }
  function gravar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (e) { /* sem armazenamento: a sacola vale só nesta página */ }
    contar();
  }
  function totalPecas() { return itens.reduce(function (s, i) { return s + i.quantidade; }, 0); }

  /* --- Botão no topo ------------------------------------------------------------------------------ */

  var botao = null;
  function montarBotao() {
    var topo = document.querySelector('.topo-interno');
    if (!topo) return;
    botao = criar('button', 'sacola-botao');
    botao.type = 'button';
    botao.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg><span class="sacola-contador" hidden></span>';
    botao.addEventListener('click', abrir);
    var menu = topo.querySelector('.menu-botao');
    topo.insertBefore(botao, menu || null);
    topo.classList.add('tem-sacola');
    contar();
  }
  function contar() {
    if (!botao) return;
    var n = totalPecas();
    var c = botao.querySelector('.sacola-contador');
    c.textContent = String(n);
    c.hidden = n === 0;
    botao.setAttribute('aria-label', n ? 'Sacola, ' + n + (n === 1 ? ' peça' : ' peças') : 'Sacola vazia');
  }

  /* --- Gaveta ------------------------------------------------------------------------------------- */

  function montarGaveta() {
    gaveta = criar('div', 'sacola');
    gaveta.hidden = true;
    gaveta.innerHTML =
      '<div class="sacola-fundo" data-fechar></div>' +
      '<aside class="sacola-painel" role="dialog" aria-modal="true" aria-labelledby="sacola-titulo">' +
      '  <header class="sacola-cabeca"><h2 id="sacola-titulo">Sua sacola</h2><button class="sacola-fechar" type="button" data-fechar aria-label="Fechar a sacola"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3l14 14M17 3L3 17"/></svg></button></header>' +
      '  <div class="sacola-corpo"><ul class="sacola-lista"></ul>' +
      '    <div class="sacola-vazia" hidden><p>Sua sacola está vazia.</p><a class="botao botao-cheio" href="colecao.html">Ver a coleção</a></div></div>' +
      '  <footer class="sacola-rodape">' +
      '    <dl class="sacola-totais"><div><dt>Subtotal</dt><dd class="sacola-subtotal"></dd></div><div><dt>Frete</dt><dd class="sacola-frete"></dd></div><div class="sacola-total"><dt>Total</dt><dd class="sacola-total-valor"></dd></div></dl>' +
      '    <p class="sacola-medida">Cada peça é feita sob as suas medidas. O prazo começa depois do pagamento.</p>' +
      '    <label class="campo-marcar sacola-aceite"><input type="checkbox"> <span>Li e concordo com as <a href="condicoes-de-compra.html" target="_blank" rel="noopener">condições de compra</a>.</span></label>' +
      '    <p class="erro sacola-erro" role="alert"></p>' +
      '    <button class="botao botao-cheio sacola-finalizar" type="button">Finalizar compra</button>' +
      '    <p class="sacola-seguro">Pagamento seguro pelo Mercado Pago, com Pix ou cartão.</p>' +
      '  </footer>' +
      '</aside>';
    document.body.appendChild(gaveta);
    gaveta.querySelectorAll('[data-fechar]').forEach(function (b) { b.addEventListener('click', fechar); });
    gaveta.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fechar();
      if (e.key === 'Tab') prenderFoco(e);
    });
    gaveta.querySelector('.sacola-finalizar').addEventListener('click', finalizar);
  }

  function prenderFoco(e) {
    var focaveis = Array.prototype.filter.call(gaveta.querySelectorAll('button, a, input'), function (x) { return x.offsetParent !== null && !x.disabled; });
    if (!focaveis.length) return;
    var primeiro = focaveis[0];
    var ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  function abrir() {
    if (!gaveta) montarGaveta();
    ultimoFoco = document.activeElement;
    gaveta.hidden = false;
    document.documentElement.classList.add('sacola-aberta');
    window.requestAnimationFrame(function () { gaveta.classList.add('aberta'); });
    erro('');
    desenhar();
    atualizarPrecos();
    gaveta.querySelector('.sacola-fechar').focus();
  }

  function fechar() {
    if (!gaveta || gaveta.hidden) return;
    gaveta.classList.remove('aberta');
    document.documentElement.classList.remove('sacola-aberta');
    window.setTimeout(function () { gaveta.hidden = true; }, 220);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function erro(texto, link) {
    if (!gaveta) return;
    var p = gaveta.querySelector('.sacola-erro');
    p.textContent = texto;
    if (link) {
      p.appendChild(document.createTextNode(' '));
      var a = criar('a', '', link[0]);
      a.href = link[1];
      p.appendChild(a);
    }
  }

  function desenhar() {
    var lista = gaveta.querySelector('.sacola-lista');
    lista.textContent = '';
    itens.forEach(function (i, n) {
      var li = criar('li', 'sacola-item' + (i.indisponivel ? ' sacola-indisponivel' : ''));
      var foto = criar('a', 'sacola-foto');
      foto.href = 'produto.html?p=' + encodeURIComponent(i.slug);
      if (i.foto) {
        var img = document.createElement('img');
        img.src = i.foto;
        img.alt = '';
        foto.appendChild(img);
      }
      li.appendChild(foto);
      var info = criar('div', 'sacola-info');
      var nome = criar('a', 'sacola-nome', i.nome);
      nome.href = foto.href;
      info.appendChild(nome);
      info.appendChild(criar('span', 'sacola-detalhe', i.indisponivel ? 'Não está mais disponível' : (i.cor ? 'Cor: ' + i.cor + ' · ' : '') + 'Sob medida'));
      var linha = criar('div', 'sacola-linha');
      var qtd = criar('div', 'sacola-qtd');
      var menos = criar('button', '', '−');
      menos.type = 'button';
      menos.setAttribute('aria-label', 'Tirar uma unidade de ' + i.nome);
      menos.disabled = i.quantidade <= 1;
      menos.addEventListener('click', function () { mudar(n, -1); });
      var valor = criar('span', '', String(i.quantidade));
      valor.setAttribute('aria-live', 'polite');
      var mais = criar('button', '', '+');
      mais.type = 'button';
      mais.setAttribute('aria-label', 'Mais uma unidade de ' + i.nome);
      mais.disabled = i.quantidade >= MAXIMO_QUANTIDADE || i.indisponivel;
      mais.addEventListener('click', function () { mudar(n, 1); });
      qtd.appendChild(menos);
      qtd.appendChild(valor);
      qtd.appendChild(mais);
      linha.appendChild(qtd);
      linha.appendChild(criar('strong', 'sacola-preco', reais(i.preco * i.quantidade)));
      info.appendChild(linha);
      var tirar = criar('button', 'sacola-tirar', 'Remover');
      tirar.type = 'button';
      tirar.addEventListener('click', function () { itens.splice(n, 1); gravar(); desenhar(); });
      info.appendChild(tirar);
      li.appendChild(info);
      lista.appendChild(li);
    });
    var vazia = itens.length === 0;
    gaveta.querySelector('.sacola-vazia').hidden = !vazia;
    gaveta.querySelector('.sacola-rodape').hidden = vazia;
    var validos = itens.filter(function (i) { return !i.indisponivel; });
    var subtotal = validos.reduce(function (s, i) { return s + i.preco * i.quantidade; }, 0);
    var frete = validos.reduce(function (m, i) { return Math.max(m, i.frete || 0); }, 0);
    gaveta.querySelector('.sacola-subtotal').textContent = reais(subtotal);
    gaveta.querySelector('.sacola-frete').textContent = frete ? reais(frete) : 'Grátis';
    gaveta.querySelector('.sacola-total-valor').textContent = reais(subtotal + frete);
    gaveta.querySelector('.sacola-finalizar').disabled = !validos.length || validos.length !== itens.length;
    if (validos.length !== itens.length) erro('Tire as peças que não estão mais disponíveis para continuar.');
  }

  function mudar(n, passo) {
    var i = itens[n];
    i.quantidade = Math.max(1, Math.min(MAXIMO_QUANTIDADE, i.quantidade + passo));
    gravar();
    desenhar();
  }

  // Preço, nome e foto de agora, direto da vitrine. O que saiu de venda fica marcado.
  function atualizarPrecos() {
    if (!itens.length || !api) return;
    api.get('api/produtos.php').then(function (r) {
      if (!r.ok) return;
      var porSlug = {};
      r.dados.produtos.forEach(function (p) { porSlug[p.slug] = p; });
      itens.forEach(function (i) {
        var p = porSlug[i.slug];
        if (!p || p.situacao !== 'publicado') { i.indisponivel = true; return; }
        i.indisponivel = false;
        i.nome = p.nome;
        i.preco = p.precoCentavos;
        i.frete = p.freteCentavos;
        var cor = (p.cores || []).filter(function (c) { return c.nome === i.cor; })[0];
        if ((p.cores || []).length && !cor) i.indisponivel = true;
        if (p.fotos && p.fotos[0]) i.foto = p.fotos[0];
      });
      gravar();
      if (gaveta && !gaveta.hidden) desenhar();
    });
  }

  function finalizar() {
    erro('');
    var aceite = gaveta.querySelector('.sacola-aceite input');
    if (!aceite.checked) { erro('Para continuar, marque que concorda com as condições de compra.'); aceite.focus(); return; }
    var b = gaveta.querySelector('.sacola-finalizar');
    b.disabled = true;
    b.textContent = 'Fechando o pedido...';
    var pronto = function () { b.disabled = false; b.textContent = 'Finalizar compra'; };
    api.post('api/pedidos.php?acao=finalizar', {
      itens: itens.map(function (i) { return { slug: i.slug, cor: i.cor || '', quantidade: i.quantidade }; })
    }).then(function (r) {
      if (r.status === 401) { location.href = 'entrar.html?voltar=' + encodeURIComponent('colecao.html'); return; }
      if (!r.ok) {
        pronto();
        if (r.dados && r.dados.precisaMedidas) { erro(r.erro, ['Preencher minhas medidas', 'medidas.html']); return; }
        if (r.dados && r.dados.indisponivel) atualizarPrecos();
        erro(r.erro || 'Não foi possível fechar o pedido agora. Tente de novo.');
        return;
      }
      var pedido = r.dados.pedido;
      itens = [];
      gravar();
      if (!r.dados.pagamentosAtivos) { location.href = 'minha-conta.html#conta-pedidos'; return; }
      b.textContent = 'Abrindo o pagamento...';
      api.post('api/pedidos.php?acao=pagar', { codigo: pedido.codigo, aceite: true }).then(function (p) {
        if (p.ok && p.dados.link) { location.href = p.dados.link; return; }
        location.href = 'minha-conta.html#conta-pedidos';
      });
    });
  }

  /* --- Para a página do produto --------------------------------------------------------------- */

  window.AR_SACOLA = {
    adicionar: function (p, cor, abrirDepois) {
      var existente = itens.filter(function (i) { return i.slug === p.slug && (i.cor || '') === (cor || ''); })[0];
      if (existente) {
        existente.quantidade = Math.min(MAXIMO_QUANTIDADE, existente.quantidade + 1);
      } else {
        if (itens.length >= MAXIMO_ITENS) return 'A sacola tem no máximo ' + MAXIMO_ITENS + ' peças diferentes.';
        itens.push({ slug: p.slug, cor: cor || '', quantidade: 1, nome: p.nome, preco: p.precoCentavos, frete: p.freteCentavos || 0, foto: (p.fotos || [])[0] || '' });
      }
      gravar();
      if (botao) {
        botao.classList.remove('pulou');
        void botao.offsetWidth;
        botao.classList.add('pulou');
      }
      if (abrirDepois) abrir();
      return '';
    },
    abrir: abrir
  };

  montarBotao();
  if (location.hash === '#sacola' && itens.length) window.setTimeout(abrir, 300);
  window.addEventListener('storage', function (e) { if (e.key === CHAVE) { itens = ler(); contar(); if (gaveta && !gaveta.hidden) desenhar(); } });
})();
