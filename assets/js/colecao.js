/* Coleção: a vitrine, a busca com filtros, o próximo lançamento e o atalho para as medidas.
   Também mostra as peças na página inicial (vitrine com data-limite e sem a busca). */
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
  function mostrar(id, sim) { var e = $(id); if (e) e.hidden = !sim; }

  var vitrine = $('vitrine');
  if (!vitrine) return;
  var limite = Number(vitrine.getAttribute('data-limite')) || 0;
  var tituloDoCartao = vitrine.getAttribute('data-titulo') || 'h2';

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
    a.appendChild(criar(tituloDoCartao, 'vitrine-nome', p.nome));
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

  /* --- Busca e filtros (só na página da coleção) ------------------------------------------------ */

  var produtos = [];
  var filtro = { texto: '', categoria: '', ordem: 'destaque' };

  function semAcento(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function combina(p) {
    if (filtro.categoria && p.categoria !== filtro.categoria) return false;
    if (!filtro.texto) return true;
    var alvo = semAcento([p.nome, p.resumo, (C.porCategoria[p.categoria] || {}).rotulo, p.cores.map(function (c) { return c.nome; }).join(' ')].join(' '));
    return semAcento(filtro.texto).split(/\s+/).filter(Boolean).every(function (palavra) { return alvo.indexOf(palavra) !== -1; });
  }

  function desenharVitrine() {
    vitrine.textContent = '';
    var lista = produtos.filter(combina);
    if (filtro.ordem === 'menor') lista.sort(function (a, b) { return a.precoCentavos - b.precoCentavos; });
    if (filtro.ordem === 'maior') lista.sort(function (a, b) { return b.precoCentavos - a.precoCentavos; });
    if (limite) lista = lista.slice(0, limite);
    lista.forEach(function (p) { vitrine.appendChild(cartao(p)); });
    var resultado = $('colecao-resultado');
    if (resultado) {
      var filtrando = filtro.texto || filtro.categoria;
      resultado.textContent = filtrando
        ? (lista.length ? lista.length + (lista.length === 1 ? ' peça encontrada.' : ' peças encontradas.') : 'Nenhuma peça encontrada. Tente outra palavra ou outra categoria.')
        : '';
      var limpar = $('colecao-limpar');
      if (limpar) limpar.hidden = !filtrando;
    }
  }

  function montarFiltros() {
    var caixa = $('colecao-filtros');
    if (!caixa) return;
    if (produtos.length < 2) return;
    $('colecao-busca-caixa').hidden = false;
    var categorias = C.CATEGORIAS.filter(function (c) { return produtos.some(function (p) { return p.categoria === c.id; }); });
    caixa.textContent = '';
    [{ id: '', rotulo: 'Todas' }].concat(categorias).forEach(function (c) {
      var b = criar('button', 'colecao-filtro', c.rotulo);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(c.id === filtro.categoria));
      b.addEventListener('click', function () {
        filtro.categoria = c.id;
        caixa.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        desenharVitrine();
      });
      caixa.appendChild(b);
    });
  }

  if ($('colecao-busca')) {
    $('colecao-busca').addEventListener('input', function (e) { filtro.texto = e.target.value.trim(); desenharVitrine(); });
    $('colecao-ordem').addEventListener('change', function (e) { filtro.ordem = e.target.value; desenharVitrine(); });
    $('colecao-limpar').addEventListener('click', function () {
      filtro.texto = '';
      filtro.categoria = '';
      $('colecao-busca').value = '';
      montarFiltros();
      desenharVitrine();
      $('colecao-busca').focus();
    });
  }

  /* --- Próximo lançamento ----------------------------------------------------------------------- */

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

  function mostrarProxima(c, destaque) {
    var data = paraData(c.lancaEm);
    $('colecao-proxima').classList.toggle('colecao-proxima-destaque', Boolean(destaque));
    $('proxima-titulo').textContent = c.nome;
    var quando = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' }) + ', às ' +
      data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('proxima-texto').textContent = (c.descricao ? c.descricao + ' ' : '') + 'Lança em ' + quando +
      (c.total ? ', com ' + c.total + (c.total === 1 ? ' peça.' : ' peças.') : '.') +
      ' Na hora do lançamento, as peças aparecem aqui.';
    $('colecao-proxima').hidden = false;
    contagem(data.getTime());
  }

  api.get('api/produtos.php').then(function (r) {
    mostrar('colecao-carregando', false);
    if (!r.ok) {
      mostrar('colecao-vazia', true);
      return;
    }
    produtos = r.dados.produtos;
    montarFiltros();
    desenharVitrine();
    var proxima = r.dados.proximas[0];
    // Sem peças e sem lançamento: o aviso de que a coleção chega em breve.
    // Com lançamento agendado, a contagem fica no lugar do aviso.
    mostrar('colecao-vazia', produtos.length === 0 && !proxima);
    mostrar('colecao-ver-tudo', produtos.length > 0);
    if (proxima) mostrarProxima(proxima, produtos.length === 0);
  });

  // Quem já salvou as medidas vê que está tudo pronto para comprar
  var botao = $('colecao-medidas');
  if (botao) {
    api.get('api/perfil.php').then(function (r) {
      if (r.status === 401) {
        botao.textContent = 'Criar conta e salvar medidas';
        botao.href = 'criar-conta.html?voltar=medidas.html';
        return;
      }
      if (r.ok && r.dados.cadastro && r.dados.cadastro.concluido_em) {
        mostrar('colecao-medidas-ok', true);
        botao.textContent = 'Conferir minhas medidas';
        botao.className = 'botao';
        botao.href = 'medidas.html?revisar=1';
      }
    });
  }
})();
