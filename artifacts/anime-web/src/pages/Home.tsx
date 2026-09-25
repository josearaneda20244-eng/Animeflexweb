import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CornerBrackets, SystemTag, ScanLines } from "@/components/SystemUI";
import { Play, Info, Star, ChevronLeft, ChevronRight, Tv, X, BookmarkCheck, Home as HomeIcon, Compass, TrendingUp, CalendarDays, ListVideo, History, Settings, Crown, Search, Clock3 } from "lucide-react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { fetchAiringSchedule, fetchSeasonalAnime, getCurrentSeason, seasonLabel, type SeasonAnime } from "@/lib/anilist";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useWatchList } from "@/context/WatchListContext";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import AnimeRecommendations from "@/components/AnimeRecommendations";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdBanner from "@/components/AdBanner";
import { SkeletonRow } from "@/components/SkeletonCard";
import WatchlistNewEpisodesBanner from "@/components/WatchlistNewEpisodesBanner";
import QuickFilters from "@/components/QuickFilters";
import ActiveDiscussions from "@/components/ActiveDiscussions";
import NewsPreview from "@/components/NewsPreview";
import MangaRecentBanner from "@/components/MangaRecentBanner";
import { usePageMeta } from "@/lib/usePageMeta";

interface FeaturedItem {
  id: number;
  anime_id: string;
  anime_title: string;
  anime_image: string;
  action: string;
}

/* ── LAZY SECTION (only mount when near viewport) ── */
function useLazySection(rootMargin?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const margin = useMemo(() => {
    if (rootMargin) return rootMargin;
    if (typeof window === "undefined") return "1200px";
    return window.matchMedia("(max-width: 768px)").matches ? "1800px" : "1200px";
  }, [rootMargin]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { rootMargin: margin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [margin]);
  return { ref, inView };
}

function LazySection({ children, minHeight = 280, skeleton }: { children: React.ReactNode; minHeight?: number; skeleton?: React.ReactNode }) {
  const { ref, inView } = useLazySection();
  return (
    <div ref={ref} style={{ minHeight: inView ? undefined : minHeight }}>
      {inView ? children : (skeleton ?? <SkeletonRow count={6} />)}
    </div>
  );
}

function nav(navigate: (to: string) => void, id: string | number) {
  navigate(`/anime/${id}`);
}

/* ── SCROLLABLE CAROUSEL WITH ARROWS ── */
function ScrollableCarousel({ children, scrollAmount = 420 }: { children: React.ReactNode; scrollAmount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => { update(); }, [children]);

  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * scrollAmount, behavior: "smooth" });
    setTimeout(update, 350);
  };

  const ARROW_STYLE = (active: boolean, side: "left" | "right"): React.CSSProperties => ({
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    [side]: 6,
    zIndex: 10,
    background: "rgba(0,0,0,0.8)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 22,
    width: 38, height: 38,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: active ? "pointer" : "default",
    opacity: active ? 1 : 0,
    pointerEvents: active ? "auto" : "none",
    transition: "opacity 0.22s, background 0.18s, transform 0.18s, box-shadow 0.18s",
    boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  });

  return (
    <div style={{ position: "relative" }} onMouseEnter={update}>
      <button onClick={() => scroll(-1)} className="carousel-arrow" style={ARROW_STYLE(canLeft, "left")}
        onMouseEnter={e => { if (canLeft) { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; } }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.8)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}>
        <ChevronLeft size={20} color="#fff" />
      </button>
      <button onClick={() => scroll(1)} className="carousel-arrow" style={ARROW_STYLE(canRight, "right")}
        onMouseEnter={e => { if (canRight) { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; } }}
        onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.8)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}>
        <ChevronRight size={20} color="#fff" />
      </button>
      <div ref={ref} className="carousel-scroll" onScroll={update}>{children}</div>
      {canLeft && <div style={{ position: "absolute", top: 0, left: 0, width: 60, height: "100%", pointerEvents: "none", background: "linear-gradient(to right, #000, transparent)" }} />}
      {canRight && <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: "100%", pointerEvents: "none", background: "linear-gradient(to left, #000, transparent)" }} />}
    </div>
  );
}

