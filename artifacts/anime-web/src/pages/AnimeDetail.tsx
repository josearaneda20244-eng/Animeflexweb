import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Heart, HeartOff, Star, Play, ChevronDown, ChevronUp,
  Tv, Calendar, Film, List, Share2, BookOpen, CheckCircle2, Clock3,
  X, Users, Clapperboard, Sparkles, ChevronRight
} from "lucide-react";
import { consumet, resolveTitle, type Episode, type AnimeResult } from "@/lib/consumet";
import { useFavorites } from "@/context/FavoritesContext";
import { useHistory } from "@/context/HistoryContext";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useWatchList, type WatchStatus } from "@/context/WatchListContext";
import CommentsSection from "@/components/CommentsSection";
import { onAnimeClick, onEpisodeClick } from "@/lib/adsManager";

const STATUS_OPTIONS: { value: WatchStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "watching", label: "Viendo", icon: <Play size={13} fill="currentColor" />, color: "#6C63FF" },
  { value: "completed", label: "Completado", icon: <CheckCircle2 size={13} />, color: "#22C55E" },
  { value: "plan_to_watch", label: "Pendiente", icon: <Clock3 size={13} />, color: "#F59E0B" },
];

function WatchStatusButton({ animeForList }: { animeForList: AnimeResult }) {
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
                setStatus(animeForList, current === opt.value ? null : opt.value);
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
      <div style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "2/3", position: "relative", background: "#13131C" }}>
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
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToHistory } = useHistory();
  const { getAnimeProgress } = useWatchProgress();
  const { addNotification } = useNotifications();
  const [descExpanded, setDescExpanded] = useState(false);
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [epFilter, setEpFilter] = useState<"all" | "unwatched">("all");
  const [shareToast, setShareToast] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => { onAnimeClick(); }, []);

  const infoQuery = useQuery({
    queryKey: ["animeAnilistInfo", id],
    queryFn: () => consumet.anilistInfo(id!),
    enabled: !!id,
    retry: 2,
    staleTime: 1000 * 60 * 10,
  });

  const paheQuery = useQuery({
    queryKey: ["animeEpisodesById", id],
    queryFn: () => consumet.episodesById(id!),
    enabled: !!id,
    retry: 2,
    staleTime: 1000 * 60 * 10,
  });

  const anime = infoQuery.data;
  const fav = isFavorite(id!);
  const animeProgress = getAnimeProgress(id!);

  const title = resolveTitle(anime?.title);
  const image = anime?.image ?? "";
  const cover = anime?.cover ?? "";
  const rawDesc = (anime?.description ?? "").replace(/<[^>]+>/g, "");
  const genres = anime?.genres ?? [];
  const episodes = anime?.episodes ?? [];
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

  const handleEpisode = (ep: Episode) => {
    if (!ep?.id) return;
    setWatchedEps((prev) => new Set([...prev, ep.id]));
    addToHistory(animeForFav, ep.number);
    onEpisodeClick();

    const paheEpisodes = paheQuery.data?.episodes ?? [];
    const paheEp = paheEpisodes.find((e) => e.number === ep.number);
    const resolvedId = paheEp?.id ?? ep.id;

    const nextEp = episodes.find((e) => e.number === ep.number + 1);
    const nextPahe = nextEp ? paheEpisodes.find((e) => e.number === nextEp.number) : undefined;
    const nextResolvedId = nextPahe?.id ?? nextEp?.id;

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

  const filteredEps = epFilter === "unwatched"
    ? episodes.filter((ep) => !watchedEps.has(ep.id))
    : episodes;

  if (infoQuery.isLoading) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center" style={{ background: "#090A12" }}>
        <div className="flex flex-col items-center gap-3 text-[#4A4A6A]">
          <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  if (infoQuery.isError) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center" style={{ background: "#090A12" }}>
        <div className="text-center text-[#4A4A6A]">
          <p className="text-[#F0F0FF] font-medium mb-2">No se pudo cargar el anime</p>
          <button onClick={() => navigate("/")} className="text-sm text-[#6C63FF] hover:underline">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: "#090A12" }}>
      {showTrailer && hasYouTubeTrailer && (
        <TrailerModal trailerId={trailer!.id} onClose={() => setShowTrailer(false)} />
      )}

      {/* Cover */}
      <div className="relative w-full" style={{ height: "min(380px, 55vw)" }}>
        <img
          src={cover || image}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-overlay" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(9,10,18,0.8) 0%, transparent 60%)" }}
        />
        <button
          onClick={() => navigate("/")}
          className="absolute top-16 left-4 md:left-8 p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
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
              {anime?.totalEpisodes && <span className="flex items-center gap-1"><Film size={12} />{anime.totalEpisodes} eps</span>}
              {anime?.studios && anime.studios.length > 0 && (
                <span className="flex items-center gap-1">{anime.studios[0]}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          {animeProgress ? (
            <button
              onClick={() => {
                const ep = episodes.find((e) => e.number === animeProgress.episodeNum);
                if (ep) handleEpisode(ep);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white justify-center transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
            >
              <Play size={16} fill="currentColor" />
              Continuar Ep. {animeProgress.episodeNum}
            </button>
          ) : episodes.length > 0 ? (
            <button
              onClick={() => handleEpisode(episodes[0])}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white justify-center transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
            >
              <Play size={16} fill="currentColor" />
              Reproducir
            </button>
          ) : null}

          {hasYouTubeTrailer && (
            <button
              onClick={() => setShowTrailer(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={{ color: "#F87171", borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)" }}
            >
              <Clapperboard size={15} /> Trailer
            </button>
          )}

          <WatchStatusButton animeForList={animeForFav} />

          <button
            onClick={() => {
              const wasNotFav = !fav;
              toggleFavorite(animeForFav);
              if (wasNotFav) {
                addNotification({
                  title: "Añadido a favoritos",
                  message: `${title} fue añadido a tu lista de favoritos.`,
                  animeId: id,
                  animeImage: image,
                });
              }
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
              fav
                ? "text-pink-400 border-pink-400/40 bg-pink-400/10"
                : "text-[#9090B0] border-[#2A2A42] hover:text-[#F0F0FF] hover:border-[#3A3A5A]"
            }`}
          >
            {fav ? <HeartOff size={16} /> : <Heart size={16} />}
            {fav ? "Quitar" : "Favorito"}
          </button>

          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                setShareToast(true);
                setTimeout(() => setShareToast(false), 2500);
              });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border text-[#9090B0] border-[#2A2A42] hover:text-[#F0F0FF] hover:border-[#3A3A5A] transition-colors"
          >
            <Share2 size={16} /> Compartir
          </button>
        </div>

        {shareToast && (
          <div style={{ position: "fixed", top: 70, right: 16, background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 10, padding: "10px 16px", zIndex: 200 }}>
            ✓ Enlace copiado al portapapeles
          </div>
        )}

        {/* Description */}
        {rawDesc && (
          <div className="mb-6 p-4 rounded-xl" style={{ background: "#13131C" }}>
            <p className={`text-sm text-[#9090B0] leading-relaxed ${!descExpanded ? "line-clamp-3" : ""}`}>
              {rawDesc}
            </p>
            {rawDesc.length > 200 && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="flex items-center gap-1 mt-2 text-xs text-[#6C63FF] hover:underline"
              >
                {descExpanded ? <><ChevronUp size={12} />Menos</> : <><ChevronDown size={12} />Más</>}
              </button>
            )}
          </div>
        )}

        {/* Characters */}
        {characters.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="section-accent" />
              <Users size={14} className="text-[#6C63FF]" />
              <h2 className="text-sm font-bold text-[#F0F0FF]">Personajes</h2>
            </div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
              {characters.slice(0, 14).map((char) => (
                <div key={char.id} style={{ flexShrink: 0, textAlign: "center", width: 72 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: "50%", overflow: "hidden",
                    margin: "0 auto 6px", border: "2px solid rgba(108,99,255,0.3)",
                    background: "#13131C",
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
                  <div style={{ color: char.role === "MAIN" ? "#A78BFA" : "rgba(255,255,255,0.3)", fontSize: 8, fontWeight: 600, marginTop: 2 }}>
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
              <List size={14} className="text-[#6C63FF]" />
              <h2 className="text-sm font-bold text-[#F0F0FF]">
                Episodios ({episodes.length})
              </h2>
            </div>
            {watchedEps.size > 0 && (
              <div className="flex rounded-lg overflow-hidden border border-[#1E1E32] text-xs">
                <button
                  onClick={() => setEpFilter("all")}
                  className={`px-3 py-1.5 transition-colors ${epFilter === "all" ? "bg-[#6C63FF] text-white" : "text-[#9090B0] hover:text-[#F0F0FF]"}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setEpFilter("unwatched")}
                  className={`px-3 py-1.5 transition-colors ${epFilter === "unwatched" ? "bg-[#6C63FF] text-white" : "text-[#9090B0] hover:text-[#F0F0FF]"}`}
                >
                  Sin ver
                </button>
              </div>
            )}
          </div>

          {paheQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#4A4A6A] mb-3">
              <div className="w-3 h-3 border border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
              Cargando fuentes...
            </div>
          )}

          {episodes.length === 0 ? (
            <div className="py-10 text-center text-[#4A4A6A]">
              <Film size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin episodios disponibles</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 max-h-[600px] overflow-y-auto pr-1">
              {filteredEps.map((ep) => {
                const watched = watchedEps.has(ep.id);
                return (
                  <button
                    key={ep.id}
                    onClick={() => handleEpisode(ep)}
                    className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors group w-full ${watched ? "opacity-60" : ""}`}
                    style={{ background: "#13131C", border: "1px solid #1E1E32" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6C63FF40")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1E1E32")}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={watched ? { background: "#1A1A27", color: "#4A4A6A" } : { background: "rgba(108,99,255,0.15)", color: "#6C63FF" }}
                    >
                      {ep.number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#F0F0FF] line-clamp-1">
                        {ep.title ?? `Episodio ${ep.number}`}
                      </p>
                      {ep.airDate && (
                        <p className="text-xs text-[#4A4A6A] mt-0.5">{ep.airDate}</p>
                      )}
                    </div>
                    <Play
                      size={14}
                      className="text-[#6C63FF] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    />
                  </button>
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
              <Sparkles size={14} className="text-[#6C63FF]" />
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

        <CommentsSection animeId={id!} />
      </div>
    </div>
  );
}
