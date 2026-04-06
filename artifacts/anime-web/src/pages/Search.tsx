import { useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X, Star, SlidersHorizontal, Loader2 } from "lucide-react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AdvancedSearch from "@/components/AdvancedSearch";

const QUICK_TAGS = ["Shonen", "Isekai", "Romance", "Action", "Fantasy", "Comedia", "Horror", "Mecha"];
const GENRE_FILTERS = ["Todos", "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Sci-Fi", "Thriller", "Horror"];
const STATUS_FILTERS = ["Todos", "Ongoing", "Completed", "Not yet aired"];

function SearchCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div
      onClick={() => navigate(`/anime/${anime.id}`)}
      style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#13131C", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer", aspectRatio: "2/3", transition: "transform 0.18s, box-shadow 0.18s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 28px rgba(108,99,255,0.28)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = ""; }}
    >
      <img src={anime.image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 48%, rgba(9,10,18,0.97) 100%)" }} />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <span style={{ background: "#22C55E", borderRadius: 4, padding: "2px 5px", color: "#fff", fontSize: 7, fontWeight: 900, letterSpacing: 0.5 }}>SUB</span>
        {anime.totalEpisodes && (
          <span style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 4, padding: "2px 5px", color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: 800 }}>{anime.totalEpisodes}</span>
        )}
      </div>
      {anime.rating != null && anime.rating > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 2, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 5px" }}>
          <Star size={8} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 8, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
        </div>
      )}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 10, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>{title}</div>
        {anime.type && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 600 }}>{anime.type}</div>}
      </div>
    </div>
  );
}

export default function Search() {
  const rawSearch = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(rawSearch);
  const initialQ = params.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [filters, setFilters] = useState({
    genres: [] as string[],
    status: "",
    year: "",
    season: "",
    type: "",
    minRating: 0,
    sortBy: "popularity"
  });

  // Búsqueda avanzada con filtros
  const { data: searchResults, isLoading, error } = useQuery<AnimeResult[]>({
    queryKey: ["search", query, filters],
    queryFn: async (): Promise<AnimeResult[]> => {
      if (!query.trim() && Object.values(filters).every(v => !v || (Array.isArray(v) && v.length === 0))) {
        return [];
      }

      try {
        // Búsqueda básica por texto
        const searchResult = await consumet.search(query);
        let results = searchResult.results;

        // Aplicar filtros
        if (filters.genres.length > 0) {
          results = results.filter((anime: AnimeResult) =>
            anime.genres?.some(genre => filters.genres.includes(genre))
          );
        }

        if (filters.status) {
          results = results.filter((anime: AnimeResult) => anime.status?.toLowerCase() === filters.status.toLowerCase());
        }

        if (filters.year) {
          results = results.filter((anime: AnimeResult) => String(anime.releaseDate || '').includes(filters.year));
        }

        if (filters.minRating > 0) {
          results = results.filter((anime: AnimeResult) => (anime.rating || 0) >= filters.minRating);
        }

        // Ordenar resultados
        switch (filters.sortBy) {
          case "rating":
            results.sort((a: AnimeResult, b: AnimeResult) => (b.rating || 0) - (a.rating || 0));
            break;
          case "latest":
            results.sort((a: AnimeResult, b: AnimeResult) => {
              const dateA = new Date(a.releaseDate || "1900");
              const dateB = new Date(b.releaseDate || "1900");
              return dateB.getTime() - dateA.getTime();
            });
            break;
          case "oldest":
            results.sort((a: AnimeResult, b: AnimeResult) => {
              const dateA = new Date(a.releaseDate || "1900");
              const dateB = new Date(b.releaseDate || "1900");
              return dateA.getTime() - dateB.getTime();
            });
            break;
          case "title":
            results.sort((a: AnimeResult, b: AnimeResult) => resolveTitle(a.title).localeCompare(resolveTitle(b.title)));
            break;
          default: // popularity - mantener orden original
            break;
        }

        return results;
      } catch (err) {
        console.error("Search error:", err);
        return [];
      }
    },
    enabled: !!(query.trim() || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : true))),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const handleAdvancedSearch = (searchQuery: string, searchFilters: typeof filters) => {
    setQuery(searchQuery);
    setFilters(searchFilters);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />
      <div className="pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Búsqueda Avanzada */}
          <div className="mb-8">
            <AdvancedSearch
              onSearch={handleAdvancedSearch}
              isLoading={isLoading}
            />
          </div>

          {/* Resultados */}
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span className="ml-3 text-gray-400">Buscando...</span>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="text-red-400 mb-4">Error al buscar</div>
              <button
                onClick={() => window.location.reload()}
                className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg text-white"
              >
                Reintentar
              </button>
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{query || 'filtros aplicados'}"
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {searchResults.map((anime) => (
                  <SearchCard key={anime.id} anime={anime} />
                ))}
              </div>
            </>
          ) : query || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) ? (
            <div className="text-center py-20">
              <SearchIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No se encontraron resultados</h3>
              <p className="text-gray-500 mb-6">Intenta con otros términos de búsqueda o filtros diferentes</p>
              <button
                onClick={() => {
                  setQuery("");
                  setFilters({
                    genres: [],
                    status: "",
                    year: "",
                    season: "",
                    type: "",
                    minRating: 0,
                    sortBy: "popularity"
                  });
                }}
                className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg text-white"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="text-center py-20">
              <SearchIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">¿Qué buscas?</h3>
              <p className="text-gray-500">Usa la búsqueda avanzada arriba para encontrar tu anime favorito</p>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