/* ── HERO SKELETON (cinematic loading state) ── */
function HeroSkeleton() {
  return (
    <div className="home-hero home-hero--skeleton" style={{
      position: "relative",
      height: "clamp(440px, 70vw, 580px)",
      overflow: "hidden",
      background: "linear-gradient(135deg, #0a0510 0%, #15050a 50%, #050309 100%)",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(220,38,38,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.05) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 85% 0%, rgba(220,38,38,0.18) 0%, transparent 55%), radial-gradient(ellipse at 10% 100%, rgba(249,115,22,0.10) 0%, transparent 55%)",
      }} />
      <CornerBrackets color="#DC2626" size={22} thickness={2} inset={14} />
      <motion.div
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute", top: 0, bottom: 0, width: "40%",
          background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.08), transparent)",
          pointerEvents: "none",
        }}
      />
      <div style={{
        position: "absolute",
        bottom: "clamp(64px, 6vw, 56px)",
        left: "clamp(16px, 4vw, 38px)",
        right: "clamp(16px, 4vw, 38px)",
        maxWidth: 620,
      }}>
        <div style={{ marginBottom: 14 }}>
          <SystemTag color="#DC2626">[ SISTEMA · CARGANDO ]</SystemTag>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[80, 60, 70].map((w, i) => (
            <div key={i} style={{
              height: 22, width: w, borderRadius: 999,
              background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
              backgroundSize: "200% 100%",
              animation: "skel-shimmer 1.6s ease-in-out infinite",
            }} />
          ))}
        </div>
        <div style={{
          height: 38, width: "75%", borderRadius: 8, marginBottom: 14,
          background: "linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
          backgroundSize: "200% 100%",
          animation: "skel-shimmer 1.6s ease-in-out infinite",
        }} />
        <div style={{
          height: 14, width: "90%", borderRadius: 6, marginBottom: 8,
          background: "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          backgroundSize: "200% 100%",
          animation: "skel-shimmer 1.6s ease-in-out infinite",
        }} />
        <div style={{
          height: 14, width: "65%", borderRadius: 6, marginBottom: 24,
          background: "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          backgroundSize: "200% 100%",
          animation: "skel-shimmer 1.6s ease-in-out infinite",
        }} />
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{
            height: 44, width: 150, borderRadius: 30,
            background: "linear-gradient(135deg, rgba(220,38,38,0.4), rgba(153,27,27,0.4))",
            border: "1px solid rgba(220,38,38,0.3)",
          }} />
          <div style={{
            height: 44, width: 120, borderRadius: 30,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
          }} />
        </div>
      </div>
      <style>{`
        @keyframes skel-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

/* ── HERO BANNER (pausable + LCP optimized) ── */
function HeroBanner({ animes, idx, onPrev, onNext, onSetIdx }: { animes: AnimeResult[]; idx: number; onPrev: () => void; onNext: () => void; onSetIdx: (i: number) => void }) {
  const [, navigate] = useLocation();
  const anime = animes[idx];

  // LCP: preload current hero image with high priority
  useEffect(() => {
    if (!anime) return;
    const url = anime.cover || anime.image;
    if (!url) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = url;
    (link as any).fetchPriority = "high";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, [anime?.id]);

  if (!anime) return <div style={{ height: "clamp(440px, 70vw, 580px)", background: "#000" }} />;
  const title = resolveTitle(anime.title);

  return (
    <div className="home-hero" style={{ position: "relative", height: "clamp(440px, 70vw, 580px)", overflow: "hidden" }}>
      <img
        src={anime.cover || anime.image}
        alt={title}
        // @ts-expect-error fetchpriority is valid HTML attribute
        fetchpriority="high"
        decoding="async"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", filter: "saturate(1.03) brightness(0.88)", transition: "opacity 0.6s" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.7) 65%, #000 100%), linear-gradient(180deg, rgba(0,0,0,0.55), transparent 35%)" }} />
      <div style={{ position: "absolute", inset: 0, width: "60%", background: "linear-gradient(270deg, transparent 40%, rgba(0,0,0,0.54) 80%)" }} />
      <ScanLines color="rgba(220,38,38,0.05)" />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 85% 0%, rgba(220,38,38,0.22) 0%, transparent 55%)", pointerEvents: "none", zIndex: 1 }} />
      <CornerBrackets color="#DC2626" size={22} thickness={2} inset={14} />
      <div style={{ position: "absolute", bottom: "clamp(64px, 6vw, 56px)", left: "clamp(16px, 4vw, 38px)", right: "clamp(16px, 4vw, 38px)", maxWidth: 620, zIndex: 2 }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginBottom: 10 }}>
          <SystemTag color="#DC2626">[ SISTEMA · DESTACADO ]</SystemTag>
        </motion.div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span style={{ background: "linear-gradient(135deg, rgba(255,92,122,0.9), rgba(220,38,38,0.85))", backdropFilter: "blur(6px)", borderRadius: 999, padding: "4px 12px", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 1, border: "1px solid rgba(252,165,181,0.35)" }}>✦ DESTACADO</span>
          {anime.status === "Ongoing" && (
            <span style={{ background: "rgba(34,197,94,0.18)", borderRadius: 999, padding: "4px 10px", color: "#86EFAC", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, background: "#22C55E", borderRadius: "50%" }} /> EN EMISIÓN
            </span>
          )}
          {anime.genres?.slice(0, 3).map((g) => (
            <span key={g} style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: 500, border: "1px solid rgba(255,255,255,0.15)" }}>{g}</span>
          ))}
        </div>
        <h1 style={{ color: "#F8FBFF", fontSize: "clamp(24px, 4.2vw, 46px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: -1, margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.85)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</h1>
        <p style={{ maxWidth: 520, color: "rgba(248,251,255,0.74)", fontSize: "clamp(13px, 1.6vw, 15px)", lineHeight: 1.55, margin: "12px 0 0", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{anime.description ? anime.description.replace(/<[^>]+>/g, '').slice(0, 240) : 'Descubre por qué este anime está arrasando entre la comunidad.'}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
          <button onClick={() => nav(navigate, anime.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg, #DC2626, #991B1B)", border: "none", borderRadius: 30, padding: "11px 24px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.25s", boxShadow: "0 4px 20px rgba(220,38,38,0.45)" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(220,38,38,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(220,38,38,0.45)"; }}>
            <Play size={18} fill="#fff" color="#fff" /> Ver Ahora
          </button>
          <button onClick={() => nav(navigate, anime.id)} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 30, padding: "10px 22px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.22s" }}>
            <Info size={16} /> Detalles
          </button>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 18, right: 24, display: "flex", gap: 8, alignItems: "center", zIndex: 3 }}>
        {animes.slice(0, 6).map((_, i) => (
          <button
            key={i}
            onClick={() => onSetIdx(i)}
            aria-label={`Ir al destacado ${i + 1}`}
            style={{ height: 6, borderRadius: 999, background: i === idx ? "#fff" : "rgba(255,255,255,0.3)", width: i === idx ? 24 : 8, transition: "width 0.35s, background 0.35s", border: "none", padding: 0, cursor: "pointer" }}
          />
        ))}
      </div>

      <button onClick={onPrev} aria-label="Anterior" style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)", background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 24, padding: "12px 13px", cursor: "pointer", display: "flex", zIndex: 3 }}>
        <ChevronLeft size={24} color="rgba(255,255,255,0.9)" />
      </button>
      <button onClick={onNext} aria-label="Siguiente" style={{ position: "absolute", top: "50%", right: 16, transform: "translateY(-50%)", background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 24, padding: "12px 13px", cursor: "pointer", display: "flex", zIndex: 3 }}>
        <ChevronRight size={24} color="rgba(255,255,255,0.9)" />
      </button>
    </div>
  );
}

/* ── SECTION HEADER ── */
function SectionHeader({ title, onSeeAll, id, count }: { title: string; onSeeAll?: () => void; id?: string; count?: number }) {
  const m = title.match(/^([^\sA-Za-z0-9]+)\s+(.+)$/u);
  const iconChar = m ? m[1] : null;
  const cleanTitle = m ? m[2] : title;
  return (
    <div id={id} className="home-section-heading">
      <div className="home-section-heading__title">
        {iconChar && <span className="home-section-heading__icon">{iconChar}</span>}
        <div>
          <span className="home-section-heading__eyebrow">Descubre</span>
          <h2>{cleanTitle}{count != null && <small>{count}</small>}</h2>
        </div>
      </div>
      {onSeeAll && (
        <button onClick={onSeeAll} className="home-see-all">
          <span>Ver todo</span><ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}
function SectionSurface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`home-section-surface ${className}`.trim()}>
      <div className="home-section-inner">{children}</div>
    </section>
  );
}

function DesktopSidebar() {
  const [location, navigate] = useLocation();
  const { user, isMegaFan } = useAuth();
  const groups = [
    { label: "Descubrir", items: [
      { label: "Inicio", detail: "Tu selección diaria", href: "/", icon: <HomeIcon size={17} />, accent: "#fb7185" },
      { label: "Explorar", detail: "Busca algo nuevo", href: "/search", icon: <Compass size={17} />, accent: "#a78bfa" },
      { label: "Tendencias", detail: "Lo más visto ahora", href: "/search?q=trending", icon: <TrendingUp size={17} />, accent: "#fb923c", badge: "HOT" },
      { label: "Últimos episodios", detail: "Recién publicados", href: "#recent", icon: <Clock3 size={17} />, accent: "#38bdf8" },
      { label: "Calendario", detail: "Estrenos de la semana", href: "/schedule", icon: <CalendarDays size={17} />, accent: "#4ade80" },
    ] },
    { label: "Tu biblioteca", items: [
      { label: "Mi lista", detail: "Guardados para después", href: "/watchlist", icon: <ListVideo size={17} />, accent: "#f472b6" },
      { label: "Historial", detail: "Vuelve a tus historias", href: "/history", icon: <History size={17} />, accent: "#818cf8" },
      { label: "Ajustes", detail: "Personaliza AnimeFlex", href: "/settings", icon: <Settings size={17} />, accent: "#94a3b8" },
    ] },
  ];
  const go = (href: string) => { if (href.startsWith("#")) document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" }); else navigate(href); };
  return (
    <aside className="home-sidebar" aria-label="Navegación principal">
      <button className="home-sidebar__brand" onClick={() => navigate("/")}>
        <span className="home-sidebar__brand-mark"><b>▶</b><i /></span>
        <span className="home-sidebar__brand-copy"><strong>Anime<em>FLEX</em></strong><small>STREAMING HUB</small></span>
      </button>
      <nav className="home-sidebar__nav">
        {groups.map((group) => <div className="home-sidebar__group" key={group.label}>
          <span className="home-sidebar__group-label">{group.label}</span>
          {group.items.map((item) => {
            const active = item.href === "/" ? location === "/" : !item.href.startsWith("#") && location.startsWith(item.href.split("?")[0]);
            return <button key={item.label} className={active ? "is-active" : ""} style={{ "--nav-accent": item.accent } as React.CSSProperties} onClick={() => go(item.href)}>
              <span className="home-sidebar__nav-icon">{item.icon}</span>
              <span className="home-sidebar__nav-copy"><b>{item.label}</b><small>{item.detail}</small></span>
              {item.badge && <em>{item.badge}</em>}
            </button>;
          })}
        </div>)}
      </nav>
      <div className="home-sidebar__bottom">
        {!isMegaFan && <button className="home-sidebar__membership" onClick={() => navigate("/membership")}>
          <span><Crown size={17} /></span><div><strong>Desbloquea MegaFan</strong><small>Sin límites · más control</small></div><ChevronRight size={15} />
        </button>}
        <button className="home-sidebar__profile" onClick={() => navigate(user ? "/settings" : "/membership")}>
          <span>{user?.avatar_url ? <img src={user.avatar_url} alt="" /> : (user?.username?.[0] || "A").toUpperCase()}</span>
          <div><strong>{user?.username || "Modo invitado"}</strong><small>{isMegaFan ? "Cuenta MegaFan" : user ? "Cuenta gratuita" : "Inicia sesión para sincronizar"}</small></div>
          <ChevronRight size={14} />
        </button>
        <div className="home-sidebar__status"><i /> Catálogo sincronizado <span>LIVE</span></div>
      </div>
    </aside>
  );
}
function WeeklyRanking({ items }: { items: AnimeResult[] }) {
  const [, navigate] = useLocation();
  return (
    <aside className="home-weekly-ranking">
      <div className="home-weekly-ranking__head"><div><span>Esta semana</span><h2>Tendencias</h2></div><TrendingUp size={18} /></div>
      <div className="home-weekly-ranking__list">{items.slice(0, 5).map((anime, index) => { const title = resolveTitle(anime.title); return <button key={anime.id} onClick={() => nav(navigate, anime.id)}><strong>{index + 1}</strong><img src={anime.image} alt="" loading="lazy" /><span><b>{title}</b><small>{anime.genres?.slice(0, 2).join(" · ") || anime.type || "Anime"}</small></span><Star size={11} fill="currentColor" /></button>; })}</div>
    </aside>
  );
}
/* ── CARD HELPERS ── */
function airedEpisodeCount(a: AnimeResult): number | undefined {
  // Prefer the actually-aired count when consumet provides it.
  if (typeof a.currentEpisode === "number" && a.currentEpisode > 0) return a.currentEpisode;
  return a.totalEpisodes;
}

function PortraitCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  const epCount = airedEpisodeCount(anime);
  const isOngoing = anime.status === "Ongoing" || anime.status === "RELEASING";
  return (
    <div className="p-card" onClick={() => nav(navigate, anime.id)}>
      <img src={anime.image} alt={title} loading="lazy" decoding="async" />
      <div className="p-card-grad" />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <span style={{ background: "linear-gradient(135deg,#DC2626,#991B1B)", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>SUB ESP</span>
        {epCount != null && (
          <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>
            {isOngoing ? `EP ${epCount}` : epCount}
          </span>
        )}
        {isOngoing && (
          <span style={{ background: "rgba(34,197,94,0.85)", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.4 }}>LIVE</span>
        )}
      </div>
      {anime.rating != null && anime.rating > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2 }}>
          <Star size={8} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 8, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
        </div>
      )}
      <div className="p-card-footer">
        <div className="p-card-title">{title}</div>
        {anime.type && <div className="p-card-type">{anime.type}</div>}
      </div>
    </div>
  );
}

function FeaturedCard({ item }: { item: FeaturedItem }) {
  const [, navigate] = useLocation();
  return (
    <div className="p-card" onClick={() => nav(navigate, item.anime_id)} style={{ borderColor: "rgba(245,158,11,0.4)" }}>
      <img src={item.anime_image} alt={item.anime_title} loading="lazy" decoding="async" />
      <div className="p-card-grad" />
      <div style={{ position: "absolute", top: 8, left: 8 }}>
        <span style={{ background: "linear-gradient(135deg,#F59E0B,#D97706)", borderRadius: 4, padding: "2px 7px", color: "#fff", fontSize: 8, fontWeight: 900, letterSpacing: 0.5, display: "flex", alignItems: "center", gap: 3 }}>
          ✦ STAFF
        </span>
      </div>
      <div className="p-card-footer">
        <div className="p-card-title">{item.anime_title}</div>
      </div>
    </div>
  );
}

/* ── RECENT CARD with timestamp ── */
function timeSince(date?: string | number): string | null {
  if (!date) return null;
  const t = typeof date === "number" ? date : new Date(date).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return null;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d}d`;
  return null;
}

function RecentCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  const ago = timeSince(anime.releaseDate);
  return (
    <div className="r-card" onClick={() => nav(navigate, anime.id)}>
      <img src={anime.cover || anime.image} alt={title} loading="lazy" decoding="async" />
      <div className="r-card-grad" />
      <div className="r-play-circle"><Play size={18} color="#fff" fill="#fff" /></div>
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 5 }}>
        <span style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", borderRadius: 6, padding: "3px 6px", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", gap: 3 }}>
          <Tv size={9} color="#fff" /> EP {anime.currentEpisode ?? "?"}
        </span>
        <span style={{ background: "rgba(255,255,255,0.9)", borderRadius: 5, padding: "2px 5px", color: "#000", fontSize: 8, fontWeight: 700 }}>HD</span>
        {ago && (
          <span style={{ background: "rgba(34,197,94,0.85)", borderRadius: 5, padding: "2px 5px", color: "#fff", fontSize: 8, fontWeight: 700 }}>{ago}</span>
        )}
      </div>
      <div className="r-card-footer">
        <div className="r-card-title">{title}</div>
        {anime.type && <div className="r-card-type">{anime.type}</div>}
      </div>
    </div>
  );
}

function SeasonalCard({ anime }: { anime: SeasonAnime }) {
  const [, navigate] = useLocation();
  const title = anime.title.english || anime.title.romaji;
  const isAiring = anime.status === "RELEASING";
  return (
    <div className="p-card" onClick={() => nav(navigate, anime.id)}>
      <img src={anime.coverImage.large} alt={title} loading="lazy" decoding="async" />
      <div className="p-card-grad" />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <span style={{ background: isAiring ? "rgba(34,197,94,0.85)" : "rgba(255,255,255,0.9)", borderRadius: 4, padding: "2px 6px", color: isAiring ? "#fff" : "#000", fontSize: 7, fontWeight: 700 }}>
          {isAiring ? "EN VIVO" : "NEW"}
        </span>
        {anime.episodes && (
          <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>
            {isAiring ? "?" : anime.episodes}
          </span>
        )}
      </div>
      {anime.averageScore != null && anime.averageScore > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 2 }}>
          <Star size={8} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 8, fontWeight: 800 }}>{(anime.averageScore / 10).toFixed(1)}</span>
        </div>
      )}
      <div className="p-card-footer">
        <div className="p-card-title">{title}</div>
        {anime.format && <div className="p-card-type">{anime.format}</div>}
      </div>
    </div>
  );
}

