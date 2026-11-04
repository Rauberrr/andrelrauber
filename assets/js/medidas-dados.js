/* ==========================================================================
   Fonte única das medidas: o formulário e o guia são gerados a partir daqui.
   Para mudar um texto ou acrescentar uma medida, edite só este arquivo.

   id     nome do campo (igual à coluna no banco de dados, se for ligado)
   min/max  faixa comum, em cm ou kg. Fora dela o site só pede para conferir.
   ajuda  frase curta que aparece abaixo do campo
   como   explicação completa do guia
   erro   erro mais comum ao tirar essa medida
   marca  desenho da fita na figura: linhas (l), voltas (v) e apoio tracejado (t)
   recorte  área da figura mostrada no guia: x y largura altura
   ========================================================================== */
window.AR_MEDIDAS = (function () {
  'use strict';

  var geral = [
    {
      id: 'altura', rotulo: 'Altura', unidade: 'cm', min: 140, max: 215,
      ajuda: 'Descalço, de costas para a parede.',
      como: 'Fique descalço, com os calcanhares encostados na parede e olhando para a frente. Marque a parede no ponto mais alto da cabeça e meça do chão até a marca.',
      erro: 'Informar a altura de memória. Vale conferir, porque ela orienta a proporção de toda a peça.',
      marca: { l: [[268, 12, 268, 712]], t: [[230, 12, 268, 12], [190, 712, 268, 712]] }, recorte: '0 0 300 724'
    },
    {
      id: 'peso', rotulo: 'Peso', unidade: 'kg', min: 40, max: 200,
      ajuda: 'Aproximado. Ajuda a conferir o conjunto das medidas.',
      como: 'Informe seu peso atual, mesmo que aproximado. Ele não entra no molde: serve para conferir se as medidas fazem sentido em conjunto.',
      erro: 'Deixar de avisar se você está ganhando ou perdendo peso. Nesse caso, conte nas observações.',
      marca: {}, recorte: '0 0 300 724'
    }
  ];

  var cima = [
    {
      id: 'pescoco', rotulo: 'Pescoço', unidade: 'cm', min: 28, max: 60,
      ajuda: 'Na base do pescoço, onde a gola fecha, com um dedo de folga.',
      como: 'Passe a fita em volta da base do pescoço, logo abaixo do pomo de adão, onde a gola da camisa fecha. Deixe um dedo entre a fita e a pele.',
      erro: 'Medir no meio do pescoço. A gola fica na base, e a medida sai menor do que deveria.',
      marca: { v: [[150, 96, 18, 5, 0]] }, recorte: '65 40 170 227'
    },
    {
      id: 'ombro', rotulo: 'Ombro a ombro', unidade: 'cm', min: 30, max: 65,
      ajuda: 'Pelas costas, da ponta de um ombro até a ponta do outro.',
      como: 'Com os braços relaxados, peça para alguém medir pelas costas, do osso da ponta de um ombro até o osso da ponta do outro, acompanhando a curva da base do pescoço.',
      erro: 'Medir pela frente ou passar da ponta do ombro. Essa medida define onde a costura da manga cai.',
      marca: { l: [[78, 124, 150, 112], [150, 112, 222, 124]], p: [[78, 124], [222, 124]] }, recorte: '40 50 220 293'
    },
    {
      id: 'torax', rotulo: 'Tórax', unidade: 'cm', min: 70, max: 170,
      ajuda: 'Na parte mais larga do peito, com a fita reta e a respiração normal.',
      como: 'Passe a fita por baixo das axilas e pela parte mais larga do peito, reta e paralela ao chão. Solte o ar normalmente e deixe os braços caídos para medir.',
      erro: 'Encher o peito ou deixar a fita descer nas costas. Se puder, peça ajuda para conferir a parte de trás.',
      marca: { v: [[150, 180, 60, 8, 0]] }, recorte: '30 90 240 320'
    },
    {
      id: 'cintura_cima', rotulo: 'Cintura', unidade: 'cm', min: 55, max: 170,
      ajuda: 'Na linha do umbigo, com a barriga relaxada.',
      como: 'Passe a fita na linha do umbigo, a parte mais estreita do tronco na maioria dos corpos. Mantenha a barriga relaxada e a fita paralela ao chão. Esta é a cintura da camisa e do blazer.',
      erro: 'Encolher a barriga. A peça precisa funcionar também quando você está sentado e depois de comer.',
      marca: { v: [[150, 268, 51, 7, 0]] }, recorte: '30 170 240 320'
    },
    {
      id: 'manga', rotulo: 'Comprimento da manga', unidade: 'cm', min: 45, max: 80,
      ajuda: 'Da ponta do ombro até o osso do punho, com o braço levemente dobrado.',
      como: 'Dobre um pouco o braço. Meça da ponta do ombro, passando pelo cotovelo, até o osso saliente do punho, seguindo a parte de fora do braço.',
      erro: 'Medir com o braço totalmente esticado. A manga fica curta quando você dobra o braço.',
      marca: { l: [[62, 134, 40, 278], [40, 278, 26, 384]], p: [[62, 134], [26, 384]] }, recorte: '0 100 200 340'
    },
    {
      id: 'braco', rotulo: 'Largura do braço', unidade: 'cm', min: 20, max: 60,
      ajuda: 'Na parte mais grossa do braço, com o músculo relaxado.',
      como: 'Com o braço solto ao lado do corpo, passe a fita em volta da parte mais grossa, entre o ombro e o cotovelo. Não faça força.',
      erro: 'Contrair o bíceps. A medida passa a não representar o braço no dia a dia.',
      marca: { v: [[69, 215, 15, 4, -8]] }, recorte: '10 130 170 227'
    },
    {
      id: 'punho', rotulo: 'Punho', unidade: 'cm', min: 13, max: 30,
      ajuda: 'Logo abaixo do osso do punho, com um dedo de folga.',
      como: 'Passe a fita em volta do punho, logo abaixo do osso saliente, deixando um dedo de folga. Se usa relógio, conte nas observações.',
      erro: 'Apertar a fita. O punho da camisa precisa de folga para abotoar com conforto.',
      marca: { v: [[46, 384, 11, 3, -6]] }, recorte: '0 320 130 173'
    },
    {
      id: 'comprimento_peca', rotulo: 'Comprimento da peça', unidade: 'cm', min: 50, max: 100,
      ajuda: 'Pelas costas, da base do pescoço até onde quer que a peça termine.',
      como: 'Incline a cabeça para encontrar o osso saliente na base do pescoço. Peça para alguém medir desse ponto, em linha reta pelas costas, até onde você quer que a peça termine.',
      erro: 'Medir uma camisa do armário sem avisar. Se fizer assim, conte qual peça usou nas observações.',
      marca: { l: [[150, 106, 150, 366]], p: [[150, 106], [150, 366]] }, recorte: '30 80 240 320'
    }
  ];

  var baixo = [
    {
      id: 'cintura_baixo', rotulo: 'Cintura', unidade: 'cm', min: 55, max: 170,
      ajuda: 'Na altura em que você costuma usar a calça.',
      como: 'Passe a fita onde o cós da calça costuma ficar, normalmente um pouco abaixo do umbigo. Mantenha a fita reta e sem apertar.',
      erro: 'Copiar a cintura da camisa. As duas ficam em alturas diferentes e os valores quase nunca coincidem.',
      marca: { v: [[150, 296, 55, 7, 0]] }, recorte: '30 200 240 320'
    },
    {
      id: 'quadril', rotulo: 'Quadril', unidade: 'cm', min: 70, max: 170,
      ajuda: 'Na parte mais larga do quadril e dos glúteos, com os pés juntos.',
      como: 'Com os pés juntos, passe a fita pela parte mais larga dos glúteos, reta e paralela ao chão. Confira no espelho se ela não subiu atrás.',
      erro: 'Medir com a carteira ou o celular no bolso. Vista roupa fina e esvazie os bolsos.',
      marca: { v: [[150, 345, 61, 8, 0]] }, recorte: '30 240 240 320'
    },
    {
      id: 'gancho', rotulo: 'Gancho', unidade: 'cm', min: 50, max: 100,
      ajuda: 'Da cintura na frente, por entre as pernas, até a cintura atrás.',
      como: 'Comece na cintura da frente, na altura em que usa a calça. Passe a fita por entre as pernas, sem apertar, e suba até a mesma altura nas costas.',
      erro: 'Deixar a fita frouxa ou apertada demais. Esta medida define o conforto ao sentar e o caimento na frente.',
      marca: { l: [[150, 296, 150, 386]], t: [[150, 386, 150, 408]], p: [[150, 296]] }, recorte: '30 230 240 320'
    },
    {
      id: 'coxa', rotulo: 'Coxa', unidade: 'cm', min: 35, max: 90,
      ajuda: 'Na parte mais grossa, perto da virilha, com a perna relaxada.',
      como: 'Com o peso distribuído nas duas pernas, passe a fita na parte mais grossa da coxa, bem perto da virilha, e mantenha-a reta.',
      erro: 'Medir no meio da coxa. A parte mais grossa fica lá em cima, e é ela que define a folga.',
      marca: { v: [[120, 420, 30, 6, 0]] }, recorte: '40 340 200 267'
    },
    {
      id: 'joelho', rotulo: 'Joelho', unidade: 'cm', min: 28, max: 60,
      ajuda: 'Em volta do centro do joelho, com a perna esticada.',
      como: 'Com a perna esticada e relaxada, passe a fita em volta do centro do joelho. Essa medida ajuda a desenhar a linha da perna.',
      erro: 'Medir com o joelho dobrado. A medida aumenta e a linha da calça perde a forma.',
      marca: { v: [[121, 530, 22, 5, 0]] }, recorte: '40 450 200 267'
    },
    {
      id: 'boca', rotulo: 'Boca da calça', unidade: 'cm', min: 25, max: 70,
      ajuda: 'Contorno da barra. Medindo uma calça aberta sobre a mesa, multiplique por 2.',
      como: 'Decida a abertura da barra. O jeito mais fácil é pegar uma calça de que você gosta, esticar a barra sobre a mesa, medir de lado a lado e multiplicar por 2.',
      erro: 'Informar só a largura da calça dobrada. O campo pede o contorno inteiro da barra.',
      marca: { v: [[124, 672, 17, 4, 0]] }, recorte: '40 524 200 200'
    },
    {
      id: 'comprimento_total', rotulo: 'Comprimento total', unidade: 'cm', min: 70, max: 125,
      ajuda: 'Pela lateral, da cintura até onde a barra deve terminar.',
      como: 'Calce o tipo de sapato que vai usar com a calça. Meça pela lateral do corpo, da altura da cintura até onde você quer que a barra termine.',
      erro: 'Medir descalço para uma calça de usar com sapato. Vale conferir com o calçado.',
      marca: { l: [[78, 296, 96, 700]], p: [[78, 296], [96, 700]] }, recorte: '0 270 300 454'
    }
  ];

  return { geral: geral, cima: cima, baixo: baixo };
})();

