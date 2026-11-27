import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { Rail, PosterCard, PosterSkeletons } from "@/components/iz/ui";

interface MangaItem {
  id: string;
  title: string | { english?: string; romaji?: string };
  image?: string;
  cover?: string;
  status?: string;
  chapters?: number;
  genres?: string[];
}

const titleOf = (t: MangaItem["title"]) => (typeof t === "string" ? t : t?.english || t?.romaji || "Manga");

/** Carril de mangas recientes para la portada. */
export default function MangaRecentBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ["manga-recent-home"],
    queryFn: () => apiClient.get<{ results?: MangaItem[] } | MangaItem[]>("/manga/recent?page=1"),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
    retry: 1,
  });
  const items: MangaItem[] = (Array.isArray(data) ? data : data?.results ?? []).slice(0, 16);
  if (!isLoading && items.length === 0) return null;
  return (
    <Rail label="Mangas recientes">
      {isLoading ? <PosterSkeletons /> : items.map((m) => (
        <PosterCard key={m.id} data={{
          id: m.id, title: titleOf(m.title), image: m.image || m.cover || "", href: `/manga/${m.id}`,
          badge: m.status === "Ongoing" ? "EN CURSO" : undefined, accentBadge: true,
          meta: m.chapters ? `${m.chapters} capítulos` : m.genres?.slice(0, 2).join(" · "),
        }} />
      ))}
    </Rail>
  );
}
