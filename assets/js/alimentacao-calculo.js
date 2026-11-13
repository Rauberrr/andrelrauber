/* Alimentação: as contas. Gasto calórico, plano alimentar e compras.
   Tudo roda no aparelho da pessoa: nenhum dado de saúde vai para o servidor. */
window.AR_ALIM_CALC = (function () {
  'use strict';

  var D = window.AR_ALIM;

  var ATIVIDADES = [
    { id: 'sedentario', rotulo: 'Fico sentado quase o dia todo e não treino', fator: 1.2 },
    { id: 'leve', rotulo: 'Caminho ou treino de 1 a 3 vezes por semana', fator: 1.375 },
    { id: 'moderado', rotulo: 'Treino de 3 a 5 vezes por semana', fator: 1.55 },
    { id: 'intenso', rotulo: 'Treino pesado quase todo dia ou trabalho braçal', fator: 1.725 }
  ];
  var OBJETIVOS = [
    { id: 'perder', rotulo: 'Perder peso' },
    { id: 'manter', rotulo: 'Manter o peso e comer melhor' },
    { id: 'ganhar', rotulo: 'Ganhar massa muscular' }
  ];
  var REFEICOES = [
    { id: 'cafe', rotulo: 'Café da manhã' },
    { id: 'almoco', rotulo: 'Almoço' },
    { id: 'lanche', rotulo: 'Lanche da tarde' },
    { id: 'jantar', rotulo: 'Jantar' },
    { id: 'outros', rotulo: 'Beliscos e bebidas ao longo do dia' }
  ];
  var FREQUENCIAS = [
    { id: 'diario', rotulo: 'Todo dia', fator: 1 },
    { id: 'quase', rotulo: '3 a 4 vezes por semana', fator: 0.5 },
    { id: 'pouco', rotulo: '1 a 2 vezes por semana', fator: 0.2 }
  ];
  var porAtividade = {};
  ATIVIDADES.forEach(function (a) { porAtividade[a.id] = a; });
  var porFrequencia = {};
  FREQUENCIAS.forEach(function (f) { porFrequencia[f.id] = f; });

  /* --- Gasto calórico ------------------------------------------------------------------ */

  // Fórmula de Mifflin-St Jeor, a mais usada para estimar o gasto em repouso
  function gasto(perfil) {
    var basal = 10 * perfil.peso + 6.25 * perfil.altura - 5 * perfil.idade + (perfil.sexo === 'f' ? -161 : 5);
    var total = basal * (porAtividade[perfil.atividade] || ATIVIDADES[0]).fator;
    var meta = total;
    if (perfil.objetivo === 'perder') {
      // Déficit moderado, nunca abaixo do gasto em repouso nem de um piso seguro
      meta = Math.max(total - Math.min(500, total * 0.2), basal, perfil.sexo === 'f' ? 1200 : 1500);
    } else if (perfil.objetivo === 'ganhar') {
      meta = total + 300;
    }
    var proteina = perfil.peso * (perfil.objetivo === 'manter' ? 1.2 : 1.6);
    return { basal: Math.round(basal), total: Math.round(total), meta: Math.round(meta), proteina: Math.round(proteina) };
  }

  /* --- Itens: o que a pessoa come -------------------------------------------------------- */

  function gramasDoItem(item) {
    var a = D.porAlimento[item.alimento];
    var medida = a.medidas[item.medida] || a.medidas[0];
    return medida.g * item.qtd * ((porFrequencia[item.freq] || FREQUENCIAS[0]).fator);
  }

  function nutrientes(itens) {
    var t = { kcal: 0, p: 0, c: 0, g: 0 };
    itens.forEach(function (item) {
      var a = D.porAlimento[item.alimento];
      var gramas = gramasDoItem(item);
      t.kcal += gramas * a.kcal / 100;
      t.p += gramas * a.p / 100;
      t.c += gramas * a.c / 100;
      t.g += gramas * a.g / 100;
    });
    return { kcal: Math.round(t.kcal), p: Math.round(t.p), c: Math.round(t.c), g: Math.round(t.g) };
  }

  function novoItem(refeicao, alimento, qtd, medida, extra) {
    var item = { refeicao: refeicao, alimento: alimento, qtd: qtd, medida: medida || 0, freq: 'diario' };
    if (extra) Object.keys(extra).forEach(function (k) { item[k] = extra[k]; });
    return item;
  }

  /* --- Ajustar o que a pessoa já come ------------------------------------------------------- */

  // Cada troca diz o que entra no lugar e por quê
  var TROCAS = {
    refrigerante: { para: [['agua', 'mesmo']], motivo: 'Água no lugar do refrigerante, com gás e limão se quiser. O refrigerante tem muito açúcar e não sacia.' },
    suco_caixa: { para: [['laranja', 1]], motivo: 'Uma laranja no lugar do suco de caixinha: a fruta inteira tem fibra e sacia mais.' },
    pao_frances: { para: [['pao_integral', 2, 'cada']], motivo: 'Duas fatias de pão integral para cada pão francês: mais fibra e fome sob controle por mais tempo.' },
    pao_forma: { para: [['pao_integral', 1, 'cada']], motivo: 'Pão integral no lugar do branco: mais fibra, mesmo preparo.' },
    biscoito: { para: [['maca', 1]], motivo: 'Uma fruta no lugar do biscoito recheado, que tem muito açúcar e gordura.' },
    batata_frita: { para: [['batata', 'peso']], motivo: 'Batata cozida ou assada no lugar da frita: menos da metade das calorias.' },
    salsicha: { para: [['frango', 'peso']], motivo: 'Frango no lugar da salsicha, que é ultraprocessada e tem muito sal.' },
    linguica: { para: [['frango', 'peso']], motivo: 'Frango no lugar da linguiça: mais proteína e bem menos gordura.' },
    ovo_frito: { para: [['ovo', 'mesmo']], motivo: 'Ovo cozido ou mexido com pouco óleo no lugar do frito.' },
    lanche: { para: [['marmita', 1]], motivo: 'Um prato feito com salada no lugar do lanche: sustenta mais e tem menos gordura.' },
    salgado: { para: [['pao_integral', 2], ['ovo', 1]], motivo: 'Pão integral com ovo no lugar do salgado frito.' },
    acucar: { reduzir: 0.5, motivo: 'Metade do açúcar. O paladar se acostuma em duas ou três semanas.' },
    mel: { reduzir: 0.5, motivo: 'Metade do mel: ele é açúcar também, só que natural.' },
    achocolatado: { reduzir: 0.5, motivo: 'Metade do achocolatado, que é quase todo açúcar.' },
    chocolate: { reduzir: 0.5, motivo: 'Metade do chocolate, sem cortar de vez.' },
    cerveja: { reduzir: 0.5, motivo: 'Metade da cerveja: são calorias que não matam a fome.' },
    pizza: { reduzir: 0.5, motivo: 'Metade da pizza, com uma salada antes.' },
    margarina: { reduzir: 0.5, motivo: 'Metade da margarina.' },
    oleo: { reduzir: 0.6, motivo: 'Menos óleo no preparo: uma colher rende uma panela.' }
  };

  // Arroz, pão e massa crescem ou diminuem para o plano chegar à meta.
  // Óleo, manteiga e açúcar só diminuem: nunca entram a mais para completar calorias.
  var GRUPOS_AJUSTAVEIS = { cereais: 'ambos', gorduras: 'reduzir' };

  function ajustavelNoSentido(grupo, fator) {
    var regra = GRUPOS_AJUSTAVEIS[grupo];
    return regra === 'ambos' || (regra === 'reduzir' && fator < 1);
  }

  function aplicarTrocas(itens) {
    var saida = [];
    itens.forEach(function (item) {
      var troca = TROCAS[item.alimento];
      if (!troca) { saida.push(copiar(item)); return; }
      if (troca.reduzir) {
        saida.push(copiar(item, { qtd: arredondar(item.qtd * troca.reduzir), motivo: troca.motivo, antes: descreverItem(item) }));
        return;
      }
      troca.para.forEach(function (p, i) {
        var destino = D.porAlimento[p[0]];
        // 'mesmo' e 'peso' trocam pela mesma quantidade em gramas ou ml. Um número é a
        // quantidade nova, multiplicada pela antiga só quando vem marcado 'cada'.
        var qtd;
        if (typeof p[1] !== 'number') qtd = gramasSemFrequencia(item) / destino.medidas[0].g;
        else qtd = p[2] === 'cada' ? p[1] * item.qtd : p[1];
        saida.push(novoItem(item.refeicao, p[0], Math.max(0.5, arredondar(qtd)), 0, {
          freq: item.freq, motivo: i === 0 ? troca.motivo : '', antes: i === 0 ? descreverItem(item) : ''
        }));
      });
    });
    return saida.filter(function (i) { return i.qtd > 0; });
  }

  function gramasSemFrequencia(item) {
    var a = D.porAlimento[item.alimento];
    return (a.medidas[item.medida] || a.medidas[0]).g * item.qtd;
  }

  function copiar(item, mudar) {
    var novo = {};
    Object.keys(item).forEach(function (k) { novo[k] = item[k]; });
    if (mudar) Object.keys(mudar).forEach(function (k) { novo[k] = mudar[k]; });
    return novo;
  }

  function temNaRefeicao(itens, refeicao, grupo) {
    return itens.some(function (i) {
      return i.refeicao === refeicao && D.porAlimento[i.alimento].grupo === grupo;
    });
  }

  // O que falta num dia equilibrado: verdura no almoço e no jantar, duas frutas, proteína
  function acrescentarFaltantes(itens, metas) {
    var novos = itens.slice();
    var comeAlmoco = itens.some(function (i) { return i.refeicao === 'almoco'; });
    var comeJantar = itens.some(function (i) { return i.refeicao === 'jantar'; });
    if (comeAlmoco && !temNaRefeicao(itens, 'almoco', 'vegetais')) {
      novos.push(novoItem('almoco', 'salada', 1, 0, { motivo: 'Salada no almoço: fibra e saciedade quase sem calorias.', novo: true }));
    }
    if (comeJantar && !temNaRefeicao(itens, 'jantar', 'vegetais')) {
      novos.push(novoItem('jantar', 'legumes', 2, 0, { motivo: 'Legumes no jantar, para encher o prato com menos calorias.', novo: true }));
    }
    var frutas = itens.filter(function (i) { return D.porAlimento[i.alimento].grupo === 'frutas'; })
      .reduce(function (t, i) { return t + i.qtd * (porFrequencia[i.freq] || FREQUENCIAS[0]).fator; }, 0);
    // Frutas baratas, em refeições diferentes: banana no café e laranja no lanche
    var faltam = Math.max(0, 2 - Math.floor(frutas));
    [['cafe', 'banana', 'Uma banana no café da manhã.'], ['lanche', 'laranja', 'Uma laranja no lanche da tarde.']].forEach(function (f) {
      if (faltam > 0 && !temNaRefeicao(novos, f[0], 'frutas')) {
        novos.push(novoItem(f[0], f[1], 1, 0, { motivo: f[2], novo: true }));
        faltam -= 1;
      }
    });
    var proteina = nutrientes(novos).p;
    if (proteina < metas.proteina * 0.8) {
      novos.push(novoItem('cafe', 'ovo', 2, 0, { motivo: 'Dois ovos no café: proteína barata, que segura a fome até o almoço.', novo: true }));
      if (proteina + 13 < metas.proteina * 0.8) {
        novos.push(novoItem('lanche', 'iogurte', 1, 0, { motivo: 'Iogurte natural no lanche, para chegar à proteína do dia.', novo: true }));
      }
    }
    return novos;
  }

  // Aproxima as calorias da meta mexendo nas porções de arroz, pão, massa, óleo e açúcar
  function ajustarPorcoes(itens, meta) {
    var total = nutrientes(itens).kcal;
    // O sentido decide quais grupos podem mudar: para subir, só os carboidratos
    var sentido = meta < total ? 0.9 : 1.1;
    var fixo = 0;
    var ajustavel = 0;
    itens.forEach(function (i) {
      var a = D.porAlimento[i.alimento];
      var kcal = gramasDoItem(i) * a.kcal / 100;
      if (ajustavelNoSentido(a.grupo, sentido)) ajustavel += kcal; else fixo += kcal;
    });
    if (ajustavel < 50) return { itens: itens, fator: 1 };
    // Limite para as porções não ficarem estranhas, como seis fatias de pão
    var fator = Math.max(0.5, Math.min(1.35, (meta - fixo) / ajustavel));
    if (Math.abs(fator - 1) < 0.05) return { itens: itens, fator: 1 };
    return {
      fator: fator,
      itens: itens.map(function (i) {
        if (!ajustavelNoSentido(D.porAlimento[i.alimento].grupo, fator)) return i;
        var qtd = Math.max(0.5, arredondar(i.qtd * fator));
        if (qtd === i.qtd) return i;
        return copiar(i, { qtd: qtd, porcao: fator < 1 ? 'menos' : 'mais' });
      })
    };
  }

  function planoAjustado(itens, metas) {
    var trocados = aplicarTrocas(itens);
    var completos = acrescentarFaltantes(trocados, metas);
    return ajustarPorcoes(completos, metas.meta).itens;
  }

  /* --- Plano novo ------------------------------------------------------------------------- */

  var MODELO = [
    ['cafe', 'pao_integral', 2], ['cafe', 'ovo', 2], ['cafe', 'banana', 1], ['cafe', 'cafe', 1], ['cafe', 'leite', 1, 1],
    ['almoco', 'arroz', 4], ['almoco', 'feijao', 1], ['almoco', 'frango', 1.2], ['almoco', 'salada', 1], ['almoco', 'legumes', 2], ['almoco', 'azeite', 0.5],
    ['lanche', 'iogurte', 1], ['lanche', 'aveia', 2], ['lanche', 'maca', 1],
    ['jantar', 'batata_doce', 1], ['jantar', 'carne', 1], ['jantar', 'brocolis', 2], ['jantar', 'azeite', 0.5],
    ['outros', 'oleo', 1]
  ];

  /* --- Cinco opções completas para cada refeição ------------------------------------------- */

  // A primeira opção de cada refeição é a do plano novo. As porções se ajustam à energia
  // que a refeição tem no plano da pessoa; depois, cada alimento ainda pode ser trocado.
  var OPCOES = {
    cafe: [
      { nome: 'Pão integral com ovos', itens: [['pao_integral', 2], ['ovo', 2], ['banana', 1], ['cafe', 1], ['leite', 1, 1]] },
      { nome: 'Tapioca com queijo', itens: [['tapioca', 1], ['queijo', 2], ['ovo', 1], ['mamao', 1], ['cafe_leite', 1]] },
      { nome: 'Cuscuz com ovos', itens: [['cuscuz', 1], ['ovo', 2], ['banana', 1], ['cafe', 1]] },
      { nome: 'Iogurte com aveia e frutas', itens: [['iogurte', 1], ['aveia', 3], ['banana', 1], ['mamao', 1], ['amendoim', 1]] },
      { nome: 'Pão francês com queijo', itens: [['pao_frances', 1], ['queijo', 2], ['requeijao', 1], ['laranja', 1], ['cafe_leite', 1]] }
    ],
    almoco: [
      { nome: 'Arroz, feijão e frango', itens: [['arroz', 4], ['feijao', 1], ['frango', 1.2], ['salada', 1], ['legumes', 2], ['azeite', 0.5]] },
      { nome: 'Arroz, feijão e carne', itens: [['arroz', 4], ['feijao', 1], ['carne', 1], ['salada', 1], ['cenoura', 2], ['azeite', 0.5]] },
      { nome: 'Macarrão com carne moída', itens: [['macarrao', 2], ['carne_moida', 4], ['salada', 1], ['azeite', 0.5]] },
      { nome: 'Peixe com batata e legumes', itens: [['peixe', 1], ['batata', 2], ['legumes', 2], ['salada', 1], ['azeite', 1]] },
      { nome: 'Arroz integral, feijão e ovos', itens: [['arroz_integral', 4], ['feijao', 1], ['ovo', 2], ['brocolis', 2], ['tomate', 1], ['azeite', 0.5]] }
    ],
    lanche: [
      { nome: 'Iogurte com aveia e maçã', itens: [['iogurte', 1], ['aveia', 2], ['maca', 1]] },
      { nome: 'Sanduíche de frango', itens: [['pao_integral', 2], ['frango', 0.5], ['tomate', 0.5], ['requeijao', 0.5]] },
      { nome: 'Banana com pasta de amendoim', itens: [['banana', 1], ['amendoim', 1], ['cafe_leite', 1]] },
      { nome: 'Pão com ovo', itens: [['pao_frances', 1], ['ovo', 1], ['cafe_leite', 1]] },
      { nome: 'Vitamina de banana com aveia', itens: [['leite', 1], ['banana', 1], ['aveia', 2]] }
    ],
    jantar: [
      { nome: 'Batata-doce, carne e brócolis', itens: [['batata_doce', 1], ['carne', 1], ['brocolis', 2], ['azeite', 0.5]] },
      { nome: 'Omelete com salada', itens: [['ovo', 3], ['queijo', 1], ['salada', 1], ['pao_integral', 1], ['azeite', 0.5]] },
      { nome: 'Arroz, feijão e frango', itens: [['arroz', 3], ['feijao', 1], ['frango', 1], ['legumes', 2], ['azeite', 0.5]] },
      { nome: 'Cuscuz com frango', itens: [['cuscuz', 1], ['frango', 1], ['salada', 1], ['azeite', 0.5]] },
      { nome: 'Mandioca com peixe', itens: [['mandioca', 1.5], ['peixe', 1], ['legumes', 2], ['azeite', 0.5]] }
    ]
  };
  // Verduras, legumes, bebidas e gordura ficam como estão; o resto acompanha a energia
  var FIXOS_NA_OPCAO = { vegetais: 1, bebidas: 1, gorduras: 1, suplementos: 1 };

  function opcaoDaRefeicao(refeicao, indice, kcalAlvo) {
    var opcao = OPCOES[refeicao] && OPCOES[refeicao][indice];
    if (!opcao) return [];
    var itens = opcao.itens.map(function (m) { return novoItem(refeicao, m[0], m[1], m[2] || 0, { opcao: indice }); });
    var total = nutrientes(itens).kcal;
    var fixo = 0;
    itens.forEach(function (i) { if (FIXOS_NA_OPCAO[D.porAlimento[i.alimento].grupo]) fixo += kcalDoItem(i); });
    if (!kcalAlvo || total - fixo < 30) return itens;
    var fator = Math.max(0.6, Math.min(1.7, (kcalAlvo - fixo) / (total - fixo)));
    if (Math.abs(fator - 1) < 0.06) return itens;
    return itens.map(function (i) {
      if (FIXOS_NA_OPCAO[D.porAlimento[i.alimento].grupo]) return i;
      return copiar(i, { qtd: Math.max(0.5, arredondar(i.qtd * fator)) });
    });
  }

  function planoNovo(metas) {
    var itens = MODELO.map(function (m) { return novoItem(m[0], m[1], m[2], m[3] || 0); });
    return ajustarPorcoes(itens, metas.meta).itens;
  }

  /* --- Trocas de quem não gosta de algum alimento ------------------------------------------------ */

  // Não entram como opção de troca: ultraprocessados, frituras, bebidas açucaradas e comida pronta
  var FORA_DAS_TROCAS = {
    salsicha: 1, linguica: 1, batata_frita: 1, ovo_frito: 1, refrigerante: 1, suco_caixa: 1, cerveja: 1,
    achocolatado: 1, biscoito: 1, chocolate: 1, agua: 1, oleo: 1, acucar: 1, adocante: 1, margarina: 1, presunto: 1,
    mel: 1, hipercalorico: 1, creatina: 1
  };

  function kcalDoItem(item) {
    var a = D.porAlimento[item.alimento];
    return gramasDoItem(item) * a.kcal / 100;
  }

  // Mesma energia com outro alimento: a quantidade muda para as calorias ficarem parecidas
  function itemEquivalente(item, alimentoId) {
    var destino = D.porAlimento[alimentoId];
    var kcalPorMedida = destino.medidas[0].g * destino.kcal / 100;
    var alvo = kcalDoItem(copiar(item, { freq: 'diario' }));
    var qtd = kcalPorMedida > 0 ? Math.max(0.5, arredondar(alvo / kcalPorMedida)) : item.qtd;
    return copiar(item, { alimento: alimentoId, qtd: qtd, medida: 0, motivo: '', antes: '', novo: false, porcao: '' });
  }

  function custoDiaDoItem(item, uf) {
    var a = D.porAlimento[item.alimento];
    var gramas = gramasDoItem(item);
    var partes = D.COMPOSTOS[a.id] || (a.produto ? [[a.produto, a.fator]] : []);
    return partes.reduce(function (t, parte) {
      var produto = D.porProduto[parte[0]];
      return t + gramas * parte[1] / produto.qtd * precoDe(produto, uf).valor;
    }, 0);
  }

  // Até cinco alimentos do mesmo grupo, com calorias próximas e o efeito no custo do mês
  function opcoesDeTroca(item, uf, quantas) {
    var original = D.porAlimento[item.alimento];
    var kcalOriginal = kcalDoItem(item);
    var custoOriginal = custoDiaDoItem(item, uf);
    return D.ALIMENTOS.filter(function (a) {
      return a.grupo === original.grupo && a.id !== original.id && !FORA_DAS_TROCAS[a.id] && a.kcal > 0;
    }).map(function (a) {
      var novo = itemEquivalente(item, a.id);
      return {
        item: novo,
        kcal: kcalDoItem(novo),
        diferencaKcal: kcalDoItem(novo) - kcalOriginal,
        diferencaMes: (custoDiaDoItem(novo, uf) - custoOriginal) * 30
      };
    }).filter(function (o) {
      return o.item.qtd <= 6 && Math.abs(o.diferencaKcal) <= Math.max(60, kcalOriginal * 0.35);
    }).sort(function (a, b) {
      return Math.abs(a.diferencaKcal) - Math.abs(b.diferencaKcal) || a.diferencaMes - b.diferencaMes;
    }).slice(0, quantas || 5);
  }

  // Aplica as trocas que a pessoa escolheu: { alimento que não gosta: alimento no lugar }
  function aplicarPreferencias(itens, trocas) {
    if (!trocas) return itens;
    return itens.map(function (item) {
      var para = trocas[item.alimento];
      if (!para || !D.porAlimento[para]) return item;
      var novo = itemEquivalente(item, para);
      novo.preferencia = D.porAlimento[item.alimento].nome;
      novo.origem = item.alimento;
      return novo;
    });
  }

  /* --- Preços ------------------------------------------------------------------------------- */

  var COLUNAS_INDICE = ['carne', 'leite', 'feijao', 'arroz', 'tomate', 'pao', 'cafe', 'banana', 'acucar', 'oleo', 'manteiga'];
  var medias = {};
  COLUNAS_INDICE.forEach(function (col) {
    var k = D.DIEESE_COLUNAS.indexOf(col);
    var soma = 0;
    var n = 0;
    Object.keys(D.DIEESE).forEach(function (uf) { soma += D.DIEESE[uf][k]; n += 1; });
    medias[col] = soma / n;
  });

  // Quanto os preços da capital estão acima ou abaixo da média das 27 capitais
  function indiceRegional(uf) {
    var linha = D.DIEESE[uf];
    if (!linha) return 1;
    var soma = 0;
    COLUNAS_INDICE.forEach(function (col) { soma += linha[D.DIEESE_COLUNAS.indexOf(col)] / medias[col]; });
    return soma / COLUNAS_INDICE.length;
  }

  function precoDe(produto, uf) {
    var p = produto.preco;
    if (p.dieese && (!p.so || p.so.indexOf(uf) !== -1)) {
      var valor = D.DIEESE[uf] && D.DIEESE[uf][D.DIEESE_COLUNAS.indexOf(p.dieese)];
      if (valor) return { valor: valor * p.mult * (D.CORRECAO || 1), fonte: 'dieese' };
    }
    return { valor: (p.base || 0) * indiceRegional(uf) * (D.CORRECAO || 1), fonte: 'estimado' };
  }

  /* --- Compras ------------------------------------------------------------------------------- */

  function consumoPorProduto(itens) {
    var consumo = {};
    function somar(id, gramas) { consumo[id] = (consumo[id] || 0) + gramas; }
    itens.forEach(function (i) {
      var a = D.porAlimento[i.alimento];
      var gramas = gramasDoItem(i);
      if (D.COMPOSTOS[a.id]) {
        D.COMPOSTOS[a.id].forEach(function (parte) { somar(parte[0], gramas * parte[1]); });
      } else if (a.produto) {
        somar(a.produto, gramas * a.fator);
      }
    });
    return consumo;
  }

  // Para cada produto: quanto dura, de quanto em quanto tempo comprar e quanto custa no mês
  function compras(itens, uf) {
    var consumo = consumoPorProduto(itens);
    var lista = Object.keys(consumo).filter(function (id) { return consumo[id] > 0.5; }).map(function (id) {
      var produto = D.porProduto[id];
      var porDia = consumo[id];
      var preco = precoDe(produto, uf);
      if (produto.granel) {
        // A peso ou solto: leva só o da semana, sem sobra para estragar
        var intervaloGranel = Math.min(7, produto.dura);
        return {
          produto: produto, porDia: porDia, preco: preco, granel: true, intervalo: intervaloGranel,
          porCompra: porDia * intervaloGranel, custoMes: porDia * 30 / produto.qtd * preco.valor, perda: 0
        };
      }
      if (produto.pronto) {
        var porcoesMes = porDia / produto.qtd * 30;
        return {
          produto: produto, porDia: porDia, preco: preco, pronto: true,
          custoMes: porcoesMes * preco.valor, porcoesMes: porcoesMes, intervalo: produto.qtd / porDia
        };
      }
      var diasParaAcabar = produto.qtd / porDia;
      var intervalo = Math.min(diasParaAcabar, produto.dura);
      var embalagensMes = 30 / intervalo;
      var perda = diasParaAcabar > produto.dura ? 1 - porDia * produto.dura / produto.qtd : 0;
      return {
        produto: produto, porDia: porDia, preco: preco, diasParaAcabar: diasParaAcabar,
        intervalo: intervalo, embalagensMes: embalagensMes, custoMes: embalagensMes * preco.valor, perda: perda
      };
    });
    lista.sort(function (a, b) { return b.custoMes - a.custoMes; });
    var total = lista.reduce(function (t, l) { return t + l.custoMes; }, 0);
    return { lista: lista, totalMes: total, totalDia: total / 30 };
  }

  // Em que ida ao mercado cada produto entra
  function frequenciaDeCompra(linha) {
    if (linha.pronto) return 'fora';
    if (linha.intervalo <= 3.5) return 'dias';
    if (linha.intervalo <= 10) return 'semana';
    if (linha.intervalo <= 20) return 'quinzena';
    return 'mes';
  }

  /* --- Despensa: o que comprar e quando ---------------------------------------------------------- */

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function paraData(iso) {
    var p = String(iso).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function diasEntre(deISO, ateISO) {
    return Math.round((paraData(ateISO) - paraData(deISO)) / 86400000);
  }

  function somarDias(iso, dias) {
    var d = paraData(iso);
    d.setDate(d.getDate() + Math.floor(dias));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Quanto levar: o do mês para o que não estraga, o da semana para fruta, verdura e pão
  function sugestaoDeCompra(linha, ritmo) {
    var produto = linha.produto;
    var porDia = linha.porDia * (ritmo || 1);
    if (linha.granel || produto.dura < 21) {
      var dias = linha.granel ? 7 : Math.max(1, Math.min(7, produto.dura));
      var gramas = porDia * dias;
      if (linha.granel) return { granel: true, gramas: gramas, embalagens: 0, dias: dias };
      // Perecível: arredonda para baixo quando sobra pouco, para não comprar o que vai estragar
      var emb = Math.max(1, Math.round(gramas / produto.qtd));
      return { granel: false, gramas: emb * produto.qtd, embalagens: emb, dias: Math.min(emb * produto.qtd / porDia, produto.dura * emb) };
    }
    // Compra do mês só para o que dura bastante; ovos e laticínios, a cada duas semanas
    var periodo = produto.dura >= 60 ? 30 : 14;
    var mes = porDia * 30;
    var embalagens = Math.max(1, Math.ceil(porDia * periodo / produto.qtd));
    return { granel: false, gramas: embalagens * produto.qtd, embalagens: embalagens, dias: Math.min(embalagens * produto.qtd / porDia, produto.dura * embalagens), mes: mes };
  }

  // Quanto ainda deve ter em casa e quando acaba. registro: { compradoEm, gramas, embalagens, ritmo }
  function situacaoNoEstoque(linha, registro, hojeData) {
    var hoje = hojeData || hojeISO();
    var ritmo = registro && registro.ritmo ? registro.ritmo : 1;
    var porDia = linha.porDia * ritmo;
    if (!registro || !registro.compradoEm || registro.acabouEm) {
      return { situacao: 'comprar', motivo: registro && registro.acabouEm ? 'acabou' : 'nunca', ritmo: ritmo };
    }
    var embalagens = registro.embalagens || 1;
    var validade = linha.granel ? linha.produto.dura : linha.produto.dura * embalagens;
    var duracao = Math.min(registro.gramas / porDia, validade);
    var acabaEm = somarDias(registro.compradoEm, duracao);
    var faltam = diasEntre(hoje, acabaEm);
    var passados = diasEntre(registro.compradoEm, hoje);
    var resta = Math.max(0, registro.gramas - porDia * passados);
    return {
      situacao: faltam <= 0 ? 'comprar' : (faltam <= 3 ? 'breve' : 'ok'),
      motivo: faltam <= 0 ? 'deve-ter-acabado' : '',
      acabaEm: acabaEm, faltam: faltam, resta: resta, ritmo: ritmo,
      estraga: registro.gramas / porDia > validade
    };
  }

  // Quando acaba antes ou depois do previsto, aprende o ritmo real da pessoa
  function novoRitmo(linha, registro, hojeData) {
    var hoje = hojeData || hojeISO();
    var antigo = registro.ritmo || 1;
    var dias = Math.max(1, diasEntre(registro.compradoEm, hoje));
    var previsto = registro.gramas / (linha.porDia * antigo);
    // Se estragou antes de acabar, a validade explica, e o ritmo não muda
    var validade = linha.granel ? linha.produto.dura : linha.produto.dura * (registro.embalagens || 1);
    if (previsto > validade) return antigo;
    var medido = antigo * previsto / dias;
    return Math.max(0.5, Math.min(2, (antigo + medido) / 2));
  }

  /* --- Utilidades ------------------------------------------------------------------------------- */

  function arredondar(qtd) {
    return Math.round(qtd * 2) / 2;
  }

  // Plural da medida e dos adjetivos que vêm com ela, até o primeiro "de" ou parêntese
  var PLURAIS = {
    'colher': 'colheres', 'concha': 'conchas', 'pegador': 'pegadores', 'prato': 'pratos', 'unidade': 'unidades',
    'fatia': 'fatias', 'pedaço': 'pedaços', 'filé': 'filés', 'bife': 'bifes', 'gomo': 'gomos', 'lata': 'latas',
    'pote': 'potes', 'copo': 'copos', 'xícara': 'xícaras', 'quadradinho': 'quadradinhos', 'barra': 'barras',
    'ponta': 'pontas', 'pacote': 'pacotes', 'porção': 'porções', 'média': 'médias', 'médio': 'médios',
    'pequena': 'pequenas', 'raso': 'rasos'
  };

  function numero(qtd) {
    var inteiro = Math.floor(qtd);
    var meio = qtd - inteiro >= 0.5;
    if (!inteiro) return meio ? 'meia' : '0';
    return String(inteiro) + (meio ? ' e meia' : '');
  }

  function descreverItem(item) {
    var a = D.porAlimento[item.alimento];
    var medida = (a.medidas[item.medida] || a.medidas[0]).rotulo;
    var qtd = Math.max(0.5, arredondar(item.qtd));
    if (qtd > 1) {
      var parar = false;
      medida = medida.split(' ').map(function (palavra) {
        if (parar || palavra === 'de' || palavra.charAt(0) === '(') { parar = true; return palavra; }
        return PLURAIS[palavra] || palavra;
      }).join(' ');
    }
    return numero(qtd) + ' ' + medida + ' de ' + a.nome.charAt(0).toLowerCase() + a.nome.slice(1);
  }

  return {
    ATIVIDADES: ATIVIDADES, OBJETIVOS: OBJETIVOS, REFEICOES: REFEICOES, FREQUENCIAS: FREQUENCIAS,
    OPCOES: OPCOES, opcaoDaRefeicao: opcaoDaRefeicao,
    gasto: gasto, nutrientes: nutrientes, novoItem: novoItem, planoAjustado: planoAjustado, planoNovo: planoNovo,
    compras: compras, frequenciaDeCompra: frequenciaDeCompra, indiceRegional: indiceRegional, precoDe: precoDe,
    descreverItem: descreverItem, gramasDoItem: gramasDoItem,
    opcoesDeTroca: opcoesDeTroca, aplicarPreferencias: aplicarPreferencias, kcalDoItem: kcalDoItem,
    hojeISO: hojeISO, diasEntre: diasEntre, somarDias: somarDias,
    sugestaoDeCompra: sugestaoDeCompra, situacaoNoEstoque: situacaoNoEstoque, novoRitmo: novoRitmo
  };
})();
