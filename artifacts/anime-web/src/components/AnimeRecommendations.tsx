// components/AnimeRecommendations.tsx
  import { useMemo, useState } from 'react';
  import { useQuery } from '@tanstack/react-query';
  import { RefreshCw, Sparkles } from 'lucide-react';
  import { Rail, PosterCard, PosterSkeletons, toScore10 } from '@/components/iz/ui';
  import { apiClient } from '@/lib/apiClient';
  import { consumet } from '@/lib/consumet';
  import { fetchSeasonalAnime, type SeasonAnime } from '@/lib/anilist';

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

  function normalizeRecs(data: unknown, defaultReason = 'Recomendado'): Recommendation[] {
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
      image: item.image || item.cover || item.coverImage?.large || '',
      score: item.score ?? item.rating ?? item.averageScore ?? 0,
      reason: item.reason ?? defaultReason,
      genres: Array.isArray(item.genres) ? item.genres : [],
      status: item.status ?? '',
      total_episodes: item.total_episodes ?? item.totalEpisodes ?? item.episodes ?? 0,
    }));
  }

  function normalizeSeasonal(items: SeasonAnime[]): Recommendation[] {
    return items.map(item => ({
      anime_id: item.id,
      title: item.title.english || item.title.romaji,
      image: item.coverImage.large,
      score: item.averageScore ?? 0,
      reason: 'Temporada actual',
      genres: item.genres ?? [],
      status: item.status ?? '',
      total_episodes: item.episodes ?? 0,
    }));
  }

      export default function AnimeRecommendations({
    userId,
    animeId,
    type = 'personal',
    title,
    limit = 14,
  }: AnimeRecommendationsProps) {
    const [refreshKey, setRefreshKey] = useState(0);

    const getRecommendations = async (): Promise<Recommendation[]> => {
      // 1. Similar anime desde el servidor
      if (type === 'similar' && animeId) {
        try {
          const r = await apiClient.get<unknown>(`/anime/${animeId}/similar`);
          const recs = normalizeRecs(r, 'Anime similar');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough */ }
      }

      // 2. Personal: historial del usuario (el servidor devuelve [] actualmente)
      if (type === 'personal' && userId) {
        try {
          const r = await apiClient.get<unknown>(`/users/${userId}/recommendations`);
          const recs = normalizeRecs(r, 'Recomendado para ti');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough */ }
      }

      // 3. Fallback: anime de la temporada actual (diferente a popular y trending)
      try {
        const seasonal = await fetchSeasonalAnime();
        if (seasonal.length > 0) return normalizeSeasonal(seasonal);
      } catch { /* fallthrough */ }

      // 4. Último recurso
      const r = await consumet.recentEpisodes();
      return normalizeRecs(r, 'Reciente');
    };

    const { data: recommendations, isLoading } = useQuery<Recommendation[]>({
      queryKey: ['recommendations', type, userId, animeId],
      queryFn: getRecommendations,
      enabled: !!(userId || animeId || type === 'trending' || type === 'personal'),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    });

    const sectionTitle = title
      ?? (type === 'personal' ? 'Recomendaciones para ti'
      : type === 'similar'   ? 'Animes similares'
      : 'Populares para ti');

    // Al pulsar "actualizar" se baraja la lista para mostrar otros títulos
    const displayList = useMemo(() => {
      const list = Array.isArray(recommendations) ? [...recommendations] : [];
      if (refreshKey > 0) {
        for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      }
      return list.slice(0, limit);
    }, [recommendations, refreshKey, limit]);

    return (
      <div>
        <div className="iz-head">
          <div>
            <div className="iz-head__eyebrow"><Sparkles size={12} /> {type === 'personal' && userId ? 'Según lo que ves' : 'Selección'}</div>
            <h2 className="iz-head__title">{sectionTitle}</h2>
          </div>
          <button type="button" className="iz-head__link" onClick={() => setRefreshKey((k) => k + 1)} disabled={isLoading} title="Mostrar otras">
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} /> Otras
          </button>
        </div>
        <Rail label={sectionTitle}>
          {isLoading ? <PosterSkeletons /> : displayList.length > 0 ? displayList.map((rec) => (
            <PosterCard key={String(rec.anime_id)} data={{
              id: rec.anime_id, title: rec.title, image: rec.image, score: toScore10(rec.score),
              badge: rec.status === 'RELEASING' || rec.status === 'Ongoing' ? 'EN EMISIÓN' : undefined, accentBadge: true,
              meta: rec.genres.slice(0, 2).join(' · ') || rec.reason,
            }} />
          )) : (
            <div style={{ padding: '32px 16px', color: 'var(--iz-dim)', fontSize: 13, width: '100%', textAlign: 'center' }}>No hay recomendaciones disponibles.</div>
          )}
        </Rail>
      </div>
    );
  }
