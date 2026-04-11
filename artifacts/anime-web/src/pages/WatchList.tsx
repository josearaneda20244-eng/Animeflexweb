import { useState } from "react";
import { useLocation } from "wouter";
import { Play, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useWatchList, type WatchStatus } from "@/context/WatchListContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DraggableWatchlist from "@/components/DraggableWatchlist";

const TABS: { value: WatchStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "watching", label: "Viendo", icon: <Play size={14} fill="currentColor" />, color: "#7C6FFF" },
  { value: "completed", label: "Completado", icon: <CheckCircle2 size={14} />, color: "#22C55E" },
  { value: "plan_to_watch", label: "Pendiente", icon: <Clock3 size={14} />, color: "#F59E0B" },
  { value: "dropped", label: "Abandonado", icon: <XCircle size={14} />, color: "#EF4444" },
];

export default function WatchList() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<WatchStatus>("watching");
  const { getByStatus, setStatus } = useWatchList();

  const currentTab = TABS.find((t) => t.value === activeTab)!;

  const handleStatusChange = (animeId: string, newStatus: WatchStatus) => {
    // Buscar el anime en todas las listas para cambiar su estado
    const allItems = [
      ...getByStatus("watching"),
      ...getByStatus("completed"),
      ...getByStatus("plan_to_watch"),
      ...getByStatus("dropped")
    ];
    const anime = allItems.find(item => item.anime.id === animeId)?.anime;
    if (anime) {
      setStatus(anime, newStatus);
    }
  };

  const handleRemove = (animeId: string) => {
    // Buscar el anime en todas las listas para removerlo
    const allItems = [
      ...getByStatus("watching"),
      ...getByStatus("completed"),
      ...getByStatus("plan_to_watch"),
      ...getByStatus("dropped")
    ];
    const anime = allItems.find(item => item.anime.id === animeId)?.anime;
    if (anime) {
      setStatus(anime, null);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <Navbar />
      <div style={{ padding: "0 16px 40px", paddingTop: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 20, paddingTop: 4 }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: "#7C6FFF" }} />
          <div>
            <div style={{ color: "#F1F1F5", fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>Mi Lista</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 1 }}>Tu colección personal de anime</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const count = getByStatus(tab.value).length;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
                  borderRadius: 12, border: `1px solid ${isActive ? tab.color + "55" : "rgba(255,255,255,0.1)"}`,
                  background: isActive ? tab.color + "18" : "#0a0a0a",
                  color: isActive ? tab.color : "rgba(255,255,255,0.5)",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {tab.icon}
                {tab.label}
                {count > 0 && (
                  <span style={{
                    background: isActive ? tab.color + "33" : "rgba(255,255,255,0.08)",
                    color: isActive ? tab.color : "rgba(255,255,255,0.4)",
                    borderRadius: 20, padding: "1px 7px", fontSize: 11, fontWeight: 800,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Draggable Watchlist */}
        <DraggableWatchlist
          status={activeTab}
          onStatusChange={handleStatusChange}
          onRemove={handleRemove}
          className="max-w-4xl mx-auto"
        />

        {/* Empty State Alternative */}
        {getByStatus(activeTab).length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40, gap: 12 }}>
            <div style={{ opacity: 0.15, color: currentTab.color, fontSize: 64 }}>
              {currentTab.icon}
            </div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 16 }}>
              Sin anime en "{currentTab.label}"
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, textAlign: "center", maxWidth: 260 }}>
              {activeTab === "dropped"
                ? "Aquí aparecerán los anime que hayas abandonado."
                : "Explora anime y márcalos con \"Mi Lista\" en cada página de detalles."}
            </div>
            <button
              onClick={() => navigate("/")}
              style={{
                marginTop: 8, padding: "10px 20px", borderRadius: 12,
                background: "linear-gradient(135deg,#7C6FFF,#5B52F5)",
                border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Explorar anime
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
