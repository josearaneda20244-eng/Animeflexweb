import { useQuery } from "@tanstack/react-query";
  import { useLocation } from "wouter";
  import { Play, Info, Star, ChevronLeft, ChevronRight, Tv } from "lucide-react";
  import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
  import { fetchAiringSchedule, fetchSeasonalAnime, getCurrentSeason, seasonLabel, type AiringEntry, type SeasonAnime } from "@/lib/anilist";
  import { useWatchProgress } from "@/context/WatchProgressContext";
  import { useAuth } from "@/context/AuthContext";
  import AnimeRecommendations from "@/components/AnimeRecommendations";
  import { useCallback, useState, useEffect, useRef } from "react";
  import Navbar from "@/components/Navbar";
  import Footer from "@/components/Footer";
  import AdBanner from "@/components/AdBanner";


  /* ── LAZY SECTION (only mount when near viewport) ── */
  function useLazySection(rootMargin = "350px") {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
        { rootMargin }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, [rootMargin]);
    return { ref, inView };
  }

  function LazySection({ children, minHeight = 280 }: { children: React.ReactNode; minHeight?: number }) {
    const { ref, inView } = useLazySection();
    return (
      <div ref={ref} style={{ minHeight: inView ? undefined : minHeight }}>
        {inView ? children : null}
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
      background: "rgba(7,7,20,0.82)",
      border: "1px solid rgba(139,92,246,0.35)",
      borderRadius: 22,
      width: 38, height: 38,
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: active ? "pointer" : "default",
      opacity: active ? 1 : 0,
      pointerEvents: active ? "auto" : "none",
      transition: "opacity 0.22s, background 0.18s, transform 0.18s, box-shadow 0.18s",
      boxShadow: "0 4px 20px rgba(0,0,0,0.5), 0 0 14px rgba(139,92,246,0.25)",
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
          onMouseEnter={e => { if (canLeft) { e.currentTarget.style.background = "rgba(139,92,246,0.45)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(139,92,246,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(7,7,20,0.82)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5), 0 0 14px rgba(139,92,246,0.25)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}>
          <ChevronLeft size={20} color="#C4B5FD" />
        </button>

        {/* Right arrow */}
        <button
          onClick={() => scroll(1)}
          className="carousel-arrow"
          style={ARROW_STYLE(canRight, "right")}
          onMouseEnter={e => { if (canRight) { e.currentTarget.style.background = "rgba(139,92,246,0.45)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(139,92,246,0.5)"; e.currentTarget.style.transform = "translateY(-50%) scale(1.1)"; }}}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(7,7,20,0.82)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5), 0 0 14px rgba(139,92,246,0.25)"; e.currentTarget.style.transform = "translateY(-50%) scale(1)"; }}>
          <ChevronRight size={20} color="#C4B5FD" />
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
            background: "linear-gradient(to right, rgba(7,7,20,0.85), transparent)"
          }} />
        )}
        {/* Right fade mask */}
        {canRight && (
          <div style={{
            position: "absolute", top: 0, right: 0, width: 60, height: "100%", pointerEvents: "none",
            background: "linear-gradient(to left, rgba(7,7,20,0.85), transparent)"
          }} />
        )}
      </div>
    );
  }

  /* ── HERO BANNER ── */
  function HeroBanner({ animes, idx, onPrev, onNext }: { animes: AnimeResult[]; idx: number; onPrev: () => void; onNext: () => void }) {
    const [, navigate] = useLocation();
    const anime = animes[idx];
    if (!anime) return <div style={{ height: "min(70vw, 540px)", background: "#070714" }} />;
    const title = resolveTitle(anime.title);

    return (
      <div style={{ position: "relative", height: "min(70vw, 580px)", overflow: "hidden", margin: "0 18px", borderRadius: 34, boxShadow: "0 36px 90px rgba(0,0,0,0.35)" }}>
        <img src={anime.cover || anime.image} alt={title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", filter: "saturate(1.03) brightness(0.9)", transition: "opacity 0.6s" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.16) 0%, rgba(0,0,0,0.55) 28%, rgba(0,0,0,0.88) 78%, #02040b 100%)" }} />
        <div style={{ position: "absolute", inset: 0, width: "60%", background: "linear-gradient(to right, rgba(0,0,0,0.88), transparent)" }} />
        <div style={{ position: "absolute", bottom: 34, left: 34, maxWidth: 560, zIndex: 2 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <span style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)", borderRadius: 999, padding: "4px 11px", color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>DESTACADO</span>
              {anime.status === "Ongoing" && (
                <span style={{ background: "rgba(34,197,94,0.18)", borderRadius: 999, padding: "4px 10px", color: "#86EFAC", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, background: "#22C55E", borderRadius: "50%" }} /> EN EMISIÓN
                </span>
              )}
              {anime.genres?.slice(0, 3).map((g) => (
                <span key={g} style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(139,92,246,0.14)", color: "#C4B5FD", fontSize: 11, fontWeight: 600, border: "1px solid rgba(139,92,246,0.18)" }}>{g}</span>
              ))}
            </div>
          <h1 style={{ color: "#F8FBFF", fontSize: "clamp(28px, 4.2vw, 46px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: -1, margin: 0, textShadow: "0 2px 24px rgba(0,0,0,0.85), 0 0 14px rgba(139,92,246,0.18)" }}>{title}</h1>
          <p style={{ maxWidth: 520, color: "rgba(248,251,255,0.74)", fontSize: 15, lineHeight: 1.8, margin: "16px 0 0" }}>{anime.description ? anime.description.replace(/<[^>]+>/g, '').slice(0, 140) + '…' : 'Descubre por qué este anime está arrasando entre la comunidad.'}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
            <button onClick={() => nav(navigate, anime.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg, #8B5CF6, #6D28D9)", border: "none", borderRadius: 14, padding: "14px 26px", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: "0 0 30px rgba(139,92,246,0.55), 0 10px 30px rgba(0,0,0,0.32)", transition: "transform 0.2s, box-shadow 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px) scale(1.02)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(139,92,246,0.75), 0 12px 30px rgba(0,0,0,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 0 30px rgba(139,92,246,0.55), 0 10px 30px rgba(0,0,0,0.32)"; }}>
              <Play size={18} fill="#fff" color="#fff" /> Ver Ahora
            </button>
            <button onClick={() => nav(navigate, anime.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14, padding: "14px 22px", color: "#F4F4F8", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.35)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; }}>
              <Info size={16} /> Detalles
            </button>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 18, right: 24, display: "flex", gap: 8, alignItems: "center" }}>
          {animes.slice(0, 6).map((_, i) => (
            <div key={i} style={{ height: 6, borderRadius: 999, background: i === idx ? "#8B5CF6" : "rgba(255,255,255,0.18)", width: i === idx ? 30 : 10, transition: "width 0.35s, background 0.35s", boxShadow: i === idx ? "0 0 14px rgba(139,92,246,0.55)" : "none" }} />
          ))}
        </div>

        <button onClick={onPrev} style={{ position: "absolute", top: "50%", left: 16, transform: "translateY(-50%)", background: "rgba(7,7,20,0.7)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 24, padding: "12px 13px", cursor: "pointer", display: "flex", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.25)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(7,7,20,0.7)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)"; }}>
          <ChevronLeft size={24} color="rgba(255,255,255,0.9)" />
        </button>
        <button onClick={onNext} style={{ position: "absolute", top: "50%", right: 16, transform: "translateY(-50%)", background: "rgba(7,7,20,0.7)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 24, padding: "12px 13px", cursor: "pointer", display: "flex", transition: "all 0.18s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.25)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(7,7,20,0.7)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)"; }}>
          <ChevronRight size={24} color="rgba(255,255,255,0.9)" />
        </button>
      </div>
    );
  }

  /* ── SECTION HEADER ── */
  function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 3, height: 24, borderRadius: 2, background: "linear-gradient(180deg, #8B5CF6, #6D28D9)", flexShrink: 0, boxShadow: "0 0 14px rgba(139,92,246,0.35)" }} />
          <span style={{ fontSize: 18, fontWeight: 900, background: "linear-gradient(90deg, #fff, #C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: -0.2 }}>{title}</span>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", transition: "background 0.18s, transform 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.18)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <span style={{ color: "#EDE9FE", fontSize: 13, fontWeight: 700 }}>Ver todo</span>
            <ChevronRight size={14} color="#EDE9FE" />
          </button>
        )}
      </div>
    );
  }

  function SectionSurface({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ margin: "24px 18px", padding: "22px 0 26px", borderRadius: 32, background: "rgba(7,7,20,0.72)", border: "1px solid rgba(139,92,246,0.16)", boxShadow: "0 24px 70px rgba(0,0,0,0.22)", backdropFilter: "blur(12px)" }}>
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
          <span style={{ background: "linear-gradient(135deg,#22C55E,#16A34A)", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>SUB</span>
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
          <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, padding: "3px 6px", color: "#8B5CF6", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", gap: 3 }}>
            <Tv size={9} color="#8B5CF6" /> EP {anime.currentEpisode ?? "?"}
          </span>
          <span style={{ background: "linear-gradient(135deg,#8B5CF6,#6D28D9)", borderRadius: 5, padding: "2px 5px", color: "#fff", fontSize: 8, fontWeight: 900 }}>HD</span>
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
          <span style={{ background: "linear-gradient(135deg,#8B5CF6,#6D28D9)", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 7, fontWeight: 900 }}>NEW</span>
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
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderBottom: "1px solid rgba(139,92,246,0.08)", cursor: "pointer", borderRadius: 8, transition: "background 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(139,92,246,0.07)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
        <span style={{ background: RANK_COLORS[rank] ?? "none", WebkitBackgroundClip: RANK_COLORS[rank] ? "text" : undefined, WebkitTextFillColor: RANK_COLORS[rank] ? "transparent" : undefined, backgroundClip: RANK_COLORS[rank] ? "text" : undefined, color: RANK_COLORS[rank] ? undefined : "rgba(255,255,255,0.2)", fontSize: 19, fontWeight: 900, width: 32, textAlign: "center", flexShrink: 0 }}>{String(rank).padStart(2, "0")}</span>
        <img src={anime.image} alt={title} loading="lazy" decoding="async" style={{ width: 48, height: 66, borderRadius: 8, objectFit: "cover", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, lineHeight: 1.35 }} className="line-clamp-2">{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {anime.type && <span style={{ color: "#8B5CF6", fontSize: 9, fontWeight: 700, background: "rgba(139,92,246,0.15)", padding: "1px 6px", borderRadius: 4 }}>{anime.type}</span>}
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
              <button key={i} onClick={() => setActiveDay(i)} style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 22, border: `1px solid ${isActive ? "#8B5CF6" : "rgba(255,255,255,0.1)"}`, background: isActive ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.04)", color: isActive ? "#C4B5FD" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, cursor: "pointer", position: "relative", boxShadow: isActive ? "0 0 12px rgba(139,92,246,0.3)" : "none", transition: "all 0.18s" }}>
                {d}
                {isToday && <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: "50%", background: "#22C55E", border: "1.5px solid #070714", boxShadow: "0 0 6px #22C55E" }} />}
              </button>
            );
          })}
        </div>
        {isLoading && (
          <ScrollableCarousel>
            {Array.from({ length: 8 }).map((_, i) => <div key={i} style={{ width: 130, height: 197, borderRadius: 14, background: "#0D0B1F", flexShrink: 0 }} />)}
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
                  style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#0D0B1F", border: "1px solid rgba(139,92,246,0.12)", cursor: "pointer", width: 130, height: 197, flexShrink: 0, transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.22s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-6px) scale(1.02)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(139,92,246,0.3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}>
                  <img src={entry.media.coverImage.large} alt={title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 42%, rgba(7,7,20,0.97) 100%)" }} />
                  <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.8)", borderRadius: 6, padding: "3px 7px", color: "#8B5CF6", fontSize: 9, fontWeight: 800, border: "1px solid rgba(139,92,246,0.3)" }}>EP {entry.episode}</div>
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
  const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Shounen", "Isekai", "Thriller", "Mystery"];
  const GENRE_COLORS: Record<string, string> = { Action: "rgba(239,68,68,0.15)", Adventure: "rgba(245,158,11,0.15)", Comedy: "rgba(34,197,94,0.15)", Drama: "rgba(139,92,246,0.15)", Fantasy: "rgba(139,92,246,0.15)", Horror: "rgba(239,68,68,0.18)", Romance: "rgba(244,114,182,0.18)", "Sci-Fi": "rgba(139,92,246,0.15)", Shounen: "rgba(251,191,36,0.15)", Isekai: "rgba(139,92,246,0.2)", Thriller: "rgba(239,68,68,0.12)", Mystery: "rgba(109,40,217,0.18)" };
  const GENRE_TEXT: Record<string, string> = { Action: "#F87171", Adventure: "#FCD34D", Comedy: "#4ADE80", Drama: "#C4B5FD", Fantasy: "#A78BFA", Horror: "#F87171", Romance: "#F9A8D4", "Sci-Fi": "#22D3EE", Shounen: "#FDE68A", Isekai: "#8B5CF6", Thriller: "#F97316", Mystery: "#A78BFA" };

  function GenresSection() {
    const [, navigate] = useLocation();
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 18px" }}>
        {GENRES.map((g) => (
          <button key={g} onClick={() => navigate(`/search?q=${g}`)} style={{ background: GENRE_COLORS[g] ?? "rgba(139,92,246,0.12)", borderRadius: 22, padding: "8px 16px", border: `1px solid ${(GENRE_TEXT[g] ?? "#8B5CF6")}44`, color: GENRE_TEXT[g] ?? "#C4B5FD", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.18s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 18px ${(GENRE_TEXT[g] ?? "#8B5CF6")}33`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
            {g}
          </button>
        ))}
      </div>
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
    return <div style={{ height: 1, margin: "8px 18px 0", background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.2) 30%, rgba(139,92,246,0.2) 70%, transparent)" }} />;
  }

  function SkeletonP() { return <div style={{ width: 130, height: 197, borderRadius: 14, background: "#0D0B1F", flexShrink: 0, border: "1px solid rgba(139,92,246,0.07)" }} />; }
  function SkeletonR() { return <div style={{ width: 220, height: 136, borderRadius: 14, background: "#0D0B1F", flexShrink: 0, border: "1px solid rgba(139,92,246,0.07)" }} />; }

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
            : <div style={{ height: "min(70vw, 540px)", background: "linear-gradient(180deg, #1a0a3e, #070714)" }} />}

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
                ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 72, background: "#0D0B1F", borderRadius: 10, marginBottom: 4, opacity: 0.5 }} />)
                : popularList.slice(0, 10).map((a, i) => <TopAnimeRow key={`top-${a.id}`} anime={a} rank={i + 1} />)}
            </div>
          </SectionSurface>

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