const RANK_COLORS: Record<number, string> = {
  1: "linear-gradient(135deg, #FBBF24, #F59E0B)",
  2: "linear-gradient(135deg, #94A3B8, #CBD5E1)",
  3: "linear-gradient(135deg, #D97706, #B45309)",
};

function TopAnimeRow({ anime, rank }: { anime: AnimeResult; rank: number }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div className="home-top-anime-row" onClick={() => nav(navigate, anime.id)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", borderRadius: 8, transition: "background 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <span style={{ background: RANK_COLORS[rank] ?? "none", WebkitBackgroundClip: RANK_COLORS[rank] ? "text" : undefined, WebkitTextFillColor: RANK_COLORS[rank] ? "transparent" : undefined, backgroundClip: RANK_COLORS[rank] ? "text" : undefined, color: RANK_COLORS[rank] ? undefined : "rgba(255,255,255,0.2)", fontSize: 19, fontWeight: 900, width: 32, textAlign: "center", flexShrink: 0 }}>{String(rank).padStart(2, "0")}</span>
      <img src={anime.image} alt={title} loading="lazy" decoding="async" style={{ width: 48, height: 66, borderRadius: 8, objectFit: "cover", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, lineHeight: 1.35 }} className="line-clamp-2">{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {anime.type && <span style={{ color: "#d1d5db", fontSize: 9, fontWeight: 600, background: "rgba(255,255,255,0.1)", padding: "1px 6px", borderRadius: 4 }}>{anime.type}</span>}
          {anime.releaseDate && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{anime.releaseDate}</span>}
        </div>
        {anime.genres && anime.genres.length > 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }} className="line-clamp-1">{anime.genres.slice(0, 2).join(" · ")}</div>}
      </div>
      {anime.rating != null && anime.rating > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <Star size={11} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 12, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}

/* ── SCHEDULE ── */
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function ScheduleSection() {
  const [, navigate] = useLocation();
  const todayIdx = new Date().getDay();
  const [activeDay, setActiveDay] = useState(todayIdx);
  const { getStatus } = useWatchList();

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ["airingSchedule"],
    queryFn: fetchAiringSchedule,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const grouped = DAY_NAMES.map((_, i) => schedule.filter((e) => new Date(e.airingAt * 1000).getDay() === i));
  const dayEntries = grouped[activeDay] ?? [];
  const todayInWatchlistCount = grouped[todayIdx].filter((e) => getStatus(String(e.media.id))).length;

  return (
    <div style={{ marginTop: 12 }}>
      <SectionHeader id="schedule" title="📅 Calendario de Emisión" onSeeAll={() => navigate("/schedule")} />
      {todayInWatchlistCount > 0 && (
        <div style={{ padding: "0 18px", marginBottom: 10 }}>
          <span style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.35)", borderRadius: 16, padding: "5px 10px", color: "#FCA5A5", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <BookmarkCheck size={11} /> {todayInWatchlistCount} de tu lista emite hoy
          </span>
        </div>
      )}
      <div style={{ display: "flex", gap: 7, paddingLeft: 18, paddingRight: 18, marginBottom: 14, overflowX: "auto" }}>
        {DAY_NAMES.map((d, i) => {
          const isToday = i === todayIdx;
          const isActive = i === activeDay;
          return (
            <button key={i} onClick={() => setActiveDay(i)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 22, border: `1px solid ${isActive ? "#fff" : "rgba(255,255,255,0.1)"}`, background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, cursor: "pointer", position: "relative", transition: "all 0.18s" }}>
              {d}
              {isToday && <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: "50%", background: "#22C55E", border: "1.5px solid #000", boxShadow: "0 0 6px #22C55E" }} />}
            </button>
          );
        })}
      </div>
      {isLoading && (
        <ScrollableCarousel>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ width: 130, height: 197, borderRadius: 14, background: "#111", flexShrink: 0, border: "1px solid #222" }} />)}
        </ScrollableCarousel>
      )}
      {!isLoading && dayEntries.length === 0 && (
        <div style={{ padding: "24px 18px", color: "rgba(255,255,255,0.28)", fontSize: 13, textAlign: "center" }}>
          Sin episodios programados para {DAY_NAMES_FULL[activeDay]}
        </div>
      )}
      {dayEntries.length > 0 && (
        <ScrollableCarousel>
          {dayEntries.slice(0, 15).map((entry) => {
            const title = entry.media.title.english || entry.media.title.romaji;
            const time = new Date(entry.airingAt * 1000).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
            const inList = !!getStatus(String(entry.media.id));
            return (
              <div key={`${entry.media.id}-${entry.episode}`} onClick={() => nav(navigate, entry.media.id)}
                style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", border: `1px solid ${inList ? "rgba(220,38,38,0.45)" : "#222"}`, cursor: "pointer", width: 130, height: 197, flexShrink: 0, transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px) scale(1.02)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}>
                <img src={entry.media.coverImage.large} alt={title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 42%, rgba(0,0,0,0.97) 100%)" }} />
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", borderRadius: 6, padding: "3px 7px", color: "#fff", fontSize: 9, fontWeight: 700 }}>EP {entry.episode}</div>
                <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 6, padding: "3px 7px", color: "#F59E0B", fontSize: 9, fontWeight: 800 }}>{time}</div>
                {inList && (
                  <div style={{ position: "absolute", top: 32, left: 8, background: "rgba(220,38,38,0.92)", borderRadius: 6, padding: "2px 6px", color: "#fff", fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", gap: 3 }}>
                    <BookmarkCheck size={8} /> EN MI LISTA
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 10 }}>
                  <div style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>{title}</div>
                  {entry.media.format && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, marginTop: 2 }}>{entry.media.format}</div>}
                </div>
              </div>
            );
          })}
        </ScrollableCarousel>
      )}
    </div>
  );
}

