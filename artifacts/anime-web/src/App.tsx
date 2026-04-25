import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { HistoryProvider } from "@/context/HistoryContext";
import { WatchProgressProvider } from "@/context/WatchProgressContext";
import { WatchListProvider } from "@/context/WatchListContext";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/components/NotificationManager";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import AdScript from "@/components/AdScript";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import InstallPrompt from "@/components/InstallPrompt";
import { useAuth } from "@/context/AuthContext";
import { useLimitsConfig } from "@/hooks/use-limits-config";

const Home = lazy(() => import("@/pages/Home"));
const Search = lazy(() => import("@/pages/Search"));
const AnimeDetail = lazy(() => import("@/pages/AnimeDetail"));
const Player = lazy(() => import("@/pages/Player"));
const Favorites = lazy(() => import("@/pages/Favorites"));
const History = lazy(() => import("@/pages/History"));
const Movies = lazy(() => import("@/pages/Movies"));
const OVAs = lazy(() => import("@/pages/OVAs"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const WatchList = lazy(() => import("@/pages/WatchList"));
const Membership = lazy(() => import("@/pages/Membership"));
const Settings = lazy(() => import("@/pages/Settings"));
const Profile = lazy(() => import("@/pages/Profile"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const Admin = lazy(() => import("@/pages/Admin"));
const Feed = lazy(() => import("@/pages/Feed"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const Manga = lazy(() => import("@/pages/Manga"));
const MangaDetail = lazy(() => import("@/pages/MangaDetail"));
const Dmca = lazy(() => import("@/pages/Dmca"));
const MangaReader = lazy(() => import("@/pages/MangaReader"));
const News = lazy(() => import("@/pages/News"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function AnimatedBackground() {
  return (
    <div className="animated-bg">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, padding: 24, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(220,38,38,0.14) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "10%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle,rgba(244,114,182,0.08) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 40, left: 24, color: "rgba(220,38,38,0.07)", fontSize: 120, fontWeight: 900, userSelect: "none", lineHeight: 1 }}>迷</div>
      <div style={{ position: "absolute", bottom: 40, right: 24, color: "rgba(220,38,38,0.07)", fontSize: 120, fontWeight: 900, userSelect: "none", lineHeight: 1 }}>子</div>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <div style={{
          width: 110, height: 110, borderRadius: "50%",
          background: "linear-gradient(135deg, rgba(220,38,38,0.22), rgba(255,255,255,0.08))",
          border: "2px solid rgba(220,38,38,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52,
          boxShadow: "0 0 40px rgba(220,38,38,0.3)",
        }}>🎌</div>
        <div style={{ position: "absolute", top: -8, right: -8, background: "linear-gradient(135deg,#EF4444,#DC2626)", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "2px solid #000", boxShadow: "0 0 12px rgba(239,68,68,0.4)" }}>！</div>
      </div>
      <div style={{ color: "transparent", fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -6, background: "linear-gradient(135deg,#DC2626,#B39DFF,#F472B6)", WebkitBackgroundClip: "text", backgroundClip: "text", marginBottom: 12 } as any}>404</div>
      <div style={{ color: "#F0F0FA", fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Página no encontrada</div>
      <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, textAlign: "center", maxWidth: 300, lineHeight: 1.7, marginBottom: 24 }}>
        El capitán no encontró este episodio. Puede que haya sido movido o eliminado del servidor.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <a href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "linear-gradient(135deg,#DC2626,#991B1B)", borderRadius: 14,
          padding: "12px 24px", color: "#fff", fontSize: 14, fontWeight: 800,
          textDecoration: "none", boxShadow: "0 8px 28px rgba(220,38,38,0.4)",
        }}>▶ Volver al inicio</a>
        <a href="/search" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14,
          padding: "12px 24px", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 700,
          textDecoration: "none",
        }}>🔍 Buscar anime</a>
      </div>
    </div>
  );
}

function formatMaintenanceTime(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function SplashLoader() {
  const mono = "'JetBrains Mono', ui-monospace, monospace";
  const bootLines = [
    "> INIT::CORE_SYSTEM................OK",
    "> AUTH::SESSION_HANDSHAKE..........OK",
    "> NETWORK::SHADOW_LINK.............OK",
    "> CACHE::PREWARM...................OK",
    "> RENDER::INTERFACE_BOOT...........●",
  ];

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 32,
      background: "radial-gradient(ellipse at center, #1a0610 0%, #07060b 70%)",
      position: "relative", overflow: "hidden",
      padding: 20,
      fontFamily: mono,
    }}>
      {/* Hex grid backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(220,38,38,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.07) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        pointerEvents: "none",
      }} />

      {/* Scan lines */}
      <div style={{
        position: "absolute", inset: 0,
        background: "repeating-linear-gradient(0deg, rgba(249,115,22,0.04) 0px, rgba(249,115,22,0.04) 1px, transparent 1px, transparent 4px)",
        pointerEvents: "none",
      }} />

      {/* Animated scan line sweep */}
      <motion.div
        animate={{ y: ["-100vh", "100vh"] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
        style={{
          position: "absolute", left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.6), transparent)",
          boxShadow: "0 0 18px rgba(249,115,22,0.7)",
          pointerEvents: "none",
        }}
      />

      {/* Ambient red glow pulse */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.85, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute", width: 520, height: 520, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220,38,38,0.32) 0%, transparent 70%)",
          filter: "blur(60px)", pointerEvents: "none",
        }}
      />

      {/* Magic Circle stack — three rotating layers */}
      <div style={{ position: "relative", width: 280, height: 280, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
        {/* Outer ring */}
        <motion.svg
          width={280} height={280} viewBox="0 0 200 200"
          style={{ position: "absolute", filter: "drop-shadow(0 0 18px #DC2626)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 32, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="100" cy="100" r="96" fill="none" stroke="#DC2626" strokeWidth="0.6" strokeDasharray="2 6" />
          <circle cx="100" cy="100" r="88" fill="none" stroke="#F97316" strokeWidth="0.4" strokeDasharray="1 3" opacity="0.7" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x1 = 100 + Math.cos(a) * 88;
            const y1 = 100 + Math.sin(a) * 88;
            const x2 = 100 + Math.cos(a) * 96;
            const y2 = 100 + Math.sin(a) * 96;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FDBA74" strokeWidth="0.8" />;
          })}
        </motion.svg>
        {/* Middle ring (counter-rotating) */}
        <motion.svg
          width={220} height={220} viewBox="0 0 200 200"
          style={{ position: "absolute", filter: "drop-shadow(0 0 12px #F97316)" }}
          animate={{ rotate: -360 }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="100" cy="100" r="80" fill="none" stroke="#F97316" strokeWidth="0.7" />
          <circle cx="100" cy="100" r="62" fill="none" stroke="#DC2626" strokeWidth="0.5" strokeDasharray="4 4" />
          <polygon points="100,28 162,134 38,134" fill="none" stroke="#FDBA74" strokeWidth="0.9" />
          <polygon points="100,172 38,66 162,66" fill="none" stroke="#FCA5A5" strokeWidth="0.7" opacity="0.7" />
        </motion.svg>
        {/* Inner ring (faster) */}
        <motion.svg
          width={150} height={150} viewBox="0 0 200 200"
          style={{ position: "absolute", filter: "drop-shadow(0 0 10px #FDBA74)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        >
          <circle cx="100" cy="100" r="44" fill="none" stroke="#FDBA74" strokeWidth="0.8" />
          <circle cx="100" cy="100" r="30" fill="none" stroke="#F97316" strokeWidth="0.5" strokeDasharray="2 2" />
          {Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2;
            const x = 100 + Math.cos(a) * 44;
            const y = 100 + Math.sin(a) * 44;
            return <circle key={i} cx={x} cy={y} r="2" fill="#FDBA74" />;
          })}
        </motion.svg>

        {/* Center logo */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.15 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, zIndex: 3 }}
        >
          <motion.div
            animate={{ boxShadow: [
              "0 0 24px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.22)",
              "0 0 48px rgba(220,38,38,0.95), 0 0 80px rgba(249,115,22,0.4), inset 0 1px 0 rgba(255,255,255,0.22)",
              "0 0 24px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.22)",
            ] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 60, height: 60,
              background: "linear-gradient(135deg, #FCA5A5 0%, #DC2626 50%, #991B1B 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              clipPath: "polygon(11px 0, 100% 0, 100% calc(100% - 11px), calc(100% - 11px) 100%, 0 100%, 0 11px)",
            }}
          >
            <span style={{ color: "#fff", fontSize: 26, fontWeight: 900, marginLeft: 3, lineHeight: 1 }}>▶</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Brand name */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        style={{ textAlign: "center", zIndex: 2, marginTop: -12 }}
      >
        <div style={{
          fontSize: 36, fontWeight: 900, letterSpacing: -1, lineHeight: 1,
          fontFamily: mono,
          textShadow: "0 0 24px rgba(220,38,38,0.6)",
        }}>
          <span style={{ color: "#F1F1F5" }}>Anime</span>
          <span style={{ background: "linear-gradient(135deg,#FECACA,#DC2626,#F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>FLEX</span>
        </div>
        <div style={{
          marginTop: 10,
          fontSize: 9.5, color: "#FDBA74", letterSpacing: 5, fontWeight: 800,
          textShadow: "0 0 10px rgba(249,115,22,0.7)",
        }}>
          [ SISTEMA · INICIANDO ]
        </div>
      </motion.div>

      {/* Boot terminal */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        style={{
          position: "relative",
          width: "100%", maxWidth: 420,
          background: "rgba(4,3,10,0.85)",
          border: "1px solid rgba(220,38,38,0.45)",
          padding: "14px 16px 12px",
          clipPath: "polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 0 28px rgba(220,38,38,0.25)",
          zIndex: 2,
        }}
      >
        {/* Top accent line */}
        <div style={{
          position: "absolute", top: 0, left: 14, right: 14, height: 1,
          background: "linear-gradient(90deg, transparent, #F97316, transparent)",
          boxShadow: "0 0 8px #F97316",
        }} />

        {bootLines.map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.18, duration: 0.25 }}
            style={{
              fontFamily: mono,
              fontSize: 10.5,
              color: i === bootLines.length - 1 ? "#FDBA74" : "rgba(253,186,116,0.65)",
              letterSpacing: 0.3,
              lineHeight: 1.7,
              textShadow: i === bootLines.length - 1 ? "0 0 8px rgba(249,115,22,0.7)" : "none",
            }}
          >
            {line}
          </motion.div>
        ))}

        {/* Progress bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "#FDBA74", letterSpacing: 1.5, fontWeight: 800 }}>// CARGANDO INTERFACE</span>
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ fontSize: 9, color: "#FECACA", fontWeight: 900 }}
            >
              ▌
            </motion.span>
          </div>
          <div style={{
            position: "relative",
            height: 6,
            background: "rgba(8,4,18,0.95)",
            border: "1px solid rgba(249,115,22,0.3)",
            overflow: "hidden",
            clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
          }}>
            <motion.div
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute", top: 0, bottom: 0, width: "55%",
                background: "linear-gradient(90deg, transparent, #DC2626 30%, #F97316 60%, #FDBA74 80%, transparent)",
                boxShadow: "0 0 12px rgba(249,115,22,0.7)",
              }}
            />
          </div>
        </div>

        {/* Bottom accent line */}
        <div style={{
          position: "absolute", bottom: 0, left: 14, right: 14, height: 1,
          background: "linear-gradient(90deg, transparent, #DC2626, transparent)",
          boxShadow: "0 0 8px #DC2626",
        }} />
      </motion.div>
    </div>
  );
}

function MaintenanceCard({
  message,
  until,
  isAdminPreview,
  onAdminBypass,
}: {
  message: string;
  until: string;
  isAdminPreview?: boolean;
  onAdminBypass?: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const endTime = until ? new Date(until).getTime() : 0;
  const remaining = Number.isFinite(endTime) && endTime > 0 ? endTime - now : 0;
  const countdown = endTime && remaining > 0 ? formatMaintenanceTime(remaining) : "Pronto volveremos";

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at 50% 20%, rgba(220,38,38,0.28), transparent 28%), rgba(0,0,0,0.94)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, flexDirection: "column", gap: 0 }}>
      {isAdminPreview && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "linear-gradient(90deg,#DC2626,#991B1B)",
          padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", fontSize: 13, fontWeight: 800 }}>
            <span style={{ fontSize: 16 }}>👁️</span>
            <span>Vista de administrador — así ven la pantalla todos los usuarios</span>
          </div>
          <button
            onClick={onAdminBypass}
            style={{
              background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 10, padding: "6px 16px", color: "#fff",
              fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            Continuar al sitio →
          </button>
        </div>
      )}
      <div style={{ width: "min(92vw, 540px)", background: "linear-gradient(145deg, rgba(15,15,30,0.98), rgba(4,4,10,0.98))", border: "1px solid rgba(220,38,38,0.32)", borderRadius: 28, padding: isAdminPreview ? "80px 28px 34px" : "34px 28px", textAlign: "center", boxShadow: "0 32px 100px rgba(0,0,0,0.72), 0 0 70px rgba(220,38,38,0.18)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(220,38,38,0.12), transparent 45%, rgba(245,158,11,0.08))", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ width: 76, height: 76, borderRadius: 24, margin: "0 auto 20px", background: "linear-gradient(135deg,#DC2626,#991B1B)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 48px rgba(220,38,38,0.42)", fontSize: 34 }}>
            🛠️
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#FBBF24", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.24)", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 900, marginBottom: 16, textTransform: "uppercase", letterSpacing: 0.8 }}>
            Modo mantenimiento activo
          </div>
          <h1 style={{ color: "#F8FAFC", fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.05, margin: "0 0 12px", fontWeight: 950, letterSpacing: -1.4 }}>
            Estamos en mantenimiento
          </h1>
          <p style={{ color: "rgba(255,255,255,0.66)", fontSize: 15, lineHeight: 1.7, margin: "0 auto 24px", maxWidth: 430, whiteSpace: "pre-wrap" }}>
            {message || "Estamos realizando mantenimiento para mejorar AnimeFlex."}
          </p>
          <div style={{ background: "rgba(0,0,0,0.38)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "18px 16px", marginBottom: 20 }}>
            <div style={{ color: "rgba(255,255,255,0.42)", fontSize: 12, fontWeight: 800, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              Tiempo estimado
            </div>
            <div style={{ color: "#B39DFF", fontSize: "clamp(34px, 10vw, 54px)", fontWeight: 950, letterSpacing: -1.5, fontVariantNumeric: "tabular-nums" }}>
              {countdown}
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: 13, lineHeight: 1.6 }}>
            La navegación está pausada temporalmente. Gracias por tu paciencia.
          </div>
        </div>
      </div>
    </div>
  );
}

function MaintenanceGate({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { config, loading: configLoading } = useLimitsConfig();
  const [adminBypass, setAdminBypass] = useState(false);

  const isAdminOrOwner = user?.role === "owner" || user?.role === "admin";
  const isAdminRoute = location.startsWith("/admin");

  const shouldBlock = config.maintenanceMode && !isAdminOrOwner && !isAdminRoute;
  const adminShouldSeeCard = config.maintenanceMode && isAdminOrOwner && !isAdminRoute && !adminBypass;

  useEffect(() => {
    if (shouldBlock && location !== "/") navigate("/", { replace: true });
  }, [shouldBlock, location, navigate]);

  useEffect(() => {
    if (!config.maintenanceMode) setAdminBypass(false);
  }, [config.maintenanceMode]);

  if (authLoading || configLoading) {
    return <SplashLoader />;
  }

  if (shouldBlock) {
    return (
      <MaintenanceCard
        message={config.maintenanceMessage}
        until={config.maintenanceUntil}
      />
    );
  }

  if (adminShouldSeeCard) {
    return (
      <MaintenanceCard
        message={config.maintenanceMessage}
        until={config.maintenanceUntil}
        isAdminPreview
        onAdminBypass={() => setAdminBypass(true)}
      />
    );
  }

  return (
    <>
      {config.maintenanceMode && isAdminOrOwner && adminBypass && !isAdminRoute && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: "linear-gradient(90deg,#DC2626,#991B1B)",
          borderRadius: 999, padding: "10px 20px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(220,38,38,0.5)",
          fontSize: 13, color: "#fff", fontWeight: 800,
          whiteSpace: "nowrap",
        }}>
          <span>🛠️ Mantenimiento activo</span>
          <button
            onClick={() => setAdminBypass(false)}
            style={{
              background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: 8, padding: "4px 12px", color: "#fff",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            Ver tarjeta
          </button>
        </div>
      )}
      {children}
    </>
  );
}

function Router() {
  return (
    <Suspense fallback={<SplashLoader />}>
      <Switch>
        <Route path="/"><Home /></Route>
        <Route path="/search"><Search /></Route>
        <Route path="/anime/:id"><AnimeDetail /></Route>
        <Route path="/watch"><Player /></Route>
        <Route path="/favorites"><Favorites /></Route>
        <Route path="/history"><History /></Route>
        <Route path="/movies"><Movies /></Route>
        <Route path="/ovas"><OVAs /></Route>
        <Route path="/schedule"><Schedule /></Route>
        <Route path="/watchlist"><WatchList /></Route>
        <Route path="/membership"><Membership /></Route>
        <Route path="/settings"><Settings /></Route>
        <Route path="/perfil"><Profile /></Route>
        <Route path="/profile"><Profile /></Route>
        <Route path="/perfil/:userId"><PublicProfile /></Route>
        <Route path="/profile/:userId"><PublicProfile /></Route>
        <Route path="/admin"><Admin /></Route>
        <Route path="/feed"><Feed /></Route>
        <Route path="/reset-password"><ResetPassword /></Route>
        <Route path="/verify-email"><VerifyEmail /></Route>
        <Route path="/manga"><Manga /></Route>
        <Route path="/noticias"><News /></Route>
        <Route path="/news"><News /></Route>
        <Route path="/manga/:id/leer/:chapterId"><MangaReader /></Route>
        <Route path="/manga/:id"><MangaDetail /></Route>
        <Route path="/legal/dmca"><Dmca /></Route>
        <Route path="/dmca"><Dmca /></Route>
        <Route><NotFound /></Route>
      </Switch>
    </Suspense>
  );
}

function Layout() {
  return (
    <main className="page-enter page-transition" style={{ position: "relative", zIndex: 1, minHeight: "100vh", overflow: "hidden" }}>
      <MaintenanceGate>
        <AnnouncementBanner />
        <Router />
        <ScrollToTop />
        <InstallPrompt />
      </MaintenanceGate>
    </main>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AdScript />
          <NotificationProvider>
            <WatchProgressProvider>
              <WatchListProvider>
                <FavoritesProvider>
                  <HistoryProvider>
                    <AnimatedBackground />
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                      <Layout />
                    </WouterRouter>
                  </HistoryProvider>
                </FavoritesProvider>
              </WatchListProvider>
            </WatchProgressProvider>
          </NotificationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
