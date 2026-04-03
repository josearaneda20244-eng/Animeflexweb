import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { Crown, Check, Zap, ShieldOff, Heart, Star, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLocation } from "wouter";

export default function Membership() {
  const { user, isMegaFan, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      refreshUser();
    }
  }, []);

  const handleUpgrade = async () => {
    if (!user) {
      setError("Debes iniciar sesión primero");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { url } = await apiClient.post<{ url: string }>("/membership/checkout", {});
      if (url) window.location.href = url;
    } catch (err: any) {
      setError(err?.message ?? "Error al procesar el pago. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    setError(null);
    try {
      const { url } = await apiClient.post<{ url: string }>("/membership/portal", {});
      if (url) window.location.href = url;
    } catch (err: any) {
      setError(err?.message ?? "Error al abrir el portal. Intenta de nuevo.");
    } finally {
      setPortalLoading(false);
    }
  };

  const freeFeatures = [
    "Acceso a todo el catálogo de anime",
    "Búsqueda ilimitada",
    "Lista de favoritos",
    "Historial de visualización",
  ];

  const megaFanFeatures = [
    "Todo lo del plan gratuito",
    "Sin anuncios en toda la plataforma",
    "Badge exclusivo MegaFan ⚡",
    "Soporte prioritario",
    "Acceso anticipado a nuevas funciones",
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#090A12", color: "#F1F1F5" }}>
      <Navbar />

      <div style={{ paddingTop: 80, paddingBottom: 60, maxWidth: 900, margin: "0 auto", padding: "80px 16px 60px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "linear-gradient(135deg,rgba(108,99,255,0.2),rgba(79,70,229,0.1))",
            border: "1px solid rgba(108,99,255,0.3)", borderRadius: 100,
            padding: "6px 16px", marginBottom: 16,
          }}>
            <Crown size={14} color="#A78BFA" />
            <span style={{ color: "#A78BFA", fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>MEMBRESÍA</span>
          </div>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 900, marginBottom: 12, lineHeight: 1.1 }}>
            Elige tu plan
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
            Disfruta de AnimeFLEX sin límites. Actualiza a MegaFan y di adiós a los anuncios.
          </p>
        </div>

        {/* Current status for logged in users */}
        {user && (
          <div style={{
            background: isMegaFan
              ? "linear-gradient(135deg,rgba(108,99,255,0.2),rgba(167,139,250,0.1))"
              : "rgba(255,255,255,0.04)",
            border: isMegaFan ? "1px solid rgba(108,99,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: "16px 20px", marginBottom: 32,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            {isMegaFan
              ? <Crown size={20} color="#A78BFA" />
              : <Star size={20} color="rgba(255,255,255,0.3)" />
            }
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {isMegaFan ? "Eres miembro MegaFan ⚡" : "Eres miembro Normal"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                {isMegaFan
                  ? `Suscripción activa • ${user.subscription_expires_at ? `Renueva el ${new Date(user.subscription_expires_at).toLocaleDateString("es")}` : "Activa"}`
                  : "Actualiza para eliminar anuncios y obtener acceso exclusivo"
                }
              </div>
            </div>
          </div>
        )}

        {/* Plans */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20, marginBottom: 40,
        }}>
          {/* Free Plan */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20, padding: 28,
            display: "flex", flexDirection: "column",
          }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Star size={18} color="rgba(255,255,255,0.4)" />
                <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 800, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>Normal</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: "#F1F1F5" }}>$0</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>/mes</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginTop: 6 }}>Gratis para siempre</p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {freeFeatures.map((f) => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Check size={14} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{f}</span>
                </li>
              ))}
            </ul>

            <div style={{
              padding: "12px 20px", borderRadius: 12, textAlign: "center",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 700,
            }}>
              {!user || !isMegaFan ? "Tu plan actual" : "Plan básico"}
            </div>
          </div>

          {/* MegaFan Plan */}
          <div style={{
            background: "linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(79,70,229,0.08) 100%)",
            border: "2px solid rgba(108,99,255,0.5)",
            borderRadius: 20, padding: 28,
            display: "flex", flexDirection: "column", position: "relative",
            boxShadow: "0 0 40px rgba(108,99,255,0.15)",
          }}>
            {/* Popular badge */}
            <div style={{
              position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
              background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
              borderRadius: 100, padding: "4px 14px",
              color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
              whiteSpace: "nowrap",
            }}>
              ⭐ MÁS POPULAR
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Crown size={18} color="#A78BFA" />
                <span style={{ color: "#A78BFA", fontWeight: 800, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }}>MegaFan</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: "#F1F1F5" }}>$4</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>/mes</span>
              </div>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 6 }}>Cancela cuando quieras</p>
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, flex: 1, display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {megaFanFeatures.map((f, i) => (
                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Check size={14} color={i === 0 ? "rgba(255,255,255,0.3)" : "#A78BFA"} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: i === 0 ? "rgba(255,255,255,0.4)" : "#D1D5DB", fontSize: 13 }}>{f}</span>
                </li>
              ))}
            </ul>

            {isMegaFan ? (
              <button
                onClick={handleManage}
                disabled={portalLoading}
                style={{
                  padding: "14px 20px", borderRadius: 12, textAlign: "center",
                  background: "rgba(108,99,255,0.2)", border: "1px solid rgba(108,99,255,0.4)",
                  color: "#A78BFA", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {portalLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : null}
                Gestionar suscripción
              </button>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                style={{
                  padding: "14px 20px", borderRadius: 12, textAlign: "center",
                  background: loading ? "rgba(108,99,255,0.5)" : "linear-gradient(135deg,#6C63FF,#4F46E5)",
                  border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: loading ? "none" : "0 4px 20px rgba(108,99,255,0.4)",
                  transition: "all 0.2s",
                }}
              >
                {loading
                  ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Procesando...</>
                  : <><Zap size={16} /> {user ? "Actualizar ahora" : "Registrarte y actualizar"}</>
                }
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12, padding: "12px 16px", marginBottom: 24,
            color: "#FCA5A5", fontSize: 13, textAlign: "center",
          }}>
            {error}
          </div>
        )}

        {/* Benefits section */}
        <div style={{
          background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 20, padding: "28px 24px",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20, textAlign: "center" }}>
            ¿Por qué hacerte MegaFan?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {[
              { icon: <ShieldOff size={20} color="#A78BFA" />, title: "Sin anuncios", desc: "Disfruta de tu anime favorito sin interrupciones" },
              { icon: <Zap size={20} color="#F59E0B" />, title: "Badge exclusivo", desc: "Muestra tu apoyo con el badge MegaFan ⚡" },
              { icon: <Heart size={20} color="#EF4444" />, title: "Apoya el proyecto", desc: "Ayuda a mantener AnimeFLEX funcionando" },
              { icon: <Crown size={20} color="#A78BFA" />, title: "Funciones premium", desc: "Acceso anticipado a nuevas características" },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "16px",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(108,99,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 24 }}>
          Pagos procesados de forma segura por Stripe. Cancela en cualquier momento desde el portal de gestión.
        </p>
      </div>

      <Footer />
    </div>
  );
}
