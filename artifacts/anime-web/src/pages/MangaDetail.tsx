import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, Star, List, Calendar, Loader2,
  SortAsc, SortDesc, Search, X, ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

interface ChapterInfo {
  id: string;
  title?: string;
  chapterNumber?: string | number;
  volumeNumber?: string | number;
  pages?: number;
  releaseDate?: string;
}

interface MangaDetailInfo {
  id: string;
  title: string | { english?: string; romaji?: string; native?: string };
  image?: string;
  cover?: string;
  description?: string;
  status?: string;
  genres?: string[];
  rating?: number;
  volumes?: number;
  authors?: Array<{ id: string; name: string }>;
  chapters?: ChapterInfo[];
}

function resolveTitle(t: MangaDetailInfo["title"]): string {
  if (!t) return "Sin título";
  if (typeof t === "string") return t;
  return t.english || t.romaji || t.native || "Sin título";
}

function stripHtml(html?: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").trim();
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function MangaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [imgError, setImgError] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [showCount, setShowCount] = useState(50);

  const { data: manga, isLoading, isError } = useQuery<MangaDetailInfo>({
    queryKey: ["manga", "info", id],
    queryFn: () => apiClient.get<MangaDetailInfo>(`/manga/info/${id}`),
    staleTime: 1000 * 60 * 10,
  });

  const title = manga ? resolveTitle(manga.title) : "";
  const chapters = manga?.chapters ?? [];

  const sortedChapters = [...chapters].sort((a, b) => {
    const n = (x: ChapterInfo) => parseFloat(String(x.chapterNumber ?? 0));
    return sortAsc ? n(a) - n(b) : n(b) - n(a);
  });

  const filteredChapters = chapterSearch.trim()
    ? sortedChapters.filter(ch => {
        const q = chapterSearch.toLowerCase();
        return String(ch.chapterNumber ?? "").includes(q) || (ch.title ?? "").toLowerCase().includes(q);
      })
    : sortedChapters;

  const visibleChapters = filteredChapters.slice(0, showCount);
  const hasMore = filteredChapters.length > showCount;

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090F", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <Loader2 size={40} color="#EC4899" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Cargando manga...</p>
        </div>
      </div>
    );
  }

  if (isError || !manga) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090F", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
          <BookOpen size={56} color="rgba(255,255,255,0.1)" />
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>No se pudo cargar este manga</p>
          <button
            onClick={() => navigate("/manga")}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 24px", background: "linear-gradient(135deg,#EC4899,#A855F7)",
              border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            <ArrowLeft size={15} /> Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  const desc = stripHtml(manga.description ?? "");
  const descShort = desc.slice(0, 300);
  const needsExpand = desc.length > 300;

  return (
    <div style={{ minHeight: "100vh", background: "#09090F", display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* Fixed blurred back bar */}
      <div style={{
        position: "fixed", top: 56, left: 0, right: 0, zIndex: 40,
        background: "rgba(9,9,15,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", gap: 12, padding: "10px 20px",
      }}>
        <button
          onClick={() => navigate("/manga")}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 10, padding: "7px 16px", color: "#F1F1F5", cursor: "pointer", fontSize: 13, fontWeight: 600,
            transition: "background 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(236,72,153,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
        >
          <ArrowLeft size={14} /> Volver al catálogo
        </button>
        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {title}
        </span>
      </div>

      {/* Cover blur background */}
      {(manga.cover || manga.image) && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 420, zIndex: 0,
          backgroundImage: `url(${manga.cover ?? manga.image})`,
          backgroundSize: "cover", backgroundPosition: "center top",
          filter: "blur(24px) brightness(0.18) saturate(0.7)",
          transform: "scale(1.08)",
        }} />
      )}

      {/* Main content — offset for navbar (56px) + back bar (~44px) = 100px */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "calc(56px + 44px + 24px) 16px 60px" }}>

        {/* Hero section */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 36, alignItems: "flex-start" }}>

          {/* Cover image */}
          <div style={{
            width: 160, flexShrink: 0, borderRadius: 14, overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)",
          }}>
            {!imgError && manga.image ? (
              <img
                src={manga.image}
                alt={title}
                onError={() => setImgError(true)}
                style={{ width: "100%", display: "block" }}
              />
            ) : (
              <div style={{ aspectRatio: "2/3", background: "linear-gradient(135deg,#1a0533,#0d1a33)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={40} color="rgba(255,255,255,0.15)" />
              </div>
            )}
          </div>

          {/* Info panel */}
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ color: "#F1F1F5", fontSize: "clamp(18px, 4vw, 26px)", fontWeight: 900, margin: "0 0 6px", lineHeight: 1.2 }}>
              {title}
            </h1>

            {manga.authors && manga.authors.length > 0 && (
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: "0 0 14px" }}>
                por {manga.authors.map(a => a.name).join(", ")}
              </p>
            )}

            {/* Badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
              {manga.status && (
                <span style={{
                  background: manga.status === "Completed" ? "rgba(34,197,94,0.15)" : "rgba(236,72,153,0.15)",
                  color: manga.status === "Completed" ? "#4ADE80" : "#F9A8D4",
                  border: `1px solid ${manga.status === "Completed" ? "rgba(34,197,94,0.3)" : "rgba(236,72,153,0.3)"}`,
                  fontSize: 11, fontWeight: 700, padding: "3px 11px", borderRadius: 20,
                }}>
                  {manga.status === "Completed" ? "Completo" : manga.status === "Ongoing" ? "En curso" : manga.status}
                </span>
              )}
              {manga.rating != null && manga.rating > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.25)", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                  <Star size={10} fill="#F59E0B" /> {(manga.rating / 10).toFixed(1)}
                </span>
              )}
              {chapters.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>
                  <List size={10} /> {chapters.length} cap.
                </span>
              )}
            </div>

            {/* Genres */}
            {manga.genres && manga.genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 16 }}>
                {manga.genres.slice(0, 8).map(g => (
                  <span key={g} style={{ background: "rgba(168,85,247,0.1)", color: "#FCA5B5", border: "1px solid rgba(168,85,247,0.18)", fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 20 }}>{g}</span>
                ))}
              </div>
            )}

            {/* Description */}
            {desc && (
              <div style={{ marginBottom: 18 }}>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                  {descExpanded || !needsExpand ? desc : `${descShort}...`}
                </p>
                {needsExpand && (
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    style={{ background: "none", border: "none", color: "#EC4899", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 0", marginTop: 4 }}
                  >
                    {descExpanded ? "Ver menos" : "Leer más"}
                  </button>
                )}
              </div>
            )}

            {/* Action buttons */}
            {sortedChapters.length > 0 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => navigate(`/manga/${id}/leer/${[...chapters].sort((a, b) => parseFloat(String(a.chapterNumber ?? 0)) - parseFloat(String(b.chapterNumber ?? 0)))[0]?.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "10px 20px", borderRadius: 12,
                    background: "linear-gradient(135deg,#EC4899,#A855F7)",
                    border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  <BookOpen size={14} /> Leer desde el cap. 1
                </button>
                <button
                  onClick={() => navigate(`/manga/${id}/leer/${[...chapters].sort((a, b) => parseFloat(String(b.chapterNumber ?? 0)) - parseFloat(String(a.chapterNumber ?? 0)))[0]?.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "10px 20px", borderRadius: 12,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  <ChevronRight size={14} /> Último capítulo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chapter list */}
        {sortedChapters.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>

            {/* Chapter header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
              padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.02)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <List size={16} color="#EC4899" />
                <span style={{ color: "#F1F1F5", fontSize: 15, fontWeight: 800 }}>Capítulos</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>({chapters.length})</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Chapter search */}
                <div style={{ position: "relative" }}>
                  <Search size={12} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    value={chapterSearch}
                    onChange={e => { setChapterSearch(e.target.value); setShowCount(50); }}
                    placeholder="Buscar..."
                    style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, color: "#F1F1F5", fontSize: 12, padding: "5px 28px 5px 26px",
                      outline: "none", fontFamily: "inherit", width: 120,
                    }}
                  />
                  {chapterSearch && (
                    <button onClick={() => setChapterSearch("")} style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex", padding: 0 }}>
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Sort toggle */}
                <button
                  onClick={() => setSortAsc(v => !v)}
                  title={sortAsc ? "Del más antiguo al más nuevo" : "Del más nuevo al más antiguo"}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "5px 10px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  }}
                >
                  {sortAsc ? <SortAsc size={13} /> : <SortDesc size={13} />}
                  {sortAsc ? "Asc" : "Desc"}
                </button>
              </div>
            </div>

            {/* Chapter rows */}
            <div>
              {visibleChapters.length === 0 && (
                <div style={{ padding: "32px 18px", textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 14 }}>
                  No se encontraron capítulos
                </div>
              )}
              {visibleChapters.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => navigate(`/manga/${id}/leer/${ch.id}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "11px 18px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer", transition: "background 0.12s",
                    gap: 12,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(236,72,153,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, overflow: "hidden" }}>
                    <span style={{
                      color: "#EC4899", fontSize: 11, fontWeight: 800,
                      minWidth: 44, fontFamily: "monospace", flexShrink: 0,
                    }}>
                      #{ch.chapterNumber}
                    </span>
                    <span style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ch.title ? ch.title : `Capítulo ${ch.chapterNumber}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {ch.releaseDate && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
                        <Calendar size={10} />
                        {formatDate(ch.releaseDate)}
                      </span>
                    )}
                    <ChevronRight size={13} color="rgba(255,255,255,0.2)" />
                  </div>
                </div>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div style={{ padding: "14px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                <button
                  onClick={() => setShowCount(c => c + 100)}
                  style={{
                    padding: "9px 24px", borderRadius: 10,
                    background: "rgba(236,72,153,0.1)", border: "1px solid rgba(236,72,153,0.25)",
                    color: "#F9A8D4", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Ver {Math.min(100, filteredChapters.length - showCount)} capítulos más
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
