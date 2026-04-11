import { useLocation } from "wouter";

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Background glow orbs */}
      <div style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,111,255,0.07) 0%, transparent 70%)",
        top: "10%", left: "50%", transform: "translateX(-50%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(236,72,153,0.05) 0%, transparent 70%)",
        bottom: "15%", right: "10%",
        pointerEvents: "none",
      }} />

      {/* Anime character SVG */}
      <svg
        width="180"
        height="200"
        viewBox="0 0 180 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ marginBottom: 8, opacity: 0.9 }}
      >
        {/* Body silhouette */}
        <ellipse cx="90" cy="180" rx="40" ry="12" fill="rgba(124,111,255,0.15)" />
        {/* Legs */}
        <rect x="72" y="140" width="14" height="42" rx="7" fill="#1E1E32" />
        <rect x="94" y="140" width="14" height="42" rx="7" fill="#1E1E32" />
        {/* Skirt/body */}
        <path d="M55 100 Q90 115 125 100 L118 145 Q90 155 62 145 Z" fill="#2A2A4A" />
        {/* Torso */}
        <rect x="65" y="72" width="50" height="35" rx="12" fill="#1E1E32" />
        {/* Arms */}
        <rect x="40" y="78" width="28" height="13" rx="6.5" fill="#1E1E32" transform="rotate(-15 40 78)" />
        <rect x="112" y="78" width="28" height="13" rx="6.5" fill="#1E1E32" transform="rotate(15 112 78)" />
        {/* Hand holding question mark */}
        <circle cx="35" cy="96" r="10" fill="#2A2A4A" />
        <text x="31" y="101" fontSize="12" fill="#B39DFF" fontWeight="900">?</text>
        {/* Neck */}
        <rect x="83" y="58" width="14" height="16" rx="7" fill="#2A2A4A" />
        {/* Head */}
        <ellipse cx="90" cy="44" rx="30" ry="34" fill="#2A2A4A" />
        {/* Hair */}
        <path d="M60 30 Q60 5 90 8 Q120 5 120 30 Q115 20 90 22 Q65 20 60 30Z" fill="#7C6FFF" />
        <path d="M60 30 Q52 40 55 55 Q60 48 65 50 Z" fill="#7C6FFF" />
        <path d="M120 30 Q128 40 125 55 Q120 48 115 50 Z" fill="#7C6FFF" />
        {/* Eyes — swirly X eyes */}
        <text x="76" y="45" fontSize="13" fill="#F0F0FF" fontWeight="900" textAnchor="middle">×</text>
        <text x="104" y="45" fontSize="13" fill="#F0F0FF" fontWeight="900" textAnchor="middle">×</text>
        {/* Mouth */}
        <path d="M82 56 Q90 62 98 56" stroke="#F0F0FF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Sweat drop */}
        <path d="M122 22 Q125 18 128 22 Q128 27 125 27 Q122 27 122 22Z" fill="#fff" opacity="0.7" />
        {/* Stars around */}
        <text x="145" y="50" fontSize="12" fill="#F59E0B" opacity="0.6">★</text>
        <text x="28" y="60" fontSize="10" fill="#B39DFF" opacity="0.5">✦</text>
        <text x="150" y="90" fontSize="8" fill="#EC4899" opacity="0.5">✦</text>
      </svg>

      {/* 404 big text */}
      <div
        style={{
          fontSize: "clamp(80px,18vw,120px)",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: -4,
          background: "linear-gradient(135deg, #7C6FFF 0%, #B39DFF 50%, #EC4899 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          marginBottom: 8,
          userSelect: "none",
        }}
      >
        404
      </div>

      {/* Main message */}
      <h1
        style={{
          color: "#F1F1F5",
          fontSize: "clamp(18px, 4vw, 24px)",
          fontWeight: 800,
          margin: "0 0 10px",
          textAlign: "center",
          letterSpacing: -0.3,
        }}
      >
        Esta página se perdió en el multiverso
      </h1>

      <p
        style={{
          color: "rgba(255,255,255,0.4)",
          fontSize: 15,
          textAlign: "center",
          maxWidth: 340,
          lineHeight: 1.6,
          margin: "0 0 32px",
        }}
      >
        La ruta que buscas no existe o fue movida. Puede que un isekai la haya transportado a otra dimensión.
      </p>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={() => navigate("/")}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg, #7C6FFF, #5B52F5)",
            border: "none", borderRadius: 14, padding: "12px 24px",
            color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 8px 24px rgba(124,111,255,0.3)",
          }}
        >
          🏠 Ir al inicio
        </button>
        <button
          onClick={() => window.history.back()}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14, padding: "12px 24px",
            color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}
        >
          ← Volver
        </button>
      </div>

      {/* Bottom tip */}
      <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 12, marginTop: 40, textAlign: "center" }}>
        AnimeFlex · Error 404
      </p>
    </div>
  );
}
