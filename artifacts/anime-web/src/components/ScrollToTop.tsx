import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      title="Volver arriba"
      style={{
        position: "fixed", bottom: 24, right: 20, zIndex: 999,
        width: 44, height: 44, borderRadius: "50%",
        background: "linear-gradient(135deg,#FF3355,#E11D48)",
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(244,63,94,0.45)",
        transition: "transform 0.18s, box-shadow 0.18s",
        animation: "fadeInUp 0.25s ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12) translateY(-2px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 28px rgba(244,63,94,0.6)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(244,63,94,0.45)";
      }}
    >
      <ChevronUp size={22} color="#fff" strokeWidth={2.5} />
    </button>
  );
}
