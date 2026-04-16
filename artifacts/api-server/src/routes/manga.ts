import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// ─── Comick.io API ───────────────────────────────────────────────────────────
// Covers and chapter images are served from meo.comick.pictures — a public CDN
// that works directly in the browser without needing a special Referer header.
const COMICK = "https://api.comick.fun";

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 1000 * 60 * 10;

function cached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) { cache.delete(key); return null; }
  return e.data as T;
}
function setCache(key: string, data: unknown) {
  if (cache.size > 400) { const k = cache.keys().next().value; if (k) cache.delete(k); }
  cache.set(key, { data, ts: Date.now() });
}

async function comickFetch(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${COMICK}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent": "AnimeFlex/1.0 (animeflex.lat)",
        "Accept": "application/json",
        "Referer": "https://comick.io/",
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`Comick ${r.status}: ${txt.slice(0, 120)}`);
    }
    return r.json();
  } catch (err) { clearTimeout(t); throw err; }
}

function getCoverUrl(comic: any): string | null {
  const cover = comic.md_covers?.[0] ?? comic.cover ?? null;
  if (!cover) return null;
  const key = cover.b2key ?? cover.gpurl ?? cover.url ?? null;
  if (!key) return null;
  if (key.startsWith("http")) return key;
  return `https://meo.comick.pictures/${key}`;
}

function formatComic(comic: any) {
  const genres = (comic.md_comic_md_genres ?? comic.genres ?? [])
    .map((g: any) => g.md_genres?.name ?? g.name ?? "").filter(Boolean).slice(0, 6);
  const rating = comic.bayesian_rating
    ? Math.round(parseFloat(String(comic.bayesian_rating)) * 10)
    : (comic.rating ?? undefined);
  return {
    id: comic.slug,
    title: comic.title || comic.md_titles?.[0]?.title || "Sin título",
    image: getCoverUrl(comic),
    status: comic.status === 2 ? "Completed" : comic.status === 1 ? "Ongoing" : undefined,
    genres,
    description: comic.desc || comic.description || "",
    rating: isNaN(rating) ? undefined : rating,
    chapters: comic.chapter_count || undefined,
  };
}

async function fetchChapters(slug: string): Promise<any[]> {
  // Try Spanish first, fall back to English
  const langs = ["es", "en"];
  for (const lang of langs) {
    try {
      const all: any[] = [];
      let page = 1;
      while (all.length < 500) {
        const data = await comickFetch(`/comic/${slug}/chapters`, {
          lang, limit: "100", page: String(page), "chap-order": "1",
        });
        const batch: any[] = data.chapters ?? [];
        all.push(...batch);
        const total: number = data.total ?? 0;
        if (batch.length === 0 || all.length >= total) break;
        page++;
      }
      if (all.length > 0) return all;
    } catch { /* try next lang */ }
  }
  return [];
}

// ─── Trending ────────────────────────────────────────────────────────────────
router.get("/manga/trending", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  const key = `trending:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const data = await comickFetch("/v1.0/comics", {
      trending: "true", page: String(page), type: "manga",
    });
    const comics: any[] = Array.isArray(data) ? data : (data.comics ?? data.data ?? []);
    const result = {
      results: comics.map(formatComic),
      hasNextPage: comics.length >= 20,
      currentPage: page,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "manga/trending failed");
    res.status(500).json({ error: "Error cargando mangas populares" });
  }
});

// ─── Recent ──────────────────────────────────────────────────────────────────
router.get("/manga/recent", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  const key = `recent:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const data = await comickFetch("/v1.0/comics", {
      sort: "uploaded", page: String(page), type: "manga",
    });
    const comics: any[] = Array.isArray(data) ? data : (data.comics ?? data.data ?? []);
    const result = {
      results: comics.map(formatComic),
      hasNextPage: comics.length >= 20,
      currentPage: page,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "manga/recent failed");
    res.status(500).json({ error: "Error cargando mangas recientes" });
  }
});

// ─── Search ──────────────────────────────────────────────────────────────────
router.get("/manga/search", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim();
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1") || 1);
  if (!q) { res.status(400).json({ error: "'q' es requerido" }); return; }
  const key = `search:${q}:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const data = await comickFetch("/v1.0/search", {
      q, limit: "24", page: String(page), tachiyomi: "true",
    });
    const comics: any[] = Array.isArray(data) ? data : [];
    const result = {
      results: comics.map(formatComic),
      hasNextPage: comics.length >= 24,
      currentPage: page,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, q }, "manga/search failed");
    res.status(500).json({ error: "Error buscando manga" });
  }
});

// ─── Manga info + chapters ───────────────────────────────────────────────────
router.get("/manga/info/:id", async (req: Request, res: Response) => {
  const { id } = req.params; // id = slug
  const key = `info:${id}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const [comicData, chapterList] = await Promise.all([
      comickFetch(`/comic/${id}`),
      fetchChapters(id),
    ]);

    const comic = comicData.comic ?? comicData;
    const authorsList: any[] = comicData.authors ?? comic.authors ?? [];
    const genresList: any[] = comicData.genres ?? comic.md_comic_md_genres ?? [];

    const chapters = chapterList.map((ch: any) => ({
      id: ch.hid,
      chapterNumber: ch.chap ?? null,
      volumeNumber: ch.vol ?? null,
      title: ch.title || null,
      pages: ch.page_count ?? null,
      releaseDate: ch.updated_at ?? null,
      lang: ch.lang ?? "es",
    }));

    const coverUrl = getCoverUrl(comic);
    const result = {
      id: comic.slug,
      title: comic.title || "Sin título",
      image: coverUrl,
      cover: coverUrl,
      description: comic.desc || "",
      status: comic.status === 2 ? "Completed" : comic.status === 1 ? "Ongoing" : undefined,
      genres: genresList.map((g: any) => g.md_genres?.name ?? g.name ?? "").filter(Boolean).slice(0, 8),
      rating: comic.bayesian_rating ? Math.round(parseFloat(String(comic.bayesian_rating)) * 10) : undefined,
      authors: authorsList.map((a: any) => ({ id: a.slug ?? a.name ?? "", name: a.name ?? "" })),
      chapters,
    };

    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, id }, "manga/info failed");
    res.status(500).json({ error: "Error cargando información del manga" });
  }
});

// ─── Chapter pages ───────────────────────────────────────────────────────────
router.get("/manga/chapter/:id", async (req: Request, res: Response) => {
  const { id } = req.params; // id = hid
  const key = `ch:${id}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const images = await comickFetch(`/chapter/${id}/get_images`, { tachiyomi: "true" });
    const pages: any[] = Array.isArray(images) ? images : (images.chapter?.images ?? images.images ?? []);
    if (!pages.length) {
      res.status(404).json({ error: "No se encontraron páginas para este capítulo." });
      return;
    }
    const result = pages.map((img: any, i: number) => {
      const b2key = img.b2key ?? img.gpurl ?? img.url ?? "";
      const imgUrl = b2key.startsWith("http") ? b2key : `https://meo.comick.pictures/${b2key}`;
      return { img: imgUrl, page: i + 1 };
    });
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, id }, "manga/chapter failed");
    res.status(500).json({ error: "Error cargando páginas del capítulo" });
  }
});

export default router;
