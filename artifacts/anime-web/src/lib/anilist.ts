// ──────────────────────────────────────────────────────────────────────────────
// Source switched from AniList GraphQL → Jikan (MyAnimeList) REST API.
// AniList disabled their public GraphQL API "due to severe stability issues"
// so we now pull the same data from Jikan and shape it into the original
// types so the rest of the app keeps working unchanged.
//
// Notes on IDs:
//   `id` is now the MAL ID (Jikan's `mal_id`), not the AniList ID.
//   The backend's /anime/anilist-info endpoint accepts MAL IDs as well.
// ──────────────────────────────────────────────────────────────────────────────
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

function pickJikanImage(images: any): string {
  return (
    images?.webp?.large_image_url ??
    images?.jpg?.large_image_url ??
    images?.webp?.image_url ??
    images?.jpg?.image_url ??
    ""
  );
}

function normalizeStatus(s: string | undefined): string {
  return (s ?? "").toUpperCase().replace(/\s+/g, "_");
}

function jikanGenres(g: any): string[] {
  return Array.isArray(g) ? g.map((x: any) => x?.name).filter(Boolean) : [];
}

export async function fetchAiringSchedule(): Promise<AiringEntry[]> {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const dayToWeekday: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  };
  const today = new Date();
  const out: AiringEntry[] = [];
  const seen = new Set<number>();

  const responses = await Promise.all(
    days.map(async (d) => {
      try {
        const r = await fetch(`${JIKAN_URL}/schedules?filter=${d}&sfw=true`, {
          headers: { Accept: "application/json" },
        });
        if (!r.ok) return { day: d, data: [] as any[] };
        const j: any = await r.json();
        return { day: d, data: (j.data ?? []) as any[] };
      } catch {
        return { day: d, data: [] as any[] };
      }
    }),
  );

  for (const { day, data } of responses) {
    const weekday = dayToWeekday[day] ?? 1;
    const ref = new Date(today);
    const offset = (weekday - ref.getDay() + 7) % 7;
    ref.setDate(ref.getDate() + offset);

    for (const m of data) {
      if (!m || seen.has(m.mal_id)) continue;
      if (m.type !== "TV") continue;
      seen.add(m.mal_id);

      const broadcastTime: string | undefined = m.broadcast?.time;
      const airingDate = new Date(ref);
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
          coverImage: { large: pickJikanImage(m.images) },
          format: m.type ?? "TV",
          episodes: m.episodes ?? undefined,
          averageScore: m.score != null ? Math.round(m.score * 10) : undefined,
          genres: jikanGenres(m.genres),
          status: normalizeStatus(m.status),
        },
      });
    }
  }

  return out;
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
    coverImage: { large: pickJikanImage(m.images) },
    format: (m.type ?? "TV").toUpperCase(),
    episodes: m.episodes ?? undefined,
    averageScore: m.score != null ? Math.round(m.score * 10) : undefined,
    genres: jikanGenres(m.genres),
    status: normalizeStatus(m.status),
    season,
    seasonYear: year,
  }));
}
