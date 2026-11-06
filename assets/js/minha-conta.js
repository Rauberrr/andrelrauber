/* Minha conta: mostra o andamento e os dados da pessoa */
(function () {
  'use strict';

  var api = window.AR_API;
  var dados = window.AR_MEDIDAS;
  var AUTH = 'api/auth.php?acao=';

  function el(id) { return document.getElementById(id); }

  function formatar(n) { return String(parseFloat(n)).replace('.', ','); }

  // Sempre como texto, nunca como HTML, para nada digitado virar código na página
  function grupo(titulo, itens) {
    var preenchidos = itens.filter(function (i) { return i[1]; });
    if (!preenchidos.length) return null;
    var secao = document.createElement('section');
    secao.className = 'revisao-grupo';
    var h = document.createElement('h2');
    h.className = 'titulo-s revisao-cab';
    h.textContent = titulo;
    var dl = document.createElement('dl');
    dl.className = 'revisao-lista';
    preenchidos.forEach(function (i) {
      var linha = document.createElement('div');
      linha.className = 'revisao-item';
      var dt = document.createElement('dt');
      dt.className = 'revisao-rotulo';
      dt.textContent = i[0];
      var dd = document.createElement('dd');
      dd.className = 'revisao-valor';
      dd.textContent = i[1];
      linha.appendChild(dt);
      linha.appendChild(dd);
      dl.appendChild(linha);
    });
    secao.appendChild(h);
    secao.appendChild(dl);
    return secao;
  }

  function medidas(lista, c) {
    return lista.map(function (m) {
      var v = c[m.id];
      return [m.rotulo, v === null || v === undefined ? '' : formatar(v) + ' ' + m.unidade];
    });
  }

  function mostrar(u, c) {
    var primeiro = (u.nome || '').split(' ')[0];
    el('conta-ola').textContent = primeiro ? 'Olá, ' + primeiro + '.' : 'Olá.';

    var progresso = Number(c.progresso) || 0;
    el('conta-barra').style.setProperty('--p', Math.max(.03, progresso / 100));
    el('conta-progresso').setAttribute('aria-valuenow', String(progresso));

    var acao = el('conta-acao');
    if (c.concluido_em) {
      el('conta-status-titulo').textContent = 'Cadastro concluído';
      el('conta-status-texto').textContent = 'Recebemos suas informações, e você não precisa enviar nenhuma mensagem. Entraremos em contato pelo seu telefone.';
      acao.textContent = 'Alterar minhas informações';
      acao.href = 'medidas.html?revisar=1';
    } else if (c.etapa_atual) {
      el('conta-status-titulo').textContent = 'Seu cadastro está em ' + progresso + '%';
      el('conta-status-texto').textContent = 'Falta pouco. Suas respostas estão salvas, e você continua de onde parou.';
      acao.textContent = 'Continuar de onde parei';
    } else {
      el('conta-status-titulo').textContent = 'Vamos preencher suas medidas?';
      el('conta-status-texto').textContent = 'Uma informação de cada vez, sem precisar mandar mensagem. Tudo fica salvo.';
      acao.textContent = 'Começar';
    }

    var endereco = '';
    if (c.logradouro) {
      endereco = c.logradouro + (c.numero ? ', ' + c.numero : '') + (c.complemento ? ' (' + c.complemento + ')' : '') +
        (c.bairro ? ' · ' + c.bairro : '') + (c.cidade ? ' · ' + c.cidade : '') + (c.uf ? '/' + c.uf : '');
    }
    var caixa = el('conta-dados');
    [
      grupo('Seus dados', [
        ['Nome', u.nome], ['E-mail', u.email], ['Telefone', api.mascaraTelefone(u.telefone || '')],
        ['CEP', api.mascaraCep(c.cep || '')], ['Endereço', endereco]
      ]),
      grupo('Sobre você', medidas(dados.geral, c).concat([['Tamanho usual', c.tamanho]])),
      Number(c.parte_cima) === 1 ? grupo('Parte de cima', medidas(dados.cima, c)) : null,
      Number(c.parte_baixo) === 1 ? grupo('Parte de baixo', medidas(dados.baixo, c)) : null,
      grupo('Preferências', [
        ['Cor', c.cor], ['Tecido', c.tecido], ['Caimento', c.caimento],
        ['Preciso até', c.data_desejada ? c.data_desejada.split('-').reverse().join('/') : ''],
        ['Observações', c.observacoes]
      ])
    ].forEach(function (s) { if (s) caixa.appendChild(s); });

    if (!u.emailVerificado) {
      el('conta-email-endereco').textContent = u.email;
      el('conta-email').hidden = false;
    }

    el('conta-painel').hidden = !u.admin;
    el('conta-senha').hidden = !u.temSenha;
    el('carregando').hidden = true;
    el('conta-conteudo').hidden = false;
  }

  el('conta-email-reenviar').addEventListener('click', function () {
    var botao = el('conta-email-reenviar');
    botao.disabled = true;
    api.post(AUTH + 'reenviar-confirmacao').then(function (r) {
      el('conta-email-aviso').textContent = r.ok
        ? 'Enviamos um novo link. Se não chegar, confira a caixa de spam.'
        : (r.erro || 'Não foi possível enviar agora. Tente de novo mais tarde.');
      botao.disabled = !r.ok;
    });
  });

  el('conta-sair').addEventListener('click', function () {
    api.post(AUTH + 'sair').then(function () { location.replace('index.html'); });
  });

  el('conta-excluir').addEventListener('click', function () {
    var confirmacao = el('excluir-confirmacao').value.trim();
    if (confirmacao !== 'EXCLUIR') {
      el('excluir-erro').textContent = 'Digite EXCLUIR para confirmar.';
      return;
    }
    api.post(AUTH + 'excluir', { confirmacao: confirmacao }).then(function (r) {
      if (r.ok) { location.replace('index.html'); return; }
      el('excluir-erro').textContent = r.erro;
    });
  });

  api.get('api/perfil.php').then(function (r) {
    if (r.status === 401) { api.irParaLogin('minha-conta.html'); return; }
    if (!r.ok) {
      el('carregando').textContent = 'Não foi possível carregar sua conta. Tente novamente em instantes.';
      return;
    }
    mostrar(r.dados.usuario, r.dados.cadastro);
  });
})();
