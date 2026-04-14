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
              borderRadius: 12, overflow: "hidden",
              background: "#0E0E1A",
              border: `1px solid ${hovered ? "rgba(124,111,255,0.4)" : "rgba(255,255,255,0.06)"}`,
              cursor: "pointer",
              transition: "transform 0.22s cubic-bezier(.22,.68,0,1.2), box-shadow 0.22s ease, border-color 0.2s ease",
              transform: hovered ? "translateY(-6px) scale(1.01)" : "translateY(0) scale(1)",
              boxShadow: hovered ? "0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,111,255,0.2)" : "0 2px 8px rgba(0,0,0,0.3)",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden", background: "#1A1A2E" }}>
              <img
                src={anime.image}
                alt={title}
                loading="lazy"
                style={{
                  width: "100%", height: "100%", objectFit: "cover", display: "block",
                  transition: "transform 0.4s cubic-bezier(.22,.68,0,1.2)",
                  transform: hovered ? "scale(1.08)" : "scale(1)"
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://placehold.co/200x280/0E0E1A/6C63FF?text=${encodeURIComponent(title.slice(0, 10))}`;
                }}
              />

              {/* Gradient overlay */}
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to bottom, rgba(9,10,18,0) 45%, rgba(9,10,18,0.95) 100%)",
                transition: "opacity 0.2s",
              }} />

              {/* Hover overlay with play button */}
              <div style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                background: "rgba(9,10,18,0.5)",
                opacity: hovered ? 1 : 0,
                transition: "opacity 0.25s ease",
              }}>
                <div style={{
                  width: 50, height: 50, borderRadius: "50%",
                  background: "linear-gradient(135deg, #7C6FFF, #5B52F5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(124,111,255,0.6)",
                  transform: hovered ? "scale(1)" : "scale(0.8)",
                  transition: "transform 0.25s cubic-bezier(.22,.68,0,1.2)",
                }}>
                  <Play size={20} color="#fff" fill="#fff" />
                </div>
                {anime.genres && anime.genres.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", padding: "0 10px" }}>
                    {anime.genres.slice(0, 2).map((g) => (
                      <span key={g} style={{
                        background: "rgba(124,111,255,0.4)", backdropFilter: "blur(8px)",
                        borderRadius: 6, padding: "2px 8px",
                        color: "#D4CAFF", fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
                      }}>{g}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Top badges */}
              <div style={{ position: "absolute", top: 7, left: 7, display: "flex", gap: 4 }}>
                <span style={{
                  background: "linear-gradient(135deg,#3B82F6,#6366F1)",
                  borderRadius: 5, padding: "2px 6px", color: "#fff",
                  fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                  boxShadow: "0 2px 6px rgba(59,130,246,0.4)",
                }}>LAT</span>
                {anime.type && (
                  <span style={{
                    background: "rgba(124,111,255,0.85)", backdropFilter: "blur(8px)",
                    borderRadius: 5, padding: "2px 6px", color: "#fff",
                    fontSize: 8, fontWeight: 900, letterSpacing: 0.3,
                  }}>{anime.type}</span>
                )}
              </div>

              {/* Progress bar */}
              {progress !== undefined && progress > 0 && (
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)" }}>
                  <div style={{ height: "100%", width: `${Math.min(progress, 100)}%`, background: "linear-gradient(90deg,#7C6FFF,#B39DFF)", borderRadius: 2 }} />
                </div>
              )}

              {/* Rating badge */}
              {anime.rating && (
                <div style={{
                  position: "absolute", top: 7, right: 7,
                  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
                  borderRadius: 6, padding: "2px 6px",
                  display: "flex", alignItems: "center", gap: 3,
                  border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  <Star size={9} color="#FBBF24" fill="#FBBF24" />
                  <span style={{ color: "#F1F1F5", fontSize: 9, fontWeight: 700 }}>
                    {typeof anime.rating === "number" ? anime.rating.toFixed(1) : anime.rating}
                  </span>
                </div>
              )}
            </div>

            {/* Card footer */}
            <div style={{ padding: "10px 10px 12px" }}>
              <p style={{
                margin: 0, color: hovered ? "#fff" : "rgba(255,255,255,0.88)",
                fontSize: 12, fontWeight: 600, lineHeight: 1.4,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                transition: "color 0.2s",
              }}>{title}</p>
              {anime.releaseDate && (
                <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
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
            position: "absolute", top: 36, right: 8, zIndex: 10,
            width: 28, height: 28, borderRadius: "50%",
            background: fav ? "rgba(239,68,68,0.9)" : "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            border: fav ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transform: `scale(${fav ? 1.1 : 1})`,
            transition: "all 0.2s cubic-bezier(.22,.68,0,1.2)",
            boxShadow: fav ? "0 2px 10px rgba(239,68,68,0.4)" : "none",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = `scale(${fav ? 1.1 : 1})`; }}
        >
          <Heart size={12} color={fav ? "#fff" : "rgba(255,255,255,0.7)"} fill={fav ? "#fff" : "none"} />
        </button>
      </div>
    );
  }
  