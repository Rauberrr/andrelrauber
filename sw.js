/* Rauber: lembretes no navegador.
   Só cuida das notificações: não guarda páginas em cache e não intercepta nada do site.
   O aviso chega cifrado dentro da notificação (o navegador decifra sozinho) e aparece mesmo
   com o site fechado. Aparelhos antigos recebem um toque vazio: aí o aviso é buscado na conta.
   Tocar no aviso abre o app Hábitos. */
'use strict';

var ENDERECO = '/api/habitos.php?acao=avisos';
var APP = '/apps/habitos/';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

function mostrar(a, i) {
  return self.registration.showNotification(a.titulo || 'Rauber', {
    body: a.texto || '',
    icon: '/assets/img/icone-192.png',
    badge: '/assets/img/favicon-64.png',
    tag: (a.marca || 'habitos') + '-' + (a.titulo || i),
    renotify: true,
    data: { url: a.url && a.url.charAt(0) === '/' ? a.url : APP }
  });
}

function buscarNaConta() {
  return fetch(ENDERECO, { credentials: 'include', cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .catch(function () { return {}; })
    .then(function (d) {
      var avisos = d && Array.isArray(d.avisos) ? d.avisos : [];
      // O navegador exige mostrar algo a cada toque: sem conta conectada, um aviso geral
      if (!avisos.length) avisos = [{ titulo: 'Hora do seu lembrete', texto: 'Abra o Rauber para ver o que falta hoje.', marca: 'habitos' }];
      return Promise.all(avisos.map(mostrar));
    });
}

self.addEventListener('push', function (e) {
  var aviso = null;
  try { aviso = e.data ? e.data.json() : null; } catch (erro) { aviso = null; }
  e.waitUntil(aviso && aviso.titulo ? mostrar(aviso, 0) : buscarNaConta());
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var destino = (e.notification.data && e.notification.data.url) || APP;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
    for (var i = 0; i < janelas.length; i += 1) {
      if (janelas[i].url.indexOf(destino) !== -1 && 'focus' in janelas[i]) return janelas[i].focus();
    }
    return self.clients.openWindow(destino);
  }));
});
