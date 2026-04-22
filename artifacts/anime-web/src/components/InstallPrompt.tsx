import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("af_pwa_dismissed") === "1"; } catch { return false; }
  });
  const [installed, setInstalled] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone =
      ("standalone" in navigator && (navigator as any).standalone === true) ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isInStandalone) { setInstalled(true); return; }

    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("af_pwa_dismissed", "1"); } catch {}
  };

  if (installed || dismissed || (!prompt && !showIOSGuide)) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: 380,
        width: "calc(100vw - 32px)",
        background: "linear-gradient(135deg, #1a1b2e 0%, #12131f 100%)",
        border: "1px solid rgba(220,38,38,0.3)",
        borderRadius: 16,
        padding: "16px 18px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(220,38,38,0.1)",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "linear-gradient(135deg, #DC2626, #FECACA)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Smartphone size={22} color="#fff" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#F0F0FF", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
          Instalar AnimeFlex
        </div>
        {showIOSGuide ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, lineHeight: 1.4 }}>
            Toca <strong style={{ color: "#FECACA" }}>Compartir</strong> → <strong style={{ color: "#FECACA" }}>Añadir a Inicio</strong>
          </div>
        ) : (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            Accede más rápido desde tu pantalla de inicio
          </div>
        )}
      </div>

      {!showIOSGuide && (
        <button
          onClick={handleInstall}
          style={{
            background: "linear-gradient(135deg, #DC2626, #FECACA)",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            padding: "8px 14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          <Download size={13} />
          Instalar
        </button>
      )}

      <button
        onClick={handleDismiss}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 4,
          color: "rgba(255,255,255,0.3)",
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
