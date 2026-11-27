import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ChevronLeft, ChevronRight, List, X, Settings2, RefreshCw, Rows3, BookOpen, Maximize, Minimize,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { usePageMeta } from "@/lib/usePageMeta";
import {
  getMangaProgress, saveMangaProgress, markChapterRead, getReaderPrefs, saveReaderPrefs,
  type ReaderPrefs,
} from "@/lib/mangaProgress";

interface ChapterPage { img: string; page: number }
interface ChapterRef { id: string; chapterNumber?: string | number; title?: string }
interface MangaInfoSmall {
  id?: string;
  title?: string | { english?: string; romaji?: string; userPreferred?: string; native?: string };
  image?: string;
  chapters?: ChapterRef[];
}

function resolveTitle(t: MangaInfoSmall["title"]): string {
  if (!t) return "";
  if (typeof t === "string") return t;
  return t.english || t.romaji || t.userPreferred || t.native || "";
}

const chapterNum = (c?: ChapterRef) => parseFloat(String(c?.chapterNumber ?? 0)) || 0;
const WIDTHS = [600, 820, 1000, 1400];

/* ─────────────────────────────────────────────────────────────
   Página del lector con carga progresiva:
   - El <img> solo se monta cuando la página está a ~2.5 pantallas.
   - Cuando se aleja más de ~6 pantallas se desmonta (libera RAM/decodificación)
     conservando su altura medida, así no hay saltos de scroll.
───────────────────────────────────────────────────────────── */
const ReaderPage = memo(function ReaderPage({
  page, index, eager, onVisible, onAspect, aspect,
}: {
  page: ChapterPage;
  index: number;
  eager: boolean;
  onVisible: (index: number) => void;
  onAspect: (index: number, ratio: number) => void;
  aspect?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);
  const [failed, setFailed] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); return; }
    const mountObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setNear(true); }, { rootMargin: "250% 0px" });
    const unmountObs = new IntersectionObserver(([e]) => { if (!e.isIntersecting) setNear(false); }, { rootMargin: "600% 0px" });
    const visObs = new IntersectionObserver(([e]) => { if (e.isIntersecting) onVisible(index); }, { threshold: 0, rootMargin: "-45% 0px -45% 0px" });
    mountObs.observe(el); unmountObs.observe(el); visObs.observe(el);
    return () => { mountObs.disconnect(); unmountObs.disconnect(); visObs.disconnect(); };
  }, [index, onVisible]);

  const src = failed > 0 ? `${page.img}${page.img.includes("?") ? "&" : "?"}r=${failed}` : page.img;

  return (
    <div ref={ref} className="iz-reader__page" style={{ aspectRatio: aspect ? String(aspect) : undefined, minHeight: aspect ? undefined : "70vh" }} data-page={index + 1}>
      {near && failed < 4 && (
        <img
          src={src}
          alt={`Página ${index + 1}`}
          decoding="async"
          // @ts-expect-error fetchpriority es un atributo HTML válido
          fetchpriority={index < 2 ? "high" : "low"}
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) onAspect(index, img.naturalWidth / img.naturalHeight);
            setLoaded(true);
          }}
          onError={() => setFailed((n) => n + 1)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      )}
      {!loaded && failed < 4 && <div className="iz-reader__ph"><span className="iz-spin" /><span>{index + 1}</span></div>}
      {failed >= 4 && (
        <div className="iz-reader__ph">
          <span>No se pudo cargar la página {index + 1}</span>
          <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" onClick={() => { setFailed(1); setLoaded(false); }}><RefreshCw size={14} /> Reintentar</button>
        </div>
      )}
    </div>
  );
});

