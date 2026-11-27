import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Heart, Star, Play, ChevronDown, ChevronUp, Calendar, Share2, BookOpen, CheckCircle2, Clock3,
  X, Clapperboard, XCircle, RefreshCw, Search as SearchIcon,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { consumet, resolveTitle, type Episode, type AnimeResult } from "@/lib/consumet";
import { useFavorites } from "@/context/FavoritesContext";
import { useHistory } from "@/context/HistoryContext";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useWatchList, type WatchStatus } from "@/context/WatchListContext";
import CommentsSection from "@/components/CommentsSection";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta, SITE_URL } from "@/lib/usePageMeta";
import { Rail, SectionHead, PosterCard, EmptyState, HeroBackdrop, toScore10 } from "@/components/iz/ui";
import { useAuth } from "@/context/AuthContext";
import AdBanner from "@/components/AdBanner";

const STATUS_OPTIONS: { value: WatchStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "watching", label: "Viendo", icon: <Play size={13} fill="currentColor" />, color: "#3f2eb2" },
  { value: "completed", label: "Completado", icon: <CheckCircle2 size={13} />, color: "#22C55E" },
  { value: "plan_to_watch", label: "Pendiente", icon: <Clock3 size={13} />, color: "#F59E0B" },
  { value: "dropped", label: "Abandonado", icon: <XCircle size={13} />, color: "#EF4444" },
];

