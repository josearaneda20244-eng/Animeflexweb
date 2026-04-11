const JIKAN_BASE = "https://api.jikan.moe/v4";

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

async function jikanFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${JIKAN_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Jikan error ${res.status}`);
  return res.json() as Promise<T>;
}

const DAY_NAME_MAP: Record<string, number> = {
  mondays: 1,
  tuesdays: 2,
  wednesdays: 3,
  thursdays: 4,
  fridays: 5,
  saturdays: 6,
  sundays: 0,
};

function broadcastToUnix(
  day: string | undefined,
  time: string | undefined
): number {
  if (!day || !time) return Math.floor(Date.now() / 1000);
  const dayIdx = DAY_NAME_MAP[day.toLowerCase()];
  if (dayIdx === undefined) return Math.floor(Date.now() / 1000);
  const [h, m] = time.split(":").map(Number);
  const now = new Date();
  const todayIdx = now.getDay();
  let diff = dayIdx - todayIdx;
  if (diff > 0) diff -= 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  target.setHours(h - 9, m, 0, 0);
  return Math.floor(target.getTime() / 1000);
}

function estimateCurrentEpisode(airedFrom: string | undefined | null): number {
  if (!airedFrom) return 1;
  try {
    const start = new Date(airedFrom);
    const weeks = Math.floor(
      (Date.now() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return Math.max(1, weeks + 1);
  } catch {
    return 1;
  }
}

export async function fetchAiringSchedule(): Promise<AiringEntry[]> {
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const results: AiringEntry[] = [];

  await Promise.allSettled(
    days.map(async (day) => {
      const data = await jikanFetch<any>(`/schedules?day=${day}&limit=25`);
      for (const item of data.data ?? []) {
        if (!["TV", "Movie", "OVA", "ONA", "Special"].includes(item.type)) continue;
        const bc = item.broadcast ?? {};
        const airingAt = broadcastToUnix(bc.day, bc.time);
        const episode = estimateCurrentEpisode(item.aired?.from);
        results.push({
          airingAt,
          episode,
          media: {
            id: item.mal_id,
            title: {
              romaji: item.title,
              english: item.title_english || undefined,
            },
            coverImage: {
              large:
                item.images?.jpg?.large_image_url ||
                item.images?.jpg?.image_url ||
                "",
            },
            format: item.type || "TV",
            episodes: item.episodes || undefined,
            averageScore: item.score != null ? Math.round(item.score * 10) : undefined,
            genres: (item.genres || []).map((g: any) => g.name as string),
            status:
              item.status === "Currently Airing"
                ? "RELEASING"
                : item.status === "Finished Airing"
                ? "FINISHED"
                : item.status || "",
          },
        });
      }
    })
  );

  return results.sort((a, b) => a.airingAt - b.airingAt);
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
  const data = await jikanFetch<any>("/seasons/now?limit=25");
  const { year } = getCurrentSeason();

  return (data.data ?? [])
    .filter((item: any) =>
      ["TV", "Movie", "OVA", "ONA", "Special"].includes(item.type)
    )
    .map((item: any): SeasonAnime => ({
      id: item.mal_id,
      title: {
        romaji: item.title,
        english: item.title_english || undefined,
      },
      coverImage: {
        large:
          item.images?.jpg?.large_image_url ||
          item.images?.jpg?.image_url ||
          "",
      },
      format: item.type || "TV",
      episodes: item.episodes || undefined,
      averageScore:
        item.score != null ? Math.round(item.score * 10) : undefined,
      genres: (item.genres || []).map((g: any) => g.name as string),
      status:
        item.status === "Currently Airing"
          ? "RELEASING"
          : item.status === "Finished Airing"
          ? "FINISHED"
          : item.status || "",
      season: (item.season || "spring").toUpperCase(),
      seasonYear: item.year || year,
    }));
}
