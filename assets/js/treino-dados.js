/* Treino: exercícios, movimentos e divisões de treino. Versão beta.
   As listas de objetivos, níveis, locais e cuidados acompanham as de api/apps.php. */
window.AR_TREINO_DADOS = (function () {
  'use strict';

  // locais: onde dá para fazer. carga: se faz sentido anotar o peso. evitar: cuidados que pedem outro exercício.
  var EXERCICIOS = [
    { id: 'agachamento_livre', nome: 'Agachamento livre com barra', locais: ['academia'], carga: true, evitar: ['joelho', 'lombar'], dica: 'Pés na largura dos ombros. Desça como se fosse sentar, com o peito aberto e os joelhos na direção dos pés.' },
    { id: 'leg_press', nome: 'Leg press', locais: ['academia'], carga: true, evitar: [], dica: 'Lombar sempre encostada. Desça até onde os joelhos dobram sem a lombar sair do banco.' },
    { id: 'agachamento_goblet', nome: 'Agachamento com halter na frente do peito', locais: ['academia', 'halteres'], carga: true, evitar: ['lombar'], dica: 'Segure o halter junto ao peito e desça com a coluna reta.' },
    { id: 'agachamento_peso', nome: 'Agachamento sem peso', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Braços à frente para equilibrar. Desça devagar e suba firme.' },
    { id: 'sentar_levantar', nome: 'Sentar e levantar da cadeira', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Movimento curto e controlado, bom para quem sente o joelho. Toque a cadeira e suba sem usar as mãos.' },
    { id: 'stiff', nome: 'Stiff com halteres', locais: ['academia', 'halteres'], carga: true, evitar: ['lombar'], dica: 'Joelhos levemente dobrados. Leve o quadril para trás e desça os halteres rente às pernas.' },
    { id: 'mesa_flexora', nome: 'Mesa flexora', locais: ['academia'], carga: true, evitar: [], dica: 'Suba e desça devagar, sem tirar o quadril do banco.' },
    { id: 'ponte_gluteo', nome: 'Elevação de quadril (ponte)', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Deitado, pés no chão. Suba o quadril apertando o glúteo e segure 1 segundo no alto.' },
    { id: 'afundo', nome: 'Afundo', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['joelho'], dica: 'Passo largo à frente. Desça o joelho de trás em direção ao chão, tronco reto.' },
    { id: 'ponte_unilateral', nome: 'Ponte com uma perna', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Como a ponte, mas com uma perna estendida. Faça as repetições de um lado e depois do outro.' },
    { id: 'panturrilha', nome: 'Panturrilha em pé', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Suba na ponta dos pés devagar e desça até o calcanhar quase tocar o chão.' },

    { id: 'supino_reto', nome: 'Supino reto com barra', locais: ['academia'], carga: true, evitar: ['ombro'], dica: 'Escápulas encaixadas no banco. Desça a barra até o meio do peito, com os cotovelos a uns 45 graus do corpo.' },
    { id: 'supino_halteres', nome: 'Supino com halteres', locais: ['academia'], carga: true, evitar: [], dica: 'Desça os halteres devagar até a linha do peito e suba juntando-os no alto.' },
    { id: 'supino_chao', nome: 'Supino no chão com halteres', locais: ['halteres'], carga: true, evitar: [], dica: 'Deitado no chão, desça até os cotovelos encostarem de leve e suba.' },
    { id: 'flexao', nome: 'Flexão de braço', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Corpo reto da cabeça aos pés. Se estiver difícil, apoie os joelhos no chão.' },
    { id: 'puxada_frente', nome: 'Puxada na frente', locais: ['academia'], carga: true, evitar: [], dica: 'Puxe a barra até o alto do peito, levando os cotovelos para baixo e para trás.' },
    { id: 'remada_baixa', nome: 'Remada baixa', locais: ['academia'], carga: true, evitar: [], dica: 'Tronco firme. Puxe até a barriga, juntando as escápulas.' },
    { id: 'remada_halter', nome: 'Remada com halter, um braço', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Apoie a mão e o joelho num banco ou cadeira. Puxe o halter em direção ao quadril.' },
    { id: 'remada_mochila', nome: 'Remada com mochila', locais: ['casa'], carga: false, evitar: [], dica: 'Coloque livros numa mochila. Incline o tronco, costas retas, e puxe a mochila até a barriga.' },
    { id: 'desenvolvimento', nome: 'Desenvolvimento com halteres', locais: ['academia', 'halteres'], carga: true, evitar: ['ombro'], dica: 'Sentado, suba os halteres acima da cabeça sem travar os cotovelos.' },
    { id: 'pike', nome: 'Flexão com quadril alto (ombros)', locais: ['casa'], carga: false, evitar: ['ombro'], dica: 'Quadril alto, formando um V. Desça a cabeça em direção ao chão entre as mãos.' },
    { id: 'elevacao_lateral', nome: 'Elevação lateral', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Peso leve. Suba os braços para os lados até a altura dos ombros.' },
    { id: 'elevacao_garrafa', nome: 'Elevação lateral com garrafas', locais: ['casa'], carga: false, evitar: [], dica: 'Use garrafas de água. Suba os braços para os lados até a altura dos ombros.' },
    { id: 'rosca_direta', nome: 'Rosca direta', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Cotovelos colados ao corpo. Suba sem balançar o tronco.' },
    { id: 'rosca_mochila', nome: 'Rosca com mochila ou galão', locais: ['casa'], carga: false, evitar: [], dica: 'Segure pela alça e dobre os cotovelos, mantendo-os junto ao corpo.' },
    { id: 'triceps_polia', nome: 'Tríceps na polia', locais: ['academia'], carga: true, evitar: [], dica: 'Cotovelos parados ao lado do corpo. Estenda os braços até o fim.' },
    { id: 'triceps_frances', nome: 'Tríceps francês com halter', locais: ['halteres'], carga: true, evitar: ['ombro'], dica: 'Halter atrás da cabeça, cotovelos apontando para cima.' },
    { id: 'triceps_cadeira', nome: 'Tríceps na cadeira', locais: ['casa', 'halteres'], carga: false, evitar: ['ombro'], dica: 'Mãos na beira de uma cadeira firme. Desça dobrando os cotovelos para trás.' },
    { id: 'triceps_fechada', nome: 'Flexão com as mãos juntas', locais: ['casa', 'halteres'], carga: false, evitar: [], dica: 'Como a flexão, com as mãos mais próximas. Apoie os joelhos se precisar.' },

    { id: 'prancha', nome: 'Prancha', locais: ['casa', 'halteres', 'academia'], carga: false, tempo: true, evitar: [], dica: 'Cotovelos embaixo dos ombros, barriga firme, sem deixar o quadril cair.' },
    { id: 'dead_bug', nome: 'Abdominal dead bug', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Deitado, lombar colada no chão. Estenda braço e perna opostos devagar.' },
    { id: 'prancha_lateral', nome: 'Prancha lateral', locais: ['casa', 'halteres', 'academia'], carga: false, tempo: true, evitar: ['ombro'], dica: 'Apoio no antebraço, corpo em linha reta. Faça dos dois lados.' }
  ];

  // Cada movimento tem opções, em ordem de preferência
  var MOVIMENTOS = {
    pernas: ['agachamento_livre', 'leg_press', 'agachamento_goblet', 'agachamento_peso', 'sentar_levantar'],
    posterior: ['stiff', 'mesa_flexora', 'ponte_gluteo'],
    unilateral: ['afundo', 'ponte_unilateral'],
    panturrilha: ['panturrilha'],
    peito: ['supino_reto', 'supino_halteres', 'supino_chao', 'flexao'],
    costas_vertical: ['puxada_frente', 'remada_halter', 'remada_mochila'],
    costas: ['remada_baixa', 'remada_halter', 'remada_mochila'],
    ombros: ['desenvolvimento', 'pike', 'elevacao_lateral', 'elevacao_garrafa'],
    ombro_lateral: ['elevacao_lateral', 'elevacao_garrafa'],
    biceps: ['rosca_direta', 'rosca_mochila'],
    triceps: ['triceps_polia', 'triceps_frances', 'triceps_cadeira', 'triceps_fechada'],
    abdomen: ['prancha', 'dead_bug', 'prancha_lateral']
  };

  // Divisões: cada letra é um treino, com os movimentos em ordem de importância
  var DIVISOES = {
    corpo_inteiro: [
      { letra: 'A', nome: 'Corpo inteiro', movimentos: ['pernas', 'peito', 'costas', 'posterior', 'ombro_lateral', 'abdomen', 'biceps'] },
      { letra: 'B', nome: 'Corpo inteiro', movimentos: ['posterior', 'costas_vertical', 'ombros', 'unilateral', 'triceps', 'abdomen', 'panturrilha'] }
    ],
    superior_inferior: [
      { letra: 'A', nome: 'Parte de cima', movimentos: ['peito', 'costas_vertical', 'ombros', 'costas', 'biceps', 'triceps'] },
      { letra: 'B', nome: 'Pernas e abdômen', movimentos: ['pernas', 'posterior', 'unilateral', 'panturrilha', 'abdomen'] },
      { letra: 'C', nome: 'Parte de cima', movimentos: ['costas', 'peito', 'ombro_lateral', 'costas_vertical', 'triceps', 'biceps'] },
      { letra: 'D', nome: 'Pernas e abdômen', movimentos: ['posterior', 'pernas', 'unilateral', 'abdomen', 'panturrilha'] }
    ],
    empurrar_puxar_pernas: [
      { letra: 'A', nome: 'Peito, ombros e tríceps', movimentos: ['peito', 'ombros', 'ombro_lateral', 'triceps', 'abdomen'] },
      { letra: 'B', nome: 'Costas e bíceps', movimentos: ['costas_vertical', 'costas', 'biceps', 'abdomen'] },
      { letra: 'C', nome: 'Pernas', movimentos: ['pernas', 'posterior', 'unilateral', 'panturrilha'] }
    ]
  };

  var OBJETIVOS = [
    { id: 'emagrecer', rotulo: 'Emagrecer', reps: '12 a 15', descanso: 45, cardio: 'Termine com 15 a 20 minutos de caminhada rápida, bicicleta ou elíptico.' },
    { id: 'massa', rotulo: 'Ganhar massa muscular', reps: '8 a 12', descanso: 90, cardio: '' },
    { id: 'saude', rotulo: 'Saúde e disposição', reps: '10 a 15', descanso: 60, cardio: 'Nos dias sem treino, caminhe 20 a 30 minutos.' }
  ];
  var NIVEIS = [
    { id: 'iniciante', rotulo: 'Começando agora ou voltando', series: 2 },
    { id: 'intermediario', rotulo: 'Treino há mais de 6 meses', series: 3 }
  ];
  var LOCAIS = [
    { id: 'academia', rotulo: 'Academia' },
    { id: 'halteres', rotulo: 'Em casa, com halteres' },
    { id: 'casa', rotulo: 'Em casa, sem equipamento' }
  ];
  var TEMPOS = [
    { id: 30, rotulo: '30 minutos', exercicios: 4 },
    { id: 45, rotulo: '45 minutos', exercicios: 5 },
    { id: 60, rotulo: '1 hora', exercicios: 7 }
  ];
  var CUIDADOS = [
    { id: 'joelho', rotulo: 'Joelho' },
    { id: 'ombro', rotulo: 'Ombro' },
    { id: 'lombar', rotulo: 'Lombar' }
  ];
  var ESFORCOS = [
    { id: 'leve', rotulo: 'Ficou leve' },
    { id: 'ok', rotulo: 'Na medida' },
    { id: 'pesado', rotulo: 'Pesado demais' }
  ];

  function indice(lista) {
    var mapa = {};
    lista.forEach(function (i) { mapa[i.id] = i; });
    return mapa;
  }

  return {
    EXERCICIOS: EXERCICIOS, MOVIMENTOS: MOVIMENTOS, DIVISOES: DIVISOES,
    OBJETIVOS: OBJETIVOS, NIVEIS: NIVEIS, LOCAIS: LOCAIS, TEMPOS: TEMPOS, CUIDADOS: CUIDADOS, ESFORCOS: ESFORCOS,
    porExercicio: indice(EXERCICIOS), porObjetivo: indice(OBJETIVOS), porNivel: indice(NIVEIS), porTempo: indice(TEMPOS)
  };
})();
