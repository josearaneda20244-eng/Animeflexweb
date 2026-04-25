import { useQuery } from "@tanstack/react-query";
  import { useLocation } from "wouter";
  import { motion } from "framer-motion";
  import { CornerBrackets, SystemTag, ScanLines } from "@/components/SystemUI";
  import { Play, Info, Star, ChevronLeft, ChevronRight, Tv } from "lucide-react";
  import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
  import { fetchAiringSchedule, fetchSeasonalAnime, getCurrentSeason, seasonLabel, type AiringEntry, type SeasonAnime } from "@/lib/anilist";
  import { useWatchProgress } from "@/context/WatchProgressContext";
  import { useAuth } from "@/context/AuthContext";
  import AnimeRecommendations from "@/components/AnimeRecommendations";
  import { useCallback, useState, useEffect, useRef, useMemo } from "react";
  import Navbar from "@/components/Navbar";
  import Footer from "@/components/Footer";
  import AdBanner from "@/components/AdBanner";
  import { SkeletonRow } from "@/components/SkeletonCard";


  /* ── LAZY SECTION (only mount when near viewport) ──
     Margin grande para que en scroll rápido (sobre todo móvil) las
     secciones se monten muy por adelantado y no se vean en blanco. */
  function useLazySection(rootMargin?: string) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    const margin = useMemo(() => {
      if (rootMargin) return rootMargin;
      if (typeof window === "undefined") return "1200px";
      // En móvil pre-cargamos aún más porque el scroll es muy rápido.
      return window.matchMedia("(max-width: 768px)").matches ? "1800px" : "1200px";
    }, [rootMargin]);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      // Fallback: si el navegador no soporta IntersectionObserver, mostramos contenido inmediato.
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
      [side]: side === "left" ? 6 : 6,
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
      <div style={{ position: "relative" }}
        onMouseEnter={update}
        onMouseLeave={() => {}}>
        {/* Left arrow */}
        <button
          onClick={() => scroll(-1)}
          className="carousel-arrow"
          style={ARROW_STYLE(canLeft, "left")}
          onMouseEnter={e => { if (canLeft) { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.8)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}>
          <ChevronLeft size={20} color="#fff" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scroll(1)}
          className="carousel-arrow"
          style={ARROW_STYLE(canRight, "right")}
          onMouseEnter={e => { if (canRight) { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.8)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}>
          <ChevronRight size={20} color="#fff" />
        </button>

        {/* Carousel scroll container */}
        <div
          ref={ref}
          className="carousel-scroll"
          onScroll={update}>
          {children}
        </div>

        {/* Left fade mask */}
        {canLeft && (
          <div style={{
            position: "absolute", top: 0, left: 0, width: 60, height: "100%", pointerEvents: "none",
            background: "linear-gradient(to right, #000, transparent)"
          }} />
        )}
        {/* Right fade mask */}
        {canRight && (
          <div style={{
            position: "absolute", top: 0, right: 0, width: 60, height: "100%", pointerEvents: "none",
            background: "linear-gradient(to left, #000, transparent)"
          }} />
        )}
      </div>
    );
  }

  /* ── HERO BANNER ── */
  function HeroBanner({ animes, idx, onPrev, onNext }: { animes: AnimeResult[]; idx: number; onPrev: () => void; onNext: () => void }) {
    const [, navigate] = useLocation();
    const anime = animes[idx];
    if (!anime) return <div style={{ height: "min(70vw, 540px)", background: "#000" }} />;
    const title = resolveTitle(anime.title);

    return (
      <div style={{ position: "relative", height: "min(70vw, 580px)", overflow: "hidden", margin: "0" }}>
        <img src={anime.cover || anime.image} alt={title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", filter: "saturate(1.03) brightness(0.88)", transition: "opacity 0.6s" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.7) 65%, #000 100%), linear-gradient(180deg, rgba(0,0,0,0.55), transparent 35%)" }} />
        <div style={{ position: "absolute", inset: 0, width: "60%", background: "linear-gradient(270deg, transparent 40%, rgba(0,0,0,0.54) 80%)" }} />
        {/* SL system frame: scanlines + corner brackets + crimson vignette */}
        <ScanLines color="rgba(220,38,38,0.05)" />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 85% 0%, rgba(220,38,38,0.22) 0%, transparent 55%)", pointerEvents: "none", zIndex: 1 }} />
        <CornerBrackets color="#DC2626" size={22} thickness={2} inset={14} />
        <div style={{ position: "absolute", bottom: "clamp(20px, 5vw, 38px)", left: "clamp(16px, 4vw, 38px)", right: "clamp(16px, 4vw, 38px)", maxWidth: 620, zIndex: 2 }}>
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              style={{ marginBottom: 10 }}
            >
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
          <h1 style={{ color: "#F8FBFF", fontSize: "clamp(28px, 4.2vw, 46px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -1, margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.85)" }}>{title}</h1>
          <p style={{ maxWidth: 520, color: "rgba(248,251,255,0.74)", fontSize: 15, lineHeight: 1.8, margin: "16px 0 0" }}>{anime.description ? anime.description.replace(/<[^>]+>/g, '').slice(0, 140) + '…' : 'Descubre por qué este anime está arrasando entre la comunidad.'}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
            <button onClick={() => nav(navigate, anime.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg, #DC2626, #991B1B)", border: "none", borderRadius: 30, padding: "11px 24px", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.25s", boxShadow: "0 4px 20px rgba(220,38,38,0.45)" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(220,38,38,0.6)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(220,38,38,0.45)"; }}>
              <Play size={18} fill="#fff" color="#fff" /> Ver Ahora
            </button>
            <button onClick={() => nav(navigate, anime.id)} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 30, padding: "10px 22px", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", transition: "all 0.22s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}>
              <Info size={16} /> Detalles
            </button>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 18, right: 24, display: "flex", gap: 8, alignItems: "center" }}>
          {animes.slice(0, 6).map((_, i) => (
            <div key={i} style={{ height: 6, borderRadius: 999, background: i === idx ? "#fff" : "rgba(255,255,255,0.3)", width: i === idx ? 24 : 8, transition: "width 0.35s, background 0.35s", boxShadow: "none" }} />
          ))}
        </div>

        <button onClick={onPrev} style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)", background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 24, padding: "12px 13px", cursor: "pointer", display: "flex", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.75)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}>
          <ChevronLeft size={24} color="rgba(255,255,255,0.9)" />
        </button>
        <button onClick={onNext} style={{ position: "absolute", top: "50%", right: 16, transform: "translateY(-50%)", background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 24, padding: "12px 13px", cursor: "pointer", display: "flex", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,0,0,0.75)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}>
          <ChevronRight size={24} color="rgba(255,255,255,0.9)" />
        </button>
      </div>
    );
  }

  /* ── SECTION HEADER ── */
  function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{ width: 4, height: 22, borderRadius: 4, background: "linear-gradient(180deg, #DC2626, #991B1B)", flexShrink: 0, boxShadow: "0 0 14px rgba(220,38,38,0.55)" }} />
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#FF6680", letterSpacing: 2, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", textTransform: "uppercase", lineHeight: 1, marginBottom: 3 }}>[ SISTEMA ]</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.3, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
          </div>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.22)", borderRadius: 20, color: "#FECACA", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(220,38,38,0.16)"; e.currentTarget.style.borderColor = "rgba(220,38,38,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(220,38,38,0.08)"; e.currentTarget.style.borderColor = "rgba(220,38,38,0.22)"; }}>
            <span>Ver todo</span>
            <ChevronRight size={13} color="#FECACA" />
          </button>
        )}
      </div>
    );
  }

  function SectionSurface({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ margin: "12px 0", padding: "24px 0 28px", background: "linear-gradient(180deg, rgba(8,8,14,0.95) 0%, #000 100%)" }}>
        {children}
      </div>
    );
  }

  /* ── PORTRAIT CARD ── */
  function PortraitCard({ anime }: { anime: AnimeResult }) {
    const [, navigate] = useLocation();
    const title = resolveTitle(anime.title);
    return (
      <div className="p-card" onClick={() => nav(navigate, anime.id)}>
        <img src={anime.image} alt={title} loading="lazy" decoding="async" />
        <div className="p-card-grad" />
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          <span style={{ background: "linear-gradient(135deg,#DC2626,#991B1B)", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>SUB ESP</span>
          {anime.totalEpisodes && <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>{anime.totalEpisodes}</span>}
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

  /* ── RECENT CARD ── */
  function RecentCard({ anime }: { anime: AnimeResult }) {
    const [, navigate] = useLocation();
    const title = resolveTitle(anime.title);
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
        </div>
        <div className="r-card-footer">
          <div className="r-card-title">{title}</div>
          {anime.type && <div className="r-card-type">{anime.type}</div>}
        </div>
      </div>
    );
  }

  /* ── SEASONAL CARD ── */
  function SeasonalCard({ anime }: { anime: SeasonAnime }) {
    const [, navigate] = useLocation();
    const title = anime.title.english || anime.title.romaji;
    return (
      <div className="p-card" onClick={() => nav(navigate, anime.id)}>
        <img src={anime.coverImage.large} alt={title} loading="lazy" decoding="async" />
        <div className="p-card-grad" />
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          <span style={{ background: "rgba(255,255,255,0.9)", borderRadius: 4, padding: "2px 6px", color: "#000", fontSize: 7, fontWeight: 700 }}>NEW</span>
          {anime.episodes && <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>{anime.episodes}</span>}
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

  /* ── TOP ANIME ROW ── */
  const RANK_COLORS: Record<number, string> = {
    1: "linear-gradient(135deg, #FBBF24, #F59E0B)",
    2: "linear-gradient(135deg, #94A3B8, #CBD5E1)",
    3: "linear-gradient(135deg, #D97706, #B45309)",
  };

  function TopAnimeRow({ anime, rank }: { anime: AnimeResult; rank: number }) {
    const [, navigate] = useLocation();
    const title = resolveTitle(anime.title);
    return (
      <div onClick={() => nav(navigate, anime.id)}
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

  /* ── SCHEDULE SECTION ── */
  const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  function ScheduleSection() {
    const [, navigate] = useLocation();
    const todayIdx = new Date().getDay();
    const [activeDay, setActiveDay] = useState(todayIdx);

    const { data: schedule = [], isLoading } = useQuery({
      queryKey: ["airingSchedule"],
      queryFn: fetchAiringSchedule,
      staleTime: 1000 * 60 * 30,
      retry: 1,
    });

    const grouped = DAY_NAMES.map((_, i) => schedule.filter((e) => new Date(e.airingAt * 1000).getDay() === i));
    const dayEntries = grouped[activeDay] ?? [];

    return (
      <div style={{ marginTop: 32 }}>
        <SectionHeader title="📅 Calendario de Emisión" />
        <div style={{ display: "flex", gap: 7, paddingLeft: 18, paddingRight: 18, marginBottom: 14, overflowX: "auto" }}>
          {DAY_NAMES.map((d, i) => {
            const isToday = i === todayIdx;
            const isActive = i === activeDay;
            return (
              <button key={i} onClick={() => setActiveDay(i)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 22, border: `1px solid ${isActive ? "#fff" : "rgba(255,255,255,0.1)"}`, background: isActive ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)", color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500, cursor: "pointer", position: "relative", boxShadow: "none", transition: "all 0.18s" }}>
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
              return (
                <div key={`${entry.media.id}-${entry.episode}`} onClick={() => nav(navigate, entry.media.id)}
                  style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", border: "1px solid #222", cursor: "pointer", width: 130, height: 197, flexShrink: 0, transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px) scale(1.02)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.4)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}>
                  <img src={entry.media.coverImage.large} alt={title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 42%, rgba(0,0,0,0.97) 100%)" }} />
                  <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)", borderRadius: 6, padding: "3px 7px", color: "#fff", fontSize: 9, fontWeight: 700 }}>EP {entry.episode}</div>
                  <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.8)", borderRadius: 6, padding: "3px 7px", color: "#F59E0B", fontSize: 9, fontWeight: 800 }}>{time}</div>
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
    { label: "Acción",      query: "Action",     icon: "⚔️", accent: "#EF4444", glow: "239,68,68" },
    { label: "Aventura",    query: "Adventure",  icon: "🗺️", accent: "#F97316", glow: "249,115,22" },
    { label: "Comedia",     query: "Comedy",     icon: "😂", accent: "#EAB308", glow: "234,179,8" },
    { label: "Drama",       query: "Drama",      icon: "🎭", accent: "#A855F7", glow: "168,85,247" },
    { label: "Fantasía",    query: "Fantasy",    icon: "✨", accent: "#8B5CF6", glow: "139,92,246" },
    { label: "Terror",      query: "Horror",     icon: "💀", accent: "#DC2626", glow: "220,38,38" },
    { label: "Romance",     query: "Romance",    icon: "💖", accent: "#EC4899", glow: "236,72,153" },
    { label: "Sci-Fi",      query: "Sci-Fi",     icon: "🚀", accent: "#06B6D4", glow: "6,182,212" },
    { label: "Shounen",     query: "Shounen",    icon: "💪", accent: "#F59E0B", glow: "245,158,11" },
    { label: "Isekai",      query: "Isekai",     icon: "🌀", accent: "#3B82F6", glow: "59,130,246" },
    { label: "Thriller",    query: "Thriller",   icon: "🔪", accent: "#64748B", glow: "100,116,139" },
    { label: "Misterio",    query: "Mystery",    icon: "🔍", accent: "#6366F1", glow: "99,102,241" },
  ];

  function GenresSection() {
    const [, navigate] = useLocation();
    return (
      <>
        <div className="genres-grid">
          {GENRES.map((g) => (
            <button
              key={g.label}
              onClick={() => navigate(`/search?q=${g.query}`)}
              className="genre-tile"
              style={{ ["--accent" as any]: g.accent, ["--glow" as any]: g.glow }}
            >
              <span className="genre-tile__corner genre-tile__corner--tl" />
              <span className="genre-tile__corner genre-tile__corner--br" />
              <span className="genre-tile__icon">{g.icon}</span>
              <span className="genre-tile__label">{g.label}</span>
              <span className="genre-tile__arrow">›</span>
            </button>
          ))}
        </div>
        <style>{`
          .genres-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 10px;
            padding: 4px 18px 6px;
          }
          @media (max-width: 480px) {
            .genres-grid { grid-template-columns: repeat(2, 1fr); gap: 9px; padding: 4px 14px 6px; }
          }
          .genre-tile {
            position: relative;
            display: flex; align-items: center; gap: 10px;
            padding: 12px 14px;
            border-radius: 12px;
            background: linear-gradient(145deg, rgba(15,17,28,0.92), rgba(8,9,18,0.92));
            border: 1px solid rgba(var(--glow), 0.22);
            color: #fff;
            font-size: 13.5px;
            font-weight: 600;
            font-family: inherit;
            cursor: pointer;
            text-align: left;
            transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.22s ease, background 0.18s ease;
            overflow: hidden;
          }
          .genre-tile::before {
            content: "";
            position: absolute; inset: 0;
            background: radial-gradient(circle at 20% 0%, rgba(var(--glow), 0.18), transparent 60%);
            opacity: 0.55;
            pointer-events: none;
            transition: opacity 0.22s ease;
          }
          .genre-tile:hover {
            transform: translateY(-2px);
            border-color: var(--accent);
            box-shadow: 0 10px 26px rgba(var(--glow), 0.28), inset 0 0 0 1px rgba(var(--glow), 0.18);
            background: linear-gradient(145deg, rgba(20,22,34,0.95), rgba(10,12,22,0.95));
          }
          .genre-tile:hover::before { opacity: 1; }
          .genre-tile:active { transform: translateY(0); }
          .genre-tile__icon {
            position: relative;
            width: 32px; height: 32px;
            border-radius: 9px;
            display: inline-flex; align-items: center; justify-content: center;
            font-size: 16px;
            background: linear-gradient(135deg, rgba(var(--glow), 0.22), rgba(var(--glow), 0.06));
            border: 1px solid rgba(var(--glow), 0.32);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
            flex-shrink: 0;
          }
          .genre-tile__label {
            position: relative;
            flex: 1;
            letter-spacing: 0.2px;
            text-shadow: 0 1px 0 rgba(0,0,0,0.4);
          }
          .genre-tile__arrow {
            position: relative;
            color: rgba(var(--glow), 0.7);
            font-size: 18px; line-height: 1;
            font-weight: 400;
            transform: translateX(-4px);
            opacity: 0;
            transition: transform 0.22s ease, opacity 0.22s ease;
          }
          .genre-tile:hover .genre-tile__arrow {
            transform: translateX(0);
            opacity: 1;
          }
          .genre-tile__corner {
            position: absolute;
            width: 8px; height: 8px;
            border-color: var(--accent);
            border-style: solid;
            opacity: 0.65;
            pointer-events: none;
          }
          .genre-tile__corner--tl { top: 4px; left: 4px; border-width: 1px 0 0 1px; border-top-left-radius: 2px; }
          .genre-tile__corner--br { bottom: 4px; right: 4px; border-width: 0 1px 1px 0; border-bottom-right-radius: 2px; }
        `}</style>
      </>
    );
  }

  /* ── CONTINUE WATCHING ── */
  type WatchEntry = ReturnType<typeof useWatchProgress>["progress"][number];

  function ContinueWatchingCard({ entry }: { entry: WatchEntry }) {
    const [, navigate] = useLocation();
    const pct = Math.min(1, entry.currentTime / Math.max(entry.duration, 1));
    const handleClick = () => {
      const p = new URLSearchParams({ episodeId: entry.episodeId, episodeNum: String(entry.episodeNum), animeTitle: entry.animeTitle, animeId: entry.animeId, animeImage: entry.animeImage });
      navigate(`/watch?${p.toString()}`);
    };
    return (
      <div className="cw-card" onClick={handleClick}>
        <img src={entry.animeImage} alt={entry.animeTitle} loading="lazy" decoding="async" />
        <div className="cw-card-grad" />
        <div className="cw-card-info">
          <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }} className="line-clamp-1">{entry.animeTitle}</div>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>Episodio {entry.episodeNum}</div>
          <div className="cw-bar"><div className="cw-fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
        </div>
      </div>
    );
  }

  /* ── SECTION DIVIDER ── */
  function SectionDivider() {
    return <div style={{ height: 1, margin: "4px 18px 0", background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.15), rgba(129,140,248,0.15), transparent)" }} />;
  }

  function SkeletonP() { return <div className="skeleton" style={{ width: 130, height: 197, borderRadius: 8, flexShrink: 0, border: "1px solid #222" }} />; }
  function SkeletonR() { return <div className="skeleton" style={{ width: 220, height: 136, borderRadius: 8, flexShrink: 0, border: "1px solid #222" }} />; }

  /* ── MAIN ── */
  export default function Home() {
    const [, navigate] = useLocation();
    const [heroIdx, setHeroIdx] = useState(0);
    const { progress: watchProgress } = useWatchProgress();
    const { user } = useAuth();

    const trending = useQuery({ queryKey: ["trending"], queryFn: consumet.trending, staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 });
    const popular = useQuery({ queryKey: ["popular"], queryFn: consumet.popular, staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 });
    const recent = useQuery({ queryKey: ["recent"], queryFn: consumet.recentEpisodes, staleTime: 1000 * 60 * 8, gcTime: 1000 * 60 * 30 });
    const { season, year } = getCurrentSeason();
    const seasonal = useQuery({ queryKey: ["seasonal", season, year], queryFn: fetchSeasonalAnime, staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 120, retry: 1 });

    const trendList = trending.data?.results ?? [];
    const popularList = popular.data?.results ?? [];
    const recentList = recent.data?.results ?? [];
    const seasonalList = seasonal.data ?? [];

    const prevHero = useCallback(() => setHeroIdx(i => (i > 0 ? i - 1 : Math.max(0, trendList.length - 1))), [trendList.length]);
    const nextHero = useCallback(() => setHeroIdx(i => (i < trendList.length - 1 ? i + 1 : 0)), [trendList.length]);

    useEffect(() => {
      if (trendList.length === 0) return;
      const t = setInterval(nextHero, 6000);
      return () => clearInterval(t);
    }, [trendList.length, nextHero]);

    const cwItems = watchProgress
      .filter((e, idx, arr) => arr.findIndex((x) => x.animeId === e.animeId) === idx)
      .slice(0, 8);

    return (
      <div style={{ minHeight: "100vh" }}>
        <Navbar />
        <div style={{ paddingTop: 56 }}>
          {/* Hero */}
          {trendList.length > 0
            ? <HeroBanner animes={trendList} idx={heroIdx} onPrev={prevHero} onNext={nextHero} />
            : <div style={{ height: "min(70vw, 540px)", background: "#000" }} />}

          {/* Continue watching */}
          {cwItems.length > 0 && (
            <SectionSurface>
              <SectionHeader title="▶ Continuar viendo" onSeeAll={() => navigate("/history")} />
              <ScrollableCarousel scrollAmount={460}>
                  {cwItems.map((e) => <ContinueWatchingCard key={`cw-${e.episodeId}`} entry={e} />)}
                </ScrollableCarousel>
            </SectionSurface>
          )}

          <SectionDivider />

          {/* Trending */}
          <SectionSurface>
            <SectionHeader title="🔥 Tendencias" />
            <ScrollableCarousel>
              {trending.isLoading ? Array.from({ length: 8 }).map((_, i) => <SkeletonP key={i} />) : trendList.slice(0, 14).map((a) => <PortraitCard key={`t-${a.id}`} anime={a} />)}
            </ScrollableCarousel>
          </SectionSurface>

          {/* Seasonal */}
          <LazySection>
          <SectionSurface>
            <SectionHeader title={`🌸 Temporada — ${seasonLabel(season)} ${year}`} />
            <ScrollableCarousel>
              {seasonal.isLoading ? Array.from({ length: 8 }).map((_, i) => <SkeletonP key={i} />) : seasonalList.map((a) => <SeasonalCard key={`s-${a.id}`} anime={a} />)}
            </ScrollableCarousel>
          </SectionSurface>

          </LazySection>

          {/* Ad banner */}
          <div style={{ padding: "0 18px", marginTop: 20 }}>
            <AdBanner variant="horizontal" />
          </div>

          <SectionDivider />

          <LazySection>
          {/* Latest episodes */}
          <SectionSurface>
            <SectionHeader title="⚡ Últimos Episodios" />
            <ScrollableCarousel scrollAmount={660}>
              {recent.isLoading ? Array.from({ length: 5 }).map((_, i) => <SkeletonR key={i} />) : recentList.slice(0, 12).map((a) => <RecentCard key={`r-${a.id}`} anime={a} />)}
            </ScrollableCarousel>
          </SectionSurface>

          </LazySection>

          <SectionDivider />

          <LazySection>
          {/* Most popular */}
          <SectionSurface>
            <SectionHeader title="⭐ Más Populares" />
            <ScrollableCarousel>
              {popular.isLoading ? Array.from({ length: 8 }).map((_, i) => <SkeletonP key={i} />) : popularList.slice(0, 14).map((a) => <PortraitCard key={`p-${a.id}`} anime={a} />)}
            </ScrollableCarousel>
          </SectionSurface>

          </LazySection>

          <LazySection minHeight={200}>
          {/* Recommendations */}
          {user ? (
            <div style={{ marginTop: 28 }}>
              <AnimeRecommendations userId={user.id} type="personal" limit={14} />
            </div>
          ) : (
            <div style={{ marginTop: 28 }}>
              <AnimeRecommendations type="trending" title="Recomendaciones para ti" limit={14} />
            </div>
          )}

          <SectionDivider />

          <ScheduleSection />

          <SectionDivider />

          </LazySection>

          <LazySection>
          {/* Top 10 */}
          <SectionSurface>
            <SectionHeader title="🏆 Top Anime" />
            <div style={{ padding: "0 18px" }}>
              {popular.isLoading
                ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 72, background: "#111", borderRadius: 8, marginBottom: 4, border: "1px solid #222", opacity: 1 }} />)
                : popularList.slice(0, 10).map((a, i) => <TopAnimeRow key={`top-${a.id}`} anime={a} rank={i + 1} />)}
            </div>
          </SectionSurface>

          </LazySection>

          <SectionDivider />

          <LazySection minHeight={120}>
          {/* Manga promo banner */}
          <div
            onClick={() => navigate("/manga")}
            style={{
              cursor: "pointer",
              borderRadius: 20,
              background: "linear-gradient(135deg, rgba(220,38,38,0.15) 0%, rgba(249,115,22,0.15) 50%, rgba(220,38,38,0.1) 100%)",
              border: "1px solid rgba(220,38,38,0.2)",
              padding: "28px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
              marginBottom: 24,
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 16px 40px rgba(220,38,38,0.2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "linear-gradient(135deg, rgba(220,38,38,0.3), rgba(249,115,22,0.3))",
                border: "1px solid rgba(220,38,38,0.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 26, flexShrink: 0,
              }}>📚</div>
              <div>
                <div style={{ color: "#F1F1F5", fontWeight: 900, fontSize: 20, marginBottom: 4 }}>¡Ya puedes leer Manga!</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Explora miles de mangas directamente en AnimeFlex</div>
              </div>
            </div>
            <div style={{
              background: "linear-gradient(135deg, #DC2626, #F97316)",
              color: "#fff", fontSize: 14, fontWeight: 700,
              padding: "10px 22px", borderRadius: 12, whiteSpace: "nowrap",
              boxShadow: "0 6px 20px rgba(220,38,38,0.35)",
            }}>
              Explorar Manga →
            </div>
          </div>
          </LazySection>

          <SectionDivider />

          <LazySection minHeight={120}>
          {/* Genres */}
          <SectionSurface>
            <SectionHeader title="🎭 Géneros" />
            <GenresSection />
          </SectionSurface>

          <div style={{ marginBottom: 24 }} />          </LazySection>

        </div>
        <Footer />
      </div>
    );
  }