/* ── GENRES ── */
const GENRES = [
  { label: "Acción", query: "Action", icon: "⚔️", accent: "#EF4444", glow: "239,68,68" },
  { label: "Aventura", query: "Adventure", icon: "🗺️", accent: "#F97316", glow: "249,115,22" },
  { label: "Comedia", query: "Comedy", icon: "😂", accent: "#EAB308", glow: "234,179,8" },
  { label: "Drama", query: "Drama", icon: "🎭", accent: "#A855F7", glow: "168,85,247" },
  { label: "Fantasía", query: "Fantasy", icon: "✨", accent: "#8B5CF6", glow: "139,92,246" },
  { label: "Terror", query: "Horror", icon: "💀", accent: "#DC2626", glow: "220,38,38" },
  { label: "Romance", query: "Romance", icon: "💖", accent: "#EC4899", glow: "236,72,153" },
  { label: "Sci-Fi", query: "Sci-Fi", icon: "🚀", accent: "#06B6D4", glow: "6,182,212" },
  { label: "Shounen", query: "Shounen", icon: "💪", accent: "#F59E0B", glow: "245,158,11" },
  { label: "Isekai", query: "Isekai", icon: "🌀", accent: "#3B82F6", glow: "59,130,246" },
  { label: "Thriller", query: "Thriller", icon: "🔪", accent: "#64748B", glow: "100,116,139" },
  { label: "Misterio", query: "Mystery", icon: "🔍", accent: "#6366F1", glow: "99,102,241" },
];

