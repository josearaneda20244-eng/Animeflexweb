import { useState } from "react";
import { useLocation } from "wouter";
import { Play, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { useWatchList, type WatchStatus } from "@/context/WatchListContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DraggableWatchlist from "@/components/DraggableWatchlist";
import { EmptyState } from "@/components/iz/ui";
import { usePageMeta } from "@/lib/usePageMeta";

const TABS: { value: WatchStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "watching", label: "Viendo", icon: <Play size={14} fill="currentColor" />, color: "#3f2eb2" },
  { value: "completed", label: "Completado", icon: <CheckCircle2 size={14} />, color: "#22C55E" },
  { value: "plan_to_watch", label: "Pendiente", icon: <Clock3 size={14} />, color: "#F59E0B" },
  { value: "dropped", label: "Abandonado", icon: <XCircle size={14} />, color: "#EF4444" },
];

export default function WatchList() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<WatchStatus>("watching");
  const { getByStatus, setStatus } = useWatchList();

  const currentTab = TABS.find((t) => t.value === activeTab)!;
  usePageMeta({ title: "Mi lista", noindex: true });

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
    <div className="iz-page">
      <Navbar />
      <main className="iz-container" style={{ maxWidth: 1100 }}>
        <header className="iz-pagehead">
          <div className="iz-head__eyebrow"><span className="iz-dot" />Tu biblioteca</div>
          <h1>Mi <span className="iz-serif">lista</span></h1>
          <p>Organiza lo que ves. Arrastra para reordenar o cambia el estado de cada anime.</p>
        </header>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const count = getByStatus(tab.value).length;
            return (
              <button key={tab.value} type="button" className={`iz-chip ${activeTab === tab.value ? "is-active" : ""}`} onClick={() => setActiveTab(tab.value)}>
                {tab.icon}{tab.label}
                {count > 0 && <span style={{ fontFamily: "var(--iz-mono)", fontSize: 11, opacity: .7 }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {getByStatus(activeTab).length === 0 ? (
          <EmptyState title={`Nada en “${currentTab.label}”`}
            text={activeTab === "dropped" ? "Aquí aparecerán los animes que abandones." : "Añade animes desde su página con el botón “Mi lista”."}
            action={<button type="button" className="iz-btn iz-btn--primary" onClick={() => navigate("/search")}>Explorar anime</button>} />
        ) : (
          <DraggableWatchlist status={activeTab} onStatusChange={handleStatusChange} onRemove={handleRemove} />
        )}
      </main>
      <Footer />
    </div>
  );
}
