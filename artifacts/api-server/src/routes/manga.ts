import { Router, type IRouter, type Request, type Response } from "express";

  const router: IRouter = Router();

  const MDX = "https://api.mangadex.org";
  const MDX_CDN = "https://uploads.mangadex.org";
  const API_SELF = (process.env.API_BASE_URL ?? "https://animeflex-api-production.up.railway.app").replace(/\/$/, "");

  // ─── Cache ─────────────────────────────────────────────────────────────────────
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

  // ─── HTTP helper ───────────────────────────────────────────────────────────────
  async function mdxFetch(path: string): Promise<any> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    try {
      const r = await fetch(`${MDX}${path}`, {
        headers: { "User-Agent": "AnimeFlex/4.0 (https://animeflex.lat)", "Accept": "application/json" },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!r.ok) throw new Error(`MangaDex ${r.status} on ${path}`);
      return r.json();
    } catch (err) { clearTimeout(t); throw err; }
  }

  // ─── Proxy de imágenes ─────────────────────────────────────────────────────────
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
    const allowed = ["mangadex.org", "mangadex.network", "uploads.mangadex.org"];
    if (!allowed.some(d => host.endsWith(d))) { res.status(400).end(); return; }
    try {
      const upstream = await fetch(u, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://mangadex.org/", "Accept": "image/*,*/*" },
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

  // Compatibilidad con rutas anteriores
  router.get("/manga/cover-proxy", (req: Request, res: Response) => {
    res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent((req.query.url as string) ?? (req.query.u as string) ?? "")}`);
  });
  router.get("/manga/image-proxy", (req: Request, res: Response) => {
    const u = (req.query.url as string) ?? (req.query.u as string) ?? "";
    res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent(u)}`);
  });

  // ─── Helpers de formato ────────────────────────────────────────────────────────
  const LANGS = ["es-la", "es"];

  function pickTitle(attrs: any): string {
    const t = attrs?.title ?? {};
    return t["es-la"] ?? t["es"] ?? t["en"] ?? Object.values(t)[0] ?? "Sin título";
  }
  function pickDesc(attrs: any): string {
    const d = attrs?.description ?? {};
    return d["es-la"] ?? d["es"] ?? d["en"] ?? Object.values(d)[0] ?? "";
  }
  function coverUrl(manga: any): string | null {
    const rel = manga.relationships?.find((r: any) => r.type === "cover_art");
    if (!rel?.attributes?.fileName) return null;
    return `${MDX_CDN}/covers/${manga.id}/${rel.attributes.fileName}.512.jpg`;
  }
  function authorName(manga: any): string {
    const rel = manga.relationships?.find((r: any) => r.type === "author");
    return rel?.attributes?.name ?? "";
  }
  function formatManga(manga: any) {
    const attrs = manga.attributes ?? {};
    const img = proxyImg(coverUrl(manga));
    return {
      id: manga.id,
      title: pickTitle(attrs),
      image: img,
      cover: img,
      description: pickDesc(attrs),
      status: attrs.status ?? null,
      genres: (attrs.tags ?? []).filter((t: any) => t.attributes?.group === "genre").map((t: any) => t.attributes?.name?.en ?? "").filter(Boolean).slice(0, 6),
      rating: null,
    };
  }

  // ─── Trending ─────────────────────────────────────────────────────────────────
  router.get("/manga/trending", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const offset = (page - 1) * 20;
    const key = `mdx:trending:v4:${page}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const qs = `limit=20&offset=${offset}&availableTranslatedLanguage[]=es-la&availableTranslatedLanguage[]=es&includes[]=cover_art&includes[]=author&order[followedCount]=desc&hasAvailableChapters=true&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
      const data = await mdxFetch(`/manga?${qs}`);
      const results = (data.data ?? []).map(formatManga);
      const result = { results, hasNextPage: (data.offset + data.limit) < data.total, currentPage: page, total: data.total };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message }, "mdx/trending failed");
      res.status(500).json({ error: "Error cargando mangas populares" });
    }
  });

  // ─── Recent ───────────────────────────────────────────────────────────────────
  router.get("/manga/recent", async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const offset = (page - 1) * 20;
    const key = `mdx:recent:v4:${page}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const qs = `limit=20&offset=${offset}&availableTranslatedLanguage[]=es-la&availableTranslatedLanguage[]=es&includes[]=cover_art&includes[]=author&order[updatedAt]=desc&hasAvailableChapters=true&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
      const data = await mdxFetch(`/manga?${qs}`);
      const results = (data.data ?? []).map(formatManga);
      const result = { results, hasNextPage: (data.offset + data.limit) < data.total, currentPage: page, total: data.total };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message }, "mdx/recent failed");
      res.status(500).json({ error: "Error cargando mangas recientes" });
    }
  });

  // ─── Search ───────────────────────────────────────────────────────────────────
  router.get("/manga/search", async (req: Request, res: Response) => {
    const q = (req.query.q as string | undefined)?.trim();
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    if (!q) { res.status(400).json({ error: "'q' es requerido" }); return; }
    const offset = (page - 1) * 20;
    const key = `mdx:search:v4:${q}:${page}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const qs = `title=${encodeURIComponent(q)}&limit=20&offset=${offset}&availableTranslatedLanguage[]=es-la&availableTranslatedLanguage[]=es&includes[]=cover_art&includes[]=author&order[relevance]=desc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`;
      const data = await mdxFetch(`/manga?${qs}`);
      const results = (data.data ?? []).map(formatManga);
      const result = { results, hasNextPage: (data.offset + data.limit) < data.total, currentPage: page, total: data.total };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, q }, "mdx/search failed");
      res.status(500).json({ error: "Error buscando manga" });
    }
  });

  // ─── Manga info + capítulos ────────────────────────────────────────────────────
  router.get("/manga/info/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const key = `mdx:info:v4:${id}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const [infoData, chaptersData] = await Promise.all([
        mdxFetch(`/manga/${id}?includes[]=cover_art&includes[]=author&includes[]=artist`),
        fetchAllChapters(id),
      ]);

      const manga = infoData.data ?? {};
      const attrs = manga.attributes ?? {};
      const img = proxyImg(coverUrl(manga));

      const result = {
        id: manga.id,
        title: pickTitle(attrs),
        image: img,
        cover: img,
        description: pickDesc(attrs),
        status: attrs.status ?? null,
        genres: (attrs.tags ?? []).filter((t: any) => t.attributes?.group === "genre").map((t: any) => t.attributes?.name?.en ?? "").filter(Boolean).slice(0, 8),
        authors: (manga.relationships ?? []).filter((r: any) => r.type === "author" || r.type === "artist").map((r: any) => ({ id: r.id, name: r.attributes?.name ?? "" })),
        chapters: chaptersData,
      };
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, id }, "mdx/info failed");
      res.status(500).json({ error: "Error cargando manga" });
    }
  });

  async function fetchAllChapters(mangaId: string): Promise<any[]> {
    // Traer español + inglés en paralelo
    const [esData, enData] = await Promise.allSettled([
      fetchChaptersByLang(mangaId, ["es-la", "es"]),
      fetchChaptersByLang(mangaId, ["en"]),
    ]);
    const esChaps = esData.status === "fulfilled" ? esData.value : [];
    const enChaps = enData.status === "fulfilled" ? enData.value : [];

    // Español tiene prioridad; inglés rellena capítulos que no tienen traducción
    const byNum = new Map<string, any>();
    for (const ch of enChaps) {
      const k = ch.chapterNumber ?? ch.id;
      if (!byNum.has(String(k))) byNum.set(String(k), ch);
    }
    for (const ch of esChaps) {
      const k = ch.chapterNumber ?? ch.id;
      byNum.set(String(k), ch); // sobreescribe inglés
    }
    return Array.from(byNum.values()).sort(
      (a, b) => parseFloat(String(a.chapterNumber ?? 0)) - parseFloat(String(b.chapterNumber ?? 0))
    );
  }

  async function fetchChaptersByLang(mangaId: string, langs: string[]): Promise<any[]> {
    const langQs = langs.map(l => `translatedLanguage[]=${l}`).join("&");
    const all: any[] = [];
    let offset = 0;
    const limit = 500;
    while (true) {
      const data = await mdxFetch(`/manga/${mangaId}/feed?limit=${limit}&offset=${offset}&${langQs}&order[chapter]=asc&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`);
      const batch: any[] = (data.data ?? []).filter(
        (ch: any) => !ch.attributes?.externalUrl  // excluir capítulos externos (0 páginas)
      );
      all.push(...batch);
      if (all.length >= (data.total ?? 0) || (data.data ?? []).length < limit) break;
      offset += limit;
    }
    // Deduplicar por número de capítulo, tomar el más reciente
    const byNum = new Map<string, any>();
    for (const ch of all) {
      const num = ch.attributes?.chapter ?? null;
      const k = num ?? ch.id;
      const existing = byNum.get(String(k));
      if (!existing || new Date(ch.attributes?.updatedAt) > new Date(existing.attributes?.updatedAt)) {
        byNum.set(String(k), ch);
      }
    }
    return Array.from(byNum.values()).map((ch: any) => ({
      id: ch.id,
      chapterNumber: ch.attributes?.chapter ?? null,
      volumeNumber: ch.attributes?.volume ?? null,
      title: ch.attributes?.title || null,
      pages: ch.attributes?.pages ?? 0,
      lang: ch.attributes?.translatedLanguage ?? langs[0],
      releaseDate: ch.attributes?.publishAt ?? null,
    }));
  }

  // ─── Páginas de capítulo ───────────────────────────────────────────────────────
  router.get("/manga/chapter/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const key = `mdx:ch:v4:${id}`;
    const hit = cached<any>(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await mdxFetch(`/at-home/server/${id}?forcePort443=true`);
      const base = data.baseUrl;
      const hash = data.chapter?.hash;
      let pages: string[] = data.chapter?.data ?? [];
      // Si no hay páginas, intentar dataSaver
      if (pages.length === 0) pages = data.chapter?.dataSaver ?? [];
      const folder = data.chapter?.data?.length > 0 ? "data" : "data-saver";
      if (!pages || pages.length === 0) {
        res.status(404).json({ error: "Este capítulo no tiene páginas disponibles." });
        return;
      }
      const result = pages.map((p: string, i: number) => ({
        img: proxyImg(`${base}/${folder}/${hash}/${p}`) ?? `${base}/${folder}/${hash}/${p}`,
        page: i + 1,
      }));
      setCache(key, result);
      res.json(result);
    } catch (err: any) {
      req.log.error({ err: err?.message, id }, "mdx/chapter failed");
      res.status(500).json({ error: "Error cargando páginas del capítulo" });
    }
  });

  export default router;
  