const BASE = "https://latanime.org";

const slugCache = new Map<string, string>();
const SLUG_CACHE_TTL = 1000 * 60 * 60 * 2; // 2h
const slugCacheTime = new Map<string, number>();

const PAGE_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
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

async function fetchPage(url: string, referer?: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { ...PAGE_HEADERS };
    if (referer) headers["Referer"] = referer;
    const res = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Latanime HTTP ${res.status}: ${url}`);
    return res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const SKIP_URL_PATTERNS = /thumbnail|poster|banner|preview|\.jpg|\.jpeg|\.png|\.webp|\.gif|\.svg/i;

function extractStreamUrl(html: string): string | null {
  const patterns: RegExp[] = [
    // Named variable assignments: m3u8 first (higher quality)
    /(?:url|file|source|src|hlsUrl|streamUrl|videoUrl|hls_url)\s*[=:]\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/i,
    /loadSource\s*\(\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/i,
    // Any m3u8 URL in quotes
    /['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
    // Named variable assignments: mp4
    /(?:url|file|source|src|videoUrl|streamUrl)\s*[=:]\s*['"`](https?:\/\/[^'"`\s<>]+\.mp4[^'"`\s<>]*)['"`]/i,
    // mp4upload / direct mp4
    /['"`](https?:\/\/[^'"`\s<>]+\.mp4[^'"`\s<>]*)['"`]/,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    const candidate = m?.[1];
    if (candidate && !SKIP_URL_PATTERNS.test(candidate)) return candidate;
  }

  return null;
}

function isM3U8(url: string): boolean {
  return url.includes(".m3u8");
}

/**
 * Search latanime.org for the "-latino" slug of an anime by title.
 * Uses a scoring system that heavily prefers slugs that exactly match the title
 * (fewer extra words = better score), avoiding films/specials with same title prefix.
 */
async function searchLatanimeSlug(titles: string[]): Promise<string | null> {
  const queries = [...new Set(titles.map(t => t.trim()).filter(t => t.length >= 3))];
  const candidates: string[] = [];
  const seenCandidates = new Set<string>();
  const skipSlugs = new Set(["animes", "emision", "calendario", "login", "register"]);

  const addCandidate = (slug: string) => {
    if (!seenCandidates.has(slug) && !skipSlugs.has(slug)) {
      seenCandidates.add(slug);
      candidates.push(slug);
    }
  };

  try {
    for (const query of queries) {
      const searchUrl = `${BASE}/buscar?q=${encodeURIComponent(query)}`;
      const html = await fetchPage(searchUrl);

      const re = /href="https?:\/\/latanime\.org\/anime\/([a-z0-9][a-z0-9-]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) addCandidate(m[1]);
    }

    if (candidates.length === 0) return null;

    const titleSlugs = queries.map(slugify).filter(Boolean);
    const titleWordsList = titleSlugs.map(s => s.split("-").filter(w => w.length > 0));

    for (const titleSlug of titleSlugs) {
      for (const c of candidates) {
        if (c.replace(/-latino$/, "") === titleSlug && c.endsWith("-latino")) return c;
      }
    }

    for (const titleSlug of titleSlugs) {
      for (const c of candidates) {
        if (c === titleSlug) return c;
      }
    }

    let best = candidates[0];
    let bestScore = -Infinity;

    for (const c of candidates) {
      const isLatino = c.endsWith("-latino");
      const isCastellano = c.endsWith("-castellano");
      const base = c.replace(/-(latino|castellano)$/, "");
      const baseWords = base.split("-").filter(w => w.length > 0);
      const bestTitleWords = titleWordsList.reduce((bestWords, words) => {
        const currentMatch = words.filter(w => baseWords.includes(w)).length;
        const bestMatch = bestWords.filter(w => baseWords.includes(w)).length;
        return currentMatch > bestMatch ? words : bestWords;
      }, titleWordsList[0] ?? []);
      const matchCount = bestTitleWords.filter(w => baseWords.includes(w)).length;
      const extraWords = Math.max(0, baseWords.length - bestTitleWords.length);
      const langBonus = isLatino ? 20 : isCastellano ? -10 : 0;
      const score = matchCount * 10 - extraWords * 5 - base.length * 0.1 + langBonus;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    return best;
  } catch {
    return null;
  }
}

export interface LatanimeStreamData {
  sources: {
    url: string;
    quality: string;
    isM3U8: boolean;
    lang: "LAT";
    referer?: string;
    isEmbed?: boolean;
  }[];
  slug: string;
  headers?: Record<string, string>;
}

/**
 * Get streaming sources for an anime episode from latanime.org (Latino dub).
 */
export async function getLatanimeStream(animeTitle: string, episodeNum: number, extraTitles: string[] = []): Promise<LatanimeStreamData> {
  const cacheKey = animeTitle.toLowerCase().trim();
  const titleCandidates = [...new Set([animeTitle, ...extraTitles].map(t => t.trim()).filter(Boolean))];

  // Check slug cache
  let slug: string | null = slugCache.get(cacheKey) ?? null;
  if (slug && Date.now() - (slugCacheTime.get(cacheKey) ?? 0) > SLUG_CACHE_TTL) {
    slug = null;
    slugCache.delete(cacheKey);
  }

  let episodeHtml = "";

  // Try cached slug first
  if (slug) {
    try {
      const url = `${BASE}/ver/${slug}-episodio-${episodeNum}`;
      episodeHtml = await fetchPage(url);
      if (!episodeHtml.includes("data-player")) {
        slug = null;
        episodeHtml = "";
      }
    } catch {
      slug = null;
      episodeHtml = "";
    }
  }

  // If no cached slug or it failed, search for one
  if (!slug) {
    slug = await searchLatanimeSlug(titleCandidates);
    if (!slug) throw new Error(`Anime not found on Latanime: "${animeTitle}"`);

    const url = `${BASE}/ver/${slug}-episodio-${episodeNum}`;
    try {
      episodeHtml = await fetchPage(url);
    } catch {
      throw new Error(`Episode ${episodeNum} not found on Latanime for "${animeTitle}" (slug: ${slug})`);
    }

    if (!episodeHtml.includes("data-player")) {
      throw new Error(`Episode ${episodeNum} not found on Latanime for "${animeTitle}" (slug: ${slug})`);
    }

    slugCache.set(cacheKey, slug);
    slugCacheTime.set(cacheKey, Date.now());
  }

  // Extract base64-encoded player URLs
  const playerRe = /data-player="([A-Za-z0-9+/=]+)"/g;
  const embedUrls: string[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = playerRe.exec(episodeHtml)) !== null) {
    try {
      const decoded = Buffer.from(pm[1], "base64").toString("utf8");
      if (decoded.startsWith("http")) embedUrls.push(decoded);
    } catch { /* skip invalid */ }
  }

  if (embedUrls.length === 0) {
    throw new Error(`No player URLs found on Latanime for "${animeTitle}" ep ${episodeNum}`);
  }

  // Return embed pages directly — the browser will load each embed player in an iframe.
  // This avoids server-side extraction of signed CDN URLs which expire or require cookies.
  const episodePageUrl = `${BASE}/ver/${slug}-episodio-${episodeNum}`;

  // First try to find m3u8 URLs (work best with proxy), fall back to embed iframes
  const resolveResults = await Promise.allSettled(
    embedUrls.slice(0, 5).map(async (embedUrl) => {
      try {
        const html = await fetchPage(embedUrl, episodePageUrl, 7000);
        const streamUrl = extractStreamUrl(html);
        if (streamUrl && isM3U8(streamUrl)) {
          return { type: "m3u8" as const, url: streamUrl, embedUrl };
        }
      } catch { /* ignore */ }
      // Fall back: return the embed page URL itself for iframe loading
      return { type: "embed" as const, url: embedUrl, embedUrl };
    })
  );

  const sources: LatanimeStreamData["sources"] = [];
  let serverNum = 1;

  for (const result of resolveResults) {
    if (result.status === "fulfilled" && result.value) {
      const item = result.value;
      if (item.type === "m3u8") {
        sources.push({
          url: item.url,
          quality: `Servidor ${serverNum} (Latino)`,
          isM3U8: true,
          lang: "LAT",
          referer: item.embedUrl,
        });
      } else {
        sources.push({
          url: item.url,
          quality: `Servidor ${serverNum} (Latino)`,
          isM3U8: false,
          isEmbed: true,
          lang: "LAT",
          referer: episodePageUrl,
        });
      }
      serverNum++;
    }
    if (sources.length >= 3) break;
  }

  if (sources.length === 0) {
    throw new Error(`No stream URLs could be resolved for "${animeTitle}" ep ${episodeNum} on Latanime`);
  }

  return {
    sources,
    slug,
    headers: { "Referer": episodePageUrl },
  };
}
