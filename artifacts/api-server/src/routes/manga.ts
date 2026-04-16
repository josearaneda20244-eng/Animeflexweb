import { Router, type IRouter, type Request, type Response } from "express";
import https from "node:https";

const router: IRouter = Router();

// ─── MangaDex API ────────────────────────────────────────────────────────────
const MDX = "https://api.mangadex.org";
const CDN = "https://uploads.mangadex.org";

// Simple in-memory cache
const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 1000 * 60 * 10; // 10 min

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

// HTTP agent that keeps connections alive (reduces latency for batched MangaDex calls)
const keepAliveAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

async function mdxFetch(path: string, params: Record<string, string | string[]> = {}): Promise<any> {
  const url = new URL(`${MDX}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      v.forEach(val => url.searchParams.append(k, val));
    } else {
      url.searchParams.set(k, v);
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url.toString(), {
      // @ts-ignore — Node 18 fetch accepts dispatcher
      agent: keepAliveAgent,
      headers: {
        "User-Agent": "AnimeFlex/3.0 (animeflex.lat)",
        "Accept": "application/json",
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`MangaDex ${r.status}: ${txt.slice(0, 120)}`);
    }
    return r.json();
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function coverUrl(mangaId: string, rel: any): string | null {
  const fileName = rel?.attributes?.fileName;
  if (!fileName) return null;
  return `${CDN}/covers/${mangaId}/${fileName}.512.jpg`;
}

function formatManga(manga: any) {
  const attrs = manga.attributes ?? {};
  const coverRel = (manga.relationships ?? []).find((r: any) => r.type === "cover_art");
  const authorRel = (manga.relationships ?? []).find((r: any) => r.type === "author");
  const title =
    attrs.title?.en ||
    attrs.title?.["ja-ro"] ||
    attrs.title?.es ||
    attrs.title?.["zh-ro"] ||
    Object.values(attrs.title ?? {})[0] ||
    "Sin título";
  const description =
    attrs.description?.es ||
    attrs.description?.en ||
    Object.values(attrs.description ?? {})[0] ||
    "";
  const genres = (attrs.tags ?? [])
    .filter((t: any) => t.attributes?.group === "genre")
    .map((t: any) => t.attributes?.name?.en ?? "")
    .filter(Boolean)
    .slice(0, 6);
  return {
    id: manga.id,
    title,
    image: coverUrl(manga.id, coverRel),
    description,
    status: attrs.status,
    genres,
    author: authorRel?.attributes?.name ?? null,
    rating: attrs.contentRating,
  };
}

const RATINGS = ["safe", "suggestive", "erotica"];

// ─── Trending ─────────────────────────────────────────────────────────────────
router.get("/manga/trending", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  const offset = (page - 1) * 24;
  const key = `trending:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const data = await mdxFetch("/manga", {
      limit: "24",
      offset: String(offset),
      "order[followedCount]": "desc",
      "includes[]": ["cover_art", "author"],
      "contentRating[]": RATINGS,
      "availableTranslatedLanguage[]": ["es", "en"],
    });
    const results = (data.data ?? []).map(formatManga);
    const result = {
      results,
      hasNextPage: offset + results.length < (data.total ?? 0),
      currentPage: page,
      total: data.total ?? 0,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "manga/trending failed");
    res.status(500).json({ error: "Error cargando mangas populares" });
  }
});

// ─── Recent ───────────────────────────────────────────────────────────────────
router.get("/manga/recent", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  const offset = (page - 1) * 24;
  const key = `recent:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const data = await mdxFetch("/manga", {
      limit: "24",
      offset: String(offset),
      "order[latestUploadedChapter]": "desc",
      "includes[]": ["cover_art", "author"],
      "contentRating[]": RATINGS,
      "availableTranslatedLanguage[]": ["es", "en"],
    });
    const results = (data.data ?? []).map(formatManga);
    const result = {
      results,
      hasNextPage: offset + results.length < (data.total ?? 0),
      currentPage: page,
      total: data.total ?? 0,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "manga/recent failed");
    res.status(500).json({ error: "Error cargando mangas recientes" });
  }
});

// ─── Search ───────────────────────────────────────────────────────────────────
router.get("/manga/search", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim();
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  const offset = (page - 1) * 20;
  if (!q) { res.status(400).json({ error: "'q' es requerido" }); return; }
  const key = `search:${q}:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const data = await mdxFetch("/manga", {
      title: q,
      limit: "20",
      offset: String(offset),
      "includes[]": ["cover_art", "author"],
      "contentRating[]": RATINGS,
    });
    const results = (data.data ?? []).map(formatManga);
    const result = {
      results,
      hasNextPage: offset + results.length < (data.total ?? 0),
      currentPage: page,
      total: data.total ?? 0,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, q }, "manga/search failed");
    res.status(500).json({ error: "Error buscando manga" });
  }
});

