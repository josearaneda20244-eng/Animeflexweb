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

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
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

function extractSeasonNumber(title: string): number | null {
  const match =
    title.match(/\b(\d+)(?:st|nd|rd|th)?\s+season\b/i) ??
    title.match(/\bseason\s+(\d+)\b/i);
  if (match?.[1]) return parseInt(match[1], 10);

  const wordMatch = title.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season\b/i);
  return wordMatch?.[1] ? ORDINAL_WORDS[wordMatch[1].toLowerCase()] ?? null : null;
}

function hasSpecificSeasonIntent(title: string): boolean {
  return (
    (extractSeasonNumber(title) ?? 1) > 1 ||
    /\b(part|cour)\s+\d+\b/i.test(title) ||
    /\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+year\b/i.test(title) ||
    /:\s*\S.+/.test(title)
  );
}

function makeSlugs(title: string): string[] {
  const variants: string[] = [slugify(title)];
  const specificSeasonIntent = hasSpecificSeasonIntent(title);

  const noPunct = slugify(title.replace(/[!?]/g, "").trim());
  if (noPunct !== variants[0] && !variants.includes(noPunct)) variants.push(noPunct);

  if (specificSeasonIntent) {
    const noYear = title.replace(/\s*\(\d{4}\)\s*$/g, "").trim();
    if (noYear !== title) variants.push(slugify(noYear));
    const noColon = title.split(":")[0].trim();
    if (noColon !== title && hasSpecificSeasonIntent(noColon)) variants.push(slugify(noColon));
    return [...new Set(variants)];
  }

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

  const seasonMatch = title.match(/\s+(\d+)\s*$/);
  if (seasonMatch) {
    const base = title.replace(/\s+\d+\s*$/, "").trim();
    variants.push(`${slugify(base)}-${seasonMatch[1]}`);
  }

  const words = title.split(" ");
  const words3 = words.slice(0, 3).join(" ");
  const words4 = words.slice(0, 4).join(" ");
  if (!variants.includes(slugify(words3)) && words3.length > 3) variants.push(slugify(words3));
  if (!variants.includes(slugify(words4)) && words4.length > 3) variants.push(slugify(words4));

  const firstWord = title.split(/[\s:]/)[0].trim();
  const firstWordSlug = slugify(firstWord);
  if (firstWordSlug.length >= 4 && !variants.includes(firstWordSlug)) {
    variants.push(firstWordSlug);
  }

  return [...new Set(variants)];
}

function extractRequestedSeason(titles: string[]): number | null {
  for (const title of titles) {
    const season = extractSeasonNumber(title);
    if (season && season > 1) return season;
  }
  return null;
}

function slugHasSeason(slug: string, season: number): boolean {
  const ordinal = Object.entries(ORDINAL_WORDS).find(([, n]) => n === season)?.[0];
  const patterns = [
    new RegExp(`(?:^|-)${season}(?:st|nd|rd|th)?-season(?:-|$)`),
    new RegExp(`(?:^|-)season-${season}(?:-|$)`),
    new RegExp(`(?:^|-)s${season}(?:-|$)`),
    ...(ordinal ? [
      new RegExp(`(?:^|-)${ordinal}-season(?:-|$)`),
      new RegExp(`(?:^|-)season-${ordinal}(?:-|$)`),
    ] : []),
  ];
  return patterns.some((pattern) => pattern.test(slug));
}

function requestedYearNumber(title: string): number | null {
  const explicit =
    title.match(/\b(\d+)(?:st|nd|rd|th)?\s+year\b/i) ??
    title.match(/\b(\d+)\s*[-\s]?nensei\b/i);
  if (explicit?.[1]) return parseInt(explicit[1], 10);
  const word = title.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+year\b/i);
  return word?.[1] ? ORDINAL_WORDS[word[1].toLowerCase()] ?? null : null;
}

