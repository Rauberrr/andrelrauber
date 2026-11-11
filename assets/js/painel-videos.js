/* Painel: publicar o mesmo vídeo em várias redes de uma vez, agora ou agendado.
   O vídeo sobe em pedaços assim que é escolhido. Ao publicar, o servidor cria uma
   publicação por rede; "agora" é avançado por esta página, o agendado pela tarefa do Cron. */
(function () {
  'use strict';

  var api = window.AR_API;
  var ENDERECO = 'api/videos.php?acao=';
  var REDES = [
    { id: 'instagram', nome: 'Instagram', login: 'meta', detalhe: 'Reels' },
    { id: 'facebook', nome: 'Facebook', login: 'meta', detalhe: 'Reels da Página' },
    { id: 'youtube', nome: 'YouTube', login: 'google', detalhe: 'Shorts' },
    { id: 'tiktok', nome: 'TikTok', login: 'tiktok', detalhe: 'Vídeo' }
  ];
  var LOGINS = [
    { id: 'meta', nome: 'Instagram e Facebook', redes: ['instagram', 'facebook'], texto: 'Um login da Meta liga os dois. O Instagram precisa ser conta Profissional e estar ligado a uma Página do Facebook.' },
    { id: 'google', nome: 'YouTube', redes: ['youtube'], texto: 'Entre com a conta Google do canal.' },
    { id: 'tiktok', nome: 'TikTok', redes: ['tiktok'], texto: 'Entre com a conta do TikTok da marca.' }
  ];
  var SITUACOES = {
    agendada: 'Agendada', enviando: 'Enviando', processando: 'A rede está processando',
    publicada: 'Publicada', erro: 'Erro', cancelada: 'Cancelada'
  };
  var LIMITE = 2200;

  var estado = null;
  var video = null;     // { id, completo }
  var envio = 0;        // muda a cada vídeo escolhido, para abandonar o envio anterior
  var acompanhando = {};

  function $(id) { return document.getElementById(id); }
  function criar(tag, classe, texto) {
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }
  function aviso(texto) {
    $('pv-aviso').textContent = texto;
    $('pv-aviso').hidden = !texto;
  }
  function dataHora(ms) {
    return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function megas(bytes) { return (bytes / 1024 / 1024).toFixed(bytes < 10485760 ? 1 : 0).replace('.', ',') + ' MB'; }

  /* --- Estado e contas ------------------------------------------------------------------------ */

  function carregar() {
    return api.get(ENDERECO + 'estado').then(function (r) {
      $('pv-carregando').hidden = true;
      if (r.status === 401) { api.irParaLogin('painel-videos.html'); return; }
      if (r.status === 403) { aviso('Esta página é só para o administrador da marca.'); return; }
      if (!r.ok) { aviso(r.erro || 'Não foi possível carregar agora.'); return; }
      estado = r.dados;
      $('pv-conteudo').hidden = false;
      desenharContas();
      desenharRedes();
      desenharLista();
      // O que estava em andamento continua sendo acompanhado
      estado.publicacoes.forEach(function (p) {
        if ((p.situacao === 'enviando' || p.situacao === 'processando' || (p.situacao === 'agendada' && p.quando <= Date.now())) && !acompanhando[p.id]) acompanhar([p.id]);
      });
    });
  }

  function desenharContas() {
    var caixa = $('pv-contas');
    caixa.textContent = '';
    LOGINS.forEach(function (l) {
      var c = criar('article', 'pv-conta');
      var ligadas = l.redes.filter(function (r) { return estado.contas[r]; });
      c.appendChild(criar('h3', 'pv-conta-nome', l.nome));
      if (ligadas.length) {
        var ul = criar('ul', 'pv-conta-ligadas');
        ligadas.forEach(function (r) {
          ul.appendChild(criar('li', '', nomeDaRede(r) + ': ' + estado.contas[r].nome));
        });
        if (l.id === 'meta' && !estado.contas.instagram) ul.appendChild(criar('li', 'pv-conta-falta', 'Instagram: nenhuma conta Profissional ligada à Página'));
        c.appendChild(ul);
      } else {
        c.appendChild(criar('p', 'painel-ajuda', estado.configurados[l.id] ? l.texto : 'Falta criar o app de desenvolvedor e pôr as chaves no config.php. O passo a passo está no README.'));
      }
      var botoes = criar('div', 'pv-conta-botoes');
      if (estado.configurados[l.id]) {
        var conectar = criar('a', ligadas.length ? 'texto-botao' : 'botao', ligadas.length ? 'Trocar de conta' : 'Conectar');
        conectar.href = 'api/conectar.php?login=' + l.id;
        botoes.appendChild(conectar);
      }
      if (ligadas.length) {
        var sair = criar('button', 'texto-botao painel-perigo', 'Desconectar');
        sair.type = 'button';
        sair.addEventListener('click', function () {
          if (!window.confirm('Desconectar ' + l.nome + '? As publicações agendadas nessa rede vão dar erro até conectar de novo.')) return;
          api.post(ENDERECO + 'desconectar', { login: l.id }).then(function () { carregar(); });
        });
        botoes.appendChild(sair);
      }
      c.appendChild(botoes);
      caixa.appendChild(c);
    });
  }

  function nomeDaRede(id) { return REDES.filter(function (r) { return r.id === id; })[0].nome; }

  function desenharRedes() {
    var caixa = $('pv-redes');
    var marcadas = marcadasAgora();
    caixa.textContent = '';
    REDES.forEach(function (r) {
      var ligada = Boolean(estado.contas[r.id]);
      var rotulo = criar('label', 'pv-rede pv-rede-' + r.id + (ligada ? '' : ' pv-rede-off'));
      var caixinha = document.createElement('input');
      caixinha.type = 'checkbox';
      caixinha.name = 'pv-rede';
      caixinha.value = r.id;
      caixinha.disabled = !ligada;
      caixinha.checked = ligada && (marcadas === null || marcadas.indexOf(r.id) !== -1);
      caixinha.defaultChecked = ligada;
      caixinha.addEventListener('change', mostrarTitulo);
      rotulo.appendChild(caixinha);
      var texto = criar('span', 'pv-rede-texto');
      texto.appendChild(criar('strong', '', r.nome));
      var nota = ligada ? r.detalhe + ' · ' + estado.contas[r.id].nome : 'Não conectado';
      if (ligada && r.id === 'tiktok' && estado.tiktokPrivacidade === 'SELF_ONLY') nota += ' · sai como privado até o TikTok aprovar o app';
      if (ligada && r.id === 'youtube') nota += ' · sai como privado até o YouTube aprovar o app';
      texto.appendChild(criar('small', '', nota));
      rotulo.appendChild(texto);
      caixa.appendChild(rotulo);
    });
    mostrarTitulo();
  }

  function marcadasAgora() {
    var caixas = document.querySelectorAll('input[name="pv-rede"]');
    if (!caixas.length) return null;
    return Array.prototype.slice.call(caixas).filter(function (c) { return c.checked; }).map(function (c) { return c.value; });
  }

  function mostrarTitulo() {
    $('pv-titulo-campo').hidden = (marcadasAgora() || []).indexOf('youtube') === -1;
  }

  /* --- Enviar o vídeo em pedaços --------------------------------------------------------------- */

  $('pv-arquivo').addEventListener('change', function () {
    var arquivo = $('pv-arquivo').files[0];
    $('pv-erro-video').textContent = '';
    if (!arquivo) return;
    var tipo = arquivo.type || (/\.mov$/i.test(arquivo.name) ? 'video/quicktime' : 'video/mp4');
    if (tipo !== 'video/mp4' && tipo !== 'video/quicktime') { $('pv-erro-video').textContent = 'Use um vídeo MP4 ou MOV.'; return; }
    if (arquivo.size > 500 * 1024 * 1024) { $('pv-erro-video').textContent = 'O vídeo passa de 500 MB. Exporte com qualidade menor.'; return; }
    var previa = $('pv-previa');
    if (previa.src) URL.revokeObjectURL(previa.src);
    previa.src = URL.createObjectURL(arquivo);
    previa.hidden = false;
    $('pv-escolher').querySelector('strong').textContent = 'Trocar o vídeo';
    enviar(arquivo, tipo);
  });

  function progresso(feito, total, texto) {
    $('pv-progresso').hidden = false;
    $('pv-barra').style.width = Math.round(feito / total * 100) + '%';
    $('pv-progresso-texto').textContent = texto || ('Subindo o vídeo: ' + megas(feito) + ' de ' + megas(total));
  }

  function enviar(arquivo, tipo) {
    var este = ++envio;
    video = null;
    progresso(0, arquivo.size, 'Preparando o envio...');
    api.post(ENDERECO + 'novo-video', { nome: arquivo.name.slice(0, 160), tamanho: arquivo.size, tipo: tipo }).then(function (r) {
      if (este !== envio) return;
      if (!r.ok) { $('pv-erro-video').textContent = r.erro || 'Não foi possível começar o envio.'; $('pv-progresso').hidden = true; return; }
      var id = r.dados.id;
      var pedaco = r.dados.pedaco;
      var tentativas = 0;
      function proximo(posicao) {
        if (este !== envio) return;
        if (posicao >= arquivo.size) {
          video = { id: id, completo: true };
          progresso(1, 1, 'Vídeo pronto (' + megas(arquivo.size) + ').');
          return;
        }
        progresso(posicao, arquivo.size);
        fetch(ENDERECO + 'pedaco', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Video': String(id), 'X-Posicao': String(posicao) },
          body: arquivo.slice(posicao, posicao + pedaco)
        }).then(function (resposta) {
          return resposta.json().catch(function () { return {}; }).then(function (d) { return { status: resposta.status, d: d }; });
        }).then(function (r) {
          if (r.status === 200) { tentativas = 0; proximo(r.d.recebido); return; }
          // Fora de ordem: continua de onde o servidor parou
          if (r.status === 409 && typeof r.d.recebido === 'number') { proximo(r.d.recebido); return; }
          throw new Error(r.d.erro || 'Falha no envio.');
        }).catch(function (e) {
          if (este !== envio) return;
          tentativas += 1;
          if (tentativas <= 4) { window.setTimeout(function () { proximo(posicao); }, 1500 * tentativas); return; }
          $('pv-erro-video').textContent = (e && e.message) || 'A conexão caiu. Escolha o vídeo de novo.';
        });
      }
      proximo(0);
    });
  }

  /* --- Publicar --------------------------------------------------------------------------------- */

  function legendaFinal() {
    var texto = $('pv-legenda').value.trim();
    var tags = $('pv-hashtags').value.trim().split(/[\s,]+/).filter(Boolean).map(function (t) { return '#' + t.replace(/^#+/, ''); });
    var novas = tags.filter(function (t) { return texto.toLowerCase().indexOf(t.toLowerCase()) === -1; });
    return novas.length ? (texto ? texto + '\n\n' : '') + novas.join(' ') : texto;
  }

  function contar() {
    var n = legendaFinal().length;
    var c = $('pv-contador');
    c.textContent = n.toLocaleString('pt-BR') + ' de 2.200' + ($('pv-hashtags').value.trim() ? ', com as hashtags' : '');
    c.classList.toggle('pv-contador-passou', n > LIMITE);
  }
  $('pv-legenda').addEventListener('input', contar);
  $('pv-hashtags').addEventListener('input', contar);

  document.querySelectorAll('input[name="pv-quando"]').forEach(function (r) {
    r.addEventListener('change', function () {
      var agendar = document.querySelector('input[name="pv-quando"]:checked').value === 'agendar';
      $('pv-data-campo').hidden = !agendar;
      $('pv-publicar').textContent = agendar ? 'Agendar' : 'Publicar';
      if (agendar && !$('pv-data').value) {
        var d = new Date(Date.now() + 3600000);
        d.setMinutes(0, 0, 0);
        $('pv-data').value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + ':00';
      }
    });
  });

  $('pv-form').addEventListener('submit', function (e) {
    e.preventDefault();
    ['pv-erro', 'pv-erro-video', 'pv-erro-redes', 'pv-erro-titulo', 'pv-erro-legenda', 'pv-erro-quando'].forEach(function (id) { $(id).textContent = ''; });
    var redes = marcadasAgora() || [];
    var legenda = legendaFinal();
    var agendar = document.querySelector('input[name="pv-quando"]:checked').value === 'agendar';
    var quando = null;
    if (!video || !video.completo) { $('pv-erro-video').textContent = video === null && !$('pv-arquivo').files.length ? 'Escolha o vídeo.' : 'Espere o vídeo terminar de subir.'; return; }
    if (!redes.length) { $('pv-erro-redes').textContent = 'Marque pelo menos uma rede.'; return; }
    if (legenda.length > LIMITE) { $('pv-erro-legenda').textContent = 'Passou de 2.200 caracteres, o limite do Instagram e do TikTok.'; return; }
    if (redes.indexOf('youtube') !== -1 && !$('pv-titulo').value.trim() && !legenda) { $('pv-erro-titulo').textContent = 'O YouTube pede um título.'; return; }
    if (agendar) {
      var data = new Date($('pv-data').value);
      if (!$('pv-data').value || isNaN(data.getTime()) || data.getTime() < Date.now() + 60000) { $('pv-erro-quando').textContent = 'Escolha uma data e hora daqui para a frente.'; return; }
      quando = Math.floor(data.getTime() / 1000);
    }
    var botao = $('pv-publicar');
    botao.disabled = true;
    api.post(ENDERECO + 'publicar', { video: video.id, titulo: $('pv-titulo').value.trim(), legenda: legenda, redes: redes, quando: quando }).then(function (r) {
      botao.disabled = false;
      if (!r.ok) {
        var campos = (r.dados && r.dados.campos) || {};
        Object.keys(campos).forEach(function (k) { var el = $('pv-erro-' + k); if (el) el.textContent = campos[k]; });
        $('pv-erro').textContent = r.erro || 'Não foi possível publicar.';
        return;
      }
      aviso(agendar
        ? 'Agendado para ' + dataHora(quando * 1000) + ' em ' + redes.map(nomeDaRede).join(', ') + '.'
        : 'Publicando em ' + redes.map(nomeDaRede).join(', ') + '. Acompanhe abaixo.');
      limparFormulario();
      carregar().then(function () { if (!agendar) acompanhar(r.dados.ids); });
    });
  });

  function limparFormulario() {
    envio += 1;
    video = null;
    $('pv-form').reset();
    var previa = $('pv-previa');
    if (previa.src) URL.revokeObjectURL(previa.src);
    previa.removeAttribute('src');
    previa.hidden = true;
    $('pv-progresso').hidden = true;
    $('pv-escolher').querySelector('strong').textContent = 'Escolher o vídeo';
    $('pv-data-campo').hidden = true;
    $('pv-publicar').textContent = 'Publicar';
    contar();
  }

  // Avança as publicações de "agora" enquanto a página está aberta. Fechou, o Cron termina.
  function acompanhar(ids) {
    ids.forEach(function (id) { acompanhando[id] = true; });
    api.post(ENDERECO + 'processar', { ids: ids }).then(function (r) {
      if (!r.ok) { ids.forEach(function (id) { delete acompanhando[id]; }); return; }
      var abertas = [];
      r.dados.publicacoes.forEach(function (p) {
        atualizar(p);
        if (p.situacao === 'enviando' || p.situacao === 'processando' || p.situacao === 'agendada') abertas.push(p.id);
        else delete acompanhando[p.id];
      });
      if (abertas.length) window.setTimeout(function () { acompanhar(abertas); }, 4000);
    });
  }

  /* --- Lista ------------------------------------------------------------------------------------ */

  function atualizar(p) {
    var lista = estado.publicacoes;
    for (var i = 0; i < lista.length; i += 1) {
      if (lista[i].id === p.id) { lista[i] = p; desenharLista(); return; }
    }
  }

  // Agrupa por vídeo e momento: uma linha por envio, com uma etiqueta por rede
  function desenharLista() {
    var caixa = $('pv-lista');
    caixa.textContent = '';
    var grupos = [];
    var porChave = {};
    estado.publicacoes.forEach(function (p) {
      var chave = p.video + '|' + p.quando + '|' + p.legenda.length;
      if (!porChave[chave]) { porChave[chave] = { itens: [], p: p }; grupos.push(porChave[chave]); }
      porChave[chave].itens.push(p);
    });
    $('pv-vazio').hidden = grupos.length > 0;
    grupos.forEach(function (g) {
      var li = criar('li', 'pv-item');
      var cab = criar('div', 'pv-item-cab');
      cab.appendChild(criar('strong', '', g.p.titulo || g.p.nomeVideo || 'Vídeo'));
      var futuro = g.p.quando > Date.now() + 60000;
      cab.appendChild(criar('span', 'painel-suave', (futuro ? 'Agendado para ' : '') + dataHora(g.p.quando)));
      li.appendChild(cab);
      if (g.p.legenda) li.appendChild(criar('p', 'pv-item-legenda', g.p.legenda.length > 180 ? g.p.legenda.slice(0, 180) + '…' : g.p.legenda));
      var redes = criar('ul', 'pv-item-redes');
      g.itens.forEach(function (p) {
        var r = criar('li', 'pv-situacao pv-situacao-' + p.situacao);
        r.appendChild(criar('span', 'pv-situacao-rede', nomeDaRede(p.rede)));
        var andamento = (p.situacao === 'enviando' || p.situacao === 'processando') ? '…' : '';
        r.appendChild(criar('span', '', SITUACOES[p.situacao] + andamento));
        if (p.situacao === 'publicada' && p.link) {
          var a = criar('a', 'link-seta', 'Ver');
          a.href = p.link;
          a.target = '_blank';
          a.rel = 'noopener';
          r.appendChild(a);
        }
        if (p.situacao === 'erro') {
          r.appendChild(criar('span', 'pv-situacao-erro', p.erro));
          var tentar = criar('button', 'texto-botao', 'Tentar de novo');
          tentar.type = 'button';
          tentar.addEventListener('click', function () {
            api.post(ENDERECO + 'tentar', { id: p.id }).then(function () { carregar().then(function () { acompanhar([p.id]); }); });
          });
          r.appendChild(tentar);
        }
        if (p.situacao === 'agendada' && p.quando > Date.now()) {
          var cancelar = criar('button', 'texto-botao painel-perigo', 'Cancelar');
          cancelar.type = 'button';
          cancelar.addEventListener('click', function () {
            if (!window.confirm('Cancelar a publicação no ' + nomeDaRede(p.rede) + '?')) return;
            api.post(ENDERECO + 'cancelar', { id: p.id }).then(function (x) {
              if (!x.ok) aviso(x.erro || 'Não foi possível cancelar.');
              carregar();
            });
          });
          r.appendChild(cancelar);
        }
        redes.appendChild(r);
      });
      li.appendChild(redes);
      caixa.appendChild(li);
    });
  }

  /* --- Começo ----------------------------------------------------------------------------------- */

  var params = new URLSearchParams(location.search);
  if (params.get('conectado')) aviso('Conectado. ' + params.get('conectado'));
  if (params.get('erro')) aviso('Não foi possível conectar: ' + params.get('erro'));
  if (params.get('conectado') || params.get('erro')) history.replaceState(null, '', 'painel-videos.html');
  contar();
  carregar();
})();
