import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { KeyRound, Eye, EyeOff, CheckCircle2, XCircle, Lock } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

export default function ResetPassword() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const token = new URLSearchParams(search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) setError("Enlace inválido. Solicita uno nuevo desde el inicio de sesión.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    setError(null);
    setLoading(true);
    try {
      await apiClient.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "El enlace no es válido o ya expiró");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#07080F",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, position: "relative", overflow: "hidden",
    }}>
      {/* Background glow */}
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,111,255,0.06) 0%, transparent 70%)", top: "20%", left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "32px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.6)", position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 12, fontWeight: 900 }}>▶</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 900 }}>
            <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#7C6FFF" }}>FLEX</span>
          </span>
        </div>

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle2 size={32} color="#22C55E" />
            </div>
            <h2 style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>¡Contraseña actualizada!</h2>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6, margin: "0 0 28px" }}>
              Tu contraseña ha sido restablecida correctamente. Ya puedes iniciar sesión.
            </p>
            <button
              onClick={() => navigate("/")}
              style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}
            >
              Ir al inicio
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(124,111,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={18} color="#B39DFF" />
              </div>
              <div>
                <h1 style={{ color: "#F1F1F5", fontSize: 18, fontWeight: 800, margin: 0 }}>Nueva contraseña</h1>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>Elige una contraseña segura</p>
              </div>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
                <XCircle size={15} color="#F87171" style={{ flexShrink: 0 }} />
                <span style={{ color: "#FCA5A5", fontSize: 13 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ position: "relative" }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <Lock size={15} style={{ position: "absolute", left: 13, color: "rgba(255,255,255,0.3)" }} />
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder="Nueva contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ width: "100%", paddingLeft: 40, paddingRight: 42, paddingTop: 11, paddingBottom: 11, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#F1F1F5", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                    onFocus={(e) => (e.target.style.borderColor = "rgba(124,111,255,0.6)")}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 12, background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                    {showPass ? <EyeOff size={15} color="rgba(255,255,255,0.3)" /> : <Eye size={15} color="rgba(255,255,255,0.3)" />}
                  </button>
                </div>
              </div>

              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Lock size={15} style={{ position: "absolute", left: 13, color: "rgba(255,255,255,0.3)" }} />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Confirmar contraseña"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  style={{ width: "100%", paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#F1F1F5", fontSize: 14, outline: "none", fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(124,111,255,0.6)")}
                  onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>

              {password.length >= 6 && confirm && password !== confirm && (
                <div style={{ color: "#F87171", fontSize: 12 }}>Las contraseñas no coinciden</div>
              )}

              <button
                type="submit"
                disabled={loading || !token}
                style={{ marginTop: 4, padding: "13px 0", borderRadius: 12, border: "none", background: loading ? "rgba(124,111,255,0.5)" : "linear-gradient(135deg,#7C6FFF,#5B52F5)", color: "#fff", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "Guardando..." : "Guardar contraseña"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
