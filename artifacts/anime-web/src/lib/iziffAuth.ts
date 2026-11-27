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
