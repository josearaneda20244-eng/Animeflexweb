import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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

import { SkeletonRow } from "@/components/SkeletonCard";
import Colors from "@/constants/colors";
import { consumet, type AnimeResult } from "@/lib/consumet";

const { width } = Dimensions.get("window");
const HERO_HEIGHT = Math.round(width * 1.05);
const CARD_W = width * 0.34;
const CARD_H = CARD_W * 1.52;
const RECENT_W = width * 0.55;
const RECENT_H = RECENT_W * 0.62;

function resolveTitle(t: AnimeResult["title"]): string {
  if (!t) return "Unknown";
  if (typeof t === "string") return t;
  return (t as any).english || (t as any).romaji || (t as any).userPreferred || "Unknown";
}

function nav(router: any, anime: AnimeResult) {
  router.push({
    pathname: "/detail/[id]",
    params: {
      id: anime.id,
      title: resolveTitle(anime.title),
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

/* ── NAVBAR ── */
function NavBar({ topPad }: { topPad: number }) {
  const router = useRouter();
  return (
    <View style={[styles.navWrap, { paddingTop: topPad + 10 }]}>
      <LinearGradient
        colors={["rgba(9,10,18,0.98)", "rgba(9,10,18,0.0)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.navInner}>
        <View style={styles.logoRow}>
          <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.logoBox}>
            <Text style={styles.logoIcon}>▶</Text>
          </LinearGradient>
          <Text style={styles.logoText}>
            <Text style={styles.logoA}>Anime</Text>
            <Text style={styles.logoFlex}>FLEX</Text>
          </Text>
        </View>

        <View style={styles.navActions}>
          <TouchableOpacity
            style={styles.navBtn}
            hitSlop={10}
            onPress={() => router.push("/(tabs)/search")}
          >
            <Feather name="search" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            hitSlop={10}
            onPress={() => router.push("/(tabs)/favorites")}
          >
            <Feather name="bookmark" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            hitSlop={10}
            onPress={() => router.push("/(tabs)/history")}
          >
            <Feather name="clock" size={19} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ── HERO BANNER ── */
function HeroBanner({
  animes, idx, onPrev, onNext, topPad,
}: {
  animes: AnimeResult[]; idx: number; onPrev: () => void; onNext: () => void; topPad: number;
}) {
  const router = useRouter();
  const anime = animes[idx];
  if (!anime) return <View style={{ height: HERO_HEIGHT, backgroundColor: Colors.bgSurface }} />;
  const title = resolveTitle(anime.title);

  return (
    <View style={[styles.hero, { height: HERO_HEIGHT }]}>
      <Image
        source={{ uri: anime.cover || anime.image }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(9,10,18,0.0)", "rgba(9,10,18,0.35)", "rgba(9,10,18,0.88)", "#090A12"]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(9,10,18,0.55)", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { width: "50%" }]}
      />

      <View style={[styles.heroContent, { paddingTop: topPad + 80 }]}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadgeHD}>
            <Text style={styles.heroBadgeHDText}>HD</Text>
          </View>
          {anime.type && (
            <View style={styles.heroBadgeType}>
              <Text style={styles.heroBadgeTypeText}>{anime.type}</Text>
            </View>
          )}
          {anime.status === "Ongoing" && (
            <View style={styles.heroBadgeLive}>
              <View style={styles.heroBadgeLiveDot} />
              <Text style={styles.heroBadgeLiveText}>EN EMISIÓN</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroTitle} numberOfLines={2}>{title}</Text>

        <View style={styles.heroMetaRow}>
          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.heroRating}>
              <Feather name="star" size={12} color={Colors.gold} />
              <Text style={styles.heroRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
            </View>
          )}
          {anime.releaseDate ? <Text style={styles.heroMetaText}>{anime.releaseDate}</Text> : null}
          {anime.totalEpisodes ? (
            <Text style={styles.heroMetaText}>{anime.totalEpisodes} EP</Text>
          ) : null}
        </View>

        {anime.genres && anime.genres.length > 0 && (
          <View style={styles.heroGenreRow}>
            {anime.genres.slice(0, 3).map((g) => (
              <View key={g} style={styles.heroGenre}>
                <Text style={styles.heroGenreText}>{g}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.heroBtns}>
          <Pressable
            style={({ pressed }) => [styles.heroPlayBtn, pressed && { opacity: 0.85 }]}
            onPress={() => nav(router, anime)}
          >
            <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.heroPlayGrad}>
              <Feather name="play" size={16} color="#fff" />
              <Text style={styles.heroPlayText}>Ver Ahora</Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.heroInfoBtn, pressed && { opacity: 0.8 }]}
            onPress={() => nav(router, anime)}
          >
            <Feather name="info" size={16} color={Colors.textSecondary} />
            <Text style={styles.heroInfoText}>Detalles</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.dotRow}>
        {animes.slice(0, 6).map((_, i) => (
          <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
        ))}
      </View>

      <TouchableOpacity style={[styles.heroArrow, { left: 12 }]} onPress={onPrev}>
        <Feather name="chevron-left" size={22} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.heroArrow, { right: 12 }]} onPress={onNext}>
        <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>
    </View>
  );
}

/* ── SECTION HEADER ── */
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.secHeader}>
      <View style={styles.secTitleRow}>
        <View style={styles.secAccent} />
        <Text style={styles.secTitle}>{title}</Text>
      </View>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>Ver todo</Text>
          <Feather name="chevron-right" size={14} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

/* ── PORTRAIT CARD (trending/popular) ── */
function PortraitCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pCard,
        { width: CARD_W, height: CARD_H },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
      ]}
      onPress={() => nav(router, anime)}
    >
      <Image source={{ uri: anime.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(9,10,18,0.96)"]}
        locations={[0.48, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.pBadgeRow}>
        <View style={styles.pSubBadge}>
          <Text style={styles.pSubText}>SUB</Text>
        </View>
        {anime.totalEpisodes ? (
          <View style={styles.pEpBadge}>
            <Text style={styles.pEpText}>{anime.totalEpisodes}</Text>
          </View>
        ) : null}
      </View>
      {anime.rating != null && anime.rating > 0 && (
        <View style={styles.pRating}>
          <Feather name="star" size={8} color={Colors.gold} />
          <Text style={styles.pRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
        </View>
      )}
      <View style={styles.pFooter}>
        <Text style={styles.pTitle} numberOfLines={2}>{title}</Text>
        {anime.type && <Text style={styles.pType}>{anime.type}</Text>}
      </View>
    </Pressable>
  );
}

/* ── RECENT EPISODE CARD ── */
function RecentCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.rCard,
        { width: RECENT_W, height: RECENT_H },
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
      ]}
      onPress={() => nav(router, anime)}
    >
      <Image
        source={{ uri: anime.cover || anime.image }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <LinearGradient
        colors={["rgba(9,10,18,0.1)", "rgba(9,10,18,0.92)"]}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.rPlayCircle}>
        <Feather name="play" size={18} color="#fff" />
      </View>
      <View style={styles.rBadgeRow}>
        <View style={styles.rEpBadge}>
          <Feather name="tv" size={9} color={Colors.cyan} />
          <Text style={styles.rEpText}>EP {anime.currentEpisode ?? "?"}</Text>
        </View>
        <View style={styles.rHDBadge}>
          <Text style={styles.rHDText}>HD</Text>
        </View>
      </View>
      <View style={styles.rFooter}>
        <Text style={styles.rTitle} numberOfLines={1}>{title}</Text>
        {anime.type && <Text style={styles.rType}>{anime.type}</Text>}
      </View>
    </Pressable>
  );
}

