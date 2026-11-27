import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient } from "@/lib/apiClient";
import { iziffAuth } from "@/lib/iziffAuth";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
  membership_tier: "free" | "megafan";
  subscription_expires_at: string | null;
  role: "user" | "owner" | "admin";
  is_profile_public: boolean;
  email_verified: boolean;
  bio: string | null;
  banner_preset: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isMegaFan: boolean;
  isOwner: boolean;
  /** Correo o usuario + contraseña de la cuenta IZIFF (la misma de la app) */
  login: (identifier: string, password: string) => Promise<void>;
  /** Paso 1 del registro: envía el código al correo */
  registerStart: (username: string, email: string) => Promise<string>;
  /** Paso 2 del registro: crea la cuenta con el código */
  register: (username: string, email: string, password: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (email: string, code: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { username?: string; avatar_url?: string; is_profile_public?: boolean; bio?: string | null; banner_preset?: string | null }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem("af_token"); } catch { return null; }
  });
  const [loading, setLoading] = useState(!!token);

  const fetchUser = async () => {
    return apiClient.get<{ user: AuthUser }>("/auth/me").then(({ user }) => setUser(user));
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchUser()
      .catch(() => { localStorage.removeItem("af_token"); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  // Cambia la sesión IZIFF (app) por la sesión de la web
  const exchange = async (accessToken: string) => {
    const { token: t, user: u } = await apiClient.post<{ token: string; user: AuthUser }>(
      "/auth/iziff", { accessToken }
    );
    localStorage.setItem("af_token", t);
    setToken(t);
    setUser(u);
  };

  const login = async (identifier: string, password: string) => {
    const s = await iziffAuth.login(identifier.trim(), password);
    await exchange(s.accessToken);
  };

  const registerStart = async (username: string, email: string) => {
    const r = await iziffAuth.registerStart(username.trim(), email.trim());
    return r.message ?? "Te enviamos un código a tu correo.";
  };

  const register = async (username: string, email: string, password: string, code: string) => {
    const s = await iziffAuth.register(username.trim(), email.trim(), password, code.trim());
    await exchange(s.accessToken);
  };

  const forgotPassword = async (email: string) => {
    const r = await iziffAuth.forgot(email.trim());
    return r.message ?? "Si el correo está registrado, recibirás un código.";
  };

  const resetPassword = async (email: string, code: string, password: string) => {
    const s = await iziffAuth.reset(email.trim(), code.trim(), password);
    await exchange(s.accessToken);
  };

  const logout = () => {
    localStorage.removeItem("af_token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    await fetchUser().catch(() => {});
  };

  const updateProfile = async (data: { username?: string; avatar_url?: string; is_profile_public?: boolean; bio?: string | null; banner_preset?: string | null }) => {
    const { user: updated } = await apiClient.patch<{ user: AuthUser }>("/auth/me", data);
    setUser(updated);
  };

  const isMegaFan = user?.membership_tier === "megafan";
  const isOwner = user?.role === "owner" || user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, token, loading, isMegaFan, isOwner, login, registerStart, register, forgotPassword, resetPassword, logout, refreshUser, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
