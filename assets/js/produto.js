/* Uma peça da coleção: fotos, cores, ficha técnica e a encomenda sob medida */
(function () {
  'use strict';

  var api = window.AR_API;
  var C = window.AR_COLECAO;
  var parametros = new URLSearchParams(location.search);
  var slug = parametros.get('p') || '';
  var produto = null;
  var corEscolhida = '';
  var exemplo = parametros.get('exemplo') === '1';

  function $(id) { return document.getElementById(id); }
  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  // Uma peça de exemplo, para ver como a página fica antes de cadastrar a coleção
  var EXEMPLO = {
    slug: 'exemplo', nome: 'Camiseta Essencial', categoria: 'camiseta', situacao: 'publicado',
    resumo: 'A camiseta básica com o comprimento, a largura do ombro e a manga no lugar certo para o seu corpo.',
    precoCentavos: 18900, freteCentavos: 0, prazoDias: 15, modelagem: 'regular',
    fotos: ['assets/img/sugeridas/camiseta-preta.webp', 'assets/img/sugeridas/camiseta-branca.webp'],
    cores: [{ nome: 'Preto', hex: '#111111' }, { nome: 'Branco', hex: '#f6f4ef' }],
    descricao: 'Feita em malha de algodão penteado, macia e encorpada, que não fica transparente.\n\nO molde parte das suas medidas de ombro, tórax, cintura e comprimento. Por isso, a camiseta não sobra na barriga nem aperta no braço.',
    tecido: 'Malha de algodão penteado', composicao: '100% algodão', gramatura: '180 g/m²',
    detalhes: ['Gola careca com ribana', 'Costura dupla nos ombros', 'Barra reta'],
    cuidados: 'Lavar do avesso, em água fria. Não usar secadora.'
  };

  function mostrarFoto(i) {
    var caixa = $('produto-foto');
    caixa.textContent = '';
    if (!produto.fotos.length) {
      caixa.appendChild(C.desenho(produto.categoria));
      caixa.classList.add('produto-foto-desenho');
      return;
    }
    var img = document.createElement('img');
    img.src = produto.fotos[i];
    img.alt = produto.nome + (produto.fotos.length > 1 ? ', foto ' + (i + 1) + ' de ' + produto.fotos.length : '');
    caixa.appendChild(img);
    document.querySelectorAll('#produto-miniaturas button').forEach(function (b, j) { b.setAttribute('aria-pressed', String(i === j)); });
  }

  function mostrarCores() {
    var lista = $('produto-cores');
    lista.textContent = '';
    if (!produto.cores.length) return;
    $('produto-cores-caixa').hidden = false;
    if (!corEscolhida) corEscolhida = produto.cores[0].nome;
    produto.cores.forEach(function (c) {
      var b = criar('button', 'produto-cor');
      b.type = 'button';
      b.style.setProperty('--cor', c.hex);
      b.setAttribute('aria-label', c.nome);
      b.setAttribute('aria-pressed', String(c.nome === corEscolhida));
      b.addEventListener('click', function () { corEscolhida = c.nome; mostrarCores(); });
      lista.appendChild(b);
    });
    $('produto-cor-nome').textContent = corEscolhida;
  }

  function linhaFicha(ficha, rotulo, valor) {
    if (!valor) return;
    var linha = criar('div');
    linha.appendChild(criar('dt', '', rotulo));
    linha.appendChild(criar('dd', '', valor));
    ficha.appendChild(linha);
  }

  function mostrar(p, previa) {
    produto = p;
    document.title = p.nome + ' | Rauber';
    $('produto-carregando').hidden = true;
    $('produto').hidden = false;
    $('produto-categoria').textContent = (C.porCategoria[p.categoria] || {}).rotulo || '';
    $('produto-nome').textContent = p.nome;
    $('produto-preco').textContent = C.reais(p.precoCentavos);
    $('produto-frete').textContent = p.freteCentavos ? 'Frete: ' + C.reais(p.freteCentavos) + ', pelos Correios' : 'Frete grátis, pelos Correios';
    $('produto-resumo').textContent = p.resumo || '';
    $('produto-prazo').textContent = 'Fica pronta em até ' + p.prazoDias + ' dias depois do pagamento. O molde parte das medidas salvas na sua conta.';

    var minis = $('produto-miniaturas');
    minis.textContent = '';
    if (p.fotos.length > 1) {
      p.fotos.forEach(function (f, i) {
        var b = criar('button', 'produto-miniatura');
        b.type = 'button';
        b.setAttribute('aria-label', 'Ver a foto ' + (i + 1));
        var img = document.createElement('img');
        img.src = f;
        img.alt = '';
        img.loading = 'lazy';
        b.appendChild(img);
        b.addEventListener('click', function () { mostrarFoto(i); });
        minis.appendChild(b);
      });
    }
    mostrarFoto(0);
    mostrarCores();

    var descricao = $('produto-descricao');
    descricao.textContent = '';
    String(p.descricao || '').split(/\n{2,}/).forEach(function (par) {
      if (par.trim()) descricao.appendChild(criar('p', '', par.trim()));
    });
    var ficha = $('produto-ficha');
    ficha.textContent = '';
    linhaFicha(ficha, 'Tecido', p.tecido);
    linhaFicha(ficha, 'Composição', p.composicao);
    linhaFicha(ficha, 'Gramatura', p.gramatura);
    var m = C.porModelagem[p.modelagem];
    linhaFicha(ficha, 'Modelagem', m ? m.rotulo + '. ' + m.texto : '');
    linhaFicha(ficha, 'Prazo', 'Até ' + p.prazoDias + ' dias para ficar pronta');
    linhaFicha(ficha, 'Cuidados', p.cuidados);
    var detalhes = $('produto-detalhes');
    detalhes.textContent = '';
    (p.detalhes || []).forEach(function (d) { detalhes.appendChild(criar('li', '', d)); });
    $('produto-detalhes-caixa').hidden = !(p.detalhes || []).length;

    var comprar = $('produto-comprar');
    if (exemplo || previa) {
      $('produto-faixa').hidden = false;
      $('produto-faixa').textContent = exemplo
        ? 'Exemplo: é assim que a página de uma peça vai ficar. Esta peça ainda não está à venda.'
        : 'Prévia para o gestor: esta peça ainda não aparece para os clientes.';
      comprar.disabled = true;
      $('produto-nota').textContent = 'A encomenda abre quando a peça estiver no ar.';
    } else if (p.situacao === 'esgotado') {
      comprar.disabled = true;
      comprar.textContent = 'Esgotado';
      $('produto-nota').textContent = 'Quer uma parecida? Faça um pedido exclusivo.';
    } else {
      $('produto-nota').textContent = 'O pedido fica na sua conta, pronto para pagar. Sem medidas salvas, você preenche antes.';
    }
  }

  $('produto-comprar').addEventListener('click', function () {
    var botao = $('produto-comprar');
    $('produto-erro').textContent = '';
    botao.disabled = true;
    api.post('api/pedidos.php?acao=encomendar', { slug: produto.slug, cor: corEscolhida }).then(function (r) {
      botao.disabled = false;
      var aqui = 'produto.html?p=' + produto.slug;
      if (r.status === 401) { location.href = 'entrar.html?voltar=' + encodeURIComponent(aqui); return; }
      if (r.ok) { location.href = 'minha-conta.html#conta-pedidos'; return; }
      if (r.dados && r.dados.precisaMedidas) {
        $('produto-erro').textContent = '';
        $('produto-nota').textContent = '';
        var aviso = $('produto-nota');
        aviso.appendChild(document.createTextNode('Para encomendar, salve suas medidas. Leva alguns minutos e fica guardado para as próximas compras. '));
        var link = criar('a', '', 'Preencher minhas medidas');
        link.href = 'medidas.html';
        aviso.appendChild(link);
        return;
      }
      $('produto-erro').textContent = r.erro || 'Não foi possível encomendar agora. Tente de novo.';
    });
  });

  if (exemplo) {
    mostrar(EXEMPLO, false);
    return;
  }
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) {
    $('produto-carregando').hidden = true;
    $('produto-sumiu').hidden = false;
    return;
  }
  api.get('api/produtos.php?slug=' + encodeURIComponent(slug)).then(function (r) {
    if (!r.ok) {
      $('produto-carregando').hidden = true;
      $('produto-sumiu').hidden = false;
      return;
    }
    mostrar(r.dados.produto, r.dados.previa);
  });
})();
