import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Lazy load pages for better performance
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
  import { FavoritesProvider } from "@/context/FavoritesContext";
  import { HistoryProvider } from "@/context/HistoryContext";
  import { WatchProgressProvider } from "@/context/WatchProgressContext";
  import { NotificationsProvider } from "@/context/NotificationsContext";
  import { WatchListProvider } from "@/context/WatchListContext";
  import { AuthProvider } from "@/context/AuthContext";
  import { NotificationProvider } from "@/components/NotificationManager";
  import ScrollToTop from "@/components/ScrollToTop";
  import AdScript from "@/components/AdScript";
  import AnnouncementBanner from "@/components/AnnouncementBanner";
  import InstallPrompt from "@/components/InstallPrompt";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 2,
        staleTime: 1000 * 60 * 5,
      },
    },
  });

  function NotFound() {
    return (
      <div style={{ minHeight: "100vh", background: "#090A12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, padding: 24, position: "relative", overflow: "hidden" }}>
        {/* Background glow blobs */}
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(108,99,255,0.12) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(236,72,153,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />

        {/* Floating kanji decorations */}
        <div style={{ position: "absolute", top: 40, left: 24, color: "rgba(108,99,255,0.07)", fontSize: 120, fontWeight: 900, userSelect: "none", lineHeight: 1 }}>迷</div>
        <div style={{ position: "absolute", bottom: 40, right: 24, color: "rgba(108,99,255,0.07)", fontSize: 120, fontWeight: 900, userSelect: "none", lineHeight: 1 }}>子</div>

        {/* Main icon */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <div style={{
            width: 110, height: 110, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(108,99,255,0.2), rgba(79,70,229,0.08))",
            border: "2px solid rgba(108,99,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52,
          }}>🎌</div>
          <div style={{ position: "absolute", top: -8, right: -8, background: "linear-gradient(135deg,#EF4444,#DC2626)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "2px solid #090A12" }}>！</div>
        </div>

        {/* 404 number */}
        <div style={{ color: "transparent", fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -6, background: "linear-gradient(135deg,#6C63FF,#A78BFA,#EC4899)", WebkitBackgroundClip: "text", backgroundClip: "text", marginBottom: 12 } as any}>404</div>

        <div style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Página no encontrada</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 300, lineHeight: 1.7, marginBottom: 24 }}>
          El capitán no encontró este episodio. Puede que haya sido movido o eliminado del servidor.
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <a href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg,#6C63FF,#4F46E5)", borderRadius: 14,
            padding: "12px 24px", color: "#fff", fontSize: 14, fontWeight: 800,
            textDecoration: "none", boxShadow: "0 8px 24px rgba(108,99,255,0.35)",
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

  function Router() {
    return (
      <Suspense fallback={<div style={{ minHeight: "100vh", background: "#090A12", display: "flex", alignItems: "center", justifyContent: "center" }}><div>Cargando...</div></div>}>
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
      <main className="page-enter">
        <AnnouncementBanner />
        <Router />
        <ScrollToTop />
        <InstallPrompt />
      </main>
    );
  }

  export default function App() {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AdScript />
          <NotificationProvider>
            <WatchProgressProvider>
              <WatchListProvider>
                <FavoritesProvider>
                  <HistoryProvider>
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
    );
  }
  