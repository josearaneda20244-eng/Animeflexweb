import { Router, type IRouter } from "express";

  const router: IRouter = Router();
  const MANGADEX = "https://api.mangadex.org";

  const cache = new Map<string, { data: unknown; ts: number }>();
  const TTL = 1000 * 60 * 10;

  function cached<T>(key: string): T | null {
    const e = cache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > TTL) { cache.delete(key); return null; }
    return e.data as T;
  }
  function setCache(key: string, data: unknown) {
    if (cache.size > 300) { const k = cache.keys().next().value; if (k) cache.delete(k); }
    cache.set(key, { data, ts: Date.now() });
  }

  function mdUrl(path: string, params: Record<string, string | string[]> = {}): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        v.forEach(val => parts.push(encodeURIComponent(k) + "[]=" + encodeURIComponent(val)));
      } else {
        parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
      }
    }
    return parts.length ? `${MANGADEX}${path}?${parts.join("&")}` : `${MANGADEX}${path}`;
  }

  async function mdFetch(path: string, params?: Record<string, string | string[]>): Promise<any> {
    const url = mdUrl(path, params);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(url, { headers: { "User-Agent": "AnimeFlex/1.0" }, signal: ctrl.signal });
      clearTimeout(t);
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        throw new Error(`MangaDex ${r.status}: ${text.slice(0, 120)}`);
      }
      return r.json();
    } catch (err) { clearTimeout(t); throw err; }
  }

  function getTitle(manga: any): string {
    const t = manga.attributes?.title ?? {};
    return t.en || t["ja-ro"] || t.ja || (Object.values(t)[0] as string) || "Sin título";
  }

  function formatManga(manga: any) {
    const a = manga.attributes ?? {};
    const rels = manga.relationships ?? [];
    const genres = (a.tags ?? [])
      .filter((t: any) => t.attributes?.group === "genre" || t.attributes?.group === "theme")
      .map((t: any) => t.attributes?.name?.en ?? "").filter(Boolean).slice(0, 6);
    const descRaw = a.description ?? {};
    const description = descRaw.es || descRaw["es-la"] || descRaw.en || (Object.values(descRaw)[0] as string) || "";
    const authorRel = rels.find((r: any) => r.type === "author");
    // Use og.mangadex.org — accessible from browsers and servers, no 403
    const image = `https://og.mangadex.org/og-image/manga/${manga.id}`;
    return {
      id: manga.id,
      title: getTitle(manga),
      image,
      status: a.status ? a.status.charAt(0).toUpperCase() + a.status.slice(1) : undefined,
      genres,
      description,
      authors: authorRel?.attributes?.name ? [{ id: authorRel.id, name: authorRel.attributes.name }] : [],
      chapters: a.lastChapter ? (parseInt(a.lastChapter) || undefined) : undefined,
      year: a.year,
    };
  }

  /** Fetch all chapters paginated (max 100 per request) */
  async function fetchAllChapters(mangaId: string, maxChapters = 300): Promise<any[]> {
    const all: any[] = [];
    let offset = 0;
    while (all.length < maxChapters) {
      const data = await mdFetch("/chapter", {
        manga: mangaId, limit: "100", offset: String(offset),
        translatedLanguage: ["es", "es-la", "en"],
        "order[chapter]": "asc",
      });
      const batch: any[] = data.data ?? [];
      all.push(...batch);
      if (batch.length < 100 || all.length >= (data.total ?? 0)) break;
      offset += 100;
    }
    return all;
  }

  // ─── Trending ────────────────────────────────────────────────────────────────
  router.get("/manga/trending", async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const offset = (page - 1) * 24;
    const key = `trending:${page}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await mdFetch("/manga", {
        limit: "24", offset: String(offset),
        "order[followedCount]": "desc",
        contentRating: ["safe", "suggestive"],
        includes: ["cover_art", "author"],
        availableTranslatedLanguage: ["es", "es-la", "en"],
      });
      const result = { results: (data.data ?? []).map(formatManga), hasNextPage: offset + 24 < (data.total ?? 0), currentPage: page };
      setCache(key, result);
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "manga/trending failed");
      res.status(500).json({ error: "Error cargando mangas populares" });
    }
  });

  // ─── Recent ──────────────────────────────────────────────────────────────────
  router.get("/manga/recent", async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const offset = (page - 1) * 24;
    const key = `recent:${page}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await mdFetch("/manga", {
        limit: "24", offset: String(offset),
        "order[updatedAt]": "desc",
        contentRating: ["safe", "suggestive"],
        includes: ["cover_art", "author"],
        availableTranslatedLanguage: ["es", "es-la", "en"],
      });
      const result = { results: (data.data ?? []).map(formatManga), hasNextPage: offset + 24 < (data.total ?? 0), currentPage: page };
      setCache(key, result);
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "manga/recent failed");
      res.status(500).json({ error: "Error cargando mangas recientes" });
    }
  });

  // ─── Search ──────────────────────────────────────────────────────────────────
  router.get("/manga/search", async (req, res) => {
    const q = (req.query.q as string | undefined)?.trim();
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
    const offset = (page - 1) * 24;
    if (!q) { res.status(400).json({ error: "'q' es requerido" }); return; }
    const key = `search:${q}:${page}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await mdFetch("/manga", {
        title: q, limit: "24", offset: String(offset),
        contentRating: ["safe", "suggestive"],
        includes: ["cover_art", "author"],
      });
      const result = { results: (data.data ?? []).map(formatManga), hasNextPage: offset + 24 < (data.total ?? 0), currentPage: page };
      setCache(key, result);
      res.json(result);
    } catch (err) {
      req.log.error({ err, q }, "manga/search failed");
      res.status(500).json({ error: "Error buscando manga" });
    }
  });

  // ─── Info + chapters ─────────────────────────────────────────────────────────
  router.get("/manga/info/:id", async (req, res) => {
    const { id } = req.params;
    const key = `info:${id}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      const [mangaRes, allChapters] = await Promise.all([
        mdFetch(`/manga/${id}`, { includes: ["cover_art", "author", "artist"] }),
        fetchAllChapters(id),
      ]);
      const info = formatManga(mangaRes.data);

      const chapMap = new Map<string, any>();
      for (const ch of allChapters) {
        const num = String(ch.attributes?.chapter ?? "0");
        const lang = ch.attributes?.translatedLanguage ?? "";
        const ex = chapMap.get(num);
        if (!ex) { chapMap.set(num, ch); continue; }
        const exLang = ex.attributes?.translatedLanguage ?? "";
        if ((lang === "es" || lang === "es-la") && !(exLang === "es" || exLang === "es-la")) {
          chapMap.set(num, ch);
        }
      }

      const chapters = Array.from(chapMap.values()).map(ch => ({
        id: ch.id,
        chapterNumber: ch.attributes?.chapter ?? null,
        volumeNumber: ch.attributes?.volume ?? null,
        title: ch.attributes?.title || null,
        pages: ch.attributes?.pages ?? null,
        releaseDate: ch.attributes?.publishAt ?? null,
        lang: ch.attributes?.translatedLanguage ?? "en",
      }));

      const result = { ...info, chapters };
      setCache(key, result);
      res.json(result);
    } catch (err) {
      req.log.error({ err, id }, "manga/info failed");
      res.status(500).json({ error: "Error cargando información del manga" });
    }
  });

  // ─── Chapter pages ───────────────────────────────────────────────────────────
  router.get("/manga/chapter/:id", async (req, res) => {
    const { id } = req.params;
    const key = `ch:${id}`;
    const hit = cached(key);
    if (hit) { res.json(hit); return; }
    try {
      const data = await mdFetch(`/at-home/server/${id}`);
      const { baseUrl, chapter } = data;
      const hash = chapter?.hash;
      const pages: string[] = chapter?.data?.length ? chapter.data : (chapter?.dataSaver ?? []);
      if (!baseUrl || !hash || !pages.length) {
        res.status(404).json({ error: "Páginas no encontradas" });
        return;
      }
      const result = pages.map((f: string, i: number) => ({ img: `${baseUrl}/data/${hash}/${f}`, page: i + 1 }));
      setCache(key, result);
      res.json(result);
    } catch (err) {
      req.log.error({ err, id }, "manga/chapter failed");
      res.status(500).json({ error: "Error cargando páginas del capítulo" });
    }
  });

  export default router;
  