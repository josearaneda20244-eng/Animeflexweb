// components/AnimeRecommendations.tsx
  import { useState } from 'react';
  import { useQuery } from '@tanstack/react-query';
  import { RefreshCw, Sparkles, Star } from 'lucide-react';
  import { apiClient } from '@/lib/apiClient';
  import { consumet } from '@/lib/consumet';
  import { Link } from 'wouter';

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
      image: item.image || item.cover || '',
      score: item.score ?? item.rating ?? 0,
      reason: item.reason ?? defaultReason,
      genres: Array.isArray(item.genres) ? item.genres : [],
      status: item.status ?? '',
      total_episodes: item.total_episodes ?? item.totalEpisodes ?? 0,
    }));
  }

  function RecCard({ rec }: { rec: Recommendation }) {
    return (
      <Link href={`/anime/${rec.anime_id}`} style={{ textDecoration: 'none' }}>
        <div className="rec-card">
          <img
            src={rec.image}
            alt={rec.title}
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://placehold.co/130x197/1a0a2e/a855f7?text=${encodeURIComponent(rec.title.slice(0, 8))}`;
            }}
          />

          {/* dark gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(9,10,18,0) 30%, rgba(9,10,18,0.97) 100%)',
          }} />

          {/* SUB badge */}
          <div style={{
            position: 'absolute', top: 7, left: 7,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            borderRadius: 4, padding: '2px 6px',
            color: '#fff', fontSize: 7, fontWeight: 900, letterSpacing: 0.5,
          }}>SUB</div>

          {/* score badge */}
          {rec.score > 0 && (
            <div style={{
              position: 'absolute', top: 7, right: 7,
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(4px)',
              borderRadius: 5, padding: '2px 5px',
              display: 'flex', alignItems: 'center', gap: 2,
              border: '1px solid rgba(168,85,247,0.4)',
            }}>
              <Star size={7} color="#a855f7" fill="#a855f7" />
              <span style={{ color: '#c084fc', fontSize: 8, fontWeight: 800 }}>
                {(rec.score / 10).toFixed(1)}
              </span>
            </div>
          )}

          {/* footer */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px' }}>
            <div style={{
              color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1.3,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              marginBottom: 2,
            }}>{rec.title}</div>
            <div style={{ color: 'rgba(192,132,252,0.8)', fontSize: 8, fontWeight: 600 }}>
              {rec.status || 'Anime'}
            </div>
          </div>
        </div>
      </Link>
    );
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
      if (type === 'similar' && animeId) {
        try {
          const response = await apiClient.get<unknown>(`/anime/${animeId}/similar`);
          const recs = normalizeRecs(response, 'Anime similar');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough */ }
      }

      if (type === 'personal' && userId) {
        try {
          const response = await apiClient.get<unknown>(`/users/${userId}/recommendations`);
          const recs = normalizeRecs(response, 'Recomendado para ti');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough */ }
      }

      // Fallback: popular() — diferente a trending()
      const response = await consumet.popular();
      return normalizeRecs(response, 'Entre los más populares');
    };

    const { data: recommendations, isLoading, refetch } = useQuery<Recommendation[]>({
      queryKey: ['recommendations', type, userId, animeId, refreshKey],
      queryFn: getRecommendations,
      enabled: !!(userId || animeId || type === 'trending' || type === 'personal'),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    });

    const sectionTitle = title
      ?? (type === 'personal' ? 'Recomendaciones para ti'
        : type === 'similar' ? 'Animes similares'
        : 'Populares para ti');

    const displayList = Array.isArray(recommendations) ? recommendations.slice(0, limit) : [];

    return (
      <section className="rec-section">
        {/* Animated background orbs */}
        <div className="rec-bg" />
        <div className="rec-orb-1" />
        <div className="rec-orb-2" />
        <div className="rec-orb-3" />

        {/* Header */}
        <div className="rec-header">
          <div className="rec-header-left">
            <div className="rec-accent-bar" />
            <Sparkles size={15} color="#a855f7" />
            <h2 className="rec-title-text">{sectionTitle}</h2>
          </div>
          <button
            className="rec-refresh-btn"
            onClick={() => { setRefreshKey(k => k + 1); refetch(); }}
            disabled={isLoading}
            title="Actualizar"
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Carousel — same padding/structure as other sections */}
        <div className="carousel-scroll">
          {isLoading
            ? Array.from({ length: 10 }, (_, i) => <div key={i} className="rec-skel" />)
            : displayList.length > 0
            ? displayList.map((rec) => <RecCard key={String(rec.anime_id)} rec={rec} />)
            : (
              <div style={{ padding: '32px 16px', color: 'rgba(255,255,255,0.3)', fontSize: 13, width: '100%', textAlign: 'center' }}>
                No hay recomendaciones disponibles.
              </div>
            )}
        </div>
      </section>
    );
  }
  