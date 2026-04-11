import { Link, useLocation } from "wouter";
import { Search, Bookmark, Clock, Home, Film, Tv2, Calendar, Shuffle, Bell, ChevronDown, X, Star, ListVideo, Menu, LogIn, LogOut, User, Crown, Shield, ChevronRight, Zap, Settings, Camera, Rss, LayoutDashboard } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useWatchList } from "@/context/WatchListContext";
import { useHistory } from "@/context/HistoryContext";
import { NotificationManager } from "@/components/NotificationManager";
import AuthModal from "@/components/AuthModal";
import { resolveAvatarUrl } from "@/lib/utils";

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

  const mobileNavItems = [
    { label: "Inicio", icon: <Home size={18} />, href: "/" },
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
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: "rgba(7,7,20,0.82)", backdropFilter: "blur(24px) saturate(1.6)", WebkitBackdropFilter: "blur(24px) saturate(1.6)", borderBottom: "1px solid rgba(139,92,246,0.28)", boxShadow: "0 1px 0 rgba(139,92,246,0.15), 0 4px 30px rgba(0,0,0,0.5)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: 56 }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0, marginRight: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#8B5CF6,#6D28D9)" }}>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>▶</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>
              <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#8B5CF6" }}>FLEX</span>
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
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(139,92,246,0.4)",
                    color: "#F1F1F5", fontSize: 14, outline: "none", fontFamily: "inherit",
                  }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300,
                    background: "#100e22", border: "1px solid rgba(139,92,246,0.3)", borderTop: "none",
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
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(139,92,246,0.12)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <img src={anime.image} alt={title} style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }} className="line-clamp-1">{title}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                              {anime.type && <span style={{ color: "#8B5CF6", fontSize: 10, fontWeight: 700 }}>{anime.type}</span>}
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
                        padding: "9px 14px", color: "#8B5CF6", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(139,92,246,0.08)")}
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
                <NavBtn href="/movies" icon={<Film size={15} />} label="Películas" active={isActive("/movies")} />
                <NavBtn href="/ovas" icon={<Tv2 size={15} />} label="OVAs" active={isActive("/ovas")} />
                <NavBtn href="/schedule" icon={<Calendar size={15} />} label="Horario" active={isActive("/schedule")} />

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
                        { label: "Mi Lista", icon: <ListVideo size={14} />, href: "/watchlist" },
                        { label: "Favoritos", icon: <Bookmark size={14} />, href: "/favorites" },
                        { label: "Historial", icon: <Clock size={14} />, href: "/history" },
                        { label: "Feed", icon: <Rss size={14} />, href: "/feed" },
                      ].map(({ label, icon, href }) => (
                        <button key={href} onClick={() => { navigate(href); setMoreOpen(false); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
                            background: isActive(href) ? "rgba(139,92,246,0.15)" : "none", border: "none",
                            borderRadius: 10, cursor: "pointer",
                            color: isActive(href) ? "#C4B5FD" : "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600,
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
                    background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
                    color: "#C4B5FD", fontSize: 12, fontWeight: 700, cursor: "pointer",
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
                        borderRadius: 10, background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#8B5CF6,#6D28D9)",
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        {resolveAvatarUrl(user.avatar_url)
                          ? <img src={resolveAvatarUrl(user.avatar_url)!} style={{ width: "100%", height: "100%", borderRadius: 8, objectFit: "cover" }} />
                          : <User size={14} color="#fff" />
                        }
                      </div>
                      <span className="hidden md:flex" style={{ color: "#C4B5FD", fontSize: 12, fontWeight: 700, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", alignItems: "center", gap: 4 }}>
                        {user.username}
                        {isOwner && <span title="Dueño" style={{ fontSize: 11 }}>🔧</span>}
                        {isMegaFan && <Crown size={11} color="#F59E0B" />}
                      </span>
                    </button>

                    {showUserMenu && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 200,
                        background: "linear-gradient(180deg,#14122a 0%,#111220 100%)",
                        border: "1px solid rgba(139,92,246,0.2)", borderRadius: 18,
                        overflow: "hidden", minWidth: 280,
                        boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.1) inset",
                      }}>
                        {/* Banner + Avatar */}
                        <div style={{ position: "relative", height: 72, background: "linear-gradient(135deg,#2D1B69 0%,#1A1A3E 50%,#0D0D1F 100%)", overflow: "hidden" }}>
                          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 50%,rgba(139,92,246,0.35) 0%,transparent 70%)" }} />
                          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 50%,rgba(245,158,11,0.12) 0%,transparent 70%)" }} />
                          {/* Decorative dots */}
                          <div style={{ position: "absolute", top: 10, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(139,92,246,0.15)", filter: "blur(8px)" }} />
                          <div style={{ position: "absolute", top: 30, right: 50, width: 20, height: 20, borderRadius: "50%", background: "rgba(245,158,11,0.1)", filter: "blur(4px)" }} />
                        </div>

                        {/* Avatar overlapping banner */}
                        <div style={{ padding: "0 16px", marginTop: -28, position: "relative", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                          <button onClick={() => { navigate("/settings"); setShowUserMenu(false); }}
                            title="Cambiar foto de perfil"
                            style={{
                              position: "relative", width: 56, height: 56, borderRadius: 16, padding: 0, border: "none",
                              background: "linear-gradient(135deg,#8B5CF6,#6D28D9)",
                              boxShadow: "0 4px 16px rgba(139,92,246,0.5)",
                              overflow: "hidden", flexShrink: 0, cursor: "pointer",
                              outline: "3px solid #14122a",
                            }}
                          >
                            {resolveAvatarUrl(user.avatar_url)
                              ? <img src={resolveAvatarUrl(user.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <span style={{ color: "#fff", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
                                  {user.username.charAt(0).toUpperCase()}
                                </span>
                            }
                            <div style={{
                              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                              background: "rgba(0,0,0,0.5)", opacity: 0, transition: "opacity 0.2s",
                            }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                            >
                              <Camera size={16} color="#fff" />
                            </div>
                          </button>
                          {/* Badges row */}
                          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                            {isOwner && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 3,
                                background: "linear-gradient(135deg,rgba(239,68,68,0.3),rgba(239,68,68,0.15))",
                                border: "1px solid rgba(239,68,68,0.6)", borderRadius: 100,
                                padding: "3px 8px", fontSize: 9, fontWeight: 900, color: "#FCA5A5",
                                letterSpacing: 0.5,
                              }}>
                                <Shield size={8} /> DUEÑO
                              </span>
                            )}
                            {isMegaFan && (
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 3,
                                background: "linear-gradient(135deg,rgba(245,158,11,0.3),rgba(139,92,246,0.2))",
                                border: "1px solid rgba(245,158,11,0.6)", borderRadius: 100,
                                padding: "3px 8px", fontSize: 9, fontWeight: 900, color: "#FCD34D",
                                letterSpacing: 0.5,
                              }}>
                                <Crown size={8} /> MEGAFAN
                              </span>
                            )}
                          </div>
                        </div>

                        {/* User info */}
                        <div style={{ padding: "8px 16px 12px" }}>
                          <div style={{ color: "#F1F1F5", fontSize: 16, fontWeight: 900, letterSpacing: -0.3 }}>{user.username}</div>
                          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block", flexShrink: 0 }} />
                            {user.email}
                          </div>
                          {user.created_at && (
                            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, marginTop: 4 }}>
                              Miembro desde {new Date(user.created_at).toLocaleDateString("es", { month: "long", year: "numeric" })}
                            </div>
                          )}
                        </div>

                        {/* Stats */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                          margin: "0 12px 12px", borderRadius: 12,
                          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
                          overflow: "hidden",
                        }}>
                          {[
                            { label: "Favoritos", value: favorites.length, icon: <Bookmark size={13} color="#C4B5FD" />, href: "/favorites" },
                            { label: "Mi Lista", value: watchList.length, icon: <ListVideo size={13} color="#8B5CF6" />, href: "/watchlist" },
                            { label: "Historial", value: history.length, icon: <Clock size={13} color="#34D399" />, href: "/history" },
                          ].map(({ label, value, icon, href }, i) => (
                            <button key={href} onClick={() => { navigate(href); setShowUserMenu(false); }}
                              style={{
                                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                padding: "10px 4px", gap: 3, background: "none", border: "none",
                                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                                cursor: "pointer", transition: "background 0.15s",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(139,92,246,0.1)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                            >
                              {icon}
                              <span style={{ color: "#F1F1F5", fontSize: 15, fontWeight: 900 }}>{value}</span>
                              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Membership banner */}
                        <div style={{ margin: "0 12px 10px" }}>
                          <button
                            onClick={() => { navigate("/membership"); setShowUserMenu(false); }}
                            style={{
                              width: "100%", display: "flex", alignItems: "center", gap: 10,
                              padding: "11px 14px",
                              background: isMegaFan
                                ? "linear-gradient(135deg,rgba(139,92,246,0.2),rgba(245,158,11,0.1))"
                                : "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(79,70,229,0.08))",
                              border: isMegaFan ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(139,92,246,0.35)",
                              borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                              background: isMegaFan ? "linear-gradient(135deg,#F59E0B,#D97706)" : "linear-gradient(135deg,#8B5CF6,#6D28D9)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: isMegaFan ? "0 4px 12px rgba(245,158,11,0.4)" : "0 4px 12px rgba(139,92,246,0.4)",
                            }}>
                              {isMegaFan ? <Crown size={16} color="#fff" /> : <Zap size={16} color="#fff" />}
                            </div>
                            <div style={{ flex: 1, textAlign: "left" }}>
                              <div style={{ color: isMegaFan ? "#FCD34D" : "#C4B5FD", fontSize: 12, fontWeight: 800 }}>
                                {isMegaFan ? "Membresía MegaFan activa" : "Hazte MegaFan"}
                              </div>
                              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 1 }}>
                                {isMegaFan ? "Sin anuncios · Acceso premium" : "Desbloquea todo el contenido"}
                              </div>
                            </div>
                            <ChevronRight size={14} color="rgba(255,255,255,0.3)" />
                          </button>
                        </div>

                        {/* Quick links */}
                        <div style={{ margin: "0 12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 6 }}>
                          {[
                            ...(isOwner ? [{ icon: <LayoutDashboard size={13} />, label: "Panel de Admin", href: "/admin", color: "#C4B5FD" }] : []),
                            { icon: <User size={13} />, label: "Mi Perfil", href: "/perfil", color: "rgba(255,255,255,0.55)" },
                            { icon: <Settings size={13} />, label: "Configuración", href: "/settings", color: "rgba(255,255,255,0.55)" },
                          ].map(({ icon, label, href, color }) => (
                            <button key={href} onClick={() => { navigate(href); setShowUserMenu(false); }}
                              style={{
                                display: "flex", alignItems: "center", gap: 9, width: "100%",
                                padding: "9px 10px", background: "none", border: "none",
                                borderRadius: 10, cursor: "pointer", color,
                                fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "#F1F1F5"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; (e.currentTarget as HTMLButtonElement).style.color = color; }}
                            >
                              {icon} {label}
                            </button>
                          ))}
                        </div>

                        {/* Logout */}
                        <div style={{ margin: "6px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 6 }}>
                          <button
                            onClick={() => { logout(); setShowUserMenu(false); }}
                            style={{
                              display: "flex", alignItems: "center", gap: 9, width: "100%",
                              padding: "9px 10px", background: "none", border: "none",
                              borderRadius: 10, cursor: "pointer",
                              color: "#FCA5A5", fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                          >
                            <LogOut size={13} /> Cerrar sesión
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
                      borderRadius: 10, background: "linear-gradient(135deg,#8B5CF6,#6D28D9)",
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}
          onClick={() => setMobileMenuOpen(false)}
        >
          {/* Backdrop */}
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />

          {/* Drawer */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative", width: 280, height: "100%",
              background: "#0D0D1A", borderRight: "1px solid rgba(255,255,255,0.08)",
              display: "flex", flexDirection: "column", overflowY: "auto",
            }}
          >
            {/* Drawer header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <Link href="/" onClick={() => setMobileMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#8B5CF6,#6D28D9)" }}>
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>▶</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 900 }}>
                  <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#8B5CF6" }}>FLEX</span>
                </span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex" }}
              >
                <X size={16} color="rgba(255,255,255,0.65)" />
              </button>
            </div>

            {/* Nav items */}
            <div style={{ padding: "12px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
              {mobileNavItems.map(({ label, icon, href }) => (
                <button
                  key={href}
                  onClick={() => { navigate(href); setMobileMenuOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "13px 16px",
                    borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left",
                    background: isActive(href) ? "rgba(139,92,246,0.15)" : "transparent",
                    color: isActive(href) ? "#C4B5FD" : "rgba(255,255,255,0.75)",
                    fontSize: 15, fontWeight: 600,
                    borderLeft: isActive(href) ? "3px solid #8B5CF6" : "3px solid transparent",
                  }}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 20px" }} />

            {/* Aleatorio */}
            <div style={{ padding: "12px 12px" }}>
              <button
                onClick={() => { handleRandom(); setMobileMenuOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", width: "100%",
                  borderRadius: 12, border: "1px solid rgba(139,92,246,0.3)", cursor: "pointer",
                  background: "rgba(139,92,246,0.1)", color: "#C4B5FD", fontSize: 15, fontWeight: 600,
                }}
              >
                <Shuffle size={18} /> Anime Aleatorio
              </button>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 20px" }} />

            {/* Auth section */}
            <div style={{ padding: "12px 12px", marginTop: "auto" }}>
              {user ? (
                <>
                  <div style={{ background: "rgba(139,92,246,0.08)", borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#8B5CF6,#6D28D9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {resolveAvatarUrl(user.avatar_url)
                          ? <img src={resolveAvatarUrl(user.avatar_url)!} style={{ width: "100%", height: "100%", borderRadius: 10, objectFit: "cover" }} />
                          : <User size={20} color="#fff" />
                        }
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 2 }}>
                          <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>{user.username}</span>
                          {isOwner && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 100, padding: "1px 6px", fontSize: 9, fontWeight: 800, color: "#F87171" }}>
                              🔧 DUEÑO
                            </span>
                          )}
                          {isMegaFan && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 100, padding: "1px 6px", fontSize: 9, fontWeight: 800, color: "#F59E0B" }}>
                              <Crown size={8} /> MEGAFAN
                            </span>
                          )}
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => { navigate("/membership"); setMobileMenuOpen(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px",
                        borderTop: "1px solid rgba(255,255,255,0.06)", border: "none", cursor: "pointer",
                        background: "none", color: isMegaFan ? "#C4B5FD" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600,
                      }}
                    >
                      <Crown size={15} color={isMegaFan ? "#C4B5FD" : undefined} />
                      {isMegaFan ? "Membresía MegaFan ⚡" : "Hazte MegaFan"}
                    </button>
                  </div>
                  <button
                    onClick={() => { logout(); setMobileMenuOpen(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 16px",
                      borderRadius: 12, border: "none", cursor: "pointer",
                      background: "rgba(239,68,68,0.1)", color: "#FCA5A5", fontSize: 14, fontWeight: 700,
                    }}
                  >
                    <LogOut size={18} /> Cerrar sesión
                  </button>
                </>
              ) : (
                <button
                  onClick={() => { setMobileMenuOpen(false); setShowAuthModal(true); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", padding: "14px 16px",
                    borderRadius: 12, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg,#8B5CF6,#6D28D9)", color: "#fff", fontSize: 15, fontWeight: 800,
                  }}
                >
                  <LogIn size={18} /> Iniciar sesión / Registrarse
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
          color: active ? "#C4B5FD" : "rgba(255,255,255,0.55)",
          background: active ? "rgba(139,92,246,0.12)" : "none",
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