/* ── TOP ANIME ROW ── */
function TopAnimeRow({ anime, rank }: { anime: AnimeResult; rank: number }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);
  return (
    <Pressable
      style={({ pressed }) => [styles.topRow, pressed && { backgroundColor: Colors.bgSurface }]}
      onPress={() => nav(router, anime)}
    >
      <Text style={[styles.topRank, rank <= 3 && styles.topRankHighlight]}>
        {String(rank).padStart(2, "0")}
      </Text>
      <Image source={{ uri: anime.image }} style={styles.topImg} resizeMode="cover" />
      <View style={styles.topInfo}>
        <Text style={styles.topTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.topMeta}>
          {anime.type && <Text style={styles.topType}>{anime.type}</Text>}
          {anime.releaseDate ? <Text style={styles.topYear}>{anime.releaseDate}</Text> : null}
        </View>
        {anime.genres && anime.genres.length > 0 && (
          <Text style={styles.topGenres} numberOfLines={1}>
            {anime.genres.slice(0, 2).join(" · ")}
          </Text>
        )}
      </View>
      {anime.rating != null && anime.rating > 0 && (
        <View style={styles.topRatingWrap}>
          <Feather name="star" size={11} color={Colors.gold} />
          <Text style={styles.topRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
        </View>
      )}
    </Pressable>
  );
}

