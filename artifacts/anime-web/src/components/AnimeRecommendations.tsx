// components/AnimeRecommendations.tsx
  import { useState } from 'react';
  import { useQuery } from '@tanstack/react-query';
  import { Star, TrendingUp, Users, RefreshCw } from 'lucide-react';
  import { apiClient } from '@/lib/apiClient';
  import { consumet, resolveTitle } from '@/lib/consumet';
  import AnimeCard from './AnimeCard';
  import { SkeletonCard } from './SkeletonCard';
  import { Button } from './ui/button';

  interface Recommendation {
    anime_id: string | number;
    title: string;
    image: string;
    score: number;
    reason: string;
    genres: string[];
    status: string;
    total_episodes: number;
  }

  interface AnimeRecommendationsProps {
    userId?: number;
    animeId?: number;
    type?: 'personal' | 'trending' | 'similar';
    title?: string;
    limit?: number;
  }

  function normalizeToRecommendations(data: unknown, defaultReason = 'Tendencia popular'): Recommendation[] {
    if (!data) return [];
    const items: any[] = Array.isArray(data)
      ? data
      : Array.isArray((data as any).results)
      ? (data as any).results
      : [];

    return items.map((item: any) => ({
      anime_id: item.anime_id ?? item.id ?? 0,
      title: typeof item.title === 'string'
        ? item.title
        : (item.title?.english || item.title?.romaji || item.title?.userPreferred || 'Unknown'),
      image: item.image || item.cover || '',
      score: item.score ?? item.rating ?? 0,
      reason: item.reason ?? defaultReason,
      genres: Array.isArray(item.genres) ? item.genres : [],
      status: item.status ?? '',
      total_episodes: item.total_episodes ?? item.totalEpisodes ?? 0,
    }));
  }

  export default function AnimeRecommendations({
    userId,
    animeId,
    type = 'personal',
    title,
    limit = 12,
  }: AnimeRecommendationsProps) {
    const [refreshKey, setRefreshKey] = useState(0);

    const getRecommendations = async (): Promise<Recommendation[]> => {
      if (type === 'trending') {
        const response = await consumet.trending();
        return normalizeToRecommendations(response, 'Tendencia popular');
      }

      if (type === 'similar' && animeId) {
        try {
          const response = await apiClient.get<unknown>(`/anime/${animeId}/similar`);
          const recs = normalizeToRecommendations(response, 'Anime similar');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough to trending */ }
      }

      if (type === 'personal' && userId) {
        try {
          const response = await apiClient.get<unknown>(`/users/${userId}/recommendations`);
          const recs = normalizeToRecommendations(response, 'Recomendado para ti');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough to trending */ }
      }

      // Fallback universal: AniList trending
      const response = await consumet.trending();
      return normalizeToRecommendations(response, 'Tendencia popular');
    };

    const { data: recommendations, isLoading, refetch } = useQuery<Recommendation[]>({
      queryKey: ['recommendations', type, userId, animeId, refreshKey],
      queryFn: getRecommendations,
      enabled: !!(userId || animeId || type === 'trending'),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    });

    const handleRefresh = () => {
      setRefreshKey(prev => prev + 1);
      refetch();
    };

    const getTitle = () => {
      if (title) return title;
      switch (type) {
        case 'personal': return 'Recomendaciones para ti';
        case 'trending': return 'Tendencias';
        case 'similar': return 'Animes similares';
        default: return 'Recomendaciones';
      }
    };

    const getIcon = () => {
      switch (type) {
        case 'personal': return <Users className="w-5 h-5" />;
        case 'trending': return <TrendingUp className="w-5 h-5" />;
        case 'similar': return <Star className="w-5 h-5" />;
        default: return <Star className="w-5 h-5" />;
      }
    };

    const displayRecommendations = Array.isArray(recommendations)
      ? recommendations.slice(0, limit)
      : [];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </h2>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {isLoading ? (
            Array.from({ length: limit }, (_, i) => <SkeletonCard key={i} />)
          ) : displayRecommendations.length > 0 ? (
            displayRecommendations.map((rec) => (
              <div key={`${rec.anime_id}`} className="space-y-2">
                <AnimeCard
                  anime={{
                    id: rec.anime_id.toString(),
                    title: rec.title,
                    image: rec.image,
                    rating: rec.score,
                    totalEpisodes: rec.total_episodes,
                    status: rec.status,
                    genres: rec.genres,
                  }}
                />
                <div className="text-xs text-muted-foreground text-center px-1">
                  {rec.reason}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No hay recomendaciones disponibles en este momento.
            </div>
          )}
        </div>
      </div>
    );
  }
  