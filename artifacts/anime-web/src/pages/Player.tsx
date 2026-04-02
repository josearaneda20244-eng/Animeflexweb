import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { ArrowLeft, SkipForward, AlertCircle, Loader2, Play, X, Users, Link2 } from "lucide-react";
import {
  consumet,
  proxyStreamUrl,
  proxySubtitleUrl,
  type StreamingSource,
  type SubtitleResult,
} from "@/lib/consumet";
import { useWatchProgress } from "@/context/WatchProgressContext";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function isDub(src: StreamingSource) {
  return /eng|dub/i.test(src.quality ?? "");
}

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
    const res = (s: StreamingSource) => {
      const m = (s.quality ?? "").match(/(\d{3,4})/);
      return m ? parseInt(m[1]) : 0;
    };
    return res(b) - res(a);
  });
}

/* ── AUTO-NEXT COUNTDOWN OVERLAY ── */
function AutoNextOverlay({
  nextNum,
  onSkip,
  onCancel,
}: {
  nextNum: string;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [secs, setSecs] = useState(10);

  useEffect(() => {
    if (secs <= 0) { onSkip(); return; }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onSkip]);

  const pct = (secs / 10) * 100;

  return (
    <div style={{
      position: "absolute", bottom: 80, right: 16, zIndex: 50,
      background: "rgba(9,10,18,0.92)", border: "1px solid rgba(108,99,255,0.3)",
      borderRadius: 16, padding: "16px 20px", minWidth: 220,
      backdropFilter: "blur(8px)",
    }}>
      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 6, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
        Siguiente episodio en {secs}s
      </div>
      <div style={{ color: "#F1F1F5", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
        Episodio {nextNum}
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, marginBottom: 12, overflow: "hidden" }}>
        <div style={{ height: "100%", background: "#6C63FF", borderRadius: 2, width: `${pct}%`, transition: "width 1s linear" }} />
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

interface PlyrPlayerProps {
  m3u8Url: string;
  subtitleUrl?: string | null;
  playbackRate: number;
  startAt?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

function PlyrPlayer({ m3u8Url, subtitleUrl, playbackRate, startAt, onTimeUpdate, onEnded }: PlyrPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startAtRef = useRef(startAt);
  const seekRestoredRef = useRef(false);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);

  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);
  useEffect(() => { startAtRef.current = startAt; }, [startAt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);
    seekRestoredRef.current = false;

    if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const plyr = new Plyr(video, {
      controls: [
        "play-large", "play", "progress", "current-time", "duration",
        "mute", "volume", "captions", "settings", "pip", "fullscreen",
      ],
      settings: ["captions", "quality", "speed"],
      speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      autoplay: true,
      keyboard: { focused: true, global: true },
      tooltips: { controls: false, seek: true },
      captions: { active: true, language: "es", update: true },
    });
    plyrRef.current = plyr;

    const onReady = () => {
      if (!seekRestoredRef.current && startAtRef.current && startAtRef.current > 5) {
        const dur = video.duration;
        if (dur && startAtRef.current < dur - 10) {
          video.currentTime = startAtRef.current;
        }
        seekRestoredRef.current = true;
      }
    };

    const onTimeUpd = () => {
      if (video.duration > 0) {
        onTimeUpdateRef.current?.(video.currentTime, video.duration);
      }
    };

    const onEnd = () => {
      onEndedRef.current?.();
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 240,
        startLevel: -1,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 20000,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
      });
      hlsRef.current = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        onReady();
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else { setError("Error al reproducir el episodio."); setLoading(false); }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = m3u8Url;
      video.addEventListener("loadedmetadata", () => { setLoading(false); onReady(); video.play().catch(() => {}); }, { once: true });
    } else {
      setError("Tu navegador no soporta reproducción HLS.");
      setLoading(false);
    }

    video.addEventListener("timeupdate", onTimeUpd);
    video.addEventListener("ended", onEnd);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpd);
      video.removeEventListener("ended", onEnd);
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const existing = video.querySelectorAll('track[kind="subtitles"]');
    existing.forEach((t) => t.remove());
    if (subtitleUrl) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = "Español";
      track.srclang = "es";
      track.src = subtitleUrl;
      track.default = true;
      video.appendChild(track);
      const tryEnable = () => {
        for (let i = 0; i < video.textTracks.length; i++) video.textTracks[i].mode = "showing";
        if (plyrRef.current) { try { plyrRef.current.currentTrack = 0; } catch {} }
      };
      tryEnable();
      const t = setTimeout(tryEnable, 600);
      return () => clearTimeout(t);
    }
  }, [subtitleUrl]);

  return (
    <div className="relative w-full h-full bg-black">
      <video ref={videoRef} crossOrigin="anonymous" playsInline className="w-full h-full" style={{ display: "block" }} />
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
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [activeSubUrl, setActiveSubUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [showAutoNext, setShowAutoNext] = useState(false);
  const [copyToast, setCopyToast] = useState(false);

  const query = useQuery({
    queryKey: ["streaming", episodeId],
    queryFn: () => consumet.streaming(episodeId),
    enabled: !!episodeId,
    retry: 2,
    staleTime: 1000 * 60 * 5,
  });

  const epNum = parseInt(episodeNum) || undefined;
  const streamSubtitles = query.data?.subtitles ?? [];
  const streamSpanishSub =
    streamSubtitles.find((s) => /español.*españa/i.test(s.lang)) ??
    streamSubtitles.find((s) => /español|spanish|spa/i.test(s.lang)) ??
    null;

  const subsQuery = useQuery({
    queryKey: ["subtitles", animeTitle, epNum],
    queryFn: () => consumet.searchSubtitles(animeTitle, epNum, "es"),
    enabled: !!animeTitle && query.isSuccess && !streamSpanishSub,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const downloadMutation = useMutation({
    mutationFn: async (sub: SubtitleResult) => {
      if (!sub.fileId) throw new Error("No fileId");
      const { url } = await consumet.downloadSubtitle(sub.fileId);
      return proxySubtitleUrl(url);
    },
    onSuccess: (proxiedUrl, sub) => { setActiveSubId(sub.id); setActiveSubUrl(proxiedUrl); },
  });

  const sources = query.data ? sortSources(query.data.sources ?? []) : [];
  const streamingHeaders = query.data?.headers ?? {};
  const referer = streamingHeaders["Referer"] ?? streamingHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;

  useEffect(() => {
    setSelectedIdx(0);
    setActiveSubId(null);
    setActiveSubUrl(null);
    setShowAutoNext(false);
  }, [episodeId]);

  useEffect(() => {
    if (!streamSpanishSub) return;
    if (activeSubId) return;
    const proxied = proxySubtitleUrl(streamSpanishSub.url);
    setActiveSubId("stream-es");
    setActiveSubUrl(proxied);
  }, [streamSpanishSub?.url]);

  useEffect(() => {
    if (streamSpanishSub) return;
    if (!subsQuery.data?.data?.length) return;
    if (activeSubId) return;
    const best = subsQuery.data.data[0];
    if (best?.fileId) downloadMutation.mutate(best);
  }, [subsQuery.data]);

  const proxyM3u8 = selected ? proxyStreamUrl(selected.url, referer) : null;

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (!animeId) return;
      saveProgress({ episodeId, episodeNum: parseInt(episodeNum) || 0, animeId, animeTitle, animeImage, currentTime, duration });
    },
    [episodeId, episodeNum, animeId, animeTitle, animeImage, saveProgress]
  );

  const handleNextEpisode = useCallback(() => {
    if (!nextEpisodeId) return;
    setShowAutoNext(false);
    const p = new URLSearchParams({ episodeId: nextEpisodeId, episodeNum: nextEpisodeNum, animeTitle, animeId, animeImage });
    navigate(`/watch?${p.toString()}`);
  }, [nextEpisodeId, nextEpisodeNum, animeTitle, animeId, animeImage, navigate]);

  const handleEnded = useCallback(() => {
    if (nextEpisodeId) setShowAutoNext(true);
  }, [nextEpisodeId]);

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    });
  };

  const subtitles = subsQuery.data?.data ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button
          onClick={() => animeId ? navigate(`/anime/${animeId}`) : navigate("/")}
          style={{ padding: 8, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.65)" }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{animeTitle}</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Episodio {episodeNum}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleCopyLink}
            title="Copiar enlace para ver juntos"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            <Users size={14} /> Ver juntos
          </button>
          {nextEpisodeId && (
            <button
              onClick={handleNextEpisode}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              Ep. {nextEpisodeNum} <SkipForward size={13} />
            </button>
          )}
        </div>
      </div>

      {copyToast && (
        <div style={{ position: "fixed", top: 70, right: 16, background: "#22C55E", color: "#fff", fontSize: 13, fontWeight: 700, borderRadius: 10, padding: "10px 16px", zIndex: 200 }}>
          ✓ Enlace copiado — compártelo para ver juntos
        </div>
      )}

      {/* Player */}
      <div style={{ position: "relative", width: "100%", background: "#000", aspectRatio: "16/9", maxHeight: "calc(100vh - 200px)" }}>
        {query.isLoading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12 }}>
            <Loader2 size={36} className="animate-spin" style={{ color: "#6C63FF" }} />
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cargando episodio...</p>
          </div>
        )}
        {query.isError && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12 }}>
            <AlertCircle size={36} color="#EF4444" />
            <p style={{ color: "#F1F1F5", fontSize: 14 }}>No se pudo cargar el episodio</p>
            <button onClick={() => query.refetch()} style={{ padding: "8px 16px", borderRadius: 10, background: "#6C63FF", border: "none", color: "#fff", fontSize: 13, cursor: "pointer" }}>
              Reintentar
            </button>
          </div>
        )}
        {!query.isLoading && !query.isError && !selected && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", gap: 12 }}>
            <AlertCircle size={36} color="rgba(255,255,255,0.2)" />
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sin fuentes disponibles</p>
          </div>
        )}
        {!query.isLoading && !query.isError && selected && proxyM3u8 && (
          <PlyrPlayer
            key={`${episodeId}-${selectedIdx}`}
            m3u8Url={proxyM3u8}
            subtitleUrl={activeSubUrl}
            playbackRate={playbackRate}
            startAt={startAt}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
          />
        )}

        {showAutoNext && nextEpisodeId && (
          <AutoNextOverlay
            nextNum={nextEpisodeNum}
            onSkip={handleNextEpisode}
            onCancel={() => setShowAutoNext(false)}
          />
        )}
      </div>

      {/* Controls */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Speed */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: "#6C63FF" }} />
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Velocidad</span>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SPEEDS.map((s) => (
              <button key={s} onClick={() => setPlaybackRate(s)} style={{ padding: "6px 14px", borderRadius: 10, background: playbackRate === s ? "rgba(108,99,255,0.2)" : "transparent", border: `1px solid ${playbackRate === s ? "#6C63FF" : "rgba(255,255,255,0.1)"}`, color: playbackRate === s ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Quality */}
        {sources.length > 1 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: "#6C63FF" }} />
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Calidad</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sources.map((src, i) => (
                <button key={i} onClick={() => setSelectedIdx(i)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 10, background: i === selectedIdx ? "rgba(108,99,255,0.2)" : "transparent", border: `1px solid ${i === selectedIdx ? "#6C63FF" : "rgba(255,255,255,0.1)"}`, color: i === selectedIdx ? "#fff" : "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {parseResolution(src)}
                  {isDub(src) && <span style={{ background: "rgba(59,130,246,0.3)", color: "#3B82F6", fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 4px" }}>DUB</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Subtitles */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: "#6C63FF" }} />
            <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Subtítulos</span>
            {activeSubUrl && <span style={{ background: "rgba(34,197,94,0.2)", color: "#22C55E", fontSize: 10, fontWeight: 700, borderRadius: 4, padding: "1px 6px" }}>ACTIVO</span>}
          </div>
          {streamSpanishSub && <p style={{ color: "#22C55E", fontSize: 12, marginBottom: 8 }}>✓ Subtítulos en español incluidos en la fuente.</p>}
          {!streamSpanishSub && subsQuery.isLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              <Loader2 size={12} className="animate-spin" /> Buscando subtítulos...
            </div>
          )}
          {!streamSpanishSub && !subsQuery.isLoading && subtitles.length === 0 && (
            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>No se encontraron subtítulos en español.</p>
          )}
          {!streamSpanishSub && subtitles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
              {subtitles.map((sub) => {
                const isActive = activeSubId === sub.id;
                return (
                  <button key={sub.id} onClick={() => { if (isActive) { setActiveSubId(null); setActiveSubUrl(null); } else downloadMutation.mutate(sub); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, textAlign: "left", background: isActive ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${isActive ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.07)"}`, color: isActive ? "#22C55E" : "rgba(255,255,255,0.5)", fontSize: 12, cursor: "pointer" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? "#22C55E" : "rgba(255,255,255,0.2)", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>Español</span>
                    {sub.release && <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.release}</span>}
                    {downloadMutation.isPending && isActive && <Loader2 size={12} className="animate-spin" style={{ marginLeft: "auto" }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
