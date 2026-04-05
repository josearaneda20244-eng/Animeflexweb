// AnimeFlex Service Worker v2 — PWA caching + bloqueo de anuncios push

const CACHE_NAME = "animeflex-v2";
const APP_SHELL = [
  "/anime-web/",
  "/anime-web/index.html",
];

// ── Install: pre-cache app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
      await self.clients.claim();
      // Bloquear push ads (Monetag / MultiTag)
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch {}
    })()
  );
});

// ── Fetch: estrategia por tipo de recurso ─────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Saltar peticiones no-GET
  if (request.method !== "GET") return;

  // API: network-first, sin cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "Sin conexión" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Imágenes externas (posters, thumbnails): cache-first, 7 días
  if (
    request.destination === "image" &&
    !url.hostname.includes("localhost") &&
    !url.hostname.includes("replit")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((res) => {
            if (!res.ok) return res;
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
          .catch(() => new Response("", { status: 408 }));
      })
    );
    return;
  }

  // JS/CSS/fonts: cache-first con network fallback
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Navegación (HTML): network-first, fallback a index.html (SPA)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/anime-web/index.html").then(
          (cached) =>
            cached ||
            new Response("<h1>Sin conexión</h1>", {
              headers: { "Content-Type": "text/html" },
            })
        )
      )
    );
    return;
  }
});

// ── Bloquear TODOS los eventos push (anuncios Monetag/MultiTag) ───────────
self.addEventListener("push", (event) => {
  event.stopImmediatePropagation();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.stopImmediatePropagation();
});
