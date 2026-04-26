/**
 * Validaciones de seguridad para inputs de usuario.
 * Centralizar aquí evita inconsistencias entre rutas.
 */

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const SAFE_URL_RE = /^https?:\/\//i;

export function validateEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v.length < 5 || v.length > 254) return null;
  if (!EMAIL_RE.test(v)) return null;
  return v;
}

export function validateUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!USERNAME_RE.test(v)) return null;
  return v;
}

export interface PasswordCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Política de contraseña:
 *  - Mínimo 8 caracteres
 *  - Al menos una letra y un número
 *  - Máximo 128 caracteres (evita ataques de DoS sobre bcrypt)
 */
export function validatePassword(raw: unknown): PasswordCheck {
  if (typeof raw !== "string") return { ok: false, reason: "Contraseña requerida" };
  if (raw.length < 8) return { ok: false, reason: "La contraseña debe tener al menos 8 caracteres" };
  if (raw.length > 128) return { ok: false, reason: "La contraseña es demasiado larga (máx. 128)" };
  if (!/[a-zA-Z]/.test(raw)) return { ok: false, reason: "La contraseña debe incluir al menos una letra" };
  if (!/\d/.test(raw)) return { ok: false, reason: "La contraseña debe incluir al menos un número" };
  return { ok: true };
}

/**
 * Devuelve la URL si es segura (http/https) o null si no.
 * Bloquea esquemas peligrosos como javascript:, data:, vbscript:, file:, etc.
 */
export function validateSafeUrl(raw: unknown, maxLen = 2048): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.length > maxLen) return null;
  if (!SAFE_URL_RE.test(v)) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}
