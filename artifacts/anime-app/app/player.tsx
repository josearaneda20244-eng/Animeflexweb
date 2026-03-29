import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
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

function parseQuality(src: StreamingSource): string {
  const q = (src.quality ?? "").trim();
  if (!q) return "Auto";
  // Extract resolution like 360p / 720p / 1080p
  const match = q.match(/(\d{3,4}p)/i);
  if (match) return match[1];
  return q;
}

function sortSources(sources: StreamingSource[]): StreamingSource[] {
  const priority = ["1080", "720", "480", "360"];
  return [...sources].sort((a, b) => {
    const subA = isDub(a) ? 1 : 0;
    const subB = isDub(b) ? 1 : 0;
    if (subA !== subB) return subA - subB;
    const ia = priority.findIndex((p) => (a.quality ?? "").includes(p));
    const ib = priority.findIndex((p) => (b.quality ?? "").includes(p));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// On web we must proxy the stream (adds Referer headers, fixes CORS).
// On native, expo-video can send headers directly.
function getVideoUri(src: StreamingSource, headers: Record<string, string>): string {
  if (Platform.OS === "web") {
    return proxyStreamUrl(src.url);
  }
  return src.url;
}

export default function PlayerScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<React.ComponentRef<typeof VideoView>>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const query = useQuery({
    queryKey: ["streaming", params.episodeId],
    queryFn: () => consumet.streaming(params.episodeId),
    enabled: !!params.episodeId,
    retry: 2,
    staleTime: 1000 * 60 * 5,
  });

  const sources = query.data ? sortSources(query.data.sources ?? []) : [];
  const headers = query.data?.headers ?? {};
  const selected = sources[selectedIdx] ?? null;

  const videoUri = selected ? getVideoUri(selected, headers) : null;

  const nativeHeaders = Platform.OS !== "web" ? headers : {};

  const player = useVideoPlayer(
    videoUri ? { uri: videoUri, headers: nativeHeaders } : null,
    (p) => {
      p.loop = false;
      if (videoUri) p.play();
    }
  );

  // When source changes, swap to the new one and resume playback
  useEffect(() => {
    if (!player || !videoUri) return;
    player.replace({ uri: videoUri, headers: nativeHeaders });
    player.play();
  }, [videoUri]);

  // Auto-select first source once loaded
  useEffect(() => {
    if (sources.length > 0) setSelectedIdx(0);
  }, [sources.length]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header bar */}
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

      {/* Video area */}
      <View style={[styles.playerWrapper, { height: VIDEO_HEIGHT }]}>
        {query.isLoading && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Cargando fuentes...</Text>
          </View>
        )}

        {query.isError && (
          <View style={styles.centered}>
            <Feather name="alert-circle" size={40} color={Colors.error} />
            <Text style={styles.errorText}>No se pudo cargar el episodio</Text>
            <Pressable style={styles.retryBtn} onPress={() => query.refetch()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        )}

        {!query.isLoading && !query.isError && !selected && (
          <View style={styles.centered}>
            <Feather name="tv" size={40} color={Colors.textMuted} />
            <Text style={styles.noSourceText}>Sin fuentes disponibles</Text>
          </View>
        )}

        {selected && player && (
          <VideoView
            ref={videoRef}
            player={player}
            style={styles.video}
            contentFit="contain"
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
        )}
      </View>

      {/* Quality selector + info */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentInner,
          { paddingBottom: 40 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sources.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calidad de video</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.qualityRow}
            >
              {sources.map((src, i) => {
                const active = i === selectedIdx;
                const dub = isDub(src);
                const label = parseQuality(src);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.qualityBtn, active && styles.qualityBtnActive]}
                    onPress={() => setSelectedIdx(i)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.qualityLabel, active && styles.qualityLabelActive]}>
                      {label}
                    </Text>
                    {dub && (
                      <View style={styles.dubTag}>
                        <Text style={styles.dubTagText}>DUB</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Subtitle tracks */}
        {(query.data?.subtitles ?? []).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subtítulos disponibles</Text>
            <View style={styles.subList}>
              {query.data!.subtitles!.map((sub, i) => (
                <View key={i} style={styles.subRow}>
                  <Feather name="type" size={13} color={Colors.primary} />
                  <Text style={styles.subText}>{sub.lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Info card */}
        <View style={styles.infoCard}>
          <Feather name="info" size={14} color={Colors.textMuted} />
          <Text style={styles.infoText}>
            Usa los controles del reproductor para pausa, avanzar y pantalla completa.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
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
  headerAnime: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  headerEp: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  playerWrapper: {
    width: "100%",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    width: "100%",
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: Colors.error,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  noSourceText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  contentInner: {
    padding: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  qualityRow: {
    flexDirection: "row",
    gap: 10,
  },
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
  qualityBtnActive: {
    backgroundColor: Colors.primary + "20",
    borderColor: Colors.primary,
  },
  qualityLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  qualityLabelActive: {
    color: Colors.primary,
  },
  dubTag: {
    backgroundColor: Colors.secondary + "30",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dubTagText: {
    color: Colors.secondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  subList: {
    gap: 6,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
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
