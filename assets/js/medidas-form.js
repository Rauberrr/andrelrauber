/* Tabela de medidas em passo a passo: cada resposta é salva na conta da pessoa */
(function () {
  'use strict';

  var api = window.AR_API;
  var dados = window.AR_MEDIDAS;
  var figura = window.AR_FIGURA;
  var form = document.getElementById('form-medidas');
  if (!form) return;

  var PERFIL = 'api/perfil.php';
  var ESTADOS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  var ENDERECO = ['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'];

  var porMedida = {};
  dados.geral.concat(dados.cima, dados.baixo).forEach(function (m) { porMedida[m.id] = m; });

  var estado = { cima: null, baixo: null };
  var precisaConsentir = false;
  var mostrarNome = false;
  var mostrarTelefone = false;
  var jaConcluido = false;
  var atual = null;
  var voltarParaRevisao = false;
  var avisoConfirmado = {};

  /* --- As etapas ------------------------------------------------------------- */

  var ETAPAS = {
    consentimento: { grupo: 'Antes de começar', titulo: 'Sua privacidade.', tipo: 'consentimento' },
    nome: { grupo: 'Seus dados', titulo: 'Qual é o seu nome?', tipo: 'texto', auto: 'name', max: 120, erro: 'Informe seu nome.' },
    telefone: {
      grupo: 'Seus dados', titulo: 'Qual é o seu telefone?', desc: 'Com DDD. É por ele que confirmamos os detalhes da peça e combinamos a entrega.',
      tipo: 'tel', auto: 'tel-national', dica: '(54) 99999-9999', erro: 'Informe seu telefone com DDD.'
    },
    cep: {
      grupo: 'Endereço', titulo: 'Qual é o seu CEP?', desc: 'O envio é feito pelos Correios. Com o CEP, preenchemos o restante do endereço para você.',
      tipo: 'tel', auto: 'postal-code', dica: '00000-000', erro: 'Informe os 8 dígitos do CEP.'
    },
    endereco: { grupo: 'Endereço', titulo: 'Confira seu endereço.', tipo: 'endereco' },
    tamanho: {
      grupo: 'Sobre você', titulo: 'Qual tamanho você costuma usar?', desc: 'Opcional. Ajuda a entender o seu ponto de partida.',
      tipo: 'texto', max: 60, dica: 'Camisa M, calça 42', opcional: true
    },
    preferencias: { grupo: 'Preferências', titulo: 'Tem alguma preferência?', desc: 'Tudo opcional. Se ainda não souber, decidimos juntos depois.', tipo: 'preferencias' },
    cima: { grupo: 'Parte de cima', titulo: 'Quer fazer uma peça de cima?', desc: 'Camisa, camiseta ou blazer.', tipo: 'decisao' },
    baixo: { grupo: 'Parte de baixo', titulo: 'Quer fazer uma peça de baixo?', desc: 'Calça.', tipo: 'decisao' },
    revisao: { grupo: 'Quase lá', titulo: 'Confira e conclua.', desc: 'Não precisa mandar mensagem: ao concluir, tudo chega direto para nós.', tipo: 'revisao' }
  };

  function ids(lista) { return lista.map(function (m) { return m.id; }); }

  function sequencia(prever) {
    var s = [];
    if (precisaConsentir) s.push('consentimento');
    if (mostrarNome) s.push('nome');
    if (mostrarTelefone) s.push('telefone');
    s = s.concat(['cep', 'endereco'], ids(dados.geral), ['tamanho', 'preferencias', 'cima']);
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
  var statusSalvo = document.getElementById('status-salvo');
  var carregando = document.getElementById('carregando');

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

  function campoSimples(id, rotulo, classe, extra) {
    return '<div class="campo ' + (classe || '') + '"><label for="' + id + '">' + rotulo + '</label>' +
      '<div class="campo-entrada"><input id="' + id + '" name="' + id + '" type="text" ' + (extra || '') + ' aria-describedby="' + id + '-erro"></div>' +
      '<p class="erro" id="' + id + '-erro" role="alert"></p></div>';
  }

  function etapaConsentimento(e) {
    return cabecalho('', e.grupo, e.titulo, '', false) +
      '<div class="etapa-corpo">' +
        '<p class="etapa-desc">Para fazer a sua peça, guardamos seu telefone, endereço e medidas na sua conta. Cada resposta é salva assim que você a preenche, mesmo que não conclua, e registramos até onde você chegou.</p>' +
        '<label class="campo-marcar"><input id="consentimento" type="checkbox"> <span>Li e concordo com a <a href="privacidade.html">política de privacidade</a>.</span></label>' +
        '<p class="erro" id="consentimento-erro" role="alert"></p>' +
      '</div>';
  }

  function etapaEndereco(e) {
    var opcoes = '<option value="">UF</option>' + ESTADOS.map(function (uf) { return '<option>' + uf + '</option>'; }).join('');
    return cabecalho('', e.grupo, e.titulo, '', false) +
      '<div class="etapa-corpo campos">' +
        campoSimples('logradouro', 'Rua ou avenida', 'campo-inteiro', 'maxlength="160" autocomplete="address-line1"') +
        campoSimples('numero', 'Número', '', 'maxlength="20" inputmode="text"') +
        campoSimples('complemento', 'Complemento <span class="opcional">(opcional)</span>', '', 'maxlength="80" autocomplete="address-line2"') +
        campoSimples('bairro', 'Bairro', 'campo-inteiro', 'maxlength="80"') +
        campoSimples('cidade', 'Cidade', '', 'maxlength="80" autocomplete="address-level2"') +
        '<div class="campo"><label for="uf">Estado</label><div class="campo-entrada"><select id="uf" name="uf" autocomplete="address-level1" aria-describedby="uf-erro">' + opcoes + '</select></div>' +
        '<p class="erro" id="uf-erro" role="alert"></p></div>' +
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
          '<button class="botao botao-cheio" id="botao-concluir" type="submit">Concluir cadastro</button>' +
          '<p class="envio-nota">Você pode voltar à sua conta para alterar as informações quando quiser.</p>' +
          '<div class="confirmacao" id="confirmacao" role="status" tabindex="-1" hidden>' +
            '<h3 class="titulo-s">Cadastro concluído.</h3>' +
            '<p>Recebemos suas informações, e você não precisa enviar nenhuma mensagem. Entraremos em contato pelo seu telefone para falar sobre a peça.</p>' +
            '<div class="confirmacao-acoes"><a class="link-seta" href="minha-conta.html">Ir para minha conta <span aria-hidden="true">→</span></a></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function montar() {
    var html = '';
    function adicionar(id, conteudo) {
      html += '<section class="etapa" data-etapa="' + id + '" hidden>' + conteudo + '</section>';
    }
    adicionar('consentimento', etapaConsentimento(ETAPAS.consentimento));
    ['nome', 'telefone', 'cep'].forEach(function (id) { adicionar(id, etapaTexto(id, ETAPAS[id])); });
    adicionar('endereco', etapaEndereco(ETAPAS.endereco));
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
  var cep = document.getElementById('cep');
  var confirmacao = document.getElementById('confirmacao');
  var erroGeral = document.getElementById('erro-geral');
  var botaoConcluir = document.getElementById('botao-concluir');

  document.getElementById('data_desejada').min = (function () {
    var h = new Date();
    return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  })();

  telefone.addEventListener('input', function () { telefone.value = api.mascaraTelefone(telefone.value); });

  /* --- CEP: busca o endereço e preenche o que estiver vazio ------------------------ */

  var cepBuscado = '';
  cep.addEventListener('input', function () {
    cep.value = api.mascaraCep(cep.value);
    buscarCep();
  });

  function buscarCep() {
    var numeros = cep.value.replace(/\D/g, '');
    if (numeros.length !== 8 || numeros === cepBuscado) return;
    cepBuscado = numeros;
    fetch('https://viacep.com.br/ws/' + numeros + '/json/', { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || d.erro) return;
        [['logradouro', d.logradouro], ['bairro', d.bairro], ['cidade', d.localidade], ['uf', d.uf]].forEach(function (par) {
          var el = document.getElementById(par[0]);
          if (el && par[1]) {
            el.value = par[1];
            marcar(par[0]);
          }
        });
        agendarSalvamento();
      })
      .catch(function () { /* Sem a busca, a pessoa preenche o endereço à mão */ });
  }

  /* --- Salvar no servidor -------------------------------------------------------------- */

  var pendentes = {};
  var etapaSalva = null;
  var temporizador = null;
  var enviando = false;
  var reenviar = false;

  function lerNumero(texto) {
    var limpo = String(texto).trim().replace(',', '.');
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(limpo)) return null;
    return Math.round(parseFloat(limpo) * 10) / 10;
  }
  function formatar(n) { return String(n).replace('.', ','); }

  function valor(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function marcar(id) {
    var el = document.getElementById(id);
    if (!el || id === 'consentimento' || !form.contains(el)) return;
    if (porMedida[id]) {
      var texto = el.value.trim();
      if (!texto) { pendentes[id] = null; return; }
      var n = lerNumero(texto);
      // Enquanto o número está incompleto ("38,"), espera a pessoa terminar
      if (n !== null && n > 0) pendentes[id] = n;
      return;
    }
    pendentes[id] = el.value.trim();
  }

  function definirStatus(texto, falhou) {
    statusSalvo.textContent = texto;
    statusSalvo.classList.toggle('status-falhou', Boolean(falhou));
  }

  function agendarSalvamento() {
    clearTimeout(temporizador);
    temporizador = setTimeout(salvar, 700);
  }

  function salvar(opcoes) {
    clearTimeout(temporizador);
    if (enviando) { reenviar = true; return enviando; }
    var campos = pendentes;
    var temCampos = Object.keys(campos).length > 0;
    if (!temCampos && etapaSalva === atual) return Promise.resolve(true);

    pendentes = {};
    var etapaEnviada = atual;
    definirStatus('Salvando...');
    enviando = api.post(PERFIL + '?acao=salvar', { etapa: etapaEnviada, campos: campos }, opcoes).then(function (r) {
      enviando = false;
      if (r.status === 401) { api.irParaLogin('medidas.html'); return false; }
      if (!r.ok) {
        // Devolve o que não foi salvo, sem cobrir o que a pessoa digitou depois
        Object.keys(campos).forEach(function (k) {
          if (!Object.prototype.hasOwnProperty.call(pendentes, k)) pendentes[k] = campos[k];
        });
        definirStatus('Não foi possível salvar. Vamos tentar de novo.', true);
        clearTimeout(temporizador);
        temporizador = setTimeout(salvar, 6000);
        return false;
      }
      etapaSalva = etapaEnviada;
      definirStatus('Salvo na sua conta');
      if (reenviar) { reenviar = false; return salvar(); }
      return true;
    });
    return enviando;
  }

  form.addEventListener('input', function (e) {
    if (!e.target.id) return;
    marcar(e.target.id);
    agendarSalvamento();
  });
  form.addEventListener('change', function (e) {
    if (e.target.tagName === 'SELECT' || e.target.type === 'date') {
      marcar(e.target.id);
      salvar();
    }
  });
  // Sair da página (ir ao guia, fechar a aba) não perde o que acabou de ser digitado
  window.addEventListener('pagehide', function () {
    if (Object.keys(pendentes).length) salvar({ keepalive: true });
  });

  /* --- Validação ------------------------------------------------------------------- */

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
    if (id === 'consentimento') {
      return definirErro(id, document.getElementById(id).checked ? '' : 'É preciso concordar para continuar.');
    }
    if (id === 'nome') return definirErro(id, valor(id).length >= 2 ? '' : ETAPAS.nome.erro);
    if (id === 'telefone') {
      var d = valor(id).replace(/\D/g, '');
      return definirErro(id, d.length === 10 || d.length === 11 ? '' : ETAPAS.telefone.erro);
    }
    if (id === 'cep') return definirErro(id, valor(id).replace(/\D/g, '').length === 8 ? '' : ETAPAS.cep.erro);
    if (id === 'endereco') {
      var ok = true;
      [['logradouro', 'Informe a rua ou avenida.'], ['numero', 'Informe o número (ou "s/n").'], ['bairro', 'Informe o bairro.'], ['cidade', 'Informe a cidade.'], ['uf', 'Escolha o estado.']].forEach(function (par) {
        ok = definirErro(par[0], valor(par[0]) ? '' : par[1]) && ok;
      });
      return ok;
    }
    return true;
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
    if (seq.indexOf(id) === -1) id = seq[0];

    var anterior = atual;
    var direcao = anterior && seq.indexOf(id) < seq.indexOf(anterior) ? 'anima-tras' : 'anima-frente';
    atual = id;
    if (anterior) aviso.hidden = true;
    document.body.classList.toggle('etapa-avancada', id !== seq[0]);

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

    if (id === 'revisao') {
      montarRevisao();
      botaoConcluir.textContent = jaConcluido ? 'Salvar alterações' : 'Concluir cadastro';
      confirmacao.hidden = true;
      erroGeral.textContent = '';
    }
    if (id === 'endereco') buscarCep();
    atualizarDecisoes();
    atualizarProgresso(id);
    mostrarNoPainel(porMedida[id] || null);
    if (opcoes.salvar !== false) salvar();

    if (opcoes.historico === 'novo') history.pushState({ etapa: id }, '');
    else if (opcoes.historico === 'trocar') history.replaceState({ etapa: id }, '');

    if (opcoes.foco !== false) {
      rolarParaTopoDoForm();
      var etapaEl = form.querySelector('.etapa[data-etapa="' + id + '"]');
      var alvo = (tipo === 'preferencias' || tipo === 'revisao' || tipo === 'decisao' || tipo === 'consentimento')
        ? etapaEl.querySelector('h2')
        : etapaEl.querySelector('input, select, textarea');
      // Com a rua preenchida pelo CEP, o que falta primeiro é o número
      if (id === 'endereco' && valor('logradouro')) alvo = document.getElementById('numero');
      if (alvo) alvo.focus({ preventScroll: true });
    }
  }

  function camposDaEtapa(id) {
    if (id === 'endereco') return ENDERECO;
    if (id === 'preferencias') return ['cor', 'tecido', 'caimento', 'data_desejada', 'observacoes'];
    return [id];
  }

  function avancar() {
    if (!validarEtapa(atual)) {
      var entrada = document.querySelector('.etapa:not([hidden]) [aria-invalid="true"]') || document.getElementById(atual);
      if (entrada) entrada.focus();
      return;
    }
    camposDaEtapa(atual).forEach(marcar);

    if (atual === 'consentimento') {
      pendentes.consentimento = true;
      var seqAntes = sequencia();
      var seguinte = seqAntes[seqAntes.indexOf(atual) + 1];
      salvar().then(function (ok) {
        if (ok === false) { definirErro('consentimento', 'Não foi possível salvar. Tente de novo.'); return; }
        precisaConsentir = false;
        mostrar(seguinte, { historico: 'novo' });
      });
      return;
    }

    if (voltarParaRevisao) { voltarParaRevisao = false; mostrar('revisao', { historico: 'novo' }); return; }
    var seq = sequencia();
    mostrar(seq[seq.indexOf(atual) + 1], { historico: 'novo' });
  }

  botaoVoltar.addEventListener('click', function () {
    voltarParaRevisao = false;
    camposDaEtapa(atual).forEach(marcar);
    var seq = sequencia();
    var i = seq.indexOf(atual);
    if (i > 0) mostrar(seq[i - 1], { historico: 'novo' });
  });

  form.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-decisao]') : null;
    if (b) {
      var id = b.getAttribute('data-decisao');
      var sim = b.getAttribute('data-valor') === 'sim';
      var erro = document.getElementById(id + '-erro');
      var campo = id === 'cima' ? 'parte_cima' : 'parte_baixo';
      erro.textContent = '';
      voltarParaRevisao = false;
      estado[id] = sim;
      pendentes[campo] = sim;
      atualizarDecisoes();
      if (id === 'baixo' && !sim && estado.cima === false) {
        erro.textContent = 'Escolha pelo menos uma das partes. Toque em Sim ou volte para a parte de cima.';
        salvar();
        return;
      }
      var seq = sequencia();
      // Pequena pausa para a pessoa ver a escolha marcada
      setTimeout(function () { mostrar(seq[seq.indexOf(id) + 1], { historico: 'novo' }); }, 260);
      return;
    }

    var alterar = e.target.closest ? e.target.closest('[data-alterar]') : null;
    if (alterar) {
      var alvo = alterar.getAttribute('data-alterar');
      if (alvo === 'nome') mostrarNome = true;
      if (alvo === 'telefone') mostrarTelefone = true;
      voltarParaRevisao = true;
      mostrar(alvo, { historico: 'novo' });
    }
  });

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

  function textoEndereco() {
    var linha = valor('logradouro') + (valor('numero') ? ', ' + valor('numero') : '');
    if (valor('complemento')) linha += ' (' + valor('complemento') + ')';
    return linha + ' · ' + valor('bairro') + ' · ' + valor('cidade') + '/' + valor('uf');
  }

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
        itemRevisao('Telefone', valor('telefone'), 'telefone') +
        itemRevisao('CEP', valor('cep'), 'cep') +
        itemRevisao('Endereço', textoEndereco(), 'endereco', true)) +
      grupoRevisao('Sobre você', geral) +
      (estado.cima ? grupoRevisao('Parte de cima', itensMedidas(dados.cima)) : '') +
      (estado.baixo ? grupoRevisao('Parte de baixo', itensMedidas(dados.baixo)) : '') +
      grupoRevisao('Preferências', prefs);
  }

  /* --- Concluir ------------------------------------------------------------------------- */

  var ETAPA_DO_CAMPO = {
    logradouro: 'endereco', numero: 'endereco', bairro: 'endereco', cidade: 'endereco', uf: 'endereco',
    parte_cima: 'cima', parte_baixo: 'baixo'
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (atual !== 'revisao') { avancar(); return; }

    erroGeral.textContent = '';
    confirmacao.hidden = true;
    botaoConcluir.disabled = true;

    Promise.resolve(salvar()).then(function () {
      return api.post(PERFIL + '?acao=concluir', {});
    }).then(function (r) {
      botaoConcluir.disabled = false;
      if (r.status === 401) { api.irParaLogin('medidas.html'); return; }
      if (r.ok) {
        jaConcluido = true;
        botaoConcluir.textContent = 'Salvar alterações';
        confirmacao.hidden = false;
        confirmacao.focus({ preventScroll: true });
        confirmacao.scrollIntoView({ block: 'nearest' });
        return;
      }
      var pendente = (r.dados.pendentes || [])[0];
      if (pendente) {
        if (pendente === 'nome') mostrarNome = true;
        if (pendente === 'telefone') mostrarTelefone = true;
        mostrar(ETAPA_DO_CAMPO[pendente] || pendente, { historico: 'novo' });
        return;
      }
      erroGeral.textContent = r.erro;
    });
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

  /* --- Início: busca o que já foi preenchido -------------------------------------------- */

  function preencher(usuario, cadastro) {
    document.getElementById('nome').value = usuario.nome || '';
    telefone.value = api.mascaraTelefone(usuario.telefone || '');
    cep.value = api.mascaraCep(cadastro.cep || '');
    cepBuscado = (cadastro.cep || '').length === 8 ? cadastro.cep : '';

    ['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'tamanho', 'cor', 'tecido', 'caimento', 'observacoes'].forEach(function (id) {
      document.getElementById(id).value = cadastro[id] || '';
    });
    document.getElementById('data_desejada').value = cadastro.data_desejada || '';
    Object.keys(porMedida).forEach(function (id) {
      var v = cadastro[id];
      document.getElementById(id).value = v === null || v === undefined ? '' : formatar(parseFloat(v));
    });

    function sn(v) { return v === null || v === undefined ? null : Number(v) === 1; }
    estado.cima = sn(cadastro.parte_cima);
    estado.baixo = sn(cadastro.parte_baixo);
    precisaConsentir = !usuario.consentiu;
    mostrarNome = String(usuario.nome || '').length < 2;
    var d = String(usuario.telefone || '');
    mostrarTelefone = d.length !== 10 && d.length !== 11;
    jaConcluido = Boolean(cadastro.concluido_em);
    etapaSalva = cadastro.etapa_atual || null;
  }

  function erroAoCarregar(mensagem) {
    carregando.textContent = mensagem;
    carregando.hidden = false;
  }

  try { localStorage.removeItem('ar-medidas-v1'); } catch (erro) { /* nada a fazer */ }

  api.get(PERFIL).then(function (r) {
    if (r.status === 401) { api.irParaLogin('medidas.html'); return; }
    if (!r.ok) {
      erroAoCarregar('Não foi possível carregar seu cadastro. Tente novamente em instantes.');
      return;
    }
    preencher(r.dados.usuario, r.dados.cadastro);
    carregando.hidden = true;
    form.hidden = false;
    document.getElementById('painel').hidden = false;

    var seq = sequencia();
    var salva = r.dados.cadastro.etapa_atual;
    var pedeRevisao = new URLSearchParams(location.search).get('revisar') === '1' && jaConcluido;
    var inicial = seq[0];
    if (pedeRevisao) inicial = 'revisao';
    else if (salva && seq.indexOf(salva) !== -1 && !precisaConsentir) inicial = salva;

    if (inicial !== seq[0] && !pedeRevisao) aviso.hidden = false;
    mostrar(inicial, { foco: false, historico: 'trocar' });
  }).catch(function (erro) {
    console.error(erro);
    form.hidden = true;
    erroAoCarregar('Não foi possível abrir a tabela. Atualize a página e, se continuar, fale conosco pelo WhatsApp.');
  });
})();
