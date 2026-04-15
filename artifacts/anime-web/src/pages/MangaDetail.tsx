import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Star, ChevronDown, ChevronUp, List, Calendar, Loader2, ExternalLink } from "lucide-react";
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

export default function MangaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [showAllChapters, setShowAllChapters] = useState(false);
  const [imgError, setImgError] = useState(false);

  const { data: manga, isLoading, isError } = useQuery<MangaDetailInfo>({
    queryKey: ["manga", "info", id],
    queryFn: () => apiClient.get<MangaDetailInfo>(`/manga/info/${id}`),
    staleTime: 1000 * 60 * 10,
  });

  const title = manga ? resolveTitle(manga.title) : "";
  const chapters = manga?.chapters ?? [];
  const sortedChapters = [...chapters].sort((a, b) => {
    const n = (x: ChapterInfo) => parseFloat(String(x.chapterNumber ?? 0));
    return n(a) - n(b);
  });
  const visibleChapters = showAllChapters ? sortedChapters : sortedChapters.slice(0, 20);

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090F", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={36} color="#EC4899" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    );
  }

  if (isError || !manga) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090F", display: "flex", flexDirection: "column" }}>
        <Navbar />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <BookOpen size={48} color="rgba(255,255,255,0.2)" />
          <p style={{ color: "rgba(255,255,255,0.4)" }}>No se pudo cargar este manga</p>
          <button onClick={() => navigate("/manga")} style={{ padding: "8px 20px", background: "rgba(236,72,153,0.2)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 10, color: "#F9A8D4", cursor: "pointer" }}>
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#09090F", display: "flex", flexDirection: "column" }}>
      <Navbar />

      {/* Banner background */}
      {manga.cover && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 400, zIndex: 0,
          backgroundImage: `url(${manga.cover})`,
          backgroundSize: "cover", backgroundPosition: "center top",
          filter: "blur(20px) brightness(0.2)",
          transform: "scale(1.1)",
        }} />
      )}

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", width: "100%", padding: "24px 20px 60px" }}>
        {/* Back */}
        <button onClick={() => navigate("/manga")} style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 28,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, padding: "7px 14px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13,
        }}>
          <ArrowLeft size={14} /> Volver
        </button>

        {/* Hero */}
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 40 }}>
          {/* Cover */}
          <div style={{
            width: 200, flexShrink: 0, borderRadius: 16, overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
          }}>
            {!imgError && manga.image ? (
              <img src={manga.image} alt={title} onError={() => setImgError(true)} style={{ width: "100%", display: "block" }} />
            ) : (
              <div style={{ aspectRatio: "2/3", background: "linear-gradient(135deg,#1a0533,#0d1a33)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={48} color="rgba(255,255,255,0.15)" />
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1 style={{ color: "#F1F1F5", fontSize: 26, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.2 }}>{title}</h1>

            {manga.authors && manga.authors.length > 0 && (
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, margin: "0 0 16px" }}>
                por {manga.authors.map(a => a.name).join(", ")}
              </p>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {manga.status && (
                <span style={{
                  background: manga.status === "Completed" ? "rgba(34,197,94,0.15)" : "rgba(236,72,153,0.15)",
                  color: manga.status === "Completed" ? "#4ADE80" : "#F9A8D4",
                  border: `1px solid ${manga.status === "Completed" ? "rgba(34,197,94,0.3)" : "rgba(236,72,153,0.3)"}`,
                  fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20,
                }}>
                  {manga.status === "Completed" ? "Completo" : manga.status === "Ongoing" ? "En curso" : manga.status}
                </span>
              )}
              {manga.rating != null && manga.rating > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.25)", fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20 }}>
                  <Star size={11} fill="#F59E0B" /> {(manga.rating / 10).toFixed(1)}
                </span>
              )}
              {chapters.length > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>
                  <List size={11} /> {chapters.length} capítulos
                </span>
              )}
            </div>

            {manga.genres && manga.genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
                {manga.genres.slice(0, 8).map(g => (
                  <span key={g} style={{ background: "rgba(168,85,247,0.1)", color: "#C4B5FD", border: "1px solid rgba(168,85,247,0.2)", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{g}</span>
                ))}
              </div>
            )}

            {manga.description && (
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                {stripHtml(manga.description).slice(0, 400)}{manga.description.length > 400 ? "..." : ""}
              </p>
            )}

            {/* Read first / last */}
            {sortedChapters.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
                <button
                  onClick={() => navigate(`/manga/${id}/leer/${sortedChapters[0].id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "10px 20px", borderRadius: 12,
                    background: "linear-gradient(135deg,#EC4899,#A855F7)",
                    border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  <BookOpen size={15} /> Leer desde el inicio
                </button>
                <button
                  onClick={() => navigate(`/manga/${id}/leer/${sortedChapters[sortedChapters.length - 1].id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "10px 20px", borderRadius: 12,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Último capítulo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chapters */}
        {sortedChapters.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <List size={18} color="#EC4899" />
              <h2 style={{ color: "#F1F1F5", fontSize: 18, fontWeight: 800, margin: 0 }}>Capítulos</h2>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>({chapters.length})</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {visibleChapters.map((ch, i) => (
                <div
                  key={ch.id}
                  onClick={() => navigate(`/manga/${id}/leer/${ch.id}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                    cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(236,72,153,0.08)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(236,72,153,0.2)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, minWidth: 32, fontFamily: "monospace" }}>#{ch.chapterNumber ?? i + 1}</span>
                    <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 600 }}>
                      {ch.title || `Capítulo ${ch.chapterNumber ?? i + 1}`}
                    </span>
                    {ch.pages && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{ch.pages} pág.</span>}
                  </div>
                  {ch.releaseDate && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                      <Calendar size={11} />
                      {new Date(ch.releaseDate).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {sortedChapters.length > 20 && (
              <button
                onClick={() => setShowAllChapters(v => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, margin: "12px auto 0",
                  padding: "9px 20px", borderRadius: 12,
                  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                }}
              >
                {showAllChapters ? <><ChevronUp size={14} /> Ver menos</> : <><ChevronDown size={14} /> Ver todos los capítulos ({sortedChapters.length - 20} más)</>}
              </button>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
