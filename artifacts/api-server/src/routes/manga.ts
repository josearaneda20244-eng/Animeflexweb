import { Router, type IRouter, type Request, type Response } from "express";
  import { MANGA } from "@consumet/extensions";

  const router: IRouter = Router();

  const API_SELF = (
    process.env.API_BASE_URL ?? "https://animeflex-api-production.up.railway.app"
  ).replace(/\/$/, "");

  // ─── Proveedor ComicK de Consumet ─────────────────────────────────────────────
  // ComicK: contenido en español, sin capítulos externos, sin problemas de 0 páginas
  const comicK = new (MANGA as any).ComicK();

  // API directa de ComicK para filtrar capítulos en español
  const COMICK_API = "https://api.comick.io";
  const COMICK_IMG = "https://meo.comick.pictures";

  // ─── Cache ────────────────────────────────────────────────────────────────────
  const cache = new Map<string, { data: unknown; ts: number }>();
  const TTL = 1000 * 60 * 10;

  function cached<T>(key: string): T | null {
    const e = cache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > TTL) { cache.delete(key); return null; }
    return e.data as T;
  }
  function setCache(key: string, data: unknown) {
    if (cache.size > 500) { const k = cache.keys().next().value; if (k) cache.delete(k); }
    cache.set(key, { data, ts: Date.now() });
  }

  // ─── HTTP helper directo ComicK ───────────────────────────────────────────────
  const COMICK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://comick.io",
    "Referer": "https://comick.io/",
  };

  async function comickFetch(path: string): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(`${COMICK_API}${path}`, { headers: COMICK_HEADERS, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(`ComicK ${r.status}: ${path}`);
      return r.json();
    } catch (err) { clearTimeout(t); throw err; }
  }

  // ─── Proxy de imágenes ────────────────────────────────────────────────────────
  router.get("/manga/img-proxy", async (req: Request, res: Response) => {
    const u = req.query.u as string | undefined;
    if (!u || !u.startsWith("https://")) { res.status(400).end(); return; }
    let host: string;
    try { host = new URL(u).hostname; } catch { res.status(400).end(); return; }
    const allowed = ["comick.pictures", "comick.io", "inmanga.com", "intomanga.com", "mangadex.org", "mangadex.network"];
    if (!allowed.some(d => host.endsWith(d))) { res.status(400).end(); return; }
    try {
      const upstream = await fetch(u, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": "https://comick.io/",
          "Accept": "image/*,*/*",
        },
      });
      if (!upstream.ok) { res.status(upstream.status).end(); return; }
      const ct = upstream.headers.get("content-type") ?? "image/jpeg";
      const buf = await upstream.arrayBuffer();
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.send(Buffer.from(buf));
    } catch { res.status(502).end(); }
  });

  // Ruta legacy para compatibilidad con cover-proxy e image-proxy anteriores
  router.get("/manga/cover-proxy", (req: Request, res: Response) => {
    const u = req.query.u as string;
    res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent(u ?? "")}`);
  });
  router.get("/manga/image-proxy", (req: Request, res: Response) => {
    const u = req.query.u as string;
    res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent(u ?? "")}`);
  });

  // ─── Helpers de formato ───────────────────────────────────────────────────────
  function proxyImg(url: string | null | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith("http")) return null;
    return `${API_SELF}/api/manga/img-proxy?u=${encodeURIComponent(url)}`;
  }

  function pickCover(comic: any): string | null {
    const rawUrl =
      comic.cover_url ||
      (Array.isArray(comic.md_covers) && comic.md_covers[0]?.b2key
        ? `${COMICK_IMG}/${comic.md_covers[0].b2key}`
        : null) ||
      comic.image ||
      null;
    return proxyImg(rawUrl);
  }

  function comickStatusToText(status: number | string | undefined): string {
    const map: Record<string, string> = { "1": "Ongoing", "2": "Completed", "3": "Cancelled", "4": "Hiatus" };
    return map[String(status ?? "")] ?? String(status ?? "");
  }

  function formatComicResult(comic: any) {
    return {
      id: comic.slug ?? comic.hid ?? String(comic.id),
      title: comic.title ?? comic.name ?? "Sin título",
      image: pickCover(comic),
      description: comic.desc ?? comic.description ?? "",
      status: comickStatusToText(comic.status),
      genres: (comic.genres ?? []).map((g: any) => g.name ?? g).filter(Boolean).slice(0, 6),
      rating: comic.rating ? parseFloat(comic.rating) : null,
    };
  }

  // ─── Trending ─────────────────────────────────────────────────────────────────
  router.get("/manga/trending", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const key = `comick:trending:${page}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      // ComicK top comics filtrado por español
      const data = await comickFetch(`/top?lang=es&type=comic&page=${page}`);
      // /top devuelve { rank: [{md_comics: {...}, ...}] }
      const items: any[] = data?.rank ?? data?.results ?? data ?? [];
      const mapped = items.map((item: any) => {
        const comic = item.md_comics ?? item.comic ?? item;
        return formatComicResult(comic);
      });
      const result = {
        results: mapped.filter((m: any) => m.id),
        hasNextPage: mapped.length >= 20,
        currentPage: page,
        total: null,
      };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message }, "comick/trending failed");
      // Fallback: buscar populares vía Consumet
      try {
        const data = await comicK.search("", page);
        const results = (data.results ?? []).map((m: any) => ({
          id: m.id,
          title: typeof m.title === "string" ? m.title : m.title?.english ?? "Sin título",
          image: proxyImg(m.image),
          description: m.description ?? "",
          status: String(m.status ?? ""),
          genres: m.genres ?? [],
          rating: m.rating ?? null,
        }));
        res.json({ results, hasNextPage: data.hasNextPage ?? false, currentPage: page, total: null });
      } catch (err2: any) {
        req.log.error({ err: err2?.message }, "comick/trending fallback failed");
        res.status(500).json({ error: "Error cargando mangas populares" });
      }
    }
  });

  // ─── Recent ───────────────────────────────────────────────────────────────────
  router.get("/manga/recent", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const key = `comick:recent:${page}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      // Buscar recientes por capítulos nuevos en español
      const data = await comickFetch(`/v1.0/search?page=${page}&limit=24&type=comic&sort=uploaded&lang=es`);
      const items: any[] = Array.isArray(data) ? data : (data.results ?? data.comics ?? []);
      const result = {
        results: items.map(formatComicResult).filter((m: any) => m.id),
        hasNextPage: items.length >= 24,
        currentPage: page,
        total: null,
      };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message }, "comick/recent failed");
      res.status(500).json({ error: "Error cargando mangas recientes" });
    }
  });

  // ─── Search ───────────────────────────────────────────────────────────────────
  router.get("/manga/search", async (req: Request, res: Response) => {
    const q = (req.query.q as string | undefined)?.trim();
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    if (!q) { res.status(400).json({ error: "'q' es requerido" }); return; }
    const key = `comick:search:${q}:${page}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      // Buscar primero con filtro español
      const data = await comickFetch(`/v1.0/search?q=${encodeURIComponent(q)}&page=${page}&limit=20&type=comic`);
      const items: any[] = Array.isArray(data) ? data : (data.results ?? data.comics ?? []);
      const result = {
        results: items.map(formatComicResult).filter((m: any) => m.id),
        hasNextPage: items.length >= 20,
        currentPage: page,
        total: null,
      };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, q }, "comick/search direct failed — trying Consumet");
      try {
        const data = await comicK.search(q, page);
        const results = (data.results ?? []).map((m: any) => ({
          id: m.id,
          title: typeof m.title === "string" ? m.title : m.title?.english ?? "Sin título",
          image: proxyImg(m.image),
          description: m.description ?? "",
          status: String(m.status ?? ""),
          genres: m.genres ?? [],
          rating: m.rating ?? null,
        }));
        res.json({ results, hasNextPage: data.hasNextPage ?? false, currentPage: page, total: null });
      } catch (err2: any) {
        req.log.error({ err: err2?.message, q }, "comick/search fallback failed");
        res.status(500).json({ error: "Error buscando manga" });
      }
    }
  });

  // ─── Manga info + chapters ────────────────────────────────────────────────────
  router.get("/manga/info/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const key = `comick:info:v3:${id}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      // 1. Obtener info del comic (slug → hid)
      const comicData = await comickFetch(`/comic/${encodeURIComponent(id)}`);
      const comic = comicData.comic ?? comicData;
      if (!comic?.hid && !comic?.id) {
        res.status(404).json({ error: "Manga no encontrado" }); return;
      }
      const hid = comic.hid ?? String(comic.id);
      const slug = comic.slug ?? id;

      // 2. Traer capítulos en español (es + es-la), luego inglés para los que falten
      const [esChaps, enChaps] = await Promise.allSettled([
        fetchComickChapters(hid, "es"),
        fetchComickChapters(hid, "en"),
      ]);
      const spanishChapters = esChaps.status === "fulfilled" ? esChaps.value : [];
      const englishChapters = enChaps.status === "fulfilled" ? enChaps.value : [];

      // Mezclar: español tiene prioridad, inglés rellena huecos
      const byNum = new Map<string, any>();
      for (const ch of englishChapters) {
        const k = String(ch.chapterNumber ?? ch.id);
        if (!byNum.has(k)) byNum.set(k, ch);
      }
      for (const ch of spanishChapters) {
        const k = String(ch.chapterNumber ?? ch.id);
        byNum.set(k, ch);  // sobreescribe inglés con español
      }
      const chapters = Array.from(byNum.values()).sort(
        (a, b) => parseFloat(String(a.chapterNumber ?? 0)) - parseFloat(String(b.chapterNumber ?? 0))
      );

      const coverImg = pickCover(comic) ?? pickCover(comicData);
      const result = {
        id: slug,
        title: comic.title ?? comic.name ?? "Sin título",
        image: coverImg,
        cover: coverImg,
        description: comic.desc ?? comic.description ?? "",
        status: comickStatusToText(comic.status),
        genres: (comic.genres ?? comicData.genres ?? []).map((g: any) => g.name ?? g).filter(Boolean).slice(0, 8),
        authors: (comicData.authors ?? []).map((a: any) => ({ id: String(a.id ?? ""), name: a.name ?? "" })),
        chapters,
      };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, id }, "comick/info failed");
      res.status(500).json({ error: "Error cargando información del manga" });
    }
  });

  async function fetchComickChapters(hid: string, lang: string) {
    const all: any[] = [];
    let page = 1;
    const limit = 300;
    while (all.length < 3000) {
      const data = await comickFetch(`/comic/${hid}/chapters?lang=${lang}&page=${page}&limit=${limit}`);
      const batch: any[] = data.chapters ?? data ?? [];
      all.push(...batch);
      if (batch.length < limit) break;
      page++;
    }
    // Deduplicar por número de capítulo
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const ch of all) {
      const k = String(ch.chap ?? ch.id);
      if (!seen.has(k)) { seen.add(k); deduped.push(ch); }
    }
    return deduped.map((ch: any) => ({
      id: ch.hid ?? ch.id,
      chapterNumber: ch.chap ?? null,
      volumeNumber: ch.vol ?? null,
      title: ch.title || null,
      pages: ch.page_count ?? ch.pages ?? 0,
      lang,
      releaseDate: ch.created_at ?? ch.updated_at ?? null,
    }));
  }

  // ─── Chapter pages ─────────────────────────────────────────────────────────────
  router.get("/manga/chapter/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const key = `comick:ch:${id}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      // Intentar primero con API directa de ComicK
      const data = await comickFetch(`/chapter/${encodeURIComponent(id)}`);
      const images: any[] = data?.chapter?.images ?? data?.images ?? [];
      if (images.length > 0) {
        const result = images.map((img: any, i: number) => ({
          img: proxyImg(`${COMICK_IMG}/${img.b2key ?? img.url}`) ?? `${COMICK_IMG}/${img.b2key ?? img.url}`,
          page: i + 1,
        }));
        setCache(key, result);
        res.json(result);
        return;
      }
      // Fallback: usar Consumet
      const pages = await comicK.fetchChapterPages(id);
      if (!pages || pages.length === 0) {
        res.status(404).json({ error: "No se encontraron páginas para este capítulo." });
        return;
      }
      const result = pages.map((p: any, i: number) => ({
        img: proxyImg(p.img) ?? p.img,
        page: p.page ?? i + 1,
      }));
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, id }, "comick/chapter failed");
      res.status(500).json({ error: "Error cargando páginas del capítulo" });
    }
  });

  export default router;
  