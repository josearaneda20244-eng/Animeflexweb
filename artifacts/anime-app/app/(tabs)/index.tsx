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

import { SkeletonCard } from "@/components/SkeletonCard";
import Colors from "@/constants/colors";
import { consumet, type AnimeResult } from "@/lib/consumet";

const { width } = Dimensions.get("window");
const BANNER_HEIGHT = Math.round(width * 0.72);
const CAROUSEL_CARD_W = width * 0.38;
const CAROUSEL_CARD_H = CAROUSEL_CARD_W * 1.5;

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

function navigateToAnime(router: any, anime: AnimeResult) {
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
}

/* ─── HERO BANNER ────────────────────────────────── */
function FeaturedBanner({
  animes,
  index,
  onPrev,
  onNext,
}: {
  animes: AnimeResult[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const router = useRouter();
  const anime = animes[index];
  if (!anime) return null;

  const title = resolveTitle(anime.title);
  const total = animes.length;

  return (
    <View style={styles.banner}>
      <Image
        source={{ uri: anime.cover || anime.image }}
        style={styles.bannerImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(8,10,18,0.15)", "rgba(8,10,18,0.5)", Colors.bg]}
        locations={[0, 0.55, 1]}
        style={styles.bannerGradient}
      />

      {/* Top badges row */}
      <View style={styles.bannerTopRow}>
        {anime.totalEpisodes ? (
          <View style={styles.ccBadge}>
            <Text style={styles.ccBadgeText}>CC {anime.totalEpisodes}</Text>
          </View>
        ) : null}
        {anime.status === "Ongoing" && (
          <View style={styles.epGreenBadge}>
            <Feather name="bookmark" size={9} color="#fff" />
            <Text style={styles.epGreenText}>
              {anime.totalEpisodes ?? "?"}
            </Text>
          </View>
        )}
        {anime.type && (
          <View style={styles.tvBadge}>
            <Text style={styles.tvBadgeText}>
              {anime.type === "TV" ? "TELEVISOR" : anime.type.toUpperCase()}
            </Text>
          </View>
        )}
        {anime.genres && anime.genres.length > 0 && (
          <Text style={styles.bannerGenres} numberOfLines={1}>
            {anime.genres.slice(0, 3).join(", ")}
          </Text>
        )}
      </View>

      {/* Content */}
      <View style={styles.bannerContent}>
        <Text style={styles.bannerTitle} numberOfLines={3}>
          {title}
        </Text>

        {/* Two wide buttons */}
        <View style={styles.bannerButtons}>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={() => navigateToAnime(router, anime)}
          >
            <Feather name="play" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bookmarkBtn}
            onPress={() => navigateToAnime(router, anime)}
          >
            <Feather name="bookmark" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Pagination */}
        <View style={styles.pagination}>
          <TouchableOpacity onPress={onPrev} style={styles.paginationArrow}>
            <Feather name="chevron-left" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.paginationText}>
            <Text style={styles.paginationCurrent}>{index + 1}</Text>
            <Text style={styles.paginationSep}> / </Text>
            <Text style={styles.paginationTotal}>{total}</Text>
          </Text>
          <TouchableOpacity onPress={onNext} style={styles.paginationArrow}>
            <Feather name="chevron-right" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ─── TRENDING ROW (vertical list like anikai.to) ── */
function TrendingRow({ anime, rank }: { anime: AnimeResult; rank: number }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);
  const isTop3 = rank <= 3;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.trendRow,
        pressed && { backgroundColor: Colors.bgElevated },
      ]}
      onPress={() => navigateToAnime(router, anime)}
    >
      {/* Rank */}
      <View style={styles.rankWrap}>
        {isTop3 && (
          <View style={styles.clawMark}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.clawLine,
                  { transform: [{ rotate: `${-15 + i * 15}deg` }] },
                ]}
              />
            ))}
          </View>
        )}
        <View style={[styles.rankCircle, isTop3 && styles.rankCircleTop]}>
          <Text style={[styles.rankNumber, isTop3 && styles.rankNumberTop]}>
            {rank}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.trendInfo}>
        <Text style={styles.trendTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.trendMeta}>
          {anime.totalEpisodes ? (
            <View style={styles.trendCCBadge}>
              <Text style={styles.trendCCText}>CC {anime.totalEpisodes}</Text>
            </View>
          ) : null}
          {anime.status === "Ongoing" && (
            <View style={styles.trendGreenBadge}>
              <Feather name="bookmark" size={8} color="#fff" />
              <Text style={styles.trendGreenText}>
                {anime.totalEpisodes ?? "?"}
              </Text>
            </View>
          )}
          <Text style={styles.trendType}>
            {anime.type === "TV" ? "TELEVISOR" : (anime.type ?? "TELEVISOR")}
          </Text>
        </View>
      </View>

      {/* Thumbnail */}
      <Image
        source={{ uri: anime.image }}
        style={styles.trendThumb}
        resizeMode="cover"
      />
    </Pressable>
  );
}

