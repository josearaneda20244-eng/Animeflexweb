import { Router, type IRouter, type Request, type Response } from "express";
import https from "node:https";

const router: IRouter = Router();

// ─── Config ───────────────────────────────────────────────────────────────────
const MDX = "https://api.mangadex.org";
const CDN = "https://uploads.mangadex.org";

const API_SELF = (
  process.env.API_BASE_URL ?? "https://animeflex-api-production.up.railway.app"
).replace(/\/$/, "");

const RATINGS = ["safe", "suggestive", "erotica"];

// Español europeo + español latinoamericano — ambos juntos en cada petición
const SPANISH_LANGS = ["es", "es-la"];

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

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

async function mdxFetch(path: string, params: Record<string, string | string[]> = {}): Promise<any> {
  const url = new URL(`${MDX}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach(val => url.searchParams.append(k, val));
    else url.searchParams.set(k, v);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url.toString(), {
      // @ts-ignore
      agent,
      headers: { "User-Agent": "AnimeFlex/3.0 (animeflex.lat)", Accept: "application/json" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`MangaDex ${r.status}`);
    return r.json();
  } catch (err) { clearTimeout(t); throw err; }
}

// ─── Cover URL helpers ────────────────────────────────────────────────────────
function directCoverUrl(mangaId: string, rel: any): string | null {
  const fileName = rel?.attributes?.fileName;
  if (!fileName) return null;
  return `${CDN}/covers/${mangaId}/${fileName}.512.jpg`;
}

function proxyCoverUrl(directUrl: string | null): string | null {
  if (!directUrl) return null;
  return `${API_SELF}/api/manga/cover-proxy?u=${encodeURIComponent(directUrl)}`;
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function pickTitle(title: Record<string, string>): string {
  // Preferir español antes que inglés
  return (
    title?.es ||
    title?.["es-la"] ||
    title?.en ||
    title?.["ja-ro"] ||
    title?.["zh-ro"] ||
    Object.values(title ?? {})[0] ||
    "Sin título"
  );
}

function pickDesc(description: Record<string, string>): string {
  // Preferir descripción en español
  return (
    description?.es ||
    description?.["es-la"] ||
    description?.en ||
    Object.values(description ?? {})[0] ||
    ""
  );
}

function formatManga(manga: any) {
  const attrs = manga.attributes ?? {};
  const coverRel = (manga.relationships ?? []).find((r: any) => r.type === "cover_art");
  const authorRel = (manga.relationships ?? []).find((r: any) => r.type === "author");
  const image = proxyCoverUrl(directCoverUrl(manga.id, coverRel));
  const genres = (attrs.tags ?? [])
    .filter((t: any) => t.attributes?.group === "genre")
    .map((t: any) => t.attributes?.name?.es ?? t.attributes?.name?.en ?? "")
    .filter(Boolean)
    .slice(0, 6);
  return {
    id: manga.id,
    title: pickTitle(attrs.title ?? {}),
    image,
    description: pickDesc(attrs.description ?? {}),
    status: attrs.status,
    genres,
    author: authorRel?.attributes?.name ?? null,
  };
}

// ─── Cover proxy ──────────────────────────────────────────────────────────────
router.get("/manga/cover-proxy", async (req: Request, res: Response) => {
  const u = req.query.u as string | undefined;
  if (!u || !u.startsWith("https://")) {
    res.status(400).end();
    return;
  }
  let host: string;
  try { host = new URL(u).hostname; } catch { res.status(400).end(); return; }
  if (!host.endsWith("mangadex.org") && !host.endsWith("mangadex.network")) {
    res.status(400).end();
    return;
  }
  try {
    const upstream = await fetch(u, {
      // @ts-ignore
      agent,
      headers: {
        "User-Agent": "AnimeFlex/3.0",
        "Referer": "https://mangadex.org/",
        "Accept": "image/*,*/*",
      },
    });
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const ct = upstream.headers.get("content-type") ?? "image/jpeg";
    const buf = await upstream.arrayBuffer();
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

// ─── Chapter image proxy ──────────────────────────────────────────────────────
router.get("/manga/image-proxy", async (req: Request, res: Response) => {
  const u = req.query.u as string | undefined;
  if (!u || !u.startsWith("https://")) { res.status(400).end(); return; }
  let host: string;
  try { host = new URL(u).hostname; } catch { res.status(400).end(); return; }
  if (!host.endsWith("mangadex.org") && !host.endsWith("mangadex.network")) {
    res.status(400).end();
    return;
  }
  try {
    const upstream = await fetch(u, {
      // @ts-ignore
      agent,
      headers: {
        "User-Agent": "AnimeFlex/3.0",
        "Referer": "https://mangadex.org/",
        "Accept": "image/*,*/*",
      },
    });
    if (!upstream.ok) { res.status(upstream.status).end(); return; }
    const ct = upstream.headers.get("content-type") ?? "image/jpeg";
    const buf = await upstream.arrayBuffer();
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

// ─── Trending ─────────────────────────────────────────────────────────────────
// Solo muestra manga que SÍ tienen capítulos en español (es o es-la)
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
      // Filtrar solo manga con traducciones en español disponibles
      "availableTranslatedLanguage[]": SPANISH_LANGS,
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
// Solo muestra manga que SÍ tienen capítulos en español (es o es-la)
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
      // Filtrar solo manga con traducciones en español disponibles
      "availableTranslatedLanguage[]": SPANISH_LANGS,
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
    // Primero buscar con filtro de español
    const data = await mdxFetch("/manga", {
      title: q,
      limit: "20",
      offset: String(offset),
      "includes[]": ["cover_art", "author"],
      "contentRating[]": RATINGS,
      "availableTranslatedLanguage[]": SPANISH_LANGS,
    });
    let results = (data.data ?? []).map(formatManga);

    // Si no hay resultados en español, buscar sin filtro de idioma como fallback
    if (results.length === 0 && offset === 0) {
      const dataFallback = await mdxFetch("/manga", {
        title: q,
        limit: "20",
        offset: "0",
        "includes[]": ["cover_art", "author"],
        "contentRating[]": RATINGS,
      });
      results = (dataFallback.data ?? []).map(formatManga);
      const result = {
        results,
        hasNextPage: results.length < (dataFallback.total ?? 0),
        currentPage: page,
        total: dataFallback.total ?? 0,
      };
      setCache(key, result);
      res.json(result);
      return;
    }

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

// ─── Manga info + chapters ─────────────────────────────────────────────────────
router.get("/manga/info/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const key = `info:${id}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const [mangaResp, chapterList] = await Promise.all([
      mdxFetch(`/manga/${id}`, { "includes[]": ["cover_art", "author", "artist"] }),
      fetchMangaChapters(id),
    ]);
    const manga = mangaResp.data;
    if (!manga) { res.status(404).json({ error: "Manga no encontrado" }); return; }
    const attrs = manga.attributes ?? {};
    const coverRel = (manga.relationships ?? []).find((r: any) => r.type === "cover_art");
    const authorRel = (manga.relationships ?? []).find((r: any) => r.type === "author");
    const imageUrl = proxyCoverUrl(directCoverUrl(manga.id, coverRel));
    const result = {
      id: manga.id,
      title: pickTitle(attrs.title ?? {}),
      image: imageUrl,
      cover: imageUrl,
      description: pickDesc(attrs.description ?? {}),
      status: attrs.status,
      genres: (attrs.tags ?? [])
        .filter((t: any) => t.attributes?.group === "genre")
        .map((t: any) => t.attributes?.name?.es ?? t.attributes?.name?.["es-la"] ?? t.attributes?.name?.en ?? "")
        .filter(Boolean)
        .slice(0, 8),
      authors: [authorRel].filter(Boolean).map((r: any) => ({
        id: r.id,
        name: r.attributes?.name ?? "",
      })),
      chapters: chapterList,
    };
    setCache(key, result);
    res.json(result);
  } catch (err) {
    req.log.error({ err, id }, "manga/info failed");
    res.status(500).json({ error: "Error cargando información del manga" });
  }
});

