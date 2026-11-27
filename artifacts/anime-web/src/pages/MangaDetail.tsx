import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Star, SortAsc, SortDesc, Search, X, CheckCircle2, RefreshCw, Share2 } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta, SITE_URL } from "@/lib/usePageMeta";
import { EmptyState, toScore10 } from "@/components/iz/ui";
import { getMangaProgress, getReadChapters } from "@/lib/mangaProgress";

interface ChapterInfo { id: string; title?: string; chapterNumber?: string | number; volumeNumber?: string | number; pages?: number; releaseDate?: string }
interface MangaDetailInfo {
  id: string;
  title: string | { english?: string; romaji?: string; native?: string };
  image?: string;
  cover?: string;
  description?: string;
  status?: string;
  genres?: string[];
  rating?: number;
  volumes?: number;
  authors?: Array<{ id: string; name: string }>;
  chapters?: ChapterInfo[];
}

function resolveTitle(t: MangaDetailInfo["title"]): string {
  if (!t) return "Sin título";
  if (typeof t === "string") return t;
  return t.english || t.romaji || t.native || "Sin título";
}
const stripHtml = (html?: string) => (html ? html.replace(/<[^>]+>/g, "").trim() : "");
function formatDate(d?: string | null): string {
  if (!d) return "";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString("es", { year: "numeric", month: "short", day: "numeric" });
}
const num = (c: ChapterInfo) => parseFloat(String(c.chapterNumber ?? 0)) || 0;
const STATUS_ES: Record<string, string> = { Ongoing: "En publicación", Completed: "Completo", Hiatus: "En pausa", Cancelled: "Cancelado" };

