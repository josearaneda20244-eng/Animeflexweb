import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import Hls from "hls.js";
import React, { useEffect, useRef, useState } from "react";
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
import { useQuery } from "@tanstack/react-query";

import Colors from "@/constants/colors";
import { consumet, proxyStreamUrl, type StreamingSource } from "@/lib/consumet";

type Params = {
  episodeId: string;
  episodeNum: string;
  animeTitle: string;
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


// ─── Web HLS player (no iframe — avoids cross-origin domain issues) ──────────
function WebPlayer({
  m3u8Url,
  height,
}: {
  m3u8Url: string;
  height: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [webError, setWebError] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);

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
      video.addEventListener("loadedmetadata", () => {
        setWebLoading(false);
        video.play().catch(() => {});
      }, { once: true });
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

  return (
    <View style={{ width: "100%", height, backgroundColor: "#000", position: "relative" }}>
      {/* @ts-ignore — video is a valid DOM element on web */}
      <video
        ref={videoRef}
        controls
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
      {webLoading && !webError && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.8)", gap: 12 }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>Cargando episodio...</Text>
        </View>
      )}
      {webError && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.85)", gap: 12 }]}>
          <Feather name="alert-circle" size={36} color={Colors.error} />
          <Text style={{ color: Colors.error, fontWeight: "700", fontSize: 15 }}>{webError}</Text>
        </View>
      )}
    </View>
  );
}

// ─── Native video player ──────────────────────────────────────────────────────
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

  const player = useVideoPlayer(
    { uri, headers },
    (p) => {
      p.loop = false;
      p.play();
    }
  );

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

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function PlayerScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const query = useQuery({
    queryKey: ["streaming", params.episodeId],
    queryFn: () => consumet.streaming(params.episodeId),
    enabled: !!params.episodeId,
    retry: 2,
    staleTime: 1000 * 60 * 5,
  });

  const sources = query.data ? sortSources(query.data.sources ?? []) : [];
  const streamingHeaders = query.data?.headers ?? {};
  const nativeHeaders = Platform.OS !== "web" ? streamingHeaders : {};
  const referer = streamingHeaders["Referer"] ?? streamingHeaders["referer"];
  const selected = sources[selectedIdx] ?? null;

  useEffect(() => {
    setSelectedIdx(0);
  }, [params.episodeId]);

  const proxyM3u8 = selected ? proxyUrl(selected, referer) : null;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isLoading = query.isLoading;
  const isError = query.isError;
  const hasSource = !!selected;

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
      </View>

      {/* Player area */}
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
              <WebPlayer m3u8Url={proxyM3u8} height={VIDEO_HEIGHT} />
            ) : (
              <NativePlayer src={selected!} headers={nativeHeaders} referer={referer} />
            )}
          </>
        )}
      </View>

      {/* Controls */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sources.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calidad</Text>
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

        {(query.data?.subtitles ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subtítulos</Text>
            {query.data!.subtitles!.map((sub, i) => (
              <View key={i} style={styles.subRow}>
                <Feather name="type" size={13} color={Colors.primary} />
                <Text style={styles.subText}>{sub.lang}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoCard}>
          <Feather name="info" size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>
            Usa el botón de pantalla completa del reproductor para una mejor
            experiencia. Puedes adelantar y retroceder libremente.
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
    backgroundColor: "#0D0D0D",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 10,
  },
  headerInfo: { flex: 1 },
  headerAnime: { color: "#fff", fontSize: 15, fontWeight: "700" },
  headerEp: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  playerArea: {
    width: "100%",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  video: { width: "100%", height: "100%" },
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
  section: { gap: 12 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  qualityRow: { gap: 10, flexDirection: "row" },
  qualityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  qualityActive: {
    backgroundColor: Colors.primary + "20",
    borderColor: Colors.primary,
  },
  qualityLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  qualityLabelActive: { color: Colors.primary },
  dubTag: {
    backgroundColor: Colors.secondary + "30",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dubText: { color: Colors.secondary, fontSize: 9, fontWeight: "800" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subText: { color: Colors.textSecondary, fontSize: 13 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
