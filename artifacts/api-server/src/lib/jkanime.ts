const BASE = "https://jkanime.net";

const HEADERS: Record<string, string> = {
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

function makeSlugs(title: string): string[] {
  const variants: string[] = [slugify(title)];

  const noSeason = title.replace(/\s*:?\s*Season\s+\d+\s*$/i, "").trim();
  if (noSeason !== title) variants.push(slugify(noSeason));

  const noPart = title.replace(/\s*:?\s*Part\s+\d+\s*$/i, "").trim();
  if (noPart !== title) variants.push(slugify(noPart));

  const noYear = title.replace(/\s*\(\d{4}\)\s*$/g, "").trim();
  if (noYear !== title) variants.push(slugify(noYear));

  const noColon = title.split(":")[0].trim();
  if (noColon !== title) variants.push(slugify(noColon));

  // Short first word(s) fallback
  const firstWords = title.split(" ").slice(0, 3).join(" ");
  if (!variants.includes(slugify(firstWords)) && firstWords.length > 3) {
    variants.push(slugify(firstWords));
  }

  return [...new Set(variants)];
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const headers: Record<string, string> = { ...HEADERS };
  if (referer) {
    headers["Referer"] = referer;
    headers["Sec-Fetch-Site"] = "same-origin";
  }
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) throw new Error(`Jkanime HTTP ${res.status}: ${url}`);
  return res.text();
}

/**
 * Search JKAnime to find the correct anime slug by title.
 * Returns the slug from the first search result.
 */
