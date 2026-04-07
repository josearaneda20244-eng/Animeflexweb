import { Clock, Trash2, X, Play, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useHistory, type HistoryEntry } from "@/context/HistoryContext";
import { resolveTitle } from "@/lib/consumet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
  const title = resolveTitle(entry.title);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 4px",
        borderBottom: "1px solid rgba(255,255,255,0.07)", borderRadius: 4, cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#12121E")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      onClick={() => navigate(`/anime/${entry.id}`)}
    >
      <img src={entry.image} alt={title} style={{ width: 65, height: 90, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, lineHeight: 1.35 }} className="line-clamp-2">{title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {entry.type && <span style={{ color: "#7C6FFF", fontSize: 10, fontWeight: 700, background: "rgba(124,111,255,0.18)", padding: "1px 5px", borderRadius: 4 }}>{entry.type}</span>}
          {entry.episodeNum && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,0.75)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 6, padding: "2px 6px", color: "#06B6D4", fontSize: 10, fontWeight: 800 }}>
              <Play size={9} color="#06B6D4" /> EP {entry.episodeNum}
            </span>
          )}
        </div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{timeAgo(entry.watchedAt)}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex" }}
          title="Eliminar"
        >
          <X size={14} color="rgba(255,255,255,0.5)" />
        </button>
        <ChevronRight size={16} color="rgba(255,255,255,0.35)" />
      </div>
    </div>
  );
}

export default function History() {
  const [, navigate] = useLocation();
  const { history, removeFromHistory, clearHistory } = useHistory();
  const sections = groupByDay(history);

  const handleClearAll = () => {
    if (confirm("¿Estás seguro de que quieres borrar todo el historial?")) {
      clearHistory();
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#07080F" }}>
      <Navbar />

      <div style={{ padding: "0 16px 40px", paddingTop: 72 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, paddingTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: "#7C6FFF" }} />
            <div>
              <div style={{ color: "#F1F1F5", fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>Historial</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 1 }}>
                {history.length > 0 ? `${history.length} anime${history.length !== 1 ? "s" : ""} vistos` : "Tu actividad reciente"}
              </div>
            </div>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "7px 12px", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
            >
              <Trash2 size={13} /> Borrar todo
            </button>
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 8 }} />

        {history.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14 }}>
            <div style={{ width: 110, height: 110, borderRadius: 55, background: "rgba(124,111,255,0.1)", border: "1px solid rgba(124,111,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={48} color="#7C6FFF" />
            </div>
            <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 800 }}>Sin historial todavía</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
              Los animes que veas aparecerán aquí
            </div>
            <button
              onClick={() => navigate("/")}
              style={{ background: "rgba(124,111,255,0.15)", border: "1px solid rgba(124,111,255,0.3)", borderRadius: 20, padding: "9px 16px", color: "#7C6FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
            >
              Explorar anime
            </button>
          </div>
        ) : (
          <div>
            {sections.map((section) => (
              <div key={section.title} style={{ marginTop: 20 }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4, paddingLeft: 4 }}>
                  {section.title}
                </div>
                {section.data.map((entry) => (
                  <HistoryItem key={entry.id} entry={entry} onRemove={() => removeFromHistory(entry.id)} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
