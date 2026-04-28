const ANILIST_URL = "https://graphql.anilist.co";
const JIKAN_URL = "https://api.jikan.moe/v4";

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

async function fetchAiringScheduleAniList(): Promise<AiringEntry[]> {
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

// Jikan fallback — used when AniList is unreachable. Pulls the weekly TV
// schedule (Monday → Sunday) and converts each entry into our AiringEntry
// shape so the existing Calendario UI works unchanged.
async function fetchAiringScheduleJikan(): Promise<AiringEntry[]> {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dayToWeekday: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };
  const today = new Date();
  const out: AiringEntry[] = [];
  const seen = new Set<number>();

  // Fetch the 7 days in parallel.
  const responses = await Promise.all(
    days.map(async (d) => {
      const r = await fetch(`${JIKAN_URL}/schedules?filter=${d}&sfw=true`, {
        headers: { Accept: "application/json" },
      });
      if (!r.ok) return { day: d, data: [] as any[] };
      const j: any = await r.json();
      return { day: d, data: (j.data ?? []) as any[] };
    }),
  );

  for (const { day, data } of responses) {
    const weekday = dayToWeekday[day] ?? 1;
    // Pick the next or current occurrence of this weekday in the local week.
    const ref = new Date(today);
    const offset = (weekday - ref.getDay() + 7) % 7;
    ref.setDate(ref.getDate() + offset);

    for (const m of data) {
      if (!m || seen.has(m.mal_id)) continue;
      if (m.type !== "TV") continue;
      seen.add(m.mal_id);

      const broadcastTime: string | undefined = m.broadcast?.time;
      let airingDate = new Date(ref);
      if (broadcastTime && /^\d{2}:\d{2}$/.test(broadcastTime)) {
        const [hh, mm] = broadcastTime.split(":").map(Number);
        airingDate.setHours(hh, mm, 0, 0);
      } else {
        airingDate.setHours(12, 0, 0, 0);
      }

      out.push({
        airingAt: Math.floor(airingDate.getTime() / 1000),
        episode: 0,
        media: {
          id: m.mal_id,
          title: {
            romaji: m.title ?? "",
            english: m.title_english ?? undefined,
          },
          coverImage: {
            large:
              m.images?.webp?.large_image_url ??
              m.images?.jpg?.large_image_url ??
              m.images?.webp?.image_url ??
              m.images?.jpg?.image_url ??
              "",
          },
          format: m.type ?? "TV",
          episodes: m.episodes ?? undefined,
          averageScore: m.score != null ? Math.round(m.score * 10) : undefined,
          genres: Array.isArray(m.genres) ? m.genres.map((g: any) => g.name).filter(Boolean) : [],
          status: (m.status ?? "").toUpperCase().replace(/\s+/g, "_"),
        },
      });
    }
  }

  return out;
}

export async function fetchAiringSchedule(): Promise<AiringEntry[]> {
  try {
    return await fetchAiringScheduleAniList();
  } catch (err) {
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[fetchAiringSchedule] AniList failed, falling back to Jikan:", err);
    }
    return await fetchAiringScheduleJikan();
  }
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

async function fetchSeasonalAnimeAniList(): Promise<SeasonAnime[]> {
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

// Jikan fallback for the current season's anime list.
async function fetchSeasonalAnimeJikan(): Promise<SeasonAnime[]> {
  const { season, year } = getCurrentSeason();
  const r = await fetch(`${JIKAN_URL}/seasons/now?limit=25&sfw=true`, {
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Jikan error ${r.status}`);
  const j: any = await r.json();
  const raw: any[] = j.data ?? [];
  return raw.map((m): SeasonAnime => ({
    id: m.mal_id,
    title: {
      romaji: m.title ?? "",
      english: m.title_english ?? undefined,
    },
    coverImage: {
      large:
        m.images?.webp?.large_image_url ??
        m.images?.jpg?.large_image_url ??
        m.images?.webp?.image_url ??
        m.images?.jpg?.image_url ??
        "",
    },
    format: (m.type ?? "TV").toUpperCase(),
    episodes: m.episodes ?? undefined,
    averageScore: m.score != null ? Math.round(m.score * 10) : undefined,
    genres: Array.isArray(m.genres) ? m.genres.map((g: any) => g.name).filter(Boolean) : [],
    status: (m.status ?? "").toUpperCase().replace(/\s+/g, "_"),
    season,
    seasonYear: year,
  }));
}

export async function fetchSeasonalAnime(): Promise<SeasonAnime[]> {
  try {
    return await fetchSeasonalAnimeAniList();
  } catch (err) {
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn("[fetchSeasonalAnime] AniList failed, falling back to Jikan:", err);
    }
    return await fetchSeasonalAnimeJikan();
  }
}
