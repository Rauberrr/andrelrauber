/* Minha conta: pedidos da pessoa e botão de pagamento.
   O pagamento acontece na tela do Mercado Pago, e o site nunca vê os dados do cartão. */
(function () {
  'use strict';

  var api = window.AR_API;
  var ENDERECO = 'api/pedidos.php';

  var SITUACOES = {
    aguardando: 'Aguardando pagamento',
    processando: 'Pagamento em análise',
    pago: 'Pago',
    contestado: 'Pagamento em disputa',
    estornado: 'Pagamento devolvido',
    cancelado: 'Cancelado'
  };
  var METODOS = {
    credit_card: 'Cartão de crédito', debit_card: 'Cartão de débito', bank_transfer: 'Pix',
    account_money: 'Saldo do Mercado Pago', digital_currency: 'Linha de Crédito'
  };

  function el(id) { return document.getElementById(id); }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function reais(centavos) {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function dataCurta(texto) {
    return texto ? texto.split(' ')[0].split('-').reverse().join('/') : '';
  }

  function linhaDeValor(rotulo, valor, classe) {
    var linha = criar('div', 'pedido-linha' + (classe ? ' ' + classe : ''));
    linha.appendChild(criar('dt', '', rotulo));
    linha.appendChild(criar('dd', '', valor));
    return linha;
  }

  function resumoDoPagamento(p) {
    var partes = [];
    if (p.pagoEm) partes.push('Pago em ' + dataCurta(p.pagoEm));
    var metodo = METODOS[p.metodo];
    if (metodo) partes.push(metodo + (p.parcelas > 1 ? ' em ' + p.parcelas + 'x' : ''));
    return partes.join(' · ');
  }

  function areaDePagamento(p, indice, ativos) {
    var area = criar('div', 'pedido-pagar');
    if (!ativos) {
      area.appendChild(criar('p', 'pedido-nota', 'O pagamento pelo site estará disponível em breve. Fale conosco para combinar.'));
      return area;
    }
    if (p.situacao === 'processando') {
      area.appendChild(criar('p', 'pedido-nota', 'Se você gerou um Pix ou já pagou, o pedido muda sozinho quando o pagamento for confirmado. Se não concluiu, pode pagar de novo abaixo.'));
    }

    var aceite = criar('label', 'campo-marcar');
    var caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.id = 'pedido-aceite-' + indice;
    aceite.appendChild(caixa);
    var frase = criar('span', '', 'Li e concordo com as ');
    var link = criar('a', '', 'condições de compra');
    link.href = 'condicoes-de-compra.html';
    link.target = '_blank';
    link.rel = 'noopener';
    frase.appendChild(link);
    frase.appendChild(document.createTextNode('.'));
    aceite.appendChild(frase);
    area.appendChild(aceite);

    var erro = criar('p', 'erro');
    erro.setAttribute('role', 'alert');
    area.appendChild(erro);

    var botao = criar('button', 'botao botao-cheio', 'Pagar ' + reais(p.totalCentavos));
    botao.type = 'button';
    botao.addEventListener('click', function () {
      erro.textContent = '';
      if (!caixa.checked) {
        erro.textContent = 'Para pagar, é preciso concordar com as condições de compra.';
        return;
      }
      botao.disabled = true;
      botao.setAttribute('aria-busy', 'true');
      api.post(ENDERECO + '?acao=pagar', { codigo: p.codigo, aceite: true }).then(function (r) {
        if (r.ok && r.dados.link) {
          location.href = r.dados.link;
          return;
        }
        botao.disabled = false;
        botao.removeAttribute('aria-busy');
        if (r.status === 401) { api.irParaLogin('minha-conta.html'); return; }
        erro.textContent = r.erro || 'Não foi possível abrir o pagamento. Tente de novo.';
      });
    });
    area.appendChild(botao);
    area.appendChild(criar('p', 'pedido-nota', 'Pix ou cartão, em uma tela segura do Mercado Pago.'));
    return area;
  }

  function cartao(p, indice, ativos) {
    var item = criar('li', 'pedido');
    var cab = criar('div', 'pedido-cab');
    cab.appendChild(criar('h3', 'titulo-s', p.descricao));
    cab.appendChild(criar('span', 'painel-selo pedido-selo-' + p.situacao, SITUACOES[p.situacao] || p.situacao));
    item.appendChild(cab);

    var valores = criar('dl', 'pedido-valores');
    if (p.freteCentavos > 0) {
      valores.appendChild(linhaDeValor('Peça', reais(p.valorCentavos)));
      valores.appendChild(linhaDeValor('Frete', reais(p.freteCentavos)));
    }
    valores.appendChild(linhaDeValor('Total', reais(p.totalCentavos), 'pedido-total'));
    item.appendChild(valores);

    var resumo = resumoDoPagamento(p);
    if (resumo) item.appendChild(criar('p', 'pedido-nota', resumo));
    if (p.situacao === 'aguardando' || p.situacao === 'processando') {
      item.appendChild(areaDePagamento(p, indice, ativos));
    }
    return item;
  }

  function desenhar(pedidos, ativos) {
    var lista = el('pedidos-lista');
    lista.textContent = '';
    pedidos.forEach(function (p, i) { lista.appendChild(cartao(p, i, ativos)); });
    el('conta-pedidos').hidden = pedidos.length === 0;
  }

  function carregar() {
    return api.get(ENDERECO).then(function (r) {
      if (r.ok) desenhar(r.dados.pedidos, r.dados.pagamentosAtivos);
      return r;
    });
  }

  // Na volta do Mercado Pago, o site pergunta a ele o que aconteceu, sem confiar no endereço
  function voltaDoPagamento() {
    var busca = new URLSearchParams(location.search);
    var codigo = busca.get('pedido');
    var resultado = busca.get('pagamento');
    if (!codigo || !resultado) return Promise.resolve(null);
    history.replaceState(null, '', location.pathname);
    return api.post(ENDERECO + '?acao=conferir', { codigo: codigo }).then(function (r) {
      var pago = r.ok && r.dados.pedido && r.dados.pedido.situacao === 'pago';
      var aviso = el('pedidos-aviso');
      if (pago) {
        aviso.textContent = 'Pagamento confirmado. Obrigado! Vamos falar com você sobre a confecção.';
      } else if (resultado === 'recusado') {
        aviso.textContent = 'O pagamento não foi concluído e nada foi cobrado por este site. Você pode tentar de novo.';
      } else {
        aviso.textContent = 'Recebemos sua volta do Mercado Pago. Quando o pagamento for confirmado, o pedido muda para Pago.';
      }
      aviso.hidden = false;
    });
  }

  voltaDoPagamento().then(carregar);
})();
