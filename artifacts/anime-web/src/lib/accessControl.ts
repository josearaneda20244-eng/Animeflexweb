// accessControl.ts — Sistema de control de acceso diario sin anuncios
// Reemplaza completamente la monetización por anuncios.

const STORAGE_KEY = "af_daily_access";
const DAILY_LIMIT = 3;
// Anti-exploit: mínimo de segundos vistos antes de contar un episodio
export const REGISTER_THRESHOLD_SECONDS = 60;

interface DailyAccess {
  count: number;
  date: string; // YYYY-MM-DD
  watchedIds: string[]; // IDs de episodios ya contados hoy (evita doble conteo)
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getAccess(): DailyAccess {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, date: getTodayDate(), watchedIds: [] };
    const parsed: DailyAccess = JSON.parse(raw);
    // Reinicio automático cada nuevo día
    if (parsed.date !== getTodayDate()) {
      return { count: 0, date: getTodayDate(), watchedIds: [] };
    }
    return { watchedIds: [], ...parsed };
  } catch {
    return { count: 0, date: getTodayDate(), watchedIds: [] };
  }
}

function saveAccess(access: DailyAccess): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
  } catch {}
}

/** Verifica si el usuario puede ver otro episodio hoy */
export function canWatchEpisode(isPremium: boolean): boolean {
  if (isPremium) return true;
  const access = getAccess();
  return access.count < DAILY_LIMIT;
}

/**
 * Registra la visualización de un episodio.
 * Anti-exploit: solo cuenta una vez por episodeId por día.
 * @returns true si se registró, false si ya estaba registrado
 */
export function registerEpisodeView(episodeId: string): boolean {
  const access = getAccess();
  // No contar episodios ya contados hoy (evita exploit de refresco)
  if (access.watchedIds.includes(episodeId)) return false;
  saveAccess({
    ...access,
    count: access.count + 1,
    watchedIds: [...access.watchedIds, episodeId],
  });
  return true;
}

/** Reinicia el contador manualmente (se llama automáticamente con getAccess) */
export function resetDailyCounter(): void {
  saveAccess({ count: 0, date: getTodayDate(), watchedIds: [] });
}

/** Episodios restantes para hoy */
export function getRemainingEpisodes(isPremium: boolean): number {
  if (isPremium) return Infinity;
  const access = getAccess();
  return Math.max(0, DAILY_LIMIT - access.count);
}

/** Cuántos episodios ha visto hoy */
export function getEpisodesWatchedToday(): number {
  return getAccess().count;
}
