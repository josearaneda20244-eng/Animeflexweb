import { Heart, Compass } from "lucide-react";
import { useLocation } from "wouter";
import { useFavorites } from "@/context/FavoritesContext";
import { resolveTitle, type AnimeResult } from "@/lib/consumet";
import { Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function FavCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div
      onClick={() => navigate(`/anime/${anime.id}`)}
      style={{ position: "relative", cursor: "pointer" }}
    >
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.07)", aspectRatio: "2/3" }}>
        <img src={anime.image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 45%, rgba(9,10,18,0.97) 100%)" }} />
        <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
          <span style={{ background: "linear-gradient(135deg,#7C6FFF,#6366F1)", borderRadius: 5, padding: "2px 6px", color: "#fff", fontSize: 8, fontWeight: 900, letterSpacing: 0.5 }}>LAT</span>
          {anime.totalEpisodes && (
            <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, padding: "2px 6px", color: "rgba(255,255,255,0.9)", fontSize: 8, fontWeight: 800 }}>{anime.totalEpisodes} EP</span>
          )}
        </div>
        {anime.status === "Ongoing" && (
          <div style={{ position: "absolute", bottom: 42, left: 8, display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 5, padding: "2px 6px" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E" }} />
            <span style={{ color: "#22C55E", fontSize: 8, fontWeight: 900, letterSpacing: 0.5 }}>LIVE</span>
          </div>
        )}
        {anime.rating != null && anime.rating > 0 && (
          <div style={{ position: "absolute", bottom: 42, right: 8, display: "flex", alignItems: "center", gap: 2, background: "rgba(0,0,0,0.8)", borderRadius: 5, padding: "2px 5px" }}>
            <Star size={8} color="#F59E0B" fill="#F59E0B" />
            <span style={{ color: "#F59E0B", fontSize: 9, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
          </div>
        )}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 10, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>{title}</div>
          {anime.type && (
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600 }}>{anime.type}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Favorites() {
  const [, navigate] = useLocation();
  const { favorites } = useFavorites();

  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <Navbar />

      <div style={{ padding: "0 16px 40px", paddingTop: 72 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 14, paddingTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: "#7C6FFF" }} />
            <div>
              <div style={{ color: "#F1F1F5", fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>Favoritos</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 1 }}>
                {favorites.length > 0 ? `${favorites.length} anime${favorites.length !== 1 ? "s" : ""} guardado${favorites.length !== 1 ? "s" : ""}` : "Tu lista personal"}
              </div>
            </div>
          </div>
          {favorites.length > 0 && (
            <div style={{ background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", borderRadius: 14, padding: "6px 12px" }}>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>{favorites.length}</span>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", marginBottom: 16 }} />

        {favorites.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 14 }}>
            <div style={{ width: 110, height: 110, borderRadius: 55, background: "rgba(124,111,255,0.1)", border: "1px solid rgba(124,111,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Heart size={48} color="#7C6FFF" />
            </div>
            <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 800 }}>Aún no tienes favoritos</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, textAlign: "center", lineHeight: 1.6, maxWidth: 280 }}>
              Toca el corazón en cualquier anime para guardarlo aquí
            </div>
            <button
              onClick={() => navigate("/")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(124,111,255,0.15)", border: "1px solid rgba(124,111,255,0.3)", borderRadius: 20, padding: "9px 16px", color: "#7C6FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
            >
              <Compass size={14} /> Explorar anime
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
            {favorites.map((anime) => <FavCard key={anime.id} anime={anime} />)}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
