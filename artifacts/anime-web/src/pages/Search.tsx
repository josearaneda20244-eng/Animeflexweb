import { useEffect, useMemo, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X, SlidersHorizontal, RefreshCw } from "lucide-react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import {
  browseAnime, ANILIST_GENRES, ANILIST_TAGS, GENRE_LABELS_ES,
  type BrowseFormat, type BrowseSeason, type BrowseSort, type BrowseStatus,
} from "@/lib/anilistBrowse";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";
import { PosterCard, PosterSkeletons, EmptyState, toScore10 } from "@/components/iz/ui";

const FORMATS: { v: BrowseFormat; l: string }[] = [
  { v: "", l: "Todos" }, { v: "TV", l: "Series" }, { v: "MOVIE", l: "Películas" }, { v: "OVA", l: "OVA" }, { v: "ONA", l: "ONA" }, { v: "SPECIAL", l: "Especiales" },
];
const STATUSES: { v: BrowseStatus; l: string }[] = [
  { v: "", l: "Cualquier estado" }, { v: "RELEASING", l: "En emisión" }, { v: "FINISHED", l: "Finalizado" }, { v: "NOT_YET_RELEASED", l: "Próximamente" },
];
const SEASONS: { v: BrowseSeason; l: string }[] = [
  { v: "", l: "Cualquier temporada" }, { v: "WINTER", l: "Invierno" }, { v: "SPRING", l: "Primavera" }, { v: "SUMMER", l: "Verano" }, { v: "FALL", l: "Otoño" },
];
const SORTS: { v: BrowseSort; l: string }[] = [
  { v: "popularity", l: "Más populares" }, { v: "trending", l: "Tendencia" }, { v: "score", l: "Mejor valorados" }, { v: "latest", l: "Más recientes" }, { v: "title", l: "A–Z" },
];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: THIS_YEAR - 1969 }, (_, i) => THIS_YEAR + 1 - i);

/** Compatibilidad con enlaces antiguos: /search?q=Action o ?q=trending */
const LEGACY_GENRE: Record<string, string> = { action: "Action", adventure: "Adventure", comedy: "Comedy", drama: "Drama", fantasy: "Fantasy", horror: "Horror", romance: "Romance", "sci-fi": "Sci-Fi", thriller: "Thriller", mystery: "Mystery", shounen: "Shounen", shonen: "Shounen", isekai: "Isekai", sports: "Sports", "slice of life": "Slice of Life" };

function readParams(raw: string) {
  const p = new URLSearchParams(raw);
  let q = p.get("q") ?? "";
  let genre = p.get("genre") ?? "";
  let sort = (p.get("sort") ?? "") as BrowseSort | "";
  const lq = q.trim().toLowerCase();
  if (lq === "trending" || lq === "popular") { sort = lq === "trending" ? "trending" : "popularity"; q = ""; }
  else if (!genre && LEGACY_GENRE[lq]) { genre = LEGACY_GENRE[lq]; q = ""; }
  return {
    q,
    genre,
    year: Number(p.get("year")) || 0,
    season: (p.get("season") ?? "") as BrowseSeason,
    format: (p.get("format") ?? "") as BrowseFormat,
    status: (p.get("status") ?? "") as BrowseStatus,
    sort: sort as BrowseSort | "",
  };
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = window.setTimeout(() => setV(value), ms); return () => window.clearTimeout(t); }, [value, ms]);
  return v;
}

const selectStyle: React.CSSProperties = { height: 40, padding: "0 12px", borderRadius: 8, background: "#0a0a0a", border: "1px solid var(--iz-line-2)", color: "#fff", fontSize: 13, cursor: "pointer" };

