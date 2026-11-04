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

  var NIVEIS = { casual: 1, esporte_fino: 2, social: 3 };

  function par(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
  // Nas frases, a calça jeans aparece como jeans, e não pela cor
  function nomeCor(p) { return p.tipo === 'jeans' ? 'jeans' : gr.porCor[p.cor].nome; }
  function grupo(p) { return gr.porTipo[p.tipo] ? gr.porTipo[p.tipo].grupo : ''; }
  function nivelDe(p) { return NIVEIS[p.formalidade] || 1; }

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
    return clima === 'calor' ? p.clima !== 'frio' : p.clima !== 'calor';
  }

  function nivelDoLook(lista) {
    var soma = lista.reduce(function (t, p) { return t + nivelDe(p); }, 0);
    return Math.round(soma / lista.length);
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

  function melhorCom(opcoes, base, clima, aceita) {
    var melhor = null;
    opcoes.forEach(function (p) {
      if (!aceitaClima(p, clima) || !aceita(p)) return;
      if (!formalidadeCombina(base.concat([p])) || !climaCombina(base.concat([p]))) return;
      var a = avaliarAcrescimo(p, base);
      if (a && a.nota >= 0 && (!melhor || a.nota > melhor.nota)) {
        melhor = { peca: p, nota: a.nota, motivo: a.motivo };
      }
    });
    return melhor;
  }

  function montarCandidato(grupos, cima, baixo, camada, clima, nivelPedido) {
    var roupa = camada && camada !== baixo ? [cima, camada, baixo] : [cima, baixo];
    if (!roupa.every(function (p) { return aceitaClima(p, clima); })) return null;
    if (!formalidadeCombina(roupa) || !climaCombina(roupa)) return null;
    if (cima.tipo === 'regata' && camada) return null;

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

    var calcado = melhorCom(grupos.calcado, roupa, clima, function () { return true; });
    var conjunto = roupa.slice();
    if (calcado) {
      conjunto.push(calcado.peca);
      nota += calcado.nota / 2;
    }

    var nivel = nivelDoLook(conjunto);
    if (nivelPedido && nivel !== nivelPedido) return null;

    if (baixo.tipo !== 'bermuda' && baixo.tipo !== 'terno') {
      var cinto = melhorCom(grupos.cinto, conjunto, clima, function () { return true; });
      if (cinto) conjunto.push(cinto.peca);
    }
    if (nivel >= 2 && cima.tipo === 'camisa' && camada) {
      var gravata = melhorCom(grupos.gravata, roupa, clima, function () { return nivel === 3; });
      if (gravata) conjunto.push(gravata.peca);
    }

    if (nota < NOTA_MINIMA) return null;
    return { pecas: conjunto, chave: chaveDe(conjunto), nivel: nivel, nota: nota, motivos: motivos.slice(0, 3) };
  }

  function separar(pecas) {
    var g = { cima: [], baixo: [], camada: [], conjunto: [], calcado: [], cinto: [], gravata: [] };
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

  // filtros: { nivel: 1|2|3|null, clima: 'calor'|'frio'|'' }. decisoes: { chave: 'salvo'|'descartado' }
  function sugerir(pecas, filtros, decisoes) {
    var grupos = separar(pecas);
    var nivel = filtros && filtros.nivel ? filtros.nivel : null;
    var clima = filtros && filtros.clima ? filtros.clima : '';
    var vistos = {};
    var candidatos = [];

    function acrescentar(c) {
      if (!c || vistos[c.chave]) return;
      if (decisoes && decisoes[c.chave] === 'descartado') return;
      vistos[c.chave] = true;
      candidatos.push(c);
    }

    grupos.cima.forEach(function (cima) {
      grupos.baixo.forEach(function (baixo) {
        acrescentar(montarCandidato(grupos, cima, baixo, null, clima, nivel));
        grupos.camada.forEach(function (camada) {
          acrescentar(montarCandidato(grupos, cima, baixo, camada, clima, nivel));
        });
      });
      grupos.conjunto.forEach(function (terno) {
        acrescentar(montarCandidato(grupos, cima, terno, terno, clima, nivel));
      });
    });

    return variar(candidatos);
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

  return {
    POR_PAGINA: POR_PAGINA, sugerir: sugerir, oQueFalta: oQueFalta,
    temSobreposicao: temSobreposicao, chaveDe: chaveDe
  };
})();
