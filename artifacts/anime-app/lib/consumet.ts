const BASE_URL = "https://consumet-api.vercel.app";

export interface AnimeResult {
  id: string;
  title: string;
  url: string;
  image: string;
  cover?: string;
  releaseDate?: string;
  subOrDub?: string;
  type?: string;
  status?: string;
  totalEpisodes?: number;
  currentEpisode?: number;
  rating?: number;
  duration?: string;
  genres?: string[];
  description?: string;
}

export interface SearchResult {
  currentPage: number;
  hasNextPage: boolean;
  results: AnimeResult[];
}

export interface AnimeInfo extends AnimeResult {
  description: string;
  genres: string[];
  studios?: string[];
  releaseDate?: string;
  status?: string;
  rating?: number;
  duration?: string;
  type?: string;
  season?: string;
  episodes: Episode[];
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

export interface StreamingSource {
  url: string;
  quality?: string;
  isM3U8?: boolean;
}

export interface StreamingData {
  headers?: Record<string, string>;
  sources: StreamingSource[];
  subtitles?: Array<{ url: string; lang: string }>;
}

async function get<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const consumet = {
  search: (query: string, page = 1): Promise<SearchResult> =>
    get<SearchResult>(`/anime/zoro/${encodeURIComponent(query)}?page=${page}`),

  trending: (): Promise<SearchResult> =>
    get<SearchResult>(`/anime/zoro/trending`),

  popular: (): Promise<SearchResult> =>
    get<SearchResult>(`/anime/zoro/popular`),

  recentEpisodes: (): Promise<SearchResult> =>
    get<SearchResult>(`/anime/zoro/recent-episodes`),

  info: (id: string): Promise<AnimeInfo> =>
    get<AnimeInfo>(`/anime/zoro/info?id=${encodeURIComponent(id)}`),

  streaming: (episodeId: string, server?: string): Promise<StreamingData> => {
    const serverParam = server ? `&server=${server}` : "";
    return get<StreamingData>(
      `/anime/zoro/watch?episodeId=${encodeURIComponent(episodeId)}${serverParam}`
    );
  },
};
