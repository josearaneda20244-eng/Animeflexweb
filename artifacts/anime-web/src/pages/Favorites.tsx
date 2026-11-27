import { Compass, HeartOff } from "lucide-react";
import { useLocation } from "wouter";
import { useFavorites } from "@/context/FavoritesContext";
import { resolveTitle } from "@/lib/consumet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";
import { PosterCard, EmptyState, toScore10 } from "@/components/iz/ui";

export default function Favorites() {
  const [, navigate] = useLocation();
  const { favorites, removeFavorite } = useFavorites();
  usePageMeta({ title: "Mis favoritos", noindex: true });

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container">
        <header className="iz-pagehead">
          <div className="iz-head__eyebrow"><span className="iz-dot" />Tu biblioteca</div>
          <h1>Mis <span className="iz-serif">favoritos</span></h1>
          <p>{favorites.length > 0 ? `${favorites.length} ${favorites.length === 1 ? "anime guardado" : "animes guardados"}.` : "Guarda los animes que más te gustan con el corazón en su página."}</p>
        </header>
        {favorites.length === 0 ? (
          <EmptyState title="Aún no tienes favoritos" text="Explora el catálogo y pulsa el corazón para guardarlos aquí."
            action={<button type="button" className="iz-btn iz-btn--primary" onClick={() => navigate("/search")}><Compass size={16} /> Explorar anime</button>} />
        ) : (
          <div className="iz-grid">
            {favorites.map((a) => (
              <div key={a.id} style={{ position: "relative" }}>
                <PosterCard data={{ id: a.id, title: resolveTitle(a.title), image: a.image, score: toScore10(a.rating), meta: a.type }} />
                <button type="button" className="iz-btn iz-btn--ghost iz-btn--icon iz-btn--sm" title="Quitar de favoritos" aria-label="Quitar de favoritos"
                  onClick={() => removeFavorite(a.id)} style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, background: "rgba(0,0,0,.7)", zIndex: 2 }}>
                  <HeartOff size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
