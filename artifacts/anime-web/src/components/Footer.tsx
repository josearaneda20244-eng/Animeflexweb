import { useLocation } from "wouter";

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Shounen", "Isekai"];

export default function Footer() {
  const [, navigate] = useLocation();
  return (
    <footer style={{ background: "#0D0D1A", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 48, padding: "40px 24px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #6C63FF, #4F46E5)" }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>▶</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 900 }}>
                <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#6C63FF" }}>FLEX</span>
              </span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, lineHeight: 1.7 }}>
              Mira anime gratis en HD con subtítulos en español. Temporadas actuales, clásicos y más.
            </p>
          </div>

          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 13, marginBottom: 14, letterSpacing: 0.5 }}>NAVEGAR</div>
            {[
              { label: "Inicio", to: "/" },
              { label: "Buscar", to: "/search" },
              { label: "Favoritos", to: "/favorites" },
              { label: "Historial", to: "/history" },
            ].map(({ label, to }) => (
              <div key={to} style={{ marginBottom: 8 }}>
                <button onClick={() => navigate(to)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 13, cursor: "pointer", padding: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#6C63FF")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
                >{label}</button>
              </div>
            ))}
          </div>

          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 13, marginBottom: 14, letterSpacing: 0.5 }}>GÉNEROS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GENRES.map((g) => (
                <button key={g} onClick={() => navigate(`/search?q=${g}`)} style={{ background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.2)", borderRadius: 6, padding: "3px 8px", color: "rgba(255,255,255,0.45)", fontSize: 11, cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#A78BFA"; e.currentTarget.style.borderColor = "rgba(108,99,255,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; e.currentTarget.style.borderColor = "rgba(108,99,255,0.2)"; }}
                >{g}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 13, marginBottom: 14, letterSpacing: 0.5 }}>AVISO</div>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, lineHeight: 1.7 }}>
              AnimeFLEX no aloja ningún contenido. Todo el contenido proviene de fuentes externas. Este sitio es para uso educativo y de entretenimiento únicamente.
            </p>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>© {new Date().getFullYear()} AnimeFLEX — Solo para entretenimiento</span>
          <div style={{ display: "flex", gap: 16 }}>
            {["AniList", "MyAnimeList", "Kitsu"].map((s) => (
              <a key={s} href={`https://${s.toLowerCase().replace("myanimelist", "myanimelist.net").replace("anilist", "anilist.co").replace("kitsu", "kitsu.io")}`} target="_blank" rel="noopener noreferrer"
                style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textDecoration: "none" }}
                onMouseEnter={e => ((e.target as HTMLAnchorElement).style.color = "#6C63FF")}
                onMouseLeave={e => ((e.target as HTMLAnchorElement).style.color = "rgba(255,255,255,0.3)")}
              >{s}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
