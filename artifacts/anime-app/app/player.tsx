import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import Hls from "hls.js";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import {
  consumet,
  proxyStreamUrl,
  proxySubtitleUrl,
  type StreamingSource,
  type SubtitleResult,
} from "@/lib/consumet";
import { useWatchProgress } from "@/context/WatchProgressContext";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

type Params = {
  episodeId: string;
  episodeNum: string;
  animeTitle: string;
  animeId?: string;
  animeImage?: string;
  nextEpisodeId?: string;
  nextEpisodeNum?: string;
};

const { width } = Dimensions.get("window");
const VIDEO_HEIGHT = Math.round(width * (9 / 16));

function isDub(src: StreamingSource): boolean {
  const q = (src.quality ?? "").toLowerCase();
  return q.includes("eng") || q.includes("dub");
}

function parseResolution(src: StreamingSource): string {
  const q = src.quality ?? "";
  const m = q.match(/(\d{3,4})p/i);
  if (m) return m[1] + "p";
  const m2 = q.match(/\b(\d{3,4})\b/);
  if (m2) return m2[1] + "p";
  return q.trim() || "Auto";
}

function sortSources(sources: StreamingSource[]): StreamingSource[] {
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

function proxyUrl(src: StreamingSource, referer?: string): string {
  return proxyStreamUrl(src.url, referer);
}

/* ── Web HLS Player with subtitle track support ── */
function WebPlayer({
  m3u8Url,
  height,
  subtitleUrl,
  playbackRate,
  startAt,
  onTimeUpdate,
}: {
  m3u8Url: string;
  height: number;
  subtitleUrl?: string | null;
  playbackRate?: number;
  startAt?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const trackRef = useRef<HTMLTrackElement | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);

  // Load / reload HLS when the stream URL changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !m3u8Url) return;

    setWebError(null);
    setWebLoading(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: 60,
        maxMaxBufferLength: 180,
        startLevel: -1,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 30000,
      });
      hlsRef.current = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setWebLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setWebError("Error al reproducir el episodio.");
            setWebLoading(false);
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = m3u8Url;
      video.addEventListener(
        "loadedmetadata",
        () => {
          setWebLoading(false);
          video.play().catch(() => {});
        },
        { once: true }
      );
    } else {
      setWebError("Tu navegador no soporta reproducción HLS.");
      setWebLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [m3u8Url]);

  // Inject / remove subtitle <track> when subtitleUrl changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Remove old track if any
    if (trackRef.current) {
      try { video.removeChild(trackRef.current); } catch {}
      trackRef.current = null;
    }

    if (subtitleUrl) {
      // @ts-ignore — DOM API
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.label = "Español";
      track.srclang = "es";
      track.src = subtitleUrl;
      track.default = true;
      video.appendChild(track);
      trackRef.current = track;

      // Force browser to show the track
      const tryEnable = () => {
        const textTracks = video.textTracks;
        for (let i = 0; i < textTracks.length; i++) {
          textTracks[i].mode = "showing";
        }
      };
      // Try immediately and after a short delay (some browsers are lazy)
      tryEnable();
      const timer = setTimeout(tryEnable, 800);
      return () => clearTimeout(timer);
    }
  }, [subtitleUrl]);

  // Apply playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video || playbackRate == null) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  // Seek to saved position when video is ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !startAt || startAt < 5) return;
    const onLoaded = () => {
      if (startAt < video.duration - 10) video.currentTime = startAt;
    };
    if (video.readyState >= 1) onLoaded();
    else video.addEventListener("loadedmetadata", onLoaded, { once: true });
  }, [startAt]);

  // Report playback time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onTimeUpdate) return;
    const handler = () => {
      if (video.duration > 0) onTimeUpdate(video.currentTime, video.duration);
    };
    video.addEventListener("timeupdate", handler);
    return () => video.removeEventListener("timeupdate", handler);
  }, [onTimeUpdate]);

  return (
    <View style={{ width: "100%", height, backgroundColor: "#000", position: "relative" }}>
      {/* @ts-ignore */}
      <video
        ref={videoRef}
        controls
        playsInline
        crossOrigin="anonymous"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
      {webLoading && !webError && (
        <View style={[StyleSheet.absoluteFillObject, styles.playerOverlay]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.playerOverlayText}>Cargando episodio...</Text>
        </View>
      )}
      {webError && (
        <View style={[StyleSheet.absoluteFillObject, styles.playerOverlay]}>
          <Feather name="alert-circle" size={36} color={Colors.error} />
          <Text style={styles.playerErrorText}>{webError}</Text>
        </View>
      )}
    </View>
  );
}

