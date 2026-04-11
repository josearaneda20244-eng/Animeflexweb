import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function VerifyEmail() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { refreshUser } = useAuth();
  const params = new URLSearchParams(search);
  const statusParam = params.get("status");
  const msgParam    = params.get("msg") ?? "";

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    statusParam === "success" ? "success"
    : statusParam === "error" ? "error"
    : "loading"
  );
  const [errorMsg, setErrorMsg] = useState(msgParam);

  useEffect(() => {
    /* If the backend already verified and redirected with ?status=success,
       just refresh the auth context so the badge updates. */
    if (statusParam === "success") {
      refreshUser().catch(() => {});
      return;
    }
    if (statusParam === "error") return;

    /* No status param — nothing to do (old ?token= flow is handled server-side now) */
    setStatus("error");
    setErrorMsg("Enlace de verificación no reconocido. Solicita uno nuevo desde Ajustes.");
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#070714",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,197,94,0.05) 0%, transparent 70%)", top: "20%", left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "40px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", textAlign: "center", position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>▶</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 900 }}>
            <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#7C6FFF" }}>FLEX</span>
          </span>
        </div>

        {status === "loading" && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(124,111,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <Loader2 size={28} color="#B39DFF" style={{ animation: "spin 1s linear infinite" }} />
            </div>
            <h2 style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Verificando...</h2>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>Estamos confirmando tu correo electrónico</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle2 size={32} color="#22C55E" />
            </div>
            <h2 style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>¡Correo verificado!</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6, margin: "0 0 28px" }}>
              Tu dirección de correo electrónico ha sido confirmada exitosamente.
            </p>
            <button
              onClick={() => navigate("/")}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Ir al inicio
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <XCircle size={32} color="#F87171" />
            </div>
            <h2 style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>Enlace inválido</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6, margin: "0 0 28px" }}>
              {errorMsg || "El enlace no es válido o ya expiró. Solicita uno nuevo desde tu perfil."}
            </p>
            <button
              onClick={() => navigate("/settings")}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Ir a Ajustes
            </button>
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