function requestedTermNumber(title: string): number | null {
  const explicit =
    title.match(/\b(\d+)(?:st|nd|rd|th)?\s+semester\b/i) ??
    title.match(/\b(\d+)\s*[-\s]?gakki\b/i);
  if (explicit?.[1]) return parseInt(explicit[1], 10);
  const word = title.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+semester\b/i);
  return word?.[1] ? ORDINAL_WORDS[word[1].toLowerCase()] ?? null : null;
}

function slugHasSchoolYear(slug: string, year: number): boolean {
  const ordinal = Object.entries(ORDINAL_WORDS).find(([, n]) => n === year)?.[0];
  const patterns = [
    new RegExp(`(?:^|-)${year}-?nensei(?:-|$)`),
    new RegExp(`(?:^|-)${year}(?:st|nd|rd|th)?-year(?:-|$)`),
    ...(ordinal ? [new RegExp(`(?:^|-)${ordinal}-year(?:-|$)`)] : []),
  ];
  return patterns.some((pattern) => pattern.test(slug));
}

function slugHasSchoolTerm(slug: string, term: number): boolean {
  const ordinal = Object.entries(ORDINAL_WORDS).find(([, n]) => n === term)?.[0];
  const patterns = [
    new RegExp(`(?:^|-)${term}-?gakki(?:-|$)`),
    new RegExp(`(?:^|-)${term}(?:st|nd|rd|th)?-semester(?:-|$)`),
    ...(ordinal ? [new RegExp(`(?:^|-)${ordinal}-semester(?:-|$)`)] : []),
  ];
  return patterns.some((pattern) => pattern.test(slug));
}

function slugMatchesSpecificIntent(slug: string, titles: string[]): boolean {
  if (!titles.some(hasSpecificSeasonIntent)) return true;

  const season = extractRequestedSeason(titles);
  if (season && !slugHasSeason(slug, season)) return false;

  for (const title of titles) {
    const year = requestedYearNumber(title);
    if (year && !slugHasSchoolYear(slug, year)) return false;

    const term = requestedTermNumber(title);
    if (term && !slugHasSchoolTerm(slug, term)) return false;
  }

  return true;
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
 * Search JKAnime using the updated /buscar/ URL (old /search/anime/ no longer works).
 * Extracts slugs from full URLs like https://jkanime.net/slug/
 */
async function searchJkAnimeSlugs(query: string): Promise<string[]> {
  try {
    // JKAnime changed search URL: /search/anime/?q= → /buscar/{query}
    const url = `${BASE}/buscar/${encodeURIComponent(query)}`;
    const html = await fetchPage(url, 12000);
    const slugs: string[] = [];
    const seen = new Set<string>();

    const SKIP = new Set([
      "search", "buscar", "api", "cdn", "assets", "static", "tag", "genero", "tipo",
      "temporada", "directorio", "usuario", "dash", "notificaciones", "guardado",
      "historial", "salir", "login", "registro", "perfil", "listas", "solicitudes",
    ]);

    const addSlug = (candidate: string) => {
      if (!SKIP.has(candidate) && !seen.has(candidate) && candidate.length >= 2) {
        seen.add(candidate);
        slugs.push(candidate);
      }
    };

    // Pattern 1: full URLs — href="https://jkanime.net/slug/"
    const re1 = /href="https?:\/\/jkanime\.net\/([a-z0-9][a-z0-9-]+)\/"/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(html)) !== null) addSlug(m[1]);

    // Pattern 2: relative href="/slug/" title=
    const re2 = /href="\/([a-z0-9][a-z0-9-]+)\/" title=/g;
    while ((m = re2.exec(html)) !== null) addSlug(m[1]);

    // Pattern 3: data-slug or data-anime
    const re3 = /data-(?:slug|anime)="([a-z0-9][a-z0-9-]+)"/g;
    while ((m = re3.exec(html)) !== null) addSlug(m[1]);

    // Pattern 4: any relative href that looks like an anime slug
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

  const re1 = /src="(https?:\/\/jkanime\.net\/jkplayer\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(html)) !== null) addUrl(m[1]);
  const re2 = /src='(https?:\/\/jkanime\.net\/jkplayer\/[^']+)'/g;
  while ((m = re2.exec(html)) !== null) addUrl(m[1]);
  const re3 = /data-src=["'](https?:\/\/jkanime\.net\/jkplayer\/[^"']+)["']/g;
  while ((m = re3.exec(html)) !== null) addUrl(m[1]);
  const re4 = /src="(https?:\/\/jkanime\.net\/(?:jkplayer|player|cdn)[^"]+)"/g;
  while ((m = re4.exec(html)) !== null) addUrl(m[1]);

  return urls;
}