/* ── Native Player ── */
function NativePlayer({
  src,
  headers,
  referer,
}: {
  src: StreamingSource;
  headers: Record<string, string>;
  referer?: string;
}) {
  const uri = src.isM3U8 ? proxyUrl(src, referer) : src.url;
  const player = useVideoPlayer({ uri, headers }, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    player.replace({ uri, headers });
    player.play();
  }, [uri, referer]);

  return (
    <VideoView
      key={uri}
      player={player}
      style={styles.video}
      contentFit="contain"
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
}

/* ── Subtitle panel ── */
function SubtitleRow({
  sub,
  isActive,
  onPress,
  isLoading,
}: {
  sub: SubtitleResult;
  isActive: boolean;
  onPress: () => void;
  isLoading: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.subRow, isActive && styles.subRowActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {isActive && (
        <LinearGradient
          colors={[Colors.primary + "25", Colors.primary + "08"]}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[styles.subDot, isActive && styles.subDotActive]} />
      <View style={styles.subInfo}>
        <Text style={[styles.subLang, isActive && styles.subLangActive]}>
          Español {sub.lang === "pt" ? "(PT)" : ""}
        </Text>
        {sub.release ? (
          <Text style={styles.subRelease} numberOfLines={1}>
            {sub.release}
          </Text>
        ) : null}
      </View>
      {isLoading && isActive ? (
        <ActivityIndicator size="small" color={Colors.primary} />
      ) : isActive ? (
        <Feather name="check-circle" size={16} color={Colors.primary} />
      ) : (
        <Feather name="download" size={14} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

/* ── Main Screen ── */
export default function PlayerScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  const [activeSubUrl, setActiveSubUrl] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const { saveProgress, getProgress } = useWatchProgress();
  const savedProgress = getProgress(params.episodeId);
  const startAt = savedProgress?.currentTime;

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number) => {
      if (!params.animeId) return;
      saveProgress({
        episodeId: params.episodeId,
        episodeNum: parseInt(params.episodeNum) || 0,
        animeId: params.animeId,
        animeTitle: params.animeTitle,
        animeImage: params.animeImage ?? "",
        currentTime,
        duration,
      });
    },
    [params.episodeId, params.episodeNum, params.animeId, params.animeTitle, params.animeImage, saveProgress]
  );

  const query = useQuery({
    queryKey: ["streaming", params.episodeId],
    queryFn: () => consumet.streaming(params.episodeId),
    enabled: !!params.episodeId,
    retry: 2,
    staleTime: 1000 * 60 * 5,
  });

  const epNum = parseInt(params.episodeNum) || undefined;

  // Spanish subtitle embedded in the stream (priority source — Crunchyroll/Zoro quality)
  const streamSubtitles = query.data?.subtitles ?? [];
  const streamSpanishSub =
    streamSubtitles.find((s) =>
      /español.*españa/i.test(s.lang)
    ) ??
    streamSubtitles.find((s) =>
      /español|spanish|spa/i.test(s.lang)
    ) ??
    null;

  const subsQuery = useQuery({
    queryKey: ["subtitles", params.animeTitle, epNum],
    queryFn: () => consumet.searchSubtitles(params.animeTitle, epNum, "es"),
    // Only fetch from OpenSubtitles when the stream has no Spanish subtitle
    enabled: !!params.animeTitle && query.isSuccess && !streamSpanishSub,
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
  const nativeHeaders = Platform.OS !== "web" ? streamingHeaders : {};
  const referer = streamingHeaders["Referer"] ?? streamingHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;

  useEffect(() => {
    setSelectedIdx(0);
    // Reset subtitles when episode changes
    setActiveSubId(null);
    setActiveSubUrl(null);
  }, [params.episodeId]);

  // Auto-select stream's Spanish subtitle (highest quality — Crunchyroll/Zoro source)
  useEffect(() => {
    if (!streamSpanishSub) return;
    if (activeSubId) return; // already active
    const proxied = proxySubtitleUrl(streamSpanishSub.url);
    setActiveSubId("stream-es");
    setActiveSubUrl(proxied);
  }, [streamSpanishSub?.url]);

  // Fallback: auto-select best OpenSubtitles result when stream has no Spanish sub
  useEffect(() => {
    if (streamSpanishSub) return; // stream sub takes priority
    if (!subsQuery.data?.data?.length) return;
    if (activeSubId) return; // already have one active
    const best = subsQuery.data.data[0]; // sorted by download_count from backend
    if (best?.fileId) {
      downloadMutation.mutate(best);
    }
  }, [subsQuery.data]);

  const proxyM3u8 = selected ? proxyUrl(selected, referer) : null;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isLoading = query.isLoading;
  const isError = query.isError;
  const hasSource = !!selected;
  const subtitles = subsQuery.data?.data ?? [];

  const handleSubPress = (sub: SubtitleResult) => {
    if (activeSubId === sub.id) {
      // Toggle off
      setActiveSubId(null);
      setActiveSubUrl(null);
      return;
    }
    downloadMutation.mutate(sub);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerAnime} numberOfLines={1}>
            {params.animeTitle}
          </Text>
          <Text style={styles.headerEp}>Episodio {params.episodeNum}</Text>
        </View>
        {activeSubUrl && (
          <View style={styles.subActiveBadge}>
            <Feather name="type" size={12} color="#fff" />
            <Text style={styles.subActiveBadgeText}>ES</Text>
          </View>
        )}
        <Pressable style={styles.shareBtn}>
          <Feather name="share-2" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {/* Player */}
      <View style={[styles.playerArea, { height: VIDEO_HEIGHT }]}>
        {isLoading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.hint}>Cargando episodio...</Text>
          </View>
        )}
        {isError && (
          <View style={styles.centered}>
            <Feather name="alert-circle" size={40} color={Colors.error} />
            <Text style={styles.errorMsg}>No se pudo cargar el episodio</Text>
            <Pressable style={styles.retryBtn} onPress={() => query.refetch()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {!isLoading && !isError && !hasSource && (
          <View style={styles.centered}>
            <Feather name="tv" size={40} color={Colors.textMuted} />
            <Text style={styles.hint}>Sin fuentes disponibles</Text>
          </View>
        )}
        {!isLoading && !isError && hasSource && (
          <>
            {Platform.OS === "web" && proxyM3u8 ? (
              <WebPlayer
                m3u8Url={proxyM3u8}
                height={VIDEO_HEIGHT}
                subtitleUrl={activeSubUrl}
                playbackRate={playbackRate}
                startAt={startAt}
                onTimeUpdate={handleTimeUpdate}
              />
            ) : (
              <NativePlayer
                src={selected!}
                headers={nativeHeaders}
                referer={referer}
              />
            )}
          </>
        )}
      </View>

      {/* Info + Controls */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Episode info + Next episode */}
        <View style={styles.epInfo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.epInfoAnime} numberOfLines={1}>
              {params.animeTitle}
            </Text>
            <Text style={styles.epInfoEp}>Episodio {params.episodeNum}</Text>
          </View>
          {params.nextEpisodeId ? (
            <TouchableOpacity
              style={styles.nextEpBtn}
              activeOpacity={0.8}
              onPress={() =>
                router.replace({
                  pathname: "/player",
                  params: {
                    episodeId: params.nextEpisodeId!,
                    episodeNum: params.nextEpisodeNum ?? "",
                    animeTitle: params.animeTitle,
                    animeId: params.animeId ?? "",
                    animeImage: params.animeImage ?? "",
                  },
                })
              }
            >
              <Text style={styles.nextEpText}>Ep {params.nextEpisodeNum}</Text>
              <Feather name="skip-forward" size={14} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Playback Speed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Velocidad</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.qualityRow}
          >
            {SPEEDS.map((s) => {
              const active = s === playbackRate;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.qualityBtn, active && styles.qualityActive]}
                  onPress={() => setPlaybackRate(s)}
                  activeOpacity={0.7}
                >
                  {active && (
                    <LinearGradient
                      colors={[Colors.primary + "30", Colors.secondary + "10"]}
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  <Text style={[styles.qualityLabel, active && styles.qualityLabelActive]}>
                    {s}x
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Quality selector */}
        {sources.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionAccent} />
              <Text style={styles.sectionTitle}>Calidad del Video</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.qualityRow}
            >
              {sources.map((src, i) => {
                const active = i === selectedIdx;
                const dub = isDub(src);
                const label = parseResolution(src);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.qualityBtn, active && styles.qualityActive]}
                    onPress={() => setSelectedIdx(i)}
                    activeOpacity={0.7}
                  >
                    {active && (
                      <LinearGradient
                        colors={[Colors.primary + "30", Colors.secondary + "10"]}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <Feather
                      name="film"
                      size={12}
                      color={active ? Colors.primary : Colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.qualityLabel,
                        active && styles.qualityLabelActive,
                      ]}
                    >
                      {label}
                    </Text>
                    {dub && (
                      <View style={styles.dubTag}>
                        <Text style={styles.dubText}>DUB</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Subtitles section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Subtítulos en Español</Text>
            {subsQuery.isLoading && (
              <ActivityIndicator
                size="small"
                color={Colors.primary}
                style={{ marginLeft: 8 }}
              />
            )}
            {activeSubUrl && (
              <View style={styles.subOnBadge}>
                <Text style={styles.subOnText}>ACTIVO</Text>
              </View>
            )}
          </View>

          {subsQuery.isError && (
            <View style={styles.subEmpty}>
              <Feather name="wifi-off" size={16} color={Colors.textMuted} />
              <Text style={styles.subEmptyText}>
                No se pudo conectar con OpenSubtitles
              </Text>
            </View>
          )}

          {!subsQuery.isLoading && !subsQuery.isError && subtitles.length === 0 && (
            <View style={styles.subEmpty}>
              <Feather name="message-square" size={16} color={Colors.textMuted} />
              <Text style={styles.subEmptyText}>
                No se encontraron subtítulos en español para este episodio
              </Text>
            </View>
          )}

          {subtitles.length > 0 && (
            <View style={styles.subList}>
              {activeSubUrl && (
                <TouchableOpacity
                  style={styles.subOffBtn}
                  onPress={() => {
                    setActiveSubId(null);
                    setActiveSubUrl(null);
                  }}
                >
                  <Feather name="x-circle" size={14} color={Colors.error} />
                  <Text style={styles.subOffText}>Desactivar subtítulos</Text>
                </TouchableOpacity>
              )}
              {subtitles.map((sub) => (
                <SubtitleRow
                  key={sub.id}
                  sub={sub}
                  isActive={activeSubId === sub.id}
                  isLoading={
                    downloadMutation.isPending &&
                    downloadMutation.variables?.id === sub.id
                  }
                  onPress={() => handleSubPress(sub)}
                />
              ))}
            </View>
          )}

          {downloadMutation.isError && (
            <View style={styles.subErrorRow}>
              <Feather name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.subErrorText}>
                No se pudo cargar el subtítulo. Intenta con otro.
              </Text>
            </View>
          )}
        </View>

        {/* Tip */}
        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Feather name="info" size={14} color={Colors.primary} />
          </View>
          <Text style={styles.tipText}>
            Los subtítulos en español se activan solos. Si quieres cambiarlos o desactivarlos, usa la lista de arriba.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0D0D15",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 8,
    borderRadius: 10,
  },
  headerInfo: { flex: 1 },
  headerAnime: { color: "#fff", fontSize: 15, fontWeight: "700" },
  headerEp: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  shareBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 8,
    borderRadius: 10,
  },
  subActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subActiveBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  playerArea: {
    width: "100%",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  video: { width: "100%", height: "100%" },
  playerOverlay: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    gap: 12,
  },
  playerOverlayText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  playerErrorText: { color: Colors.error, fontWeight: "700", fontSize: 15 },

  centered: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  hint: { color: Colors.textSecondary, fontSize: 14 },
  errorMsg: { color: Colors.error, fontSize: 15, fontWeight: "600" },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  scroll: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { padding: 20, gap: 20 },

  epInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
  },
  epInfoAnime: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  epInfoEp: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },

  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.primary },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: "700" },

  qualityRow: { gap: 10, flexDirection: "row" },
  qualityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: "hidden",
    position: "relative",
  },
  qualityActive: { borderColor: Colors.primary },
  qualityLabel: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
  qualityLabelActive: { color: Colors.primary },
  dubTag: {
    backgroundColor: Colors.dub + "30",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dubText: { color: Colors.dub, fontSize: 9, fontWeight: "800" },

  subOnBadge: {
    backgroundColor: Colors.primary + "25",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary + "50",
    marginLeft: "auto",
  },
  subOnText: { color: Colors.primary, fontSize: 9, fontWeight: "900" },

  subList: { gap: 8 },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: "hidden",
    position: "relative",
  },
  subRowActive: { borderColor: Colors.primary },
  subDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  subDotActive: { backgroundColor: Colors.primary },
  subInfo: { flex: 1 },
  subLang: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
  subLangActive: { color: Colors.textPrimary },
  subRelease: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  subOffBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.error + "12",
    borderWidth: 1,
    borderColor: Colors.error + "30",
    alignSelf: "flex-start",
  },
  subOffText: { color: Colors.error, fontSize: 12, fontWeight: "700" },

  subEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subEmptyText: { color: Colors.textMuted, fontSize: 13, flex: 1 },

  subErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -4,
  },
  subErrorText: { color: Colors.error, fontSize: 12 },

  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.primary + "10",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.primary + "25",
  },
  tipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },

  nextEpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  nextEpText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
