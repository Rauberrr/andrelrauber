/* Guarda-roupa: a peça que mais abriria looks novos para a pessoa.
   Primeiro, só peças da coleção da marca que estão à venda e que a pessoa ainda não comprou nem tem.
   Sem nenhuma que valha, uma sugestão sem detalhes, para um orçamento sob medida.
   Usado pelo app Guarda-roupa e pela tela inicial dos apps. */
window.AR_SUGESTAO = (function () {
  'use strict';

  var gr = window.AR_GR;
  var motor = window.AR_LOOKS;
  if (!gr || !motor) return null;

  // Categoria da coleção -> tipo do guarda-roupa
  var TIPO_DA_CATEGORIA = { camiseta: 'camiseta', polo: 'polo', camisa: 'camisa', calca: 'calca', bermuda: 'bermuda', blazer: 'blazer', terno: 'terno', colete: 'colete', jaqueta: 'jaqueta' };
  var CORTE_DA_MODELAGEM = { ajustada: 'slim', regular: 'regular', solta: 'relaxed' };
  var MINIMO_DE_LOOKS = 2;

  // Peças clássicas para o orçamento sob medida, quando a coleção não tem o que falta.
  // peca: o tipo no pedido exclusivo. desenho: o traço usado no lugar da foto.
  var SOB_MEDIDA = [
    { id: 'jaqueta-caqui', tipo: 'jaqueta', cor: 'caqui', corte: 'regular', peca: 'jaqueta', desenho: 'blazer', nome: 'jaqueta leve' },
    { id: 'jaqueta-marinho', tipo: 'jaqueta', cor: 'azul_marinho', corte: 'regular', peca: 'jaqueta', desenho: 'blazer', nome: 'jaqueta leve' },
    { id: 'blazer-marinho', tipo: 'blazer', cor: 'azul_marinho', corte: 'regular', peca: 'blazer', desenho: 'blazer', nome: 'blazer' },
    { id: 'blazer-preto', tipo: 'blazer', cor: 'preto', corte: 'regular', peca: 'blazer', desenho: 'blazer', nome: 'blazer' },
    { id: 'calca-marinho', tipo: 'calca', cor: 'azul_marinho', corte: 'reto', peca: 'calca', desenho: 'calca', nome: 'calça' },
    { id: 'calca-cinza', tipo: 'calca', cor: 'cinza', corte: 'reto', peca: 'calca', desenho: 'calca', nome: 'calça' },
    { id: 'sarja-bege', tipo: 'calca_sarja', cor: 'bege', corte: 'reto', peca: 'calca', desenho: 'calca', nome: 'calça de sarja' },
    { id: 'camisa-branca', tipo: 'camisa', cor: 'branco', corte: 'regular', peca: 'camisa', desenho: 'camisa', nome: 'camisa' },
    { id: 'camisa-azul-clara', tipo: 'camisa', cor: 'azul_claro', corte: 'regular', peca: 'camisa', desenho: 'camisa', nome: 'camisa' },
    { id: 'polo-marinho', tipo: 'polo', cor: 'azul_marinho', corte: 'regular', peca: 'polo', desenho: 'polo', nome: 'polo' },
    { id: 'camiseta-off', tipo: 'camiseta', cor: 'off_white', corte: 'regular', peca: 'camiseta', desenho: 'camiseta', nome: 'camiseta' },
    { id: 'bermuda-bege', tipo: 'bermuda', cor: 'bege', corte: 'regular', peca: 'bermuda', desenho: 'bermuda', nome: 'bermuda' }
  ];

  function semAcento(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]+/g, '_');
  }

  function rgb(hex) {
    var h = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // A cor da coleção na lista de cores do guarda-roupa: pelo nome ou, sem acerto, pela cor mais próxima
  function corDoGuardaRoupa(cor) {
    var nome = semAcento(cor.nome);
    var porNome = gr.CORES.filter(function (c) { return c.id === nome || semAcento(c.rotulo) === nome || semAcento(c.nome) === nome; })[0];
    if (porNome) return porNome.id;
    var alvo = rgb(cor.hex);
    if (!alvo) return null;
    var melhor = null;
    gr.CORES.forEach(function (c) {
      var v = rgb(c.hex);
      if (!v) return;
      var d = Math.pow(v[0] - alvo[0], 2) + Math.pow(v[1] - alvo[1], 2) + Math.pow(v[2] - alvo[2], 2);
      if (!melhor || d < melhor.d) melhor = { id: c.id, d: d };
    });
    return melhor ? melhor.id : null;
  }

  function jaTem(pecas, tipo, cor) {
    return pecas.some(function (p) { return p.tipo === tipo && p.cor === cor; });
  }

  function pecaNova(id, tipo, cor, corte) {
    return {
      id: 'sugestao-' + id, tipo: tipo, cor: cor, corte: corte || 'regular', tecido: '',
      formalidade: gr.formalidadePadrao(tipo), clima: gr.climaPadrao(tipo, '')
    };
  }

  /**
   * pecas: as do guarda-roupa. produtos: os da vitrine (api/produtos.php). compradas: slugs que a pessoa já pediu.
   * fora: ids de sugestões que a pessoa descartou.
   * Devolve { tipo: 'colecao' | 'sob_medida', id, looks, nova, total, ... } ou null.
   */
  function melhor(pecas, produtos, compradas, fora) {
    if (!pecas || pecas.length < 2) return null;
    fora = fora || [];
    compradas = compradas || [];
    var total = motor.totalDeLooks(pecas);
    var escolhida = null;

    // 1. A coleção: cada cor de cada peça à venda é uma candidata
    (produtos || []).forEach(function (p) {
      var tipo = TIPO_DA_CATEGORIA[p.categoria];
      if (!tipo || p.situacao !== 'publicado' || compradas.indexOf(p.slug) !== -1) return;
      var cores = p.cores && p.cores.length ? p.cores : [];
      cores.forEach(function (c) {
        var cor = corDoGuardaRoupa(c);
        var id = 'colecao-' + p.slug + '-' + semAcento(c.nome);
        if (!cor || fora.indexOf(id) !== -1 || jaTem(pecas, tipo, cor)) return;
        var nova = pecaNova(id, tipo, cor, CORTE_DA_MODELAGEM[p.modelagem]);
        var looks = motor.looksCom(pecas, nova);
        if (looks.length >= MINIMO_DE_LOOKS && (!escolhida || looks.length > escolhida.looks.length)) {
          escolhida = { tipo: 'colecao', id: id, produto: p, cor: c, corGr: cor, looks: looks, nova: nova, total: total };
        }
      });
    });
    if (escolhida) return escolhida;

    // 2. Sem peça da coleção que valha: uma ideia para fazer sob medida
    SOB_MEDIDA.forEach(function (s) {
      var id = 'sob-medida-' + s.id;
      if (fora.indexOf(id) !== -1 || jaTem(pecas, s.tipo, s.cor)) return;
      var nova = pecaNova(id, s.tipo, s.cor, s.corte);
      var looks = motor.looksCom(pecas, nova);
      if (looks.length >= MINIMO_DE_LOOKS && (!escolhida || looks.length > escolhida.looks.length)) {
        escolhida = { tipo: 'sob_medida', id: id, item: s, looks: looks, nova: nova, total: total };
      }
    });
    return escolhida;
  }

  // "uma calça azul-marinho", "um blazer preto": o nome da peça com a cor, para as frases
  function nomeComCor(s) {
    var cor = gr.porCor[s.tipo === 'colecao' ? s.corGr : s.item.cor];
    var base = s.tipo === 'colecao' ? s.produto.nome : s.item.nome;
    var feminino = /^(cal[cç]a|camisa|camiseta|polo|jaqueta|bermuda|regata|malha)/i.test(semAcento(base).replace(/_/g, ' '));
    var corTexto = cor ? (feminino ? cor.descricao : cor.nome) : '';
    if (s.tipo === 'colecao') return (feminino ? 'a ' : 'o ') + base + (s.cor && s.cor.nome ? ' ' + s.cor.nome.toLowerCase() : '');
    return (feminino ? 'uma ' : 'um ') + base + (corTexto ? ' ' + corTexto : '');
  }

  function linkDaPeca(s) {
    if (s.tipo === 'colecao') return 'produto.html?p=' + encodeURIComponent(s.produto.slug) + (s.cor && s.cor.nome ? '&cor=' + encodeURIComponent(s.cor.nome) : '');
    return 'pedido-exclusivo.html?peca=' + encodeURIComponent(s.item.peca);
  }

  return { melhor: melhor, nomeComCor: nomeComCor, linkDaPeca: linkDaPeca, SOB_MEDIDA: SOB_MEDIDA };
})();
