import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BookmarkCheck, RefreshCw } from "lucide-react";
import { fetchAiringSchedule } from "@/lib/anilist";
import { useWatchList } from "@/context/WatchListContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";
import { EmptyState } from "@/components/iz/ui";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Schedule() {
  const [, navigate] = useLocation();
  const todayIdx = new Date().getDay();
  const [activeDay, setActiveDay] = useState(todayIdx);
  const [onlyMine, setOnlyMine] = useState(false);
  const { getStatus } = useWatchList();
  usePageMeta({ title: "Calendario de emisión", description: "Horario semanal de estrenos de anime con la hora local de cada episodio." });

  const { data: schedule = [], isLoading, isError, refetch } = useQuery({ queryKey: ["airingSchedule"], queryFn: fetchAiringSchedule, staleTime: 1000 * 60 * 30, retry: 1 });

  const grouped = useMemo(() => DAY_NAMES.map((_, i) => schedule.filter((e) => new Date(e.airingAt * 1000).getDay() === i).sort((a, b) => a.airingAt - b.airingAt)), [schedule]);
  const entries = (grouped[activeDay] ?? []).filter((e) => !onlyMine || !!getStatus(String(e.media.id)));
  const now = Date.now() / 1000;

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container" style={{ maxWidth: 1100 }}>
        <header className="iz-pagehead">
          <div className="iz-head__eyebrow"><span className="iz-dot" />Calendario</div>
          <h1>Emisiones de la <span className="iz-serif">semana</span></h1>
          <p>Horarios en tu zona horaria. Los animes de tu lista aparecen resaltados.</p>
        </header>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
          {DAY_SHORT.map((d, i) => (
            <button key={d} type="button" className={`iz-chip ${i === activeDay ? "is-active" : ""}`} onClick={() => setActiveDay(i)}>
              {d}{i === todayIdx && <span className="iz-dot" />}
              <span style={{ fontFamily: "var(--iz-mono)", fontSize: 11, opacity: .6 }}>{grouped[i].length}</span>
            </button>
          ))}
          <button type="button" className={`iz-chip ${onlyMine ? "is-active" : ""}`} onClick={() => setOnlyMine((v) => !v)} style={{ marginLeft: "auto" }}>
            <BookmarkCheck size={14} /> Solo mi lista
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: "grid", gap: 8 }}>{Array.from({ length: 6 }).map((_, i) => <div key={i} className="iz-skel" style={{ height: 96 }} />)}</div>
        ) : isError ? (
          <EmptyState title="No pudimos cargar el calendario" action={<button type="button" className="iz-btn iz-btn--primary" onClick={() => refetch()}><RefreshCw size={16} /> Reintentar</button>} />
        ) : entries.length === 0 ? (
          <EmptyState title={`Sin emisiones el ${DAY_NAMES[activeDay].toLowerCase()}`} text={onlyMine ? "Ningún anime de tu lista se emite este día." : undefined} />
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {entries.map((e) => {
              const title = e.media.title.english || e.media.title.romaji;
              const time = new Date(e.airingAt * 1000).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
              const aired = e.airingAt < now;
              const mine = !!getStatus(String(e.media.id));
              return (
                <button key={`${e.media.id}-${e.episode}`} type="button" onClick={() => navigate(`/anime/${e.media.id}`)} className="iz-panel"
                  style={{ display: "grid", gridTemplateColumns: "64px 54px minmax(0,1fr) auto", alignItems: "center", gap: 16, padding: 12, cursor: "pointer", textAlign: "left", color: "inherit", borderColor: mine ? "rgba(99,102,241,.45)" : undefined, opacity: aired ? 0.72 : 1 }}>
                  <div style={{ fontFamily: "var(--iz-mono)", fontSize: 17, fontWeight: 600, textAlign: "center" }}>{time}</div>
                  <img src={e.media.coverImage.large} alt="" loading="lazy" style={{ width: 54, height: 76, borderRadius: 8, objectFit: "cover" }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
                    <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className="iz-tag">EP {e.episode}{e.media.episodes ? ` / ${e.media.episodes}` : ""}</span>
                      <span className="iz-tag">{e.media.format}</span>
                      {mine && <span className="iz-tag iz-tag--accent"><BookmarkCheck size={11} /> En tu lista</span>}
                    </div>
                  </div>
                  <span className={`iz-tag ${aired ? "" : "iz-tag--accent"}`}>{aired ? "Emitido" : "Próximo"}</span>
                </button>
              );
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