/* ── GENRE PILLS ── */
const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy",
  "Horror", "Romance", "Sci-Fi", "Shounen", "Isekai", "Thriller", "Mystery",
];

function GenresSection() {
  const router = useRouter();
  return (
    <View style={styles.genresWrap}>
      {GENRES.map((g) => (
        <Pressable
          key={g}
          style={({ pressed }) => [styles.genrePill, pressed && { opacity: 0.75 }]}
          onPress={() => router.push({ pathname: "/(tabs)/search", params: { q: g } })}
        >
          <Text style={styles.genrePillText}>{g}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ── MAIN SCREEN ── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [heroIdx, setHeroIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const trending = useQuery({ queryKey: ["trending"], queryFn: consumet.trending, staleTime: 1000 * 60 * 10 });
  const popular = useQuery({ queryKey: ["popular"], queryFn: consumet.popular, staleTime: 1000 * 60 * 10 });
  const recent = useQuery({ queryKey: ["recent"], queryFn: consumet.recentEpisodes, staleTime: 1000 * 60 * 5 });

  const trendList = trending.data?.results ?? [];
  const popularList = popular.data?.results ?? [];
  const recentList = recent.data?.results ?? [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([trending.refetch(), popular.refetch(), recent.refetch()]);
    setRefreshing(false);
  }, [trending, popular, recent]);

  const prevHero = useCallback(() => {
    setHeroIdx((i) => (i > 0 ? i - 1 : Math.max(0, trendList.length - 1)));
  }, [trendList.length]);

  const nextHero = useCallback(() => {
    setHeroIdx((i) => (i < trendList.length - 1 ? i + 1 : 0));
  }, [trendList.length]);

  return (
    <View style={styles.container}>
      <NavBar topPad={topPad} />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: 110 + (Platform.OS === "web" ? 0 : insets.bottom) }}
      >
        {/* HERO BANNER */}
        {trendList.length > 0 ? (
          <HeroBanner animes={trendList} idx={heroIdx} onPrev={prevHero} onNext={nextHero} topPad={topPad} />
        ) : (
          <View style={{ height: HERO_HEIGHT, backgroundColor: Colors.bgSurface }} />
        )}

        {/* TRENDING */}
        <View style={styles.section}>
          <SectionHeader title="🔥 Tendencias" />
          {trending.isLoading ? (
            <SkeletonRow count={5} cardWidth={CARD_W} />
          ) : (
            <FlatList
              data={trendList.slice(0, 12)}
              keyExtractor={(a) => `t-${a.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => <PortraitCard anime={item} />}
            />
          )}
        </View>

        {/* RECENT EPISODES */}
        <View style={styles.section}>
          <SectionHeader title="⚡ Últimos Episodios" />
          {recent.isLoading ? (
            <SkeletonRow count={3} cardWidth={RECENT_W} />
          ) : (
            <FlatList
              data={recentList.slice(0, 10)}
              keyExtractor={(a) => `r-${a.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => <RecentCard anime={item} />}
            />
          )}
        </View>

        {/* POPULAR */}
        <View style={styles.section}>
          <SectionHeader title="⭐ Más Populares" />
          {popular.isLoading ? (
            <SkeletonRow count={5} cardWidth={CARD_W} />
          ) : (
            <FlatList
              data={popularList.slice(0, 12)}
              keyExtractor={(a) => `p-${a.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => <PortraitCard anime={item} />}
            />
          )}
        </View>

        {/* TOP ANIME */}
        <View style={styles.section}>
          <SectionHeader title="🏆 Top Anime" />
          <View style={styles.topList}>
            {popular.isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <View key={i} style={styles.topRowSkeleton} />
                ))
              : popularList.slice(0, 10).map((a, i) => (
                  <TopAnimeRow key={`top-${a.id}`} anime={a} rank={i + 1} />
                ))}
          </View>
        </View>

        {/* GENRES */}
        <View style={styles.section}>
          <SectionHeader title="🎭 Géneros" />
          <GenresSection />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  navWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  navInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIcon: { color: "#fff", fontSize: 14, fontWeight: "900" },
  logoText: { fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  logoA: { color: Colors.textPrimary },
  logoFlex: { color: Colors.primary },
  navActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
  },

  /* HERO */
  hero: { width, position: "relative", justifyContent: "flex-end", overflow: "hidden" },
  heroContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  heroBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  heroBadgeHD: {
    backgroundColor: Colors.primary,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroBadgeHDText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  heroBadgeType: {
    backgroundColor: "rgba(255,255,255,0.13)",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroBadgeTypeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  heroBadgeLive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success + "22",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.success + "55",
  },
  heroBadgeLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.success },
  heroBadgeLiveText: { color: Colors.success, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroRating: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroRatingText: { color: Colors.gold, fontSize: 13, fontWeight: "800" },
  heroMetaText: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
  heroGenreRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  heroGenre: {
    backgroundColor: "rgba(108,99,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
  },
  heroGenreText: { color: Colors.accent, fontSize: 10, fontWeight: "600" },
  heroBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  heroPlayBtn: { borderRadius: 12, overflow: "hidden" },
  heroPlayGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  heroPlayText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  heroInfoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  heroInfoText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "700" },
  dotRow: {
    position: "absolute",
    bottom: 14,
    right: 20,
    flexDirection: "row",
    gap: 4,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  dotActive: { width: 18, backgroundColor: Colors.primary, borderRadius: 3 },
  heroArrow: {
    position: "absolute",
    top: "55%",
    backgroundColor: "rgba(9,10,18,0.55)",
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },

  /* SECTION */
  section: { marginTop: 28 },
  secHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  secTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  secAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: Colors.primary },
  secTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: "800" },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  seeAllText: { color: Colors.primary, fontSize: 13, fontWeight: "700" },
  carousel: { paddingHorizontal: 16 },

  /* PORTRAIT CARD */
  pCard: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  pBadgeRow: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 4,
  },
  pSubBadge: {
    backgroundColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pSubText: { color: "#fff", fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
  pEpBadge: {
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pEpText: { color: "rgba(255,255,255,0.9)", fontSize: 7, fontWeight: "800" },
  pRating: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pRatingText: { color: Colors.gold, fontSize: 8, fontWeight: "800" },
  pFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    gap: 3,
  },
  pTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  pType: { color: Colors.textSecondary, fontSize: 9, fontWeight: "600" },

  /* RECENT CARD */
  rCard: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  rPlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(108,99,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  rBadgeRow: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 5,
  },
  rEpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.cyan + "40",
  },
  rEpText: { color: Colors.cyan, fontSize: 9, fontWeight: "800" },
  rHDBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rHDText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  rFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  rTitle: { color: "#fff", fontSize: 11, fontWeight: "700" },
  rType: { color: Colors.textMuted, fontSize: 9 },

  /* TOP ANIME */
  topList: { paddingHorizontal: 16, gap: 0 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  topRowSkeleton: {
    height: 70,
    backgroundColor: Colors.bgSurface,
    borderRadius: 10,
    marginBottom: 4,
    opacity: 0.5,
  },
  topRank: {
    color: Colors.textMuted,
    fontSize: 18,
    fontWeight: "900",
    width: 30,
    textAlign: "center",
  },
  topRankHighlight: { color: Colors.primary },
  topImg: { width: 46, height: 64, borderRadius: 8 },
  topInfo: { flex: 1, gap: 4 },
  topTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  topMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  topType: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: Colors.primary + "18",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  topYear: { color: Colors.textMuted, fontSize: 10 },
  topGenres: { color: Colors.textMuted, fontSize: 10 },
  topRatingWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
  topRatingText: { color: Colors.gold, fontSize: 12, fontWeight: "800" },

  /* GENRES */
  genresWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
  },
  genrePill: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  genrePillText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
});
