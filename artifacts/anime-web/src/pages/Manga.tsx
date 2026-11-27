import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronLeft, ChevronRight, RefreshCw, BookOpen } from "lucide-react";
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

const STATUS_ES: Record<string, string> = { Ongoing: "EN CURSO", Completed: "COMPLETO", Hiatus: "PAUSA", Cancelled: "CANCELADO" };

export default function Manga() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<"trending" | "recent">("trending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reading, setReading] = useState<MangaProgress[]>(() => getAllMangaProgress());
  const debounced = useDebounced(query.trim(), 400);
  const isSearching = debounced.length >= 2;

  usePageMeta({ title: "Manga online en español HD", description: "Lee manga, manhwa y manhua online en HD y en español. Modo webtoon, capítulos al día y tu progreso guardado." });

  useEffect(() => { setPage(1); }, [tab, debounced]);

  const endpoint = isSearching ? `/manga/search?q=${encodeURIComponent(debounced)}&page=${page}` : `/manga/${tab}?page=${page}`;
  const list = useQuery<MangaListResponse>({
    queryKey: ["manga", isSearching ? "search" : tab, debounced, page],
    queryFn: () => apiClient.get<MangaListResponse>(endpoint),
    staleTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    retry: 1,
  });

  const mangas = list.data?.results ?? [];
  const hasNext = list.data?.hasNextPage ?? false;
  const loadingFresh = list.isLoading || (list.isFetching && list.isPlaceholderData);

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

  const changePage = (n: number) => { setPage(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const headline = useMemo(() => (isSearching ? <>Resultados para <span className="iz-serif">“{debounced}”</span></> : <>Manga <span className="iz-serif">al día</span></>), [isSearching, debounced]);

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container">
        <header className="iz-pagehead">
          <div className="iz-head__eyebrow"><BookOpen size={13} /> Lector HD · Webtoon</div>
          <h1>{headline}</h1>
          <p>Manga, manhwa y manhua en español. Tu último capítulo se guarda automáticamente.</p>
        </header>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <div style={{ position: "relative", flex: "1 1 300px", maxWidth: 520 }}>
            <Search size={17} color="#71717a" style={{ position: "absolute", left: 14, top: 13 }} />
            <input className="iz-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busca un manga…" style={{ paddingLeft: 42, paddingRight: 40 }} aria-label="Buscar manga" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpiar" style={{ position: "absolute", right: 10, top: 10, background: "none", border: 0, color: "#a1a1aa", cursor: "pointer" }}><X size={18} /></button>}
          </div>
          {!isSearching && (
            <>
              <button type="button" className={`iz-chip ${tab === "trending" ? "is-active" : ""}`} onClick={() => setTab("trending")}>Populares</button>
              <button type="button" className={`iz-chip ${tab === "recent" ? "is-active" : ""}`} onClick={() => setTab("recent")}>Recientes</button>
            </>
          )}
        </div>

        {!isSearching && reading.length > 0 && page === 1 && (
          <section className="iz-section" style={{ marginTop: 28 }}>
            <SectionHead eyebrow="Tu progreso" title="Continuar" serif="leyendo" />
            <Rail label="Continuar leyendo">
              {reading.slice(0, 12).map((r) => (
                <WideCard key={r.mangaId} title={r.mangaTitle} image={r.mangaImage ?? ""}
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

          {(page > 1 || hasNext) && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 36 }}>
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" disabled={page <= 1 || list.isFetching} onClick={() => changePage(page - 1)}><ChevronLeft size={16} /> Anterior</button>
              <span style={{ fontFamily: "var(--iz-mono)", color: "var(--iz-muted)", fontSize: 13 }}>Página {page}</span>
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" disabled={!hasNext || list.isFetching} onClick={() => changePage(page + 1)}>Siguiente <ChevronRight size={16} /></button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
