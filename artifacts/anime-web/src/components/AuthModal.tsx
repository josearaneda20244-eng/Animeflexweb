import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { CornerBrackets, MagicCircle, HexGrid } from "@/components/SystemUI";

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

  const tabLabel =
    tab === "login" ? "ACCESO · NIVEL 01" :
    tab === "register" ? "REGISTRO · NUEVO CAZADOR" :
    "RECUPERACIÓN · CONTRASEÑA";

  return createPortal(
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "radial-gradient(ellipse at center, rgba(20,20,20,0.6), rgba(0,0,0,0.92))",
        backdropFilter: "blur(14px) saturate(140%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overflowY: "auto",
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        style={{
          width: "100%", maxWidth: 440,
          position: "relative", margin: "auto",
        }}
      >
        {/* Main panel */}
        <div style={{
          position: "relative",
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16,
          boxShadow: "0 24px 80px rgba(0,0,0,0.9)",
          overflow: "hidden",
        }}>
          {/* Close btn */}
          <button onClick={onClose} style={{
            position: "absolute", top: 16, right: 16, zIndex: 5,
            width: 30, height: 30, borderRadius: 8,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#ffffff",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X size={14} />
          </button>

          <div style={{ position: "relative", zIndex: 2, padding: "30px 26px 26px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontSize: 10, fontWeight: 700, letterSpacing: 2,
                color: "#a1a1aa",
                marginBottom: 14,
                textTransform: "uppercase",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3f2eb2" }} />
                {tabLabel}
              </div>

              {/* Brand */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
                {tab === "forgot" && (
                  <button
                    onClick={() => switchTab("login")}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      width: 26, height: 26, borderRadius: 8, color: "#ffffff",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <ArrowLeft size={13} />
                  </button>
                )}
                <img src="/icon.svg" alt="IZIFF ANIME" style={{ width: 32, height: 32, borderRadius: 8 }} />
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>
                  <span style={{ color: "#ffffff" }}>IZIFF ANIME</span>
                </span>
              </div>

              {tab === "forgot" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
                  <KeyRound size={12} color="#a1a1aa" />
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                    Te enviaremos un enlace al correo
                  </span>
                </div>
              )}
            </div>

            {/* Tab switcher */}
            {tab !== "forgot" && (
              <div style={{
                display: "flex", marginBottom: 22,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: 4,
              }}>
                {(["login", "register"] as const).map((t) => {
                  const active = tab === t;
                  return (
                    <button key={t} onClick={() => switchTab(t)} style={{
                      flex: 1, padding: "9px 6px",
                      border: "none", cursor: "pointer",
                      borderRadius: 8,
                      background: active ? "#ffffff" : "transparent",
                      color: active ? "#000000" : "rgba(255,255,255,0.55)",
                      fontSize: 12, fontWeight: 700,
                      transition: "all 0.2s",
                    }}>
                      {t === "login" ? "Iniciar sesión" : "Registrarse"}
                    </button>
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait">
              {forgotSent ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center", padding: "12px 4px 4px" }}
                >
                  <div style={{
                    width: 56, height: 56,
                    background: "rgba(34,197,94,0.12)",
                    border: "1px solid rgba(34,197,94,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 0 24px rgba(34,197,94,0.35)",
                  }}>
                    <CheckCircle2 size={26} color="#22C55E" />
                  </div>
                  <div>
                    <div style={{ color: "#f4f4f5", fontSize: 14, fontWeight: 900, marginBottom: 6, fontFamily: "'Space Grotesk', ui-monospace, monospace", letterSpacing: 1, textTransform: "uppercase" }}>
                      {">"} Mensaje enviado
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, lineHeight: 1.6 }}>
                      Si el correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
                    </div>
                  </div>
                  <button
                    onClick={() => switchTab("login")}
                    className="sys-btn"
                    style={{ marginTop: 4 }}
                  >
                    ← Volver al acceso
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key={tab}
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {tab === "register" && (
                    <SysField icon={<User size={14} />} label="Usuario" placeholder="Nombre de usuario" value={username}
                      onChange={setUsername} type="text" required />
                  )}
                  <SysField icon={<Mail size={14} />} label="Correo electrónico" placeholder="correo@dominio.com" value={email}
                    onChange={setEmail} type="email" required />
                  {tab !== "forgot" && (
                    <SysField
                      icon={<Lock size={14} />}
                      label="Contraseña"
                      placeholder="••••••••"
                      value={password}
                      onChange={setPassword}
                      type={showPass ? "text" : "password"}
                      required
                      adornment={
                        <button type="button" onClick={() => setShowPass(v => !v)}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, color: "#a1a1aa" }}>
                          {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      }
                    />
                  )}

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.4)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        color: "#a5b4fc",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "#F87171", fontWeight: 700 }}>Error: </span>{error}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      marginTop: 6,
                      width: "100%", justifyContent: "center",
                      padding: "12px 0",
                      borderRadius: 10,
                      border: "none",
                      background: "#ffffff",
                      color: "#000000",
                      fontSize: 13, fontWeight: 700,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? "Procesando..." :
                     tab === "login" ? "Iniciar sesión" :
                     tab === "register" ? "Crear cuenta" :
                     "Enviar enlace"}
                  </button>

                  {tab === "login" && (
                    <button
                      type="button"
                      onClick={() => switchTab("forgot")}
                      style={{
                        background: "none", border: "none",
                        color: "#a1a1aa",
                        fontSize: 12,
                        cursor: "pointer", padding: 0,
                        textAlign: "center",
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}

                  {tab !== "forgot" && (
                    <p style={{
                      textAlign: "center",
                      color: "rgba(255,255,255,0.45)",
                      fontSize: 12,
                      margin: 0,
                    }}>
                      {tab === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
                      <button
                        type="button"
                        onClick={() => switchTab(tab === "login" ? "register" : "login")}
                        style={{
                          background: "none", border: "none",
                          color: "#ffffff", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", padding: 0,
                        }}
                      >
                        {tab === "login" ? "Regístrate" : "Inicia sesión"}
                      </button>
                    </p>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function SysField({
  icon, label, placeholder, value, onChange, type, required, adornment,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  required?: boolean;
  adornment?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 11, fontWeight: 600,
        color: "#a1a1aa",
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 12, color: "#a1a1aa", display: "flex", zIndex: 2 }}>{icon}</span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          className="sys-input"
          style={{
            paddingLeft: 36,
            paddingRight: adornment ? 40 : 14,
            paddingTop: 10, paddingBottom: 10,
            fontSize: 13.5,
          }}
        />
        {adornment && (
          <div style={{ position: "absolute", right: 10, zIndex: 2 }}>{adornment}</div>
        )}
      </div>
    </div>
  );
}
