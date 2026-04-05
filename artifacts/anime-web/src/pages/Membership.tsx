import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "";
const PAYPAL_PLAN_ID = import.meta.env.VITE_PAYPAL_PLAN_ID ?? "";

export default function Membership() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isMegaFan = user?.membership_tier === "megafan";

  async function handleApprove(subscriptionId: string) {
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

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[#0a0a1a] text-white py-16 px-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-2">
              <span className="text-purple-400">MegaFan</span> Membresía
            </h1>
            <p className="text-gray-400">Disfruta AnimeFlex sin interrupciones</p>
          </div>

          {/* Card */}
          <div className="relative bg-[#12122a] border-2 border-purple-500 rounded-2xl p-8 shadow-xl shadow-purple-900/30">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-orange-400 text-black text-xs font-bold px-4 py-1 rounded-full">
              MÁS POPULAR
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">👑</span>
              <span className="text-xl font-bold text-purple-300">MEGAFAN</span>
            </div>

            <div className="mb-1">
              <span className="text-5xl font-black">$4</span>
              <span className="text-gray-400 ml-1">/mes</span>
            </div>
            <p className="text-gray-500 text-sm mb-6">Cancela cuando quieras</p>

            <ul className="space-y-3 mb-8 text-sm">
              {[
                { text: "Todo lo del plan gratuito", dim: true },
                { text: "Sin límite diario de episodios" },
                { text: "Badge exclusivo MegaFan" },
                { text: "Soporte prioritario" },
                { text: "Acceso anticipado a nuevas funciones" },
              ].map((item) => (
                <li key={item.text} className={`flex items-center gap-2 ${item.dim ? "text-gray-500" : ""}`}>
                  <svg className={`w-4 h-4 flex-shrink-0 ${item.dim ? "text-gray-600" : "text-purple-400"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {item.text}
                </li>
              ))}
            </ul>

            {!user ? (
              <div className="text-center text-gray-400 py-4">Inicia sesión para suscribirte</div>
            ) : isMegaFan ? (
              <div className="text-center">
                <div className="bg-purple-900/40 border border-purple-500/40 rounded-xl p-4 mb-4">
                  <p className="text-purple-300 font-semibold">👑 ¡Ya eres MegaFan!</p>
                  <p className="text-gray-400 text-sm mt-1">Gracias por tu apoyo</p>
                </div>
                <button
                  onClick={handleManage}
                  disabled={loading}
                  className="w-full py-3 rounded-xl border border-purple-500 text-purple-300 hover:bg-purple-900/30 transition-colors text-sm"
                >
                  {loading ? "Cargando..." : "Gestionar suscripción en PayPal"}
                </button>
              </div>
            ) : success ? (
              <div className="text-center bg-green-900/40 border border-green-500/40 rounded-xl p-6">
                <p className="text-green-400 text-xl font-bold">¡Bienvenido MegaFan!</p>
                <p className="text-gray-400 text-sm mt-2">Tu membresía ya está activa</p>
              </div>
            ) : (
              <div>
                {loading && <div className="text-center text-gray-400 py-4">Procesando...</div>}
                {!loading && PAYPAL_CLIENT_ID && PAYPAL_PLAN_ID ? (
                  <PayPalScriptProvider
                    options={{ clientId: PAYPAL_CLIENT_ID, vault: true, intent: "subscription" }}
                  >
                    <PayPalButtons
                      style={{ layout: "vertical", color: "blue", shape: "rect", label: "subscribe" }}
                      createSubscription={(_data, actions) =>
                        actions.subscription.create({ plan_id: PAYPAL_PLAN_ID })
                      }
                      onApprove={async (data) => {
                        if (data.subscriptionID) await handleApprove(data.subscriptionID);
                      }}
                      onError={() => {
                        setError("Error con PayPal. Intenta de nuevo.");
                      }}
                    />
                  </PayPalScriptProvider>
                ) : (
                  !loading && (
                    <div className="text-center text-yellow-500 text-sm py-4 bg-yellow-900/20 rounded-xl border border-yellow-700/40 p-4">
                      PayPal aún no está configurado.
                      <br />
                      <span className="text-gray-400 text-xs mt-1 block">
                        Añade VITE_PAYPAL_CLIENT_ID y VITE_PAYPAL_PLAN_ID en tus variables de entorno.
                      </span>
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
      <Footer />
    </>
  );
}
