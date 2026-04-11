import { Link } from "wouter";
import { Star, Play, Heart } from "lucide-react";
import { resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useFavorites } from "@/context/FavoritesContext";
import { useState } from "react";

interface AnimeCardProps {
  anime: AnimeResult;
  progress?: number;
}

export default function AnimeCard({ anime, progress }: AnimeCardProps) {
  const title = resolveTitle(anime.title);
  const href = `/anime/${anime.id}`;
  const [hovered, setHovered] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(anime.id);

  return (
    <div className="anime-card group" style={{ position: "relative" }}>
      <Link href={href} style={{ display: "block", textDecoration: "none" }}>
        <div
          style={{
            borderRadius: 14, overflow: "hidden", background: "#100e22", cursor: "pointer",
            transition: "transform 0.18s ease, box-shadow 0.18s ease",
            transform: hovered ? "translateY(-5px)" : "",
            boxShadow: hovered ? "0 12px 32px rgba(124,111,255,0.35)" : "none",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden", background: "#1A1A27" }}>
            <img
              src={anime.image}
              alt={title}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.3s", transform: hovered ? "scale(1.06)" : "scale(1)" }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/200x280/13131C/6C63FF?text=${encodeURIComponent(title.slice(0, 10))}`;
              }}
            />

            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(9,10,18,0) 40%, rgba(9,10,18,0.97) 100%)",
              opacity: hovered ? 1 : 0.7, transition: "opacity 0.2s",
            }} />

            {hovered && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                background: "rgba(9,10,18,0.55)",
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: "50%",
                  background: "linear-gradient(135deg, #7C6FFF, #5B52F5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 14px rgba(124,111,255,0.5)",
                }}>
                  <Play size={18} color="#fff" fill="#fff" />
                </div>
                {anime.genres && anime.genres.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", padding: "0 10px" }}>
                    {anime.genres.slice(0, 2).map((g) => (
                      <span key={g} style={{
                        background: "rgba(124,111,255,0.35)", borderRadius: 6,
                        padding: "2px 6px", color: "#B39DFF", fontSize: 8, fontWeight: 700,
                      }}>{g}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ position: "absolute", top: 6, left: 6, display: "flex", gap: 3 }}>
              <span style={{ background: "#22C55E", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.4 }}>SUB</span>
              {anime.type && (
                <span style={{ background: "rgba(124,111,255,0.85)", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.4 }}>{anime.type}</span>
              )}
            </div>

            {anime.rating != null && anime.rating > 0 && (
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", alignItems: "center", gap: 2, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 5px" }}>
                <Star size={8} color="#F59E0B" fill="#F59E0B" />
                <span style={{ color: "#F59E0B", fontSize: 8, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
              </div>
            )}

            {progress != null && progress > 0 && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.15)" }}>
                <div style={{ height: "100%", background: "#7C6FFF", width: `${Math.min(progress * 100, 100)}%` }} />
              </div>
            )}
          </div>

          <div style={{ padding: "8px 8px 6px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#F0F0FF", lineHeight: 1.35, margin: 0 }} className="line-clamp-2">{title}</p>
            {anime.status && (
              <p style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2, margin: 0 }}>{anime.status}</p>
            )}
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => { e.preventDefault(); toggleFavorite(anime); }}
        title={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
        style={{
          position: "absolute", bottom: 40, right: 8, zIndex: 5,
          width: 26, height: 26, borderRadius: "50%",
          background: fav ? "rgba(236,72,153,0.9)" : "rgba(9,10,18,0.75)",
          border: `1.5px solid ${fav ? "#EC4899" : "rgba(255,255,255,0.2)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", opacity: hovered || fav ? 1 : 0, transition: "opacity 0.2s",
        }}
      >
        <Heart size={11} color="#fff" fill={fav ? "#fff" : "none"} />
      </button>
    </div>
  );
}
