/* Coleção: categorias, modelagens e as opções do pedido exclusivo.
   As listas acompanham as de api/produtos.php. */
window.AR_COLECAO = (function () {
  'use strict';

  var CATEGORIAS = [
    { id: 'camiseta', rotulo: 'Camiseta' }, { id: 'polo', rotulo: 'Polo' }, { id: 'camisa', rotulo: 'Camisa' },
    { id: 'calca', rotulo: 'Calça' }, { id: 'bermuda', rotulo: 'Bermuda' }, { id: 'blazer', rotulo: 'Blazer' },
    { id: 'terno', rotulo: 'Terno' }, { id: 'colete', rotulo: 'Colete' }, { id: 'jaqueta', rotulo: 'Jaqueta' },
    { id: 'acessorio', rotulo: 'Acessório' }
  ];
  var MODELAGENS = [
    { id: 'ajustada', rotulo: 'Ajustada', texto: 'Mais rente ao corpo, sem apertar.' },
    { id: 'regular', rotulo: 'Regular', texto: 'Acompanha o corpo com folga confortável.' },
    { id: 'solta', rotulo: 'Mais solta', texto: 'Caimento amplo e relaxado.' }
  ];
  var SITUACOES = [
    { id: 'rascunho', rotulo: 'Rascunho (só você vê)' }, { id: 'publicado', rotulo: 'No ar' }, { id: 'esgotado', rotulo: 'Esgotado' }
  ];

  /* --- Pedido exclusivo ------------------------------------------------------------------- */

  // Desenhos simples das peças, em traço, numa grade de 64 por 64
  var DESENHOS = {
    camiseta: 'M24 10l-12 6-6 12 8 4 4-6v28h28V26l4 6 8-4-6-12-12-6c-2 4-14 4-16 0z',
    polo: 'M24 10l-12 6-6 12 8 4 4-6v28h28V26l4 6 8-4-6-12-12-6-8 6zM32 16v10',
    camisa: 'M24 9l-12 5-5 38h8l3-26v32h28V26l3 26h8l-5-38-12-5-8 10zM32 19v35',
    calca: 'M20 8h24l3 48h-10l-5-32-5 32H17z',
    bermuda: 'M18 12h28l4 26H36l-4-14-4 14H14z',
    blazer: 'M24 8l-13 6-5 40h8l3-26v30h30V28l3 26h8l-5-40-13-6-8 22zM24 8l4 12M40 8l-4 12',
    terno: 'M24 8l-13 6-5 40h8l3-26v30h30V28l3 26h8l-5-40-13-6-8 22zM28 40h8M24 8l4 12M40 8l-4 12',
    colete: 'M22 10l-8 6v36h36V16l-8-6-10 24zM32 34v18',
    jaqueta: 'M24 10l-13 6-5 36h8l3-24v30h30V28l3 24h8l-5-36-13-6zM32 12v42M20 14l4 6M44 14l-4 6'
  };

  var PECAS = [
    { id: 'camiseta', rotulo: 'Camiseta', texto: 'Malha leve, para o dia a dia.', tecidos: ['malha_algodao', 'piquet', 'linho', 'viscose'] },
    { id: 'polo', rotulo: 'Polo', texto: 'Entre o casual e o arrumado.', tecidos: ['piquet', 'malha_algodao'] },
    { id: 'camisa', rotulo: 'Camisa', texto: 'Social ou casual, de manga longa ou curta.', tecidos: ['tricoline', 'oxford', 'linho', 'algodao', 'viscose'] },
    { id: 'calca', rotulo: 'Calça', texto: 'De alfaiataria ou casual.', tecidos: ['la_fria', 'gabardine', 'sarja', 'linho', 'algodao'] },
    { id: 'bermuda', rotulo: 'Bermuda', texto: 'Para o calor, com o comprimento certo.', tecidos: ['sarja', 'linho', 'algodao'] },
    { id: 'blazer', rotulo: 'Blazer', texto: 'Estruturado ou leve, com ombro no lugar.', tecidos: ['la_fria', 'linho', 'gabardine', 'algodao'] },
    { id: 'terno', rotulo: 'Terno', texto: 'Paletó e calça do mesmo tecido.', tecidos: ['la_fria', 'gabardine', 'linho'] },
    { id: 'colete', rotulo: 'Colete', texto: 'Para usar com terno ou sozinho.', tecidos: ['la_fria', 'gabardine', 'linho'] },
    { id: 'jaqueta', rotulo: 'Jaqueta leve', texto: 'Casual, em tecido plano.', tecidos: ['sarja', 'algodao', 'gabardine'] }
  ];

  var TECIDOS = [
    { id: 'malha_algodao', rotulo: 'Malha de algodão', texto: 'Macia e respirável. A clássica das camisetas.' },
    { id: 'piquet', rotulo: 'Piquet', texto: 'Malha com textura de colmeia, usada nas polos.' },
    { id: 'algodao', rotulo: 'Algodão', texto: 'Tecido plano, resistente e fácil de cuidar.' },
    { id: 'tricoline', rotulo: 'Tricoline', texto: 'Liso e fino, o tecido da camisa social.' },
    { id: 'oxford', rotulo: 'Oxford', texto: 'Trama aparente, para camisas mais casuais.' },
    { id: 'linho', rotulo: 'Linho', texto: 'Fresco e elegante. Amassa um pouco, e isso faz parte do charme.' },
    { id: 'sarja', rotulo: 'Sarja', texto: 'Firme, com diagonal discreta. Boa para calças e bermudas.' },
    { id: 'la_fria', rotulo: 'Lã fria', texto: 'O tecido do bom terno: cai bem e respira o ano todo.' },
    { id: 'gabardine', rotulo: 'Gabardine', texto: 'Trama fechada e caimento reto, para alfaiataria.' },
    { id: 'viscose', rotulo: 'Viscose', texto: 'Leve e fluida, com toque macio.' },
    { id: 'indicacao', rotulo: 'Quero uma indicação', texto: 'A gente sugere o melhor tecido para a sua peça.' }
  ];

  // Por enquanto, tecidos que pedem máquinas e acabamentos especiais ficam de fora
  var FORA = 'couro, camurça, veludo, seda pura, paetê e tecidos técnicos ou impermeáveis';

  var OCASIOES = [
    { id: 'dia_a_dia', rotulo: 'Dia a dia' }, { id: 'trabalho', rotulo: 'Trabalho' }, { id: 'evento', rotulo: 'Evento ou festa' },
    { id: 'casamento', rotulo: 'Casamento' }, { id: 'viagem', rotulo: 'Viagem' }, { id: 'outra', rotulo: 'Outra' }
  ];

  var ORCAMENTOS = [
    { id: 'ate_300', rotulo: 'Até R$ 300' }, { id: 'ate_600', rotulo: 'R$ 300 a R$ 600' },
    { id: 'ate_1200', rotulo: 'R$ 600 a R$ 1.200' }, { id: 'acima_1200', rotulo: 'Acima de R$ 1.200' },
    { id: 'a_definir', rotulo: 'Ainda não sei' }
  ];

  var CORES = [
    { nome: 'Preto', hex: '#111111' }, { nome: 'Branco', hex: '#f6f4ef' }, { nome: 'Off-white', hex: '#ece5d6' },
    { nome: 'Cinza', hex: '#8a8a86' }, { nome: 'Marinho', hex: '#1d2840' }, { nome: 'Azul-claro', hex: '#a9bfd8' },
    { nome: 'Bege', hex: '#cdb894' }, { nome: 'Caramelo', hex: '#a26b3a' }, { nome: 'Marrom', hex: '#5a3d2b' },
    { nome: 'Verde-oliva', hex: '#5b5e3a' }, { nome: 'Bordô', hex: '#5c1322' }
  ];

  // Detalhes que fazem sentido para cada peça: [chave, rótulo, opções]
  var DETALHES = {
    camiseta: [
      ['gola', 'Gola', [['careca', 'Careca'], ['v', 'V']]],
      ['manga', 'Manga', [['curta', 'Curta'], ['longa', 'Longa']]],
      ['comprimento', 'Comprimento', [['padrao', 'Padrão'], ['curto', 'Mais curto'], ['longo', 'Mais longo']]]
    ],
    polo: [
      ['manga', 'Manga', [['curta', 'Curta'], ['longa', 'Longa']]],
      ['botoes', 'Botões', [['dois', '2 botões'], ['tres', '3 botões']]]
    ],
    camisa: [
      ['gola', 'Gola', [['italiana', 'Italiana'], ['americana', 'Com botões na ponta'], ['padre', 'Padre']]],
      ['manga', 'Manga', [['longa', 'Longa'], ['curta', 'Curta']]],
      ['punho', 'Punho', [['simples', 'Simples'], ['duplo', 'Duplo, para abotoadura']]],
      ['bolso', 'Bolso', [['sem', 'Sem bolso'], ['com', 'Com bolso']]]
    ],
    calca: [
      ['cintura', 'Cintura', [['passante', 'Com passantes para cinto'], ['regulador', 'Com reguladores laterais']]],
      ['pregas', 'Pregas', [['sem', 'Sem pregas'], ['uma', 'Uma prega']]],
      ['barra', 'Barra', [['simples', 'Simples'], ['italiana', 'Italiana, dobrada']]]
    ],
    bermuda: [
      ['comprimento', 'Comprimento', [['acima', 'Acima do joelho'], ['joelho', 'Na altura do joelho']]],
      ['barra', 'Barra', [['simples', 'Simples'], ['dobrada', 'Dobrada']]]
    ],
    blazer: [
      ['abotoamento', 'Abotoamento', [['dois', '2 botões'], ['um', '1 botão'], ['trespassado', 'Trespassado']]],
      ['lapela', 'Lapela', [['entalhada', 'Entalhada'], ['pico', 'Pico']]],
      ['forro', 'Forro', [['completo', 'Completo'], ['meio', 'Meio forro, mais leve']]],
      ['fenda', 'Fenda nas costas', [['duas', 'Duas fendas'], ['uma', 'Uma fenda'], ['sem', 'Sem fenda']]]
    ],
    terno: [
      ['abotoamento', 'Abotoamento', [['dois', '2 botões'], ['um', '1 botão'], ['trespassado', 'Trespassado']]],
      ['lapela', 'Lapela', [['entalhada', 'Entalhada'], ['pico', 'Pico']]],
      ['forro', 'Forro', [['completo', 'Completo'], ['meio', 'Meio forro, mais leve']]],
      ['barra', 'Barra da calça', [['simples', 'Simples'], ['italiana', 'Italiana, dobrada']]]
    ],
    colete: [
      ['botoes', 'Botões', [['cinco', '5 botões'], ['seis', '6 botões']]],
      ['costas', 'Costas', [['forro', 'Em forro'], ['tecido', 'No mesmo tecido']]]
    ],
    jaqueta: [
      ['modelo', 'Modelo', [['harrington', 'Harrington, com gola alta'], ['camisa', 'Estilo camisa (overshirt)'], ['bomber', 'Bomber, com punho de ribana']]],
      ['forro', 'Forro', [['sem', 'Sem forro'], ['com', 'Com forro']]]
    ]
  };

  var SITUACOES_EXCLUSIVO = [
    { id: 'novo', rotulo: 'Novo' }, { id: 'conversando', rotulo: 'Em conversa' }, { id: 'orcado', rotulo: 'Orçamento enviado' },
    { id: 'fechado', rotulo: 'Fechado' }, { id: 'cancelado', rotulo: 'Cancelado' }
  ];

  function indice(lista) {
    var m = {};
    lista.forEach(function (i) { m[i.id] = i; });
    return m;
  }

  function reais(centavos) {
    return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Desenho da peça em SVG, só com traço
  function desenho(id) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 64 64');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', DESENHOS[id] || DESENHOS.camiseta);
    svg.appendChild(p);
    return svg;
  }

  // O rótulo legível de um detalhe guardado, como "Gola: Italiana"
  function textoDoDetalhe(peca, chave, valor) {
    var d = (DETALHES[peca] || []).filter(function (x) { return x[0] === chave; })[0];
    if (!d) return chave + ': ' + valor;
    var o = d[2].filter(function (x) { return x[0] === valor; })[0];
    return d[1] + ': ' + (o ? o[1] : valor);
  }

  return {
    CATEGORIAS: CATEGORIAS, MODELAGENS: MODELAGENS, SITUACOES: SITUACOES, PECAS: PECAS, TECIDOS: TECIDOS, FORA: FORA,
    OCASIOES: OCASIOES, ORCAMENTOS: ORCAMENTOS, CORES: CORES, DETALHES: DETALHES, SITUACOES_EXCLUSIVO: SITUACOES_EXCLUSIVO,
    porCategoria: indice(CATEGORIAS), porModelagem: indice(MODELAGENS), porSituacao: indice(SITUACOES), porPeca: indice(PECAS),
    porTecido: indice(TECIDOS), porOcasiao: indice(OCASIOES), porOrcamento: indice(ORCAMENTOS), porSituacaoExclusivo: indice(SITUACOES_EXCLUSIVO),
    reais: reais, desenho: desenho, textoDoDetalhe: textoDoDetalhe
  };
})();
