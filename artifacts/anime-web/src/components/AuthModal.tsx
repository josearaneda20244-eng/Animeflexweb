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
        background: "radial-gradient(ellipse at center, rgba(40,8,8,0.6), rgba(0,0,0,0.92))",
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
        {/* Floating magic circles in background */}
        <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 0 }}>
          <MagicCircle size={300} color="#DC2626" opacity={0.35} />
        </div>

        {/* Main system panel */}
        <div style={{
          position: "relative",
          background: "linear-gradient(180deg, rgba(20,8,18,0.96) 0%, rgba(8,3,12,0.98) 100%)",
          border: "1px solid rgba(220,38,38,0.55)",
          clipPath: "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 24px 80px rgba(0,0,0,0.85), 0 0 60px rgba(220,38,38,0.35), 0 0 120px rgba(249,115,22,0.18)",
          overflow: "hidden",
        }}>
          {/* Hex grid background */}
          <HexGrid color="rgba(220,38,38,0.06)" size={26} fade />

          {/* Scan lines */}
          <div style={{
            position: "absolute", inset: 0,
            background: "repeating-linear-gradient(0deg, rgba(249,115,22,0.025) 0px, rgba(249,115,22,0.025) 1px, transparent 1px, transparent 4px)",
            pointerEvents: "none", zIndex: 1,
          }} />

          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 18, right: 18, height: 1,
            background: "linear-gradient(90deg, transparent, #F97316 30%, #DC2626 50%, #F97316 70%, transparent)",
            boxShadow: "0 0 12px #F97316",
          }} />

          {/* Corner brackets */}
          <CornerBrackets color="#F97316" size={18} thickness={2} inset={6} />

          {/* Close btn */}
          <button onClick={onClose} style={{
            position: "absolute", top: 16, right: 16, zIndex: 5,
            width: 28, height: 28,
            background: "rgba(220,38,38,0.15)",
            border: "1px solid rgba(220,38,38,0.5)",
            color: "#FECACA",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
          }}>
            <X size={14} />
          </button>

          <div style={{ position: "relative", zIndex: 2, padding: "30px 26px 26px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 22 }}>
              {/* Sys label */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 9.5, fontWeight: 800, letterSpacing: 3,
                color: "#FDBA74", textShadow: "0 0 10px rgba(249,115,22,0.7)",
                marginBottom: 14,
              }}>
                <motion.span
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{ width: 7, height: 7, background: "#F97316", boxShadow: "0 0 10px #F97316" }}
                />
                {`[ ${tabLabel} ]`}
              </div>

              {/* Brand */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
                {tab === "forgot" && (
                  <button
                    onClick={() => switchTab("login")}
                    style={{
                      background: "rgba(249,115,22,0.12)",
                      border: "1px solid rgba(249,115,22,0.4)",
                      width: 26, height: 26, color: "#FDBA74",
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      clipPath: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
                    }}
                  >
                    <ArrowLeft size={13} />
                  </button>
                )}
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 18px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
                      "0 0 36px rgba(220,38,38,0.85), inset 0 1px 0 rgba(255,255,255,0.22)",
                      "0 0 18px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,255,255,0.22)",
                    ],
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    width: 38, height: 38,
                    background: "linear-gradient(135deg, #FCA5A5 0%, #DC2626 50%, #991B1B 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: 17, fontWeight: 900, marginLeft: 2, lineHeight: 1 }}>▶</span>
                </motion.div>
                <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
                  <span style={{ color: "#F1F1F5" }}>Anime</span>
                  <span style={{ background: "linear-gradient(135deg,#FECACA,#DC2626)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FLEX</span>
                </span>
              </div>

              {tab === "forgot" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 }}>
                  <KeyRound size={12} color="#FDBA74" />
                  <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11.5, letterSpacing: 0.4 }}>
                    Te enviaremos un enlace al correo
                  </span>
                </div>
              )}
            </div>

            {/* Tab switcher */}
            {tab !== "forgot" && (
              <div style={{
                display: "flex", marginBottom: 22,
                background: "rgba(4,3,10,0.75)",
                border: "1px solid rgba(249,115,22,0.25)",
                clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                padding: 4,
              }}>
                {(["login", "register"] as const).map((t) => {
                  const active = tab === t;
                  return (
                    <button key={t} onClick={() => switchTab(t)} style={{
                      flex: 1, padding: "9px 6px",
                      border: "none", cursor: "pointer",
                      background: active
                        ? "linear-gradient(135deg, rgba(220,38,38,0.85), rgba(153,27,27,0.85))"
                        : "transparent",
                      color: active ? "#fff" : "rgba(255,255,255,0.45)",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase",
                      transition: "all 0.2s",
                      clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                      textShadow: active ? "0 0 8px rgba(255,255,255,0.4)" : "none",
                      boxShadow: active ? "0 0 16px rgba(220,38,38,0.5)" : "none",
                    }}>
                      {t === "login" ? "// ACCESO" : "// REGISTRO"}
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
                    clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                    boxShadow: "0 0 24px rgba(34,197,94,0.35)",
                  }}>
                    <CheckCircle2 size={26} color="#22C55E" />
                  </div>
                  <div>
                    <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 900, marginBottom: 6, fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: 1, textTransform: "uppercase" }}>
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
                    <SysField icon={<User size={14} />} label="// USUARIO" placeholder="Nombre de cazador" value={username}
                      onChange={setUsername} type="text" required />
                  )}
                  <SysField icon={<Mail size={14} />} label="// IDENT_EMAIL" placeholder="correo@dominio.com" value={email}
                    onChange={setEmail} type="email" required />
                  {tab !== "forgot" && (
                    <SysField
                      icon={<Lock size={14} />}
                      label="// CLAVE_ACCESO"
                      placeholder="••••••••"
                      value={password}
                      onChange={setPassword}
                      type={showPass ? "text" : "password"}
                      required
                      adornment={
                        <button type="button" onClick={() => setShowPass(v => !v)}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4, color: "#FDBA74" }}>
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
                        border: "1px solid rgba(239,68,68,0.5)",
                        padding: "10px 14px",
                        color: "#FCA5A5",
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                        boxShadow: "0 0 16px rgba(239,68,68,0.25)",
                      }}
                    >
                      <span style={{ color: "#F87171", fontWeight: 800 }}>! ERROR > </span>{error}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="sys-btn primary"
                    style={{
                      marginTop: 6,
                      width: "100%", justifyContent: "center",
                      padding: "13px 0",
                      fontSize: 13, letterSpacing: 3,
                      cursor: loading ? "not-allowed" : "pointer",
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    {loading ? ">{">>>"} PROCESANDO..." :
                     tab === "login" ? ">{">>>"} ENTRAR AL SISTEMA" :
                     tab === "register" ? ">{">>>"} CREAR CAZADOR" :
                     ">{">>>"} ENVIAR ENLACE"}
                  </button>

                  {tab === "login" && (
                    <button
                      type="button"
                      onClick={() => switchTab("forgot")}
                      style={{
                        background: "none", border: "none",
                        color: "#FDBA74",
                        fontSize: 11.5,
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        letterSpacing: 0.5,
                        cursor: "pointer", padding: 0,
                        textAlign: "center",
                        textShadow: "0 0 8px rgba(249,115,22,0.5)",
                      }}
                    >
                      ¿Olvidaste tu clave de acceso?
                    </button>
                  )}

                  {tab !== "forgot" && (
                    <p style={{
                      textAlign: "center",
                      color: "rgba(255,255,255,0.4)",
                      fontSize: 11.5,
                      margin: 0,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      letterSpacing: 0.4,
                    }}>
                      {tab === "login" ? "¿Sin registro? " : "¿Ya tienes acceso? "}
                      <button
                        type="button"
                        onClick={() => switchTab(tab === "login" ? "register" : "login")}
                        style={{
                          background: "none", border: "none",
                          color: "#FECACA", fontSize: 11.5, fontWeight: 800,
                          cursor: "pointer", padding: 0,
                          fontFamily: "inherit",
                          textShadow: "0 0 8px rgba(220,38,38,0.6)",
                        }}
                      >
                        {tab === "login" ? "→ REGISTRARSE" : "→ INICIAR SESIÓN"}
                      </button>
                    </p>
                  )}
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom accent line */}
          <div style={{
            position: "absolute", bottom: 0, left: 18, right: 18, height: 1,
            background: "linear-gradient(90deg, transparent, #DC2626 30%, #F97316 50%, #DC2626 70%, transparent)",
            boxShadow: "0 0 12px #DC2626",
          }} />
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
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5,
        color: "#FDBA74",
        marginBottom: 5,
        opacity: 0.85,
      }}>
        {label}
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ position: "absolute", left: 12, color: "#FDBA74", display: "flex", zIndex: 2, opacity: 0.7 }}>{icon}</span>
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
            paddingTop: 11, paddingBottom: 11,
            fontSize: 13.5,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: 0.3,
          }}
        />
        {adornment && (
          <div style={{ position: "absolute", right: 10, zIndex: 2 }}>{adornment}</div>
        )}
      </div>
    </div>
  );
}