/* ─── RECENT CAROUSEL CARD ──────────────────────── */
function RecentCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.recentCard,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
      onPress={() => navigateToAnime(router, anime)}
    >
      <Image source={{ uri: anime.image }} style={styles.recentImage} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(8,10,18,0.97)"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Play overlay */}
      <View style={styles.recentPlayCircle}>
        <Feather name="play" size={11} color="#fff" />
      </View>
      {/* CC badge */}
      {anime.totalEpisodes ? (
        <View style={styles.recentCCBadge}>
          <Text style={styles.recentCCText}>CC {anime.totalEpisodes}</Text>
        </View>
      ) : null}
      <View style={styles.recentFooter}>
        <Text style={styles.recentTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.recentType}>
          {anime.type === "TV" ? "TELEVISOR" : (anime.type ?? "TV")}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── POPULAR CAROUSEL CARD ─────────────────────── */
function PopularCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.popularCard,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
      onPress={() => navigateToAnime(router, anime)}
    >
      <Image source={{ uri: anime.image }} style={styles.popularImage} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(8,10,18,0.97)"]}
        style={StyleSheet.absoluteFill}
      />
      {anime.totalEpisodes ? (
        <View style={styles.popularCCBadge}>
          <Text style={styles.popularCCText}>CC {anime.totalEpisodes}</Text>
        </View>
      ) : null}
      {anime.rating != null && anime.rating > 0 && (
        <View style={styles.popularRating}>
          <Feather name="star" size={9} color={Colors.accent} />
          <Text style={styles.popularRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
        </View>
      )}
      <View style={styles.popularFooter}>
        <Text style={styles.popularTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.popularType}>
          {anime.type === "TV" ? "TELEVISOR" : (anime.type ?? "TV")}
        </Text>
      </View>
    </Pressable>
  );
}

/* ─── SECTION HEADER ─────────────────────────────── */
function SectionHeader({
  icon,
  title,
  iconColor = Colors.primary,
  showButton = false,
}: {
  icon: string;
  title: string;
  iconColor?: string;
  showButton?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLeft}>
        <View style={[styles.sectionIconCircle, { backgroundColor: iconColor + "22" }]}>
          <Feather name={icon as any} size={16} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {showButton && (
        <TouchableOpacity style={styles.ahoraBtn}>
          <Text style={styles.ahoraBtnText}>AHORA</Text>
          <Feather name="chevron-down" size={12} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ─── MAIN SCREEN ────────────────────────────────── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [bannerIndex, setBannerIndex] = useState(0);
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

  const trendingData = trendingQuery.data?.results ?? [];
  const popularData = popularQuery.data?.results ?? [];
  const recentData = recentQuery.data?.results ?? [];

  const bannerAnimes = trendingData.slice(0, 10);
  const trendingList = trendingData.slice(0, 10);
  const recentList = recentData.slice(0, 12);
  const popularList = popularData.slice(0, 10);

  const handlePrev = () =>
    setBannerIndex((i) => (i - 1 + bannerAnimes.length) % bannerAnimes.length);
  const handleNext = () =>
    setBannerIndex((i) => (i + 1) % bannerAnimes.length);

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
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuBtn} hitSlop={8}>
          <Feather name="menu" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.logo}>
          <Text style={styles.logoAnime}>Anime</Text>
          <Text style={styles.logoFlex}>Flex</Text>
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon} hitSlop={8}>
            <Feather name="search" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} hitSlop={8}>
            <Feather name="user" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Hero Banner ── */}
      {!trendingQuery.isLoading && bannerAnimes.length > 0 ? (
        <FeaturedBanner
          animes={bannerAnimes}
          index={bannerIndex}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      ) : (
        <View style={[styles.banner, { backgroundColor: Colors.bgSurface, opacity: 0.4 }]} />
      )}

      {/* ── Tendencias principales ── */}
      <View style={styles.section}>
        <SectionHeader icon="award" title="Tendencias principales" showButton />
        {trendingQuery.isLoading ? (
          <View style={styles.trendSkeleton}>
            {Array(5).fill(null).map((_, i) => (
              <View key={i} style={styles.trendSkeletonRow} />
            ))}
          </View>
        ) : (
          trendingList.map((anime, i) => (
            <TrendingRow key={anime.id} anime={anime} rank={i + 1} />
          ))
        )}
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Últimas actualizaciones ── */}
      <View style={styles.section}>
        <SectionHeader icon="clock" title="Últimas actualizaciones" iconColor="#22C55E" />
        {recentQuery.isLoading ? (
          <View style={{ flexDirection: "row", gap: 10, paddingLeft: 16 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.recentCard, { backgroundColor: Colors.bgSurface, opacity: 0.4 }]} />
            ))}
          </View>
        ) : (
          <FlatList
            data={recentList}
            keyExtractor={(item, i) => item.id + i}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            renderItem={({ item }) => <RecentCard anime={item} />}
          />
        )}
      </View>

      {/* ── Divider ── */}
      <View style={styles.divider} />

      {/* ── Más populares ── */}
      <View style={styles.section}>
        <SectionHeader icon="trending-up" title="Más populares" iconColor={Colors.primary} />
        {popularQuery.isLoading ? (
          <View style={{ flexDirection: "row", gap: 10, paddingLeft: 16 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.popularCard, { backgroundColor: Colors.bgSurface, opacity: 0.4 }]} />
            ))}
          </View>
        ) : (
          <FlatList
            data={popularList}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContent}
            renderItem={({ item }) => <PopularCard anime={item} />}
          />
        )}
      </View>
    </ScrollView>
  );
}

