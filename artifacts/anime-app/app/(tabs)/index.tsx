import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimeCard from "@/components/AnimeCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import Colors from "@/constants/colors";
import { consumet, type AnimeResult } from "@/lib/consumet";

const { width } = Dimensions.get("window");
const BANNER_HEIGHT = Math.round(width * 0.56);

const SECTIONS = [
  { key: "trending", label: "Tendencias", icon: "trending-up" },
  { key: "popular", label: "Populares", icon: "award" },
  { key: "recent", label: "Recientes", icon: "clock" },
] as const;

type Section = (typeof SECTIONS)[number]["key"];

function resolveTitle(title: AnimeResult["title"]): string {
  if (!title) return "Unknown";
  if (typeof title === "string") return title;
  return (
    (title as any).english ||
    (title as any).romaji ||
    (title as any).userPreferred ||
    "Unknown"
  );
}

function FeaturedBanner({ anime }: { anime: AnimeResult }) {
  const router = useRouter();

  const handlePress = () => {
    const title = resolveTitle(anime.title);
    router.push({
      pathname: "/detail/[id]",
      params: {
        id: anime.id,
        title,
        image: anime.image,
        cover: anime.cover || "",
        rating: String(anime.rating ?? ""),
        type: anime.type ?? "",
        status: anime.status ?? "",
        releaseDate: String(anime.releaseDate ?? ""),
        totalEpisodes: String(anime.totalEpisodes ?? ""),
        description: anime.description ?? "",
        genres: JSON.stringify(anime.genres ?? []),
      },
    });
  };

  const title = resolveTitle(anime.title);

  return (
    <Pressable
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.9 }]}
      onPress={handlePress}
    >
      <Image
        source={{ uri: anime.cover || anime.image }}
        style={styles.bannerImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(13,13,13,0.5)", Colors.bg]}
        style={styles.bannerGradient}
      />
      <View style={styles.bannerContent}>
        <View style={styles.bannerBadgeRow}>
          <View style={styles.featuredBadge}>
            <Feather name="zap" size={10} color={Colors.primary} />
            <Text style={styles.featuredText}>Destacado</Text>
          </View>
          {anime.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{anime.type}</Text>
            </View>
          )}
        </View>
        <Text style={styles.bannerTitle} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.bannerMeta}>
          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.ratingRow}>
              <Feather name="star" size={12} color={Colors.warning} />
              <Text style={styles.ratingText}>{(anime.rating / 10).toFixed(1)}</Text>
            </View>
          )}
          {anime.totalEpisodes && (
            <Text style={styles.bannerMetaText}>
              {anime.totalEpisodes} episodios
            </Text>
          )}
          {anime.status && (
            <Text style={[
              styles.bannerStatus,
              anime.status === "Ongoing" && styles.statusOngoing,
            ]}>
              {anime.status}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.watchBtn} onPress={handlePress}>
          <Feather name="play" size={14} color="#fff" />
          <Text style={styles.watchBtnText}>Ver ahora</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>("trending");
  const [refreshing, setRefreshing] = useState(false);

  const trendingQuery = useQuery({
    queryKey: ["trending"],
    queryFn: () => consumet.trending(),
  });

  const popularQuery = useQuery({
    queryKey: ["popular"],
    queryFn: () => consumet.popular(),
  });

  const recentQuery = useQuery({
    queryKey: ["recent"],
    queryFn: () => consumet.recentEpisodes(),
  });

  const activeQuery =
    section === "trending"
      ? trendingQuery
      : section === "popular"
        ? popularQuery
        : recentQuery;

  const data = activeQuery.data?.results ?? [];
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;

  const featuredAnime = trendingQuery.data?.results?.[0] ?? null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await activeQuery.refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={styles.logoAccent}>Ani</Text>
          <Text style={styles.logoMain}>Flow</Text>
        </Text>
      </View>

      {isError ? (
        <View style={styles.errorContainer}>
          <Feather name="wifi-off" size={40} color={Colors.textMuted} />
          <Text style={styles.errorText}>No se pudo cargar el contenido</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => activeQuery.refetch()}
          >
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={isLoading ? Array(8).fill(null) : data}
          numColumns={2}
          keyExtractor={(item, i) => item?.id ?? `skeleton-${i}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 90 + (Platform.OS === "web" ? 34 : insets.bottom) },
          ]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Featured banner */}
              {featuredAnime && !trendingQuery.isLoading && section === "trending" && (
                <FeaturedBanner anime={featuredAnime} />
              )}

              {/* Section tabs */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabs}
                contentContainerStyle={styles.tabsContent}
              >
                {SECTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.tab, section === s.key && styles.tabActive]}
                    onPress={() => setSection(s.key)}
                  >
                    <Feather
                      name={s.icon as any}
                      size={13}
                      color={section === s.key ? "#fff" : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.tabText,
                        section === s.key && styles.tabTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          }
          renderItem={({ item }) =>
            item === null ? (
              <SkeletonCard />
            ) : (
              <AnimeCard anime={item} />
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
  },
  logo: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: Colors.primary,
  },
  logoMain: {
    color: Colors.textPrimary,
  },
  banner: {
    width: "100%",
    height: BANNER_HEIGHT,
    position: "relative",
    marginBottom: 4,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 6,
  },
  bannerBadgeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary + "33",
    borderWidth: 1,
    borderColor: Colors.primary + "66",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  featuredText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  typeBadgeText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "600",
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: Colors.warning,
    fontSize: 13,
    fontWeight: "700",
  },
  bannerMetaText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
  },
  bannerStatus: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  statusOngoing: {
    color: Colors.success,
    fontWeight: "600",
  },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  watchBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  tabs: {
    marginBottom: 10,
    marginTop: 4,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#fff",
  },
  list: {
    padding: 16,
    paddingTop: 0,
    gap: 14,
  },
  row: {
    justifyContent: "space-between",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: "center",
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
  },
});
