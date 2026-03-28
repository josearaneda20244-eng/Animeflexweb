import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
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
import { consumet, type Episode, type AnimeResult } from "@/lib/consumet";

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

  const navTitle = params.title ?? "";
  const navImage = params.image ?? "";
  const navCover = params.cover ?? "";
  const navRating = params.rating ? parseFloat(params.rating) : undefined;
  const navGenres = params.genres ? (JSON.parse(params.genres) as string[]) : [];

  const infoQuery = useQuery({
    queryKey: ["animeInfoByTitle", navTitle],
    queryFn: () => consumet.infoByTitle(navTitle),
    enabled: !!navTitle,
    retry: 1,
  });

  const anime = infoQuery.data;

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

  const fav = isFavorite(params.id);

  const handleFav = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(animeForFav);
  };

  const handleEpisode = async (episode: Episode) => {
    if (!episode?.id) return;
    setLoadingEp(episode.id);
    try {
      const data = await consumet.streaming(episode.id);
      const best =
        data.sources?.find((s) => s.quality === "1080p") ||
        data.sources?.find((s) => s.quality === "720p") ||
        data.sources?.[0];

      if (!best) {
        Alert.alert("Sin streams", "No se encontró un stream para este episodio.");
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
          Alert.alert("URL del stream", best.url);
        }
      }
    } catch {
      Alert.alert("Error", "No se pudo cargar el episodio. Intenta de nuevo.");
    } finally {
      setLoadingEp(null);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : 0;
  const episodes = anime?.episodes ?? [];
  const description =
    (anime?.description || params.description || "").replace(/<[^>]+>/g, "");
  const genres = anime?.genres?.length ? anime.genres : navGenres;
  const rating = navRating;
  const displayStatus = anime?.status || params.status;
  const displayType = anime?.type || params.type;
  const displayEps = anime?.totalEpisodes || (params.totalEpisodes ? parseInt(params.totalEpisodes) : undefined);

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
                style={[styles.backBtn, { top: insets.top + (Platform.OS === "web" ? 12 : 12) }]}
                onPress={() => router.back()}
              >
                <Feather name="arrow-left" size={20} color="#fff" />
              </Pressable>

              <Pressable
                style={[styles.favBtn, { top: insets.top + (Platform.OS === "web" ? 12 : 12) }]}
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
                source={{ uri: navImage }}
                style={styles.poster}
                resizeMode="cover"
              />
              <View style={styles.heroInfo}>
                <Text style={styles.animeTitle}>{navTitle}</Text>
                <View style={styles.metaRow}>
                  {rating !== undefined && rating > 0 && (
                    <View style={styles.ratingBadge}>
                      <Feather name="star" size={12} color={Colors.warning} />
                      <Text style={styles.ratingText}>
                        {(rating / 10).toFixed(1)}
                      </Text>
                    </View>
                  )}
                  {displayType && (
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{displayType}</Text>
                    </View>
                  )}
                  {displayStatus && (
                    <View
                      style={[
                        styles.statusBadge,
                        displayStatus === "Ongoing" && styles.statusOngoing,
                      ]}
                    >
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
                style={styles.genresScroll}
                contentContainerStyle={styles.genresContent}
              >
                {genres.map((g) => (
                  <GenreBadge key={g} genre={g} />
                ))}
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
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <Text style={styles.episodeCount}>{episodes.length} total</Text>
              )}
            </View>

            {infoQuery.isError && (
              <View style={styles.errorEps}>
                <Feather name="alert-circle" size={20} color={Colors.error} />
                <Text style={styles.errorEpsText}>
                  No se pudieron cargar los episodios
                </Text>
                <Pressable
                  style={styles.retrySmall}
                  onPress={() => infoQuery.refetch()}
                >
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
            <EpisodeItem
              episode={item}
              onPress={handleEpisode}
              watched={watchedEps.has(item.id)}
            />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  coverContainer: {
    width: "100%",
    height: 260,
    position: "relative",
  },
  cover: {
    width: "100%",
    height: "100%",
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,13,13,0.45)",
  },
  backBtn: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    padding: 8,
    borderRadius: 10,
  },
  favBtn: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
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
    marginBottom: 8,
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
  errorEps: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  errorEpsText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
  retrySmall: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retrySmallText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
