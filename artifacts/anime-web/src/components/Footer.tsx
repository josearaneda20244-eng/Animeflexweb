import { useLocation } from "wouter";

const GENRES = [
  { label: "Acción", q: "Action" },
  { label: "Aventura", q: "Adventure" },
  { label: "Comedia", q: "Comedy" },
  { label: "Drama", q: "Drama" },
  { label: "Fantasía", q: "Fantasy" },
  { label: "Terror", q: "Horror" },
  { label: "Romance", q: "Romance" },
  { label: "Sci-Fi", q: "Sci-Fi" },
  { label: "Shounen", q: "Shounen" },
  { label: "Isekai", q: "Isekai" },
];

const NAV_LINKS = [
  { label: "Inicio", to: "/" },
  { label: "Manga", to: "/manga" },
  { label: "Noticias", to: "/noticias" },
  { label: "Películas", to: "/movies" },
  { label: "OVAs & ONAs", to: "/ovas" },
  { label: "Horario", to: "/schedule" },
  { label: "Descargar Apps", to: "https://anime-app-landing.vercel.app/#descargas", external: true },
  { label: "Buscar", to: "/search" },
  { label: "Favoritos", to: "/favorites" },
  { label: "Historial", to: "/history" },
];

const LEGAL_LINKS = [
  { label: "Aviso Legal", href: "/legal/dmca" },
  { label: "Política de Privacidad", href: "/legal/dmca" },
  { label: "DMCA / Contacto", href: "/legal/dmca" },
  { label: "Términos de Uso", href: "/legal/dmca" },
  { label: "Sobre Nosotros", href: "/legal/dmca" },
];

const SOCIAL_LINKS = [
  {
    name: "Discord",
    url: "https://discord.gg",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.091.12 18.123.143 18.143a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" /></svg>
    ),
  },
  {
    name: "Telegram",
    url: "https://t.me",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
    ),
  },
  {
    name: "X / Twitter",
    url: "https://twitter.com",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
    ),
  },
];

const PARTNERS = [
  { label: "AniList", href: "https://anilist.co" },
  { label: "MyAnimeList", href: "https://myanimelist.net" },
  { label: "Kitsu", href: "https://kitsu.io" },
];

export default function Footer() {
  const [, navigate] = useLocation();
  const go = (to: string, external?: boolean) => {
    if (external) window.open(to, "_blank", "noopener,noreferrer");
    else { navigate(to); window.scrollTo({ top: 0 }); }
  };
  return (
    <footer className="iz-footer">
      <div className="iz-container" style={{ padding: "56px var(--iz-pad) 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 40 }}>
          <div style={{ maxWidth: 340 }}>
            <a href="/" onClick={(e) => { e.preventDefault(); go("/"); }} className="iz-brand">
              <img src="/icon.svg" alt="" />
              <b>IZIFF ANIME</b>
            </a>
            <p style={{ margin: "16px 0 0", color: "var(--iz-muted)", fontSize: 14, lineHeight: 1.6 }}>
              Anime y manga en <span className="iz-serif" style={{ color: "#fff", fontSize: 16 }}>1080p</span> con subtítulos en español latino y castellano. Web, Android y Windows.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              {SOCIAL_LINKS.map((s) => (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.name} className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm">{s.icon}</a>
              ))}
            </div>
          </div>
          <FooterCol title="Navegar">
            {NAV_LINKS.map((l) => <FooterLink key={l.label} onClick={() => go(l.to, l.external)}>{l.label}</FooterLink>)}
          </FooterCol>
          <FooterCol title="Géneros">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GENRES.map((g) => (
                <button key={g.q} type="button" className="iz-chip" style={{ height: 28, padding: "0 11px", fontSize: 12 }} onClick={() => go(`/search?genre=${encodeURIComponent(g.q)}`)}>{g.label}</button>
              ))}
            </div>
          </FooterCol>
          <FooterCol title="Legal">
            {LEGAL_LINKS.map((l) => <FooterLink key={l.label} onClick={() => go(l.href)}>{l.label}</FooterLink>)}
            <div style={{ marginTop: 14, color: "var(--iz-dim)", fontSize: 12 }}>
              Datos de {PARTNERS.map((p, i) => <span key={p.label}>{i > 0 && " · "}<a href={p.href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--iz-muted)" }}>{p.label}</a></span>)}
            </div>
          </FooterCol>
        </div>
        <div style={{ marginTop: 44, paddingTop: 22, borderTop: "1px solid var(--iz-line)", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", color: "var(--iz-dim)", fontSize: 12, lineHeight: 1.6 }}>
          <span>© {new Date().getFullYear()} IZIFF ANIME · Hecho para la comunidad de anime y manga.</span>
          <span style={{ maxWidth: 620 }}>IZIFF ANIME no aloja contenido propio: los videos provienen de fuentes externas de terceros.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="iz-head__eyebrow" style={{ marginBottom: 16 }}><span className="iz-dot" />{title}</div>
      <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>{children}</div>
    </div>
  );
}

function FooterLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: "none", border: 0, padding: 0, color: "var(--iz-text-2)", fontSize: 14, cursor: "pointer", textAlign: "left" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--iz-text-2)")}>
      {children}
    </button>
  );
}
