// components/AnimeRecommendations.tsx
  import { useState, useRef } from 'react';
  import { useQuery } from '@tanstack/react-query';
  import { RefreshCw, Sparkles, Star } from 'lucide-react';
  import { apiClient } from '@/lib/apiClient';
  import { consumet } from '@/lib/consumet';
  import { fetchSeasonalAnime, type SeasonAnime } from '@/lib/anilist';
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

  function RecCard({ rec }: { rec: Recommendation }) {
    return (
      <Link href={`/anime/${rec.anime_id}`} style={{ textDecoration: 'none', display: 'block', flexShrink: 0 }}>
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
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(9,10,18,0) 30%, rgba(9,10,18,0.97) 100%)',
          }} />
          <div style={{
            position: 'absolute', top: 7, left: 7,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            borderRadius: 4, padding: '2px 6px',
            color: '#fff', fontSize: 7, fontWeight: 900, letterSpacing: 0.5,
          }}>SUB</div>
          {rec.score > 0 && (
            <div style={{
              position: 'absolute', top: 7, right: 7,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
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
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 8px' }}>
            <div style={{
              color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1.3,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 2,
            }}>{rec.title}</div>
            <div style={{ color: 'rgba(192,132,252,0.8)', fontSize: 8, fontWeight: 600 }}>
              {rec.status || 'Anime'}
            </div>
          </div>
        </div>
      </Link>
    );
  }


    /* ── SCROLLABLE CAROUSEL WITH ARROWS ── */
    function RecCarousel({ children }: { children: React.ReactNode }) {
      const ref = useRef<HTMLDivElement>(null);
      const [canLeft, setCanLeft] = useState(false);
      const [canRight, setCanRight] = useState(true);
      const update = () => {
        const el = ref.current;
        if (!el) return;
        setCanLeft(el.scrollLeft > 4);
        setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
      };
      const scroll = (dir: number) => {
        ref.current?.scrollBy({ left: dir * 420, behavior: 'smooth' });
        setTimeout(update, 350);
      };
      const arrowStyle = (active: boolean, side: string): React.CSSProperties => ({
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [side]: 6, zIndex: 10,
        background: 'rgba(7,7,20,0.82)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(139,92,246,0.35)', borderRadius: 22,
        width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: active ? 'pointer' : 'default',
        opacity: active ? 1 : 0, pointerEvents: active ? 'auto' : 'none',
        transition: 'opacity 0.22s, background 0.18s, transform 0.18s',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 14px rgba(139,92,246,0.25)',
      });
      return (
        <div style={{ position: 'relative' }} onMouseEnter={update}>
          <button onClick={() => scroll(-1)} style={arrowStyle(canLeft, 'left')}
            onMouseEnter={e => { if (canLeft) { e.currentTarget.style.background = 'rgba(139,92,246,0.45)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(7,7,20,0.82)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="#C4B5FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button onClick={() => scroll(1)} style={arrowStyle(canRight, 'right')}
            onMouseEnter={e => { if (canRight) { e.currentTarget.style.background = 'rgba(139,92,246,0.45)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(7,7,20,0.82)'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#C4B5FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div ref={ref} className="carousel-scroll" onScroll={update}>{children}</div>
          {canLeft && <div style={{ position: 'absolute', top: 0, left: 0, width: 60, height: '100%', pointerEvents: 'none', background: 'linear-gradient(to right, rgba(7,7,20,0.85), transparent)' }} />}
          {canRight && <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: '100%', pointerEvents: 'none', background: 'linear-gradient(to left, rgba(7,7,20,0.85), transparent)' }} />}
        </div>
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
      : type === 'similar'   ? 'Animes similares'
      : 'Populares para ti');

    const displayList = Array.isArray(recommendations) ? recommendations.slice(0, limit) : [];

    return (
      <section className="rec-section">
        <div className="rec-bg" />
        <div className="rec-orb-1" />
        <div className="rec-orb-2" />
        <div className="rec-orb-3" />

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
  