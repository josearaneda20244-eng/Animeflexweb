import { useLocation } from "wouter";

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Shounen", "Isekai"];

const SOCIAL_LINKS = [
  { name: "Discord", url: "https://discord.gg", color: "#5865F2", icon: "💬" },
  { name: "Telegram", url: "https://t.me", color: "#26A5E4", icon: "📨" },
  { name: "X / Twitter", url: "https://twitter.com", color: "#E7E9EA", icon: "𝕏" },
];

export default function Footer() {
  const [, navigate] = useLocation();
  return (
    <footer style={{ background: "rgba(7,7,20,0.95)", backdropFilter: "blur(12px)" , borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 48, padding: "40px 24px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #7C6FFF, #5B52F5)" }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>▶</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 900 }}>
                <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#7C6FFF" }}>FLEX</span>
              </span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.7, marginBottom: 16 }}>
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
                    width: 34, height: 34, borderRadius: 8, background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center",
                    justifyContent: "center", textDecoration: "none", fontSize: 14, transition: "background 0.15s, border-color 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(124,111,255,0.2)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(124,111,255,0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.1)"; }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 12, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Navegar</div>
            {[
              { label: "Inicio", to: "/" },
              { label: "Películas", to: "/movies" },
              { label: "OVAs & ONAs", to: "/ovas" },
              { label: "Horario", to: "/schedule" },
              { label: "Buscar", to: "/search" },
              { label: "Favoritos", to: "/favorites" },
              { label: "Historial", to: "/history" },
            ].map(({ label, to }) => (
              <div key={to} style={{ marginBottom: 7 }}>
                <button onClick={() => navigate(to)}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 13, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#B39DFF")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                >
                  {label}
                </button>
              </div>
            ))}
          </div>

          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 12, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Géneros</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GENRES.map((g) => (
                <button key={g} onClick={() => navigate(`/search?q=${g}`)}
                  style={{ background: "rgba(124,111,255,0.08)", border: "1px solid rgba(124,111,255,0.18)", borderRadius: 6, padding: "3px 8px", color: "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#B39DFF"; e.currentTarget.style.borderColor = "rgba(124,111,255,0.45)"; e.currentTarget.style.background = "rgba(124,111,255,0.15)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.borderColor = "rgba(124,111,255,0.18)"; e.currentTarget.style.background = "rgba(124,111,255,0.08)"; }}
                >{g}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 12, marginBottom: 14, letterSpacing: 1, textTransform: "uppercase" }}>Legal</div>
            {[
              { label: "Aviso Legal", href: "#" },
              { label: "Política de Privacidad", href: "#" },
              { label: "DMCA / Contacto", href: "#" },
              { label: "Términos de Uso", href: "#" },
              { label: "Sobre Nosotros", href: "#" },
            ].map(({ label, href }) => (
              <div key={label} style={{ marginBottom: 7 }}>
                <a href={href} style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textDecoration: "none" }}
                  onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#B39DFF")}
                  onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "rgba(255,255,255,0.4)")}
                >{label}</a>
              </div>
            ))}
            <div style={{ marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, lineHeight: 1.6, margin: 0 }}>
                AnimeFLEX no aloja contenido. Todo proviene de fuentes externas. Solo para entretenimiento educativo.
              </p>
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 11 }}>
            © {new Date().getFullYear()} AnimeFLEX — Hecho para los fans del anime
          </span>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {["AniList", "MyAnimeList", "Kitsu"].map((s) => (
              <a key={s}
                href={s === "AniList" ? "https://anilist.co" : s === "MyAnimeList" ? "https://myanimelist.net" : "https://kitsu.io"}
                target="_blank" rel="noopener noreferrer"
                style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, textDecoration: "none" }}
                onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#7C6FFF")}
                onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "rgba(255,255,255,0.28)")}
              >{s}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
