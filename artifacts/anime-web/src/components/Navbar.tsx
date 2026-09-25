import { Link, useLocation } from "wouter";
import { Search, Bookmark, Clock, Home, Film, Tv2, Calendar, Shuffle, Bell, ChevronDown, X, Star, ListVideo, Menu, LogIn, LogOut, User, Crown, Shield, ChevronRight, Zap, Settings, Camera, Rss, LayoutDashboard, BookOpen, Newspaper } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useWatchList } from "@/context/WatchListContext";
import { useHistory } from "@/context/HistoryContext";
import { NotificationManager } from "@/components/NotificationManager";
import AuthModal from "@/components/AuthModal";
import { resolveAvatarUrl } from "@/lib/utils";
import { CornerBrackets, SystemTag } from "@/components/SystemUI";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Navbar() {
  const [location, navigate] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AnimeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, logout, isMegaFan, isOwner } = useAuth();
  const { favorites } = useFavorites();
  const { watchList } = useWatchList();
  const { history } = useHistory();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setSearchLoading(true);
    try {
      const res = await consumet.search(q.trim(), 1);
      setSuggestions(res.results?.slice(0, 6) ?? []);
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 380);
  };

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (anime: AnimeResult) => {
    navigate(`/anime/${anime.id}`);
    setSearchOpen(false);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleRandom = async () => {
    try {
      const trending = await consumet.trending();
      const list = trending.results ?? [];
      if (list.length > 0) {
        const r = list[Math.floor(Math.random() * list.length)];
        navigate(`/anime/${r.id}`);
      }
    } catch {}
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  useEffect(() => { if (searchOpen) inputRef.current?.focus(); }, [searchOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowSuggestions(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener("change", handler as (e: MediaQueryListEvent) => void);
    return () => mq.removeEventListener("change", handler as (e: MediaQueryListEvent) => void);
  }, []);

  const mobileNavItems = [
    { label: "Inicio", icon: <Home size={18} />, href: "/" },
    { label: "Manga", icon: <BookOpen size={18} />, href: "/manga" },
    { label: "Noticias", icon: <Newspaper size={18} />, href: "/noticias" },
    { label: "Películas", icon: <Film size={18} />, href: "/movies" },
    { label: "OVAs", icon: <Tv2 size={18} />, href: "/ovas" },
    { label: "Horario", icon: <Calendar size={18} />, href: "/schedule" },
    { label: "Mi Lista", icon: <ListVideo size={18} />, href: "/watchlist" },
    { label: "Favoritos", icon: <Bookmark size={18} />, href: "/favorites" },
    { label: "Historial", icon: <Clock size={18} />, href: "/history" },
    { label: "Feed", icon: <Rss size={18} />, href: "/feed" },
    ...(isOwner ? [{ label: "Panel Admin", icon: <LayoutDashboard size={18} />, href: "/admin" }] : []),
  ];

  return (
    <>
      <nav
        className="site-navbar fixed top-0 left-0 right-0 z-50"
        style={{ background: "rgba(7,7,11,0.78)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", borderBottom: "1px solid rgba(220,38,38,0.14)", boxShadow: "0 6px 28px rgba(0,0,0,0.45)" }}
      >
        <div className="site-navbar__inner" style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: 58 }}>
          {/* Logo */}
          <Link className="site-navbar__brand" href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", flexShrink: 0, marginRight: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,#FCA5A5 0%,#DC2626 50%,#991B1B 100%)",
              boxShadow: "0 6px 18px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
            }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 900, lineHeight: 1, marginLeft: 1 }}>▶</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>
              <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ background: "linear-gradient(135deg,#FECACA,#DC2626)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FLEX</span>
            </span>
          </Link>

          {searchOpen ? (
            <form onSubmit={handleSearch} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
              <div ref={searchBoxRef} style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={15} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 12, zIndex: 1 }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  placeholder="Buscar anime..."
                  style={{
                    width: "100%", paddingLeft: 36, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
                    borderRadius: showSuggestions && suggestions.length > 0 ? "12px 12px 0 0" : 12,
                    background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
                    color: "#F1F1F5", fontSize: 14, outline: "none", fontFamily: "inherit",
                  }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300,
                    background: "#0a0a0a", border: "1px solid #222", borderTop: "none",
                    borderRadius: "0 0 14px 14px", overflow: "hidden",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
                  }}>
                    {searchLoading && (
                      <div style={{ padding: "10px 14px", color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Buscando...</div>
                    )}
                    {!searchLoading && suggestions.map((anime) => {
                      const title = resolveTitle(anime.title);
                      return (
                        <div key={anime.id} onClick={() => handleSuggestionClick(anime)}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                            cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.04)",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <img src={anime.image} alt={title} style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }} className="line-clamp-1">{title}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                              {anime.type && <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{anime.type}</span>}
                              {anime.releaseDate && <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{anime.releaseDate}</span>}
                              {anime.rating != null && anime.rating > 0 && (
                                <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                  <Star size={9} color="#F59E0B" fill="#F59E0B" />
                                  <span style={{ color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>{(anime.rating / 10).toFixed(1)}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div onClick={() => { if (query.trim()) { navigate(`/search?q=${encodeURIComponent(query.trim())}`); setSearchOpen(false); setQuery(""); setSuggestions([]); setShowSuggestions(false); } }}
                      style={{
                        padding: "9px 14px", color: "#fff", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      Ver todos los resultados para "{query}" →
                    </div>
                  </div>
                )}
              </div>
              <button type="button" onClick={closeSearch}
                style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, padding: 8, cursor: "pointer", display: "flex" }}>
                <X size={16} color="rgba(255,255,255,0.65)" />
              </button>
            </form>
          ) : (
            <>
              {/* Desktop nav links */}
              <div style={{ alignItems: "center", gap: 2, flex: 1 }} className="hidden md:flex">
                <NavBtn href="/" icon={<Home size={15} />} label="Inicio" active={isActive("/")} />
                <NavBtn href="/manga" icon={<BookOpen size={15} />} label="Manga" active={isActive("/manga")} />
                <NavBtn href="/noticias" icon={<Newspaper size={15} />} label="Noticias" active={isActive("/noticias")} />
                <NavBtn href="/movies" icon={<Film size={15} />} label="Películas" active={isActive("/movies")} />

                <div ref={moreRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => setMoreOpen((v) => !v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 10,
                      background: "none", border: "none", cursor: "pointer",
                      color: moreOpen ? "#F1F1F5" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600,
                    }}
                  >
                    Más <ChevronDown size={13} style={{ transform: moreOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
                  </button>
                  {moreOpen && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
                      background: "#100e22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                      padding: 8, minWidth: 160, boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                    }}>
                      {[
                        { label: "OVAs", icon: <Tv2 size={14} />, href: "/ovas" },
                        { label: "Horario", icon: <Calendar size={14} />, href: "/schedule" },
                        { label: "Mi Lista", icon: <ListVideo size={14} />, href: "/watchlist" },
                        { label: "Favoritos", icon: <Bookmark size={14} />, href: "/favorites" },
                        { label: "Historial", icon: <Clock size={14} />, href: "/history" },
                        { label: "Feed", icon: <Rss size={14} />, href: "/feed" },
                      ].map(({ label, icon, href }) => (
                        <button key={href} onClick={() => { navigate(href); setMoreOpen(false); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
                            background: isActive(href) ? "rgba(255,255,255,0.1)" : "none", border: "none",
                            borderRadius: 10, cursor: "pointer",
                            color: isActive(href) ? "#fff" : "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600,
                          }}
                          onMouseEnter={(e) => { if (!isActive(href)) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
                          onMouseLeave={(e) => { if (!isActive(href)) (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                        >
                          {icon}{label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile: spacer */}
              <div className="flex md:hidden" style={{ flex: 1 }} />

              {/* Right actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Aleatorio - desktop only */}
                <button
                  onClick={handleRandom}
                  title="Anime aleatorio"
                  style={{
                    alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10,
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer",
                  }}
                  className="hidden md:flex"
                >
                  <Shuffle size={14} /> Aleatorio
                </button>

                {/* Search */}
                <button onClick={() => setSearchOpen(true)}
                  style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex" }}>
                  <Search size={17} color="rgba(255,255,255,0.65)" />
                </button>

                {/* Notifications */}
                <NotificationManager />

                {/* Auth button / user avatar */}
                {user ? (
                  <div ref={userMenuRef} style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowUserMenu((v) => !v)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 5px",
                        borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "linear-gradient(135deg,#DC2626,#991B1B)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
                      }}>
                        {resolveAvatarUrl(user.avatar_url)
                          ? <img src={resolveAvatarUrl(user.avatar_url)!} style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }} />
                          : <User size={14} color="#fff" />
                        }
                      </div>
                      <span className="hidden md:flex" style={{ color: "#fff", fontSize: 12, fontWeight: 500, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", alignItems: "center", gap: 4 }}>
                        {user.username}
                        {isOwner && <span title="Dueño" style={{ fontSize: 11 }}>🔧</span>}
                        {isMegaFan && <Crown size={11} color="#F59E0B" />}
                      </span>
                    </button>

                    {showUserMenu && (
                      <div style={isMobile ? {
                        position: "fixed", top: 66, left: 8, right: 8, zIndex: 200,
                        maxHeight: "calc(100vh - 78px)", overflowY: "auto",
                        background: "linear-gradient(180deg, rgba(17,8,35,0.97), rgba(8,4,18,0.99))",
                        border: "1px solid rgba(220,38,38,0.45)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.85), 0 0 28px rgba(220,38,38,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
                        clipPath: "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
                      } : {
                        position: "absolute", top: "calc(100% + 12px)", right: 0, zIndex: 200,
                        minWidth: 300, width: 300,
                        background: "linear-gradient(180deg, rgba(17,8,35,0.97), rgba(8,4,18,0.99))",
                        border: "1px solid rgba(220,38,38,0.45)",
                        boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 24px 60px rgba(0,0,0,0.85), 0 0 28px rgba(220,38,38,0.25), inset 0 1px 0 rgba(255,255,255,0.04)",
                        clipPath: "polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)",
                      }}>
                        {/* Hex grid background */}
                        <div style={{
                          position: "absolute", inset: 0,
                          backgroundImage: "linear-gradient(rgba(220,38,38,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.06) 1px, transparent 1px)",
                          backgroundSize: "22px 22px",
                          maskImage: "linear-gradient(180deg, black 0%, transparent 80%)",
                          WebkitMaskImage: "linear-gradient(180deg, black 0%, transparent 80%)",
                          pointerEvents: "none",
                        }} />
                        {/* Aurora glow top */}
                        <div style={{
                          position: "absolute", top: 0, left: 0, right: 0, height: 140,
                          background: "radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.32) 0%, transparent 70%)",
                          pointerEvents: "none",
                        }} />
                        {/* Corner brackets */}
                        <CornerBrackets color="#DC2626" size={14} thickness={2} inset={4} />

                        {/* SYSTEM tag header */}
                        <div style={{ padding: "14px 16px 10px", position: "relative", zIndex: 2 }}>
                          <SystemTag color="#DC2626">[ SYSTEM ] PERFIL</SystemTag>
                        </div>

                        {/* Avatar + Badges */}
                        <div style={{ padding: "0 16px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, position: "relative", zIndex: 2 }}>
                          <button onClick={() => { navigate("/settings"); setShowUserMenu(false); }}
                            title="Cambiar foto de perfil"
                            style={{
                              position: "relative", width: 60, height: 60, padding: 0, border: "none",
                              background: "linear-gradient(135deg,#DC2626,#7F1D1D)",
                              boxShadow: "0 4px 18px rgba(220,38,38,0.45), 0 0 0 1px rgba(220,38,38,0.6)",
                              overflow: "hidden", flexShrink: 0, cursor: "pointer",
                              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                            }}
                          >
                            {resolveAvatarUrl(user.avatar_url)
                              ? <img src={resolveAvatarUrl(user.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ color: "#fff", fontSize: 24, fontWeight: 900, lineHeight: 1, display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                            }
                            <div style={{
                              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(0,0,0,0.55)", opacity: 0, transition: "opacity 0.2s",
                            }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                            >
                              <Camera size={16} color="#fff" />
                            </div>
                          </button>
                          {/* Badges */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                            {isOwner && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: "rgba(220,38,38,0.18)",
                                border: "1px solid rgba(220,38,38,0.55)",
                                color: "#FCA5A5", fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
                                padding: "3px 8px",
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                              }}>
                                <Shield size={9} /> DUEÑO
                              </span>
                            )}
                            {isMegaFan && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 4,
                                background: "rgba(249,115,22,0.15)",
                                border: "1px solid rgba(249,115,22,0.55)",
                                color: "#FCD34D", fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
                                padding: "3px 8px",
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                              }}>
                                <Crown size={9} /> MEGAFAN
                              </span>
                            )}
                          </div>
                        </div>

                        {/* User info */}
                        <div style={{ padding: "0 16px 14px", position: "relative", zIndex: 2 }}>
                          <div style={{ color: "#FECACA", fontSize: 18, fontWeight: 900, letterSpacing: 0.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace", textShadow: "0 0 12px rgba(220,38,38,0.35)" }}>
                            {user.username}
                          </div>
                          <div style={{ color: "rgba(252,165,165,0.55)", fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 6, wordBreak: "break-all", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px #22C55E", display: "inline-block", flexShrink: 0 }} />
                            {user.email}
                          </div>
                          {user.created_at && (
                            <div style={{ color: "rgba(252,165,165,0.35)", fontSize: 9.5, marginTop: 6, letterSpacing: 1.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace", textTransform: "uppercase" }}>
                              ▸ MIEMBRO DESDE {new Date(user.created_at).toLocaleDateString("es", { month: "short", year: "numeric" }).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Stats */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                          margin: "0 12px 12px",
                          background: "rgba(220,38,38,0.06)",
                          border: "1px solid rgba(220,38,38,0.25)",
                          position: "relative", zIndex: 2,
                          clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                        }}>
                          {[
                            { label: "FAVS", value: favorites.length, icon: <Bookmark size={13} color="#FCA5A5" />, href: "/favorites" },
                            { label: "LISTA", value: watchList.length, icon: <ListVideo size={13} color="#FCA5A5" />, href: "/watchlist" },
                            { label: "HIST", value: history.length, icon: <Clock size={13} color="#34D399" />, href: "/history" },
                          ].map(({ label, value, icon, href }, i) => (
                            <button key={href} onClick={() => { navigate(href); setShowUserMenu(false); }}
                              style={{
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                padding: "10px 4px", gap: 3, background: "none", border: "none",
                                borderRight: i < 2 ? "1px solid rgba(220,38,38,0.18)" : "none",
                                cursor: "pointer", transition: "background 0.15s",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.12)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                            >
                              {icon}
                              <span style={{ color: "#FECACA", fontSize: 16, fontWeight: 900, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{value}</span>
                              <span style={{ color: "rgba(252,165,165,0.6)", fontSize: 8.5, fontWeight: 800, letterSpacing: 1.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Membership banner */}
                        <div style={{ margin: "0 12px 10px", position: "relative", zIndex: 2 }}>
                          <button
                            onClick={() => { navigate("/membership"); setShowUserMenu(false); }}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 10,
                              padding: "11px 12px",
                              background: isMegaFan
                                ? "linear-gradient(135deg, rgba(249,115,22,0.18), rgba(249,115,22,0.06))"
                                : "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(220,38,38,0.06))",
                              border: isMegaFan ? "1px solid rgba(249,115,22,0.55)" : "1px solid rgba(220,38,38,0.45)",
                              cursor: "pointer", transition: "all 0.2s",
                              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                          >
                            <div style={{
                              width: 32, height: 32, flexShrink: 0,
                              background: isMegaFan ? "linear-gradient(135deg,#F97316,#B45309)" : "linear-gradient(135deg,#DC2626,#7F1D1D)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: isMegaFan ? "0 4px 12px rgba(249,115,22,0.45)" : "0 4px 12px rgba(220,38,38,0.45)",
                              clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                            }}>
                              {isMegaFan ? <Crown size={16} color="#fff" /> : <Zap size={16} color="#fff" />}
                            </div>
                            <div style={{ flex: 1, textAlign: "left" }}>
                              <div style={{ color: isMegaFan ? "#FCD34D" : "#FECACA", fontSize: 12, fontWeight: 800, letterSpacing: 0.4, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                                {isMegaFan ? "MEMBRESÍA ACTIVA" : "HAZTE MEGAFAN"}
                              </div>
                              <div style={{ color: "rgba(252,165,165,0.55)", fontSize: 9.5, marginTop: 2, letterSpacing: 0.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                                {isMegaFan ? "▸ ACCESO PREMIUM ACTIVO" : "▸ DESBLOQUEAR CONTENIDO"}
                              </div>
                            </div>
                            <ChevronRight size={14} color={isMegaFan ? "#FCD34D" : "#FCA5A5"} />
                          </button>
                        </div>

                        {/* Quick links */}
                        <div style={{ margin: "0 12px", borderTop: "1px solid rgba(220,38,38,0.18)", paddingTop: 6, position: "relative", zIndex: 2 }}>
                          {[
                            ...(isOwner ? [{ icon: <LayoutDashboard size={13} />, label: "PANEL DE ADMIN", href: "/admin", color: "#FCA5A5" }] : []),
                            { icon: <User size={13} />, label: "MI PERFIL", href: "/perfil", color: "rgba(252,165,165,0.7)" },
                            { icon: <Settings size={13} />, label: "CONFIGURACIÓN", href: "/settings", color: "rgba(252,165,165,0.7)" },
                          ].map(({ icon, label, href, color }) => (
                            <button key={href} onClick={() => { navigate(href); setShowUserMenu(false); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 10, width: "100%",
                                padding: "10px 10px", background: "none", border: "none",
                                cursor: "pointer", color,
                                fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.1)"; (e.currentTarget as HTMLButtonElement).style.color = "#FECACA"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = color; }}
                            >
                              <span style={{ color: "#DC2626" }}>▸</span>{icon} {label}
                            </button>
                          ))}
                        </div>

                        {/* Logout */}
                        <div style={{ margin: "6px 12px 14px", borderTop: "1px solid rgba(220,38,38,0.18)", paddingTop: 6, position: "relative", zIndex: 2 }}>
                          <button
                            onClick={() => { logout(); setShowUserMenu(false); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 10, width: "100%",
                              padding: "10px 10px", background: "none", border: "1px solid rgba(220,38,38,0.35)",
                              cursor: "pointer",
                              color: "#FCA5A5", fontSize: 11, fontWeight: 900, letterSpacing: 1.5,
                              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                              transition: "all 0.15s",
                              clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,38,38,0.18)"; (e.currentTarget as HTMLButtonElement).style.color = "#FECACA"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = "#FCA5A5"; }}
                          >
                            <LogOut size={13} /> CERRAR SESIÓN
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                      borderRadius: 10, background: "#1a365d",
                      border: "none", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700,
                    }}
                  >
                    <LogIn size={14} />
                    <span className="hidden md:inline">Entrar</span>
                  </button>
                )}

                {/* Hamburger - mobile only */}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="flex md:hidden"
                  style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", alignItems: "center", justifyContent: "center" }}
                >
                  <Menu size={18} color="rgba(255,255,255,0.8)" />
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* Mobile Menu Overlay — SOLO LEVELING SYSTEM HUD */}
      {mobileMenuOpen && (
        <div
          className="md:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}
          onClick={() => setMobileMenuOpen(false)}
        >
          {/* Backdrop with cyan tint */}
          <div style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(ellipse at left, rgba(0,40,80,0.7), rgba(0,0,0,0.85))",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }} />

          {/* Drawer */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", width: 296, height: "100%",
              background: "linear-gradient(180deg, #050714 0%, #07091F 50%, #04060F 100%)",
              borderRight: "1px solid rgba(56,189,248,0.35)",
              boxShadow: "inset -1px 0 0 rgba(125,211,252,0.12), 8px 0 40px rgba(56,189,248,0.18), 0 0 60px rgba(56,189,248,0.08)",
              display: "flex", flexDirection: "column", overflowY: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            }}
          >
            {/* Background — animated grid + scanlines */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: "linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.05) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              maskImage: "radial-gradient(ellipse at 30% 0%, black 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse at 30% 0%, black 0%, transparent 70%)",
            }} />
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 3px, rgba(125,211,252,0.025) 3px, rgba(125,211,252,0.025) 4px)",
              opacity: 0.7,
            }} />
            {/* Top accent bar (system stripe) */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg, transparent, #38BDF8, #6366F1, #38BDF8, transparent)",
              boxShadow: "0 0 12px rgba(56,189,248,0.6)",
            }} />
            {/* Bottom accent */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
              background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)",
            }} />

            {/* Drawer header */}
            <div style={{ position: "relative", padding: "16px 18px 14px", borderBottom: "1px solid rgba(56,189,248,0.18)" }}>
              <div style={{
                fontSize: 9, letterSpacing: 2.5, color: "#38BDF8", fontWeight: 800,
                marginBottom: 10, textTransform: "uppercase",
                textShadow: "0 0 10px rgba(56,189,248,0.6)",
              }}>
                <span style={{ color: "#7DD3FC" }}>{"["}</span> Sistema · Menú_Activo <span style={{ color: "#7DD3FC" }}>{"]"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Link href="/" onClick={() => setMobileMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", minWidth: 0, flex: 1 }}>
                  <div style={{
                    position: "relative",
                    width: 36, height: 36,
                    clipPath: "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)",
                    background: "linear-gradient(135deg, #1E40AF 0%, #4F46E5 50%, #38BDF8 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 18px rgba(56,189,248,0.55), inset 0 0 0 1px rgba(255,255,255,0.18)",
                    flexShrink: 0,
                  }}>
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 900, marginLeft: 1 }}>▶</span>
                  </div>
                  <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: 0.5, lineHeight: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    <span style={{ color: "#F1F1F5" }}>Anime</span>
                    <span style={{
                      background: "linear-gradient(135deg,#7DD3FC,#38BDF8,#6366F1)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                      filter: "drop-shadow(0 0 8px rgba(56,189,248,0.5))",
                    }}>FLEX</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    padding: 7, cursor: "pointer", display: "flex",
                    clipPath: "polygon(20% 0, 100% 0, 100% 80%, 80% 100%, 0 100%, 0 20%)",
                    background: "rgba(56,189,248,0.1)",
                    border: "1px solid rgba(56,189,248,0.4)",
                    boxShadow: "0 0 8px rgba(56,189,248,0.25), inset 0 0 0 1px rgba(56,189,248,0.1)",
                    flexShrink: 0,
                  }}
                >
                  <X size={15} color="#7DD3FC" />
                </button>
              </div>
            </div>

            {/* Nav items */}
            <div style={{ position: "relative", padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{
                fontSize: 9, letterSpacing: 2, color: "rgba(125,211,252,0.55)",
                fontWeight: 700, padding: "4px 8px 8px", textTransform: "uppercase",
              }}>
                ▸ Categorías_disponibles
              </div>
              {mobileNavItems.map(({ label, icon, href }, i) => {
                const active = isActive(href);
                return (
                  <button
                    key={href}
                    onClick={() => { navigate(href); setMobileMenuOpen(false); }}
                    style={{
                      position: "relative",
                      display: "flex", alignItems: "center", gap: 11, padding: "11px 14px 11px 12px",
                      border: active ? "1px solid rgba(56,189,248,0.55)" : "1px solid rgba(125,211,252,0.08)",
                      borderLeft: active ? "3px solid #38BDF8" : "3px solid transparent",
                      background: active
                        ? "linear-gradient(90deg, rgba(56,189,248,0.22) 0%, rgba(56,189,248,0.06) 50%, rgba(56,189,248,0.02) 100%)"
                        : "rgba(125,211,252,0.025)",
                      color: active ? "#F1F1F5" : "rgba(255,255,255,0.7)",
                      cursor: "pointer", textAlign: "left",
                      clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)",
                      boxShadow: active
                        ? "inset 0 0 14px rgba(56,189,248,0.2), 0 0 18px rgba(56,189,248,0.18)"
                        : "none",
                      transition: "all 0.18s ease",
                      fontSize: 13.5, fontWeight: 600,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      letterSpacing: 0.3,
                    }}
                  >
                    <span style={{
                      color: active ? "#38BDF8" : "rgba(125,211,252,0.4)",
                      fontSize: 9, fontWeight: 800, letterSpacing: 1.2,
                      minWidth: 26, textAlign: "right",
                    }}>
                      {String(i + 1).padStart(3, "0")}
                    </span>
                    <span style={{
                      color: active ? "#7DD3FC" : "rgba(125,211,252,0.55)",
                      display: "flex",
                      filter: active ? "drop-shadow(0 0 6px rgba(56,189,248,0.7))" : "none",
                    }}>
                      {icon}
                    </span>
                    <span style={{ flex: 1 }}>{label}</span>
                    {active && (
                      <span style={{
                        color: "#38BDF8", fontSize: 11, fontWeight: 800, letterSpacing: 1,
                        textShadow: "0 0 8px rgba(56,189,248,0.8)",
                      }}>◢</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Divider — system separator */}
            <div style={{
              position: "relative", height: 12, margin: "6px 18px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)" }} />
              <span style={{ color: "rgba(125,211,252,0.45)", fontSize: 8, fontWeight: 700, letterSpacing: 1.5 }}>◇ ◇ ◇</span>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)" }} />
            </div>

            {/* Aleatorio */}
            <div style={{ position: "relative", padding: "8px 12px" }}>
              <button
                onClick={() => { handleRandom(); setMobileMenuOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", width: "100%",
                  border: "1px solid rgba(56,189,248,0.35)",
                  cursor: "pointer",
                  background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(99,102,241,0.06))",
                  color: "#7DD3FC",
                  fontSize: 13.5, fontWeight: 700,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: 0.5,
                  clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
                  boxShadow: "0 0 14px rgba(56,189,248,0.18), inset 0 0 0 1px rgba(125,211,252,0.08)",
                }}
              >
                <Shuffle size={16} color="#38BDF8" style={{ filter: "drop-shadow(0 0 6px rgba(56,189,248,0.5))" }} />
                <span>Skill_Aleatorio</span>
              </button>
            </div>

            {/* Divider */}
            <div style={{
              position: "relative", height: 12, margin: "6px 18px",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)" }} />
              <span style={{ color: "rgba(125,211,252,0.45)", fontSize: 8, fontWeight: 700, letterSpacing: 1.5 }}>◇ ◇ ◇</span>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)" }} />
            </div>

            {/* Auth section */}
            <div style={{ position: "relative", padding: "8px 12px 16px", marginTop: "auto" }}>
              {user ? (
                <>
                  <div style={{
                    position: "relative",
                    background: "linear-gradient(135deg, rgba(56,189,248,0.1) 0%, rgba(99,102,241,0.05) 100%)",
                    border: "1px solid rgba(56,189,248,0.3)",
                    boxShadow: "inset 0 0 0 1px rgba(125,211,252,0.06), 0 0 16px rgba(56,189,248,0.12)",
                    marginBottom: 8, overflow: "hidden",
                    clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                      <div style={{
                        width: 44, height: 44,
                        clipPath: "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)",
                        background: "linear-gradient(135deg, #1E40AF, #38BDF8)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        boxShadow: "0 0 14px rgba(56,189,248,0.4), inset 0 0 0 1px rgba(255,255,255,0.15)",
                        overflow: "hidden",
                      }}>
                        {resolveAvatarUrl(user.avatar_url)
                          ? <img src={resolveAvatarUrl(user.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <User size={20} color="#fff" />
                        }
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#38BDF8", fontWeight: 700, letterSpacing: 1.5, marginBottom: 2 }}>
                          [ JUGADOR ]
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                          <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{user.username}</span>
                          {isOwner && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(56,189,248,0.18)", border: "1px solid rgba(56,189,248,0.5)", padding: "1px 5px", fontSize: 8, fontWeight: 800, color: "#7DD3FC", letterSpacing: 1, fontFamily: "ui-monospace, monospace" }}>
                              <Shield size={8} /> ADMIN
                            </span>
                          )}
                          {isMegaFan && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", padding: "1px 5px", fontSize: 8, fontWeight: 800, color: "#FCD34D", letterSpacing: 1, fontFamily: "ui-monospace, monospace" }}>
                              <Crown size={8} /> RANK_S
                            </span>
                          )}
                        </div>
                        <div style={{ color: "rgba(125,211,252,0.5)", fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }}>{user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { navigate("/membership"); setMobileMenuOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px",
                        border: "none", borderTop: "1px solid rgba(56,189,248,0.2)",
                        cursor: "pointer",
                        background: isMegaFan ? "rgba(252,211,77,0.06)" : "rgba(56,189,248,0.05)",
                        color: isMegaFan ? "#FCD34D" : "rgba(125,211,252,0.75)",
                        fontSize: 12, fontWeight: 700,
                        letterSpacing: 0.8,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      }}
                    >
                      <Crown size={14} color={isMegaFan ? "#FCD34D" : "#7DD3FC"} />
                      {isMegaFan ? "Rank_S · Activo" : "Subir_de_Rango"}
                    </button>
                  </div>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px",
                      border: "1px solid rgba(239,68,68,0.35)",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.04))",
                      color: "#FCA5A5", fontSize: 13, fontWeight: 700,
                      letterSpacing: 0.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)",
                      boxShadow: "0 0 12px rgba(239,68,68,0.12)",
                    }}
                  >
                    <LogOut size={15} /> Salir_del_Sistema
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowAuthModal(true); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", padding: "13px 14px",
                    border: "1px solid rgba(56,189,248,0.5)",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, rgba(56,189,248,0.25) 0%, rgba(99,102,241,0.18) 100%)",
                    color: "#fff", fontSize: 13.5, fontWeight: 800,
                    letterSpacing: 1,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
                    boxShadow: "0 0 18px rgba(56,189,248,0.35), inset 0 0 0 1px rgba(125,211,252,0.15)",
                    textShadow: "0 0 10px rgba(56,189,248,0.5)",
                  }}
                >
                  <LogIn size={16} /> Iniciar_Sesión
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}

function NavBtn({
  href, icon, label, active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 5, padding: "6px 10px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          color: active ? "#fff" : "rgba(255,255,255,0.55)",
          background: active ? "rgba(255,255,255,0.08)" : "none",
          transition: "color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLDivElement).style.color = "#F1F1F5"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"; } }}
        onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLDivElement).style.background = "none"; } }}
      >
        {icon}
        <span>{label}</span>
      </div>
    </Link>
  );
}
