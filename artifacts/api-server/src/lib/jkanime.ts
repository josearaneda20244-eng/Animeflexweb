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

  return [...new Set(variants)];
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const headers: Record<string, string> = { ...HEADERS };
  if (referer) {
    headers["Referer"] = referer;
    headers["Sec-Fetch-Site"] = "same-origin";
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Jkanime HTTP ${res.status}: ${url}`);
  return res.text();
}

async function resolveJkplayer(iframeUrl: string, referer: string): Promise<string | null> {
  try {
    const html = await fetchHtml(iframeUrl, referer);
    const m3u8 = html.match(/["'](https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*?)["']/);
    return m3u8?.[1] ?? null;
  } catch {
    return null;
  }
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

  for (const candidate of slugVariants) {
    try {
      const url = `${BASE}/${candidate}/${episodeNum}/`;
      const html = await fetchHtml(url, BASE);
      if (html.length > 10000) {
        slug = candidate;
        episodeHtml = html;
        break;
      }
    } catch { /* try next variant */ }
  }

  if (!slug) throw new Error(`Anime not found on Jkanime: "${animeTitle}" ep ${episodeNum}`);

  const iframeUrls: string[] = [];
  const iframeRe = /src="(https:\/\/jkanime\.net\/jkplayer\/(?:um|umv|jk)[^"]*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = iframeRe.exec(episodeHtml)) !== null) {
    if (!m[1].includes("'+val.")) iframeUrls.push(m[1]);
  }

  if (iframeUrls.length === 0) {
    throw new Error(`No players found for ${slug} ep ${episodeNum}`);
  }

  const referer = `${BASE}/${slug}/${episodeNum}/`;
  const sources: JkAnimeStreamData["sources"] = [];
  let serverNum = 1;

  for (const url of iframeUrls.slice(0, 6)) {
    const m3u8 = await resolveJkplayer(url, referer);
    if (m3u8) {
      sources.push({
        url: m3u8,
        quality: `Servidor ${serverNum} (Sub Español)`,
        isM3U8: true,
        lang: "SUB",
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
