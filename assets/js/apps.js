/* Apps: a moldura comum. Barra de cima com a conta, título que encolhe ao rolar,
   ícones e pequenas utilidades usadas por todos os apps. */
window.AR_APP = (function () {
  'use strict';

  var api = window.AR_API;
  var SVG = 'http://www.w3.org/2000/svg';

  // Desenhos dos ícones: cada item é um traço do SVG, numa grade de 24 por 24
  var ICONES = {
    apps: ['M5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4Z', 'M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3A1.5 1.5 0 0 1 15.5 4Z', 'M5.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3A1.5 1.5 0 0 1 5.5 14Z', 'M15.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5Z'],
    cabide: ['M12 7.2a2.2 2.2 0 1 1 2.2 2.2c-.9.4-2.2 1-2.2 2.1v.5', 'M12 12 3.4 17.6c-.8.5-.4 1.7.5 1.7h16.2c.9 0 1.3-1.2.5-1.7Z'],
    folha: ['M5 19.5c0-8.5 5-14.5 15-14.5 0 10.5-6 15.5-14.5 15', 'M5 19.5c3-4.5 6.5-7.5 10.5-9.5'],
    calendario: ['M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4Z', 'M4 9.5h16', 'M8.5 2.5v3', 'M15.5 2.5v3', 'm12 12 .95 1.9 2.1.3-1.5 1.5.35 2.1-1.9-1-1.9 1 .35-2.1-1.5-1.5 2.1-.3Z'],
    haltere: ['M6.5 7v10', 'M17.5 7v10', 'M3.5 9.5v5', 'M20.5 9.5v5', 'M6.5 12h11'],
    pessoa: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20.5c1.3-3.6 4.1-5.5 7.5-5.5s6.2 1.9 7.5 5.5'],
    voltar: ['M15 5l-7 7 7 7'],
    seguir: ['M9 5l7 7-7 7'],
    mais: ['M12 5v14', 'M5 12h14'],
    lapis: ['M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
    lixeira: ['M4 7h16', 'M9.5 7V4.5h5V7', 'M6.5 7l.9 12.5c.05.8.7 1.5 1.5 1.5h6.2c.8 0 1.45-.7 1.5-1.5L17.5 7', 'M10 11v6', 'M14 11v6'],
    camera: ['M5.5 7h2L9 4.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9A1.5 1.5 0 0 1 5.5 7Z', 'M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'],
    girar: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v5h-5'],
    varinha: ['M4 20 14.5 9.5', 'M13 8l3 3', 'M17.5 3v2.5', 'M21 6.5h-2.5', 'M20 4l-1.5 1.5'],
    restaurar: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4.5 4.5v5h5'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    sol: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2.5v2', 'M12 19.5v2', 'M2.5 12h2', 'M19.5 12h2', 'm5.3 5.3 1.4 1.4', 'm17.3 17.3 1.4 1.4', 'm5.3 18.7 1.4-1.4', 'm17.3 6.7 1.4-1.4'],
    nuvem: ['M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 11a3.75 3.75 0 0 0 0 7.5Z'],
    floco: ['M12 3v18', 'M4.2 7.5l15.6 9', 'M4.2 16.5l15.6-9', 'M9.5 4.5 12 6.5l2.5-2', 'M9.5 19.5 12 17.5l2.5 2'],
    carrinho: ['M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1', 'M9.5 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M17 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'],
    mala: ['M6.5 7h11A1.5 1.5 0 0 1 19 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-10A1.5 1.5 0 0 1 6.5 7Z', 'M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7', 'M9 11v5', 'M15 11v5'],
    tesoura: ['M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M8.6 7.6 20 17', 'M8.6 16.4 20 7'],
    relogio: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
    sino: ['M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z', 'M10 21h4'],
    diario: ['M6 3.5h11A1.5 1.5 0 0 1 18.5 5v14.5A1.5 1.5 0 0 1 17 21H6Z', 'M6 3.5v17.5', 'M9.5 8h5.5', 'M9.5 11.5h5.5'],
    conversa: ['M4 19.5l1.3-3.7A7.5 7.5 0 1 1 8.4 18.6Z'],
    fechar: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
    chama: ['M12 21c-3.9 0-6.5-2.7-6.5-6.3 0-3.4 2.3-5.4 3.6-7.7.5 1.8 1.4 2.8 2.4 3.3.3-3.3 1.6-5.8 3.8-7.3-.2 2.8 3.2 5.6 3.2 11 0 4.4-2.7 7-6.5 7Z', 'M12 21c-1.6 0-2.7-1.1-2.7-2.7 0-1.7 1.5-2.7 2.7-4.3 1.2 1.6 2.7 2.6 2.7 4.3 0 1.6-1.1 2.7-2.7 2.7Z']
  };

  function icone(nome, classe) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', classe || 'app-ico');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    (ICONES[nome] || []).forEach(function (d) {
      var caminho = document.createElementNS(SVG, 'path');
      caminho.setAttribute('d', d);
      svg.appendChild(caminho);
    });
    return svg;
  }

  // Ícones escritos no HTML como <svg data-icone="nome">
  function desenharIcones(raiz) {
    (raiz || document).querySelectorAll('svg[data-icone]').forEach(function (svg) {
      if (svg.childNodes.length) return;
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      if (!svg.getAttribute('class')) svg.setAttribute('class', 'app-ico');
      (ICONES[svg.getAttribute('data-icone')] || []).forEach(function (d) {
        var caminho = document.createElementNS(SVG, 'path');
        caminho.setAttribute('d', d);
        svg.appendChild(caminho);
      });
    });
  }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  // Página atual, como 'apps/treino/', para voltar a ela depois de entrar na conta
  function paginaAtual() {
    return location.pathname.replace(/^\/+/, '');
  }

  function iniciais(texto) {
    var partes = String(texto || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    var letras = partes.length > 1 ? partes[0].charAt(0) + partes[partes.length - 1].charAt(0) : partes[0].slice(0, 2);
    return letras.toUpperCase();
  }

  /* --- Datas ------------------------------------------------------------------- */

  function hojeISO(data) {
    var d = data || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function paraData(iso) {
    var p = String(iso).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function diasAte(iso, desde) {
    var a = paraData(desde || hojeISO());
    var b = paraData(iso);
    return Math.round((b - a) / 86400000);
  }

  function somarDias(iso, dias) {
    var d = paraData(iso);
    d.setDate(d.getDate() + dias);
    return hojeISO(d);
  }

  function dataCurta(iso) {
    var p = String(iso).split('-');
    return p[2] + '/' + p[1];
  }

  function dataLonga(iso) {
    return paraData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function textoDias(dias) {
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'amanhã';
    if (dias === -1) return 'ontem';
    return dias > 0 ? 'em ' + dias + ' dias' : 'há ' + Math.abs(dias) + ' dias';
  }

  /* --- Guardar no aparelho ------------------------------------------------------- */

  function lerLocal(chave) {
    try { return JSON.parse(localStorage.getItem(chave)); } catch (e) { return null; }
  }

  function gravarLocal(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  }

  /* --- Medidas em comum entre a Alimentação e o Treino ------------------------------ */

  // Quem preenche as medidas num app não precisa digitar de novo no outro.
  // medidas: sexo, idade, altura e peso. resumo: o que um app mostra do outro.
  // A página de medidas apaga 'ar-medidas-v1', um nome antigo dela; por isso o nome é outro
  var COMUM = 'ar-corpo-v1';
  var COMUM_ANTIGO = 'ar-medidas-v1';
  var CAMPOS_MEDIDAS = ['sexo', 'idade', 'altura', 'peso'];

  function comum() {
    var c = lerLocal(COMUM);
    if (!c) {
      // Quem já usava os apps com o nome antigo não perde as medidas
      var antigo = lerLocal(COMUM_ANTIGO);
      if (antigo && typeof antigo === 'object' && antigo.medidas && typeof antigo.medidas === 'object') {
        c = antigo;
        gravarLocal(COMUM, c);
      }
    }
    if (!c || typeof c !== 'object' || Array.isArray(c)) c = {};
    if (!c.medidas || typeof c.medidas !== 'object') c.medidas = {};
    return c;
  }

  function guardarComum(origem, medidas, resumo) {
    var c = comum();
    var mudou = false;
    CAMPOS_MEDIDAS.forEach(function (k) {
      var v = medidas ? medidas[k] : undefined;
      if (v === undefined || v === '' || v === null) return;
      if (c.medidas[k] !== v) { c.medidas[k] = v; mudou = true; }
    });
    if (mudou) { c.medidasEm = Date.now(); c.medidasDe = origem; }
    if (resumo) c[origem] = resumo;
    gravarLocal(COMUM, c);
    return c;
  }

  /* --- Aviso na parte de baixo ----------------------------------------------------- */

  var temporizador = null;

  function avisar(texto, desfazer) {
    var caixa = document.getElementById('app-aviso');
    if (!caixa) return;
    caixa.textContent = '';
    window.clearTimeout(temporizador);
    caixa.appendChild(criar('span', '', texto));
    if (desfazer) {
      var b = criar('button', 'texto-botao', 'Desfazer');
      b.type = 'button';
      b.addEventListener('click', function () { caixa.textContent = ''; desfazer(); });
      caixa.appendChild(b);
    }
    temporizador = window.setTimeout(function () { caixa.textContent = ''; }, desfazer ? 9000 : 4500);
  }

  /* --- Link do WhatsApp da marca --------------------------------------------------- */

  function linkWhatsapp(texto) {
    var numero = window.AR_CONFIG && window.AR_CONFIG.whatsapp;
    return 'https://wa.me/' + numero + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }

  /* --- Conta ---------------------------------------------------------------------- */

  // respondeu: o servidor respondeu. Sem resposta, não dá para saber se a pessoa tem conta.
  var verificacao = api
    ? api.get('api/auth.php?acao=sessao').then(function (r) {
      return { respondeu: Boolean(r.ok), usuario: r.ok && r.dados.logado ? r.dados.usuario : null };
    }, function () { return { respondeu: false, usuario: null }; })
    : Promise.resolve({ respondeu: false, usuario: null });
  var sessao = verificacao.then(function (v) { return v.usuario; });

  sessao.then(function (usuario) {
    var conta = document.getElementById('app-conta');
    if (!conta) return;
    conta.textContent = '';
    if (usuario) {
      conta.textContent = iniciais(usuario.nome || usuario.email);
      conta.href = 'minha-conta.html';
      conta.setAttribute('aria-label', 'Minha conta');
      conta.classList.remove('app-conta-visitante');
    } else {
      conta.appendChild(icone('pessoa'));
      conta.href = 'entrar.html?voltar=' + encodeURIComponent(paginaAtual());
      conta.setAttribute('aria-label', 'Entrar na minha conta');
      conta.classList.add('app-conta-visitante');
    }
  });

  /* --- Acesso: os apps são de quem tem conta ----------------------------------------- */

  // Para quem ainda não tem conta, cada app mostra o que entrega e o convite para criar.
  // itens: [ícone, título, texto]. No início, cada item é um app: [ícone, título, texto, classe do ícone].
  var PORTOES = {
    'apps/': {
      classe: 'app-icone-portao', icone: 'apps', nome: 'Apps',
      titulo: 'Vista-se melhor, coma melhor e chegue pronto a cada ocasião',
      texto: 'Cinco apps que trabalham juntos para você. Crie sua conta grátis em menos de um minuto e libere todos eles agora.',
      itens: [
        ['cabide', 'Guarda-roupa', 'Seu armário no celular, com looks prontos para o clima do dia e o custo de cada peça.', 'app-icone-guarda-roupa'],
        ['folha', 'Alimentação', 'Um plano para o seu objetivo, com a lista de compras e quanto custa no mercado da sua região.', 'app-icone-alimentacao'],
        ['calendario', 'Ocasiões', 'O traje certo para cada evento, montado com as suas próprias peças, e a mala da viagem pronta.', 'app-icone-ocasioes'],
        ['haltere', 'Treino', 'Um treino para o seu objetivo e o seu foco, na academia ou em casa, no tempo que você tem.', 'app-icone-treino'],
        ['chama', 'Hábitos', 'Hábitos que ficam, com lembretes no celular e o resgate antes de você desistir.', 'app-icone-habitos']
      ]
    },
    'apps/guarda-roupa/': {
      classe: 'app-icone-guarda-roupa', icone: 'cabide', nome: 'Guarda-roupa',
      titulo: 'Nunca mais pare na frente do armário sem saber o que vestir',
      texto: 'Fotografe suas roupas uma vez e receba, todo dia, looks prontos com o que você já tem.',
      itens: [
        ['camera', 'Seu armário no bolso', 'Fotografe as peças: o fundo sai sozinho e tudo fica organizado por tipo e cor.'],
        ['varinha', 'Looks prontos todo dia', 'Combinações que respeitam as cores, a formalidade e o clima de hoje na sua cidade.'],
        ['diario', 'Sem repetir sem querer', 'Anote o que usou e o app avisa antes de você repetir o look no mesmo lugar.'],
        ['tesoura', 'Compre melhor', 'Veja o custo por uso de cada peça e as que estão paradas há meses.']
      ]
    },
    'apps/alimentacao/': {
      classe: 'app-icone-alimentacao', icone: 'folha', nome: 'Alimentação',
      titulo: 'Um plano de alimentação que cabe no seu objetivo e no seu bolso',
      texto: 'Descubra quanto você precisa comer por dia e receba um plano montado a partir da sua rotina, sem dieta maluca.',
      itens: [
        ['folha', 'Sua meta calculada', 'Calorias e proteína por dia para perder peso, manter ou ganhar massa.'],
        ['check', 'Parte do que você já come', 'O plano ajusta a sua rotina, e você troca o que não gosta por opções parecidas.'],
        ['carrinho', 'Quanto custa no mercado', 'Lista de compras com preços da sua região e onde dá para economizar.'],
        ['sino', 'Avisos antes de acabar', 'O app avisa por e-mail quando um item da despensa está para acabar.']
      ]
    },
    'apps/ocasioes/': {
      classe: 'app-icone-ocasioes', icone: 'calendario', nome: 'Ocasiões',
      titulo: 'Chegue a cada evento vestido do jeito certo',
      texto: 'Casamento, formatura, entrevista ou viagem: anote a data e o app cuida do resto.',
      itens: [
        ['calendario', 'O traje explicado', 'Esporte fino, passeio completo, black tie: o que usar e o que evitar, sem dúvida.'],
        ['cabide', 'O look com as suas peças', 'O app escolhe no seu guarda-roupa o que serve para o traje, e você ajusta como quiser.'],
        ['tesoura', 'O prazo do sob medida', 'Se faltar uma peça, você sabe até quando encomendar para ficar pronta a tempo.'],
        ['mala', 'A mala sem esquecer nada', 'Poucas peças que combinam entre si, com a previsão do tempo do destino.']
      ]
    },
    'apps/treino/': {
      classe: 'app-icone-treino', icone: 'haltere', nome: 'Treino',
      titulo: 'Um treino feito para você, no tempo que você tem',
      texto: 'Diga o seu objetivo, onde treina e quanto tempo tem. O app monta o plano e guia cada série.',
      itens: [
        ['haltere', 'Para o seu objetivo', 'Emagrecer, ganhar massa ou ter mais disposição, na academia ou em casa.'],
        ['pessoa', 'Foco onde você quer', 'Escolha até dois grupos musculares para receberem mais atenção.'],
        ['girar', 'Três opções por treino', 'Varie os exercícios sem perder o rumo e troque o que não gostar.'],
        ['relogio', 'Tudo sob controle', 'Descanso cronometrado, histórico das cargas e a sua semana à vista.']
      ]
    },
    'apps/habitos/': {
      classe: 'app-icone-habitos', icone: 'chama', nome: 'Hábitos',
      titulo: 'Para quem já tentou mudar um hábito e desistiu no meio',
      texto: 'Comece pequeno, prenda o hábito novo a algo que você já faz e receba o aviso na hora certa.',
      itens: [
        ['check', 'Dois minutos bastam', 'Cada hábito tem a sua versão mínima. Nos dias difíceis, ela conta e mantém a sequência.'],
        ['sino', 'Lembretes no celular', 'O aviso chega na hora marcada, mesmo com o navegador fechado.'],
        ['chama', 'Nunca falhe duas vezes', 'Ficou para trás? O app destaca o hábito e chama você à noite, antes de virar desistência.'],
        ['calendario', 'A sua consistência', 'Sequências, recordes e um mapa de 12 semanas para ver o quanto você já mudou.']
      ]
    }
  };

  var LEMBRAR = 'ar-conta-ativa';
  var raiz = document.documentElement;
  var principal = document.querySelector('body.app .app-conteudo');

  function liberar() { raiz.classList.add('app-liberado'); }

  function linkDeConta(classe, texto, pagina, destino) {
    var a = criar('a', classe, texto);
    a.href = pagina + '?voltar=' + encodeURIComponent(destino);
    return a;
  }

  function mostrarPortao() {
    var destino = paginaAtual();
    var p = PORTOES[destino] || PORTOES['apps/'];
    if (document.getElementById('app-portao')) return;
    var portao = criar('section', 'app-portao');
    portao.id = 'app-portao';
    portao.setAttribute('aria-labelledby', 'app-portao-titulo');

    var topo = criar('div', 'app-portao-topo');
    var marca = criar('div', 'app-portao-marca');
    var fundo = criar('span', 'app-icone-fundo ' + p.classe);
    fundo.setAttribute('aria-hidden', 'true');
    fundo.appendChild(icone(p.icone));
    marca.appendChild(fundo);
    marca.appendChild(criar('span', '', p.nome));
    topo.appendChild(marca);
    topo.appendChild(criar('p', 'app-portao-selo', 'Exclusivo para quem tem conta · grátis'));
    var h = criar('h1', 'app-portao-titulo', p.titulo);
    h.id = 'app-portao-titulo';
    topo.appendChild(h);
    topo.appendChild(criar('p', 'app-portao-texto', p.texto));
    var botoes = criar('div', 'app-convite-botoes');
    botoes.appendChild(linkDeConta('botao botao-cheio', 'Criar minha conta grátis', 'criar-conta.html', destino));
    botoes.appendChild(linkDeConta('botao', 'Já tenho conta', 'entrar.html', destino));
    topo.appendChild(botoes);
    portao.appendChild(topo);

    portao.appendChild(criar('h2', 'app-secao-titulo', 'O que você ganha'));
    var lista = criar('ul', 'app-portao-lista');
    p.itens.forEach(function (i) {
      var li = criar('li');
      var ic = criar('span', 'app-portao-ico ' + (i[3] || p.classe));
      ic.setAttribute('aria-hidden', 'true');
      ic.appendChild(icone(i[0]));
      li.appendChild(ic);
      var texto = criar('span');
      texto.appendChild(criar('strong', '', i[1]));
      texto.appendChild(criar('span', '', i[2]));
      li.appendChild(texto);
      lista.appendChild(li);
    });
    portao.appendChild(lista);

    var garantias = criar('ul', 'app-portao-garantias');
    ['Grátis, sem cartão de crédito', 'Uma conta só para todos os apps', 'O que você anota é visível só para você', 'Abre no celular e no computador'].forEach(function (g) {
      var li = criar('li');
      li.appendChild(icone('check'));
      li.appendChild(document.createTextNode(g));
      garantias.appendChild(li);
    });
    portao.appendChild(garantias);
    var fim = criar('div', 'app-portao-fim');
    fim.appendChild(linkDeConta('botao botao-cheio', 'Criar minha conta grátis', 'criar-conta.html', destino));
    portao.appendChild(fim);

    var abrindo = document.getElementById('app-abrindo');
    if (abrindo) abrindo.remove();
    principal.insertBefore(portao, principal.firstChild);
    window.scrollTo(0, 0);
  }

  if (principal) {
    // Quem já entrou neste aparelho vê o app na hora; a confirmação chega em seguida
    if (lerLocal(LEMBRAR)) liberar();
    else {
      var abrindo = criar('p', 'app-abrindo', 'Abrindo...');
      abrindo.id = 'app-abrindo';
      principal.insertBefore(abrindo, principal.firstChild);
    }
    verificacao.then(function (v) {
      var abrindo = document.getElementById('app-abrindo');
      if (v.usuario) {
        gravarLocal(LEMBRAR, 1);
        if (abrindo) abrindo.remove();
        liberar();
        return;
      }
      // Sem resposta do servidor, quem já entrou antes continua usando o que está no aparelho
      if (!v.respondeu && lerLocal(LEMBRAR)) return;
      try { localStorage.removeItem(LEMBRAR); } catch (e) { /* nada guardado */ }
      raiz.classList.remove('app-liberado');
      mostrarPortao();
    });
  }

  /* --- Barra: o título pequeno aparece quando o grande sai da tela -------------------- */

  var barra = document.querySelector('.app-barra');
  var titulo = document.querySelector('.app-titulo');
  if (barra && titulo && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      barra.classList.toggle('rolou', !entradas[0].isIntersecting);
    }, { rootMargin: '-60px 0px 0px 0px' }).observe(titulo);
  }

  desenharIcones();

  return {
    api: api, sessao: sessao, icone: icone, desenharIcones: desenharIcones, criar: criar,
    paginaAtual: paginaAtual, iniciais: iniciais,
    hojeISO: hojeISO, paraData: paraData, diasAte: diasAte, somarDias: somarDias,
    dataCurta: dataCurta, dataLonga: dataLonga, textoDias: textoDias,
    lerLocal: lerLocal, gravarLocal: gravarLocal, avisar: avisar, linkWhatsapp: linkWhatsapp,
    comum: comum, guardarComum: guardarComum
  };
})();
