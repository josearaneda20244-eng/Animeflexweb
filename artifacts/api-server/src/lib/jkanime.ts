const BASE = "https://jkanime.net";

const slugCache = new Map<string, string>();
const SLUG_CACHE_TTL = 1000 * 60 * 60 * 2;
const slugCacheTime = new Map<string, number>();

const m3u8Cache = new Map<string, { sources: Array<{ url: string; quality: string; isM3U8: boolean; lang: "LAT" | "SUB"; referer?: string }>, ts: number }>();
const M3U8_CACHE_TTL = 1000 * 60 * 25;

const PAGE_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

const IFRAME_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "iframe",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeSlugs(title: string): string[] {
  const variants: string[] = [slugify(title)];

  // Remove trailing season/part info
  const noSeason = title.replace(/\s*:?\s*Season\s+\d+\s*$/i, "").trim();
  if (noSeason !== title) variants.push(slugify(noSeason));

  const noOrdinalSeason = title.replace(/\s*:?\s*\d+(st|nd|rd|th)\s+Season\s*$/i, "").trim();
  if (noOrdinalSeason !== title && !variants.includes(slugify(noOrdinalSeason)))
    variants.push(slugify(noOrdinalSeason));

  const noPart = title.replace(/\s*:?\s*Part\s+\d+\s*$/i, "").trim();
  if (noPart !== title) variants.push(slugify(noPart));

  const noYear = title.replace(/\s*\(\d{4}\)\s*$/g, "").trim();
  if (noYear !== title) variants.push(slugify(noYear));

  const noColon = title.split(":")[0].trim();
  if (noColon !== title) variants.push(slugify(noColon));

  const noTrailingNum = title.replace(/\s+\d+\s*$/, "").trim();
  if (noTrailingNum !== title && !variants.includes(slugify(noTrailingNum)))
    variants.push(slugify(noTrailingNum));

  // JKAnime-specific: append season number suffix (e.g. "one-piece-2")
  const seasonMatch = title.match(/\s+(\d+)\s*$/);
  if (seasonMatch) {
    const base = title.replace(/\s+\d+\s*$/, "").trim();
    variants.push(`${slugify(base)}-${seasonMatch[1]}`);
  }

  // First 3 and 4 words
  const words = title.split(" ");
  const words3 = words.slice(0, 3).join(" ");
  const words4 = words.slice(0, 4).join(" ");
  if (!variants.includes(slugify(words3)) && words3.length > 3) variants.push(slugify(words3));
  if (!variants.includes(slugify(words4)) && words4.length > 3) variants.push(slugify(words4));

  // First word
  const firstWord = title.split(/[\s:]/)[0].trim();
  const firstWordSlug = slugify(firstWord);
  if (firstWordSlug.length >= 4 && !variants.includes(firstWordSlug)) {
    variants.push(firstWordSlug);
  }

  // JKAnime sometimes uses "nire" suffix: e.g. "enen-no-shouboutai-ni-nare"
  // We don't add that automatically, but search will find it

  return [...new Set(variants)];
}

async function fetchPage(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: PAGE_HEADERS, redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`JKAnime page HTTP ${res.status}: ${url}`);
    return res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchIframe(url: string, referer: string, timeoutMs = 8000): Promise<string> {
  const headers = { ...IFRAME_HEADERS, "Referer": referer };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`JKAnime iframe HTTP ${res.status}: ${url}`);
    return res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Search JKAnime and return ALL candidate slugs found.
 */
async function searchJkAnimeSlugs(query: string): Promise<string[]> {
  try {
    const url = `${BASE}/search/anime/?q=${encodeURIComponent(query)}`;
    const html = await fetchPage(url, 12000);
    const slugs: string[] = [];
    const seen = new Set<string>();

    const addSlug = (candidate: string) => {
      const SKIP = ["search", "api", "cdn", "assets", "static", "tag", "genero", "tipo", "temporada", "directorio"];
      if (!SKIP.includes(candidate) && !seen.has(candidate) && candidate.length >= 2) {
        seen.add(candidate);
        slugs.push(candidate);
      }
    };

    // Pattern 1: href="/slug/" title=
    const re1 = /href="\/([a-z0-9][a-z0-9-]+)\/" title=/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(html)) !== null) addSlug(m[1]);

    // Pattern 2: href="/slug/" (without title=, but with class or other attributes)
    const re2 = /href="\/([a-z0-9][a-z0-9-]{2,})\/"[^>]*class="[^"]*anime[^"]*"/g;
    while ((m = re2.exec(html)) !== null) addSlug(m[1]);

    // Pattern 3: data-slug or data-name
    const re3 = /data-(?:slug|anime)="([a-z0-9][a-z0-9-]+)"/g;
    while ((m = re3.exec(html)) !== null) addSlug(m[1]);

    // Pattern 4: any href="/slug/" as long as slug looks like an anime name (has a dash or is long enough)
    const re4 = /href="\/([a-z0-9][a-z0-9-]{3,})\/"/g;
    while ((m = re4.exec(html)) !== null) {
      const candidate = m[1];
      if (candidate.includes("-") || candidate.length >= 6) addSlug(candidate);
    }

    return slugs;
  } catch {
    return [];
  }
}

