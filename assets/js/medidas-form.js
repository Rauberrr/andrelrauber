/* Tabela de medidas em passo a passo: uma informação por vez, tudo salvo no aparelho */
(function () {
  'use strict';

  var config = window.AR_CONFIG;
  var dados = window.AR_MEDIDAS;
  var figura = window.AR_FIGURA;
  var form = document.getElementById('form-medidas');
  if (!form) return;

  var CHAVE = 'ar-medidas-v1';
  var VALIDADE_DIAS = 30;

  var porMedida = {};
  dados.geral.concat(dados.cima, dados.baixo).forEach(function (m) { porMedida[m.id] = m; });

  var estado = { cima: null, baixo: null };
  var atual = null;
  var voltarParaRevisao = false;
  var avisoConfirmado = {};

  /* --- As etapas ------------------------------------------------------------- */

  var CAMPOS_PREFERENCIAS = ['cor', 'tecido', 'caimento', 'data_desejada', 'observacoes'];

  var ETAPAS = {
    nome: { grupo: 'Seus dados', titulo: 'Qual é o seu nome?', tipo: 'texto', auto: 'name', max: 120, erro: 'Informe seu nome.' },
    telefone: {
      grupo: 'Seus dados', titulo: 'Qual é o seu WhatsApp?', desc: 'Com DDD, para continuarmos a conversa.',
      tipo: 'tel', auto: 'tel-national', dica: '(54) 99999-9999', erro: 'Informe um WhatsApp com DDD.'
    },
    cidade: {
      grupo: 'Seus dados', titulo: 'Para qual cidade enviamos?', desc: 'O envio é feito pelos Correios.',
      tipo: 'texto', auto: 'address-level2', max: 120, dica: 'Curitiba, PR', erro: 'Informe sua cidade e estado.'
    },
    tamanho: {
      grupo: 'Sobre você', titulo: 'Qual tamanho você costuma usar?', desc: 'Opcional. Ajuda a entender o seu ponto de partida.',
      tipo: 'texto', max: 60, dica: 'Camisa M, calça 42', opcional: true
    },
    preferencias: { grupo: 'Preferências', titulo: 'Tem alguma preferência?', desc: 'Tudo opcional. Se ainda não souber, decidimos juntos na conversa.', tipo: 'preferencias' },
    cima: { grupo: 'Parte de cima', titulo: 'Quer fazer uma peça de cima?', desc: 'Camisa, camiseta ou blazer.', tipo: 'decisao' },
    baixo: { grupo: 'Parte de baixo', titulo: 'Quer fazer uma peça de baixo?', desc: 'Calça.', tipo: 'decisao' },
    revisao: { grupo: 'Quase lá', titulo: 'Confira e envie.', desc: 'O WhatsApp vai abrir com a mensagem pronta, e você decide quando enviar.', tipo: 'revisao' }
  };

  function ids(lista) { return lista.map(function (m) { return m.id; }); }

  // A sequência muda conforme as respostas de Sim e Não
  function sequencia(prever) {
    var s = ['nome', 'telefone', 'cidade'].concat(ids(dados.geral), ['tamanho', 'preferencias', 'cima']);
    if (estado.cima === true || (prever && estado.cima === null)) s = s.concat(ids(dados.cima));
    s.push('baixo');
    if (estado.baixo === true || (prever && estado.baixo === null)) s = s.concat(ids(dados.baixo));
    s.push('revisao');
    return s;
  }

  /* --- Montagem ---------------------------------------------------------------- */

  var etapasEl = document.getElementById('etapas');
  var barra = document.getElementById('barra-progresso');
  var progresso = barra.parentNode;
  var navEl = document.getElementById('etapas-nav');
  var botaoVoltar = document.getElementById('botao-voltar');
  var botaoContinuar = document.getElementById('botao-continuar');
  var aviso = document.getElementById('aviso-retomada');

  function cabecalho(id, grupo, titulo, desc, comoLabel) {
    var tag = comoLabel ? 'label for="' + id + '"' : 'h2 tabindex="-1"';
    var fecha = comoLabel ? 'label' : 'h2';
    return '<span class="etiqueta etapa-grupo" data-grupo>' + grupo + '</span>' +
      '<' + tag + ' class="titulo-l etapa-titulo">' + titulo + '</' + fecha + '>' +
      (desc ? '<p class="etapa-desc">' + desc + '</p>' : '');
  }

  function etapaTexto(id, e) {
    return cabecalho(id, e.grupo, e.titulo, e.desc, true) +
      '<div class="etapa-corpo"><div class="campo campo-grande">' +
        '<div class="campo-entrada"><input id="' + id + '" name="' + id + '" type="' + (e.tipo === 'tel' ? 'tel' : 'text') + '"' +
        (e.tipo === 'tel' ? ' inputmode="tel"' : '') + (e.auto ? ' autocomplete="' + e.auto + '"' : '') +
        (e.max ? ' maxlength="' + e.max + '"' : '') + (e.dica ? ' placeholder="' + e.dica + '"' : '') +
        ' enterkeyhint="next" aria-describedby="' + id + '-erro"></div>' +
        '<p class="erro" id="' + id + '-erro" role="alert"></p>' +
      '</div></div>';
  }

  function etapaMedida(m, grupo, n, total) {
    var temDesenho = m.marca && (m.marca.l || m.marca.v);
    var rotulo = grupo + (total ? ' · ' + n + ' de ' + total : '');
    return cabecalho(m.id, rotulo, m.rotulo, '', true) +
      '<div class="etapa-corpo"><div class="campo campo-grande">' +
        '<div class="campo-entrada"><input id="' + m.id + '" name="' + m.id + '" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" placeholder="0" aria-describedby="' + m.id + '-ajuda ' + m.id + '-erro ' + m.id + '-aviso">' +
        '<span class="unidade" aria-hidden="true">' + m.unidade + '</span></div>' +
        '<p class="ajuda" id="' + m.id + '-ajuda">' + m.ajuda + ' <a href="guia-de-medidas.html#' + m.id + '">Ver no guia</a>.</p>' +
        '<p class="erro" id="' + m.id + '-erro" role="alert"></p>' +
        '<p class="aviso" id="' + m.id + '-aviso" role="status"></p>' +
      '</div>' +
      (temDesenho ? '<button class="onde-medir" type="button" data-ampliar="' + m.id + '">' +
        '<span class="onde-medir-figura">' + figura.desenhar(m, m.recorte) + '</span>' +
        '<span class="onde-medir-texto"><strong>Onde medir</strong><span>Toque para ampliar a imagem</span></span>' +
      '</button>' : '') +
      '</div>';
  }

  function etapaPreferencias(e) {
    return cabecalho('', e.grupo, e.titulo, e.desc, false) +
      '<div class="etapa-corpo campos">' +
        '<div class="campo"><label for="cor">Cor</label><div class="campo-entrada"><input id="cor" name="cor" type="text" maxlength="80" enterkeyhint="next" placeholder="Preto, off-white, bordô"></div></div>' +
        '<div class="campo"><label for="tecido">Tecido</label><div class="campo-entrada"><input id="tecido" name="tecido" type="text" maxlength="80" enterkeyhint="next" placeholder="Algodão, linho, alfaiataria"></div></div>' +
        '<div class="campo"><label for="caimento">Caimento</label><div class="campo-entrada"><select id="caimento" name="caimento">' +
          '<option value="">Selecione</option><option>Ajustado</option><option>Regular</option><option>Amplo</option><option>Quero orientação</option>' +
        '</select></div></div>' +
        '<div class="campo"><label for="data_desejada">Preciso até</label><div class="campo-entrada"><input id="data_desejada" name="data_desejada" type="date"></div></div>' +
        '<div class="campo campo-inteiro"><label for="observacoes">Observações</label><div class="campo-entrada"><textarea id="observacoes" name="observacoes" rows="3" maxlength="800" placeholder="Qual peça você quer, referências de estilo, o que costuma incomodar nas suas roupas"></textarea></div></div>' +
      '</div>';
  }

  function etapaDecisao(id, e) {
    return cabecalho('', e.grupo, e.titulo, e.desc, false) +
      '<div class="etapa-corpo">' +
        '<div class="decisao" role="group" aria-label="' + e.titulo + '">' +
          '<button class="decisao-botao" type="button" data-decisao="' + id + '" data-valor="sim" aria-pressed="false">Sim</button>' +
          '<button class="decisao-botao" type="button" data-decisao="' + id + '" data-valor="nao" aria-pressed="false">Não</button>' +
        '</div>' +
        '<p class="erro" id="' + id + '-erro" role="alert"></p>' +
      '</div>';
  }

  function etapaRevisao(e) {
    return cabecalho('', e.grupo, e.titulo, e.desc, false) +
      '<div class="etapa-corpo">' +
        '<div id="revisao-conteudo"></div>' +
        '<div class="envio">' +
          '<p class="erro envio-erro" id="erro-geral" role="alert"></p>' +
          '<button class="botao botao-cheio" type="submit">Enviar pelo WhatsApp</button>' +
          '<p class="envio-nota" id="nota-privacidade">Suas respostas ficam salvas apenas neste aparelho, para você não perder nada, e só saem dele quando você envia pelo WhatsApp. Veja a <a href="privacidade.html">política de privacidade</a>.</p>' +
          '<div class="confirmacao" id="confirmacao" role="status" hidden>' +
            '<h3 class="titulo-s">Sua mensagem está pronta.</h3>' +
            '<p>Agora é só tocar em enviar no WhatsApp. Se ele não abriu sozinho, use o link abaixo.</p>' +
            '<div class="confirmacao-acoes">' +
              '<a class="link-seta" id="reabrir-whatsapp" href="#" target="_blank" rel="noopener">Abrir o WhatsApp <span aria-hidden="true">→</span></a>' +
              '<button class="texto-botao" type="button" data-recomecar>Começar novo pedido</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function montar() {
    var html = '';
    function adicionar(id, conteudo) {
      html += '<section class="etapa" data-etapa="' + id + '" hidden>' + conteudo + '</section>';
    }
    ['nome', 'telefone', 'cidade'].forEach(function (id) { adicionar(id, etapaTexto(id, ETAPAS[id])); });
    dados.geral.forEach(function (m) { adicionar(m.id, etapaMedida(m, 'Sobre você')); });
    adicionar('tamanho', etapaTexto('tamanho', ETAPAS.tamanho));
    adicionar('preferencias', etapaPreferencias(ETAPAS.preferencias));
    adicionar('cima', etapaDecisao('cima', ETAPAS.cima));
    dados.cima.forEach(function (m, i) { adicionar(m.id, etapaMedida(m, 'Parte de cima', i + 1, dados.cima.length)); });
    adicionar('baixo', etapaDecisao('baixo', ETAPAS.baixo));
    dados.baixo.forEach(function (m, i) { adicionar(m.id, etapaMedida(m, 'Parte de baixo', i + 1, dados.baixo.length)); });
    adicionar('revisao', etapaRevisao(ETAPAS.revisao));
    etapasEl.innerHTML = html;
  }
  montar();

  var telefone = document.getElementById('telefone');
  var confirmacao = document.getElementById('confirmacao');
  var linkReabrir = document.getElementById('reabrir-whatsapp');
  var erroGeral = document.getElementById('erro-geral');
  var nota = document.getElementById('nota-privacidade');

  if (config.salvarNoBanco) {
    nota.innerHTML = 'Suas respostas ficam salvas neste aparelho e, ao enviar, seguem pelo WhatsApp e são guardadas com segurança para a confecção das suas peças. Veja a <a href="privacidade.html">política de privacidade</a>.';
  }

  document.getElementById('data_desejada').min = (function () {
    var h = new Date();
    return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  })();

  telefone.addEventListener('input', function () {
    var d = telefone.value.replace(/\D/g, '').slice(0, 11);
    var saida = d;
    if (d.length > 2) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 10) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    else if (d.length > 6) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    telefone.value = saida;
  });

  /* --- Salvar no aparelho --------------------------------------------------------- */

  function valor(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function salvar() {
    var valores = {};
    form.querySelectorAll('.etapa input, .etapa select, .etapa textarea').forEach(function (el) {
      if (el.value) valores[el.id] = el.value;
    });
    try {
      localStorage.setItem(CHAVE, JSON.stringify({
        salvoEm: Date.now(), etapa: atual, cima: estado.cima, baixo: estado.baixo, valores: valores
      }));
    } catch (erro) { /* Modo privado ou sem espaço: o formulário segue funcionando */ }
  }

  function apagarSalvo() {
    try { localStorage.removeItem(CHAVE); } catch (erro) { /* nada a fazer */ }
  }

  function restaurar() {
    var salvo = null;
    try { salvo = JSON.parse(localStorage.getItem(CHAVE)); } catch (erro) { salvo = null; }
    if (!salvo || !salvo.valores) return null;
    if (Date.now() - (salvo.salvoEm || 0) > VALIDADE_DIAS * 864e5) { apagarSalvo(); return null; }
    Object.keys(salvo.valores).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && form.contains(el)) el.value = salvo.valores[id];
    });
    estado.cima = typeof salvo.cima === 'boolean' ? salvo.cima : null;
    estado.baixo = typeof salvo.baixo === 'boolean' ? salvo.baixo : null;
    atualizarDecisoes();
    return salvo;
  }

  form.addEventListener('input', salvar);
  form.addEventListener('change', salvar);
  window.addEventListener('pagehide', salvar);

  /* --- Validação ------------------------------------------------------------------- */

  function lerNumero(texto) {
    var limpo = String(texto).trim().replace(',', '.');
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpo)) return null;
    return Math.round(parseFloat(limpo) * 10) / 10;
  }
  function formatar(n) { return String(n).replace('.', ','); }

  function definirErro(id, mensagem) {
    var entrada = document.getElementById(id);
    var erro = document.getElementById(id + '-erro');
    if (erro) erro.textContent = mensagem || '';
    if (entrada) {
      if (mensagem) entrada.setAttribute('aria-invalid', 'true');
      else entrada.removeAttribute('aria-invalid');
    }
    return !mensagem;
  }

  function validarMedida(id, parar) {
    var m = porMedida[id];
    var texto = valor(id);
    var avisoEl = document.getElementById(id + '-aviso');
    if (!texto) return definirErro(id, 'Informe esta medida para continuar.');
    var n = lerNumero(texto);
    if (n === null || n <= 0) return definirErro(id, 'Use só números, como 38 ou 38,5.');
    definirErro(id, '');
    if (n < m.min || n > m.max) {
      // Todo corpo é um corpo: o valor incomum não bloqueia, só pede uma conferida
      if (parar && avisoConfirmado[id] !== texto) {
        avisoConfirmado[id] = texto;
        avisoEl.textContent = 'Esse valor parece fora do comum (' + m.min + ' a ' + m.max + ' ' + m.unidade + '). Confira e, se estiver certo, toque em Continuar.';
        return false;
      }
    } else {
      avisoEl.textContent = '';
    }
    return true;
  }

  function validarEtapa(id) {
    if (porMedida[id]) return validarMedida(id, true);
    if (id === 'nome') return definirErro(id, valor(id) ? '' : ETAPAS.nome.erro);
    if (id === 'cidade') return definirErro(id, valor(id) ? '' : ETAPAS.cidade.erro);
    if (id === 'telefone') {
      var d = valor(id).replace(/\D/g, '');
      return definirErro(id, d.length === 10 || d.length === 11 ? '' : ETAPAS.telefone.erro);
    }
    return true;
  }

  function primeiraPendente() {
    var seq = sequencia();
    for (var i = 0; i < seq.length; i++) {
      var id = seq[i];
      if (id === 'revisao') return null;
      if (id === 'cima' && estado.cima === null) return id;
      if (id === 'baixo' && estado.baixo === null) return id;
      if (porMedida[id] && !validarMedida(id, false)) return id;
      if ((id === 'nome' || id === 'cidade' || id === 'telefone') && !validarEtapa(id)) return id;
    }
    return null;
  }

  /* --- Navegação ------------------------------------------------------------------- */

  function atualizarDecisoes() {
    ['cima', 'baixo'].forEach(function (id) {
      form.querySelectorAll('[data-decisao="' + id + '"]').forEach(function (b) {
        var marcado = (estado[id] === true && b.getAttribute('data-valor') === 'sim') ||
          (estado[id] === false && b.getAttribute('data-valor') === 'nao');
        b.setAttribute('aria-pressed', String(marcado));
      });
    });
  }

  function atualizarProgresso(id) {
    var previsao = sequencia(true);
    var pos = previsao.indexOf(id);
    var fracao = previsao.length > 1 ? Math.max(pos, 0) / (previsao.length - 1) : 0;
    barra.style.setProperty('--p', Math.max(.03, fracao).toFixed(3));
    progresso.setAttribute('aria-valuenow', String(Math.round(fracao * 100)));
  }

  function rolarParaTopoDoForm() {
    var margem = (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--topo'), 10) || 84) + 16;
    var y = form.getBoundingClientRect().top;
    var estreita = window.matchMedia('(max-width: 1040px)').matches;
    // No celular o formulário sobe até o topo, para o teclado não cobrir o campo
    if (y < margem || y > window.innerHeight * .45 || (estreita && Math.abs(y - margem) > 1)) {
      window.scrollBy(0, y - margem);
    }
  }

  function mostrar(id, opcoes) {
    opcoes = opcoes || {};
    var seq = sequencia();
    if (seq.indexOf(id) === -1) id = 'nome';

    var anterior = atual;
    var direcao = anterior && seq.indexOf(id) < seq.indexOf(anterior) ? 'anima-tras' : 'anima-frente';
    atual = id;
    document.body.classList.toggle('etapa-avancada', id !== 'nome');

    form.querySelectorAll('.etapa').forEach(function (etapa) {
      var ativa = etapa.getAttribute('data-etapa') === id;
      etapa.hidden = !ativa;
      etapa.classList.remove('anima-frente', 'anima-tras');
      if (ativa && anterior) etapa.classList.add(direcao);
    });

    var tipo = ETAPAS[id] ? ETAPAS[id].tipo : 'medida';
    navEl.hidden = false;
    botaoVoltar.hidden = seq.indexOf(id) === 0;
    botaoContinuar.hidden = tipo === 'decisao' || tipo === 'revisao';
    botaoContinuar.textContent = voltarParaRevisao ? 'Salvar e revisar' : 'Continuar';

    if (id === 'revisao') montarRevisao();
    atualizarDecisoes();
    atualizarProgresso(id);
    mostrarNoPainel(porMedida[id] || null);
    salvar();

    if (opcoes.historico === 'novo') history.pushState({ etapa: id }, '');
    else if (opcoes.historico === 'trocar') history.replaceState({ etapa: id }, '');

    if (opcoes.foco !== false) {
      rolarParaTopoDoForm();
      var etapaEl = form.querySelector('.etapa[data-etapa="' + id + '"]');
      var alvo = etapaEl.querySelector('input, select, textarea') || etapaEl.querySelector('h2');
      if (tipo === 'preferencias' || tipo === 'revisao' || tipo === 'decisao') alvo = etapaEl.querySelector('h2');
      if (alvo) alvo.focus({ preventScroll: true });
    }
  }

  function avancar() {
    if (!validarEtapa(atual)) {
      var entrada = document.getElementById(atual);
      if (entrada) entrada.focus();
      return;
    }
    if (voltarParaRevisao) { voltarParaRevisao = false; mostrar('revisao', { historico: 'novo' }); return; }
    var seq = sequencia();
    mostrar(seq[seq.indexOf(atual) + 1], { historico: 'novo' });
  }

  botaoVoltar.addEventListener('click', function () {
    voltarParaRevisao = false;
    var seq = sequencia();
    var i = seq.indexOf(atual);
    if (i > 0) mostrar(seq[i - 1], { historico: 'novo' });
  });

  // Respostas de Sim e Não
  form.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-decisao]') : null;
    if (b) {
      var id = b.getAttribute('data-decisao');
      var sim = b.getAttribute('data-valor') === 'sim';
      var erro = document.getElementById(id + '-erro');
      erro.textContent = '';
      voltarParaRevisao = false;
      if (id === 'baixo' && !sim && estado.cima === false) {
        estado.baixo = false;
        atualizarDecisoes();
        erro.textContent = 'Escolha pelo menos uma das partes. Toque em Sim ou volte para a parte de cima.';
        salvar();
        return;
      }
      estado[id] = sim;
      atualizarDecisoes();
      var seq = sequencia();
      // Pequena pausa para a pessoa ver a escolha marcada
      setTimeout(function () { mostrar(seq[seq.indexOf(id) + 1], { historico: 'novo' }); }, 260);
      return;
    }

    var alterar = e.target.closest ? e.target.closest('[data-alterar]') : null;
    if (alterar) {
      voltarParaRevisao = true;
      mostrar(alterar.getAttribute('data-alterar'), { historico: 'novo' });
      return;
    }

    var recomecar = e.target.closest ? e.target.closest('[data-recomecar]') : null;
    if (recomecar) recomecarTudo();
  });

  document.querySelector('[data-recomecar-topo]').addEventListener('click', recomecarTudo);

  function recomecarTudo() {
    form.querySelectorAll('.etapa input, .etapa select, .etapa textarea').forEach(function (el) { el.value = ''; });
    form.querySelectorAll('.erro, .aviso').forEach(function (el) { el.textContent = ''; });
    estado.cima = null;
    estado.baixo = null;
    avisoConfirmado = {};
    voltarParaRevisao = false;
    confirmacao.hidden = true;
    aviso.hidden = true;
    apagarSalvo();
    mostrar('nome', { historico: 'novo' });
  }

  // O botão Voltar do celular anda entre as etapas e fecha a imagem ampliada
  window.addEventListener('popstate', function (e) {
    if (modal.open) modal.close();
    var id = e.state && e.state.etapa;
    if (id && id !== atual) mostrar(id, { foco: false });
  });

  /* --- Revisão ---------------------------------------------------------------------- */

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function itemRevisao(rotulo, texto, etapa, inteiro) {
    return '<div class="revisao-item' + (inteiro ? ' revisao-item-inteiro' : '') + '">' +
      '<dt class="revisao-rotulo">' + rotulo + '</dt>' +
      '<dd><span class="revisao-valor">' + escapar(texto) + '</span>' +
      '<button class="texto-botao" type="button" data-alterar="' + etapa + '" aria-label="Alterar ' + rotulo + '">Alterar</button></dd>' +
    '</div>';
  }

  function grupoRevisao(titulo, itens) {
    if (!itens) return '';
    return '<div class="revisao-grupo"><h3 class="titulo-s revisao-cab">' + titulo + '</h3><dl class="revisao-lista">' + itens + '</dl></div>';
  }

  function itensMedidas(lista) {
    return lista.map(function (m) {
      var n = lerNumero(valor(m.id));
      return itemRevisao(m.rotulo, (n === null ? valor(m.id) : formatar(n)) + ' ' + m.unidade, m.id);
    }).join('');
  }

  function dataBrasileira(iso) { return iso.split('-').reverse().join('/'); }

  function montarRevisao() {
    var prefs = '';
    if (valor('cor')) prefs += itemRevisao('Cor', valor('cor'), 'preferencias');
    if (valor('tecido')) prefs += itemRevisao('Tecido', valor('tecido'), 'preferencias');
    if (valor('caimento')) prefs += itemRevisao('Caimento', valor('caimento'), 'preferencias');
    if (valor('data_desejada')) prefs += itemRevisao('Preciso até', dataBrasileira(valor('data_desejada')), 'preferencias');
    if (valor('observacoes')) prefs += itemRevisao('Observações', valor('observacoes'), 'preferencias', true);

    var geral = itensMedidas(dados.geral);
    if (valor('tamanho')) geral += itemRevisao('Tamanho usual', valor('tamanho'), 'tamanho');

    document.getElementById('revisao-conteudo').innerHTML =
      grupoRevisao('Seus dados',
        itemRevisao('Nome', valor('nome'), 'nome') +
        itemRevisao('WhatsApp', valor('telefone'), 'telefone') +
        itemRevisao('Cidade', valor('cidade'), 'cidade')) +
      grupoRevisao('Sobre você', geral) +
      (estado.cima ? grupoRevisao('Parte de cima', itensMedidas(dados.cima)) : '') +
      (estado.baixo ? grupoRevisao('Parte de baixo', itensMedidas(dados.baixo)) : '') +
      grupoRevisao('Preferências', prefs);
  }

  /* --- Mensagem e envio --------------------------------------------------------------- */

  function linhasMedidas(lista) {
    return lista.map(function (m) {
      return m.rotulo + ': ' + formatar(lerNumero(valor(m.id))) + ' ' + m.unidade;
    });
  }

  function montarMensagem() {
    var l = ['*NOVAS MEDIDAS | ANDRE RAUBER*', ''];
    l.push('*Cliente*', 'Nome: ' + valor('nome'), 'WhatsApp: ' + valor('telefone'), 'Cidade/UF: ' + valor('cidade'), '');

    l.push('*Geral*');
    l = l.concat(linhasMedidas(dados.geral));
    if (valor('tamanho')) l.push('Tamanho que costuma usar: ' + valor('tamanho'));
    l.push('');

    if (estado.cima) l = l.concat(['*Parte de cima*'], linhasMedidas(dados.cima), ['']);
    if (estado.baixo) l = l.concat(['*Parte de baixo*'], linhasMedidas(dados.baixo), ['']);

    var prefs = [];
    if (valor('cor')) prefs.push('Cor: ' + valor('cor'));
    if (valor('tecido')) prefs.push('Tecido: ' + valor('tecido'));
    if (valor('caimento')) prefs.push('Caimento: ' + valor('caimento'));
    if (valor('data_desejada')) prefs.push('Preciso até: ' + dataBrasileira(valor('data_desejada')));
    if (valor('observacoes')) prefs.push('Observações: ' + valor('observacoes'));
    if (prefs.length) l = l.concat(['*Preferências*'], prefs);

    return l.join('\n').trim();
  }

  function salvarNoBanco() {
    if (!config.salvarNoBanco) return;
    var corpo = {
      nome: valor('nome'), telefone: valor('telefone'), cidade: valor('cidade'),
      parte_cima: estado.cima === true, parte_baixo: estado.baixo === true,
      tamanho: valor('tamanho'), cor: valor('cor'), tecido: valor('tecido'),
      caimento: valor('caimento'), data_desejada: valor('data_desejada'), observacoes: valor('observacoes'),
      website: form.elements.website.value,
      medidas: {}
    };
    dados.geral.concat(estado.cima ? dados.cima : [], estado.baixo ? dados.baixo : []).forEach(function (m) {
      corpo.medidas[m.id] = lerNumero(valor(m.id));
    });
    // Se o salvamento falhar, o cliente ainda envia pelo WhatsApp: nada se perde
    fetch(config.endereco, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).catch(function (erro) { console.warn('Não foi possível salvar no banco:', erro); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (atual !== 'revisao') { avancar(); return; }

    erroGeral.textContent = '';
    confirmacao.hidden = true;
    var pendente = primeiraPendente();
    if (pendente) { mostrar(pendente, { historico: 'novo' }); return; }
    if (estado.cima !== true && estado.baixo !== true) { mostrar('cima', { historico: 'novo' }); return; }

    var url = 'https://wa.me/' + config.whatsapp + '?text=' + encodeURIComponent(montarMensagem());
    linkReabrir.href = url;
    salvarNoBanco();

    // Abre na hora do clique, senão o navegador pode bloquear a nova aba.
    // O link da confirmação cobre os casos em que a aba não abrir.
    window.open(url, '_blank', 'noopener');
    confirmacao.hidden = false;
    confirmacao.scrollIntoView({ block: 'nearest' });
  });

  /* --- Figura: painel ao lado e imagem ampliada ------------------------------------------ */

  var painelBotao = document.getElementById('painel-ampliar');
  var painelFigura = document.getElementById('painel-figura');
  var painelTitulo = document.getElementById('painel-titulo');
  var painelTexto = document.getElementById('painel-texto');
  var modal = document.getElementById('modal-figura');

  function mostrarNoPainel(m) {
    var temDesenho = m && m.marca && (m.marca.l || m.marca.v);
    painelFigura.innerHTML = figura.desenhar(m);
    painelTitulo.textContent = m ? m.rotulo : 'Onde medir';
    painelTexto.textContent = m ? m.como : 'Nas etapas de medida, esta figura mostra onde passar a fita.';
    painelBotao.disabled = !temDesenho;
    if (temDesenho) {
      painelBotao.setAttribute('data-ampliar', m.id);
      painelBotao.setAttribute('aria-label', 'Ampliar a imagem de ' + m.rotulo);
    } else {
      painelBotao.removeAttribute('data-ampliar');
      painelBotao.removeAttribute('aria-label');
    }
  }

  function abrirModal(id) {
    var m = porMedida[id];
    if (!m) return;
    document.getElementById('modal-desenho').innerHTML = figura.desenhar(m, m.recorte);
    document.getElementById('modal-titulo').textContent = m.rotulo;
    document.getElementById('modal-como').textContent = m.como;
    document.getElementById('modal-erro').textContent = m.erro;
    modal.showModal();
    modal.scrollTop = 0;
    history.pushState({ etapa: atual, modal: true }, '');
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-ampliar]') : null;
    if (b && !b.disabled) abrirModal(b.getAttribute('data-ampliar'));
  });

  document.getElementById('modal-fechar').addEventListener('click', function () { modal.close(); });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
  modal.addEventListener('close', function () {
    if (history.state && history.state.modal) history.back();
    var entrada = document.getElementById(atual);
    if (entrada) entrada.focus({ preventScroll: true });
  });

  /* --- Início ------------------------------------------------------------------------------ */

  var salvo = restaurar();
  var inicial = 'nome';
  if (salvo) {
    if (sequencia().indexOf(salvo.etapa) !== -1) inicial = salvo.etapa;
    if (inicial !== 'nome' || valor('nome')) aviso.hidden = false;
  }
  mostrar(inicial, { foco: false, historico: 'trocar' });
})();
