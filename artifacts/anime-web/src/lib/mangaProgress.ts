/** Progreso de lectura de manga guardado en el dispositivo (localStorage). */
export interface MangaProgress {
  mangaId: string;
  mangaTitle: string;
  mangaImage?: string;
  chapterId: string;
  chapterNumber?: string | number;
  /** Página (índice base 0) donde se quedó el lector */
  page: number;
  totalPages: number;
  updatedAt: number;
}

const PROGRESS_KEY = "iz_manga_progress";
const READ_KEY = "iz_manga_read";
const MAX_MANGAS = 60;
const MAX_READ_PER_MANGA = 2000;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* cuota llena o modo privado */ }
}

export function getAllMangaProgress(): MangaProgress[] {
  const map = readJson<Record<string, MangaProgress>>(PROGRESS_KEY, {});
  return Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getMangaProgress(mangaId: string): MangaProgress | undefined {
  return readJson<Record<string, MangaProgress>>(PROGRESS_KEY, {})[mangaId];
}

export function saveMangaProgress(p: Omit<MangaProgress, "updatedAt">) {
  const map = readJson<Record<string, MangaProgress>>(PROGRESS_KEY, {});
  map[p.mangaId] = { ...p, updatedAt: Date.now() };
  const entries = Object.values(map).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_MANGAS);
  writeJson(PROGRESS_KEY, Object.fromEntries(entries.map((e) => [e.mangaId, e])));
}

export function removeMangaProgress(mangaId: string) {
  const map = readJson<Record<string, MangaProgress>>(PROGRESS_KEY, {});
  delete map[mangaId];
  writeJson(PROGRESS_KEY, map);
}

export function getReadChapters(mangaId: string): Set<string> {
  return new Set(readJson<Record<string, string[]>>(READ_KEY, {})[mangaId] ?? []);
}

export function markChapterRead(mangaId: string, chapterId: string) {
  const map = readJson<Record<string, string[]>>(READ_KEY, {});
  const list = map[mangaId] ?? [];
  if (list.includes(chapterId)) return;
  list.push(chapterId);
  map[mangaId] = list.slice(-MAX_READ_PER_MANGA);
  writeJson(READ_KEY, map);
}

/** Preferencias del lector */
export type ReaderMode = "webtoon" | "paged";
export interface ReaderPrefs { mode: ReaderMode; width: number; gap: boolean }
const PREFS_KEY = "iz_reader_prefs";
export const DEFAULT_PREFS: ReaderPrefs = { mode: "webtoon", width: 820, gap: false };
export function getReaderPrefs(): ReaderPrefs { return { ...DEFAULT_PREFS, ...readJson<Partial<ReaderPrefs>>(PREFS_KEY, {}) }; }
export function saveReaderPrefs(p: ReaderPrefs) { writeJson(PREFS_KEY, p); }
