/* Tabela de medidas: monta os campos, valida e prepara a mensagem de WhatsApp */
(function () {
  'use strict';

  var config = window.AR_CONFIG;
  var dados = window.AR_MEDIDAS;
  var figura = window.AR_FIGURA;
  var form = document.getElementById('form-medidas');
  if (!form) return;

  var TODAS = dados.geral.concat(dados.cima, dados.baixo);
  var porId = {};
  TODAS.forEach(function (m) { porId[m.id] = m; });

  var blocoCima = document.getElementById('bloco-cima');
  var blocoBaixo = document.getElementById('bloco-baixo');
  var escolhaCima = document.getElementById('escolha-cima');
  var escolhaBaixo = document.getElementById('escolha-baixo');
  var erroEscolha = document.getElementById('erro-partes');
  var erroGeral = document.getElementById('erro-geral');
  var confirmacao = document.getElementById('confirmacao');
  var linkReabrir = document.getElementById('reabrir-whatsapp');

  /* --- Montagem dos campos ------------------------------------------------- */

  function campoMedida(m) {
    return '<div class="campo medida" data-medida="' + m.id + '">' +
      '<label for="' + m.id + '">' + m.rotulo + '</label>' +
      '<div class="campo-entrada">' +
        '<input id="' + m.id + '" name="' + m.id + '" type="text" inputmode="decimal" autocomplete="off" ' +
          'placeholder="0" aria-describedby="' + m.id + '-ajuda ' + m.id + '-erro ' + m.id + '-aviso">' +
        '<span class="unidade" aria-hidden="true">' + m.unidade + '</span>' +
      '</div>' +
      '<p class="ajuda" id="' + m.id + '-ajuda">' + m.ajuda + '</p>' +
      '<p class="erro" id="' + m.id + '-erro"></p>' +
      '<p class="aviso" id="' + m.id + '-aviso"></p>' +
    '</div>';
  }

  function preencher(idLista, lista) {
    document.getElementById(idLista).innerHTML = lista.map(campoMedida).join('');
  }
  preencher('campos-geral-medidas', dados.geral);
  preencher('campos-cima', dados.cima);
  preencher('campos-baixo', dados.baixo);

  /* --- Figura ao lado do formulário ------------------------------------------ */

  var painelFigura = document.getElementById('painel-figura');
  var painelTitulo = document.getElementById('painel-titulo');
  var painelTexto = document.getElementById('painel-texto');
  var TEXTO_INICIAL = 'Clique em uma medida e veja aqui onde passar a fita.';

  function mostrarNoPainel(m) {
    if (!painelFigura) return;
    painelFigura.innerHTML = figura.desenhar(m);
    painelTitulo.textContent = m ? m.rotulo : 'Onde medir';
    painelTexto.textContent = m ? m.como : TEXTO_INICIAL;
  }
  mostrarNoPainel(null);

  form.addEventListener('focusin', function (e) {
    var campo = e.target.closest ? e.target.closest('.campo.medida') : null;
    form.querySelectorAll('.campo.medida.ativa').forEach(function (c) { c.classList.remove('ativa'); });
    if (campo) {
      campo.classList.add('ativa');
      mostrarNoPainel(porId[campo.getAttribute('data-medida')]);
    }
  });

  /* --- Parte de cima / parte de baixo --------------------------------------- */

  function atualizarPartes() {
    blocoCima.hidden = !escolhaCima.checked;
    blocoBaixo.hidden = !escolhaBaixo.checked;
    if (escolhaCima.checked || escolhaBaixo.checked) erroEscolha.textContent = '';
    numerarBlocos();
  }

  // Mantém 01, 02, 03... em sequência mesmo com blocos escondidos
  function numerarBlocos() {
    var n = 0;
    form.querySelectorAll('.bloco').forEach(function (bloco) {
      if (bloco.hidden) return;
      n += 1;
      var alvo = bloco.querySelector('.bloco-num');
      if (alvo) alvo.textContent = (n < 10 ? '0' : '') + n;
    });
  }

  escolhaCima.addEventListener('change', atualizarPartes);
  escolhaBaixo.addEventListener('change', atualizarPartes);
  atualizarPartes();

  /* --- Máscara de telefone e data mínima ------------------------------------- */

  var telefone = document.getElementById('telefone');
  telefone.addEventListener('input', function () {
    var d = telefone.value.replace(/\D/g, '').slice(0, 11);
    var saida = d;
    if (d.length > 2) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length > 10) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    else if (d.length > 6) saida = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    telefone.value = saida;
  });

  function hojeISO() {
    var h = new Date();
    return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  }
  document.getElementById('data_desejada').min = hojeISO();

  /* --- Validação ------------------------------------------------------------- */

  // Aceita 38,5 e 38.5. Devolve número com no máximo uma casa, ou null.
  function lerNumero(texto) {
    var limpo = String(texto).trim().replace(',', '.');
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpo)) return null;
    return Math.round(parseFloat(limpo) * 10) / 10;
  }

  function formatar(n) { return String(n).replace('.', ','); }

  function definirErro(campoEl, mensagem) {
    var entrada = campoEl.querySelector('input, select, textarea');
    var erro = campoEl.querySelector('.erro');
    campoEl.classList.toggle('invalido', Boolean(mensagem));
    if (erro) erro.textContent = mensagem || '';
    if (entrada) {
      if (mensagem) entrada.setAttribute('aria-invalid', 'true');
      else entrada.removeAttribute('aria-invalid');
    }
    return !mensagem;
  }

  function validarMedida(campoEl, obrigatorio) {
    var m = porId[campoEl.getAttribute('data-medida')];
    var entrada = campoEl.querySelector('input');
    var aviso = campoEl.querySelector('.aviso');
    var texto = entrada.value.trim();
    aviso.textContent = '';

    if (!texto) return definirErro(campoEl, obrigatorio ? 'Informe esta medida.' : '');

    var n = lerNumero(texto);
    if (n === null || n <= 0) return definirErro(campoEl, 'Use só números, como 38 ou 38,5.');

    // Medidas fora do comum não bloqueiam: todo corpo é um corpo. O site só pede para conferir.
    if (n < m.min || n > m.max) {
      aviso.textContent = 'Valor fora do comum (' + m.min + ' a ' + m.max + ' ' + m.unidade + '). Se estiver certo, pode manter.';
    }
    return definirErro(campoEl, '');
  }

  function validarTexto(id, mensagem, regra) {
    var entrada = document.getElementById(id);
    var valor = entrada.value.trim();
    return definirErro(entrada.closest('.campo'), !valor || (regra && !regra(valor)) ? mensagem : '');
  }

  function camposDeMedidaVisiveis() {
    return Array.prototype.filter.call(form.querySelectorAll('.campo.medida'), function (c) {
      return !c.closest('.bloco').hidden;
    });
  }

  function validarTudo() {
    var ok = true;
    ok = validarTexto('nome', 'Informe seu nome.') && ok;
    ok = validarTexto('telefone', 'Informe um WhatsApp com DDD.', function (v) {
      var d = v.replace(/\D/g, '');
      return d.length === 10 || d.length === 11;
    }) && ok;
    ok = validarTexto('cidade', 'Informe sua cidade e estado para o envio.') && ok;

    if (!escolhaCima.checked && !escolhaBaixo.checked) {
      erroEscolha.textContent = 'Escolha a parte de cima, a parte de baixo ou as duas.';
      ok = false;
    }

    camposDeMedidaVisiveis().forEach(function (c) { ok = validarMedida(c, true) && ok; });
    return ok;
  }

  form.addEventListener('focusout', function (e) {
    var campo = e.target.closest ? e.target.closest('.campo.medida') : null;
    if (campo && e.target.value.trim()) validarMedida(campo, false);
    else if (campo && campo.classList.contains('invalido')) validarMedida(campo, true);
  });

  /* --- Mensagem do WhatsApp -------------------------------------------------- */

  function valor(id) { return document.getElementById(id).value.trim(); }

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

    if (escolhaCima.checked) l = l.concat(['*Parte de cima*'], linhasMedidas(dados.cima), ['']);
    if (escolhaBaixo.checked) l = l.concat(['*Parte de baixo*'], linhasMedidas(dados.baixo), ['']);

    var prefs = [];
    if (valor('cor')) prefs.push('Cor: ' + valor('cor'));
    if (valor('tecido')) prefs.push('Tecido: ' + valor('tecido'));
    if (valor('caimento')) prefs.push('Caimento: ' + valor('caimento'));
    if (valor('data_desejada')) {
      prefs.push('Preciso até: ' + valor('data_desejada').split('-').reverse().join('/'));
    }
    if (valor('observacoes')) prefs.push('Observações: ' + valor('observacoes'));
    if (prefs.length) l = l.concat(['*Preferências*'], prefs);

    return l.join('\n').trim();
  }

  /* --- Banco de dados (desligado por padrão em config.js) --------------------- */

  function salvarNoBanco() {
    if (!config.salvarNoBanco) return;
    var corpo = {
      nome: valor('nome'),
      telefone: valor('telefone'),
      cidade: valor('cidade'),
      parte_cima: escolhaCima.checked,
      parte_baixo: escolhaBaixo.checked,
      tamanho: valor('tamanho'),
      cor: valor('cor'),
      tecido: valor('tecido'),
      caimento: valor('caimento'),
      data_desejada: valor('data_desejada'),
      observacoes: valor('observacoes'),
      website: form.elements.website.value,
      medidas: {}
    };
    camposDeMedidaVisiveis().forEach(function (c) {
      var id = c.getAttribute('data-medida');
      corpo.medidas[id] = lerNumero(valor(id));
    });
    // Se o salvamento falhar, o cliente ainda envia pelo WhatsApp: nada se perde
    fetch(config.endereco, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).catch(function (erro) { console.warn('Não foi possível salvar no banco:', erro); });
  }

  // O aviso de privacidade acompanha o que o site realmente faz
  var nota = document.getElementById('nota-privacidade');
  if (nota && config.salvarNoBanco) {
    nota.innerHTML = 'Suas medidas são enviadas pelo WhatsApp e guardadas com segurança para a confecção das suas peças. Veja a <a href="privacidade.html">política de privacidade</a>.';
  }

  /* --- Envio --------------------------------------------------------------------- */

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    erroGeral.textContent = '';
    confirmacao.hidden = true;

    if (!validarTudo()) {
      erroGeral.textContent = 'Faltam algumas informações. Confira os campos marcados.';
      var primeiro = form.querySelector('.campo.invalido input, .campo.invalido textarea');
      if (!escolhaCima.checked && !escolhaBaixo.checked && !primeiro) primeiro = escolhaCima;
      if (primeiro) primeiro.focus();
      return;
    }

    var url = 'https://wa.me/' + config.whatsapp + '?text=' + encodeURIComponent(montarMensagem());
    linkReabrir.href = url;
    salvarNoBanco();

    // Abre na hora do clique, senão o navegador pode bloquear a nova aba.
    // O link da confirmação cobre os casos em que a aba não abrir.
    window.open(url, '_blank', 'noopener');
    confirmacao.hidden = false;
    confirmacao.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
})();
