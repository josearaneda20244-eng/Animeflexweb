import { useState } from "react";
import { X, Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setUsername(""); setEmail(""); setPassword(""); setError(null); };

  const switchTab = (t: "login" | "register") => { setTab(t); reset(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  return (
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
          margin: "auto",
          position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#6C63FF,#4F46E5)" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>▶</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 900 }}>
              <span style={{ color: "#F1F1F5" }}>Anime</span><span style={{ color: "#6C63FF" }}>FLEX</span>
            </span>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", display: "flex" }}>
            <X size={15} color="rgba(255,255,255,0.6)" />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", margin: "20px 24px 0", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4 }}>
          {(["login", "register"] as const).map((t) => (
            <button key={t} onClick={() => switchTab(t)} style={{
              flex: 1, padding: "9px 0", borderRadius: 9, border: "none", cursor: "pointer",
              background: tab === t ? "#6C63FF" : "transparent",
              color: tab === t ? "#fff" : "rgba(255,255,255,0.5)",
              fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {t === "login" ? <><LogIn size={13} /> Iniciar sesión</> : <><UserPlus size={13} /> Registrarse</>}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "register" && (
            <Field icon={<User size={15} />} placeholder="Nombre de usuario" value={username}
              onChange={setUsername} type="text" required />
          )}
          <Field icon={<Mail size={15} />} placeholder="Correo electrónico" value={email}
            onChange={setEmail} type="email" required />
          <div style={{ position: "relative" }}>
            <Field icon={<Lock size={15} />} placeholder="Contraseña" value={password}
              onChange={setPassword} type={showPass ? "text" : "password"} required />
            <button type="button" onClick={() => setShowPass(v => !v)}
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 0 }}>
              {showPass ? <EyeOff size={15} color="rgba(255,255,255,0.35)" /> : <Eye size={15} color="rgba(255,255,255,0.35)" />}
            </button>
          </div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", color: "#FCA5A5", fontSize: 13 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            marginTop: 4, padding: "13px 0", borderRadius: 12, border: "none", cursor: loading ? "not-allowed" : "pointer",
            background: loading ? "rgba(108,99,255,0.5)" : "linear-gradient(135deg,#6C63FF,#4F46E5)",
            color: "#fff", fontSize: 14, fontWeight: 800, transition: "opacity 0.2s",
          }}>
            {loading ? "Cargando..." : tab === "login" ? "Entrar" : "Crear cuenta"}
          </button>

          <p style={{ textAlign: "center", color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>
            {tab === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
            <button type="button" onClick={() => switchTab(tab === "login" ? "register" : "login")}
              style={{ background: "none", border: "none", color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              {tab === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </form>
      </div>
    </div>
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
        onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,0.6)")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
      />
    </div>
  );
}
