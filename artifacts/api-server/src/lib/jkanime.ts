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
    title.match(/\bseason\s+(\d+)\b/i) ??
    title.match(/\btemporada\s+(\d+)\b/i);
  if (match?.[1]) return parseInt(match[1], 10);

  const wordMatch = title.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+season\b/i);
  return wordMatch?.[1] ? ORDINAL_WORDS[wordMatch[1].toLowerCase()] ?? null : null;
}

function isFinalSeason(title: string): boolean {
  return /\bfinal\s+season\b/i.test(title) || /\bthe\s+final\b/i.test(title);
}

function extractPartNumber(title: string): number | null {
  const m = title.match(/\b(?:part|parte|cour)\s+(\d+)\b/i) ?? title.match(/\bpart(\d+)\b/i);
  return m ? parseInt(m[1], 10) : null;
}

function hasSpecificSeasonIntent(title: string): boolean {
  return (
    (extractSeasonNumber(title) ?? 1) > 1 ||
    isFinalSeason(title) ||
    extractPartNumber(title) !== null ||
    /\b(second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+year\b/i.test(title) ||
    /:\s*\S.+/.test(title)
  );
}

/**
 * Strip the season/part suffix from a title to get the base anime name.
 */
function stripSeasonSuffix(title: string): string {
  return title
    .replace(/\s*:?\s*(?:the\s+)?final\s+season\b.*/i, "")
    .replace(/\s*:?\s*\d+(?:st|nd|rd|th)?\s+season\b.*/i, "")
    .replace(/\s*:?\s*season\s+\d+\b.*/i, "")
    .replace(/\s*:?\s*temporada\s+\d+\b.*/i, "")
    .replace(/\s*:?\s*(?:part|parte|cour)\s+\d+\b.*/i, "")
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .trim();
}

function makeSlugs(title: string): string[] {
  const add = (s: string, arr: string[]) => {
    if (s && !arr.includes(s)) arr.push(s);
  };

  const variants: string[] = [slugify(title)];

  const noPunct = slugify(title.replace(/[!?]/g, "").trim());
  add(noPunct, variants);

  const seasonNum = extractSeasonNumber(title);
  const partNum = extractPartNumber(title);
  const finalSeason = isFinalSeason(title);
  const base = stripSeasonSuffix(title);
  const baseSlug = slugify(base);

  if (baseSlug && baseSlug !== variants[0]) add(baseSlug, variants);

  // Season-number variants (English + Spanish + trailing-number)
  if (seasonNum && seasonNum > 1) {
    add(`${baseSlug}-${seasonNum}`, variants);
    add(`${baseSlug}-temporada-${seasonNum}`, variants);
    add(`${baseSlug}-season-${seasonNum}`, variants);
    add(`${baseSlug}-s${seasonNum}`, variants);
  }

  // Final season variants
  if (finalSeason) {
    add(`${baseSlug}-the-final-season`, variants);
    add(`${baseSlug}-final-season`, variants);
  }

  // Part variants (English + Spanish)
  if (partNum) {
    add(`${baseSlug}-parte-${partNum}`, variants);
    add(`${baseSlug}-part-${partNum}`, variants);
    // Combined season + part
    if (seasonNum && seasonNum > 1) {
      add(`${baseSlug}-${seasonNum}-parte-${partNum}`, variants);
      add(`${baseSlug}-temporada-${seasonNum}-parte-${partNum}`, variants);
    }
    if (finalSeason) {
      add(`${baseSlug}-the-final-season-parte-${partNum}`, variants);
      add(`${baseSlug}-final-season-parte-${partNum}`, variants);
    }
  }

  // No-year variant
  const noYear = title.replace(/\s*\(\d{4}\)\s*$/g, "").trim();
  if (noYear !== title) add(slugify(noYear), variants);

  // No-colon variant
  const noColon = title.split(":")[0].trim();
  if (noColon !== title) add(slugify(noColon), variants);

  // Trailing-number check (e.g. "Naruto Shippuden 2" → "naruto-shippuden-2")
  const trailingNumMatch = title.match(/\s+(\d+)\s*$/);
  if (trailingNumMatch) {
    const trailingBase = title.replace(/\s+\d+\s*$/, "").trim();
    add(`${slugify(trailingBase)}-${trailingNumMatch[1]}`, variants);
  }

  // Word-prefix variants
  const words = title.split(" ").filter(Boolean);
  const words3 = words.slice(0, 3).join(" ");
  const words4 = words.slice(0, 4).join(" ");
  if (words3.length > 3) add(slugify(words3), variants);
  if (words4.length > 3) add(slugify(words4), variants);

  // First word (useful for Japanese single-word romaji)
  const firstWord = title.split(/[\s:]/)[0].trim();
  const firstWordSlug = slugify(firstWord);
  if (firstWordSlug.length >= 4) add(firstWordSlug, variants);

  return variants;
}

function extractRequestedSeason(titles: string[]): number | null {
  for (const title of titles) {
    const season = extractSeasonNumber(title);
    if (season && season > 1) return season;
  }
  return null;
}

/**
 * Check if a JKAnime slug contains a season number in any expected format.
 * Covers English (season-N, Nth-season, sN), Spanish (temporada-N), and
 * JKAnime's common pattern of appending just the number at the end (anime-N).
 */
function slugHasSeason(slug: string, season: number): boolean {
  const ordinal = Object.entries(ORDINAL_WORDS).find(([, n]) => n === season)?.[0];
  const patterns = [
    // English patterns
    new RegExp(`(?:^|-)${season}(?:st|nd|rd|th)?-season(?:-|$)`),
    new RegExp(`(?:^|-)season-${season}(?:-|$)`),
    new RegExp(`(?:^|-)s${season}(?:-|$)`),
    // Spanish patterns
    new RegExp(`(?:^|-)temporada-${season}(?:-|$)`),
    // JKAnime trailing-number style: boku-no-hero-academia-6
    new RegExp(`-${season}(?:-parte-\\d+)?$`),
    ...(ordinal ? [
      new RegExp(`(?:^|-)${ordinal}-season(?:-|$)`),
      new RegExp(`(?:^|-)season-${ordinal}(?:-|$)`),
    ] : []),
  ];
  return patterns.some((pattern) => pattern.test(slug));
}

function slugHasFinalSeason(slug: string): boolean {
  return /(?:^|-)(?:the-)?final-season(?:-|$)/.test(slug);
}

function slugHasPart(slug: string, part: number): boolean {
  const patterns = [
    new RegExp(`(?:^|-)part-${part}(?:-|$)`),
    new RegExp(`(?:^|-)parte-${part}(?:-|$)`),
    new RegExp(`(?:^|-)cour-${part}(?:-|$)`),
    // trailing part
    new RegExp(`-parte?-${part}$`),
  ];
  return patterns.some(p => p.test(slug));
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

/**
 * Returns true if the slug is compatible with the season/part intent of the titles.
 * More permissive than before: base-only slugs are also accepted when we can't
 * find a season marker (JKAnime sometimes doesn't include season in the slug).
 */
function slugMatchesSpecificIntent(slug: string, titles: string[]): boolean {
  if (!titles.some(hasSpecificSeasonIntent)) return true;

  const season = extractRequestedSeason(titles);
  const finalSeason = titles.some(isFinalSeason);
  const partNum = titles.reduce<number | null>((acc, t) => acc ?? extractPartNumber(t), null);

  // Season check: slug must contain season indicator OR just be the base name
  // (some anime don't append season to slug for season 1 style sequels)
  if (season && season > 1) {
    if (!slugHasSeason(slug, season)) return false;
  }

  if (finalSeason && !slugHasFinalSeason(slug)) {
    // Still accept if slug has a trailing number (some JKAnime use -4 for final season 4)
    const hasTrailingNum = /-\d+(?:-parte?-\d+)?$/.test(slug);
    if (!hasTrailingNum) return false;
  }

  if (partNum && !slugHasPart(slug, partNum)) {
    // Accept slugs without part marker — JKAnime sometimes includes part in season slug
    // or uses a different episode numbering. Only reject if slug explicitly has a DIFFERENT part.
    const hasWrongPart = Array.from({ length: 10 }, (_, i) => i + 1)
      .filter(p => p !== partNum)
      .some(p => slugHasPart(slug, p));
    if (hasWrongPart) return false;
  }

  for (const title of titles) {
    const year = requestedYearNumber(title);
    if (year && !slugHasSchoolYear(slug, year)) return false;

    const term = requestedTermNumber(title);
    if (term && !slugHasSchoolTerm(slug, term)) return false;
  }

  return true;
}

/**
 * Score how relevant a JKAnime slug is for the requested title(s).
 * Returns the number of slug words that appear in any of the requested titles.
 */
function slugRelevanceScore(slug: string, titles: string[]): number {
  const slugWords = new Set(slug.split("-").filter(w => w.length >= 3));
  if (slugWords.size === 0) return 0;
  let best = 0;
  for (const title of titles) {
    const titleSlug = slugify(title);
    const titleWords = new Set(titleSlug.split("-").filter(w => w.length >= 3));
    const shared = [...slugWords].filter(w => titleWords.has(w)).length;
    if (shared > best) best = shared;
  }
  return best;
}

async function fetchPage(url: string, timeoutMs = 10000, extraHeaders?: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { ...PAGE_HEADERS, ...extraHeaders }, redirect: "follow", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`JKAnime page HTTP ${res.status}: ${url}`);
    return res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const EMBED_STREAM_PATTERNS: RegExp[] = [
  /(?:file|src|hlsUrl|source|videoUrl|streamUrl)\s*[=:]\s*['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/i,
  /['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/,
  /(?:file|src|videoUrl|streamUrl)\s*[=:]\s*['"`](https?:\/\/[^'"`\s<>]+\.mp4[^'"`\s<>]*)['"`]/i,
  /['"`](https?:\/\/[^'"`\s<>]+\.mp4[^'"`\s<>]*)['"`]/,
];

const EMBED_SKIP_PATTERNS = /thumbnail|poster|banner|preview|\.jpg|\.jpeg|\.png|\.webp|\.gif|\.svg/i;

/**
 * Try to resolve an embed player URL to a direct m3u8/mp4 stream URL.
 * Returns null if resolution fails.
 */
async function resolveEmbedToStream(
  embedUrl: string,
  referer: string,
): Promise<{ url: string; isM3U8: boolean } | null> {
  try {
    const html = await fetchPage(embedUrl, 9000, { Referer: referer, Origin: new URL(referer).origin });
    for (const pattern of EMBED_STREAM_PATTERNS) {
      const m = html.match(pattern);
      const candidate = m?.[1];
      if (candidate && !EMBED_SKIP_PATTERNS.test(candidate)) {
        return { url: candidate, isM3U8: candidate.includes(".m3u8") };
      }
    }
  } catch {
    // ignore — fall back to embed URL
  }
  return null;
}

/**
 * Search JKAnime using /buscar/ URL.
 * Extracts slugs from full URLs like https://jkanime.net/slug/
 */
async function searchJkAnimeSlugs(query: string): Promise<string[]> {
  try {
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

    // Pattern 1: full URLs
    const re1 = /href="https?:\/\/jkanime\.net\/([a-z0-9][a-z0-9-]+)\/"/g;
    let m: RegExpExecArray | null;
    while ((m = re1.exec(html)) !== null) addSlug(m[1]);

    // Pattern 2: relative href with title
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

const DOWNLOAD_ONLY_SERVERS = new Set([
  "mediafire", "mega", "google drive", "zippyshare", "pixeldrain",
  "terabox", "1fichier", "sendcm", "uptobox", "openload", "fembed",
]);

interface JkServer {
  url: string;
  server: string;
  lang: number;
}

/**
 * JKAnime now embeds player info as `var servers = [...]` in the page HTML.
 * Each entry has `remote` (base64-encoded URL), `server` (provider name),
 * `lang` (1=Sub, 2=Lat), `slug` (internal ID), and `append` (0=direct, 1=via CDN).
 */
function extractServersFromPage(html: string): JkServer[] {
  const cdnBaseMatch = html.match(/var\s+remote\s*=\s*['"]([^'"]+)['"]/);
  const cdnBase = cdnBaseMatch?.[1] ?? "https://c1.jkplayers.com";

  const m = html.match(/var\s+servers\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return [];

  let parsed: Array<{ remote: string; server: string; lang: number; slug: string; append: number }>;
  try {
    parsed = JSON.parse(m[1]);
  } catch {
    return [];
  }

  const results: JkServer[] = [];
  for (const s of parsed) {
    const serverName = (s.server ?? "").toLowerCase().trim();
    if (DOWNLOAD_ONLY_SERVERS.has(serverName)) continue;

    let url = "";
    try {
      if (s.append === 1) {
        url = `${cdnBase}/${s.slug}`;
      } else {
        url = Buffer.from(s.remote, "base64").toString("utf8").trim();
      }
    } catch {
      continue;
    }

    if (url.startsWith("http")) {
      results.push({ url, server: s.server, lang: s.lang });
    }
  }

  return results;
}

/**
 * Try to extract m3u8 or mp4 stream URLs directly from a jkanime episode page HTML.
 * This avoids having to open embed player pages (which often show ads).
 */
function extractDirectStreamsFromEpisodePage(
  html: string,
  episodePageUrl: string,
): Array<{ url: string; quality: string; isM3U8: boolean; lang: "LAT" | "SUB"; referer: string }> {
  const results: Array<{ url: string; quality: string; isM3U8: boolean; lang: "LAT" | "SUB"; referer: string }> = [];
  const seen = new Set<string>();

  const addIfNew = (url: string, isM3U8: boolean, lang: "LAT" | "SUB", label: string) => {
    if (!url || seen.has(url) || EMBED_SKIP_PATTERNS.test(url)) return;
    seen.add(url);
    results.push({ url, quality: label, isM3U8, lang, referer: episodePageUrl });
  };

  // Look for m3u8 URLs tagged with language info
  const m3u8Re = /['"`](https?:\/\/[^'"`\s<>]+\.m3u8[^'"`\s<>]*)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = m3u8Re.exec(html)) !== null) {
    const url = m[1];
    // Guess language from surrounding context (50 chars before)
    const ctx = html.slice(Math.max(0, m.index - 80), m.index).toLowerCase();
    const lang: "LAT" | "SUB" = ctx.includes("lat") || ctx.includes("esp") || ctx.includes("dub") ? "LAT" : "SUB";
    addIfNew(url, true, lang, `Directo ${lang}`);
  }

  return results;
}

function isValidEpisodePage(html: string): boolean {
  if (html.length < 3000) return false;
  const lower = html.toLowerCase();
  if (lower.includes("404 not found") || lower.includes("página no encontrada") || lower.includes("page not found")) return false;
  const hasServers = lower.includes("var servers") || lower.includes("jkplayer") || lower.includes("jwplayer") ||
    lower.includes(".m3u8") || lower.includes("videojs") || lower.includes("video/mp4") ||
    lower.includes("hlsurl") || lower.includes("data-video") ||
    (lower.includes("player") && lower.includes("source"));
  const hasEpisodeContent = lower.includes("episodio") || lower.includes("capítulo") || lower.includes("episode");
  return hasServers || (hasEpisodeContent && html.length > 8000);
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

  // 2. Try all slug variants from all title variants in parallel batches
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

  // 3. Search JKAnime with all title variants (using /buscar/ URL)
  if (!slug) {
    const triedSlugs = new Set<string>(allTitles.flatMap(t => makeSlugs(t)));

    const allSearchQueries: string[] = [];
    const seenQ = new Set<string>();
    const addQuery = (q: string) => {
      const qc = q.trim();
      if (qc.length >= 3 && !seenQ.has(qc)) { seenQ.add(qc); allSearchQueries.push(qc); }
    };

    for (const t of allTitles) {
      const words = t.split(" ").filter(Boolean);
      const base = stripSeasonSuffix(t);
      // Add multiple query forms per title
      addQuery(t);
      addQuery(base);
      addQuery(t.split(":")[0].trim());
      addQuery(words.slice(0, 2).join(" "));
      addQuery(words.slice(0, 3).join(" "));
      addQuery(words.slice(0, 4).join(" "));
      // Single word queries for Japanese/romaji titles (e.g. "Shingeki", "Naruto")
      if (words[0] && words[0].length >= 4) addQuery(words[0]);
      // Base without trailing season words
      const baseWords = base.split(" ").filter(Boolean);
      if (baseWords.length >= 2) addQuery(baseWords.slice(0, 2).join(" "));
    }

    const searchResults = await Promise.allSettled(allSearchQueries.map(q => searchJkAnimeSlugs(q)));
    const candidateSlugsRaw: string[] = [];
    const seenCand = new Set<string>();
    for (const r of searchResults) {
      if (r.status === "fulfilled") {
        for (const s of r.value) {
          if (!slugMatchesSpecificIntent(s, allTitles)) continue;
          if (!triedSlugs.has(s) && !seenCand.has(s)) { seenCand.add(s); candidateSlugsRaw.push(s); }
        }
      }
    }

    // If no candidates with season intent matched, fall back to ANY returned slug
    // (handles cases where JKAnime's slug has no season marker at all)
    if (candidateSlugsRaw.length === 0) {
      for (const r of searchResults) {
        if (r.status === "fulfilled") {
          for (const s of r.value) {
            if (!triedSlugs.has(s) && !seenCand.has(s)) { seenCand.add(s); candidateSlugsRaw.push(s); }
          }
        }
      }
    }

    // Sort by relevance: slugs sharing words with titles come first
    const candidateSlugs = candidateSlugsRaw
      .map(s => ({ s, score: slugRelevanceScore(s, allTitles) }))
      .sort((a, b) => b.score - a.score)
      .map(({ s }) => s);

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

  // Step 1: Try to extract direct m3u8 streams from the episode page HTML (no ads, no embed)
  const directStreams = extractDirectStreamsFromEpisodePage(episodeHtml, episodePageUrl);
  if (directStreams.length > 0) {
    const cacheable = directStreams.filter(s => s.isM3U8);
    if (cacheable.length > 0) {
      m3u8Cache.set(cachedM3u8Key, { sources: cacheable, ts: Date.now() });
    }
    return { sources: directStreams, slug, headers: { "Referer": episodePageUrl } };
  }

  // Step 2: Extract embed player URLs from `var servers = [...]`
  const jkServers = extractServersFromPage(episodeHtml);
  if (jkServers.length === 0) {
    throw new Error(`No players found for ${slug} ep ${episodeNum}`);
  }

  // Step 3: Try to resolve each embed player to a direct m3u8/mp4 stream server-side
  const resolveResults = await Promise.allSettled(
    jkServers.slice(0, 4).map(async (s) => {
      const resolved = await resolveEmbedToStream(s.url, episodePageUrl);
      return { server: s.server, lang: s.lang, embedUrl: s.url, resolved };
    })
  );

  const sources: JkAnimeStreamData["sources"] = [];
  for (const r of resolveResults) {
    if (r.status !== "fulfilled") continue;
    const { server, lang, embedUrl, resolved } = r.value;
    const langTag = lang === 2 ? "LAT" as const : "SUB" as const;
    if (resolved) {
      // Got a direct stream URL — no embed needed, no ads
      sources.push({
        url: resolved.url,
        quality: `${server}`,
        isM3U8: resolved.isM3U8,
        lang: langTag,
        referer: embedUrl,
      });
    } else {
      // Fallback: return embed URL for proxy serving
      sources.push({
        url: embedUrl,
        quality: `${server} [embed]`,
        isM3U8: false,
        lang: langTag,
        referer: episodePageUrl,
      });
    }
  }

  if (sources.length === 0) {
    throw new Error(`No playable sources for ${slug} ep ${episodeNum}`);
  }

  // Cache only direct m3u8 sources
  const cacheable = sources.filter(s => s.isM3U8);
  if (cacheable.length > 0) {
    m3u8Cache.set(cachedM3u8Key, { sources: cacheable, ts: Date.now() });
  }

  return {
    sources,
    slug,
    headers: { "Referer": episodePageUrl },
  };
}
