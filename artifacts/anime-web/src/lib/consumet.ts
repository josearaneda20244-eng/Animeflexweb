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

export function proxySubtitleUrl(directUrl: string): string {
  return `${BASE_URL}/anime/subtitle-proxy?url=${encodeURIComponent(directUrl)}`;
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

export interface AnimeInfo extends AnimeResult {
  description?: string;
  genres?: string[];
  studios?: string[];
  episodes: Episode[];
  episodePages?: number;
  externalLinks?: Array<{ url: string; site: string }>;
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

async function get<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`);
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
  streaming: (episodeId: string): Promise<StreamingData> =>
    get<StreamingData>(`/anime/watch?episodeId=${encodeURIComponent(episodeId)}`),
  searchSubtitles: (title: string, episode?: number, lang = "es"): Promise<{ data: SubtitleResult[] }> =>
    get<{ data: SubtitleResult[] }>(
      `/anime/subtitles?title=${encodeURIComponent(title)}` +
        (episode ? `&episode=${episode}` : "") +
        `&lang=${lang}`
    ),
  downloadSubtitle: (fileId: number): Promise<SubtitleDownload> =>
    post<SubtitleDownload>(`/anime/subtitles/download`, { fileId }),
};
