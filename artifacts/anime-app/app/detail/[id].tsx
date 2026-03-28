import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  FlatList,
  Image,
  Linking,
  Modal,
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

import EpisodeItem from "@/components/EpisodeItem";
import { GenreBadge } from "@/components/GenreBadge";
import Colors from "@/constants/colors";
import { useFavorites } from "@/context/FavoritesContext";
import { consumet, type Episode, type AnimeResult, type StreamingSource } from "@/lib/consumet";

type Params = {
  id: string;
  title?: string;
  image?: string;
  cover?: string;
  rating?: string;
  type?: string;
  status?: string;
  releaseDate?: string;
  totalEpisodes?: string;
  description?: string;
  genres?: string;
};

export default function DetailScreen() {
  const params = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [loadingEp, setLoadingEp] = useState<string | null>(null);
  const [streamModal, setStreamModal] = useState<{ sources: StreamingSource[]; epNum: number } | null>(null);

  const navTitle = params.title ?? "";
  const navImage = params.image ?? "";
  const navCover = params.cover ?? "";
  const navRating = params.rating ? parseFloat(params.rating) : undefined;
  const navGenres = params.genres ? (JSON.parse(params.genres) as string[]) : [];

  const infoQuery = useQuery({
    queryKey: ["animeInfoByTitle", navTitle],
    queryFn: () => consumet.infoByTitle(navTitle),
    enabled: !!navTitle,
    retry: 2,
    staleTime: 1000 * 60 * 10,
  });

  const anime = infoQuery.data;
  const fav = isFavorite(params.id);

  const animeForFav: AnimeResult = {
    id: params.id,
    title: navTitle,
    image: navImage,
    cover: navCover || undefined,
    rating: navRating,
    type: params.type || undefined,
    status: params.status || undefined,
    genres: navGenres,
  };

  const handleFav = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(animeForFav);
  };

  const handleEpisode = async (episode: Episode) => {
    const epId = episode?.id;
    if (!epId) {
      Alert.alert("Error", "Este episodio no tiene ID válido.");
      return;
    }
    setLoadingEp(epId);
    try {
      const data = await consumet.streaming(epId);
      const sources = data.sources ?? [];

      if (sources.length === 0) {
        Alert.alert("Sin fuentes", "No se encontraron streams para este episodio.");
        return;
      }

      setWatchedEps((prev) => new Set([...prev, epId]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStreamModal({ sources, epNum: episode.number });
    } catch {
      Alert.alert("Error", "No se pudo cargar el episodio. Intenta de nuevo.");
    } finally {
      setLoadingEp(null);
    }
  };

  const openStream = async (url: string) => {
    setStreamModal(null);
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("No se puede abrir", "Copia la URL para reproducir externamente.");
      }
    }
  };

  const copyUrl = (url: string) => {
    Clipboard.setString(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("¡Copiado!", "URL del stream copiada al portapapeles.");
  };

  const topPad = Platform.OS === "web" ? 67 : 0;
  const episodes = anime?.episodes ?? [];
  const description = (anime?.description || params.description || "").replace(/<[^>]+>/g, "");
  const genres = anime?.genres?.length ? anime.genres : navGenres;
  const displayStatus = anime?.status || params.status;
  const displayType = anime?.type || params.type;
  const displayEps = anime?.totalEpisodes || (params.totalEpisodes ? parseInt(params.totalEpisodes) : undefined);

  const qualityLabel = (src: StreamingSource) => {
    const q = src.quality ?? "";
    const isDub = q.toLowerCase().includes("eng") || q.toLowerCase().includes("dub");
    const quality = q.replace(/\s*(BD|eng|dub|sub)/gi, "").trim();
    return { quality: quality || "Auto", isDub };
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <FlatList
        data={episodes}
        keyExtractor={(ep) => ep.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 40 + (Platform.OS === "web" ? 34 : insets.bottom),
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.coverContainer}>
              <Image
                source={{ uri: navCover || navImage }}
                style={styles.cover}
                resizeMode="cover"
              />
              <View style={styles.coverOverlay} />
              <Pressable
                style={[styles.backBtn, { top: insets.top + 12 }]}
                onPress={() => router.back()}
              >
                <Feather name="arrow-left" size={20} color="#fff" />
              </Pressable>
              <Pressable
                style={[styles.favBtn, { top: insets.top + 12 }]}
                onPress={handleFav}
              >
                <Feather name="heart" size={20} color={fav ? Colors.accent : "#fff"} />
              </Pressable>
            </View>

            <View style={styles.heroRow}>
              <Image source={{ uri: navImage }} style={styles.poster} resizeMode="cover" />
              <View style={styles.heroInfo}>
                <Text style={styles.animeTitle}>{navTitle}</Text>
                <View style={styles.metaRow}>
                  {navRating !== undefined && navRating > 0 && (
                    <View style={styles.ratingBadge}>
                      <Feather name="star" size={12} color={Colors.warning} />
                      <Text style={styles.ratingText}>{(navRating / 10).toFixed(1)}</Text>
                    </View>
                  )}
                  {displayType && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{displayType}</Text>
                    </View>
                  )}
                  {displayStatus && (
                    <View style={[styles.statusBadge, displayStatus === "Ongoing" && styles.statusOngoing]}>
                      <Text style={styles.statusText}>{displayStatus}</Text>
                    </View>
                  )}
                </View>
                {params.releaseDate && params.releaseDate !== "undefined" && (
                  <Text style={styles.metaLabel}>📅 {params.releaseDate}</Text>
                )}
                {displayEps && (
                  <Text style={styles.metaLabel}>📺 {displayEps} Episodios</Text>
                )}
              </View>
            </View>

            {genres.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genresContent}
              >
                {genres.map((g) => <GenreBadge key={g} genre={g} />)}
              </ScrollView>
            )}

            {description.length > 0 && (
              <View style={styles.descSection}>
                <Text style={styles.sectionLabel}>Sinopsis</Text>
                <Text style={styles.desc}>{description}</Text>
              </View>
            )}

            <View style={styles.episodesHeader}>
              <Text style={styles.sectionLabel}>Episodios</Text>
              {infoQuery.isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={styles.loadingText}>Cargando...</Text>
                </View>
              ) : infoQuery.isError ? null : (
                <Text style={styles.episodeCount}>{episodes.length} total</Text>
              )}
            </View>

            {infoQuery.isError && (
              <View style={styles.errorEps}>
                <Feather name="alert-circle" size={24} color={Colors.error} />
                <Text style={styles.errorEpsText}>
                  No se pudieron cargar los episodios para "{navTitle}"
                </Text>
                <Pressable style={styles.retrySmall} onPress={() => infoQuery.refetch()}>
                  <Text style={styles.retrySmallText}>Reintentar</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ position: "relative" }}>
            {loadingEp === item.id && (
              <View style={styles.epLoading}>
                <ActivityIndicator color={Colors.primary} size="small" />
              </View>
            )}
            <EpisodeItem episode={item} onPress={handleEpisode} watched={watchedEps.has(item.id)} />
          </View>
        )}
        ListEmptyComponent={
          !infoQuery.isLoading && !infoQuery.isError ? (
            <View style={styles.emptyEps}>
              <Feather name="tv" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyEpsText}>Sin episodios disponibles</Text>
            </View>
          ) : null
        }
      />

      {/* Stream quality modal */}
      <Modal
        visible={!!streamModal}
        transparent
        animationType="slide"
        onRequestClose={() => setStreamModal(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setStreamModal(null)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              Episodio {streamModal?.epNum} — Selecciona calidad
            </Text>
            <Text style={styles.modalSubtitle}>
              Toca para abrir en el navegador o copia el enlace
            </Text>

            {streamModal?.sources.map((src, i) => {
              const { quality, isDub } = qualityLabel(src);
              return (
                <View key={i} style={styles.sourceRow}>
                  <TouchableOpacity
                    style={styles.sourceBtn}
                    onPress={() => openStream(src.url)}
                  >
                    <View style={styles.sourceBtnLeft}>
                      <Feather name="play-circle" size={18} color={Colors.primary} />
                      <Text style={styles.sourceQuality}>{quality}</Text>
                      {isDub && (
                        <View style={styles.dubBadge}>
                          <Text style={styles.dubText}>DUB</Text>
                        </View>
                      )}
                    </View>
                    <Feather name="external-link" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyUrl(src.url)}
                  >
                    <Feather name="copy" size={16} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setStreamModal(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  coverContainer: { width: "100%", height: 260, position: "relative" },
  cover: { width: "100%", height: "100%" },
  coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(13,13,13,0.45)" },
  backBtn: {
    position: "absolute", left: 16, backgroundColor: "rgba(0,0,0,0.55)",
    padding: 8, borderRadius: 10,
  },
  favBtn: {
    position: "absolute", right: 16, backgroundColor: "rgba(0,0,0,0.55)",
    padding: 8, borderRadius: 10,
  },
  heroRow: {
    flexDirection: "row", gap: 16, paddingHorizontal: 16,
    paddingVertical: 16, marginTop: -60,
  },
  poster: {
    width: 100, height: 145, borderRadius: 12,
    borderWidth: 2, borderColor: Colors.primary,
  },
  heroInfo: { flex: 1, paddingTop: 16, gap: 8, justifyContent: "flex-end" },
  animeTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800", lineHeight: 24 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ratingBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: Colors.warning + "22", paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 6,
  },
  ratingText: { color: Colors.warning, fontSize: 12, fontWeight: "700" },
  typeBadge: {
    backgroundColor: Colors.secondary + "22", paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 6,
  },
  typeText: { color: Colors.secondary, fontSize: 12, fontWeight: "600" },
  statusBadge: {
    backgroundColor: Colors.textMuted + "33", paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 6,
  },
  statusOngoing: { backgroundColor: Colors.success + "22" },
  statusText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  metaLabel: { color: Colors.textMuted, fontSize: 12 },
  genresContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 12, paddingTop: 4 },
  descSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  sectionLabel: {
    color: Colors.textPrimary, fontSize: 16, fontWeight: "700",
    paddingHorizontal: 16, marginBottom: 4,
  },
  desc: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  episodesHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingRight: 16, paddingBottom: 8,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { color: Colors.textMuted, fontSize: 13 },
  episodeCount: { color: Colors.textMuted, fontSize: 13 },
  epLoading: {
    position: "absolute", right: 16, top: "50%",
    zIndex: 10, transform: [{ translateY: -10 }],
  },
  emptyEps: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyEpsText: { color: Colors.textMuted, fontSize: 15 },
  errorEps: { alignItems: "center", gap: 12, paddingVertical: 24, paddingHorizontal: 24 },
  errorEpsText: {
    color: Colors.textSecondary, fontSize: 14,
    textAlign: "center", lineHeight: 20,
  },
  retrySmall: {
    backgroundColor: Colors.primary, paddingHorizontal: 20,
    paddingVertical: 8, borderRadius: 8,
  },
  retrySmallText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  // Modal styles
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Colors.bgSurface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 12, paddingHorizontal: 16,
  },
  modalHandle: {
    width: 40, height: 4, backgroundColor: Colors.border,
    borderRadius: 2, alignSelf: "center", marginBottom: 20,
  },
  modalTitle: {
    color: Colors.textPrimary, fontSize: 17,
    fontWeight: "700", marginBottom: 4,
  },
  modalSubtitle: {
    color: Colors.textMuted, fontSize: 13,
    marginBottom: 16,
  },
  sourceRow: {
    flexDirection: "row", alignItems: "center",
    gap: 8, marginBottom: 8,
  },
  sourceBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", backgroundColor: Colors.bgCard,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  sourceBtnLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  sourceQuality: { color: Colors.textPrimary, fontSize: 15, fontWeight: "600" },
  dubBadge: {
    backgroundColor: Colors.secondary + "33",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  dubText: { color: Colors.secondary, fontSize: 10, fontWeight: "700" },
  copyBtn: {
    backgroundColor: Colors.bgCard, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  cancelBtn: {
    marginTop: 8, alignItems: "center",
    paddingVertical: 14,
  },
  cancelText: { color: Colors.textMuted, fontSize: 15, fontWeight: "600" },
});
