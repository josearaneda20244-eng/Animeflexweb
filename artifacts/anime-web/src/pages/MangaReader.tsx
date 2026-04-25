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

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const CLIP_8 = "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
const CLIP_6 = "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)";
const CLIP_10 = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";

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
  const [scrollPct, setScrollPct] = useState(0);

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
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? Math.min(100, Math.max(0, (window.scrollY / h) * 100)) : 0;
      setScrollPct(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [chapterId]);

  const barStyle: React.CSSProperties = {
    position: "fixed", left: 0, right: 0, zIndex: 100,
    background: "linear-gradient(180deg, rgba(8,4,18,0.96) 0%, rgba(20,6,16,0.92) 100%)",
    backdropFilter: "blur(14px)",
    transition: "opacity 0.3s, transform 0.3s",
    opacity: showControls ? 1 : 0,
    pointerEvents: showControls ? "auto" : "none",
    fontFamily: MONO,
  };

  const sysBtn = (active = false): React.CSSProperties => ({
    background: active ? "linear-gradient(135deg,#DC2626,#991B1B)" : "rgba(220,38,38,0.08)",
    border: `1px solid ${active ? "rgba(249,115,22,0.6)" : "rgba(249,115,22,0.35)"}`,
    color: active ? "#fff" : "#FDBA74",
    cursor: "pointer", display: "flex", alignItems: "center",
    fontFamily: MONO, fontWeight: 800, letterSpacing: 1,
    clipPath: CLIP_6,
    boxShadow: active ? "0 0 12px rgba(220,38,38,0.5)" : "none",
    transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #14060c 0%, #07060b 60%)", position: "relative" }} onClick={showControlsTemporarily}>
      {/* Background scan lines (subtle) */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, rgba(249,115,22,0.025) 0px, rgba(249,115,22,0.025) 1px, transparent 1px, transparent 4px)",
      }} />

      {/* Top bar */}
      <div style={{ ...barStyle, top: 0, padding: "10px 14px 12px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(249,115,22,0.35)", boxShadow: "0 0 18px rgba(220,38,38,0.2)" }}>
        {/* Top accent */}
        <div style={{ position: "absolute", top: 0, left: 16, right: 16, height: 1, background: "linear-gradient(90deg,transparent,#F97316,#DC2626,#F97316,transparent)", boxShadow: "0 0 8px #F97316" }} />

        <button
          onClick={() => navigate(`/manga/${mangaId}`)}
          style={{ ...sysBtn(false), padding: "8px 10px", flexShrink: 0 }}
          title="Volver"
        >
          <ArrowLeft size={14} />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#F97316", fontSize: 9, fontWeight: 800, letterSpacing: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 5, height: 5, background: "#F97316", borderRadius: "50%", boxShadow: "0 0 6px #F97316", animation: "syspulse 1.6s ease-in-out infinite" }} />
            [ LECTOR · {resolveTitle(mangaInfo?.title)?.toUpperCase().slice(0, 30) || "MANGA"} ]
          </div>
          <div style={{ color: "#FECACA", fontSize: 13, fontWeight: 800, letterSpacing: 0.5, marginTop: 2, fontFamily: "system-ui, sans-serif", textShadow: "0 0 12px rgba(220,38,38,0.4)" }}>
            {currentChapter ? `Cap. ${currentChapter.chapterNumber}${currentChapter.title ? ` · ${currentChapter.title}` : ""}` : "// CARGANDO..."}
          </div>
        </div>

        {/* Zoom group */}
        <div style={{
          display: "flex", alignItems: "center", gap: 3,
          background: "rgba(8,4,18,0.7)",
          border: "1px solid rgba(249,115,22,0.3)",
          padding: "3px 4px",
          clipPath: CLIP_6,
        }}>
          <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={{ ...sysBtn(false), padding: 5, border: "none", background: "transparent" }}>
            <ZoomOut size={12} />
          </button>
          <span style={{ color: "#FDBA74", fontSize: 10, fontWeight: 900, minWidth: 32, textAlign: "center", letterSpacing: 0.5 }}>{zoom}%</span>
          <button onClick={() => setZoom(z => Math.min(200, z + 10))} style={{ ...sysBtn(false), padding: 5, border: "none", background: "transparent" }}>
            <ZoomIn size={12} />
          </button>
          {zoom !== 100 && (
            <button onClick={() => setZoom(100)} style={{ ...sysBtn(false), padding: 5, border: "none", background: "transparent" }} title="Reset">
              <RotateCcw size={12} />
            </button>
          )}
        </div>

        {/* Chapter list */}
        {sortedChapters.length > 0 && (
          <button onClick={() => setShowChapterList(v => !v)} style={{ ...sysBtn(showChapterList), padding: "7px 10px", fontSize: 10, gap: 5, flexShrink: 0 }}>
            <List size={12} /> CAPS
          </button>
        )}
      </div>

      {/* Progress bar (just below top bar) */}
      <div style={{
        position: "fixed", top: 60, left: 0, right: 0, zIndex: 99,
        height: 2, background: "rgba(8,4,18,0.6)",
        opacity: showControls ? 1 : 0.4,
        transition: "opacity 0.3s",
        pointerEvents: "none",
      }}>
        <div style={{
          height: "100%", width: `${scrollPct}%`,
          background: "linear-gradient(90deg,#DC2626,#F97316,#FDBA74)",
          boxShadow: "0 0 10px rgba(249,115,22,0.7)",
          transition: "width 0.1s linear",
        }} />
      </div>

      {/* Chapter list panel */}
      {showChapterList && (
        <div style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: 320, zIndex: 200,
          background: "linear-gradient(180deg, rgba(20,6,16,0.98) 0%, rgba(8,4,18,0.99) 100%)",
          borderLeft: "1px solid rgba(249,115,22,0.5)",
          boxShadow: "-8px 0 32px rgba(220,38,38,0.3)",
          display: "flex", flexDirection: "column",
          fontFamily: MONO,
        }}>
          {/* Side panel hex grid bg */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(220,38,38,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.05) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse at top, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at top, black 20%, transparent 80%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 14px", borderBottom: "1px solid rgba(249,115,22,0.35)" }}>
            <div>
              <div style={{ color: "#F97316", fontSize: 9, fontWeight: 800, letterSpacing: 2 }}>// INDICE</div>
              <div style={{ color: "#FDBA74", fontWeight: 900, fontSize: 14, marginTop: 2, letterSpacing: 1 }}>CAPITULOS · {sortedChapters.length}</div>
            </div>
            <button onClick={() => setShowChapterList(false)} style={{ ...sysBtn(false), padding: 7 }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 10, position: "relative" }}>
            {sortedChapters.slice().reverse().map(ch => {
              const active = ch.id === chapterId;
              return (
                <div
                  key={ch.id}
                  onClick={() => { navigate(`/manga/${mangaId}/leer/${ch.id}`); setShowChapterList(false); }}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: active ? "linear-gradient(135deg, rgba(220,38,38,0.25), rgba(153,27,27,0.1))" : "rgba(8,4,18,0.5)",
                    border: `1px solid ${active ? "rgba(249,115,22,0.6)" : "rgba(220,38,38,0.15)"}`,
                    color: active ? "#FDBA74" : "rgba(255,255,255,0.65)",
                    fontSize: 12, fontWeight: active ? 900 : 600,
                    marginBottom: 5,
                    clipPath: CLIP_6,
                    transition: "all 0.15s",
                    display: "flex", alignItems: "center", gap: 10,
                    boxShadow: active ? "0 0 12px rgba(220,38,38,0.3)" : "none",
                    fontFamily: "system-ui, sans-serif",
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(220,38,38,0.1)"; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(8,4,18,0.5)"; }}
                >
                  <span style={{ color: active ? "#F97316" : "rgba(249,115,22,0.5)", fontFamily: MONO, fontSize: 10, fontWeight: 900, minWidth: 32 }}>
                    {String(ch.chapterNumber).padStart(3, "0")}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ch.title || `Capitulo ${ch.chapterNumber}`}
                  </span>
                  {active && <span style={{ color: "#F97316", fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>[ > ]</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main content */}
      <div style={{ paddingTop: 70, paddingBottom: 110, position: "relative", zIndex: 1 }}>
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto 16px" }}>
                {/* Magic circle loader */}
                <svg width={80} height={80} viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, animation: "spin 8s linear infinite", filter: "drop-shadow(0 0 8px #DC2626)" }}>
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#DC2626" strokeWidth="0.6" strokeDasharray="2 4" />
                  <polygon points="50,12 82,68 18,68" fill="none" stroke="#F97316" strokeWidth="0.6" />
                </svg>
                <Loader2 size={32} color="#FDBA74" style={{ position: "absolute", top: 24, left: 24, animation: "spin 1s linear infinite" }} />
              </div>
              <p style={{ color: "#FDBA74", fontSize: 11, fontWeight: 800, letterSpacing: 3, fontFamily: MONO }}>
                > CARGANDO_PAGINAS...
              </p>
            </div>
          </div>
        )}

        {isError && (
          <div style={{
            textAlign: "center", padding: "40px 20px", margin: "20px auto", maxWidth: 380,
            background: "linear-gradient(160deg, rgba(20,6,16,0.85), rgba(8,4,18,0.95))",
            border: "1px solid rgba(220,38,38,0.4)",
            clipPath: CLIP_10,
            color: "#FECACA",
          }}>
            <BookOpen size={42} style={{ marginBottom: 14, color: "#F97316", filter: "drop-shadow(0 0 8px #DC2626)" }} />
            <div style={{ fontSize: 11, color: "#F97316", fontWeight: 900, letterSpacing: 2, fontFamily: MONO, marginBottom: 4 }}>[ ERROR · 404 ]</div>
            <p style={{ color: "rgba(255,255,255,0.6)", margin: "0 0 16px", fontSize: 13 }}>No se pudo cargar este capitulo.</p>
            <button
              onClick={() => navigate(`/manga/${mangaId}`)}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg,#DC2626,#991B1B)",
                border: "1px solid rgba(249,115,22,0.6)",
                color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 900,
                letterSpacing: 2, fontFamily: MONO,
                clipPath: CLIP_8,
                boxShadow: "0 0 16px rgba(220,38,38,0.5)",
              }}
            >
              >> VOLVER AL MANGA
            </button>
          </div>
        )}

        {!isLoading && !isError && pages && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "0 16px" }}>
            {pages.map((page, i) => (
              <div key={i} style={{
                maxWidth: `${zoom}%`, width: "100%",
                position: "relative",
              }}>
                {/* Page number marker */}
                <div style={{
                  position: "absolute", top: 8, left: 8, zIndex: 2,
                  background: "rgba(8,4,18,0.85)",
                  border: "1px solid rgba(249,115,22,0.5)",
                  padding: "3px 8px",
                  clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                  color: "#FDBA74", fontSize: 9, fontWeight: 900, letterSpacing: 1, fontFamily: MONO,
                  pointerEvents: "none",
                  opacity: showControls ? 0.85 : 0,
                  transition: "opacity 0.3s",
                }}>
                  {String(page.page).padStart(3, "0")} / {String(pages.length).padStart(3, "0")}
                </div>
                <img
                  src={page.img}
                  alt={`Pagina ${page.page}`}
                  loading="lazy"
                  style={{ width: "100%", display: "block" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            ))}

            {/* End of chapter */}
            <div style={{
              marginTop: 36, padding: 28,
              background: "linear-gradient(160deg, rgba(20,6,16,0.92), rgba(8,4,18,0.98))",
              border: "1px solid rgba(249,115,22,0.5)",
              clipPath: CLIP_10,
              textAlign: "center",
              maxWidth: 440, width: "100%",
              boxShadow: "0 0 32px rgba(220,38,38,0.25)",
              position: "relative",
            }}>
              <div style={{ position: "absolute", top: 0, left: 14, right: 14, height: 1, background: "linear-gradient(90deg,transparent,#F97316,transparent)", boxShadow: "0 0 8px #F97316" }} />
              <div style={{ position: "absolute", bottom: 0, left: 14, right: 14, height: 1, background: "linear-gradient(90deg,transparent,#DC2626,transparent)" }} />

              {/* Mini magic circle */}
              <svg width={56} height={56} viewBox="0 0 100 100" style={{ margin: "0 auto 8px", display: "block", filter: "drop-shadow(0 0 8px #F97316)", animation: "spin 12s linear infinite" }}>
                <circle cx="50" cy="50" r="46" fill="none" stroke="#DC2626" strokeWidth="1" strokeDasharray="2 4" />
                <circle cx="50" cy="50" r="34" fill="none" stroke="#F97316" strokeWidth="0.8" />
                <polygon points="50,18 76,62 24,62" fill="none" stroke="#FDBA74" strokeWidth="0.8" />
                <text x="50" y="56" textAnchor="middle" fontSize="22" fill="#FDBA74" fontFamily="JetBrains Mono">✓</text>
              </svg>

              <div style={{ color: "#F97316", fontSize: 10, fontWeight: 900, letterSpacing: 3, fontFamily: MONO, marginBottom: 4 }}>
                [ MISION · COMPLETADA ]
              </div>
              <div style={{ color: "#FDBA74", fontWeight: 900, fontSize: 18, marginBottom: 4, fontFamily: MONO, letterSpacing: 1 }}>
                FIN DEL CAPITULO
              </div>
              <div style={{ color: "rgba(253,186,116,0.6)", fontSize: 11, marginBottom: 22, letterSpacing: 1, fontFamily: MONO }}>
                {currentChapter ? `> CAP_${String(currentChapter.chapterNumber).padStart(3, "0")} · LEIDO` : ""}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {prevChapter && (
                  <button
                    onClick={() => navigate(`/manga/${mangaId}/leer/${prevChapter.id}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
                      background: "rgba(220,38,38,0.08)",
                      border: "1px solid rgba(249,115,22,0.4)",
                      clipPath: CLIP_8,
                      color: "#FDBA74", cursor: "pointer", fontSize: 10, fontWeight: 900,
                      letterSpacing: 1.5, fontFamily: MONO,
                    }}
                  >
                    <ChevronLeft size={13} /> CAP {prevChapter.chapterNumber}
                  </button>
                )}
                <button
                  onClick={() => navigate(`/manga/${mangaId}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "10px 16px",
                    background: "rgba(220,38,38,0.08)",
                    border: "1px solid rgba(249,115,22,0.4)",
                    clipPath: CLIP_8,
                    color: "#FDBA74", cursor: "pointer", fontSize: 10, fontWeight: 900,
                    letterSpacing: 1.5, fontFamily: MONO,
                  }}
                >
                  <List size={13} /> INDICE
                </button>
                {nextChapter && (
                  <button
                    onClick={() => navigate(`/manga/${mangaId}/leer/${nextChapter.id}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
                      background: "linear-gradient(135deg,#DC2626,#F97316)",
                      border: "1px solid rgba(253,186,116,0.6)",
                      clipPath: CLIP_8,
                      color: "#fff", cursor: "pointer", fontSize: 10, fontWeight: 900,
                      letterSpacing: 1.5, fontFamily: MONO,
                      boxShadow: "0 0 16px rgba(220,38,38,0.6)",
                    }}
                  >
                    CAP {nextChapter.chapterNumber} >> <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation bar */}
      <div style={{
        ...barStyle, bottom: 0, top: "auto",
        borderTop: "1px solid rgba(249,115,22,0.35)",
        padding: "10px 14px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        boxShadow: "0 0 18px rgba(220,38,38,0.2)",
      }}>
        <div style={{ position: "absolute", bottom: 0, left: 16, right: 16, height: 1, background: "linear-gradient(90deg,transparent,#DC2626,#F97316,#DC2626,transparent)", boxShadow: "0 0 8px #DC2626" }} />

        <button
          disabled={!prevChapter}
          onClick={() => prevChapter && navigate(`/manga/${mangaId}/leer/${prevChapter.id}`)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "9px 14px",
            background: prevChapter ? "rgba(220,38,38,0.08)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${prevChapter ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.06)"}`,
            color: prevChapter ? "#FDBA74" : "rgba(255,255,255,0.2)",
            cursor: prevChapter ? "pointer" : "default",
            fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
            fontFamily: MONO,
            clipPath: CLIP_8,
          }}
        >
          <ChevronLeft size={13} /> ANTERIOR
        </button>

        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          color: "#FDBA74", fontSize: 9, fontWeight: 800, letterSpacing: 1.5, textAlign: "center",
        }}>
          <span style={{ color: "#F97316" }}>
            {isLoading ? "// CARGANDO..." : isError ? "// ERROR" : `${pages?.length ?? 0} PAGINAS`}
          </span>
          <span style={{ color: "rgba(253,186,116,0.5)", fontSize: 8 }}>
            {Math.round(scrollPct)}% LEIDO
          </span>
        </div>

        <button
          disabled={!nextChapter}
          onClick={() => nextChapter && navigate(`/manga/${mangaId}/leer/${nextChapter.id}`)}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "9px 14px",
            background: nextChapter ? "linear-gradient(135deg,#DC2626,#F97316)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${nextChapter ? "rgba(253,186,116,0.6)" : "rgba(255,255,255,0.06)"}`,
            color: nextChapter ? "#fff" : "rgba(255,255,255,0.2)",
            cursor: nextChapter ? "pointer" : "default",
            fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
            fontFamily: MONO,
            clipPath: CLIP_8,
            boxShadow: nextChapter ? "0 0 12px rgba(220,38,38,0.4)" : "none",
          }}
        >
          SIGUIENTE <ChevronRight size={13} />
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes syspulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
      `}</style>
    </div>
  );
}
