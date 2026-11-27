import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Hls from "hls.js";
import {
  ArrowLeft, SkipForward, AlertCircle, Loader2, Play, Pause, X,
  Users, Captions, ChevronLeft, ChevronRight, List, Maximize2, Minimize2,
  Share2, Copy, Check as CheckIcon, HelpCircle, FastForward, Rewind,
  Download, Settings, Crown, Lock, RotateCcw, RotateCw,
} from "lucide-react";
import {
  consumet,
  proxyStreamUrl,
  downloadProxyUrl,
  type StreamingSource,
} from "@/lib/consumet";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useHistory } from "@/context/HistoryContext";
import { WatchTogetherButton, WatchTogetherDrawer } from "@/components/WatchTogether";
import { useRoomPlayerSync } from "@/hooks/useRoomPlayerSync";
import { useAuth } from "@/context/AuthContext";
import { CornerBrackets, SystemTag, ScanLines } from "@/components/SystemUI";
import { apiClient } from "@/lib/apiClient";
import { useLimitsConfig } from "@/hooks/use-limits-config";
import { useSkipTimes } from "@/lib/aniskip";
import { usePageMeta } from "@/lib/usePageMeta";
import {
  canWatchEpisodeSync,
  registerEpisodeView,
  REGISTER_THRESHOLD_SECONDS,
} from "@/lib/accessControl";

// Función auxiliar para obtener el acceso diario (extraída de accessControl.ts)
function getAccess() {
  const STORAGE_KEY = "af_daily_access";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { count: 0, date: new Date().toISOString().slice(0, 10), watchedIds: [] };
    const parsed = JSON.parse(raw);
    // Reinicio automático cada nuevo día
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) {
      return { count: 0, date: today, watchedIds: [] };
    }
    return { ...parsed, watchedIds: parsed.watchedIds ?? [] };
  } catch {
    return { count: 0, date: new Date().toISOString().slice(0, 10), watchedIds: [] };
  }
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function parseResolution(src: StreamingSource) {
  const m = (src.quality ?? "").match(/(\d{3,4})p/i);
  if (m) return m[1] + "p";
  const m2 = (src.quality ?? "").match(/\b(\d{3,4})\b/);
  if (m2) return m2[1] + "p";
  return (src.quality ?? "").trim() || "Auto";
}
function parseLatLabel(src: StreamingSource & { server?: string }, index: number): string {
  if (src.server && src.server.trim() && !/^servidor$/i.test(src.server.trim())) {
    const name = src.server.trim().replace(/[-_]/g, " ");
    const q = (src.quality ?? "").match(/(\d{3,4})p/i)?.[1];
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}${q ? ` · ${q}p` : ""}`;
  }
  const m = (src.quality ?? "").match(/(\d{3,4})p/i);
  if (m) return m[1] + "p";
  const m2 = (src.quality ?? "").match(/\b(\d{3,4})\b/);
  if (m2) return m2[1] + "p";
  if ((src as any).isEmbed) return `Reproductor ${index + 1}`;
  return `Servidor ${index + 1}`;
}

/* ── VTT PARSER ── */
interface VttCue { start: number; end: number; text: string; }

function parseVtt(vttText: string): VttCue[] {
  const cues: VttCue[] = [];
  const lines = vttText.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  // Matches both HH:MM:SS.mmm and MM:SS.mmm formats
  const TIME_RE = /^((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3})/;
  const parseTime = (s: string) => {
    const parts = s.replace(",", ".").split(":");
    if (parts.length === 3) return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  };
  while (i < lines.length) {
    const line = lines[i].trim();
    const timeMatch = line.match(TIME_RE);
    if (timeMatch) {
      const start = parseTime(timeMatch[1]);
      const end = parseTime(timeMatch[2]);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim().replace(/<[^>]+>/g, ""));
        i++;
      }
      if (textLines.length > 0) cues.push({ start, end, text: textLines.join("\n") });
    } else { i++; }
  }
  return cues;
}

/* ── CUSTOM SUBTITLE OVERLAY ── */
function SubtitleOverlay({
  text, subtitleUrl, currentTime, isFullscreen,
}: {
  text?: string | null;
  subtitleUrl?: string | null;
  currentTime?: number;
  isFullscreen?: boolean;
}) {
  const [cues, setCues] = useState<VttCue[]>([]);
  const loadedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!subtitleUrl || subtitleUrl === loadedUrl.current) return;
    loadedUrl.current = subtitleUrl;
    setCues([]);
    fetch(subtitleUrl)
      .then(r => { if (!r.ok) throw new Error("bad"); return r.text(); })
      .then(t => setCues(parseVtt(t)))
      .catch(() => setCues([]));
  }, [subtitleUrl]);

  const display =
    text != null ? text :
    (subtitleUrl && currentTime != null
      ? (cues.find(c => currentTime >= c.start && currentTime <= c.end)?.text ?? null)
      : null);

  if (!display) return null;
  // In fullscreen (native or Plyr CSS-fallback), use fixed positioning with z-index above
  // Plyr's own fullscreen layer (z-index: 10000000)
  return (
    <div style={{
      position: isFullscreen ? "fixed" : "absolute",
      bottom: isFullscreen ? "13vh" : "15%",
      left: 0, right: 0,
      zIndex: isFullscreen ? 10000001 : 200,
      display: "flex", justifyContent: "center", pointerEvents: "none", padding: "0 24px",
    }}>
      <div style={{
        background: "rgba(0,0,0,0.82)", borderRadius: 6, padding: "5px 12px",
        color: "#fff", fontSize: "clamp(13px, 2.2vw, 18px)", fontWeight: 500,
        lineHeight: 1.5, textAlign: "center", maxWidth: 700, wordBreak: "break-word",
        textShadow: "0 1px 4px rgba(0,0,0,0.9)", letterSpacing: 0.2,
        whiteSpace: "pre-line",
      }}>
        {display}
      </div>
      {/* Footer gradient — prevents abrupt end */}
      <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)", margin: "0 16px 20px" }} />
    </div>
  );
}

/* ── AUTO-NEXT ── */
function AutoNextOverlay({ nextNum, onSkip, onCancel }: { nextNum: string; onSkip: () => void; onCancel: () => void }) {
  const [secs, setSecs] = useState(5);
  useEffect(() => {
    if (secs <= 0) { onSkip(); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onSkip]);
  return (
    <div style={{ position: "absolute", bottom: 80, right: 16, zIndex: 50, background: "rgba(10,10,10,0.95)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 16, padding: "16px 20px", minWidth: 220, backdropFilter: "blur(8px)" }}>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Siguiente episodio en {secs}s</div>
      <div style={{ color: "#f4f4f5", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Episodio {nextNum}</div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#3f2eb2", borderRadius: 2, width: `${(secs / 10) * 100}%`, transition: "width 1s linear" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSkip} style={{ flex: 1, background: "#ffffff", border: "none", borderRadius: 10, padding: "9px 0", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <Play size={12} fill="#000" color="#000" /> Ver ahora
        </button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── PLAYER LOADING SCREEN ─────────────────────────────────────────────
 * Cinematic loading screen shown while the backend probes streaming
 * sources. Uses the anime cover as a blurred backdrop, displays anime
 * + episode info, and rotates through reassuring progress messages so
 * the wait feels intentional instead of broken.
 */
function PlayerLoadingScreen({
  animeImage,
  animeTitle,
  episodeNum,
}: {
  animeImage?: string;
  animeTitle?: string;
  episodeNum?: string;
}) {
  const messages = [
    "Conectando con servidores...",
    "Buscando la mejor fuente...",
    "Verificando calidad disponible...",
    "Casi listo, preparando reproductor...",
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 1800);
    const e = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => { clearInterval(t); clearInterval(e); };
  }, []); // eslint-disable-line

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Blurred backdrop using the anime cover */}
      {animeImage && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -40,
            backgroundImage: `url(${animeImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(28px) saturate(1.15) brightness(0.55)",
            transform: "scale(1.15)",
            opacity: 0.55,
          }}
        />
      )}
      {/* Dark overlay */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 100%)",
        }}
      />
      {/* Subtle scan lines */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "overlay",
          opacity: 0.6,
        }}
      />

      {/* Center content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
          gap: 18,
          textAlign: "center",
        }}
      >
        {/* Animated dual-ring loader with pulse */}
        <div style={{ position: "relative", width: 76, height: 76 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.15)",
              borderTopColor: "#ffffff",
              borderRightColor: "rgba(255,255,255,0.6)",
            }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 2.6, ease: "linear" }}
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: "50%",
              border: "2px solid rgba(63,46,178,0.3)",
              borderBottomColor: "#6366f1",
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: 22,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #3f2eb2 0%, #18181b 60%, transparent 100%)",
              boxShadow: "0 0 24px rgba(63,46,178,0.6)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              pointerEvents: "none",
            }}
          >
            <Play size={18} fill="#fff" />
          </div>
        </div>

        {/* Anime / episode label */}
        {(animeTitle || episodeNum) && (
          <div style={{ maxWidth: 480 }}>
            {episodeNum && (
              <div
                style={{
                  display: "inline-block",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: "#a1a1aa",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "3px 10px",
                  borderRadius: 999,
                  marginBottom: 8,
                  fontFamily: "'Space Grotesk', ui-monospace, monospace",
                }}
              >
                EP · {episodeNum}
              </div>
            )}
            {animeTitle && (
              <div
                style={{
                  color: "#f4f4f5",
                  fontSize: 16,
                  fontWeight: 800,
                  lineHeight: 1.3,
                  textShadow: "0 2px 12px rgba(0,0,0,0.7)",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                } as React.CSSProperties}
              >
                {animeTitle}
              </div>
            )}
          </div>
        )}

        {/* Rotating status message */}
        <div style={{ minHeight: 22, position: "relative", width: "100%", maxWidth: 360 }}>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              style={{
                color: "rgba(255,255,255,0.72)",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.2,
                margin: 0,
              }}
            >
              {messages[msgIdx]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Indeterminate progress bar */}
        <div
          style={{
            width: "min(280px, 80%)",
            height: 3,
            borderRadius: 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "50%",
              height: "100%",
              background:
                "linear-gradient(90deg, transparent, #3f2eb2 30%, #ffffff 50%, #3f2eb2 70%, transparent)",
              boxShadow: "0 0 12px rgba(63,46,178,0.6)",
            }}
          />
        </div>

        {/* Helpful hint after a few seconds */}
        {elapsed >= 6 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 11,
              fontWeight: 500,
              maxWidth: 320,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Estamos buscando la fuente más rápida disponible. Si tarda demasiado,
            podrás cambiar de servidor desde el panel inferior.
          </motion.p>
        )}
      </div>
    </div>
  );
}

/* ── PLYR PLAYER ── */
export interface HlsSubTrack { id: number; lang: string; name: string; }

interface PlyrControls {
  seekTo: (t: number) => void;
  getVolume: () => number;
  setVolume: (v: number) => void;
}

