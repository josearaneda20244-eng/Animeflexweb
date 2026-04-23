import { useState, useEffect, useRef } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PAYPAL_CLIENT_ID       = import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "";
const PAYPAL_PLAN_ID_MONTHLY = import.meta.env.VITE_PAYPAL_PLAN_ID ?? "";
const PAYPAL_PLAN_ID_ANNUAL  = import.meta.env.VITE_PAYPAL_PLAN_ID_ANNUAL ?? "";

type Plan = "monthly" | "annual";

interface PromoResult {
  valid: boolean;
  code: string;
  discountPercent: number;
  originalCents: number;
  discountedCents: number;
}

interface PaymentRow {
  order_id: string;
  amount_usd: string;
  plan: string;
  promo_code: string | null;
  status: string;
  created_at: string;
}

function centsToDisplay(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const FEATURES = [
  { icon: "∞", label: "Sin límite diario de episodios", free: false },
  { icon: "👑", label: "Badge exclusivo MegaFan", free: false },
  { icon: "⚡", label: "Acceso anticipado a nuevas funciones", free: false },
  { icon: "🎯", label: "Soporte prioritario 24/7", free: false },
  { icon: "📺", label: "Streaming ilimitado", free: true },
  { icon: "🔖", label: "Lista de favoritos", free: true },
];

const FAQS = [
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí, cancelas en cualquier momento desde PayPal sin penalización." },
  { q: "¿Qué métodos de pago se aceptan?", a: "PayPal, tarjetas de crédito/débito y saldo PayPal." },
  { q: "¿El plan anual se renueva automáticamente?", a: "Sí, al cumplir 12 meses se renueva automáticamente. Puedes cancelar antes si lo deseas." },
  { q: "¿El badge aparece de inmediato?", a: "Sí, en cuanto se procesa el pago tu badge 👑 aparece en todo el sitio." },
];

export default function Membership() {
  const { user, refreshUser } = useAuth();
  const [plan, setPlan]         = useState<Plan>("monthly");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
  const [openFaq, setOpenFaq]   = useState<number | null>(null);

  const [couponInput, setCouponInput]   = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [promoResult, setPromoResult]   = useState<PromoResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMegaFan = user?.membership_tier === "megafan";

  const [payments, setPayments]             = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [showPayments, setShowPayments]     = useState(false);

  useEffect(() => {
    if (!user || !showPayments) return;
    setPaymentsLoading(true);
    apiClient.get<{ payments: PaymentRow[] }>("/user/payments")
      .then(d => setPayments(d.payments))
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, [user, showPayments]);

  const MONTHLY_CENTS = 400;
  const ANNUAL_CENTS  = 3840;
  const baseAmount    = plan === "annual" ? ANNUAL_CENTS  : MONTHLY_CENTS;
  const finalAmount   = promoResult ? promoResult.discountedCents : baseAmount;
  const savingsAnnual = MONTHLY_CENTS * 12 - ANNUAL_CENTS;

  useEffect(() => {
    if (!couponInput.trim()) { setCouponStatus("idle"); setPromoResult(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCouponStatus("loading");
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.post<PromoResult>("/promo-codes/validate", { code: couponInput.trim(), plan });
        setPromoResult(data); setCouponStatus("valid");
      } catch { setPromoResult(null); setCouponStatus("invalid"); }
    }, 600);
  }, [couponInput, plan]);

  async function handlePayPalSubscriptionApprove(subscriptionId: string) {
    setLoading(true); setError(null);
    try {
      await apiClient.post("/membership", { action: "activate", subscriptionId, plan });
      await refreshUser(); setSuccess(true);
    } catch (e: any) { setError(e.message ?? "Error activando la membresía"); }
    finally { setLoading(false); }
  }

  async function createPayPalOrder(): Promise<string> {
    const data = await apiClient.post<{ orderId: string }>("/membership", {
      action: "create-order", plan, promoCode: couponInput.trim() || undefined,
    });
    return data.orderId;
  }

  async function handlePayPalOrderApprove(orderId: string) {
    setLoading(true); setError(null);
    try {
      await apiClient.post("/membership", { action: "capture-order", orderId, plan, promoCode: couponInput.trim() || undefined });
      await refreshUser(); setSuccess(true);
    } catch (e: any) { setError(e.message ?? "Error capturando el pago de PayPal"); }
    finally { setLoading(false); }
  }

  async function handleManage() {
    setLoading(true); setError(null);
    try {
      const data = await apiClient.post<{ url: string }>("/membership", { action: "portal" });
      window.open(data.url, "_blank");
    } catch (e: any) { setError(e.message ?? "Error abriendo el portal"); }
    finally { setLoading(false); }
  }

  const activePayPalPlan = plan === "annual" ? PAYPAL_PLAN_ID_ANNUAL : PAYPAL_PLAN_ID_MONTHLY;

  return (
    <>
      <Navbar />

      <div style={{ minHeight: "100vh", background: "#07071a", color: "#fff", paddingBottom: 80, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>

        {/* ── Hero banner ── */}
        <div style={{ position: "relative", overflow: "hidden", padding: "72px 16px 56px", textAlign: "center" }}>
          {/* Hex grid background */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "linear-gradient(rgba(220,38,38,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 80% 70% at center, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 70% at center, black 20%, transparent 80%)",
            pointerEvents: "none",
          }} />
          {/* Scan lines */}
          <div style={{
            position: "absolute", inset: 0,
            background: "repeating-linear-gradient(0deg, rgba(249,115,22,0.03) 0px, rgba(249,115,22,0.03) 1px, transparent 1px, transparent 4px)",
            pointerEvents: "none",
          }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(220,38,38,0.22) 0%, transparent 70%)", pointerEvents: "none" }} />

          {/* Magic circle backdrop */}
          <svg
            width={420} height={420} viewBox="0 0 200 200"
            style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", opacity: 0.35, filter: "drop-shadow(0 0 20px #DC2626)", pointerEvents: "none", animation: "spin 60s linear infinite" }}
          >
            <circle cx="100" cy="100" r="96" fill="none" stroke="#DC2626" strokeWidth="0.5" strokeDasharray="2 6" />
            <circle cx="100" cy="100" r="80" fill="none" stroke="#F97316" strokeWidth="0.4" strokeDasharray="1 3" />
            <polygon points="100,28 162,134 38,134" fill="none" stroke="#FDBA74" strokeWidth="0.6" />
            <polygon points="100,172 38,66 162,66" fill="none" stroke="#FCA5A5" strokeWidth="0.5" />
          </svg>

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(249,115,22,0.5)",
              padding: "6px 16px", marginBottom: 20,
              clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
              boxShadow: "0 0 20px rgba(249,115,22,0.25)",
            }}>
              <span style={{ width: 6, height: 6, background: "#F97316", borderRadius: "50%", boxShadow: "0 0 8px #F97316", animation: "pulse 1.6s ease-in-out infinite" }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: "#FDBA74", letterSpacing: 3 }}>[ SISTEMA · CLASE_PREMIUM ]</span>
            </div>

            <h1 style={{ fontSize: "clamp(28px,6vw,48px)", fontWeight: 900, margin: "0 0 12px", lineHeight: 1.15, letterSpacing: -1, textShadow: "0 0 24px rgba(220,38,38,0.4)" }}>
              <span style={{ color: "#F1F1F5" }}>Eleva tu rango</span><br />
              <span style={{ background: "linear-gradient(135deg,#FECACA,#DC2626,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>// MEGAFAN</span>
            </h1>
            <p style={{ color: "rgba(253,186,116,0.7)", fontSize: 13, margin: "16px auto 0", maxWidth: 420, letterSpacing: 0.5, lineHeight: 1.7 }}>
              &gt; Anime sin límites · sin interrupciones · acceso completo al sistema
            </p>
          </div>
        </div>

        {/* ── Plan toggle ── */}
        {!isMegaFan && !success && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32, padding: "0 16px" }}>
            <div style={{
              display: "flex",
              background: "rgba(8,4,18,0.85)",
              border: "1px solid rgba(220,38,38,0.4)",
              padding: 4, gap: 4,
              clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
              boxShadow: "0 0 24px rgba(220,38,38,0.2)",
            }}>
              {(["monthly","annual"] as Plan[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  style={{
                    padding: "11px 26px", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 800, letterSpacing: 2,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    transition: "all 0.2s",
                    background: plan === p ? "linear-gradient(135deg,#DC2626,#991B1B)" : "transparent",
                    color: plan === p ? "#fff" : "rgba(253,186,116,0.5)",
                    clipPath: "polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px)",
                    boxShadow: plan === p ? "0 0 18px rgba(220,38,38,0.5)" : "none",
                    display: "flex", alignItems: "center", gap: 8, textTransform: "uppercase",
                  }}
                >
                  {p === "monthly" ? "// MENSUAL" : "// ANUAL"}
                  {p === "annual" && (
                    <span style={{ background: "#F97316", color: "#000", fontSize: 9, fontWeight: 900, padding: "2px 6px", letterSpacing: 0.5, clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)" }}>
                      −20%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Main card ── */}
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px 48px" }}>
          <div style={{
            position: "relative",
            background: "linear-gradient(160deg, rgba(20,6,16,0.95) 0%, rgba(8,4,18,0.98) 100%)",
            border: "1px solid rgba(220,38,38,0.55)",
            clipPath: "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)",
            boxShadow: "0 0 0 1px rgba(220,38,38,0.12), 0 32px 80px rgba(220,38,38,0.28), 0 8px 32px rgba(0,0,0,0.7)",
          }}>
            {/* Top glow strip */}
            <div style={{ position: "absolute", top: 0, left: 20, right: 20, height: 2, background: "linear-gradient(90deg,transparent,#F97316,#DC2626,#F97316,transparent)", boxShadow: "0 0 16px #DC2626" }} />
            {/* Bottom glow strip */}
            <div style={{ position: "absolute", bottom: 0, left: 20, right: 20, height: 1, background: "linear-gradient(90deg,transparent,#DC2626,transparent)", boxShadow: "0 0 10px #DC2626" }} />
            {/* Hex grid inside card */}
            <div style={{
              position: "absolute", inset: 0,
              backgroundImage: "linear-gradient(rgba(220,38,38,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.06) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              maskImage: "radial-gradient(ellipse at top, black 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse at top, black 0%, transparent 70%)",
              pointerEvents: "none",
            }} />

            {/* Popular badge */}
            <div style={{ position: "absolute", top: 16, right: 0 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg,#F97316,#DC2626)",
                color: "#fff", fontSize: 9, fontWeight: 900, padding: "5px 14px 5px 12px", letterSpacing: 1.5,
                clipPath: "polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)",
                boxShadow: "0 0 16px rgba(249,115,22,0.6)",
              }}>
                <span style={{ width: 5, height: 5, background: "#fff", borderRadius: "50%", boxShadow: "0 0 6px #fff" }} />
                MÁS POPULAR
              </span>
            </div>

            <div style={{ padding: "36px 28px 28px", position: "relative", zIndex: 1 }}>
              {/* Plan name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
                <div style={{
                  width: 44, height: 44,
                  background: "linear-gradient(135deg,rgba(220,38,38,0.4),rgba(153,27,27,0.3))",
                  border: "1px solid rgba(249,115,22,0.6)",
                  clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
                  boxShadow: "0 0 18px rgba(220,38,38,0.5)",
                }}>
                  👑
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: "#FDBA74", letterSpacing: 2.5, textTransform: "uppercase" }}>// PLAN_RANGO</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#F1F1F5", letterSpacing: 0.5 }}>MegaFan</div>
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 6 }}>
                {promoResult && (
                  <span style={{ color: "rgba(253,186,116,0.4)", textDecoration: "line-through", fontSize: 18, marginRight: 8 }}>
                    {centsToDisplay(promoResult.originalCents)}
                  </span>
                )}
                <span style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg,#fff 30%,#FDBA74 70%,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textShadow: "0 0 24px rgba(249,115,22,0.4)", letterSpacing: -1 }}>
                  {centsToDisplay(finalAmount)}
                </span>
                <span style={{ color: "#FDBA74", fontSize: 13, marginLeft: 6, fontWeight: 700, letterSpacing: 1 }}>
                  {plan === "annual" ? "/AÑO" : "/MES"}
                </span>
              </div>

              {plan === "annual" && !promoResult && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: "#22C55E", fontSize: 13, fontWeight: 700 }}>
                    Ahorra {centsToDisplay(savingsAnnual)} al año
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>
                    · ≈ {centsToDisplay(Math.round(finalAmount / 12))}/mes
                  </span>
                </div>
              )}

              {promoResult && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>🎉</span>
                  <span style={{ color: "#22C55E", fontSize: 13, fontWeight: 700 }}>
                    Cupón aplicado: −{promoResult.discountPercent}%
                  </span>
                </div>
              )}

              <p style={{ color: "rgba(253,186,116,0.4)", fontSize: 11, margin: "4px 0 24px", letterSpacing: 0.5 }}>
                &gt; Cancela cuando quieras · Sin contratos
              </p>

              {/* Divider */}
              <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(249,115,22,0.4),transparent)", marginBottom: 22, boxShadow: "0 0 6px rgba(249,115,22,0.3)" }} />

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                {FEATURES.map(f => (
                  <div key={f.label} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 10px",
                    background: f.free ? "rgba(255,255,255,0.02)" : "rgba(220,38,38,0.06)",
                    border: `1px solid ${f.free ? "rgba(255,255,255,0.06)" : "rgba(249,115,22,0.25)"}`,
                    clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                  }}>
                    <div style={{
                      width: 24, height: 24, flexShrink: 0,
                      background: f.free ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg,#DC2626,#991B1B)",
                      border: `1px solid ${f.free ? "rgba(255,255,255,0.08)" : "rgba(249,115,22,0.5)"}`,
                      clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: f.free ? "none" : "0 0 8px rgba(220,38,38,0.4)",
                    }}>
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke={f.free ? "rgba(255,255,255,0.3)" : "#fff"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 12, color: f.free ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.92)", fontWeight: f.free ? 500 : 700, fontFamily: "system-ui, sans-serif" }}>
                      {f.label}
                    </span>
                    {!f.free && (
                      <span style={{
                        marginLeft: "auto", fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
                        background: "rgba(249,115,22,0.18)", color: "#FDBA74",
                        padding: "3px 8px", whiteSpace: "nowrap",
                        clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
                        border: "1px solid rgba(249,115,22,0.35)",
                      }}>
                        MEGAFAN
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(249,115,22,0.4),transparent)", marginBottom: 22, boxShadow: "0 0 6px rgba(249,115,22,0.3)" }} />

              {/* Coupon */}
              {!isMegaFan && !success && user && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 9, color: "#FDBA74", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                    // CODIGO_DESCUENTO
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="INGRESA TU CODIGO"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: "rgba(8,4,18,0.85)",
                        border: `1px solid ${couponStatus === "valid" ? "rgba(34,197,94,0.7)" : couponStatus === "invalid" ? "rgba(239,68,68,0.7)" : "rgba(249,115,22,0.4)"}`,
                        clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
                        padding: "11px 40px 11px 14px",
                        color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        outline: "none", transition: "border 0.2s", letterSpacing: 2,
                        boxShadow: couponStatus === "valid" ? "0 0 16px rgba(34,197,94,0.3)" : "inset 0 0 12px rgba(220,38,38,0.1)",
                      }}
                    />
                    {couponStatus === "loading" && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>···</span>}
                    {couponStatus === "valid"   && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#22C55E", fontSize: 14 }}>✓</span>}
                    {couponStatus === "invalid" && couponInput && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "#F87171", fontSize: 14 }}>✗</span>}
                  </div>
                  {couponStatus === "invalid" && couponInput && (
                    <p style={{ color: "#F87171", fontSize: 11, marginTop: 5, margin: "5px 0 0" }}>Código inválido o expirado</p>
                  )}
                  {couponStatus === "valid" && promoResult && (
                    <p style={{ color: "#22C55E", fontSize: 11, marginTop: 5, margin: "5px 0 0" }}>
                      −{promoResult.discountPercent}% → {centsToDisplay(promoResult.discountedCents)}
                    </p>
                  )}
                </div>
              )}

              {/* CTA area */}
              {!user ? (
                <div style={{
                  background: "rgba(8,4,18,0.7)",
                  border: "1px solid rgba(249,115,22,0.3)",
                  clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                  padding: "18px", textAlign: "center",
                }}>
                  <p style={{ color: "#FDBA74", fontSize: 12, margin: 0, letterSpacing: 1, fontWeight: 700 }}>&gt; INICIA SESION PARA SUSCRIBIRTE</p>
                </div>
              ) : isMegaFan ? (
                <div>
                  <div style={{
                    background: "linear-gradient(135deg,rgba(220,38,38,0.18),rgba(153,27,27,0.08))",
                    border: "1px solid rgba(249,115,22,0.5)",
                    clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                    padding: "20px 20px", textAlign: "center", marginBottom: 14,
                    boxShadow: "0 0 24px rgba(220,38,38,0.25)",
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 6, filter: "drop-shadow(0 0 12px #F97316)" }}>👑</div>
                    <p style={{ color: "#FDBA74", fontWeight: 900, fontSize: 14, margin: "0 0 4px", letterSpacing: 2 }}>[ RANGO · MEGAFAN ACTIVO ]</p>
                    <p style={{ color: "rgba(253,186,116,0.6)", fontSize: 11, margin: 0, letterSpacing: 0.5 }}>&gt; Gracias por apoyar AnimeFlex</p>
                  </div>
                  <button
                    onClick={handleManage}
                    disabled={loading}
                    style={{
                      width: "100%", padding: "13px 0",
                      border: "1px solid rgba(249,115,22,0.5)",
                      clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                      background: "rgba(220,38,38,0.08)", color: "#FDBA74",
                      fontSize: 12, fontWeight: 800, cursor: "pointer", letterSpacing: 2,
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    {loading ? "// CARGANDO..." : "&gt;&gt;&gt; GESTIONAR EN PAYPAL"}
                  </button>
                </div>
              ) : success ? (
                <div style={{
                  background: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,163,74,0.06))",
                  border: "1px solid rgba(34,197,94,0.5)",
                  clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                  padding: "26px 20px", textAlign: "center",
                  boxShadow: "0 0 24px rgba(34,197,94,0.25)",
                }}>
                  <div style={{ fontSize: 34, marginBottom: 8, filter: "drop-shadow(0 0 12px #22C55E)" }}>✦</div>
                  <p style={{ color: "#22C55E", fontWeight: 900, fontSize: 14, margin: "0 0 6px", letterSpacing: 2 }}>[ RANGO · ACTUALIZADO ]</p>
                  <p style={{ color: "rgba(34,197,94,0.7)", fontSize: 11, margin: 0, letterSpacing: 0.5 }}>&gt; Bienvenido MegaFan · Membresia activa</p>
                </div>
              ) : (
                <div>
                  {loading && (
                    <div style={{ textAlign: "center", padding: "14px 0", color: "rgba(255,255,255,0.4)", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #DC2626", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      Procesando pago...
                    </div>
                  )}
                  {!loading && PAYPAL_CLIENT_ID ? (
                    couponStatus === "valid" ? (
                      <PayPalScriptProvider key="paypal-order" options={{ clientId: PAYPAL_CLIENT_ID, intent: "capture" }}>
                        <PayPalButtons
                          style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay" }}
                          createOrder={async () => createPayPalOrder()}
                          onApprove={async (data) => { if (data.orderID) await handlePayPalOrderApprove(data.orderID); }}
                          onError={() => setError("Error con PayPal. Intenta de nuevo.")}
                        />
                      </PayPalScriptProvider>
                    ) : activePayPalPlan ? (
                      <PayPalScriptProvider key="paypal-sub" options={{ clientId: PAYPAL_CLIENT_ID, vault: true, intent: "subscription" }}>
                        <PayPalButtons
                          style={{ layout: "vertical", color: "blue", shape: "rect", label: "subscribe" }}
                          createSubscription={(_data, actions) => actions.subscription.create({ plan_id: activePayPalPlan })}
                          onApprove={async (data) => { if (data.subscriptionID) await handlePayPalSubscriptionApprove(data.subscriptionID); }}
                          onError={() => setError("Error con PayPal. Intenta de nuevo.")}
                        />
                      </PayPalScriptProvider>
                    ) : (
                      <div style={{ textAlign: "center", color: "#F59E0B", fontSize: 12, padding: "14px 16px", background: "rgba(245,158,11,0.08)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.2)" }}>
                        {plan === "annual" ? "Plan anual no disponible aún." : "Configura VITE_PAYPAL_PLAN_ID para pagos mensuales."}
                      </div>
                    )
                  ) : !loading && !PAYPAL_CLIENT_ID ? (
                    <div style={{ textAlign: "center", color: "#F59E0B", fontSize: 12, padding: "14px 16px", background: "rgba(245,158,11,0.08)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.2)" }}>
                      PayPal no está configurado.
                    </div>
                  ) : null}
                </div>
              )}

              {error && (
                <div style={{ marginTop: 14, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 14px", color: "#F87171", fontSize: 13, textAlign: "center" }}>
                  {error}
                </div>
              )}
            </div>

            {/* Card footer */}
            <div style={{ borderTop: "1px solid rgba(249,115,22,0.2)", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
              {[
                { icon: "🔒", text: "PAGO_SEGURO" },
                { icon: "↻", text: "CANCELA_SIEMPRE" },
                { icon: "⚡", text: "ACTIVO_INSTANTE" },
              ].map(b => (
                <div key={b.text} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 11, color: "#F97316" }}>{b.icon}</span>
                  <span style={{ fontSize: 9, color: "rgba(253,186,116,0.55)", fontWeight: 800, letterSpacing: 1.2 }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Highlights ── */}
        <div style={{ maxWidth: 700, margin: "0 auto 60px", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, background: "#DC2626", borderRadius: "50%", boxShadow: "0 0 8px #DC2626", animation: "pulse 1.6s ease-in-out infinite" }} />
            <h2 style={{ fontSize: 11, fontWeight: 900, color: "#FDBA74", margin: 0, letterSpacing: 3, textTransform: "uppercase" }}>
              [ HABILIDADES · MEGAFAN ]
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
            {[
              { icon: "⚔", title: "Anime sin limites", desc: "Mira todos los episodios que quieras, sin restricciones." },
              { icon: "⚡", title: "Acceso anticipado", desc: "Se el primero en disfrutar nuevas funciones y contenido." },
              { icon: "👑", title: "Badge exclusivo", desc: "Muestra tu badge MegaFan en toda la comunidad." },
              { icon: "◎", title: "Soporte premium", desc: "Atencion prioritaria para resolver cualquier problema." },
            ].map(h => (
              <div key={h.title} style={{
                position: "relative",
                background: "linear-gradient(160deg, rgba(20,6,16,0.85), rgba(8,4,18,0.95))",
                border: "1px solid rgba(220,38,38,0.3)",
                clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
                padding: "22px 18px", textAlign: "center",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 0 20px rgba(220,38,38,0.1)",
              }}>
                <div style={{ position: "absolute", top: 0, left: 14, right: 14, height: 1, background: "linear-gradient(90deg,transparent,#F97316,transparent)" }} />
                <div style={{ fontSize: 28, marginBottom: 12, color: "#F97316", filter: "drop-shadow(0 0 8px #DC2626)" }}>{h.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#FDBA74", marginBottom: 8, letterSpacing: 2, textTransform: "uppercase" }}>// {h.title}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, fontFamily: "system-ui, sans-serif" }}>{h.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Comparison table ── */}
        <div style={{ maxWidth: 560, margin: "0 auto 60px", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, background: "#F97316", borderRadius: "50%", boxShadow: "0 0 8px #F97316", animation: "pulse 1.6s ease-in-out infinite" }} />
            <h2 style={{ fontSize: 11, fontWeight: 900, color: "#FDBA74", margin: 0, letterSpacing: 3, textTransform: "uppercase" }}>
              [ COMPARATIVA · CAZADOR_VS_MONARCA ]
            </h2>
          </div>
          <div style={{
            background: "linear-gradient(160deg, rgba(20,6,16,0.85), rgba(8,4,18,0.95))",
            border: "1px solid rgba(220,38,38,0.4)",
            clipPath: "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
            overflow: "hidden",
            boxShadow: "0 0 24px rgba(220,38,38,0.15)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", borderBottom: "1px solid rgba(249,115,22,0.3)" }}>
              <div style={{ padding: "12px 18px", fontSize: 9, color: "rgba(253,186,116,0.5)", fontWeight: 800, letterSpacing: 2 }}>// FUNCION</div>
              <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: 1.5 }}>GRATIS</div>
              <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 10, fontWeight: 900, color: "#FDBA74", background: "rgba(220,38,38,0.12)", letterSpacing: 1.5 }}>MEGAFAN ✦</div>
            </div>
            {[
              { label: "Streaming de anime", free: true, pro: true },
              { label: "Lista de favoritos", free: true, pro: true },
              { label: "Sin limite de episodios", free: false, pro: true },
              { label: "Badge exclusivo", free: false, pro: true },
              { label: "Acceso anticipado", free: false, pro: true },
              { label: "Soporte prioritario", free: false, pro: true },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", borderBottom: i < arr.length - 1 ? "1px solid rgba(220,38,38,0.12)" : "none" }}>
                <div style={{ padding: "13px 18px", fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "system-ui, sans-serif" }}>{row.label}</div>
                <div style={{ padding: "13px 8px", textAlign: "center" }}>
                  {row.free ? <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>✓</span> : <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 14 }}>—</span>}
                </div>
                <div style={{ padding: "13px 8px", textAlign: "center", background: "rgba(220,38,38,0.08)" }}>
                  {row.pro ? <span style={{ color: "#FDBA74", fontSize: 14, fontWeight: 800, textShadow: "0 0 8px rgba(249,115,22,0.6)" }}>✓</span> : <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 14 }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div style={{ maxWidth: 560, margin: "0 auto 60px", padding: "0 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, background: "#DC2626", borderRadius: "50%", boxShadow: "0 0 8px #DC2626", animation: "pulse 1.6s ease-in-out infinite" }} />
            <h2 style={{ fontSize: 11, fontWeight: 900, color: "#FDBA74", margin: 0, letterSpacing: 3, textTransform: "uppercase" }}>
              [ CONSULTAS · FRECUENTES ]
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{
                background: openFaq === i ? "linear-gradient(160deg, rgba(20,6,16,0.9), rgba(8,4,18,0.98))" : "rgba(8,4,18,0.6)",
                border: `1px solid ${openFaq === i ? "rgba(249,115,22,0.55)" : "rgba(220,38,38,0.2)"}`,
                clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                overflow: "hidden", transition: "all 0.2s",
                boxShadow: openFaq === i ? "0 0 18px rgba(249,115,22,0.2)" : "none",
              }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "16px 18px", background: "transparent", border: "none", cursor: "pointer",
                    color: openFaq === i ? "#FDBA74" : "#F1F1F5",
                    fontSize: 13, fontWeight: 700, textAlign: "left", gap: 12,
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#F97316", fontSize: 10, fontWeight: 900, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>0{i+1}</span>
                    {faq.q}
                  </span>
                  <span style={{ color: openFaq === i ? "#F97316" : "rgba(253,186,116,0.4)", fontSize: 16, flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 18px 16px", color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.7, fontFamily: "system-ui, sans-serif", borderTop: "1px solid rgba(249,115,22,0.15)", paddingTop: 12, marginTop: -2 }}>
                    <span style={{ color: "#F97316", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginRight: 6 }}>&gt;</span>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Payment history ── */}
        {user && (
          <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 16px" }}>
            <button
              onClick={() => setShowPayments(v => !v)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "15px 20px", cursor: "pointer", marginBottom: showPayments ? 12 : 0 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 15 }}>🧾</span>
                <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Historial de pagos</span>
              </div>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, transition: "transform 0.2s", transform: showPayments ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
            </button>

            {showPayments && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
                {paymentsLoading ? (
                  <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Cargando...</div>
                ) : payments.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.2)", fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🧾</div>
                    No hay transacciones registradas.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                        {["Fecha","Plan","Monto","Estado","Cupón"].map(h => (
                          <th key={h} style={{ padding: "11px 16px", color: "rgba(255,255,255,0.3)", fontWeight: 700, textAlign: "left", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={p.order_id} style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                          <td style={{ padding: "11px 16px", color: "rgba(255,255,255,0.55)" }}>
                            {new Date(p.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                          </td>
                          <td style={{ padding: "11px 16px", color: "#FECACA", fontWeight: 700, textTransform: "capitalize" }}>{p.plan}</td>
                          <td style={{ padding: "11px 16px", color: "#22C55E", fontWeight: 800 }}>${Number(p.amount_usd).toFixed(2)}</td>
                          <td style={{ padding: "11px 16px" }}>
                            <span style={{ padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: p.status === "completed" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)", color: p.status === "completed" ? "#22C55E" : "#F59E0B" }}>
                              {p.status === "completed" ? "Completado" : p.status}
                            </span>
                          </td>
                          <td style={{ padding: "11px 16px", color: p.promo_code ? "#F59E0B" : "rgba(255,255,255,0.18)", fontSize: 12 }}>
                            {p.promo_code ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
      `}</style>
      <Footer />
    </>
  );
}
