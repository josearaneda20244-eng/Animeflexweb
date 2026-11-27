import { useLocation } from "wouter";
import { Home, Compass } from "lucide-react";
import Navbar from "@/components/Navbar";
import { usePageMeta } from "@/lib/usePageMeta";

export default function NotFound() {
  const [, navigate] = useLocation();
  usePageMeta({ title: "Página no encontrada", noindex: true });
  return (
    <div className="iz-page" style={{ display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main className="iz-container" style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: "60px var(--iz-pad)", position: "relative" }}>
        <div className="iz-hero__grid" style={{ opacity: .06 }} />
        <div>
          <div style={{ font: "800 clamp(96px, 18vw, 200px)/.9 'Inter', sans-serif", letterSpacing: "-.08em", color: "#000", WebkitTextStroke: "2px rgba(255,255,255,.25)" }}>404</div>
          <h1 style={{ margin: "18px 0 0", fontSize: "clamp(26px, 3.4vw, 40px)", fontWeight: 500, letterSpacing: "-.04em" }}>Este episodio <span className="iz-serif">no existe</span></h1>
          <p style={{ margin: "12px auto 0", maxWidth: 440, color: "var(--iz-muted)", fontSize: 15, lineHeight: 1.6 }}>La página que buscas se movió o nunca fue emitida. Vuelve al inicio o explora el catálogo.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
            <button type="button" className="iz-btn iz-btn--primary iz-btn--lg" onClick={() => navigate("/")}><Home size={17} /> Ir al inicio</button>
            <button type="button" className="iz-btn iz-btn--ghost iz-btn--lg" onClick={() => navigate("/search")}><Compass size={17} /> Explorar</button>
          </div>
        </div>
      </main>
    </div>
  );
}
