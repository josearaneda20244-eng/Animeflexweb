import { useState } from "react";
import { useLocation } from "wouter";
import { Play, CheckCircle2, Clock3, BookOpen, Trash2 } from "lucide-react";
import { resolveTitle } from "@/lib/consumet";
import { useWatchList, type WatchStatus } from "@/context/WatchListContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TABS: { value: WatchStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "watching", label: "Viendo", icon: <Play size={14} fill="currentColor" />, color: "#6C63FF" },
  { value: "completed", label: "Completado", icon: <CheckCircle2 size={14} />, color: "#22C55E" },
  { value: "plan_to_watch", label: "Pendiente", icon: <Clock3 size={14} />, color: "#F59E0B" },
];

export default function WatchList() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<WatchStatus>("watching");
  const { getByStatus, setStatus } = useWatchList();

  const items = getByStatus(activeTab);
  const currentTab = TABS.find((t) => t.value === activeTab)!;

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <Navbar />
      <div style={{ padding: "0 16px 40px", paddingTop: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 20, paddingTop: 4 }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: "#6C63FF" }} />
          <div>
            <div style={{ color: "#F1F1F5", fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>Mi Lista</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 1 }}>Tu colección personal de anime</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
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
                  background: isActive ? tab.color + "18" : "#13131C",
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

        {/* Grid */}
        {items.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 12 }}>
            <div style={{ opacity: 0.15, color: currentTab.color, fontSize: 64 }}>
              {currentTab.icon}
            </div>
            <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 16 }}>
              Sin anime en "{currentTab.label}"
            </div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, textAlign: "center", maxWidth: 260 }}>
              Explora anime y márcalos con "Mi Lista" en cada página de detalles.
            </div>
            <button
              onClick={() => navigate("/")}
              style={{
                marginTop: 8, padding: "10px 20px", borderRadius: 12,
                background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
                border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Explorar anime
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
            {items.map(({ anime }) => {
              const title = resolveTitle(anime.title);
              return (
                <div key={anime.id} style={{ position: "relative" }}>
                  <div
                    onClick={() => navigate(`/anime/${anime.id}`)}
                    style={{
                      borderRadius: 14, overflow: "hidden", background: "#13131C",
                      border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer",
                      aspectRatio: "2/3", transition: "transform 0.18s, box-shadow 0.18s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 28px rgba(108,99,255,0.28)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "";
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "";
                    }}
                  >
                    <img
                      src={anime.image}
                      alt={title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(9,10,18,0.97) 100%)" }} />
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 10 }}>
                      <div style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as any}>
                        {title}
                      </div>
                    </div>
                    <div style={{
                      position: "absolute", top: 8, left: 8,
                      background: currentTab.color + "cc",
                      borderRadius: 6, padding: "3px 6px",
                      display: "flex", alignItems: "center", gap: 4,
                      color: "#fff", fontSize: 9, fontWeight: 800,
                    }}>
                      {currentTab.icon}
                    </div>
                  </div>
                  <button
                    onClick={() => setStatus(anime, null)}
                    title="Quitar de la lista"
                    style={{
                      position: "absolute", top: 6, right: 6,
                      background: "rgba(0,0,0,0.7)", border: "none",
                      borderRadius: 8, padding: 5, cursor: "pointer",
                      display: "flex", alignItems: "center",
                      opacity: 0, transition: "opacity 0.15s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.8)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.7)"; }}
                  >
                    <Trash2 size={12} color="#fff" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
