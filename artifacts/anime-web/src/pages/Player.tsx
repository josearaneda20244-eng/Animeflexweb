import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";
import {
  ArrowLeft, SkipForward, AlertCircle, Loader2, Play, Pause, X,
  Users, Captions, ChevronLeft, ChevronRight, List, Maximize2, Minimize2,
  Share2, Copy, Check as CheckIcon, HelpCircle, FastForward, Rewind,
  Download,
} from "lucide-react";
import {
  consumet,
  proxyStreamUrl,
  downloadProxyUrl,
  type StreamingSource,
} from "@/lib/consumet";
import { useWatchProgress } from "@/context/WatchProgressContext";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useLimitsConfig } from "@/hooks/use-limits-config";
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
function parseLatLabel(src: StreamingSource, index: number): string {
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
    </div>
  );
}

/* ── AUTO-NEXT ── */
function AutoNextOverlay({ nextNum, onSkip, onCancel }: { nextNum: string; onSkip: () => void; onCancel: () => void }) {
  const [secs, setSecs] = useState(10);
  useEffect(() => {
    if (secs <= 0) { onSkip(); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onSkip]);
  return (
    <div style={{ position: "absolute", bottom: 80, right: 16, zIndex: 50, background: "rgba(9,10,18,0.92)", border: "1px solid rgba(124,111,255,0.3)", borderRadius: 16, padding: "16px 20px", minWidth: 220, backdropFilter: "blur(8px)" }}>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Siguiente episodio en {secs}s</div>
      <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Episodio {nextNum}</div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#7C6FFF", borderRadius: 2, width: `${(secs / 10) * 100}%`, transition: "width 1s linear" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSkip} style={{ flex: 1, background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", border: "none", borderRadius: 10, padding: "9px 0", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <Play size={12} fill="#fff" /> Ver ahora
        </button>
        <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "9px 12px", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center" }}>
          <X size={14} />
        </button>
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
}

/* ── Button style reused across player controls ── */
const _playerBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  padding: 8, display: "flex", alignItems: "center", justifyContent: "center",
  lineHeight: 0, color: "#fff", flexShrink: 0,
};

function PlyrPlayer({ m3u8Url, playbackRate, startAt, fullscreenContainer, onTimeUpdate, onEnded, onSubtitleTracks, activeHlsSubId, onSubtitleCue, controlsRef, onPlaybackError, onFullscreenChange }: PlyrPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFs(fs);
      onFullscreenChangeRef.current?.(fs);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const enterFs = useCallback(() => {
    const el = fullscreenContainer
      ? (document.querySelector(fullscreenContainer) as HTMLElement | null)
      : videoRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  }, [fullscreenContainer]);

  const exitFs = useCallback(() => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
  }, []);

  const showControls = useCallback(() => {
    setControlsVis(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setPlaying(p => { if (p) setControlsVis(false); return p; });
    }, 3000);
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
    setBufferedFrac(0); setPlaying(false);
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
            if (track.mode !== "disabled" && track.activeCues && track.activeCues.length > 0) {
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

    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setControlsVis(true); };
    const onEndEv = () => { onEndedRef.current?.(); setPlaying(false); setControlsVis(true); };
    const onVolCh = () => { setVol(video.volume); setMuted(video.muted); };
    const onProg = () => {
      if (video.buffered.length && video.duration)
        setBufferedFrac(video.buffered.end(video.buffered.length - 1) / video.duration);
    };
    const onNativeErr = () => { setError("Error al cargar fuente. Probando otra..."); setLoading(false); notifyErr(); };
    const onMeta = () => trySeek();

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true, maxBufferLength: 60, maxMaxBufferLength: 240,
        startLevel: -1, fragLoadingTimeOut: 15000, manifestLoadingTimeOut: 15000, maxBufferHole: 1,
      });
      hlsRef.current = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        const tracks = (data.subtitleTracks ?? []).map(t => ({ id: t.id, lang: t.lang ?? t.name ?? "", name: t.name ?? t.lang ?? "" }));
        if (tracks.length > 0) onSubtitleTracksRef.current?.(tracks);
      });
      loadTimeout = setTimeout(() => { setError("Tiempo agotado. Probando otra fuente..."); setLoading(false); notifyErr(); }, 12000);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
        setLoading(false); video.play().catch(() => {});
      });
      let netErr = 0, mediaErr = 0;
      hls.on(Hls.Events.FRAG_LOADED, () => { netErr = 0; });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          netErr++;
          if (netErr > 2) { if (loadTimeout) clearTimeout(loadTimeout); setError("Error de red. Probando otra..."); setLoading(false); notifyErr(); }
          else setTimeout(() => hls.startLoad(), 1000);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          mediaErr++;
          if (mediaErr > 3) { if (loadTimeout) clearTimeout(loadTimeout); setError("Error de medios. Probando otra..."); setLoading(false); notifyErr(); }
          else { const st = video.currentTime; hls.recoverMediaError(); setTimeout(() => { if (st > 5) video.currentTime = st; }, 300); }
        } else { if (loadTimeout) clearTimeout(loadTimeout); setError("Error en esta fuente. Probando otra..."); setLoading(false); notifyErr(); }
      });
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
    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("timeupdate", onTimeUpd);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEndEv);
      video.removeEventListener("volumechange", onVolCh);
      video.removeEventListener("progress", onProg);
      video.removeEventListener("error", onNativeErr);
      if (loadTimeout) clearTimeout(loadTimeout);
      if (controlsRef) controlsRef.current = null;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [m3u8Url]);

  const fmt = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

  const seekFromClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (videoRef.current && dur) videoRef.current.currentTime = pct * dur;
  };

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
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
      onTouchStart={showControls}
      onClick={() => { if (!controlsVis) { showControls(); return; } togglePlay(); }}
    >
      <video
        ref={videoRef}
        playsInline
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
      />

      {/* Loading */}
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ background: "rgba(0,0,0,0.7)" }}>
          <Loader2 size={40} className="animate-spin" style={{ color: "#7C6FFF" }} />
          <p style={{ color: "#9090B0", fontSize: 13 }}>Cargando episodio...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none" style={{ background: "rgba(0,0,0,0.85)" }}>
          <AlertCircle size={36} style={{ color: "#EF4444" }} />
          <p style={{ color: "#F0F0FF", fontSize: 13 }}>{error}</p>
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
        {/* Progress bar */}
        <div
          style={{
            height: 5, background: "rgba(255,255,255,0.18)", borderRadius: 3,
            marginBottom: 10, cursor: "pointer", position: "relative",
          }}
          onClick={seekFromClick}
        >
          <div style={{ position: "absolute", inset: 0, width: `${bufferedFrac * 100}%`, background: "rgba(255,255,255,0.28)", borderRadius: 3 }} />
          <div style={{ position: "absolute", inset: 0, width: `${dur ? (currentSec / dur) * 100 : 0}%`, background: "#7C6FFF", borderRadius: 3 }} />
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); togglePlay(e); }} style={_playerBtnStyle}>
            {playing ? <Pause size={22} fill="white" color="white" /> : <Play size={22} fill="white" color="white" />}
          </button>

          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontVariantNumeric: "tabular-nums", padding: "0 4px" }}>
            {fmt(currentSec)} / {fmt(dur)}
          </span>

          <div style={{ flex: 1 }} />

          <button onClick={toggleMute} style={_playerBtnStyle}>
            {muted || vol === 0
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
            }
          </button>

          <button onClick={e => { e.stopPropagation(); isFs ? exitFs() : enterFs(); }} style={_playerBtnStyle}>
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
    <div style={{ background: "#0E0E1A", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <List size={15} color="#7C6FFF" />
          <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Episodios</span>
          {episodes.length > 0 && <span style={{ background: "rgba(124,111,255,0.15)", color: "#B39DFF", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{episodes.length}</span>}
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
        <div style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(180deg,rgba(124,111,255,0.08),rgba(14,14,26,0))" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
            <input
              value={jumpEpisode}
              onChange={(e) => setJumpEpisode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") jumpToEpisode(); }}
              placeholder="Número de episodio"
              inputMode="numeric"
              style={{ minWidth: 0, background: "rgba(5,5,12,0.7)", border: "1px solid rgba(124,111,255,0.22)", borderRadius: 12, padding: "10px 12px", color: "#F1F1F5", fontSize: 12, outline: "none" }}
            />
            <button
              onClick={jumpToEpisode}
              style={{ background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", border: "none", color: "#fff", borderRadius: 12, padding: "0 15px", fontSize: 12, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 20px rgba(124,111,255,0.22)" }}
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
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "#86EFAC", borderRadius: 12, padding: "9px 10px", fontSize: 12, fontWeight: 900, cursor: "pointer" }}
            >
              Últimos episodios
            </button>
          </div>
        </div>
      )}

      <div style={{ maxHeight: 380, overflowY: "auto", padding: "8px 10px" }}>
        {episodesQuery.isLoading && (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Loader2 size={20} className="animate-spin" style={{ color: "#7C6FFF" }} />
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
                background: isCurrent ? "rgba(124,111,255,0.18)" : "transparent",
                border: `1px solid ${isCurrent ? "rgba(124,111,255,0.4)" : "transparent"}`,
                cursor: isCurrent ? "default" : "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: isCurrent ? "rgba(124,111,255,0.3)" : "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isCurrent
                  ? <Play size={14} color="#B39DFF" fill="#B39DFF" />
                  : <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700 }}>{ep.number}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: isCurrent ? "#B39DFF" : "#F1F1F5", fontSize: 12, fontWeight: isCurrent ? 800 : 600 }} className="line-clamp-1">
                  {ep.title ? ep.title : `Episodio ${ep.number}`}
                </div>
                {pct > 0 && (
                  <div style={{ height: 2, background: "rgba(255,255,255,0.1)", borderRadius: 1, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: isCurrent ? "#7C6FFF" : "#22C55E", width: `${Math.round(pct * 100)}%`, borderRadius: 1 }} />
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

  const animeflvQuery = useQuery({
    queryKey: ["animeflv", animeTitle, episodeNum, animeId],
    queryFn: () => consumet.animeflvWatch(animeTitle, parseInt(episodeNum || "1"), animeId || undefined),
    enabled: shouldFetchAnimeFlv,
    retry: 1,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  const animeflvSources = animeflvQuery.data
    ? (animeflvQuery.data.sources ?? [])
        .map(s => ({ ...s, isDub: true, provider: "backup", isEmbed: !s.isM3U8 && (s.quality ?? "").includes("[embed]") }))
        .sort((a, b) => (a.isM3U8 ? 0 : 1) - (b.isM3U8 ? 0 : 1))
    : [];
  const sources = animeflvSources;
  const animeflvHeaders = (animeflvQuery.data as any)?.headers ?? {};
  const latReferer = animeflvHeaders["Referer"] ?? animeflvHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;
  const selectedIsBackup = !!selected && (selected as any).provider === "backup";

  useEffect(() => {
    setSelectedIdx(0);
    setPlaybackFailureCount(0);
    setHlsSubTracks([]);
    setActiveHlsSubId(-1);
    setHlsCueText(null);
    setCurrentTime(0);
    setVideoDuration(0);
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

  const handlePlaybackError = useCallback(() => {
    setPlaybackFailureCount((count) => count + 1);
    setSelectedIdx((idx) => (idx + 1 < sources.length ? idx + 1 : idx));
  }, [sources.length]);

  const handleTimeUpdate = useCallback((ct: number, duration: number) => {
    currentTimeRef.current = ct;
    if (duration > 0) {
      durationRef.current = duration;
      setVideoDuration(duration);
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

  const handleEnded = useCallback(() => {
    if (nextEpisodeId) setShowAutoNext(true);
  }, [nextEpisodeId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  // ── Fullscreen detection + auto-hide controls on mouse inactivity ─────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
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
    if (e.touches.length !== 1) return;
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
        const isLeft = t.clientX < containerWidth / 2;
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
    <div style={{ background: "#090A12", minHeight: "100dvh" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(9,10,18,0.98)" }}>
        <button onClick={() => animeId ? navigate(`/anime/${animeId}`) : navigate("/")}
          style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.65)", flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{animeTitle}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
            Episodio {episodeNum}
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
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
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
          <div id="plyr-fullscreen-container" style={{ position: "relative", width: "100%", background: "#000", aspectRatio: "16/9" }}>

            {/* ── Límite de episodios — Modal premium ── */}
            {showLimitModal && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 50,
                background: "rgba(9,10,18,0.92)",
                backdropFilter: "blur(12px)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 20, padding: "32px 24px", textAlign: "center",
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "linear-gradient(135deg,rgba(124,111,255,0.25),rgba(79,70,229,0.15))",
                  border: "2px solid rgba(124,111,255,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 36,
                }}>😢</div>
                <div>
                  <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 900, marginBottom: 8, lineHeight: 1.2 }}>
                    {limitsConfig.limitMessage.split('.')[0] || "Has alcanzado el límite diario"}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.5, maxWidth: 320 }}>
                    Solo puedes ver <strong style={{ color: "#B39DFF" }}>{limitsConfig.dailyLimit} episodios por día</strong> con la cuenta gratuita.
                    <br />El límite se reinicia automáticamente cada día.
                  </div>
                </div>
                <Link href="/membership" style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: "linear-gradient(135deg,#7C6FFF,#5B52F5)",
                  borderRadius: 16, padding: "14px 28px",
                  color: "#fff", fontSize: 16, fontWeight: 900,
                  textDecoration: "none", boxShadow: "0 8px 32px rgba(124,111,255,0.35)",
                }}>
                  👑 {limitsConfig.megafanMessage}
                </Link>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, lineHeight: 1.5 }}>
                  Acceso ilimitado · Sin interrupciones · Mejor calidad
                  <br />Solo <strong style={{ color: "#B39DFF" }}>$4/mes</strong> · Cancela cuando quieras
                </div>
              </div>
            )}

          {animeflvQuery.isError && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 16, position: "absolute", inset: 0, background: "rgba(5,5,12,0.85)", backdropFilter: "blur(6px)" }}>
                <div style={{ width: 60, height: 60, borderRadius: "50%", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AlertCircle size={28} color="#EF4444" />
                </div>
                <div style={{ textAlign: "center", maxWidth: 300, padding: "0 16px" }}>
                  <p style={{ color: "#F1F1F5", fontSize: 16, fontWeight: 800, marginBottom: 6 }}>No disponible</p>
                  <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, lineHeight: 1.6 }}>No se encontró este episodio en JKAnime (Español).</p>
                </div>
                <button
                  onClick={() => { setPlaybackFailureCount(0); setSelectedIdx(0); animeflvQuery.refetch(); }}
                  style={{ padding: "10px 20px", borderRadius: 12, background: "#7C6FFF", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Reintentar
                </button>
              </div>
            )}
            {animeflvQuery.isLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <Loader2 size={36} color="#F59E0B" className="animate-spin" />
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>Buscando episodio en JKAnime (Español Latino)...</p>
              </div>
            )}
            {!selected && !showLimitModal && !animeflvQuery.isLoading && !animeflvQuery.isError && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <AlertCircle size={36} color="rgba(255,255,255,0.2)" />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sin fuentes disponibles</p>
              </div>
            )}
            {!showLimitModal && selected && !animeflvQuery.isLoading && !animeflvQuery.isError && (
              selected.isM3U8 === false ? (
                (selected as any).isEmbed ? (
                  <iframe
                    key={`embed-${episodeId}-${selectedIdx}`}
                    src={selected.url}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", background: "#000" }}
                    allowFullScreen
                    allow="autoplay; fullscreen; picture-in-picture"
                    referrerPolicy="origin"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                  />
                ) : (
                  <video
                    key={`mp4-${episodeId}-${selectedIdx}`}
                    src={proxyStreamUrl(selected.url, activeReferer)}
                    autoPlay
                    controls
                    playsInline
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#000" }}
                  />
                )
              ) : (
                proxyM3u8 ? (
                  <PlyrPlayer
                    key={`${episodeId}-lat-${selectedIdx}`}
                    m3u8Url={proxyM3u8}
                    playbackRate={playbackRate}
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

            {/* ── Skip intro button (first 90s) ── */}
            {!showLimitModal && videoDuration > 0 && currentTime < 90 && currentTime > 2 && (
              <button
                onClick={() => playerControlsRef.current?.seekTo(90)}
                style={{
                  position: "absolute", bottom: 80, right: 16, zIndex: 30,
                  background: "rgba(9,10,18,0.85)", backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10,
                  color: "#F1F1F5", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  padding: "9px 16px", display: "flex", alignItems: "center", gap: 7,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                }}
              >
                <SkipForward size={14} />
                Saltar intro
              </button>
            )}

            {/* ── Skip outro button (last 120s, more than 10s from end) ── */}
            {!showLimitModal && videoDuration > 0 && currentTime >= videoDuration - 120 && currentTime <= videoDuration - 10 && currentTime >= 90 && (
              <button
                onClick={() => playerControlsRef.current?.seekTo(Math.max(0, videoDuration - 8))}
                style={{
                  position: "absolute", bottom: 80, right: 16, zIndex: 30,
                  background: "rgba(9,10,18,0.85)", backdropFilter: "blur(6px)",
                  border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10,
                  color: "#F1F1F5", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  padding: "9px 16px", display: "flex", alignItems: "center", gap: 7,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                }}
              >
                <SkipForward size={14} />
                Saltar final
              </button>
            )}

            {/* ── Mobile gesture overlay (upper 80% of video) ── */}
            <div
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: "80%", zIndex: 8 }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            />

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
          <div style={{ padding: "16px 16px 28px", display: isFullscreen && !fullscreenControlsVisible ? "none" : "flex", flexDirection: "column", gap: 12, transition: "opacity 0.3s", opacity: isFullscreen && !fullscreenControlsVisible ? 0 : 1, background: "linear-gradient(180deg,#0A0B16 0%,#090A12 100%)" }}>
            {/* Episode title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "12px 16px", background: "linear-gradient(135deg,rgba(124,111,255,0.07),rgba(91,82,245,0.04))", border: "1px solid rgba(124,111,255,0.15)", borderRadius: 16, borderLeft: "3px solid rgba(124,111,255,0.6)" }}>
              <div>
                <div style={{ color: "#F1F1F5", fontSize: 15, fontWeight: 800 }}>{animeTitle}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Episodio {episodeNum}</span>
                  <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12 }}>·</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "1px 7px", color: "#F59E0B", fontSize: 11, fontWeight: 700 }}>🇪🇸 Español Latino</span>
                  {hlsSubTracks.length > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 6, padding: "1px 7px", color: "#22C55E", fontSize: 11, fontWeight: 700 }}>CC · Subs</span>
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
                {/* Theater mode */}
                <button
                  onClick={() => setTheaterMode(v => !v)}
                  title={theaterMode ? "Salir del modo teatro" : "Modo teatro"}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                    borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: theaterMode ? "rgba(124,111,255,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${theaterMode ? "rgba(124,111,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: theaterMode ? "#B39DFF" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {theaterMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span className="hidden md:inline">{theaterMode ? "Normal" : "Modo Teatro"}</span>
                </button>
                {/* LAT badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 13px", borderRadius: 9, background: "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,88,12,0.15))", border: "1px solid rgba(245,158,11,0.5)", color: "#F59E0B", fontSize: 12, fontWeight: 800 }}>
                  🇪🇸 LAT
                  {animeflvQuery.isLoading && <span style={{ fontSize: 9, opacity: 0.6 }}>···</span>}
                </div>

                {/* Share button */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`;
                      const shareData = { title: `${animeTitle} — AnimeFlex`, text: `Mira ${animeTitle} en AnimeFlex`, url: shareUrl };
                      if (navigator.share) { try { await navigator.share(shareData); return; } catch {} }
                      setShowShare(v => !v);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700, background: showShare ? "rgba(124,111,255,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${showShare ? "rgba(124,111,255,0.4)" : "rgba(255,255,255,0.1)"}`, color: showShare ? "#B39DFF" : "rgba(255,255,255,0.4)" }}
                  >
                    <Share2 size={14} />
                    <span className="hidden md:inline">Compartir</span>
                  </button>
                  {showShare && (
                    <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200, background: "#1A1A2E", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 10, minWidth: 200, boxShadow: "0 16px 48px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", gap: 6 }}>
                      {[
                        {
                          label: "WhatsApp", color: "#25D366",
                          emoji: "💬",
                          onClick: () => { const url = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`; window.open(`https://wa.me/?text=${encodeURIComponent(`Mira ${animeTitle} en AnimeFlex 🎌\n${url}`)}`); setShowShare(false); }
                        },
                        {
                          label: "Twitter / X", color: "#1DA1F2",
                          emoji: "🐦",
                          onClick: () => { const url = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`; window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Estoy viendo ${animeTitle} en AnimeFlex 🎌`)}&url=${encodeURIComponent(url)}`); setShowShare(false); }
                        },
                        {
                          label: shareCopied ? "¡Copiado!" : "Copiar enlace", color: "#B39DFF",
                          emoji: shareCopied ? "✅" : "🔗",
                          onClick: () => {
                            const url = `${window.location.origin}${import.meta.env.BASE_URL}anime/${animeId}`;
                            navigator.clipboard.writeText(url).catch(() => {});
                            setShareCopied(true);
                            setTimeout(() => { setShareCopied(false); setShowShare(false); }, 1500);
                          }
                        },
                      ].map(item => (
                        <button key={item.label} onClick={item.onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "none", color: "#F1F1F5", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                          <span>{item.emoji}</span> {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Speed */}
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", flexShrink: 0 }}>Velocidad</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
                  {SPEEDS.map((s) => (
                    <button key={s} onClick={() => setPlaybackRate(s)}
                      style={{
                        padding: "5px 13px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: playbackRate === s ? "linear-gradient(135deg,rgba(124,111,255,0.35),rgba(91,82,245,0.25))" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${playbackRate === s ? "rgba(124,111,255,0.7)" : "rgba(255,255,255,0.07)"}`,
                        color: playbackRate === s ? "#B39DFF" : "rgba(255,255,255,0.3)",
                        boxShadow: playbackRate === s ? "0 0 10px rgba(124,111,255,0.25)" : "none",
                        transition: "all 0.12s ease",
                      }}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quality */}
            {sources.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Servidor</div>
                  {selected && (
                    <span style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 800, border: "1px solid rgba(245,158,11,0.25)" }}>
                      {parseLatLabel(selected, selectedIdx)} activo
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sources.map((src, i) => (
                    <button key={i} onClick={() => setSelectedIdx(i)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 10, cursor: "pointer",
                        background: i === selectedIdx ? "linear-gradient(135deg,rgba(245,158,11,0.25),rgba(234,88,12,0.15))" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${i === selectedIdx ? "rgba(245,158,11,0.55)" : "rgba(255,255,255,0.08)"}`,
                        color: i === selectedIdx ? "#F59E0B" : "rgba(255,255,255,0.35)",
                        fontSize: 12, fontWeight: 700,
                        boxShadow: i === selectedIdx ? "0 0 10px rgba(245,158,11,0.15)" : "none",
                        transition: "all 0.12s ease",
                      }}>
                      {parseLatLabel(src, i)}
                      {(src as any).isEmbed && <span style={{ fontSize: 9, opacity: 0.7, background: "rgba(255,255,255,0.08)", borderRadius: 4, padding: "1px 4px" }}>WEB</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}



            {/* Download section */}
            {sources.length > 0 && (
              <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Download size={14} color="#7C6FFF" />
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Descargar</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  {/* dlCopied toast */}
                  {dlCopied && (
                    <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ color: "#22C55E", fontSize: 12, fontWeight: 700, marginBottom: 3 }}>✓ Enlace copiado</div>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 1.5 }}>
                        Abre <span style={{ color: "#7C6FFF", fontWeight: 700 }}>1DM</span> o <span style={{ color: "#7C6FFF", fontWeight: 700 }}>ADM</span>, pega el enlace y descarga el episodio completo.
                      </div>
                    </div>
                  )}

                  {/* Video sources */}
                  <div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, marginBottom: 7 }}>
                      Video · Latino
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {sources.map((src, i) => {
                        const label = parseResolution(src);
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
                                background: "rgba(124,111,255,0.22)", border: "1px solid rgba(124,111,255,0.45)",
                                color: "#B39DFF", fontSize: 12, fontWeight: 700, textDecoration: "none",
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
                              background: isCopied ? "rgba(34,197,94,0.15)" : (i === selectedIdx ? "rgba(124,111,255,0.22)" : "rgba(255,255,255,0.07)"),
                              border: `1px solid ${isCopied ? "rgba(34,197,94,0.4)" : (i === selectedIdx ? "rgba(124,111,255,0.45)" : "rgba(255,255,255,0.1)")}`,
                              color: isCopied ? "#22C55E" : (i === selectedIdx ? "#B39DFF" : "rgba(255,255,255,0.55)"),
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
                        Toca una calidad para copiar el enlace → ábrelo en <span style={{ color: "#7C6FFF" }}>1DM</span> o <span style={{ color: "#7C6FFF" }}>ADM</span>
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

      {/* Episode list for mobile/tablet */}
      {animeId && (
        <div style={{ margin: "0 12px 32px", maxWidth: 1376 }} className="lg:hidden">
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
              background: "#0E0E1A", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, padding: 28, maxWidth: 440, width: "100%",
              boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <HelpCircle size={18} color="#B39DFF" />
                <span style={{ color: "#F1F1F5", fontSize: 16, fontWeight: 800 }}>Atajos de teclado</span>
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
                  <kbd style={{ background: "rgba(124,111,255,0.2)", color: "#B39DFF", border: "1px solid rgba(124,111,255,0.35)", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
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
    </div>
  );
}
