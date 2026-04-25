import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Newspaper, RefreshCw, Loader2, ExternalLink, Filter } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SystemTag, MagicCircle } from "@/components/SystemUI";

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image?: string;
  source: string;
}

interface NewsResponse {
  items: NewsItem[];
  cached?: boolean;
  count?: number;
}

const SOURCE_ACCENTS: Record<string, string> = {
  Kudasai: "#DC2626",
  ANMTV: "#F97316",
  "Ramen Para Dos": "#A78BFA",
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "AHORA";
  if (m < 60) return `HACE ${m} MIN`;
  const h = Math.floor(m / 60);
  if (h < 24) return `HACE ${h} H`;
  const d = Math.floor(h / 24);
  if (d < 7) return `HACE ${d} D`;
  return new Date(t).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).toUpperCase();
}

function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  const accent = SOURCE_ACCENTS[item.source] ?? "#DC2626";
  return (
    <motion.a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      className={`news-card ${featured ? "news-card--featured" : ""}`}
      style={{ ["--accent" as any]: accent }}
    >
      <div className="news-card__media">
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" decoding="async" />
        ) : (
          <div className="news-card__media-fallback">
            <Newspaper size={featured ? 64 : 44} strokeWidth={1.2} />
          </div>
        )}
        <div className="news-card__overlay" />
        <span className="news-card__corner news-card__corner--tl" />
        <span className="news-card__corner news-card__corner--tr" />
        <span className="news-card__corner news-card__corner--bl" />
        <span className="news-card__corner news-card__corner--br" />
        <div className="news-card__source">
          <span className="news-card__source-dot" />
          {item.source}
        </div>
        {item.pubDate && <div className="news-card__date">{timeAgo(item.pubDate)}</div>}
        {featured && (
          <div className="news-card__featured-badge">
            <span className="news-card__featured-dot" />
            DESTACADA
          </div>
        )}
      </div>
      <div className="news-card__body">
        <h3 className="news-card__title">{item.title}</h3>
        {item.description && <p className="news-card__desc">{item.description}</p>}
        <div className="news-card__cta">
          <span>LEER NOTICIA</span>
          <ExternalLink size={12} />
        </div>
      </div>
      <span className="news-card__scanlines" />
    </motion.a>
  );
}

