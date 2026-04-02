import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { useHistory } from "@/context/HistoryContext";
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
  const { addToHistory } = useHistory();
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [descExpanded, setDescExpanded] = useState(false);

  const navTitle = params.title ?? "";
  const navImage = params.image ?? "";
  const navCover = params.cover ?? "";
  const navRating = params.rating ? parseFloat(params.rating) : undefined;
  const navGenres = params.genres ? (JSON.parse(params.genres) as string[]) : [];

  const infoQuery = useQuery({
    queryKey: ["animeAnilistInfo", params.id],
    queryFn: () => consumet.anilistInfo(params.id),
    enabled: !!params.id,
    retry: 2,
    staleTime: 1000 * 60 * 10,
  });

  const paheQuery = useQuery({
    queryKey: ["animeEpisodesById", params.id],
    queryFn: () => consumet.episodesById(params.id),
    enabled: !!params.id,
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

  const handleEpisode = (episode: Episode) => {
    if (!episode?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWatchedEps((prev) => new Set([...prev, episode.id]));

    addToHistory(animeForFav, episode.number);

    const paheEpisodes = paheQuery.data?.episodes ?? [];
    const paheEp = paheEpisodes.find((e) => e.number === episode.number);
    const resolvedId = paheEp?.id ?? episode.id;

    router.push({
      pathname: "/player",
      params: {
        episodeId: resolvedId,
        episodeNum: String(episode.number),
        animeTitle: navTitle,
        animeId: params.id,
        animeImage: navImage,
      },
    });
  };

  const topPad = Platform.OS === "web" ? 67 : 0;
  const episodes = anime?.episodes ?? [];
  const rawDesc = (anime?.description || params.description || "").replace(/<[^>]+>/g, "");
  const description = rawDesc;
  const genres = anime?.genres?.length ? anime.genres : navGenres;
  const displayStatus = anime?.status || params.status;
  const displayType = anime?.type || params.type;
  const displayEps = anime?.totalEpisodes || (params.totalEpisodes ? parseInt(params.totalEpisodes) : undefined);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <FlatList
        data={episodes}
        keyExtractor={(ep) => ep.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 + (Platform.OS === "web" ? 34 : insets.bottom) }}
        ListHeaderComponent={
          <View>
            {/* Cover image with overlay */}
            <View style={styles.coverWrap}>
              <Image
                source={{ uri: navCover || navImage }}
                style={styles.cover}
                resizeMode="cover"
              />
              <LinearGradient
                colors={["rgba(9,10,18,0.15)", "rgba(9,10,18,0.5)", Colors.bg]}
                locations={[0, 0.6, 1]}
                style={StyleSheet.absoluteFill}
              />
              <Pressable
                style={[styles.backBtn, { top: insets.top + 14 }]}
                onPress={() => router.back()}
              >
                <Feather name="arrow-left" size={20} color="#fff" />
              </Pressable>
              <Pressable
                style={[styles.favBtn, { top: insets.top + 14 }, fav && styles.favBtnActive]}
                onPress={handleFav}
              >
                <Feather name="heart" size={18} color={fav ? Colors.pink : "rgba(255,255,255,0.75)"} />
              </Pressable>
            </View>

            {/* Poster + Info */}
            <View style={styles.heroRow}>
              <Image source={{ uri: navImage }} style={styles.poster} resizeMode="cover" />
              <View style={styles.heroInfo}>
                <Text style={styles.animeTitle}>{navTitle}</Text>

                <View style={styles.metaRow}>
                  {navRating !== undefined && navRating > 0 && (
                    <View style={styles.ratingBadge}>
                      <Feather name="star" size={11} color={Colors.gold} />
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

                <View style={styles.metaInfoRow}>
                  {params.releaseDate && params.releaseDate !== "undefined" && (
                    <View style={styles.metaInfoItem}>
                      <Feather name="calendar" size={11} color={Colors.textMuted} />
                      <Text style={styles.metaInfoText}>{params.releaseDate}</Text>
                    </View>
                  )}
                  {displayEps && (
                    <View style={styles.metaInfoItem}>
                      <Feather name="tv" size={11} color={Colors.textMuted} />
                      <Text style={styles.metaInfoText}>{displayEps} EP</Text>
                    </View>
                  )}
                </View>

                {/* Play first episode button */}
                {episodes.length > 0 && (
                  <Pressable
                    style={styles.playFirstBtn}
                    onPress={() => handleEpisode(episodes[0])}
                  >
                    <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.playFirstGrad}>
                      <Feather name="play" size={13} color="#fff" />
                      <Text style={styles.playFirstText}>Ep. 1</Text>
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Genres */}
            {genres.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genresContent}
              >
                {genres.map((g) => <GenreBadge key={g} genre={g} />)}
              </ScrollView>
            )}

            {/* Description */}
            {description.length > 0 && (
              <View style={styles.descSection}>
                <View style={styles.sectionLabelRow}>
                  <View style={styles.sectionAccent} />
                  <Text style={styles.sectionLabel}>Sinopsis</Text>
                </View>
                <Text
                  style={styles.desc}
                  numberOfLines={descExpanded ? undefined : 4}
                >
                  {description}
                </Text>
                {description.length > 200 && (
                  <Pressable onPress={() => setDescExpanded((v) => !v)} style={styles.expandBtn}>
                    <Text style={styles.expandBtnText}>
                      {descExpanded ? "Ver menos" : "Ver más"}
                    </Text>
                    <Feather
                      name={descExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color={Colors.primary}
                    />
                  </Pressable>
                )}
              </View>
            )}

            {/* Episodes header */}
            <View style={styles.episodesHeader}>
              <View style={styles.sectionLabelRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionLabel}>Episodios</Text>
              </View>
              {infoQuery.isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={styles.loadingText}>Cargando...</Text>
                </View>
              ) : paheQuery.isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={styles.loadingText}>Preparando...</Text>
                </View>
              ) : (
                <View style={styles.epCountBadge}>
                  <Text style={styles.epCountText}>{episodes.length} total</Text>
                </View>
              )}
            </View>

            {infoQuery.isError && (
              <View style={styles.errorEps}>
                <Feather name="alert-circle" size={24} color={Colors.error} />
                <Text style={styles.errorEpsText}>No se pudieron cargar los episodios</Text>
                <Pressable style={styles.retrySmall} onPress={() => infoQuery.refetch()}>
                  <Text style={styles.retrySmallText}>Reintentar</Text>
                </Pressable>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <EpisodeItem
            episode={item}
            onPress={handleEpisode}
            watched={watchedEps.has(item.id)}
          />
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
  container: { flex: 1, backgroundColor: Colors.bg },

  coverWrap: { width: "100%", height: 270, position: "relative" },
  cover: { width: "100%", height: "100%" },
  backBtn: {
    position: "absolute",
    left: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  favBtn: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  favBtnActive: {
    backgroundColor: Colors.pink + "25",
    borderColor: Colors.pink + "60",
  },

  heroRow: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: -70,
  },
  poster: {
    width: 100,
    height: 148,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  heroInfo: { flex: 1, paddingTop: 20, gap: 8, justifyContent: "flex-end" },
  animeTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.gold + "22",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  ratingText: { color: Colors.gold, fontSize: 12, fontWeight: "700" },
  typeBadge: {
    backgroundColor: Colors.primary + "22",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
  },
  typeText: { color: Colors.primary, fontSize: 11, fontWeight: "700" },
  statusBadge: {
    backgroundColor: Colors.textMuted + "22",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusOngoing: { backgroundColor: Colors.success + "22", borderWidth: 1, borderColor: Colors.success + "40" },
  statusText: { color: Colors.textSecondary, fontSize: 11, fontWeight: "600" },
  metaInfoRow: { flexDirection: "row", gap: 10 },
  metaInfoItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaInfoText: { color: Colors.textMuted, fontSize: 11 },
  playFirstBtn: { borderRadius: 10, overflow: "hidden", alignSelf: "flex-start", marginTop: 2 },
  playFirstGrad: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8 },
  playFirstText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  genresContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 12, paddingTop: 4 },

  descSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.primary },
  sectionLabel: { color: Colors.textPrimary, fontSize: 16, fontWeight: "800" },
  desc: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 2 },
  expandBtnText: { color: Colors.primary, fontSize: 13, fontWeight: "700" },

  episodesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingText: { color: Colors.textMuted, fontSize: 13 },
  epCountBadge: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  epCountText: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },

  emptyEps: { alignItems: "center", gap: 10, paddingVertical: 40 },
  emptyEpsText: { color: Colors.textMuted, fontSize: 15 },
  errorEps: { alignItems: "center", gap: 12, paddingVertical: 24, paddingHorizontal: 24 },
  errorEpsText: { color: Colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20 },
  retrySmall: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  retrySmallText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