interface PlyrPlayerProps {
  m3u8Url: string;
  playbackRate: number;
  onPlaybackRateChange?: (rate: number) => void;
  startAt?: number;
  fullscreenContainer?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onSubtitleTracks?: (tracks: HlsSubTrack[]) => void;
  activeHlsSubId?: number;
  onSubtitleCue?: (text: string | null) => void;
  controlsRef?: React.MutableRefObject<PlyrControls | null>;
  onPlaybackError?: () => void;
  onFullscreenChange?: (isFs: boolean) => void;
  /** Hay otros servidores a los que cambiar si este va lento */
  hasAlternatives?: boolean;
}

/* ── Button style reused across player controls ── */
const _playerBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  padding: 8, display: "flex", alignItems: "center", justifyContent: "center",
  lineHeight: 0, color: "#fff", flexShrink: 0,
};

function PlyrPlayer({ m3u8Url, playbackRate, onPlaybackRateChange, startAt, fullscreenContainer, onTimeUpdate, onEnded, onSubtitleTracks, activeHlsSubId, onSubtitleCue, controlsRef, onPlaybackError, onFullscreenChange, hasAlternatives }: PlyrPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAltRef = useRef(!!hasAlternatives);
  hasAltRef.current = !!hasAlternatives;
  const hlsRef = useRef<Hls | null>(null);
  const startAtRef = useRef(startAt);
  const seekRestoredRef = useRef(false);
  const activeHlsSubIdRef = useRef(activeHlsSubId);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const onSubtitleTracksRef = useRef(onSubtitleTracks);
  const onSubtitleCueRef = useRef(onSubtitleCue);
  const onPlaybackErrorRef = useRef(onPlaybackError);
  const onFullscreenChangeRef = useRef(onFullscreenChange);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSec, setCurrentSec] = useState(0);
  const [dur, setDur] = useState(0);
  const [bufferedFrac, setBufferedFrac] = useState(0);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controlsVis, setControlsVis] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [levels, setLevels] = useState<{ index: number; height: number; bitrate: number }[]>([]);
  const [qualityPref, setQualityPref] = useState<number>(() => { try { return Number(localStorage.getItem("iz_quality_height")) || -1; } catch { return -1; } });
  const [activeHeight, setActiveHeight] = useState<number>(0);
  const pointerTypeRef = useRef<string>("mouse");
  const tapTimerRef = useRef<number | null>(null);
  const wasPlayingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const durRef = useRef(0);

  useEffect(() => { startAtRef.current = startAt; }, [startAt]);
  useEffect(() => { activeHlsSubIdRef.current = activeHlsSubId; }, [activeHlsSubId]);
  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { onSubtitleTracksRef.current = onSubtitleTracks; }, [onSubtitleTracks]);
  useEffect(() => { onSubtitleCueRef.current = onSubtitleCue; }, [onSubtitleCue]);
  useEffect(() => { onPlaybackErrorRef.current = onPlaybackError; }, [onPlaybackError]);
  useEffect(() => { onFullscreenChangeRef.current = onFullscreenChange; }, [onFullscreenChange]);

  // HLS subtitle track switch
  useEffect(() => {
    if (hlsRef.current) hlsRef.current.subtitleTrack = activeHlsSubId ?? -1;
  }, [activeHlsSubId]);

  // Playback rate
  useEffect(() => {
    if (videoRef.current && playbackRate) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // Native fullscreen detection — no Plyr CSS fallback, fullscreenchange always fires
  useEffect(() => {
    const isMobileDevice = () =>
      typeof navigator !== "undefined" &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 900px)").matches));

    const getFsContainer = (): HTMLElement | null =>
      fullscreenContainer
        ? (document.querySelector(fullscreenContainer) as HTMLElement | null)
        : videoRef.current;

    const lockLandscape = async () => {
      try {
        const orient: any = (screen as any).orientation;
        if (orient && typeof orient.lock === "function") {
          await orient.lock("landscape");
        }
      } catch {
        // Browser may reject if not allowed (e.g. iOS Safari, system rotation lock on Firefox)
        // — fallback CSS rotation will handle it below.
      }
    };

    const unlockOrientation = () => {
      try {
        const orient: any = (screen as any).orientation;
        if (orient && typeof orient.unlock === "function") {
          orient.unlock();
        }
      } catch {
        // ignore
      }
    };

    const applyRotateFallbackIfNeeded = () => {
      const el = getFsContainer();
      if (!el) return;
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!fs || !isMobileDevice()) {
        el.classList.remove("plyr-fs-rotate");
        return;
      }
      // If the screen is still portrait after fullscreen + orientation-lock attempt,
      // rotate the player 90° via CSS so the user gets a landscape view anyway
      // (works even when the device's auto-rotate is OFF).
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (h > w) {
        el.classList.add("plyr-fs-rotate");
      } else {
        el.classList.remove("plyr-fs-rotate");
      }
    };

    const onFsChange = () => {
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFs(fs);
      onFullscreenChangeRef.current?.(fs);
      if (isMobileDevice()) {
        if (fs) {
          lockLandscape().finally(() => {
            // Re-check after lock attempt resolves; the orientationchange/resize
            // listeners below will also keep this in sync.
            setTimeout(applyRotateFallbackIfNeeded, 250);
            setTimeout(applyRotateFallbackIfNeeded, 700);
          });
        } else {
          unlockOrientation();
          const el = getFsContainer();
          if (el) el.classList.remove("plyr-fs-rotate");
        }
      }
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    window.addEventListener("resize", applyRotateFallbackIfNeeded);
    window.addEventListener("orientationchange", applyRotateFallbackIfNeeded);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      window.removeEventListener("resize", applyRotateFallbackIfNeeded);
      window.removeEventListener("orientationchange", applyRotateFallbackIfNeeded);
      if (isMobileDevice()) unlockOrientation();
      const el = getFsContainer();
      if (el) el.classList.remove("plyr-fs-rotate");
    };
  }, [fullscreenContainer]);

  const enterFs = useCallback(async () => {
    const el = fullscreenContainer
      ? (document.querySelector(fullscreenContainer) as HTMLElement | null)
      : videoRef.current;
    if (!el) return;

    // Chain requestFullscreen + screen.orientation.lock inside the SAME user gesture.
    // This is what lets Chrome/Android force landscape even when the system's
    // auto-rotate (rotation lock) is OFF.
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if ((el as any).webkitRequestFullscreen) {
        await (el as any).webkitRequestFullscreen();
      }
    } catch {
      return;
    }

    const isMobile =
      typeof navigator !== "undefined" &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 900px)").matches));
    if (!isMobile) return;

    try {
      const orient: any = (screen as any).orientation;
      if (orient && typeof orient.lock === "function") {
        await orient.lock("landscape");
      }
    } catch {
      // Lock denied (system rotation lock, iOS, Firefox) — CSS fallback in
      // the fullscreenchange handler will rotate the container instead.
    }
  }, [fullscreenContainer]);

  const exitFs = useCallback(() => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
  }, []);

  const showControls = useCallback(() => {
    setControlsVis(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setPlaying(p => {
        if (p) {
          setControlsVis(false);
          setSettingsOpen(false);
        }
        return p;
      });
    }, 3000);
  }, []);

  // Keep durRef in sync so drag handlers can read duration without stale closure
  useEffect(() => { durRef.current = dur; }, [dur]);

  // Global mouse listeners for progress bar drag (mousedown starts in the bar, move/up anywhere)
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !progressBarRef.current) return;
      const d = durRef.current;
      if (!d) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      if (videoRef.current) videoRef.current.currentTime = pct * d;
    };
    const onMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      // Resume playback if the video was playing before we started dragging
      if (wasPlayingRef.current && videoRef.current?.paused) {
        videoRef.current.play().catch(() => {});
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Expose controls to parent (keyboard shortcuts, external seek, volume)
  useEffect(() => {
    if (controlsRef) {
      controlsRef.current = {
        seekTo: (t: number) => { if (videoRef.current) videoRef.current.currentTime = t; },
        getVolume: () => videoRef.current?.volume ?? 1,
        setVolume: (v: number) => { if (videoRef.current) { videoRef.current.volume = Math.max(0, Math.min(1, v)); } },
      };
    }
  });

  // Main HLS setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true); setError(null); setCurrentSec(0); setDur(0);
    setBufferedFrac(0); setPlaying(false); setLevels([]); setActiveHeight(0);
    seekRestoredRef.current = false;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const trySeek = () => {
      if (seekRestoredRef.current) return;
      const t = startAtRef.current;
      if (!t || t <= 5) { seekRestoredRef.current = true; return; }
      if (video.duration && isFinite(video.duration) && t < video.duration - 5) {
        video.currentTime = t; seekRestoredRef.current = true;
      }
    };

    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    let errSent = false;
    const notifyErr = () => { if (errSent) return; errSent = true; onPlaybackErrorRef.current?.(); };

    const onTimeUpd = () => {
      if (video.duration > 0) {
        if (!seekRestoredRef.current) trySeek();
        const ct = video.currentTime; const d = video.duration;
        setCurrentSec(ct); setDur(d);
        onTimeUpdateRef.current?.(ct, d);
        // Poll subtitle cues — far more reliable on Android than cuechange events
        let cueText: string | null = null;
        if ((activeHlsSubIdRef.current ?? -1) >= 0) {
          for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            if (track.mode === "disabled") track.mode = "hidden";
            if (track.activeCues && track.activeCues.length > 0) {
              cueText = Array.from(track.activeCues)
                .map(c => (c as VTTCue).text?.replace(/<[^>]+>/g, "") ?? "")
                .filter(Boolean).join("\n");
              if (cueText) break;
            }
          }
        }
        onSubtitleCueRef.current?.(cueText);
      }
    };

    const onPlay = () => { setPlaying(true); setBuffering(false); wasPlayingRef.current = true; };
    const onPause = () => {
      // Don't update state if the pause was caused by dragging the seek bar
      if (!isDraggingRef.current) { setPlaying(false); setControlsVis(true); wasPlayingRef.current = false; }
    };
    const onEndEv = () => { onEndedRef.current?.(); setPlaying(false); setControlsVis(true); };
    const onVolCh = () => { setVol(video.volume); setMuted(video.muted); };
    const onProg = () => {
      if (video.buffered.length && video.duration)
        setBufferedFrac(video.buffered.end(video.buffered.length - 1) / video.duration);
    };
    const onNativeErr = () => { setError("Error al cargar fuente. Probando otra..."); setLoading(false); notifyErr(); };
    const onMeta = () => trySeek();

    // Seeking/buffering handlers — keep the UI responsive during HLS segment loads
    const onSeekingEv = () => { wasPlayingRef.current = !video.paused; setBuffering(true); };
    const onSeekedEv = () => {
      setBuffering(false);
      // If the video was playing before we sought, resume it
      if (wasPlayingRef.current && video.paused) video.play().catch(() => {});
    };
    // Cambio automático de servidor lento (como la app): si la fuente se traba
    // muchas veces o queda cargando demasiado, se pasa a la siguiente sin perder el minuto.
    let waitStart = 0;
    let longStalls: number[] = [];
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;
    const onWaiting = () => {
      setBuffering(true);
      if (video.seeking || video.currentTime < 1) return;
      waitStart = Date.now();
      if (stuckTimer) clearTimeout(stuckTimer);
      stuckTimer = setTimeout(() => {
        if (hasAltRef.current && !video.paused && video.readyState < 3) { setError("Servidor lento. Cambiando de servidor..."); notifyErr(); }
      }, 25_000);
    };
    const onPlayingEv = () => {
      setBuffering(false); setPlaying(true);
      if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; }
      if (waitStart) {
        const waited = Date.now() - waitStart;
        waitStart = 0;
        const now = Date.now();
        if (waited > 6_000) longStalls = [...longStalls.filter((t) => now - t < 120_000), now];
        if (longStalls.length >= 3 && hasAltRef.current) { longStalls = []; setError("Servidor lento. Cambiando de servidor..."); notifyErr(); }
      }
    };

    if (Hls.isSupported()) {
      // Igual que la app (v0.10.45): precarga de hasta 2 minutos para que no se
      // detenga con internet lento, y arranque en calidad adaptada a la red.
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 120,
        maxMaxBufferLength: 300,
        maxBufferSize: 384 * 1024 * 1024,
        backBufferLength: 30,
        startLevel: -1,
        abrEwmaDefaultEstimate: 1_500_000,
        abrBandWidthFactor: 0.8,
        abrBandWidthUpFactor: 0.6,
        capLevelToPlayerSize: true,
        startFragPrefetch: true,
        nudgeMaxRetry: 8,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
        maxBufferHole: 2,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 4,
        levelLoadingRetryDelay: 1000,
      });
      hlsRef.current = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        const tracks = (data.subtitleTracks ?? []).map(t => ({ id: t.id, lang: t.lang ?? t.name ?? "", name: t.name ?? t.lang ?? "" }));
        if (tracks.length > 0) onSubtitleTracksRef.current?.(tracks);
      });
      loadTimeout = setTimeout(() => { setError("Tiempo agotado. Probando otra fuente..."); setLoading(false); notifyErr(); }, 20000);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
        const lv = (data.levels ?? [])
          .map((l, index) => ({ index, height: l.height || 0, bitrate: l.bitrate || 0 }))
          .filter((l) => l.height > 0);
        // Una entrada por resolución (la de mayor bitrate)
        const byHeight = new Map<number, { index: number; height: number; bitrate: number }>();
        for (const l of lv) { const prev = byHeight.get(l.height); if (!prev || l.bitrate > prev.bitrate) byHeight.set(l.height, l); }
        const uniq = Array.from(byHeight.values()).sort((a, b) => b.height - a.height);
        setLevels(uniq);
        // Aplicar la calidad preferida guardada (la más cercana por debajo)
        let pref = -1;
        try { pref = Number(localStorage.getItem("iz_quality_height")) || -1; } catch { /* */ }
        if (pref > 0 && uniq.length > 1) {
          const target = uniq.find((l) => l.height <= pref) ?? uniq[uniq.length - 1];
          hls.currentLevel = target.index;
        }
        setLoading(false); video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        const h = hls.levels?.[data.level]?.height;
        if (h) setActiveHeight(h);
      });
      let netErr = 0, mediaErr = 0;
      hls.on(Hls.Events.FRAG_LOADED, () => { netErr = 0; });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          netErr++;
          if (netErr > 4) { if (loadTimeout) clearTimeout(loadTimeout); setError("Error de red. Probando otra..."); setLoading(false); notifyErr(); }
          else setTimeout(() => hls.startLoad(), 1500);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          mediaErr++;
          if (mediaErr > 5) { if (loadTimeout) clearTimeout(loadTimeout); setError("Error de medios. Probando otra..."); setLoading(false); notifyErr(); }
          else { const st = video.currentTime; hls.recoverMediaError(); setTimeout(() => { if (st > 5) video.currentTime = st; }, 300); }
        } else { if (loadTimeout) clearTimeout(loadTimeout); setError("Error en esta fuente. Probando otra..."); setLoading(false); notifyErr(); }
      });

      // Detección de video trabado: si lleva 8s sin avanzar y no está pausado, recuperar
      let lastStallTime = 0;
      let stallCount = 0;
      const stallInterval = setInterval(() => {
        if (!video || video.paused || video.ended || video.seeking || video.readyState < 3) {
          stallCount = 0;
          lastStallTime = video?.currentTime ?? 0;
          return;
        }
        if (video.currentTime === lastStallTime) {
          stallCount++;
          if (stallCount >= 2) {
            stallCount = 0;
            const ct = video.currentTime;
            hls.startLoad();
            setTimeout(() => {
              if (video && Math.abs(video.currentTime - ct) < 1) {
                video.currentTime = ct + 0.1;
              }
            }, 600);
          }
        } else {
          stallCount = 0;
          lastStallTime = video.currentTime;
        }
      }, 4000);

      const origReturn_HLS = () => {
        clearInterval(stallInterval);
        if (stuckTimer) clearTimeout(stuckTimer);
      };
      video.addEventListener("loadedmetadata", onMeta);
      video.addEventListener("timeupdate", onTimeUpd);
      video.addEventListener("play", onPlay);
      video.addEventListener("pause", onPause);
      video.addEventListener("ended", onEndEv);
      video.addEventListener("volumechange", onVolCh);
      video.addEventListener("progress", onProg);
      video.addEventListener("error", onNativeErr);
      video.addEventListener("seeking", onSeekingEv);
      video.addEventListener("seeked", onSeekedEv);
      video.addEventListener("waiting", onWaiting);
      video.addEventListener("playing", onPlayingEv);
      return () => {
        origReturn_HLS();
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("timeupdate", onTimeUpd);
        video.removeEventListener("play", onPlay);
        video.removeEventListener("pause", onPause);
        video.removeEventListener("ended", onEndEv);
        video.removeEventListener("volumechange", onVolCh);
        video.removeEventListener("progress", onProg);
        video.removeEventListener("error", onNativeErr);
        video.removeEventListener("seeking", onSeekingEv);
        video.removeEventListener("seeked", onSeekedEv);
        video.removeEventListener("waiting", onWaiting);
        video.removeEventListener("playing", onPlayingEv);
        if (loadTimeout) clearTimeout(loadTimeout);
        if (controlsRef) controlsRef.current = null;
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = m3u8Url;
      video.addEventListener("loadedmetadata", () => { setLoading(false); video.play().catch(() => {}); }, { once: true });
    } else { setError("Tu navegador no soporta HLS."); setLoading(false); notifyErr(); }

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("timeupdate", onTimeUpd);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEndEv);
    video.addEventListener("volumechange", onVolCh);
    video.addEventListener("progress", onProg);
    video.addEventListener("error", onNativeErr);
    video.addEventListener("seeking", onSeekingEv);
    video.addEventListener("seeked", onSeekedEv);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlayingEv);
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTimeUpd);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEndEv);
      video.removeEventListener("volumechange", onVolCh);
      video.removeEventListener("progress", onProg);
      video.removeEventListener("error", onNativeErr);
      video.removeEventListener("seeking", onSeekingEv);
      video.removeEventListener("seeked", onSeekedEv);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlayingEv);
      if (loadTimeout) clearTimeout(loadTimeout);
      if (controlsRef) controlsRef.current = null;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [m3u8Url]);

  const changeQuality = (height: number) => {
    const hls = hlsRef.current;
    setQualityPref(height);
    try { if (height > 0) localStorage.setItem("iz_quality_height", String(height)); else localStorage.removeItem("iz_quality_height"); } catch { /* */ }
    if (!hls) return;
    if (height <= 0) { hls.currentLevel = -1; return; }
    const lv = levels.find((l) => l.height === height);
    if (lv) hls.currentLevel = lv.index;
  };

  const seekBy = (secs: number) => {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 0.5, v.currentTime + secs));
    showControls();
  };

  const fmt = (t: number) => {
    if (!isFinite(t) || t < 0) t = 0;
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = Math.floor(t % 60).toString().padStart(2, "0");
    return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };

  const seekFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (videoRef.current && dur) {
      wasPlayingRef.current = !videoRef.current.paused;
      videoRef.current.currentTime = pct * dur;
    }
  };

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) videoRef.current.muted = !videoRef.current.muted;
  };

  return (
    <div
      className="relative w-full h-full bg-black select-none"
      style={{ cursor: controlsVis ? "default" : "none" }}
      onMouseMove={showControls}
      onPointerDown={(e) => { pointerTypeRef.current = e.pointerType; }}
      onClick={() => {
        if (pointerTypeRef.current !== "mouse") {
          // Táctil: un toque muestra/oculta controles. Se retrasa para no
          // interferir con el doble toque (±10 s) que gestiona el contenedor padre.
          if (tapTimerRef.current) { window.clearTimeout(tapTimerRef.current); tapTimerRef.current = null; return; }
          tapTimerRef.current = window.setTimeout(() => {
            tapTimerRef.current = null;
            if (controlsVis) { setControlsVis(false); setSettingsOpen(false); } else showControls();
          }, 280);
          return;
        }
        if (!controlsVis) { showControls(); return; }
        togglePlay();
      }}
    >
      <video
        ref={videoRef}
        playsInline
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
      />

      {/* Loading / Buffering spinner */}
      {(loading || buffering) && !error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none"
          style={{ background: loading ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.35)" }}
        >
          <Loader2 size={40} className="animate-spin" style={{ color: "#ffffff" }} />
          <p style={{ color: "#a1a1aa", fontSize: 13 }}>
            {loading ? "Cargando episodio..." : "Cargando..."}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ background: "rgba(0,0,0,0.85)" }}>
          <AlertCircle size={36} style={{ color: "#EF4444" }} />
          <p style={{ color: "#ffffff", fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* Controles centrales (táctil): retroceder · play/pausa · adelantar */}
      {!loading && !error && (
        <div className={`iz-pcenter ${controlsVis ? "is-on" : ""}`} style={{ opacity: controlsVis ? 1 : 0 }}>
          <button type="button" aria-label="Retroceder 10 segundos" onClick={(e) => { e.stopPropagation(); seekBy(-10); }}><RotateCcw size={22} /><small>10</small></button>
          <button type="button" aria-label={playing ? "Pausar" : "Reproducir"} className="iz-pcenter__main" onClick={(e) => togglePlay(e)}>
            {playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" style={{ marginLeft: 3 }} />}
          </button>
          <button type="button" aria-label="Adelantar 10 segundos" onClick={(e) => { e.stopPropagation(); seekBy(10); }}><RotateCw size={22} /><small>10</small></button>
        </div>
      )}

      {/* Controls overlay */}
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)",
          padding: "52px 14px 12px",
          opacity: controlsVis ? 1 : 0,
          transition: "opacity 0.25s ease",
          pointerEvents: controlsVis ? "auto" : "none",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar — supports click and drag */}
        <div
          ref={progressBarRef}
          style={{
            height: 22, background: "transparent", touchAction: "none",
            marginBottom: 6, cursor: "pointer", position: "relative",
            display: "flex", alignItems: "center",
          }}
          onClick={seekFromClick}
          onPointerDown={e => {
            e.stopPropagation();
            if (e.pointerType === "mouse") e.preventDefault();
            isDraggingRef.current = true;
            wasPlayingRef.current = !(videoRef.current?.paused ?? true);
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ }
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            if (videoRef.current && dur) videoRef.current.currentTime = pct * dur;
          }}
          onPointerMove={e => {
            if (!isDraggingRef.current || !dur) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            if (videoRef.current) videoRef.current.currentTime = pct * dur;
            showControls();
          }}
          onPointerUp={e => {
            try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ }
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            if (wasPlayingRef.current && videoRef.current?.paused) videoRef.current.play().catch(() => {});
          }}
          onPointerCancel={() => { isDraggingRef.current = false; }}
        >
          {/* Track background */}
          <div style={{ position: "absolute", left: 0, right: 0, height: 5, background: "rgba(255,255,255,0.18)", borderRadius: 3 }}>
            {/* Buffered fill */}
            <div style={{ position: "absolute", inset: 0, width: `${bufferedFrac * 100}%`, background: "rgba(255,255,255,0.28)", borderRadius: 3 }} />
            {/* Played fill */}
            <div style={{ position: "absolute", inset: 0, width: `${dur ? (currentSec / dur) * 100 : 0}%`, background: "linear-gradient(90deg, #6366f1, #ffffff)", borderRadius: 3 }} />
          </div>
          {/* Thumb */}
          <div style={{
            position: "absolute",
            left: `${dur ? (currentSec / dur) * 100 : 0}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 13, height: 13, borderRadius: "50%",
            background: "#ffffff",
            boxShadow: "0 0 8px rgba(255,255,255,0.85)",
            transition: "transform 0.1s",
            pointerEvents: "none",
          }} />
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); togglePlay(e); }} style={_playerBtnStyle}>
            {playing ? <Pause size={22} fill="white" color="white" /> : <Play size={22} fill="white" color="white" />}
          </button>

          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontVariantNumeric: "tabular-nums", padding: "0 4px" }}>
            {fmt(currentSec)} / {fmt(dur)}
          </span>
          {activeHeight > 0 && (
            <span style={{ marginLeft: 4, padding: "2px 6px", borderRadius: 5, border: "1px solid rgba(255,255,255,.2)", color: "rgba(255,255,255,.8)", fontSize: 10, fontWeight: 700, fontFamily: "'Space Grotesk', monospace" }}>
              {activeHeight >= 1080 ? "1080p HD" : `${activeHeight}p`}
            </span>
          )}

          <div style={{ flex: 1 }} />

          <button onClick={toggleMute} style={_playerBtnStyle}>
            {muted || vol === 0
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
            }
          </button>

          {/* Settings (gear) button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={e => { e.stopPropagation(); setSettingsOpen(o => !o); }}
              style={{
                ..._playerBtnStyle,
                background: settingsOpen ? "rgba(255,255,255,0.12)" : "none",
                borderRadius: 8,
              }}
              aria-label="Ajustes"
            >
              <Settings
                size={20}
                style={{
                  transition: "transform 0.3s ease",
                  transform: settingsOpen ? "rotate(60deg)" : "rotate(0deg)",
                }}
              />
            </button>

            {settingsOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 10px)",
                  right: 0,
                  minWidth: 250, maxHeight: "min(70vh, 420px)", overflowY: "auto",
                  background: "rgba(10,10,10,0.96)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  padding: 10,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  zIndex: 50,
                }}
              >
                {levels.length > 1 && (
                  <>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "4px 8px 8px" }}>Calidad</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 4, marginBottom: 10 }}>
                      {[{ height: -1 }, ...levels].map((l) => {
                        const active = l.height === -1 ? qualityPref <= 0 : qualityPref === l.height;
                        return (
                          <button key={l.height} type="button" onClick={() => changeQuality(l.height)}
                            style={{ padding: "7px 6px", borderRadius: 8, border: "1px solid " + (active ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.08)"), background: active ? "rgba(255,255,255,0.14)" : "transparent", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            {l.height === -1 ? `Auto${qualityPref <= 0 && activeHeight ? ` · ${activeHeight}p` : ""}` : `${l.height}p${l.height >= 1080 ? " HD" : ""}`}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <div style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: "4px 8px 8px",
                }}>
                  Velocidad de reproducción
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {SPEEDS.map(s => {
                    const active = playbackRate === s;
                    return (
                      <button
                        key={s}
                        onClick={() => {
                          if (videoRef.current) videoRef.current.playbackRate = s;
                          onPlaybackRateChange?.(s);
                          setSettingsOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: active ? "rgba(255,255,255,0.12)" : "transparent",
                          border: "none",
                          color: active ? "#ffffff" : "rgba(255,255,255,0.85)",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                      >
                        <span>{s === 1 ? "Normal (1x)" : `${s}x`}</span>
                        {active && <CheckIcon size={16} style={{ color: "#ffffff" }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button onClick={e => { e.stopPropagation(); if (isFs) { exitFs(); } else { enterFs(); } }} style={_playerBtnStyle}>
            {isFs ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── EPISODE LIST PANEL ── */
function EpisodePanel({
  animeId, currentEpisodeId, animeTitle, animeImage,
  nextEpisodeId, onNavigate,
}: {
  animeId: string; currentEpisodeId: string; animeTitle: string; animeImage: string;
  nextEpisodeId: string; onNavigate: (episodeId: string, episodeNum: string, nextId: string, nextNum: string) => void;
}) {
  const [, navigate] = useLocation();
  const { getProgress } = useWatchProgress();
  const [page, setPage] = useState(0);
  const [jumpEpisode, setJumpEpisode] = useState("");
  const PAGE_SIZE = 24;

  const episodesQuery = useQuery({
    queryKey: ["animeEpisodesById", animeId],
    queryFn: () => consumet.episodesById(animeId),
    enabled: !!animeId,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const episodes = episodesQuery.data?.episodes ?? [];
  const currentIndex = episodes.findIndex((e) => e.id === currentEpisodeId);
  const totalPages = Math.ceil(episodes.length / PAGE_SIZE);
  const safePage = totalPages > 0 ? Math.min(page, totalPages - 1) : 0;
  const pageEps = episodes.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const pageOptions = useMemo(() => {
    if (episodes.length <= PAGE_SIZE) return [];
    return Array.from({ length: totalPages }, (_, pageIndex) => {
      const pageEpisodes = episodes.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
      const first = pageEpisodes[0]?.number ?? pageIndex * PAGE_SIZE + 1;
      const last = pageEpisodes[pageEpisodes.length - 1]?.number ?? first;
      return { label: first === last ? `Ep. ${first}` : `Ep. ${first}-${last}`, page: pageIndex };
    });
  }, [episodes, totalPages]);
  useEffect(() => {
    if (currentIndex >= 0) setPage(Math.floor(currentIndex / PAGE_SIZE));
  }, [currentIndex]);

  const jumpToEpisode = () => {
    const target = parseInt(jumpEpisode, 10);
    if (!target || Number.isNaN(target)) return;
    const idx = episodes.findIndex((ep) => ep.number === target);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE));
  };

  return (
    <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <List size={15} color="#ffffff" />
          <span style={{ color: "#f4f4f5", fontSize: 14, fontWeight: 800 }}>Episodios</span>
          {episodes.length > 0 && <span style={{ background: "rgba(255,255,255,0.1)", color: "#ffffff", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{episodes.length}</span>}
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: 5, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", cursor: page === 0 ? "default" : "pointer", opacity: page === 0 ? 0.3 : 1 }}>
              <ChevronLeft size={14} color="#fff" />
            </button>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{safePage + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ padding: 5, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", cursor: page === totalPages - 1 ? "default" : "pointer", opacity: page === totalPages - 1 ? 0.3 : 1 }}>
              <ChevronRight size={14} color="#fff" />
            </button>
          </div>
        )}
      </div>

      {episodes.length > PAGE_SIZE && (
        <div style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
            <input
              value={jumpEpisode}
              onChange={(e) => setJumpEpisode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") jumpToEpisode(); }}
              placeholder="Número de episodio"
              inputMode="numeric"
              style={{ minWidth: 0, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "10px 12px", color: "#f4f4f5", fontSize: 12, outline: "none" }}
            />
            <button
              onClick={jumpToEpisode}
              style={{ background: "#ffffff", border: "none", color: "#000000", borderRadius: 12, padding: "0 15px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Ir
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <select
              value={safePage}
              onChange={(e) => setPage(Number(e.target.value))}
              style={{ minWidth: 0, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "9px 10px", color: "#E8E7FF", fontSize: 12, fontWeight: 800, outline: "none" }}
            >
              {pageOptions.map((range) => (
                <option key={range.label} value={range.page}>{range.label}</option>
              ))}
            </select>
            <button
              onClick={() => setPage(Math.max(0, totalPages - 1))}
              style={{ background: "rgba(63,46,178,0.25)", border: "1px solid rgba(63,46,178,0.45)", color: "#ffffff", borderRadius: 12, padding: "9px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Últimos episodios
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: "8px 10px" }}>
        {episodesQuery.isLoading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "#ffffff" }} />
          </div>
        )}
        {!episodesQuery.isLoading && episodes.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", padding: 24 }}>No se encontraron episodios</div>
        )}
        {pageEps.map((ep, idx) => {
          const isCurrent = ep.id === currentEpisodeId;
          const globalIdx = safePage * PAGE_SIZE + idx;
          const nextEp = episodes[globalIdx + 1];
          const progress = getProgress(ep.id);
          const pct = progress ? Math.min(1, progress.currentTime / Math.max(progress.duration, 1)) : 0;

          return (
            <button key={ep.id}
              onClick={() => {
                if (isCurrent) return;
                const p = new URLSearchParams({
                  episodeId: ep.id,
                  episodeNum: String(ep.number),
                  animeTitle,
                  animeId,
                  animeImage,
                  ...(nextEp ? { nextEpisodeId: nextEp.id, nextEpisodeNum: String(nextEp.number) } : {}),
                });
                navigate(`/watch?${p.toString()}`);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 10px", borderRadius: 10, marginBottom: 2, textAlign: "left",
                background: isCurrent ? "rgba(255,255,255,0.08)" : "transparent",
                border: `1px solid ${isCurrent ? "rgba(255,255,255,0.18)" : "transparent"}`,
                cursor: isCurrent ? "default" : "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: isCurrent ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isCurrent
                  ? <Play size={14} color="#ffffff" fill="#ffffff" />
                  : <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700 }}>{ep.number}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: isCurrent ? "#ffffff" : "#f4f4f5", fontSize: 12, fontWeight: isCurrent ? 800 : 600 }} className="line-clamp-1">
                  {ep.title ? ep.title : `Episodio ${ep.number}`}
                </div>
                {pct > 0 && (
                  <div style={{ height: 2, background: "rgba(255,255,255,0.1)", borderRadius: 1, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: isCurrent ? "#ffffff" : "#22C55E", width: `${Math.round(pct * 100)}%`, borderRadius: 1 }} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── MAIN PLAYER ── */
/**
 * Las fuentes del motor (AnimeFLV/AnimeAV1/JKAnime) suelen ser PÁGINAS de reproductor
 * (mp4upload, voe, byselapuix…), no videos. La app las abre en un WebView; aquí van en
 * un iframe. Versiones anteriores del backend las envolvían en el proxy HLS, lo que hacía
 * fallar todas las fuentes: aquí se detecta y se desenvuelve la URL original.
 */
function normalizeEngineSource<T extends { url: string; isM3U8?: boolean; quality?: string }>(src: T) {
  let url = src.url;
  let inner = url;
  if (/\/anime\/hls-proxy\?/.test(url)) {
    try { inner = new URL(url, "https://x.invalid").searchParams.get("url") || url; } catch { /* */ }
  }
  const declaredEmbed = (src as { isEmbed?: boolean }).isEmbed;
  const looksM3u8 = /\.m3u8(?:$|[?#])/i.test(inner) || src.isM3U8 === true;
  const looksMp4 = /\.mp4(?:$|[?#])/i.test(inner) || (src as { isMp4?: boolean }).isMp4 === true;
  const isEmbed = declaredEmbed ?? (!looksM3u8 && !looksMp4);
  if (isEmbed) url = inner;
  return { ...src, url, isDub: false, provider: "sub", isM3U8: !isEmbed && looksM3u8, isEmbed };
}
const EMBED_HOST_RE = /(mp4upload|voe\.sx|byselapuix|zilla-networks|animeav1|streamwish|filemoon|ok\.ru|uqload|dsvplay|mega\.nz|lulu(vid|stream)|mxdrop|listeamed|yourupload|streamtape|vidhide|swhoi)/i;
function sourceRank(s: { isM3U8?: boolean; isEmbed?: boolean }) {
  return s.isM3U8 ? 0 : s.isEmbed ? 2 : 1;
}

export default function Player() {
  const rawSearch = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(rawSearch);
  const episodeId = params.get("episodeId") ?? "";
  const episodeNum = params.get("episodeNum") ?? "";
  const animeTitle = params.get("animeTitle") ?? "";
  const animeId = params.get("animeId") ?? "";
  const animeImage = params.get("animeImage") ?? "";

  const { saveProgress, getProgress } = useWatchProgress();
  const { history, addToHistory } = useHistory();
  const historyRef = useRef(history);
  historyRef.current = history;

  // Registrar en el historial cada episodio que se abre (también al venir de
  // "Continuar viendo" o del autoplay del siguiente episodio).
  useEffect(() => {
    if (!animeId || !episodeId) return;
    const num = parseInt(episodeNum) || undefined;
    const last = historyRef.current.find((h) => String(h.id) === String(animeId));
    if (last && last.episodeNum === num && Date.now() - last.watchedAt < 60_000) return;
    addToHistory({ id: animeId, title: animeTitle, image: animeImage }, num);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, episodeId]);
  const savedProgress = getProgress(episodeId);
  const startAt = savedProgress?.currentTime;

  const { user, isMegaFan } = useAuth();
  const { config: limitsConfig } = useLimitsConfig();
  const episodesQuery = useQuery({
    queryKey: ["animeEpisodesById", animeId],
    queryFn: () => consumet.episodesById(animeId),
    enabled: !!animeId,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
  const allEpisodes = episodesQuery.data?.episodes ?? [];
  const currentEpIdx = allEpisodes.findIndex((e) => e.id === episodeId);
  const nextEp = currentEpIdx !== -1 ? allEpisodes[currentEpIdx + 1] : null;
  const nextNextEp = currentEpIdx !== -1 ? allEpisodes[currentEpIdx + 2] : null;
  const nextEpisodeId = nextEp?.id ?? "";
  const nextEpisodeNum = nextEp ? String(nextEp.number) : "";
  const [videoDurationForSkip, setVideoDurationForSkip] = useState(0);
  const skipTimes = useSkipTimes(animeId, parseInt(episodeNum) || 0, videoDurationForSkip);
  usePageMeta({
    title: animeTitle ? `${animeTitle} · Episodio ${episodeNum}` : "Reproductor",
    description: animeTitle ? `Mira ${animeTitle} episodio ${episodeNum} online en HD con subtítulos en español.` : undefined,
    image: animeImage || undefined,
    imageAlt: animeTitle,
    type: "video.episode",
  });

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [playbackFailureCount, setPlaybackFailureCount] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showAutoNext, setShowAutoNext] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [dlCopied, setDlCopied] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [hlsSubTracks, setHlsSubTracks] = useState<HlsSubTrack[]>([]);
  const [activeHlsSubId, setActiveHlsSubId] = useState<number>(-1);
  const [hlsCueText, setHlsCueText] = useState<string | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  useRoomPlayerSync({ animeId, episodeNum, title: animeTitle, image: animeImage });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [seekFeedback, setSeekFeedback] = useState<{ dir: "left" | "right"; secs: number; visible: boolean }>({ dir: "right", secs: 10, visible: false });
  const [volumeFeedback, setVolumeFeedback] = useState<{ pct: number; visible: boolean }>({ pct: 100, visible: false });

  const playerControlsRef = useRef<PlyrControls | null>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const lastTapTimeRef = useRef(0);
  const lastTapXRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchStartVolumeRef = useRef(1);
  const seekFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(true);

  useEffect(() => {
    return () => {
      if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
      if (volumeFeedbackTimerRef.current) clearTimeout(volumeFeedbackTimerRef.current);
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    };
  }, []);

  // ── Access control ─────────────────────────────────────────────────────────
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [serverRemaining, setServerRemaining] = useState<number | null>(null);
  const episodeRegisteredRef = useRef(false);

  // Calcular remaining usando la configuración actual del hook
  const access = getAccess();
  const localRemaining = isMegaFan ? Infinity : Math.max(0, limitsConfig.dailyLimit - access.count);
  const remaining = user ? (serverRemaining ?? localRemaining) : localRemaining;

  // Verifica límite en el servidor cuando cambia el episodio (solo usuarios logueados)
  useEffect(() => {
    if (!episodeId || isMegaFan) return;
    if (!user) {
      // Invitado: verificar por localStorage (sync)
      if (!canWatchEpisodeSync(false)) setShowLimitModal(true);
      else setShowLimitModal(false);
      return;
    }
    // Usuario logueado: verificar en servidor
    apiClient.get<{ isPremium: boolean; remaining: number; watched: number }>("/user/daily-access")
      .then((data) => {
        setServerRemaining(data.remaining ?? 0);
        if (!data.isPremium && (data.remaining ?? 0) <= 0) {
          setShowLimitModal(true);
        } else {
          setShowLimitModal(false);
        }
      })
      .catch(() => {
        // Si falla el servidor, caer a localStorage como respaldo
        if (!canWatchEpisodeSync(false)) setShowLimitModal(true);
        else setShowLimitModal(false);
      });
  }, [episodeId, isMegaFan, user]);

  const shouldFetchAnimeFlv = !!animeTitle && !!episodeNum;

  // Audio: subtitulado (sub) o español latino (lat). Se recuerda entre sesiones.
  const [audio, setAudio] = useState<"sub" | "lat">(() => {
    try { return localStorage.getItem("iz_audio") === "lat" ? "lat" : "sub"; } catch { return "sub"; }
  });
  const changeAudio = useCallback((a: "sub" | "lat") => {
    setAudio(a);
    try { localStorage.setItem("iz_audio", a); } catch { /* */ }
  }, []);

  // Motor unificado (el mismo de la app): /anime/sources. Si el backend aún no
  // tiene ese endpoint, cae al anterior /anime/animeflv-watch.
  const animeflvQuery = useQuery({
    queryKey: ["engine-sources", animeId, episodeNum, animeTitle, audio],
    queryFn: async () => {
      const ep = parseInt(episodeNum || "1");
      try {
        return await consumet.sources(animeId, ep, animeTitle, audio === "lat");
      } catch (err) {
        if (audio === "lat") throw err;
        return consumet.animeflvWatch(animeTitle, ep, animeId || undefined);
      }
    },
    enabled: shouldFetchAnimeFlv,
    retry: 1,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // El motor de la app es la fuente principal. Los proveedores antiguos (lentos)
  // solo se consultan si el motor no dio ningún video directo, y con tiempo límite.
  const engineHasDirect = !!animeflvQuery.data?.sources?.some(
    (s) => !normalizeEngineSource(s).isEmbed,
  );
  const engineSettled = !shouldFetchAnimeFlv || animeflvQuery.isSuccess || animeflvQuery.isError;
  const streamQuery = useQuery({
    queryKey: ["stream", episodeId, animeTitle, episodeNum, animeId],
    queryFn: () =>
      Promise.race([
        consumet.streaming(episodeId, animeTitle || undefined, episodeNum || undefined, animeId || undefined),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 20_000)),
      ]),
    enabled: !!episodeId && audio === "sub" && engineSettled && !engineHasDirect,
    retry: 1,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const animeflvSources = animeflvQuery.data
    ? (animeflvQuery.data.sources ?? [])
        .map(s => normalizeEngineSource(s))
        // Sin anuncios: solo video directo (HLS/MP4) en nuestro reproductor, nunca iframes
        .filter(s => !s.isEmbed)
        .sort((a, b) => sourceRank(a) - sourceRank(b))
    : [];

  const streamSources = streamQuery.data
    ? (streamQuery.data.sources ?? [])
        .map(s => {
          // Si es una página de reproductor conocida (aunque venga envuelta en el proxy) → iframe
          const n = normalizeEngineSource(s);
          if (n.isEmbed && EMBED_HOST_RE.test(n.url)) return null;
          return {
            ...s,
            isDub: false,
            provider: "sub",
            isM3U8: s.isM3U8 !== false || (typeof s.url === "string" && (s.url.includes(".m3u8") || s.url.includes("hls-proxy"))),
            isEmbed: false,
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => sourceRank(a) - sourceRank(b))
    : [];

  // En modo latino solo se usan las fuentes del motor (las demás son subtituladas)
  const sources = audio === "lat" ? animeflvSources : [...animeflvSources, ...streamSources];
  const animeflvHeaders = (animeflvQuery.data as any)?.headers ?? {};
  const streamHeaders = (streamQuery.data as any)?.headers ?? {};
  const latReferer = animeflvHeaders["Referer"] ?? animeflvHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;
  const selectedIsBackup = !!selected && ((selected as any).provider === "lat" || (selected as any).provider === "sub");

  // Se reproduce apenas exista una fuente; no se espera a los proveedores lentos.
  const streamEnabled = !!episodeId && audio === "sub" && engineSettled && !engineHasDirect;
  const isLoadingAny = sources.length === 0 && (animeflvQuery.isLoading || (streamEnabled && streamQuery.isPending));
  const isErrorAll = sources.length === 0 && (animeflvQuery.isError || !shouldFetchAnimeFlv) && (audio === "lat" || !episodeId || streamQuery.isError || (streamQuery.isSuccess && !streamQuery.data?.sources?.length));

  useEffect(() => { setSelectedIdx(0); setPlaybackFailureCount(0); }, [audio]);

  useEffect(() => {
    setSelectedIdx(0);
    setPlaybackFailureCount(0);
    setHlsSubTracks([]);
    setActiveHlsSubId(-1);
    setHlsCueText(null);
    setCurrentTime(0);
    setVideoDuration(0);
    setVideoDurationForSkip(0);
    currentTimeRef.current = 0;
    durationRef.current = 0;
    setShowAutoNext(false);
    setServerRemaining(null);
    episodeRegisteredRef.current = false;
    // El modal de límite lo gestiona el useEffect de /user/daily-access arriba
  }, [episodeId]);

  // Auto-select HLS embedded subtitle track (prefer Spanish for LAT)
  useEffect(() => {
    if (hlsSubTracks.length === 0) return;
    const match =
      hlsSubTracks.find(t => /español|spanish|spa|\bes\b/i.test(`${t.lang} ${t.name}`)) ??
      hlsSubTracks[0];
    setActiveHlsSubId(match?.id ?? -1);
  }, [hlsSubTracks]);

  const handleSubtitleTracks = useCallback((tracks: HlsSubTrack[]) => {
    setHlsSubTracks(tracks);
  }, []);

  const handleSubtitleCue = useCallback((text: string | null) => {
    setHlsCueText(text);
  }, []);

  const activeReferer = (selected as any)?.referer ?? latReferer;
  const proxyM3u8 = selected ? proxyStreamUrl(selected.url, activeReferer) : null;

  useEffect(() => {
    if (sources.length > 0 && selectedIdx >= sources.length) setSelectedIdx(0);
  }, [selectedIdx, sources.length]);

  const allSourcesFailed = sources.length > 0 && playbackFailureCount >= sources.length;

  const handlePlaybackError = useCallback(() => {
    setPlaybackFailureCount((count) => count + 1);
    setSelectedIdx((idx) => (idx + 1 < sources.length ? idx + 1 : idx));
  }, [sources.length]);

  const handleTimeUpdate = useCallback((ct: number, duration: number) => {
    currentTimeRef.current = ct;
    if (duration > 0) {
      durationRef.current = duration;
      setVideoDuration(duration);
      setVideoDurationForSkip((d) => (Math.abs(d - duration) > 5 ? duration : d));
    }
    setCurrentTime(ct);
    // Anti-exploit: registrar episodio solo tras REGISTER_THRESHOLD_SECONDS segundos vistos
    // y solo una vez por sesión de episodio (useRef evita doble conteo al refrescar)
    if (!episodeRegisteredRef.current && ct >= REGISTER_THRESHOLD_SECONDS) {
      episodeRegisteredRef.current = true;
      if (user) {
        // Registrar siempre en servidor (incluso MegaFan, para estadísticas de admin)
        apiClient.post<{ ok: boolean; remaining?: number }>("/user/daily-access/register", { episodeId })
          .then((data) => {
            if (data.remaining !== undefined) setServerRemaining(data.remaining);
          })
          .catch(() => {});
      } else if (!isMegaFan) {
        // Invitado no-megafan → localStorage como respaldo
        registerEpisodeView(episodeId);
      }
    }
    if (!animeId) return;
    saveProgress({ episodeId, episodeNum: parseInt(episodeNum) || 0, animeId, animeTitle, animeImage, currentTime: ct, duration });
  }, [episodeId, episodeNum, animeId, animeTitle, animeImage, isMegaFan, user, saveProgress]);

  const handleNextEpisode = useCallback(() => {
    if (!nextEpisodeId) return;
    setShowAutoNext(false);
    const p = new URLSearchParams({ episodeId: nextEpisodeId, episodeNum: nextEpisodeNum, animeTitle, animeId, animeImage });
    if (nextNextEp) {
      p.set("nextEpisodeId", nextNextEp.id);
      p.set("nextEpisodeNum", String(nextNextEp.number));
    }
    navigate(`/watch?${p.toString()}`);
  }, [nextEpisodeId, nextEpisodeNum, nextNextEp, animeTitle, animeId, animeImage, navigate]);

  const [videoEnded, setVideoEnded] = useState(false);

  const handleEnded = useCallback(() => {
    setVideoEnded(true);
    if (nextEpisodeId) setShowAutoNext(true);
  }, [nextEpisodeId]);

  // Reset end-of-video flags whenever the user moves to a different episode
  useEffect(() => {
    setVideoEnded(false);
    setShowAutoNext(false);
  }, [episodeId]);

  // If the video already ended but the next-episode id wasn't loaded yet
  // (episode list still fetching), trigger the auto-next overlay as soon
  // as the id becomes available.
  useEffect(() => {
    if (videoEnded && nextEpisodeId && !showAutoNext) {
      setShowAutoNext(true);
    }
  }, [videoEnded, nextEpisodeId, showAutoNext]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  // ── Fullscreen detection + auto-hide controls on mouse inactivity ─────────
  useEffect(() => {
    const isMobileDevice = () =>
      typeof navigator !== "undefined" &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && window.matchMedia("(max-width: 900px)").matches));

    const lockLandscape = async () => {
      try {
        const orient: any = (screen as any).orientation;
        if (orient && typeof orient.lock === "function") {
          await orient.lock("landscape");
        }
      } catch {
        // ignore unsupported / disallowed
      }
    };

    const unlockOrientation = () => {
      try {
        const orient: any = (screen as any).orientation;
        if (orient && typeof orient.unlock === "function") orient.unlock();
      } catch {
        // ignore
      }
    };

    const onChange = () => {
      const fs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(fs);
      if (isMobileDevice()) {
        if (fs) lockLandscape();
        else unlockOrientation();
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      if (isMobileDevice()) unlockOrientation();
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenControlsVisible(true);
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
      return;
    }
    const startHideTimer = () => {
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = setTimeout(() => setFullscreenControlsVisible(false), 2500);
    };
    const onActivity = () => {
      setFullscreenControlsVisible(true);
      startHideTimer();
    };
    startHideTimer();
    document.addEventListener("mousemove", onActivity);
    document.addEventListener("pointermove", onActivity);
    return () => {
      document.removeEventListener("mousemove", onActivity);
      document.removeEventListener("pointermove", onActivity);
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    };
  }, [isFullscreen]);

  // ── Seek/volume feedback helpers ──────────────────────────────────────────
  const triggerSeekFeedback = useCallback((dir: "left" | "right", secs: number) => {
    setSeekFeedback({ dir, secs, visible: true });
    if (seekFeedbackTimerRef.current) clearTimeout(seekFeedbackTimerRef.current);
    seekFeedbackTimerRef.current = setTimeout(() => setSeekFeedback(f => ({ ...f, visible: false })), 700);
  }, []);

  const triggerVolumeFeedback = useCallback((pct: number) => {
    setVolumeFeedback({ pct: Math.round(pct * 100), visible: true });
    if (volumeFeedbackTimerRef.current) clearTimeout(volumeFeedbackTimerRef.current);
    volumeFeedbackTimerRef.current = setTimeout(() => setVolumeFeedback(f => ({ ...f, visible: false })), 700);
  }, []);

  // ── Mobile touch gesture handlers ─────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) { touchStartRef.current = null; return; }
    // Los toques sobre botones/controles no cuentan como gestos
    if ((e.target as HTMLElement).closest("button, [role='slider'], input")) { touchStartRef.current = null; return; }
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    touchStartVolumeRef.current = playerControlsRef.current?.getVolume() ?? 1;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.time;
    const containerWidth = (e.currentTarget as HTMLDivElement).offsetWidth;
    const containerHeight = (e.currentTarget as HTMLDivElement).offsetHeight;
    touchStartRef.current = null;

    // Vertical swipe → volume
    if (Math.abs(dy) > 25 && Math.abs(dy) > Math.abs(dx) * 1.5 && dt < 600) {
      const deltaVol = -dy / (containerHeight * 0.8);
      const newVol = Math.max(0, Math.min(1, touchStartVolumeRef.current + deltaVol));
      playerControlsRef.current?.setVolume(newVol);
      triggerVolumeFeedback(newVol);
      return;
    }

    // Tap (short, no movement)
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 300) {
      const now = Date.now();
      const isDoubleTap = (now - lastTapTimeRef.current) < 350 && Math.abs(t.clientX - lastTapXRef.current) < 70;
      if (isDoubleTap) {
        lastTapTimeRef.current = 0;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const isLeft = t.clientX - rect.left < (rect.width || containerWidth) / 2;
        const SEEK = 10;
        if (isLeft) {
          const target = Math.max(0, currentTimeRef.current - SEEK);
          playerControlsRef.current?.seekTo(target);
          triggerSeekFeedback("left", SEEK);
        } else {
          const target = Math.min(durationRef.current || 999999, currentTimeRef.current + SEEK);
          playerControlsRef.current?.seekTo(target);
          triggerSeekFeedback("right", SEEK);
        }
      } else {
        lastTapTimeRef.current = now;
        lastTapXRef.current = t.clientX;
      }
    }
  }, [triggerSeekFeedback, triggerVolumeFeedback]);

  // HLS cue text takes priority over external subtitles
  const hlsCueToRender = hlsCueText ?? null;

  return (
    <div style={{ background: "#000000", minHeight: "100vh" }}>
      <WatchTogetherDrawer open={roomOpen} onClose={() => setRoomOpen(false)} />
      {/* Top bar */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#0a0a0a", overflow: "hidden" }}>
        <button onClick={() => animeId ? navigate(`/anime/${animeId}`) : navigate("/")}
          style={{ position: "relative", padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", display: "flex", color: "#ffffff", flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <div style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, marginBottom: 1, textTransform: "uppercase" }}>REPRODUCIENDO</div>
          <div style={{ color: "#f4f4f5", fontSize: 14, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: 0.2 }}>{animeTitle}</div>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
            EP {String(episodeNum).padStart(2, "0")}
            {!isMegaFan && remaining <= 2 && remaining > 0 && (
              <span style={{ marginLeft: 8, color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>
                · {remaining} ep. gratis {remaining === 1 ? "restante" : "restantes"} hoy
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={handleCopyLink}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Users size={13} /> <span className="hidden md:inline">Ver juntos</span>
          </button>
          {nextEpisodeId && (
            <button onClick={handleNextEpisode}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "#ffffff", border: "none", color: "#000000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Ep. {nextEpisodeNum} <SkipForward size={13} />
            </button>
          )}
        </div>
      </div>

      {copyToast && (
        <div style={{ position: "fixed", top: 70, right: 16, background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 10, padding: "10px 16px", zIndex: 200 }}>
          ✓ Enlace copiado
        </div>
      )}

      {/* Main layout: player + sidebar */}
      <div style={{ display: "flex", gap: 0, alignItems: "flex-start", maxWidth: theaterMode ? "100%" : 1400, margin: "0 auto", transition: "max-width 0.3s ease" }}>
        {/* Player column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Video */}
          <div id="plyr-fullscreen-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ position: "relative", width: "100%", background: "#000", aspectRatio: "16/9", border: "1px solid rgba(255,255,255,0.08)", borderRadius: isFullscreen ? 0 : 14, overflow: "hidden" }}>
            {/* SISTEMA frame on player */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6 }}>
            </div>

            {/* Placeholder cuando el modal está activo (mantiene el aspect ratio del player) */}
            {showLimitModal && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 5,
                background: "#000",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Lock size={48} color="rgba(255,255,255,0.15)" />
              </div>
            )}

          {isErrorAll && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 16, position: "absolute", inset: 0, background: "rgba(7,7,7,0.85)", backdropFilter: "blur(6px)" }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertCircle size={28} color="#EF4444" />
                </div>
                <div style={{ textAlign: "center", maxWidth: 300, padding: "0 16px" }}>
                  <p style={{ color: "#f4f4f5", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>No disponible</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6 }}>{audio === "lat" ? "Este episodio no está disponible en español latino." : "No se encontró este episodio en ningún servidor. Intenta de nuevo."}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="iz-btn iz-btn--primary iz-btn--sm"
                    onClick={() => { setPlaybackFailureCount(0); setSelectedIdx(0); animeflvQuery.refetch(); if (audio === "sub") streamQuery.refetch(); }}>
                    Reintentar
                  </button>
                  {audio === "lat" && <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" onClick={() => changeAudio("sub")}>Ver subtitulado</button>}
                </div>
              </div>
            )}
            {isLoadingAny && !isErrorAll && (
              <PlayerLoadingScreen
                animeImage={animeImage}
                animeTitle={animeTitle}
                episodeNum={episodeNum}
              />
            )}
            {!selected && !showLimitModal && !isLoadingAny && !isErrorAll && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <AlertCircle size={36} color="rgba(255,255,255,0.2)" />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sin fuentes disponibles</p>
              </div>
            )}
            {allSourcesFailed && !showLimitModal && (
              <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, textAlign: "center", background: "rgba(0,0,0,.92)" }}>
                <AlertCircle size={34} color="#f87171" />
                <div style={{ fontSize: 16, fontWeight: 600 }}>No se pudo reproducir en ningún servidor</div>
                <div style={{ color: "#a1a1aa", fontSize: 13, maxWidth: 380 }}>Probamos {sources.length} {sources.length === 1 ? "fuente" : "fuentes"}. Puede ser un corte temporal del proveedor.</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button type="button" className="iz-btn iz-btn--primary iz-btn--sm" onClick={() => { setPlaybackFailureCount(0); setSelectedIdx(0); animeflvQuery.refetch(); streamQuery.refetch(); }}>Reintentar</button>
                  {sources.map((src, i) => (
                    <button key={i} type="button" className="iz-btn iz-btn--ghost iz-btn--sm" onClick={() => { setPlaybackFailureCount(0); setSelectedIdx(i); }}>{parseLatLabel(src, i)}</button>
                  ))}
                </div>
              </div>
            )}
            {!showLimitModal && !allSourcesFailed && selected && !isLoadingAny && !isErrorAll && (
              selected.isM3U8 === false ? (
                (selected as any).isEmbed ? (
                  <iframe
                    key={`embed-${episodeId}-${selectedIdx}`}
                    src={selected.url}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", background: "#000" }}
                    allowFullScreen
                    allow="autoplay; fullscreen; picture-in-picture"
                    referrerPolicy="origin"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
                  />
                ) : (
                  <video
                    key={`mp4-${episodeId}-${selectedIdx}`}
                    src={proxyStreamUrl(selected.url, activeReferer)}
                    preload="auto"
                    autoPlay
                    controls
                    playsInline
                    onError={handlePlaybackError}
                    onLoadedMetadata={(e) => { const v = e.currentTarget; if (startAt && startAt > 5 && startAt < v.duration - 5) v.currentTime = startAt; }}
                    onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration > 0) handleTimeUpdate(v.currentTime, v.duration); }}
                    onEnded={handleEnded}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#000" }}
                  />
                )
              ) : (
                proxyM3u8 ? (
                  <PlyrPlayer
                    key={`${episodeId}-lat-${selectedIdx}`}
                    m3u8Url={proxyM3u8}
                    playbackRate={playbackRate}
                    onPlaybackRateChange={setPlaybackRate}
                    startAt={startAt}
                    fullscreenContainer="#plyr-fullscreen-container"
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    onSubtitleTracks={handleSubtitleTracks}
                    activeHlsSubId={activeHlsSubId}
                    onSubtitleCue={handleSubtitleCue}
                    controlsRef={playerControlsRef}
                    onPlaybackError={handlePlaybackError}
                    onFullscreenChange={setIsFullscreen}
                    hasAlternatives={selectedIdx + 1 < sources.length}
                  />
                ) : null
              )
            )}
            {/* Custom subtitle overlay — VTT primary, HLS cue fallback */}
            <SubtitleOverlay
              text={hlsCueToRender}
              subtitleUrl={null}
              currentTime={currentTime}
              isFullscreen={isFullscreen}
            />

            {showAutoNext && nextEpisodeId && (
              <AutoNextOverlay nextNum={nextEpisodeNum} onSkip={handleNextEpisode} onCancel={() => setShowAutoNext(false)} />
            )}

            {/* ── Saltar opening / ending (tiempos exactos de AniSkip; si no hay datos, heurística) ── */}
            {!showLimitModal && videoDuration > 0 && (() => {
              const op = skipTimes.op;
              const ed = skipTimes.ed;
              const inOp = op ? currentTime >= op.start - 1 && currentTime < op.end - 1 : currentTime > 2 && currentTime < 90;
              const edStart = ed ? ed.start : videoDuration - 120;
              const inEd = ed ? currentTime >= ed.start - 1 && currentTime < ed.end - 1 : currentTime >= edStart && currentTime <= videoDuration - 10 && currentTime >= 90;
              if (!inOp && !inEd) return null;
              const label = inOp ? "Saltar opening" : nextEpisodeId && (!ed || ed.end >= videoDuration - 15) ? "Siguiente episodio" : "Saltar ending";
              const go = () => {
                if (inOp) playerControlsRef.current?.seekTo(op ? op.end : 90);
                else if (label === "Siguiente episodio") handleNextEpisode();
                else playerControlsRef.current?.seekTo(ed ? ed.end : Math.max(0, videoDuration - 8));
              };
              return (
                <button type="button" onClick={go} className="iz-skip">
                  <SkipForward size={15} /> {label}
                </button>
              );
            })()}

            {/* ── Seek feedback overlay ── */}
            {seekFeedback.visible && (
              <div style={{
                position: "absolute", top: "50%", transform: "translateY(-50%)",
                [seekFeedback.dir === "left" ? "left" : "right"]: "10%",
                zIndex: 40, background: "rgba(0,0,0,0.65)", borderRadius: "50%",
                width: 72, height: 72, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 2,
                pointerEvents: "none", backdropFilter: "blur(4px)",
              }}>
                {seekFeedback.dir === "left"
                  ? <Rewind size={22} color="#fff" fill="#fff" />
                  : <FastForward size={22} color="#fff" fill="#fff" />}
                <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{seekFeedback.secs}s</span>
              </div>
            )}

            {/* ── Volume feedback overlay ── */}
            {volumeFeedback.visible && (
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                zIndex: 40, background: "rgba(0,0,0,0.65)", borderRadius: 14,
                padding: "10px 18px", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 6, pointerEvents: "none",
              }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>
                  {volumeFeedback.pct === 0 ? "🔇 Silencio" : `🔊 ${volumeFeedback.pct}%`}
                </span>
                <div style={{ width: 90, height: 4, background: "rgba(255,255,255,0.2)", borderRadius: 2 }}>
                  <div style={{ height: "100%", background: "#fff", borderRadius: 2, width: `${volumeFeedback.pct}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Controls below video — hidden when fullscreen + mouse inactive */}
          <div style={{ padding: "16px 16px 28px", display: isFullscreen && !fullscreenControlsVisible ? "none" : "flex", flexDirection: "column", gap: 12, transition: "opacity 0.3s", opacity: isFullscreen && !fullscreenControlsVisible ? 0 : 1, background: "#000000" }}>
            {/* Episode title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "12px 16px", background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
              <div>
                <div style={{ color: "#f4f4f5", fontSize: 15, fontWeight: 800 }}>{animeTitle}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Episodio {episodeNum}</span>
                  <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>·</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "1px 7px", color: "#F59E0B", fontSize: 11, fontWeight: 700 }}>🇪🇸 Sub Español</span>
                  {hlsSubTracks.length > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "1px 7px", color: "#22C55E", fontSize: 11, fontWeight: 700 }}>CC · Subs</span>
                  )}
                  {sources.length > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "1px 7px", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600 }}>{sources.length} {sources.length === 1 ? "servidor" : "servidores"}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/* Keyboard shortcuts help */}
                <button
                  onClick={() => setShowShortcuts(true)}
                  title="Atajos de teclado"
                  style={{
                    display: "flex", alignItems: "center", padding: "8px 10px",
                    borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.4)",
                  }}
                >
                  <HelpCircle size={14} />
                </button>
                {/* Ver juntos (salas privadas, igual que la app) */}
                <WatchTogetherButton onClick={() => setRoomOpen(true)} />
                {/* Theater mode */}
                <button
                  onClick={() => setTheaterMode(v => !v)}
                  title={theaterMode ? "Salir del modo teatro" : "Modo teatro"}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                    borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: theaterMode ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${theaterMode ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
                    color: theaterMode ? "#ffffff" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {theaterMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span className="hidden md:inline">{theaterMode ? "Normal" : "Modo Teatro"}</span>
                </button>
                {/* LAT badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 9, background: "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,88,12,0.15))", border: "1px solid rgba(245,158,11,0.5)", color: "#F59E0B", fontSize: 12, fontWeight: 800 }}>
                  🇪🇸 SUB ESP
                  {animeflvQuery.isLoading && <span style={{ fontSize: 9, opacity: 0.6 }}>···</span>}
                </div>

                {/* Share button */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`;
                      const shareData = { title: `${animeTitle} — IZIFF ANIME`, text: `Mira ${animeTitle} en IZIFF ANIME`, url: shareUrl };
                      if (navigator.share) { try { await navigator.share(shareData); return; } catch {} }
                      setShowShare(v => !v);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700, background: showShare ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${showShare ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`, color: showShare ? "#ffffff" : "rgba(255,255,255,0.4)" }}
                  >
                    <Share2 size={14} />
                    <span className="hidden md:inline">Compartir</span>
                  </button>
                  {showShare && (
                    <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 10, minWidth: 200, boxShadow: "0 16px 48px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        {
                          label: "WhatsApp", color: "#25D366",
                          emoji: "💬",
                          onClick: () => { const url = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`; window.open(`https://wa.me/?text=${encodeURIComponent(`Mira ${animeTitle} en IZIFF ANIME 🎌\n${url}`)}`); setShowShare(false); }
                        },
                        {
                          label: "Twitter / X", color: "#1DA1F2",
                          emoji: "🐦",
                          onClick: () => { const url = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`; window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Estoy viendo ${animeTitle} en IZIFF ANIME 🎌`)}&url=${encodeURIComponent(url)}`); setShowShare(false); }
                        },
                        {
                          label: shareCopied ? "¡Copiado!" : "Copiar enlace", color: "#ffffff",
                          emoji: shareCopied ? "✅" : "🔗",
                          onClick: () => {
                            const url = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`;
                            navigator.clipboard.writeText(url).catch(() => {});
                            setShareCopied(true);
                            setTimeout(() => { setShareCopied(false); setShowShare(false); }, 1500);
                          }
                        },
                      ].map(item => (
                        <button key={item.label} onClick={item.onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "none", color: "#f4f4f5", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                          <span>{item.emoji}</span> {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Audio + servidores (cambio rápido si uno falla) */}
            <div className="iz-panel" style={{ padding: "14px 16px", display: "grid", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div className="iz-head__eyebrow" style={{ margin: 0 }}>Audio</div>
                <button type="button" className={`iz-chip ${audio === "sub" ? "is-active" : ""}`} style={{ height: 30, fontSize: 12 }} onClick={() => changeAudio("sub")}>Subtitulado</button>
                <button type="button" className={`iz-chip ${audio === "lat" ? "is-active" : ""}`} style={{ height: 30, fontSize: 12 }} onClick={() => changeAudio("lat")}>Español latino</button>
                {animeflvQuery.isFetching && <span className="iz-spin" style={{ marginLeft: 4 }} />}
              </div>
              {sources.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <div className="iz-head__eyebrow" style={{ margin: 0 }}>Servidores · {sources.length}</div>
                    {selected && <span className="iz-tag iz-tag--accent">{parseLatLabel(selected, selectedIdx)}</span>}
                    {playbackFailureCount > 0 && !allSourcesFailed && <span style={{ color: "var(--iz-dim)", fontSize: 12 }}>Cambiado automáticamente tras {playbackFailureCount} {playbackFailureCount === 1 ? "fallo" : "fallos"}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {sources.map((src, i) => (
                      <button key={i} type="button" className={`iz-chip ${i === selectedIdx ? "is-active" : ""}`} style={{ height: 32, fontSize: 12 }}
                        onClick={() => { setPlaybackFailureCount(0); setSelectedIdx(i); }}>
                        {parseLatLabel(src, i)}
                        {(src as { isEmbed?: boolean }).isEmbed && <span style={{ fontSize: 9, opacity: 0.7 }}>WEB</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Download section */}
            {sources.length > 0 && (
              <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Download size={14} color="#ffffff" />
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Descargar</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  {/* dlCopied toast */}
                  {dlCopied && (
                    <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ color: "#22C55E", fontSize: 12, fontWeight: 700, marginBottom: 3 }}>✓ Enlace copiado</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1.5 }}>
                        Abre <span style={{ color: "#ffffff", fontWeight: 700 }}>1DM</span> o <span style={{ color: "#ffffff", fontWeight: 700 }}>ADM</span>, pega el enlace y descarga el episodio completo.
                      </div>
                    </div>
                  )}

                  {/* Video sources */}
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, marginBottom: 7 }}>
                      Video · Sub Español
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {sources.map((src, i) => {
                        const label = parseLatLabel(src, i);
                        const isDirectMp4 = src.isM3U8 === false;
                        const filename = `${animeTitle}-ep${episodeNum}-${label}.${isDirectMp4 ? "mp4" : "m3u8"}`;
                        const proxyHref = downloadProxyUrl(src.url, filename, latReferer);

                        if (isDirectMp4) {
                          // MP4: descarga directa via proxy
                          return (
                            <a
                              key={i}
                              href={proxyHref}
                              download={filename}
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                padding: "6px 13px", borderRadius: 9,
                                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                                color: "#ffffff", fontSize: 12, fontWeight: 700, textDecoration: "none",
                              }}
                            >
                              <Download size={11} /> {label} MP4
                            </a>
                          );
                        }

                        // HLS: copia enlace para usar con 1DM/ADM
                        const isCopied = dlCopied === src.url;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              navigator.clipboard.writeText(src.url).then(() => {
                                setDlCopied(src.url);
                                setTimeout(() => setDlCopied(null), 5000);
                              }).catch(() => {
                                // Fallback: abrir en nueva pestaña
                                window.open(src.url, "_blank");
                              });
                            }}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "6px 13px", borderRadius: 9,
                              background: isCopied ? "rgba(34,197,94,0.15)" : (i === selectedIdx ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)"),
                              border: `1px solid ${isCopied ? "rgba(34,197,94,0.4)" : (i === selectedIdx ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)")}`,
                              color: isCopied ? "#22C55E" : (i === selectedIdx ? "#ffffff" : "rgba(255,255,255,0.55)"),
                              fontSize: 12, fontWeight: 700, cursor: "pointer",
                            }}
                          >
                            {isCopied ? <CheckIcon size={11} /> : <Copy size={11} />}
                            {isCopied ? "¡Copiado!" : label}
                          </button>
                        );
                      })}
                    </div>
                    {sources.every(s => s.isM3U8 !== false) && !dlCopied && (
                      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginTop: 6, lineHeight: 1.5 }}>
                        Toca una calidad para copiar el enlace → ábrelo en <span style={{ color: "#ffffff" }}>1DM</span> o <span style={{ color: "#ffffff" }}>ADM</span>
                      </div>
                    )}
                  </div>


                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Episode list (desktop) */}
        {animeId && !theaterMode && (
          <div style={{ width: 300, flexShrink: 0, padding: "12px 12px 12px 0" }} className="hidden lg:block">
            <EpisodePanel
              animeId={animeId}
              currentEpisodeId={episodeId}
              animeTitle={animeTitle}
              animeImage={animeImage}
              nextEpisodeId={nextEpisodeId}
              onNavigate={() => {}}
            />
          </div>
        )}
      </div>

      {/* Now Playing hero card — mobile only */}
      {animeImage && animeId && (
        <div className="lg:hidden" style={{ margin: "0 12px 12px", position: "relative", borderRadius: 20, overflow: "hidden" }}>
          {/* Blurred background */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url(${animeImage})`,
            backgroundSize: "cover", backgroundPosition: "center 20%",
            filter: "blur(22px) brightness(0.25) saturate(1.4)",
            transform: "scale(1.1)",
          }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(0,0,0,0.65),rgba(0,0,0,0.5))" }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "16px 16px" }}>
            {/* Poster */}
            <img
              src={animeImage} alt={animeTitle}
              style={{ width: 72, height: 100, objectFit: "cover", borderRadius: 12, flexShrink: 0, boxShadow: "0 8px 24px rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "2px 8px", marginBottom: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ffffff", boxShadow: "0 0 6px rgba(255,255,255,0.8)" }} />
                <span style={{ color: "#ffffff", fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>REPRODUCIENDO</span>
              </div>
              <div style={{ color: "#f4f4f5", fontSize: 15, fontWeight: 900, lineHeight: 1.25, marginBottom: 5 }} className="line-clamp-2">
                {animeTitle}
              </div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginBottom: 8 }}>Episodio {episodeNum}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 20, padding: "3px 10px", color: "#F59E0B", fontSize: 11, fontWeight: 700 }}>🇪🇸 Sub Español</span>
                {hlsSubTracks.length > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "3px 10px", color: "#22C55E", fontSize: 11, fontWeight: 700 }}>CC Subtítulos</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Episode list for mobile/tablet */}
      {animeId && (
        <div style={{ margin: "0 12px 32px", maxWidth: 1376, background: "rgba(255,255,255,0.02)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", paddingBottom: 4 }} className="lg:hidden">
          <EpisodePanel
            animeId={animeId}
            currentEpisodeId={episodeId}
            animeTitle={animeTitle}
            animeImage={animeImage}
            nextEpisodeId={nextEpisodeId}
            onNavigate={() => {}}
          />
        </div>
      )}

      {/* ── Keyboard Shortcuts Modal ── */}
      {showShortcuts && (
        <div
          onClick={() => setShowShortcuts(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 300,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20, padding: 28, maxWidth: 440, width: "100%",
              boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <HelpCircle size={18} color="#ffffff" />
                <span style={{ color: "#f4f4f5", fontSize: 16, fontWeight: 800 }}>Atajos de teclado</span>
              </div>
              <button onClick={() => setShowShortcuts(false)}
                style={{ padding: 6, borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                ["Espacio", "Pausar / Reanudar"],
                ["F", "Pantalla completa"],
                ["M", "Silenciar / Activar sonido"],
                ["← / →", "Retroceder / Avanzar 5s"],
                ["↑ / ↓", "Subir / Bajar volumen 10%"],
                ["0 – 9", "Saltar al % del video (0=inicio, 5=50%)"],
                ["L", "Avanzar 10s"],
                ["J", "Retroceder 10s"],
                ["K", "Pausar / Reanudar"],
              ].map(([key, desc]) => (
                <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)" }}>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{desc}</span>
                  <kbd style={{ background: "rgba(255,255,255,0.08)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center" }}>
              Toca fuera del panel para cerrar
            </div>
          </div>
        </div>
      )}

      {/* ── Límite diario alcanzado — Overlay full-screen ── */}
      {showLimitModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(7,7,7,0.96)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, overflowY: "auto",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            width: "100%", maxWidth: 440,
            background: "#0a0a0a",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 20,
            padding: "32px 24px",
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset",
            position: "relative",
          }}>
            <button
              onClick={() => navigate("/")}
              aria-label="Cerrar"
              style={{
                position: "absolute", top: 12, right: 12,
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>

            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 18px",
            }}>
              <Lock size={32} color="#ffffff" />
            </div>

            <h2 style={{
              color: "#f4f4f5", fontSize: 20, fontWeight: 900,
              margin: "0 0 10px", lineHeight: 1.25,
            }}>
              {limitsConfig.limitMessage.split('.')[0] || "Has alcanzado el límite diario"}
            </h2>
            <p style={{
              color: "rgba(255,255,255,0.6)", fontSize: 14, lineHeight: 1.55,
              margin: "0 0 22px",
            }}>
              Solo puedes ver <strong style={{ color: "#ffffff" }}>{limitsConfig.dailyLimit} {limitsConfig.dailyLimit === 1 ? "episodio" : "episodios"} por día</strong> con la cuenta gratuita.
              <br />El límite se reinicia automáticamente cada día.
            </p>

            <Link href="/membership" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              background: "#ffffff",
              borderRadius: 14, padding: "14px 20px",
              color: "#000000", fontSize: 15, fontWeight: 900,
              textDecoration: "none",
              marginBottom: 14,
            }}>
              <Crown size={18} />
              <span>{limitsConfig.megafanMessage}</span>
            </Link>

            <div style={{
              display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 6,
              color: "rgba(255,255,255,0.45)", fontSize: 12, lineHeight: 1.6,
              marginBottom: 6,
            }}>
              <span>Acceso ilimitado</span><span style={{ opacity: 0.4 }}>·</span>
              <span>Sin interrupciones</span><span style={{ opacity: 0.4 }}>·</span>
              <span>Mejor calidad</span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              Solo <strong style={{ color: "#ffffff" }}>$4/mes</strong> · Cancela cuando quieras
            </div>

            <button
              onClick={() => navigate("/")}
              style={{
                marginTop: 18,
                background: "transparent", border: "none",
                color: "rgba(255,255,255,0.45)", fontSize: 13,
                cursor: "pointer", padding: 8,
              }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
