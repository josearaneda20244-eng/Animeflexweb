/**
 * Recuerda en este navegador qué servidores reproducen bien y cuáles fallan,
 * para poner siempre primero el más estable (igual que la app).
 * Clave: el nombre del servidor ("AnimeFLV · VOE · Directo", "AnimeAV1 · Zilla · HLS"…).
 */
const STORE_KEY = "iz_source_health";
const MAX_RESULTS = 12;

type Store = Record<string, number[]>; // 1 = reprodujo, 0 = falló (más reciente al final)

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: Store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* modo privado */ }
}

export function sourceHealthKey(server?: string): string {
  return (server ?? "").trim().toLowerCase();
}

export function recordSourceHealth(server: string | undefined, ok: boolean) {
  const key = sourceHealthKey(server);
  if (!key) return;
  const store = load();
  const list = [...(store[key] ?? []), ok ? 1 : 0].slice(-MAX_RESULTS);
  store[key] = list;
  save(store);
}

/** 0…1. Sin historial = 0.5. Los resultados recientes pesan más. */
export function sourceHealthScore(server: string | undefined, store: Store = load()): number {
  const list = store[sourceHealthKey(server)] ?? [];
  let ok = 1, total = 2; // prior neutro
  list.forEach((v, i) => {
    const w = 1 + i / list.length; // lo reciente pesa hasta 2x
    ok += v * w;
    total += w;
  });
  return ok / total;
}

/**
 * Ordena las fuentes por estabilidad sin romper el orden del servidor cuando la
 * diferencia es pequeña (el servidor ya ordena por estabilidad global).
 */
export function sortSourcesByHealth<T>(sources: T[]): T[] {
  const store = load();
  return sources
    .map((s, i) => ({ s, i, score: sourceHealthScore((s as { server?: string } | null)?.server, store) }))
    .sort((a, b) => (Math.abs(b.score - a.score) > 0.12 ? b.score - a.score : a.i - b.i))
    .map(x => x.s);
}