/* Desenha a figura. Tudo em SVG, sem imagens: fica nítido em qualquer tela. */
window.AR_FIGURA = (function () {
  'use strict';

  // Metade esquerda do corpo. A direita é o espelho desta linha.
  var CONTORNO = 'M135 84 L135 102 C125 112 100 114 86 120 C72 126 66 142 63 165 ' +
    'L50 280 L36 382 C32 400 32 418 38 428 C44 434 50 428 52 415 L56 385 L74 285 L90 185 ' +
    'C92 215 98 245 100 268 C100 295 92 315 90 345 C88 400 94 470 100 530 C100 580 108 640 112 682 ' +
    'C108 695 100 706 104 712 L140 712 C142 700 138 690 136 680 C140 620 144 580 142 530 ' +
    'C146 480 150 430 150 385';
  // O preenchimento fecha no centro; o traço fica aberto, para não riscar o meio do corpo
  var PREENCHIMENTO = 'M150 84 L' + CONTORNO.slice(1) + ' Z';
  var ESPELHO = ' transform="translate(300 0) scale(-1 1)"';

  function marca(m) {
    if (!m) return '';
    var saida = '';
    (m.t || []).forEach(function (s) {
      saida += '<line class="fig-fita fig-fita-apoio" x1="' + s[0] + '" y1="' + s[1] + '" x2="' + s[2] + '" y2="' + s[3] + '"/>';
    });
    (m.l || []).forEach(function (s) {
      saida += '<line class="fig-fita" x1="' + s[0] + '" y1="' + s[1] + '" x2="' + s[2] + '" y2="' + s[3] + '"/>';
    });
    (m.v || []).forEach(function (v) {
      saida += '<ellipse class="fig-fita" cx="' + v[0] + '" cy="' + v[1] + '" rx="' + v[2] + '" ry="' + v[3] + '"' +
        (v[4] ? ' transform="rotate(' + v[4] + ' ' + v[0] + ' ' + v[1] + ')"' : '') + '/>';
    });
    (m.p || []).forEach(function (p) {
      saida += '<circle class="fig-ponto" cx="' + p[0] + '" cy="' + p[1] + '" r="3"/>';
    });
    return saida;
  }

  function desenhar(medida, recorte) {
    return '<svg viewBox="' + (recorte || '0 0 300 724') + '" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' +
      (medida ? 'Onde medir: ' + medida.rotulo : 'Figura do corpo') + '">' +
      '<path class="fig-fundo" d="' + PREENCHIMENTO + '"/>' +
      '<path class="fig-fundo" d="' + PREENCHIMENTO + '"' + ESPELHO + '/>' +
      '<path class="fig-contorno" d="' + CONTORNO + '"/>' +
      '<path class="fig-contorno" d="' + CONTORNO + '"' + ESPELHO + '/>' +
      '<ellipse class="fig-cabeca" cx="150" cy="50" rx="30" ry="38"/>' +
      (medida ? marca(medida.marca) : '') +
      '</svg>';
  }

  return { desenhar: desenhar };
})();