/* ─── STYLES ─────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  /* Header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 8,
  },
  menuBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5, flex: 1 },
  logoAnime: { color: Colors.primary },
  logoFlex: { color: Colors.textPrimary },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Banner */
  banner: {
    width: "100%",
    height: BANNER_HEIGHT,
    position: "relative",
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerGradient: { ...StyleSheet.absoluteFillObject },
  bannerTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  ccBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ccBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  epGreenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#22C55E",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  epGreenText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  tvBadge: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  tvBadgeText: { color: Colors.textSecondary, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  bannerGenres: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontWeight: "500",
    flex: 1,
  },
  bannerContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    gap: 12,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  bannerButtons: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  playBtn: {
    width: (width - 56) * 0.44,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  bookmarkBtn: {
    width: (width - 56) * 0.44,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
  },
  paginationArrow: {
    padding: 4,
  },
  paginationText: {
    fontSize: 14,
    fontWeight: "700",
  },
  paginationCurrent: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  paginationSep: {
    color: Colors.textMuted,
  },
  paginationTotal: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  /* Section */
  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 14,
  },
  sectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  ahoraBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  ahoraBtnText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },

  /* Trending rows */
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 72,
  },
  rankWrap: {
    width: 42,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  clawMark: {
    position: "absolute",
    width: 44,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  clawLine: {
    position: "absolute",
    width: 3,
    height: 36,
    backgroundColor: "#22C55E",
    borderRadius: 2,
    opacity: 0.75,
  },
  rankCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rankCircleTop: {
    backgroundColor: Colors.bgElevated,
    borderColor: "#22C55E44",
  },
  rankNumber: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "800",
  },
  rankNumberTop: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  trendInfo: { flex: 1, gap: 6 },
  trendTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  trendMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendCCBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trendCCText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  trendGreenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#22C55E",
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trendGreenText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  trendType: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  trendThumb: {
    width: 80,
    height: 56,
    borderRadius: 8,
    backgroundColor: Colors.bgSurface,
  },
  trendSkeleton: { paddingHorizontal: 16, gap: 2 },
  trendSkeletonRow: {
    height: 70,
    backgroundColor: Colors.bgSurface,
    borderRadius: 8,
    opacity: 0.4,
    marginBottom: 2,
  },

  /* Recent carousel */
  carouselContent: { paddingHorizontal: 16, gap: 10 },
  recentCard: {
    width: CAROUSEL_CARD_W,
    height: CAROUSEL_CARD_W * 1.5,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  recentImage: { width: "100%", height: "100%" },
  recentPlayCircle: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentCCBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#EF4444",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recentCCText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  recentFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    gap: 3,
  },
  recentTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  recentType: { color: Colors.textMuted, fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },

  /* Popular carousel */
  popularCard: {
    width: CAROUSEL_CARD_W,
    height: CAROUSEL_CARD_W * 1.5,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  popularImage: { width: "100%", height: "100%" },
  popularCCBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#EF4444",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularCCText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  popularRating: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  popularRatingText: { color: Colors.accent, fontSize: 10, fontWeight: "800" },
  popularFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    gap: 3,
  },
  popularTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  popularType: { color: Colors.textMuted, fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },

  /* Divider */
  divider: {
    height: 6,
    backgroundColor: Colors.bgSurface,
    marginVertical: 8,
  },
});
