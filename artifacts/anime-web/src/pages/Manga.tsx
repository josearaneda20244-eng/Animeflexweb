import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, TrendingUp, Clock, ChevronLeft, ChevronRight, Star, X, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const LME_API = "https://leermangaesp.net/api/buscar_mangas";
const LME_IMAGES = "https://images.leermangaesp.net/file/leermangaesp";
const RAILWAY_PROXY = "https://animeflex-api-production.up.railway.app/api/manga/img-proxy";

function lmePortadaUrl(portada: string | null | undefined): string | null {
  if (!portada) return null;
  if (portada.startsWith("http")) return portada;
  if (portada.startsWith("/")) return `https://leermangaesp.net${portada}`;
  return `${LME_IMAGES}/${portada.replace(/^\/+/, "")}`;
}

function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null;
  return `${RAILWAY_PROXY}?u=${encodeURIComponent(url)}`;
}

async function searchLeerMangaEsp(query: string, page: number): Promise<MangaListResponse> {
  const params = new URLSearchParams({
    query,
    page: String(page),
    page_size: "20",
  });
  const res = await fetch(`${LME_API}/?${params}`, {
    headers: {
      Accept: "application/json",
      Referer: "https://leermangaesp.net/biblioteca/",
    },
  });
  if (!res.ok) throw new Error(`LeerMangaEsp search error: ${res.status}`);
  const json = await res.json();
  const items: any[] = json.resultados ?? [];
  const results: MangaResult[] = items.map((item: any) => {
    const rawImg = lmePortadaUrl(item.portada);
    return {
      id: item.slug,
      title: item.titulo ?? item.slug,
      image: proxyImg(rawImg) ?? undefined,
      cover: proxyImg(rawImg) ?? undefined,
      genres: [...new Set<string>([...(item.generos ?? []), item.tipo, item.demografia].filter(Boolean))].slice(0, 4) as string[],
      chapters: item.ultimo_capitulo != null ? Number(item.ultimo_capitulo) : undefined,
      status: undefined,
    };
  });
  return {
    results,
    hasNextPage: page < (json.total_pages ?? 1),
    currentPage: page,
  };
}

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
    <div
      onClick={onClick}
      style={{
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        cursor: "pointer",
        transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 16px 40px rgba(236,72,153,0.2)";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(236,72,153,0.3)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.07)";
      }}
    >
      <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden", background: "#111" }}>
        {!imgError && manga.image ? (
          <img
            src={manga.image}
            alt={title}
            onError={() => setImgError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.3s" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#1a0533,#0d1a33)" }}>
            <BookOpen size={40} color="rgba(255,255,255,0.15)" />
          </div>
        )}
        {manga.status && (
          <div style={{
            position: "absolute", top: 8, left: 8,
            background: manga.status === "Completed" ? "rgba(34,197,94,0.85)" : "rgba(236,72,153,0.85)",
            color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: 0.3,
          }}>
            {manga.status === "Completed" ? "Completo" : manga.status === "Ongoing" ? "En curso" : manga.status}
          </div>
        )}
        {manga.rating != null && manga.rating > 0 && (
          <div style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(0,0,0,0.75)", color: "#F59E0B",
            fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
            display: "flex", alignItems: "center", gap: 3, backdropFilter: "blur(4px)",
          }}>
            <Star size={9} fill="#F59E0B" /> {(manga.rating / 10).toFixed(1)}
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, lineHeight: 1.3 }} className="line-clamp-2">{title}</div>
        {manga.genres && manga.genres.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
            {manga.genres.slice(0, 2).map(g => (
              <span key={g} style={{ background: "rgba(236,72,153,0.12)", color: "#F9A8D4", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20 }}>{g}</span>
            ))}
          </div>
        )}
        {manga.chapters != null && (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 }}>{manga.chapters} capítulos</div>
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
  { id: "trending", label: "Populares", icon: <TrendingUp size={14} /> },
  { id: "recent", label: "Recientes", icon: <Clock size={14} /> },
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
    queryFn: () => searchLeerMangaEsp(debouncedQuery, page),
    enabled: isSearching,
    staleTime: 1000 * 60 * 2,
  });

  const active = isSearching ? searchQuery : (tab === "trending" ? trendingQuery : recentQuery);
  const mangas: MangaResult[] = active.data?.results ?? [];
  const hasNextPage = active.data?.hasNextPage ?? false;

  useEffect(() => { setPage(1); }, [tab, debouncedQuery]);

  return (
    <div style={{ minHeight: "100vh", background: "#09090F", display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* Header */}
      <div style={{
        background: "#09090F",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "calc(56px + 32px) 24px 32px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "linear-gradient(135deg, rgba(236,72,153,0.3), rgba(168,85,247,0.3))",
              border: "1px solid rgba(236,72,153,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <BookOpen size={22} color="#F9A8D4" />
            </div>
            <h1 style={{ color: "#F1F1F5", fontSize: 30, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
              Manga
            </h1>
          </div>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, margin: "0 0 24px" }}>
            Lee los mejores mangas directamente en AnimeFlex
          </p>

          {/* Search */}
          <div style={{ position: "relative", maxWidth: 500, margin: "0 auto" }}>
            <Search size={16} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar manga..."
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "12px 40px 12px 40px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 14, color: "#F1F1F5", fontSize: 15, outline: "none", fontFamily: "inherit",
              }}
            />
            {query && (
              <button onClick={() => setQuery("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "28px 20px 60px", flex: 1 }}>
        {/* Tabs */}
        {!isSearching && (
          <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 18px", borderRadius: 30,
                  background: tab === t.id ? "linear-gradient(135deg,#EC4899,#A855F7)" : "rgba(255,255,255,0.05)",
                  border: tab === t.id ? "none" : "1px solid rgba(255,255,255,0.1)",
                  color: tab === t.id ? "#fff" : "rgba(255,255,255,0.5)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        )}

        {isSearching && (
          <div style={{ marginBottom: 20, color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
            {searchQuery.isFetching ? "Buscando..." : `${mangas.length} resultados para "${debouncedQuery}"`}
          </div>
        )}

        {/* Loading */}
        {active.isLoading && (
          <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
            <Loader2 size={32} color="#EC4899" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}

        {/* Error */}
        {active.isError && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.4)" }}>
            <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>No se pudieron cargar los mangas. Intenta de nuevo.</p>
            <button onClick={() => active.refetch()} style={{ marginTop: 12, padding: "8px 20px", background: "rgba(236,72,153,0.2)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 10, color: "#F9A8D4", cursor: "pointer", fontSize: 13 }}>
              Reintentar
            </button>
          </div>
        )}

        {/* Grid */}
        {!active.isLoading && mangas.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
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
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)" }}>
            <BookOpen size={56} style={{ marginBottom: 16, opacity: 0.2 }} />
            <p style={{ fontSize: 16 }}>No se encontraron mangas</p>
          </div>
        )}

        {/* Pagination */}
        {mangas.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 40 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "9px 18px", borderRadius: 12,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: page <= 1 ? "rgba(255,255,255,0.2)" : "#F1F1F5",
                cursor: page <= 1 ? "default" : "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <span style={{ display: "flex", alignItems: "center", padding: "0 16px", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
              Página {page}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={!hasNextPage}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "9px 18px", borderRadius: 12,
                background: hasNextPage ? "linear-gradient(135deg,#EC4899,#A855F7)" : "rgba(255,255,255,0.05)",
                border: "none",
                color: !hasNextPage ? "rgba(255,255,255,0.2)" : "#fff",
                cursor: !hasNextPage ? "default" : "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              Siguiente <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
