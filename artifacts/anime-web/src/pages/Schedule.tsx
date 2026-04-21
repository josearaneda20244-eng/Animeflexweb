import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Calendar, Clock, Play } from "lucide-react";
import { fetchAiringSchedule } from "@/lib/anilist";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function Schedule() {
  const [, navigate] = useLocation();
  const todayIdx = new Date().getDay();
  const [activeDay, setActiveDay] = useState(todayIdx);

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ["airingSchedule"],
    queryFn: fetchAiringSchedule,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const grouped = DAY_NAMES.map((_, i) => {
    const entries = schedule
      .filter((e) => new Date(e.airingAt * 1000).getDay() === i)
      .sort((a, b) => a.airingAt - b.airingAt);
    return entries;
  });

  const dayEntries = grouped[activeDay] ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <Navbar />
      <div style={{ paddingTop: 56 }}>
        <div style={{ padding: "32px 16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 4, height: 32, borderRadius: 2, background: "#22C55E" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar size={22} color="#22C55E" />
                <span style={{ color: "#F1F1F5", fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>Calendario de Emisión</span>
              </div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 2 }}>Episodios que salen esta semana</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
            {DAY_SHORT.map((d, i) => {
              const isToday = i === todayIdx;
              const isActive = i === activeDay;
              const count = grouped[i].length;
              return (
                <button
                  key={i}
                  onClick={() => setActiveDay(i)}
                  style={{
                    flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "12px 20px", borderRadius: 16,
                    border: `1px solid ${isActive ? "#FF3355" : "rgba(255,255,255,0.1)"}`,
                    background: isActive ? "rgba(244,63,94,0.2)" : "rgba(255,255,255,0.04)",
                    color: isActive ? "#FCA5B5" : "rgba(255,255,255,0.55)",
                    cursor: "pointer", position: "relative",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{d}</span>
                  <span style={{ fontSize: 10, color: isActive ? "#FCA5B5" : "rgba(255,255,255,0.35)" }}>{count} ep</span>
                  {isToday && (
                    <span style={{
                      position: "absolute", top: -4, right: -4, width: 10, height: 10,
                      borderRadius: "50%", background: "#22C55E", border: "2px solid #000",
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "0 16px 60px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ color: "#F1F1F5", fontSize: 18, fontWeight: 800 }}>{DAY_NAMES[activeDay]}</span>
            {activeDay === todayIdx && (
              <span style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "2px 8px", color: "#22C55E", fontSize: 11, fontWeight: 700 }}>
                HOY
              </span>
            )}
          </div>

          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: 90, borderRadius: 16, background: "#12121E" }} />
              ))}
            </div>
          )}

          {!isLoading && dayEntries.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 12 }}>
              <Calendar size={56} color="rgba(255,255,255,0.1)" />
              <div style={{ color: "#F1F1F5", fontWeight: 600 }}>Sin episodios para este día</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Prueba otro día de la semana</div>
            </div>
          )}

          {dayEntries.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {dayEntries.map((entry) => {
                const title = entry.media.title.english || entry.media.title.romaji;
                const time = new Date(entry.airingAt * 1000).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
                const isPast = Date.now() > entry.airingAt * 1000;
                return (
                  <div
                    key={`${entry.media.id}-${entry.episode}`}
                    onClick={() => navigate(`/anime/${entry.media.id}`)}
                    style={{
                      display: "flex", alignItems: "center", gap: 16, padding: 16,
                      background: "#0a0a0a", borderRadius: 16,
                      border: `1px solid ${isPast ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.15)"}`,
                      cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#161620"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#0a0a0a"; }}
                  >
                    <img
                      src={entry.media.coverImage.large}
                      alt={title}
                      style={{ width: 60, height: 85, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 700, marginBottom: 6 }} className="line-clamp-2">{title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{
                          background: "rgba(255,255,255,0.005)", border: "1px solid rgba(255,255,255,0.005)",
                          borderRadius: 6, padding: "2px 8px", color: "#fff", fontSize: 11, fontWeight: 700,
                        }}>
                          EP {entry.episode}
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.45)", fontSize: 12 }}>
                          <Clock size={11} /> {time}
                        </span>
                        {isPast && (
                          <span style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "2px 8px", color: "#22C55E", fontSize: 10, fontWeight: 700 }}>
                            DISPONIBLE
                          </span>
                        )}
                        {!isPast && (
                          <span style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 6, padding: "2px 8px", color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>
                            PRÓXIMO
                          </span>
                        )}
                        {entry.media.format && (
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{entry.media.format}</span>
                        )}
                      </div>
                    </div>
                    <button
                      style={{
                        flexShrink: 0, width: 40, height: 40, borderRadius: "50%",
                        background: isPast ? "#FF3355" : "rgba(255,255,255,0.07)",
                        border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Play size={16} color="#fff" fill={isPast ? "#fff" : "none"} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
