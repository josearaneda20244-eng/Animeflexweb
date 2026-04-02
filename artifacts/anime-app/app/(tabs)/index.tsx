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

import Colors from "@/constants/colors";
import { consumet, type AnimeResult } from "@/lib/consumet";

const { width } = Dimensions.get("window");
const BANNER_HEIGHT = Math.round(width * 0.95);
const CAROUSEL_CARD_W = width * 0.36;

/* ─── helpers ─────────────────────────────────── */
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

/* ─── TOP NAV BAR ────────────────────────────── */
function NavBar({ topPad }: { topPad: number }) {
  return (
    <View style={[styles.navWrap, { paddingTop: topPad + 10 }]}>
      <View style={styles.navInner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoIconBox}>
            <Text style={styles.logoIconText}>A</Text>
          </View>
          <Text style={styles.logoText}>
            <Text style={styles.logoTextBold}>Anime</Text>
            <Text style={styles.logoTextAccent}>FLEX</Text>
          </Text>
        </View>

        {/* Right icons */}
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navBtn} hitSlop={10}>
            <Feather name="bell" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} hitSlop={10}>
            <Feather name="search" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.userCircle} hitSlop={10}>
            <Feather name="user" size={15} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ─── HERO BANNER ────────────────────────────── */
function HeroBanner({
  animes, index, onPrev, onNext, topPad,
}: {
  animes: AnimeResult[]; index: number; onPrev: () => void; onNext: () => void; topPad: number;
}) {
  const router = useRouter();
  const anime = animes[index];
  if (!anime) return <View style={styles.heroBg} />;

  const title = resolveTitle(anime.title);

  return (
    <Pressable style={styles.heroBg} onPress={() => nav(router, anime)}>
      {/* Full background image */}
      <Image
        source={{ uri: anime.cover || anime.image }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {/* Strong gradient overlay */}
      <LinearGradient
        colors={["rgba(10,10,18,0.05)", "rgba(10,10,18,0.3)", "rgba(10,10,18,0.85)", Colors.bg]}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Left vignette */}
      <LinearGradient
        colors={["rgba(10,10,18,0.6)", "transparent"]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFill, { width: "45%" }]}
      />

      {/* Content at the bottom */}
      <View style={[styles.heroContent, { paddingTop: topPad + 60 }]}>
        {/* Badges row */}
        <View style={styles.heroBadgeRow}>
          {anime.status === "Ongoing" && (
            <View style={styles.newBadge}>
              <View style={styles.newDot} />
              <Text style={styles.newBadgeText}>NUEVO</Text>
            </View>
          )}
          {anime.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{anime.type}</Text>
            </View>
          )}
          {anime.totalEpisodes ? (
            <View style={styles.epHeroBadge}>
              <Feather name="play-circle" size={9} color={Colors.accent} />
              <Text style={styles.epHeroBadgeText}>{anime.totalEpisodes} EP</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <Text style={styles.heroTitle} numberOfLines={3}>{title}</Text>

        {/* Genres */}
        {anime.genres && anime.genres.length > 0 && (
          <Text style={styles.heroGenres} numberOfLines={1}>
            {anime.genres.slice(0, 4).join("  ·  ")}
          </Text>
        )}

        {/* Rating + Year */}
        <View style={styles.heroMeta}>
          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.heroRating}>
              <Feather name="star" size={11} color="#FBBF24" />
              <Text style={styles.heroRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
            </View>
          )}
          {anime.releaseDate ? (
            <Text style={styles.heroYear}>{anime.releaseDate}</Text>
          ) : null}
        </View>

        {/* Buttons */}
        <View style={styles.heroBtns}>
          <TouchableOpacity style={styles.playBtn} onPress={() => nav(router, anime)}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.playBtnGrad}
            >
              <Feather name="play" size={18} color="#fff" />
              <Text style={styles.playBtnText}>Ver ahora</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoBtn} onPress={() => nav(router, anime)}>
            <Feather name="info" size={16} color="rgba(255,255,255,0.7)" />
            <Text style={styles.infoBtnText}>Detalles</Text>
          </TouchableOpacity>
        </View>

        {/* Dot Pagination */}
        <View style={styles.heroDots}>
          {animes.slice(0, 8).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      {/* Prev/Next invisible tap zones */}
      <TouchableOpacity style={styles.heroLeft} onPress={onPrev} />
      <TouchableOpacity style={styles.heroRight} onPress={onNext} />
    </Pressable>
  );
}

