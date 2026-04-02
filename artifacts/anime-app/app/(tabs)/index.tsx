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
const BANNER_HEIGHT = Math.round(width * 0.62);
const CAROUSEL_CARD_W = width * 0.38;
const CAROUSEL_CARD_H = CAROUSEL_CARD_W * 1.5;
const TOP_CARD_W = width * 0.32;
const TOP_CARD_H = TOP_CARD_W * 1.5;

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
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.92 }]}
      onPress={handlePress}
    >
      <Image
        source={{ uri: anime.cover || anime.image }}
        style={styles.bannerImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(10,10,20,0.55)", Colors.bg]}
        locations={[0.2, 0.65, 1]}
        style={styles.bannerGradient}
      />
      {/* Side accent line */}
      <View style={styles.bannerAccentLine} />

      <View style={styles.bannerContent}>
        <View style={styles.bannerBadgeRow}>
          <LinearGradient
            colors={[Colors.primary, Colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.featuredBadge}
          >
            <Feather name="zap" size={9} color="#fff" />
            <Text style={styles.featuredText}>DESTACADO</Text>
          </LinearGradient>
          {anime.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{anime.type}</Text>
            </View>
          )}
          {anime.status === "Ongoing" && (
            <View style={styles.ongoingBadge}>
              <View style={styles.ongoingDot} />
              <Text style={styles.ongoingText}>EN EMISIÓN</Text>
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
          {anime.totalEpisodes ? (
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{anime.totalEpisodes} eps</Text>
            </View>
          ) : null}
          {anime.genres?.slice(0, 2).map((g) => (
            <View key={g} style={styles.genrePill}>
              <Text style={styles.genrePillText}>{g}</Text>
            </View>
          ))}
        </View>
        <View style={styles.bannerButtons}>
          <TouchableOpacity style={styles.watchBtn} onPress={handlePress}>
            <Feather name="play" size={14} color="#fff" />
            <Text style={styles.watchBtnText}>Ver ahora</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoBtn} onPress={handlePress}>
            <Feather name="info" size={14} color={Colors.textSecondary} />
            <Text style={styles.infoBtnText}>Más info</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle, onMore }: { title: string; subtitle?: string; onMore?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionAccent} />
        <View>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {onMore && (
        <TouchableOpacity style={styles.moreBtn} onPress={onMore}>
          <Text style={styles.moreBtnText}>Ver más</Text>
          <Feather name="chevron-right" size={14} color={Colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function CarouselCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);

  const handlePress = () => {
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

  return (
    <Pressable
      style={({ pressed }) => [
        styles.carouselCard,
        pressed && { transform: [{ scale: 0.96 }], opacity: 0.88 },
      ]}
      onPress={handlePress}
    >
      <Image source={{ uri: anime.image }} style={styles.carouselImage} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(10,10,20,0.95)"]}
        style={styles.carouselGradient}
      />
      {anime.rating != null && anime.rating > 0 && (
        <View style={styles.carouselRating}>
          <Feather name="star" size={9} color={Colors.warning} />
          <Text style={styles.carouselRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
        </View>
      )}
      {anime.type && (
        <View style={styles.carouselType}>
          <Text style={styles.carouselTypeText}>{anime.type}</Text>
        </View>
      )}
      <View style={styles.carouselInfo}>
        <Text style={styles.carouselTitle} numberOfLines={2}>{title}</Text>
        {anime.totalEpisodes ? (
          <Text style={styles.carouselEps}>{anime.totalEpisodes} episodios</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function TopRankCard({ anime, rank }: { anime: AnimeResult; rank: number }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);

  const handlePress = () => {
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

  const rankColor = rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : Colors.textMuted;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.topCard,
        pressed && { transform: [{ scale: 0.96 }], opacity: 0.88 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.topRankBg}>
        <Text style={[styles.topRankNumber, { color: rankColor }]}>
          {rank}
        </Text>
      </View>
      <Image source={{ uri: anime.image }} style={styles.topImage} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(10,10,20,0.98)"]}
        style={styles.topGradient}
      />
      {rank <= 3 && (
        <View style={[styles.topCrown, { backgroundColor: rankColor + "33", borderColor: rankColor + "66" }]}>
          <Text style={{ fontSize: 10 }}>{rank === 1 ? "👑" : rank === 2 ? "🥈" : "🥉"}</Text>
        </View>
      )}
      <View style={styles.topInfo}>
        <Text style={styles.topTitle} numberOfLines={2}>{title}</Text>
        {anime.rating != null && anime.rating > 0 && (
          <View style={styles.topRatingRow}>
            <Feather name="star" size={9} color={Colors.warning} />
            <Text style={styles.topRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function RecentEpisodeCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);

  const handlePress = () => {
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

  return (
    <Pressable
      style={({ pressed }) => [
        styles.recentCard,
        pressed && { opacity: 0.85 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.recentImageWrap}>
        <Image source={{ uri: anime.image }} style={styles.recentImage} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(10,10,20,0.85)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.recentPlayBtn}>
          <Feather name="play" size={12} color="#fff" />
        </View>
        {(anime as any).episodeNumber != null && (
          <View style={styles.recentEpBadge}>
            <Text style={styles.recentEpText}>EP {(anime as any).episodeNumber}</Text>
          </View>
        )}
      </View>
      <View style={styles.recentInfo}>
        <Text style={styles.recentTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.recentMeta}>
          {anime.type && <Text style={styles.recentType}>{anime.type}</Text>}
          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.recentRatingRow}>
              <Feather name="star" size={8} color={Colors.warning} />
              <Text style={styles.recentRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function SkeletonCarousel() {
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.carouselCard,
            { backgroundColor: Colors.bgSurface, opacity: 0.5 + i * 0.1 },
          ]}
        />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

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

  const trendingData = trendingQuery.data?.results ?? [];
  const popularData = popularQuery.data?.results ?? [];
  const recentData = recentQuery.data?.results ?? [];

  const featuredAnime = trendingData[0] ?? null;
  const topAnimes = trendingData.slice(0, 10);
  const recommendations = popularData.slice(0, 10);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      trendingQuery.refetch(),
      popularQuery.refetch(),
      recentQuery.refetch(),
    ]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: topPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
      contentContainerStyle={{
        paddingBottom: 100 + (Platform.OS === "web" ? 34 : insets.bottom),
      }}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>
            <Text style={styles.logoAccent}>Anime</Text>
            <Text style={styles.logoMain}>Flex</Text>
          </Text>
          <Text style={styles.logoTagline}>Tu portal de anime</Text>
        </View>
        <View style={styles.headerRight}>
          <LinearGradient
            colors={[Colors.primary + "33", Colors.accent + "22"]}
            style={styles.liveTag}
          >
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Hero Banner */}
      {featuredAnime && !trendingQuery.isLoading && (
        <FeaturedBanner anime={featuredAnime} />
      )}
      {trendingQuery.isLoading && (
        <View style={[styles.banner, { backgroundColor: Colors.bgSurface, opacity: 0.4 }]} />
      )}

      {/* Spotlight dots */}
      {trendingData.length > 1 && (
        <View style={styles.dotsRow}>
          {trendingData.slice(0, 5).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === 0 && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* TOP ANIMES */}
      <SectionHeader
        title="Top Animes"
        subtitle="Los más valorados del momento"
        onMore={() => {}}
      />
      {trendingQuery.isLoading ? (
        <SkeletonCarousel />
      ) : (
        <FlatList
          data={topAnimes}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          renderItem={({ item, index }) => (
            <TopRankCard anime={item} rank={index + 1} />
          )}
        />
      )}

      {/* Divider */}
      <LinearGradient
        colors={["transparent", Colors.primary + "44", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.divider}
      />

      {/* EPISODIOS RECIENTES */}
      <SectionHeader
        title="Episodios Recientes"
        subtitle="Actualizados hoy"
        onMore={() => {}}
      />
      {recentQuery.isLoading ? (
        <SkeletonCarousel />
      ) : (
        <FlatList
          data={recentData.slice(0, 12)}
          keyExtractor={(item, i) => item.id + i}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          renderItem={({ item }) => <RecentEpisodeCard anime={item} />}
        />
      )}

      {/* Divider */}
      <LinearGradient
        colors={["transparent", Colors.secondary + "44", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.divider}
      />

      {/* RECOMENDACIONES */}
      <SectionHeader
        title="Recomendaciones"
        subtitle="Seleccionados para ti"
        onMore={() => {}}
      />
      {popularQuery.isLoading ? (
        <SkeletonCarousel />
      ) : (
        <FlatList
          data={recommendations}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carouselContent}
          renderItem={({ item }) => <CarouselCard anime={item} />}
        />
      )}

      {/* Divider */}
      <LinearGradient
        colors={["transparent", Colors.accent + "33", "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.divider}
      />

      {/* POPULARES – Grid */}
      <SectionHeader
        title="Populares"
        subtitle="Los favoritos de la comunidad"
      />
      <View style={styles.gridContainer}>
        {popularQuery.isLoading
          ? Array(6).fill(null).map((_, i) => <SkeletonCard key={i} />)
          : popularData.slice(0, 6).map((item) => (
              <AnimeCard key={item.id} anime={item} />
            ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: Colors.primary,
  },
  logoMain: {
    color: Colors.textPrimary,
  },
  logoTagline: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: -2,
    letterSpacing: 0.3,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  liveText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },

  // Banner
  banner: {
    width: "100%",
    height: BANNER_HEIGHT,
    position: "relative",
    marginBottom: 0,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerAccentLine: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    opacity: 0.8,
  },
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 8,
  },
  bannerBadgeRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  featuredText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  typeBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  typeBadgeText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "700",
  },
  ongoingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.success + "22",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.success + "55",
  },
  ongoingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  ongoingText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    letterSpacing: -0.3,
  },
  bannerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    color: Colors.warning,
    fontSize: 12,
    fontWeight: "800",
  },
  metaPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  metaPillText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 11,
    fontWeight: "600",
  },
  genrePill: {
    backgroundColor: Colors.primary + "33",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary + "55",
  },
  genrePillText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "600",
  },
  bannerButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  watchBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  infoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  infoBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    marginBottom: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.primary,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionAccent: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  moreBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 0,
    marginVertical: 6,
  },

  // Carousel
  carouselContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  carouselCard: {
    width: CAROUSEL_CARD_W,
    height: CAROUSEL_CARD_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  carouselGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  carouselRating: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,214,10,0.3)",
  },
  carouselRatingText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },
  carouselType: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.primary + "CC",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  carouselTypeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  carouselInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    gap: 3,
  },
  carouselTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  carouselEps: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 10,
  },

  // Top rank card
  topCard: {
    width: TOP_CARD_W,
    height: TOP_CARD_H,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  topRankBg: {
    position: "absolute",
    bottom: -6,
    left: -6,
    zIndex: 10,
  },
  topRankNumber: {
    fontSize: 52,
    fontWeight: "900",
    opacity: 0.25,
    lineHeight: 55,
    letterSpacing: -2,
  },
  topImage: {
    width: "100%",
    height: "100%",
  },
  topGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topCrown: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 8,
    padding: 5,
    borderWidth: 1,
  },
  topInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    gap: 3,
  },
  topTitle: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  topRatingText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: "700",
  },

  // Recent episodes
  recentCard: {
    width: 130,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recentImageWrap: {
    width: "100%",
    height: 86,
    position: "relative",
  },
  recentImage: {
    width: "100%",
    height: "100%",
  },
  recentPlayBtn: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -14,
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  recentEpBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: Colors.secondary + "DD",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  recentEpText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  recentInfo: {
    padding: 8,
    gap: 4,
  },
  recentTitle: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 15,
  },
  recentMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentType: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "600",
  },
  recentRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  recentRatingText: {
    color: Colors.warning,
    fontSize: 9,
    fontWeight: "700",
  },

  // Popular grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 14,
    justifyContent: "space-between",
  },
});
