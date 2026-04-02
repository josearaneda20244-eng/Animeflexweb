import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Heart, HeartOff, Star, Play, ChevronDown, ChevronUp,
  Tv, Calendar, Film, List, Share2
} from "lucide-react";
import { consumet, resolveTitle, type Episode, type AnimeResult } from "@/lib/consumet";
import { useFavorites } from "@/context/FavoritesContext";
import { useHistory } from "@/context/HistoryContext";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useNotifications } from "@/context/NotificationsContext";
import CommentsSection from "@/components/CommentsSection";

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
      {/* Cover */}
      <div className="relative w-full" style={{ height: "min(380px, 55vw)" }}>
        <img
          src={cover || image}
          alt={title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-overlay" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, rgba(9,10,18,0.8) 0%, transparent 60%)" }}
        />
        {/* Back button */}
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
            <img src={image} alt={title} className="w-full h-full object-cover" />
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
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-6">
          {animeProgress ? (
            <button
              onClick={() => {
                const ep = episodes.find((e) => e.number === animeProgress.episodeNum);
                if (ep) handleEpisode(ep);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex-1 md:flex-none justify-center transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
            >
              <Play size={16} fill="currentColor" />
              Continuar Ep. {animeProgress.episodeNum}
            </button>
          ) : episodes.length > 0 ? (
            <button
              onClick={() => handleEpisode(episodes[0])}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white flex-1 md:flex-none justify-center transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
            >
              <Play size={16} fill="currentColor" />
              Reproducir
            </button>
          ) : null}
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

        {/* Episodes */}
        <div>
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

          {shareToast && (
            <div style={{ position: "fixed", top: 70, right: 16, background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 10, padding: "10px 16px", zIndex: 200 }}>
              ✓ Enlace copiado al portapapeles
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
                    className={`flex items-center gap-3 p-3 rounded-xl text-left transition-colors group w-full ${
                      watched ? "opacity-60" : ""
                    }`}
                    style={{
                      background: "#13131C",
                      border: "1px solid #1E1E32",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6C63FF40")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1E1E32")}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold"
                      style={
                        watched
                          ? { background: "#1A1A27", color: "#4A4A6A" }
                          : { background: "rgba(108,99,255,0.15)", color: "#6C63FF" }
                      }
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

        <CommentsSection animeId={id!} />
      </div>
    </div>
  );
}
