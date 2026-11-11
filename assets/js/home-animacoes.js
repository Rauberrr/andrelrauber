/* Home: a cena do molde. Conforme a página rola, o molde da peça se desenha no papel,
   as medidas aparecem, a tesoura corta o contorno e o tecido surge por trás do corte,
   em câmera lenta. Tudo desenhado em código, sem imagens. A seção fica presa na tela
   enquanto a rolagem avança. Também cuida do botão "Cadastrar minhas medidas". */
(function () {
  'use strict';

  var secao = document.querySelector('.molde-secao');
  var svg = document.getElementById('molde-svg');
  if (secao && svg) cena();
  botaoDeMedidas();

  function cena() {
    var tracos = [].slice.call(svg.querySelectorAll('.molde-traco'));
    var guias = [].slice.call(svg.querySelectorAll('.molde-guia'));
    var notas = [].slice.call(svg.querySelectorAll('.molde-notas text'));
    var frente = document.getElementById('molde-frente');
    var varrida = document.getElementById('molde-varrida');
    var tesoura = document.getElementById('molde-tesoura');
    var zoom = document.getElementById('molde-tecido-zoom');
    var luz = document.getElementById('molde-tecido-luz');

    var comprimentos = tracos.map(function (p) {
      var c = p.getTotalLength();
      p.style.strokeDasharray = p.classList.contains('molde-fino') ? '' : c + ' ' + c;
      return c;
    });
    var contorno = frente.getTotalLength();
    // Pontos do contorno, para a tesoura seguir e o tecido aparecer atrás dela
    var AMOSTRAS = 160;
    var pontos = [];
    for (var i = 0; i <= AMOSTRAS; i++) pontos.push(frente.getPointAtLength(contorno * i / AMOSTRAS));
    var CENTRO = { x: 300, y: 330 };

    function trecho(p, ini, fim) { return Math.max(0, Math.min(1, (p - ini) / (fim - ini))); }
    function suave(t) { return t * t * (3 - 2 * t); }

    function progresso() {
      var r = secao.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      if (total <= 0) return 1;
      return Math.max(0, Math.min(1, -r.top / total));
    }

    var tempo = 0;

    function desenhar(p) {
      // 1. O molde se desenha: contornos primeiro, depois as linhas finas
      tracos.forEach(function (traco, n) {
        var fino = traco.classList.contains('molde-fino');
        var t = suave(trecho(p, n * 0.03, fino ? 0.38 : 0.3));
        if (fino) traco.style.opacity = (0.55 * t).toFixed(3);
        else traco.style.strokeDashoffset = (comprimentos[n] * (1 - t)).toFixed(1);
      });
      // 2. As medidas aparecem, uma a uma
      guias.forEach(function (g, n) { g.style.opacity = (0.8 * suave(trecho(p, 0.22 + n * 0.04, 0.36 + n * 0.04))).toFixed(3); });
      notas.forEach(function (t, n) { t.style.opacity = suave(trecho(p, 0.24 + n * 0.04, 0.38 + n * 0.04)).toFixed(3); });

      // 3. A tesoura corta o contorno e o tecido aparece atrás do corte
      var corte = trecho(p, 0.38, 0.72);
      var ate = Math.round(suave(corte) * AMOSTRAS);
      if (ate <= 0) {
        varrida.setAttribute('d', 'M0 0Z');
      } else {
        var d = 'M' + CENTRO.x + ' ' + CENTRO.y;
        for (var k = 0; k <= ate; k++) d += 'L' + pontos[k].x.toFixed(1) + ' ' + pontos[k].y.toFixed(1);
        varrida.setAttribute('d', d + 'Z');
      }
      var cortando = corte > 0 && corte < 1;
      tesoura.style.opacity = cortando ? Math.min(1, corte * 8, (1 - corte) * 8).toFixed(3) : '0';
      if (cortando) {
        var a = pontos[Math.max(0, ate - 1)];
        var b = pontos[Math.min(AMOSTRAS, ate + 1)];
        var angulo = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI + 90;
        var aqui = pontos[ate];
        tesoura.setAttribute('transform', 'translate(' + aqui.x.toFixed(1) + ' ' + aqui.y.toFixed(1) + ') rotate(' + angulo.toFixed(1) + ')');
      }

      // 4. O tecido em câmera lenta: aproxima devagar e a luz corre pela sarja
      var t4 = suave(trecho(p, 0.5, 1));
      var escala = 1 + 0.06 * t4 + 0.008 * Math.sin(tempo / 2600);
      zoom.setAttribute('transform', 'translate(300 300) scale(' + escala.toFixed(4) + ') translate(-300 -300)');
      luz.setAttribute('x', (40 + 300 * t4 + 30 * Math.sin(tempo / 3400)).toFixed(1));
    }

    var visivel = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { visivel = e[0].isIntersecting; }).observe(secao);
    }

    function quadro(agora) {
      tempo = agora || 0;
      if (visivel) {
        var p = progresso();
        // Redesenha a cada quadro: o tecido balança devagar mesmo com a página parada
        desenhar(p);
      }
      requestAnimationFrame(quadro);
    }
    // A rolagem também redesenha, para a cena seguir o dedo mesmo sem quadros de animação
    window.addEventListener('scroll', function () { if (visivel) desenhar(progresso()); }, { passive: true });
    window.addEventListener('resize', function () { desenhar(progresso()); });
    desenhar(progresso());
    requestAnimationFrame(quadro);
  }

  // "Cadastrar minhas medidas": quem já preencheu vê o aviso e o caminho para a coleção
  function botaoDeMedidas() {
    var botao = document.getElementById('molde-medidas');
    var aviso = document.getElementById('medidas-ok');
    if (!botao) return;
    var texto = botao.textContent;

    botao.addEventListener('click', function () {
      if (!window.AR_API) { location.href = 'medidas.html'; return; }
      botao.disabled = true;
      botao.textContent = 'Verificando…';
      window.AR_API.get('api/perfil.php').then(function (r) {
        botao.disabled = false;
        botao.textContent = texto;
        if (r.status === 401) { location.href = 'criar-conta.html?voltar=medidas.html'; return; }
        if (r.ok && r.dados.cadastro && r.dados.cadastro.concluido_em && aviso && aviso.showModal) {
          aviso.showModal();
          return;
        }
        location.href = 'medidas.html';
      });
    });

    if (!aviso) return;
    document.getElementById('medidas-ok-fechar').addEventListener('click', function () { aviso.close(); });
    aviso.addEventListener('click', function (e) { if (e.target === aviso) aviso.close(); });
  }
})();
