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
const NotFoundPage = lazy(() => import("@/pages/not-found"));

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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0, padding: 24, position: "relative", overflow: "hidden", background: "#000000" }}>
      <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(63,46,178,0.18) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "relative", marginBottom: 20 }}>
        <div style={{
          width: 90, height: 90, borderRadius: "50%",
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42,
          boxShadow: "0 0 40px rgba(0,0,0,0.6)",
        }}>🎌</div>
      </div>
      <div style={{ color: "transparent", fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -4, background: "linear-gradient(135deg,#ffffff,#818cf8,#3f2eb2)", WebkitBackgroundClip: "text", backgroundClip: "text", marginBottom: 12 } as any}>404</div>
      <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Página no encontrada</div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, textAlign: "center", maxWidth: 320, lineHeight: 1.6, marginBottom: 24 }}>
        No pudimos encontrar este contenido. Puede que haya sido movido o actualizado.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <a href="/" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#ffffff", borderRadius: 10,
          padding: "10px 22px", color: "#000000", fontSize: 13.5, fontWeight: 700,
          textDecoration: "none", boxShadow: "0 4px 16px rgba(255,255,255,0.15)",
        }}>▶ Volver al inicio</a>
        <a href="/search" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
          padding: "10px 22px", color: "#ffffff", fontSize: 13.5, fontWeight: 600,
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
  const loadingItems = ["Perfil", "Catálogo", "Recomendaciones"];

  return (
    <div className="af-splash" role="status" aria-live="polite" aria-label="Cargando IZIFF ANIME">
      <div className="af-splash__aurora af-splash__aurora--one" />
      <div className="af-splash__aurora af-splash__aurora--two" />
      <div className="af-splash__grain" />

      <motion.div
        className="af-splash__panel"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="af-splash__mark" aria-hidden>
          <motion.span
            className="af-splash__orbit af-splash__orbit--outer"
            animate={{ rotate: 360 }}
            transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            className="af-splash__orbit af-splash__orbit--inner"
            animate={{ rotate: -360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
          />
          <motion.span
            className="af-splash__logo"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            ▶
          </motion.span>
        </div>

        <div className="af-splash__eyebrow"><span /> Tu espacio para descubrir anime</div>
        <h1 className="af-splash__title">IZIFF <span>ANIME</span></h1>
        <p className="af-splash__copy">Preparando una experiencia hecha a tu medida.</p>

        <div className="af-splash__steps" aria-hidden>
          {loadingItems.map((item, index) => (
            <motion.span
              key={item}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + index * 0.12 }}
            >
              <i>✓</i> {item}
            </motion.span>
          ))}
        </div>

        <div className="af-splash__progress" aria-hidden>
          <motion.div
            initial={{ width: "8%" }}
            animate={{ width: ["8%", "62%", "84%", "96%"] }}
            transition={{ duration: 3.2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          />
        </div>
        <div className="af-splash__status">Sincronizando catálogo <b>•••</b></div>
      </motion.div>

      <div className="af-splash__footer">IZIFF ANIME <span>•</span> MIRA <span>•</span> DESCUBRE <span>•</span> CONTINÚA</div>
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

  const mono = "'Space Grotesk', 'SF Mono', ui-monospace, monospace";
  const RED = "#ffffff";
  const RED_GLOW = "rgba(63,46,178,0.55)";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000000",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, flexDirection: "column", position: "relative", overflow: "hidden",
    }}>
      {/* Scanlines overlay */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px)",
        mixBlendMode: "overlay",
      }} />
      {/* Vignette */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
      }} />

      <style>{`
        @keyframes maint-pulse { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: 0.55; transform: scale(1.06);} }
        @keyframes maint-scan { 0% { transform: translateY(-100%);} 100% { transform: translateY(2200%);} }
        @keyframes maint-flicker { 0%,98%,100% { opacity: 1;} 99% { opacity: 0.4;} }
      `}</style>

      {isAdminPreview && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "linear-gradient(90deg, rgba(63,46,178,0.95), rgba(46,33,138,0.95))",
          borderBottom: `1px solid ${RED}`,
          padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
          boxShadow: `0 0 24px ${RED_GLOW}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#fff", fontSize: 12, fontWeight: 900, fontFamily: mono, letterSpacing: 1, textTransform: "uppercase" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", boxShadow: "0 0 10px #fff", animation: "maint-pulse 1.4s ease-in-out infinite" }} />
            <span>[ ADMIN_VIEW ] vista pública del sistema</span>
          </div>
          <button
            onClick={onAdminBypass}
            style={{
              background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.55)",
              borderRadius: 6, padding: "6px 14px", color: "#fff",
              fontSize: 12, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap",
              fontFamily: mono, letterSpacing: 1, textTransform: "uppercase",
            }}
          >
            CONTINUAR ›
          </button>
        </div>
      )}

      {/* Top status bar */}
      <div style={{
        position: "relative", zIndex: 2,
        marginTop: isAdminPreview ? 60 : 0,
        marginBottom: 18,
        display: "flex", alignItems: "center", gap: 10,
        color: RED, fontFamily: mono, fontSize: 11, fontWeight: 800,
        letterSpacing: 2, textTransform: "uppercase",
        animation: "maint-flicker 4s linear infinite",
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: RED, boxShadow: `0 0 12px ${RED}, 0 0 24px ${RED_GLOW}`,
          animation: "maint-pulse 1.2s ease-in-out infinite",
        }} />
        <span>[ ALERTA DEL SISTEMA ]</span>
        <span style={{ opacity: 0.4 }}>///</span>
        <span style={{ opacity: 0.7 }}>NIVEL: CRÍTICO</span>
      </div>

      {/* Monolith panel */}
      <div style={{
        position: "relative", zIndex: 2,
        width: "min(94vw, 580px)",
        background: "linear-gradient(180deg, rgba(8,8,16,0.96), rgba(2,2,8,0.98))",
        border: `1px solid ${RED}`,
        boxShadow: `0 0 0 1px rgba(63,46,178,0.12) inset, 0 0 60px rgba(63,46,178,0.25), 0 40px 120px rgba(0,0,0,0.75)`,
        padding: "30px 28px 28px",
        textAlign: "left",
        overflow: "hidden",
      }}>
        {/* Inner scanline beam */}
        <div aria-hidden style={{
          position: "absolute", left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${RED}, transparent)`,
          boxShadow: `0 0 10px ${RED}`,
          animation: "maint-scan 4s linear infinite",
          opacity: 0.7,
        }} />

        {/* Corner ticks */}
        {[
          { top: 6, left: 6, borderTop: `2px solid ${RED}`, borderLeft: `2px solid ${RED}` },
          { top: 6, right: 6, borderTop: `2px solid ${RED}`, borderRight: `2px solid ${RED}` },
          { bottom: 6, left: 6, borderBottom: `2px solid ${RED}`, borderLeft: `2px solid ${RED}` },
          { bottom: 6, right: 6, borderBottom: `2px solid ${RED}`, borderRight: `2px solid ${RED}` },
        ].map((s, i) => (
          <div key={i} aria-hidden style={{ position: "absolute", width: 14, height: 14, ...s }} />
        ))}

        {/* Header line */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingBottom: 12, marginBottom: 22,
          borderBottom: "1px solid rgba(63,46,178,0.22)",
          fontFamily: mono, fontSize: 10, fontWeight: 800,
          color: "rgba(255,255,255,0.45)", letterSpacing: 1.4, textTransform: "uppercase",
        }}>
          <span>SYS://iziff.core</span>
          <span style={{ color: "#ffffff" }}>● MANTENIMIENTO</span>
        </div>

        {/* Hex warning icon */}
        <div style={{
          width: 84, height: 84, margin: "0 auto 22px",
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg viewBox="0 0 100 100" width={84} height={84} style={{
            position: "absolute", inset: 0,
            filter: `drop-shadow(0 0 12px ${RED_GLOW})`,
            animation: "maint-pulse 2.4s ease-in-out infinite",
          }}>
            <polygon
              points="50,4 92,27 92,73 50,96 8,73 8,27"
              fill="rgba(63,46,178,0.15)"
              stroke="#ffffff"
              strokeWidth="2"
            />
            <polygon
              points="50,18 78,34 78,66 50,82 22,66 22,34"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1"
            />
          </svg>
          <div style={{
            position: "relative", zIndex: 1,
            color: "#fff", fontSize: 38, fontWeight: 950, lineHeight: 1,
            fontFamily: mono,
            textShadow: `0 0 14px #ffffff, 0 0 28px ${RED_GLOW}`,
          }}>!</div>
        </div>

        {/* Title */}
        <h1 style={{
          color: "#F8FAFC", textAlign: "center",
          fontSize: "clamp(26px, 5vw, 38px)", lineHeight: 1.1,
          margin: "0 0 10px", fontWeight: 950, letterSpacing: -0.8,
          textShadow: `0 0 30px ${RED_GLOW}`,
        }}>
          SISTEMA EN MANTENIMIENTO
        </h1>
        <div style={{
          textAlign: "center",
          color: "#a1a1aa", fontFamily: mono, fontSize: 11, fontWeight: 800,
          letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 22,
        }}>
          /// acceso temporalmente restringido ///
        </div>

        {/* Message */}
        <p style={{
          color: "rgba(255,255,255,0.7)", fontSize: 14.5, lineHeight: 1.65,
          margin: "0 auto 22px", maxWidth: 460,
          textAlign: "center", whiteSpace: "pre-wrap",
        }}>
          {message || "Estamos realizando mantenimiento para mejorar IZIFF ANIME."}
        </p>

        {/* Countdown panel */}
        <div style={{
          background: "#0a0a0a",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 14,
          padding: "16px 18px", marginBottom: 18,
          position: "relative",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 8,
          }}>
            <span style={{
              color: "rgba(255,255,255,0.5)", fontFamily: mono,
              fontSize: 10, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase",
            }}>
              [ TIEMPO RESTANTE ]
            </span>
            <span style={{
              color: "#ffffff", fontFamily: mono,
              fontSize: 10, fontWeight: 800, letterSpacing: 1.6, textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#3f2eb2", boxShadow: "0 0 8px #818cf8",
                animation: "maint-pulse 1s ease-in-out infinite",
              }} />
              EN VIVO
            </span>
          </div>
          <div style={{
            color: "#F8FAFC",
            fontSize: "clamp(36px, 11vw, 60px)", fontWeight: 950,
            fontFamily: mono, letterSpacing: -1,
            fontVariantNumeric: "tabular-nums",
            textShadow: `0 0 24px ${RED_GLOW}`,
            textAlign: "center", lineHeight: 1,
          }}>
            {countdown}
          </div>
        </div>

        {/* Footer status */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontFamily: mono, fontSize: 10, fontWeight: 700,
          color: "rgba(255,255,255,0.4)", letterSpacing: 1.2, textTransform: "uppercase",
        }}>
          <span>› El sistema se restablecerá automáticamente</span>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>v0.10.45</span>
        </div>
      </div>

      {/* Bottom signature */}
      <div style={{
        position: "relative", zIndex: 2,
        marginTop: 18,
        color: "rgba(255,255,255,0.3)", fontFamily: mono, fontSize: 10,
        letterSpacing: 2, textTransform: "uppercase",
      }}>
        IZIFF ANIME · ECOSYSTEM
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
          zIndex: 9999, background: "linear-gradient(90deg,#3f2eb2,#6366f1)",
          borderRadius: 999, padding: "10px 20px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(63,46,178,0.5)",
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
        <Route><NotFoundPage /></Route>
      </Switch>
    </Suspense>
  );
}

function Layout() {
  return (
    <main className="page-enter page-transition" style={{ position: "relative", minHeight: "100vh", overflowX: "clip" }}>
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
