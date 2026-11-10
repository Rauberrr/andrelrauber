/* Coleção: a vitrine, o próximo lançamento e o atalho para as medidas */
(function () {
  'use strict';

  var api = window.AR_API;
  var C = window.AR_COLECAO;

  function $(id) { return document.getElementById(id); }
  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function cartao(p) {
    var a = criar('a', 'vitrine-item');
    a.href = 'produto.html?p=' + encodeURIComponent(p.slug);
    var foto = criar('div', 'vitrine-foto');
    if (p.fotos[0]) {
      var img = document.createElement('img');
      img.src = p.fotos[0];
      img.alt = '';
      img.loading = 'lazy';
      foto.appendChild(img);
    } else {
      foto.appendChild(C.desenho(p.categoria));
    }
    if (p.situacao === 'esgotado') foto.appendChild(criar('span', 'vitrine-selo', 'Esgotado'));
    a.appendChild(foto);
    a.appendChild(criar('span', 'vitrine-categoria', (C.porCategoria[p.categoria] || {}).rotulo || ''));
    a.appendChild(criar('h2', 'vitrine-nome', p.nome));
    a.appendChild(criar('span', 'vitrine-preco', C.reais(p.precoCentavos)));
    if (p.cores.length > 1) {
      var cores = criar('span', 'vitrine-cores');
      cores.setAttribute('aria-label', p.cores.length + ' cores');
      p.cores.slice(0, 6).forEach(function (c) {
        var bolinha = criar('i');
        bolinha.style.background = c.hex;
        cores.appendChild(bolinha);
      });
      a.appendChild(cores);
    }
    return a;
  }

  // "2026-12-01 19:00:00", no horário de Brasília, vira uma data do navegador
  function paraData(texto) {
    return new Date(texto.replace(' ', 'T') + '-03:00');
  }

  function contagem(alvo) {
    var caixa = $('proxima-contagem');
    function passo() {
      var falta = Math.max(0, alvo - Date.now());
      if (falta <= 0) { location.reload(); return; }
      var dias = Math.floor(falta / 864e5);
      var horas = Math.floor(falta / 36e5) % 24;
      var minutos = Math.floor(falta / 6e4) % 60;
      caixa.textContent = '';
      [[dias, dias === 1 ? 'dia' : 'dias'], [horas, horas === 1 ? 'hora' : 'horas'], [minutos, 'min']].forEach(function (x) {
        var bloco = criar('span');
        bloco.appendChild(criar('b', '', String(x[0]).padStart(2, '0')));
        bloco.appendChild(criar('small', '', x[1]));
        caixa.appendChild(bloco);
      });
      caixa.setAttribute('aria-label', 'Faltam ' + dias + ' dias, ' + horas + ' horas e ' + minutos + ' minutos');
    }
    passo();
    setInterval(passo, 30000);
  }

  function mostrarProxima(c) {
    var data = paraData(c.lancaEm);
    $('proxima-titulo').textContent = c.nome;
    var quando = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + ', às ' +
      data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('proxima-texto').textContent = (c.descricao ? c.descricao + ' ' : '') + 'Lança em ' + quando +
      (c.total ? ', com ' + c.total + (c.total === 1 ? ' peça.' : ' peças.') : '.');
    $('colecao-proxima').hidden = false;
    contagem(data.getTime());
  }

  api.get('api/produtos.php').then(function (r) {
    $('colecao-carregando').hidden = true;
    if (!r.ok) {
      $('colecao-vazia').hidden = false;
      return;
    }
    var vitrine = $('vitrine');
    r.dados.produtos.forEach(function (p) { vitrine.appendChild(cartao(p)); });
    $('colecao-vazia').hidden = r.dados.produtos.length > 0;
    if (r.dados.proximas[0]) mostrarProxima(r.dados.proximas[0]);
  });

  // Quem já salvou as medidas vê que está tudo pronto para comprar
  api.get('api/perfil.php').then(function (r) {
    var botao = $('colecao-medidas');
    if (r.status === 401) {
      botao.textContent = 'Criar conta e salvar medidas';
      botao.href = 'criar-conta.html?voltar=medidas.html';
      return;
    }
    if (r.ok && r.dados.cadastro && r.dados.cadastro.concluido_em) {
      $('colecao-medidas-ok').hidden = false;
      botao.textContent = 'Conferir minhas medidas';
      botao.className = 'botao';
      botao.href = 'medidas.html?revisar=1';
    }
  });
})();
