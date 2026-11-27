import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Newspaper } from "lucide-react";
import { SectionHead } from "@/components/iz/ui";
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
  if (!Number.isFinite(diff) || diff < 0) return "";
  if (m < 60) return `hace ${Math.max(1, m)} min`;
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
    <div>
      <SectionHead eyebrow="Noticias" title="Lo último del" serif="mundo anime" onAction={() => navigate("/noticias")} action="Ver todas" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(250px, 100%), 1fr))", gap: 14 }}>
        {(isLoading ? Array.from({ length: 4 }) : items).map((n: unknown, i) => {
          if (isLoading) return <div key={i} className="iz-skel" style={{ height: 230 }} />;
          const item = n as NewsItem;
          const date = item.published_at ?? item.publishedAt;
          return (
            <a key={String(item.id) + i} href={item.url} target="_blank" rel="noopener noreferrer" className="iz-wide" style={{ width: "auto", textDecoration: "none" }}>
              <div className="iz-wide__frame">{item.image ? <img src={item.image} alt="" loading="lazy" /> : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--iz-dim)" }}><Newspaper size={28} /></div>}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 6, color: "var(--iz-dim)", fontSize: 12 }}>
                {item.source && <span style={{ color: "var(--iz-muted)", fontWeight: 600 }}>{item.source}</span>}
                {date && <span>· {timeAgo(date)}</span>}
              </div>
              <div style={{ marginTop: 4, color: "#f4f4f5", fontSize: 14, fontWeight: 600, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.title}</div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