// ─── Obtener capítulos en español ─────────────────────────────────────────────
// Pide es + es-la juntos en una sola llamada. Si no hay nada en español,
// intenta inglés como último recurso.
async function fetchMangaChapters(mangaId: string) {
  // Intentar ambos dialectos de español en una sola petición
  try {
    const all: any[] = [];
    let offset = 0;
    const limit = 100;

    while (all.length < 600) {
      const data = await mdxFetch(`/manga/${mangaId}/feed`, {
        limit: String(limit),
        offset: String(offset),
        // Ambos dialectos de español en una sola petición
        "translatedLanguage[]": SPANISH_LANGS,
        "order[chapter]": "asc",
        "contentRating[]": RATINGS,
        "includes[]": ["scanlation_group"],
      });
      const batch: any[] = data.data ?? [];
      all.push(...batch);
      if (batch.length < limit || all.length >= (data.total ?? 0)) break;
      offset += limit;
    }

    if (all.length > 0) {
      return deduplicateChapters(all);
    }
  } catch {
    // seguimos al fallback
  }

  // Fallback en inglés si no hay nada en español
  try {
    const all: any[] = [];
    let offset = 0;
    const limit = 100;

    while (all.length < 600) {
      const data = await mdxFetch(`/manga/${mangaId}/feed`, {
        limit: String(limit),
        offset: String(offset),
        "translatedLanguage[]": ["en"],
        "order[chapter]": "asc",
        "contentRating[]": RATINGS,
        "includes[]": ["scanlation_group"],
      });
      const batch: any[] = data.data ?? [];
      all.push(...batch);
      if (batch.length < limit || all.length >= (data.total ?? 0)) break;
      offset += limit;
    }

    if (all.length > 0) {
      return deduplicateChapters(all);
    }
  } catch { /* sin capítulos */ }

  return [];
}

