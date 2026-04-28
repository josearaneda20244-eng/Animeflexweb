import { useState, useEffect, useCallback, type ReactNode } from "react";
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
          display: "flex", alignItems: "center", gap: 6,
          height: 38, padding: "0 14px",
          borderRadius: 10, border: `1px solid ${currentOpt ? currentOpt.color + "55" : "rgba(255,255,255,0.14)"}`,
          background: currentOpt ? currentOpt.color + "18" : "rgba(255,255,255,0.05)",
          backdropFilter: "blur(10px)",
          color: currentOpt ? currentOpt.color : "#B8B8D1",
          fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
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

/* ── Reusable section header with system aesthetic ─────────────── */
function SectionHeader({
  icon,
  label,
  count,
  module,
  noBottomMargin,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  module?: string;
  noBottomMargin?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: noBottomMargin ? 0 : 14,
      }}
    >
      {/* Vertical accent bar */}
      <div
        style={{
          width: 4,
          height: 22,
          borderRadius: 2,
          background: "linear-gradient(180deg,#FCA5A5,#DC2626 50%,#991B1B)",
          boxShadow: "0 0 12px rgba(220,38,38,0.5)",
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 26,
          height: 26,
          borderRadius: 7,
          background: "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(220,38,38,0.04))",
          border: "1px solid rgba(220,38,38,0.3)",
          color: "#FCA5A5",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05, minWidth: 0 }}>
        <h2
          style={{
            color: "#F0F0FF",
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: -0.2,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          {label}
          {count != null && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.4,
                color: "#FCA5A5",
                background: "rgba(220,38,38,0.14)",
                border: "1px solid rgba(220,38,38,0.3)",
                padding: "1px 7px",
                borderRadius: 999,
                lineHeight: 1.4,
              }}
            >
              {count}
            </span>
          )}
        </h2>
        {module && (
          <span
            style={{
              color: "rgba(252,165,165,0.55)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 1.5,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            ▸ {module}
          </span>
        )}
      </div>
      {/* Horizontal accent line filling the rest */}
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            "linear-gradient(90deg, rgba(220,38,38,0.35) 0%, rgba(220,38,38,0.05) 60%, transparent 100%)",
          marginLeft: 6,
        }}
      />
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

      {/* ── HERO: Cinematic backdrop with parallax-style Ken Burns ─────── */}
      <div className="relative w-full overflow-hidden" style={{ height: "min(560px, 78vw)" }}>
        <motion.img
          src={cover || image}
          alt={title}
          loading="lazy"
          initial={{ scale: 1.18, opacity: 0 }}
          animate={{ scale: 1.04, opacity: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 28%" }}
        />
        {/* Bottom fade to black — taller, smoother */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.55) 65%, #000 100%)" }} />
        {/* Side fade for left-side info readability */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.4) 100%)" }} />
        {/* Crimson glow top-right */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 78% 5%, rgba(220,38,38,0.35) 0%, transparent 55%)" }} />
        {/* Orange accent bottom-left */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 8% 95%, rgba(249,115,22,0.18) 0%, transparent 45%)" }} />
        {/* Subtle grid lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(220,38,38,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.4) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <ScanLines color="rgba(220,38,38,0.05)" />
        <CornerBrackets color="#DC2626" size={26} thickness={2} inset={14} />
        <div className="absolute" style={{ top: 14, right: 16, zIndex: 4 }}>
          <SystemTag color="#DC2626">[ EXPEDIENTE · ANIMEFLEX ]</SystemTag>
        </div>

        <motion.button
          onClick={() => navigate("/")}
          whileHover={{ scale: 1.08, x: -2 }}
          whileTap={{ scale: 0.92 }}
          className="absolute top-16 left-4 md:left-8 p-2.5 rounded-full text-white z-10"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <ArrowLeft size={18} />
        </motion.button>

        {/* ── Floating title block over the hero ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 right-0 px-4 md:px-10"
          style={{ bottom: "26%", zIndex: 5 }}
        >
          <div className="max-w-3xl">
            {anime?.studios && anime.studios.length > 0 && (
              <div
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#FCA5A5",
                  marginBottom: 10,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                ▸ {anime.studios[0]}
              </div>
            )}
            <h1
              className="font-black text-[#F0F0FF] line-clamp-2"
              style={{
                fontSize: "clamp(28px, 5.5vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: -0.5,
                textShadow: "0 4px 24px rgba(0,0,0,0.85), 0 2px 8px rgba(220,38,38,0.35)",
                marginBottom: 12,
              }}
            >
              {title}
            </h1>
            {anime?.title && typeof anime.title === "object" && (anime.title as any).native && (
              <div
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 13,
                  fontWeight: 500,
                  fontStyle: "italic",
                  marginTop: -4,
                }}
              >
                {(anime.title as any).native}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* ── Poster row (just poster + studio strip on the side) ──── */}
        <div className="flex gap-4 md:gap-6 -mt-20 md:-mt-32 mb-4 items-end relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="w-28 md:w-44 flex-shrink-0 rounded-2xl overflow-hidden relative"
            style={{
              boxShadow: "0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(220,38,38,0.25), 0 0 40px rgba(220,38,38,0.15)",
            }}
          >
            <img src={image} alt={title} loading="lazy" className="w-full h-full object-cover block" />
            {/* Glossy reflection */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.2) 100%)" }} />
            {anime?.status === "Ongoing" && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  background: "linear-gradient(135deg,#22C55E,#16A34A)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  padding: "3px 7px",
                  borderRadius: 6,
                  boxShadow: "0 4px 12px rgba(34,197,94,0.45)",
                }}
              >
                ● EN EMISIÓN
              </div>
            )}
          </motion.div>

          {/* Right of poster: rating prominently shown, plus type/eps as a compact pair */}
          <div className="flex-1 min-w-0 pb-1 flex flex-col gap-2">
            {anime?.rating != null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.04))",
                  border: "1px solid rgba(245,158,11,0.35)",
                  backdropFilter: "blur(8px)",
                  alignSelf: "flex-start",
                }}
              >
                <Star size={16} color="#F59E0B" fill="#F59E0B" />
                <span style={{ color: "#F59E0B", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>
                  {(anime.rating / 10).toFixed(1)}
                </span>
                <span style={{ color: "rgba(245,158,11,0.6)", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>/ 10</span>
              </motion.div>
            )}
            {/* Compact type + episodes on one line for mobile */}
            <div className="flex flex-wrap gap-2">
              {anime?.type && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Tv size={11} color="#9090B0" />
                  <span style={{ color: "#F0F0FF", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{anime.type}</span>
                </motion.div>
              )}
              {anime?.totalEpisodes != null && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.48 }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Film size={11} color="#9090B0" />
                  <span style={{ color: "#F0F0FF", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>
                    {episodes.length > 0 && episodes.length < anime.totalEpisodes
                      ? `${episodes.length}/${anime.totalEpisodes}`
                      : anime.totalEpisodes}{" "}eps
                  </span>
                </motion.div>
              )}
              {anime?.releaseDate && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.54 }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Calendar size={11} color="#9090B0" />
                  <span style={{ color: "#F0F0FF", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{anime.releaseDate}</span>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* ── Genre chips: full-width row below poster, no longer cramped ── */}
        {genres.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.04, delayChildren: 0.6 } } }}
            className="flex flex-wrap gap-1.5 md:gap-2 mb-5"
          >
            {genres.slice(0, 8).map((g) => (
              <motion.span
                key={g}
                variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ y: -2, scale: 1.04 }}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  padding: "5px 11px",
                  borderRadius: 999,
                  color: "#FECACA",
                  background: "linear-gradient(135deg, rgba(220,38,38,0.22), rgba(153,27,27,0.1))",
                  border: "1px solid rgba(220,38,38,0.35)",
                  backdropFilter: "blur(8px)",
                  textTransform: "uppercase",
                  cursor: "default",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                {g}
              </motion.span>
            ))}
          </motion.div>
        )}

        {/* ── Action buttons: primary full-width on mobile, secondary aligned ── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } }}
          className="mb-6"
        >
          {/* Primary CTA — single line, full width on mobile, auto on desktop */}
          {(animeProgress || episodes.length > 0) && (
            <motion.button
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (animeProgress) {
                  const ep = episodes.find((e) => e.number === animeProgress.episodeNum);
                  if (ep) handleEpisode(ep);
                } else {
                  handleEpisode(episodes[0]);
                }
              }}
              className="relative overflow-hidden w-full md:w-auto flex items-center justify-center gap-2.5 text-white mb-2.5"
              style={{
                height: 48,
                padding: "0 22px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: 0.4,
                background: "linear-gradient(135deg,#FCA5A5 0%,#DC2626 45%,#991B1B 100%)",
                boxShadow: "0 10px 28px rgba(220,38,38,0.45), 0 2px 6px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
            >
              {/* Animated shine sweep */}
              <motion.div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
                  pointerEvents: "none",
                }}
                initial={{ x: "-120%" }}
                animate={{ x: "220%" }}
                transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  position: "relative",
                  zIndex: 1,
                  flexShrink: 0,
                }}
              >
                <Play size={12} fill="currentColor" style={{ marginLeft: 1 }} />
              </div>
              <span style={{ position: "relative", zIndex: 1, whiteSpace: "nowrap" }}>
                {animeProgress
                  ? `Continuar viendo · Ep. ${animeProgress.episodeNum}`
                  : "Reproducir Episodio 1"}
              </span>
            </motion.button>
          )}

          {/* Secondary actions — uniform height, neat horizontal row */}
          <div className="flex flex-wrap gap-2 items-stretch">
            {hasYouTubeTrailer && (
              <motion.button
                variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
                whileHover={{ scale: 1.04, y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowTrailer(true)}
                className="flex items-center justify-center gap-1.5 text-xs font-bold border"
                style={{
                  height: 38,
                  padding: "0 14px",
                  borderRadius: 10,
                  color: "#FECACA",
                  borderColor: "rgba(220,38,38,0.4)",
                  background: "rgba(220,38,38,0.1)",
                  backdropFilter: "blur(10px)",
                  whiteSpace: "nowrap",
                }}
              >
                <Clapperboard size={13} /> Trailer
              </motion.button>
            )}

            <div style={{ display: "inline-flex", alignItems: "stretch" }}>
              <WatchStatusButton
                animeForList={animeForFav}
                onStatusChange={() => {}}
              />
            </div>

            <motion.button
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => toggleFavorite(animeForFav)}
              className="flex items-center justify-center gap-1.5 text-xs font-bold border"
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 10,
                whiteSpace: "nowrap",
                ...(fav
                  ? { color: "#FECACA", borderColor: "rgba(220,38,38,0.5)", background: "rgba(220,38,38,0.14)", backdropFilter: "blur(10px)" }
                  : { color: "#B8B8D1", borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)" }),
              }}
            >
              <motion.span animate={fav ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.4 }} style={{ display: "inline-flex" }}>
                {fav ? <HeartOff size={13} /> : <Heart size={13} fill={fav ? "currentColor" : "none"} />}
              </motion.span>
              {fav ? "Quitar" : "Favorito"}
            </motion.button>

            <motion.button
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ scale: 1.04, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).then(() => {
                  setShareToast(true);
                  setTimeout(() => setShareToast(false), 2500);
                });
              }}
              className="flex items-center justify-center gap-1.5 text-xs font-bold border"
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: 10,
                color: "#B8B8D1",
                borderColor: "rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(10px)",
                whiteSpace: "nowrap",
              }}
            >
              <Share2 size={13} /> Compartir
            </motion.button>
          </div>
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

        {/* ── Description with quote-style design ─────────────────────── */}
        {rawDesc && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mb-6 relative overflow-hidden"
            style={{
              padding: "20px 22px 18px",
              borderRadius: 16,
              background:
                "linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(16,14,34,0.95) 30%, rgba(13,12,28,0.95) 100%)",
              border: "1px solid rgba(220,38,38,0.15)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.3)",
            }}
          >
            {/* Big opening quote mark */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -8,
                left: 8,
                fontSize: 80,
                lineHeight: 1,
                color: "rgba(220,38,38,0.2)",
                fontFamily: "Georgia, serif",
                fontWeight: 800,
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              "
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
                position: "relative",
              }}
            >
              <div className="section-accent" />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#FCA5A5",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                Sinopsis
              </span>
            </div>
            <p
              className={`text-sm text-[#C5C5DD] leading-relaxed ${!descExpanded ? "line-clamp-4" : ""}`}
              style={{ position: "relative", fontWeight: 400 }}
            >
              {rawDesc}
            </p>
            {rawDesc.length > 200 && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="flex items-center gap-1 mt-3 text-xs font-bold transition-colors"
                style={{
                  color: "#FCA5A5",
                  padding: "5px 11px",
                  borderRadius: 8,
                  background: "rgba(220,38,38,0.1)",
                  border: "1px solid rgba(220,38,38,0.3)",
                }}
              >
                {descExpanded ? <><ChevronUp size={12} />Mostrar menos</> : <><ChevronDown size={12} />Leer más</>}
              </button>
            )}
          </motion.div>
        )}

        {/* User Rating */}
        {id && <UserRatingWidget animeId={id} />}

        {/* ── Characters: tall portrait cards with overlay name ─────── */}
        {characters.length > 0 && (
          <div className="mb-7">
            <SectionHeader icon={<Users size={13} />} label="Personajes" count={characters.length} module="MOD-03" />
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none", marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }}>
              {characters.slice(0, 16).map((char, idx) => (
                <motion.div
                  key={char.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(idx * 0.04, 0.4) }}
                  whileHover={{ y: -4 }}
                  style={{
                    flexShrink: 0,
                    width: 96,
                    cursor: "default",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: 96,
                      height: 132,
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "linear-gradient(135deg,#1a1530,#0d0c1c)",
                      border: char.role === "MAIN"
                        ? "1.5px solid rgba(220,38,38,0.45)"
                        : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: char.role === "MAIN"
                        ? "0 8px 22px rgba(220,38,38,0.25), inset 0 1px 0 rgba(255,255,255,0.05)"
                        : "0 4px 14px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <img
                      src={char.image}
                      alt={char.name}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    {/* Bottom dark gradient for text legibility */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.85) 100%)",
                        pointerEvents: "none",
                      }}
                    />
                    {char.role === "MAIN" && (
                      <div
                        style={{
                          position: "absolute",
                          top: 6,
                          left: 6,
                          fontSize: 8,
                          fontWeight: 800,
                          letterSpacing: 0.6,
                          color: "#fff",
                          padding: "2px 6px",
                          borderRadius: 5,
                          background: "linear-gradient(135deg,#DC2626,#991B1B)",
                          boxShadow: "0 3px 8px rgba(220,38,38,0.5)",
                          textTransform: "uppercase",
                        }}
                      >
                        Principal
                      </div>
                    )}
                    {/* Name overlay at bottom */}
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        padding: "8px 8px 7px",
                      }}
                    >
                      <div
                        style={{
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 800,
                          lineHeight: 1.2,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          textShadow: "0 2px 6px rgba(0,0,0,0.8)",
                        } as any}
                      >
                        {char.name}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ── Episodes section ──────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <SectionHeader icon={<List size={13} />} label="Episodios" count={episodes.length} module="MOD-04" noBottomMargin />
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
                    className={`relative flex items-center gap-3 text-left group w-full overflow-hidden ${watched ? "opacity-65" : ""}`}
                    style={{
                      padding: "11px 12px 11px 14px",
                      borderRadius: 12,
                      background: inProgress
                        ? "linear-gradient(135deg, rgba(220,38,38,0.16) 0%, rgba(17,13,32,0.95) 55%, rgba(13,12,28,0.95) 100%)"
                        : "linear-gradient(135deg, rgba(20,16,40,0.7) 0%, rgba(12,11,26,0.9) 100%)",
                      border: inProgress
                        ? "1px solid rgba(220,38,38,0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: inProgress
                        ? "0 0 0 1px rgba(220,38,38,0.15), 0 10px 28px rgba(220,38,38,0.18), inset 0 1px 0 rgba(255,255,255,0.04)"
                        : "0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
                      transition: "border-color .2s, box-shadow .2s, background .2s, transform .2s",
                    }}
                  >
                    {/* Left accent stripe */}
                    <span
                      aria-hidden
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 6,
                        bottom: 6,
                        width: 3,
                        borderRadius: "0 3px 3px 0",
                        background: watched
                          ? "rgba(34,197,94,0.6)"
                          : inProgress
                            ? "linear-gradient(180deg,#FCA5A5,#DC2626)"
                            : "transparent",
                        opacity: watched || inProgress ? 1 : 0,
                        transition: "opacity .2s",
                      }}
                    />
                    {/* Episode number badge */}
                    <div
                      style={{
                        position: "relative",
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        ...(watched
                          ? { background: "#171627", color: "#5A5A7A", border: "1px solid rgba(34,197,94,0.2)" }
                          : inProgress
                            ? {
                                background: "linear-gradient(135deg,#DC2626,#991B1B)",
                                color: "#fff",
                                boxShadow: "0 8px 22px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.3)",
                              }
                            : {
                                background: "linear-gradient(135deg, rgba(220,38,38,0.22), rgba(153,27,27,0.06))",
                                color: "#FCA5A5",
                                boxShadow: "inset 0 0 0 1px rgba(220,38,38,0.28)",
                              }),
                      }}
                    >
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 800,
                          letterSpacing: 1,
                          opacity: 0.65,
                          marginBottom: -2,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                      >
                        EP
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>
                        {ep.number}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        style={{
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: "#F0F0FF",
                          lineHeight: 1.25,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                        } as any}
                      >
                        {ep.title ?? `Episodio ${ep.number}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {ep.airDate && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 10,
                              color: "#7A7A95",
                              fontWeight: 600,
                            }}
                          >
                            <Calendar size={9} /> {ep.airDate}
                          </span>
                        )}
                        {inProgress && (
                          <span
                            style={{
                              fontSize: 9,
                              color: "#FCA5A5",
                              fontWeight: 800,
                              letterSpacing: 0.7,
                              textTransform: "uppercase",
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "rgba(220,38,38,0.18)",
                              border: "1px solid rgba(220,38,38,0.35)",
                            }}
                          >
                            ▶ En curso
                          </span>
                        )}
                        {watched && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              fontSize: 9,
                              color: "#22C55E",
                              fontWeight: 800,
                              letterSpacing: 0.5,
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "rgba(34,197,94,0.1)",
                              border: "1px solid rgba(34,197,94,0.25)",
                              textTransform: "uppercase",
                            }}
                          >
                            <CheckCircle2 size={9} /> Visto
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Play CTA — always visible on mobile, animates on desktop hover */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        background: inProgress
                          ? "linear-gradient(135deg,#fff,#FECACA)"
                          : "linear-gradient(135deg,#FCA5A5,#DC2626 60%,#991B1B)",
                        boxShadow: inProgress
                          ? "0 6px 18px rgba(255,255,255,0.25)"
                          : "0 6px 18px rgba(220,38,38,0.45)",
                        transition: "transform .2s",
                      }}
                    >
                      <Play size={13} fill={inProgress ? "#991B1B" : "#fff"} color={inProgress ? "#991B1B" : "#fff"} style={{ marginLeft: 1 }} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recommendations ───────────────────────────────────────── */}
        {recommendations.length > 0 && (
          <div className="mb-6">
            <SectionHeader icon={<Sparkles size={13} />} label="Animes similares" count={recommendations.length} module="MOD-05" />
            <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none", marginLeft: -2, marginRight: -2, paddingLeft: 2, paddingRight: 2 }}>
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
