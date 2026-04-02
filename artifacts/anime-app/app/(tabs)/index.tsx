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
const BANNER_HEIGHT = Math.round(width * 0.88);
const CAROUSEL_CARD_W = width * 0.38;

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

/* ─── FLOATING NAVBAR PILL ───────────────────── */
function NavBar({ topPad }: { topPad: number }) {
  return (
    <View style={[styles.navWrap, { top: topPad + 8 }]}>
      <View style={styles.navPill}>
        {/* Hamburger */}
        <TouchableOpacity style={styles.navBtn} hitSlop={10}>
          <Feather name="menu" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoAnime}>Anime</Text>
          {/* FLEX box with claw marks */}
          <View style={styles.flexBox}>
            {/* Claw diagonal lines */}
            <View style={[styles.clawStroke, { left: 6,  top: -2, transform: [{ rotate: "20deg" }] }]} />
            <View style={[styles.clawStroke, { left: 13, top: -2, transform: [{ rotate: "20deg" }] }]} />
            <View style={[styles.clawStroke, { left: 20, top: -2, transform: [{ rotate: "20deg" }] }]} />
            <Text style={styles.logoFlex}>FLEX</Text>
          </View>
        </View>

        {/* Right icons */}
        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navBtn} hitSlop={10}>
            <Feather name="search" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} hitSlop={10}>
            <View style={styles.userCircle}>
              <Feather name="user" size={16} color="#fff" />
            </View>
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
    <View style={styles.heroBg}>
      {/* Full background image */}
      <Image
        source={{ uri: anime.cover || anime.image }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {/* Gradient overlay */}
      <LinearGradient
        colors={["rgba(8,10,18,0.25)", "rgba(8,10,18,0.55)", Colors.bg]}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content at the bottom */}
      <View style={[styles.heroContent, { paddingTop: topPad + 70 }]}>
        {/* Badges row */}
        <View style={styles.heroBadgeRow}>
          {anime.totalEpisodes ? (
            <View style={styles.ccBadge}>
              <Text style={styles.ccText}>CC {anime.totalEpisodes}</Text>
            </View>
          ) : null}
          {anime.status === "Ongoing" && (
            <View style={styles.greenBadge}>
              <Feather name="bookmark" size={9} color="#fff" />
              <Text style={styles.greenBadgeText}>{anime.totalEpisodes ?? "?"}</Text>
            </View>
          )}
          {anime.type && (
            <View style={styles.tvBadge}>
              <Text style={styles.tvText}>
                {anime.type === "TV" ? "TELEVISOR" : anime.type.toUpperCase()}
              </Text>
            </View>
          )}
          {anime.genres && anime.genres.length > 0 && (
            <Text style={styles.heroGenres} numberOfLines={1}>
              {anime.genres.slice(0, 3).join(", ")}
            </Text>
          )}
        </View>

        {/* Title */}
        <Text style={styles.heroTitle} numberOfLines={3}>{title}</Text>

        {/* Buttons */}
        <View style={styles.heroBtns}>
          <TouchableOpacity style={styles.playBtn} onPress={() => nav(router, anime)}>
            <Feather name="play" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={() => nav(router, anime)}>
            <Feather name="bookmark" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Pagination */}
        <View style={styles.heroPaging}>
          <TouchableOpacity onPress={onPrev} hitSlop={8}>
            <Feather name="chevron-left" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.pagingText}>
            <Text style={styles.pagingCurrent}>{index + 1}</Text>
            <Text style={styles.pagingSep}> / </Text>
            <Text style={styles.pagingTotal}>{animes.length}</Text>
          </Text>
          <TouchableOpacity onPress={onNext} hitSlop={8}>
            <Feather name="chevron-right" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
      {/* Rank number with claw for top 3 */}
      <View style={styles.rankWrap}>
        {isTop3 && (
          <>
            <View style={[styles.claw, { left: 2,  transform: [{ rotate: "-15deg" }] }]} />
            <View style={[styles.claw, { left: 8,  transform: [{ rotate: "0deg"  }] }]} />
            <View style={[styles.claw, { left: 14, transform: [{ rotate: "15deg" }] }]} />
          </>
        )}
        <View style={[styles.rankCircle, isTop3 && styles.rankCircleTop]}>
          <Text style={[styles.rankNum, isTop3 && styles.rankNumTop]}>{rank}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.trendInfo}>
        <Text style={styles.trendTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.trendMeta}>
          {anime.totalEpisodes ? (
            <View style={styles.tCCBadge}>
              <Text style={styles.tCCText}>CC {anime.totalEpisodes}</Text>
            </View>
          ) : null}
          {anime.status === "Ongoing" && (
            <View style={styles.tGreenBadge}>
              <Feather name="bookmark" size={8} color="#fff" />
              <Text style={styles.tGreenText}>{anime.totalEpisodes ?? "?"}</Text>
            </View>
          )}
          <Text style={styles.tType}>
            {anime.type === "TV" ? "TELEVISOR" : (anime.type ?? "TELEVISOR")}
          </Text>
        </View>
      </View>

      {/* Thumbnail */}
      <Image source={{ uri: anime.image }} style={styles.tThumb} resizeMode="cover" />
    </Pressable>
  );
}