export default function Search() {
  const raw = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => readParams(raw), [raw]);
  const [text, setText] = useState(params.q);
  const [showFilters, setShowFilters] = useState(false);
  const debounced = useDebounced(text, 450);

  // URL → input (cuando se busca desde el navbar estando ya en /search)
  useEffect(() => { setText(params.q); }, [params.q]);

  const update = (patch: Partial<Record<keyof typeof params, string | number>>) => {
    const next = { ...params, ...patch };
    const sp = new URLSearchParams();
    if (next.q) sp.set("q", String(next.q));
    if (next.genre) sp.set("genre", String(next.genre));
    if (next.year) sp.set("year", String(next.year));
    if (next.season) sp.set("season", String(next.season));
    if (next.format) sp.set("format", String(next.format));
    if (next.status) sp.set("status", String(next.status));
    if (next.sort) sp.set("sort", String(next.sort));
    const qs = sp.toString();
    navigate(`/search${qs ? `?${qs}` : ""}`, { replace: true });
  };

  // input (debounced) → URL
  useEffect(() => {
    if (debounced.trim() !== params.q.trim()) update({ q: debounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const activeFilters = [params.genre, params.year, params.season, params.format, params.status].filter(Boolean).length;

  usePageMeta({
    title: params.q ? `Resultados para “${params.q}”` : params.genre ? `Anime de ${GENRE_LABELS_ES[params.genre] ?? params.genre}` : "Explorar anime",
    description: "Busca y filtra miles de animes por género, año, temporada, formato y estado.",
  });

  const query = useInfiniteQuery({
    queryKey: ["browse", params],
    queryFn: async ({ pageParam, signal }) => {
      try {
        return await browseAnime({
          search: params.q, genre: params.genre || undefined, year: params.year || undefined,
          season: params.season, format: params.format, status: params.status,
          sort: params.sort || undefined, page: pageParam as number,
        }, signal);
      } catch (err) {
        // Respaldo: búsqueda por texto en nuestro backend si AniList falla
        if (params.q && (pageParam as number) === 1) return consumet.search(params.q, 1);
        throw err;
      }
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.currentPage + 1 : undefined),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const results = useMemo(() => {
    const all: AnimeResult[] = query.data?.pages.flatMap((p: { results: AnimeResult[] }) => p.results) ?? [];
    return Array.from(new Map(all.map((a) => [a.id, a])).values());
  }, [query.data]);

  const toPoster = (a: AnimeResult) => ({
    id: a.id,
    title: resolveTitle(a.title),
    image: a.image,
    score: toScore10(a.rating),
    badge: a.status === "RELEASING" || a.status === "Ongoing" ? "EN EMISIÓN" : undefined,
    accentBadge: true,
    meta: [a.type, a.releaseDate].filter(Boolean).join(" · ") || undefined,
  });

  const heading = params.q ? <>Resultados para <span className="iz-serif">“{params.q}”</span></>
    : params.genre ? <>Anime de <span className="iz-serif">{GENRE_LABELS_ES[params.genre] ?? params.genre}</span></>
    : <>Explorar <span className="iz-serif">anime</span></>;

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container">
        <header className="iz-pagehead">
          <div className="iz-head__eyebrow"><span className="iz-dot" />Catálogo completo</div>
          <h1>{heading}</h1>
        </header>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 320px", maxWidth: 560 }}>
            <SearchIcon size={17} color="#71717a" style={{ position: "absolute", left: 14, top: 13 }} />
            <input className="iz-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Busca por título, en inglés o romaji…" style={{ paddingLeft: 42, paddingRight: 40 }} aria-label="Buscar anime" />
            {text && <button type="button" aria-label="Limpiar" onClick={() => { setText(""); update({ q: "" }); }} style={{ position: "absolute", right: 10, top: 10, background: "none", border: 0, color: "#a1a1aa", cursor: "pointer" }}><X size={18} /></button>}
          </div>
          <select aria-label="Ordenar" style={selectStyle} value={params.sort || (params.q ? "" : "popularity")} onChange={(e) => update({ sort: e.target.value })}>
            {params.q && <option value="">Relevancia</option>}
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          <button type="button" className={`iz-btn iz-btn--sm ${showFilters || activeFilters ? "iz-btn--accent" : "iz-btn--ghost"}`} style={{ height: 40 }} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal size={15} /> Filtros{activeFilters ? ` (${activeFilters})` : ""}
          </button>
          {activeFilters > 0 && <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" style={{ height: 40 }} onClick={() => update({ genre: "", year: 0, season: "", format: "", status: "" })}>Limpiar</button>}
        </div>

        {showFilters && (
          <div className="iz-panel iz-panel--pad" style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select aria-label="Formato" style={selectStyle} value={params.format} onChange={(e) => update({ format: e.target.value })}>{FORMATS.map((f) => <option key={f.v} value={f.v}>{f.v ? f.l : "Cualquier formato"}</option>)}</select>
            <select aria-label="Estado" style={selectStyle} value={params.status} onChange={(e) => update({ status: e.target.value })}>{STATUSES.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}</select>
            <select aria-label="Año" style={selectStyle} value={params.year || ""} onChange={(e) => update({ year: Number(e.target.value) || 0 })}>
              <option value="">Cualquier año</option>{YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select aria-label="Temporada" style={selectStyle} value={params.season} onChange={(e) => update({ season: e.target.value })}>{SEASONS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}</select>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 0 28px", scrollbarWidth: "none" }}>
          <button type="button" className={`iz-chip ${!params.genre ? "is-active" : ""}`} onClick={() => update({ genre: "" })}>Todos</button>
          {[...ANILIST_GENRES, ...ANILIST_TAGS].map((g) => (
            <button key={g} type="button" className={`iz-chip ${params.genre === g ? "is-active" : ""}`} onClick={() => update({ genre: params.genre === g ? "" : g })}>
              {GENRE_LABELS_ES[g] ?? g}
            </button>
          ))}
        </div>

        {query.isLoading ? (
          <div className="iz-grid"><PosterSkeletons count={18} /></div>
        ) : query.isError && results.length === 0 ? (
          <EmptyState title="No pudimos completar la búsqueda" text="Revisa tu conexión e inténtalo de nuevo."
            action={<button type="button" className="iz-btn iz-btn--primary" onClick={() => query.refetch()}><RefreshCw size={16} /> Reintentar</button>} />
        ) : results.length === 0 ? (
          <EmptyState title="Sin resultados" text="Prueba con otro título (en inglés o romaji) o quita algunos filtros." />
        ) : (
          <>
            <div className="iz-grid">{results.map((a) => <PosterCard key={a.id} data={toPoster(a)} />)}</div>
            {query.hasNextPage && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
                <button type="button" className="iz-btn iz-btn--ghost" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  {query.isFetchingNextPage ? "Cargando…" : "Cargar más"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
