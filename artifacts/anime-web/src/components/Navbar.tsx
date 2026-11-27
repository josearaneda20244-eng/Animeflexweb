import { Link, useLocation } from "wouter";
import {
  Search, Bookmark, Clock, Home, Film, Tv2, Calendar, Shuffle, ChevronDown, X, Star, ListVideo, Menu,
  LogIn, LogOut, User, Crown, Shield, Settings, Rss, LayoutDashboard, BookOpen, Newspaper, Compass, Download, CornerDownLeft,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import { useWatchList } from "@/context/WatchListContext";
import { useHistory } from "@/context/HistoryContext";
import { NotificationManager } from "@/components/NotificationManager";
import AuthModal from "@/components/AuthModal";
import { resolveAvatarUrl } from "@/lib/utils";

const LANDING_URL = "https://anime-app-landing.vercel.app";

const MAIN_LINKS = [
  { label: "Inicio", href: "/", icon: Home },
  { label: "Explorar", href: "/search", icon: Compass },
  { label: "Manga", href: "/manga", icon: BookOpen },
  { label: "Películas", href: "/movies", icon: Film },
  { label: "Horario", href: "/schedule", icon: Calendar },
];

const MORE_LINKS = [
  { label: "OVAs y especiales", href: "/ovas", icon: Tv2 },
  { label: "Noticias", href: "/noticias", icon: Newspaper },
  { label: "Comunidad", href: "/feed", icon: Rss },
];

const LIBRARY_LINKS = [
  { label: "Mi lista", href: "/watchlist", icon: ListVideo },
  { label: "Favoritos", href: "/favorites", icon: Bookmark },
  { label: "Historial", href: "/history", icon: Clock },
];

/**
 * Barra de navegación global de IZIFF ANIME.
 * @param transparent — empieza transparente sobre un hero y se vuelve sólida al hacer scroll.
 */
export default function Navbar({ transparent = false }: { transparent?: boolean }) {
  const [location, navigate] = useLocation();
  const { user, logout, isMegaFan, isOwner } = useAuth();
  const { favorites } = useFavorites();
  const { watchList } = useWatchList();
  const { history } = useHistory();

  const [solid, setSolid] = useState(!transparent);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => (path === "/" ? location === "/" : location === path || location.startsWith(path + "/"));

  // Transparente → sólida al hacer scroll
  useEffect(() => {
    if (!transparent) { setSolid(true); return; }
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparent]);

  // Cerrar menús al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Cerrar todo al cambiar de ruta
  useEffect(() => { setMoreOpen(false); setUserOpen(false); setDrawerOpen(false); setCmdOpen(false); }, [location]);

  // Atajo Ctrl/Cmd+K y "/" para buscar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setCmdOpen(true); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Padding inferior para la barra de pestañas móvil
  useEffect(() => {
    document.body.classList.add("iz-has-tabbar");
    return () => document.body.classList.remove("iz-has-tabbar");
  }, []);

  // Bloquear scroll con drawer abierto
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const handleRandom = useCallback(async () => {
    try {
      const res = await consumet.trending();
      const list = res.results ?? [];
      if (list.length > 0) navigate(`/anime/${list[Math.floor(Math.random() * list.length)].id}`);
    } catch { /* sin conexión: ignorar */ }
  }, [navigate]);

  const avatar = user ? resolveAvatarUrl(user.avatar_url) : null;
  const moreActive = MORE_LINKS.some((l) => isActive(l.href));

  return (
    <>
      <nav className={`iz-nav ${transparent ? (solid ? "is-solid" : "") : "is-static"}`} aria-label="Principal">
        <div className="iz-nav__inner">
          <Link href="/" className="iz-brand" aria-label="IZIFF ANIME — inicio">
            <img src="/icon.svg" alt="" width={34} height={34} />
            <b>IZIFF ANIME</b>
            <small className="iz-hide-m">WEB</small>
          </Link>

          <div className="iz-nav__links">
            {MAIN_LINKS.map(({ label, href }) => (
              <Link key={href} href={href} className={`iz-nav__link ${isActive(href) ? "is-active" : ""}`}>{label}</Link>
            ))}
            <div ref={moreRef} style={{ position: "relative" }}>
              <button type="button" className={`iz-nav__link ${moreActive ? "is-active" : ""}`} onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
                Más <ChevronDown size={14} style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>
              {moreOpen && (
                <div className="iz-menu" style={{ left: 0, right: "auto" }}>
                  {MORE_LINKS.map(({ label, href, icon: Icon }) => (
                    <button key={href} type="button" className={`iz-menu__item ${isActive(href) ? "is-active" : ""}`} onClick={() => navigate(href)}>
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                  <div className="iz-menu__sep" />
                  <div className="iz-menu__label">Tu biblioteca</div>
                  {LIBRARY_LINKS.map(({ label, href, icon: Icon }) => (
                    <button key={href} type="button" className={`iz-menu__item ${isActive(href) ? "is-active" : ""}`} onClick={() => navigate(href)}>
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="iz-nav__spacer" />

          <div className="iz-nav__actions">
            <button type="button" className="iz-nav__search" onClick={() => setCmdOpen(true)} aria-label="Buscar anime">
              <Search size={16} /> <span>Buscar anime…</span> <kbd>Ctrl K</kbd>
            </button>
            <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm iz-show-m" onClick={() => setCmdOpen(true)} aria-label="Buscar">
              <Search size={17} />
            </button>
            <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm iz-hide-m" onClick={handleRandom} title="Anime aleatorio" aria-label="Anime aleatorio">
              <Shuffle size={16} />
            </button>
            <a href={`${LANDING_URL}/#descargas`} target="_blank" rel="noopener noreferrer" className="iz-btn iz-btn--ghost iz-btn--sm iz-hide-m">
              <Download size={15} /> App
            </a>
            <NotificationManager />

            {user ? (
              <div ref={userRef} style={{ position: "relative" }}>
                <button type="button" onClick={() => setUserOpen((v) => !v)} aria-label="Menú de usuario" aria-expanded={userOpen}
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "flex", position: "relative" }}>
                  <span className="iz-avatar">{avatar ? <img src={avatar} alt="" /> : user.username.charAt(0).toUpperCase()}</span>
                  {isMegaFan && <Crown size={12} color="#fbbf24" fill="#fbbf24" style={{ position: "absolute", top: -5, right: -5 }} />}
                </button>
                {userOpen && (
                  <div className="iz-menu" style={{ width: 280 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 8px 12px" }}>
                      <span className="iz-avatar" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 17 }}>{avatar ? <img src={avatar} alt="" /> : user.username.charAt(0).toUpperCase()}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, fontSize: 14 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.username}</span>
                          {isOwner && <span className="iz-tag" style={{ padding: "1px 5px", fontSize: 9 }}><Shield size={9} />ADMIN</span>}
                        </div>
                        <div style={{ color: "var(--iz-dim)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4, padding: "0 4px 8px" }}>
                      {[{ n: favorites.length, l: "Favoritos", h: "/favorites" }, { n: watchList.length, l: "En lista", h: "/watchlist" }, { n: history.length, l: "Vistos", h: "/history" }].map((s) => (
                        <button key={s.h} type="button" onClick={() => navigate(s.h)} className="iz-menu__item" style={{ flexDirection: "column", gap: 2, padding: "8px 4px", background: "rgba(255,255,255,.03)" }}>
                          <b style={{ fontSize: 16, color: "#fff", fontFamily: "var(--iz-mono)" }}>{s.n}</b>
                          <small style={{ fontSize: 11, color: "var(--iz-dim)" }}>{s.l}</small>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="iz-menu__item" onClick={() => navigate("/membership")}
                      style={{ background: isMegaFan ? "rgba(251,191,36,.08)" : "rgba(63,46,178,.18)", border: `1px solid ${isMegaFan ? "rgba(251,191,36,.25)" : "rgba(99,102,241,.35)"}`, marginBottom: 6 }}>
                      <Crown size={16} color={isMegaFan ? "#fbbf24" : "#c7d2fe"} />
                      <span style={{ flex: 1 }}>{isMegaFan ? "MegaFan activo" : "Hazte MegaFan"}</span>
                    </button>
                    <div className="iz-menu__sep" />
                    {isOwner && <button type="button" className="iz-menu__item" onClick={() => navigate("/admin")}><LayoutDashboard size={16} /> Panel de admin</button>}
                    <button type="button" className="iz-menu__item" onClick={() => navigate("/perfil")}><User size={16} /> Mi perfil</button>
                    <button type="button" className="iz-menu__item" onClick={() => navigate("/settings")}><Settings size={16} /> Ajustes</button>
                    <div className="iz-menu__sep" />
                    <button type="button" className="iz-menu__item iz-menu__item--danger" onClick={() => { logout(); setUserOpen(false); }}><LogOut size={16} /> Cerrar sesión</button>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" className="iz-btn iz-btn--primary iz-btn--sm" onClick={() => setShowAuth(true)}>
                <LogIn size={15} /> <span className="iz-hide-m">Entrar</span>
              </button>
            )}

            <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm iz-show-m" onClick={() => setDrawerOpen(true)} aria-label="Abrir menú">
              <Menu size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Barra de pestañas móvil */}
      <div className="iz-tabbar" role="navigation" aria-label="Navegación móvil">
        <Link href="/" className={isActive("/") ? "is-active" : ""}><Home size={20} />Inicio</Link>
        <Link href="/search" className={isActive("/search") ? "is-active" : ""}><Compass size={20} />Explorar</Link>
        <Link href="/manga" className={isActive("/manga") ? "is-active" : ""}><BookOpen size={20} />Manga</Link>
        <Link href="/watchlist" className={isActive("/watchlist") ? "is-active" : ""}><ListVideo size={20} />Mi lista</Link>
        {user
          ? <Link href="/perfil" className={isActive("/perfil") ? "is-active" : ""}><User size={20} />Perfil</Link>
          : <button type="button" onClick={() => setShowAuth(true)}><LogIn size={20} />Entrar</button>}
      </div>

      {/* Drawer móvil */}
      {drawerOpen && (
        <div className="iz-drawer" onClick={() => setDrawerOpen(false)}>
          <div className="iz-drawer__panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Link href="/" className="iz-brand"><img src="/icon.svg" alt="" /><b>IZIFF ANIME</b></Link>
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm" onClick={() => setDrawerOpen(false)} aria-label="Cerrar"><X size={17} /></button>
            </div>
            <div className="iz-menu__label">Navegar</div>
            {[...MAIN_LINKS, ...MORE_LINKS].map(({ label, href, icon: Icon }) => (
              <button key={href} type="button" className={`iz-menu__item ${isActive(href) ? "is-active" : ""}`} onClick={() => navigate(href)}><Icon size={17} /> {label}</button>
            ))}
            <div className="iz-menu__sep" />
            <div className="iz-menu__label">Tu biblioteca</div>
            {LIBRARY_LINKS.map(({ label, href, icon: Icon }) => (
              <button key={href} type="button" className={`iz-menu__item ${isActive(href) ? "is-active" : ""}`} onClick={() => navigate(href)}><Icon size={17} /> {label}</button>
            ))}
            {isOwner && <button type="button" className="iz-menu__item" onClick={() => navigate("/admin")}><LayoutDashboard size={17} /> Panel de admin</button>}
            <div className="iz-menu__sep" />
            <button type="button" className="iz-menu__item" onClick={() => { setDrawerOpen(false); handleRandom(); }}><Shuffle size={17} /> Anime aleatorio</button>
            <a className="iz-menu__item" href={`${LANDING_URL}/#descargas`} target="_blank" rel="noopener noreferrer"><Download size={17} /> Descargar la app</a>
            <div style={{ marginTop: "auto", paddingTop: 16, display: "grid", gap: 8 }}>
              {user ? (
                <>
                  <button type="button" className="iz-btn iz-btn--accent" onClick={() => navigate("/membership")}><Crown size={16} /> {isMegaFan ? "MegaFan activo" : "Hazte MegaFan"}</button>
                  <button type="button" className="iz-btn iz-btn--ghost" onClick={() => { logout(); setDrawerOpen(false); }}><LogOut size={16} /> Cerrar sesión</button>
                </>
              ) : (
                <button type="button" className="iz-btn iz-btn--primary" onClick={() => { setDrawerOpen(false); setShowAuth(true); }}><LogIn size={16} /> Iniciar sesión</button>
              )}
            </div>
          </div>
        </div>
      )}

      {cmdOpen && <CommandSearch onClose={() => setCmdOpen(false)} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  );
}

/* ── Buscador tipo paleta de comandos (Ctrl+K) ── */
function CommandSearch({ onClose }: { onClose: () => void }) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { reqId.current++; setResults([]); setLoading(false); return; }
    const id = ++reqId.current;
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await consumet.search(q, 1);
        if (id === reqId.current) { setResults((res.results ?? []).slice(0, 8)); setSel(0); }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const goAll = () => { const q = query.trim(); if (q) { navigate(`/search?q=${encodeURIComponent(q)}`); onClose(); } };
  const goItem = (a: AnimeResult) => { navigate(`/anime/${a.id}`); onClose(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (results[sel]) goItem(results[sel]); else goAll(); }
  };

  return (
    <div className="iz-cmd" onMouseDown={onClose}>
      <div className="iz-cmd__box" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Buscar anime">
        <div className="iz-cmd__field">
          <Search size={18} color="#a1a1aa" />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder="Busca un anime por nombre…" aria-label="Buscar" />
          <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        <div className="iz-cmd__list">
          {query.trim().length < 2 && <div className="iz-cmd__empty">Escribe al menos 2 letras. Tip: pulsa <b>/</b> o <b>Ctrl K</b> desde cualquier página.</div>}
          {loading && results.length === 0 && query.trim().length >= 2 && <div className="iz-cmd__empty">Buscando…</div>}
          {!loading && query.trim().length >= 2 && results.length === 0 && <div className="iz-cmd__empty">Sin resultados para “{query}”.</div>}
          {results.map((a, i) => {
            const title = resolveTitle(a.title);
            const score = a.rating && a.rating > 0 ? (a.rating > 10 ? a.rating / 10 : a.rating) : null;
            return (
              <button key={a.id} type="button" className={`iz-cmd__row ${i === sel ? "is-sel" : ""}`} onMouseEnter={() => setSel(i)} onClick={() => goItem(a)}>
                <img src={a.image} alt="" loading="lazy" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, color: "var(--iz-dim)", fontSize: 12 }}>
                    {a.type && <span>{a.type}</span>}
                    {a.releaseDate && <span>{a.releaseDate}</span>}
                    {score && <span className="iz-score"><Star size={10} fill="currentColor" />{score.toFixed(1)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
          {results.length > 0 && (
            <button type="button" className="iz-cmd__row" onClick={goAll} style={{ justifyContent: "center", color: "var(--iz-muted)", fontSize: 13 }}>
              Ver todos los resultados <CornerDownLeft size={13} />
            </button>
          )}
        </div>
        <div className="iz-cmd__foot"><span>↑↓ navegar</span><span>↵ abrir</span><span>esc cerrar</span></div>
      </div>
    </div>
  );
}