function isValidEpisodePage(html: string): boolean {
  if (html.length < 3000) return false;
  const lower = html.toLowerCase();
  if (lower.includes("404 not found") || lower.includes("página no encontrada") || lower.includes("page not found")) return false;
  const hasPlayer = lower.includes("jkplayer") || lower.includes("jwplayer") || lower.includes(".m3u8") ||
    lower.includes("videojs") || lower.includes("video/mp4") || lower.includes("hlsurl") ||
    lower.includes("data-video") || lower.includes("player") && lower.includes("source");
  const hasEpisodeContent = lower.includes("episodio") || lower.includes("capítulo") || lower.includes("episode");
  return hasPlayer || (hasEpisodeContent && html.length > 8000);
}

async function trySlug(slug: string, episodeNum: number): Promise<string | null> {
  try {
    const url = `${BASE}/${slug}/${episodeNum}/`;
    const html = await fetchPage(url, 10000);
    if (isValidEpisodePage(html)) return html;
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

export async function getJkAnimeWatch(
  animeTitle: string,
  episodeNum: number,
  extraTitles: string[] = [],
  animeId?: string,
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


  // 1. Check slug cache (only use if it matches season intent)
  if (!slug) {
    const cachedSlug = slugCache.get(cacheKey);
    const cacheAge = slugCacheTime.get(cacheKey) ?? 0;
    if (cachedSlug && (Date.now() - cacheAge) < SLUG_CACHE_TTL && slugMatchesSpecificIntent(cachedSlug, allTitles)) {
      const html = await trySlug(cachedSlug, episodeNum);
      if (html) { slug = cachedSlug; episodeHtml = html; }
    }
  }

  // 2. Try all slug variants in parallel batches
  if (!slug) {
    const allSlugs: string[] = [];
    const seenSlugs = new Set<string>();
    for (const title of allTitles) {
      for (const s of makeSlugs(title)) {
        if (!seenSlugs.has(s) && slugMatchesSpecificIntent(s, allTitles)) {
          seenSlugs.add(s);
          allSlugs.push(s);
        }
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

  // 3. Search JKAnime with all title variants (using fixed /buscar/ URL)
  if (!slug) {
    const triedSlugs = new Set<string>(allTitles.flatMap(t => makeSlugs(t)));

    const allSearchQueries: string[] = [];
    const seenQ = new Set<string>();
    for (const t of allTitles) {
      const queries = [
        t,
        t.split(":")[0].trim(),
        t.split(" ").slice(0, 2).join(" "),
        t.split(" ").slice(0, 3).join(" "),
        ...(t.split(" ")[0].length >= 4 ? [t.split(" ")[0]] : []),
      ];
      for (const q of queries) {
        if (q.length >= 3 && !seenQ.has(q)) { seenQ.add(q); allSearchQueries.push(q); }
      }
    }

    const searchResults = await Promise.allSettled(allSearchQueries.map(q => searchJkAnimeSlugs(q)));
    const candidateSlugs: string[] = [];
    const seenCand = new Set<string>();
    for (const r of searchResults) {
      if (r.status === "fulfilled") {
        for (const s of r.value) {
          if (!slugMatchesSpecificIntent(s, allTitles)) continue;
          if (!triedSlugs.has(s) && !seenCand.has(s)) { seenCand.add(s); candidateSlugs.push(s); }
        }
      }
    }

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
