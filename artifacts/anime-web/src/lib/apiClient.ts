const API = import.meta.env.VITE_API_BASE_URL ?? "/api";

function getToken(): string | null {
  try { return localStorage.getItem("af_token"); } catch { return null; }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(res.ok ? "Respuesta inesperada del servidor" : `Error del servidor (${res.status})`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Error del servidor");
  return data as T;
}

export const apiClient = {
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  get: <T>(path: string) => request<T>(path),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
