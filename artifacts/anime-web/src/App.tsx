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
import { FavoritesProvider } from "@/context/FavoritesContext";
import { HistoryProvider } from "@/context/HistoryContext";
import { WatchProgressProvider } from "@/context/WatchProgressContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { WatchListProvider } from "@/context/WatchListContext";
import { AuthProvider } from "@/context/AuthContext";
import ScrollToTop from "@/components/ScrollToTop";
import AdScript from "@/components/AdScript";

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
    <div style={{ minHeight: "100vh", background: "#090A12", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{
        width: 90, height: 90, borderRadius: "50%",
        background: "linear-gradient(135deg, rgba(108,99,255,0.2), rgba(79,70,229,0.1))",
        border: "2px solid rgba(108,99,255,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 36, marginBottom: 8,
      }}>🎌</div>
      <div style={{ color: "rgba(108,99,255,0.5)", fontSize: 80, fontWeight: 900, lineHeight: 1, letterSpacing: -4 }}>404</div>
      <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 800 }}>Página no encontrada</div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, textAlign: "center", maxWidth: 280 }}>
        Parece que este episodio no existe o fue eliminado.
      </div>
      <a href="/" style={{
        marginTop: 8, display: "inline-flex", alignItems: "center", gap: 8,
        background: "linear-gradient(135deg,#6C63FF,#4F46E5)", borderRadius: 14,
        padding: "12px 24px", color: "#fff", fontSize: 14, fontWeight: 800,
        textDecoration: "none",
      }}>
        ▶ Volver al inicio
      </a>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout() {
  return (
    <main className="page-enter">
      <Router />
      <ScrollToTop />
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
