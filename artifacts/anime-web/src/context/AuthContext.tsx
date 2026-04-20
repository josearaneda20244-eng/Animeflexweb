import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient } from "@/lib/apiClient";

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
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isMegaFan: boolean;
  isOwner: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { username?: string; avatar_url?: string; is_profile_public?: boolean }) => Promise<void>;
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

    let alive = true;

    // Safety: never block the UI more than 6 seconds waiting for the server.
    // If the server is slow/down, just show the app (user will appear logged out
    // until the request eventually resolves).
    const safetyTimer = setTimeout(() => {
      if (alive) setLoading(false);
    }, 6000);

    fetchUser()
      .catch(() => { localStorage.removeItem("af_token"); setToken(null); })
      .finally(() => {
        clearTimeout(safetyTimer);
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      clearTimeout(safetyTimer);
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    const { token: t, user: u } = await apiClient.post<{ token: string; user: AuthUser }>(
      "/auth/login", { email, password }
    );
    localStorage.setItem("af_token", t);
    setToken(t);
    setUser(u);
  };

  const register = async (username: string, email: string, password: string) => {
    const { token: t, user: u } = await apiClient.post<{ token: string; user: AuthUser }>(
      "/auth/register", { username, email, password }
    );
    localStorage.setItem("af_token", t);
    setToken(t);
    setUser(u);
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

  const updateProfile = async (data: { username?: string; avatar_url?: string; is_profile_public?: boolean }) => {
    const { user: updated } = await apiClient.patch<{ user: AuthUser }>("/auth/me", data);
    setUser(updated);
  };

  const isMegaFan = user?.membership_tier === "megafan";
  const isOwner = user?.role === "owner" || user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, token, loading, isMegaFan, isOwner, login, register, logout, refreshUser, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
