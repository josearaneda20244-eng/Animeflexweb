import { useState, useEffect, useRef } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PAYPAL_CLIENT_ID       = import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "";
const PAYPAL_PLAN_ID_MONTHLY = import.meta.env.VITE_PAYPAL_PLAN_ID ?? "";
/* Annual PayPal plan requires its own plan ID — no fallback to monthly
   to avoid silently enrolling users in a monthly plan when annual is selected. */
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

export default function Membership() {
  const { user, refreshUser } = useAuth();
  const [plan, setPlan]         = useState<Plan>("monthly");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const [couponInput, setCouponInput]   = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [promoResult, setPromoResult]   = useState<PromoResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMegaFan = user?.membership_tier === "megafan";

  /* Payment history state */
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

  /* Price display */
  const MONTHLY_CENTS = 400;
  const ANNUAL_CENTS  = 3840;
  const baseAmount    = plan === "annual" ? ANNUAL_CENTS  : MONTHLY_CENTS;
  const finalAmount   = promoResult ? promoResult.discountedCents : baseAmount;
  const savingsAnnual = MONTHLY_CENTS * 12 - ANNUAL_CENTS; // 960 cents = $9.60

  /* Coupon validation (debounced) */
  useEffect(() => {
    if (!couponInput.trim()) {
      setCouponStatus("idle");
      setPromoResult(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCouponStatus("loading");
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiClient.post<PromoResult>("/promo-codes/validate", {
          code: couponInput.trim(),
          plan,
        });
        setPromoResult(data);
        setCouponStatus("valid");
      } catch {
        setPromoResult(null);
        setCouponStatus("invalid");
      }
    }, 600);
  }, [couponInput, plan]);

  /* ── PayPal SUBSCRIPTION flow (no coupon) ── */
  async function handlePayPalSubscriptionApprove(subscriptionId: string) {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/membership", { action: "activate", subscriptionId, plan });
      await refreshUser();
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Error activando la membresía");
    } finally {
      setLoading(false);
    }
  }

  /* ── PayPal ORDER flow (with coupon — applies real discount at billing time) ── */
  async function createPayPalOrder(): Promise<string> {
    const data = await apiClient.post<{ orderId: string }>("/membership", {
      action: "create-order",
      plan,
      promoCode: couponInput.trim() || undefined,
    });
    return data.orderId;
  }

  async function handlePayPalOrderApprove(orderId: string) {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/membership", {
        action: "capture-order",
        orderId,
        plan,
        promoCode: couponInput.trim() || undefined,
      });
      await refreshUser();
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Error capturando el pago de PayPal");
    } finally {
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.post<{ url: string }>("/membership", { action: "portal" });
      window.open(data.url, "_blank");
    } catch (e: any) {
      setError(e.message ?? "Error abriendo el portal");
    } finally {
      setLoading(false);
    }
  }

  const activePayPalPlan = plan === "annual" ? PAYPAL_PLAN_ID_ANNUAL : PAYPAL_PLAN_ID_MONTHLY;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a1a] text-white py-16 px-4">
        <div className="max-w-lg mx-auto">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">
              <span className="text-purple-400">MegaFan</span> Membresía
            </h1>
            <p className="text-gray-400">Disfruta AnimeFlex sin interrupciones</p>
          </div>

          {/* Plan toggle */}
          {!isMegaFan && !success && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="flex bg-[#12122a] border border-purple-800/30 rounded-xl p-1">
                <button
                  onClick={() => setPlan("monthly")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    plan === "monthly"
                      ? "bg-purple-600 text-white shadow"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setPlan("annual")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                    plan === "annual"
                      ? "bg-purple-600 text-white shadow"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  Anual
                  <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    −20%
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Card */}
          <div className="relative bg-[#12122a] border-2 border-purple-500 rounded-2xl p-8 shadow-xl shadow-purple-900/30">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
              MÁS POPULAR
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👑</span>
              <span className="text-xl font-bold text-purple-300">MEGAFAN</span>
            </div>

            {/* Price display */}
            <div className="mb-1">
              {promoResult && (
                <span className="text-gray-500 line-through text-xl mr-2">
                  {centsToDisplay(promoResult.originalCents)}
                </span>
              )}
              <span className="text-5xl font-black text-white">
                {centsToDisplay(finalAmount)}
              </span>
              <span className="text-gray-400 ml-1">
                {plan === "annual" ? "/año" : "/mes"}
              </span>
              {plan === "annual" && !promoResult && (
                <span className="ml-2 text-sm text-green-400 font-semibold">
                  (ahorra {centsToDisplay(savingsAnnual)})
                </span>
              )}
              {plan === "annual" && (
                <div className="text-gray-500 text-sm mt-1">
                  ≈ {centsToDisplay(Math.round(finalAmount / 12))}/mes
                </div>
              )}
            </div>
            {promoResult && (
              <div className="mb-3">
                <p className="text-green-400 text-sm font-semibold">
                  🎉 Cupón aplicado: −{promoResult.discountPercent}% de descuento
                </p>
                {PAYPAL_CLIENT_ID && (
                  <p className="text-gray-500 text-xs mt-0.5">
                    El pago con cupón es un cargo único. Al vencer, puedes renovar con suscripción normal.
                  </p>
                )}
              </div>
            )}
            <p className="text-gray-500 text-sm mb-6">Cancela cuando quieras</p>

            {/* Features */}
            <ul className="space-y-3 mb-6 text-sm">
              {[
                { text: "Todo lo del plan gratuito", dim: true },
                { text: "Sin límite diario de episodios" },
                { text: "Badge exclusivo MegaFan 👑" },
                { text: "Soporte prioritario" },
                { text: "Acceso anticipado a nuevas funciones" },
                ...(plan === "annual" ? [{ text: `Ahorra ${centsToDisplay(savingsAnnual)} vs. mensual`, special: true }] : []),
              ].map((item) => (
                <li key={item.text} className={`flex items-center gap-2 ${item.dim ? "text-gray-500" : item.special ? "text-green-400 font-semibold" : ""}`}>
                  <svg className={`w-4 h-4 flex-shrink-0 ${item.dim ? "text-gray-600" : item.special ? "text-green-400" : "text-purple-400"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item.text}
                </li>
              ))}
            </ul>

            {/* Coupon input */}
            {!isMegaFan && !success && user && (
              <div className="mb-5">
                <label className="text-xs text-gray-400 mb-1 block">¿Tienes un cupón?</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="CÓDIGO"
                      value={couponInput}
                      onChange={e => setCouponInput(e.target.value.toUpperCase())}
                      className="w-full bg-[#0d0d1a] border border-purple-800/40 rounded-xl px-4 py-2.5 text-sm font-mono text-white placeholder-gray-600 outline-none focus:border-purple-500 transition-colors uppercase"
                    />
                    {couponStatus === "loading" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">…</span>
                    )}
                    {couponStatus === "valid" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-xs">✓</span>
                    )}
                    {couponStatus === "invalid" && couponInput && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 text-xs">✗</span>
                    )}
                  </div>
                </div>
                {couponStatus === "invalid" && couponInput && (
                  <p className="text-red-400 text-xs mt-1">Código inválido o expirado</p>
                )}
                {couponStatus === "valid" && promoResult && (
                  <p className="text-green-400 text-xs mt-1">
                    −{promoResult.discountPercent}% → {centsToDisplay(promoResult.discountedCents)}
                  </p>
                )}
              </div>
            )}

            {/* Content by state */}
            {!user ? (
              <div className="text-center text-gray-400 py-4 bg-white/5 rounded-xl">
                Inicia sesión para suscribirte
              </div>
            ) : isMegaFan ? (
              <div className="text-center">
                <div className="bg-purple-900/40 border border-purple-500/40 rounded-xl p-4 mb-4">
                  <p className="text-purple-300 font-semibold">👑 ¡Ya eres MegaFan!</p>
                  <p className="text-gray-400 text-sm mt-1">Gracias por tu apoyo</p>
                </div>
                <button
                  onClick={handleManage}
                  disabled={loading}
                  className="w-full py-3 rounded-xl border border-purple-500/60 text-purple-300 hover:bg-purple-900/30 transition-colors text-sm"
                >
                  {loading ? "Cargando..." : "Gestionar en PayPal"}
                </button>
              </div>
            ) : success ? (
              <div className="text-center bg-green-900/40 border border-green-500/40 rounded-xl p-6">
                <p className="text-green-400 text-xl font-bold">¡Bienvenido MegaFan! 🎉</p>
                <p className="text-gray-400 text-sm mt-2">Tu membresía ya está activa</p>
              </div>
            ) : (
              <div className="space-y-3">
                {loading && (
                  <div className="text-center text-gray-400 py-3">
                    <span className="inline-block w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2" />
                    Procesando...
                  </div>
                )}

                {/* PayPal buttons:
                    • Coupon applied  → Orders flow (real discounted charge)
                    • No coupon       → Subscription flow (recurring plan) */}
                {!loading && PAYPAL_CLIENT_ID ? (
                  couponStatus === "valid" ? (
                    /* ── ORDER mode: applies exact discounted amount ── */
                    <PayPalScriptProvider
                      key="paypal-order"
                      options={{ clientId: PAYPAL_CLIENT_ID, intent: "capture" }}
                    >
                      <PayPalButtons
                        style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay" }}
                        createOrder={async () => createPayPalOrder()}
                        onApprove={async (data) => {
                          if (data.orderID) await handlePayPalOrderApprove(data.orderID);
                        }}
                        onError={() => setError("Error con PayPal. Intenta de nuevo.")}
                      />
                    </PayPalScriptProvider>
                  ) : activePayPalPlan ? (
                    /* ── SUBSCRIPTION mode: auto-recurring plan ──
                       NOTE: coupon flow (above) uses a one-time Order capture — PayPal
                       does not support discounts on subscription plans natively. The
                       discounted charge is a single payment; the user can re-subscribe
                       normally after the promo period ends. */
                    <PayPalScriptProvider
                      key="paypal-sub"
                      options={{ clientId: PAYPAL_CLIENT_ID, vault: true, intent: "subscription" }}
                    >
                      <PayPalButtons
                        style={{ layout: "vertical", color: "blue", shape: "rect", label: "subscribe" }}
                        createSubscription={(_data, actions) =>
                          actions.subscription.create({ plan_id: activePayPalPlan })
                        }
                        onApprove={async (data) => {
                          if (data.subscriptionID) await handlePayPalSubscriptionApprove(data.subscriptionID);
                        }}
                        onError={() => setError("Error con PayPal. Intenta de nuevo.")}
                      />
                    </PayPalScriptProvider>
                  ) : (
                    <div className="text-center text-yellow-500 text-xs py-3 bg-yellow-900/20 rounded-xl border border-yellow-700/40 px-4">
                      {plan === "annual"
                        ? "Plan anual no disponible aún. Configura VITE_PAYPAL_PLAN_ID_ANNUAL para activarlo."
                        : "Configura VITE_PAYPAL_PLAN_ID para pagos mensuales con PayPal."}
                    </div>
                  )
                ) : (
                  !loading && !PAYPAL_CLIENT_ID && (
                    <div className="text-center text-yellow-500 text-xs py-3 bg-yellow-900/20 rounded-xl border border-yellow-700/40 px-4">
                      PayPal no está configurado.
                      <br />
                      <span className="text-gray-500">Añade VITE_PAYPAL_CLIENT_ID en variables de entorno.</span>
                    </div>
                  )
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-900/30 border border-red-500/40 rounded-lg p-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}
          </div>

          <p className="text-center text-gray-600 text-xs mt-6">
            Pago seguro con PayPal · Sin contratos · Cancela cuando quieras
          </p>
        </div>
      </div>

      {/* ── T005: Payment history ── */}
      {user && (
        <div style={{ maxWidth: 680, margin: "0 auto 48px", padding: "0 16px" }}>
          <button
            onClick={() => setShowPayments(v => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "14px 18px", cursor: "pointer", marginBottom: showPayments ? 12 : 0 }}
          >
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Historial de pagos</span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }}>{showPayments ? "−" : "+"}</span>
          </button>

          {showPayments && (
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, overflow: "hidden" }}>
              {paymentsLoading ? (
                <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                  Cargando...
                </div>
              ) : payments.length === 0 ? (
                <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                  No hay transacciones registradas.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["Fecha", "Plan", "Monto", "Estado", "Cupón"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", color: "rgba(255,255,255,0.35)", fontWeight: 700, textAlign: "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p, i) => (
                      <tr key={p.order_id} style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                        <td style={{ padding: "10px 14px", color: "rgba(255,255,255,0.6)" }}>
                          {new Date(p.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ padding: "10px 14px", color: "#A78BFA", fontWeight: 700, textTransform: "capitalize" }}>{p.plan}</td>
                        <td style={{ padding: "10px 14px", color: "#22C55E", fontWeight: 800 }}>${Number(p.amount_usd).toFixed(2)}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: p.status === "completed" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)", color: p.status === "completed" ? "#22C55E" : "#F59E0B" }}>
                            {p.status === "completed" ? "Completado" : p.status}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", color: p.promo_code ? "#F59E0B" : "rgba(255,255,255,0.2)", fontSize: 12 }}>
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

      <Footer />
    </>
  );
}
