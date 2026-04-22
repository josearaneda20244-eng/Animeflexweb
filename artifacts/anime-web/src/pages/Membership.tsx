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

      <div style={{ minHeight: "100vh", background: "#07071a", color: "#fff", paddingBottom: 80 }}>

        {/* ── Hero banner ── */}
        <div style={{ position: "relative", overflow: "hidden", padding: "72px 16px 56px", textAlign: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(220,38,38,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,38,38,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 100, padding: "6px 16px", marginBottom: 20 }}>
            <span style={{ fontSize: 12 }}>👑</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#FECACA", letterSpacing: 1 }}>PLAN PREMIUM</span>
          </div>

          <h1 style={{ fontSize: "clamp(28px,6vw,48px)", fontWeight: 900, margin: "0 0 12px", lineHeight: 1.15 }}>
            <span style={{ color: "#F1F1F5" }}>Eleva tu experiencia</span><br />
            <span style={{ background: "linear-gradient(135deg,#FECACA,#DC2626)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>con MegaFan</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, margin: 0, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
            Anime sin límites, sin interrupciones, con beneficios exclusivos
          </p>
        </div>

        {/* ── Plan toggle ── */}
        {!isMegaFan && !success && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
            <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 4, gap: 4 }}>
              {(["monthly","annual"] as Plan[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  style={{
                    padding: "10px 24px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700,
                    transition: "all 0.2s",
                    background: plan === p ? "linear-gradient(135deg,#DC2626,#991B1B)" : "transparent",
                    color: plan === p ? "#fff" : "rgba(255,255,255,0.4)",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                >
                  {p === "monthly" ? "Mensual" : "Anual"}
                  {p === "annual" && (
                    <span style={{ background: "#22C55E", color: "#fff", fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 100 }}>
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
            background: "linear-gradient(160deg, #13133a 0%, #0d0d25 100%)",
            border: "1px solid rgba(220,38,38,0.35)",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 0 0 1px rgba(220,38,38,0.1), 0 32px 80px rgba(220,38,38,0.2), 0 8px 32px rgba(0,0,0,0.6)",
          }}>
            {/* Glow top */}
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", height: 2, background: "linear-gradient(90deg,transparent,rgba(220,38,38,0.8),transparent)" }} />
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: "60%", height: 60, background: "radial-gradient(ellipse, rgba(220,38,38,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />

            {/* Popular badge */}
            <div style={{ position: "absolute", top: 18, right: 18 }}>
              <span style={{ background: "linear-gradient(135deg,#F59E0B,#EF4444)", color: "#fff", fontSize: 10, fontWeight: 800, padding: "4px 10px", borderRadius: 100, letterSpacing: 0.5 }}>
                MÁS POPULAR
              </span>
            </div>

            <div style={{ padding: "32px 28px 28px" }}>
              {/* Plan name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,rgba(220,38,38,0.3),rgba(153,27,27,0.2))", border: "1px solid rgba(220,38,38,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                  👑
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(167,139,250,0.7)", letterSpacing: 1.5, textTransform: "uppercase" }}>Plan</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#F1F1F5", letterSpacing: 0.5 }}>MegaFan</div>
                </div>
              </div>

              {/* Price */}
              <div style={{ marginBottom: 6 }}>
                {promoResult && (
                  <span style={{ color: "rgba(255,255,255,0.3)", textDecoration: "line-through", fontSize: 18, marginRight: 8 }}>
                    {centsToDisplay(promoResult.originalCents)}
                  </span>
                )}
                <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, background: "linear-gradient(135deg,#fff 60%,rgba(167,139,250,0.8))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {centsToDisplay(finalAmount)}
                </span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 15, marginLeft: 4 }}>
                  {plan === "annual" ? "/año" : "/mes"}
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

              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, margin: "4px 0 24px" }}>
                Cancela cuando quieras · Sin contratos
              </p>

              {/* Divider */}
              <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(220,38,38,0.2),transparent)", marginBottom: 22 }} />

              {/* Features */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                {FEATURES.map(f => (
                  <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: f.free ? "rgba(255,255,255,0.04)" : "rgba(220,38,38,0.15)",
                      border: `1px solid ${f.free ? "rgba(255,255,255,0.06)" : "rgba(220,38,38,0.25)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    }}>
                      {f.free ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#FECACA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 13, color: f.free ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)", fontWeight: f.free ? 400 : 600 }}>
                      {f.label}
                    </span>
                    {!f.free && (
                      <span style={{ marginLeft: "auto", fontSize: 11, background: "rgba(220,38,38,0.15)", color: "#FECACA", padding: "2px 7px", borderRadius: 6, fontWeight: 700, whiteSpace: "nowrap" }}>
                        MegaFan
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(220,38,38,0.2),transparent)", marginBottom: 22 }} />

              {/* Coupon */}
              {!isMegaFan && !success && user && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                    Código de descuento
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="CÓDIGO"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${couponStatus === "valid" ? "rgba(34,197,94,0.5)" : couponStatus === "invalid" ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                        borderRadius: 12, padding: "11px 40px 11px 14px",
                        color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "monospace",
                        outline: "none", transition: "border 0.2s", letterSpacing: 1,
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
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px", textAlign: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, margin: 0 }}>Inicia sesión para suscribirte</p>
                </div>
              ) : isMegaFan ? (
                <div>
                  <div style={{ background: "linear-gradient(135deg,rgba(220,38,38,0.15),rgba(153,27,27,0.08))", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 14, padding: "18px 20px", textAlign: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>👑</div>
                    <p style={{ color: "#FECACA", fontWeight: 800, fontSize: 15, margin: "0 0 4px" }}>¡Ya eres MegaFan!</p>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0 }}>Gracias por apoyar AnimeFlex</p>
                  </div>
                  <button
                    onClick={handleManage}
                    disabled={loading}
                    style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "1px solid rgba(220,38,38,0.4)", background: "transparent", color: "#FECACA", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
                  >
                    {loading ? "Cargando..." : "Gestionar en PayPal"}
                  </button>
                </div>
              ) : success ? (
                <div style={{ background: "linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,163,74,0.06))", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 14, padding: "24px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                  <p style={{ color: "#22C55E", fontWeight: 900, fontSize: 17, margin: "0 0 6px" }}>¡Bienvenido MegaFan!</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, margin: 0 }}>Tu membresía ya está activa</p>
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
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
              {[
                { icon: "🔒", text: "Pago seguro" },
                { icon: "🔄", text: "Cancela siempre" },
                { icon: "⚡", text: "Activo al instante" },
              ].map(b => (
                <div key={b.text} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 12 }}>{b.icon}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>{b.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Highlights ── */}
        <div style={{ maxWidth: 700, margin: "0 auto 60px", padding: "0 16px" }}>
          <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#F1F1F5", marginBottom: 24 }}>
            ¿Por qué elegir <span style={{ color: "#FECACA" }}>MegaFan</span>?
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
            {[
              { icon: "🎌", title: "Anime sin límites", desc: "Mira todos los episodios que quieras cada día, sin restricciones." },
              { icon: "⚡", title: "Acceso anticipado", desc: "Sé el primero en disfrutar nuevas funciones y contenido exclusivo." },
              { icon: "👑", title: "Badge exclusivo", desc: "Muestra tu badge MegaFan en toda la comunidad de AnimeFlex." },
              { icon: "🎯", title: "Soporte premium", desc: "Atención prioritaria para resolver cualquier problema al instante." },
            ].map(h => (
              <div key={h.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "22px 18px", textAlign: "center", transition: "border 0.2s" }}>
                <div style={{ fontSize: 30, marginBottom: 12 }}>{h.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#F1F1F5", marginBottom: 6 }}>{h.title}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{h.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Comparison table ── */}
        <div style={{ maxWidth: 560, margin: "0 auto 60px", padding: "0 16px" }}>
          <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#F1F1F5", marginBottom: 24 }}>
            Gratis vs <span style={{ color: "#FECACA" }}>MegaFan</span>
          </h2>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ padding: "12px 18px" }} />
              <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>GRATIS</div>
              <div style={{ padding: "12px 8px", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#FECACA", background: "rgba(220,38,38,0.08)" }}>MEGAFAN 👑</div>
            </div>
            {[
              { label: "Streaming de anime", free: true, pro: true },
              { label: "Lista de favoritos", free: true, pro: true },
              { label: "Sin límite de episodios", free: false, pro: true },
              { label: "Badge exclusivo", free: false, pro: true },
              { label: "Acceso anticipado", free: false, pro: true },
              { label: "Soporte prioritario", free: false, pro: true },
            ].map((row, i, arr) => (
              <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ padding: "13px 18px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>{row.label}</div>
                <div style={{ padding: "13px 8px", textAlign: "center" }}>
                  {row.free ? <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>✓</span> : <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 14 }}>—</span>}
                </div>
                <div style={{ padding: "13px 8px", textAlign: "center", background: "rgba(220,38,38,0.05)" }}>
                  {row.pro ? <span style={{ color: "#FECACA", fontSize: 14, fontWeight: 700 }}>✓</span> : <span style={{ color: "rgba(255,255,255,0.12)", fontSize: 14 }}>—</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FAQ ── */}
        <div style={{ maxWidth: 560, margin: "0 auto 60px", padding: "0 16px" }}>
          <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#F1F1F5", marginBottom: 24 }}>
            Preguntas frecuentes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${openFaq === i ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 14, overflow: "hidden", transition: "border 0.2s" }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "transparent", border: "none", cursor: "pointer", color: "#F1F1F5", fontSize: 14, fontWeight: 700, textAlign: "left", gap: 12 }}
                >
                  <span>{faq.q}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18, flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
                </button>
                {openFaq === i && (
                  <div style={{ padding: "0 18px 16px", color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.7 }}>
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

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <Footer />
    </>
  );
}
