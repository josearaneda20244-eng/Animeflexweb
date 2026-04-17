import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const LME = "https://leermangaesp.net";
const LME_IMAGES = "https://images.leermangaesp.net/file/leermangaesp";
const API_SELF = (process.env.API_BASE_URL ?? "https://animeflex-api-production.up.railway.app").replace(/\/$/, "");
const USER_AGENT = "AnimeFlex/4.1 (+https://animeflex.lat)";
const PAGE_SIZE = 20;

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 1000 * 60 * 10;

function cached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > TTL) {
    cache.delete(key);
    return null;
  }
  return e.data as T;
}

function setCache(key: string, data: unknown) {
  if (cache.size > 500) {
    const k = cache.keys().next().value;
    if (k) cache.delete(k);
  }
  cache.set(key, { data, ts: Date.now() });
}

async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: LME,
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`LeerMangaEsp ${r.status} on ${url}`);
    return r.text();
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Referer: `${LME}/biblioteca/`,
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) throw new Error(`LeerMangaEsp API ${r.status} on ${url}`);
    return r.json() as Promise<T>;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

function decodeHtml(value = ""): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripTags(value = ""): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return m ? decodeHtml(m[1]) : null;
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `${LME}${url}`;
  return `${LME_IMAGES}/${url.replace(/^\/+/, "")}`;
}

function portadaUrl(portada: string | null | undefined): string | null {
  if (!portada) return null;
  return absoluteUrl(portada);
}

function proxyImg(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("http")) return null;
  return `${API_SELF}/api/manga/img-proxy?u=${encodeURIComponent(url)}`;
}

function encodeChapterId(slug: string, chapter: string | number): string {
  return `lme:${slug}:${String(chapter).replace(/\/+$/g, "")}`;
}

function parseChapterId(id: string): { slug: string; chapter: string } | null {
  const parts = id.split(":");
  if (parts.length >= 3 && parts[0] === "lme") {
    return { slug: parts[1], chapter: parts.slice(2).join(":") };
  }
  return null;
}

function normalizeStatus(value?: string | null): string | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v.includes("final") || v.includes("complet")) return "Completed";
  if (v.includes("curso") || v.includes("emisi") || v.includes("public")) return "Ongoing";
  return value;
}

type LmeManga = {
  id?: number;
  slug: string;
  titulo: string;
  portada?: string;
  tipo?: string;
  generos?: string[];
  ultimo_capitulo?: number | string;
  demografia?: string;
};

type LmeListResponse = {
  resultados?: LmeManga[];
  total_pages?: number;
  total?: number;
  total_results?: number;
};

function formatListManga(item: LmeManga) {
  const img = proxyImg(portadaUrl(item.portada));
  return {
    id: item.slug,
    title: item.titulo,
    image: img,
    cover: img,
    description: "",
    status: null,
    genres: [...new Set(item.generos ?? [])].filter(Boolean).slice(0, 6),
    rating: null,
    chapters: item.ultimo_capitulo != null ? Number(item.ultimo_capitulo) : undefined,
    source: "leermangaesp",
  };
}

async function listFromApi(page: number, query?: string) {
  const readable: LmeManga[] = [];
  let totalPages = page;
  let total: number | undefined;

  // For search queries, try multiple param names in case the API uses a different key
  const queryParamNames = query ? ["query", "titulo", "search", "q"] : [undefined];

  let fetchedAny = false;
  for (const paramName of queryParamNames) {
    if (fetchedAny) break;
    for (let apiPage = page; apiPage < page + 5 && readable.length < PAGE_SIZE; apiPage++) {
      const params = new URLSearchParams({
        page: String(apiPage),
        page_size: String(PAGE_SIZE * 3),
      });
      if (query && paramName) params.set(paramName, query);
      try {
        const data = await fetchJson<LmeListResponse>(`${LME}/api/buscar_mangas/?${params.toString()}`);
        totalPages = data.total_pages ?? totalPages;
        total = data.total ?? data.total_results;
        const items = data.resultados ?? [];
        // For search queries, don't filter by ultimo_capitulo — show all matches
        const filtered = query ? items : items.filter((item) => Number(item.ultimo_capitulo ?? 0) > 0);
        readable.push(...filtered);
        if (items.length > 0) fetchedAny = true;
        if (apiPage >= totalPages) break;
      } catch {
        break;
      }
    }
  }

  const results = readable.slice(0, PAGE_SIZE).map(formatListManga);
  return {
    results,
    hasNextPage: page < totalPages,
    currentPage: page,
    total,
  };
}

