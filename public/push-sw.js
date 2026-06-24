self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(clients.claim()); });

self.addEventListener('push', function (event) {
  if (!event.data) return;
  var data = {};
  try { data = event.data.json(); } catch (e) { data = { title: 'CIMAdera', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'CIMAdera', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      tag: data.tag || undefined,
      data: { url: data.url || '/' },
      actions: data.url ? [{ action: 'open', title: 'Ver' }] : [],
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      var existing = list.find(function (c) { return c.url.includes(url); });
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