export default function MangaDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [descExpanded, setDescExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [asc, setAsc] = useState(false);
  const [showCount, setShowCount] = useState(80);
  const [copied, setCopied] = useState(false);

  const { data: manga, isLoading, isError, refetch } = useQuery<MangaDetailInfo>({
    queryKey: ["manga", "info", id],
    queryFn: () => apiClient.get<MangaDetailInfo>(`/manga/info/${id}`),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const title = manga ? resolveTitle(manga.title) : "";
  const desc = stripHtml(manga?.description);
  const chapters = manga?.chapters ?? [];
  const progress = useMemo(() => getMangaProgress(id), [id]);
  const read = useMemo(() => getReadChapters(id), [id]);

  const sorted = useMemo(() => [...chapters].sort((a, b) => (asc ? num(a) - num(b) : num(b) - num(a))), [chapters, asc]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? sorted.filter((c) => String(c.chapterNumber ?? "").startsWith(q) || (c.title ?? "").toLowerCase().includes(q)) : sorted;
  }, [sorted, search]);
  const ascList = useMemo(() => [...chapters].sort((a, b) => num(a) - num(b)), [chapters]);
  const first = ascList[0];
  const latest = ascList[ascList.length - 1];
  const resumeChapter = progress ? chapters.find((c) => c.id === progress.chapterId) : undefined;

  usePageMeta({
    title: manga ? `Leer ${title} en español` : "Manga",
    description: desc ? desc.slice(0, 190) : `Lee ${title} online en HD y en español.`,
    image: manga?.cover || manga?.image,
    imageAlt: title,
    url: `${SITE_URL}/manga/${id}`,
    type: "book",
  });

  const read_ = (c?: ChapterInfo) => { if (c) navigate(`/manga/${id}/leer/${c.id}`); };
  const share = async () => {
    const url = `${SITE_URL}/manga/${id}`;
    try {
      if (navigator.share) { await navigator.share({ title, url }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000);
    } catch { /* cancelado */ }
  };

  if (isLoading) {
    return (
      <div className="iz-page"><Navbar />
        <div className="iz-container" style={{ paddingTop: 40, display: "flex", gap: 24 }}>
          <div className="iz-skel" style={{ width: 200, aspectRatio: "2/3" }} />
          <div style={{ flex: 1, display: "grid", gap: 12, alignContent: "start" }}><div className="iz-skel" style={{ height: 40, width: "60%" }} /><div className="iz-skel" style={{ height: 16, width: "80%" }} /></div>
        </div>
      </div>
    );
  }
  if (isError || !manga) {
    return (
      <div className="iz-page"><Navbar />
        <div className="iz-container" style={{ paddingTop: 60 }}>
          <EmptyState title="No se pudo cargar este manga" action={<div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button type="button" className="iz-btn iz-btn--primary" onClick={() => refetch()}><RefreshCw size={16} /> Reintentar</button>
            <button type="button" className="iz-btn iz-btn--ghost" onClick={() => navigate("/manga")}>Volver al catálogo</button>
          </div>} />
        </div>
      </div>
    );
  }

  const score = toScore10(manga.rating);
  const bg = manga.cover || manga.image;

  return (
    <div className="iz-page iz-page--flush">
      <Navbar transparent />
      <section className="iz-hero" style={{ height: "clamp(340px, 50svh, 480px)" }}>
        {bg && <div className="iz-hero__bg"><img src={bg} alt="" style={{ filter: manga.cover ? undefined : "blur(24px) saturate(1.3)", transform: manga.cover ? undefined : "scale(1.2)" }} /></div>}
        <div className="iz-hero__grid" />
      </section>

      <main className="iz-container" style={{ position: "relative", zIndex: 2, marginTop: "clamp(-240px, -20svh, -140px)" }}>
        <div className="iz-detail">
          <div className="iz-detail__poster"><div className="iz-poster__frame" style={{ borderRadius: 16 }}>{manga.image && <img src={manga.image} alt={title} />}</div></div>
          <div className="iz-detail__info">
            <div className="iz-hero__eyebrow" style={{ marginBottom: 12 }}>
              <span className="iz-tag"><BookOpen size={11} /> Manga</span>
              {manga.status && <span className={`iz-tag ${manga.status === "Ongoing" ? "iz-tag--accent" : ""}`}>{STATUS_ES[manga.status] ?? manga.status}</span>}
            </div>
            <h1 className="iz-detail__title">{title}</h1>
            <div className="iz-hero__meta" style={{ marginTop: 14 }}>
              {score && <span className="iz-score" style={{ fontSize: 15 }}><Star size={14} fill="currentColor" /> {score.toFixed(1)}</span>}
              <span>{chapters.length} capítulos</span>
              {manga.volumes ? <span>{manga.volumes} tomos</span> : null}
              {manga.authors?.length ? <span>{manga.authors.map((a) => a.name).join(", ")}</span> : null}
            </div>
            <div className="iz-hero__cta" style={{ marginTop: 22 }}>
              {resumeChapter ? (
                <button type="button" className="iz-btn iz-btn--primary iz-btn--lg" onClick={() => read_(resumeChapter)}><BookOpen size={18} /> Continuar · Cap. {resumeChapter.chapterNumber}</button>
              ) : first ? (
                <button type="button" className="iz-btn iz-btn--primary iz-btn--lg" onClick={() => read_(first)}><BookOpen size={18} /> Empezar a leer</button>
              ) : null}
              {latest && latest !== first && <button type="button" className="iz-btn iz-btn--ghost iz-btn--lg" onClick={() => read_(latest)}>Último · Cap. {latest.chapterNumber}</button>}
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--lg iz-btn--icon" style={{ width: 50 }} onClick={share} aria-label="Compartir" title="Compartir"><Share2 size={17} /></button>
            </div>
            {copied && <div className="iz-tag iz-tag--accent" style={{ marginTop: 12 }}>✓ Enlace copiado</div>}
            {manga.genres && manga.genres.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>{manga.genres.map((g) => <span key={g} className="iz-chip" style={{ height: 30, fontSize: 12, cursor: "default" }}>{g}</span>)}</div>
            )}
            {desc && (
              <div style={{ marginTop: 22, maxWidth: 820 }}>
                <p style={{ margin: 0, color: "var(--iz-text-2)", fontSize: 15, lineHeight: 1.7 }} className={descExpanded ? "" : "line-clamp-4"}>{desc}</p>
                {desc.length > 280 && <button type="button" className="iz-head__link" style={{ paddingLeft: 0, marginTop: 6 }} onClick={() => setDescExpanded((v) => !v)}>{descExpanded ? "Mostrar menos" : "Leer más"}</button>}
              </div>
            )}
          </div>
        </div>

        <section className="iz-section">
          <div className="iz-head">
            <div>
              <div className="iz-head__eyebrow"><span className="iz-dot" />{read.size > 0 ? `${read.size} leídos de ${chapters.length}` : `${chapters.length} disponibles`}</div>
              <h2 className="iz-head__title">Capítulos</h2>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={15} color="#71717a" style={{ position: "absolute", left: 11, top: 11 }} />
                <input className="iz-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº de capítulo" style={{ width: 170, height: 38, paddingLeft: 34 }} aria-label="Buscar capítulo" />
                {search && <button type="button" aria-label="Limpiar" onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: 9, background: "none", border: 0, color: "#a1a1aa", cursor: "pointer" }}><X size={16} /></button>}
              </div>
              <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm iz-btn--icon" style={{ height: 38, width: 38 }} onClick={() => setAsc((v) => !v)} title={asc ? "Más antiguos primero" : "Más recientes primero"} aria-label="Cambiar orden">
                {asc ? <SortAsc size={16} /> : <SortDesc size={16} />}
              </button>
            </div>
          </div>

          {chapters.length === 0 ? <EmptyState title="Aún no hay capítulos disponibles" /> : (
            <>
              <div className="iz-eps">
                {filtered.slice(0, showCount).map((c) => {
                  const isRead = read.has(c.id);
                  const isCurrent = progress?.chapterId === c.id;
                  return (
                    <button key={c.id} type="button" className={`iz-ep ${isCurrent ? "is-current" : ""} ${isRead && !isCurrent ? "is-watched" : ""}`} onClick={() => read_(c)}>
                      <span className="iz-ep__num" style={{ fontSize: String(c.chapterNumber ?? "").length > 4 ? 12 : 15 }}>{c.chapterNumber ?? "–"}</span>
                      <span className="iz-ep__body">
                        <span className="iz-ep__title">{c.title && !/^cap[ií]tulo\s*[\d.]+$/i.test(c.title.trim()) ? c.title : `Capítulo ${c.chapterNumber}`}</span>
                        <span className="iz-ep__meta">
                          {isCurrent ? <><span className="iz-dot" /> Pág. {(progress?.page ?? 0) + 1} de {progress?.totalPages}</> : isRead ? <><CheckCircle2 size={12} /> Leído</> : formatDate(c.releaseDate) || (c.pages ? `${c.pages} páginas` : "Español")}
                        </span>
                      </span>
                      <span className="iz-ep__play"><BookOpen size={13} /></span>
                    </button>
                  );
                })}
              </div>
              {filtered.length > showCount && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
                  <button type="button" className="iz-btn iz-btn--ghost" onClick={() => setShowCount((n) => n + 120)}>Mostrar más ({filtered.length - showCount} restantes)</button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
