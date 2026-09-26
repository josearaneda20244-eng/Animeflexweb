import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const TMO = "https://zonatmo.org";
const API_SELF = (process.env.API_BASE_URL ?? "https://animeflexweb-production.up.railway.app").replace(/\/$/, "");
const USER_AGENT = "AnimeFlex/4.2 (+https://animeflex.lat)";
const PAGE_SIZE = 24;
const CACHE_TTL = 1000 * 60 * 10;
const cache = new Map<string, { data: unknown; ts: number }>();

function cached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown) {
  if (cache.size >= 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Referer: `${TMO}/`,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`ZonaTMO ${response.status} on ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtml(value = ""): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripTags(value = ""): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

function absoluteUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${TMO}/${value.replace(/^\/+/, "")}`;
}

function proxyImage(url: string | null | undefined): string | null {
  const absolute = absoluteUrl(url);
  return absolute ? `${API_SELF}/api/manga/img-proxy?u=${encodeURIComponent(absolute)}` : null;
}

function normalizeStatus(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("final") || normalized.includes("complet")) return "Completed";
  if (normalized.includes("emisión") || normalized.includes("emision") || normalized.includes("public")) return "Ongoing";
  if (normalized.includes("pausa") || normalized.includes("hiatus")) return "Hiatus";
  if (normalized.includes("cancel")) return "Cancelled";
  return value;
}

function encodeMangaId(type: string, numericId: string, slug: string): string {
  return `tmo:${type}:${numericId}:${slug}`;
}

function parseMangaId(value: string): { type: string; numericId: string; slug: string } | null {
  const parts = value.replace(/^tmo:/, "").split(":");
  if (parts.length < 3) return null;
  const [type, numericId, ...slugParts] = parts;
  if (!/^[a-z_]+$/i.test(type) || !/^\d+$/.test(numericId)) return null;
  return { type, numericId, slug: slugParts.join(":") };
}

function parseChapterId(value: string): string | null {
  return value.match(/^tmo:(\d+)$/)?.[1] ?? null;
}

