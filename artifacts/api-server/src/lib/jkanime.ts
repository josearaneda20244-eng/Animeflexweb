const BASE = "https://jkanime.net";

const slugCache = new Map<string, string>();
const SLUG_CACHE_TTL = 1000 * 60 * 60 * 2;
const slugCacheTime = new Map<string, number>();

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

  // Season number suffix variants (e.g. "2", "ii", "2nd-season" → just base)
  const noTrailingNum = title.replace(/\s+\d+\s*$/, "").trim();
  if (noTrailingNum !== title && !variants.includes(slugify(noTrailingNum)))
    variants.push(slugify(noTrailingNum));

  const firstWords = title.split(" ").slice(0, 3).join(" ");
  const firstSlug = slugify(firstWords);
  if (!variants.includes(firstSlug) && firstWords.length > 3) {
    variants.push(firstSlug);
  }

  const firstWord = title.split(/[\s:]/)[0].trim();
  const firstWordSlug = slugify(firstWord);
  if (firstWordSlug.length >= 4 && !variants.includes(firstWordSlug)) {
    variants.push(firstWordSlug);
  }

  return [...new Set(variants)];
}

async function fetchPage(url: string, timeoutMs = 4000): Promise<string> {
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

async function fetchIframe(url: string, referer: string, timeoutMs = 6000): Promise<string> {
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
 * Search JKAnime and return ALL candidate slugs found (not just first).
 */
async function searchJkAnimeSlugs(query: string): Promise<string[]> {
  try {
    const url = `${BASE}/search/anime/?q=${encodeURIComponent(query)}`;
    const html = await fetchPage(url);
    const re = /href="\/([a-z0-9][a-z0-9-]+)\/" title=/g;
    const slugs: string[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const candidate = m[1];
      if (!["search", "api", "cdn", "assets", "static"].includes(candidate) && !seen.has(candidate)) {
        seen.add(candidate);
        slugs.push(candidate);
      }
    }
    return slugs;
  } catch {
    return [];
  }
}

function extractM3u8(html: string): string | null {
  const p1 = html.match(/(?:url|file|source|src)\s*:\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/);
  if (p1?.[1]) return p1[1];
  const p2 = html.match(/loadSource\s*\(\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/);
  if (p2?.[1]) return p2[1];
  const p3 = html.match(/['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/);
  if (p3?.[1]) return p3[1];
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

  const re1 = /src="(https?:\/\/jkanime\.net\/jkplayer\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) addUrl(m[1]);
  const re2 = /src='(https?:\/\/jkanime\.net\/jkplayer\/[^']+)'/g;
  while ((m = re2.exec(html)) !== null) addUrl(m[1]);
  const re3 = /data-src=["'](https?:\/\/jkanime\.net\/jkplayer\/[^"']+)["']/g;
  while ((m = re3.exec(html)) !== null) addUrl(m[1]);

  return urls;
}

async function trySlug(slug: string, episodeNum: number): Promise<string | null> {
  try {
    const url = `${BASE}/${slug}/${episodeNum}/`;
    const html = await fetchPage(url);
    if (html.length > 5000 && !html.toLowerCase().includes("404") && html.includes("jkplayer")) {
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

  let slug: string | null = null;
  let episodeHtml = "";

  // 1. Check slug cache first
  const cachedSlug = slugCache.get(cacheKey);
  const cacheAge = slugCacheTime.get(cacheKey) ?? 0;
  if (cachedSlug && (Date.now() - cacheAge) < SLUG_CACHE_TTL) {
    const html = await trySlug(cachedSlug, episodeNum);
    if (html) { slug = cachedSlug; episodeHtml = html; }
  }

  // 2. Try all slug variants in parallel batches (much faster than sequential)
  if (!slug) {
    const allSlugs: string[] = [];
    const seenSlugs = new Set<string>();
    for (const title of allTitles) {
      for (const s of makeSlugs(title)) {
        if (!seenSlugs.has(s)) { seenSlugs.add(s); allSlugs.push(s); }
      }
    }
    const BATCH = 4;
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

  // 3. Search JKAnime — run all search queries in parallel, then check returned slugs
  if (!slug) {
    const triedSlugs = new Set<string>(allTitles.flatMap(t => makeSlugs(t)));

    // Build all unique search queries from all title variants
    const allSearchQueries: string[] = [];
    const seenQ = new Set<string>();
    for (const t of allTitles) {
      for (const q of [t, t.split(":")[0].trim(), t.split(" ").slice(0, 2).join(" ")]) {
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

    // Check each found slug in parallel batches
    const BATCH = 4;
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

  return {
    sources,
    slug,
    headers: { "Referer": episodePageUrl },
  };
}