/**
 * Use the JSON API with an ordering parameter for trending/recent lists.
 * This is more reliable than HTML scraping because it uses the stable API endpoint.
 * - trending: ordering=-ultimo_capitulo (most chapters = most active/popular)
 * - recent:   ordering=-id (newest added to the catalog)
 */
async function listFromApiOrdered(page: number, ordering: string) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
    ordering,
  });
  try {
    const data = await fetchJson<LmeListResponse>(`${LME}/api/buscar_mangas/?${params.toString()}`);
    const totalPages = data.total_pages ?? page;
    const items = (data.resultados ?? []).filter((item) => Number(item.ultimo_capitulo ?? 0) > 0);
    return {
      results: items.map(formatListManga),
      hasNextPage: page < totalPages,
      currentPage: page,
      total: data.total ?? data.total_results,
    };
  } catch {
    // Fallback to HTML scraping if JSON API fails
    return listFromHome(page);
  }
}

/**
 * Scrape LeerMangaEsp search page (HTML fallback when API returns nothing).
 */
async function searchFromHtml(query: string, page: number) {
  const searchUrl = `${LME}/buscar/?q=${encodeURIComponent(query)}&page=${page}`;
  let html: string;
  try {
    html = await fetchText(searchUrl);
  } catch {
    // Try alternate URL pattern
    try {
      html = await fetchText(`${LME}/biblioteca/?search=${encodeURIComponent(query)}&page=${page}`);
    } catch {
      return null;
    }
  }

  const items: LmeManga[] = [];
  const seen = new Set<string>();

  // Manga card pattern
  const cardRe = /<div\b[^>]*class=["'][^"']*manga-item[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*manga-item[^"']*["']|<\/section>|<footer)/gi;
  for (const card of html.matchAll(cardRe)) {
    const block = card[1];
    const slug = block.match(/href=["'](?:https:\/\/leermangaesp\.net)?\/manga\/([^\/"']+)\/["']/i)?.[1];
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    const imgTag = block.match(/<img\b[^>]*>/i)?.[0] ?? "";
    const title = stripTags(block.match(/class=["'][^"']*manga-title[^"']*["'][^>]*>([\s\S]*?)<\/h\d>/i)?.[1] ?? attr(imgTag, "alt") ?? slug.replace(/-/g, " "));
    const portada = attr(imgTag, "data-src") ?? attr(imgTag, "src") ?? undefined;
    const chapter = block.match(/href=["'](?:https:\/\/leermangaesp\.net)?\/leer-m\/[^\/"']+\/([^\/"']+)\/["']/i)?.[1];
    items.push({ slug, titulo: title, portada, generos: [], ultimo_capitulo: chapter });
  }

  // Fallback: any links that look like manga pages
  if (items.length === 0) {
    const linkRe = /href="\/manga\/([a-z0-9][a-z0-9-]+)\/"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(linkRe)) {
      const slug = m[1];
      if (seen.has(slug)) continue;
      seen.add(slug);
      const title = stripTags(m[2]).trim() || slug.replace(/-/g, " ");
      items.push({ slug, titulo: title, generos: [] });
    }
  }

  if (items.length === 0) return null;
  return {
    results: items.slice(0, PAGE_SIZE).map(formatListManga),
    hasNextPage: false,
    currentPage: page,
    total: items.length,
  };
}

async function listFromHome(page: number) {
  const html = await fetchText(LME);
  const cardRe = /<div\b[^>]*class=["'][^"']*manga-item[^"']*["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["'][^"']*manga-item[^"']*["']|<link rel="stylesheet" href="\/static\/mi_app_public\/footer|<\/body>)/gi;
  const items: LmeManga[] = [];
  const seen = new Set<string>();
  for (const card of html.matchAll(cardRe)) {
    const block = card[1];
    const slug = block.match(/href=["'](?:https:\/\/leermangaesp\.net)?\/manga\/([^\/"']+)\/["']/i)?.[1];
    const chapter = block.match(/href=["'](?:https:\/\/leermangaesp\.net)?\/leer-m\/[^\/"']+\/([^\/"']+)\/["']/i)?.[1];
    if (!slug || !chapter || seen.has(slug)) continue;
    seen.add(slug);
    const imgTag = block.match(/<img\b[^>]*>/i)?.[0] ?? "";
    const title = stripTags(block.match(/class=["'][^"']*manga-title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? attr(imgTag, "alt") ?? slug.replace(/-/g, " "));
    const portada = attr(imgTag, "data-src") ?? attr(imgTag, "src") ?? undefined;
    const tipo = stripTags(block.match(/class=["'][^"']*manga-type[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    const demografia = stripTags(block.match(/class=["'][^"']*manga-demografia[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "");
    items.push({
      slug,
      titulo: title,
      portada,
      tipo,
      demografia,
      generos: [tipo, demografia].filter(Boolean),
      ultimo_capitulo: chapter,
    });
  }
  const start = (page - 1) * PAGE_SIZE;
  const results = items.slice(start, start + PAGE_SIZE).map(formatListManga);
  return {
    results,
    hasNextPage: start + PAGE_SIZE < items.length,
    currentPage: page,
    total: items.length,
  };
}

function parseJsonLd(html: string): any | null {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1].trim());
      if (parsed?.["@type"] === "ComicSeries") return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function parseGenres(html: string): string[] {
  return [...html.matchAll(/class=["'][^"']*genero-item[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
    .filter((g, i, arr) => arr.indexOf(g) === i)
    .slice(0, 12);
}

function parseChaptersFromHtml(html: string, slug: string): any[] {
  const chapters: any[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']\/leer-m\/([^\/"']+)\/([^\/"']+)\/["'][^>]*class=["'][^"']*chapter-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(re)) {
    const chapterSlug = decodeHtml(m[1]);
    if (chapterSlug !== slug) continue;
    const tag = m[0].slice(0, m[0].indexOf(">") + 1);
    const chapterNumber = attr(tag, "data-chapter") ?? decodeHtml(m[2]);
    if (seen.has(chapterNumber)) continue;
    seen.add(chapterNumber);
    const inner = m[3];
    const titleMatch = inner.match(/class=["'][^"']*chapter-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const dateMatch = inner.match(/class=["'][^"']*chapter-date[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const cleanTitle = titleMatch ? stripTags(titleMatch[1]).replace(/^Capítulo\s+/i, "") : "";
    chapters.push({
      id: encodeChapterId(slug, chapterNumber),
      chapterNumber: chapterNumber.replace(/\.00$/, ""),
      volumeNumber: null,
      title: cleanTitle && cleanTitle !== chapterNumber ? cleanTitle : null,
      pages: undefined,
      lang: "es",
      releaseDate: dateMatch ? stripTags(dateMatch[1]) : null,
    });
  }
  return chapters.sort((a, b) => parseFloat(String(a.chapterNumber ?? 0)) - parseFloat(String(b.chapterNumber ?? 0)));
}

type LmeChapterApi = {
  numero?: string | number;
  slug_capitulo?: string;
  titulo?: string;
  fecha?: string;
  capitulo?: string | number;
  chapter?: string | number;
  title?: string;
  date?: string;
  id?: string | number;
};

function mapApiChapter(item: LmeChapterApi, slug: string): any | null {
  const num = String(item.numero ?? item.capitulo ?? item.chapter ?? item.id ?? "").trim();
  if (!num) return null;
  const chSlug = String(item.slug_capitulo ?? num);
  return {
    id: encodeChapterId(slug, chSlug || num),
    chapterNumber: num.replace(/\.00$/, ""),
    volumeNumber: null,
    title: decodeHtml(String(item.titulo ?? item.title ?? "")) || null,
    pages: undefined,
    lang: "es",
    releaseDate: item.fecha ?? item.date ?? null,
  };
}

/**
 * Fetch ALL chapters using the ?before= pagination that LeerMangaEsp uses.
 * The manga detail page only shows the most recent ~96 chapters; older ones
 * are loaded by following the "Ver más" link: ?before=<lowest_chapter_number>.
 * Railway CAN reach these HTML pages even when the /api/capitulos/ endpoint is blocked.
 */
async function fetchAllChaptersWithPagination(slug: string, firstPageHtml: string): Promise<any[]> {
  const allChapters: any[] = [];
  const seenNums = new Set<string>();

  const addChapters = (chapters: any[]) => {
    for (const ch of chapters) {
      if (!seenNums.has(ch.chapterNumber)) {
        seenNums.add(ch.chapterNumber);
        allChapters.push(ch);
      }
    }
  };

  // Parse chapters from the first page (already fetched)
  addChapters(parseChaptersFromHtml(firstPageHtml, slug));

  // Follow ?before= links to get older chapters
  let beforeParam: string | null = firstPageHtml.match(/href="\?before=([\d.]+)"/)?.[1] ?? null;
  const MAX_PAGES = 30;
  let page = 0;

  while (beforeParam && page < MAX_PAGES) {
    try {
      const url = `${LME}/manga/${encodeURIComponent(slug)}/?before=${encodeURIComponent(beforeParam)}`;
      const pageHtml = await fetchText(url);
      const pageChapters = parseChaptersFromHtml(pageHtml, slug);
      if (pageChapters.length === 0) break;
      addChapters(pageChapters);
      beforeParam = pageHtml.match(/href="\?before=([\d.]+)"/)?.[1] ?? null;
    } catch {
      break;
    }
    page++;
  }

  return allChapters.sort(
    (a, b) => parseFloat(String(a.chapterNumber ?? 0)) - parseFloat(String(b.chapterNumber ?? 0))
  );
}

async function fetchAllChapters(slug: string, htmlChapters: any[], html: string): Promise<any[]> {
  // Use ?before= HTML pagination — works from Railway, fetches all chapters from ch.1
  try {
    const all = await fetchAllChaptersWithPagination(slug, html);
    if (all.length > htmlChapters.length) return all;
  } catch {}
  return htmlChapters;
}

function parseDetail(slug: string, html: string) {
  const jsonLd = parseJsonLd(html);
  const titleFromHead = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s*\|\s*LeerMangaEsp.*$/i, "");
  const title = decodeHtml(jsonLd?.name ?? titleFromHead ?? slug.replace(/-/g, " "));
  const description = decodeHtml(jsonLd?.description ?? html.match(/<p[^>]+id=["']synopsis-text["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const coverTag = html.match(/<img[^>]+class=["'][^"']*manga-cover[^"']*["'][^>]*>/i)?.[0] ?? "";
  const coverFromTag = attr(coverTag, "src");
  const coverFromBody = html.match(/data-portada-rel=["']([^"']+)["']/i)?.[1];
  const image = proxyImg(absoluteUrl(coverFromTag) ?? portadaUrl(coverFromBody));
  const genres = parseGenres(html);
  const chapters = parseChaptersFromHtml(html, slug);
  return {
    id: slug,
    title,
    image,
    cover: image,
    description: stripTags(description),
    status: normalizeStatus(null),
    genres,
    authors: [],
    rating: null,
    chapters,
    source: "leermangaesp",
  };
}

router.get("/manga/img-proxy", async (req: Request, res: Response) => {
  const u = req.query.u as string | undefined;
  if (!u || !u.startsWith("https://")) {
    res.status(400).end();
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    res.status(400).end();
    return;
  }
  const allowed = ["mangadex.org", "mangadex.network", "uploads.mangadex.org", "leermangaesp.net", "images.leermangaesp.net"];
  if (!allowed.some((d) => parsed.hostname.endsWith(d))) {
    res.status(400).end();
    return;
  }
  try {
    const upstream = await fetch(u, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: parsed.hostname.endsWith("leermangaesp.net") ? LME : "https://mangadex.org/",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    });
    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }
    const ct = upstream.headers.get("content-type") ?? "image/webp";
    const buf = await upstream.arrayBuffer();
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(Buffer.from(buf));
  } catch {
    res.status(502).end();
  }
});

router.get("/manga/cover-proxy", (req: Request, res: Response) => {
  res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent((req.query.url as string) ?? (req.query.u as string) ?? "")}`);
});

router.get("/manga/image-proxy", (req: Request, res: Response) => {
  const u = (req.query.url as string) ?? (req.query.u as string) ?? "";
  res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent(u)}`);
});

router.get("/manga/trending", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  const key = `lme:trending:${page}`;
  const hit = cached<any>(key);
  if (hit) {
    res.json(hit);
    return;
  }
  try {
    const result = await listFromApiOrdered(page, "-ultimo_capitulo");
    setCache(key, result);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err: err?.message }, "lme/trending failed");
    res.status(500).json({ error: "Error cargando mangas populares" });
  }
});

router.get("/manga/recent", async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  const key = `lme:recent:${page}`;
  const hit = cached<any>(key);
  if (hit) {
    res.json(hit);
    return;
  }
  try {
    const result = await listFromApiOrdered(page, "-id");
    setCache(key, result);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err: err?.message }, "lme/recent failed");
    res.status(500).json({ error: "Error cargando mangas recientes" });
  }
});

router.get("/manga/search", async (req: Request, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim();
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10) || 1);
  if (!q) {
    res.status(400).json({ error: "'q' es requerido" });
    return;
  }
  const key = `lme:search:${q}:${page}`;
  const hit = cached<any>(key);
  if (hit) {
    res.json(hit);
    return;
  }
  try {
    // 1. Try the JSON API first
    const apiResult = await listFromApi(page, q);

    // 2. If API returned nothing, fall back to HTML scraping
    if (apiResult.results.length === 0) {
      req.log.warn({ q }, "API search returned 0 results, trying HTML scrape");
      const htmlResult = await searchFromHtml(q, page);
      if (htmlResult && htmlResult.results.length > 0) {
        setCache(key, htmlResult);
        res.json(htmlResult);
        return;
      }
    }

    setCache(key, apiResult);
    res.json(apiResult);
  } catch (err: any) {
    req.log.error({ err: err?.message, q }, "lme/search failed");
    // Last resort: try HTML scraping
    try {
      const htmlResult = await searchFromHtml(q, page);
      if (htmlResult) {
        res.json(htmlResult);
        return;
      }
    } catch {}
    res.status(500).json({ error: "Error buscando manga" });
  }
});

router.get("/manga/info/:id", async (req: Request, res: Response) => {
  const slug = req.params.id.replace(/^lme:/, "");
  const key = `lme:info:${slug}`;
  const hit = cached<any>(key);
  if (hit) {
    res.json(hit);
    return;
  }
  try {
    const html = await fetchText(`${LME}/manga/${encodeURIComponent(slug)}/`);
    const result = parseDetail(slug, html);
    const allChapters = await fetchAllChapters(slug, result.chapters, html);
    result.chapters = allChapters;
    setCache(key, result);
    res.json(result);
  } catch (err: any) {
    req.log.error({ err: err?.message, id: slug }, "lme/info failed");
    res.status(500).json({ error: "Error cargando manga" });
  }
});

router.get("/manga/chapter/:id", async (req: Request, res: Response) => {
  const parsed = parseChapterId(req.params.id);
  if (!parsed) {
    res.status(400).json({ error: "Capítulo inválido" });
    return;
  }
  const key = `lme:chapter:${parsed.slug}:${parsed.chapter}`;
  const hit = cached<any>(key);
  if (hit) {
    res.json(hit);
    return;
  }
  try {
    const html = await fetchText(`${LME}/leer-m/${encodeURIComponent(parsed.slug)}/${encodeURIComponent(parsed.chapter)}/`);
    const seen = new Set<string>();
    const pages = [...html.matchAll(/<img[^>]+class=["'][^"']*manga-image[^"']*["'][^>]*>/gi)]
      .map((m) => attr(m[0], "src") ?? attr(m[0], "data-src") ?? attr(m[0], "data-lazy-src"))
      .filter((src): src is string => !!src && src.startsWith("http"))
      .filter((src) => {
        if (!src.includes("/mangas/") || seen.has(src)) return false;
        seen.add(src);
        return true;
      })
      .map((src, i) => ({
        img: proxyImg(src) ?? src,
        page: i + 1,
      }));
    if (pages.length === 0) {
      res.status(404).json({ error: "Este capítulo no tiene páginas disponibles." });
      return;
    }
    setCache(key, pages);
    res.json(pages);
  } catch (err: any) {
    req.log.error({ err: err?.message, id: req.params.id }, "lme/chapter failed");
    res.status(500).json({ error: "Error cargando páginas del capítulo" });
  }
});

export default router;