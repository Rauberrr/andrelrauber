/* Treino: exercícios, grupos musculares, movimentos e divisões de treino.
   As listas de objetivos, níveis, locais, cuidados e focos acompanham as de api/apps.php. */
window.AR_TREINO_DADOS = (function () {
  'use strict';

  // grupo: o grupo muscular principal, usado nas trocas e no foco.
  // locais: onde dá para fazer. carga: se faz sentido anotar o peso. tempo: conta segundos, não repetições.
  // evitar: cuidados que pedem outro exercício.
  var EXERCICIOS = [
    /* Pernas, frente da coxa */
    { id: 'agachamento_livre', grupo: 'quadriceps', nome: 'Agachamento livre com barra', locais: ['academia'], carga: true, evitar: ['joelho', 'lombar'], dica: 'Pés na largura dos ombros. Desça como se fosse sentar, com o peito aberto e os joelhos na direção dos pés.' },
    { id: 'leg_press', grupo: 'quadriceps', nome: 'Leg press', locais: ['academia'], carga: true, evitar: [], dica: 'Lombar sempre encostada. Desça até onde os joelhos dobram sem a lombar sair do banco.' },
    { id: 'hack', grupo: 'quadriceps', nome: 'Agachamento no hack', locais: ['academia'], carga: true, evitar: ['joelho'], dica: 'Costas apoiadas e pés no meio da plataforma. Desça devagar e suba sem travar os joelhos.' },
    { id: 'agachamento_smith', grupo: 'quadriceps', nome: 'Agachamento no Smith', locais: ['academia'], carga: true, evitar: ['joelho'], dica: 'Pés um pouco à frente da barra. Desça com o tronco reto até as coxas ficarem paralelas ao chão.' },
    { id: 'passada', grupo: 'quadriceps', nome: 'Passada andando com halteres', locais: ['academia', 'halteres'], carga: true, evitar: ['joelho'], dica: 'Passos longos, alternando as pernas. O joelho de trás quase encosta no chão.' },
    { id: 'cadeira_extensora', grupo: 'quadriceps', nome: 'Cadeira extensora', locais: ['academia'], carga: true, evitar: ['joelho'], dica: 'Estenda as pernas até o fim, segure 1 segundo e desça devagar.' },
    { id: 'agachamento_goblet', grupo: 'quadriceps', nome: 'Agachamento com halter na frente do peito', locais: ['academia', 'halteres'], carga: true, evitar: ['lombar'], dica: 'Segure o halter junto ao peito e desça com a coluna reta.' },
    { id: 'agachamento_sumo', grupo: 'quadriceps', nome: 'Agachamento sumô com halter', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Pés bem afastados e pontas para fora. Segure o halter entre as pernas e desça com o tronco reto.' },
    { id: 'agachamento_bulgaro', grupo: 'quadriceps', nome: 'Agachamento búlgaro', locais: ['academia', 'halteres', 'casa'], carga: true, evitar: ['joelho'], dica: 'O pé de trás apoiado num banco ou cadeira. Desça o joelho de trás em direção ao chão. Faça um lado e depois o outro.' },
    { id: 'afundo', grupo: 'quadriceps', nome: 'Afundo', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['joelho'], dica: 'Passo largo à frente. Desça o joelho de trás em direção ao chão, tronco reto.' },
    { id: 'afundo_reverso', grupo: 'quadriceps', nome: 'Afundo para trás', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['joelho'], dica: 'Dê um passo para trás e desça o joelho de trás. Volte empurrando com a perna da frente.' },
    { id: 'subida_degrau', grupo: 'quadriceps', nome: 'Subida no degrau', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['joelho'], dica: 'Use um degrau firme e baixo. Suba apoiando o pé inteiro e desça devagar.' },
    { id: 'agachamento_peso', grupo: 'quadriceps', nome: 'Agachamento sem peso', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Braços à frente para equilibrar. Desça devagar e suba firme.' },
    { id: 'sentar_levantar', grupo: 'quadriceps', nome: 'Sentar e levantar da cadeira', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Movimento curto e controlado, bom para quem sente o joelho. Toque a cadeira e suba sem usar as mãos.' },
    { id: 'agachamento_parede', grupo: 'quadriceps', nome: 'Cadeirinha na parede', locais: ['casa', 'halteres', 'academia'], carga: false, tempo: true, evitar: [], dica: 'Costas na parede, desça só até onde não incomodar e segure parado.' },

    /* Glúteos e posterior da coxa */
    { id: 'stiff', grupo: 'posterior', nome: 'Stiff com halteres', locais: ['academia', 'halteres'], carga: true, evitar: ['lombar'], dica: 'Joelhos levemente dobrados. Leve o quadril para trás e desça os halteres rente às pernas.' },
    { id: 'levantamento_terra', grupo: 'posterior', nome: 'Levantamento terra', locais: ['academia'], carga: true, evitar: ['lombar'], dica: 'Barra rente às canelas e coluna reta. Empurre o chão com os pés e suba levando o quadril à frente.' },
    { id: 'cadeira_adutora', grupo: 'posterior', nome: 'Cadeira adutora', locais: ['academia'], carga: true, evitar: [], dica: 'Feche as pernas contra o apoio, segure 1 segundo e volte devagar.' },
    { id: 'mesa_flexora', grupo: 'posterior', nome: 'Mesa flexora', locais: ['academia'], carga: true, evitar: [], dica: 'Suba e desça devagar, sem tirar o quadril do banco.' },
    { id: 'cadeira_flexora', grupo: 'posterior', nome: 'Cadeira flexora', locais: ['academia'], carga: true, evitar: [], dica: 'Costas apoiadas. Dobre os joelhos puxando o apoio para baixo e volte devagar.' },
    { id: 'elevacao_pelvica', grupo: 'posterior', nome: 'Elevação de quadril com barra', locais: ['academia'], carga: true, evitar: [], dica: 'Costas apoiadas no banco e barra sobre o quadril, com proteção. Suba apertando o glúteo.' },
    { id: 'abducao_maquina', grupo: 'posterior', nome: 'Cadeira abdutora', locais: ['academia'], carga: true, evitar: [], dica: 'Abra as pernas contra o apoio, segure 1 segundo e volte devagar.' },
    { id: 'ponte_halter', grupo: 'posterior', nome: 'Elevação de quadril com halter', locais: ['halteres'], carga: true, evitar: [], dica: 'Deitado, com o halter sobre o quadril. Suba apertando o glúteo e desça devagar.' },
    { id: 'stiff_unilateral', grupo: 'posterior', nome: 'Stiff com uma perna', locais: ['academia', 'halteres', 'casa'], carga: true, evitar: ['lombar'], dica: 'Apoiado numa perna, leve o quadril para trás e o tronco à frente, com as costas retas. Segure numa parede se precisar.' },
    { id: 'ponte_gluteo', grupo: 'posterior', nome: 'Elevação de quadril (ponte)', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Deitado, pés no chão. Suba o quadril apertando o glúteo e segure 1 segundo no alto.' },
    { id: 'ponte_unilateral', grupo: 'posterior', nome: 'Ponte com uma perna', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Como a ponte, mas com uma perna estendida. Faça as repetições de um lado e depois do outro.' },
    { id: 'coice_gluteo', grupo: 'posterior', nome: 'Coice de glúteo em quatro apoios', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'De quatro, leve uma perna dobrada para trás e para cima, sem arquear a lombar.' },
    { id: 'abducao_deitado', grupo: 'posterior', nome: 'Abertura de perna deitado de lado', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Deitado de lado, suba a perna de cima devagar, com o pé reto, e desça sem encostar.' },

    /* Panturrilha */
    { id: 'panturrilha', grupo: 'panturrilha', nome: 'Panturrilha em pé', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Suba na ponta dos pés devagar e desça até o calcanhar quase tocar o chão.' },
    { id: 'panturrilha_sentado', grupo: 'panturrilha', nome: 'Panturrilha sentado', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Sentado, com o peso sobre os joelhos. Suba os calcanhares o máximo que der.' },
    { id: 'panturrilha_leg', grupo: 'panturrilha', nome: 'Panturrilha no leg press', locais: ['academia'], carga: true, evitar: [], dica: 'Só a ponta dos pés na plataforma. Empurre com os tornozelos, sem dobrar os joelhos.' },
    { id: 'panturrilha_unilateral', grupo: 'panturrilha', nome: 'Panturrilha em pé com uma perna', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Apoie a mão numa parede. Suba na ponta de um pé e desça devagar.' },
    { id: 'panturrilha_degrau', grupo: 'panturrilha', nome: 'Panturrilha no degrau', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Ponta dos pés na beira do degrau. Deixe o calcanhar descer abaixo do degrau e suba.' },

    /* Peito */
    { id: 'supino_reto', grupo: 'peito', nome: 'Supino reto com barra', locais: ['academia'], carga: true, evitar: ['ombro'], dica: 'Escápulas encaixadas no banco. Desça a barra até o meio do peito, com os cotovelos a uns 45 graus do corpo.' },
    { id: 'supino_halteres', grupo: 'peito', nome: 'Supino com halteres', locais: ['academia'], carga: true, evitar: [], dica: 'Desça os halteres devagar até a linha do peito e suba juntando-os no alto.' },
    { id: 'supino_maquina', grupo: 'peito', nome: 'Supino na máquina', locais: ['academia'], carga: true, evitar: [], dica: 'Ajuste o banco para as pegadas ficarem na linha do peito. Empurre sem travar os cotovelos.' },
    { id: 'supino_inclinado', grupo: 'peito', nome: 'Supino inclinado com halteres', locais: ['academia'], carga: true, evitar: ['ombro'], dica: 'Banco um pouco inclinado. Desça os halteres até a parte de cima do peito.' },
    { id: 'supino_declinado', grupo: 'peito', nome: 'Supino declinado', locais: ['academia'], carga: true, evitar: [], dica: 'Banco declinado, pés presos. Desça a barra até a parte de baixo do peito.' },
    { id: 'crucifixo_halteres', grupo: 'peito', nome: 'Crucifixo com halteres no banco', locais: ['academia'], carga: true, evitar: ['ombro'], dica: 'Braços abertos e cotovelos levemente dobrados. Desça até a linha do peito e junte no alto.' },
    { id: 'crucifixo_maquina', grupo: 'peito', nome: 'Voador (crucifixo na máquina)', locais: ['academia'], carga: true, evitar: [], dica: 'Cotovelos levemente dobrados. Junte os braços à frente e volte devagar, sem passar da linha do corpo.' },
    { id: 'crossover', grupo: 'peito', nome: 'Crossover na polia', locais: ['academia'], carga: true, evitar: [], dica: 'Um passo à frente, tronco um pouco inclinado. Traga as mãos para a frente do peito num arco.' },
    { id: 'supino_chao', grupo: 'peito', nome: 'Supino no chão com halteres', locais: ['halteres'], carga: true, evitar: [], dica: 'Deitado no chão, desça até os cotovelos encostarem de leve e suba.' },
    { id: 'crucifixo_chao', grupo: 'peito', nome: 'Crucifixo no chão com halteres', locais: ['halteres'], carga: true, evitar: [], dica: 'Deitado, braços abertos e cotovelos levemente dobrados. Junte os halteres acima do peito.' },
    { id: 'flexao', grupo: 'peito', nome: 'Flexão de braço', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Corpo reto da cabeça aos pés. Se estiver difícil, apoie os joelhos no chão.' },
    { id: 'flexao_inclinada', grupo: 'peito', nome: 'Flexão com as mãos num apoio alto', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Mãos num sofá, mesa ou banco firme. Quanto mais alto, mais fácil.' },
    { id: 'flexao_pausa', grupo: 'peito', nome: 'Flexão com pausa embaixo', locais: ['casa', 'halteres'], carga: false, evitar: [], dica: 'Desça devagar, pare 2 segundos perto do chão e suba. Apoie os joelhos se precisar.' },
    { id: 'flexao_declinada', grupo: 'peito', nome: 'Flexão com os pés num apoio', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['ombro'], dica: 'Pés numa cadeira ou degrau, corpo reto. Mais difícil que a flexão comum.' },

    /* Costas */
    { id: 'puxada_frente', grupo: 'costas', nome: 'Puxada na frente', locais: ['academia'], carga: true, evitar: [], dica: 'Puxe a barra até o alto do peito, levando os cotovelos para baixo e para trás.' },
    { id: 'puxada_neutra', grupo: 'costas', nome: 'Puxada com triângulo', locais: ['academia'], carga: true, evitar: [], dica: 'Pegada com as palmas viradas uma para a outra. Puxe até o peito, sem jogar o tronco para trás.' },
    { id: 'pulldown', grupo: 'costas', nome: 'Puxada com braços estendidos na polia', locais: ['academia'], carga: true, evitar: [], dica: 'Braços quase retos. Leve a barra da altura dos olhos até as coxas, num arco.' },
    { id: 'remada_baixa', grupo: 'costas', nome: 'Remada baixa', locais: ['academia'], carga: true, evitar: [], dica: 'Tronco firme. Puxe até a barriga, juntando as escápulas.' },
    { id: 'remada_maquina', grupo: 'costas', nome: 'Remada na máquina com apoio no peito', locais: ['academia'], carga: true, evitar: [], dica: 'Peito encostado no apoio. Puxe as pegadas juntando as escápulas e volte devagar.' },
    { id: 'remada_curvada', grupo: 'costas', nome: 'Remada curvada com barra', locais: ['academia'], carga: true, evitar: ['lombar'], dica: 'Tronco inclinado, costas retas. Puxe a barra até a barriga.' },
    { id: 'remada_halter', grupo: 'costas', nome: 'Remada com halter, um braço', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Apoie a mão e o joelho num banco ou cadeira. Puxe o halter em direção ao quadril.' },
    { id: 'remada_curvada_halteres', grupo: 'costas', nome: 'Remada curvada com halteres', locais: ['academia', 'halteres'], carga: true, evitar: ['lombar'], dica: 'Tronco inclinado, costas retas. Puxe os dois halteres junto ao corpo.' },
    { id: 'pullover', grupo: 'costas', nome: 'Pullover com halter', locais: ['academia', 'halteres'], carga: true, evitar: ['ombro'], dica: 'Deitado, segure um halter com as duas mãos acima do peito e leve-o para trás da cabeça, devagar.' },
    { id: 'remada_mesa', grupo: 'costas', nome: 'Remada deitado embaixo da mesa', locais: ['casa', 'halteres'], carga: false, evitar: [], dica: 'Só numa mesa pesada e firme. Segure a beira e puxe o peito em direção a ela, com o corpo reto.' },
    { id: 'barra_fixa', grupo: 'costas', nome: 'Barra fixa', locais: ['academia'], carga: false, evitar: [], dica: 'Pegada um pouco mais aberta que os ombros. Puxe até o queixo passar a barra. Use o graviton ou um elástico se precisar.' },
    { id: 'remada_cavalinho', grupo: 'costas', nome: 'Remada cavalinho', locais: ['academia'], carga: true, evitar: ['lombar'], dica: 'Tronco inclinado e coluna reta. Puxe a barra até a barriga, juntando as escápulas.' },
    { id: 'encolhimento', grupo: 'costas', nome: 'Encolhimento de ombros', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Braços estendidos. Suba os ombros em direção às orelhas, segure 1 segundo e desça.' },
    { id: 'remada_mochila', grupo: 'costas', nome: 'Remada com mochila', locais: ['casa'], carga: false, evitar: [], dica: 'Coloque livros numa mochila. Incline o tronco, costas retas, e puxe a mochila até a barriga.' },
    { id: 'remada_mochila_um', grupo: 'costas', nome: 'Remada com mochila, um braço', locais: ['casa'], carga: false, evitar: [], dica: 'Mão livre apoiada numa cadeira. Puxe a mochila até o quadril e desça devagar.' },
    { id: 'superman_y', grupo: 'costas', nome: 'Elevação em Y deitado de bruços', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'De bruços, braços em Y. Tire os braços do chão juntando as escápulas, sem forçar o pescoço.' },

    /* Ombros */
    { id: 'desenvolvimento', grupo: 'ombros', nome: 'Desenvolvimento com halteres', locais: ['academia', 'halteres'], carga: true, evitar: ['ombro'], dica: 'Sentado, suba os halteres acima da cabeça sem travar os cotovelos.' },
    { id: 'desenvolvimento_maquina', grupo: 'ombros', nome: 'Desenvolvimento na máquina', locais: ['academia'], carga: true, evitar: ['ombro'], dica: 'Costas apoiadas. Empurre para cima sem arquear a lombar.' },
    { id: 'desenvolvimento_arnold', grupo: 'ombros', nome: 'Desenvolvimento Arnold', locais: ['academia', 'halteres'], carga: true, evitar: ['ombro'], dica: 'Comece com as palmas viradas para você e gire enquanto sobe os halteres.' },
    { id: 'elevacao_lateral', grupo: 'ombros', nome: 'Elevação lateral', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Peso leve. Suba os braços para os lados até a altura dos ombros.' },
    { id: 'elevacao_lateral_polia', grupo: 'ombros', nome: 'Elevação lateral na polia', locais: ['academia'], carga: true, evitar: [], dica: 'De lado para a polia, puxe o cabo para o lado até a altura do ombro.' },
    { id: 'elevacao_frontal', grupo: 'ombros', nome: 'Elevação frontal', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Suba os halteres à frente até a altura dos ombros, sem balançar o tronco.' },
    { id: 'crucifixo_inverso', grupo: 'ombros', nome: 'Crucifixo inverso', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Tronco inclinado à frente. Abra os braços para os lados, trabalhando a parte de trás do ombro.' },
    { id: 'face_pull', grupo: 'ombros', nome: 'Puxada na polia até o rosto', locais: ['academia'], carga: true, evitar: [], dica: 'Corda na altura do rosto. Puxe abrindo os cotovelos para os lados.' },
    { id: 'pike', grupo: 'ombros', nome: 'Flexão com quadril alto (ombros)', locais: ['casa', 'halteres'], carga: false, evitar: ['ombro'], dica: 'Quadril alto, formando um V. Desça a cabeça em direção ao chão entre as mãos.' },
    { id: 'elevacao_garrafa', grupo: 'ombros', nome: 'Elevação lateral com garrafas', locais: ['casa'], carga: false, evitar: [], dica: 'Use garrafas de água. Suba os braços para os lados até a altura dos ombros.' },
    { id: 'elevacao_frontal_garrafa', grupo: 'ombros', nome: 'Elevação frontal com garrafas', locais: ['casa'], carga: false, evitar: [], dica: 'Suba as garrafas à frente até a altura dos ombros e desça devagar.' },
    { id: 'crucifixo_inverso_garrafa', grupo: 'ombros', nome: 'Crucifixo inverso com garrafas', locais: ['casa'], carga: false, evitar: [], dica: 'Tronco inclinado à frente. Abra os braços para os lados com as garrafas.' },

    /* Bíceps */
    { id: 'rosca_direta', grupo: 'biceps', nome: 'Rosca direta', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Cotovelos colados ao corpo. Suba sem balançar o tronco.' },
    { id: 'rosca_martelo', grupo: 'biceps', nome: 'Rosca martelo', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Palmas viradas para o corpo, como quem segura um martelo. Suba e desça devagar.' },
    { id: 'rosca_concentrada', grupo: 'biceps', nome: 'Rosca concentrada', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Sentado, cotovelo apoiado na parte de dentro da coxa. Suba o halter devagar.' },
    { id: 'rosca_polia', grupo: 'biceps', nome: 'Rosca na polia', locais: ['academia'], carga: true, evitar: [], dica: 'Cotovelos parados ao lado do corpo. Suba a barra até o peito.' },
    { id: 'rosca_mochila', grupo: 'biceps', nome: 'Rosca com mochila ou galão', locais: ['casa'], carga: false, evitar: [], dica: 'Segure pela alça e dobre os cotovelos, mantendo-os junto ao corpo.' },
    { id: 'rosca_martelo_garrafa', grupo: 'biceps', nome: 'Rosca martelo com garrafas', locais: ['casa'], carga: false, evitar: [], dica: 'Garrafas cheias, palmas viradas para o corpo. Suba e desça devagar.' },
    { id: 'rosca_alternada', grupo: 'biceps', nome: 'Rosca alternada', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Um braço de cada vez, girando a palma para cima enquanto sobe.' },
    { id: 'rosca_scott', grupo: 'biceps', nome: 'Rosca Scott', locais: ['academia'], carga: true, evitar: [], dica: 'Braços apoiados no banco Scott. Desça até quase estender e suba sem tirar os cotovelos do apoio.' },
    { id: 'rosca_spider', grupo: 'biceps', nome: 'Rosca spider', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Peito apoiado num banco inclinado, braços pendurados. Suba os halteres sem levar os cotovelos para a frente.' },
    { id: 'rosca_inclinada', grupo: 'biceps', nome: 'Rosca no banco inclinado', locais: ['academia'], carga: true, evitar: ['ombro'], dica: 'Costas no banco inclinado e braços para trás do corpo. Suba devagar, sentindo o alongamento.' },
    { id: 'rosca_barra_w', grupo: 'biceps', nome: 'Rosca com barra W', locais: ['academia'], carga: true, evitar: [], dica: 'Pegada na curva da barra. Cotovelos parados ao lado do corpo.' },
    { id: 'rosca_inversa', grupo: 'biceps', nome: 'Rosca inversa', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Palmas viradas para baixo. Trabalha o antebraço junto com o bíceps.' },
    { id: 'rosca_toalha', grupo: 'biceps', nome: 'Rosca parada com toalha', locais: ['casa'], carga: false, tempo: true, evitar: [], dica: 'Pise no meio de uma toalha e puxe as pontas, com os cotovelos dobrados a 90 graus. Segure firme.' },

    /* Tríceps */
    { id: 'triceps_polia', grupo: 'triceps', nome: 'Tríceps na polia', locais: ['academia'], carga: true, evitar: [], dica: 'Cotovelos parados ao lado do corpo. Estenda os braços até o fim.' },
    { id: 'triceps_corda', grupo: 'triceps', nome: 'Tríceps na polia com corda', locais: ['academia'], carga: true, evitar: [], dica: 'Estenda os braços e abra a corda no fim do movimento.' },
    { id: 'triceps_testa', grupo: 'triceps', nome: 'Tríceps testa com halteres', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Deitado, cotovelos apontando para cima. Desça os halteres ao lado da cabeça e estenda.' },
    { id: 'triceps_coice', grupo: 'triceps', nome: 'Tríceps coice com halter', locais: ['academia', 'halteres'], carga: true, evitar: [], dica: 'Tronco inclinado, cotovelo colado ao corpo. Estenda o braço para trás.' },
    { id: 'triceps_frances', grupo: 'triceps', nome: 'Tríceps francês com halter', locais: ['academia', 'halteres'], carga: true, evitar: ['ombro'], dica: 'Halter atrás da cabeça, cotovelos apontando para cima.' },
    { id: 'supino_fechado', grupo: 'triceps', nome: 'Supino com pegada fechada', locais: ['academia'], carga: true, evitar: [], dica: 'Mãos na largura dos ombros e cotovelos junto ao corpo. Desça a barra até a parte de baixo do peito.' },
    { id: 'mergulho_paralelas', grupo: 'triceps', nome: 'Mergulho nas paralelas', locais: ['academia'], carga: false, evitar: ['ombro'], dica: 'Tronco reto e cotovelos para trás. Desça até os braços ficarem a 90 graus e suba.' },
    { id: 'triceps_cadeira', grupo: 'triceps', nome: 'Tríceps na cadeira', locais: ['casa', 'halteres'], carga: false, evitar: ['ombro'], dica: 'Mãos na beira de uma cadeira firme. Desça dobrando os cotovelos para trás.' },
    { id: 'triceps_fechada', grupo: 'triceps', nome: 'Flexão com as mãos juntas', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Como a flexão, com as mãos mais próximas. Apoie os joelhos se precisar.' },
    { id: 'triceps_garrafa', grupo: 'triceps', nome: 'Tríceps acima da cabeça com garrafa', locais: ['casa'], carga: false, evitar: ['ombro'], dica: 'Segure uma garrafa com as duas mãos atrás da cabeça e estenda os braços para cima.' },
    { id: 'triceps_coice_garrafa', grupo: 'triceps', nome: 'Tríceps coice com garrafa', locais: ['casa'], carga: false, evitar: [], dica: 'Tronco inclinado, cotovelo colado ao corpo. Estenda o braço para trás.' },

    /* Abdômen */
    { id: 'prancha', grupo: 'abdomen', nome: 'Prancha', locais: ['casa', 'halteres', 'academia'], carga: false, tempo: true, evitar: [], dica: 'Cotovelos embaixo dos ombros, barriga firme, sem deixar o quadril cair.' },
    { id: 'dead_bug', grupo: 'abdomen', nome: 'Abdominal dead bug', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Deitado, lombar colada no chão. Estenda braço e perna opostos devagar.' },
    { id: 'prancha_lateral', grupo: 'abdomen', nome: 'Prancha lateral', locais: ['casa', 'halteres', 'academia'], carga: false, tempo: true, evitar: ['ombro'], dica: 'Apoio no antebraço, corpo em linha reta. Faça dos dois lados.' },
    { id: 'perdigueiro', grupo: 'abdomen', nome: 'Perdigueiro em quatro apoios', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'De quatro, estenda braço e perna opostos, segure 2 segundos e troque. Coluna parada.' },
    { id: 'abdominal_curto', grupo: 'abdomen', nome: 'Abdominal curto', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Deitado, joelhos dobrados. Tire só os ombros do chão, sem puxar o pescoço.' },
    { id: 'abdominal_bicicleta', grupo: 'abdomen', nome: 'Abdominal bicicleta', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: [], dica: 'Leve o cotovelo em direção ao joelho oposto, alternando os lados, devagar.' },
    { id: 'elevacao_pernas', grupo: 'abdomen', nome: 'Elevação de pernas deitado', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['lombar'], dica: 'Lombar colada no chão. Suba as pernas juntas e desça sem encostar no chão.' },
    { id: 'abdominal_infra', grupo: 'abdomen', nome: 'Abdominal infra', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['lombar'], dica: 'Deitado, pernas dobradas. Leve os joelhos em direção ao peito tirando o quadril do chão.' },
    { id: 'abdominal_polia', grupo: 'abdomen', nome: 'Abdominal na polia', locais: ['academia'], carga: true, evitar: [], dica: 'Ajoelhado, corda junto à cabeça. Enrole o tronco para baixo, sem puxar com os braços.' },
    { id: 'roda_abdominal', grupo: 'abdomen', nome: 'Roda abdominal', locais: ['casa', 'halteres', 'academia'], carga: false, evitar: ['lombar'], dica: 'Ajoelhado, role a roda à frente até onde a lombar não cair, e volte.' },
    { id: 'pallof', grupo: 'abdomen', nome: 'Antirrotação na polia', locais: ['academia'], carga: true, evitar: [], dica: 'De lado para a polia, segure o cabo junto ao peito e estenda os braços sem deixar o tronco girar.' }
  ];

  var GRUPOS = [
    { id: 'peito', rotulo: 'Peito' },
    { id: 'costas', rotulo: 'Costas' },
    { id: 'ombros', rotulo: 'Ombros' },
    { id: 'biceps', rotulo: 'Bíceps' },
    { id: 'triceps', rotulo: 'Tríceps' },
    { id: 'quadriceps', rotulo: 'Pernas' },
    { id: 'posterior', rotulo: 'Glúteos e posterior' },
    { id: 'panturrilha', rotulo: 'Panturrilha' },
    { id: 'abdomen', rotulo: 'Abdômen' }
  ];

  // Cada movimento tem opções, em ordem de preferência. As 3 opções de cada treino
  // pegam a 1ª, a 2ª e a 3ª que servem para o local e os cuidados da pessoa.
  var MOVIMENTOS = {
    pernas: ['agachamento_livre', 'leg_press', 'agachamento_goblet', 'hack', 'agachamento_smith', 'agachamento_sumo', 'agachamento_peso', 'agachamento_bulgaro', 'sentar_levantar', 'agachamento_parede'],
    posterior: ['stiff', 'mesa_flexora', 'cadeira_flexora', 'ponte_halter', 'ponte_gluteo', 'stiff_unilateral', 'ponte_unilateral'],
    unilateral: ['afundo', 'agachamento_bulgaro', 'afundo_reverso', 'subida_degrau', 'ponte_unilateral', 'coice_gluteo'],
    panturrilha: ['panturrilha', 'panturrilha_sentado', 'panturrilha_leg', 'panturrilha_unilateral', 'panturrilha_degrau'],
    peito: ['supino_reto', 'supino_halteres', 'supino_maquina', 'supino_chao', 'flexao', 'flexao_pausa', 'flexao_inclinada'],
    costas_vertical: ['puxada_frente', 'puxada_neutra', 'pulldown', 'barra_fixa', 'remada_halter', 'pullover', 'remada_mesa', 'remada_mochila'],
    costas: ['remada_baixa', 'remada_maquina', 'remada_curvada', 'remada_halter', 'remada_curvada_halteres', 'remada_mochila', 'remada_mesa', 'remada_mochila_um', 'superman_y'],
    ombros: ['desenvolvimento', 'desenvolvimento_maquina', 'pike', 'elevacao_lateral', 'elevacao_frontal', 'elevacao_garrafa', 'elevacao_frontal_garrafa'],
    ombro_lateral: ['elevacao_lateral', 'elevacao_lateral_polia', 'crucifixo_inverso', 'elevacao_garrafa', 'crucifixo_inverso_garrafa', 'face_pull'],
    biceps: ['rosca_direta', 'rosca_martelo', 'rosca_polia', 'rosca_concentrada', 'rosca_mochila', 'rosca_martelo_garrafa', 'rosca_toalha'],
    triceps: ['triceps_polia', 'triceps_corda', 'triceps_testa', 'triceps_frances', 'triceps_coice', 'triceps_fechada', 'triceps_cadeira', 'triceps_coice_garrafa', 'triceps_garrafa'],
    abdomen: ['prancha', 'dead_bug', 'perdigueiro', 'abdominal_curto', 'prancha_lateral', 'abdominal_bicicleta'],

    // Exercícios a mais para quem escolhe um foco
    peito_extra: ['supino_inclinado', 'crucifixo_maquina', 'crossover', 'crucifixo_chao', 'flexao_inclinada', 'flexao_declinada', 'flexao_pausa', 'supino_declinado', 'crucifixo_halteres'],
    costas_extra: ['remada_maquina', 'pulldown', 'remada_curvada_halteres', 'puxada_neutra', 'remada_mochila_um', 'superman_y', 'barra_fixa', 'remada_cavalinho', 'encolhimento'],
    ombros_extra: ['crucifixo_inverso', 'elevacao_lateral_polia', 'face_pull', 'elevacao_frontal', 'crucifixo_inverso_garrafa', 'elevacao_frontal_garrafa', 'desenvolvimento_arnold'],
    biceps_extra: ['rosca_martelo', 'rosca_concentrada', 'rosca_polia', 'rosca_martelo_garrafa', 'rosca_toalha', 'rosca_scott', 'rosca_spider', 'rosca_alternada', 'rosca_inclinada', 'rosca_barra_w'],
    triceps_extra: ['triceps_corda', 'triceps_coice', 'triceps_testa', 'triceps_coice_garrafa', 'triceps_fechada', 'supino_fechado', 'mergulho_paralelas'],
    pernas_extra: ['cadeira_extensora', 'agachamento_bulgaro', 'hack', 'agachamento_sumo', 'afundo_reverso', 'subida_degrau', 'agachamento_parede', 'sentar_levantar', 'passada', 'agachamento_smith'],
    gluteos_extra: ['elevacao_pelvica', 'abducao_maquina', 'ponte_halter', 'coice_gluteo', 'abducao_deitado', 'ponte_unilateral', 'levantamento_terra', 'cadeira_adutora'],
    abdomen_extra: ['abdominal_curto', 'abdominal_bicicleta', 'pallof', 'perdigueiro', 'elevacao_pernas', 'abdominal_infra', 'abdominal_polia', 'roda_abdominal']
  };

  // O grupo de cada movimento, para saber o que cada treino trabalha
  var GRUPO_DO_MOVIMENTO = {
    pernas: 'quadriceps', unilateral: 'quadriceps', posterior: 'posterior', panturrilha: 'panturrilha',
    peito: 'peito', costas_vertical: 'costas', costas: 'costas', ombros: 'ombros', ombro_lateral: 'ombros',
    biceps: 'biceps', triceps: 'triceps', abdomen: 'abdomen',
    peito_extra: 'peito', costas_extra: 'costas', ombros_extra: 'ombros', biceps_extra: 'biceps', triceps_extra: 'triceps',
    pernas_extra: 'quadriceps', gluteos_extra: 'posterior', abdomen_extra: 'abdomen'
  };

  // Focos: a pessoa escolhe até dois. O treino ganha exercícios a mais desses grupos
  // e uma série a mais em cada exercício deles.
  var FOCOS = [
    { id: 'peito', rotulo: 'Peito', grupos: ['peito'], extras: ['peito_extra'] },
    { id: 'costas', rotulo: 'Costas', grupos: ['costas'], extras: ['costas_extra'] },
    { id: 'ombros', rotulo: 'Ombros', grupos: ['ombros'], extras: ['ombros_extra'] },
    { id: 'bracos', rotulo: 'Braços', grupos: ['biceps', 'triceps'], extras: ['biceps_extra', 'triceps_extra'] },
    { id: 'pernas', rotulo: 'Pernas', grupos: ['quadriceps', 'panturrilha'], extras: ['pernas_extra'] },
    { id: 'gluteos', rotulo: 'Glúteos', grupos: ['posterior'], extras: ['gluteos_extra'] },
    { id: 'abdomen', rotulo: 'Abdômen', grupos: ['abdomen'], extras: ['abdomen_extra'] }
  ];
  var MAXIMO_FOCOS = 2;
  var VARIACOES = 3;

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

  // Para os exercícios criados pela pessoa: o músculo sai do nome.
  // A ordem importa: os termos mais específicos vêm antes dos gerais.
  var PALAVRAS = [
    ['crucifixo inverso', 'ombros'], ['voador inverso', 'ombros'], ['face pull', 'ombros'], ['elevacao lateral', 'ombros'], ['elevacao frontal', 'ombros'],
    ['elevacao de perna', 'abdomen'], ['elevacao das perna', 'abdomen'],
    ['gluteo', 'posterior'], ['pelvica', 'posterior'], ['quadril', 'posterior'], ['stiff', 'posterior'], ['flexora', 'posterior'], ['terra', 'posterior'],
    ['abdutora', 'posterior'], ['adutora', 'posterior'], ['good morning', 'posterior'], ['posterior', 'posterior'], ['isquio', 'posterior'],
    ['panturrilha', 'panturrilha'], ['gemeo', 'panturrilha'], ['soleo', 'panturrilha'],
    ['triceps', 'triceps'], ['testa', 'triceps'], ['frances', 'triceps'], ['coice', 'triceps'], ['mergulho', 'triceps'], ['paralela', 'triceps'], ['supino fechado', 'triceps'], ['pegada fechada', 'triceps'],
    ['rosca', 'biceps'], ['biceps', 'biceps'], ['scott', 'biceps'], ['spider', 'biceps'], ['martelo', 'biceps'], ['antebraco', 'biceps'],
    ['abdominal', 'abdomen'], ['abdomen', 'abdomen'], ['prancha', 'abdomen'], ['crunch', 'abdomen'], ['infra', 'abdomen'], ['obliquo', 'abdomen'], ['canivete', 'abdomen'],
    ['supino', 'peito'], ['crucifixo', 'peito'], ['voador', 'peito'], ['peck', 'peito'], ['crossover', 'peito'], ['cross over', 'peito'], ['flexao', 'peito'], ['peito', 'peito'], ['peitoral', 'peito'],
    ['puxada', 'costas'], ['remada', 'costas'], ['pulldown', 'costas'], ['barra fixa', 'costas'], ['pullover', 'costas'], ['serrote', 'costas'], ['graviton', 'costas'],
    ['costas', 'costas'], ['dorsal', 'costas'], ['encolhimento', 'costas'], ['trapezio', 'costas'], ['lombar', 'costas'],
    ['desenvolvimento', 'ombros'], ['arnold', 'ombros'], ['ombro', 'ombros'], ['deltoide', 'ombros'], ['militar', 'ombros'],
    ['agachamento', 'quadriceps'], ['leg', 'quadriceps'], ['extensora', 'quadriceps'], ['afundo', 'quadriceps'], ['passada', 'quadriceps'], ['hack', 'quadriceps'],
    ['bulgaro', 'quadriceps'], ['sissy', 'quadriceps'], ['avanco', 'quadriceps'], ['quadriceps', 'quadriceps'], ['coxa', 'quadriceps'], ['perna', 'quadriceps']
  ];
  var SEM_PESO = ['prancha', 'flexao', 'barra fixa', 'sem peso', 'peso do corpo', 'abdominal', 'mergulho', 'canivete', 'perdigueiro'];
  var POR_TEMPO = ['prancha', 'isometri', 'parado', 'segurar', 'cadeirinha'];

  function normalizar(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Devolve o grupo, se usa peso e se conta tempo, adivinhados pelo nome
  function classificar(nome) {
    var n = ' ' + normalizar(nome) + ' ';
    var achado = PALAVRAS.filter(function (p) { return n.indexOf(p[0]) !== -1; })[0];
    var tem = function (lista) { return lista.some(function (p) { return n.indexOf(p) !== -1; }); };
    return { grupo: achado ? achado[1] : '', carga: !tem(SEM_PESO), tempo: tem(POR_TEMPO) };
  }

  function indice(lista) {
    var mapa = {};
    lista.forEach(function (i) { mapa[i.id] = i; });
    return mapa;
  }

  return {
    EXERCICIOS: EXERCICIOS, GRUPOS: GRUPOS, MOVIMENTOS: MOVIMENTOS, GRUPO_DO_MOVIMENTO: GRUPO_DO_MOVIMENTO,
    classificar: classificar, normalizar: normalizar,
    FOCOS: FOCOS, MAXIMO_FOCOS: MAXIMO_FOCOS, VARIACOES: VARIACOES, DIVISOES: DIVISOES,
    OBJETIVOS: OBJETIVOS, NIVEIS: NIVEIS, LOCAIS: LOCAIS, TEMPOS: TEMPOS, CUIDADOS: CUIDADOS, ESFORCOS: ESFORCOS,
    porExercicio: indice(EXERCICIOS), porGrupo: indice(GRUPOS), porFoco: indice(FOCOS),
    porObjetivo: indice(OBJETIVOS), porNivel: indice(NIVEIS), porTempo: indice(TEMPOS)
  };
})();
