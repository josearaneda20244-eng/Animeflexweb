/* IZIFF ANIME — Service Worker v4
 * - Instalable como app (Android / Windows / ChromeOS).
 * - App shell offline: si no hay red, se abre la última versión guardada.
 * - Assets con hash (/assets/*) en caché inmutable; imágenes con límite de tamaño.
 * - NO intercepta API, HLS ni videos: el streaming va directo a la red (sin latencia extra).
 * - Ya NO recarga las pestañas al actualizarse (antes cortaba el episodio en curso).
 * - Sigue bloqueando las notificaciones push de redes publicitarias.
 */
const VERSION = "iz-v5";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const IMG_CACHE = `${VERSION}-img`;
const FONT_CACHE = `${VERSION}-fonts`;
const KEEP = [SHELL_CACHE, ASSET_CACHE, IMG_CACHE, FONT_CACHE];
const SHELL = ["/", "/manifest.json", "/icon.svg", "/icon-192.png", "/icon-512.png", "/favicon.ico"];
const MAX_IMAGES = 250;
const MAX_ASSETS = 120;

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión · IZIFF ANIME</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#000;color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center;padding:24px}img{width:64px;height:64px;border-radius:16px}h1{font-weight:500;letter-spacing:-.03em;margin:18px 0 8px}p{color:#a1a1aa;margin:0 0 22px}button{height:44px;padding:0 20px;border-radius:8px;border:0;background:#fff;color:#000;font-weight:600;font-size:14px;cursor:pointer}</style></head><body><div><img src="/icon.svg" alt=""><h1>Sin conexión</h1><p>Revisa tu internet y vuelve a intentarlo.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    await self.clients.claim();
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {}
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Video / audio / rangos: nunca interceptar (HLS, MP4, segmentos)
  if (request.headers.has("range") || request.destination === "video" || request.destination === "audio") return;
  if (/\.(m3u8|ts|m4s|mp4|vtt|srt)(\?|$)/i.test(url.pathname)) return;
  if (url.pathname.includes("/api/")) return;

  // Navegaciones (SPA): red primero; si falla, shell en caché; si no, página offline
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preload = event.preloadResponse ? await event.preloadResponse : null;
        const res = preload || await Promise.race([fetch(request), timeout(8000)]);
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/", copy)).catch(() => {});
        }
        return res;
      } catch {
        const cached = await caches.match("/", { cacheName: SHELL_CACHE });
        return cached || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  // Assets con hash del propio sitio: caché primero (son inmutables)
  if (url.origin === self.location.origin && url.pathname.startsWith("/assets/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request, { cacheName: ASSET_CACHE });
      if (cached) return cached;
      const res = await fetch(request);
      if (res.ok) {
        const copy = res.clone();
        caches.open(ASSET_CACHE).then((c) => c.put(request, copy)).then(() => trim(ASSET_CACHE, MAX_ASSETS)).catch(() => {});
      }
      return res;
    })());
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const cached = await cache.match(request);
      const net = fetch(request).then((res) => { if (res.ok || res.type === "opaque") cache.put(request, res.clone()); return res; }).catch(() => cached);
      return cached || net;
    })());
    return;
  }

  // Imágenes (pósters, portadas, páginas de manga): caché primero con límite
  // Las imágenes de otros dominios (AniList, MangaDex…) van directo al navegador:
  // son respuestas opacas que no se guardan y, si la red falla, el navegador reintenta.
  if (request.destination === "image" && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const res = await fetch(request);
        // Solo respuestas CORS/same-origin: las opacas ocupan ~7 MB de cuota cada una en Chrome
        if (res.ok && res.type !== "opaque") {
          cache.put(request, res.clone()).then(() => trim(IMG_CACHE, MAX_IMAGES)).catch(() => {});
        }
        return res;
      } catch {
        return new Response("", { status: 408 });
      }
    })());
    return;
  }
  // Todo lo demás: directo a la red, sin pasar por el SW
});

// Bloquear notificaciones push de redes publicitarias (Monetag/MultiTag)
self.addEventListener("push", (event) => { event.stopImmediatePropagation(); });
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.stopImmediatePropagation(); });
