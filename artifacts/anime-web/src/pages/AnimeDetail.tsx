import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Heart, HeartOff, Star, Play, ChevronDown, ChevronUp,
  Tv, Calendar, Film, List, Share2, BookOpen, CheckCircle2, Clock3,
  X, Users, Clapperboard, Sparkles, ChevronRight, XCircle,
} from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { consumet, resolveTitle, type Episode, type AnimeResult } from "@/lib/consumet";
import { useFavorites } from "@/context/FavoritesContext";
import { useHistory } from "@/context/HistoryContext";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useWatchList, type WatchStatus } from "@/context/WatchListContext";
import CommentsSection from "@/components/CommentsSection";
import { CornerBrackets, SystemTag, ScanLines } from "@/components/SystemUI";
import { useAuth } from "@/context/AuthContext";
import AdBanner from "@/components/AdBanner";

const STATUS_OPTIONS: { value: WatchStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "watching", label: "Viendo", icon: <Play size={13} fill="currentColor" />, color: "#DC2626" },
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
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "9px 14px",
          borderRadius: 12, border: `1px solid ${currentOpt ? currentOpt.color + "55" : "rgba(255,255,255,0.15)"}`,
          background: currentOpt ? currentOpt.color + "18" : "rgba(255,255,255,0.05)",
          color: currentOpt ? currentOpt.color : "rgba(255,255,255,0.6)",
          fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        {currentOpt ? currentOpt.icon : <BookOpen size={13} />}
        {currentOpt ? currentOpt.label : "Mi Lista"}
        <ChevronDown size={11} style={{ marginLeft: 2, opacity: 0.6 }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 300,
            background: "#1A1A28", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
            padding: 6, minWidth: 170, boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
          }}
        >
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
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="section-accent" />
        <Star size={14} className="text-[#DC2626]" />
        <h2 className="text-sm font-bold text-[#F0F0FF]">Tu valoración</h2>
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
              size={30}
              color="#F59E0B"
              fill={display >= n ? "#F59E0B" : "transparent"}
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

function RecommendationCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div
      onClick={() => navigate(`/anime/${anime.id}`)}
      style={{
        flexShrink: 0, width: 120, cursor: "pointer",
        transition: "transform 0.18s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = ""; }}
    >
      <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "2/3", position: "relative", background: "#100e22" }}>
        <img
          src={anime.image}
          alt={title}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {anime.rating != null && anime.rating > 0 && (
          <div style={{
            position: "absolute", top: 6, right: 6, display: "flex", alignItems: "center", gap: 2,
            background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "2px 5px",
          }}>
            <Star size={8} color="#F59E0B" fill="#F59E0B" />
            <span style={{ color: "#F59E0B", fontSize: 9, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 7 }}>
        <div style={{ color: "#F1F1F5", fontSize: 11, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
          {title}
        </div>
        {anime.type && (
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600, marginTop: 2 }}>{anime.type}</div>
        )}
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
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [epFilter, setEpFilter] = useState<"all" | "unwatched">("all");
  const [epSearch, setEpSearch] = useState("");
  const [shareToast, setShareToast] = useState(false);
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

  /* ── T006: Dynamic SEO — must be before conditional returns ── */
  useEffect(() => {
    if (!anime) return;
    const t = resolveTitle(anime.title);
    const desc = (anime.description ?? "").replace(/<[^>]+>/g, "").slice(0, 160);
    const img = anime.cover ?? anime.image ?? "";
    document.title = `${t} – AnimeFlex`;
    const setMeta = (prop: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${prop}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute("property", prop); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("og:title", t);
    setMeta("og:description", desc);
    if (img) setMeta("og:image", img);
    setMeta("og:type", "video.tv_show");
    return () => { document.title = "AnimeFlex"; };
  }, [anime]);

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
      queryClient.prefetchQuery({
        queryKey: ["animeflv", title, String(epNum), id],
        queryFn: () =>
          consumet.animeflvWatch(title, epNum, id || undefined),
        staleTime: 1000 * 60 * 15,
      });
    },
    [queryClient, title, id],
  );

  const handleEpisode = (ep: Episode) => {
    if (!ep?.id) return;
    setWatchedEps((prev) => new Set([...prev, ep.id]));
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

  const normalizedEpSearch = epSearch.trim().toLowerCase();
  const filteredEps = episodes.filter((ep) => {
    if (epFilter === "unwatched" && watchedEps.has(ep.id)) return false;
    if (!normalizedEpSearch) return true;
    return String(ep.number).includes(normalizedEpSearch) || (ep.title ?? "").toLowerCase().includes(normalizedEpSearch);
  });

  if (infoQuery.isLoading) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center" style={{ background: "#000" }}>
        <div className="flex flex-col items-center gap-3 text-[#4A4A6A]">
          <div className="w-8 h-8 border-2 border-[#DC2626] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (infoQuery.isError) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center" style={{ background: "#000" }}>
        <div className="text-center text-[#4A4A6A]">
          <p className="text-[#F0F0FF] font-medium mb-2">No se pudo cargar el anime</p>
          <button onClick={() => navigate("/")} className="text-sm text-[#DC2626] hover:underline">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "#000" }}>
      {showTrailer && hasYouTubeTrailer && (
        <TrailerModal trailerId={trailer!.id} onClose={() => setShowTrailer(false)} />
      )}

      {/* Cover with Ken Burns + cinematic gradient */}
      <div className="relative w-full overflow-hidden" style={{ height: "min(420px, 60vw)" }}>
        <motion.img
          src={cover || image}
          alt={title}
          loading="lazy"
          initial={{ scale: 1.12, opacity: 0 }}
          animate={{ scale: 1.02, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 30%" }}
        />
        {/* Bottom fade to black */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 55%, #000 100%)" }} />
        {/* Side fade */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, transparent 50%, rgba(0,0,0,0.4) 100%)" }} />
        {/* Crimson vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(220,38,38,0.22) 0%, transparent 60%)" }} />
        {/* SL system frame */}
        <ScanLines color="rgba(220,38,38,0.045)" />
        <CornerBrackets color="#DC2626" size={20} thickness={2} inset={12} />
        <div className="absolute" style={{ top: 14, right: 16, zIndex: 4 }}>
          <SystemTag color="#DC2626">[ EXPEDIENTE · ANIMEFLEX ]</SystemTag>
        </div>

        <motion.button
          onClick={() => navigate("/")}
          whileHover={{ scale: 1.08, x: -2 }}
          whileTap={{ scale: 0.92 }}
          className="absolute top-16 left-4 md:left-8 p-2.5 rounded-full text-white"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <ArrowLeft size={18} />
        </motion.button>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* Info row */}
        <div className="flex gap-4 -mt-16 md:-mt-24 mb-6 items-end relative z-10">
          <div className="w-28 md:w-36 flex-shrink-0 rounded-xl overflow-hidden shadow-2xl border border-[#2A2A42]">
            <img src={image} alt={title} loading="lazy" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl md:text-3xl font-bold text-[#F0F0FF] line-clamp-2 mb-2">{title}</h1>
            <div className="flex flex-wrap gap-2 mb-3">
              {genres.slice(0, 5).map((g) => (
                <span key={g} className="genre-badge">{g}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-[#9090B0]">
              {anime?.rating != null && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star size={12} fill="currentColor" />
                  {(anime.rating / 10).toFixed(1)}
                </span>
              )}
              {anime?.type && <span className="flex items-center gap-1"><Tv size={12} />{anime.type}</span>}
              {anime?.status && <span>{anime.status}</span>}
              {anime?.releaseDate && <span className="flex items-center gap-1"><Calendar size={12} />{anime.releaseDate}</span>}
              {anime?.totalEpisodes != null && (
                <span className="flex items-center gap-1">
                  <Film size={12} />
                  {episodes.length > 0 && episodes.length < anime.totalEpisodes
                    ? `${episodes.length}/${anime.totalEpisodes} eps`
                    : `${anime.totalEpisodes} eps`}
                </span>
              )}
              {anime?.studios && anime.studios.length > 0 && (
                <span className="flex items-center gap-1">{anime.studios[0]}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
          className="flex flex-wrap gap-2.5 mb-6"
        >
          {animeProgress ? (
            <motion.button
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                const ep = episodes.find((e) => e.number === animeProgress.episodeNum);
                if (ep) handleEpisode(ep);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white justify-center"
              style={{ background: "linear-gradient(135deg,#FCA5A5 0%,#DC2626 50%,#991B1B 100%)", boxShadow: "0 8px 24px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.25)" }}
            >
              <Play size={15} fill="currentColor" />
              Continuar Ep. {animeProgress.episodeNum}
            </motion.button>
          ) : episodes.length > 0 ? (
            <motion.button
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => handleEpisode(episodes[0])}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white justify-center"
              style={{ background: "linear-gradient(135deg,#FCA5A5 0%,#DC2626 50%,#991B1B 100%)", boxShadow: "0 8px 24px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.25)" }}
            >
              <Play size={15} fill="currentColor" />
              Reproducir
            </motion.button>
          ) : null}

          {hasYouTubeTrailer && (
            <motion.button
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowTrailer(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border"
              style={{ color: "#FECACA", borderColor: "rgba(220,38,38,0.35)", background: "rgba(220,38,38,0.08)", backdropFilter: "blur(10px)" }}
            >
              <Clapperboard size={15} /> Trailer
            </motion.button>
          )}

          <WatchStatusButton
            animeForList={animeForFav}
            onStatusChange={(status) => {
              if (status) {
                const labels: Record<string, string> = { watching: "Viendo", completed: "Completado", plan_to_watch: "Pendiente", dropped: "Abandonado" };
                // addNotification({
                //   title: "Lista actualizada",
                //   message: `${title} marcado como "${labels[status] ?? status}".`,
                //   animeId: id ?? "",
                //   animeImage: image,
                // });
              }
            }}
          />

          <motion.button
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              const wasNotFav = !fav;
              toggleFavorite(animeForFav);
              if (wasNotFav) { /* notification omitted */ }
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border"
            style={fav
              ? { color: "#FECACA", borderColor: "rgba(220,38,38,0.5)", background: "rgba(220,38,38,0.12)", backdropFilter: "blur(10px)" }
              : { color: "#B8B8D1", borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(10px)" }
            }
          >
            <motion.span animate={fav ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.4 }} style={{ display: "inline-flex" }}>
              {fav ? <HeartOff size={15} /> : <Heart size={15} fill={fav ? "currentColor" : "none"} />}
            </motion.span>
            {fav ? "Quitar" : "Favorito"}
          </motion.button>

          <motion.button
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                setShareToast(true);
                setTimeout(() => setShareToast(false), 2500);
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border"
            style={{ color: "#B8B8D1", borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", backdropFilter: "blur(10px)" }}
          >
            <Share2 size={15} /> Compartir
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {shareToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 360, damping: 24 }}
              style={{ position: "fixed", top: 70, right: 16, background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 12, padding: "10px 16px", zIndex: 200, boxShadow: "0 12px 32px rgba(34,197,94,0.45)" }}
            >
              ✓ Enlace copiado al portapapeles
            </motion.div>
          )}
        </AnimatePresence>

        {/* Description */}
        {rawDesc && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: "#100e22" }}>
            <p className={`text-sm text-[#9090B0] leading-relaxed ${!descExpanded ? "line-clamp-3" : ""}`}>
              {rawDesc}
            </p>
            {rawDesc.length > 200 && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="flex items-center gap-1 mt-2 text-xs text-[#DC2626] hover:underline"
              >
                {descExpanded ? <><ChevronUp size={12} />Menos</> : <><ChevronDown size={12} />Más</>}
              </button>
            )}
          </div>
        )}

        {/* User Rating */}
        {id && <UserRatingWidget animeId={id} />}

        {/* Characters */}
        {characters.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="section-accent" />
              <Users size={14} className="text-[#DC2626]" />
              <h2 className="text-sm font-bold text-[#F0F0FF]">Personajes</h2>
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
              {characters.slice(0, 14).map((char) => (
                <div key={char.id} style={{ flexShrink: 0, textAlign: "center", width: 72 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%", overflow: "hidden",
                    margin: "0 auto 6px", border: "2px solid rgba(220,38,38,0.3)",
                    background: "#100e22",
                  }}>
                    <img
                      src={char.image}
                      alt={char.name}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <div style={{ color: "#F1F1F5", fontSize: 9, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>
                    {char.name}
                  </div>
                  <div style={{ color: char.role === "MAIN" ? "#FECACA" : "rgba(255,255,255,0.3)", fontSize: 8, fontWeight: 600, marginTop: 2 }}>
                    {char.role === "MAIN" ? "Principal" : "Secundario"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Episodes */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="section-accent" />
              <List size={14} className="text-[#DC2626]" />
              <h2 className="text-sm font-bold text-[#F0F0FF]">
                Episodios ({episodes.length})
              </h2>
            </div>
            {watchedEps.size > 0 && (
              <div className="flex rounded-lg overflow-hidden border border-[#1E1E32] text-xs">
                <button
                  onClick={() => setEpFilter("all")}
                  className={`px-3 py-1.5 transition-colors ${epFilter === "all" ? "bg-[#DC2626] text-white" : "text-[#9090B0] hover:text-[#F0F0FF]"}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setEpFilter("unwatched")}
                  className={`px-3 py-1.5 transition-colors ${epFilter === "unwatched" ? "bg-[#DC2626] text-white" : "text-[#9090B0] hover:text-[#F0F0FF]"}`}
                >
                  Sin ver
                </button>
              </div>
            )}
          </div>

          {episodes.length > 24 && (
            <div className="mb-3 flex gap-2">
              <input
                value={epSearch}
                onChange={(e) => setEpSearch(e.target.value)}
                placeholder="Buscar episodio o número"
                inputMode="numeric"
                className="flex-1 min-w-0 rounded-xl border border-[#1E1E32] bg-[#100e22] px-3 py-2.5 text-sm text-[#F0F0FF] outline-none placeholder:text-[#4A4A6A] focus:border-[#DC262680]"
              />
              {epSearch && (
                <button
                  onClick={() => setEpSearch("")}
                  className="rounded-xl border border-[#1E1E32] px-3 text-[#9090B0]"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          )}

          {paheQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#4A4A6A] mb-3">
              <div className="w-3 h-3 border border-[#DC2626] border-t-transparent rounded-full animate-spin" />
              Cargando fuentes...
            </div>
          )}

          {episodes.length === 0 ? (
            <div className="py-10 text-center text-[#4A4A6A]">
              <Film size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin episodios disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 max-h-[640px] overflow-y-auto pr-1 ep-scroll">
              {filteredEps.map((ep, idx) => {
                const watched = watchedEps.has(ep.id);
                const inProgress =
                  !watched && animeProgress?.episodeNum === ep.number;
                /* Resolve real provider id for prefetch (handles synthetic ids) */
                const paheEpisodes = paheQuery.data?.episodes ?? [];
                const paheEp = paheEpisodes.find((e) => e.number === ep.number);
                const resolvedId = paheEp?.id ?? ep.id;
                return (
                  <motion.button
                    key={ep.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.28, delay: Math.min(idx * 0.022, 0.35), ease: [0.16, 1, 0.3, 1] }}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleEpisode(ep)}
                    onMouseEnter={() => prefetchStream(resolvedId, ep.number)}
                    onTouchStart={() => prefetchStream(resolvedId, ep.number)}
                    className={`relative flex items-center gap-3 p-3 rounded-xl text-left group w-full overflow-hidden ${watched ? "opacity-60" : ""}`}
                    style={{
                      background: inProgress
                        ? "linear-gradient(135deg, rgba(220,38,38,0.14) 0%, #110d20 60%, #0d0c1c 100%)"
                        : "linear-gradient(135deg, #110e22 0%, #0c0b1a 100%)",
                      border: inProgress
                        ? "1px solid rgba(220,38,38,0.35)"
                        : "1px solid rgba(255,255,255,0.05)",
                      boxShadow: inProgress
                        ? "0 0 0 1px rgba(220,38,38,0.2), 0 8px 24px rgba(220,38,38,0.12)"
                        : "0 1px 0 rgba(255,255,255,0.02)",
                      transition: "border-color .2s, box-shadow .2s, background .2s",
                    }}
                  >
                    {/* Thin accent stripe on the left */}
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 8,
                        bottom: 8,
                        width: 3,
                        borderRadius: 3,
                        background: watched
                          ? "rgba(34,197,94,0.55)"
                          : inProgress
                            ? "linear-gradient(180deg,#FCA5A5,#DC2626)"
                            : "transparent",
                        opacity: watched || inProgress ? 1 : 0,
                        transition: "opacity .2s",
                      }}
                    />
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black"
                      style={watched
                        ? { background: "#171627", color: "#5A5A7A", border: "1px solid rgba(34,197,94,0.18)" }
                        : inProgress
                          ? {
                              background: "linear-gradient(135deg,#DC2626,#991B1B)",
                              color: "#fff",
                              boxShadow: "0 6px 18px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
                            }
                          : {
                              background: "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(153,27,27,0.08))",
                              color: "#FCA5A5",
                              boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.22)",
                            }
                      }
                    >
                      {ep.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#F0F0FF] line-clamp-1">
                        {ep.title ?? `Episodio ${ep.number}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ep.airDate && (
                          <p className="text-[11px] text-[#5A5A7A]">{ep.airDate}</p>
                        )}
                        {inProgress && (
                          <span
                            style={{
                              fontSize: 9,
                              color: "#FCA5A5",
                              fontWeight: 800,
                              letterSpacing: 0.6,
                              textTransform: "uppercase",
                              padding: "1px 6px",
                              borderRadius: 4,
                              background: "rgba(220,38,38,0.15)",
                              border: "1px solid rgba(220,38,38,0.3)",
                            }}
                          >
                            En curso
                          </span>
                        )}
                      </div>
                    </div>
                    {watched && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 10,
                          color: "#22C55E",
                          fontWeight: 800,
                          letterSpacing: 0.6,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: "rgba(34,197,94,0.08)",
                          border: "1px solid rgba(34,197,94,0.22)",
                        }}
                      >
                        <CheckCircle2 size={10} /> VISTO
                      </span>
                    )}
                    <motion.div
                      initial={{ x: -4, opacity: 0 }}
                      whileHover={{ x: 0, opacity: 1 }}
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "linear-gradient(135deg,#FCA5A5,#DC2626 60%,#991B1B)", boxShadow: "0 6px 16px rgba(220,38,38,0.5)" }}
                    >
                      <Play size={12} fill="#fff" color="#fff" />
                    </motion.div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="section-accent" />
              <Sparkles size={14} className="text-[#DC2626]" />
              <h2 className="text-sm font-bold text-[#F0F0FF]">Animes similares</h2>
              <ChevronRight size={14} className="text-[#4A4A6A]" />
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
              {recommendations.map((rec) => (
                <RecommendationCard key={rec.id} anime={rec} />
              ))}
            </div>
          </div>
        )}

        <AdBanner variant="horizontal" />
        <CommentsSection animeId={id!} />
      </div>
    </div>
  );
}
