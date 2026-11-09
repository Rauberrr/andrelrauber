/* Apps: a moldura comum. Barra de cima com a conta, título que encolhe ao rolar,
   ícones e pequenas utilidades usadas por todos os apps. */
window.AR_APP = (function () {
  'use strict';

  var api = window.AR_API;
  var SVG = 'http://www.w3.org/2000/svg';

  // Desenhos dos ícones: cada item é um traço do SVG, numa grade de 24 por 24
  var ICONES = {
    apps: ['M5.5 4h3A1.5 1.5 0 0 1 10 5.5v3A1.5 1.5 0 0 1 8.5 10h-3A1.5 1.5 0 0 1 4 8.5v-3A1.5 1.5 0 0 1 5.5 4Z', 'M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 14 8.5v-3A1.5 1.5 0 0 1 15.5 4Z', 'M5.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3A1.5 1.5 0 0 1 5.5 14Z', 'M15.5 14h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-3a1.5 1.5 0 0 1 1.5-1.5Z'],
    cabide: ['M12 7.2a2.2 2.2 0 1 1 2.2 2.2c-.9.4-2.2 1-2.2 2.1v.5', 'M12 12 3.4 17.6c-.8.5-.4 1.7.5 1.7h16.2c.9 0 1.3-1.2.5-1.7Z'],
    folha: ['M5 19.5c0-8.5 5-14.5 15-14.5 0 10.5-6 15.5-14.5 15', 'M5 19.5c3-4.5 6.5-7.5 10.5-9.5'],
    calendario: ['M6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4Z', 'M4 9.5h16', 'M8.5 2.5v3', 'M15.5 2.5v3', 'm12 12 .95 1.9 2.1.3-1.5 1.5.35 2.1-1.9-1-1.9 1 .35-2.1-1.5-1.5 2.1-.3Z'],
    haltere: ['M6.5 7v10', 'M17.5 7v10', 'M3.5 9.5v5', 'M20.5 9.5v5', 'M6.5 12h11'],
    pessoa: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20.5c1.3-3.6 4.1-5.5 7.5-5.5s6.2 1.9 7.5 5.5'],
    voltar: ['M15 5l-7 7 7 7'],
    seguir: ['M9 5l7 7-7 7'],
    mais: ['M12 5v14', 'M5 12h14'],
    lapis: ['M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
    lixeira: ['M4 7h16', 'M9.5 7V4.5h5V7', 'M6.5 7l.9 12.5c.05.8.7 1.5 1.5 1.5h6.2c.8 0 1.45-.7 1.5-1.5L17.5 7', 'M10 11v6', 'M14 11v6'],
    camera: ['M5.5 7h2L9 4.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9A1.5 1.5 0 0 1 5.5 7Z', 'M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z'],
    girar: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v5h-5'],
    varinha: ['M4 20 14.5 9.5', 'M13 8l3 3', 'M17.5 3v2.5', 'M21 6.5h-2.5', 'M20 4l-1.5 1.5'],
    restaurar: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4.5 4.5v5h5'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    sol: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2.5v2', 'M12 19.5v2', 'M2.5 12h2', 'M19.5 12h2', 'm5.3 5.3 1.4 1.4', 'm17.3 17.3 1.4 1.4', 'm5.3 18.7 1.4-1.4', 'm17.3 6.7 1.4-1.4'],
    nuvem: ['M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 11a3.75 3.75 0 0 0 0 7.5Z'],
    floco: ['M12 3v18', 'M4.2 7.5l15.6 9', 'M4.2 16.5l15.6-9', 'M9.5 4.5 12 6.5l2.5-2', 'M9.5 19.5 12 17.5l2.5 2'],
    carrinho: ['M3 4h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1', 'M9.5 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M17 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'],
    mala: ['M6.5 7h11A1.5 1.5 0 0 1 19 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-10A1.5 1.5 0 0 1 6.5 7Z', 'M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7', 'M9 11v5', 'M15 11v5'],
    tesoura: ['M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M6.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M8.6 7.6 20 17', 'M8.6 16.4 20 7'],
    relogio: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
    sino: ['M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z', 'M10 21h4'],
    diario: ['M6 3.5h11A1.5 1.5 0 0 1 18.5 5v14.5A1.5 1.5 0 0 1 17 21H6Z', 'M6 3.5v17.5', 'M9.5 8h5.5', 'M9.5 11.5h5.5'],
    conversa: ['M4 19.5l1.3-3.7A7.5 7.5 0 1 1 8.4 18.6Z']
  };

  function icone(nome, classe) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', classe || 'app-ico');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    (ICONES[nome] || []).forEach(function (d) {
      var caminho = document.createElementNS(SVG, 'path');
      caminho.setAttribute('d', d);
      svg.appendChild(caminho);
    });
    return svg;
  }

  // Ícones escritos no HTML como <svg data-icone="nome">
  function desenharIcones(raiz) {
    (raiz || document).querySelectorAll('svg[data-icone]').forEach(function (svg) {
      if (svg.childNodes.length) return;
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      if (!svg.getAttribute('class')) svg.setAttribute('class', 'app-ico');
      (ICONES[svg.getAttribute('data-icone')] || []).forEach(function (d) {
        var caminho = document.createElementNS(SVG, 'path');
        caminho.setAttribute('d', d);
        svg.appendChild(caminho);
      });
    });
  }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
  }

  // Página atual, como 'apps/treino/', para voltar a ela depois de entrar na conta
  function paginaAtual() {
    return location.pathname.replace(/^\/+/, '');
  }

  function iniciais(texto) {
    var partes = String(texto || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return '';
    var letras = partes.length > 1 ? partes[0].charAt(0) + partes[partes.length - 1].charAt(0) : partes[0].slice(0, 2);
    return letras.toUpperCase();
  }

  /* --- Datas ------------------------------------------------------------------- */

  function hojeISO(data) {
    var d = data || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function paraData(iso) {
    var p = String(iso).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }

  function diasAte(iso, desde) {
    var a = paraData(desde || hojeISO());
    var b = paraData(iso);
    return Math.round((b - a) / 86400000);
  }

  function somarDias(iso, dias) {
    var d = paraData(iso);
    d.setDate(d.getDate() + dias);
    return hojeISO(d);
  }

  function dataCurta(iso) {
    var p = String(iso).split('-');
    return p[2] + '/' + p[1];
  }

  function dataLonga(iso) {
    return paraData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function textoDias(dias) {
    if (dias === 0) return 'hoje';
    if (dias === 1) return 'amanhã';
    if (dias === -1) return 'ontem';
    return dias > 0 ? 'em ' + dias + ' dias' : 'há ' + Math.abs(dias) + ' dias';
  }

  /* --- Guardar no aparelho ------------------------------------------------------- */

  function lerLocal(chave) {
    try { return JSON.parse(localStorage.getItem(chave)); } catch (e) { return null; }
  }

  function gravarLocal(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); return true; } catch (e) { return false; }
  }

  /* --- Aviso na parte de baixo ----------------------------------------------------- */

  var temporizador = null;

  function avisar(texto, desfazer) {
    var caixa = document.getElementById('app-aviso');
    if (!caixa) return;
    caixa.textContent = '';
    window.clearTimeout(temporizador);
    caixa.appendChild(criar('span', '', texto));
    if (desfazer) {
      var b = criar('button', 'texto-botao', 'Desfazer');
      b.type = 'button';
      b.addEventListener('click', function () { caixa.textContent = ''; desfazer(); });
      caixa.appendChild(b);
    }
    temporizador = window.setTimeout(function () { caixa.textContent = ''; }, desfazer ? 9000 : 4500);
  }

  /* --- Link do WhatsApp da marca --------------------------------------------------- */

  function linkWhatsapp(texto) {
    var numero = window.AR_CONFIG && window.AR_CONFIG.whatsapp;
    return 'https://wa.me/' + numero + (texto ? '?text=' + encodeURIComponent(texto) : '');
  }

  /* --- Conta ---------------------------------------------------------------------- */

  var sessao = api
    ? api.get('api/auth.php?acao=sessao').then(function (r) { return r.ok && r.dados.logado ? r.dados.usuario : null; })
    : Promise.resolve(null);

  sessao.then(function (usuario) {
    var conta = document.getElementById('app-conta');
    if (!conta) return;
    conta.textContent = '';
    if (usuario) {
      conta.textContent = iniciais(usuario.nome || usuario.email);
      conta.href = 'minha-conta.html';
      conta.setAttribute('aria-label', 'Minha conta');
      conta.classList.remove('app-conta-visitante');
    } else {
      conta.appendChild(icone('pessoa'));
      conta.href = 'entrar.html?voltar=' + encodeURIComponent(paginaAtual());
      conta.setAttribute('aria-label', 'Entrar na minha conta');
      conta.classList.add('app-conta-visitante');
    }
  });

  /* --- Barra: o título pequeno aparece quando o grande sai da tela -------------------- */

  var barra = document.querySelector('.app-barra');
  var titulo = document.querySelector('.app-titulo');
  if (barra && titulo && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entradas) {
      barra.classList.toggle('rolou', !entradas[0].isIntersecting);
    }, { rootMargin: '-60px 0px 0px 0px' }).observe(titulo);
  }

  desenharIcones();

  return {
    api: api, sessao: sessao, icone: icone, desenharIcones: desenharIcones, criar: criar,
    paginaAtual: paginaAtual, iniciais: iniciais,
    hojeISO: hojeISO, paraData: paraData, diasAte: diasAte, somarDias: somarDias,
    dataCurta: dataCurta, dataLonga: dataLonga, textoDias: textoDias,
    lerLocal: lerLocal, gravarLocal: gravarLocal, avisar: avisar, linkWhatsapp: linkWhatsapp
  };
})();
