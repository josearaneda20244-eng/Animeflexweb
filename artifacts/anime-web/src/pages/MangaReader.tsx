import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Loader2, ZoomIn, ZoomOut, List, X, RotateCcw } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface ChapterPage {
  img: string;
  page: number;
  headerForImage?: Record<string, string>;
}

interface MangaInfoSmall {
  id?: string;
  title?: string | { english?: string; romaji?: string };
  chapters?: Array<{ id: string; chapterNumber?: string | number; title?: string }>;
}

function resolveTitle(t: any): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  return t.english || t.romaji || t.userPreferred || t.native || "";
}

export default function MangaReader() {
  const { id: mangaId, chapterId } = useParams<{ id: string; chapterId: string }>();
  const [, navigate] = useLocation();
  const [zoom, setZoom] = useState(100);
  const [showChapterList, setShowChapterList] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: pages, isLoading, isError } = useQuery<ChapterPage[]>({
    queryKey: ["manga", "chapter", chapterId],
    queryFn: () => apiClient.get<ChapterPage[]>(`/manga/chapter/${chapterId}`),
    staleTime: 1000 * 60 * 30,
  });

  const { data: mangaInfo } = useQuery<MangaInfoSmall>({
    queryKey: ["manga", "info", mangaId],
    queryFn: () => apiClient.get<MangaInfoSmall>(`/manga/info/${mangaId}`),
    staleTime: 1000 * 60 * 10,
  });

  const sortedChapters = [...(mangaInfo?.chapters ?? [])].sort((a, b) => {
    return parseFloat(String(a.chapterNumber ?? 0)) - parseFloat(String(b.chapterNumber ?? 0));
  });
  const currentIdx = sortedChapters.findIndex(c => c.id === chapterId);
  const prevChapter = currentIdx > 0 ? sortedChapters[currentIdx - 1] : null;
  const nextChapter = currentIdx < sortedChapters.length - 1 ? sortedChapters[currentIdx + 1] : null;
  const currentChapter = sortedChapters[currentIdx];

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    const onMove = () => showControlsTemporarily();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
    };
  }, [showControlsTemporarily]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapterId]);

  const barStyle: React.CSSProperties = {
    position: "fixed", left: 0, right: 0, zIndex: 100,
    background: "rgba(9,9,15,0.95)", backdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    transition: "opacity 0.3s, transform 0.3s",
    opacity: showControls ? 1 : 0,
    pointerEvents: showControls ? "auto" : "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#09090F" }} onClick={showControlsTemporarily}>
      {/* Top bar */}
      <div style={{ ...barStyle, top: 0, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(`/manga/${mangaId}`)} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 12px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, flexShrink: 0 }}>
          <ArrowLeft size={14} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }}>
            {resolveTitle(mangaInfo?.title) || "Manga"}
          </div>
          <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>
            {currentChapter ? `Capítulo ${currentChapter.chapterNumber}${currentChapter.title ? ` — ${currentChapter.title}` : ""}` : "Cargando..."}
          </div>
        </div>

        {/* Zoom */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex" }}>
            <ZoomOut size={14} />
          </button>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, minWidth: 36, textAlign: "center" }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex" }}>
            <ZoomIn size={14} />
          </button>
          {zoom !== 100 && (
            <button onClick={() => setZoom(100)} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex" }}>
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {/* Chapter list */}
        {sortedChapters.length > 0 && (
          <button onClick={() => setShowChapterList(v => !v)} style={{ background: "rgba(236,72,153,0.15)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 8, padding: "6px 10px", color: "#F9A8D4", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, flexShrink: 0 }}>
            <List size={14} /> Capítulos
          </button>
        )}
      </div>

      {/* Chapter list panel */}
      {showChapterList && (
        <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 300, zIndex: 200, background: "#0E0E1A", borderLeft: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ color: "#F1F1F5", fontWeight: 700 }}>Capítulos ({sortedChapters.length})</span>
            <button onClick={() => setShowChapterList(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex" }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
            {sortedChapters.map(ch => (
              <div
                key={ch.id}
                onClick={() => { navigate(`/manga/${mangaId}/leer/${ch.id}`); setShowChapterList(false); }}
                style={{
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                  background: ch.id === chapterId ? "rgba(236,72,153,0.15)" : "none",
                  border: ch.id === chapterId ? "1px solid rgba(236,72,153,0.3)" : "1px solid transparent",
                  color: ch.id === chapterId ? "#F9A8D4" : "rgba(255,255,255,0.6)",
                  fontSize: 13, fontWeight: ch.id === chapterId ? 700 : 500,
                  marginBottom: 2, transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (ch.id !== chapterId) (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={e => { if (ch.id !== chapterId) (e.currentTarget as HTMLDivElement).style.background = "none"; }}
              >
                Cap. {ch.chapterNumber}{ch.title ? ` — ${ch.title}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ paddingTop: 60, paddingBottom: 100 }}>
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
            <div style={{ textAlign: "center" }}>
              <Loader2 size={36} color="#EC4899" style={{ animation: "spin 1s linear infinite", marginBottom: 12 }} />
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cargando páginas...</p>
            </div>
          </div>
        )}

        {isError && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,0.4)" }}>
            <BookOpen size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
            <p>No se pudo cargar este capítulo.</p>
            <button onClick={() => navigate(`/manga/${mangaId}`)} style={{ marginTop: 12, padding: "8px 20px", background: "rgba(236,72,153,0.2)", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 10, color: "#F9A8D4", cursor: "pointer" }}>
              Volver al manga
            </button>
          </div>
        )}

        {!isLoading && !isError && pages && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 16px" }}>
            {pages.map((page, i) => (
              <div key={i} style={{ maxWidth: `${zoom}%`, width: "100%" }}>
                <img
                  src={page.img}
                  alt={`Página ${page.page}`}
                  loading="lazy"
                  style={{ width: "100%", display: "block", borderRadius: i === 0 ? "0 0 0 0" : 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            ))}

            {/* End of chapter */}
            <div style={{ marginTop: 32, padding: 28, borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", textAlign: "center", maxWidth: 400, width: "100%" }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
              <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Fin del capítulo</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20 }}>
                {currentChapter ? `Capítulo ${currentChapter.chapterNumber}` : ""}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {prevChapter && (
                  <button onClick={() => navigate(`/manga/${mangaId}/leer/${prevChapter.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    <ChevronLeft size={14} /> Cap. {prevChapter.chapterNumber}
                  </button>
                )}
                <button onClick={() => navigate(`/manga/${mangaId}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  <List size={14} /> Lista
                </button>
                {nextChapter && (
                  <button onClick={() => navigate(`/manga/${mangaId}/leer/${nextChapter.id}`)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 12, background: "linear-gradient(135deg,#EC4899,#A855F7)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    Cap. {nextChapter.chapterNumber} <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation bar */}
      <div style={{ ...barStyle, bottom: 0, top: "auto", borderTop: "1px solid rgba(255,255,255,0.08)", borderBottom: "none", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <button
          disabled={!prevChapter}
          onClick={() => prevChapter && navigate(`/manga/${mangaId}/leer/${prevChapter.id}`)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 10, background: prevChapter ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", color: prevChapter ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)", cursor: prevChapter ? "pointer" : "default", fontSize: 13, fontWeight: 600 }}
        >
          <ChevronLeft size={14} /> Anterior
        </button>

        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center" }}>
          {isLoading ? "Cargando páginas..." : isError ? "" : `${pages?.length ?? 0} páginas`}
        </div>

        <button
          disabled={!nextChapter}
          onClick={() => nextChapter && navigate(`/manga/${mangaId}/leer/${nextChapter.id}`)}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 10, background: nextChapter ? "linear-gradient(135deg,#EC4899,#A855F7)" : "rgba(255,255,255,0.02)", border: "none", color: nextChapter ? "#fff" : "rgba(255,255,255,0.2)", cursor: nextChapter ? "pointer" : "default", fontSize: 13, fontWeight: 600 }}
        >
          Siguiente <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
