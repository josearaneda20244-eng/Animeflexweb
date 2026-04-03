import { Link, useLocation } from "wouter";
import { Search, Bookmark, Clock, Home, Film, Tv2, Calendar, Shuffle, Bell, ChevronDown, X, Star, ListVideo } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useNotifications } from "@/context/NotificationsContext";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Navbar() {
  const [location, navigate] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AnimeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const notifsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

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
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: "rgba(9,10,18,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: 56 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0, marginRight: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#6C63FF,#4F46E5)" }}>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 900 }}>▶</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>
            <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#6C63FF" }}>FLEX</span>
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
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(108,99,255,0.4)",
                  color: "#F1F1F5", fontSize: 14, outline: "none", fontFamily: "inherit",
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "100%", left: 0, right: 0, zIndex: 300,
                  background: "#13131C", border: "1px solid rgba(108,99,255,0.3)", borderTop: "none",
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
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(108,99,255,0.12)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <img src={anime.image} alt={title} style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }} className="line-clamp-1">{title}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                            {anime.type && <span style={{ color: "#6C63FF", fontSize: 10, fontWeight: 700 }}>{anime.type}</span>}
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
                  <div onClick={handleSearch as any}
                    style={{
                      padding: "9px 14px", color: "#6C63FF", fontSize: 12, fontWeight: 700,
                      cursor: "pointer", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(108,99,255,0.08)")}
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
            <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
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
                  className="hidden md:flex"
                >
                  Más <ChevronDown size={13} style={{ transform: moreOpen ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
                </button>
                {moreOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 200,
                    background: "#13131C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
                    padding: 8, minWidth: 160, boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                  }}>
                    {[
                      { label: "Mi Lista", icon: <ListVideo size={14} />, href: "/watchlist" },
                      { label: "Favoritos", icon: <Bookmark size={14} />, href: "/favorites" },
                      { label: "Historial", icon: <Clock size={14} />, href: "/history" },
                    ].map(({ label, icon, href }) => (
                      <button key={href} onClick={() => { navigate(href); setMoreOpen(false); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px",
                          background: isActive(href) ? "rgba(108,99,255,0.15)" : "none", border: "none",
                          borderRadius: 10, cursor: "pointer",
                          color: isActive(href) ? "#A78BFA" : "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600,
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

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={handleRandom}
                title="Anime aleatorio"
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10,
                  background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.25)",
                  color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}
                className="hidden md:flex"
              >
                <Shuffle size={14} /> Aleatorio
              </button>

              <button onClick={() => setSearchOpen(true)}
                style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex" }}>
                <Search size={17} color="rgba(255,255,255,0.65)" />
              </button>

              <div ref={notifsRef} style={{ position: "relative" }}>
                <button
                  onClick={() => { setShowNotifs((v) => !v); if (!showNotifs) markAllRead(); }}
                  style={{ position: "relative", padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex" }}
                >
                  <Bell size={17} color="rgba(255,255,255,0.65)" />
                  {unreadCount > 0 && (
                    <span style={{
                      position: "absolute", top: 4, right: 4, width: 14, height: 14,
                      background: "#EF4444", borderRadius: "50%", border: "2px solid #090A12",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 8, fontWeight: 900,
                    }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </button>

                {showNotifs && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 200,
                    background: "#13131C", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
                    padding: 0, width: 320, boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
                    maxHeight: 400, overflow: "hidden", display: "flex", flexDirection: "column",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Notificaciones</span>
                      {notifications.length > 0 && (
                        <button onClick={clearAll} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer" }}>Limpiar todo</button>
                      )}
                    </div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {notifications.length === 0 ? (
                        <div style={{ padding: "32px 16px", textAlign: "center" }}>
                          <Bell size={28} color="rgba(255,255,255,0.15)" style={{ margin: "0 auto 8px" }} />
                          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin notificaciones</div>
                        </div>
                      ) : (
                        notifications.slice(0, 20).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => { if (n.animeId) navigate(`/anime/${n.animeId}`); setShowNotifs(false); }}
                            style={{
                              display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
                              borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: n.animeId ? "pointer" : "default",
                              background: n.read ? "transparent" : "rgba(108,99,255,0.06)",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = n.read ? "transparent" : "rgba(108,99,255,0.06)"; }}
                          >
                            {n.animeImage ? (
                              <img src={n.animeImage} alt="" style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(108,99,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Bell size={16} color="#6C63FF" />
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ color: "#F1F1F5", fontSize: 12, fontWeight: 700, marginBottom: 2 }} className="line-clamp-1">{n.title}</div>
                              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }} className="line-clamp-2">{n.message}</div>
                              <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 4 }}>
                                {new Date(n.timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                            {!n.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6C63FF", flexShrink: 0, marginTop: 4 }} />}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <NavBtn href="/watchlist" icon={<ListVideo size={15} />} label="Mi Lista" active={isActive("/watchlist")} iconOnly />
              <NavBtn href="/favorites" icon={<Bookmark size={15} />} label="Favoritos" active={isActive("/favorites")} iconOnly />
              <NavBtn href="/history" icon={<Clock size={15} />} label="Historial" active={isActive("/history")} iconOnly />
            </div>
          </>
        )}
      </div>
    </nav>
  );
}

function NavBtn({
  href, icon, label, active, iconOnly = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  iconOnly?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{ textDecoration: "none" }}
      className={iconOnly ? "md:hidden" : ""}
    >
      <div
        style={{
          display: "flex", alignItems: "center", gap: 5, padding: iconOnly ? "8px" : "6px 10px",
          borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
          color: active ? "#A78BFA" : "rgba(255,255,255,0.55)",
          background: active ? "rgba(108,99,255,0.12)" : "none",
          transition: "color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLDivElement).style.color = "#F1F1F5"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.05)"; } }}
        onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLDivElement).style.color = "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLDivElement).style.background = "none"; } }}
      >
        {icon}
        {!iconOnly && <span className="hidden md:inline">{label}</span>}
      </div>
    </Link>
  );
}
