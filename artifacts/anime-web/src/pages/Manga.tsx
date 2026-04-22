import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, TrendingUp, Clock, ChevronLeft, ChevronRight, Star, X, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SystemTag, MagicCircle } from "@/components/SystemUI";


interface MangaResult {
  id: string;
  title: string | { english?: string; romaji?: string; userPreferred?: string; native?: string };
  image?: string;
  cover?: string;
  description?: string;
  status?: string;
  genres?: string[];
  rating?: number;
  volumes?: number;
  chapters?: number;
}

interface MangaListResponse {
  results: MangaResult[];
  hasNextPage?: boolean;
  currentPage?: number;
}

function resolveTitle(title: MangaResult["title"]): string {
  if (!title) return "Sin título";
  if (typeof title === "string") return title;
  return title.english || title.romaji || title.userPreferred || title.native || "Sin título";
}

function MangaCard({ manga, onClick }: { manga: MangaResult; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  const title = resolveTitle(manga.title);
  return (
    <div className="sys-card" onClick={onClick}>
      <div className="sys-card-img-wrap">
        {!imgError && manga.image ? (
          <img src={manga.image} alt={title} onError={() => setImgError(true)} loading="lazy" />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1a0b0b,#2a0808)" }}>
            <BookOpen size={40} color="rgba(255,255,255,0.15)" />
          </div>
        )}
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        {manga.status && (
          <div className={`sys-tag ${manga.status === "Completed" ? "success" : ""}`}>
            {manga.status === "Completed" ? "■ Completo" : manga.status === "Ongoing" ? "▶ En curso" : manga.status}
          </div>
        )}
        {manga.rating != null && manga.rating > 0 && (
          <div className="sys-tag gold" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Star size={9} fill="#FCD34D" /> {(manga.rating / 10).toFixed(1)}
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 6, position: "relative", zIndex: 2 }}>
        <div style={{ color: "#FECACA", fontSize: 13, fontWeight: 800, lineHeight: 1.3, letterSpacing: 0.2 }} className="line-clamp-2">{title}</div>
        {manga.genres && manga.genres.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {manga.genres.slice(0, 2).map(g => (
              <span key={g} style={{
                background: "rgba(220,38,38,0.18)",
                color: "#FCA5A5",
                fontSize: 9.5,
                fontWeight: 700,
                padding: "2px 7px",
                letterSpacing: 0.5,
                textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                border: "1px solid rgba(220,38,38,0.3)",
                clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
              }}>{g}</span>
            ))}
          </div>
        )}
        {manga.chapters != null && (
          <div style={{ color: "rgba(253,186,116,0.65)", fontSize: 10.5, marginTop: 2, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1 }}>
            ✦ {manga.chapters} CAPS
          </div>
        )}
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const TABS = [
  { id: "trending", label: "Populares", icon: <TrendingUp size={13} /> },
  { id: "recent", label: "Recientes", icon: <Clock size={13} /> },
];

export default function Manga() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"trending" | "recent">("trending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebounce(query, 400);
  const isSearching = debouncedQuery.trim().length >= 2;

  const trendingQuery = useQuery<MangaListResponse>({
    queryKey: ["manga", "trending", page],
    queryFn: () => apiClient.get<MangaListResponse>(`/manga/trending?page=${page}`),
    enabled: !isSearching && tab === "trending",
    staleTime: 1000 * 60 * 5,
  });

  const recentQuery = useQuery<MangaListResponse>({
    queryKey: ["manga", "recent", page],
    queryFn: () => apiClient.get<MangaListResponse>(`/manga/recent?page=${page}`),
    enabled: !isSearching && tab === "recent",
    staleTime: 1000 * 60 * 5,
  });

  const searchQuery = useQuery<MangaListResponse>({
    queryKey: ["manga", "search", debouncedQuery, page],
    queryFn: () => apiClient.get<MangaListResponse>(`/manga/search?q=${encodeURIComponent(debouncedQuery)}&page=${page}`),
    enabled: isSearching,
    staleTime: 1000 * 60 * 2,
  });

  const active = isSearching ? searchQuery : (tab === "trending" ? trendingQuery : recentQuery);
  const mangas: MangaResult[] = active.data?.results ?? [];
  const hasNextPage = active.data?.hasNextPage ?? false;

  useEffect(() => { setPage(1); }, [tab, debouncedQuery]);

  return (
    <div style={{ minHeight: "100vh", background: "#04030a", display: "flex", flexDirection: "column", position: "relative" }}>
      <Navbar />

      {/* HERO HEADER WITH MAGIC CIRCLE */}
      <div style={{
        position: "relative",
        borderBottom: "1px solid rgba(220,38,38,0.25)",
        padding: "calc(56px + 48px) 24px 48px",
        textAlign: "center",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at center, rgba(220,38,38,0.18), transparent 60%), linear-gradient(180deg, #0a0307, #04030a)",
      }}>
        {/* Magic circle behind title */}
        <div style={{ position: "absolute", left: "50%", top: 60, transform: "translateX(-50%)", opacity: 0.55 }}>
          <MagicCircle size={320} color="#DC2626" opacity={0.55} />
        </div>
        {/* Hex grid */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(220,38,38,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.06) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ position: "relative", zIndex: 2, maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 18 }}>
            <SystemTag color="#F97316">[ SYSTEM ] BIBLIOTECA DE MANGA</SystemTag>
          </div>
          <h1 className="sys-title" style={{ fontSize: 44, marginBottom: 16 }}>
            MANGA
          </h1>
          <p style={{
            color: "rgba(252,165,165,0.75)",
            fontSize: 14,
            margin: "20px 0 28px",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: 1.5,
          }}>
            ▸ ACCESO CONCEDIDO — LEE LOS MEJORES TÍTULOS EN ANIMEFLEX
          </p>

          {/* SYSTEM SEARCH */}
          <div style={{ position: "relative", maxWidth: 540, margin: "0 auto" }}>
            <Search size={16} color="#F97316" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", zIndex: 2, filter: "drop-shadow(0 0 4px #F97316)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="BUSCAR EN LA BIBLIOTECA..."
              className="sys-input"
              style={{ paddingLeft: 44, letterSpacing: 1.5, fontSize: 13, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  background: "rgba(220,38,38,0.2)", border: "1px solid rgba(220,38,38,0.4)",
                  width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#FCA5A5", zIndex: 2,
                  clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "32px 20px 60px", flex: 1, position: "relative", zIndex: 1 }}>
        {/* TABS — system style */}
        {!isSearching && (
          <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={`sys-btn ${active ? "primary" : ""}`}
                  style={{ padding: "9px 20px" }}
                >
                  {t.icon} {t.label}
                </button>
              );
            })}
          </div>
        )}

        {isSearching && (
          <div style={{
            marginBottom: 24,
            color: "#FDBA74",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: 1.5,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ width: 8, height: 8, background: "#F97316", boxShadow: "0 0 10px #F97316" }} />
            {searchQuery.isFetching ? "ESCANEANDO..." : `${mangas.length} RESULTADOS · "${debouncedQuery}"`}
          </div>
        )}

        {/* Loading */}
        {active.isLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "80px 0" }}>
            <Loader2 size={36} color="#DC2626" style={{ animation: "spin 1s linear infinite", filter: "drop-shadow(0 0 12px #DC2626)" }} />
            <div style={{ color: "#FCA5A5", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: 2 }}>
              CARGANDO DATOS DEL SISTEMA...
            </div>
          </div>
        )}

        {/* Error */}
        {active.isError && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(252,165,165,0.7)" }}>
            <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.4, color: "#DC2626" }} />
            <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1, color: "#FCA5A5" }}>
              ⚠ ERROR · NO SE PUDIERON CARGAR LOS DATOS
            </p>
            <button onClick={() => active.refetch()} className="sys-btn" style={{ marginTop: 20 }}>
              ↻ REINTENTAR
            </button>
          </div>
        )}

        {/* GRID */}
        {!active.isLoading && mangas.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))",
            gap: 16,
          }}>
            {mangas.map(manga => (
              <MangaCard
                key={manga.id}
                manga={manga}
                onClick={() => navigate(`/manga/${manga.id}`)}
              />
            ))}
          </div>
        )}

        {!active.isLoading && !active.isError && mangas.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(252,165,165,0.4)" }}>
            <BookOpen size={56} style={{ marginBottom: 16, opacity: 0.25, color: "#DC2626" }} />
            <p style={{ fontSize: 14, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1.5 }}>
              ◇ SIN RESULTADOS EN LA BIBLIOTECA
            </p>
          </div>
        )}

        {/* PAGINATION */}
        {mangas.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 48 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="sys-btn"
              style={{ opacity: page <= 1 ? 0.35 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
            >
              <ChevronLeft size={14} /> ANTERIOR
            </button>
            <span style={{
              padding: "8px 18px",
              color: "#FDBA74",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.3)",
              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
            }}>
              PÁG · {String(page).padStart(2, "0")}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasNextPage}
              className={`sys-btn ${hasNextPage ? "primary" : ""}`}
              style={{ opacity: !hasNextPage ? 0.35 : 1, cursor: !hasNextPage ? "not-allowed" : "pointer" }}
            >
              SIGUIENTE <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
