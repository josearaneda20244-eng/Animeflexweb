import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import {
  ArrowLeft, SkipForward, AlertCircle, Loader2, Play, X,
  Users, Captions, ChevronLeft, ChevronRight, List, Maximize2, Minimize2,
  Share2, Copy, Check as CheckIcon, HelpCircle, FastForward, Rewind,
} from "lucide-react";
import {
  consumet,
  proxyStreamUrl,
  proxySubtitleUrl,
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

function isDub(src: StreamingSource) { return /eng|dub/i.test(src.quality ?? ""); }
function parseResolution(src: StreamingSource) {
  const m = (src.quality ?? "").match(/(\d{3,4})p/i);
  if (m) return m[1] + "p";
  const m2 = (src.quality ?? "").match(/\b(\d{3,4})\b/);
  if (m2) return m2[1] + "p";
  return (src.quality ?? "").trim() || "Auto";
}
function sortSources(sources: StreamingSource[]) {
  return [...sources].sort((a, b) => {
    const subA = isDub(a) ? 1 : 0;
    const subB = isDub(b) ? 1 : 0;
    if (subA !== subB) return subA - subB;
    const res = (s: StreamingSource) => { const m = (s.quality ?? "").match(/(\d{3,4})/); return m ? parseInt(m[1]) : 0; };
    return res(b) - res(a);
  });
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
  text, subtitleUrl, currentTime,
}: {
  text?: string | null;
  subtitleUrl?: string | null;
  currentTime?: number;
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
  return (
    <div style={{
      position: "absolute", bottom: "8%", left: 0, right: 0, zIndex: 20,
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
}

function PlyrPlayer({ m3u8Url, playbackRate, startAt, fullscreenContainer, onTimeUpdate, onEnded, onSubtitleTracks, activeHlsSubId, onSubtitleCue, controlsRef }: PlyrPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startAtRef = useRef(startAt);
  const seekRestoredRef = useRef(false);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  const onSubtitleTracksRef = useRef(onSubtitleTracks);
  const onSubtitleCueRef = useRef(onSubtitleCue);

  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { startAtRef.current = startAt; }, [startAt]);
  useEffect(() => { onSubtitleTracksRef.current = onSubtitleTracks; }, [onSubtitleTracks]);
  useEffect(() => { onSubtitleCueRef.current = onSubtitleCue; }, [onSubtitleCue]);

  // Switch active HLS subtitle track when prop changes
  useEffect(() => {
    if (hlsRef.current && activeHlsSubId !== undefined) {
      hlsRef.current.subtitleTrack = activeHlsSubId;
    }
  }, [activeHlsSubId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setError(null);
    seekRestoredRef.current = false;
    if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const plyr = new Plyr(video, {
      controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "pip", "fullscreen"],
      autoplay: true,
      keyboard: { focused: true, global: true },
      tooltips: { controls: false, seek: true },
      fullscreen: { enabled: true, fallback: true, iosNative: false, container: fullscreenContainer ?? undefined },
    });
    plyrRef.current = plyr;

    if (controlsRef) {
      controlsRef.current = {
        seekTo: (t: number) => { video.currentTime = t; },
        getVolume: () => plyr.volume ?? 1,
        setVolume: (v: number) => { plyr.volume = Math.max(0, Math.min(1, v)); },
      };
    }

    const trySeekRestore = () => {
      if (seekRestoredRef.current) return;
      const target = startAtRef.current;
      if (!target || target <= 5) { seekRestoredRef.current = true; return; }
      const dur = video.duration;
      if (dur && isFinite(dur) && target < dur - 5) {
        video.currentTime = target;
        seekRestoredRef.current = true;
      }
    };

    const onLoadedMetadata = () => {
      trySeekRestore();
    };

    const onTimeUpd = () => {
      if (video.duration > 0) {
        if (!seekRestoredRef.current) trySeekRestore();
        onTimeUpdateRef.current?.(video.currentTime, video.duration);
      }
    };
    const onEnd = () => { onEndedRef.current?.(); };

    // Track cue changes across all subtitle text tracks
    const handleCueChange = () => {
      let text: string | null = null;
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        if ((track.kind === "subtitles" || track.kind === "captions") && track.mode !== "disabled" && track.activeCues && track.activeCues.length > 0) {
          text = Array.from(track.activeCues)
            .map(c => (c as VTTCue).text.replace(/<[^>]+>/g, ""))
            .join("\n");
          break;
        }
      }
      onSubtitleCueRef.current?.(text);
    };

    const handleAddTrack = (e: TrackEvent) => {
      const track = e.track;
      if (track && (track.kind === "subtitles" || track.kind === "captions")) {
        track.mode = "hidden";
        track.addEventListener("cuechange", handleCueChange);
      }
    };

    video.textTracks.addEventListener("addtrack", handleAddTrack as EventListener);

    let loadTimeout: ReturnType<typeof setTimeout> | null = null;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 240,
        startLevel: -1,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 30000,
        maxBufferHole: 1,
      });
      hlsRef.current = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
        const tracks: HlsSubTrack[] = (data.subtitleTracks ?? []).map(t => ({
          id: t.id,
          lang: t.lang ?? t.name ?? "",
          name: t.name ?? t.lang ?? "",
        }));
        if (tracks.length > 0) onSubtitleTracksRef.current?.(tracks);
      });

      let networkErrCount = 0;
      let mediaErrCount = 0;
      loadTimeout = setTimeout(() => {
        setError("Tiempo de carga agotado. Intenta de nuevo.");
        setLoading(false);
      }, 60000);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
        networkErrCount = 0;
        mediaErrCount = 0;
        setLoading(false);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        networkErrCount = 0;
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            networkErrCount++;
            if (networkErrCount > 8) {
              if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
              setError("Error de red al cargar el episodio. Intenta de nuevo.");
              setLoading(false);
            } else {
              setTimeout(() => hls.startLoad(), 1000);
            }
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaErrCount++;
            if (mediaErrCount > 3) {
              if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
              setError("Error de medios al reproducir el episodio.");
              setLoading(false);
              return;
            }
            const savedTime = video.currentTime;
            hls.recoverMediaError();
            if (savedTime > 5) {
              const restoreTime = () => {
                if (video.currentTime < savedTime - 2) {
                  video.currentTime = savedTime;
                }
                video.removeEventListener("canplay", restoreTime);
              };
              video.addEventListener("canplay", restoreTime);
            }
          } else {
            if (loadTimeout) { clearTimeout(loadTimeout); loadTimeout = null; }
            setError("Error al reproducir el episodio.");
            setLoading(false);
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = m3u8Url;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        trySeekRestore();
        video.play().catch(() => {});
      }, { once: true });
    } else {
      setError("Tu navegador no soporta reproducción HLS.");
      setLoading(false);
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpd);
    video.addEventListener("ended", onEnd);
    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpd);
      video.removeEventListener("ended", onEnd);
      video.textTracks.removeEventListener("addtrack", handleAddTrack as EventListener);
      if (loadTimeout) clearTimeout(loadTimeout);
      if (controlsRef) controlsRef.current = null;
      if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [m3u8Url]);

  useEffect(() => {
    const video = videoRef.current;
    if (video && playbackRate) {
      video.playbackRate = playbackRate;
      if (plyrRef.current) plyrRef.current.speed = playbackRate;
    }
  }, [playbackRate]);

  return (
    <div className="relative w-full h-full bg-black">
      <video ref={videoRef} playsInline className="w-full h-full" style={{ display: "block" }} />
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 pointer-events-none">
          <Loader2 size={36} className="animate-spin text-[#7C6FFF]" />
          <p className="text-sm text-[#9090B0]">Cargando episodio...</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80">
          <AlertCircle size={36} className="text-[#EF4444]" />
          <p className="text-sm text-[#F0F0FF]">{error}</p>
        </div>
      )}
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
  const PAGE_SIZE = 24;

  const episodesQuery = useQuery({
    queryKey: ["animeEpisodesById", animeId],
    queryFn: () => consumet.episodesById(animeId),
    enabled: !!animeId,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const episodes = episodesQuery.data?.episodes ?? [];
  const totalPages = Math.ceil(episodes.length / PAGE_SIZE);
  const pageEps = episodes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{page + 1}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              style={{ padding: 5, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", cursor: page === totalPages - 1 ? "default" : "pointer", opacity: page === totalPages - 1 ? 0.3 : 1 }}>
              <ChevronRight size={14} color="#fff" />
            </button>
          </div>
        )}
      </div>

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
          const globalIdx = page * PAGE_SIZE + idx;
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
  const [activeSubUrl, setActiveSubUrl] = useState<string | null>(null);
  const [subLang, setSubLang] = useState<"es" | "en" | "off">("es");
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showAutoNext, setShowAutoNext] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
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

  const query = useQuery({
    queryKey: ["streaming", episodeId],
    queryFn: () => consumet.streaming(episodeId, animeTitle || undefined, episodeNum || undefined),
    enabled: !!episodeId,
    retry: (failCount, error: any) => {
      if (error?.status === 403) return false;
      return failCount < 3;
    },
    retryDelay: (i) => Math.min(600 * Math.pow(2, i), 6000),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const err: any = query.error;
    if (err?.status === 403 && err?.limitReached) {
      setShowLimitModal(true);
    }
  }, [query.error]);

  const sources = query.data ? sortSources(query.data.sources ?? []) : [];
  const streamingHeaders = query.data?.headers ?? {};
  const referer = streamingHeaders["Referer"] ?? streamingHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;

  const streamSubtitles = query.data?.subtitles ?? [];
  const streamSpanishSub =
    streamSubtitles.find((s) => /español.*españa|spanish.*esp/i.test(s.lang)) ??
    streamSubtitles.find((s) => /español|spanish|spa/i.test(s.lang)) ??
    null;
  const streamEnglishSub =
    streamSubtitles.find((s) => /english.*us|english/i.test(s.lang)) ??
    streamSubtitles.find((s) => /eng|^en$/i.test(s.lang)) ??
    null;

  useEffect(() => {
    setSelectedIdx(0);
    setActiveSubUrl(null);
    setHlsSubTracks([]);
    setActiveHlsSubId(-1);
    setHlsCueText(null);
    setCurrentTime(0);
    setVideoDuration(0);
    currentTimeRef.current = 0;
    durationRef.current = 0;
    setShowAutoNext(false);
    setServerRemaining(null);
    setSubLang("es");
    episodeRegisteredRef.current = false;
    // El modal de límite lo gestiona el useEffect de /user/daily-access arriba
  }, [episodeId]);

  // Auto-load VTT subtitle based on selected language
  useEffect(() => {
    if (subLang === "off") { setActiveSubUrl(null); return; }
    const target = subLang === "en" ? streamEnglishSub : streamSpanishSub;
    if (target) {
      setActiveSubUrl(proxySubtitleUrl(target.url, referer));
    } else {
      setActiveSubUrl(null);
    }
  }, [subLang, streamSpanishSub?.url, streamEnglishSub?.url, referer]);

  // Auto-select HLS embedded subtitle track based on subLang
  const handleSubtitleTracks = useCallback((tracks: HlsSubTrack[]) => {
    setHlsSubTracks(tracks);
    if (activeSubUrl) return; // VTT already loaded, skip HLS
    if (subLang === "off") { setActiveHlsSubId(-1); return; }
    const isEn = subLang === "en";
    const match = isEn
      ? (tracks.find(t => /english.*us|english/i.test(t.lang + " " + t.name)) ?? tracks.find(t => /eng|^en$/i.test(t.lang + " " + t.name)))
      : (tracks.find(t => /español.*españa|spanish.*esp/i.test(t.lang + " " + t.name)) ?? tracks.find(t => /español|spanish|spa|es$/i.test(t.lang + " " + t.name)));
    if (match) setActiveHlsSubId(match.id);
  }, [activeSubUrl, subLang]);

  const handleSubtitleCue = useCallback((text: string | null) => {
    setHlsCueText(text);
  }, []);

  const proxyM3u8 = selected ? proxyStreamUrl(selected.url, referer) : null;

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

  const hasSubtitles = !!activeSubUrl || activeHlsSubId !== -1;
  // HLS cue text takes priority; VTT parsed cue is handled inside SubtitleOverlay
  const vttSubUrl = subLang !== "off" && !hlsCueText && activeSubUrl ? activeSubUrl : null;
  const hlsCueToRender = subLang !== "off" && activeHlsSubId !== -1 ? hlsCueText : null;

  return (
    <div style={{ minHeight: "100vh", background: "#07080F" }}>
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
            {query.isLoading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <Loader2 size={36} className="animate-spin" style={{ color: "#7C6FFF" }} />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                  {query.failureCount > 0 ? `Reconectando... (intento ${query.failureCount + 1})` : "Cargando episodio..."}
                </p>
              </div>
            )}
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

          {query.isError && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <AlertCircle size={36} color="#EF4444" />
                <p style={{ color: "#F1F1F5", fontSize: 14 }}>No se pudo cargar el episodio</p>
                <button onClick={() => query.refetch()} style={{ padding: "8px 16px", borderRadius: 10, background: "#7C6FFF", border: "none", color: "#fff", fontSize: 13, cursor: "pointer" }}>Reintentar</button>
              </div>
            )}
            {!query.isLoading && !query.isError && !selected && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <AlertCircle size={36} color="rgba(255,255,255,0.2)" />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sin fuentes disponibles</p>
              </div>
            )}
            {!showLimitModal && !query.isLoading && !query.isError && selected && proxyM3u8 && (
              <PlyrPlayer
                key={`${episodeId}-${selectedIdx}`}
                m3u8Url={proxyM3u8}
                playbackRate={playbackRate}
                startAt={startAt}
                fullscreenContainer="#plyr-fullscreen-container"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onSubtitleTracks={handleSubtitleTracks}
                activeHlsSubId={subLang !== "off" ? activeHlsSubId : -1}
                onSubtitleCue={handleSubtitleCue}
                controlsRef={playerControlsRef}
              />
            )}
            {/* Custom subtitle overlay — VTT primary, HLS cue fallback */}
            <SubtitleOverlay
              text={hlsCueToRender}
              subtitleUrl={vttSubUrl}
              currentTime={currentTime}
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
          <div style={{ padding: "14px 16px", display: isFullscreen && !fullscreenControlsVisible ? "none" : "flex", flexDirection: "column", gap: 18, transition: "opacity 0.3s", opacity: isFullscreen && !fullscreenControlsVisible ? 0 : 1 }}>
            {/* Episode title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ color: "#F1F1F5", fontSize: 16, fontWeight: 800 }}>{animeTitle}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>Episodio {episodeNum}</div>
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
                {/* Subtitle language selector */}
                {(streamSpanishSub || streamEnglishSub || hlsSubTracks.length > 0) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Captions size={14} style={{ color: subLang !== "off" ? "#22C55E" : "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                    {(["es", "en", "off"] as const).map((lang) => {
                      const active = subLang === lang;
                      const hasLang = lang === "es"
                        ? (!!streamSpanishSub || hlsSubTracks.some(t => /español|spanish|spa|es$/i.test(t.lang + t.name)))
                        : lang === "en"
                        ? (!!streamEnglishSub || hlsSubTracks.some(t => /english|eng|^en$/i.test(t.lang + t.name)))
                        : true;
                      if (!hasLang && lang !== "off") return null;
                      return (
                        <button key={lang} onClick={() => setSubLang(lang)}
                          style={{
                            padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer",
                            background: active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${active ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)"}`,
                            color: active ? "#22C55E" : "rgba(255,255,255,0.35)",
                          }}>
                          {lang === "off" ? "OFF" : lang.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                )}
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
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Velocidad</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => setPlaybackRate(s)}
                    style={{ padding: "6px 14px", borderRadius: 10, background: playbackRate === s ? "rgba(124,111,255,0.2)" : "transparent", border: `1px solid ${playbackRate === s ? "#7C6FFF" : "rgba(255,255,255,0.1)"}`, color: playbackRate === s ? "#B39DFF" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            {sources.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Calidad</div>
                  {selected && (
                    <span style={{ background: "rgba(124,111,255,0.2)", color: "#B39DFF", borderRadius: 6, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>
                      {parseResolution(selected)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sources.map((src, i) => (
                    <button key={i} onClick={() => setSelectedIdx(i)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 10, background: i === selectedIdx ? "rgba(124,111,255,0.2)" : "transparent", border: `1px solid ${i === selectedIdx ? "#7C6FFF" : "rgba(255,255,255,0.1)"}`, color: i === selectedIdx ? "#B39DFF" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {parseResolution(src)}
                      {isDub(src) && <span style={{ background: "rgba(59,130,246,0.3)", color: "#3B82F6", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 4px" }}>DUB</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subtitles section */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Subtítulos</div>
                {(streamSpanishSub || streamEnglishSub || hlsSubTracks.length > 0) && (
                  <div style={{ display: "flex", gap: 4 }}>
                    {(["es", "en", "off"] as const).map((lang) => {
                      const hasLang = lang === "es"
                        ? (!!streamSpanishSub || hlsSubTracks.some(t => /español|spanish|spa|es$/i.test(t.lang + t.name)))
                        : lang === "en"
                        ? (!!streamEnglishSub || hlsSubTracks.some(t => /english|eng|^en$/i.test(t.lang + t.name)))
                        : true;
                      if (!hasLang && lang !== "off") return null;
                      const active = subLang === lang;
                      return (
                        <button key={lang} onClick={() => setSubLang(lang)}
                          style={{ padding: "4px 9px", borderRadius: 7, fontSize: 10, fontWeight: 800, cursor: "pointer",
                            background: active ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                            border: `1px solid ${active ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)"}`,
                            color: active ? "#22C55E" : "rgba(255,255,255,0.35)" }}>
                          {lang === "off" ? "OFF" : lang.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {query.isLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  <Loader2 size={12} className="animate-spin" /> Cargando episodio...
                </div>
              )}
              {!query.isLoading && (streamSpanishSub || streamEnglishSub) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {streamSpanishSub && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: subLang === "es" ? "#22C55E" : "rgba(255,255,255,0.3)", fontSize: 12 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: subLang === "es" ? "#22C55E" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                      {streamSpanishSub.lang} — disponible
                    </div>
                  )}
                  {streamEnglishSub && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: subLang === "en" ? "#22C55E" : "rgba(255,255,255,0.3)", fontSize: 12 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: subLang === "en" ? "#22C55E" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                      {streamEnglishSub.lang} — disponible
                    </div>
                  )}
                </div>
              )}
              {!query.isLoading && !streamSpanishSub && !streamEnglishSub && hlsSubTracks.some(t => /español|spanish|spa|es$|english|eng|^en$/i.test(t.lang + t.name)) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#22C55E", fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                  Pistas HLS — disponibles
                </div>
              )}
              {!query.isLoading && !streamSpanishSub && !streamEnglishSub && !hlsSubTracks.length && (
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>No se encontraron subtítulos para este episodio.</p>
              )}
            </div>
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
        <div style={{ margin: "0 12px 24px", maxWidth: 1376 }} className="lg:hidden">
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
