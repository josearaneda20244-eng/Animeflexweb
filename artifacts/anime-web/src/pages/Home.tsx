import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { RefreshCw, Play, TrendingUp, Star, Clock } from "lucide-react";
import AnimeCard from "@/components/AnimeCard";
import { SkeletonRow } from "@/components/SkeletonCard";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useWatchProgress } from "@/context/WatchProgressContext";

export default function Home() {
  const { progress } = useWatchProgress();

  const trendingQuery = useQuery({
    queryKey: ["trending"],
    queryFn: () => consumet.trending(),
    staleTime: 1000 * 60 * 5,
  });

  const popularQuery = useQuery({
    queryKey: ["popular"],
    queryFn: () => consumet.popular(),
    staleTime: 1000 * 60 * 5,
  });

  const recentQuery = useQuery({
    queryKey: ["recent"],
    queryFn: () => consumet.recentEpisodes(),
    staleTime: 1000 * 60 * 2,
  });

  const trending = trendingQuery.data?.results ?? [];
  const popular = popularQuery.data?.results ?? [];
  const recent = recentQuery.data?.results ?? [];
  const hero = trending[0];

  const getAnimeProgress = (animeId: string) =>
    progress.filter((p) => p.animeId === animeId).sort((a, b) => b.updatedAt - a.updatedAt)[0];

  return (
    <div className="min-h-screen" style={{ background: "#090A12" }}>
      {/* Hero */}
      {hero && <HeroSection anime={hero} />}

      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 pb-16 space-y-10 pt-6">
        {/* Continue Watching */}
        {progress.length > 0 && (
          <Section title="Continuar Viendo" icon={<Clock size={16} />}>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {progress.slice(0, 7).map((p) => (
                <AnimeCard
                  key={p.episodeId}
                  anime={{
                    id: p.animeId,
                    title: p.animeTitle,
                    image: p.animeImage,
                  }}
                  progress={p.currentTime / p.duration}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Trending */}
        <Section title="Tendencias" icon={<TrendingUp size={16} />} loading={trendingQuery.isLoading}>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {trending.slice(0, 14).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} progress={getAnimeProgress(anime.id)?.currentTime / (getAnimeProgress(anime.id)?.duration || 1)} />
            ))}
          </div>
        </Section>

        {/* Popular */}
        <Section title="Populares" icon={<Star size={16} />} loading={popularQuery.isLoading}>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {popular.slice(0, 14).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </Section>

        {/* Recent Episodes */}
        <Section title="Episodios Recientes" icon={<Play size={16} />} loading={recentQuery.isLoading}>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {recent.slice(0, 14).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function HeroSection({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  const desc = (anime.description ?? "").replace(/<[^>]+>/g, "").slice(0, 200);

  return (
    <div className="relative w-full overflow-hidden" style={{ height: "min(500px, 60vw)" }}>
      <img
        src={anime.cover || anime.image}
        alt={title}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 hero-overlay" />
      <div className="absolute inset-0 flex flex-col justify-end px-4 md:px-8 pb-8">
        <div className="max-w-2xl">
          {anime.genres && anime.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {anime.genres.slice(0, 3).map((g) => (
                <span key={g} className="genre-badge">{g}</span>
              ))}
            </div>
          )}
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2 line-clamp-2">{title}</h1>
          {desc && <p className="text-sm text-gray-300 line-clamp-2 mb-4">{desc}</p>}
          <button
            onClick={() => navigate(`/anime/${anime.id}`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
          >
            <Play size={16} fill="currentColor" />
            Ver ahora
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title, icon, children, loading,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="section-accent" />
        {icon && <span className="text-[#6C63FF]">{icon}</span>}
        <h2 className="text-base font-bold text-[#F0F0FF]">{title}</h2>
      </div>
      {loading ? <SkeletonRow /> : children}
    </div>
  );
}
