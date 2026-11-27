import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, X, RefreshCw, BookOpen, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";
import { PosterCard, PosterSkeletons, EmptyState, Rail, SectionHead, WideCard, toScore10 } from "@/components/iz/ui";
import { getAllMangaProgress, removeMangaProgress, type MangaProgress } from "@/lib/mangaProgress";

interface MangaResult {
  id: string;
  title: string | { english?: string; romaji?: string; userPreferred?: string; native?: string };
  image?: string;
  cover?: string;
  status?: string;
  genres?: string[];
  rating?: number;
  chapters?: number;
}
interface MangaListResponse { results: MangaResult[]; hasNextPage?: boolean; currentPage?: number }

function resolveTitle(title: MangaResult["title"]): string {
  if (!title) return "Sin título";
  if (typeof title === "string") return title;
  return title.english || title.romaji || title.userPreferred || title.native || "Sin título";
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]);
  return v;
}

type MangaType = "manga" | "manhwa" | "manhua";
const TYPES: Array<{ id: MangaType; label: string; hint: string }> = [
  { id: "manga", label: "Manga", hint: "Japón" },
  { id: "manhwa", label: "Manhwa", hint: "Corea" },
  { id: "manhua", label: "Manhua", hint: "China" },
];

/* Portadas recordadas para "Continuar leyendo" (por si el progreso no la guardó) */
const COVER_KEY = "iz_manga_covers";
function readCovers(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(COVER_KEY) || "{}"); } catch { return {}; }
}
function rememberCovers(list: Array<{ id: string; image?: string }>) {
  try {
    const map = readCovers();
    for (const m of list) if (m.image) map[m.id] = m.image;
    const keys = Object.keys(map);
    if (keys.length > 600) for (const k of keys.slice(0, keys.length - 600)) delete map[k];
    localStorage.setItem(COVER_KEY, JSON.stringify(map));
  } catch { /* */ }
}

const STATUS_ES: Record<string, string> = { Ongoing: "EN CURSO", Completed: "COMPLETO", Hiatus: "PAUSA", Cancelled: "CANCELADO" };

