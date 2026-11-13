/* Alimentação: alimentos, embalagens e preços por região.
   Valores nutricionais por 100 g (ou 100 ml), aproximados a partir da Tabela Brasileira
   de Composição de Alimentos (TACO, Unicamp). Servem para estimativa, não para prescrição. */
window.AR_ALIM = (function () {
  'use strict';

  /* --- Preços do DIEESE ---------------------------------------------------------------
     Pesquisa Nacional da Cesta Básica de Alimentos (DIEESE e Conab), preço médio de
     setembro de 2026, coletado em supermercados das 27 capitais, sem considerar promoções.
     Unidades: carne kg, leite L, feijão kg, arroz kg, farinha kg (de trigo no Centro-Sul,
     de mandioca no Norte e Nordeste), batata kg (só no Centro-Sul), tomate kg, pão francês kg,
     café em pó kg, banana dúzia, açúcar kg, óleo de soja 900 ml, manteiga kg.
     Para atualizar: dieese.org.br/cesta, aba Banco de Dados, por data, Preço médio. */
  var DIEESE_DATA = 'setembro de 2026';
  var DIEESE_COLUNAS = ['carne', 'leite', 'feijao', 'arroz', 'farinha', 'batata', 'tomate', 'pao', 'cafe', 'banana', 'acucar', 'oleo', 'manteiga'];
  var DIEESE = {
    DF: [46.69, 6.65, 8.69, 4.97, 4.61, 6.29, 9.58, 18.69, 47.39, 8.15, 3.05, 7.37, 54.18],
    MS: [47.78, 5.82, 8.64, 4.39, 4.32, 5.44, 7.20, 18.37, 48.21, 11.55, 2.84, 7.19, 64.88],
    MT: [46.56, 7.07, 8.13, 4.18, 4.38, 7.94, 12.31, 21.66, 54.89, 12.23, 2.83, 7.67, 59.29],
    GO: [46.98, 7.02, 10.44, 4.84, 4.82, 6.88, 9.14, 19.32, 67.57, 8.69, 3.27, 7.65, 56.15],
    MG: [49.39, 6.63, 8.98, 4.95, 4.47, 6.75, 11.04, 19.49, 47.48, 7.90, 2.93, 7.55, 45.43],
    RJ: [54.36, 7.44, 6.80, 5.76, 4.80, 8.09, 12.66, 21.51, 54.03, 10.60, 3.55, 7.80, 72.68],
    SP: [56.07, 7.28, 9.42, 4.69, 5.25, 8.52, 10.97, 20.03, 57.98, 12.14, 3.64, 7.93, 69.90],
    ES: [50.78, 6.63, 7.27, 4.09, 4.20, 8.13, 10.79, 20.60, 44.98, 8.29, 2.84, 7.97, 64.39],
    PR: [53.81, 6.43, 6.42, 4.36, 4.20, 6.77, 11.39, 16.57, 47.03, 7.88, 3.83, 7.35, 53.46],
    SC: [56.18, 6.28, 7.48, 5.60, 4.35, 7.41, 12.30, 18.50, 54.84, 9.40, 4.09, 7.88, 65.93],
    RS: [55.07, 5.67, 6.91, 4.71, 4.10, 7.06, 11.91, 16.26, 55.08, 10.52, 4.09, 7.81, 68.11],
    PA: [46.76, 8.20, 8.43, 5.04, 8.26, null, 9.88, 17.15, 60.08, 11.44, 3.50, 8.63, 62.31],
    RR: [46.63, 8.28, 9.24, 4.30, 9.20, null, 10.34, 10.96, 65.15, 10.93, 3.57, 7.45, 61.39],
    AP: [45.44, 8.80, 9.29, 5.29, 7.69, null, 10.10, 16.33, 60.00, 9.55, 4.12, 8.25, 65.85],
    AM: [46.82, 7.72, 9.05, 4.80, 5.79, null, 8.72, 14.38, 62.51, 9.99, 3.06, 7.78, 56.30],
    TO: [48.25, 6.97, 10.98, 5.87, 9.13, null, 9.24, 19.13, 66.08, 9.41, 4.09, 8.92, 78.06],
    RO: [40.32, 6.78, 8.19, 4.71, 7.02, null, 11.01, 15.35, 62.81, 13.26, 2.83, 7.98, 47.02],
    AC: [41.00, 7.83, 8.55, 5.32, 6.66, null, 9.75, 14.78, 59.01, 11.31, 3.34, 8.29, 56.99],
    SE: [44.66, 6.80, 9.27, 5.34, 6.79, null, 5.07, 12.45, 61.13, 7.69, 3.38, 8.25, 46.30],
    CE: [56.32, 7.57, 8.99, 5.29, 5.14, null, 9.58, 22.26, 60.53, 8.67, 3.64, 8.93, 72.83],
    PB: [49.51, 7.82, 10.12, 4.88, 7.06, null, 5.53, 16.11, 55.62, 7.39, 3.50, 9.08, 68.64],
    AL: [48.68, 7.23, 9.21, 5.29, 6.15, null, 4.87, 15.08, 58.66, 7.63, 3.59, 8.61, 62.36],
    RN: [47.71, 7.61, 9.65, 4.66, 6.77, null, 5.75, 14.89, 61.36, 6.80, 3.72, 8.67, 62.85],
    PE: [47.34, 7.35, 9.75, 6.00, 6.35, null, 5.76, 14.73, 60.96, 10.43, 3.87, 9.28, 62.55],
    BA: [44.74, 7.93, 9.23, 5.40, 7.17, null, 5.99, 16.80, 62.06, 6.84, 3.56, 8.42, 55.42],
    MA: [45.36, 6.78, 8.97, 5.10, 8.73, null, 8.24, 19.45, 54.37, 8.71, 3.62, 8.69, 61.93],
    PI: [46.65, 7.30, 9.54, 5.01, 8.20, null, 6.80, 20.13, 60.73, 9.35, 3.72, 8.62, 64.99]
  };

  var ESTADOS = [
    ['AC', 'Acre', 'Rio Branco'], ['AL', 'Alagoas', 'Maceió'], ['AP', 'Amapá', 'Macapá'],
    ['AM', 'Amazonas', 'Manaus'], ['BA', 'Bahia', 'Salvador'], ['CE', 'Ceará', 'Fortaleza'],
    ['DF', 'Distrito Federal', 'Brasília'], ['ES', 'Espírito Santo', 'Vitória'], ['GO', 'Goiás', 'Goiânia'],
    ['MA', 'Maranhão', 'São Luís'], ['MT', 'Mato Grosso', 'Cuiabá'], ['MS', 'Mato Grosso do Sul', 'Campo Grande'],
    ['MG', 'Minas Gerais', 'Belo Horizonte'], ['PA', 'Pará', 'Belém'], ['PB', 'Paraíba', 'João Pessoa'],
    ['PR', 'Paraná', 'Curitiba'], ['PE', 'Pernambuco', 'Recife'], ['PI', 'Piauí', 'Teresina'],
    ['RJ', 'Rio de Janeiro', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte', 'Natal'],
    ['RS', 'Rio Grande do Sul', 'Porto Alegre'], ['RO', 'Rondônia', 'Porto Velho'], ['RR', 'Roraima', 'Boa Vista'],
    ['SC', 'Santa Catarina', 'Florianópolis'], ['SP', 'São Paulo', 'São Paulo'], ['SE', 'Sergipe', 'Aracaju'],
    ['TO', 'Tocantins', 'Palmas']
  ].map(function (e) { return { uf: e[0], nome: e[1], capital: e[2] }; });

  // Onde o DIEESE pesquisa farinha de trigo, a de mandioca usa o preço estimado
  var FARINHA_DE_MANDIOCA = ['PA', 'RR', 'AP', 'AM', 'TO', 'RO', 'AC', 'SE', 'CE', 'PB', 'AL', 'RN', 'PE', 'BA', 'MA', 'PI'];

  var SALARIO_MINIMO = 1621;

  /* --- Produtos que se compram -----------------------------------------------------------
     qtd: gramas (ou ml) da embalagem. dura: dias que dura depois de aberto ou comprado.
     granel: vendido a peso ou solto, então a pessoa leva só o que vai usar na semana.
     preco: { dieese: coluna, mult: quantas unidades do DIEESE cabem na embalagem }
            ou { base: preço médio estimado de prateleira, sem promoção, novembro de 2026 }.
     O preço estimado é ajustado pelo índice de preços da região, calculado com o DIEESE. */
  var PRODUTOS = [
    ['arroz', 'Arroz branco', 'pacote de 5 kg', 5000, 180, { dieese: 'arroz', mult: 5 }],
    ['arroz_integral', 'Arroz integral', 'pacote de 1 kg', 1000, 120, { base: 8.49 }],
    ['feijao', 'Feijão', 'pacote de 1 kg', 1000, 180, { dieese: 'feijao', mult: 1 }],
    ['macarrao', 'Macarrão', 'pacote de 500 g', 500, 180, { base: 5.49 }],
    ['pao_frances', 'Pão francês', '6 pães (300 g)', 300, 2, { dieese: 'pao', mult: 0.3 }],
    ['pao_forma', 'Pão de forma', 'pacote de 500 g', 500, 7, { base: 8.55 }],
    ['pao_integral', 'Pão integral', 'pacote de 400 g', 400, 8, { base: 10.9 }],
    ['goma', 'Goma de tapioca', 'pacote de 500 g', 500, 60, { base: 8.49 }],
    ['flocao', 'Flocão de milho', 'pacote de 500 g', 500, 120, { base: 3.49 }],
    ['aveia', 'Aveia em flocos', 'pacote de 500 g', 500, 60, { base: 9.49 }],
    ['granola', 'Granola', 'pacote de 800 g', 800, 60, { base: 21.9 }],
    ['batata', 'Batata', '1 kg', 1000, 14, { dieese: 'batata', mult: 1, base: 6.9 }, true],
    ['batata_doce', 'Batata-doce', '1 kg', 1000, 14, { base: 6.49 }, true],
    ['mandioca', 'Mandioca', '1 kg', 1000, 5, { base: 6.99 }, true],
    ['farinha_mandioca', 'Farinha de mandioca', 'pacote de 1 kg', 1000, 120, { dieese: 'farinha', mult: 1, so: FARINHA_DE_MANDIOCA, base: 8.49 }],
    ['frango', 'Peito de frango', 'bandeja de 1 kg', 1000, 90, { base: 22.9 }],
    ['coxa', 'Coxa e sobrecoxa de frango', 'bandeja de 1 kg', 1000, 90, { base: 14.9 }],
    ['carne', 'Carne bovina de primeira', '1 kg', 1000, 90, { dieese: 'carne', mult: 1 }],
    ['porco', 'Lombo de porco', '1 kg', 1000, 90, { base: 27.9 }],
    ['peixe', 'Filé de peixe (tilápia)', '1 kg', 1000, 90, { base: 49.9 }],
    ['ovos', 'Ovos', 'dúzia (12 ovos)', 600, 30, { base: 11.5 }],
    ['atum', 'Atum em lata', 'lata de 170 g', 120, 3, { base: 9.9 }],
    ['sardinha', 'Sardinha em lata', 'lata de 125 g', 84, 3, { base: 6.49 }],
    ['salsicha', 'Salsicha', 'pacote de 500 g', 500, 10, { base: 8.49 }],
    ['linguica', 'Linguiça', 'pacote de 500 g', 500, 30, { base: 13.49 }],
    ['presunto', 'Presunto fatiado', '200 g', 200, 5, { base: 7.98 }],
    ['mucarela', 'Muçarela fatiada', '200 g', 200, 7, { base: 9.98 }],
    ['requeijao', 'Requeijão', 'copo de 200 g', 200, 10, { base: 9.49 }],
    ['iogurte', 'Iogurte natural', 'pote de 500 g', 500, 7, { base: 8.99 }],
    ['leite', 'Leite', 'caixa de 1 litro', 1000, 5, { dieese: 'leite', mult: 1 }],
    ['banana', 'Banana', 'dúzia', 840, 7, { dieese: 'banana', mult: 1 }, true],
    ['maca', 'Maçã', '1 kg', 1000, 14, { base: 11.9 }, true],
    ['laranja', 'Laranja', '1 kg', 1000, 14, { base: 4.99 }, true],
    ['mamao', 'Mamão', 'unidade (1,5 kg)', 1500, 6, { base: 11.2 }],
    ['melancia', 'Melancia', 'metade (4 kg)', 4000, 5, { base: 13.96 }],
    ['abacate', 'Abacate', 'unidade (600 g)', 600, 5, { base: 5.99 }],
    ['morango', 'Morango', 'bandeja de 250 g', 250, 4, { base: 7.99 }],
    ['uva', 'Uva', 'bandeja de 500 g', 500, 7, { base: 9.99 }],
    ['abacaxi', 'Abacaxi', 'unidade (1,4 kg)', 1400, 5, { base: 8.99 }],
    ['alface', 'Alface', 'pé', 250, 5, { base: 3.99 }],
    ['tomate', 'Tomate', '1 kg', 1000, 7, { dieese: 'tomate', mult: 1 }, true],
    ['cenoura', 'Cenoura', '1 kg', 1000, 14, { base: 4.99 }, true],
    ['abobrinha', 'Abobrinha', '1 kg', 1000, 7, { base: 6.99 }, true],
    ['brocolis', 'Brócolis', 'maço (350 g)', 350, 4, { base: 6.99 }],
    ['oleo', 'Óleo de soja', 'garrafa de 900 ml', 828, 120, { dieese: 'oleo', mult: 1 }],
    ['azeite', 'Azeite', 'garrafa de 500 ml', 460, 90, { base: 34.9 }],
    ['manteiga', 'Manteiga', 'pote de 200 g', 200, 60, { dieese: 'manteiga', mult: 0.2 }],
    ['margarina', 'Margarina', 'pote de 500 g', 500, 60, { base: 9.49 }],
    ['acucar', 'Açúcar', 'pacote de 1 kg', 1000, 365, { dieese: 'acucar', mult: 1 }],
    ['cafe', 'Café em pó', 'pacote de 500 g', 500, 150, { dieese: 'cafe', mult: 0.5 }],
    ['cafe_soluvel', 'Café solúvel', 'pote de 100 g', 100, 120, { base: 19.9 }],
    ['adocante', 'Adoçante', 'frasco de 100 ml', 100, 180, { base: 6.99 }],
    ['mel', 'Mel', 'pote de 500 g', 500, 365, { base: 24.9 }],
    ['refrigerante', 'Refrigerante', 'garrafa de 2 litros', 2000, 3, { base: 9.99 }],
    ['suco_caixa', 'Suco de caixinha', 'caixa de 1 litro', 1000, 4, { base: 7.99 }],
    ['cerveja', 'Cerveja', 'lata de 350 ml', 350, 365, { base: 4.29 }],
    ['achocolatado', 'Achocolatado', 'pote de 400 g', 400, 90, { base: 9.99 }],
    ['biscoito', 'Biscoito recheado', 'pacote de 130 g', 130, 15, { base: 3.49 }],
    ['cracker', 'Biscoito de água e sal', 'pacote de 350 g', 350, 20, { base: 6.49 }],
    ['chocolate', 'Chocolate ao leite', 'barra de 90 g', 90, 30, { base: 7.99 }],
    ['amendoim', 'Pasta de amendoim', 'pote de 500 g', 500, 90, { base: 19.9 }],
    // Suplementos: preço de prateleira de marcas populares
    ['whey', 'Whey protein', 'pote de 900 g', 900, 120, { base: 129.9 }],
    ['hipercalorico', 'Hipercalórico', 'pote de 3 kg', 3000, 90, { base: 99.9 }],
    ['creatina', 'Creatina', 'pote de 300 g', 300, 120, { base: 79.9 }],
    ['barra_proteina', 'Barra de proteína', 'caixa com 12 (45 g cada)', 540, 180, { base: 89.9 }],
    // Comida pronta: o preço é de cada porção, comprada na hora
    ['marmita', 'Marmita ou prato feito', 'porção', 450, 1, { base: 24.9 }],
    ['lanche', 'Lanche de lanchonete', 'unidade', 250, 1, { base: 32.9 }],
    ['pizza', 'Pizza de delivery', 'fatia', 120, 1, { base: 8.13 }],
    ['salgado', 'Salgado de padaria', 'unidade', 100, 1, { base: 7.5 }]
  ].map(function (p) {
    return { id: p[0], nome: p[1], embalagem: p[2], qtd: p[3], dura: p[4], preco: p[5], granel: Boolean(p[6]), pronto: p[4] === 1 };
  });

  /* --- Alimentos como a pessoa os come ------------------------------------------------------
     [id, nome, grupo, kcal, proteína, carboidrato, gordura, medidas, produto, fator]
     medidas: [rótulo, gramas]. fator: gramas do produto comprado por grama comida
     (arroz cozido rende cerca de 2,5 vezes o cru, carne perde água ao grelhar etc.). */
  var GRUPOS = [
    { id: 'cereais', rotulo: 'Arroz, pães e massas' },
    { id: 'proteinas', rotulo: 'Carnes, ovos e peixes' },
    { id: 'leite', rotulo: 'Leite e derivados' },
    { id: 'frutas', rotulo: 'Frutas' },
    { id: 'vegetais', rotulo: 'Verduras e legumes' },
    { id: 'gorduras', rotulo: 'Óleos, açúcar e temperos' },
    { id: 'bebidas', rotulo: 'Bebidas' },
    { id: 'doces', rotulo: 'Doces e beliscos' },
    { id: 'suplementos', rotulo: 'Suplementos' },
    { id: 'prontos', rotulo: 'Comida pronta e fora de casa' }
  ];

  var COLHER = ['colher de sopa', 25];
  var ALIMENTOS = [
    ['arroz', 'Arroz branco', 'cereais', 128, 2.5, 28.1, 0.2, [COLHER, ['colher de servir', 45], ['prato raso (meio prato)', 150]], 'arroz', 0.4],
    ['arroz_integral', 'Arroz integral', 'cereais', 124, 2.6, 25.8, 1.0, [COLHER, ['colher de servir', 45]], 'arroz_integral', 0.4],
    ['feijao', 'Feijão', 'cereais', 76, 4.8, 13.6, 0.5, [['concha média', 100], COLHER], 'feijao', 0.4],
    ['macarrao', 'Macarrão', 'cereais', 150, 5, 30, 0.9, [['pegador', 60], ['prato raso (meio prato)', 150]], 'macarrao', 0.45],
    ['pao_frances', 'Pão francês', 'cereais', 300, 8, 58.6, 3.1, [['unidade', 50]], 'pao_frances', 1],
    ['pao_forma', 'Pão de forma branco', 'cereais', 253, 7.5, 49.4, 2.7, [['fatia', 25]], 'pao_forma', 1],
    ['pao_integral', 'Pão integral', 'cereais', 253, 9.4, 49.9, 3.7, [['fatia', 25]], 'pao_integral', 1],
    ['tapioca', 'Tapioca', 'cereais', 340, 0.5, 84, 0.2, [['unidade (3 colheres de goma)', 50]], 'goma', 1],
    ['cuscuz', 'Cuscuz de milho', 'cereais', 113, 2.2, 25.3, 0.7, [['pedaço médio', 120], COLHER], 'flocao', 0.4],
    ['aveia', 'Aveia em flocos', 'cereais', 394, 13.9, 66.6, 8.5, [['colher de sopa', 15]], 'aveia', 1],
    ['granola', 'Granola', 'cereais', 421, 9.8, 66, 13, [['colher de sopa', 12], ['porção (3 colheres)', 36]], 'granola', 1],
    ['batata', 'Batata cozida', 'cereais', 52, 1.2, 11.9, 0.1, [['unidade média', 130], COLHER], 'batata', 1],
    ['batata_frita', 'Batata frita', 'cereais', 267, 5, 35.6, 13.1, [['porção pequena', 100]], 'batata', 1.2],
    ['batata_doce', 'Batata-doce cozida', 'cereais', 77, 0.6, 18.4, 0.1, [['unidade média', 150], COLHER], 'batata_doce', 1],
    ['mandioca', 'Mandioca cozida', 'cereais', 125, 0.6, 30.1, 0.3, [['pedaço', 100]], 'mandioca', 1.2],
    ['farofa', 'Farinha de mandioca ou farofa', 'cereais', 365, 1.6, 87.9, 0.3, [['colher de sopa', 16]], 'farinha_mandioca', 1],
    ['frango', 'Peito de frango grelhado', 'proteinas', 159, 32, 0, 2.5, [['filé médio', 100]], 'frango', 1.35],
    ['coxa', 'Coxa ou sobrecoxa assada', 'proteinas', 215, 28.5, 0, 10.4, [['unidade', 90]], 'coxa', 1.6],
    ['carne', 'Carne bovina', 'proteinas', 219, 35.9, 0, 7.3, [['bife médio', 100]], 'carne', 1.35],
    ['carne_moida', 'Carne moída refogada', 'proteinas', 212, 26.7, 0, 10.9, [['colher de sopa', 25]], 'carne', 1.3],
    ['porco', 'Carne de porco assada', 'proteinas', 210, 35.7, 0, 6.4, [['fatia média', 100]], 'porco', 1.35],
    ['peixe', 'Filé de peixe grelhado', 'proteinas', 128, 26, 0, 2.7, [['filé médio', 120]], 'peixe', 1.3],
    ['ovo', 'Ovo cozido ou mexido', 'proteinas', 146, 13.3, 0.6, 9.5, [['unidade', 50]], 'ovos', 1],
    ['ovo_frito', 'Ovo frito', 'proteinas', 240, 15.6, 1.2, 18.6, [['unidade', 50]], 'ovos', 1],
    ['atum', 'Atum em lata', 'proteinas', 166, 26, 0, 6.6, [['colher de sopa', 20], ['lata', 120]], 'atum', 1],
    ['sardinha', 'Sardinha em lata', 'proteinas', 285, 15.9, 0, 24, [['lata', 84]], 'sardinha', 1],
    ['salsicha', 'Salsicha', 'proteinas', 257, 12, 3, 22, [['unidade', 40]], 'salsicha', 1],
    ['linguica', 'Linguiça', 'proteinas', 296, 18, 0, 24.5, [['gomo', 60]], 'linguica', 1.1],
    ['presunto', 'Presunto', 'proteinas', 94, 14.3, 2.1, 2.7, [['fatia', 15]], 'presunto', 1],
    ['queijo', 'Queijo muçarela', 'leite', 330, 22.6, 3, 25.2, [['fatia', 15]], 'mucarela', 1],
    ['requeijao', 'Requeijão', 'leite', 257, 9.6, 2.4, 23.4, [['colher de sopa', 30]], 'requeijao', 1],
    ['iogurte', 'Iogurte natural', 'leite', 51, 4.1, 1.9, 3, [['pote', 170]], 'iogurte', 1],
    ['leite', 'Leite integral', 'leite', 61, 3.2, 4.6, 3.3, [['copo (200 ml)', 200], ['xícara (100 ml)', 100]], 'leite', 1],
    ['leite_desnatado', 'Leite desnatado', 'leite', 35, 3.4, 5, 0.2, [['copo (200 ml)', 200], ['xícara (100 ml)', 100]], 'leite', 1],
    ['banana', 'Banana', 'frutas', 98, 1.3, 26, 0.1, [['unidade', 70]], 'banana', 1],
    ['maca', 'Maçã', 'frutas', 56, 0.3, 15.2, 0, [['unidade', 130]], 'maca', 1.1],
    ['laranja', 'Laranja', 'frutas', 37, 1, 8.9, 0.1, [['unidade', 140]], 'laranja', 1.4],
    ['mamao', 'Mamão', 'frutas', 45, 0.8, 11.6, 0.1, [['fatia', 150]], 'mamao', 1.3],
    ['melancia', 'Melancia', 'frutas', 33, 0.9, 8.1, 0, [['fatia', 200]], 'melancia', 1.6],
    ['abacate', 'Abacate', 'frutas', 96, 1.2, 6, 8.4, [['colher de sopa', 30]], 'abacate', 1.4],
    ['morango', 'Morango', 'frutas', 30, 0.9, 6.8, 0.3, [['unidade', 12], ['xícara (150 g)', 150]], 'morango', 1.05],
    ['uva', 'Uva', 'frutas', 53, 0.7, 13.6, 0.2, [['cacho pequeno (100 g)', 100], ['unidade', 6]], 'uva', 1.1],
    ['abacaxi', 'Abacaxi', 'frutas', 48, 0.9, 12.3, 0.1, [['fatia', 75]], 'abacaxi', 1.8],
    ['salada', 'Salada de alface e tomate', 'vegetais', 13, 1, 2.4, 0.1, [['prato de sobremesa', 80]], 'salada', 1],
    ['tomate', 'Tomate', 'vegetais', 15, 1.1, 3.1, 0.2, [['unidade', 100], ['fatia', 15]], 'tomate', 1.05],
    ['cenoura', 'Cenoura', 'vegetais', 34, 1.3, 7.7, 0.2, [COLHER], 'cenoura', 1.1],
    ['legumes', 'Legumes cozidos (abobrinha, chuchu)', 'vegetais', 20, 1, 4, 0.2, [['colher de servir', 50]], 'abobrinha', 1.1],
    ['brocolis', 'Brócolis cozido', 'vegetais', 25, 2.1, 4.4, 0.5, [['colher de servir', 50]], 'brocolis', 1.3],
    ['oleo', 'Óleo no preparo', 'gorduras', 884, 0, 0, 100, [['colher de sopa', 8]], 'oleo', 1],
    ['azeite', 'Azeite', 'gorduras', 884, 0, 0, 100, [['colher de sopa', 8]], 'azeite', 1],
    ['manteiga', 'Manteiga', 'gorduras', 726, 0.4, 0.1, 82.4, [['ponta de faca', 5], ['colher de chá', 5]], 'manteiga', 1],
    ['margarina', 'Margarina', 'gorduras', 596, 0, 0, 67.4, [['ponta de faca', 5]], 'margarina', 1],
    ['acucar', 'Açúcar', 'gorduras', 387, 0, 99.5, 0, [['colher de chá', 5], ['colher de sopa', 12]], 'acucar', 1],
    ['adocante', 'Adoçante', 'gorduras', 0, 0, 0, 0, [['gotas (uma dose)', 0.3]], 'adocante', 1],
    ['mel', 'Mel', 'gorduras', 309, 0, 84, 0, [['colher de chá', 7], ['colher de sopa', 20]], 'mel', 1],
    ['amendoim', 'Pasta de amendoim', 'gorduras', 589, 25, 20, 49, [['colher de sopa', 15]], 'amendoim', 1],
    ['cafe', 'Café coado', 'bebidas', 9, 0.7, 1.5, 0.1, [['xícara (50 ml)', 50], ['copo americano (150 ml)', 150]], 'cafe', 0.08],
    ['cafe_soluvel', 'Café solúvel', 'bebidas', 4, 0.3, 0.7, 0, [['xícara (50 ml)', 50], ['copo americano (150 ml)', 150]], 'cafe_soluvel', 0.014],
    ['cafe_leite', 'Café com leite', 'bebidas', 35, 1.9, 3, 1.7, [['xícara (100 ml)', 100], ['copo americano (150 ml)', 150]], null, 0],
    ['refrigerante', 'Refrigerante comum', 'bebidas', 39, 0, 10, 0, [['copo (250 ml)', 250], ['lata (350 ml)', 350]], 'refrigerante', 1],
    ['refrigerante_zero', 'Refrigerante zero', 'bebidas', 1, 0, 0, 0, [['copo (250 ml)', 250], ['lata (350 ml)', 350]], 'refrigerante', 1],
    ['suco_caixa', 'Suco de caixinha', 'bebidas', 55, 0.2, 13.5, 0, [['copo (250 ml)', 250]], 'suco_caixa', 1],
    ['suco_laranja', 'Suco de laranja natural', 'bebidas', 45, 0.7, 10.4, 0.1, [['copo (250 ml)', 250]], 'laranja', 2.4],
    ['cerveja', 'Cerveja', 'bebidas', 41, 0.3, 3.3, 0, [['lata (350 ml)', 350]], 'cerveja', 1],
    ['achocolatado', 'Achocolatado em pó', 'bebidas', 401, 4.2, 91.2, 2.2, [['colher de sopa', 15]], 'achocolatado', 1],
    ['agua', 'Água', 'bebidas', 0, 0, 0, 0, [['copo (250 ml)', 250]], null, 0],
    ['biscoito', 'Biscoito recheado', 'doces', 472, 6.4, 70.5, 19.6, [['unidade', 13], ['pacote', 130]], 'biscoito', 1],
    ['cracker', 'Biscoito de água e sal', 'doces', 432, 10.1, 68.7, 14.4, [['unidade', 7]], 'cracker', 1],
    ['chocolate', 'Chocolate ao leite', 'doces', 540, 7.2, 59.6, 30.3, [['quadradinho', 5], ['barra (90 g)', 90]], 'chocolate', 1],
    ['whey', 'Whey protein', 'suplementos', 390, 76, 8, 6, [['dose (30 g)', 30]], 'whey', 1],
    ['hipercalorico', 'Hipercalórico', 'suplementos', 380, 13, 76, 2.5, [['dose (100 g)', 100], ['medida (50 g)', 50]], 'hipercalorico', 1],
    ['creatina', 'Creatina', 'suplementos', 0, 0, 0, 0, [['dose (3 g)', 3]], 'creatina', 1],
    ['barra_proteina', 'Barra de proteína', 'suplementos', 370, 33, 38, 11, [['unidade (45 g)', 45]], 'barra_proteina', 1],
    ['marmita', 'Marmita ou prato feito', 'prontos', 155, 7, 18, 6, [['porção', 450]], 'marmita', 1],
    ['lanche', 'Hambúrguer de lanchonete', 'prontos', 260, 12, 26, 12, [['unidade', 250]], 'lanche', 1],
    ['pizza', 'Pizza', 'prontos', 270, 11, 30, 12, [['fatia', 120]], 'pizza', 1],
    ['salgado', 'Salgado (coxinha, pastel)', 'prontos', 300, 8, 32, 16, [['unidade', 100]], 'salgado', 1]
  ].map(function (a) {
    return {
      id: a[0], nome: a[1], grupo: a[2], kcal: a[3], p: a[4], c: a[5], g: a[6],
      medidas: a[7].map(function (m) { return { rotulo: m[0], g: m[1] }; }),
      produto: a[8], fator: a[9]
    };
  });

  // A salada se compra em duas partes: alface e tomate
  var COMPOSTOS = {
    salada: [['alface', 0.5], ['tomate', 0.55]],
    // Metade café coado, metade leite
    cafe_leite: [['leite', 0.5], ['cafe', 0.04]]
  };

  // Alimentos da mesma família: a pessoa troca o tipo depois, sem apagar e incluir de novo
  var FAMILIAS = [
    ['cafe', 'cafe_soluvel', 'cafe_leite'],
    ['leite', 'leite_desnatado'],
    ['acucar', 'adocante', 'mel'],
    ['aveia', 'granola'],
    ['whey', 'hipercalorico', 'barra_proteina'],
    ['refrigerante', 'refrigerante_zero'],
    ['suco_caixa', 'suco_laranja'],
    ['pao_frances', 'pao_forma', 'pao_integral'],
    ['arroz', 'arroz_integral'],
    ['batata', 'batata_frita', 'batata_doce', 'mandioca'],
    ['frango', 'coxa'],
    ['carne', 'carne_moida', 'porco'],
    ['peixe', 'atum', 'sardinha'],
    ['ovo', 'ovo_frito'],
    ['manteiga', 'margarina', 'requeijao'],
    ['oleo', 'azeite'],
    ['biscoito', 'cracker']
  ];
  var familiaDe = {};
  FAMILIAS.forEach(function (lista) { lista.forEach(function (id) { familiaDe[id] = lista; }); });

  function indice(lista) {
    var mapa = {};
    lista.forEach(function (item) { mapa[item.id] = item; });
    return mapa;
  }

  return {
    DIEESE: DIEESE, DIEESE_COLUNAS: DIEESE_COLUNAS, DIEESE_DATA: DIEESE_DATA,
    ESTADOS: ESTADOS, SALARIO_MINIMO: SALARIO_MINIMO,
    PRODUTOS: PRODUTOS, ALIMENTOS: ALIMENTOS, GRUPOS: GRUPOS, COMPOSTOS: COMPOSTOS, familiaDe: familiaDe,
    porProduto: indice(PRODUTOS), porAlimento: indice(ALIMENTOS), porEstado: indice(ESTADOS.map(function (e) { return { id: e.uf, uf: e.uf, nome: e.nome, capital: e.capital }; }))
  };
})();
