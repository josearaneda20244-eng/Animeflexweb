const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";
const PROXY_ENDPOINT = `${BASE_URL}/anime/hls-proxy`;

export function proxyStreamUrl(directUrl: string, referer?: string): string {
  let url =
    `${PROXY_ENDPOINT}` +
    `?url=${encodeURIComponent(directUrl)}` +
    `&base=${encodeURIComponent(PROXY_ENDPOINT)}`;
  if (referer) {
    url += `&referer=${encodeURIComponent(referer)}`;
  }
  return url;
}

export function proxySubtitleUrl(directUrl: string, referer?: string): string {
  let url = `${BASE_URL}/anime/subtitle-proxy?url=${encodeURIComponent(directUrl)}`;
  if (referer) url += `&referer=${encodeURIComponent(referer)}`;
  return url;
}

export function downloadProxyUrl(directUrl: string, filename: string, referer?: string): string {
  let url = `${BASE_URL}/anime/download-proxy?url=${encodeURIComponent(directUrl)}&filename=${encodeURIComponent(filename)}`;
  if (referer) url += `&referer=${encodeURIComponent(referer)}`;
  return url;
}

export function resolveTitle(
  title:
    | string
    | { english?: string; romaji?: string; userPreferred?: string; native?: string }
    | undefined
): string {
  if (!title) return "Unknown";
  if (typeof title === "string") return title;
  return title.english || title.romaji || title.userPreferred || title.native || "Unknown";
}

export interface AnimeResult {
  id: string;
  title: string | { english?: string; romaji?: string; userPreferred?: string; native?: string };
  url?: string;
  image: string;
  cover?: string;
  releaseDate?: string | number;
  subOrDub?: string;
  type?: string;
  status?: string;
  totalEpisodes?: number;
  currentEpisode?: number;
  rating?: number;
  duration?: string;
  genres?: string[];
  description?: string;
  color?: string;
}

export interface SearchResult {
  currentPage: number;
  hasNextPage: boolean;
  results: AnimeResult[];
}

export interface Episode {
  id: string;
  title?: string;
  description?: string;
  number: number;
  url?: string;
  image?: string;
  airDate?: string;
  isFiller?: boolean;
}

export interface AnimeCharacter {
  id: string;
  name: string;
  image: string;
  role: string;
}

export interface AnimeTrailer {
  id: string;
  site: string;
}

export interface AnimeInfo extends AnimeResult {
  description?: string;
  genres?: string[];
  studios?: string[];
  episodes: Episode[];
  episodePages?: number;
  externalLinks?: Array<{ url: string; site: string }>;
  trailer?: AnimeTrailer | null;
  characters?: AnimeCharacter[];
  recommendations?: AnimeResult[];
}

export interface StreamingSource {
  url: string;
  quality?: string;
  isM3U8?: boolean;
  isDub?: boolean;
}

export interface StreamingData {
  headers?: Record<string, string>;
  sources: StreamingSource[];
  subtitles?: Array<{ url: string; lang: string }>;
}

export interface SubtitleResult {
  id: string;
  lang: string;
  release: string;
  downloadCount: number;
  fileId: number | null;
  fileName: string;
}

export interface SubtitleDownload {
  url: string;
}

function getToken(): string | null {
  try { return localStorage.getItem("af_token"); } catch { return null; }
}

async function get<T>(path: string, auth = false): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const json = await response.json().catch(() => null);
    const err: any = new Error(json?.error ?? `API error ${response.status}`);
    err.status = response.status;
    err.limitReached = json?.limitReached ?? false;
    throw err;
  }
  return response.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

export const consumet = {
  search: (query: string, page = 1): Promise<SearchResult> =>
    get<SearchResult>(`/anime/search?q=${encodeURIComponent(query)}&page=${page}`),
  trending: (): Promise<SearchResult> => get<SearchResult>(`/anime/trending`),
  popular: (): Promise<SearchResult> => get<SearchResult>(`/anime/popular`),
  recentEpisodes: (): Promise<SearchResult> => get<SearchResult>(`/anime/recent`),
  info: (id: string): Promise<AnimeInfo> => get<AnimeInfo>(`/anime/info?id=${encodeURIComponent(id)}`),
  anilistInfo: (id: string): Promise<AnimeInfo> => get<AnimeInfo>(`/anime/anilist-info?id=${encodeURIComponent(id)}`),
  episodesById: (anilistId: string): Promise<AnimeInfo> =>
    get<AnimeInfo>(`/anime/episodes?anilistId=${encodeURIComponent(anilistId)}`),
  streaming: (episodeId: string, animeTitle?: string, episodeNum?: string, animeId?: string): Promise<StreamingData> => {
    let url = `/anime/watch?episodeId=${encodeURIComponent(episodeId)}`;
    if (animeTitle) url += `&animeTitle=${encodeURIComponent(animeTitle)}`;
    if (episodeNum)  url += `&episodeNum=${encodeURIComponent(episodeNum)}`;
    if (animeId) url += `&animeId=${encodeURIComponent(animeId)}`;
    return get<StreamingData>(url, true);
  },
  searchSubtitles: (title: string, episode?: number, lang = "es"): Promise<{ data: SubtitleResult[] }> =>
    get<{ data: SubtitleResult[] }>(
      `/anime/subtitles?title=${encodeURIComponent(title)}` +
        (episode ? `&episode=${episode}` : "") +
        `&lang=${lang}`
    ),
  downloadSubtitle: (fileId: number): Promise<SubtitleDownload> =>
    post<SubtitleDownload>(`/anime/subtitles/download`, { fileId }),
  animeflvWatch: (title: string, episode: number, animeId?: string | number): Promise<StreamingData & { slug?: string }> =>
    get<StreamingData & { slug?: string }>(
      `/anime/animeflv-watch?title=${encodeURIComponent(title)}&episode=${encodeURIComponent(episode)}${animeId ? `&animeId=${encodeURIComponent(animeId)}` : ""}`,
      true
    ),
  byFormat: (format: "MOVIE" | "OVA" | "ONA" | "SPECIAL", page = 1): Promise<SearchResult> =>
    get<SearchResult>(`/anime/by-format?format=${format}&page=${page}`),
};

