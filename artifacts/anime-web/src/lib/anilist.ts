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

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data as T;
}

export async function fetchAiringSchedule(): Promise<AiringEntry[]> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - 12 * 60 * 60; // 12h ago
  const end = now + 8 * 24 * 60 * 60; // 8 days ahead

  const query = `
    query ($start: Int, $end: Int) {
      Page(perPage: 100) {
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
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

  const data = await gql<{ Page: { airingSchedules: AiringEntry[] } }>(query, { start, end });
  return data.Page.airingSchedules ?? [];
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
  const map: Record<string, string> = { WINTER: "Invierno", SPRING: "Primavera", SUMMER: "Verano", FALL: "Otoño" };
  return map[s] ?? s;
}

export async function fetchSeasonalAnime(): Promise<SeasonAnime[]> {
  const { season, year } = getCurrentSeason();
  const query = `
    query ($season: MediaSeason, $year: Int) {
      Page(perPage: 30) {
        media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, status_in: [RELEASING, FINISHED]) {
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
  const data = await gql<{ Page: { media: SeasonAnime[] } }>(query, { season, year });
  return data.Page.media ?? [];
}