function WatchStatusButton({ animeForList, onStatusChange }: { animeForList: AnimeResult; onStatusChange?: (status: WatchStatus | null) => void }) {
  const { getStatus, setStatus } = useWatchList();
  const [open, setOpen] = useState(false);
  const current = getStatus(animeForList.id);
  const currentOpt = STATUS_OPTIONS.find((o) => o.value === current);

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className={`iz-btn iz-btn--lg ${currentOpt ? "iz-btn--accent" : "iz-btn--ghost"}`} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {currentOpt ? currentOpt.icon : <BookOpen size={13} />}
        {currentOpt ? currentOpt.label : "Mi lista"}
        <ChevronDown size={14} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div className="iz-menu" style={{ left: 0, right: "auto", minWidth: 190 }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                const newStatus = current === opt.value ? null : opt.value;
                setStatus(animeForList, newStatus);
                onStatusChange?.(newStatus);
                setOpen(false);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "9px 12px", background: current === opt.value ? opt.color + "22" : "none",
                border: "none", borderRadius: 10, cursor: "pointer",
                color: current === opt.value ? opt.color : "rgba(255,255,255,0.75)",
                fontSize: 13, fontWeight: 600, textAlign: "left",
              }}
              onMouseEnter={(e) => { if (current !== opt.value) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)"; }}
              onMouseLeave={(e) => { if (current !== opt.value) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
            >
              {opt.icon} {opt.label}
              {current === opt.value && <X size={10} style={{ marginLeft: "auto", opacity: 0.5 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/* ── USER RATING WIDGET ── */
const RATING_LABELS: Record<number, string> = { 1: "Malo", 2: "Regular", 3: "Bueno", 4: "Muy bueno", 5: "Excelente" };

function UserRatingWidget({ animeId }: { animeId: string }) {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(() => {
    try { return (JSON.parse(localStorage.getItem("af_user_ratings") || "{}"))[animeId] ?? 0; } catch { return 0; }
  });
  const [hover, setHover] = useState(0);
  const [communityAvg, setCommunityAvg] = useState<number>(0);
  const [communityTotal, setCommunityTotal] = useState<number>(0);

  useEffect(() => {
    apiClient.get<{ avg: number; total: number; userScore: number | null }>(`/anime/${animeId}/rating`)
      .then(d => {
        setCommunityAvg(d.avg);
        setCommunityTotal(d.total);
        if (d.userScore != null && user) {
          setRating(d.userScore);
          try {
            const all = JSON.parse(localStorage.getItem("af_user_ratings") || "{}");
            all[animeId] = d.userScore;
            localStorage.setItem("af_user_ratings", JSON.stringify(all));
          } catch {}
        }
      })
      .catch(() => {});
  }, [animeId, user]);

  const handleRate = (n: number) => {
    const next = rating === n ? 0 : n;
    setRating(next);
    try {
      const all = JSON.parse(localStorage.getItem("af_user_ratings") || "{}");
      if (next === 0) delete all[animeId];
      else all[animeId] = next;
      localStorage.setItem("af_user_ratings", JSON.stringify(all));
    } catch {}
    if (user) {
      apiClient.post<{ avg: number; total: number }>(`/anime/${animeId}/rating`, { score: next })
        .then(d => { setCommunityAvg(d.avg); setCommunityTotal(d.total); })
        .catch(() => {});
    }
  };

  const display = hover || rating;
  return (
    <div className="iz-panel iz-panel--pad">
      <div className="flex items-center gap-2 mb-3">
        <div className="iz-head__eyebrow" style={{ margin: 0 }}><span className="iz-dot" />Tu valoración</div>
        {communityTotal > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.3)", fontSize: 11, marginLeft: "auto" }}>
            <Star size={10} color="#F59E0B" fill="#F59E0B" />
            <span style={{ color: "#F59E0B", fontWeight: 800 }}>{communityAvg.toFixed(1)}</span>
            <span>({communityTotal} votos)</span>
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => handleRate(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: "4px 3px",
              transition: "transform 0.1s",
              transform: display >= n ? "scale(1.18)" : "scale(1)",
            }}
          >
            <Star
              size={26}
              color="#fbbf24"
              fill={display >= n ? "#fbbf24" : "transparent"}
            />
          </button>
        ))}
        {display > 0 && (
          <span style={{ color: "#F59E0B", fontSize: 14, fontWeight: 800, marginLeft: 10 }}>
            {RATING_LABELS[display]}
          </span>
        )}
      </div>
    </div>
  );
}

function TrailerModal({ trailerId, onClose }: { trailerId: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.92)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 900, position: "relative" }}>
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: -44, right: 0, background: "rgba(255,255,255,0.1)",
            border: "none", borderRadius: 10, padding: "8px 12px", color: "#fff",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
          }}
        >
          <X size={14} /> Cerrar
        </button>
        <div style={{ position: "relative", paddingBottom: "56.25%", borderRadius: 16, overflow: "hidden", background: "#000" }}>
          <iframe
            src={`https://www.youtube.com/embed/${trailerId}?autoplay=1&rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AnimeDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { isMegaFan } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToHistory } = useHistory();
  const { getAnimeProgress } = useWatchProgress();
  const queryClient = useQueryClient();
  // const { addNotification } = useNotifications(); // Commented out - using new notification system
  const [descExpanded, setDescExpanded] = useState(false);
  const { progress } = useWatchProgress();
  const [clickedEps, setClickedEps] = useState<Set<number>>(new Set());
  const [epRange, setEpRange] = useState(0);
  const [epFilter, setEpFilter] = useState<"all" | "unwatched">("all");
  const [epSearch, setEpSearch] = useState("");
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);


  const infoQuery = useQuery({
    queryKey: ["animeAnilistInfo", id],
    queryFn: () => consumet.anilistInfo(id!),
    enabled: !!id,
    retry: 2,
    staleTime: 1000 * 60 * 10,
  });

  // anilist-info resolves MAL ID → AniList ID internally; use the resolved
  // AniList ID for AnimeKai episode mapping (AnimeKai requires AniList IDs).
  const resolvedAnilistId = infoQuery.data?.id;

  const paheQuery = useQuery({
    queryKey: ["animeEpisodesById", resolvedAnilistId],
    queryFn: () => consumet.episodesById(resolvedAnilistId!),
    enabled: !!resolvedAnilistId,
    retry: 2,
    staleTime: 1000 * 60 * 10,
  });

  const anime = infoQuery.data;

  // Normalize AnimeKai episodes so they can serve as a fallback list
  // when AniList doesn't know the episode count (airing / unknown total).
  const paheEpisodesList: Episode[] = (paheQuery.data?.episodes ?? []).map((ep: any) => ({
    id: ep.id ?? `pahe-${ep.number}`,
    number: ep.number ?? 0,
    title: ep.title ?? `Episodio ${ep.number}`,
    image: ep.image ?? null,
    url: ep.url ?? null,
  }));

  const fav = isFavorite(id!);
  const animeProgress = getAnimeProgress(id!);

  const title = resolveTitle(anime?.title);
  const image = anime?.image ?? "";
  const cover = anime?.cover ?? "";
  const rawDesc = (anime?.description ?? "").replace(/<[^>]+>/g, "");
  const genres = anime?.genres ?? [];
  const anilistEpisodes = anime?.episodes ?? [];
  /**
   * IMPORTANTE: solo mostramos episodios REALMENTE disponibles en el proveedor de streaming
   * (paheEpisodesList). Antes se mezclaba con la metadata total de AniList (totalEpisodes),
   * lo que generaba botones "fantasma" para episodios aún no emitidos: al pulsarlos, el
   * reproductor no encontraba el stream y caía a otro anime distinto.
   *
   * Si el proveedor todavía está cargando o falló por completo, usamos AniList como
   * último recurso para no dejar la pantalla vacía.
   */
  const episodes: Episode[] =
    paheEpisodesList.length > 0
      ? paheEpisodesList
      : (paheQuery.isLoading || paheQuery.isError ? anilistEpisodes : []);
  const characters = anime?.characters ?? [];
  const recommendations = (anime?.recommendations ?? []).filter((r) => r.image);
  const trailer = anime?.trailer;
  const hasYouTubeTrailer = trailer?.site?.toLowerCase() === "youtube" && trailer?.id;

  const animeForFav: AnimeResult = {
    id: id!,
    title: title,
    image: image,
    cover: cover || undefined,
    rating: anime?.rating,
    type: anime?.type,
    status: anime?.status,
    genres: genres,
  };

  /* Prefetch streaming source for faster perceived player load.
   * Same query keys as Player.tsx so the cache is reused.
   */
  const prefetchStream = useCallback(
    (epId: string, epNum: number) => {
      if (!epId || !title) return;
      queryClient.prefetchQuery({
        queryKey: ["stream", epId, title, String(epNum), id],
        queryFn: () =>
          consumet.streaming(epId, title || undefined, String(epNum), id || undefined),
        staleTime: 1000 * 60 * 15,
      });
      // Mismas claves que Player.tsx → el reproductor arranca con la caché caliente
      let audio: "sub" | "lat" = "sub";
      try { audio = localStorage.getItem("iz_audio") === "lat" ? "lat" : "sub"; } catch { /* */ }
      queryClient.prefetchQuery({
        queryKey: ["engine-sources", id, String(epNum), title, audio],
        queryFn: async () => {
          try { return await consumet.sources(id!, epNum, title, audio === "lat"); }
          catch (err) { if (audio === "lat") throw err; return consumet.animeflvWatch(title, epNum, id || undefined); }
        },
        staleTime: 1000 * 60 * 10,
      });
    },
    [queryClient, title, id],
  );

  const handleEpisode = (ep: Episode) => {
    if (!ep?.id) return;
    setClickedEps((prev) => new Set([...prev, ep.number]));
    addToHistory(animeForFav, ep.number);

    const paheEpisodes = paheQuery.data?.episodes ?? [];
    const paheEp = paheEpisodes.find((e) => e.number === ep.number);
    const resolvedId = paheEp?.id ?? ep.id;

    const nextEp = episodes.find((e) => e.number === ep.number + 1);
    const nextPahe = nextEp ? paheEpisodes.find((e) => e.number === nextEp.number) : undefined;
    const nextResolvedId = nextPahe?.id ?? nextEp?.id;

    /* Fire prefetch RIGHT NOW (before navigation) so by the time the Player
     * mounts and runs its useQuery, the in-flight request is already underway
     * or the cache is already populated. */
    prefetchStream(resolvedId, ep.number);

    const params = new URLSearchParams({
      episodeId: resolvedId,
      episodeNum: String(ep.number),
      animeTitle: title,
      animeId: id!,
      animeImage: image,
    });
    if (nextResolvedId) {
      params.set("nextEpisodeId", nextResolvedId);
      params.set("nextEpisodeNum", String(nextEp!.number));
    }
    navigate(`/watch?${params.toString()}`);
  };

  /* Auto-prefetch the most likely "next-to-watch" episode when episodes load.
   * This warms the cache so clicking "Continuar" / "Reproducir" feels instant. */
  useEffect(() => {
    if (!title || episodes.length === 0) return;
    const target =
      (animeProgress && episodes.find((e) => e.number === animeProgress.episodeNum)) ||
      episodes[0];
    if (!target?.id) return;
    const paheEpisodes = paheQuery.data?.episodes ?? [];
    const paheEp = paheEpisodes.find((e) => e.number === target.number);
    const resolvedId = paheEp?.id ?? target.id;
    /* Small delay so we don't compete with the initial page render */
    const t = setTimeout(() => prefetchStream(resolvedId, target.number), 800);
    return () => clearTimeout(t);
  }, [episodes, animeProgress, title, paheQuery.data, prefetchStream]);

  /* Episodios vistos / en curso: derivados del progreso guardado (persisten entre sesiones). */
  const { watchedNums, progressByNum } = useMemo(() => {
    const watched = new Set<number>(clickedEps);
    const byNum = new Map<number, number>();
    for (const p of progress) {
      if (String(p.animeId) !== String(id)) continue;
      const ratio = p.duration > 0 ? p.currentTime / p.duration : 0;
      byNum.set(p.episodeNum, ratio);
      if (ratio >= 0.85) watched.add(p.episodeNum);
    }
    return { watchedNums: watched, progressByNum: byNum };
  }, [progress, id, clickedEps]);

  const RANGE = 100;
  const ranges = useMemo(() => {
    if (episodes.length <= RANGE) return [] as { label: string; from: number; to: number }[];
    const out: { label: string; from: number; to: number }[] = [];
    for (let i = 0; i < episodes.length; i += RANGE) {
      const from = episodes[i].number;
      const to = episodes[Math.min(i + RANGE, episodes.length) - 1].number;
      out.push({ label: `${from}–${to}`, from: i, to: Math.min(i + RANGE, episodes.length) });
    }
    return out;
  }, [episodes]);

  // Abrir el rango donde está el episodio en curso
  useEffect(() => {
    if (!ranges.length || !animeProgress) return;
    const idx = episodes.findIndex((e) => e.number === animeProgress.episodeNum);
    if (idx >= 0) setEpRange(Math.floor(idx / RANGE));
  }, [ranges.length, animeProgress?.episodeNum]); // eslint-disable-line react-hooks/exhaustive-deps

  const normalizedEpSearch = epSearch.trim().toLowerCase();
  const visibleEps = useMemo(() => {
    let list = episodes;
    if (normalizedEpSearch) {
      list = list.filter((ep) => String(ep.number) === normalizedEpSearch || String(ep.number).startsWith(normalizedEpSearch) || (ep.title ?? "").toLowerCase().includes(normalizedEpSearch));
    } else if (ranges.length) {
      const r = ranges[Math.min(epRange, ranges.length - 1)];
      list = list.slice(r.from, r.to);
    }
    if (epFilter === "unwatched") list = list.filter((ep) => !watchedNums.has(ep.number));
    return list;
  }, [episodes, normalizedEpSearch, ranges, epRange, epFilter, watchedNums]);

  /* ── SEO dinámico: OG/Twitter para compartir ── */
  const seoDesc = rawDesc ? rawDesc.slice(0, 190) : `Mira ${title} online en HD con subtítulos en español.`;
  const jsonLd = useMemo(() => (anime ? {
    "@context": "https://schema.org",
    "@type": anime.type === "MOVIE" ? "Movie" : "TVSeries",
    name: title,
    image: image || undefined,
    description: seoDesc,
    genre: genres,
    numberOfEpisodes: anime.totalEpisodes ?? undefined,
    url: `${SITE_URL}/anime/${id}`,
    aggregateRating: anime.rating ? { "@type": "AggregateRating", ratingValue: (anime.rating / 10).toFixed(1), bestRating: "10", ratingCount: 100 } : undefined,
  } : undefined), [anime, title, image, seoDesc, genres, id]);
  usePageMeta({
    title: anime ? `Ver ${title} sub español` : "Cargando anime",
    description: seoDesc,
    image: cover || image,
    imageAlt: title,
    url: `${SITE_URL}/anime/${id}`,
    type: anime?.type === "MOVIE" ? "video.movie" : "video.tv_show",
    jsonLd,
  });

  const share = async () => {
    const url = `${SITE_URL}/anime/${id}`;
    try {
      if (navigator.share) { await navigator.share({ title, text: `Mira ${title} en IZIFF ANIME`, url }); return; }
      await navigator.clipboard.writeText(url);
      setShareToast("Enlace copiado");
    } catch { return; }
    window.setTimeout(() => setShareToast(null), 2200);
  };

  const playMain = () => {
    if (animeProgress) {
      const ep = episodes.find((e) => e.number === animeProgress.episodeNum);
      if (ep) { handleEpisode(ep); return; }
    }
    if (episodes[0]) handleEpisode(episodes[0]);
  };

  if (infoQuery.isLoading) {
    return (
      <div className="iz-page iz-page--flush">
        <Navbar transparent />
        <section className="iz-hero" style={{ height: "clamp(420px, 62svh, 600px)" }}><div className="iz-hero__grid" /></section>
        <div className="iz-container iz-overlap" style={{ display: "flex", gap: 24 }}>
          <div className="iz-skel" style={{ width: 200, aspectRatio: "2/3", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "grid", gap: 12, alignContent: "start", paddingTop: 40 }}>
            <div className="iz-skel" style={{ height: 40, width: "60%" }} /><div className="iz-skel" style={{ height: 16, width: "80%" }} /><div className="iz-skel" style={{ height: 16, width: "70%" }} />
          </div>
        </div>
      </div>
    );
  }

  if (infoQuery.isError || !anime) {
    return (
      <div className="iz-page">
        <Navbar />
        <div className="iz-container" style={{ paddingTop: 80 }}>
          <EmptyState title="No se pudo cargar el anime" text="Puede ser un problema temporal del servidor."
            action={<div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button type="button" className="iz-btn iz-btn--primary" onClick={() => infoQuery.refetch()}><RefreshCw size={16} /> Reintentar</button>
              <button type="button" className="iz-btn iz-btn--ghost" onClick={() => navigate("/")}>Volver al inicio</button>
            </div>} />
        </div>
      </div>
    );
  }

  const score = toScore10(anime.rating);
  const nativeTitle = typeof anime.title === "object" ? (anime.title as { native?: string }).native : undefined;
  const airing = anime.status === "Ongoing" || anime.status === "RELEASING";

  return (
    <div className="iz-page iz-page--flush">
      <Navbar transparent />
      {showTrailer && hasYouTubeTrailer && <TrailerModal trailerId={trailer!.id} onClose={() => setShowTrailer(false)} />}

      {/* ── Backdrop ── */}
      <section className="iz-hero" style={{ height: "clamp(380px, 58svh, 560px)" }}>
        <HeroBackdrop banner={cover || undefined} poster={image || undefined} />
        <div className="iz-hero__grid" />
      </section>

      <main className="iz-container" style={{ position: "relative", zIndex: 2, marginTop: "clamp(-260px, -22svh, -150px)" }}>
        <div className="iz-detail">
          <div className="iz-detail__poster">
            <div className="iz-poster__frame" style={{ borderRadius: 16 }}>
              <img src={image} alt={title} />
            </div>
          </div>

          <div className="iz-detail__info">
            <div className="iz-hero__eyebrow" style={{ marginBottom: 12 }}>
              {airing && <span className="iz-tag iz-tag--accent"><span className="iz-dot" /> En emisión</span>}
              {anime.type && <span className="iz-tag">{anime.type}</span>}
              {anime.studios?.[0] && <span className="iz-tag">{anime.studios[0]}</span>}
              <span className="iz-tag">SUB ESP</span>
            </div>
            <h1 className="iz-detail__title">{title}</h1>
            {nativeTitle && <div className="iz-serif" style={{ color: "var(--iz-muted)", fontSize: 18, marginTop: 6 }}>{nativeTitle}</div>}

            <div className="iz-hero__meta" style={{ marginTop: 14 }}>
              {score && <span className="iz-score" style={{ fontSize: 15 }}><Star size={14} fill="currentColor" /> {score.toFixed(1)}</span>}
              {anime.releaseDate && <span>{anime.releaseDate}</span>}
              {anime.totalEpisodes ? <span>{episodes.length > 0 && episodes.length < anime.totalEpisodes ? `${episodes.length} de ${anime.totalEpisodes}` : anime.totalEpisodes} episodios</span> : episodes.length > 0 ? <span>{episodes.length} episodios</span> : null}
              {anime.duration && <span>{anime.duration}</span>}
            </div>

            <div className="iz-hero__cta" style={{ marginTop: 22 }}>
              {(animeProgress || episodes.length > 0) && (
                <button type="button" className="iz-btn iz-btn--primary iz-btn--lg" onClick={playMain}>
                  <Play size={18} fill="#000" />
                  {animeProgress ? `Continuar · Ep. ${animeProgress.episodeNum}` : "Ver episodio 1"}
                </button>
              )}
              <WatchStatusButton animeForList={animeForFav} />
              <button type="button" className={`iz-btn iz-btn--lg iz-btn--icon ${fav ? "iz-btn--accent" : "iz-btn--ghost"}`} style={{ width: 50 }} onClick={() => toggleFavorite(animeForFav)} title={fav ? "Quitar de favoritos" : "Añadir a favoritos"} aria-label="Favorito" aria-pressed={fav}>
                <Heart size={18} fill={fav ? "currentColor" : "none"} />
              </button>
              {hasYouTubeTrailer && (
                <button type="button" className="iz-btn iz-btn--ghost iz-btn--lg" onClick={() => setShowTrailer(true)}><Clapperboard size={17} /> Tráiler</button>
              )}
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--lg iz-btn--icon" style={{ width: 50 }} onClick={share} title="Compartir" aria-label="Compartir"><Share2 size={17} /></button>
            </div>
            {shareToast && <div className="iz-tag iz-tag--accent" style={{ marginTop: 12 }}>✓ {shareToast}</div>}

            {genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
                {genres.slice(0, 8).map((g) => (
                  <button key={g} type="button" className="iz-chip" style={{ height: 30, fontSize: 12 }} onClick={() => navigate(`/search?genre=${encodeURIComponent(g)}`)}>{g}</button>
                ))}
              </div>
            )}

            {rawDesc && (
              <div style={{ marginTop: 22, maxWidth: 820 }}>
                <p style={{ margin: 0, color: "var(--iz-text-2)", fontSize: 15, lineHeight: 1.7 }} className={descExpanded ? "" : "line-clamp-4"}>{rawDesc}</p>
                {rawDesc.length > 280 && (
                  <button type="button" className="iz-head__link" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setDescExpanded((v) => !v)}>
                    {descExpanded ? <>Mostrar menos <ChevronUp size={14} /></> : <>Leer más <ChevronDown size={14} /></>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Episodios ── */}
        <section className="iz-section" id="episodios">
          <div className="iz-head">
            <div>
              <div className="iz-head__eyebrow"><span className="iz-dot" />{episodes.length} disponibles</div>
              <h2 className="iz-head__title">Episodios</h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {episodes.length > 12 && (
                <div style={{ position: "relative" }}>
                  <SearchIcon size={15} color="#71717a" style={{ position: "absolute", left: 11, top: 11 }} />
                  <input className="iz-input" value={epSearch} onChange={(e) => setEpSearch(e.target.value)} placeholder="Nº o título" inputMode="search" style={{ width: 170, height: 38, paddingLeft: 34 }} aria-label="Buscar episodio" />
                  {epSearch && <button type="button" onClick={() => setEpSearch("")} aria-label="Limpiar" style={{ position: "absolute", right: 8, top: 9, background: "none", border: 0, color: "#a1a1aa", cursor: "pointer" }}><X size={16} /></button>}
                </div>
              )}
              {watchedNums.size > 0 && (
                <>
                  <button type="button" className={`iz-chip ${epFilter === "all" ? "is-active" : ""}`} onClick={() => setEpFilter("all")}>Todos</button>
                  <button type="button" className={`iz-chip ${epFilter === "unwatched" ? "is-active" : ""}`} onClick={() => setEpFilter("unwatched")}>Sin ver</button>
                </>
              )}
            </div>
          </div>

          {ranges.length > 0 && !normalizedEpSearch && (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none" }}>
              {ranges.map((r, i) => (
                <button key={r.label} type="button" className={`iz-chip ${i === epRange ? "is-active" : ""}`} style={{ height: 30, fontSize: 12, fontFamily: "var(--iz-mono)" }} onClick={() => setEpRange(i)}>{r.label}</button>
              ))}
            </div>
          )}

          {paheQuery.isLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--iz-dim)", fontSize: 13, marginBottom: 12 }}>
              <span className="iz-spin" /> Buscando fuentes de video…
            </div>
          )}

          {episodes.length === 0 ? (
            <EmptyState title={paheQuery.isLoading ? "Cargando episodios…" : "Sin episodios disponibles"} text={paheQuery.isLoading ? undefined : "Este anime aún no tiene episodios en nuestras fuentes. Vuelve pronto."} />
          ) : visibleEps.length === 0 ? (
            <EmptyState title="Ningún episodio coincide" />
          ) : (
            <div className="iz-eps">
              {visibleEps.map((ep) => {
                const watched = watchedNums.has(ep.number);
                const ratio = progressByNum.get(ep.number) ?? 0;
                const current = animeProgress?.episodeNum === ep.number && !watched;
                const paheEp = (paheQuery.data?.episodes ?? []).find((e) => e.number === ep.number);
                const resolvedId = paheEp?.id ?? ep.id;
                return (
                  <button key={ep.id} type="button" className={`iz-ep ${current ? "is-current" : ""} ${watched ? "is-watched" : ""}`}
                    onClick={() => handleEpisode(ep)} onMouseEnter={() => prefetchStream(resolvedId, ep.number)} onTouchStart={() => prefetchStream(resolvedId, ep.number)}>
                    <span className="iz-ep__num">{ep.number}</span>
                    <span className="iz-ep__body">
                      <span className="iz-ep__title">{ep.title && !/^episod(e|io)\s*\d+$/i.test(ep.title.trim()) ? ep.title : `Episodio ${ep.number}`}</span>
                      <span className="iz-ep__meta">
                        {current ? <><span className="iz-dot" /> Continuar</> : watched ? <><CheckCircle2 size={12} /> Visto</> : ep.airDate ? <><Calendar size={11} /> {ep.airDate}</> : "Sub español"}
                        {ep.isFiller && <span className="iz-tag" style={{ padding: "1px 5px", fontSize: 9 }}>RELLENO</span>}
                      </span>
                    </span>
                    <span className="iz-ep__play"><Play size={13} fill="currentColor" /></span>
                    {ratio > 0 && ratio < 0.85 && <span className="iz-ep__bar"><i style={{ width: `${Math.round(ratio * 100)}%` }} /></span>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {characters.length > 0 && (
          <section className="iz-section">
            <SectionHead eyebrow="Reparto" title="Personajes" />
            <Rail label="Personajes">
              {characters.slice(0, 20).map((c) => (
                <div key={c.id} style={{ width: 112 }}>
                  <div className="iz-poster__frame" style={{ borderColor: c.role === "MAIN" ? "rgba(99,102,241,.45)" : undefined }}>
                    <img src={c.image} alt={c.name} loading="lazy" />
                  </div>
                  <div className="iz-poster__title" style={{ fontSize: 12 }}>{c.name}</div>
                  <div className="iz-poster__meta">{c.role === "MAIN" ? "Principal" : "Secundario"}</div>
                </div>
              ))}
            </Rail>
          </section>
        )}

        {recommendations.length > 0 && (
          <section className="iz-section">
            <SectionHead eyebrow="Si te gustó este" title="Animes" serif="similares" />
            <Rail label="Similares">
              {recommendations.map((r) => (
                <PosterCard key={r.id} data={{ id: r.id, title: resolveTitle(r.title), image: r.image, score: toScore10(r.rating), meta: r.type }} />
              ))}
            </Rail>
          </section>
        )}

        <section className="iz-section" style={{ display: "grid", gap: 16 }}>
          {id && <UserRatingWidget animeId={id} />}
          <AdBanner variant="horizontal" />
        </section>
        <section className="iz-section"><CommentsSection animeId={id!} /></section>
      </main>
      <Footer />
    </div>
  );
}
