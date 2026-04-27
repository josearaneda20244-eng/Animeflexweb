import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle, Flame } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface DiscussionItem {
  anime_id: string;
  comment_count: number;
  last_at: string;
  top_comment: string | null;
  top_user: string | null;
  anime_title: string | null;
  anime_image: string | null;
}

export default function ActiveDiscussions() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery({
    queryKey: ["active-discussions"],
    queryFn: () => apiClient.get<{ items: DiscussionItem[] }>("/discussions/active"),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
    retry: 1,
  });

  const items = (data?.items ?? []).filter((it) => it.anime_title && it.anime_image);
  if (!isLoading && items.length === 0) return null;

  return (
    <div style={{ padding: "0 18px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 4, height: 22, borderRadius: 4, background: "linear-gradient(180deg,#A78BFA,#7C3AED)", boxShadow: "0 0 14px rgba(167,139,250,0.55)" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#C4B5FD", letterSpacing: 2, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", textTransform: "uppercase", lineHeight: 1, marginBottom: 3 }}>[ COMUNIDAD ]</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.3, lineHeight: 1.1 }}>Discusiones activas</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 10 }}>
        {(isLoading ? Array.from({ length: 4 }) : items.slice(0, 6)).map((it: any, i) => {
          if (isLoading) return <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />;
          const d = it as DiscussionItem;
          return (
            <div
              key={d.anime_id}
              onClick={() => navigate(`/anime/${d.anime_id}`)}
              style={{
                display: "flex",
                gap: 12,
                padding: 12,
                background: "linear-gradient(135deg, rgba(15,12,28,0.95), rgba(8,8,18,0.95))",
                border: "1px solid rgba(167,139,250,0.18)",
                borderRadius: 14,
                cursor: "pointer",
                transition: "transform 0.18s, border-color 0.18s, box-shadow 0.18s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(167,139,250,0.4)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 24px rgba(124,58,237,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(167,139,250,0.18)";
                (e.currentTarget as HTMLDivElement).style.transform = "";
                (e.currentTarget as HTMLDivElement).style.boxShadow = "";
              }}
            >
              <img
                src={d.anime_image ?? ""}
                alt={d.anime_title ?? ""}
                loading="lazy"
                style={{ width: 56, height: 78, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ background: "rgba(220,38,38,0.18)", color: "#FCA5A5", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 5, display: "flex", alignItems: "center", gap: 3 }}>
                    <Flame size={9} /> {d.comment_count}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 600 }}>
                    <MessageCircle size={9} style={{ display: "inline", marginRight: 3, verticalAlign: "-1px" }} />
                    {d.comment_count === 1 ? "comentario" : "comentarios"}
                  </span>
                </div>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" } as any}>
                  {d.anime_title}
                </div>
                {d.top_comment && (
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>
                    {d.top_user && <span style={{ color: "#A78BFA", fontWeight: 700 }}>@{d.top_user}: </span>}
                    {d.top_comment}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
