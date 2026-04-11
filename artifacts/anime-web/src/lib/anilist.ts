const ANILIST_URL = "https://graphql.anilist.co";

export interface AiringEntry {
  airingAt: number;
  episode: number;
  media: {
    id: number;
    title: { romaji: string; english?: string };
    coverImage: { large: string };
    format: string;
    episodes?: number;
    averageScore?: number;
    genres?: string[];
    status: string;
  };
}

export interface SeasonAnime {
  id: number;
  title: { romaji: string; english?: string };
  coverImage: { large: string };
  format: string;
  episodes?: number;
  averageScore?: number;
  genres?: string[];
  status: string;
  season: string;
  seasonYear: number;
}

async function anilistQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList error ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export async function fetchAiringSchedule(): Promise<AiringEntry[]> {
  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        airingSchedules(notYetAired: false, sort: TIME_DESC) {
          airingAt
          episode
          media {
            id
            title { romaji english }
            coverImage { large }
            format
            episodes
            averageScore
            genres
            status
          }
        }
      }
    }
  `;
  const data = await anilistQuery<{
    Page: { airingSchedules: Array<{ airingAt: number; episode: number; media: any }> };
  }>(query, { page: 1, perPage: 50 });

  return (data.Page.airingSchedules ?? [])
    .filter((e) => e.media && e.media.format === "TV")
    .map((e) => ({
      airingAt: e.airingAt,
      episode: e.episode,
      media: {
        id: e.media.id,
        title: {
          romaji: e.media.title?.romaji ?? "",
          english: e.media.title?.english ?? undefined,
        },
        coverImage: { large: e.media.coverImage?.large ?? "" },
        format: e.media.format ?? "TV",
        episodes: e.media.episodes ?? undefined,
        averageScore: e.media.averageScore ?? undefined,
        genres: e.media.genres ?? [],
        status: e.media.status ?? "",
      },
    }));
}

export function getCurrentSeason(): { season: string; year: number } {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  let season: string;
  if (month >= 1 && month <= 3) season = "WINTER";
  else if (month >= 4 && month <= 6) season = "SPRING";
  else if (month >= 7 && month <= 9) season = "SUMMER";
  else season = "FALL";
  return { season, year };
}

export function seasonLabel(s: string): string {
  const map: Record<string, string> = {
    WINTER: "Invierno",
    SPRING: "Primavera",
    SUMMER: "Verano",
    FALL: "Otoño",
  };
  return map[s] ?? s;
}

export async function fetchSeasonalAnime(): Promise<SeasonAnime[]> {
  const { season, year } = getCurrentSeason();
  const query = `
    query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(
          season: $season
          seasonYear: $seasonYear
          type: ANIME
          sort: POPULARITY_DESC
          format_in: [TV, MOVIE, OVA, ONA, SPECIAL]
        ) {
          id
          title { romaji english }
          coverImage { large }
          format
          episodes
          averageScore
          genres
          status
          season
          seasonYear
        }
      }
    }
  `;
  const data = await anilistQuery<{ Page: { media: any[] } }>(query, {
    season,
    seasonYear: year,
    page: 1,
    perPage: 30,
  });

  return (data.Page.media ?? []).map((m): SeasonAnime => ({
    id: m.id,
    title: {
      romaji: m.title?.romaji ?? "",
      english: m.title?.english ?? undefined,
    },
    coverImage: { large: m.coverImage?.large ?? "" },
    format: m.format ?? "TV",
    episodes: m.episodes ?? undefined,
    averageScore: m.averageScore ?? undefined,
    genres: m.genres ?? [],
    status: m.status ?? "",
    season: m.season ?? season,
    seasonYear: m.seasonYear ?? year,
  }));
}