function GenresSection() {
  const [, navigate] = useLocation();
  return (
    <>
      <div className="genres-grid">
        {GENRES.map((g) => (
          <button key={g.label} onClick={() => navigate(`/search?q=${g.query}`)} className="genre-tile" style={{ ["--accent" as any]: g.accent, ["--glow" as any]: g.glow }}>
            <span className="genre-tile__corner genre-tile__corner--tl" />
            <span className="genre-tile__corner genre-tile__corner--br" />
            <span className="genre-tile__icon">{g.icon}</span>
            <span className="genre-tile__label">{g.label}</span>
            <span className="genre-tile__arrow">›</span>
          </button>
        ))}
      </div>
      <style>{`
        .genres-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; padding: 4px 18px 6px; }
        @media (max-width: 480px) { .genres-grid { grid-template-columns: repeat(2, 1fr); gap: 9px; padding: 4px 14px 6px; } }
        .genre-tile { position: relative; display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 12px; background: linear-gradient(145deg, rgba(15,17,28,0.92), rgba(8,9,18,0.92)); border: 1px solid rgba(var(--glow), 0.22); color: #fff; font-size: 13.5px; font-weight: 600; font-family: inherit; cursor: pointer; text-align: left; transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.22s ease, background 0.18s ease; overflow: hidden; }
        .genre-tile::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 20% 0%, rgba(var(--glow), 0.18), transparent 60%); opacity: 0.55; pointer-events: none; transition: opacity 0.22s ease; }
        .genre-tile:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: 0 10px 26px rgba(var(--glow), 0.28), inset 0 0 0 1px rgba(var(--glow), 0.18); background: linear-gradient(145deg, rgba(20,22,34,0.95), rgba(10,12,22,0.95)); }
        .genre-tile:hover::before { opacity: 1; }
        .genre-tile:active { transform: translateY(0); }
        .genre-tile__icon { position: relative; width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; background: linear-gradient(135deg, rgba(var(--glow), 0.22), rgba(var(--glow), 0.06)); border: 1px solid rgba(var(--glow), 0.32); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06); flex-shrink: 0; }
        .genre-tile__label { position: relative; flex: 1; letter-spacing: 0.2px; text-shadow: 0 1px 0 rgba(0,0,0,0.4); }
        .genre-tile__arrow { position: relative; color: rgba(var(--glow), 0.7); font-size: 18px; line-height: 1; font-weight: 400; transform: translateX(-4px); opacity: 0; transition: transform 0.22s ease, opacity 0.22s ease; }
        .genre-tile:hover .genre-tile__arrow { transform: translateX(0); opacity: 1; }
        .genre-tile__corner { position: absolute; width: 8px; height: 8px; border-color: var(--accent); border-style: solid; opacity: 0.65; pointer-events: none; }
        .genre-tile__corner--tl { top: 4px; left: 4px; border-width: 1px 0 0 1px; border-top-left-radius: 2px; }
        .genre-tile__corner--br { bottom: 4px; right: 4px; border-width: 0 1px 1px 0; border-bottom-right-radius: 2px; }
      `}</style>
    </>
  );
}

/* ── CONTINUE WATCHING ── */
type WatchEntry = ReturnType<typeof useWatchProgress>["progress"][number];

function ContinueWatchingCard({ entry, onRemove }: { entry: WatchEntry; onRemove: () => void }) {
  const [, navigate] = useLocation();
  const pct = Math.min(1, entry.currentTime / Math.max(entry.duration, 1));
  const handleClick = () => {
    const p = new URLSearchParams({ episodeId: entry.episodeId, episodeNum: String(entry.episodeNum), animeTitle: entry.animeTitle, animeId: entry.animeId, animeImage: entry.animeImage });
    navigate(`/watch?${p.toString()}`);
  };
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };
  return (
    <div className="cw-card" onClick={handleClick} style={{ position: "relative" }}>
      <img src={entry.animeImage} alt={entry.animeTitle} loading="lazy" decoding="async" />
      <div className="cw-card-grad" />
      <button
        onClick={handleRemove}
        aria-label="Quitar de continuar viendo"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.78)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.85)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          zIndex: 4,
          opacity: 0,
          transition: "opacity 0.18s, background 0.18s",
        }}
        className="cw-remove"
      >
        <X size={13} />
      </button>
      <div className="cw-card-info">
        <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }} className="line-clamp-1">{entry.animeTitle}</div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>Episodio {entry.episodeNum}</span>
          {entry.duration > 0 && pct > 0 && (
            <span style={{ color: "#FCA5A5", fontWeight: 700 }}>{Math.round(pct * 100)}%</span>
          )}
        </div>
        <div className="cw-bar"><div className="cw-fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
      </div>
      <style>{`.cw-card:hover .cw-remove { opacity: 1; } .cw-card .cw-remove:hover { background: rgba(220,38,38,0.85); color: #fff; }`}</style>
    </div>
  );
}

