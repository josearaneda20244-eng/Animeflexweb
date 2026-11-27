import type { AnimeResult, SearchResult } from "@/lib/consumet";

const ANILIST_GQL_URL = "https://graphql.anilist.co";

export const ANILIST_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Horror", "Mahou Shoujo", "Mecha", "Music",
  "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller",
] as const;

/** Etiquetas populares que en AniList son "tags" y no géneros. */
export const ANILIST_TAGS = ["Isekai", "Shounen", "Seinen", "Shoujo", "Josei", "School", "Super Power", "Military", "Historical"] as const;

export const GENRE_LABELS_ES: Record<string, string> = {
  Action: "Acción", Adventure: "Aventura", Comedy: "Comedia", Drama: "Drama", Ecchi: "Ecchi", Fantasy: "Fantasía",
  Horror: "Terror", "Mahou Shoujo": "Mahou Shoujo", Mecha: "Mecha", Music: "Música", Mystery: "Misterio",
  Psychological: "Psicológico", Romance: "Romance", "Sci-Fi": "Ciencia ficción", "Slice of Life": "Recuentos de la vida",
  Sports: "Deportes", Supernatural: "Sobrenatural", Thriller: "Thriller", Isekai: "Isekai", Shounen: "Shounen",
  Seinen: "Seinen", Shoujo: "Shoujo", Josei: "Josei", School: "Escolar", "Super Power": "Superpoderes",
  Military: "Militar", Historical: "Histórico",
};

export type BrowseSort = "popularity" | "trending" | "score" | "latest" | "title" | "relevance";
export type BrowseFormat = "" | "TV" | "MOVIE" | "OVA" | "ONA" | "SPECIAL" | "TV_SHORT";
export type BrowseStatus = "" | "RELEASING" | "FINISHED" | "NOT_YET_RELEASED";
export type BrowseSeason = "" | "WINTER" | "SPRING" | "SUMMER" | "FALL";

export interface BrowseParams {
  search?: string;
  genre?: string;
  year?: number;
  season?: BrowseSeason;
  format?: BrowseFormat;
  status?: BrowseStatus;
  sort?: BrowseSort;
  page?: number;
}

const SORT_MAP: Record<BrowseSort, string[]> = {
  popularity: ["POPULARITY_DESC"],
  trending: ["TRENDING_DESC", "POPULARITY_DESC"],
  score: ["SCORE_DESC"],
  latest: ["START_DATE_DESC"],
  title: ["TITLE_ROMAJI"],
  relevance: ["SEARCH_MATCH", "POPULARITY_DESC"],
};

const QUERY = `
query ($page: Int, $search: String, $genre: [String], $tag: [String], $year: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
  Page(page: $page, perPage: 30) {
    pageInfo { currentPage hasNextPage }
    media(type: ANIME, isAdult: false, search: $search, genre_in: $genre, tag_in: $tag, seasonYear: $year, season: $season, format: $format, status: $status, sort: $sort) {
      id
      title { romaji english userPreferred }
      coverImage { extraLarge large }
      bannerImage
      averageScore
      format
      status
      episodes
      genres
      seasonYear
      nextAiringEpisode { episode }
    }
  }
}`;

/** Explorar/buscar anime directamente contra AniList (no depende del backend). */
export async function browseAnime(p: BrowseParams, signal?: AbortSignal): Promise<SearchResult> {
  const isTag = !!p.genre && (ANILIST_TAGS as readonly string[]).includes(p.genre);
  const search = p.search?.trim() || undefined;
  const sort = p.sort ?? (search ? "relevance" : "popularity");
  const variables: Record<string, unknown> = {
    page: p.page ?? 1,
    search,
    genre: p.genre && !isTag ? [p.genre] : undefined,
    tag: p.genre && isTag ? [p.genre] : undefined,
    year: p.year || undefined,
    season: p.season || undefined,
    format: p.format || undefined,
    status: p.status || undefined,
    sort: SORT_MAP[sort === "relevance" && !search ? "popularity" : sort],
  };
  const resp = await fetch(ANILIST_GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables }),
    signal,
  });
  if (!resp.ok) throw new Error(`AniList ${resp.status}`);
  const json: any = await resp.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  const page = json.data.Page;
  return {
    currentPage: page.pageInfo.currentPage,
    hasNextPage: page.pageInfo.hasNextPage,
    results: (page.media as any[]).map((m): AnimeResult => ({
      id: String(m.id),
      title: m.title,
      image: m.coverImage?.extraLarge ?? m.coverImage?.large ?? "",
      cover: m.bannerImage ?? undefined,
      rating: m.averageScore ?? 0,
      type: m.format ?? undefined,
      status: m.status ?? undefined,
      totalEpisodes: m.episodes ?? undefined,
      currentEpisode: m.nextAiringEpisode?.episode ? m.nextAiringEpisode.episode - 1 : undefined,
      genres: m.genres ?? [],
      releaseDate: m.seasonYear ?? undefined,
    })),
  };
}
