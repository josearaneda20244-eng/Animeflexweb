import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bell, ChevronRight, Clock } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";

interface NewEpItem {
  animeId: string;
  title: string;
  image: string;
  airedEpisodes: number;
  lastSeenEpisode: number;
  newEpisodes: number;
  nextEpisode: number | null;
  nextAiringAt: number | null;
  timeUntilAiring: number | null;
  status: string;
}

function formatCountdown(secs: number | null): string | null {
  if (!secs || secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h >= 24) return `en ${Math.floor(h / 24)}d`;
  if (h >= 1) return `en ${h}h ${m}m`;
  return `en ${m}m`;
}

export default function WatchlistNewEpisodesBanner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data } = useQuery({
    queryKey: ["watchlist-new-episodes", user?.id],
    queryFn: () => apiClient.get<{ items: NewEpItem[] }>("/user/watchlist/new-episodes"),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 0,
  });

  if (!user) return null;
  const items = data?.items ?? [];
  if (items.length === 0) return null;

  const totalNew = items.reduce((acc, it) => acc + it.newEpisodes, 0);

  return (
    <section className="iz-panel iz-panel--pad" style={{ marginTop: 8, background: "radial-gradient(ellipse at 0% 0%, rgba(63,46,178,.28), transparent 55%), #0a0a0a" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <span className="iz-avatar" style={{ background: "rgba(63,46,178,.3)", borderColor: "rgba(99,102,241,.4)" }}><Bell size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {totalNew > 0 ? `${totalNew} ${totalNew === 1 ? "episodio nuevo" : "episodios nuevos"} en tu lista` : "Próximos episodios de tu lista"}
          </div>
          <div style={{ color: "var(--iz-dim)", fontSize: 12, marginTop: 2 }}>{items.length} {items.length === 1 ? "anime" : "animes"} con novedades</div>
        </div>
        <button type="button" className="iz-head__link" onClick={() => navigate("/watchlist")}>Mi lista <ChevronRight size={14} /></button>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none" }}>
        {items.slice(0, 12).map((it) => {
          const countdown = formatCountdown(it.timeUntilAiring);
          return (
            <button key={it.animeId} type="button" onClick={() => navigate(`/anime/${it.animeId}`)} className="iz-discussion iz-panel" style={{ flex: "0 0 auto", width: 250, gridTemplateColumns: "44px minmax(0,1fr)", padding: 8, alignItems: "center", background: "rgba(0,0,0,.4)" }}>
              <img src={it.image} alt="" loading="lazy" style={{ width: 44, height: 60 }} />
              <span style={{ minWidth: 0, display: "grid", gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                {it.newEpisodes > 0
                  ? <span style={{ color: "#c7d2fe", fontSize: 12 }}>+{it.newEpisodes} nuevo{it.newEpisodes > 1 ? "s" : ""} · viste el {it.lastSeenEpisode}</span>
                  : countdown
                    ? <span style={{ color: "var(--iz-muted)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> Ep {it.nextEpisode} {countdown}</span>
                    : <span style={{ color: "var(--iz-dim)", fontSize: 12 }}>Próximamente</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
