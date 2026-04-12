const BASE = "https://jkanime.net";

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

  const noPart = title.replace(/\s*:?\s*Part\s+\d+\s*$/i, "").trim();
  if (noPart !== title) variants.push(slugify(noPart));

  const noYear = title.replace(/\s*\(\d{4}\)\s*$/g, "").trim();
  if (noYear !== title) variants.push(slugify(noYear));

  const noColon = title.split(":")[0].trim();
  if (noColon !== title) variants.push(slugify(noColon));

  const firstWords = title.split(" ").slice(0, 3).join(" ");
  const firstSlug = slugify(firstWords);
  if (!variants.includes(firstSlug) && firstWords.length > 3) {
    variants.push(firstSlug);
  }

  return [...new Set(variants)];
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: PAGE_HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`JKAnime page HTTP ${res.status}: ${url}`);
  return res.text();
}

async function fetchIframe(url: string, referer: string): Promise<string> {
  const headers = { ...IFRAME_HEADERS, "Referer": referer };
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok) throw new Error(`JKAnime iframe HTTP ${res.status}: ${url}`);
  return res.text();
}

/**
 * Search JKAnime to find the correct anime slug by title.
 */
async function searchJkAnimeSlug(title: string): Promise<string | null> {
  try {
    const url = `${BASE}/search/anime/?q=${encodeURIComponent(title)}`;
    const html = await fetchPage(url);
    // Match anime card links: href="/slug/"
    const re = /href="\/([a-z0-9][a-z0-9-]+)\/" title=/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const candidate = m[1];
      // Skip known non-anime paths
      if (!["search", "api", "cdn", "assets", "static"].includes(candidate)) {
        return candidate;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract all m3u8 URLs from a player iframe page.
 */
function extractM3u8(html: string): string | null {
  // Pattern 1: url: '...m3u8...' or url: "...m3u8..."
  const p1 = html.match(/(?:url|file|source|src)\s*:\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/);
  if (p1?.[1]) return p1[1];

  // Pattern 2: hls.loadSource('...m3u8...') or loadSource("...m3u8...")
  const p2 = html.match(/loadSource\s*\(\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/);
  if (p2?.[1]) return p2[1];

  // Pattern 3: Any quoted m3u8 URL in the page
  const p3 = html.match(/['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/);
  if (p3?.[1]) return p3[1];

  return null;
}

/**
 * Extract all player iframe URLs from an episode page HTML.
 */
function extractIframeUrls(html: string, episodePageUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (u: string) => {
    if (!seen.has(u) && !u.includes("'+val.") && !u.includes("undefined")) {
      seen.add(u);
      urls.push(u);
    }
  };

  // Pattern 1: Standard jkplayer iframes (um, umv, jk, c1, etc.) with double quotes
  const re1 = /src="(https?:\/\/jkanime\.net\/jkplayer\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) addUrl(m[1]);

  // Pattern 2: Single quotes
  const re2 = /src='(https?:\/\/jkanime\.net\/jkplayer\/[^']+)'/g;
  while ((m = re2.exec(html)) !== null) addUrl(m[1]);

  // Pattern 3: data-src attributes
  const re3 = /data-src=["'](https?:\/\/jkanime\.net\/jkplayer\/[^"']+)["']/g;
  while ((m = re3.exec(html)) !== null) addUrl(m[1]);

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
      const html = await fetchPage(url);
      if (html.length > 5000 && !html.toLowerCase().includes("404") && html.includes("jkplayer")) {
        slug = candidate;
        episodeHtml = html;
        break;
      }
    } catch { /* try next variant */ }
  }

  // If direct slug failed, try JKAnime search
  if (!slug) {
    const searchSlug = await searchJkAnimeSlug(animeTitle);
    if (searchSlug && !slugVariants.includes(searchSlug)) {
      try {
        const url = `${BASE}/${searchSlug}/${episodeNum}/`;
        const html = await fetchPage(url);
        if (html.length > 5000 && html.includes("jkplayer")) {
          slug = searchSlug;
          episodeHtml = html;
        }
      } catch { /* search also failed */ }
    }
  }

  if (!slug) throw new Error(`Anime not found on Jkanime: "${animeTitle}" ep ${episodeNum}`);

  const episodePageUrl = `${BASE}/${slug}/${episodeNum}/`;
  const iframeUrls = extractIframeUrls(episodeHtml, episodePageUrl);

  if (iframeUrls.length === 0) {
    throw new Error(`No players found for ${slug} ep ${episodeNum}`);
  }

  // Resolve each iframe in parallel
  const resolveResults = await Promise.allSettled(
    iframeUrls.slice(0, 4).map(async (iframeUrl) => {
      const html = await fetchIframe(iframeUrl, episodePageUrl);
      return extractM3u8(html);
    })
  );

  const sources: JkAnimeStreamData["sources"] = [];
  let serverNum = 1;

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
    throw new Error(`No se pudieron resolver fuentes m3u8 para ${slug} ep ${episodeNum}`);
  }

  return { sources, slug };
}