function parseLibrary(html: string, page: number) {
  const results: any[] = [];
  const seen = new Set<string>();
  const cards = /<a\b[^>]*href=["'](?:https:\/\/zonatmo\.org)?\/library\/([a-z_]+)\/(\d+)\/([^"'/?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(cards)) {
    const [, type, numericId, slug, body] = match;
    const id = encodeMangaId(type, numericId, slug);
    if (seen.has(id)) continue;
    seen.add(id);
    const imageTag = body.match(/<img\b[^>]*class=["'][^"']*cover-bg-img[^"']*["'][^>]*>/i)?.[0] ?? "";
    const title = stripTags(body.match(/<h4\b[^>]*class=["'][^"']*text-truncate[^"']*["'][^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? slug.replace(/-/g, " "));
    const image = proxyImage(attr(imageTag, "src") ?? attr(imageTag, "data-src"));
    const status = normalizeStatus(stripTags(body.match(/class=["'][^"']*book-meta-status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ""));
    const demographic = attr(body.match(/<span\b[^>]*class=["'][^"']*demography[^"']*["'][^>]*>/i)?.[0] ?? "", "title");
    const mediaType = stripTags(body.match(/class=["'][^"']*book-type[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? type);
    const rating = Number.parseFloat(stripTags(body.match(/class=["']score["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1] ?? ""));
    const chapterText = stripTags(body.match(/class=["'][^"']*book-meta-item[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    const chapters = Number.parseInt(chapterText.match(/\d+/)?.[0] ?? "", 10);
    results.push({
      id, title, image, cover: image, description: "", status,
      genres: [mediaType, demographic].filter((item): item is string => !!item),
      rating: Number.isFinite(rating) ? rating : null,
      chapters: Number.isFinite(chapters) ? chapters : undefined,
      source: "zonatmo",
    });
  }

  const pageNumbers = [...html.matchAll(/[?&]page=(\d+)/gi)].map((match) => Number.parseInt(match[1], 10));
  const lastPage = Math.max(page, ...pageNumbers.filter(Number.isFinite));
  return { results: results.slice(0, PAGE_SIZE), hasNextPage: page < lastPage, currentPage: page };
}

async function fetchLibrary(page: number, options?: { query?: string; order?: string }) {
  const params = new URLSearchParams({
    page: String(page),
    _pg: String(page),
    order_item: options?.order ?? "likes_count",
    order_dir: "desc",
  });
  if (options?.query) params.set("title", options.query);
  return parseLibrary(await fetchText(`${TMO}/biblioteca?${params.toString()}`), page);
}

function parseGenres(html: string): string[] {
  const end = html.indexOf("<h5 class=\"element-subtitle\">Estado</h5>");
  const relevant = end > 0 ? html.slice(0, end) : html;
  return [...relevant.matchAll(/<a\b[^>]*href=["'](?:https:\/\/zonatmo\.org)?\/tag\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => stripTags(match[1])).filter(Boolean)
    .filter((genre, index, all) => all.indexOf(genre) === index).slice(0, 16);
}

function parseAuthors(html: string): Array<{ name: string }> {
  return [...html.matchAll(/<a\b[^>]*href=["'][^"']*biblioteca\?filter_by=author&amp;title=[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => stripTags(match[1])).filter(Boolean)
    .filter((author, index, all) => all.indexOf(author) === index)
    .map((name) => ({ name }));
}

function parseChapters(html: string) {
  const chapters: any[] = [];
  const seen = new Set<string>();
  const rows = /<li\b[^>]*class=["'][^"']*upload-link[^"']*["'][^>]*data-chapter-number=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<li\b[^>]*class=["'][^"']*upload-link|<\/ul>)/gi;
  for (const row of html.matchAll(rows)) {
    const chapterNumber = decodeHtml(row[1]).replace(/\.00$/, "");
    const uploadId = row[2].match(/href=["'](?:https:\/\/zonatmo\.org)?\/view_uploads\/(\d+)["']/i)?.[1];
    if (!uploadId || seen.has(chapterNumber)) continue;
    seen.add(chapterNumber);
    const date = stripTags(row[2].match(/<span\b[^>]*class=["'][^"']*text-muted\s+small\s+ml-auto[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "");
    chapters.push({ id: `tmo:${uploadId}`, chapterNumber, volumeNumber: null, title: null, pages: undefined, lang: "es", releaseDate: date || null });
  }
  return chapters.sort((a, b) => Number.parseFloat(a.chapterNumber) - Number.parseFloat(b.chapterNumber));
}

function parseDetail(id: string, html: string) {
  const parsed = parseMangaId(id);
  const title = stripTags(html.match(/<h1\b[^>]*class=["'][^"']*element-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const imageTag = html.match(/<img\b[^>]*class=["'][^"']*book-thumbnail[^"']*["'][^>]*>/i)?.[0] ?? "";
  const image = proxyImage(attr(imageTag, "src"));
  const description = stripTags(html.match(/<p\b[^>]*id=["']manga-synopsis["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const status = normalizeStatus(stripTags(html.match(/<span\b[^>]*class=["'][^"']*book-status[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ""));
  const rating = Number.parseFloat(stripTags(html.match(/<div\b[^>]*class=["']score["'][^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/i)?.[1] ?? ""));
  return {
    id, title: title || parsed?.slug.replace(/-/g, " ") || id, image, cover: image,
    description, status, genres: parseGenres(html), authors: parseAuthors(html),
    rating: Number.isFinite(rating) ? rating : null, chapters: parseChapters(html), source: "zonatmo",
  };
}

function isAllowedImageHost(hostname: string): boolean {
  return hostname === "zonatmo.org" || hostname === "storage.zonatmo.org" || hostname === "storage2.zonatmo.org";
}

router.get("/manga/img-proxy", async (req: Request, res: Response) => {
  let imageUrl: URL;
  try { imageUrl = new URL(String(req.query.u ?? "")); } catch { res.status(400).end(); return; }
  if (imageUrl.protocol !== "https:" || !isAllowedImageHost(imageUrl.hostname)) { res.status(400).end(); return; }
  try {
    const upstream = await fetch(imageUrl, { headers: { "User-Agent": USER_AGENT, Referer: `${TMO}/`, Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" } });
    if (!upstream.ok) { res.status(upstream.status).end(); return; }
    const contentType = upstream.headers.get("content-type") ?? "image/webp";
    if (!contentType.toLowerCase().startsWith("image/")) { res.status(502).end(); return; }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch { res.status(502).end(); }
});

router.get("/manga/cover-proxy", (req, res) => res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent(String(req.query.url ?? req.query.u ?? ""))}`));
router.get("/manga/image-proxy", (req, res) => res.redirect(`/api/manga/img-proxy?u=${encodeURIComponent(String(req.query.url ?? req.query.u ?? ""))}`));

async function sendLibrary(req: Request, res: Response, kind: "trending" | "recent") {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const key = `tmo:${kind}:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const result = await fetchLibrary(page, { order: kind === "recent" ? "creation" : "likes_count" });
    setCache(key, result);
    res.json(result);
  } catch (error: any) {
    req.log.error({ err: error?.message }, `tmo/${kind} failed`);
    res.status(502).json({ error: kind === "recent" ? "Error cargando mangas recientes" : "Error cargando mangas populares" });
  }
}

router.get("/manga/trending", (req, res) => void sendLibrary(req, res, "trending"));
router.get("/manga/recent", (req, res) => void sendLibrary(req, res, "recent"));

router.get("/manga/search", async (req: Request, res: Response) => {
  const query = String(req.query.q ?? "").trim();
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  if (!query) { res.status(400).json({ error: "'q' es requerido" }); return; }
  const key = `tmo:search:${query.toLowerCase()}:${page}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const result = await fetchLibrary(page, { query });
    setCache(key, result);
    res.json(result);
  } catch (error: any) {
    req.log.error({ err: error?.message, query }, "tmo/search failed");
    res.status(502).json({ error: "Error buscando manga" });
  }
});

router.get("/manga/info/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = parseMangaId(id);
  if (!parsed) { res.status(400).json({ error: "Manga inválido" }); return; }
  const key = `tmo:info:${id}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const url = `${TMO}/library/${encodeURIComponent(parsed.type)}/${encodeURIComponent(parsed.numericId)}/${encodeURIComponent(parsed.slug)}`;
    const result = parseDetail(id, await fetchText(url));
    setCache(key, result);
    res.json(result);
  } catch (error: any) {
    req.log.error({ err: error?.message, id }, "tmo/info failed");
    res.status(502).json({ error: "Error cargando manga" });
  }
});

router.get("/manga/chapter/:id", async (req: Request, res: Response) => {
  const uploadId = parseChapterId(String(req.params.id));
  if (!uploadId) { res.status(400).json({ error: "Capítulo inválido" }); return; }
  const key = `tmo:chapter:${uploadId}`;
  const hit = cached(key);
  if (hit) { res.json(hit); return; }
  try {
    const html = await fetchText(`${TMO}/view_uploads/${uploadId}`);
    const seen = new Set<string>();
    const pages: Array<{ img: string; page: number }> = [];
    for (const match of html.matchAll(/<img\b[^>]*class=["'][^"']*reader-image[^"']*["'][^>]*>/gi)) {
      const source = absoluteUrl(attr(match[0], "src") ?? attr(match[0], "data-src"));
      if (!source || seen.has(source)) continue;
      seen.add(source);
      pages.push({ img: proxyImage(source) ?? source, page: pages.length + 1 });
    }
    if (pages.length === 0) { res.status(404).json({ error: "Este capítulo no tiene páginas disponibles." }); return; }
    setCache(key, pages);
    res.json(pages);
  } catch (error: any) {
    req.log.error({ err: error?.message, uploadId }, "tmo/chapter failed");
    res.status(502).json({ error: "Error cargando páginas del capítulo" });
  }
});

export default router;