/* ─── SECTION HEADER ─────────────────────────── */
function SectionHeader({
  icon, title, iconColor = Colors.primary, showButton = false,
}: {
  icon: string; title: string; iconColor?: string; showButton?: boolean;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionLeft}>
        <View style={[styles.sectionIcon, { backgroundColor: iconColor + "22" }]}>
          <Feather name={icon as any} size={15} color={iconColor} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {showButton && (
        <TouchableOpacity style={styles.ahoraBtn}>
          <Text style={styles.ahoraText}>AHORA</Text>
          <Feather name="chevron-down" size={11} color="#fff" />
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
      style={({ pressed }) => [styles.rCard, pressed && { transform: [{ scale: 0.96 }] }]}
      onPress={() => nav(router, anime)}
    >
      <Image source={{ uri: anime.image }} style={styles.rImg} resizeMode="cover" />
      <LinearGradient colors={["transparent", "rgba(8,10,18,0.97)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.rPlayCircle}>
        <Feather name="play" size={11} color="#fff" />
      </View>
      {anime.totalEpisodes ? (
        <View style={styles.rCCBadge}><Text style={styles.rCCText}>CC {anime.totalEpisodes}</Text></View>
      ) : null}
      <View style={styles.rFooter}>
        <Text style={styles.rTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.rType}>{anime.type === "TV" ? "TELEVISOR" : (anime.type ?? "TV")}</Text>
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
      style={({ pressed }) => [styles.pCard, pressed && { transform: [{ scale: 0.96 }] }]}
      onPress={() => nav(router, anime)}
    >
      <Image source={{ uri: anime.image }} style={styles.pImg} resizeMode="cover" />
      <LinearGradient colors={["transparent", "rgba(8,10,18,0.97)"]} style={StyleSheet.absoluteFill} />
      {anime.totalEpisodes ? (
        <View style={styles.pCCBadge}><Text style={styles.pCCText}>CC {anime.totalEpisodes}</Text></View>
      ) : null}
      {anime.rating != null && anime.rating > 0 && (
        <View style={styles.pRating}>
          <Feather name="star" size={9} color={Colors.accent} />
          <Text style={styles.pRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
        </View>
      )}
      <View style={styles.pFooter}>
        <Text style={styles.pTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.pType}>{anime.type === "TV" ? "TELEVISOR" : (anime.type ?? "TV")}</Text>
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

  const banners      = trending.slice(0, 10);
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
          <View style={[styles.heroBg, { backgroundColor: Colors.bgSurface }]} />
        )}

        {/* ── Tendencias ── */}
        <View style={styles.section}>
          <SectionHeader icon="award" title="Tendencias principales" showButton />
          {trendingQ.isLoading
            ? Array(6).fill(null).map((_, i) => <View key={i} style={styles.skeletonRow} />)
            : trendingList.map((a, i) => <TrendingRow key={a.id} anime={a} rank={i + 1} />)}
        </View>

        <View style={styles.divider} />

        {/* ── Últimas actualizaciones ── */}
        <View style={styles.section}>
          <SectionHeader icon="clock" title="Últimas actualizaciones" iconColor="#22C55E" />
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
          <SectionHeader icon="trending-up" title="Más populares" iconColor={Colors.primary} />
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

  /* ── Floating NavBar pill ── */
  navWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 100,
  },
  navPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10,12,22,0.85)",
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  logoAnime: {
    color: Colors.primary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  flexBox: {
    backgroundColor: "#22C55E",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: "relative",
    overflow: "hidden",
  },
  clawStroke: {
    position: "absolute",
    width: 1.5,
    height: "160%",
    backgroundColor: "rgba(255,255,255,0.35)",
    borderRadius: 1,
  },
  logoFlex: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  navRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  userCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* ── Hero banner ── */
  heroBg: {
    width: "100%",
    height: BANNER_HEIGHT,
    backgroundColor: Colors.bgSurface,
    position: "relative",
    justifyContent: "flex-end",
  },
  heroContent: {
    padding: 16,
    gap: 12,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  ccBadge: {
    backgroundColor: "#EF4444",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ccText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  greenBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#22C55E",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  greenBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  tvBadge: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tvText: { color: Colors.textSecondary, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  heroGenres: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "500", flex: 1 },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  heroBtns: { flexDirection: "row", gap: 14 },
  playBtn: {
    width: (width - 56) * 0.44,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  saveBtn: {
    width: (width - 56) * 0.44,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#22C55E",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  heroPaging: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "flex-start",
  },
  pagingText: { fontSize: 14 },
  pagingCurrent: { color: Colors.textPrimary, fontSize: 17, fontWeight: "900" },
  pagingSep: { color: Colors.textMuted },
  pagingTotal: { color: Colors.textMuted, fontSize: 14 },

  /* ── Section ── */
  section: { marginBottom: 4 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
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
  ahoraText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },

  /* ── Trending rows ── */
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    minHeight: 74,
  },
  rankWrap: {
    width: 44,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  claw: {
    position: "absolute",
    width: 2.5,
    height: 40,
    backgroundColor: "#22C55E",
    borderRadius: 2,
    opacity: 0.8,
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
    borderColor: "#22C55E55",
  },
  rankNum: { color: Colors.textSecondary, fontSize: 14, fontWeight: "800" },
  rankNumTop: { color: "#fff", fontSize: 15, fontWeight: "900" },
  trendInfo: { flex: 1, gap: 5 },
  trendTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  trendMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  tCCBadge: { backgroundColor: "#EF4444", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  tCCText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  tGreenBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#22C55E", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3,
  },
  tGreenText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  tType: { color: Colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  tThumb: { width: 82, height: 58, borderRadius: 8, backgroundColor: Colors.bgSurface },
  skeletonRow: {
    height: 72, marginHorizontal: 16, marginBottom: 2,
    backgroundColor: Colors.bgSurface, borderRadius: 8, opacity: 0.4,
  },

  /* ── Carousels ── */
  carouselPad: { paddingHorizontal: 16, gap: 10 },
  rCard: {
    width: CAROUSEL_CARD_W, height: CAROUSEL_CARD_W * 1.5,
    borderRadius: 10, overflow: "hidden",
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    position: "relative",
  },
  rImg: { width: "100%", height: "100%" },
  rPlayCircle: {
    position: "absolute", top: "40%", alignSelf: "center",
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  rCCBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "#EF4444", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  rCCText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  rFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, gap: 3 },
  rTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  rType: { color: Colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },

  pCard: {
    width: CAROUSEL_CARD_W, height: CAROUSEL_CARD_W * 1.5,
    borderRadius: 10, overflow: "hidden",
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    position: "relative",
  },
  pImg: { width: "100%", height: "100%" },
  pCCBadge: {
    position: "absolute", top: 8, left: 8,
    backgroundColor: "#EF4444", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  pCCText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  pRating: {
    position: "absolute", top: 8, right: 8,
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
  },
  pRatingText: { color: Colors.accent, fontSize: 10, fontWeight: "800" },
  pFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 8, gap: 3 },
  pTitle: { color: "#fff", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  pType: { color: Colors.textMuted, fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },

  /* ── Divider ── */
  divider: { height: 6, backgroundColor: Colors.bgSurface, marginVertical: 8 },
});