export default function MangaReader() {
  const { id: mangaId, chapterId } = useParams<{ id: string; chapterId: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<ReaderPrefs>(() => getReaderPrefs());
  const [showList, setShowList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [current, setCurrent] = useState(0);
  const [aspects, setAspects] = useState<Record<number, number>>({});
  const [isFs, setIsFs] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const restoredRef = useRef<string | null>(null);

  const updatePrefs = (patch: Partial<ReaderPrefs>) => setPrefs((p) => { const n = { ...p, ...patch }; saveReaderPrefs(n); return n; });

  const { data: pages = [], isLoading, isError, refetch } = useQuery<ChapterPage[]>({
    queryKey: ["manga", "chapter", chapterId],
    queryFn: () => apiClient.get<ChapterPage[]>(`/manga/chapter/${chapterId}`),
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });

  const { data: info } = useQuery<MangaInfoSmall>({
    queryKey: ["manga", "info", mangaId],
    queryFn: () => apiClient.get<MangaInfoSmall>(`/manga/info/${mangaId}`),
    staleTime: 1000 * 60 * 10,
  });

  const chapters = useMemo(() => [...(info?.chapters ?? [])].sort((a, b) => chapterNum(a) - chapterNum(b)), [info?.chapters]);
  const idx = chapters.findIndex((c) => c.id === chapterId);
  const chapter = idx >= 0 ? chapters[idx] : undefined;
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
  const mangaTitle = resolveTitle(info?.title);

  usePageMeta({
    title: `${mangaTitle || "Manga"}${chapter ? ` · Capítulo ${chapter.chapterNumber}` : ""}`,
    description: `Lee ${mangaTitle || "manga"}${chapter ? ` capítulo ${chapter.chapterNumber}` : ""} online en HD, en español.`,
    image: info?.image,
    type: "book",
  });

  const goChapter = useCallback((c: ChapterRef | null) => {
    if (!c) return;
    setShowList(false);
    navigate(`/manga/${mangaId}/leer/${c.id}`);
  }, [mangaId, navigate]);

  // Reiniciar estado al cambiar de capítulo y restaurar la página guardada
  useEffect(() => {
    setAspects({});
    setCurrent(0);
    window.scrollTo(0, 0);
  }, [chapterId]);

  useEffect(() => {
    if (!pages.length || restoredRef.current === chapterId) return;
    restoredRef.current = chapterId;
    const saved = getMangaProgress(mangaId);
    if (saved && saved.chapterId === chapterId && saved.page > 0 && saved.page < pages.length - 1) {
      const target = saved.page;
      if (prefs.mode === "paged") setCurrent(target);
      else window.setTimeout(() => document.querySelector(`[data-page="${target + 1}"]`)?.scrollIntoView({ block: "start" }), 120);
    }
  }, [pages.length, chapterId, mangaId, prefs.mode]);

  // Guardar progreso (debounced) y marcar como leído al llegar al final
  useEffect(() => {
    if (!pages.length || !chapterId) return;
    const t = window.setTimeout(() => {
      saveMangaProgress({
        mangaId, mangaTitle: mangaTitle || "Manga", mangaImage: info?.image,
        chapterId, chapterNumber: chapter?.chapterNumber, page: current, totalPages: pages.length,
      });
      if (current >= pages.length - 2) markChapterRead(mangaId, chapterId);
    }, 500);
    return () => window.clearTimeout(t);
  }, [current, pages.length, chapterId, mangaId, mangaTitle, info?.image, chapter?.chapterNumber]);

  // Precargar el siguiente capítulo cuando se pasa del 70 %
  useEffect(() => {
    if (!next || !pages.length || current < pages.length * 0.7) return;
    queryClient.prefetchQuery({ queryKey: ["manga", "chapter", next.id], queryFn: () => apiClient.get<ChapterPage[]>(`/manga/chapter/${next.id}`), staleTime: 1000 * 60 * 30 });
  }, [current, pages.length, next, queryClient]);

  // Modo páginas: precargar las 3 siguientes imágenes
  useEffect(() => {
    if (prefs.mode !== "paged") return;
    for (let i = current + 1; i <= current + 3 && i < pages.length; i++) { const img = new Image(); img.src = pages[i].img; }
  }, [current, pages, prefs.mode]);

  const onVisible = useCallback((i: number) => setCurrent(i), []);
  const onAspect = useCallback((i: number, r: number) => setAspects((a) => (a[i] === r ? a : { ...a, [i]: r })), []);

  // Mostrar/ocultar controles
  const poke = useCallback(() => {
    setShowUI(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => { setShowUI(false); setShowSettings(false); }, 3200);
  }, []);
  useEffect(() => {
    poke();
    window.addEventListener("mousemove", poke, { passive: true });
    return () => { window.removeEventListener("mousemove", poke); if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [poke]);

  const pageStep = useCallback((dir: 1 | -1) => {
    if (prefs.mode !== "paged") return;
    const n = current + dir;
    if (n < 0) { goChapter(prev); return; }
    if (n >= pages.length) { goChapter(next); return; }
    window.scrollTo(0, 0);
    setCurrent(n);
  }, [prefs.mode, current, pages.length, prev, next, goChapter]);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); prefs.mode === "paged" ? pageStep(1) : goChapter(next); }
      else if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); prefs.mode === "paged" ? pageStep(-1) : goChapter(prev); }
      else if (e.key === "Escape") { setShowList(false); setShowSettings(false); }
      else if (e.key === "f") toggleFs();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const pct = pages.length ? Math.round(((current + 1) / pages.length) * 100) : 0;

  // Toque en modo páginas: tercio izquierdo = anterior, derecho = siguiente, centro = controles
  const onPagedTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.33) pageStep(-1);
    else if (x > 0.67) pageStep(1);
    else setShowUI((v) => !v);
  };

  return (
    <div className="iz-reader" onClick={() => { if (prefs.mode === "webtoon") poke(); }}>
      {/* Barra superior */}
      <header className={`iz-reader__bar iz-reader__bar--top ${showUI ? "" : "is-hidden"}`}>
        <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm" onClick={() => navigate(`/manga/${mangaId}`)} aria-label="Volver al manga"><ArrowLeft size={17} /></button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--iz-dim)", fontFamily: "var(--iz-mono)", letterSpacing: ".08em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mangaTitle || "Manga"}</div>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {chapter ? `Capítulo ${chapter.chapterNumber}${chapter.title && !/^cap/i.test(chapter.title) ? ` · ${chapter.title}` : ""}` : "Cargando…"}
          </div>
        </div>
        <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm iz-hide-m" onClick={toggleFs} aria-label="Pantalla completa">{isFs ? <Minimize size={16} /> : <Maximize size={16} />}</button>
        <button type="button" className={`iz-btn iz-btn--icon iz-btn--sm ${showSettings ? "iz-btn--accent" : "iz-btn--ghost"}`} onClick={(e) => { e.stopPropagation(); setShowSettings((v) => !v); }} aria-label="Ajustes de lectura"><Settings2 size={16} /></button>
        <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" onClick={(e) => { e.stopPropagation(); setShowList(true); }}><List size={16} /> <span className="iz-hide-m">Capítulos</span></button>
        <div className="iz-reader__progress"><i style={{ width: `${pct}%` }} /></div>
      </header>

      {showSettings && (
        <div className="iz-menu iz-reader__settings" onClick={(e) => e.stopPropagation()}>
          <div className="iz-menu__label">Modo de lectura</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "4px 4px 8px" }}>
            <button type="button" className={`iz-chip ${prefs.mode === "webtoon" ? "is-active" : ""}`} onClick={() => updatePrefs({ mode: "webtoon" })}><Rows3 size={14} /> Webtoon</button>
            <button type="button" className={`iz-chip ${prefs.mode === "paged" ? "is-active" : ""}`} onClick={() => { updatePrefs({ mode: "paged" }); window.scrollTo(0, 0); }}><BookOpen size={14} /> Páginas</button>
          </div>
          <div className="iz-menu__label">Ancho</div>
          <div style={{ display: "flex", gap: 6, padding: "4px 4px 8px", flexWrap: "wrap" }}>
            {WIDTHS.map((w) => <button key={w} type="button" className={`iz-chip ${prefs.width === w ? "is-active" : ""}`} style={{ height: 28, fontSize: 12 }} onClick={() => updatePrefs({ width: w })}>{w === 1400 ? "Completo" : `${w}px`}</button>)}
          </div>
          {prefs.mode === "webtoon" && (
            <label className="iz-menu__item" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={prefs.gap} onChange={(e) => updatePrefs({ gap: e.target.checked })} /> Separación entre páginas
            </label>
          )}
          <div style={{ padding: "6px 10px", color: "var(--iz-dim)", fontSize: 11, lineHeight: 1.5 }}>Atajos: ← → cambiar · F pantalla completa</div>
        </div>
      )}

      {/* Contenido */}
      <main className="iz-reader__body" style={{ maxWidth: prefs.width >= 1400 ? "100%" : prefs.width }}>
        {isLoading ? (
          <div className="iz-reader__ph" style={{ height: "80vh" }}><span className="iz-spin" /> Cargando capítulo…</div>
        ) : isError || pages.length === 0 ? (
          <div className="iz-reader__ph" style={{ height: "80vh" }}>
            <span>{isError ? "No se pudo cargar el capítulo." : "Este capítulo no tiene páginas disponibles."}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="iz-btn iz-btn--primary iz-btn--sm" onClick={() => refetch()}><RefreshCw size={14} /> Reintentar</button>
              {next && <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" onClick={() => goChapter(next)}>Siguiente capítulo</button>}
            </div>
          </div>
        ) : prefs.mode === "paged" ? (
          <div className="iz-reader__paged" onClick={onPagedTap}>
            <ReaderPage key={`${chapterId}-${current}`} page={pages[Math.min(current, pages.length - 1)]} index={Math.min(current, pages.length - 1)} eager onVisible={onVisible} onAspect={onAspect} />
          </div>
        ) : (
          <div style={{ display: "grid", gap: prefs.gap ? 12 : 0 }}>
            {pages.map((p, i) => (
              <ReaderPage key={`${chapterId}-${i}`} page={p} index={i} eager={i < 3} onVisible={onVisible} onAspect={onAspect} aspect={aspects[i]} />
            ))}
          </div>
        )}

        {/* Fin de capítulo */}
        {!isLoading && pages.length > 0 && (prefs.mode === "webtoon" || current === pages.length - 1) && (
          <div className="iz-reader__end">
            <div className="iz-head__eyebrow" style={{ justifyContent: "center" }}><span className="iz-dot" /> Fin del capítulo {chapter?.chapterNumber}</div>
            {next ? (
              <button type="button" className="iz-btn iz-btn--primary iz-btn--lg" onClick={() => goChapter(next)}>Capítulo {next.chapterNumber} <ChevronRight size={18} /></button>
            ) : (
              <p style={{ color: "var(--iz-muted)", margin: 0 }}>Estás al día. ¡No hay más capítulos por ahora!</p>
            )}
            <button type="button" className="iz-btn iz-btn--ghost" onClick={() => navigate(`/manga/${mangaId}`)}>Volver al manga</button>
          </div>
        )}
      </main>

      {/* Barra inferior */}
      <footer className={`iz-reader__bar iz-reader__bar--bottom ${showUI ? "" : "is-hidden"}`}>
        <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" disabled={!prev} onClick={() => goChapter(prev)}><ChevronLeft size={16} /> <span className="iz-hide-m">Anterior</span></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--iz-mono)", fontSize: 13, color: "var(--iz-text-2)" }}>
          {pages.length ? <>{prefs.mode === "paged" ? "Página" : "Pág."} {current + 1} / {pages.length}</> : "—"}
        </div>
        <button type="button" className="iz-btn iz-btn--primary iz-btn--sm" disabled={!next} onClick={() => goChapter(next)}><span className="iz-hide-m">Siguiente</span> <ChevronRight size={16} /></button>
      </footer>

      {/* Lista de capítulos */}
      {showList && (
        <div className="iz-drawer" onClick={() => setShowList(false)}>
          <div className="iz-drawer__panel" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottom: "1px solid var(--iz-line)" }}>
              <b>{chapters.length} capítulos</b>
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm" onClick={() => setShowList(false)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <ChapterList chapters={chapters} currentId={chapterId} onPick={goChapter} />
          </div>
        </div>
      )}
    </div>
  );
}

function ChapterList({ chapters, currentId, onPick }: { chapters: ChapterRef[]; currentId: string; onPick: (c: ChapterRef) => void }) {
  const listRef = useRef<HTMLDivElement>(null);
  const reversed = useMemo(() => [...chapters].reverse(), [chapters]);
  useEffect(() => { listRef.current?.querySelector(".is-active")?.scrollIntoView({ block: "center" }); }, []);
  return (
    <div ref={listRef} style={{ overflowY: "auto", padding: 8, flex: 1 }}>
      {reversed.map((c) => (
        <button key={c.id} type="button" className={`iz-menu__item ${c.id === currentId ? "is-active" : ""}`} onClick={() => onPick(c)}>
          <span style={{ fontFamily: "var(--iz-mono)", minWidth: 44, color: "var(--iz-muted)" }}>{c.chapterNumber}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title || `Capítulo ${c.chapterNumber}`}</span>
        </button>
      ))}
    </div>
  );
}
