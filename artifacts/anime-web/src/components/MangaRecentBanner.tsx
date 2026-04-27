import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookOpen, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

interface MangaItem {
  id: string;
  title: string;
  image?: string;
  cover?: string;
  latestChapter?: string | number;
  chapter?: string | number;
}

export default function MangaRecentBanner() {
  const [, navigate] = useLocation();

  const { data } = useQuery({
    queryKey: ["manga-recent-home"],
    queryFn: () => apiClient.get<{ results?: MangaItem[] } | MangaItem[]>("/manga/recent?page=1"),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });

  const raw = Array.isArray(data) ? data : (data as any)?.results ?? [];
  const items: MangaItem[] = raw.slice(0, 4);

  return (
    <div
      onClick={() => navigate("/manga")}
      style={{
        cursor: "pointer",
        borderRadius: 20,
        background: "linear-gradient(135deg, rgba(220,38,38,0.15) 0%, rgba(249,115,22,0.15) 50%, rgba(220,38,38,0.1) 100%)",
        border: "1px solid rgba(220,38,38,0.2)",
        padding: "22px 24px",
        marginBottom: 24,
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 16px 40px rgba(220,38,38,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: items.length > 0 ? 16 : 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(220,38,38,0.3), rgba(249,115,22,0.3))",
              border: "1px solid rgba(220,38,38,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <BookOpen size={22} color="#fff" />
          </div>
          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 900, fontSize: 18, marginBottom: 2 }}>
              Manga al día
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
              Capítulos recién publicados, miles de títulos
            </div>
          </div>
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, #DC2626, #F97316)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            padding: "9px 18px",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 6px 20px rgba(220,38,38,0.35)",
          }}
        >
          Explorar Manga <ChevronRight size={15} />
        </div>
      </div>

      {items.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {items.map((m) => (
            <div
              key={m.id}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/manga/${encodeURIComponent(m.id)}`);
              }}
              style={{
                display: "flex",
                gap: 8,
                padding: 8,
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 10,
                cursor: "pointer",
                transition: "border-color 0.18s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(249,115,22,0.45)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)")}
            >
              <img
                src={m.image || m.cover || ""}
                alt={m.title}
                loading="lazy"
                style={{ width: 36, height: 50, objectFit: "cover", borderRadius: 5, flexShrink: 0, background: "#111" }}
              />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div
                  style={{
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.title}
                </div>
                {(m.latestChapter ?? m.chapter) != null && (
                  <div style={{ color: "#FCA5A5", fontSize: 10, fontWeight: 600, marginTop: 2 }}>
                    Cap. {m.latestChapter ?? m.chapter}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