export default function Manga() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"trending" | "recent">("trending");
  const [type, setType] = useState<MangaType>(() => {
    try { const t = localStorage.getItem("iz_manga_type"); if (t === "manga" || t === "manhwa" || t === "manhua") return t; } catch { /* */ }
    return "manga";
  });
  const [query, setQuery] = useState("");
  const [reading, setReading] = useState<MangaProgress[]>(() => getAllMangaProgress());
  const [covers, setCovers] = useState<Record<string, string>>(() => readCovers());
  const debounced = useDebounced(query.trim(), 400);
  const isSearching = debounced.length >= 2;

  usePageMeta({ title: "Manga, manhwa y manhua en español", description: "Lee manga, manhwa y manhua online en HD y en español. Modo webtoon, capítulos al día y tu progreso guardado." });

  const chooseType = (t: MangaType) => { setType(t); try { localStorage.setItem("iz_manga_type", t); } catch { /* */ } };

  const list = useInfiniteQuery<MangaListResponse>({
    queryKey: ["manga-list", isSearching ? "search" : tab, type, debounced],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const page = Number(pageParam) || 1;
      return apiClient.get<MangaListResponse>(
        isSearching
          ? `/manga/search?q=${encodeURIComponent(debounced)}&page=${page}`
          : `/manga/${tab}?type=${type}&page=${page}`,
      );
    },
    getNextPageParam: (last, all) => (last?.hasNextPage ? all.length + 1 : undefined),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Igual que la app: se muestran dos páginas de entrada (≈48 títulos)
  const pageCount = list.data?.pages.length ?? 0;
  useEffect(() => {
    if (pageCount === 1 && list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageCount, list.hasNextPage]);

  const mangas = useMemo(() => {
    const seen = new Set<string>();
    return (list.data?.pages ?? []).flatMap((p) => p?.results ?? []).filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [list.data]);

  useEffect(() => {
    if (!mangas.length) return;
    rememberCovers(mangas.map((m) => ({ id: m.id, image: m.image })));
    setCovers(readCovers());
  }, [mangas]);

  // Carga automática al llegar al final
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
    }, { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [list.hasNextPage, list.isFetchingNextPage, list.fetchNextPage]);

  const loadingFresh = list.isLoading;
  const toPoster = (m: MangaResult) => ({
    id: m.id,
    title: resolveTitle(m.title),
    image: m.image ?? "",
    href: `/manga/${m.id}`,
    score: toScore10(m.rating),
    badge: m.status ? STATUS_ES[m.status] ?? m.status.toUpperCase() : undefined,
    accentBadge: m.status === "Ongoing",
    meta: [m.chapters != null ? `${m.chapters} caps` : null, m.genres?.slice(0, 2).join(" · ")].filter(Boolean).join(" · ") || undefined,
  });

  const headline = useMemo(() => (isSearching ? <>Resultados para <span className="iz-serif">“{debounced}”</span></> : <>Manga <span className="iz-serif">al día</span></>), [isSearching, debounced]);

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container">
        <header className="iz-pagehead">
          <div className="iz-head__eyebrow"><BookOpen size={13} /> Lector HD · Webtoon</div>
          <h1>{headline}</h1>
          <p>Manga, manhwa y manhua en español, cada uno por separado. Tu último capítulo se guarda automáticamente.</p>
        </header>

        <div role="tablist" aria-label="Tipo" style={{ display: isSearching ? "none" : "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {TYPES.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={type === t.id}
              className={`iz-btn iz-btn--sm ${type === t.id ? "iz-btn--primary" : "iz-btn--ghost"}`}
              onClick={() => chooseType(t.id)}>
              {t.label} <span style={{ opacity: 0.55, fontWeight: 500 }}>· {t.hint}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 520 }}>
            <Search size={17} color="#71717a" style={{ position: "absolute", left: 14, top: 13 }} />
            <input className="iz-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busca manga, manhwa o manhua…" style={{ paddingLeft: 42, paddingRight: 40 }} aria-label="Buscar manga" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar" style={{ position: "absolute", right: 10, top: 10, background: "none", border: 0, color: "#a1a1aa", cursor: "pointer" }}><X size={18} /></button>}
          </div>
          {!isSearching && (
            <>
              <button type="button" className={`iz-chip ${tab === "trending" ? "is-active" : ""}`} onClick={() => setTab("trending")}>Populares</button>
              <button type="button" className={`iz-chip ${tab === "recent" ? "is-active" : ""}`} onClick={() => setTab("recent")}>Recientes</button>
            </>
          )}
        </div>

        {!isSearching && reading.length > 0 && (
          <section className="iz-section" style={{ marginTop: 28 }}>
            <SectionHead eyebrow="Tu progreso" title="Continuar" serif="leyendo" />
            <Rail label="Continuar leyendo">
              {reading.slice(0, 12).map((r) => (
                <WideCard key={r.mangaId} title={r.mangaTitle} image={r.mangaImage || covers[r.mangaId] || ""}
                  meta={r.chapterNumber != null ? `Capítulo ${r.chapterNumber}` : "Continuar"}
                  right={r.totalPages ? `pág. ${r.page + 1}/${r.totalPages}` : undefined}
                  progress={r.totalPages ? (r.page + 1) / r.totalPages : undefined}
                  onRemove={() => { removeMangaProgress(r.mangaId); setReading(getAllMangaProgress()); }}
                  onClick={() => navigate(`/manga/${r.mangaId}/leer/${r.chapterId}`)} />
              ))}
            </Rail>
          </section>
        )}

        <section className="iz-section" style={{ marginTop: 28 }}>
          {loadingFresh ? (
            <div className="iz-grid"><PosterSkeletons count={18} /></div>
          ) : list.isError && mangas.length === 0 ? (
            <EmptyState title="No pudimos cargar los mangas" text="El servidor de manga no respondió. Inténtalo en unos segundos."
              action={<button type="button" className="iz-btn iz-btn--primary" onClick={() => list.refetch()}><RefreshCw size={16} /> Reintentar</button>} />
          ) : mangas.length === 0 ? (
            <EmptyState title={isSearching ? "Sin resultados" : "No hay mangas disponibles"} text={isSearching ? "Prueba con otro nombre." : undefined} />
          ) : (
            <div className="iz-grid">{mangas.map((m) => <PosterCard key={m.id} data={toPoster(m)} />)}</div>
          )}

          <div ref={sentinelRef} style={{ height: 1 }} />
          {list.isFetchingNextPage && (
            <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--iz-muted)" }}><Loader2 size={20} className="iz-spin" /></div>
          )}
          {list.hasNextPage && !list.isFetchingNextPage && mangas.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
              <button type="button" className="iz-btn iz-btn--ghost" onClick={() => list.fetchNextPage()}>Cargar más</button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
