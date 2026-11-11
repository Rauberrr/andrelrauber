/* Guarda-roupa: monta as sugestões de looks com regras de cor, formalidade,
   clima e caimento. Roda no navegador, sem custo e na hora. */
window.AR_LOOKS = (function () {
  'use strict';

  var gr = window.AR_GR;
  var POR_PAGINA = 12;
  var NOTA_MINIMA = 2;

  // Combinações de duas cores vivas que funcionam bem juntas
  var PARES = {
    'azul|rosa': 1, 'azul|laranja': 1, 'azul|amarelo': 1, 'bordo|rosa': 1,
    'verde|rosa': 1, 'bordo|verde': 1, 'laranja|roxo': 1
  };
  // Neutras que brigam um pouco quando ficam lado a lado
  var EVITAR = {
    'azul_marinho|preto': 1, 'marrom|preto': 1, 'caramelo|preto': 1, 'caqui|preto': 1
  };

  // Só as melhores entram na conta de variedade, que fica lenta com muitas combinações
  var MAXIMO_PARA_VARIAR = 240;
  // Calças e shorts de esporte não combinam com camisa, blazer ou sapato de couro
  var BAIXO_ESPORTIVO = { calca_moletom: 1, short_esportivo: 1 };
  var CAMADA_ARRUMADA = { blazer: 1, colete: 1, sobretudo: 1 };
  var CALCADO_ESPORTIVO = { tenis: 1, sandalia: 1, chinelo: 1 };

  var NIVEIS = { esporte_fino: 2 };
  gr.FORMALIDADES.forEach(function (f) { NIVEIS[f.id] = f.nivel; });

  function par(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  // Nas frases, a calça jeans aparece como jeans, e não pela cor
  function nomeCor(p) { return p.tipo === 'jeans' ? 'jeans' : gr.porCor[p.cor].nome; }
  function grupo(p) { return gr.porTipo[p.tipo] ? gr.porTipo[p.tipo].grupo : ''; }
  function nivelDe(p) { return NIVEIS[p.formalidade] !== undefined ? NIVEIS[p.formalidade] : 1; }

  // Jeans combina como neutro, mesmo sendo azul
  function neutra(p) { return p.tipo === 'jeans' || gr.porCor[p.cor].neutra; }

  function harmonia(a, b) {
    if (a.cor === 'estampado' && b.cor === 'estampado') {
      return { nota: -9, motivo: '' };
    }
    if (a.cor === b.cor && a.cor !== 'estampado') {
      return neutra(a) && neutra(b)
        ? { nota: 2, motivo: 'Tom sobre tom em ' + nomeCor(a) + ', um visual limpo e alongado.' }
        : { nota: -1, motivo: '' };
    }
    if (neutra(a) && neutra(b)) {
      if (EVITAR[par(a.cor, b.cor)]) return { nota: -1, motivo: '' };
      return { nota: 3, motivo: frase(a, b) + ': dois neutros que sempre conversam.' };
    }
    if (neutra(a) || neutra(b)) {
      var viva = neutra(a) ? b : a;
      var calma = neutra(a) ? a : b;
      return viva.cor === 'estampado'
        ? { nota: 3, motivo: 'O ' + nomeCor(calma) + ' equilibra a estampa, que fica em destaque.' }
        : { nota: 3, motivo: 'O ' + nomeCor(calma) + ' deixa o ' + nomeCor(viva) + ' em destaque.' };
    }
    if (PARES[par(a.cor, b.cor)]) {
      return { nota: 2, motivo: frase(a, b) + ': duas cores que se valorizam.' };
    }
    return { nota: -9, motivo: '' };
  }

  function frase(a, b) {
    var texto = nomeCor(a) + ' e ' + nomeCor(b);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  function formalidadeCombina(lista) {
    var niveis = lista.map(nivelDe);
    return Math.max.apply(null, niveis) - Math.min.apply(null, niveis) <= 1;
  }

  function climaCombina(lista) {
    var tem = {};
    lista.forEach(function (p) { tem[p.clima] = true; });
    return !(tem.calor && tem.frio);
  }

  function aceitaClima(p, clima) {
    if (!clima) return true;
    if (clima === 'meia_estacao') return p.clima === 'qualquer' || p.clima === 'meia_estacao';
    return clima === 'calor' ? p.clima !== 'frio' : p.clima !== 'calor';
  }

  function nivelDoLook(lista) {
    var soma = lista.reduce(function (t, p) { return t + nivelDe(p); }, 0);
    return soma / lista.length;
  }

  function roupasECalcados(lista) {
    return lista.filter(function (p) { return grupo(p) !== 'acessorio'; });
  }

  // Misto é o que junta peça arrumada com peça casual, como camisa com jeans e tênis
  function ehMisto(lista) {
    var niveis = roupasECalcados(lista).map(nivelDe);
    return Math.min.apply(null, niveis) <= 1 && Math.max.apply(null, niveis) >= 2;
  }

  // A ocasião mais marcada nas roupas e calçados. No empate, a mais arrumada.
  function ocasiaoDoLook(lista) {
    if (ehMisto(lista)) return 'misto';
    var principais = roupasECalcados(lista);
    var contagem = {};
    principais.forEach(function (p) {
      var id = gr.porFormalidade[p.formalidade] ? p.formalidade : 'misto';
      contagem[id] = (contagem[id] || 0) + 1;
    });
    var melhor = '';
    Object.keys(contagem).forEach(function (id) {
      if (!melhor || contagem[id] > contagem[melhor] ||
        (contagem[id] === contagem[melhor] && NIVEIS[id] > NIVEIS[melhor])) {
        melhor = id;
      }
    });
    return melhor;
  }

  function rotuloDaOcasiao(lista) {
    var f = gr.porFormalidade[ocasiaoDoLook(lista)];
    return f ? (f.curto || f.rotulo) : '';
  }

  function chaveDe(lista) {
    return lista.map(function (p) { return p.id; }).sort(function (a, b) { return a - b; }).join('-');
  }

  function notaDoCaimento(cima, baixo) {
    var soltos = { relaxed: 1, oversized: 1 };
    if (cima.corte === 'oversized' && baixo.corte === 'oversized') return { nota: -2, motivo: '' };
    if (soltos[cima.corte] && baixo.corte === 'slim') {
      return { nota: 1, motivo: 'A parte de cima mais solta com a de baixo ajustada equilibra as proporções.' };
    }
    if (cima.corte === 'slim' && soltos[baixo.corte]) {
      return { nota: 1, motivo: 'A parte de cima ajustada com a de baixo mais solta equilibra as proporções.' };
    }
    return { nota: 0, motivo: '' };
  }

  function avaliarAcrescimo(peca, base) {
    var nota = 0;
    var motivo = '';
    for (var i = 0; i < base.length; i += 1) {
      var h = harmonia(peca, base[i]);
      if (h.nota <= -9) return null;
      nota += h.nota;
      if (!motivo) motivo = h.motivo;
    }
    return { nota: nota / base.length, motivo: motivo };
  }

  // Com notas iguais, a semente alterna entre as opções, para os looks não repetirem o mesmo tênis
  function melhorCom(opcoes, base, clima, aceita, semente) {
    var empatadas = [];
    var maior = -Infinity;
    opcoes.forEach(function (p) {
      if (!aceitaClima(p, clima) || !aceita(p)) return;
      if (!formalidadeCombina(base.concat([p])) || !climaCombina(base.concat([p]))) return;
      var a = avaliarAcrescimo(p, base);
      if (!a || a.nota < 0 || a.nota < maior) return;
      if (a.nota > maior) { maior = a.nota; empatadas = []; }
      empatadas.push({ peca: p, nota: a.nota, motivo: a.motivo });
    });
    return empatadas.length ? empatadas[(semente || 0) % empatadas.length] : null;
  }

  // Pares que as regras de cor deixariam passar, mas ninguém usaria
  function combinacaoEstranha(cima, baixo, camada) {
    if (cima.tipo === 'regata' && camada) return true;
    if (!BAIXO_ESPORTIVO[baixo.tipo]) return false;
    return cima.tipo === 'camisa' || cima.tipo === 'polo' || Boolean(camada && CAMADA_ARRUMADA[camada.tipo]);
  }

  function montarCandidato(grupos, cima, baixo, camada, clima) {
    var roupa = camada && camada !== baixo ? [cima, camada, baixo] : [cima, baixo];
    if (!roupa.every(function (p) { return aceitaClima(p, clima); })) return null;
    if (!formalidadeCombina(roupa) || !climaCombina(roupa)) return null;
    if (combinacaoEstranha(cima, baixo, camada)) return null;
    var semente = cima.id + baixo.id;

    var motivos = [];
    var nota = 0;
    var principal = harmonia(cima, baixo);
    if (principal.nota <= -9) return null;
    nota += principal.nota;
    if (principal.motivo) motivos.push(principal.motivo);

    if (camada && camada !== baixo) {
      var extra = avaliarAcrescimo(camada, [cima, baixo]);
      if (!extra) return null;
      nota += extra.nota;
      if (extra.motivo && motivos.length < 2) motivos.push(extra.motivo);
    }

    var caimento = notaDoCaimento(cima, baixo);
    nota += caimento.nota;
    if (caimento.motivo) motivos.push(caimento.motivo);

    var sobMedida = roupa.filter(function (p) { return p.corte === 'sob_medida'; }).length;
    if (sobMedida) {
      nota += sobMedida;
      motivos.push(sobMedida > 1 ? 'As peças sob medida dão mais presença ao conjunto.' : 'A peça sob medida dá mais presença ao conjunto.');
    }

    var calcado = melhorCom(grupos.calcado, roupa, clima, function (p) {
      return !BAIXO_ESPORTIVO[baixo.tipo] || Boolean(CALCADO_ESPORTIVO[p.tipo]);
    }, semente);
    var conjunto = roupa.slice();
    if (calcado) {
      conjunto.push(calcado.peca);
      nota += calcado.nota / 2;
    }

    var nivel = nivelDoLook(conjunto);

    if (baixo.tipo !== 'bermuda' && baixo.tipo !== 'terno' && !BAIXO_ESPORTIVO[baixo.tipo]) {
      var cinto = melhorCom(grupos.cinto, conjunto, clima, function () { return true; }, semente);
      if (cinto) conjunto.push(cinto.peca);
    }
    if (nivel >= 2.4 && cima.tipo === 'camisa' && camada) {
      var gravata = melhorCom(grupos.gravata, roupa, clima, function () { return true; }, semente);
      if (gravata) conjunto.push(gravata.peca);
    }
    // O boné aparece em parte dos looks casuais, para não virar regra
    if (nivel <= 1.5 && grupos.bone.length && semente % 3 === 0) {
      var bone = melhorCom(grupos.bone, roupa, clima, function () { return true; }, semente);
      if (bone) conjunto.push(bone.peca);
    }

    if (nota < NOTA_MINIMA) return null;
    return {
      pecas: conjunto, chave: chaveDe(conjunto), nivel: nivel, misto: ehMisto(conjunto),
      ocasiao: rotuloDaOcasiao(conjunto), nota: nota, motivos: motivos.slice(0, 3)
    };
  }

  function separar(pecas) {
    var g = { cima: [], baixo: [], camada: [], conjunto: [], calcado: [], cinto: [], gravata: [], bone: [] };
    pecas.forEach(function (p) {
      var nome = grupo(p);
      if (nome === 'acessorio') {
        if (g[p.tipo]) g[p.tipo].push(p);
      } else if (g[nome]) {
        g[nome].push(p);
      }
    });
    return g;
  }

  // Ordena pela nota, mas evita repetir as mesmas peças em todos os looks
  function variar(candidatos) {
    var usos = {};
    var restantes = candidatos.slice();
    var saida = [];
    function ajustada(c) {
      var repeticoes = c.pecas.reduce(function (t, p) {
        return t + (grupo(p) === 'calcado' ? 0 : (usos[p.id] || 0));
      }, 0);
      return c.nota - repeticoes * 0.8;
    }
    while (restantes.length) {
      var melhorI = 0;
      var melhorNota = -Infinity;
      for (var i = 0; i < restantes.length; i += 1) {
        var n = ajustada(restantes[i]);
        if (n > melhorNota) { melhorNota = n; melhorI = i; }
      }
      var escolhido = restantes.splice(melhorI, 1)[0];
      escolhido.pecas.forEach(function (p) { usos[p.id] = (usos[p.id] || 0) + 1; });
      saida.push(escolhido);
    }
    return saida;
  }

  function todasAsCombinacoes(pecas, clima) {
    var grupos = separar(pecas);
    var vistos = {};
    var candidatos = [];

    function acrescentar(c) {
      if (!c || vistos[c.chave]) return;
      vistos[c.chave] = true;
      candidatos.push(c);
    }

    grupos.cima.forEach(function (cima) {
      grupos.baixo.forEach(function (baixo) {
        acrescentar(montarCandidato(grupos, cima, baixo, null, clima));
        grupos.camada.forEach(function (camada) {
          acrescentar(montarCandidato(grupos, cima, baixo, camada, clima));
        });
      });
      grupos.conjunto.forEach(function (terno) {
        acrescentar(montarCandidato(grupos, cima, terno, terno, clima));
      });
    });
    return candidatos;
  }

  // Salvar ou rejeitar um look redesenha a lista: sem as peças mudarem, a conta é reaproveitada
  var guardadas = { chave: '', combinacoes: [] };

  function combinacoesDe(pecas, clima) {
    var chave = clima + '|' + pecas.map(function (p) {
      return [p.id, p.tipo, p.cor, p.corte, p.formalidade, p.clima].join(':');
    }).join(',');
    if (guardadas.chave !== chave) {
      guardadas = { chave: chave, combinacoes: todasAsCombinacoes(pecas, clima) };
    }
    return guardadas.combinacoes;
  }

  // filtros: { ocasiao: id da ocasião ou '', clima: id do clima ou '' }. decisoes: { chave: 'salvo'|'descartado' }
  function sugerir(pecas, filtros, decisoes) {
    var clima = filtros && filtros.clima ? filtros.clima : '';
    var ocasiao = filtros && filtros.ocasiao ? gr.porFormalidade[filtros.ocasiao] : null;
    var candidatos = combinacoesDe(pecas, clima).filter(function (c) {
      if (decisoes && decisoes[c.chave] === 'descartado') return false;
      if (!ocasiao) return true;
      if (ocasiao.id === 'misto') return c.misto || c.ocasiao === ocasiao.curto;
      if (ocasiao.id === 'casual' && c.misto) return false;
      // Fora isso, vale a proximidade: um look arrumado serve para trabalho e também para festa
      return Math.abs(c.nivel - ocasiao.nivel) <= 0.5;
    });
    candidatos.sort(function (a, b) { return b.nota - a.nota; });
    return variar(candidatos.slice(0, MAXIMO_PARA_VARIAR));
  }

  // O que falta para o guarda-roupa começar a gerar looks
  function oQueFalta(pecas) {
    var g = separar(pecas);
    var falta = [];
    if (!g.cima.length) falta.push('uma peça de cima, como camiseta ou camisa');
    if (!g.baixo.length && !g.conjunto.length) falta.push('uma peça de baixo, como calça ou bermuda');
    return falta;
  }

  function temSobreposicao(pecas) {
    var g = separar(pecas);
    return g.camada.length > 0 || g.conjunto.length > 0;
  }

  // Quantos looks uma peça nova abriria: as combinações que só existem com ela
  function looksCom(pecas, nova) {
    return todasAsCombinacoes(pecas.concat([nova]), '').filter(function (c) {
      return c.pecas.some(function (p) { return p.id === nova.id; });
    }).sort(function (a, b) { return b.nota - a.nota; });
  }

  function totalDeLooks(pecas) { return combinacoesDe(pecas, '').length; }

  return {
    POR_PAGINA: POR_PAGINA, sugerir: sugerir, oQueFalta: oQueFalta,
    temSobreposicao: temSobreposicao, chaveDe: chaveDe, rotuloDaOcasiao: rotuloDaOcasiao,
    looksCom: looksCom, totalDeLooks: totalDeLooks
  };
})();
