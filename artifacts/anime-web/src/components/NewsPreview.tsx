import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Newspaper, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface NewsItem {
  id: string | number;
  title: string;
  url: string;
  image?: string;
  source?: string;
  published_at?: string;
  publishedAt?: string;
}

function timeAgo(date?: string): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export default function NewsPreview() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["news-preview"],
    queryFn: () => apiClient.get<{ items?: NewsItem[]; news?: NewsItem[] } | NewsItem[]>("/news/anime"),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });

  const raw = Array.isArray(data) ? data : (data as any)?.items ?? (data as any)?.news ?? [];
  const items: NewsItem[] = raw.slice(0, 4);
  if (!isLoading && items.length === 0) return null;

  return (
    <div style={{ padding: "0 18px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 22, borderRadius: 4, background: "linear-gradient(180deg,#22C55E,#15803D)", boxShadow: "0 0 14px rgba(34,197,94,0.55)" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#86EFAC", letterSpacing: 2, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", textTransform: "uppercase", lineHeight: 1, marginBottom: 3 }}>[ NOTICIAS ]</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.3, lineHeight: 1.1 }}>Últimas noticias del anime</span>
          </div>
        </div>
        <button
          onClick={() => navigate("/news")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.22)",
            borderRadius: 20,
            color: "#86EFAC",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Ver todas <ChevronRight size={13} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))", gap: 10 }}>
        {(isLoading ? Array.from({ length: 4 }) : items).map((n: any, i) => {
          if (isLoading) return <div key={i} className="skeleton" style={{ height: 200, borderRadius: 14 }} />;
          const item = n as NewsItem;
          const date = item.published_at ?? item.publishedAt;
          return (
            <a
              key={String(item.id) + i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#0a0a0a",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                transition: "transform 0.18s, border-color 0.18s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(34,197,94,0.4)";
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLAnchorElement).style.transform = "";
              }}
            >
              {item.image && (
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: "#000" }}
                />
              )}
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600 }}>
                  <Newspaper size={10} color="#86EFAC" />
                  {item.source && <span style={{ color: "#86EFAC" }}>{item.source}</span>}
                  {date && <span style={{ color: "rgba(255,255,255,0.35)" }}>· {timeAgo(date)}</span>}
                </div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
                  {item.title}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
