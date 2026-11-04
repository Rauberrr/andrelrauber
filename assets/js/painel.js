/* Painel de clientes: quem se cadastrou, até onde foi e o que respondeu.
   Tudo que veio de um cliente é escrito como texto, nunca como HTML: assim,
   ninguém consegue executar código no painel digitando algo no próprio nome. */
(function () {
  'use strict';

  var api = window.AR_API;
  var dados = window.AR_MEDIDAS;
  var ROTULOS = window.AR_ETAPAS_ROTULOS;
  var ENDERECO = 'api/painel.php';
  var pessoas = [];

  var SITUACOES = { nao_comecou: 'Não começou', andamento: 'Parou no meio', concluido: 'Concluído' };
  var EVENTOS = {
    conta_criada: 'Criou a conta', login: 'Entrou na conta', etapa: 'Chegou na etapa', respostas: 'Salvou respostas',
    concluido: 'Concluiu o cadastro', atualizado: 'Alterou o cadastro concluído', senha_pedida: 'Pediu para redefinir a senha',
    senha_redefinida: 'Redefiniu a senha', google_vinculado: 'Vinculou a conta ao Google'
  };

  function $(id) { return document.getElementById(id); }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  function situacao(p) {
    if (p.concluido_em) return 'concluido';
    return p.etapa_atual ? 'andamento' : 'nao_comecou';
  }

  function dataHora(texto) {
    if (!texto) return '';
    var d = new Date(texto.replace(' ', 'T'));
    if (isNaN(d)) return texto;
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function haQuanto(texto) {
    if (!texto) return '';
    var d = new Date(texto.replace(' ', 'T'));
    if (isNaN(d)) return '';
    var dias = Math.floor((Date.now() - d.getTime()) / 864e5);
    if (dias <= 0) return 'hoje';
    return dias === 1 ? 'há 1 dia' : 'há ' + dias + ' dias';
  }

  function linkWhatsapp(telefone) {
    var d = String(telefone || '').replace(/\D/g, '');
    if (d.length !== 10 && d.length !== 11) return null;
    var a = criar('a', '', api.mascaraTelefone(d));
    a.href = 'https://wa.me/55' + d;
    a.target = '_blank';
    a.rel = 'noopener';
    return a;
  }

  /* --- Lista -------------------------------------------------------------------- */

  function numeros() {
    var caixa = $('painel-numeros');
    caixa.textContent = '';
    var cont = { nao_comecou: 0, andamento: 0, concluido: 0 };
    pessoas.forEach(function (p) { cont[situacao(p)] += 1; });
    [['Contas', pessoas.length], ['Não começaram', cont.nao_comecou], ['Pararam no meio', cont.andamento], ['Concluíram', cont.concluido]].forEach(function (par) {
      var bloco = criar('div', 'painel-numero');
      bloco.appendChild(criar('dd', 'titulo-l', String(par[1])));
      bloco.appendChild(criar('dt', 'etiqueta', par[0]));
      caixa.appendChild(bloco);
    });
  }

  function desenhar() {
    var busca = $('busca').value.trim().toLowerCase();
    var filtro = $('filtro').value;
    var corpo = $('painel-linhas');
    corpo.textContent = '';

    var lista = pessoas.filter(function (p) {
      if (filtro && situacao(p) !== filtro) return false;
      if (!busca) return true;
      return [p.nome, p.email, p.telefone, p.cidade].join(' ').toLowerCase().indexOf(busca) !== -1;
    });

    lista.forEach(function (p) {
      var linha = document.createElement('tr');

      var celula = document.createElement('td');
      var botao = criar('button', 'texto-botao', p.nome || p.email);
      botao.type = 'button';
      botao.addEventListener('click', function () { abrir(p.id); });
      celula.appendChild(botao);
      celula.appendChild(criar('small', 'painel-suave', p.email));
      linha.appendChild(celula);

      var tel = document.createElement('td');
      var link = linkWhatsapp(p.telefone);
      tel.appendChild(link || document.createTextNode('Sem telefone'));
      linha.appendChild(tel);

      var sit = situacao(p);
      var cSit = document.createElement('td');
      cSit.appendChild(criar('span', 'painel-selo painel-selo-' + sit, SITUACOES[sit] + (sit === 'andamento' ? ' · ' + p.progresso + '%' : '')));
      linha.appendChild(cSit);

      linha.appendChild(criar('td', '', sit === 'concluido' ? '' : (ROTULOS[p.etapa_atual] || p.etapa_atual || '')));

      var atividade = p.atualizado_em || p.ultimo_acesso_em || p.criado_em;
      linha.appendChild(criar('td', '', haQuanto(atividade) + ' · ' + dataHora(atividade)));
      corpo.appendChild(linha);
    });

    $('painel-vazio').hidden = lista.length > 0;
  }

  $('busca').addEventListener('input', desenhar);
  $('filtro').addEventListener('change', desenhar);

  /* --- Detalhes de uma pessoa ------------------------------------------------------ */

  function bloco(titulo, itens) {
    var preenchidos = itens.filter(function (i) { return i[1] !== '' && i[1] !== null && i[1] !== undefined; });
    if (!preenchidos.length) return null;
    var s = criar('section', 'revisao-grupo');
    s.appendChild(criar('h3', 'titulo-s revisao-cab', titulo));
    var dl = criar('dl', 'revisao-lista');
    preenchidos.forEach(function (i) {
      var l = criar('div', 'revisao-item');
      l.appendChild(criar('dt', 'revisao-rotulo', i[0]));
      l.appendChild(criar('dd', 'revisao-valor', i[1]));
      dl.appendChild(l);
    });
    s.appendChild(dl);
    return s;
  }

  function itensMedida(lista, p) {
    return lista.map(function (m) {
      var v = p[m.id];
      return [m.rotulo, v === null || v === undefined ? '' : String(parseFloat(v)).replace('.', ',') + ' ' + m.unidade];
    });
  }

  function simNao(v) {
    if (v === null || v === undefined) return 'Ainda não respondeu';
    return Number(v) === 1 ? 'Sim' : 'Não';
  }

  function abrir(id) {
    api.get(ENDERECO + '?id=' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok) return;
      var p = r.dados.pessoa;
      var caixa = $('pessoa-conteudo');
      caixa.textContent = '';

      var titulo = criar('h2', 'titulo-m', p.nome || p.email);
      titulo.id = 'pessoa-nome';
      caixa.appendChild(titulo);
      var sit = situacao(p);
      caixa.appendChild(criar('p', 'painel-suave', SITUACOES[sit] + ' · ' + (Number(p.progresso) || 0) + '% preenchido'));

      var endereco = [p.logradouro, p.numero, p.complemento, p.bairro, p.cidade, p.uf].filter(Boolean).join(', ');
      [
        bloco('Contato', [['E-mail', p.email], ['Telefone', api.mascaraTelefone(p.telefone || '')], ['CEP', api.mascaraCep(p.cep || '')], ['Endereço', endereco], ['Criou a conta com', p.origem === 'google' ? 'Google' : 'E-mail e senha']]),
        bloco('Sobre a pessoa', itensMedida(dados.geral, p).concat([['Tamanho usual', p.tamanho]])),
        bloco('Parte de cima', [['Quer fazer', simNao(p.parte_cima)]].concat(itensMedida(dados.cima, p))),
        bloco('Parte de baixo', [['Quer fazer', simNao(p.parte_baixo)]].concat(itensMedida(dados.baixo, p))),
        bloco('Preferências', [['Cor', p.cor], ['Tecido', p.tecido], ['Caimento', p.caimento], ['Preciso até', p.data_desejada ? p.data_desejada.split('-').reverse().join('/') : ''], ['Observações', p.observacoes]])
      ].forEach(function (s) { if (s) caixa.appendChild(s); });

      var hist = criar('section', 'revisao-grupo');
      hist.appendChild(criar('h3', 'titulo-s revisao-cab', 'Histórico'));
      var lista = criar('ol', 'painel-historico');
      r.dados.eventos.forEach(function (ev) {
        var texto = EVENTOS[ev.tipo] || ev.tipo;
        if (ev.etapa) texto += ': ' + (ROTULOS[ev.etapa] || ev.etapa);
        if (ev.tipo === 'respostas' && ev.detalhes) texto += ' (' + ev.detalhes + ')';
        var item = criar('li');
        item.appendChild(criar('span', 'painel-suave', dataHora(ev.criado_em)));
        item.appendChild(criar('span', '', texto));
        lista.appendChild(item);
      });
      hist.appendChild(lista);
      caixa.appendChild(hist);

      $('modal-pessoa').showModal();
      $('modal-pessoa').scrollTop = 0;
    });
  }

  $('pessoa-fechar').addEventListener('click', function () { $('modal-pessoa').close(); });
  $('modal-pessoa').addEventListener('click', function (e) { if (e.target === $('modal-pessoa')) $('modal-pessoa').close(); });

  /* --- Início ------------------------------------------------------------------------ */

  api.get(ENDERECO).then(function (r) {
    if (r.status === 401) { api.irParaLogin('painel.html'); return; }
    if (r.status === 403) { $('carregando').textContent = 'Esta conta não tem acesso ao painel.'; return; }
    if (!r.ok) { $('carregando').textContent = 'Não foi possível carregar o painel.'; return; }
    pessoas = r.dados.pessoas;
    $('carregando').hidden = true;
    $('painel-conteudo').hidden = false;
    numeros();
    desenhar();
  });
})();