function extractM3u8(html: string): string | null {
  const patterns = [
    /(?:url|file|source|src)\s*:\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
    /loadSource\s*\(\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
    /['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractIframeUrls(html: string, episodePageUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (u: string) => {
    if (!seen.has(u) && !u.includes("'+val.") && !u.includes("undefined")) {
      seen.add(u);
      urls.push(u);
    }
  };

  // JKPlayer iframes
  const re1 = /src="(https?:\/\/jkanime\.net\/jkplayer\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) addUrl(m[1]);
  const re2 = /src='(https?:\/\/jkanime\.net\/jkplayer\/[^']+)'/g;
  while ((m = re2.exec(html)) !== null) addUrl(m[1]);
  const re3 = /data-src=["'](https?:\/\/jkanime\.net\/jkplayer\/[^"']+)["']/g;
  while ((m = re3.exec(html)) !== null) addUrl(m[1]);

  // Also catch any other player iframes from jkanime.net
  const re4 = /src="(https?:\/\/jkanime\.net\/(?:jkplayer|player|cdn)[^"]+)"/g;
  while ((m = re4.exec(html)) !== null) addUrl(m[1]);

  return urls;
}

/**
 * Check if an HTML response looks like a valid JKAnime episode page.
 * Flexible — doesn't require a specific player name.
 */
function isValidEpisodePage(html: string): boolean {
  if (html.length < 3000) return false;
  const lower = html.toLowerCase();
  // Must not be a 404/not found page
  if (lower.includes("404 not found") || lower.includes("página no encontrada") || lower.includes("page not found")) return false;
  // Must contain some video/player indicator
  const hasPlayer = lower.includes("jkplayer") || lower.includes("jwplayer") || lower.includes(".m3u8") ||
    lower.includes("videojs") || lower.includes("video/mp4") || lower.includes("hlsurl") ||
    lower.includes("data-video") || lower.includes("player") && lower.includes("source");
  // OR must have episode-specific content
  const hasEpisodeContent = lower.includes("episodio") || lower.includes("capítulo") || lower.includes("episode");
  return hasPlayer || (hasEpisodeContent && html.length > 8000);
}

async function trySlug(slug: string, episodeNum: number): Promise<string | null> {
  try {
    const url = `${BASE}/${slug}/${episodeNum}/`;
    const html = await fetchPage(url, 10000);
    if (isValidEpisodePage(html)) {
      return html;
    }
    return null;
  } catch {
    return null;
  }
}

export interface JkAnimeStreamData {
  sources: Array<{ url: string; quality: string; isM3U8: boolean; lang: "LAT" | "SUB"; referer?: string }>;
  slug: string;
  headers?: Record<string, string>;
}

/**
 * Find anime on JKAnime using all provided title variants (English, Romaji, etc.)
 * and return streaming sources.
 */