function SectionDivider() {
  return <div className="home-section-divider" />;
}

function SkeletonP() { return <div className="skeleton" style={{ width: 130, height: 197, borderRadius: 8, flexShrink: 0, border: "1px solid #222" }} />; }
function SkeletonR() { return <div className="skeleton" style={{ width: 220, height: 136, borderRadius: 8, flexShrink: 0, border: "1px solid #222" }} />; }

/* ── MAIN ── */
export default function Home() {
  const [, navigate] = useLocation();
  const [heroIdx, setHeroIdx] = useState(0);
  const { progress: watchProgress, removeProgress } = useWatchProgress();
  const { user } = useAuth();

  const trending = useQuery({ queryKey: ["trending"], queryFn: consumet.trending, staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 });
  const popular = useQuery({ queryKey: ["popular"], queryFn: consumet.popular, staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 });
  const recent = useQuery({ queryKey: ["recent"], queryFn: consumet.recentEpisodes, staleTime: 1000 * 60 * 8, gcTime: 1000 * 60 * 30 });
  const { season, year } = getCurrentSeason();
  const seasonal = useQuery({ queryKey: ["seasonal", season, year], queryFn: fetchSeasonalAnime, staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 120, retry: 1 });

  const featured = useQuery({
    queryKey: ["featured-content"],
    queryFn: () => apiClient.get<{ items: FeaturedItem[] }>("/featured-content"),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 0,
  });
  const featuredList = featured.data?.items ?? [];

  const trendList = trending.data?.results ?? [];
  const popularList = popular.data?.results ?? [];
  const recentList = recent.data?.results ?? [];
  const seasonalList = seasonal.data ?? [];

  // SEO meta tags + JSON-LD structured data for rich snippets.
  const heroTitle = trendList[heroIdx] ? resolveTitle(trendList[heroIdx].title) : "";
  const homeJsonLd = useMemo(() => ([
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "AnimeFlex",
      "url": "https://animeflex.lat/",
      "inLanguage": "es",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://animeflex.lat/search?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "AnimeFlex",
      "url": "https://animeflex.lat/",
      "logo": "https://animeflex.lat/icon-512.png",
    },
  ]), []);
  usePageMeta({
    title: "AnimeFlex — Anime online sub español, manga y noticias",
    description: "Mira anime online gratis con subtítulos en español. Tendencias, calendario de emisión, últimos episodios, mangas al día y novedades del mundo anime.",
    image: trendList[heroIdx]?.cover || trendList[heroIdx]?.image,
    jsonLd: homeJsonLd,
  });

  const prevHero = useCallback(() => setHeroIdx(i => (i > 0 ? i - 1 : Math.max(0, trendList.length - 1))), [trendList.length]);
  const nextHero = useCallback(() => setHeroIdx(i => (i < trendList.length - 1 ? i + 1 : 0)), [trendList.length]);

  // Hero auto-rotate: pause when tab hidden or user prefers reduced motion
  useEffect(() => {
    if (trendList.length === 0) return;
    const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let timer: number | null = null;
    const start = () => {
      if (timer != null) return;
      timer = window.setInterval(nextHero, 6000);
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [trendList.length, nextHero]);

  const cwItems = watchProgress
    .filter((e, idx, arr) => arr.findIndex((x) => x.animeId === e.animeId) === idx)
    .slice(0, 8);

  const handleJump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="home-page" style={{ minHeight: "100vh" }}>
      <DesktopSidebar />
      <Navbar />
      <div className="home-workspace">
      <div className="home-main" style={{ paddingTop: 56 }}>
        <div className="home-dashboard-intro">
          <div className="home-dashboard-intro__copy">
            <span><i /> Para ti · actualizado ahora</span>
            <h1>Tu próxima historia empieza aquí.</h1>
            <p>Una selección viva de estrenos, clásicos y mundos que vale la pena descubrir.</p>
          </div>
          <button className="home-command-search" onClick={() => navigate("/search")}><span className="home-command-search__icon"><Search size={17} /></span><span><b>Busca en AnimeFlex</b><small>Anime, género, estudio o personaje</small></span><kbd>CTRL K</kbd></button>
        </div>
        <div className="home-top-grid">
          {trendList.length > 0
            ? <HeroBanner animes={trendList} idx={heroIdx} onPrev={prevHero} onNext={nextHero} onSetIdx={setHeroIdx} />
            : <HeroSkeleton />}
          <WeeklyRanking items={popularList.length ? popularList : trendList} />
        </div>

        {/* Watchlist new episodes banner — top priority for logged-in users */}
        <WatchlistNewEpisodesBanner />

        {/* Quick filters / section jump chips */}
        <div className="home-quick-filters"><QuickFilters onJump={handleJump} /></div>

        {/* Continue watching */}
        {cwItems.length > 0 && (
          <SectionSurface className="home-continue-section">
            <SectionHeader id="continue" title="▶ Continuar viendo" onSeeAll={() => navigate("/history")} />
            <div className="home-continue-layout">
              <div className="home-continue-rail">
                <ScrollableCarousel scrollAmount={460}>
                  {cwItems.map((e) => (
                    <ContinueWatchingCard key={`cw-${e.episodeId}`} entry={e} onRemove={() => removeProgress(e.episodeId)} />
                  ))}
                </ScrollableCarousel>
              </div>
              <aside className="home-continue-summary">
                <span><Play size={19} fill="currentColor" /></span>
                <div><strong>Retoma justo donde lo dejaste</strong><small>Tu progreso se guarda automáticamente en este dispositivo.</small></div>
                <button onClick={() => navigate("/history")} aria-label="Ver historial"><ChevronRight size={16} /></button>
              </aside>
            </div>
          </SectionSurface>
        )}

        <SectionDivider />

        {/* Trending */}
        <SectionSurface>
          <SectionHeader id="trending" title="🔥 Tendencias" onSeeAll={() => navigate("/search?q=trending")} />
          <ScrollableCarousel>
            {trending.isLoading ? Array.from({ length: 8 }).map((_, i) => <SkeletonP key={i} />) : trendList.slice(0, 14).map((a) => <PortraitCard key={`t-${a.id}`} anime={a} />)}
          </ScrollableCarousel>
        </SectionSurface>

        {/* Featured by admin staff */}
        {featuredList.length > 0 && (
          <>
            <SectionDivider />
            <SectionSurface>
              <SectionHeader id="featured" title="✦ Selección AnimeFlex" />
              <ScrollableCarousel>
                {featuredList.map((f) => <FeaturedCard key={`f-${f.id}`} item={f} />)}
              </ScrollableCarousel>
            </SectionSurface>
          </>
        )}

        {/* Schedule — moved up so users see "what's airing today" early */}
        <LazySection>
          <SectionSurface>
            <ScheduleSection />
          </SectionSurface>
        </LazySection>

        <SectionDivider />

        {/* Seasonal */}
        <LazySection>
          <SectionSurface>
            <SectionHeader id="seasonal" title={`🌸 Temporada — ${seasonLabel(season)} ${year}`} />
            <ScrollableCarousel>
              {seasonal.isLoading ? Array.from({ length: 8 }).map((_, i) => <SkeletonP key={i} />) : seasonalList.map((a) => <SeasonalCard key={`s-${a.id}`} anime={a} />)}
            </ScrollableCarousel>
          </SectionSurface>
        </LazySection>

        {/* Episode counter for free users (hidden for MegaFan) */}
        <div style={{ padding: "0 18px", marginTop: 20 }}>
          <AdBanner variant="horizontal" />
        </div>

        <SectionDivider />

        {/* Latest episodes */}
        <LazySection>
          <SectionSurface>
            <SectionHeader id="recent" title="⚡ Últimos Episodios" />
            <ScrollableCarousel scrollAmount={660}>
              {recent.isLoading ? Array.from({ length: 5 }).map((_, i) => <SkeletonR key={i} />) : recentList.slice(0, 12).map((a) => <RecentCard key={`r-${a.id}`} anime={a} />)}
            </ScrollableCarousel>
          </SectionSurface>
        </LazySection>

        <SectionDivider />

        {/* Most popular */}
        <LazySection>
          <SectionSurface>
            <SectionHeader id="popular" title="⭐ Más Populares" />
            <ScrollableCarousel>
              {popular.isLoading ? Array.from({ length: 8 }).map((_, i) => <SkeletonP key={i} />) : popularList.slice(0, 14).map((a) => <PortraitCard key={`p-${a.id}`} anime={a} />)}
            </ScrollableCarousel>
          </SectionSurface>
        </LazySection>

        {/* Recommendations */}
        <LazySection minHeight={200}>
          {user ? (
            <div className="home-contained" style={{ marginTop: 28 }}>
              <AnimeRecommendations userId={user.id} type="personal" limit={14} />
            </div>
          ) : (
            <div className="home-contained" style={{ marginTop: 28 }}>
              <AnimeRecommendations type="trending" title="Recomendaciones para ti" limit={14} />
            </div>
          )}
        </LazySection>

        <SectionDivider />

        {/* News preview */}
        <LazySection minHeight={220}>
          <div className="home-contained"><NewsPreview /></div>
        </LazySection>

        <SectionDivider />

        {/* Active discussions — community */}
        <LazySection minHeight={180}>
          <div className="home-contained"><ActiveDiscussions /></div>
        </LazySection>

        <SectionDivider />

        {/* Top 10 */}
        <LazySection>
          <SectionSurface>
            <SectionHeader id="top" title="🏆 Top Anime" />
            <div className="home-ranking-grid">
              {popular.isLoading
                ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 72, background: "#111", borderRadius: 8, marginBottom: 4, border: "1px solid #222" }} />)
                : popularList.slice(0, 10).map((a, i) => <TopAnimeRow key={`top-${a.id}`} anime={a} rank={i + 1} />)}
            </div>
          </SectionSurface>
        </LazySection>

        <SectionDivider />

        {/* Manga banner with recent chapters */}
        <LazySection minHeight={120}>
          <div className="home-contained">
            <MangaRecentBanner />
          </div>
        </LazySection>

        <SectionDivider />

        {/* Genres */}
        <LazySection minHeight={120}>
          <SectionSurface>
            <SectionHeader id="genres" title="🎭 Géneros" />
            <GenresSection />
          </SectionSurface>
          <div style={{ marginBottom: 24 }} />
        </LazySection>

      </div>
      <Footer />
    </div>
    </div>
  );
}
