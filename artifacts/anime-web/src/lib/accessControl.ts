// accessControl.ts — Sistema de control de acceso diario sin anuncios

import { apiClient } from "@/lib/apiClient";

const STORAGE_KEY = "af_daily_access";
const CONFIG_STORAGE_KEY = "af_limits_config";
export const DAILY_LIMIT = 5; // Fallback por defecto
// Anti-exploit: mínimo de segundos vistos antes de contar un episodio
export const REGISTER_THRESHOLD_SECONDS = 60;

interface DailyAccess {
  count: number;
  date: string; // YYYY-MM-DD
  watchedIds: string[]; // IDs de episodios ya contados hoy (evita doble conteo)
}

interface LimitsConfig {
  dailyLimit: number;
  dailyLimitEnabled: boolean;
  limitMessage: string;
  megafanMessage: string;
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
    return { ...parsed, watchedIds: parsed.watchedIds ?? [] };
  } catch {
    return { count: 0, date: getTodayDate(), watchedIds: [] };
  }
}

function saveAccess(access: DailyAccess): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
  } catch {}
}

// Obtener configuración dinámica del servidor
async function getLimitsConfig(): Promise<LimitsConfig> {
  try {
    // Intentar obtener de localStorage primero (cache)
    const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Verificar si el cache es reciente (menos de 5 minutos)
      if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed.config;
      }
    }

    // Obtener del servidor
    const config = await apiClient.get<LimitsConfig>("/config/limits");

    // Guardar en cache
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
      config,
      timestamp: Date.now()
    }));

    return config;
  } catch (err) {
    console.warn("Error getting limits config:", err);
    // Fallback por defecto
    return {
      dailyLimit: 5,
      dailyLimitEnabled: true,
      limitMessage: "Has alcanzado tu límite diario de episodios gratuitos.",
      megafanMessage: "¡Hazte MegaFan y disfruta sin límites!",
    };
  }
}

/** Verifica si el usuario puede ver otro episodio hoy */
export async function canWatchEpisode(isPremium: boolean): Promise<boolean> {
  if (isPremium) return true;
  const config = await getLimitsConfig();
  if (!config.dailyLimitEnabled) return true;

  const access = getAccess();
  return access.count < config.dailyLimit;
}

/** Versión síncrona para compatibilidad (usa cache) */
export function canWatchEpisodeSync(isPremium: boolean): boolean {
  if (isPremium) return true;

  try {
    const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (!parsed.config.dailyLimitEnabled) return true;

      const access = getAccess();
      return access.count < parsed.config.dailyLimit;
    }
  } catch {}

  // Fallback
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

/** Reinicia el contador manualmente */
export function resetDailyCounter(): void {
  saveAccess({ count: 0, date: getTodayDate(), watchedIds: [] });
}

/** Episodios restantes para hoy (versión síncrona con cache) */
export function getRemainingEpisodes(isPremium: boolean): number {
  if (isPremium) return Infinity;

  try {
    const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const access = getAccess();
      return Math.max(0, parsed.config.dailyLimit - access.count);
    }
  } catch {}

  // Fallback
  const access = getAccess();
  return Math.max(0, DAILY_LIMIT - access.count);
}

/** Episodios restantes para hoy (versión asíncrona) */
export async function getRemainingEpisodesAsync(isPremium: boolean): Promise<number> {
  if (isPremium) return Infinity;
  const config = await getLimitsConfig();
  const access = getAccess();
  return Math.max(0, config.dailyLimit - access.count);
}

/** Cuántos episodios ha visto hoy */
export function getEpisodesWatchedToday(): number {
  return getAccess().count;
}

/** Obtener límite diario actual (versión síncrona con cache) */
export function getCurrentDailyLimit(): number {
  try {
    const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      return parsed.config.dailyLimit;
    }
  } catch {}
  return DAILY_LIMIT;
}

/** Obtener límite diario actual (versión asíncrona) */
export async function getCurrentDailyLimitAsync(): Promise<number> {
  const config = await getLimitsConfig();
  return config.dailyLimit;
}
