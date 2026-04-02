import { Clock, Trash2, X } from "lucide-react";
import { useLocation } from "wouter";
import AnimeCard from "@/components/AnimeCard";
import { useHistory } from "@/context/HistoryContext";
import { resolveTitle } from "@/lib/consumet";

export default function History() {
  const [, navigate] = useLocation();
  const { history, removeFromHistory, clearHistory } = useHistory();

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 md:px-8 max-w-screen-2xl mx-auto" style={{ background: "#090A12" }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="section-accent" />
          <div>
            <h1 className="text-xl font-bold text-[#F0F0FF]">Historial</h1>
            <p className="text-xs text-[#9090B0] mt-0.5">
              {history.length > 0 ? `${history.length} visto${history.length !== 1 ? "s" : ""}` : "Sin historial"}
            </p>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#9090B0] hover:text-[#EF4444] transition-colors border border-[#1E1E32]"
          >
            <Trash2 size={13} />
            Borrar todo
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-[#4A4A6A]">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: "rgba(108,99,255,0.1)" }}
          >
            <Clock size={36} className="text-[#6C63FF]" />
          </div>
          <p className="text-[#F0F0FF] font-medium mb-1">Sin historial todavía</p>
          <p className="text-sm text-center max-w-xs">
            Los animes que veas aparecerán aquí
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
          >
            Explorar anime
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {history.map((entry) => (
            <div key={entry.id} className="relative group">
              <AnimeCard
                anime={entry}
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeFromHistory(entry.id);
                }}
                className="absolute top-1 left-1 p-1 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X size={10} />
              </button>
              {entry.episodeNum && (
                <div className="absolute bottom-7 left-2 bg-[#6C63FF]/90 rounded px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Ep. {entry.episodeNum}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
