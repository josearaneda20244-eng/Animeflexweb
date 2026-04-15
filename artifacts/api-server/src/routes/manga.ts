import { Router, type IRouter } from "express";

const router: IRouter = Router();

const MANGADEX_API = "https://api.mangadex.org";
const DEFAULT_LANG = "es,es-la,en";

// Simple in-memory cache
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 1000 * 60 * 10;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCached(key: string, data: unknown) {
  if (cache.size > 300) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { data, ts: Date.now() });
}

function getTitle(manga: any): string {
  const t = manga.attributes?.title ?? {};
  return t.en || t["ja-ro"] || t.ja || Object.values(t)[0] || "Sin título";
}

function getCover(manga: any, relationships: any[]): string | null {
  const rel = (relationships ?? manga.relationships ?? []).find((r: any) => r.type === "cover_art");
  if (!rel?.attributes?.fileName) return null;
  return `https://uploads.mangadex.org/covers/${manga.id}/${rel.attributes.fileName}.512.jpg`;
}

function formatManga(manga: any) {
  const attrs = manga.attributes ?? {};
  const rels = manga.relationships ?? [];
  const genres = (attrs.tags ?? [])
    .filter((t: any) => t.attributes?.group === "genre" || t.attributes?.group === "theme")
    .map((t: any) => t.attributes?.name?.en ?? "")
    .filter(Boolean)
    .slice(0, 6);

  const descRaw = attrs.description ?? {};
  const desc = descRaw["es"] || descRaw["es-la"] || descRaw["en"] || Object.values(descRaw)[0] || "";

  const authorRel = rels.find((r: any) => r.type === "author");
  const authors = authorRel?.attributes?.name ? [{ id: authorRel.id, name: authorRel.attributes.name }] : [];

  return {
    id: manga.id,
    title: getTitle(manga),
    image: getCover(manga, rels),
    status: attrs.status ? (attrs.status.charAt(0).toUpperCase() + attrs.status.slice(1)) : undefined,
    genres,
    description: typeof desc === "string" ? desc : "",
    authors,
    year: attrs.year,
    contentRating: attrs.contentRating,
    chapters: attrs.lastChapter ? parseInt(attrs.lastChapter) || undefined : undefined,
  };
}

async function mdFetch(path: string, params?: Record<string, string | string[]>, timeoutMs = 8000): Promise<any> {
  const url = new URL(`${MANGADEX_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        v.forEach(val => url.searchParams.append(k, val));
      } else {
        url.searchParams.set(k, v);
      }
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url.toString(), {
      headers: { "User-Agent": "AnimeFlex/1.0" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`MangaDex API ${resp.status}: ${url.pathname}`);
    return resp.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * GET /api/manga/trending
 */
router.get("/manga/trending", async (req, res) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  const offset = (page - 1) * 24;
  const key = `trending:${page}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await mdFetch("/manga", {
      limit: "24",
      offset: String(offset),
      "order[followedCount]": "desc",
      contentRating: ["safe", "suggestive"],
      includes: ["cover_art", "author"],
      availableTranslatedLanguage: ["es", "es-la", "en"],
    });
    const result = {
      results: (data.data ?? []).map(formatManga),
      hasNextPage: offset + 24 < (data.total ?? 0),
      currentPage: page,
      total: data.total,
    };
    setCached(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trending manga");
    res.status(500).json({ error: "Failed to fetch trending manga" });
  }
});

/**
 * GET /api/manga/recent
 */
