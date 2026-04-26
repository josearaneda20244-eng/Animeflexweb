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
    if (statusParam === "success") {
      refreshUser().catch(() => {});
      return;
    }
    if (statusParam === "error") return;
    setStatus("error");
    setErrorMsg("Enlace de verificación no reconocido. Solicita uno nuevo desde Ajustes.");
  }, []);

  // ── Theme tokens (Solo Leveling) ──
  const isError = status === "error";
  const isSuccess = status === "success";
  const accent  = isSuccess ? "#22C55E" : "#DC2626";       // verde si éxito, rojo en otros estados
  const accentS = isSuccess ? "rgba(34,197,94,0.55)" : "rgba(220,38,38,0.6)";
  const accentBg = isSuccess ? "rgba(34,197,94,0.08)" : "rgba(220,38,38,0.06)";
  const mono    = "'JetBrains Mono','Courier New',Consolas,monospace";

  // Etiquetas dinámicas del HUD
  const sysLabel =
    status === "loading" ? "VERIFICANDO IDENTIDAD"
    : status === "success" ? "ACCESO CONCEDIDO"
    : "ACCESO DENEGADO";
  const sysSubLabel =
    status === "loading" ? "/// procesando token ///"
    : status === "success" ? "/// usuario autenticado ///"
    : "/// token inválido o expirado ///";

  return (
    <div style={{
      minHeight: "100vh", background: "#04040A",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, position: "relative", overflow: "hidden",
      color: "#F1F1F5",
    }}>

      {/* Grid background */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.18, pointerEvents: "none",
        backgroundImage:
          `linear-gradient(${accent}22 1px, transparent 1px),
           linear-gradient(90deg, ${accent}22 1px, transparent 1px)`,
        backgroundSize: "44px 44px",
        maskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 70%)",
      }} />

      {/* Scanlines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.35,
        backgroundImage: `repeating-linear-gradient(
          0deg, transparent 0, transparent 2px,
          rgba(255,255,255,0.025) 2px, rgba(255,255,255,0.025) 3px
        )`,
      }} />

      {/* Glow halo behind card */}
      <div style={{
        position: "absolute", width: 520, height: 520, borderRadius: "50%",
        background: `radial-gradient(circle, ${accent}1f 0%, transparent 70%)`,
        top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        pointerEvents: "none", filter: "blur(20px)",
      }} />

      {/* MONOLITH CARD */}
      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 440,
      }}>

        {/* SYSTEM ALERT BAR (encima del card) */}
        <div style={{
          textAlign: "center", marginBottom: 14, fontFamily: mono,
          fontSize: 11, fontWeight: 800, color: accent, letterSpacing: 2.4,
          textTransform: "uppercase",
        }}>
          <span style={{
            display: "inline-block", width: 8, height: 8, borderRadius: "50%",
            background: accent, marginRight: 8, verticalAlign: 1,
            boxShadow: `0 0 10px ${accent}`,
            animation: status === "loading" ? "sl-pulse 1.4s ease-in-out infinite" : "none",
          }} />
          [ SISTEMA · {isSuccess ? "ÉXITO" : isError ? "ERROR" : "PROCESANDO"} ] /// {isSuccess ? "NIVEL ACTIVADO" : "NIVEL CRÍTICO"}
        </div>

        <div style={{
          position: "relative",
          background: "linear-gradient(180deg, #08080F 0%, #0A0A12 100%)",
          border: `1px solid ${accentS}`,
          boxShadow: `0 0 0 1px rgba(0,0,0,0.5) inset, 0 24px 60px rgba(0,0,0,0.6), 0 0 40px ${accent}22`,
        }}>

          {/* Top scanline / borde superior */}
          <div style={{ height: 2, background: accent, boxShadow: `0 0 12px ${accent}` }} />

          {/* Corner brackets (4) */}
          {[
            { top: 8, left: 8, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
            { top: 8, right: 8, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
            { bottom: 8, left: 8, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` },
            { bottom: 8, right: 8, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` },
          ].map((s, i) => (
            <span key={i} style={{
              position: "absolute", width: 18, height: 18, ...s, pointerEvents: "none",
            }} />
          ))}

          {/* Header bar (SYS://) */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 22px",
            borderBottom: `1px solid ${accent}38`,
            fontFamily: mono, fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
            textTransform: "uppercase",
          }}>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>SYS://animeflex.core</span>
            <span style={{ color: accent }}>● VERIFICACIÓN</span>
          </div>

          {/* CONTENT */}
          <div style={{ padding: "32px 28px 28px", textAlign: "center" }}>

            {/* LOGO */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, marginBottom: 28,
            }}>
              <div style={{
                width: 32, height: 32, background: "#DC2626",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 12px rgba(220,38,38,0.5)",
              }}>
                <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>▶</span>
              </div>
              <span style={{
                fontSize: 18, fontWeight: 900, letterSpacing: -0.4,
                fontFamily: "system-ui, -apple-system, sans-serif",
              }}>
                <span style={{ color: "#F1F1F5" }}>ANIME</span>
                <span style={{ color: "#DC2626" }}>FLEX</span>
              </span>
            </div>

            {/* HEX-STYLE ICON BOX */}
            <div style={{
              position: "relative", width: 96, height: 96, margin: "0 auto 22px",
            }}>
              {/* Outer rotating ring (only loading) */}
              {status === "loading" && (
                <div style={{
                  position: "absolute", inset: -8, border: `1px dashed ${accent}55`,
                  animation: "sl-spin 8s linear infinite", borderRadius: 6,
                }} />
              )}
              <div style={{
                width: 96, height: 96, border: `2px solid ${accent}`,
                background: accentBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 24px ${accent}55, inset 0 0 18px ${accent}22`,
              }}>
                {status === "loading" && <Loader2 size={36} color={accent} style={{ animation: "sl-spin 1s linear infinite" }} />}
                {status === "success" && <CheckCircle2 size={44} color={accent} strokeWidth={2.5} />}
                {status === "error"   && <XCircle size={44} color={accent} strokeWidth={2.5} />}
              </div>
            </div>

            {/* SYSTEM LABELS */}
            <div style={{
              fontFamily: mono, fontSize: 11, fontWeight: 800, color: accent,
              letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 6,
            }}>
              [ {sysLabel} ]
            </div>
            <div style={{
              fontFamily: mono, fontSize: 10, fontWeight: 700,
              color: "rgba(255,255,255,0.45)", letterSpacing: 1.4,
              textTransform: "lowercase", marginBottom: 22,
            }}>
              {sysSubLabel}
            </div>

            {/* MAIN TITLE + COPY according to state */}
            {status === "loading" && (
              <>
                <h2 style={{
                  color: "#F8FAFC", fontSize: 22, fontWeight: 900,
                  margin: "0 0 10px", letterSpacing: -0.3,
                }}>
                  Verificando…
                </h2>
                <p style={{
                  color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.6,
                  margin: "0 0 24px",
                }}>
                  Estamos confirmando tu correo electrónico.
                </p>
              </>
            )}

            {status === "success" && (
              <>
                <h2 style={{
                  color: "#F8FAFC", fontSize: 24, fontWeight: 900,
                  margin: "0 0 10px", letterSpacing: -0.3,
                }}>
                  ¡Correo verificado!
                </h2>
                <p style={{
                  color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.65,
                  margin: "0 0 24px",
                }}>
                  Tu identidad ha sido confirmada. El sistema ha desbloqueado el acceso completo a la red AnimeFlex.
                </p>

                {/* STATUS PANEL */}
                <div style={{
                  border: `1px solid ${accent}55`, background: "rgba(0,0,0,0.4)",
                  padding: "10px 14px", marginBottom: 22, fontFamily: mono,
                  fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: 0.6,
                  textAlign: "left",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>STATUS</span>
                    <span style={{ color: accent, fontWeight: 800 }}>● ONLINE</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>NIVEL</span>
                    <span style={{ color: "#F8FAFC", fontWeight: 800 }}>USUARIO_VERIFICADO</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate("/")}
                  style={{
                    width: "100%", padding: "14px 0", border: `1px solid #F87171`,
                    background: "#DC2626", color: "#fff",
                    fontFamily: mono, fontSize: 13, fontWeight: 900,
                    letterSpacing: 2.2, textTransform: "uppercase", cursor: "pointer",
                    boxShadow: "0 0 18px rgba(220,38,38,0.45)",
                  }}
                  onMouseDown={e => (e.currentTarget.style.transform = "translateY(1px)")}
                  onMouseUp={e => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  [ ENTRAR AL SISTEMA ›› ]
                </button>
              </>
            )}

            {status === "error" && (
              <>
                <h2 style={{
                  color: "#F8FAFC", fontSize: 22, fontWeight: 900,
                  margin: "0 0 10px", letterSpacing: -0.3,
                }}>
                  Enlace inválido
                </h2>
                <p style={{
                  color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.65,
                  margin: "0 0 22px",
                }}>
                  {errorMsg || "El enlace no es válido o ya expiró. Solicita uno nuevo desde tu perfil."}
                </p>

                <button
                  onClick={() => navigate("/settings")}
                  style={{
                    width: "100%", padding: "14px 0", border: `1px solid #F87171`,
                    background: "#DC2626", color: "#fff",
                    fontFamily: mono, fontSize: 13, fontWeight: 900,
                    letterSpacing: 2.2, textTransform: "uppercase", cursor: "pointer",
                    boxShadow: "0 0 18px rgba(220,38,38,0.45)",
                  }}
                >
                  [ IR A AJUSTES ›› ]
                </button>
              </>
            )}

          </div>

          {/* Footer bar */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 22px",
            borderTop: `1px solid ${accent}33`,
            fontFamily: mono, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            textTransform: "uppercase",
          }}>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>› animeflex.lat</span>
            <span style={{ color: accent }}>v4.0</span>
          </div>

          {/* Bottom scanline */}
          <div style={{ height: 2, background: accent, boxShadow: `0 0 12px ${accent}` }} />
        </div>

        {/* Footer caption */}
        <div style={{
          textAlign: "center", marginTop: 16, fontFamily: mono,
          fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1.8,
          textTransform: "uppercase",
        }}>
          ANIMEFLEX · SYSTEM_GUARD · © 2026
        </div>
      </div>

      <style>{`
        @keyframes sl-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sl-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(0.7); } }
      `}</style>
    </div>
  );
}
