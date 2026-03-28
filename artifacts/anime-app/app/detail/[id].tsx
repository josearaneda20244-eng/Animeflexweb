import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import EpisodeItem from "@/components/EpisodeItem";
import { GenreBadge } from "@/components/GenreBadge";
import Colors from "@/constants/colors";
import { useFavorites } from "@/context/FavoritesContext";
import { consumet, type Episode } from "@/lib/consumet";

const { width } = Dimensions.get("window");
const COVER_HEIGHT = 260;

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [loadingEp, setLoadingEp] = useState<string | null>(null);

  const infoQuery = useQuery({
    queryKey: ["animeInfo", id],
    queryFn: () => consumet.info(id!),
    enabled: !!id,
  });

  const anime = infoQuery.data;
  const fav = anime ? isFavorite(anime.id) : false;

  const title =
    typeof anime?.title === "string"
      ? anime.title
      : (anime?.title as any)?.english ||
        (anime?.title as any)?.romaji ||
        (anime?.title as any)?.userPreferred ||
        "Unknown";

  const handleFav = () => {
    if (!anime) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(anime);
  };

  const handleEpisode = async (episode: Episode) => {
    if (!id) return;
    setLoadingEp(episode.id);
    try {
      const data = await consumet.streaming(episode.id);
      const best =
        data.sources.find((s) => s.quality === "1080p") ||
        data.sources.find((s) => s.quality === "720p") ||
        data.sources[0];

      if (!best) {
        Alert.alert("No streams found", "Could not find a stream for this episode.");
        return;
      }

      setWatchedEps((prev) => new Set([...prev, episode.id]));

      if (Platform.OS === "web") {
        window.open(best.url, "_blank");
      } else {
        const canOpen = await Linking.canOpenURL(best.url);
        if (canOpen) {
          await Linking.openURL(best.url);
        } else {
          Alert.alert(
            "Stream URL",
            best.url,
            [
              { text: "Copy URL", onPress: () => {} },
              { text: "OK" },
            ]
          );
        }
      }
    } catch (err) {
      Alert.alert("Error", "Could not load episode. Please try again.");
    } finally {
      setLoadingEp(null);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : 0;

  if (infoQuery.isLoading) {
    return (
      <View style={[styles.center, { paddingTop: topPad + insets.top }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (infoQuery.isError || !anime) {
    return (
      <View style={[styles.center, { paddingTop: topPad + insets.top }]}>
        <Feather name="alert-circle" size={40} color={Colors.error} />
        <Text style={styles.errorText}>Failed to load anime info.</Text>
        <Pressable style={styles.retryBtn} onPress={() => infoQuery.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const episodes = anime.episodes ?? [];

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
                source={{ uri: anime.cover || anime.image }}
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
                <Feather
                  name="heart"
                  size={20}
                  color={fav ? Colors.accent : "#fff"}
                />
              </Pressable>
            </View>

            <View style={styles.heroRow}>
              <Image
                source={{ uri: anime.image }}
                style={styles.poster}
                resizeMode="cover"
              />
              <View style={styles.heroInfo}>
                <Text style={styles.animeTitle}>{title}</Text>
                <View style={styles.metaRow}>
                  {anime.rating && (
                    <View style={styles.ratingBadge}>
                      <Feather name="star" size={12} color={Colors.warning} />
                      <Text style={styles.ratingText}>
                        {typeof anime.rating === "number"
                          ? (anime.rating / 10).toFixed(1)
                          : anime.rating}
                      </Text>
                    </View>
                  )}
                  {anime.type && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{anime.type}</Text>
                    </View>
                  )}
                  {anime.status && (
                    <View
                      style={[
                        styles.statusBadge,
                        anime.status === "Ongoing" && styles.statusOngoing,
                      ]}
                    >
                      <Text style={styles.statusText}>{anime.status}</Text>
                    </View>
                  )}
                </View>
                {anime.releaseDate && (
                  <Text style={styles.metaLabel}>
                    <Feather name="calendar" size={11} color={Colors.textMuted} />{" "}
                    {anime.releaseDate}
                  </Text>
                )}
                {anime.totalEpisodes && (
                  <Text style={styles.metaLabel}>
                    <Feather name="tv" size={11} color={Colors.textMuted} />{" "}
                    {anime.totalEpisodes} Episodes
                  </Text>
                )}
              </View>
            </View>

            {anime.genres && anime.genres.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.genresScroll}
                contentContainerStyle={styles.genresContent}
              >
                {anime.genres.map((g) => (
                  <GenreBadge key={g} genre={g} />
                ))}
              </ScrollView>
            )}

            {anime.description && (
              <View style={styles.descSection}>
                <Text style={styles.sectionLabel}>Synopsis</Text>
                <Text style={styles.desc}>{anime.description.replace(/<[^>]+>/g, "")}</Text>
              </View>
            )}

            <View style={styles.episodesHeader}>
              <Text style={styles.sectionLabel}>Episodes</Text>
              <Text style={styles.episodeCount}>{episodes.length} total</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ position: "relative" }}>
            {loadingEp === item.id && (
              <View style={styles.epLoading}>
                <ActivityIndicator color={Colors.primary} size="small" />
              </View>
            )}
            <EpisodeItem
              episode={item}
              onPress={handleEpisode}
              watched={watchedEps.has(item.id)}
            />
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyEps}>
            <Feather name="tv" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyEpsText}>No episodes available</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  coverContainer: {
    width: "100%",
    height: COVER_HEIGHT,
    position: "relative",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,13,13,0.5)",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 10,
  },
  favBtn: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 10,
  },
  heroRow: {
    flexDirection: "row",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: -60,
  },
  poster: {
    width: 100,
    height: 145,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  heroInfo: {
    flex: 1,
    paddingTop: 16,
    gap: 8,
    justifyContent: "flex-end",
  },
  animeTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.warning + "22",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: "700",
  },
  typeBadge: {
    backgroundColor: Colors.secondary + "22",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadge: {
    backgroundColor: Colors.textMuted + "33",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusOngoing: {
    backgroundColor: Colors.success + "22",
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  metaLabel: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  genresScroll: {
    marginBottom: 4,
  },
  genresContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  descSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  sectionLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 16,
  },
  desc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  episodesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    paddingBottom: 8,
  },
  episodeCount: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  epLoading: {
    position: "absolute",
    right: 16,
    top: "50%",
    zIndex: 10,
    transform: [{ translateY: -10 }],
  },
  emptyEps: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 40,
  },
  emptyEpsText: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
});