// ──────────────────────────────────────────────────────────────────────────────
// Direct AniList GraphQL call — bypasses the backend, works from the browser.
// Used for Películas / OVAs pages so they don't depend on Railway being up.
// ──────────────────────────────────────────────────────────────────────────────
const ANILIST_GQL_URL = "https://graphql.anilist.co";

const BY_FORMAT_QUERY = `
  query ($format: MediaFormat, $page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage }
      media(type: ANIME, format: $format, sort: POPULARITY_DESC, isAdult: false) {
        id
        title { romaji english native userPreferred }
        coverImage { extraLarge large }
        averageScore
        format
        episodes
        status
        genres
      }
    }
  }
`;

async function byFormatAniList(
  format: "MOVIE" | "OVA" | "ONA" | "SPECIAL",
  page: number,
  perPage: number,
): Promise<SearchResult> {
  const resp = await fetch(ANILIST_GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: BY_FORMAT_QUERY, variables: { format, page, perPage } }),
  });
  if (!resp.ok) throw new Error(`AniList error ${resp.status}`);
  const json: any = await resp.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const raw: any[] = json.data.Page.media ?? [];
  return {
    currentPage: json.data.Page.pageInfo.currentPage,
    hasNextPage: json.data.Page.pageInfo.hasNextPage,
    results: raw.map((m: any) => ({
      id: String(m.id),
      title: m.title,
      image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? "",
      rating: m.averageScore ?? 0,
      type: m.format ?? format,
      totalEpisodes: m.episodes ?? 0,
      status: m.status ?? "",
      genres: m.genres ?? [],
    })),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Jikan (MyAnimeList) fallback — used when AniList GraphQL is down or rate-limits
// us. Returns the same `SearchResult` shape so the rest of the UI doesn't change.
// ──────────────────────────────────────────────────────────────────────────────
const JIKAN_BASE_URL = "https://api.jikan.moe/v4";

const JIKAN_TYPE_BY_FORMAT: Record<"MOVIE" | "OVA" | "ONA" | "SPECIAL", string> = {
  MOVIE: "movie",
  OVA: "ova",
  ONA: "ona",
  SPECIAL: "special",
};

async function byFormatJikan(
  format: "MOVIE" | "OVA" | "ONA" | "SPECIAL",
  page: number,
  perPage: number,
): Promise<SearchResult> {
  const type = JIKAN_TYPE_BY_FORMAT[format];
  // Jikan caps `limit` at 25.
  const limit = Math.min(Math.max(perPage, 1), 25);
  const url =
    `${JIKAN_BASE_URL}/anime?type=${type}` +
    `&order_by=popularity&sort=asc` +
    `&page=${page}&limit=${limit}`;
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) throw new Error(`Jikan error ${resp.status}`);
  const json: any = await resp.json();
  const raw: any[] = json.data ?? [];
  return {
    currentPage: json.pagination?.current_page ?? page,
    hasNextPage: Boolean(json.pagination?.has_next_page),
    results: raw.map((m: any) => ({
      // Use the MAL id as the result id. Many popular titles share the same
      // numeric id between MAL and AniList, so the detail route still works
      // for the common case while AniList is unreachable.
      id: String(m.mal_id),
      title: {
        english: m.title_english ?? undefined,
        romaji: m.title ?? undefined,
        userPreferred: m.title_english || m.title,
        native: m.title_japanese ?? undefined,
      },
      image:
        m.images?.webp?.large_image_url ??
        m.images?.jpg?.large_image_url ??
        m.images?.webp?.image_url ??
        m.images?.jpg?.image_url ??
        "",
      // Jikan's `score` is 0-10; AniList's `averageScore` is 0-100. Normalise
      // so the existing UI which divides by 10 keeps producing the right value.
      rating: m.score != null ? Math.round(m.score * 10) : 0,
      type: format,
      totalEpisodes: m.episodes ?? 0,
      status: (m.status ?? "").toUpperCase().replace(/\s+/g, "_"),
      genres: Array.isArray(m.genres) ? m.genres.map((g: any) => g.name).filter(Boolean) : [],
      releaseDate: m.aired?.prop?.from?.year ?? m.year ?? undefined,
    })),
  };
}

export async function byFormatDirect(
  format: "MOVIE" | "OVA" | "ONA" | "SPECIAL",
  page = 1,
  perPage = 24,
): Promise<SearchResult> {
  // 1. Try AniList GraphQL first (richer data, AniList ids work everywhere).
  try {
    return await byFormatAniList(format, page, perPage);
  } catch (err) {
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[byFormatDirect] AniList failed, falling back to Jikan:", err);
    }
  }
  // 2. Fall back to Jikan (MyAnimeList) so the page still renders something
  //    when AniList is unreachable / rate-limited / temporarily disabled.
  return await byFormatJikan(format, page, perPage);
}
