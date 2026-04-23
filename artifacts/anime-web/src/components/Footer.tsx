import { useLocation } from "wouter";

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Shounen", "Isekai"];

const NAV_LINKS = [
  { label: "Inicio", to: "/" },
  { label: "Películas", to: "/movies" },
  { label: "OVAs & ONAs", to: "/ovas" },
  { label: "Horario", to: "/schedule" },
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
  { name: "Discord", url: "https://discord.gg", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.091.12 18.123.143 18.143a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
  )},
  { name: "Telegram", url: "https://t.me", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
  )},
  { name: "X / Twitter", url: "https://twitter.com", icon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  )},
];

export default function Footer() {
  const [, navigate] = useLocation();

  return (
    <footer style={{
      background: "linear-gradient(180deg, #050509 0%, #000 100%)",
      borderTop: "1px solid rgba(220,38,38,0.14)",
      marginTop: 64,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: -1, left: "10%", right: "10%", height: 1,
        background: "linear-gradient(90deg, transparent, rgba(220,38,38,0.5), transparent)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 28px" }}>

        {/* Main grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1.6fr 1fr",
          gap: 48,
          marginBottom: 48,
        }}
        className="footer-grid"
        >

          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg,#FCA5A5,#DC2626 50%,#991B1B)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 8px 24px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: -0.3 }}>
                Anime<span style={{ background: "linear-gradient(135deg,#DC2626,#FECACA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FLEX</span>
              </span>
            </div>

            <p style={{
              color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.7,
              margin: "0 0 20px", maxWidth: 220,
            }}>
              Mira anime gratis en HD con subtítulos en español. Temporadas actuales, clásicos y más.
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              {SOCIAL_LINKS.map(({ name, url, icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={name}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    textDecoration: "none", color: "rgba(255,255,255,0.5)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.12)";
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.25)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.1)";
                    (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.5)";
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navegar */}
          <div>
            <div style={{
              color: "#fff", fontWeight: 600, fontSize: 13,
              marginBottom: 18, letterSpacing: 1, textTransform: "uppercase",
            }}>
              Navegar
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {NAV_LINKS.map(({ label, to }) => (
                <button
                  key={to}
                  onClick={() => navigate(to)}
                  style={{
                    background: "none", border: "none",
                    color: "rgba(255,255,255,0.45)", fontSize: 14,
                    cursor: "pointer", padding: 0, textAlign: "left",
                    transition: "color 0.2s ease",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Géneros */}
          <div>
            <div style={{
              color: "#fff", fontWeight: 600, fontSize: 13,
              marginBottom: 18, letterSpacing: 1, textTransform: "uppercase",
            }}>
              Géneros
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => navigate(`/search?q=${g}`)}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 999, padding: "5px 14px",
                    color: "rgba(255,255,255,0.55)", fontSize: 12,
                    cursor: "pointer", transition: "all 0.2s ease",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                    e.currentTarget.style.color = "#fff";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <div style={{
              color: "#fff", fontWeight: 600, fontSize: 13,
              marginBottom: 18, letterSpacing: 1, textTransform: "uppercase",
            }}>
              Legal
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {LEGAL_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={(e) => { e.preventDefault(); navigate(href); }}
                  style={{
                    color: "rgba(255,255,255,0.45)", fontSize: 14,
                    textDecoration: "none", transition: "color 0.2s ease",
                    display: "block", cursor: "pointer",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = "#fff")}
                  onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)")}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Disclaimer */}
            <div style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, lineHeight: 1.65, margin: 0 }}>
                AnimeFLEX no aloja contenido. Todo proviene de fuentes externas. Solo para entretenimiento educativo.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: 22,
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap", gap: 12,
        }}>
          <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 12 }}>
            © {new Date().getFullYear()} AnimeFLEX — Hecho para los fans del anime
          </span>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {[
              { label: "AniList", href: "https://anilist.co" },
              { label: "MyAnimeList", href: "https://myanimelist.net" },
              { label: "Kitsu", href: "https://kitsu.io" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "rgba(255,255,255,0.28)", fontSize: 12, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.7)")}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.28)")}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 32px !important;
          }
        }
        @media (max-width: 540px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
          }
        }
      `}</style>
    </footer>
  );
}
