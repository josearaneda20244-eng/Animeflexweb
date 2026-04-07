// components/AnimeRecommendations.tsx
  import { useState } from 'react';
  import { useQuery } from '@tanstack/react-query';
  import { TrendingUp, Users, RefreshCw } from 'lucide-react';
  import { apiClient } from '@/lib/apiClient';
  import { consumet } from '@/lib/consumet';
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
        } catch { /* fallthrough */ }
      }

      if (type === 'personal' && userId) {
        try {
          const response = await apiClient.get<unknown>(`/users/${userId}/recommendations`);
          const recs = normalizeToRecommendations(response, 'Recomendado para ti');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough */ }
      }

      // Fallback: AniList trending directo
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
        case 'trending': return 'Tendencias Populares';
        case 'similar': return 'Animes similares';
        default: return 'Recomendaciones';
      }
    };

    const getIcon = () => {
      switch (type) {
        case 'personal': return <Users className="w-5 h-5" />;
        case 'trending': return <TrendingUp className="w-5 h-5" />;
        default: return <TrendingUp className="w-5 h-5" />;
      }
    };

    const displayRecommendations = Array.isArray(recommendations)
      ? recommendations.slice(0, limit)
      : [];

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 10 }}>
          <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            {getIcon()}
            {getTitle()}
          </h2>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading} style={{ color: 'rgba(255,255,255,0.5)', padding: '4px 8px' }}>
            <RefreshCw style={{ width: 14, height: 14 }} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </div>

        {/* Carousel — same layout as "Más Populares" */}
        <div className="carousel-scroll">
          {isLoading ? (
            Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ width: 130, height: 197, borderRadius: 14, background: '#12121E', flexShrink: 0, scrollSnapAlign: 'start' }} />
            ))
          ) : displayRecommendations.length > 0 ? (
            displayRecommendations.map((rec) => (
              <div key={String(rec.anime_id)} style={{ width: 130, flexShrink: 0, scrollSnapAlign: 'start' }}>
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
              </div>
            ))
          ) : (
            <div style={{ padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', width: '100%' }}>
              No hay recomendaciones disponibles.
            </div>
          )}
        </div>
      </div>
    );
  }
  