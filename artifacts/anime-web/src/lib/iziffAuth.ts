/**
 * Cuentas IZIFF: las mismas de la app móvil (servicio IZIFF Auth).
 * El navegador habla directo con el servicio (CORS abierto) y luego el backend
 * de la web cambia ese token por la sesión de la web (/auth/iziff).
 */
export const IZIFF_AUTH_URL = (
  (import.meta.env.VITE_IZIFF_AUTH_URL as string | undefined) || "https://iziff-auth.josearaneda2025.workers.dev"
).replace(/\/+$/, "");

async function call<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${IZIFF_AUTH_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor de cuentas. Revisa tu conexión.");
  }
  let data: any = {};
  try { data = await res.json(); } catch { /* */ }
  if (!res.ok) throw new Error(data?.message || data?.error || `Error del servidor (${res.status})`);
  return data as T;
}

type Session = { accessToken: string; refreshToken: string };

export const iziffAuth = {
  login: (identifier: string, password: string) => call<Session>("/v1/auth/login", { identifier, password }),
  registerStart: (username: string, email: string) =>
    call<{ ok: boolean; message?: string }>("/v1/auth/register/start", { username, email }),
  register: (username: string, email: string, password: string, code: string) =>
    call<Session>("/v1/auth/register", { username, email, password, code }),
  forgot: (email: string) => call<{ ok: boolean; message?: string }>("/v1/auth/password/forgot", { email }),
  reset: (email: string, code: string, password: string) =>
    call<Session>("/v1/auth/password/reset", { email, code, password }),
};

/* ── Sesión IZIFF guardada en el navegador (para salas "Ver juntos") ───────── */
const SESSION_KEY = "iz_iziff_session";
const ACCESS_TTL_MS = 12 * 60 * 1000; // el servidor da 15 min; se renueva antes

type StoredSession = Session & { at: number };

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as StoredSession) : null;
    return s?.accessToken && s?.refreshToken ? s : null;
  } catch { return null; }
}

export function saveIziffSession(s: Session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: s.accessToken, refreshToken: s.refreshToken, at: Date.now() })); } catch { /* */ }
}

export function clearIziffSession() {
  const s = readSession();
  try { localStorage.removeItem(SESSION_KEY); } catch { /* */ }
  if (s) {
    fetch(`${IZIFF_AUTH_URL}/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.accessToken}` },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
      keepalive: true,
    }).catch(() => {});
  }
}

export function hasIziffSession() {
  return !!readSession();
}

let refreshing: Promise<string | null> | null = null;

/** Token de acceso vigente (lo renueva si hace falta). null = hay que iniciar sesión. */
export async function getIziffAccessToken(force = false): Promise<string | null> {
  const s = readSession();
  if (!s) return null;
  if (!force && Date.now() - s.at < ACCESS_TTL_MS) return s.accessToken;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const next = await call<Session>("/v1/auth/refresh", { refreshToken: s.refreshToken });
        saveIziffSession(next);
        return next.accessToken;
      } catch (err) {
        // Sesión vencida: hay que volver a entrar
        if (err instanceof Error && /vencio|venció|valida|válida|401/i.test(err.message)) {
          try { localStorage.removeItem(SESSION_KEY); } catch { /* */ }
        }
        return null;
      } finally {
        setTimeout(() => { refreshing = null; }, 0);
      }
    })();
  }
  return refreshing;
}

/** Llamada autenticada al servicio IZIFF (reintenta una vez renovando la sesión). */
export async function iziffAuthed<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getIziffAccessToken(attempt > 0);
    if (!token) throw new Error("Inicia sesión de nuevo para usar las salas.");
    let res: Response;
    try {
      res = await fetch(`${IZIFF_AUTH_URL}${path}`, {
        method: init.method ?? "GET",
        headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
    } catch {
      throw new Error("No se pudo conectar con el servidor de salas.");
    }
    let data: any = {};
    try { data = await res.json(); } catch { /* */ }
    if (res.status === 401 && attempt === 0) continue;
    if (!res.ok) throw new Error(data?.message || `Error del servidor (${res.status})`);
    return data as T;
  }
  throw new Error("Inicia sesión de nuevo para usar las salas.");
}
