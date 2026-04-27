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
    <div style={{ padding: "14px 18px 0" }}>
      <div
        style={{
          background: "linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(99,102,241,0.12) 100%)",
          border: "1px solid rgba(220,38,38,0.32)",
          borderRadius: 18,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "rgba(220,38,38,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Bell size={18} color="#FECACA" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>
              {totalNew > 0
                ? `Tienes ${totalNew} ${totalNew === 1 ? "episodio nuevo" : "episodios nuevos"} en tu lista`
                : "Próximos episodios de tu lista"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 2 }}>
              {items.length} {items.length === 1 ? "anime" : "animes"} con novedades
            </div>
          </div>
          <button
            onClick={() => navigate("/watchlist")}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 20,
              padding: "6px 12px",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            Mi lista <ChevronRight size={12} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "thin",
          }}
        >
          {items.slice(0, 10).map((it) => {
            const countdown = formatCountdown(it.timeUntilAiring);
            return (
              <div
                key={it.animeId}
                onClick={() => navigate(`/anime/${it.animeId}`)}
                style={{
                  flex: "0 0 auto",
                  width: 220,
                  display: "flex",
                  gap: 10,
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 8,
                  cursor: "pointer",
                  transition: "transform 0.18s, border-color 0.18s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(220,38,38,0.45)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLDivElement).style.transform = "";
                }}
              >
                <img
                  src={it.image}
                  alt={it.title}
                  loading="lazy"
                  style={{
                    width: 44,
                    height: 60,
                    objectFit: "cover",
                    borderRadius: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div
                    style={{
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {it.title}
                  </div>
                  {it.newEpisodes > 0 ? (
                    <div style={{ color: "#FCA5A5", fontSize: 10, fontWeight: 700, marginTop: 4 }}>
                      +{it.newEpisodes} ep nuevo{it.newEpisodes > 1 ? "s" : ""} · viste {it.lastSeenEpisode}
                    </div>
                  ) : countdown ? (
                    <div style={{ color: "#FCD34D", fontSize: 10, fontWeight: 700, marginTop: 4, display: "flex", alignItems: "center", gap: 3 }}>
                      <Clock size={9} /> Ep {it.nextEpisode} {countdown}
                    </div>
                  ) : (
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 4 }}>
                      Próximamente
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
