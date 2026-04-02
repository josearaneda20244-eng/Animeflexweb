import { useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X, SlidersHorizontal } from "lucide-react";
import AnimeCard from "@/components/AnimeCard";
import { SkeletonRow } from "@/components/SkeletonCard";
import { consumet } from "@/lib/consumet";

const QUICK_TAGS = ["Shonen", "Isekai", "Romance", "Action", "Fantasy", "Comedia", "Horror", "Mecha"];

export default function Search() {
  const rawSearch = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(rawSearch);
  const initialQ = params.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [submitted, setSubmitted] = useState(initialQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(rawSearch).get("q") ?? "";
    setQuery(q);
    setSubmitted(q);
  }, [rawSearch]);

  const searchQuery = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => consumet.search(submitted),
    enabled: submitted.trim().length > 0,
  });

  const handleChange = (t: string) => {
    setQuery(t);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (t.trim().length > 1) setSubmitted(t.trim());
      else if (t.trim().length === 0) setSubmitted("");
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) setSubmitted(query.trim());
  };

  const handleQuick = (tag: string) => {
    setQuery(tag);
    setSubmitted(tag);
  };

  const handleClear = () => {
    setQuery("");
    setSubmitted("");
    inputRef.current?.focus();
  };

  const results = searchQuery.data?.results ?? [];

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 md:px-8 max-w-screen-2xl mx-auto" style={{ background: "#090A12" }}>
      {/* Search box */}
      <div className="mb-6">
        <form onSubmit={handleSubmit}>
          <div className="relative flex items-center">
            <SearchIcon size={18} className="absolute left-4 text-[#4A4A6A]" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Buscar anime..."
              autoFocus
              className="w-full pl-11 pr-10 py-3 rounded-xl text-[#F0F0FF] placeholder-[#4A4A6A] text-sm font-medium outline-none focus:ring-2 focus:ring-[#6C63FF]/40 transition-all"
              style={{ background: "#13131C", border: "1px solid #1E1E32" }}
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 text-[#4A4A6A] hover:text-[#9090B0] transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        {/* Quick tags */}
        <div className="flex flex-wrap gap-2 mt-3">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleQuick(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                submitted === tag
                  ? "text-white"
                  : "text-[#9090B0] hover:text-[#F0F0FF]"
              }`}
              style={
                submitted === tag
                  ? { background: "linear-gradient(135deg,#6C63FF,#EC4899)", border: "none" }
                  : { background: "#13131C", border: "1px solid #1E1E32" }
              }
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {searchQuery.isLoading && <SkeletonRow count={12} />}

      {searchQuery.isError && (
        <div className="flex flex-col items-center py-20 text-[#4A4A6A]">
          <SearchIcon size={48} className="mb-4 opacity-30" />
          <p className="text-sm">Error al buscar. Intenta de nuevo.</p>
        </div>
      )}

      {!searchQuery.isLoading && !searchQuery.isError && submitted && results.length === 0 && (
        <div className="flex flex-col items-center py-20 text-[#4A4A6A]">
          <SearchIcon size={48} className="mb-4 opacity-30" />
          <p className="font-medium text-[#F0F0FF]">Sin resultados para "{submitted}"</p>
          <p className="text-sm mt-1">Prueba con otro título</p>
        </div>
      )}

      {!searchQuery.isLoading && !submitted && (
        <div className="flex flex-col items-center py-20 text-[#4A4A6A]">
          <SearchIcon size={48} className="mb-4 opacity-30" />
          <p className="text-sm">Escribe algo para buscar anime</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          <p className="text-xs text-[#9090B0] mb-4">{results.length} resultados para "{submitted}"</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {results.map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
