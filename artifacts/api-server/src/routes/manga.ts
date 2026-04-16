import { Router, type IRouter, type Request, type Response } from "express";

  const router: IRouter = Router();

  const API_SELF = (
    process.env.API_BASE_URL ?? "https://animeflex-api-production.up.railway.app"
  ).replace(/\/$/, "");

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

  // ─── HTTP helper ──────────────────────────────────────────────────────────────
  const COMICK_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Origin": "https://comick.io",
    "Referer": "https://comick.io/",
  };

  async function comickFetch(path: string): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(`${COMICK_API}${path}`, { headers: COMICK_HEADERS, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error(`ComicK ${r.status} on ${path}`);
      return r.json();
    } catch (err) { clearTimeout(t); throw err; }
  }

  // ─── Proxy de imágenes ────────────────────────────────────────────────────────
  function proxyImg(url: string | null | undefined): string | null {
    if (!url) return null;
    if (!url.startsWith("http")) return null;
    return `${API_SELF}/api/manga/img-proxy?u=${encodeURIComponent(url)}`;
  }

  router.get("/manga/img-proxy", async (req: Request, res: Response) => {
    const u = req.query.u as string | undefined;
    if (!u || !u.startsWith("https://")) { res.status(400).end(); return; }
    let host: string;
    try { host = new URL(u).hostname; } catch { res.status(400).end(); return; }
    const allowed = ["comick.pictures", "comick.io", "mangadex.org", "mangadex.network"];
    if (!allowed.some(d => host.endsWith(d))) { res.status(400).end(); return; }
    try {
      const upstream = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://comick.io/", "Accept": "image/*,*/*" },
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

  // Compatibilidad con proxies anteriores
  router.get("/manga/cover-proxy", (req: Request, res: Response) => {
    res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent((req.query.u as string) ?? "")}`);
  });
  router.get("/manga/image-proxy", (req: Request, res: Response) => {
    res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent((req.query.u as string) ?? "")}`);
  });

  // ─── Formato ──────────────────────────────────────────────────────────────────
  function pickCover(comic: any): string | null {
    const raw =
      comic?.cover_url ||
      (Array.isArray(comic?.md_covers) && comic.md_covers[0]?.b2key
        ? `${COMICK_IMG}/${comic.md_covers[0].b2key}`
        : null) ||
      comic?.image ||
      null;
    return proxyImg(raw);
  }

  function statusText(s: number | string | undefined): string {
    return ({ "1": "Ongoing", "2": "Completed", "3": "Cancelled", "4": "Hiatus" } as any)[String(s ?? "")] ?? "";
  }

  function formatComic(comic: any) {
    return {
      id: comic.slug ?? comic.hid ?? String(comic.id ?? ""),
      title: comic.title ?? comic.name ?? "Sin título",
      image: pickCover(comic),
      description: comic.desc ?? comic.description ?? "",
      status: statusText(comic.status),
      genres: (comic.genres ?? []).map((g: any) => g.name ?? g).filter(Boolean).slice(0, 6),
      rating: comic.rating ? parseFloat(comic.rating) : null,
    };
  }

  // ─── Trending ─────────────────────────────────────────────────────────────────
  router.get("/manga/trending", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const key = `comick:trending:v2:${page}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await comickFetch(`/top?lang=es&type=comic&page=${page}`);
      const items: any[] = data?.rank ?? data?.results ?? (Array.isArray(data) ? data : []);
      const results = items.map((item: any) => {
        const comic = item.md_comics ?? item.comic ?? item;
        return formatComic(comic);
      }).filter(m => m.id);
      const result = { results, hasNextPage: results.length >= 20, currentPage: page, total: null };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message }, "comick/trending failed");
      res.status(500).json({ error: "Error cargando mangas populares" });
    }
  });

  // ─── Recent (capítulos recientes en español) ──────────────────────────────────
  router.get("/manga/recent", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const key = `comick:recent:v2:${page}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      // /chapter devuelve capítulos recientes; md_comics tiene el manga
      const data = await comickFetch(`/chapter?lang=es&limit=60&page=${page}&order=new`);
      const chapters: any[] = Array.isArray(data) ? data : (data.chapters ?? data.results ?? []);
      const seen = new Set<string>();
      const results: any[] = [];
      for (const ch of chapters) {
        const comic = ch.md_comics ?? ch.comic ?? null;
        if (!comic) continue;
        const slug = comic.slug ?? comic.hid ?? String(comic.id ?? "");
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        results.push(formatComic(comic));
        if (results.length >= 24) break;
      }
      const result = { results, hasNextPage: results.length >= 24, currentPage: page, total: null };
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
    const key = `comick:search:v2:${q}:${page}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await comickFetch(`/v1.0/search?q=${encodeURIComponent(q)}&page=${page}&limit=20&type=comic`);
      const items: any[] = Array.isArray(data) ? data : (data.results ?? []);
      const result = {
        results: items.map(formatComic).filter(m => m.id),
        hasNextPage: items.length >= 20,
        currentPage: page,
        total: null,
      };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, q }, "comick/search failed");
      res.status(500).json({ error: "Error buscando manga" });
    }
  });

  // ─── Manga info + capítulos ───────────────────────────────────────────────────
  router.get("/manga/info/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const key = `comick:info:v4:${id}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const comicData = await comickFetch(`/comic/${id}`);
      const comic = comicData.comic ?? comicData;
      // hid puede ser un hash corto o el id numérico
      const hid: string | null = comic.hid ?? null;
      const numId: string | null = comic.id ? String(comic.id) : null;
      const chapterKey = hid ?? numId;
      if (!chapterKey) {
        res.status(404).json({ error: "Manga no encontrado" }); return;
      }
      const slug = comic.slug ?? id;

      // Traer capítulos: español primero, inglés de respaldo
      const [esRes, enRes] = await Promise.allSettled([
        fetchChapters(chapterKey, "es"),
        fetchChapters(chapterKey, "en"),
      ]);
      const esChaps = esRes.status === "fulfilled" ? esRes.value : [];
      const enChaps = enRes.status === "fulfilled" ? enRes.value : [];

      // Mezclar: español tiene prioridad por número de capítulo
      const byNum = new Map<string, any>();
      for (const ch of enChaps) byNum.set(ch.chapterNumber ?? ch.id, ch);
      for (const ch of esChaps) byNum.set(ch.chapterNumber ?? ch.id, ch);

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
        status: statusText(comic.status),
        genres: (comicData.genres ?? comic.genres ?? []).map((g: any) => g.name ?? g).filter(Boolean).slice(0, 8),
        authors: (comicData.authors ?? []).map((a: any) => ({ id: String(a.id ?? ""), name: a.name ?? "" })),
        chapters,
      };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, id }, "comick/info failed");
      res.status(500).json({ error: "Error cargando manga: " + (err?.message ?? "desconocido") });
    }
  });

  async function fetchChapters(hid: string, lang: string): Promise<any[]> {
    const all: any[] = [];
    let page = 1;
    while (all.length < 5000) {
      const data = await comickFetch(`/comic/${hid}/chapters?lang=${lang}&page=${page}&limit=300`);
      const batch: any[] = data?.chapters ?? (Array.isArray(data) ? data : []);
      if (batch.length === 0) break;
      all.push(...batch);
      if (batch.length < 300) break;
      page++;
    }
    const seen = new Set<string>();
    const out: any[] = [];
    for (const ch of all) {
      const k = ch.chap ?? ch.id;
      if (seen.has(String(k))) continue;
      seen.add(String(k));
      out.push({
        id: ch.hid ?? ch.id,
        chapterNumber: ch.chap ?? null,
        volumeNumber: ch.vol ?? null,
        title: ch.title || null,
        pages: ch.page_count ?? 0,
        lang,
        releaseDate: ch.created_at ?? null,
      });
    }
    return out;
  }

  // ─── Páginas de capítulo ──────────────────────────────────────────────────────
  router.get("/manga/chapter/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const key = `comick:ch:v2:${id}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await comickFetch(`/chapter/${id}`);
      const images: any[] = data?.chapter?.images ?? data?.images ?? [];
      if (!images || images.length === 0) {
        res.status(404).json({ error: "Este capítulo no tiene páginas disponibles." });
        return;
      }
      const result = images.map((img: any, i: number) => ({
        img: proxyImg(`${COMICK_IMG}/${img.b2key}`) ?? `${COMICK_IMG}/${img.b2key}`,
        page: i + 1,
      }));
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, id }, "comick/chapter failed");
      res.status(500).json({ error: "Error cargando páginas del capítulo" });
    }
  });

  export default router;
  