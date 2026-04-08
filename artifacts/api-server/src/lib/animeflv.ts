const ANIMEFLV_BASE = "https://www3.animeflv.net";

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const headers: Record<string, string> = { ...FETCH_HEADERS };
  if (referer) headers["Referer"] = referer;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`AnimeFLV HTTP ${res.status}: ${url}`);
  return res.text();
}

export interface AnimeFLVResult {
  slug: string;
  title: string;
  image: string;
}

export interface AnimeFLVSource {
  server: string;
  url: string;
  lang: "SUB" | "LAT";
}

export interface AnimeFLVStreamData {
  sources: Array<{ url: string; quality: string; isM3U8: boolean; lang: "LAT" | "SUB" }>;
  slug: string;
}

export async function searchAnimeFLV(query: string): Promise<AnimeFLVResult[]> {
  const url = `${ANIMEFLV_BASE}/browse?q=${encodeURIComponent(query)}`;
  const html = await fetchHtml(url);
  const results: AnimeFLVResult[] = [];

  const articleRegex = /<article[^>]*class="[^"]*Anime[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = articleRegex.exec(html)) !== null) {
    const article = m[1];
    const hrefMatch = article.match(/href="\/anime\/([^"]+)"/);
    const slug = hrefMatch?.[1];
    const titleMatch =
      article.match(/class="Title"[^>]*>\s*([^<]+)\s*</) ??
      article.match(/<h3[^>]*>([^<]+)<\/h3>/);
    const title = titleMatch?.[1]?.trim();
    const imgMatch =
      article.match(/(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ??
      article.match(/src="([^"]+)"\s*alt/i);
    let image = imgMatch?.[1] ?? "";
    if (image && !image.startsWith("http")) image = ANIMEFLV_BASE + image;
    if (slug && title) results.push({ slug, title, image });
  }
  return results;
}

export async function getAnimeFLVEpisodeSources(slug: string, episodeNum: number): Promise<AnimeFLVSource[]> {
  const url = `${ANIMEFLV_BASE}/ver/${slug}-${episodeNum}`;
  const html = await fetchHtml(url, ANIMEFLV_BASE);

  const videosMatch =
    html.match(/var\s+videos\s*=\s*(\{[\s\S]*?\})\s*;/) ??
    html.match(/var\s+videos\s*=\s*(\[[\s\S]*?\])\s*;/);

  if (!videosMatch) throw new Error(`No video sources found for ${slug}-${episodeNum}`);

  const sources: AnimeFLVSource[] = [];
  const parsed = JSON.parse(videosMatch[1]) as Record<
    string,
    Array<{ server?: string; url?: string; code?: string; title?: string }>
  >;

  for (const [lang, list] of Object.entries(parsed)) {
    if (!Array.isArray(list)) continue;
    const langKey: "LAT" | "SUB" = lang.toUpperCase() === "LAT" ? "LAT" : "SUB";
    for (const item of list) {
      const srcUrl = item.url ?? item.code ?? "";
      const server = item.server ?? item.title ?? "Unknown";
      if (srcUrl) sources.push({ server, url: srcUrl, lang: langKey });
    }
  }
  return sources;
}

async function tryResolveM3U8(embedUrl: string, referer?: string): Promise<string | null> {
  try {
    const html = await fetchHtml(embedUrl, referer ?? ANIMEFLV_BASE);
    const patterns = [
      /["']file["']\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i,
      /sources\s*:\s*\[[\s\S]*?["']([^"']+\.m3u8[^"']*)["']/i,
      /source\s+src=["']([^"']+\.m3u8[^"']*)["']/i,
      /"hls"\s*:\s*"([^"]+)"/i,
      /var\s+url\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i,
    ];
    for (const pattern of patterns) {
      const found = html.match(pattern);
      if (found?.[1]) return found[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function resolveAnimeFLVSource(source: AnimeFLVSource): Promise<string | null> {
  const sl = source.server.toLowerCase();
  const ul = source.url.toLowerCase();
  if (
    sl.includes("yourupload") || sl.includes("your upload") || ul.includes("yourupload")
  ) return tryResolveM3U8(source.url);
  if (sl.includes("filemoon") || sl.includes("moon") || ul.includes("filemoon")) return tryResolveM3U8(source.url);
  if (sl.includes("fembed") || ul.includes("fembed")) return tryResolveM3U8(source.url);
  if (sl.includes("streamsb") || sl.includes("sbplay") || ul.includes("sbplay") || ul.includes("streamsb")) return tryResolveM3U8(source.url);
  if (sl.includes("doodstream") || sl.includes("dood") || ul.includes("dood")) return tryResolveM3U8(source.url);
  return tryResolveM3U8(source.url);
}

function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const wa = a.split(/\s+/);
  const wb = b.split(/\s+/);
  const common = wa.filter(w => wb.includes(w)).length;
  return common / Math.max(wa.length, wb.length);
}

function makeTitleVariants(title: string): string[] {
  const variants: string[] = [title];
  const noParens = title.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (noParens !== title) variants.push(noParens);
  const noPart = title.replace(/[\s:,\-–]+Part\s+\d+\s*$/i, "").trim();
  if (noPart !== title) variants.push(noPart);
  const noSeason = title.replace(/[\s:,\-–]+(Season\s+\d+|\d+(st|nd|rd|th)\s+Season)\s*$/i, "").trim();
  if (noSeason !== title) variants.push(noSeason);
  const firstWords = title.split(" ").slice(0, 3).join(" ");
  if (!variants.includes(firstWords) && firstWords.length > 4) variants.push(firstWords);
  return [...new Set(variants)];
}

export async function getAnimeFLVWatch(
  animeTitle: string,
  episodeNum: number,
): Promise<AnimeFLVStreamData> {
  const variants = makeTitleVariants(animeTitle);
  let slug: string | null = null;

  for (const variant of variants) {
    try {
      const results = await searchAnimeFLV(variant);
      if (results.length === 0) continue;
      const scored = results
        .map(r => ({ ...r, score: titleSimilarity(r.title.toLowerCase(), variant.toLowerCase()) }))
        .sort((a, b) => b.score - a.score);
      slug = scored[0].slug;
      break;
    } catch { /* try next variant */ }
  }

  if (!slug) throw new Error(`Anime not found on AnimeFLV: "${animeTitle}"`);

  const rawSources = await getAnimeFLVEpisodeSources(slug, episodeNum);
  if (rawSources.length === 0) throw new Error(`No sources for ${slug} ep ${episodeNum}`);

  const sorted = [...rawSources].sort((a, b) => {
    if (a.lang === "LAT" && b.lang !== "LAT") return -1;
    if (b.lang === "LAT" && a.lang !== "LAT") return 1;
    return 0;
  });

  const resolved: AnimeFLVStreamData["sources"] = [];
  for (const source of sorted) {
    const directUrl = await resolveAnimeFLVSource(source);
    if (directUrl) {
      resolved.push({
        url: directUrl,
        quality: `${source.server} (${source.lang === "LAT" ? "Latino" : "Sub"})`,
        isM3U8: true,
        lang: source.lang,
      });
    } else {
      resolved.push({
        url: source.url,
        quality: `${source.server} (${source.lang === "LAT" ? "Latino" : "Sub"}) [embed]`,
        isM3U8: false,
        lang: source.lang,
      });
    }
  }

  return { sources: resolved, slug };
}
