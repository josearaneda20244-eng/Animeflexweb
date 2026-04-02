import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import AnimeDetail from "@/pages/AnimeDetail";
import Player from "@/pages/Player";
import Favorites from "@/pages/Favorites";
import History from "@/pages/History";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { HistoryProvider } from "@/context/HistoryContext";
import { WatchProgressProvider } from "@/context/WatchProgressContext";

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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#090A12" }}>
      <div className="text-center text-[#4A4A6A]">
        <p className="text-6xl font-bold text-[#1A1A27] mb-4">404</p>
        <p className="text-[#F0F0FF] font-medium mb-2">Página no encontrada</p>
        <a href="/" className="text-sm text-[#6C63FF] hover:underline">Volver al inicio</a>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function Layout() {
  return (
    <main>
      <Router />
    </main>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WatchProgressProvider>
        <FavoritesProvider>
          <HistoryProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Layout />
            </WouterRouter>
          </HistoryProvider>
        </FavoritesProvider>
      </WatchProgressProvider>
    </QueryClientProvider>
  );
}
