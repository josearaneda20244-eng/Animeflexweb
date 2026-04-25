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

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="af-col-title">
      <span className="af-col-title__bar" />
      {children}
    </div>
  );
}

export default function Footer() {
  const [, navigate] = useLocation();

  return (
    <footer className="af-footer">
      {/* Top accent line */}
      <div className="af-footer__accent" />
      {/* Subtle grid pattern */}
      <div className="af-footer__grid" />

      <div className="af-footer__inner">
        {/* Main columns */}
        <div className="af-footer__cols">
          {/* Brand */}
          <div className="af-footer__brand">
            <div className="af-brand">
              <div className="af-brand__logo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <polygon points="5,3 19,12 5,21" />
                </svg>
              </div>
              <span className="af-brand__name">
                Anime<span className="af-brand__name--accent">FLEX</span>
              </span>
            </div>

            <p className="af-brand__tagline">
              Tu plataforma para mirar anime gratis en HD con subtítulos en español. Temporada actual, clásicos, películas, OVAs y mucho más.
            </p>

            {/* Social */}
            <div className="af-social">
              {SOCIAL_LINKS.map(({ name, url, icon }) => (
                <a
                  key={name}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={name}
                  aria-label={name}
                  className="af-social__btn"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navegar */}
          <div>
            <ColumnTitle>Navegar</ColumnTitle>
            <ul className="af-list">
              {NAV_LINKS.map(({ label, to }) => (
                <li key={to}>
                  <button onClick={() => navigate(to)} className="af-link">
                    <span className="af-link__dot" />
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Géneros */}
          <div>
            <ColumnTitle>Géneros</ColumnTitle>
            <div className="af-genres">
              {GENRES.map(({ label, q }) => (
                <button
                  key={q}
                  onClick={() => navigate(`/search?q=${q}`)}
                  className="af-chip"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div>
            <ColumnTitle>Legal</ColumnTitle>
            <ul className="af-list">
              {LEGAL_LINKS.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    onClick={(e) => { e.preventDefault(); navigate(href); }}
                    className="af-link"
                  >
                    <span className="af-link__dot" />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer banner */}
        <div className="af-disclaimer">
          <div className="af-disclaimer__icon" aria-hidden>ⓘ</div>
          <p className="af-disclaimer__text">
            <strong>AnimeFLEX no aloja contenido propio.</strong> Todos los videos provienen de fuentes externas de terceros. Esta plataforma se ofrece exclusivamente con fines educativos y de entretenimiento.
          </p>
        </div>

        {/* Bottom bar */}
        <div className="af-bottom">
          <div className="af-bottom__left">
            <span className="af-copy">
              © {new Date().getFullYear()} <strong>AnimeFLEX</strong> — Hecho con <span className="af-heart">♥</span> para los fans del anime
            </span>
          </div>
          <div className="af-bottom__right">
            <span className="af-partners-label">Datos de</span>
            {PARTNERS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="af-partner"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .af-footer {
          position: relative;
          margin-top: 64px;
          background:
            radial-gradient(ellipse at 50% 0%, rgba(220,38,38,0.08), transparent 60%),
            linear-gradient(180deg, #07080F 0%, #030307 100%);
          border-top: 1px solid rgba(220,38,38,0.18);
          overflow: hidden;
          color: #fff;
        }
        .af-footer__accent {
          position: absolute; top: 0; left: 8%; right: 8%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(220,38,38,0.65), rgba(255,150,150,0.4), rgba(220,38,38,0.65), transparent);
          pointer-events: none;
        }
        .af-footer__grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(ellipse at 50% 30%, #000 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(ellipse at 50% 30%, #000 30%, transparent 75%);
          pointer-events: none;
          opacity: 0.55;
        }
        .af-footer__inner {
          position: relative;
          max-width: 1200px;
          margin: 0 auto;
          padding: 56px 24px 24px;
        }

        /* Columns */
        .af-footer__cols {
          display: grid;
          grid-template-columns: 1.5fr 0.9fr 1.4fr 1fr;
          gap: 44px;
          margin-bottom: 40px;
        }
        @media (max-width: 960px) {
          .af-footer__cols { grid-template-columns: 1fr 1fr; gap: 36px; }
          .af-footer__brand { grid-column: 1 / -1; }
        }
        @media (max-width: 540px) {
          .af-footer__cols { grid-template-columns: 1fr; gap: 32px; }
          .af-footer__inner { padding: 44px 20px 20px; }
        }

        /* Brand */
        .af-brand {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 18px;
        }
        .af-brand__logo {
          width: 42px; height: 42px; border-radius: 12px;
          background: linear-gradient(135deg, #FCA5A5, #DC2626 50%, #7F1D1D);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          box-shadow:
            0 10px 30px rgba(220,38,38,0.45),
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -2px 6px rgba(0,0,0,0.3);
        }
        .af-brand__name {
          font-size: 22px; font-weight: 900; letter-spacing: -0.4px;
          line-height: 1;
        }
        .af-brand__name--accent {
          background: linear-gradient(135deg, #FCA5A5, #DC2626);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .af-brand__tagline {
          color: rgba(255,255,255,0.5);
          font-size: 13.5px; line-height: 1.7;
          margin: 0 0 22px;
          max-width: 320px;
        }

        /* Social */
        .af-social { display: flex; gap: 10px; }
        .af-social__btn {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          display: inline-flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.55);
          text-decoration: none;
          transition: all 0.22s ease;
        }
        .af-social__btn:hover {
          background: linear-gradient(135deg, rgba(220,38,38,0.18), rgba(220,38,38,0.08));
          border-color: rgba(220,38,38,0.55);
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(220,38,38,0.22);
        }

        /* Column title */
        .af-col-title {
          display: flex; align-items: center; gap: 8px;
          color: #fff;
          font-weight: 700; font-size: 11.5px;
          letter-spacing: 1.4px; text-transform: uppercase;
          margin-bottom: 18px;
        }
        .af-col-title__bar {
          width: 14px; height: 2px;
          background: linear-gradient(90deg, #DC2626, #FCA5A5);
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(220,38,38,0.6);
        }

        /* Lists */
        .af-list {
          list-style: none;
          margin: 0; padding: 0;
          display: flex; flex-direction: column;
          gap: 11px;
        }
        .af-link {
          background: none; border: none; padding: 0;
          color: rgba(255,255,255,0.5);
          font-size: 13.5px;
          font-family: inherit;
          cursor: pointer;
          text-align: left; text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          transition: color 0.18s ease, transform 0.18s ease;
        }
        .af-link__dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: rgba(220,38,38,0.45);
          flex-shrink: 0;
          transition: all 0.22s ease;
        }
        .af-link:hover {
          color: #fff;
          transform: translateX(3px);
        }
        .af-link:hover .af-link__dot {
          background: #DC2626;
          box-shadow: 0 0 8px rgba(220,38,38,0.8);
        }

        /* Géneros chips */
        .af-genres {
          display: flex; flex-wrap: wrap; gap: 7px;
        }
        .af-chip {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 999px;
          padding: 6px 13px;
          color: rgba(255,255,255,0.6);
          font-size: 12px; font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .af-chip:hover {
          background: rgba(220,38,38,0.14);
          border-color: rgba(220,38,38,0.5);
          color: #fff;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220,38,38,0.18);
        }

        /* Disclaimer */
        .af-disclaimer {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 16px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(220,38,38,0.06), rgba(255,255,255,0.02));
          border: 1px solid rgba(220,38,38,0.18);
          margin-bottom: 24px;
        }
        .af-disclaimer__icon {
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(220,38,38,0.18);
          color: #FCA5A5;
          font-size: 12px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .af-disclaimer__text {
          color: rgba(255,255,255,0.55);
          font-size: 12.5px; line-height: 1.65;
          margin: 0;
        }
        .af-disclaimer__text strong {
          color: rgba(255,255,255,0.85);
          font-weight: 600;
        }

        /* Bottom bar */
        .af-bottom {
          padding-top: 22px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 14px;
        }
        .af-copy {
          color: rgba(255,255,255,0.32);
          font-size: 12.5px;
        }
        .af-copy strong {
          color: rgba(255,255,255,0.55);
          font-weight: 600;
        }
        .af-heart {
          color: #DC2626;
          text-shadow: 0 0 6px rgba(220,38,38,0.6);
        }
        .af-bottom__right {
          display: flex; align-items: center; gap: 14px;
          flex-wrap: wrap;
        }
        .af-partners-label {
          color: rgba(255,255,255,0.28);
          font-size: 11px;
          letter-spacing: 1px; text-transform: uppercase;
        }
        .af-partner {
          color: rgba(255,255,255,0.42);
          font-size: 12.5px;
          font-weight: 500;
          text-decoration: none;
          padding: 4px 10px;
          border-radius: 6px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          transition: all 0.2s ease;
        }
        .af-partner:hover {
          color: #fff;
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.14);
        }

        @media (max-width: 540px) {
          .af-bottom { justify-content: center; text-align: center; }
          .af-bottom__left, .af-bottom__right { justify-content: center; width: 100%; }
        }
      `}</style>
    </footer>
  );
}
