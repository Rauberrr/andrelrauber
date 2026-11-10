/* Home: a fita métrica desenrola e a camiseta 3D gira conforme a página rola.
   As duas seções ficam presas na tela enquanto a rolagem avança por elas. */
(function () {
  'use strict';

  var semMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Quanto da seção já foi rolado, de 0 a 1
  function progresso(secao) {
    var r = secao.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, -r.top / total));
  }

  function suave(t) { return t * t * (3 - 2 * t); }

  /* --- Fita métrica -------------------------------------------------------------------------- */

  function fita() {
    var secao = document.querySelector('.fita-secao');
    var tela = document.getElementById('fita-canvas');
    if (!secao || !tela || !tela.getContext) return;
    var ctx = tela.getContext('2d');
    var largura = 0;
    var altura = 0;
    var ultimo = -1;

    function medir() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      largura = tela.clientWidth;
      altura = tela.clientHeight;
      tela.width = Math.round(largura * dpr);
      tela.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ultimo = -1;
    }

    function desenhar(p) {
      ctx.clearRect(0, 0, largura, altura);
      var margem = Math.max(20, largura * 0.06);
      var chao = altura * 0.7;
      var banda = Math.max(7, Math.min(12, largura * 0.011));
      var camada = banda * 0.42;
      var cm = Math.max(5, Math.min(9, largura / 170));
      var inicio = margem;
      var maximo = largura - margem * 2 - 40;
      var aberta = maximo * suave(p);
      // Quanto mais fita sai, menor fica o rolo
      var restante = (maximo - aberta) + maximo * 0.12;
      var miolo = banda * 1.4;
      var raio = Math.sqrt(miolo * miolo + restante * camada / Math.PI);
      var cx = inicio + aberta + raio * 0.15;
      var cy = chao - raio;
      var giro = -aberta / Math.max(raio, 1);

      // Sombra suave sob o rolo e a fita
      var sombra = ctx.createRadialGradient(cx, chao + 4, 2, cx, chao + 4, raio * 1.4);
      sombra.addColorStop(0, 'rgba(11, 11, 10, .16)');
      sombra.addColorStop(1, 'rgba(11, 11, 10, 0)');
      ctx.fillStyle = sombra;
      ctx.fillRect(cx - raio * 1.5, chao - 6, raio * 3, 20);
      ctx.fillStyle = 'rgba(11, 11, 10, .07)';
      ctx.fillRect(inicio, chao + 1, aberta, 3);

      // A parte aberta: a fita com as marcas de centímetro
      ctx.fillStyle = '#fbf8f1';
      ctx.strokeStyle = '#0b0b0a';
      ctx.lineWidth = 1;
      ctx.fillRect(inicio, chao - banda, aberta + raio * 0.15, banda);
      ctx.beginPath();
      ctx.moveTo(inicio, chao - banda + .5);
      ctx.lineTo(cx, chao - banda + .5);
      ctx.moveTo(inicio, chao - .5);
      ctx.lineTo(cx, chao - .5);
      ctx.moveTo(inicio + .5, chao - banda);
      ctx.lineTo(inicio + .5, chao);
      ctx.stroke();
      ctx.fillStyle = '#0b0b0a';
      ctx.font = '500 ' + Math.round(Math.max(10, cm * 1.35)) + 'px Jost, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (var i = 0; i * cm <= aberta; i += 1) {
        var x = inicio + i * cm;
        var alto = i % 10 === 0 ? banda * 2.2 : (i % 5 === 0 ? banda * 1.5 : banda * 0.9);
        ctx.fillRect(Math.round(x), chao - banda - alto + banda, 1, alto - banda + 1);
        if (i % 10 === 0 && i > 0) ctx.fillText(String(i), x, chao - banda - alto + banda - 6);
      }

      // O rolo: a fita enrolada em espiral, girando enquanto rola
      ctx.save();
      ctx.translate(cx, cy);
      ctx.beginPath();
      ctx.arc(0, 0, raio + 1, 0, Math.PI * 2);
      ctx.fillStyle = '#fbf8f1';
      ctx.fill();
      ctx.strokeStyle = '#0b0b0a';
      ctx.lineWidth = 1;
      var voltas = Math.max(1, (raio - miolo) / camada);
      ctx.beginPath();
      var passos = Math.ceil(voltas * 90);
      for (var k = 0; k <= passos; k += 1) {
        var t = k / passos;
        var ang = Math.PI / 2 + giro + t * voltas * Math.PI * 2;
        var rr = raio - t * (raio - miolo);
        var px = Math.cos(ang) * rr;
        var py = Math.sin(ang) * rr;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // O miolo, com uma marca que mostra o giro
      ctx.beginPath();
      ctx.arc(0, 0, miolo * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = '#0b0b0a';
      ctx.fill();
      ctx.strokeStyle = '#fbf8f1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(giro) * miolo * 0.6, Math.sin(giro) * miolo * 0.6);
      ctx.stroke();
      ctx.restore();

      // A ponta de metal, no começo da fita
      ctx.fillStyle = '#7b1e31';
      ctx.fillRect(inicio - 4, chao - banda - 1, 5, banda + 2);
    }

    function quadro() {
      var p = semMovimento ? 1 : progresso(secao);
      if (Math.abs(p - ultimo) > 0.0005) { ultimo = p; desenhar(p); }
    }

    medir();
    quadro();
    window.addEventListener('resize', function () { medir(); quadro(); });
    window.addEventListener('scroll', function () { window.requestAnimationFrame(quadro); }, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ultimo = -1; quadro(); });
  }

  /* --- Camiseta 3D ----------------------------------------------------------------------------- */

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

  function carregarThree(pronto, falhou) {
    if (window.THREE) { pronto(); return; }
    var s = document.createElement('script');
    s.src = THREE_URL;
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.onload = function () { if (window.THREE) pronto(); else falhou(); };
    s.onerror = falhou;
    document.head.appendChild(s);
  }

  // Monta uma malha a partir de uma função (u, v) -> [x, y, z], com u em volta e v ao longo
  function malha(THREE, nu, nv, ponto) {
    var pos = [];
    var idx = [];
    for (var j = 0; j <= nv; j += 1) {
      for (var i = 0; i <= nu; i += 1) {
        var p = ponto(i / nu, j / nv);
        pos.push(p[0], p[1], p[2]);
      }
    }
    for (var jj = 0; jj < nv; jj += 1) {
      for (var ii = 0; ii < nu; ii += 1) {
        var a = jj * (nu + 1) + ii;
        var b = a + 1;
        var c = a + nu + 1;
        var d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function interpolar(pontos, v) {
    for (var i = 1; i < pontos.length; i += 1) {
      if (v <= pontos[i][0]) {
        var a = pontos[i - 1];
        var b = pontos[i];
        var t = (v - a[0]) / (b[0] - a[0]);
        t = t * t * (3 - 2 * t);
        return a[1] + (b[1] - a[1]) * t;
      }
    }
    return pontos[pontos.length - 1][1];
  }

  function montarCamiseta(THREE) {
    var grupo = new THREE.Group();
    var tecido = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    var acabamento = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.82, metalness: 0 });

    // Tronco: largura, profundidade e altura mudam da barra até o pescoço
    var LARG = [[0, 0.92], [0.25, 0.88], [0.55, 0.92], [0.8, 0.96], [0.9, 0.92], [0.96, 0.68], [1, 0.44]];
    var PROF = [[0, 0.42], [0.3, 0.41], [0.6, 0.46], [0.85, 0.42], [0.96, 0.33], [1, 0.27]];
    var ALTURA = [[0, -1.72], [0.8, 0.3], [0.9, 0.5], [0.96, 0.6], [1, 0.66]];
    function pontoTronco(u, v) {
      var a = u * Math.PI * 2;
      var w = interpolar(LARG, v);
      var d = interpolar(PROF, v);
      // Dobras leves do tecido
      var dobra = 1 + 0.014 * Math.sin(v * 26 + a * 3) * (1 - v) + 0.008 * Math.sin(a * 11);
      var x = Math.cos(a) * w * dobra;
      var z = Math.sin(a) * d * dobra;
      var y = interpolar(ALTURA, v);
      // Os ombros descem do pescoço para fora
      var topo = Math.max(0, (v - 0.78) / 0.22);
      var lado = Math.min(1, Math.max(0, (Math.abs(x) - 0.4) / 0.6));
      y -= topo * lado * lado * 0.2;
      // A gola fica um pouco mais baixa na frente
      if (v > 0.96) y -= Math.max(0, Math.sin(a)) * 0.09 * (v - 0.96) / 0.04;
      return [x, y, z];
    }
    grupo.add(new THREE.Mesh(malha(THREE, 96, 64, pontoTronco), tecido));

    // Gola e barra com ribana, seguindo a borda do tecido
    function borda(v, raio) {
      var pontos = [];
      for (var i = 0; i < 72; i += 1) {
        var q = pontoTronco(i / 72, v);
        pontos.push(new THREE.Vector3(q[0], q[1], q[2]));
      }
      return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontos, true), 144, raio, 10, true), acabamento);
    }
    grupo.add(borda(1, 0.05));
    grupo.add(borda(0, 0.022));

    // Mangas: tubos achatados que saem dos ombros, um pouco para baixo
    [-1, 1].forEach(function (lado) {
      var manga = malha(THREE, 48, 16, function (u, v) {
        var a = u * Math.PI * 2;
        var r = 0.4 - v * 0.08;
        var p = 0.27 - v * 0.03;
        var dobra = 1 + 0.02 * Math.sin(v * 9 + a * 2);
        return [v * 0.66, Math.cos(a) * r * dobra, Math.sin(a) * p * dobra];
      });
      var m = new THREE.Mesh(manga, tecido);
      m.position.set(lado * 0.74, 0.22, 0);
      m.rotation.z = lado > 0 ? -0.72 : Math.PI + 0.72;
      grupo.add(m);
      var punho = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 8, 48), acabamento);
      punho.scale.set(0.245, 0.325, 1);
      punho.rotation.y = Math.PI / 2;
      var fim = new THREE.Object3D();
      fim.position.set(0.66, 0, 0);
      fim.add(punho);
      m.add(fim);
    });
    grupo.position.y = 0.32;
    return grupo;
  }

  function camiseta() {
    var secao = document.querySelector('.camiseta-secao');
    var palco = document.getElementById('camiseta-palco');
    if (!secao || !palco) return;
    var iniciado = false;

    function semWebgl() {
      palco.classList.add('camiseta-plana');
      palco.innerHTML = '<svg viewBox="0 0 200 240" aria-hidden="true"><path d="M80 30L48 42L22 78L44 96L58 76V210H142V76L156 96L178 78L152 42L120 30C112 44 88 44 80 30Z"/></svg>';
    }

    function iniciar() {
      if (iniciado) return;
      iniciado = true;
      carregarThree(function () {
        var THREE = window.THREE;
        var renderer;
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        } catch (e) { semWebgl(); return; }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        palco.appendChild(renderer.domElement);
        var cena = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
        camera.position.set(0, 0.1, 8);
        cena.add(new THREE.HemisphereLight(0xffffff, 0x6f6a60, 0.45));
        var chave = new THREE.DirectionalLight(0xffffff, 0.95);
        chave.position.set(2.5, 3.5, 4);
        cena.add(chave);
        var contorno = new THREE.DirectionalLight(0xfff4e6, 0.8);
        contorno.position.set(-3.5, 1.5, -3);
        cena.add(contorno);
        var camisa = montarCamiseta(THREE);
        cena.add(camisa);

        function medir() {
          var l = palco.clientWidth;
          var a = palco.clientHeight;
          renderer.setSize(l, a, false);
          camera.aspect = l / a;
          camera.updateProjectionMatrix();
        }
        var ultimo = -1;
        function quadro() {
          var p = semMovimento ? 0.1 : progresso(secao);
          if (Math.abs(p - ultimo) < 0.0005) return;
          ultimo = p;
          camisa.rotation.y = -0.5 + p * Math.PI * 2;
          camisa.rotation.x = 0.06 - Math.sin(p * Math.PI) * 0.08;
          camisa.position.y = 0.45 + Math.sin(p * Math.PI) * 0.06;
          renderer.render(cena, camera);
        }
        medir();
        quadro();
        palco.classList.add('camiseta-pronta');
        window.addEventListener('resize', function () { medir(); ultimo = -1; quadro(); });
        window.addEventListener('scroll', function () { window.requestAnimationFrame(quadro); }, { passive: true });
      }, semWebgl);
    }

    // A biblioteca 3D só carrega quando a seção está chegando
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entradas, obs) {
        if (entradas[0].isIntersecting) { obs.disconnect(); iniciar(); }
      }, { rootMargin: '600px 0px' }).observe(secao);
    } else {
      iniciar();
    }
  }

  fita();
  camiseta();
})();
