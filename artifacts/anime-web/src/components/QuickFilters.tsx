import { useLocation } from "wouter";
import { Tv, Film, Disc, Sparkles, Shuffle, Search } from "lucide-react";

interface QuickFiltersProps {
  onJump: (sectionId: string) => void;
}

const SECTION_CHIPS = [
  { id: "trending", label: "Tendencias", icon: "🔥" },
  { id: "seasonal", label: "Temporada", icon: "🌸" },
  { id: "recent", label: "Últimos eps", icon: "⚡" },
  { id: "popular", label: "Populares", icon: "⭐" },
  { id: "schedule", label: "Calendario", icon: "📅" },
  { id: "top", label: "Top 10", icon: "🏆" },
];

export default function QuickFilters({ onJump }: QuickFiltersProps) {
  const [, navigate] = useLocation();

  const surprise = () => {
    const tags = ["Action", "Adventure", "Romance", "Comedy", "Fantasy", "Sci-Fi", "Thriller", "Mystery", "Sports", "Slice of Life"];
    const pick = tags[Math.floor(Math.random() * tags.length)];
    navigate(`/search?q=${encodeURIComponent(pick)}`);
  };

  return (
    <div style={{ padding: "16px 18px 4px" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 6,
          scrollbarWidth: "none",
        }}
        className="quick-filters-row"
      >
        {SECTION_CHIPS.map((c) => (
          <button
            key={c.id}
            onClick={() => onJump(c.id)}
            style={{
              flexShrink: 0,
              padding: "7px 12px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.85)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              transition: "background 0.15s, border-color 0.15s",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(220,38,38,0.12)";
              e.currentTarget.style.borderColor = "rgba(220,38,38,0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            <span style={{ fontSize: 13 }}>{c.icon}</span> {c.label}
          </button>
        ))}

        <div style={{ width: 1, background: "rgba(255,255,255,0.1)", flexShrink: 0, margin: "4px 4px" }} />

        <button
          onClick={() => navigate("/search?type=TV")}
          style={chipStyle()}
          title="Series TV"
        >
          <Tv size={12} /> TV
        </button>
        <button
          onClick={() => navigate("/movies")}
          style={chipStyle()}
          title="Películas"
        >
          <Film size={12} /> Películas
        </button>
        <button
          onClick={() => navigate("/ovas")}
          style={chipStyle()}
          title="OVAs y especiales"
        >
          <Disc size={12} /> OVAs
        </button>
        <button
          onClick={surprise}
          style={{
            ...chipStyle(),
            background: "linear-gradient(135deg, rgba(220,38,38,0.18), rgba(249,115,22,0.18))",
            borderColor: "rgba(220,38,38,0.35)",
            color: "#FCA5A5",
          }}
          title="Sorpréndeme"
        >
          <Shuffle size={12} /> Sorpréndeme
        </button>
        <button
          onClick={() => navigate("/search")}
          style={chipStyle()}
          title="Búsqueda avanzada"
        >
          <Search size={12} /> Buscar
        </button>
      </div>
      <style>{`.quick-filters-row::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

function chipStyle(): React.CSSProperties {
  return {
    flexShrink: 0,
    padding: "7px 12px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.78)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "inherit",
    transition: "background 0.15s, border-color 0.15s",
  };
}
