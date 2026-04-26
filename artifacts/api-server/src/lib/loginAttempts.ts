/**
 * Tracker de intentos de login en memoria.
 * Bloquea temporalmente combinaciones (email + IP) tras N intentos fallidos.
 *
 * Pros: cero schema changes, instantáneo.
 * Cons: se reinicia con el server. Para prod multi-instancia conviene usar Redis.
 */

interface AttemptRecord {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 min
const LOCK_MS = 15 * 60 * 1000;   // 15 min de bloqueo tras superar el límite

const store = new Map<string, AttemptRecord>();

function key(email: string, ip: string): string {
  return `${email.toLowerCase()}::${ip}`;
}

/**
 * Llamar ANTES de validar la contraseña.
 * Devuelve `null` si está permitido, o un objeto con segundos restantes si está bloqueado.
 */
export function checkLockout(email: string, ip: string): { lockedFor: number } | null {
  const k = key(email, ip);
  const rec = store.get(k);
  if (!rec) return null;

  // Limpiar ventana caducada
  if (Date.now() - rec.firstAt > WINDOW_MS && !rec.lockedUntil) {
    store.delete(k);
    return null;
  }

  if (rec.lockedUntil && Date.now() < rec.lockedUntil) {
    return { lockedFor: Math.ceil((rec.lockedUntil - Date.now()) / 1000) };
  }
  if (rec.lockedUntil && Date.now() >= rec.lockedUntil) {
    store.delete(k);
    return null;
  }
  return null;
}

/**
 * Llamar tras un intento FALLIDO. Incrementa el contador y bloquea si toca.
 * Devuelve cuántos intentos quedan, o un objeto con segundos de bloqueo si se acabó de bloquear.
 */
export function registerFailure(email: string, ip: string): { remaining?: number; lockedFor?: number } {
  const k = key(email, ip);
  const now = Date.now();
  let rec = store.get(k);
  if (!rec || now - rec.firstAt > WINDOW_MS) {
    rec = { count: 1, firstAt: now };
    store.set(k, rec);
    return { remaining: MAX_ATTEMPTS - 1 };
  }
  rec.count += 1;
  if (rec.count >= MAX_ATTEMPTS) {
    rec.lockedUntil = now + LOCK_MS;
    return { lockedFor: Math.ceil(LOCK_MS / 1000) };
  }
  return { remaining: MAX_ATTEMPTS - rec.count };
}

/** Llamar tras un login EXITOSO para limpiar el contador. */
export function clearAttempts(email: string, ip: string): void {
  store.delete(key(email, ip));
}

/** Limpieza periódica para no acumular entradas viejas en memoria. */
setInterval(() => {
  const now = Date.now();
  for (const [k, rec] of store.entries()) {
    const expired = rec.lockedUntil
      ? now >= rec.lockedUntil
      : now - rec.firstAt > WINDOW_MS;
    if (expired) store.delete(k);
  }
}, 5 * 60 * 1000).unref?.();
