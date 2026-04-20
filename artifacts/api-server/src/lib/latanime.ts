const BASE = "https://latanime.org";

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

async function fetchPage(url: string, referer?: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { ...PAGE_HEADERS };
    if (referer) {
      headers["Referer"] = referer;
      try { headers["Origin"] = new URL(referer).origin; } catch {}
    }
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

/**
 * Attempt to decode a basic Dean Edwards packer.
 * Returns the original string if not packed.
 */
function tryUnpackPacker(js: string): string {
  const packerRe = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*[dr]/;
  if (!packerRe.test(js)) return js;
  try {
    const inner = js.match(/\)\s*\(\s*'([\s\S]+?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]+?)'\s*\.split/);
    if (!inner) return js;
    const [, p, radixStr, , kRaw] = inner;
    const radix = parseInt(radixStr, 10);
    const k = kRaw.split("|");
    const toBase = (n: number, r: number) => n.toString(r);
    let result = p;
    for (let i = k.length - 1; i >= 0; i--) {
      if (k[i]) {
        result = result.replace(new RegExp("\\b" + toBase(i, radix) + "\\b", "g"), k[i]);
      }
    }
    return result;
  } catch {
    return js;
  }
}

/**
 * Scan for base64 strings that decode to video URLs.
 */
function extractBase64VideoUrls(html: string): string[] {
  const found: string[] = [];
  const atobRe = /atob\s*\(\s*["'`]([A-Za-z0-9+/]{20,}={0,2})["'`]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = atobRe.exec(html)) !== null) {
    try {
      const decoded = Buffer.from(m[1], "base64").toString("utf8");
      const urlMatch = decoded.match(/https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*/i);
      if (urlMatch && !SKIP_URL_PATTERNS.test(urlMatch[0])) {
        found.push(urlMatch[0]);
      }
    } catch {}
  }
  return found;
}

/**
 * Extract a playable stream URL (m3u8 or mp4) from an embed player's HTML.
 * Tries multiple strategies in order of reliability.
 */
function extractStreamUrl(html: string): string | null {
  const unpacked = tryUnpackPacker(html);
  const sources = [html, unpacked];

  for (const src of sources) {
    // Strategy 1: JWPlayer setup — sources array with file property
    const jwMatch = src.match(/sources\s*:\s*\[\s*\{[^{}]{0,200}["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i)
      ?? src.match(/["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
    if (jwMatch?.[1] && !SKIP_URL_PATTERNS.test(jwMatch[1])) return jwMatch[1];

    // Strategy 2: Named variable assignments — m3u8 priority
    const namedM3u8 = src.match(/(?:url|file|source|src|hlsUrl|streamUrl|videoUrl|hls_url|hls)\s*[=:]\s*["'`](https?:\/\/[^"'`\s<>]+\.m3u8[^"'`\s<>]*)["'`]/i);
    if (namedM3u8?.[1] && !SKIP_URL_PATTERNS.test(namedM3u8[1])) return namedM3u8[1];

    // Strategy 3: loadSource / playlistItem / setup with m3u8
    const loadMatch = src.match(/(?:loadSource|playlistItem|setup)\s*\(\s*["'`]?(https?:\/\/[^"'`\s<>]+\.m3u8[^"'`\s<>]*)["'`]?/i);
    if (loadMatch?.[1] && !SKIP_URL_PATTERNS.test(loadMatch[1])) return loadMatch[1];

    // Strategy 4: Any quoted m3u8 URL
    const anyM3u8 = src.match(/["'`](https?:\/\/[^"'`\s<>]+\.m3u8[^"'`\s<>]*)["'`]/);
    if (anyM3u8?.[1] && !SKIP_URL_PATTERNS.test(anyM3u8[1])) return anyM3u8[1];

    // Strategy 5: JWPlayer mp4
    const jwMp4 = src.match(/["']file["']\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
    if (jwMp4?.[1] && !SKIP_URL_PATTERNS.test(jwMp4[1])) return jwMp4[1];

    // Strategy 6: Named variable assignments — mp4
    const namedMp4 = src.match(/(?:url|file|source|src|videoUrl|streamUrl)\s*[=:]\s*["'`](https?:\/\/[^"'`\s<>]+\.mp4[^"'`\s<>]*)["'`]/i);
    if (namedMp4?.[1] && !SKIP_URL_PATTERNS.test(namedMp4[1])) return namedMp4[1];

    // Strategy 7: Any quoted mp4 URL
    const anyMp4 = src.match(/["'`](https?:\/\/[^"'`\s<>]+\.mp4[^"'`\s<>]*)["'`]/);
    if (anyMp4?.[1] && !SKIP_URL_PATTERNS.test(anyMp4[1])) return anyMp4[1];
  }

  // Strategy 8: base64 atob() decoded URLs
  const b64Urls = extractBase64VideoUrls(html);
  if (b64Urls.length > 0) return b64Urls[0];

  return null;
}

function isM3U8(url: string): boolean {
  return url.includes(".m3u8");
}

/**
 * Search latanime.org for the "-latino" slug of an anime by title.
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
 * Only returns direct m3u8/mp4 sources — no embed fallback to avoid blank players.
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
      episodeHtml = await fetchPage(url, `${BASE}/`);
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
      episodeHtml = await fetchPage(url, `${BASE}/`);
    } catch {
      throw new Error(`Episode ${episodeNum} not found on Latanime for "${animeTitle}" (slug: ${slug})`);
    }

    if (!episodeHtml.includes("data-player")) {
      throw new Error(`Episode ${episodeNum} not found on Latanime for "${animeTitle}" (slug: ${slug})`);
    }

    slugCache.set(cacheKey, slug);
    slugCacheTime.set(cacheKey, Date.now());
  }

  const episodePageUrl = `${BASE}/ver/${slug}-episodio-${episodeNum}`;

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

  // Try to extract direct stream URLs from each embed player page
  const resolveResults = await Promise.allSettled(
    embedUrls.slice(0, 6).map(async (embedUrl, idx): Promise<{ url: string; isM3U8: boolean; embedUrl: string } | null> => {
      try {
        const html = await fetchPage(embedUrl, episodePageUrl, 9000);

        // Try direct extraction from the fetched HTML
        const streamUrl = extractStreamUrl(html);
        if (streamUrl && !SKIP_URL_PATTERNS.test(streamUrl)) {
          return { url: streamUrl, isM3U8: isM3U8(streamUrl), embedUrl };
        }

        // If the page itself is/was an m3u8 playlist
        const ct = "";
        if (html.trimStart().startsWith("#EXTM3U")) {
          return { url: embedUrl, isM3U8: true, embedUrl };
        }

        // Try following any iframe src within the embed page (one level deeper)
        const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
        if (iframeMatch?.[1]) {
          const iframeUrl = iframeMatch[1].startsWith("http")
            ? iframeMatch[1]
            : (() => { try { return new URL(iframeMatch[1], embedUrl).href; } catch { return null; } })();
          if (iframeUrl) {
            try {
              const iframeHtml = await fetchPage(iframeUrl, embedUrl, 7000);
              const iframeStream = extractStreamUrl(iframeHtml);
              if (iframeStream && !SKIP_URL_PATTERNS.test(iframeStream)) {
                return { url: iframeStream, isM3U8: isM3U8(iframeStream), embedUrl: iframeUrl };
              }
            } catch {}
          }
        }
      } catch {}
      return null;
    })
  );

  const sources: LatanimeStreamData["sources"] = [];
  let serverNum = 1;

  for (const result of resolveResults) {
    if (result.status === "fulfilled" && result.value) {
      const item = result.value;
      sources.push({
        url: item.url,
        quality: `Reproductor ${serverNum}`,
        isM3U8: item.isM3U8,
        isEmbed: false,
        lang: "LAT",
        referer: item.embedUrl,
      });
      serverNum++;
    }
    if (sources.length >= 4) break;
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
