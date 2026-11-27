import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { SectionHead } from "@/components/iz/ui";
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
    <div>
      <SectionHead eyebrow="Comunidad" title="Discusiones" serif="activas" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: 10 }}>
        {(isLoading ? Array.from({ length: 4 }) : items.slice(0, 6)).map((it: unknown, i) => {
          if (isLoading) return <div key={i} className="iz-skel" style={{ height: 102 }} />;
          const d = it as DiscussionItem;
          return (
            <button key={d.anime_id} type="button" onClick={() => navigate(`/anime/${d.anime_id}`)} className="iz-panel iz-discussion">
              <img src={d.anime_image ?? ""} alt="" loading="lazy" />
              <span style={{ minWidth: 0, display: "grid", gap: 5, alignContent: "start" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="iz-tag iz-tag--accent"><MessageCircle size={10} /> {d.comment_count}</span>
                  <span style={{ color: "var(--iz-dim)", fontSize: 12 }}>{d.comment_count === 1 ? "comentario" : "comentarios"}</span>
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.anime_title}</span>
                {d.top_comment && (
                  <span style={{ color: "var(--iz-muted)", fontSize: 12.5, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {d.top_user && <b style={{ color: "#c7d2fe", fontWeight: 600 }}>@{d.top_user}: </b>}{d.top_comment}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
