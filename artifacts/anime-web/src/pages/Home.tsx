import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Play, Info, Star, BookmarkCheck, Download, BookOpen, Crown } from "lucide-react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { fetchAiringSchedule, fetchSeasonalAnime, getCurrentSeason, seasonLabel } from "@/lib/anilist";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useWatchList } from "@/context/WatchListContext";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import AnimeRecommendations from "@/components/AnimeRecommendations";
import { useCallback, useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdBanner from "@/components/AdBanner";
import WatchlistNewEpisodesBanner from "@/components/WatchlistNewEpisodesBanner";
import ActiveDiscussions from "@/components/ActiveDiscussions";
import NewsPreview from "@/components/NewsPreview";
import MangaRecentBanner from "@/components/MangaRecentBanner";
import { usePageMeta, SITE_NAME, SITE_URL } from "@/lib/usePageMeta";
import { Rail, SectionHead, PosterCard, WideCard, PosterSkeletons, WideSkeletons, HeroBackdrop, toScore10 } from "@/components/iz/ui";

const HERO_MS = 7000;
const LANDING_URL = "https://anime-app-landing.vercel.app";

interface FeaturedItem {
  id: number;
  anime_id: string;
  anime_title: string;
  anime_image: string;
  action: string;
}

/* ── Monta la sección solo cuando se acerca al viewport ── */
function LazySection({ children, minHeight = 300 }: { children: ReactNode; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const margin = window.matchMedia("(max-width: 768px)").matches ? "1600px" : "1000px";
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: margin });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} style={{ minHeight: inView ? undefined : minHeight }}>{inView ? children : null}</div>;
}

function airedEpisodes(a: AnimeResult): number | undefined {
  if (typeof a.currentEpisode === "number" && a.currentEpisode > 0) return a.currentEpisode;
  return a.totalEpisodes;
}
const isAiring = (status?: string) => status === "Ongoing" || status === "RELEASING";
const cleanText = (html?: string) => (html ? html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "");

function animeToPoster(a: AnimeResult) {
  const eps = airedEpisodes(a);
  const airing = isAiring(a.status);
  return {
    id: a.id,
    title: resolveTitle(a.title),
    image: a.image,
    score: toScore10(a.rating),
    badge: airing ? (eps ? `EP ${eps}` : "EN EMISIÓN") : eps ? `${eps} EPS` : undefined,
    accentBadge: airing,
    meta: [a.type, a.genres?.slice(0, 2).join(" · ")].filter(Boolean).join(" · ") || undefined,
  };
}

function timeSince(date?: string | number): string | null {
  if (!date) return null;
  const t = typeof date === "number" ? date : new Date(date).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return null;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d < 30 ? `hace ${d} d` : null;
}

