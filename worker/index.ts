declare let self: ServiceWorkerGlobalScope;

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; url?: string } = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'CIMAdera', body: event.data.text() };
  }

  event.waitUntil(
    (self.registration.showNotification as (title: string, options: object) => Promise<void>)(
      data.title ?? 'CIMAdera',
      {
        body: data.body ?? '',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: { url: data.url ?? '/' },
        actions: data.url ? [{ action: 'open', title: 'Ver' }] : [],
      }
    )
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(url));
        if (existing) return existing.focus();
        return self.clients.openWindow(url);
      })
  );
});
