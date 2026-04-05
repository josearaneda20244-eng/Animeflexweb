import { Switch, Route, Router as WouterRouter } from "wouter";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import Home from "@/pages/Home";
  import Search from "@/pages/Search";
  import AnimeDetail from "@/pages/AnimeDetail";
  import Player from "@/pages/Player";
  import Favorites from "@/pages/Favorites";
  import History from "@/pages/History";
  import Movies from "@/pages/Movies";
  import OVAs from "@/pages/OVAs";
  import Schedule from "@/pages/Schedule";
  import WatchList from "@/pages/WatchList";
  import Membership from "@/pages/Membership";
  import Settings from "@/pages/Settings";
  import Profile from "@/pages/Profile";
  import PublicProfile from "@/pages/PublicProfile";
  import Admin from "@/pages/Admin";
  import { FavoritesProvider } from "@/context/FavoritesContext";
  import { HistoryProvider } from "@/context/HistoryContext";
  import { WatchProgressProvider } from "@/context/WatchProgressContext";
  import { NotificationsProvider } from "@/context/NotificationsContext";
  import { WatchListProvider } from "@/context/WatchListContext";
  import { AuthProvider } from "@/context/AuthContext";
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
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/search" component={Search} />
        <Route path="/anime/:id" component={AnimeDetail} />
        <Route path="/watch" component={Player} />
        <Route path="/favorites" component={Favorites} />
        <Route path="/history" component={History} />
        <Route path="/movies" component={Movies} />
        <Route path="/ovas" component={OVAs} />
        <Route path="/schedule" component={Schedule} />
        <Route path="/watchlist" component={WatchList} />
        <Route path="/membership" component={Membership} />
        <Route path="/settings" component={Settings} />
        <Route path="/perfil" component={Profile} />
        <Route path="/perfil/:userId" component={PublicProfile} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
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
          <NotificationsProvider>
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
          </NotificationsProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }
  