/* ─── TRENDING ROW ───────────────────────────── */
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
      onPress={() => nav(router, anime)}
    >
      {/* Rank number */}
      <Text style={[styles.rankNum, isTop3 && styles.rankNumTop]}>{rank < 10 ? `0${rank}` : rank}</Text>

      {/* Thumbnail */}
      <View style={styles.tThumbWrap}>
        <Image source={{ uri: anime.image }} style={styles.tThumb} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(10,10,18,0.6)"]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {/* Info */}
      <View style={styles.trendInfo}>
        <Text style={styles.trendTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.trendMeta}>
          {anime.totalEpisodes ? (
            <View style={styles.subBadge}>
              <Text style={styles.subBadgeText}>SUB</Text>
              <Text style={styles.subEpCount}>{anime.totalEpisodes}</Text>
            </View>
          ) : null}
          {anime.type ? (
            <Text style={styles.tType}>{anime.type}</Text>
          ) : null}
        </View>
        {anime.rating != null && anime.rating > 0 && (
          <View style={styles.tRatingRow}>
            <Feather name="star" size={9} color="#FBBF24" />
            <Text style={styles.tRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
          </View>
        )}
      </View>

      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

/* ─── SECTION HEADER ─────────────────────────── */
function SectionHeader({
  title, showButton = false,
}: {
  title: string; showButton?: boolean;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionLeft}>
        <View style={styles.sectionAccentBar} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {showButton && (
        <TouchableOpacity style={styles.verMasBtn}>
          <Text style={styles.verMasText}>Ver más</Text>
          <Feather name="chevron-right" size={13} color={Colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ─── RECENT CARD ────────────────────────────── */
function RecentCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);
  return (
    <Pressable
      style={({ pressed }) => [styles.rCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
      onPress={() => nav(router, anime)}
    >
      <Image source={{ uri: anime.image }} style={styles.rImg} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(10,10,18,0.98)"]}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Badges */}
      <View style={styles.rBadgeRow}>
        <View style={styles.subSmBadge}>
          <Text style={styles.subSmText}>SUB</Text>
        </View>
        {anime.totalEpisodes ? (
          <View style={styles.epSmBadge}>
            <Text style={styles.epSmText}>{anime.totalEpisodes}</Text>
          </View>
        ) : null}
      </View>

      {/* Rating top right */}
      {anime.rating != null && anime.rating > 0 && (
        <View style={styles.rRating}>
          <Feather name="star" size={8} color="#FBBF24" />
          <Text style={styles.rRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
        </View>
      )}

      <View style={styles.rFooter}>
        <Text style={styles.rTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.rType}>{anime.type ?? "TV"}</Text>
      </View>
    </Pressable>
  );
}

/* ─── POPULAR CARD ───────────────────────────── */
function PopularCard({ anime }: { anime: AnimeResult }) {
  const router = useRouter();
  const title = resolveTitle(anime.title);
  return (
    <Pressable
      style={({ pressed }) => [styles.pCard, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
      onPress={() => nav(router, anime)}
    >
      <Image source={{ uri: anime.image }} style={styles.pImg} resizeMode="cover" />
      <LinearGradient
        colors={["transparent", "rgba(10,10,18,0.98)"]}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Badges */}
      <View style={styles.pBadgeRow}>
        <View style={styles.subSmBadge}>
          <Text style={styles.subSmText}>SUB</Text>
        </View>
        {anime.totalEpisodes ? (
          <View style={styles.epSmBadge}>
            <Text style={styles.epSmText}>{anime.totalEpisodes}</Text>
          </View>
        ) : null}
      </View>

      {anime.rating != null && anime.rating > 0 && (
        <View style={styles.pRating}>
          <Feather name="star" size={8} color="#FBBF24" />
          <Text style={styles.pRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
        </View>
      )}
      <View style={styles.pFooter}>
        <Text style={styles.pTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.pType}>{anime.type ?? "TV"}</Text>
      </View>
    </Pressable>
  );
}

/* ─── MAIN ───────────────────────────────────── */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [bannerIdx, setBannerIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const trendingQ = useQuery({ queryKey: ["trending"], queryFn: () => consumet.trending() });
  const popularQ  = useQuery({ queryKey: ["popular"],  queryFn: () => consumet.popular()  });
  const recentQ   = useQuery({ queryKey: ["recent"],   queryFn: () => consumet.recentEpisodes() });

  const trending = trendingQ.data?.results ?? [];
  const popular  = popularQ.data?.results  ?? [];
  const recent   = recentQ.data?.results   ?? [];

  const banners      = trending.slice(0, 8);
  const trendingList = trending.slice(0, 10);
  const recentList   = recent.slice(0, 12);
  const popularList  = popular.slice(0, 10);

  const prev = () => setBannerIdx(i => (i - 1 + banners.length) % banners.length);
  const next = () => setBannerIdx(i => (i + 1) % banners.length);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([trendingQ.refetch(), popularQ.refetch(), recentQ.refetch()]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
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
        {/* ── Hero (full top, navbar floats on top) ── */}
        {!trendingQ.isLoading && banners.length > 0 ? (
          <HeroBanner animes={banners} index={bannerIdx} onPrev={prev} onNext={next} topPad={topPad} />
        ) : (
          <View style={[styles.heroBg, { backgroundColor: Colors.bgSurface }]}>
            <LinearGradient
              colors={[Colors.bgSurface, Colors.bg]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}

        {/* ── Tendencias ── */}
        <View style={styles.section}>
          <SectionHeader title="Tendencias principales" showButton />
          {trendingQ.isLoading
            ? Array(6).fill(null).map((_, i) => <View key={i} style={styles.skeletonRow} />)
            : trendingList.map((a, i) => <TrendingRow key={a.id} anime={a} rank={i + 1} />)}
        </View>

        <View style={styles.divider} />

        {/* ── Últimas actualizaciones ── */}
        <View style={styles.section}>
          <SectionHeader title="Últimas actualizaciones" showButton />
          {recentQ.isLoading
            ? <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16 }}>
                {[0,1,2].map(i => <View key={i} style={[styles.rCard, { backgroundColor: Colors.bgSurface, opacity: 0.4 }]} />)}
              </View>
            : <FlatList
                data={recentList}
                keyExtractor={(item, i) => item.id + i}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselPad}
                renderItem={({ item }) => <RecentCard anime={item} />}
              />}
        </View>

        <View style={styles.divider} />

        {/* ── Más populares ── */}
        <View style={styles.section}>
          <SectionHeader title="Más populares" showButton />
          {popularQ.isLoading
            ? <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16 }}>
                {[0,1,2].map(i => <View key={i} style={[styles.pCard, { backgroundColor: Colors.bgSurface, opacity: 0.4 }]} />)}
              </View>
            : <FlatList
                data={popularList}
                keyExtractor={item => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carouselPad}
                renderItem={({ item }) => <PopularCard anime={item} />}
              />}
        </View>
      </ScrollView>

      {/* ── Floating NavBar (always on top) ── */}
      <NavBar topPad={topPad} />
    </View>
  );
}

/* ─── STYLES ─────────────────────────────────── */
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },

  /* ── Top NavBar ── */
  navWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 100,
    backgroundColor: "rgba(10,10,18,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  navInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoIconText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  logoText: {
    fontSize: 18,
  },
  logoTextBold: {
    color: Colors.textPrimary,
    fontWeight: "700",
  },
  logoTextAccent: {
    color: Colors.accent,
    fontWeight: "900",
    letterSpacing: 1,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  userCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },

  /* ── Hero banner ── */
  heroBg: {
    width: "100%",
    height: BANNER_HEIGHT,
    backgroundColor: Colors.bgSurface,
    position: "relative",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroContent: {
    padding: 20,
    gap: 10,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  newBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.success + "25",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.success + "60",
  },
  newDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  newBadgeText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  typeBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  typeBadgeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  epHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "20",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.accent + "40",
  },
  epHeroBadgeText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroGenres: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroRatingText: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "800",
  },
  heroYear: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
  },
  heroBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  playBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    overflow: "hidden",
    maxWidth: 180,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  playBtnGrad: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  playBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  infoBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  infoBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "700",
  },
  heroDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.primary,
  },
  heroLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "20%",
  },
  heroRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "20%",
  },

  /* ── Section ── */
  section: { marginBottom: 4 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 14,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionAccentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  verMasBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  verMasText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "700",
  },

  /* ── Trending rows ── */
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 80,
  },
  rankNum: {
    color: Colors.textMuted,
    fontSize: 20,
    fontWeight: "900",
    width: 32,
    textAlign: "center",
    letterSpacing: -1,
  },
  rankNumTop: {
    color: Colors.primary,
    fontSize: 22,
  },
  tThumbWrap: {
    width: 52,
    height: 70,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: Colors.bgSurface,
  },
  tThumb: { width: "100%", height: "100%" },
  trendInfo: { flex: 1, gap: 5 },
  trendTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  trendMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  subBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success + "20",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.success + "50",
  },
  subBadgeText: { color: Colors.success, fontSize: 9, fontWeight: "900" },
  subEpCount: { color: Colors.success, fontSize: 9, fontWeight: "700" },
  tType: { color: Colors.textMuted, fontSize: 10, fontWeight: "600" },
  tRatingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  tRatingText: { color: "#FBBF24", fontSize: 11, fontWeight: "700" },

  /* ── Skeleton ── */
  skeletonRow: {
    height: 80,
    marginHorizontal: 16,
    marginBottom: 1,
    borderRadius: 8,
    backgroundColor: Colors.bgSurface,
    opacity: 0.5,
  },

  /* ── Carousels ── */
  carouselPad: { paddingHorizontal: 16, gap: 10 },

  /* ── Recent Card ── */
  rCard: {
    width: CAROUSEL_CARD_W,
    height: CAROUSEL_CARD_W * 1.55,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  rImg: { width: "100%", height: "100%" },
  rBadgeRow: {
    position: "absolute",
    top: 7,
    left: 7,
    flexDirection: "row",
    gap: 3,
  },
  subSmBadge: {
    backgroundColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  subSmText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  epSmBadge: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  epSmText: { color: "rgba(255,255,255,0.85)", fontSize: 9, fontWeight: "800" },
  rRating: {
    position: "absolute",
    top: 7,
    right: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  rRatingText: { color: "#FBBF24", fontSize: 9, fontWeight: "800" },
  rFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 9, gap: 3 },
  rTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  rType: { color: Colors.textMuted, fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },

  /* ── Popular Card ── */
  pCard: {
    width: CAROUSEL_CARD_W,
    height: CAROUSEL_CARD_W * 1.55,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  pImg: { width: "100%", height: "100%" },
  pBadgeRow: {
    position: "absolute",
    top: 7,
    left: 7,
    flexDirection: "row",
    gap: 3,
  },
  pRating: {
    position: "absolute",
    top: 7,
    right: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pRatingText: { color: "#FBBF24", fontSize: 9, fontWeight: "800" },
  pFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 9, gap: 3 },
  pTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  pType: { color: Colors.textMuted, fontSize: 9, fontWeight: "600", letterSpacing: 0.3 },

  /* ── Divider ── */
  divider: { height: 6, backgroundColor: Colors.bgSurface, marginVertical: 8 },
});