router.get("/manga/recent", async (req, res) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  const offset = (page - 1) * 24;
  const key = `recent:${page}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await mdFetch("/manga", {
      limit: "24",
      offset: String(offset),
      "order[updatedAt]": "desc",
      contentRating: ["safe", "suggestive"],
      includes: ["cover_art", "author"],
      availableTranslatedLanguage: ["es", "es-la", "en"],
    });
    const result = {
      results: (data.data ?? []).map(formatManga),
      hasNextPage: offset + 24 < (data.total ?? 0),
      currentPage: page,
      total: data.total,
    };
    setCached(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recent manga");
    res.status(500).json({ error: "Failed to fetch recent manga" });
  }
});

/**
 * GET /api/manga/search?q=...&page=1
 */
router.get("/manga/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  const offset = (page - 1) * 24;
  if (!q) { res.status(400).json({ error: "Query param 'q' is required" }); return; }
  const key = `search:${q}:${page}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await mdFetch("/manga", {
      title: q,
      limit: "24",
      offset: String(offset),
      contentRating: ["safe", "suggestive"],
      includes: ["cover_art", "author"],
    });
    const result = {
      results: (data.data ?? []).map(formatManga),
      hasNextPage: offset + 24 < (data.total ?? 0),
      currentPage: page,
      total: data.total,
    };
    setCached(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, q }, "Failed to search manga");
    res.status(500).json({ error: "Failed to search manga" });
  }
});

/**
 * GET /api/manga/info/:id
 */
router.get("/manga/info/:id", async (req, res) => {
  const { id } = req.params;
  const key = `info:${id}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    // Fetch manga info + chapters in parallel
    const [mangaData, chaptersData] = await Promise.all([
      mdFetch(`/manga/${id}`, { includes: ["cover_art", "author", "artist"] }),
      mdFetch("/chapter", {
        manga: id,
        limit: "500",
        translatedLanguage: ["es", "es-la", "en"],
        "order[chapter]": "asc",
        "order[publishAt]": "asc",
      }),
    ]);

    const manga = mangaData.data;
    const info = formatManga(manga);

    // Group chapters: prefer Spanish, then English
    const rawChapters: any[] = chaptersData.data ?? [];
    const chapterMap = new Map<string, any>();
    for (const ch of rawChapters) {
      const num = ch.attributes?.chapter ?? "0";
      const lang = ch.attributes?.translatedLanguage ?? "";
      const existing = chapterMap.get(num);
      if (!existing) {
        chapterMap.set(num, ch);
      } else {
        // Prefer Spanish over English
        const existingLang = existing.attributes?.translatedLanguage ?? "";
        const isEsLang = lang === "es" || lang === "es-la";
        const existingIsEsLang = existingLang === "es" || existingLang === "es-la";
        if (isEsLang && !existingIsEsLang) chapterMap.set(num, ch);
      }
    }

    const chapters = Array.from(chapterMap.values()).map(ch => ({
      id: ch.id,
      chapterNumber: ch.attributes?.chapter ?? null,
      volumeNumber: ch.attributes?.volume ?? null,
      title: ch.attributes?.title || null,
      pages: ch.attributes?.pages ?? null,
      releaseDate: ch.attributes?.publishAt ?? null,
      lang: ch.attributes?.translatedLanguage ?? "en",
    }));

    const result = { ...info, chapters };
    setCached(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, id }, "Failed to fetch manga info");
    res.status(500).json({ error: "Failed to fetch manga info" });
  }
});

/**
 * GET /api/manga/chapter/:id
 */
router.get("/manga/chapter/:id", async (req, res) => {
  const { id } = req.params;
  const key = `chapter:${id}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await mdFetch(`/at-home/server/${id}`);
    const baseUrl = data.baseUrl;
    const hash = data.chapter?.hash;
    const dataArr: string[] = data.chapter?.data ?? data.chapter?.dataSaver ?? [];

    if (!baseUrl || !hash || dataArr.length === 0) {
      res.status(404).json({ error: "Chapter pages not found" });
      return;
    }

    const pages = dataArr.map((filename: string, i: number) => ({
      img: `${baseUrl}/data/${hash}/${filename}`,
      page: i + 1,
    }));

    setCached(key, pages);
    res.json(pages);
  } catch (err) {
    req.log.error({ err, id }, "Failed to fetch chapter pages");
    res.status(500).json({ error: "Failed to fetch chapter pages" });
  }
});

export default router;
