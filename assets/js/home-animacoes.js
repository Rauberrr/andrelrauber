/* Home: uma fita métrica de costura, enrolada em espiral sobre a mesa, que desenrola
   conforme a página rola. Vista de cima: as marcas de centímetro acompanham a fita,
   inclusive nas voltas do rolo. A seção fica presa na tela enquanto a rolagem avança. */
(function () {
  'use strict';

  var secao = document.querySelector('.fita-secao');
  var tela = document.getElementById('fita-canvas');
  if (!secao || !tela || !tela.getContext) return;
  var ctx = tela.getContext('2d');

  var COMPRIMENTO_CM = 150;
  // A fita termina de desenrolar na primeira metade da seção: a outra metade é para ler
  var ATE = 0.55;
  var largura = 0;
  var altura = 0;
  var ultimo = -1;

  function progresso() {
    var r = secao.getBoundingClientRect();
    var total = r.height - window.innerHeight;
    if (total <= 0) return 1;
    return Math.max(0, Math.min(1, -r.top / total));
  }

  function suave(t) { return 1 - Math.pow(1 - t, 3); }

  function medir() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    largura = tela.clientWidth;
    altura = tela.clientHeight;
    tela.width = Math.round(largura * dpr);
    tela.height = Math.round(altura * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ultimo = -1;
  }

  // O caminho da fita, da ponta solta (0 cm) até o miolo do rolo, com um ponto a cada 2 px.
  // A origem é onde a fita sai do rolo. Cada ponto guarda a posição, a direção da fita
  // e quantos pixels de fita já foram percorridos desde a ponta.
  function caminho(aberta, total, banda) {
    var pontos = [];
    var passo = 2;
    var s;
    // A parte aberta, reta, à direita do rolo
    for (s = 0; s <= aberta; s += passo) pontos.push({ x: aberta - s, y: 0, ang: Math.PI, s: s });
    // O rolo: uma espiral que começa no fundo e vai para a esquerda e para cima, até o miolo
    var volta = banda + 2.5;
    var miolo = banda * 0.9;
    var restante = total - aberta;
    var raio = Math.sqrt(miolo * miolo + restante * volta / Math.PI);
    var phi = 0;
    for (var feito = 0; feito < restante; feito += passo) {
      var r = raio - volta * phi / (Math.PI * 2);
      if (r < miolo) break;
      var a = Math.PI / 2 + phi;
      pontos.push({ x: Math.cos(a) * r, y: -raio + Math.sin(a) * r, ang: a + Math.PI / 2, s: aberta + feito });
      phi += passo / r;
    }
    return { pontos: pontos, raio: raio };
  }

  function tracar(pontos) {
    ctx.beginPath();
    pontos.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  }

  function desenhar(p) {
    ctx.clearRect(0, 0, largura, altura);
    var cm = Math.max(3.4, Math.min(6.2, largura / 190));
    var banda = Math.max(17, Math.min(26, cm * 4.2));
    var margem = Math.max(16, largura * 0.05);
    var total = COMPRIMENTO_CM * cm;
    // Um pedacinho aberto no começo; quase toda a fita no fim
    var maximo = Math.min(total - 18 * cm, largura - margem * 2 - banda * 7);
    var aberta = 5 * cm + Math.max(0, maximo - 5 * cm) * suave(Math.min(1, p / ATE));
    var rolo = caminho(aberta, total, banda);
    // O rolo fica parado à esquerda; a fita corre para a direita
    var cx = margem + rolo.raio + banda / 2;
    var cy = Math.min(altura * 0.72, altura - banda * 2);
    var pontos = rolo.pontos.map(function (q) { return { x: q.x + cx, y: q.y + cy, ang: q.ang, s: q.s }; });

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';

    // Sombra macia, como sobre uma mesa, e a borda da fita
    ctx.save();
    ctx.shadowColor = 'rgba(11, 11, 10, .2)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    ctx.strokeStyle = 'rgba(92, 76, 38, .6)';
    ctx.lineWidth = banda + 1.6;
    tracar(pontos);
    ctx.stroke();
    ctx.restore();

    // O corpo: amarelo-claro de fita de costura, um pouco mais claro no meio
    ctx.strokeStyle = '#efd98f';
    ctx.lineWidth = banda;
    tracar(pontos);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 252, 238, .5)';
    ctx.lineWidth = banda * 0.42;
    tracar(pontos);
    ctx.stroke();

    // Marcas e números ao longo da fita, também nas voltas do rolo
    ctx.fillStyle = '#1d1a14';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 ' + Math.round(Math.max(8.5, banda * 0.4)) + 'px Jost, system-ui, sans-serif';
    var i = 0;
    for (var marca = 0; marca <= COMPRIMENTO_CM; marca += 1) {
      var alvo = marca * cm;
      while (i < pontos.length - 1 && pontos[i + 1].s <= alvo) i += 1;
      var q = pontos[i];
      if (!q || Math.abs(q.s - alvo) > 3) continue;
      var tamanho = marca % 10 === 0 ? 0.42 : (marca % 5 === 0 ? 0.3 : 0.19);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.ang + Math.PI);
      ctx.fillRect(-0.5, -banda / 2, 1, banda * tamanho);
      if (marca % 10 === 0 && marca > 0) ctx.fillText(String(marca), 0, banda * 0.17);
      ctx.restore();
    }

    // A ponta de metal no começo da fita, com o furinho
    var ponta = pontos[0];
    ctx.save();
    ctx.translate(ponta.x, ponta.y);
    var metal = ctx.createLinearGradient(0, -banda / 2, 0, banda / 2);
    metal.addColorStop(0, '#dcc48d');
    metal.addColorStop(0.5, '#a9874a');
    metal.addColorStop(1, '#7d6232');
    ctx.fillStyle = metal;
    ctx.fillRect(-1, -banda / 2 - 0.5, cm * 1.4, banda + 1);
    ctx.fillStyle = 'rgba(30, 24, 12, .55)';
    ctx.beginPath();
    ctx.arc(cm * 0.75, 0, Math.max(1.4, banda * 0.08), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function quadro() {
    var p = progresso();
    if (Math.abs(p - ultimo) < 0.0008) return;
    ultimo = p;
    desenhar(p);
  }

  var agendado = false;
  function aoRolar() {
    if (agendado) return;
    agendado = true;
    window.requestAnimationFrame(function () { agendado = false; quadro(); });
  }

  medir();
  quadro();
  window.addEventListener('resize', function () { medir(); quadro(); });
  window.addEventListener('scroll', aoRolar, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ultimo = -1; quadro(); });
})();
