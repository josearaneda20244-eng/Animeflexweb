import { Heart } from "lucide-react";
import { useLocation } from "wouter";
import AnimeCard from "@/components/AnimeCard";
import { useFavorites } from "@/context/FavoritesContext";

export default function Favorites() {
  const [, navigate] = useLocation();
  const { favorites } = useFavorites();

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 md:px-8 max-w-screen-2xl mx-auto" style={{ background: "#090A12" }}>
      <div className="flex items-center gap-3 mb-6">
        <div className="section-accent" />
        <div>
          <h1 className="text-xl font-bold text-[#F0F0FF]">Favoritos</h1>
          <p className="text-xs text-[#9090B0] mt-0.5">
            {favorites.length > 0
              ? `${favorites.length} anime${favorites.length !== 1 ? "s" : ""} guardado${favorites.length !== 1 ? "s" : ""}`
              : "Tu lista personal"}
          </p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-[#4A4A6A]">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
            style={{ background: "rgba(108,99,255,0.1)" }}
          >
            <Heart size={36} className="text-[#6C63FF]" />
          </div>
          <p className="text-[#F0F0FF] font-medium mb-1">Aún no tienes favoritos</p>
          <p className="text-sm text-center max-w-xs">
            Toca el corazón en cualquier anime para guardarlo aquí
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
          {favorites.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      )}
    </div>
  );
}
