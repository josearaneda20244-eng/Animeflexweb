// components/AnimeRecommendations.tsx
  import { useState } from 'react';
  import { useQuery } from '@tanstack/react-query';
  import { RefreshCw, Sparkles } from 'lucide-react';
  import { apiClient } from '@/lib/apiClient';
  import { consumet, resolveTitle, type AnimeResult } from '@/lib/consumet';
  import { Link } from 'wouter';
  import { Star } from 'lucide-react';

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
    const [hovered, setHovered] = useState(false);
    const href = `/anime/${rec.anime_id}`;

    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block', width: 130, flexShrink: 0, scrollSnapAlign: 'start' }}>
        <div
          style={{
            position: 'relative',
            width: 130,
            height: 197,
            borderRadius: 14,
            overflow: 'hidden',
            background: '#13131C',
            border: hovered ? '1px solid rgba(168,85,247,0.6)' : '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
            transform: hovered ? 'translateY(-5px)' : 'none',
            boxShadow: hovered ? '0 12px 32px rgba(168,85,247,0.35)' : 'none',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <img
            src={rec.image}
            alt={rec.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transition: 'transform 0.3s', transform: hovered ? 'scale(1.06)' : 'scale(1)' }}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                `https://placehold.co/130x197/13131C/a855f7?text=${encodeURIComponent(rec.title.slice(0, 8))}`;
            }}
          />
          {/* gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(9,10,18,0) 35%, rgba(9,10,18,0.95) 100%)',
          }} />

          {/* score badge */}
          {rec.score > 0 && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
              borderRadius: 5, padding: '2px 5px',
              display: 'flex', alignItems: 'center', gap: 2,
              border: '1px solid rgba(168,85,247,0.3)',
            }}>
              <Star size={8} color="#a855f7" fill="#a855f7" />
              <span style={{ color: '#a855f7', fontSize: 8, fontWeight: 800 }}>
                {(rec.score / 10).toFixed(1)}
              </span>
            </div>
          )}

          {/* SUB badge */}
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            borderRadius: 4, padding: '2px 5px',
            color: '#fff', fontSize: 7, fontWeight: 900, letterSpacing: 0.5,
          }}>SUB</div>

          {/* footer info */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px' }}>
            <div style={{
              color: '#fff', fontSize: 10, fontWeight: 700,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              lineHeight: 1.3, marginBottom: 3,
            }}>{rec.title}</div>
            <div style={{ color: 'rgba(168,85,247,0.85)', fontSize: 8, fontWeight: 600 }}>
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
      // 1. Tipo similar: desde el servidor
      if (type === 'similar' && animeId) {
        try {
          const response = await apiClient.get<unknown>(`/anime/${animeId}/similar`);
          const recs = normalizeRecs(response, 'Anime similar');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough */ }
      }

      // 2. Personal: desde el servidor (historial del usuario)
      if (type === 'personal' && userId) {
        try {
          const response = await apiClient.get<unknown>(`/users/${userId}/recommendations`);
          const recs = normalizeRecs(response, 'Recomendado para ti');
          if (recs.length > 0) return recs;
        } catch { /* fallthrough */ }
      }

      // 3. Fallback: usar popular() — distinto a trending()
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

    const sectionTitle = title ?? (type === 'personal' ? 'Recomendaciones para ti' : type === 'similar' ? 'Animes similares' : 'Populares para ti');
    const displayList = Array.isArray(recommendations) ? recommendations.slice(0, limit) : [];

    return (
      <div>
        {/* Header con acento morado */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Accent bar */}
            <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(180deg, #7c3aed, #a855f7)' }} />
            <Sparkles size={16} color="#a855f7" />
            <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 800, margin: 0 }}>
              {sectionTitle}
            </h2>
          </div>
          <button
            onClick={() => { setRefreshKey(k => k + 1); refetch(); }}
            disabled={isLoading}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(168,85,247,0.6)', padding: 4, display: 'flex',
              transition: 'color 0.2s',
            }}
            title="Actualizar recomendaciones"
          >
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Carousel horizontal — mismo layout que Más Populares */}
        <div className="carousel-scroll">
          {isLoading
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={i} style={{
                  width: 130, height: 197, flexShrink: 0, scrollSnapAlign: 'start',
                  borderRadius: 14, background: 'linear-gradient(135deg, #12121E, #1a0a2e)',
                  border: '1px solid rgba(168,85,247,0.1)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }} />
              ))
            : displayList.length > 0
            ? displayList.map((rec) => <RecCard key={String(rec.anime_id)} rec={rec} />)
            : (
              <div style={{ padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', width: '100%' }}>
                No hay recomendaciones disponibles.
              </div>
            )}
        </div>
      </div>
    );
  }
  