export default function News() {
  const [sourceFilter, setSourceFilter] = useState<string>("Todas");

  const { data, isLoading, isFetching, isError, refetch } = useQuery<NewsResponse>({
    queryKey: ["news", "anime"],
    queryFn: async () => {
      const API = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "/api";
      const r = await fetch(`${API}/news/anime`);
      if (!r.ok) throw new Error("News fetch failed");
      return (await r.json()) as NewsResponse;
    },
    staleTime: 1000 * 60 * 25,
    retry: 1,
  });

  const allNews: NewsItem[] = data?.items ?? [];

  const sources = useMemo(() => {
    const set = new Set(allNews.map((n) => n.source));
    return ["Todas", ...Array.from(set)];
  }, [allNews]);

  const filteredNews = useMemo(
    () => (sourceFilter === "Todas" ? allNews : allNews.filter((n) => n.source === sourceFilter)),
    [allNews, sourceFilter]
  );

  const featured = filteredNews[0];
  const rest = filteredNews.slice(1);

  return (
    <div style={{ minHeight: "100vh", background: "#04030a", display: "flex", flexDirection: "column", position: "relative" }}>
      <Navbar />

      {/* HERO HEADER */}
      <div
        style={{
          position: "relative",
          borderBottom: "1px solid rgba(220,38,38,0.25)",
          padding: "calc(56px + 48px) 24px 48px",
          textAlign: "center",
          overflow: "hidden",
          background:
            "radial-gradient(ellipse at center, rgba(220,38,38,0.18), transparent 60%), linear-gradient(180deg, #0a0307, #04030a)",
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: 60, transform: "translateX(-50%)", opacity: 0.55 }}>
          <MagicCircle size={320} color="#DC2626" opacity={0.55} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(220,38,38,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 2, maxWidth: 760, margin: "0 auto" }}>
          <div style={{ marginBottom: 18 }}>
            <SystemTag color="#F97316">[ SYSTEM ] FEED DE NOTICIAS</SystemTag>
          </div>
          <h1 className="sys-title" style={{ fontSize: 44, marginBottom: 16 }}>
            NOTICIAS
          </h1>
          <p
            style={{
              color: "rgba(252,165,165,0.75)",
              fontSize: 14,
              margin: "20px 0 8px",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              letterSpacing: 1.5,
            }}
          >
            ▸ ÚLTIMAS NOTICIAS DEL MUNDO ANIME · ACTUALIZADO EN VIVO
          </p>
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              letterSpacing: 2,
            }}
          >
            FUENTES: KUDASAI · ANMTV · RAMEN PARA DOS
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "32px 20px 60px", flex: 1, position: "relative", zIndex: 1 }}>
        {/* TOOLBAR: source filter + refresh */}
        {!isLoading && allNews.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Filter size={14} color="#F97316" style={{ filter: "drop-shadow(0 0 4px #F97316)" }} />
              <span
                style={{
                  color: "#FDBA74",
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  letterSpacing: 2,
                  fontWeight: 800,
                  marginRight: 4,
                }}
              >
                FUENTE:
              </span>
              {sources.map((s) => {
                const active = sourceFilter === s;
                const accent = s === "Todas" ? "#DC2626" : SOURCE_ACCENTS[s] ?? "#DC2626";
                return (
                  <button
                    key={s}
                    onClick={() => setSourceFilter(s)}
                    style={{
                      padding: "7px 14px",
                      background: active ? `linear-gradient(135deg, ${accent}, ${accent}cc)` : "rgba(220,38,38,0.06)",
                      border: `1px solid ${active ? accent : "rgba(220,38,38,0.3)"}`,
                      color: active ? "#fff" : "rgba(252,165,165,0.75)",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: 1.5,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                      boxShadow: active ? `0 0 14px ${accent}66` : "none",
                      transition: "all 0.18s ease",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                background: "rgba(220,38,38,0.08)",
                border: "1px solid rgba(220,38,38,0.35)",
                color: "#FCA5A5",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.5,
                cursor: isFetching ? "wait" : "pointer",
                clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                opacity: isFetching ? 0.6 : 1,
              }}
            >
              <RefreshCw size={12} style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
              {isFetching ? "ACTUALIZANDO" : "ACTUALIZAR"}
            </button>
          </div>
        )}

        {/* LOADING */}
        {isLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "80px 0" }}>
            <Loader2 size={36} color="#DC2626" style={{ animation: "spin 1s linear infinite", filter: "drop-shadow(0 0 12px #DC2626)" }} />
            <div style={{ color: "#FCA5A5", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: 2 }}>
              CARGANDO FEED DE NOTICIAS...
            </div>
          </div>
        )}

        {/* ERROR */}
        {isError && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(252,165,165,0.7)" }}>
            <Newspaper size={48} style={{ marginBottom: 16, opacity: 0.4, color: "#DC2626" }} />
            <p style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1, color: "#FCA5A5" }}>
              ⚠ ERROR · NO SE PUDIERON CARGAR LAS NOTICIAS
            </p>
            <button
              onClick={() => refetch()}
              style={{
                marginTop: 20,
                padding: "10px 22px",
                background: "rgba(220,38,38,0.18)",
                border: "1px solid rgba(220,38,38,0.5)",
                color: "#FCA5A5",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: 1.5,
                fontWeight: 800,
                cursor: "pointer",
                clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
              }}
            >
              ↻ REINTENTAR
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!isLoading && !isError && filteredNews.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(252,165,165,0.4)" }}>
            <Newspaper size={56} style={{ marginBottom: 16, opacity: 0.25, color: "#DC2626" }} />
            <p style={{ fontSize: 14, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1.5 }}>
              ◇ SIN NOTICIAS EN ESTA FUENTE
            </p>
          </div>
        )}

        {/* FEATURED + GRID */}
        {!isLoading && filteredNews.length > 0 && (
          <>
            {featured && (
              <div style={{ marginBottom: 28 }}>
                <NewsCard item={featured} featured />
              </div>
            )}
            {rest.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 18,
                }}
              >
                {rest.map((n, i) => (
                  <NewsCard key={`${n.link}-${i}`} item={n} />
                ))}
              </div>
            )}

            {data?.cached && (
              <div
                style={{
                  marginTop: 36,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10,
                  letterSpacing: 2,
                }}
              >
                ◇ CACHE ACTIVO · LOS DATOS SE REFRESCAN CADA 30 MIN
              </div>
            )}
          </>
        )}
      </div>

      <Footer />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes news-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }

        .news-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: linear-gradient(180deg, rgba(15,8,18,0.95), rgba(8,4,12,0.98));
          border: 1px solid rgba(220,38,38,0.22);
          border-radius: 4px;
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
          clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
          box-shadow: 0 12px 30px rgba(0,0,0,0.4);
          text-decoration: none;
          color: inherit;
        }
        .news-card:hover {
          border-color: var(--accent);
          box-shadow: 0 18px 50px rgba(0,0,0,0.55), 0 0 26px var(--accent), inset 0 0 24px rgba(220,38,38,0.06);
        }
        .news-card__media {
          position: relative;
          width: 100%;
          height: 180px;
          background: #000;
          overflow: hidden;
          border-bottom: 1px solid rgba(220,38,38,0.18);
        }
        .news-card--featured { flex-direction: row; min-height: 320px; }
        .news-card--featured .news-card__media { width: 56%; height: auto; min-height: 320px; border-bottom: none; border-right: 1px solid rgba(220,38,38,0.18); }
        .news-card--featured .news-card__body { width: 44%; padding: 28px 28px 24px; }
        .news-card--featured .news-card__title { font-size: 22px; -webkit-line-clamp: 4; }
        .news-card--featured .news-card__desc { font-size: 13px; -webkit-line-clamp: 5; }
        @media (max-width: 720px) {
          .news-card--featured { flex-direction: column; min-height: 0; }
          .news-card--featured .news-card__media { width: 100%; min-height: 0; height: 220px; border-right: none; border-bottom: 1px solid rgba(220,38,38,0.18); }
          .news-card--featured .news-card__body { width: 100%; padding: 18px; }
          .news-card--featured .news-card__title { font-size: 17px; -webkit-line-clamp: 3; }
        }
        .news-card__media img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.4s ease, filter 0.3s ease;
          filter: brightness(0.85) saturate(1.05);
        }
        .news-card:hover .news-card__media img { transform: scale(1.06); filter: brightness(1) saturate(1.15); }
        .news-card__media-fallback {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          color: var(--accent); opacity: 0.25;
          background: radial-gradient(circle at 50% 50%, rgba(220,38,38,0.2), transparent 70%);
        }
        .news-card__overlay {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.6) 100%);
          pointer-events: none;
        }
        .news-card__corner {
          position: absolute; width: 14px; height: 14px;
          border: 0 solid var(--accent);
          filter: drop-shadow(0 0 4px var(--accent));
          pointer-events: none;
        }
        .news-card__corner--tl { top: 6px; left: 6px; border-top-width: 2px; border-left-width: 2px; }
        .news-card__corner--tr { top: 6px; right: 6px; border-top-width: 2px; border-right-width: 2px; }
        .news-card__corner--bl { bottom: 6px; left: 6px; border-bottom-width: 2px; border-left-width: 2px; }
        .news-card__corner--br { bottom: 6px; right: 6px; border-bottom-width: 2px; border-right-width: 2px; }
        .news-card__source {
          position: absolute; top: 12px; left: 12px;
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(0,0,0,0.78); backdrop-filter: blur(8px);
          color: #FECACA;
          font-family: 'JetBrains Mono', 'Courier New', ui-monospace, monospace;
          font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
          padding: 4px 9px;
          border: 1px solid rgba(220,38,38,0.4);
          border-radius: 2px;
        }
        .news-card__source-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent);
          animation: news-pulse 1.6s ease-in-out infinite;
        }
        .news-card__date {
          position: absolute; bottom: 12px; right: 12px;
          background: rgba(0,0,0,0.7);
          color: rgba(255,255,255,0.75);
          font-size: 9.5px; font-weight: 800; letter-spacing: 1.5px;
          padding: 3px 8px; border-radius: 99px;
          font-family: 'JetBrains Mono', 'Courier New', ui-monospace, monospace;
          border: 1px solid rgba(255,255,255,0.08);
          text-transform: uppercase;
        }
        .news-card__featured-badge {
          position: absolute; top: 12px; right: 12px;
          display: inline-flex; align-items: center; gap: 6px;
          background: linear-gradient(135deg, var(--accent), #F97316);
          color: #fff;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10px; font-weight: 900; letter-spacing: 2px;
          padding: 5px 10px;
          border-radius: 2px;
          box-shadow: 0 0 18px var(--accent);
        }
        .news-card__featured-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #fff;
          animation: news-pulse 1.2s ease-in-out infinite;
        }
        .news-card__body {
          position: relative;
          padding: 16px 18px 18px;
          display: flex; flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        .news-card__title {
          color: #F1F1F5;
          font-size: 15px;
          font-weight: 800;
          line-height: 1.35;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          letter-spacing: -0.1px;
        }
        .news-card:hover .news-card__title { color: #fff; }
        .news-card__desc {
          color: rgba(255,255,255,0.5);
          font-size: 12px;
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .news-card__cta {
          margin-top: auto; padding-top: 12px;
          border-top: 1px dashed rgba(220,38,38,0.22);
          display: flex; align-items: center; gap: 8px;
          color: var(--accent);
          font-family: 'JetBrains Mono', 'Courier New', ui-monospace, monospace;
          font-size: 10px; font-weight: 900; letter-spacing: 2px;
          transition: gap 0.22s ease;
        }
        .news-card:hover .news-card__cta { gap: 12px; }
        .news-card__scanlines {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg, rgba(220,38,38,0.025) 0px, rgba(220,38,38,0.025) 1px, transparent 1px, transparent 4px);
          pointer-events: none; opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
