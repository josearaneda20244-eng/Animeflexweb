import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
    queryKey: ["animePaheInfo", navTitle],
    queryFn: () => consumet.infoByTitle(navTitle),
    enabled: !!navTitle,
    retry: 1,
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

    const paheEpisodes = paheQuery.data?.episodes ?? [];
    const paheEp = paheEpisodes.find((e) => e.number === episode.number);
    const resolvedId = paheEp?.id ?? episode.id;

    router.push({
      pathname: "/player",
      params: {
        episodeId: resolvedId,
        episodeNum: String(episode.number),
        animeTitle: navTitle,
      },
    });
  };

  const topPad = Platform.OS === "web" ? 67 : 0;
  const episodes = anime?.episodes ?? [];
  const description = (anime?.description || params.description || "").replace(/<[^>]+>/g, "");
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
              ) : infoQuery.isError ? null : paheQuery.isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={Colors.primary} size="small" />
                  <Text style={styles.loadingText}>Preparando reproducción...</Text>
                </View>
              ) : (
                <Text style={styles.episodeCount}>{episodes.length} total</Text>
              )}
            </View>

            {infoQuery.isError && (
              <View style={styles.errorEps}>
                <Feather name="alert-circle" size={24} color={Colors.error} />
                <Text style={styles.errorEpsText}>
                  No se pudieron cargar los episodios
                </Text>
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
});
