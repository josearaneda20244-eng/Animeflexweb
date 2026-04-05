import { useState, useEffect, useRef } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSearch } from "wouter";

const PAYPAL_CLIENT_ID       = import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "";
const PAYPAL_PLAN_ID_MONTHLY = import.meta.env.VITE_PAYPAL_PLAN_ID ?? "";
const PAYPAL_PLAN_ID_ANNUAL  = import.meta.env.VITE_PAYPAL_PLAN_ID_ANNUAL ?? PAYPAL_PLAN_ID_MONTHLY;

type Plan = "monthly" | "annual";

interface PromoResult {
  valid: boolean;
  code: string;
  discountPercent: number;
  originalCents: number;
  discountedCents: number;
}

function centsToDisplay(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function Membership() {
  const { user, refreshUser } = useAuth();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const [plan, setPlan]         = useState<Plan>("monthly");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const [couponInput, setCouponInput]   = useState("");
  const [couponStatus, setCouponStatus] = useState<"idle" | "loading" | "valid" | "invalid">("idle");
  const [promoResult, setPromoResult]   = useState<PromoResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMegaFan = user?.membership_tier === "megafan";

  /* Show stripe success/cancel banners from URL */
  const stripeStatus = searchParams.get("stripe");

  useEffect(() => {
    if (stripeStatus === "success") {
      refreshUser();
      setSuccess(true);
    }
  }, [stripeStatus]);

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

  async function handlePayPalApprove(subscriptionId: string) {
    setLoading(true);
    setError(null);
    try {
      await apiClient.post("/membership", { action: "activate", subscriptionId });
      await refreshUser();
      setSuccess(true);
    } catch (e: any) {
      setError(e.message ?? "Error activando la membresía");
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

  async function handleStripePortal() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<{ url: string }>("/stripe/portal");
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message ?? "Error abriendo el portal de Stripe");
    } finally {
      setLoading(false);
    }
  }

  async function handleStripeCheckout() {
    if (!user) { setError("Debes iniciar sesión primero"); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.post<{ url: string }>("/stripe/create-checkout-session", {
        plan,
        promoCode: couponInput.trim() || undefined,
      });
      window.location.href = data.url;
    } catch (e: any) {
      setError(e.message ?? "Error creando la sesión de pago");
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

          {/* Stripe success / cancel banners */}
          {stripeStatus === "success" && (
            <div className="mb-6 bg-green-900/40 border border-green-500/40 rounded-xl p-4 text-center">
              <p className="text-green-400 font-bold text-lg">¡Pago procesado con éxito!</p>
              <p className="text-gray-400 text-sm mt-1">Tu membresía MegaFan ya está activa.</p>
            </div>
          )}
          {stripeStatus === "cancel" && (
            <div className="mb-6 bg-yellow-900/30 border border-yellow-700/40 rounded-xl p-4 text-center">
              <p className="text-yellow-400 font-semibold">Pago cancelado</p>
              <p className="text-gray-400 text-sm mt-1">No se realizó ningún cargo.</p>
            </div>
          )}

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
              <div className="mb-3 text-green-400 text-sm font-semibold">
                🎉 Cupón aplicado: −{promoResult.discountPercent}% de descuento
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
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleManage}
                    disabled={loading}
                    className="w-full py-3 rounded-xl border border-purple-500/60 text-purple-300 hover:bg-purple-900/30 transition-colors text-sm"
                  >
                    {loading ? "Cargando..." : "Gestionar en PayPal"}
                  </button>
                  {user?.stripe_customer_id && (
                    <button
                      onClick={handleStripePortal}
                      disabled={loading}
                      className="w-full py-3 rounded-xl border border-indigo-500/60 text-indigo-300 hover:bg-indigo-900/30 transition-colors text-sm"
                    >
                      Gestionar en Stripe
                    </button>
                  )}
                </div>
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

                {/* Stripe button */}
                {!loading && (
                  <button
                    onClick={handleStripeCheckout}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
                    Pagar con tarjeta (Stripe)
                    <span className="text-xs opacity-75 ml-1">
                      {centsToDisplay(finalAmount)}{plan === "annual" ? "/año" : "/mes"}
                    </span>
                  </button>
                )}

                {/* Divider */}
                {!loading && PAYPAL_CLIENT_ID && activePayPalPlan && (
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-gray-500 text-xs">o</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                )}

                {/* PayPal buttons */}
                {!loading && PAYPAL_CLIENT_ID && activePayPalPlan ? (
                  <PayPalScriptProvider
                    options={{ clientId: PAYPAL_CLIENT_ID, vault: true, intent: "subscription" }}
                  >
                    <PayPalButtons
                      style={{ layout: "vertical", color: "blue", shape: "rect", label: "subscribe" }}
                      createSubscription={(_data, actions) =>
                        actions.subscription.create({ plan_id: activePayPalPlan })
                      }
                      onApprove={async (data) => {
                        if (data.subscriptionID) await handlePayPalApprove(data.subscriptionID);
                      }}
                      onError={() => setError("Error con PayPal. Intenta de nuevo.")}
                    />
                  </PayPalScriptProvider>
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
            Pago seguro con Stripe y PayPal · Sin contratos · Cancela cuando quieras
          </p>
        </div>
      </div>
      <Footer />
    </>
  );
}