// ─── Manga info ────────────────────────────────────────────────────────────────
router.get("/manga/info/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const key = `info:${id}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    // Fetch manga details + chapters concurrently
    const [mangaResp, chapterResp] = await Promise.all([
      mdxFetch(`/manga/${id}`, {
        "includes[]": ["cover_art", "author", "artist"],
      }),
      fetchMangaChapters(id),
    ]);

    const manga = mangaResp.data;
    if (!manga) {
      res.status(404).json({ error: "Manga no encontrado" });
      return;
    }
    const attrs = manga.attributes ?? {};
    const coverRel = (manga.relationships ?? []).find((r: any) => r.type === "cover_art");
    const authorRel = (manga.relationships ?? []).find((r: any) => r.type === "author");

    const title =
      attrs.title?.en ||
      attrs.title?.["ja-ro"] ||
      attrs.title?.es ||
      Object.values(attrs.title ?? {})[0] ||
      "Sin título";
    const description =
      attrs.description?.es ||
      attrs.description?.en ||
      Object.values(attrs.description ?? {})[0] ||
      "";

    const result = {
      id: manga.id,
      title,
      image: coverUrl(manga.id, coverRel),
      cover: coverUrl(manga.id, coverRel),
      description,
      status: attrs.status,
      genres: (attrs.tags ?? [])
        .filter((t: any) => t.attributes?.group === "genre")
        .map((t: any) => t.attributes?.name?.en ?? "")
        .filter(Boolean)
        .slice(0, 8),
      authors: [authorRel].filter(Boolean).map((r: any) => ({
        id: r.id,
        name: r.attributes?.name ?? "",
      })),
      chapters: chapterResp,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, id }, "manga/info failed");
    res.status(500).json({ error: "Error cargando información del manga" });
  }
});

async function fetchMangaChapters(mangaId: string) {
  // Prefer Spanish, fall back to English
  const langs = ["es", "en"];
  for (const lang of langs) {
    try {
      const all: any[] = [];
      let offset = 0;
      const limit = 100;
      while (all.length < 600) {
        const data = await mdxFetch(`/manga/${mangaId}/feed`, {
          limit: String(limit),
          offset: String(offset),
          "translatedLanguage[]": [lang],
          "order[chapter]": "asc",
          "contentRating[]": RATINGS,
          "includes[]": ["scanlation_group"],
        });
        const batch: any[] = data.data ?? [];
        all.push(...batch);
        if (batch.length < limit || all.length >= (data.total ?? 0)) break;
        offset += limit;
      }
      const chapters = all
        .filter((ch: any) => (ch.attributes?.pages ?? 0) > 0)
        .map((ch: any) => ({
          id: ch.id,
          chapterNumber: ch.attributes?.chapter ?? null,
          volumeNumber: ch.attributes?.volume ?? null,
          title: ch.attributes?.title || null,
          pages: ch.attributes?.pages ?? 0,
          lang: ch.attributes?.translatedLanguage ?? lang,
          releaseDate: ch.attributes?.publishAt ?? ch.attributes?.updatedAt ?? null,
        }));
      if (chapters.length > 0) return chapters;
    } catch { /* try next lang */ }
  }
  return [];
}

// ─── Chapter pages ─────────────────────────────────────────────────────────────
router.get("/manga/chapter/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const key = `ch:${id}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const data = await mdxFetch(`/at-home/server/${id}`);
    const baseUrl: string = data.baseUrl;
    const hash: string = data.chapter?.hash;
    const files: string[] = data.chapter?.data ?? [];
    if (!baseUrl || !hash || !files.length) {
      res.status(404).json({ error: "No se encontraron páginas para este capítulo." });
      return;
    }
    // Return direct CDN URLs — browsers send Referer automatically (animeflex.lat origin)
    // MangaDex at-home servers accept any Referer, so no server-side proxy needed.
    const result = files.map((f, i) => ({
      img: `${baseUrl}/data/${hash}/${f}`,
      page: i + 1,
    }));
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, id }, "manga/chapter failed");
    res.status(500).json({ error: "Error cargando páginas del capítulo" });
  }
});

export default router;
