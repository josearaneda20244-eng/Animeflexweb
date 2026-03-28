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
import { consumet, type StreamingSource } from "@/lib/consumet";

type Params = {
  episodeId: string;
  episodeNum: string;
  animeTitle: string;
};

const { width } = Dimensions.get("window");
const VIDEO_HEIGHT = width * (9 / 16);

function qualityLabel(src: StreamingSource): string {
  const q = (src.quality ?? "").trim();
  if (!q) return "Auto";
  return q;
}

function isDub(src: StreamingSource): boolean {
  const q = (src.quality ?? "").toLowerCase();
  return q.includes("eng") || q.includes("dub");
}

function sortSources(sources: StreamingSource[]): StreamingSource[] {
  const priority = ["1080", "720", "360", "480"];
  return [...sources].sort((a, b) => {
    const qa = a.quality ?? "";
    const qb = b.quality ?? "";
    const subA = !isDub(a) ? 0 : 1;
    const subB = !isDub(b) ? 0 : 1;
    if (subA !== subB) return subA - subB;
    const ia = priority.findIndex((p) => qa.includes(p));
    const ib = priority.findIndex((p) => qb.includes(p));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export default function PlayerScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedSource, setSelectedSource] = useState<StreamingSource | null>(null);
  const ref = useRef<React.ComponentRef<typeof VideoView>>(null);

  const query = useQuery({
    queryKey: ["streaming", params.episodeId],
    queryFn: () => consumet.streaming(params.episodeId),
    enabled: !!params.episodeId,
    retry: 2,
    staleTime: 1000 * 60 * 5,
  });

  const sources = query.data ? sortSources(query.data.sources ?? []) : [];
  const headers = query.data?.headers ?? {};

  useEffect(() => {
    if (sources.length > 0 && !selectedSource) {
      setSelectedSource(sources[0]);
    }
  }, [sources]);

  const videoSource = selectedSource
    ? { uri: selectedSource.url, headers }
    : null;

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    if (videoSource) p.play();
  });

  useEffect(() => {
    if (selectedSource && player) {
      player.replace({ uri: selectedSource.url, headers });
      player.play();
    }
  }, [selectedSource?.url]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

      {/* Video player */}
      <View style={styles.playerWrapper}>
        {query.isLoading && (
          <View style={styles.playerPlaceholder}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Cargando episodio...</Text>
          </View>
        )}
        {query.isError && (
          <View style={styles.playerPlaceholder}>
            <Feather name="alert-circle" size={36} color={Colors.error} />
            <Text style={styles.errorText}>No se pudo cargar el video</Text>
            <Pressable style={styles.retryBtn} onPress={() => query.refetch()}>
              <Text style={styles.retryText}>Reintentar</Text>
            </Pressable>
          </View>
        )}
        {!query.isLoading && !query.isError && selectedSource && (
          <VideoView
            ref={ref}
            player={player}
            style={styles.video}
            allowsFullscreen
            allowsPictureInPicture
            contentFit="contain"
            nativeControls
          />
        )}
      </View>

      {/* Quality selector */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {sources.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calidad</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.qualityRow}>
              {sources.map((src, i) => {
                const active = src.url === selectedSource?.url;
                const dub = isDub(src);
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.qualityBtn, active && styles.qualityBtnActive]}
                    onPress={() => setSelectedSource(src)}
                  >
                    <Text style={[styles.qualityText, active && styles.qualityTextActive]}>
                      {qualityLabel(src)}
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

        {query.data?.subtitles && query.data.subtitles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Subtítulos disponibles</Text>
            {query.data.subtitles.map((sub, i) => (
              <View key={i} style={styles.subRow}>
                <Feather name="type" size={14} color={Colors.textSecondary} />
                <Text style={styles.subLang}>{sub.lang}</Text>
              </View>
            ))}
          </View>
        )}

        {!query.isLoading && sources.length === 0 && !query.isError && (
          <View style={styles.noSources}>
            <Feather name="tv" size={36} color={Colors.textMuted} />
            <Text style={styles.noSourcesText}>Sin fuentes de video disponibles</Text>
          </View>
        )}
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
  },
  backBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 10,
  },
  headerInfo: { flex: 1 },
  headerAnime: { color: "#fff", fontSize: 15, fontWeight: "700" },
  headerEp: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  playerWrapper: {
    width,
    height: VIDEO_HEIGHT,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  video: { width, height: VIDEO_HEIGHT },
  playerPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  errorText: { color: Colors.error, fontSize: 15, fontWeight: "600" },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  content: { flex: 1, backgroundColor: Colors.bg },
  contentInner: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  qualityRow: { gap: 8, paddingBottom: 4 },
  qualityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qualityBtnActive: {
    backgroundColor: Colors.primary + "22",
    borderColor: Colors.primary,
  },
  qualityText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  qualityTextActive: { color: Colors.primary },
  dubTag: {
    backgroundColor: Colors.secondary + "33",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dubTagText: { color: Colors.secondary, fontSize: 9, fontWeight: "800" },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  subLang: { color: Colors.textSecondary, fontSize: 13 },
  noSources: { alignItems: "center", gap: 12, paddingVertical: 40 },
  noSourcesText: { color: Colors.textMuted, fontSize: 15 },
});
