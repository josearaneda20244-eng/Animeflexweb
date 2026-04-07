import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";

interface AuthModalProps {
  onClose: () => void;
}

type TabMode = "login" | "register" | "forgot";

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<TabMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  const reset = () => {
    setUsername(""); setEmail(""); setPassword("");
    setError(null); setForgotSent(false);
  };

  const switchTab = (t: TabMode) => { setTab(t); reset(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
        onClose();
      } else if (tab === "register") {
        await register(username, email, password);
        onClose();
      } else {
        await apiClient.post("/auth/forgot-password", { email });
        setForgotSent(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 400, background: "#0D0D1A",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
          overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
          margin: "auto", position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {tab === "forgot" && (
              <button
                onClick={() => switchTab("login")}
                style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 8, padding: 6, cursor: "pointer", display: "flex", marginRight: 2 }}
              >
                <ArrowLeft size={14} color="rgba(255,255,255,0.6)" />
              </button>
            )}
            <div style={{ width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#7C6FFF,#5B52F5)" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>▶</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 900 }}>
              <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#7C6FFF" }}>FLEX</span>
            </span>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex" }}>
            <X size={15} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Tabs (only login/register) */}
        {tab !== "forgot" && (
          <div style={{ display: "flex", margin: "20px 24px 0", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4 }}>
            {(["login", "register"] as const).map((t) => (
              <button key={t} onClick={() => switchTab(t)} style={{
                flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
                background: tab === t ? "#7C6FFF" : "transparent",
                color: tab === t ? "#fff" : "rgba(255,255,255,0.5)",
                fontSize: 13, fontWeight: 700, transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                {t === "login" ? <><LogIn size={13} /> Iniciar sesión</> : <><UserPlus size={13} /> Registrarse</>}
              </button>
            ))}
          </div>
        )}

        {/* Forgot password title */}
        {tab === "forgot" && (
          <div style={{ padding: "20px 24px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(124,111,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={15} color="#B39DFF" />
              </div>
              <div>
                <div style={{ color: "#F1F1F5", fontSize: 15, fontWeight: 800 }}>Recuperar contraseña</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>Te enviaremos un enlace por email</div>
              </div>
            </div>
          </div>
        )}

        {/* Forgot sent success state */}
        {forgotSent ? (
          <div style={{ padding: "24px 24px 28px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={26} color="#22C55E" />
            </div>
            <div>
              <div style={{ color: "#F1F1F5", fontSize: 15, fontWeight: 800, marginBottom: 6 }}>¡Revisa tu bandeja!</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6 }}>
                Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
              </div>
            </div>
            <button
              onClick={() => switchTab("login")}
              style={{ padding: "11px 24px", borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#F1F1F5", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              Volver al inicio de sesión
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {tab === "register" && (
              <Field icon={<User size={15} />} placeholder="Nombre de usuario" value={username}
                onChange={setUsername} type="text" required />
            )}
            <Field icon={<Mail size={15} />} placeholder="Correo electrónico" value={email}
              onChange={setEmail} type="email" required />
            {tab !== "forgot" && (
              <div style={{ position: "relative" }}>
                <Field icon={<Lock size={15} />} placeholder="Contraseña" value={password}
                  onChange={setPassword} type={showPass ? "text" : "password"} required />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
                  {showPass ? <EyeOff size={15} color="rgba(255,255,255,0.35)" /> : <Eye size={15} color="rgba(255,255,255,0.35)" />}
                </button>
              </div>
            )}

            {error && (
              <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: "#FCA5A5", fontSize: 13 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              marginTop: 4, padding: "13px 0", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "rgba(124,111,255,0.5)" : "linear-gradient(135deg,#7C6FFF,#5B52F5)",
              color: "#fff", fontSize: 14, fontWeight: 800, transition: "opacity 0.2s",
            }}>
              {loading ? "Cargando..." : tab === "login" ? "Entrar" : tab === "register" ? "Crear cuenta" : "Enviar enlace"}
            </button>

            {tab === "login" && (
              <button
                type="button"
                onClick={() => switchTab("forgot")}
                style={{ background: "none", border: "none", color: "rgba(167,139,250,0.7)", fontSize: 12, cursor: "pointer", padding: 0, textAlign: "center" }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {tab !== "forgot" && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>
                {tab === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
                <button type="button" onClick={() => switchTab(tab === "login" ? "register" : "login")}
                  style={{ background: "none", border: "none", color: "#B39DFF", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                  {tab === "login" ? "Regístrate" : "Inicia sesión"}
                </button>
              </p>
            )}
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

function Field({ icon, placeholder, value, onChange, type, required }: {
  icon: React.ReactNode; placeholder: string; value: string;
  onChange: (v: string) => void; type: string; required?: boolean;
}) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <span style={{ position: "absolute", left: 13, color: "rgba(255,255,255,0.3)", display: "flex" }}>{icon}</span>
      <input
        type={type} placeholder={placeholder} value={value} required={required}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12, color: "#F1F1F5", fontSize: 14, outline: "none", fontFamily: "inherit",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(124,111,255,0.6)")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
      />
    </div>
  );
}
