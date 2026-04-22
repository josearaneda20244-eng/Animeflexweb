import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Film, Star, Play, Shuffle } from "lucide-react";
import { byFormatDirect, resolveTitle, type AnimeResult } from "@/lib/consumet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

function MovieCard({ anime }: { anime: AnimeResult }) {
  const [, navigate] = useLocation();
  const title = resolveTitle(anime.title);
  return (
    <div
      onClick={() => navigate(`/anime/${anime.id}`)}
      style={{
        position: "relative", borderRadius: 14, overflow: "hidden",
        background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.07)",
        cursor: "pointer", aspectRatio: "2/3", transition: "transform 0.18s, box-shadow 0.18s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-5px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 14px 32px rgba(220,38,38,0.35)";
        const overlay = (e.currentTarget as HTMLDivElement).querySelector(".hover-overlay") as HTMLDivElement;
        if (overlay) overlay.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = "";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        const overlay = (e.currentTarget as HTMLDivElement).querySelector(".hover-overlay") as HTMLDivElement;
        if (overlay) overlay.style.opacity = "0";
      }}
    >
      <img src={anime.image} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(9,10,18,0.98) 100%)" }} />

      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 4 }}>
        <span style={{ background: "#DC2626", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 8, fontWeight: 900 }}>MOVIE</span>
        <span style={{ background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 6px", color: "#fff", fontSize: 8, fontWeight: 800 }}>HD</span>
      </div>

      {anime.rating != null && anime.rating > 0 && (
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 2, background: "rgba(0,0,0,0.75)", borderRadius: 4, padding: "2px 5px" }}>
          <Star size={8} color="#F59E0B" fill="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 8, fontWeight: 800 }}>{(anime.rating / 10).toFixed(1)}</span>
        </div>
      )}

      <div className="hover-overlay" style={{
        position: "absolute", inset: 0, background: "rgba(9,10,18,0.75)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 10, opacity: 0, transition: "opacity 0.2s",
      }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Play size={20} color="#fff" fill="#fff" />
        </div>
        {anime.genres && anime.genres.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", padding: "0 12px" }}>
            {anime.genres.slice(0, 3).map((g) => (
              <span key={g} style={{ background: "rgba(220,38,38,0.3)", border: "1px solid rgba(220,38,38,0.5)", borderRadius: 6, padding: "2px 6px", color: "#FECACA", fontSize: 9, fontWeight: 700 }}>{g}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 10 }}>
        <div style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{title}</div>
        {anime.releaseDate && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, marginTop: 2 }}>{anime.releaseDate}</div>}
      </div>
    </div>
  );
}

export default function Movies() {
  const [, navigate] = useLocation();

  const page1 = useQuery({
    queryKey: ["movies-direct-1"],
    queryFn: () => byFormatDirect("MOVIE", 1),
    staleTime: 1000 * 60 * 15,
    retry: 3,
    retryDelay: (i: number) => Math.min(1000 * Math.pow(2, i), 8000),
  });

  const page2 = useQuery({
    queryKey: ["movies-direct-2"],
    queryFn: () => byFormatDirect("MOVIE", 2),
    staleTime: 1000 * 60 * 15,
    retry: 3,
    retryDelay: (i: number) => Math.min(1000 * Math.pow(2, i), 8000),
  });

  const page3 = useQuery({
    queryKey: ["movies-direct-3"],
    queryFn: () => byFormatDirect("MOVIE", 3),
    staleTime: 1000 * 60 * 15,
    retry: 3,
    retryDelay: (i: number) => Math.min(1000 * Math.pow(2, i), 8000),
  });

  const allMovies = [
    ...(page1.data?.results ?? []),
    ...(page2.data?.results ?? []),
    ...(page3.data?.results ?? []),
  ];

  const uniqueMovies = Array.from(new Map(allMovies.map((m) => [m.id, m])).values());

  const handleRandom = () => {
    if (uniqueMovies.length > 0) {
      const r = uniqueMovies[Math.floor(Math.random() * uniqueMovies.length)];
      navigate(`/anime/${r.id}`);
    }
  };

  const isLoading = page1.isLoading;
  const isError = page1.isError && page2.isError;

  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <Navbar />
      <div style={{ paddingTop: 56 }}>
        <div style={{ padding: "32px 16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 32, borderRadius: 2, background: "#DC2626" }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Film size={22} color="#DC2626" />
                  <span style={{ color: "#F1F1F5", fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>Películas</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 2 }}>Las mejores películas de anime en HD</div>
              </div>
            </div>
            <button
              onClick={handleRandom}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 12, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.35)", color: "#FECACA", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Shuffle size={16} /> Aleatoria
            </button>
          </div>
        </div>

        <div style={{ padding: "0 16px 60px" }}>
          {isLoading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 14, background: "#12121E", aspectRatio: "2/3" }} />
              ))}
            </div>
          )}

          {!isLoading && isError && uniqueMovies.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 12 }}>
              <Film size={56} color="rgba(255,255,255,0.15)" />
              <div style={{ color: "#F1F1F5", fontWeight: 600 }}>Error al cargar películas</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Hubo un problema al conectarse. Intenta de nuevo.</div>
              <button
                onClick={() => { page1.refetch(); page2.refetch(); page3.refetch(); }}
                style={{ marginTop: 8, padding: "10px 24px", borderRadius: 12, background: "#DC2626", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Reintentar
              </button>
            </div>
          )}
          {!isLoading && !isError && uniqueMovies.length === 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 80, gap: 12 }}>
              <Film size={56} color="rgba(255,255,255,0.1)" />
              <div style={{ color: "#F1F1F5", fontWeight: 600 }}>No se encontraron películas</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>Intenta buscar directamente</div>
              <button
                onClick={() => navigate("/search?q=movie")}
                style={{ marginTop: 8, padding: "10px 24px", borderRadius: 12, background: "#DC2626", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                Buscar Películas
              </button>
            </div>
          )}

          {uniqueMovies.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 14 }}>
              {uniqueMovies.map((movie) => <MovieCard key={movie.id} anime={movie} />)}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
