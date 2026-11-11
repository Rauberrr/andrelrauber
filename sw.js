/* Rauber: lembretes no navegador.
   Só cuida das notificações: não guarda páginas em cache e não intercepta nada do site.
   O servidor manda um toque sem conteúdo; aqui o navegador busca os avisos na conta
   da pessoa e mostra cada um. Tocar no aviso abre o app Hábitos. */
'use strict';

var ENDERECO = '/api/habitos.php?acao=avisos';
var APP = '/apps/habitos/';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('push', function (e) {
  e.waitUntil(
    fetch(ENDERECO, { credentials: 'include', cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .catch(function () { return {}; })
      .then(function (d) {
        var avisos = d && Array.isArray(d.avisos) ? d.avisos : [];
        // O navegador exige mostrar algo a cada toque: sem conta conectada, um aviso geral
        if (!avisos.length) avisos = [{ titulo: 'Hora do seu hábito', texto: 'Abra o app para ver o que falta hoje.', marca: 'habitos' }];
        return Promise.all(avisos.map(function (a, i) {
          return self.registration.showNotification(a.titulo, {
            body: a.texto,
            icon: '/assets/img/icone-192.png',
            badge: '/assets/img/favicon-64.png',
            tag: 'habitos-' + (a.titulo || i),
            renotify: true,
            data: { url: APP }
          });
        }));
      })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (janelas) {
    for (var i = 0; i < janelas.length; i += 1) {
      if (janelas[i].url.indexOf(APP) !== -1 && 'focus' in janelas[i]) return janelas[i].focus();
    }
    return self.clients.openWindow(APP);
  }));
});
