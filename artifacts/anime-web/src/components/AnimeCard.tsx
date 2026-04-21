import { Link } from "wouter";
import { Star, Play, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveTitle, type AnimeResult } from "@/lib/consumet";
import { useFavorites } from "@/context/FavoritesContext";
import { useState } from "react";

interface AnimeCardProps {
  anime: AnimeResult;
  progress?: number;
}

const ACCENT = "#FF3355";
const ACCENT_DEEP = "#E11D48";
const ACCENT_LIGHT = "#FF5C7A";

export default function AnimeCard({ anime, progress }: AnimeCardProps) {
  const title = resolveTitle(anime.title);
  const href = `/anime/${anime.id}`;
  const [hovered, setHovered] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(anime.id);

  return (
    <div className="anime-card group" style={{ position: "relative" }}>
      <Link href={href} style={{ display: "block", textDecoration: "none" }}>
        <motion.div
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
          whileHover={{ y: -6, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 22 }}
          style={{
            borderRadius: 14,
            overflow: "hidden",
            background: "#0c0c14",
            border: `1px solid ${hovered ? "rgba(244,63,94,0.45)" : "rgba(255,255,255,0.06)"}`,
            cursor: "pointer",
            boxShadow: hovered
              ? "0 22px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(244,63,94,0.22), 0 0 28px rgba(244,63,94,0.22)"
              : "0 2px 8px rgba(0,0,0,0.35)",
            transition: "border-color 0.25s ease, box-shadow 0.32s ease",
          }}
        >
          <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden", background: "#13131f" }}>
            <motion.img
              src={anime.image}
              alt={title}
              loading="lazy"
              animate={{ scale: hovered ? 1.08 : 1, filter: hovered ? "brightness(0.78) saturate(1.05)" : "brightness(1) saturate(1)" }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://placehold.co/200x280/0c0c14/FF3355?text=${encodeURIComponent(title.slice(0, 10))}`;
              }}
            />

            {/* Bottom gradient */}
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(to bottom, rgba(7,7,11,0) 40%, rgba(7,7,11,0.55) 75%, rgba(7,7,11,0.96) 100%)",
              pointerEvents: "none",
            }} />

            {/* Hover overlay with play button */}
            <AnimatePresence>
              {hovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, backdropFilter: "blur(2px)" }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{
                    position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", gap: 12,
                    background: "radial-gradient(circle at center, rgba(7,7,11,0.35), rgba(7,7,11,0.7))",
                    WebkitBackdropFilter: "blur(2px)",
                  }}
                >
                  <motion.div
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.6, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 360, damping: 18 }}
                    style={{
                      width: 56, height: 56, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${ACCENT_LIGHT}, ${ACCENT_DEEP})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: `0 10px 28px rgba(244,63,94,0.6), 0 0 0 4px rgba(244,63,94,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`,
                    }}
                  >
                    <Play size={22} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
                  </motion.div>

                  {anime.genres && anime.genres.length > 0 && (
                    <motion.div
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 8, opacity: 0 }}
                      transition={{ delay: 0.05 }}
                      style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", padding: "0 10px" }}
                    >
                      {anime.genres.slice(0, 2).map((g) => (
                        <span key={g} style={{
                          background: "rgba(244,63,94,0.32)", backdropFilter: "blur(8px)",
                          borderRadius: 6, padding: "3px 8px",
                          color: "#FFE2E8", fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4,
                          border: "1px solid rgba(244,63,94,0.4)",
                        }}>{g}</span>
                      ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top badges */}
            <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4, zIndex: 2 }}>
              <span style={{
                background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DEEP})`,
                borderRadius: 6, padding: "2.5px 7px", color: "#fff",
                fontSize: 8.5, fontWeight: 900, letterSpacing: 0.6,
                boxShadow: "0 2px 10px rgba(244,63,94,0.5)",
              }}>LAT</span>
              {anime.type && (
                <span style={{
                  background: "rgba(7,7,11,0.78)", backdropFilter: "blur(8px)",
                  borderRadius: 6, padding: "2.5px 7px", color: "#fff",
                  fontSize: 8.5, fontWeight: 900, letterSpacing: 0.4,
                  border: "1px solid rgba(255,255,255,0.12)",
                }}>{anime.type}</span>
              )}
            </div>

            {/* Progress bar */}
            {progress !== undefined && progress > 0 && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)", zIndex: 2 }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_LIGHT})`,
                    borderRadius: 2,
                    boxShadow: "0 0 10px rgba(244,63,94,0.7)",
                  }}
                />
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
                zIndex: 2,
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
              letterSpacing: "-0.01em",
            }}>{title}</p>
            {anime.releaseDate && (
              <p style={{ margin: "5px 0 0", color: "rgba(255,255,255,0.4)", fontSize: 10.5, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                {anime.releaseDate}
              </p>
            )}
          </div>
        </motion.div>
      </Link>

      {/* Favorite button */}
      <motion.button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(anime); }}
        whileHover={{ scale: 1.18 }}
        whileTap={{ scale: 0.88 }}
        animate={{ scale: fav ? 1.08 : 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 18 }}
        style={{
          position: "absolute", top: 38, right: 8, zIndex: 10,
          width: 32, height: 32, borderRadius: "50%",
          background: fav ? "rgba(244,63,94,0.95)" : "rgba(7,7,11,0.7)",
          backdropFilter: "blur(10px)",
          border: fav ? "1px solid rgba(244,63,94,0.6)" : "1px solid rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
          boxShadow: fav ? "0 4px 16px rgba(244,63,94,0.55)" : "0 2px 8px rgba(0,0,0,0.4)",
        }}
        aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      >
        <Heart size={14} color={fav ? "#fff" : "rgba(255,255,255,0.85)"} fill={fav ? "#fff" : "none"} strokeWidth={2.2} />
      </motion.button>
    </div>
  );
}