function deduplicateChapters(chapters: any[]) {
  const mapped = chapters.map((ch: any) => ({
    id: ch.id,
    chapterNumber: ch.attributes?.chapter ?? null,
    volumeNumber: ch.attributes?.volume ?? null,
    title: ch.attributes?.title || null,
    pages: ch.attributes?.pages ?? 0,
    lang: ch.attributes?.translatedLanguage ?? "",
    releaseDate: ch.attributes?.publishAt ?? ch.attributes?.updatedAt ?? null,
  }));

  // Deduplicar por número de capítulo.
  // Si hay versión en español (es/es-la) Y en inglés para el mismo número,
  // preferir siempre la española.
  const byNumber = new Map<string, typeof mapped[0]>();
  for (const ch of mapped) {
    const key = String(ch.chapterNumber ?? ch.id);
    const existing = byNumber.get(key);
    if (!existing) {
      byNumber.set(key, ch);
    } else {
      // Preferir español sobre inglés
      const chIsSpanish = SPANISH_LANGS.includes(ch.lang);
      const existingIsSpanish = SPANISH_LANGS.includes(existing.lang);
      if (chIsSpanish && !existingIsSpanish) {
        byNumber.set(key, ch);
      }
    }
  }

  return Array.from(byNumber.values());
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
    const filesSaver: string[] = data.chapter?.dataSaver ?? [];

    // Intentar primero calidad normal, luego dataSaver como respaldo
    const imagesToUse = files.length > 0 ? files : filesSaver;
    const qualityPath = files.length > 0 ? "data" : "data-saver";

    if (!baseUrl || !hash || imagesToUse.length === 0) {
      res.status(404).json({ error: "No se encontraron páginas para este capítulo." });
      return;
    }

    const result = imagesToUse.map((f, i) => ({
      img: `${API_SELF}/api/manga/image-proxy?u=${encodeURIComponent(`${baseUrl}/${qualityPath}/${hash}/${f}`)}`,
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
