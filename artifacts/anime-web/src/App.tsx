import { lazy, Suspense, useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { HistoryProvider } from "@/context/HistoryContext";
import { WatchProgressProvider } from "@/context/WatchProgressContext";
import { WatchListProvider } from "@/context/WatchListContext";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/components/NotificationManager";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import AdScript from "@/components/AdScript";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import InstallPrompt from "@/components/InstallPrompt";
import { useAuth } from "@/context/AuthContext";
import { useLimitsConfig } from "@/hooks/use-limits-config";

const Home = lazy(() => import("@/pages/Home"));
const Search = lazy(() => import("@/pages/Search"));
const AnimeDetail = lazy(() => import("@/pages/AnimeDetail"));
const Player = lazy(() => import("@/pages/Player"));
const Favorites = lazy(() => import("@/pages/Favorites"));
const History = lazy(() => import("@/pages/History"));
const Movies = lazy(() => import("@/pages/Movies"));
const OVAs = lazy(() => import("@/pages/OVAs"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const WatchList = lazy(() => import("@/pages/WatchList"));
const Membership = lazy(() => import("@/pages/Membership"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const Admin = lazy(() => import("@/pages/Admin"));
const Feed = lazy(() => import("@/pages/Feed"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function AnimatedBackground() {
  return (
    <div className="animated-bg">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,111,255,0.14) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(244,114,182,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 40, left: 24, color: "rgba(124,111,255,0.07)", fontSize: 120, fontWeight: 900, userSelect: "none", lineHeight: 1 }}>迷</div>
      <div style={{ position: "absolute", bottom: 40, right: 24, color: "rgba(124,111,255,0.07)", fontSize: 120, fontWeight: 900, userSelect: "none", lineHeight: 1 }}>子</div>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <div style={{
          width: 110, height: 110, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(124,111,255,0.22), rgba(255,255,255,0.08))",
          border: "2px solid rgba(124,111,255,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52,
          boxShadow: "0 0 40px rgba(124,111,255,0.3)",
        }}>🎌</div>
        <div style={{ position: "absolute", top: -8, right: -8, background: "linear-gradient(135deg,#EF4444,#DC2626)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "2px solid #000", boxShadow: "0 0 12px rgba(239,68,68,0.4)" }}>！</div>
      </div>
      <div style={{ color: "transparent", fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -6, background: "linear-gradient(135deg,#7C6FFF,#B39DFF,#F472B6)", WebkitBackgroundClip: "text", backgroundClip: "text", marginBottom: 12 } as any}>404</div>
      <div style={{ color: "#F0F0FA", fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Página no encontrada</div>
      <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, textAlign: "center", maxWidth: 300, lineHeight: 1.7, marginBottom: 24 }}>
        El capitán no encontró este episodio. Puede que haya sido movido o eliminado del servidor.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <a href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", borderRadius: 14,
          padding: "12px 24px", color: "#fff", fontSize: 14, fontWeight: 800,
          textDecoration: "none", boxShadow: "0 8px 28px rgba(124,111,255,0.4)",
        }}>▶ Volver al inicio</a>
        <a href="/search" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
          padding: "12px 24px", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 700,
          textDecoration: "none",
        }}>🔍 Buscar anime</a>
      </div>
    </div>
  );
}

function formatMaintenanceTime(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function MaintenanceOverlay() {
  const [location] = useLocation();
  const { isOwner, loading } = useAuth();
  const { config } = useLimitsConfig();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!config.maintenanceMode) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [config.maintenanceMode]);

  if (!config.maintenanceMode || loading || isOwner || location.startsWith("/admin")) return null;

  const endTime = config.maintenanceUntil ? new Date(config.maintenanceUntil).getTime() : 0;
  const remaining = endTime ? endTime - now : 0;
  const countdown = endTime && remaining > 0 ? formatMaintenanceTime(remaining) : "Pronto volveremos";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "radial-gradient(circle at 50% 20%, rgba(124,111,255,0.28), transparent 28%), rgba(0,0,0,0.92)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, pointerEvents: "auto" }}>
      <div style={{ width: "min(92vw, 520px)", background: "linear-gradient(145deg, rgba(15,15,30,0.98), rgba(4,4,10,0.98))", border: "1px solid rgba(124,111,255,0.32)", borderRadius: 28, padding: "34px 28px", textAlign: "center", boxShadow: "0 32px 100px rgba(0,0,0,0.72), 0 0 70px rgba(124,111,255,0.18)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(124,111,255,0.12), transparent 45%, rgba(245,158,11,0.08))", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ width: 76, height: 76, borderRadius: 24, margin: "0 auto 20px", background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 48px rgba(124,111,255,0.42)", fontSize: 34 }}>
            🛠️
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#FBBF24", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.24)", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 900, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Modo mantenimiento activo
          </div>
          <h1 style={{ color: "#F8FAFC", fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.05, margin: "0 0 12px", fontWeight: 950, letterSpacing: -1.4 }}>
            Estamos mejorando AnimeFlex
          </h1>
          <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 15, lineHeight: 1.7, margin: "0 auto 24px", maxWidth: 420 }}>
            {config.maintenanceMessage || "Estamos en mantenimiento, mejorando la plataforma y arreglando errores para que vuelvas a disfrutar mejor."}
          </p>
          <div style={{ background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "18px 16px", marginBottom: 20 }}>
            <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              Tiempo estimado
            </div>
            <div style={{ color: "#B39DFF", fontSize: "clamp(34px, 10vw, 54px)", fontWeight: 950, letterSpacing: -1.5, fontVariantNumeric: "tabular-nums" }}>
              {countdown}
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, lineHeight: 1.6 }}>
            La navegación está pausada temporalmente. Gracias por tu paciencia.
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}><div style={{ color: "rgba(255,255,255,0.45)", fontSize: 15 }}>Cargando...</div></div>}>
      <Switch>
        <Route path="/"><Home /></Route>
        <Route path="/search"><Search /></Route>
        <Route path="/anime/:id"><AnimeDetail /></Route>
        <Route path="/watch"><Player /></Route>
        <Route path="/favorites"><Favorites /></Route>
        <Route path="/history"><History /></Route>
        <Route path="/movies"><Movies /></Route>
        <Route path="/ovas"><OVAs /></Route>
        <Route path="/schedule"><Schedule /></Route>
        <Route path="/watchlist"><WatchList /></Route>
        <Route path="/membership"><Membership /></Route>
        <Route path="/settings"><Settings /></Route>
        <Route path="/perfil"><Profile /></Route>
        <Route path="/profile"><Profile /></Route>
        <Route path="/perfil/:userId"><PublicProfile /></Route>
        <Route path="/profile/:userId"><PublicProfile /></Route>
        <Route path="/admin"><Admin /></Route>
        <Route path="/feed"><Feed /></Route>
        <Route path="/reset-password"><ResetPassword /></Route>
        <Route path="/verify-email"><VerifyEmail /></Route>
        <Route><NotFound /></Route>
      </Switch>
    </Suspense>
  );
}

function Layout() {
  return (
    <main className="page-enter page-transition" style={{ position: "relative", zIndex: 1, minHeight: "100vh", overflow: "hidden" }}>
      <AnnouncementBanner />
      <Router />
      <MaintenanceOverlay />
      <ScrollToTop />
      <InstallPrompt />
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AdScript />
          <NotificationProvider>
            <WatchProgressProvider>
              <WatchListProvider>
                <FavoritesProvider>
                  <HistoryProvider>
                    <AnimatedBackground />
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                      <Layout />
                    </WouterRouter>
                  </HistoryProvider>
                </FavoritesProvider>
              </WatchListProvider>
            </WatchProgressProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