async function searchJkAnimeSlug(title: string): Promise<string | null> {
  try {
    const url = `${BASE}/search/anime/?q=${encodeURIComponent(title)}`;
    const html = await fetchHtml(url, BASE);
    // Match href="/anime-slug/" links in search results
    const m = html.match(/href="\/([a-z0-9][a-z0-9-]+)\/"\s+title=/);
    if (m?.[1]) return m[1];
    // Alternative pattern
    const m2 = html.match(/class="[^"]*title[^"]*"[^>]*>[\s\S]*?href="\/([a-z0-9][a-z0-9-]+)\//);
    if (m2?.[1]) return m2[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve a JKAnime player iframe to an m3u8 URL.
 * Looks in HTML body, script tags, and JSON data attributes.
 */
async function resolveJkplayer(iframeUrl: string, referer: string): Promise<string | null> {
  try {
    const html = await fetchHtml(iframeUrl, referer);

    // 1. Direct m3u8 URL in HTML
    const m3u8Direct = html.match(/["'`](https?:\/\/[^\s"'`<>]+\.m3u8[^\s"'`<>]*?)["'`]/);
    if (m3u8Direct?.[1]) return m3u8Direct[1];

    // 2. Look in script tags for file/src/source fields
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
    for (const sm of scriptMatches) {
      const scriptContent = sm[1];
      // "file":"URL" or 'file':'URL' patterns (NinoCloud, JWPlayer, etc.)
      const fileMatch = scriptContent.match(/["'](?:file|src|source)["']\s*:\s*["'](https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*?)["']/);
      if (fileMatch?.[1]) return fileMatch[1];
      // Array of sources like [{file:"..."}]
      const arrMatch = scriptContent.match(/["']file["']\s*:\s*["'](https?:\/\/[^\s"'<>]+)["']/);
      if (arrMatch?.[1] && (arrMatch[1].includes(".m3u8") || arrMatch[1].includes("stream"))) return arrMatch[1];
    }

    // 3. Look for blob of video URL in data attributes
    const dataMatch = html.match(/data-(?:file|src|stream)=["'](https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*?)["']/);
    if (dataMatch?.[1]) return dataMatch[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract all player iframe URLs from an episode page HTML.
 * Broadened to catch all known JKAnime player patterns.
 */
function extractIframeUrls(html: string): string[] {
  const urls: string[] = [];

  // Pattern 1: jkplayer iframes (um, umv, jk, etc.)
  const re1 = /src=["'](https?:\/\/jkanime\.net\/jkplayer\/[^"'<>\s]+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) {
    if (!m[1].includes("'+val.") && !m[1].includes("undefined")) urls.push(m[1]);
  }

  // Pattern 2: Any iframe on the page pointing to a known video host
  const re2 = /src=["'](https?:\/\/(?:www\.)?(?:streamtape|doodstream|filemoon|ninocloud|ok\.ru|mp4upload|jkanime\.net\/jkplayer)[^"'<>\s]+)["']/g;
  while ((m = re2.exec(html)) !== null) {
    if (!urls.includes(m[1]) && !m[1].includes("undefined")) urls.push(m[1]);
  }

  // Pattern 3: server variable assignments like servers[0] = "URL"
  const re3 = /(?:servers|sources|players)\s*\[?\d*\]?\s*=\s*["'](https?:\/\/[^"'<>\s]+)["']/g;
  while ((m = re3.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }

  return urls;
}

export interface JkAnimeStreamData {
  sources: Array<{ url: string; quality: string; isM3U8: boolean; lang: "LAT" | "SUB" }>;
  slug: string;
}

export async function getJkAnimeWatch(
  animeTitle: string,
  episodeNum: number,
): Promise<JkAnimeStreamData> {
  const slugVariants = makeSlugs(animeTitle);
  let slug: string | null = null;
  let episodeHtml = "";

  // Try each slug variant directly
  for (const candidate of slugVariants) {
    try {
      const url = `${BASE}/${candidate}/${episodeNum}/`;
      const html = await fetchHtml(url, BASE);
      if (html.length > 5000 && !html.includes("404") && !html.includes("no encontrado")) {
        slug = candidate;
        episodeHtml = html;
        break;
      }
    } catch { /* try next variant */ }
  }

  // If direct slug failed, try JKAnime search
  if (!slug) {
    const searchSlug = await searchJkAnimeSlug(animeTitle);
    if (searchSlug) {
      try {
        const url = `${BASE}/${searchSlug}/${episodeNum}/`;
        const html = await fetchHtml(url, BASE);
        if (html.length > 5000) {
          slug = searchSlug;
          episodeHtml = html;
        }
      } catch { /* search also failed */ }
    }
  }

  if (!slug) throw new Error(`Anime not found on Jkanime: "${animeTitle}" ep ${episodeNum}`);

  const iframeUrls = extractIframeUrls(episodeHtml);

  // Also look for m3u8 directly in the episode page itself (some pages embed it)
  const directM3u8 = episodeHtml.match(/["'`](https?:\/\/[^\s"'`<>]+\.m3u8[^\s"'`<>]*?)["'`]/);
  if (directM3u8?.[1]) {
    return {
      sources: [{
        url: directM3u8[1],
        quality: "Servidor 1 (Latino)",
        isM3U8: true,
        lang: "LAT",
      }],
      slug,
    };
  }

  if (iframeUrls.length === 0) {
    throw new Error(`No players found for ${slug} ep ${episodeNum}`);
  }

  const referer = `${BASE}/${slug}/${episodeNum}/`;
  const sources: JkAnimeStreamData["sources"] = [];
  let serverNum = 1;

  // Resolve each iframe in parallel (up to 4 at a time)
  const resolveResults = await Promise.allSettled(
    iframeUrls.slice(0, 4).map(url => resolveJkplayer(url, referer))
  );

  for (const result of resolveResults) {
    if (result.status === "fulfilled" && result.value) {
      sources.push({
        url: result.value,
        quality: `Servidor ${serverNum} (Latino)`,
        isM3U8: true,
        lang: "LAT",
      });
      serverNum++;
    }
    if (sources.length >= 3) break;
  }

  if (sources.length === 0) {
    throw new Error(`No se pudieron resolver fuentes para ${slug} ep ${episodeNum}`);
  }

  return { sources, slug };
}
