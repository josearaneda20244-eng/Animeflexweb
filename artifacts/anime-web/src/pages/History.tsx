import { Trash2, X, Play, Compass } from "lucide-react";
import { useLocation } from "wouter";
import { useHistory, type HistoryEntry } from "@/context/HistoryContext";
import { resolveTitle } from "@/lib/consumet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";
import { EmptyState } from "@/components/iz/ui";
import { useWatchProgress } from "@/context/WatchProgressContext";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(diff / 86400000);
  return `Hace ${days}d`;
}

function groupByDay(entries: HistoryEntry[]) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7);
  const today: HistoryEntry[] = [], yesterday: HistoryEntry[] = [], week: HistoryEntry[] = [], older: HistoryEntry[] = [];
  for (const e of entries) {
    if (e.watchedAt >= todayStart.getTime()) today.push(e);
    else if (e.watchedAt >= yesterdayStart.getTime()) yesterday.push(e);
    else if (e.watchedAt >= weekStart.getTime()) week.push(e);
    else older.push(e);
  }
  const sections: { title: string; data: HistoryEntry[] }[] = [];
  if (today.length) sections.push({ title: "Hoy", data: today });
  if (yesterday.length) sections.push({ title: "Ayer", data: yesterday });
  if (week.length) sections.push({ title: "Esta semana", data: week });
  if (older.length) sections.push({ title: "Más antiguo", data: older });
  return sections;
}

function HistoryItem({ entry, onRemove }: { entry: HistoryEntry; onRemove: () => void }) {
  const [, navigate] = useLocation();
  const { getAnimeProgress } = useWatchProgress();
  const title = resolveTitle(entry.title);
  const p = getAnimeProgress(String(entry.id));
  const pct = p && p.duration > 0 ? Math.min(1, p.currentTime / p.duration) : 0;
  const resume = () => {
    if (p) {
      const q = new URLSearchParams({ episodeId: p.episodeId, episodeNum: String(p.episodeNum), animeTitle: p.animeTitle, animeId: p.animeId, animeImage: p.animeImage });
      navigate(`/watch?${q.toString()}`);
    } else navigate(`/anime/${entry.id}`);
  };
  return (
    <div className="iz-rank__row" style={{ gridTemplateColumns: "60px minmax(0,1fr) auto", borderBottom: "1px solid var(--iz-line)" }} onClick={resume} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") resume(); }}>
      <img src={entry.image} alt="" loading="lazy" style={{ width: 60, height: 84 }} />
      <div style={{ minWidth: 0 }}>
        <strong>{title}</strong>
        <small>
          {entry.episodeNum ? `Episodio ${entry.episodeNum} · ` : ""}{timeAgo(entry.watchedAt)}
        </small>
        {pct > 0 && (
          <div style={{ marginTop: 8, height: 3, maxWidth: 240, borderRadius: 3, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
            <div style={{ width: `${Math.round(pct * 100)}%`, height: "100%", background: "linear-gradient(90deg,var(--iz-accent),var(--iz-accent-2))" }} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <span className="iz-btn iz-btn--ghost iz-btn--sm iz-hide-m" aria-hidden><Play size={14} fill="currentColor" /> {p ? "Continuar" : "Ver"}</span>
        <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm" title="Eliminar del historial" aria-label="Eliminar del historial"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}><X size={15} /></button>
      </div>
    </div>
  );
}

export default function History() {
  const [, navigate] = useLocation();
  const { history, removeFromHistory, clearHistory } = useHistory();
  const sections = groupByDay(history);
  usePageMeta({ title: "Historial", noindex: true });

  const handleClearAll = () => {
    if (confirm("¿Seguro que quieres borrar todo el historial?")) clearHistory();
  };

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container" style={{ maxWidth: 1000 }}>
        <header className="iz-pagehead" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="iz-head__eyebrow"><span className="iz-dot" />Tu biblioteca</div>
            <h1>Historial <span className="iz-serif">reciente</span></h1>
            <p>Retoma cualquier episodio justo donde lo dejaste.</p>
          </div>
          {history.length > 0 && <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" onClick={handleClearAll}><Trash2 size={15} /> Borrar todo</button>}
        </header>
        {history.length === 0 ? (
          <EmptyState title="Tu historial está vacío" text="Los animes que veas aparecerán aquí automáticamente."
            action={<button type="button" className="iz-btn iz-btn--primary" onClick={() => navigate("/")}><Compass size={16} /> Descubrir anime</button>} />
        ) : (
          sections.map((sec) => (
            <section key={sec.title} style={{ marginBottom: 32 }}>
              <div className="iz-head__eyebrow" style={{ marginBottom: 8 }}>{sec.title}</div>
              {sec.data.map((e) => <HistoryItem key={`${e.id}-${e.watchedAt}`} entry={e} onRemove={() => removeFromHistory(e.id)} />)}
            </section>
          ))
        )}
      </main>
      <Footer />
    </div>
  );
}
