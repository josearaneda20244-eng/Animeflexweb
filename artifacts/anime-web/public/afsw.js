// AnimeFlex Service Worker v3 — purga total + recarga forzada para limpiar caches viejos

const CACHE_NAME = "animeflex-v3";
const APP_SHELL = ["/", "/index.html"];

// ── Install: tomar control inmediatamente ─────────────────────────────────
self.addEventListener("install", (event) => {
  // No precachear nada para no servir HTML viejo en futuras navegaciones
  self.skipWaiting();
});

// ── Activate: PURGAR TODOS los caches viejos y recargar pestañas abiertas ─
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Borrar absolutamente todos los caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));

      // Tomar control inmediato de todas las pestañas
      await self.clients.claim();

      // Forzar reload de todas las pestañas abiertas para que carguen el bundle nuevo
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch {}
      }

      // Bloquear push ads si los hay
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {}
    })()
  );
});

// ── Fetch: network-first para todo, sin cachear (modo a prueba de obsolescencia) ──
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo manejar GET; el resto pasa directo a la red
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // API: network-first, fallback a respuesta de error JSON
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: "Sin conexión" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // Imágenes externas: cache-first con expiración implícita por nombre de archivo
  if (
    request.destination === "image" &&
    url.origin !== self.location.origin
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return new Response("", { status: 408 });
        }
      })
    );
    return;
  }

  // JS/CSS/HTML/fonts del propio sitio: SIEMPRE network, sin cachear (evita servir bundles viejos)
  // Si la red falla y es una navegación, devolver una página de "sin conexión" mínima
  event.respondWith(
    fetch(request).catch(() => {
      if (request.mode === "navigate") {
        return new Response(
          "<h1 style='font-family:sans-serif;text-align:center;padding:40px;color:#fff;background:#0a0307'>Sin conexión</h1>",
          { headers: { "Content-Type": "text/html" }, status: 503 }
        );
      }
      return new Response("", { status: 408 });
    })
  );
});

// ── Bloquear TODOS los eventos push (anuncios Monetag/MultiTag) ───────────
self.addEventListener("push", (event) => {
  event.stopImmediatePropagation();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.stopImmediatePropagation();
});
