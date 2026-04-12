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

function extractStreamUrl(html: string): string | null {
  // mp4upload direct MP4
  const mp4 = html.match(/src\s*:\s*['"`](https?:\/\/[^'"`\s<>]+\.mp4[^'"`\s<>]*)['"`]/);
  if (mp4?.[1]) return mp4[1];

  // Generic m3u8
  const m3u8Patterns = [
    /(?:url|file|source|src)\s*:\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
    /loadSource\s*\(\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
    /['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
  ];
  for (const re of m3u8Patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
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
async function searchLatanimeSlug(title: string): Promise<string | null> {
  try {
    const searchUrl = `${BASE}/buscar?q=${encodeURIComponent(title)}`;
    const html = await fetchPage(searchUrl);

    // Extract all hrefs ending in -latino
    const re = /href="https?:\/\/latanime\.org\/anime\/([a-z0-9][a-z0-9-]+-latino)"/g;
    const candidates: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (!candidates.includes(m[1])) candidates.push(m[1]);
    }

    if (candidates.length === 0) return null;

    const titleSlug = slugify(title);
    const titleWords = titleSlug.split("-").filter(w => w.length > 0);

    // Priority 1: exact match (base slug === titleSlug)
    for (const c of candidates) {
      if (c.replace(/-latino$/, "") === titleSlug) return c;
    }

    // Priority 2: score by match quality
    // score = (matching title words * 10) - (extra base words * 5) - (base length * 0.1)
    // This strongly penalizes slugs with extra words (films, specials, etc.)
    let best = candidates[0];
    let bestScore = -Infinity;

    for (const c of candidates) {
      const base = c.replace(/-latino$/, "");
      const baseWords = base.split("-").filter(w => w.length > 0);
      const matchCount = titleWords.filter(w => baseWords.includes(w)).length;
      const extraWords = Math.max(0, baseWords.length - titleWords.length);
      const score = matchCount * 10 - extraWords * 5 - base.length * 0.1;
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
  }[];
  slug: string;
  headers?: Record<string, string>;
}

/**
 * Get streaming sources for an anime episode from latanime.org (Latino dub).
 */
export async function getLatanimeStream(animeTitle: string, episodeNum: number): Promise<LatanimeStreamData> {
  const cacheKey = animeTitle.toLowerCase().trim();

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
    slug = await searchLatanimeSlug(animeTitle);
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

  // Try each embed URL to extract a streamable URL (mp4 or m3u8)
  const episodePageUrl = `${BASE}/ver/${slug}-episodio-${episodeNum}`;
  const resolveResults = await Promise.allSettled(
    embedUrls.slice(0, 5).map(async (embedUrl) => {
      const html = await fetchPage(embedUrl, episodePageUrl, 7000);
      const streamUrl = extractStreamUrl(html);
      return streamUrl ? { streamUrl, embedUrl } : null;
    })
  );

  const sources: LatanimeStreamData["sources"] = [];
  let serverNum = 1;

  for (const result of resolveResults) {
    if (result.status === "fulfilled" && result.value) {
      const { streamUrl, embedUrl } = result.value;
      sources.push({
        url: streamUrl,
        quality: `Servidor ${serverNum} (Latino)`,
        isM3U8: isM3U8(streamUrl),
        lang: "LAT",
        referer: embedUrl,
      });
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
