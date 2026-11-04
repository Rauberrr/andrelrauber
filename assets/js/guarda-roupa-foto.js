/* Guarda-roupa: prepara a foto da peça no aparelho da pessoa */
window.AR_FOTO = (function () {
  'use strict';

  var MAIOR_LADO_ENTRADA = 1600;
  var LARGURA_FINAL = 1000;
  var ALTURA_FINAL = 1250;
  var MARGEM = 0.06;
  // Limite pensado para caber no envio de hospedagens mais restritas
  var MAXIMO_BYTES = 1800000;
  var LIMITE_MS = 180000;
  var ENDERECO_WORKER = 'assets/js/guarda-roupa-fundo-worker.js?v=20261104c';
  var CHAVE_PRONTO = 'ar-guarda-roupa-fundo';

  function novoCanvas(l, a) {
    var c = document.createElement('canvas');
    c.width = l;
    c.height = a;
    return c;
  }

  function decodificar(arquivo) {
    if (window.createImageBitmap) {
      return createImageBitmap(arquivo, { imageOrientation: 'from-image' }).catch(function () {
        return decodificarPorImagem(arquivo);
      });
    }
    return decodificarPorImagem(arquivo);
  }

  function decodificarPorImagem(arquivo) {
    return new Promise(function (ok, erro) {
      var url = URL.createObjectURL(arquivo);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); erro(new Error('foto')); };
      img.src = url;
    });
  }

  // Abre a foto na posição certa e reduz para um tamanho que o celular aguenta
  function abrir(arquivo) {
    return decodificar(arquivo).then(function (imagem) {
      var l = imagem.width || imagem.naturalWidth;
      var a = imagem.height || imagem.naturalHeight;
      var escala = Math.min(1, MAIOR_LADO_ENTRADA / Math.max(l, a));
      var canvas = novoCanvas(Math.round(l * escala), Math.round(a * escala));
      canvas.getContext('2d').drawImage(imagem, 0, 0, canvas.width, canvas.height);
      if (imagem.close) imagem.close();
      return canvas;
    });
  }

  function paraBlob(canvas, tipo, qualidade) {
    return new Promise(function (ok, erro) {
      canvas.toBlob(function (blob) {
        if (blob) ok(blob); else erro(new Error('foto'));
      }, tipo, qualidade);
    });
  }

  /* --- Remoção do fundo ---------------------------------------------------------- */

  var worker = null;

  function encerrarWorker() {
    if (worker) worker.terminate();
    worker = null;
  }

  function podeRemover() {
    return typeof Worker === 'function' && typeof WebAssembly === 'object';
  }

  function jaBaixou() {
    try { return localStorage.getItem(CHAVE_PRONTO) === '1'; } catch (e) { return false; }
  }

  // aoProgredir recebe { fase: 'baixando' | 'processando', parte: 0 a 1 }
  function removerFundo(canvas, aoProgredir) {
    var tarefa = {};
    var totais = {};
    var encerrar = function () {};

    tarefa.cancelar = function () {
      encerrarWorker();
      encerrar(new Error('cancelado'));
    };

    tarefa.resultado = paraBlob(canvas, 'image/jpeg', 0.92).then(function (foto) {
      return new Promise(function (ok, erro) {
        var limite = setTimeout(function () {
          encerrarWorker();
          erro(new Error('demorou'));
        }, LIMITE_MS);

        encerrar = function (motivo) {
          clearTimeout(limite);
          erro(motivo);
        };

        if (!worker) worker = new Worker(ENDERECO_WORKER, { type: 'module' });

        worker.onerror = function () {
          encerrarWorker();
          encerrar(new Error('worker'));
        };
        worker.onmessage = function (m) {
          var d = m.data;
          if (d.progresso) {
            totais[d.progresso.chave] = d.progresso;
            aoProgredir(resumir(totais));
          } else if (d.recorte) {
            clearTimeout(limite);
            try { localStorage.setItem(CHAVE_PRONTO, '1'); } catch (e) { /* segue sem lembrar */ }
            ok(d.recorte);
          } else if (d.erro) {
            encerrarWorker();
            encerrar(new Error(d.erro));
          }
        };
        worker.postMessage(foto);
      });
    });
    return tarefa;
  }

  function resumir(totais) {
    var chaves = Object.keys(totais);
    var processando = chaves.filter(function (c) { return c.indexOf('compute') === 0; });
    if (processando.length) {
      var p = totais[processando[processando.length - 1]];
      return { fase: 'processando', parte: p.total ? p.atual / p.total : 0 };
    }
    var atual = 0;
    var total = 0;
    chaves.forEach(function (c) { atual += totais[c].atual; total += totais[c].total; });
    return { fase: 'baixando', parte: total ? atual / total : 0 };
  }

  /* --- Foto final ------------------------------------------------------------------ */

  // O recorte às vezes deixa manchas soltas do fundo. Mantém só os blocos grandes:
  // a peça, ou as duas partes de um par de sapatos, por exemplo.
  var BLOCO_MINIMO = 0.15;

  function limparManchas(canvas) {
    var l = canvas.width;
    var a = canvas.height;
    var ctx = canvas.getContext('2d');
    var imagem = ctx.getImageData(0, 0, l, a);
    var pixels = imagem.data;
    // Analisa em metade do tamanho, o que basta para achar os blocos e é mais rápido
    var ml = Math.ceil(l / 2);
    var ma = Math.ceil(a / 2);
    var rotulos = new Int32Array(ml * ma);
    var pilha = new Int32Array(ml * ma);
    var tamanhos = [0];
    var x, y, i;

    function firme(celula) {
      var cx = celula % ml;
      var cy = (celula - cx) / ml;
      return pixels[(Math.min(cy * 2, a - 1) * l + Math.min(cx * 2, l - 1)) * 4 + 3] >= 128;
    }

    for (i = 0; i < rotulos.length; i += 1) {
      if (rotulos[i] || !firme(i)) continue;
      var rotulo = tamanhos.length;
      var tamanho = 0;
      var topo = 0;
      pilha[topo++] = i;
      rotulos[i] = rotulo;
      while (topo > 0) {
        var atual = pilha[--topo];
        tamanho += 1;
        var ax = atual % ml;
        var vizinhos = [ax > 0 ? atual - 1 : -1, ax < ml - 1 ? atual + 1 : -1, atual - ml, atual + ml];
        for (var v = 0; v < 4; v += 1) {
          var n = vizinhos[v];
          if (n >= 0 && n < rotulos.length && !rotulos[n] && firme(n)) {
            rotulos[n] = rotulo;
            pilha[topo++] = n;
          }
        }
      }
      tamanhos.push(tamanho);
    }

    var maior = Math.max.apply(null, tamanhos);
    if (!maior) return;

    function mantem(cx, cy) {
      if (cx < 0 || cy < 0 || cx >= ml || cy >= ma) return false;
      var r = rotulos[cy * ml + cx];
      return r > 0 && tamanhos[r] >= maior * BLOCO_MINIMO;
    }

    // O contorno suave da peça fica: só some o que está longe de um bloco grande
    for (y = 0; y < a; y += 1) {
      for (x = 0; x < l; x += 1) {
        var p = (y * l + x) * 4 + 3;
        if (!pixels[p]) continue;
        var cx = x >> 1;
        var cy = y >> 1;
        var perto = false;
        for (var dy = -1; dy <= 1 && !perto; dy += 1) {
          for (var dx = -1; dx <= 1 && !perto; dx += 1) {
            perto = mantem(cx + dx, cy + dy);
          }
        }
        if (!perto) pixels[p] = 0;
      }
    }
    ctx.putImageData(imagem, 0, 0);
  }

  // Encontra onde a peça está depois de tirar o fundo
  function areaDaPeca(canvas) {
    var l = canvas.width;
    var a = canvas.height;
    var pixels = canvas.getContext('2d').getImageData(0, 0, l, a).data;
    var minX = l, minY = a, maxX = -1, maxY = -1, cheios = 0;
    for (var y = 0; y < a; y += 1) {
      for (var x = 0; x < l; x += 1) {
        if (pixels[(y * l + x) * 4 + 3] > 24) {
          cheios += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    var largura = maxX - minX + 1;
    var altura = maxY - minY + 1;
    return { x: minX, y: minY, l: largura, a: altura, parte: cheios / (l * a), preenchido: cheios / (largura * altura) };
  }

  // Corta o vazio, centraliza a peça e deixa todas as fotos do mesmo tamanho.
  // Devolve null quando o recorte não encontrou uma peça de verdade.
  function enquadrar(recorte) {
    return decodificar(recorte).then(function (imagem) {
      var bruto = novoCanvas(imagem.width, imagem.height);
      bruto.getContext('2d').drawImage(imagem, 0, 0);
      if (imagem.close) imagem.close();

      limparManchas(bruto);
      var area = areaDaPeca(bruto);
      if (!area || area.parte < 0.02 || area.parte > 0.98) return null;

      var final = novoCanvas(LARGURA_FINAL, ALTURA_FINAL);
      var util = 1 - MARGEM * 2;
      var escala = Math.min(LARGURA_FINAL * util / area.l, ALTURA_FINAL * util / area.a);
      var l = area.l * escala;
      var a = area.a * escala;
      var ctx = final.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bruto, area.x, area.y, area.l, area.a, (LARGURA_FINAL - l) / 2, (ALTURA_FINAL - a) / 2, l, a);
      // Um recorte quase retangular costuma ser o fundo que ficou junto com a peça
      final.fundoSuspeito = area.preenchido > 0.9;
      return final;
    });
  }

  function reduzir(canvas, escala) {
    var menor = novoCanvas(Math.round(canvas.width * escala), Math.round(canvas.height * escala));
    var ctx = menor.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, menor.width, menor.height);
    return menor;
  }

  // Alguns navegadores não geram WebP e devolvem PNG, que é maior: aí a foto encolhe
  function exportar(canvas, transparente) {
    var tentativas = 0;
    function tentar(atual) {
      var tipo = transparente ? 'image/webp' : 'image/jpeg';
      return paraBlob(atual, tipo, 0.86).then(function (blob) {
        if (blob.size <= MAXIMO_BYTES || tentativas >= 5) return blob;
        tentativas += 1;
        return tentar(reduzir(atual, 0.8));
      });
    }
    return tentar(canvas);
  }

  /* --- Cor sugerida ------------------------------------------------------------------ */

  function hexParaRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function distancia(a, b) {
    var media = (a[0] + b[0]) / 2;
    var r = a[0] - b[0], g = a[1] - b[1], bl = a[2] - b[2];
    return (2 + media / 256) * r * r + 4 * g * g + (2 + (255 - media) / 256) * bl * bl;
  }

  // Conta qual cor da lista aparece mais na peça. É só uma sugestão: a pessoa confirma.
  function corPrincipal(canvas, transparente) {
    var cores = window.AR_GR.CORES.filter(function (c) { return c.hex; }).map(function (c) {
      return { id: c.id, rgb: hexParaRgb(c.hex), votos: 0 };
    });
    var amostra = novoCanvas(64, 80);
    var ctx = amostra.getContext('2d');
    // Sem tirar o fundo, olha só o centro da foto, onde a peça costuma estar
    if (transparente) {
      ctx.drawImage(canvas, 0, 0, 64, 80);
    } else {
      ctx.drawImage(canvas, canvas.width * 0.3, canvas.height * 0.3, canvas.width * 0.4, canvas.height * 0.4, 0, 0, 64, 80);
    }
    var pixels = ctx.getImageData(0, 0, 64, 80).data;
    for (var i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 200) continue;
      var rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
      var melhor = cores[0];
      var menor = Infinity;
      for (var j = 0; j < cores.length; j += 1) {
        var d = distancia(rgb, cores[j].rgb);
        if (d < menor) { menor = d; melhor = cores[j]; }
      }
      melhor.votos += 1;
    }
    cores.sort(function (a, b) { return b.votos - a.votos; });
    return cores[0].votos ? cores[0].id : '';
  }

  return {
    abrir: abrir, podeRemover: podeRemover, jaBaixou: jaBaixou, removerFundo: removerFundo,
    enquadrar: enquadrar, exportar: exportar, corPrincipal: corPrincipal, reduzir: reduzir
  };
})();
