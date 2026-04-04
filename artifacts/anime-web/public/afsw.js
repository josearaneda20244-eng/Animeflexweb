// AnimeFlex Service Worker — bloquea notificaciones push de redes publicitarias

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', async (event) => {
  event.waitUntil(
    (async () => {
      // Tomar control de todos los clientes inmediatamente
      await self.clients.claim();
      // Cancelar suscripción push si existe (Monetag la usaba para anuncios)
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {}
    })()
  );
});

// Bloquear TODOS los eventos push — estos son los anuncios de Monetag/MultiTag
self.addEventListener('push', (event) => {
  // No mostrar ninguna notificación
  event.stopImmediatePropagation();
});

// Bloquear notificationclick también
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.stopImmediatePropagation();
});
