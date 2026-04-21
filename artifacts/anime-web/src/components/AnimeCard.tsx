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
            borderRadius: 14, overflow: "hidden",
            background: "#0c0c14",
            border: `1px solid ${hovered ? "rgba(124,111,255,0.45)" : "rgba(255,255,255,0.06)"}`,
            cursor: "pointer",
            transition: "transform 0.32s cubic-bezier(.22,.68,0,1.2), box-shadow 0.32s ease, border-color 0.25s ease",
            transform: hovered ? "translateY(-6px) scale(1.015)" : "translateY(0) scale(1)",
            boxShadow: hovered
              ? "0 22px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(124,111,255,0.22), 0 0 24px rgba(124,111,255,0.18)"
              : "0 2px 8px rgba(0,0,0,0.35)",
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden", background: "#13131f" }}>
            <img
              src={anime.image}
              alt={title}
              loading="lazy"
              style={{
                width: "100%", height: "100%", objectFit: "cover", display: "block",
                transition: "transform 0.55s cubic-bezier(0.16,1,0.3,1), filter 0.4s ease",
                transform: hovered ? "scale(1.08)" : "scale(1)",
                filter: hovered ? "brightness(0.78) saturate(1.05)" : "brightness(1) saturate(1)",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/200x280/0c0c14/7C6FFF?text=${encodeURIComponent(title.slice(0, 10))}`;
              }}
            />

            {/* Gradient overlay */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(7,7,11,0) 40%, rgba(7,7,11,0.55) 75%, rgba(7,7,11,0.96) 100%)",
              transition: "opacity 0.25s",
            }} />

            {/* Hover overlay with play button */}
            <div style={{
              position: "absolute", inset: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              background: "radial-gradient(circle at center, rgba(7,7,11,0.35), rgba(7,7,11,0.7))",
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.28s ease",
              backdropFilter: hovered ? "blur(2px)" : "none",
              WebkitBackdropFilter: hovered ? "blur(2px)" : "none",
            }}>
              <div style={{
                width: 54, height: 54, borderRadius: "50%",
                background: "linear-gradient(135deg, #8B7FFF, #5B52F5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 24px rgba(124,111,255,0.55), 0 0 0 4px rgba(124,111,255,0.18), inset 0 1px 0 rgba(255,255,255,0.25)",
                transform: hovered ? "scale(1)" : "scale(0.78)",
                transition: "transform 0.32s cubic-bezier(.22,.68,0,1.2)",
              }}>
                <Play size={20} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
              </div>
              {anime.genres && anime.genres.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", padding: "0 10px" }}>
                  {anime.genres.slice(0, 2).map((g) => (
                    <span key={g} style={{
                      background: "rgba(124,111,255,0.32)", backdropFilter: "blur(8px)",
                      borderRadius: 6, padding: "3px 8px",
                      color: "#E5DEFF", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
                      border: "1px solid rgba(124,111,255,0.35)",
                    }}>{g}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Top badges */}
            <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
              <span style={{
                background: "linear-gradient(135deg,#3B82F6,#6366F1)",
                borderRadius: 6, padding: "2.5px 7px", color: "#fff",
                fontSize: 8.5, fontWeight: 900, letterSpacing: 0.6,
                boxShadow: "0 2px 8px rgba(59,130,246,0.45)",
              }}>LAT</span>
              {anime.type && (
                <span style={{
                  background: "rgba(124,111,255,0.92)", backdropFilter: "blur(8px)",
                  borderRadius: 6, padding: "2.5px 7px", color: "#fff",
                  fontSize: 8.5, fontWeight: 900, letterSpacing: 0.4,
                  boxShadow: "0 2px 8px rgba(124,111,255,0.4)",
                }}>{anime.type}</span>
              )}
            </div>

            {/* Progress bar */}
            {progress !== undefined && progress > 0 && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)", zIndex: 2 }}>
                <div style={{
                  height: "100%", width: `${Math.min(progress, 100)}%`,
                  background: "linear-gradient(90deg,#7C6FFF,#B39DFF)",
                  borderRadius: 2,
                  boxShadow: "0 0 10px rgba(124,111,255,0.6)",
                }} />
              </div>
            )}

            {/* Rating badge */}
            {anime.rating && (
              <div style={{
                position: "absolute", top: 8, right: 8,
                background: "rgba(7,7,11,0.78)", backdropFilter: "blur(10px)",
                borderRadius: 7, padding: "2.5px 7px",
                display: "flex", alignItems: "center", gap: 3,
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}>
                <Star size={9} color="#FBBF24" fill="#FBBF24" />
                <span style={{ color: "#fff", fontSize: 9.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {typeof anime.rating === "number" ? anime.rating.toFixed(1) : anime.rating}
                </span>
              </div>
            )}
          </div>

          {/* Card footer */}
          <div style={{ padding: "11px 11px 13px" }}>
            <p style={{
              margin: 0, color: "#fff",
              fontSize: 12.5, fontWeight: 600, lineHeight: 1.4,
              overflow: "hidden", display: "-webkit-box",
              WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              transition: "color 0.2s",
              letterSpacing: "-0.01em",
            }}>{title}</p>
            {anime.releaseDate && (
              <p style={{ margin: "5px 0 0", color: "rgba(255,255,255,0.4)", fontSize: 10.5, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                {anime.releaseDate}
              </p>
            )}
          </div>
        </div>
      </Link>

      {/* Favorite button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(anime); }}
        style={{
          position: "absolute", top: 38, right: 8, zIndex: 10,
          width: 30, height: 30, borderRadius: "50%",
          background: fav ? "rgba(239,68,68,0.92)" : "rgba(7,7,11,0.7)",
          backdropFilter: "blur(10px)",
          border: fav ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          transform: `scale(${fav ? 1.08 : 1})`,
          transition: "all 0.22s cubic-bezier(.22,.68,0,1.2)",
          boxShadow: fav ? "0 4px 14px rgba(239,68,68,0.5)" : "0 2px 8px rgba(0,0,0,0.35)",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.18)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = `scale(${fav ? 1.08 : 1})`; }}
        aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      >
        <Heart size={13} color={fav ? "#fff" : "rgba(255,255,255,0.78)"} fill={fav ? "#fff" : "none"} strokeWidth={2.2} />
      </button>
    </div>
  );
}
