import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import {
  ArrowLeft, SkipForward, AlertCircle, Loader2, Play, X,
  Users, Captions, ChevronLeft, ChevronRight, List, Maximize2, Minimize2
} from "lucide-react";
import {
  consumet,
  proxyStreamUrl,
  proxySubtitleUrl,
  type StreamingSource,
} from "@/lib/consumet";
import { useWatchProgress } from "@/context/WatchProgressContext";

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
    <div style={{ position: "absolute", bottom: 80, right: 16, zIndex: 50, background: "rgba(9,10,18,0.92)", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 16, padding: "16px 20px", minWidth: 220, backdropFilter: "blur(8px)" }}>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>Siguiente episodio en {secs}s</div>
      <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Episodio {nextNum}</div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#6C63FF", borderRadius: 2, width: `${(secs / 10) * 100}%`, transition: "width 1s linear" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSkip} style={{ flex: 1, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", border: "none", borderRadius: 10, padding: "9px 0", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
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
}

function PlyrPlayer({ m3u8Url, playbackRate, startAt, fullscreenContainer, onTimeUpdate, onEnded, onSubtitleTracks, activeHlsSubId, onSubtitleCue }: PlyrPlayerProps) {
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
          <Loader2 size={36} className="animate-spin text-[#6C63FF]" />
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
          <List size={15} color="#6C63FF" />
          <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Episodios</span>
          {episodes.length > 0 && <span style={{ background: "rgba(108,99,255,0.15)", color: "#A78BFA", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{episodes.length}</span>}
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
            <Loader2 size={20} className="animate-spin" style={{ color: "#6C63FF" }} />
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
                background: isCurrent ? "rgba(108,99,255,0.18)" : "transparent",
                border: `1px solid ${isCurrent ? "rgba(108,99,255,0.4)" : "transparent"}`,
                cursor: isCurrent ? "default" : "pointer",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (!isCurrent) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                background: isCurrent ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isCurrent
                  ? <Play size={14} color="#A78BFA" fill="#A78BFA" />
                  : <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700 }}>{ep.number}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: isCurrent ? "#A78BFA" : "#F1F1F5", fontSize: 12, fontWeight: isCurrent ? 800 : 600 }} className="line-clamp-1">
                  {ep.title ? ep.title : `Episodio ${ep.number}`}
                </div>
                {pct > 0 && (
                  <div style={{ height: 2, background: "rgba(255,255,255,0.1)", borderRadius: 1, marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: isCurrent ? "#6C63FF" : "#22C55E", width: `${Math.round(pct * 100)}%`, borderRadius: 1 }} />
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
  const nextEpisodeId = params.get("nextEpisodeId") ?? "";
  const nextEpisodeNum = params.get("nextEpisodeNum") ?? "";

  const { saveProgress, getProgress } = useWatchProgress();
  const savedProgress = getProgress(episodeId);
  const startAt = savedProgress?.currentTime;

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeSubUrl, setActiveSubUrl] = useState<string | null>(null);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showAutoNext, setShowAutoNext] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [hlsSubTracks, setHlsSubTracks] = useState<HlsSubTrack[]>([]);
  const [activeHlsSubId, setActiveHlsSubId] = useState<number>(-1);
  const [hlsCueText, setHlsCueText] = useState<string | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);

  const query = useQuery({
    queryKey: ["streaming", episodeId],
    queryFn: () => consumet.streaming(episodeId),
    enabled: !!episodeId,
    retry: 3,
    retryDelay: (i) => Math.min(600 * Math.pow(2, i), 6000),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 8,
    refetchOnWindowFocus: false,
  });

  const sources = query.data ? sortSources(query.data.sources ?? []) : [];
  const streamingHeaders = query.data?.headers ?? {};
  const referer = streamingHeaders["Referer"] ?? streamingHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;

  const streamSubtitles = query.data?.subtitles ?? [];
  const streamSpanishSub =
    streamSubtitles.find((s) => /español.*españa|spanish.*esp/i.test(s.lang)) ??
    streamSubtitles.find((s) => /español|spanish|spa/i.test(s.lang)) ??
    null;

  useEffect(() => {
    setSelectedIdx(0);
    setActiveSubUrl(null);
    setHlsSubTracks([]);
    setActiveHlsSubId(-1);
    setHlsCueText(null);
    setCurrentTime(0);
    setShowAutoNext(false);
  }, [episodeId]);

  // Auto-load VTT subtitle from stream source (with referer for CDN auth)
  useEffect(() => {
    if (!streamSpanishSub) return;
    const proxied = proxySubtitleUrl(streamSpanishSub.url, referer);
    setActiveSubUrl(proxied);
    setSubtitlesEnabled(true);
  }, [streamSpanishSub?.url, referer]);

  // Auto-select Spanish HLS embedded subtitle track (secondary path)
  const handleSubtitleTracks = useCallback((tracks: HlsSubTrack[]) => {
    setHlsSubTracks(tracks);
    if (activeSubUrl) return; // VTT already loaded, skip HLS fallback
    const spanish =
      tracks.find(t => /español.*españa|spanish.*esp/i.test(t.lang + " " + t.name)) ??
      tracks.find(t => /español|spanish|spa|es$/i.test(t.lang + " " + t.name)) ??
      null;
    if (spanish) {
      setActiveHlsSubId(spanish.id);
      setSubtitlesEnabled(true);
    }
  }, [activeSubUrl]);

  const handleSubtitleCue = useCallback((text: string | null) => {
    setHlsCueText(text);
  }, []);

  const proxyM3u8 = selected ? proxyStreamUrl(selected.url, referer) : null;

  const handleTimeUpdate = useCallback((ct: number, duration: number) => {
    setCurrentTime(ct);
    if (!animeId) return;
    saveProgress({ episodeId, episodeNum: parseInt(episodeNum) || 0, animeId, animeTitle, animeImage, currentTime: ct, duration });
  }, [episodeId, episodeNum, animeId, animeTitle, animeImage, saveProgress]);

  const handleNextEpisode = useCallback(() => {
    if (!nextEpisodeId) return;
    setShowAutoNext(false);
    const p = new URLSearchParams({ episodeId: nextEpisodeId, episodeNum: nextEpisodeNum, animeTitle, animeId, animeImage });
    navigate(`/watch?${p.toString()}`);
  }, [nextEpisodeId, nextEpisodeNum, animeTitle, animeId, animeImage, navigate]);

  const handleEnded = useCallback(() => { if (nextEpisodeId) setShowAutoNext(true); }, [nextEpisodeId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  const hasSpanishSubs = !!activeSubUrl || activeHlsSubId !== -1;
  // HLS cue text takes priority; VTT parsed cue is handled inside SubtitleOverlay
  const vttSubUrl = subtitlesEnabled && !hlsCueText && activeSubUrl ? activeSubUrl : null;
  const hlsCueToRender = subtitlesEnabled && activeHlsSubId !== -1 ? hlsCueText : null;

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(9,10,18,0.98)" }}>
        <button onClick={() => animeId ? navigate(`/anime/${animeId}`) : navigate("/")}
          style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.65)", flexShrink: 0 }}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{animeTitle}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>Episodio {episodeNum}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={handleCopyLink}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            <Users size={13} /> <span className="hidden md:inline">Ver juntos</span>
          </button>
          {nextEpisodeId && (
            <button onClick={handleNextEpisode}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
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
                <Loader2 size={36} className="animate-spin" style={{ color: "#6C63FF" }} />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
                  {query.failureCount > 0 ? `Reconectando... (intento ${query.failureCount + 1})` : "Cargando episodio..."}
                </p>
              </div>
            )}
            {query.isError && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <AlertCircle size={36} color="#EF4444" />
                <p style={{ color: "#F1F1F5", fontSize: 14 }}>No se pudo cargar el episodio</p>
                <button onClick={() => query.refetch()} style={{ padding: "8px 16px", borderRadius: 10, background: "#6C63FF", border: "none", color: "#fff", fontSize: 13, cursor: "pointer" }}>Reintentar</button>
              </div>
            )}
            {!query.isLoading && !query.isError && !selected && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12, position: "absolute", inset: 0 }}>
                <AlertCircle size={36} color="rgba(255,255,255,0.2)" />
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sin fuentes disponibles</p>
              </div>
            )}
            {!query.isLoading && !query.isError && selected && proxyM3u8 && (
              <PlyrPlayer
                key={`${episodeId}-${selectedIdx}`}
                m3u8Url={proxyM3u8}
                playbackRate={playbackRate}
                startAt={startAt}
                fullscreenContainer="#plyr-fullscreen-container"
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onSubtitleTracks={handleSubtitleTracks}
                activeHlsSubId={subtitlesEnabled ? activeHlsSubId : -1}
                onSubtitleCue={handleSubtitleCue}
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
          </div>

          {/* Controls below video */}
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Episode title row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ color: "#F1F1F5", fontSize: 16, fontWeight: 800 }}>{animeTitle}</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 2 }}>Episodio {episodeNum}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Theater mode */}
                <button
                  onClick={() => setTheaterMode(v => !v)}
                  title={theaterMode ? "Salir del modo teatro" : "Modo teatro"}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                    borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: theaterMode ? "rgba(108,99,255,0.2)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${theaterMode ? "rgba(108,99,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                    color: theaterMode ? "#A78BFA" : "rgba(255,255,255,0.4)",
                  }}
                >
                  {theaterMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span className="hidden md:inline">{theaterMode ? "Normal" : "Modo Teatro"}</span>
                </button>
                {/* Subtitle toggle */}
                {hasSpanishSubs && (
                  <button onClick={() => setSubtitlesEnabled(v => !v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 7, padding: "8px 14px",
                      borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: subtitlesEnabled ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${subtitlesEnabled ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)"}`,
                      color: subtitlesEnabled ? "#22C55E" : "rgba(255,255,255,0.4)",
                    }}>
                    <Captions size={14} />
                    {subtitlesEnabled ? "SUB ES — Activo" : "Subtítulos — Desactivado"}
                  </button>
                )}
              </div>
            </div>

            {/* Speed */}
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Velocidad</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => setPlaybackRate(s)}
                    style={{ padding: "6px 14px", borderRadius: 10, background: playbackRate === s ? "rgba(108,99,255,0.2)" : "transparent", border: `1px solid ${playbackRate === s ? "#6C63FF" : "rgba(255,255,255,0.1)"}`, color: playbackRate === s ? "#A78BFA" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            {sources.length > 1 && (
              <div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Calidad</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sources.map((src, i) => (
                    <button key={i} onClick={() => setSelectedIdx(i)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 10, background: i === selectedIdx ? "rgba(108,99,255,0.2)" : "transparent", border: `1px solid ${i === selectedIdx ? "#6C63FF" : "rgba(255,255,255,0.1)"}`, color: i === selectedIdx ? "#A78BFA" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {parseResolution(src)}
                      {isDub(src) && <span style={{ background: "rgba(59,130,246,0.3)", color: "#3B82F6", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 4px" }}>DUB</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subtitles section */}
            <div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                Subtítulos en Español
              </div>
              {query.isLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
                  <Loader2 size={12} className="animate-spin" /> Cargando episodio...
                </div>
              )}
              {!query.isLoading && streamSpanishSub && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#22C55E", fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                  {streamSpanishSub.lang} — incluidos en la fuente, activos automáticamente
                </div>
              )}
              {!query.isLoading && !streamSpanishSub && hlsSubTracks.some(t => /español|spanish|spa/i.test(t.lang + " " + t.name)) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#22C55E", fontSize: 12 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
                  Español (HLS) — activos automáticamente
                </div>
              )}
              {!query.isLoading && !streamSpanishSub && !hlsSubTracks.some(t => /español|spanish|spa/i.test(t.lang + " " + t.name)) && (
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>No se encontraron subtítulos en español para este episodio.</p>
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
    </div>
  );
}
