// components/AnimeRecommendations.tsx
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Heart, Star, TrendingUp, Clock, Users, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { resolveTitle } from '@/lib/consumet';
import AnimeCard from './AnimeCard';
import { SkeletonCard } from './SkeletonCard';
import { Button } from './ui/button';

interface Recommendation {
  anime_id: number;
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

export default function AnimeRecommendations({
  userId,
  animeId,
  type = 'personal',
  title,
  limit = 12
}: AnimeRecommendationsProps) {
  const [, navigate] = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  const getRecommendations = async (): Promise<Recommendation[]> => {
    if (type === 'personal' && userId) {
      const response = await apiClient.get<Recommendation[]>(`/users/${userId}/recommendations`);
      return response;
    } else if (type === 'trending') {
      const response = await apiClient.get<Recommendation[]>('/anime/trending');
      return response;
    } else if (type === 'similar' && animeId) {
      const response = await apiClient.get<Recommendation[]>(`/anime/${animeId}/similar`);
      return response;
    }
    return [];
  };

  const { data: recommendations, isLoading, error, refetch } = useQuery<Recommendation[]>({
    queryKey: ['recommendations', type, userId, animeId, refreshKey],
    queryFn: getRecommendations,
    enabled: !!(userId || animeId || type === 'trending'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'personal':
        return 'Recomendaciones para ti';
      case 'trending':
        return 'Tendencias';
      case 'similar':
        return 'Animes similares';
      default:
        return 'Recomendaciones';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'personal':
        return <Users className="w-5 h-5" />;
      case 'trending':
        return <TrendingUp className="w-5 h-5" />;
      case 'similar':
        return <Star className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </h2>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          Error al cargar recomendaciones. Intenta de nuevo.
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="ml-2"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const displayRecommendations = recommendations?.slice(0, limit) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          {getIcon()}
          {getTitle()}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({ length: limit }, (_, i) => (
            <SkeletonCard key={i} />
          ))
        ) : displayRecommendations.length > 0 ? (
          displayRecommendations.map((rec) => (
            <div key={rec.anime_id} className="space-y-2">
              <AnimeCard
                anime={{
                  id: rec.anime_id.toString(),
                  title: rec.title,
                  image: rec.image,
                  rating: rec.score,
                  totalEpisodes: rec.total_episodes,
                  status: rec.status,
                  genres: rec.genres
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