/* ═══════════ HERO ═══════════ */
function Hero({ items }: { items: AnimeResult[] }) {
  const [, navigate] = useLocation();
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = items.slice(0, 6);
  const anime = list[idx];

  const next = useCallback(() => setIdx((i) => (list.length ? (i + 1) % list.length : 0)), [list.length]);

  useEffect(() => {
    if (list.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.visibilityState !== "visible") return;
    const t = window.setTimeout(next, HERO_MS);
    return () => window.clearTimeout(t);
  }, [idx, list.length, paused, next]);

  useEffect(() => {
    const onVis = () => setPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Precarga de la siguiente imagen para que el cambio sea instantáneo
  useEffect(() => {
    const n = list[(idx + 1) % Math.max(list.length, 1)];
    if (n) { const img = new Image(); img.src = n.cover || n.image; }
  }, [idx, list]);

  if (!anime) {
    return (
      <section className="iz-hero" aria-busy="true">
        <div className="iz-hero__grid" />
        <div className="iz-hero__content"><div className="iz-container">
          <div className="iz-skel" style={{ width: 160, height: 22, marginBottom: 18 }} />
          <div className="iz-skel" style={{ width: "min(560px, 80%)", height: 56, marginBottom: 14 }} />
          <div className="iz-skel" style={{ width: "min(460px, 70%)", height: 16, marginBottom: 8 }} />
          <div className="iz-skel" style={{ width: "min(380px, 60%)", height: 16, marginBottom: 26 }} />
          <div style={{ display: "flex", gap: 12 }}><div className="iz-skel" style={{ width: 150, height: 50 }} /><div className="iz-skel" style={{ width: 130, height: 50 }} /></div>
        </div></div>
      </section>
    );
  }

  const title = resolveTitle(anime.title);
  const score = toScore10(anime.rating);
  const eps = airedEpisodes(anime);
  const desc = cleanText(anime.description) || "Descubre por qué este anime está arrasando entre la comunidad.";

  return (
    <section className="iz-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-roledescription="carrusel" aria-label="Destacados">
      <HeroBackdrop key={anime.id} banner={anime.cover} poster={anime.image} />
      <div className="iz-hero__grid" />
      <div className="iz-hero__content">
        <div className="iz-container">
          <div className="iz-hero__copy" key={`c-${anime.id}`}>
            <div className="iz-hero__eyebrow">
              <span className="iz-tag"><span className="iz-dot" /> #{idx + 1} en tendencias</span>
              {isAiring(anime.status) && <span className="iz-tag iz-tag--accent">En emisión</span>}
              <span className="iz-tag">SUB ESP</span>
            </div>
            <h1 className="iz-hero__title">{title}</h1>
            <div className="iz-hero__meta">
              {score && <span className="iz-score" style={{ fontSize: 14 }}><Star size={13} fill="currentColor" /> {score.toFixed(1)}</span>}
              {anime.type && <span>{anime.type}</span>}
              {eps ? <span>{eps} episodios</span> : null}
              {anime.genres && anime.genres.length > 0 && <span>{anime.genres.slice(0, 3).join(", ")}</span>}
            </div>
            <p className="iz-hero__desc">{desc}</p>
            <div className="iz-hero__cta">
              <button type="button" className="iz-btn iz-btn--primary iz-btn--lg" onClick={() => navigate(`/anime/${anime.id}`)}>
                <Play size={18} fill="#000" /> Ver ahora
              </button>
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--lg" onClick={() => navigate(`/anime/${anime.id}`)}>
                <Info size={18} /> Más info
              </button>
            </div>
          </div>
        </div>
      </div>
      {list.length > 1 && (
        <>
          <div className="iz-hero__thumbs">
            {list.map((a, i) => (
              <button key={a.id} type="button" className={`iz-hero__thumb ${i === idx ? "is-active" : ""}`} onClick={() => setIdx(i)} aria-label={`Ver ${resolveTitle(a.title)}`}>
                <img src={a.image} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <div className="iz-hero__progress" style={{ ["--iz-hero-ms" as string]: `${HERO_MS}ms` }}>
            {list.map((a, i) => (
              <button key={a.id} type="button" onClick={() => setIdx(i)} aria-label={`Destacado ${i + 1}`}
                className={i === idx ? "is-active" : i < idx ? "is-done" : ""}>
                {i === idx && <i key={`${idx}-${paused}`} style={{ animationPlayState: paused ? "paused" : "running" }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ═══════════ CALENDARIO ═══════════ */
const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function ScheduleSection() {
  const [, navigate] = useLocation();
  const today = new Date().getDay();
  const [day, setDay] = useState(today);
  const { getStatus } = useWatchList();
  const { data: schedule = [], isLoading } = useQuery({ queryKey: ["airingSchedule"], queryFn: fetchAiringSchedule, staleTime: 1000 * 60 * 30, retry: 1 });

  const grouped = useMemo(() => DAYS.map((_, i) => schedule.filter((e) => new Date(e.airingAt * 1000).getDay() === i).sort((a, b) => a.airingAt - b.airingAt)), [schedule]);
  const entries = grouped[day] ?? [];
  const mineToday = grouped[today].filter((e) => getStatus(String(e.media.id))).length;

  return (
    <section className="iz-section">
      <SectionHead id="schedule" eyebrow="Calendario" title="Emisiones de la" serif="semana" onAction={() => navigate("/schedule")} />
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 14, scrollbarWidth: "none", alignItems: "center" }}>
        {DAYS.map((d, i) => (
          <button key={d} type="button" className={`iz-chip ${i === day ? "is-active" : ""}`} onClick={() => setDay(i)}>
            {d}{i === today && <span className="iz-dot" style={{ marginLeft: 2 }} />}
          </button>
        ))}
        {mineToday > 0 && <span className="iz-tag iz-tag--accent" style={{ marginLeft: 6, whiteSpace: "nowrap" }}><BookmarkCheck size={12} /> {mineToday} de tu lista emite hoy</span>}
      </div>
      {isLoading ? (
        <Rail><PosterSkeletons /></Rail>
      ) : entries.length === 0 ? (
        <div className="iz-panel iz-panel--pad" style={{ color: "var(--iz-muted)", fontSize: 14, textAlign: "center" }}>No hay episodios programados para el {DAYS_FULL[day]}.</div>
      ) : (
        <Rail label="Calendario">
          {entries.slice(0, 20).map((e) => {
            const time = new Date(e.airingAt * 1000).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
            const mine = !!getStatus(String(e.media.id));
            return (
              <PosterCard key={`${e.media.id}-${e.episode}`} data={{
                id: e.media.id,
                title: e.media.title.english || e.media.title.romaji,
                image: e.media.coverImage.large,
                badge: mine ? `★ EP ${e.episode}` : `EP ${e.episode}`,
                accentBadge: mine,
                meta: `${time} · ${e.media.format}`,
                score: toScore10(e.media.averageScore),
              }} />
            );
          })}
        </Rail>
      )}
    </section>
  );
}

/* ═══════════ GÉNEROS ═══════════ */
const GENRES = [
  { label: "Acción", q: "Action", icon: "⚔️" }, { label: "Aventura", q: "Adventure", icon: "🧭" },
  { label: "Comedia", q: "Comedy", icon: "😂" }, { label: "Drama", q: "Drama", icon: "🎭" },
  { label: "Fantasía", q: "Fantasy", icon: "✨" }, { label: "Romance", q: "Romance", icon: "💗" },
  { label: "Sci-Fi", q: "Sci-Fi", icon: "🚀" }, { label: "Misterio", q: "Mystery", icon: "🔍" },
  { label: "Terror", q: "Horror", icon: "💀" }, { label: "Deportes", q: "Sports", icon: "🏀" },
  { label: "Slice of Life", q: "Slice of Life", icon: "☕" }, { label: "Isekai", q: "Isekai", icon: "🌀" },
  { label: "Shounen", q: "Shounen", icon: "🔥" }, { label: "Thriller", q: "Thriller", icon: "🔪" },
];

/* ═══════════ PÁGINA ═══════════ */
export default function Home() {
  const [, navigate] = useLocation();
  const { progress, removeProgress } = useWatchProgress();
  const { user, isMegaFan } = useAuth();

  const trending = useQuery({ queryKey: ["trending"], queryFn: consumet.trending, staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 });
  const popular = useQuery({ queryKey: ["popular"], queryFn: consumet.popular, staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 });
  const recent = useQuery({ queryKey: ["recent"], queryFn: consumet.recentEpisodes, staleTime: 1000 * 60 * 8, gcTime: 1000 * 60 * 30 });
  const { season, year } = getCurrentSeason();
  const seasonal = useQuery({ queryKey: ["seasonal", season, year], queryFn: fetchSeasonalAnime, staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 120, retry: 1 });
  const featured = useQuery({
    queryKey: ["featured-content"],
    queryFn: () => apiClient.get<{ items: FeaturedItem[] }>("/featured-content"),
    staleTime: 1000 * 60 * 5, retry: 0,
  });

  const trendList = trending.data?.results ?? [];
  const popularList = popular.data?.results ?? [];
  const recentList = recent.data?.results ?? [];
  const seasonalList = seasonal.data ?? [];
  const featuredList = featured.data?.items ?? [];

  const jsonLd = useMemo(() => ([
    {
      "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/`, inLanguage: "es",
      potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
    },
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/`, logo: `${SITE_URL}/icon-512.png` },
  ]), []);
  usePageMeta({
    title: `${SITE_NAME} — Anime y manga en 1080p sub español HD`,
    description: "Mira anime online gratis en HD con subtítulos en español latino y castellano. Tendencias, calendario de emisión, últimos episodios y manga al día.",
    image: trendList[0]?.cover || trendList[0]?.image,
    jsonLd,
  });

  // Un solo episodio por anime, el más reciente primero
  const continueList = useMemo(() => {
    const seen = new Set<string>();
    return [...progress]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .filter((e) => (seen.has(e.animeId) ? false : (seen.add(e.animeId), true)))
      .slice(0, 12);
  }, [progress]);

  return (
    <div className="iz-page iz-page--flush">
      <Navbar transparent />
      <Hero items={trendList} />

      <main className="iz-container iz-overlap">
        <WatchlistNewEpisodesBanner />

        {continueList.length > 0 && (
          <section className="iz-section" style={{ marginTop: 8 }}>
            <SectionHead id="continue" eyebrow="Tu progreso" title="Continuar" serif="viendo" onAction={() => navigate("/history")} action="Historial" />
            <Rail label="Continuar viendo">
              {continueList.map((e) => {
                const pct = e.duration > 0 ? e.currentTime / e.duration : 0;
                const left = e.duration > 0 ? Math.max(0, Math.round((e.duration - e.currentTime) / 60)) : null;
                return (
                  <WideCard key={e.episodeId} title={e.animeTitle} image={e.animeImage}
                    meta={`Episodio ${e.episodeNum}`} right={left != null ? `${left} min restantes` : undefined}
                    progress={pct}
                    onRemove={() => removeProgress(e.episodeId)}
                    onClick={() => {
                      const p = new URLSearchParams({ episodeId: e.episodeId, episodeNum: String(e.episodeNum), animeTitle: e.animeTitle, animeId: e.animeId, animeImage: e.animeImage });
                      navigate(`/watch?${p.toString()}`);
                    }} />
                );
              })}
            </Rail>
          </section>
        )}

        <section className="iz-section" style={continueList.length ? undefined : { marginTop: 8 }}>
          <SectionHead id="trending" eyebrow="Lo más visto" title="Tendencias" serif="ahora" onAction={() => navigate("/search?sort=trending")} />
          <Rail label="Tendencias">
            {trending.isLoading ? <PosterSkeletons /> : trendList.slice(0, 18).map((a) => <PosterCard key={a.id} data={animeToPoster(a)} />)}
          </Rail>
        </section>

        <section className="iz-section">
          <SectionHead id="recent" eyebrow="Recién publicados" title="Últimos" serif="episodios" />
          <Rail label="Últimos episodios">
            {recent.isLoading ? <WideSkeletons /> : recentList.slice(0, 16).map((a) => (
              <WideCard key={`${a.id}-${a.currentEpisode ?? ""}`} title={resolveTitle(a.title)} image={a.cover || a.image}
                badges={[`EP ${a.currentEpisode ?? "?"}`, "HD"]}
                meta={a.type || "Anime"} right={timeSince(a.releaseDate) ?? undefined}
                onClick={() => navigate(`/anime/${a.id}`)} />
            ))}
          </Rail>
        </section>

        {popularList.length > 0 && (
          <section className="iz-section">
            <SectionHead id="top" eyebrow="Ranking" title="Top 10" serif="de la semana" />
            <Rail label="Top 10">
              {popularList.slice(0, 10).map((a, i) => (
                <div key={a.id} className="iz-top">
                  <span className="iz-top__num" aria-hidden>{i + 1}</span>
                  <PosterCard data={{ ...animeToPoster(a), meta: undefined }} />
                </div>
              ))}
            </Rail>
          </section>
        )}

        {featuredList.length > 0 && (
          <section className="iz-section">
            <SectionHead id="featured" eyebrow="Elegidos por el staff" title="Selección" serif="IZIFF" />
            <Rail label="Selección del staff">
              {featuredList.map((f) => <PosterCard key={f.id} data={{ id: f.anime_id, title: f.anime_title, image: f.anime_image, badge: "✦ STAFF", accentBadge: true }} />)}
            </Rail>
          </section>
        )}

        <LazySection><ScheduleSection /></LazySection>

        <LazySection>
          <section className="iz-section">
            <SectionHead id="seasonal" eyebrow={`${seasonLabel(season)} ${year}`} title="Estrenos de" serif="temporada" onAction={() => navigate("/schedule")} />
            <Rail label="Temporada">
              {seasonal.isLoading ? <PosterSkeletons /> : seasonalList.map((a) => (
                <PosterCard key={a.id} data={{
                  id: a.id, title: a.title.english || a.title.romaji, image: a.coverImage.large,
                  badge: a.status === "RELEASING" ? "EN EMISIÓN" : "PRÓXIMO", accentBadge: a.status === "RELEASING",
                  score: toScore10(a.averageScore), meta: [a.format, a.genres?.slice(0, 2).join(" · ")].filter(Boolean).join(" · "),
                }} />
              ))}
            </Rail>
          </section>
        </LazySection>

        <div className="iz-section"><AdBanner variant="horizontal" /></div>

        <LazySection minHeight={260}>
          <section className="iz-section">
            {user
              ? <AnimeRecommendations userId={user.id} type="personal" limit={16} />
              : <AnimeRecommendations type="trending" title="Recomendaciones para ti" limit={16} />}
          </section>
        </LazySection>

        <LazySection>
          <section className="iz-section">
            <SectionHead id="popular" eyebrow="Clásicos y favoritos" title="Más" serif="populares" onAction={() => navigate("/search?sort=popular")} />
            <Rail label="Más populares">
              {popular.isLoading ? <PosterSkeletons /> : popularList.slice(10, 30).map((a) => <PosterCard key={a.id} data={animeToPoster(a)} />)}
            </Rail>
          </section>
        </LazySection>

        <LazySection minHeight={200}>
          <section className="iz-section">
            <div className="iz-band">
              <div>
                <div className="iz-head__eyebrow"><BookOpen size={13} /> Manga al día</div>
                <h3>Lee manga en <span className="iz-serif">HD</span>, sin cortes.</h3>
                <p>Modo webtoon vertical, carga progresiva y tu último capítulo siempre guardado.</p>
              </div>
              <button type="button" className="iz-btn iz-btn--primary" onClick={() => navigate("/manga")}><BookOpen size={16} /> Explorar manga</button>
            </div>
            <div style={{ marginTop: 16 }}><MangaRecentBanner /></div>
          </section>
        </LazySection>

        <LazySection minHeight={240}><section className="iz-section"><NewsPreview /></section></LazySection>
        <LazySection minHeight={180}><section className="iz-section"><ActiveDiscussions /></section></LazySection>

        <section className="iz-section">
          <SectionHead id="genres" eyebrow="Explora por" title="Géneros" />
          <div className="iz-genres">
            {GENRES.map((g) => (
              <button key={g.q} type="button" className="iz-genre" onClick={() => navigate(`/search?genre=${encodeURIComponent(g.q)}`)}>
                <span>{g.icon}</span>{g.label}
              </button>
            ))}
          </div>
        </section>

        <section className="iz-section">
          <div className="iz-band">
            <div>
              <div className="iz-head__eyebrow"><span className="iz-dot" /> Android · Windows</div>
              <h3>Llévate IZIFF ANIME <span className="iz-serif">a todas partes</span></h3>
              <p>Descarga la app con reproductor nativo, descargas offline y salas para ver con amigos.</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="iz-btn iz-btn--primary" href={`${LANDING_URL}/#descargas`} target="_blank" rel="noopener noreferrer"><Download size={16} /> Descargar app</a>
              {!isMegaFan && <button type="button" className="iz-btn iz-btn--accent" onClick={() => navigate("/membership")}><Crown size={16} /> MegaFan</button>}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