export async function getJkAnimeWatch(
  animeTitle: string,
  episodeNum: number,
  extraTitles: string[] = [],
): Promise<JkAnimeStreamData> {
  const allTitles = [animeTitle, ...extraTitles].filter(Boolean);
  const cacheKey = animeTitle.toLowerCase().trim();

  // Fast path: cached M3U8
  const cachedM3u8Key = `${cacheKey}:${episodeNum}`;
  const cachedM3u8 = m3u8Cache.get(cachedM3u8Key);
  if (cachedM3u8 && (Date.now() - cachedM3u8.ts) < M3U8_CACHE_TTL) {
    const cachedSlugForReturn = slugCache.get(cacheKey) ?? cacheKey;
    return { sources: cachedM3u8.sources, slug: cachedSlugForReturn, headers: { "Referer": `${BASE}/${cachedSlugForReturn}/${episodeNum}/` } };
  }

  let slug: string | null = null;
  let episodeHtml = "";

  // 1. Check slug cache
  const cachedSlug = slugCache.get(cacheKey);
  const cacheAge = slugCacheTime.get(cacheKey) ?? 0;
  if (cachedSlug && (Date.now() - cacheAge) < SLUG_CACHE_TTL) {
    const html = await trySlug(cachedSlug, episodeNum);
    if (html) { slug = cachedSlug; episodeHtml = html; }
  }

  // 2. Try all slug variants in parallel batches
  if (!slug) {
    const allSlugs: string[] = [];
    const seenSlugs = new Set<string>();
    for (const title of allTitles) {
      for (const s of makeSlugs(title)) {
        if (!seenSlugs.has(s)) { seenSlugs.add(s); allSlugs.push(s); }
      }
    }
    const BATCH = 6;
    for (let i = 0; i < allSlugs.length && !slug; i += BATCH) {
      const batch = allSlugs.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(s => trySlug(s, episodeNum).then(h => h ? { s, h } : null)));
      const hit = results.find(r => r !== null);
      if (hit) {
        slug = hit.s;
        episodeHtml = hit.h!;
        slugCache.set(cacheKey, slug);
        slugCacheTime.set(cacheKey, Date.now());
      }
    }
  }

  // 3. Search JKAnime with all title variants
  if (!slug) {
    const triedSlugs = new Set<string>(allTitles.flatMap(t => makeSlugs(t)));

    // Build all unique search queries
    const allSearchQueries: string[] = [];
    const seenQ = new Set<string>();
    for (const t of allTitles) {
      const queries = [
        t,
        t.split(":")[0].trim(),
        t.split(" ").slice(0, 2).join(" "),
        t.split(" ").slice(0, 3).join(" "),
        // Also try just the first word if it's long enough
        ...(t.split(" ")[0].length >= 4 ? [t.split(" ")[0]] : []),
      ];
      for (const q of queries) {
        if (q.length >= 3 && !seenQ.has(q)) { seenQ.add(q); allSearchQueries.push(q); }
      }
    }

    // Fire all search requests in parallel
    const searchResults = await Promise.allSettled(allSearchQueries.map(q => searchJkAnimeSlugs(q)));
    const candidateSlugs: string[] = [];
    const seenCand = new Set<string>();
    for (const r of searchResults) {
      if (r.status === "fulfilled") {
        for (const s of r.value) {
          if (!triedSlugs.has(s) && !seenCand.has(s)) { seenCand.add(s); candidateSlugs.push(s); }
        }
      }
    }

    // Check search results in parallel batches
    const BATCH = 6;
    for (let i = 0; i < candidateSlugs.length && !slug; i += BATCH) {
      const batch = candidateSlugs.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(s => trySlug(s, episodeNum).then(h => h ? { s, h } : null)));
      const hit = results.find(r => r !== null);
      if (hit) {
        slug = hit.s;
        episodeHtml = hit.h!;
        slugCache.set(cacheKey, slug);
        slugCacheTime.set(cacheKey, Date.now());
      }
    }
  }

  if (!slug) throw new Error(`Anime not found on Jkanime: "${animeTitle}" ep ${episodeNum}`);

  const episodePageUrl = `${BASE}/${slug}/${episodeNum}/`;
  const iframeUrls = extractIframeUrls(episodeHtml, episodePageUrl);

  if (iframeUrls.length === 0) {
    throw new Error(`No players found for ${slug} ep ${episodeNum}`);
  }

  const resolveResults = await Promise.allSettled(
    iframeUrls.slice(0, 4).map(async (iframeUrl) => {
      const html = await fetchIframe(iframeUrl, episodePageUrl);
      const m3u8 = extractM3u8(html);
      return m3u8 ? { m3u8, iframeUrl } : null;
    })
  );

  const sources: JkAnimeStreamData["sources"] = [];
  let serverNum = 1;

  for (const result of resolveResults) {
    if (result.status === "fulfilled" && result.value) {
      const { m3u8, iframeUrl } = result.value;
      sources.push({
        url: m3u8,
        quality: `Servidor ${serverNum} (Sub español)`,
        isM3U8: true,
        lang: "SUB",
        referer: iframeUrl,
      });
      serverNum++;
    }
    if (sources.length >= 3) break;
  }

  if (sources.length === 0) {
    throw new Error(`No se pudieron resolver fuentes m3u8 para ${slug} ep ${episodeNum}`);
  }

  m3u8Cache.set(cachedM3u8Key, { sources, ts: Date.now() });

  return {
    sources,
    slug,
    headers: { "Referer": episodePageUrl },
  };
}
