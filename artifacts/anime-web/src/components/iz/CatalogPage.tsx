import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shuffle, RefreshCw } from "lucide-react";
import { byFormatDirect, resolveTitle, type AnimeResult } from "@/lib/consumet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";
import { PosterCard, PosterSkeletons, EmptyState, toScore10 } from "@/components/iz/ui";

type Format = "MOVIE" | "OVA" | "ONA" | "SPECIAL";

/** Página de catálogo por formato (Películas, OVAs/ONAs/Especiales) con paginación infinita. */
export default function CatalogPage({
  eyebrow, title, serif, description, formats, badge,
}: {
  eyebrow: string;
  title: string;
  serif: string;
  description: string;
  formats: { label: string; value: Format }[];
  badge?: string;
}) {
  const [, navigate] = useLocation();
  const [active, setActive] = useState<Format>(formats[0].value);

  usePageMeta({ title: `${title} ${serif}`, description });

  const q = useInfiniteQuery({
    queryKey: ["catalog", active],
    queryFn: ({ pageParam }) => byFormatDirect(active, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasNextPage ? last.currentPage + 1 : undefined),
    staleTime: 1000 * 60 * 15,
    retry: 2,
  });

  const items = useMemo(() => {
    const all: AnimeResult[] = q.data?.pages.flatMap((p: { results: AnimeResult[] }) => p.results) ?? [];
    return Array.from(new Map(all.map((m) => [m.id, m])).values());
  }, [q.data]);

  const random = () => {
    if (!items.length) return;
    navigate(`/anime/${items[Math.floor(Math.random() * items.length)].id}`);
  };

  const toPoster = (a: AnimeResult) => ({
    id: a.id,
    title: resolveTitle(a.title),
    image: a.image,
    score: toScore10(a.rating),
    badge: badge ?? a.type,
    meta: [a.totalEpisodes ? `${a.totalEpisodes} eps` : null, a.genres?.slice(0, 2).join(" · ")].filter(Boolean).join(" · ") || undefined,
  });

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container">
        <header className="iz-pagehead" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="iz-head__eyebrow"><span className="iz-dot" />{eyebrow}</div>
            <h1>{title} <span className="iz-serif">{serif}</span></h1>
            <p>{description}</p>
          </div>
          <button type="button" className="iz-btn iz-btn--ghost" onClick={random} disabled={!items.length}><Shuffle size={16} /> Sorpréndeme</button>
        </header>

        {formats.length > 1 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {formats.map((f) => (
              <button key={f.value} type="button" className={`iz-chip ${active === f.value ? "is-active" : ""}`} onClick={() => setActive(f.value)}>{f.label}</button>
            ))}
          </div>
        )}

        {q.isLoading ? (
          <div className="iz-grid"><PosterSkeletons count={18} /></div>
        ) : q.isError && items.length === 0 ? (
          <EmptyState title="No pudimos cargar el catálogo" text="Hubo un problema de conexión con el servidor de datos."
            action={<button type="button" className="iz-btn iz-btn--primary" onClick={() => q.refetch()}><RefreshCw size={16} /> Reintentar</button>} />
        ) : items.length === 0 ? (
          <EmptyState title="Nada por aquí todavía" text="Prueba con otra categoría o usa el buscador." />
        ) : (
          <>
            <div className="iz-grid">{items.map((a) => <PosterCard key={a.id} data={toPoster(a)} />)}</div>
            {q.hasNextPage && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
                <button type="button" className="iz-btn iz-btn--ghost" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                  {q.isFetchingNextPage ? "Cargando…" : "Cargar más"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
