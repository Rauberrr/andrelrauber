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
  var ENDERECO_WORKER = 'assets/js/guarda-roupa-fundo-worker.js?v=20261110a';
  // Mudou com a ferramenta mais precisa: quem já tinha a antiga é avisado do novo download
  var CHAVE_PRONTO = 'ar-guarda-roupa-fundo-2';

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

  // A ferramenta deixa partes da peça meio transparentes, sobretudo em tecidos claros.
  // Aqui o contorno fica firme: o que é quase peça vira peça, o que é quase fundo some.
  function firmarContorno(canvas) {
    var ctx = canvas.getContext('2d');
    var imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var px = imagem.data;
    for (var i = 3; i < px.length; i += 4) {
      var a = px[i];
      if (a === 0 || a === 255) continue;
      px[i] = a < 40 ? 0 : (a > 190 ? 255 : Math.round((a - 40) * 255 / 150));
    }
    ctx.putImageData(imagem, 0, 0);
  }

  // Buracos dentro da peça, que a ferramenta apagou por engano, voltam com os pixels da foto
  // original. Só os buracos fechados e pequenos: a abertura de uma alça de bolsa fica como está.
  var BURACO_MAXIMO = 0.06;

  function preencherBuracos(canvas, original) {
    var l = canvas.width;
    var a = canvas.height;
    if (!original || original.width !== l || original.height !== a) return;
    var ctx = canvas.getContext('2d');
    var imagem = ctx.getImageData(0, 0, l, a);
    var px = imagem.data;
    var foto = original.getContext('2d').getImageData(0, 0, l, a).data;
    var total = l * a;
    var marca = new Uint8Array(total);
    var pilha = new Int32Array(total);
    var topo = 0;
    var peca = 0;
    var i;
    function vazio(k) { return px[k * 4 + 3] < 128; }
    for (i = 0; i < total; i += 1) if (!vazio(i)) peca += 1;
    // O fundo de verdade encosta na borda da foto
    for (var x = 0; x < l; x += 1) {
      [x, (a - 1) * l + x].forEach(function (k) { if (vazio(k) && !marca[k]) { marca[k] = 1; pilha[topo++] = k; } });
    }
    for (var y = 0; y < a; y += 1) {
      [y * l, y * l + l - 1].forEach(function (k) { if (vazio(k) && !marca[k]) { marca[k] = 1; pilha[topo++] = k; } });
    }
    while (topo > 0) {
      var atual = pilha[--topo];
      var ax = atual % l;
      var viz = [ax > 0 ? atual - 1 : -1, ax < l - 1 ? atual + 1 : -1, atual - l, atual + l];
      for (var v = 0; v < 4; v += 1) {
        var n = viz[v];
        if (n >= 0 && n < total && !marca[n] && vazio(n)) { marca[n] = 1; pilha[topo++] = n; }
      }
    }
    // O que ficou vazio e sem marca é buraco: agrupa e devolve os pequenos
    var limite = peca * BURACO_MAXIMO;
    for (i = 0; i < total; i += 1) {
      if (marca[i] || !vazio(i)) continue;
      var grupo = [];
      marca[i] = 2;
      pilha[0] = i;
      topo = 1;
      while (topo > 0) {
        var b = pilha[--topo];
        grupo.push(b);
        var bx = b % l;
        var vz = [bx > 0 ? b - 1 : -1, bx < l - 1 ? b + 1 : -1, b - l, b + l];
        for (var w = 0; w < 4; w += 1) {
          var m = vz[w];
          if (m >= 0 && m < total && !marca[m] && vazio(m)) { marca[m] = 2; pilha[topo++] = m; }
        }
      }
      if (grupo.length > limite) continue;
      grupo.forEach(function (k) {
        var o = k * 4;
        px[o] = foto[o];
        px[o + 1] = foto[o + 1];
        px[o + 2] = foto[o + 2];
        px[o + 3] = 255;
      });
    }
    ctx.putImageData(imagem, 0, 0);
  }

  // O eixo principal da peça, pela distribuição dos pixels. Calças e camisas costumam
  // ficar em pé; sapatos e bonés, deitados. Devolve o giro, em graus, para endireitar.
  function inclinacao(canvas) {
    var l = canvas.width;
    var a = canvas.height;
    var px = canvas.getContext('2d').getImageData(0, 0, l, a).data;
    var n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (var y = 0; y < a; y += 2) {
      for (var x = 0; x < l; x += 2) {
        if (px[(y * l + x) * 4 + 3] < 128) continue;
        n += 1; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      }
    }
    if (n < 50) return 0;
    var mx = sx / n, my = sy / n;
    var cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my;
    // Peças quase redondas ou quadradas não têm um eixo claro
    var media = (cxx + cyy) / 2;
    var dif = Math.sqrt(Math.pow((cxx - cyy) / 2, 2) + cxy * cxy);
    if ((media + dif) / Math.max(media - dif, 1) < 1.35) return 0;
    var angulo = 0.5 * Math.atan2(2 * cxy, cxx - cyy) * 180 / Math.PI;
    // Gira para o eixo em pé ou deitado mais próximo, só quando a diferença é pequena
    var alvo = Math.abs(angulo) > 45 ? (angulo > 0 ? 90 : -90) : 0;
    var desvio = angulo - alvo;
    return Math.abs(desvio) >= 1.5 && Math.abs(desvio) <= 20 ? -desvio : 0;
  }

  function rotacionar(canvas, graus) {
    if (!graus) return canvas;
    var r = graus * Math.PI / 180;
    var c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
    var novo = novoCanvas(Math.ceil(canvas.width * c + canvas.height * s), Math.ceil(canvas.width * s + canvas.height * c));
    var ctx = novo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(novo.width / 2, novo.height / 2);
    ctx.rotate(r);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return novo;
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

  // Coloca a peça no centro, do mesmo tamanho em todas as fotos, já girada
  function centralizar(peca, graus) {
    var girada = rotacionar(peca, graus);
    var area = areaDaPeca(girada);
    if (!area) return null;
    var final = novoCanvas(LARGURA_FINAL, ALTURA_FINAL);
    var util = 1 - MARGEM * 2;
    var escala = Math.min(LARGURA_FINAL * util / area.l, ALTURA_FINAL * util / area.a);
    var l = area.l * escala;
    var a = area.a * escala;
    var ctx = final.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(girada, area.x, area.y, area.l, area.a, (LARGURA_FINAL - l) / 2, (ALTURA_FINAL - a) / 2, l, a);
    final.area = area;
    return final;
  }

  // Corta o vazio, firma o contorno, devolve partes apagadas, endireita e centraliza.
  // original: a foto antes de tirar o fundo, do mesmo tamanho. Devolve null quando
  // o recorte não encontrou uma peça de verdade. O resultado guarda a peça limpa e o
  // giro automático, para a pessoa ajustar o ângulo depois com ajustarAngulo().
  function enquadrar(recorte, original) {
    return decodificar(recorte).then(function (imagem) {
      var bruto = novoCanvas(imagem.width, imagem.height);
      bruto.getContext('2d').drawImage(imagem, 0, 0);
      if (imagem.close) imagem.close();

      firmarContorno(bruto);
      limparManchas(bruto);
      preencherBuracos(bruto, original);
      var area = areaDaPeca(bruto);
      if (!area || area.parte < 0.02 || area.parte > 0.98) return null;

      var giro = inclinacao(bruto);
      var final = centralizar(bruto, giro);
      if (!final) return null;
      final.peca = bruto;
      final.giroAutomatico = giro;
      // Um recorte quase retangular costuma ser o fundo que ficou junto com a peça
      final.fundoSuspeito = area.preenchido > 0.9;
      return final;
    });
  }

  // Ajuste fino do ângulo, a partir da peça limpa, sem perder qualidade a cada toque
  function ajustarAngulo(final, graus) {
    if (!final || !final.peca) return final;
    var novo = centralizar(final.peca, final.giroAutomatico + graus);
    if (!novo) return final;
    novo.peca = final.peca;
    novo.giroAutomatico = final.giroAutomatico;
    novo.fundoSuspeito = final.fundoSuspeito;
    return novo;
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
    enquadrar: enquadrar, ajustarAngulo: ajustarAngulo, exportar: exportar, corPrincipal: corPrincipal, reduzir: reduzir
  };
})();
