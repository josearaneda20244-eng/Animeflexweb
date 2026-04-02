import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Hls from "hls.js";
import Plyr from "plyr";
import "plyr/dist/plyr.css";
import { ArrowLeft, SkipForward, AlertCircle, Loader2 } from "lucide-react";
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

interface PlyrPlayerProps {
  m3u8Url: string;
  subtitleUrl?: string | null;
  playbackRate: number;
  startAt?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

function PlyrPlayer({ m3u8Url, subtitleUrl, playbackRate, startAt, onTimeUpdate }: PlyrPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startAtRef = useRef(startAt);
  const seekRestoredRef = useRef(false);
  const onTimeUpdateRef = useRef(onTimeUpdate);

  useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
  useEffect(() => { startAtRef.current = startAt; }, [startAt]);

  // Initialize Plyr + HLS once
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLoading(true);
    setError(null);
    seekRestoredRef.current = false;

    // Destroy previous instances
    if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    // Init Plyr
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

    // Seek restore on ready
    const onReady = () => {
      if (!seekRestoredRef.current && startAtRef.current && startAtRef.current > 5) {
        const dur = video.duration;
        if (dur && startAtRef.current < dur - 10) {
          video.currentTime = startAtRef.current;
        }
        seekRestoredRef.current = true;
      }
    };

    // Time update — report progress
    const onTimeUpd = () => {
      if (video.duration > 0) {
        onTimeUpdateRef.current?.(video.currentTime, video.duration);
      }
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 240,
        startLevel: -1,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 20000,
        // Key settings to fix seek/pause bug:
        // HLS.js will not pause during seeking — it buffers aggressively
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
      });
      hlsRef.current = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLoading(false);
        onReady();
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setError("Error al reproducir el episodio.");
            setLoading(false);
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = m3u8Url;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        onReady();
        video.play().catch(() => {});
      }, { once: true });
    } else {
      setError("Tu navegador no soporta reproducción HLS.");
      setLoading(false);
    }

    video.addEventListener("timeupdate", onTimeUpd);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpd);
      if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [m3u8Url]);

  // Apply playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (video && playbackRate) {
      video.playbackRate = playbackRate;
      if (plyrRef.current) plyrRef.current.speed = playbackRate;
    }
  }, [playbackRate]);

  // Inject subtitle track when subtitleUrl changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Remove existing subtitle tracks
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

      // Force captions to show in Plyr
      const tryEnable = () => {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = "showing";
        }
        if (plyrRef.current) {
          try { plyrRef.current.currentTrack = 0; } catch {}
        }
      };
      tryEnable();
      const t = setTimeout(tryEnable, 600);
      return () => clearTimeout(t);
    }
  }, [subtitleUrl]);

  return (
    <div className="relative w-full h-full bg-black">
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        playsInline
        className="w-full h-full"
        style={{ display: "block" }}
      />
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
    onSuccess: (proxiedUrl, sub) => {
      setActiveSubId(sub.id);
      setActiveSubUrl(proxiedUrl);
    },
  });

  const sources = query.data ? sortSources(query.data.sources ?? []) : [];
  const streamingHeaders = query.data?.headers ?? {};
  const referer = streamingHeaders["Referer"] ?? streamingHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;

  useEffect(() => {
    setSelectedIdx(0);
    setActiveSubId(null);
    setActiveSubUrl(null);
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
      saveProgress({
        episodeId,
        episodeNum: parseInt(episodeNum) || 0,
        animeId,
        animeTitle,
        animeImage,
        currentTime,
        duration,
      });
    },
    [episodeId, episodeNum, animeId, animeTitle, animeImage, saveProgress]
  );

  const handleNextEpisode = () => {
    if (!nextEpisodeId) return;
    const p = new URLSearchParams({ episodeId: nextEpisodeId, episodeNum: nextEpisodeNum, animeTitle, animeId, animeImage });
    navigate(`/watch?${p.toString()}`);
  };

  const subtitles = subsQuery.data?.data ?? [];

  return (
    <div className="min-h-screen pt-14" style={{ background: "#090A12" }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 md:px-8 py-3 border-b border-[#1E1E32]">
        <button
          onClick={() => animeId ? navigate(`/anime/${animeId}`) : navigate("/")}
          className="p-2 rounded-lg text-[#9090B0] hover:text-[#F0F0FF] hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#F0F0FF] truncate">{animeTitle}</p>
          <p className="text-xs text-[#9090B0]">Episodio {episodeNum}</p>
        </div>
        {nextEpisodeId && (
          <button
            onClick={handleNextEpisode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-80"
            style={{ background: "linear-gradient(135deg,#6C63FF,#EC4899)" }}
          >
            Ep. {nextEpisodeNum}
            <SkipForward size={12} />
          </button>
        )}
      </div>

      {/* Player */}
      <div className="w-full bg-black" style={{ aspectRatio: "16/9", maxHeight: "calc(100vh - 200px)" }}>
        {query.isLoading && (
          <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-[#4A4A6A]">
            <Loader2 size={36} className="animate-spin text-[#6C63FF]" />
            <p className="text-sm">Cargando episodio...</p>
          </div>
        )}
        {query.isError && (
          <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-[#4A4A6A]">
            <AlertCircle size={36} className="text-[#EF4444]" />
            <p className="text-sm text-[#F0F0FF]">No se pudo cargar el episodio</p>
            <button
              onClick={() => query.refetch()}
              className="px-4 py-2 rounded-lg text-xs text-white bg-[#6C63FF] hover:bg-[#5B52EE] transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}
        {!query.isLoading && !query.isError && !selected && (
          <div className="flex flex-col items-center justify-center w-full h-full gap-3 text-[#4A4A6A]">
            <AlertCircle size={36} />
            <p className="text-sm">Sin fuentes disponibles</p>
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
          />
        )}
      </div>

      {/* Controls */}
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-4 space-y-4">
        {/* Playback speed */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="section-accent" />
            <span className="text-xs font-semibold text-[#9090B0] uppercase tracking-wide">Velocidad</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackRate(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  playbackRate === s
                    ? "text-white border-[#6C63FF]"
                    : "text-[#9090B0] border-[#1E1E32] hover:border-[#2A2A42] hover:text-[#F0F0FF]"
                }`}
                style={playbackRate === s ? { background: "rgba(108,99,255,0.2)" } : {}}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Quality */}
        {sources.length > 1 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="section-accent" />
              <span className="text-xs font-semibold text-[#9090B0] uppercase tracking-wide">Calidad</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {sources.map((src, i) => {
                const active = i === selectedIdx;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedIdx(i)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      active
                        ? "text-white border-[#6C63FF]"
                        : "text-[#9090B0] border-[#1E1E32] hover:border-[#2A2A42] hover:text-[#F0F0FF]"
                    }`}
                    style={active ? { background: "rgba(108,99,255,0.2)" } : {}}
                  >
                    {parseResolution(src)}
                    {isDub(src) && (
                      <span className="px-1 rounded text-[9px] font-bold bg-[#3B82F6]/30 text-[#3B82F6]">DUB</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Subtitles */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="section-accent" />
            <span className="text-xs font-semibold text-[#9090B0] uppercase tracking-wide">Subtítulos</span>
            {activeSubUrl && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#22C55E]/20 text-[#22C55E]">ACTIVO</span>
            )}
          </div>

          {streamSpanishSub && (
            <p className="text-xs text-[#22C55E] mb-2">✓ Subtítulos en español incluidos en la fuente.</p>
          )}

          {!streamSpanishSub && subsQuery.isLoading && (
            <div className="flex items-center gap-2 text-xs text-[#4A4A6A]">
              <Loader2 size={12} className="animate-spin" />
              Buscando subtítulos...
            </div>
          )}

          {!streamSpanishSub && !subsQuery.isLoading && subtitles.length === 0 && (
            <p className="text-xs text-[#4A4A6A]">No se encontraron subtítulos en español.</p>
          )}

          {!streamSpanishSub && subtitles.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {subtitles.map((sub) => {
                const isActive = activeSubId === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      if (isActive) { setActiveSubId(null); setActiveSubUrl(null); }
                      else downloadMutation.mutate(sub);
                    }}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs transition-colors border ${
                      isActive
                        ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]"
                        : "border-[#1E1E32] text-[#9090B0] hover:border-[#2A2A42] hover:text-[#F0F0FF]"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-[#22C55E]" : "bg-[#2A2A42]"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium">Español</span>
                      {sub.release && <span className="ml-2 text-[10px] text-[#4A4A6A] truncate">{sub.release}</span>}
                    </div>
                    {downloadMutation.isPending && isActive && <Loader2 size={12} className="animate-spin" />}
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
