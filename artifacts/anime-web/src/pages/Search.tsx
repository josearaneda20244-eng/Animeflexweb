import { useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon, X, Star, SlidersHorizontal } from "lucide-react";
import { consumet, resolveTitle, type AnimeResult } from "@/lib/consumet";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
  const [submitted, setSubmitted] = useState(initialQ);
  const [genre, setGenre] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(rawSearch).get("q") ?? "";
    setQuery(q);
    setSubmitted(q);
  }, [rawSearch]);

  useEffect(() => {
    if (!submitted.trim() || submitted.trim().length < 2) return;
    const t = setTimeout(() => {
      apiClient.post("/search-log", { query: submitted.trim() }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [submitted]);

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

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (query.trim()) setSubmitted(query.trim()); };
  const handleQuick = (tag: string) => { setQuery(tag); setSubmitted(tag); };
  const handleClear = () => { setQuery(""); setSubmitted(""); inputRef.current?.focus(); };

  let results = searchQuery.data?.results ?? [];
  if (genre !== "Todos") results = results.filter((a) => a.genres?.some((g) => g.toLowerCase() === genre.toLowerCase()));
  if (status !== "Todos") results = results.filter((a) => a.status === status);
  const activeFilters = (genre !== "Todos" ? 1 : 0) + (status !== "Todos" ? 1 : 0);

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <Navbar />

      <div style={{ padding: "0 16px 40px", paddingTop: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, paddingTop: 4 }}>
          <div style={{ width: 4, height: 28, borderRadius: 2, background: "#6C63FF" }} />
          <div>
            <div style={{ color: "#F1F1F5", fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>Buscar</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 1 }}>Encuentra tu próximo favorito</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
              <SearchIcon size={17} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 14 }} />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => handleChange(e.target.value)}
                placeholder="Buscar anime..."
                autoFocus
                style={{
                  width: "100%", paddingLeft: 44, paddingRight: query ? 40 : 14, paddingTop: 13, paddingBottom: 13,
                  borderRadius: 14, background: "#13131C", border: "1px solid rgba(255,255,255,0.1)",
                  color: "#F1F1F5", fontSize: 15, fontWeight: 500, outline: "none",
                  fontFamily: "inherit",
                }}
                onFocus={e => (e.target.style.borderColor = "rgba(108,99,255,0.5)")}
                onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
              />
              {query && (
                <button type="button" onClick={handleClear} style={{ position: "absolute", right: 12, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 10, padding: 4, cursor: "pointer", display: "flex" }}>
                  <X size={12} color="rgba(255,255,255,0.65)" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              style={{ position: "relative", background: showFilters ? "rgba(108,99,255,0.2)" : "#13131C", border: `1px solid ${showFilters ? "rgba(108,99,255,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 14, padding: "0 14px", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <SlidersHorizontal size={18} color={showFilters ? "#6C63FF" : "rgba(255,255,255,0.65)"} />
              {activeFilters > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, background: "#6C63FF", borderRadius: 8, width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 900 }}>{activeFilters}</span>
              )}
            </button>
            <button type="submit" style={{ background: "linear-gradient(135deg, #6C63FF, #4F46E5)", border: "none", borderRadius: 14, padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <SearchIcon size={18} color="#fff" />
            </button>
          </div>
        </form>

        {showFilters && (
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Género</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {GENRE_FILTERS.map(g => (
                  <button key={g} onClick={() => setGenre(g)} style={{ background: genre === g ? "rgba(108,99,255,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${genre === g ? "rgba(108,99,255,0.5)" : "rgba(255,255,255,0.07)"}`, borderRadius: 8, padding: "5px 10px", color: genre === g ? "#A78BFA" : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{g}</button>
                ))}
              </div>
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Estado</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {STATUS_FILTERS.map(s => (
                  <button key={s} onClick={() => setStatus(s)} style={{ background: status === s ? "rgba(108,99,255,0.25)" : "rgba(255,255,255,0.05)", border: `1px solid ${status === s ? "rgba(108,99,255,0.5)" : "rgba(255,255,255,0.07)"}`, borderRadius: 8, padding: "5px 10px", color: status === s ? "#A78BFA" : "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => handleQuick(tag)}
              style={{
                background: submitted === tag ? "linear-gradient(135deg,#6C63FF,#EC4899)" : "#13131C",
                border: `1px solid ${submitted === tag ? "transparent" : "rgba(255,255,255,0.1)"}`,
                borderRadius: 20, padding: "7px 14px", color: submitted === tag ? "#fff" : "rgba(255,255,255,0.65)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {tag}
            </button>
          ))}
        </div>

        {searchQuery.isLoading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
            {Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ borderRadius: 14, background: "#12121E", aspectRatio: "2/3" }} />)}
          </div>
        )}

        {!searchQuery.isLoading && submitted && results.length === 0 && !searchQuery.isError && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 10 }}>
            <SearchIcon size={48} color="rgba(255,255,255,0.1)" />
            <div style={{ color: "#F1F1F5", fontWeight: 600 }}>Sin resultados para "{submitted}"</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Prueba con otro título</div>
          </div>
        )}

        {!submitted && !searchQuery.isLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60, gap: 10 }}>
            <SearchIcon size={48} color="rgba(255,255,255,0.1)" />
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Escribe algo para buscar anime</div>
          </div>
        )}

        {results.length > 0 && (
          <>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginBottom: 12 }}>{results.length} resultados para "{submitted}"</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
              {results.map((anime) => <SearchCard key={anime.id} anime={anime} />)}
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
