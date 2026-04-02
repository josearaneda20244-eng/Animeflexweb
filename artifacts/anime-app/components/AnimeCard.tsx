import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { memo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Colors from "@/constants/colors";
import { useFavorites } from "@/context/FavoritesContext";
import type { AnimeResult } from "@/lib/consumet";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface Props {
  anime: AnimeResult;
  compact?: boolean;
  cardWidth?: number;
}

function resolveTitle(anime: AnimeResult): string {
  if (typeof anime.title === "string") return anime.title;
  return (
    (anime.title as any)?.english ||
    (anime.title as any)?.romaji ||
    (anime.title as any)?.userPreferred ||
    "Unknown"
  );
}

function navParams(anime: AnimeResult, title: string) {
  return {
    pathname: "/detail/[id]" as const,
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
  };
}

function AnimeCard({ anime, compact, cardWidth }: Props) {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(anime.id);
  const title = resolveTitle(anime);
  const cw = cardWidth ?? CARD_WIDTH;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (Platform.OS !== "web") {
      Animated.spring(scaleAnim, {
        toValue: 0.96,
        useNativeDriver: true,
        speed: 20,
        bounciness: 2,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (Platform.OS !== "web") {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 2,
      }).start();
    }
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(navParams(anime, title));
  };

  const handleFav = (e: any) => {
    e.stopPropagation?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleFavorite(anime);
  };

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [styles.compact, pressed && { opacity: 0.85 }]}
        onPress={handlePress}
      >
        <Image source={{ uri: anime.image }} style={styles.compactImage} resizeMode="cover" />
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={2}>{title}</Text>
          <View style={styles.compactMeta}>
            {anime.type && <Text style={styles.compactType}>{anime.type}</Text>}
            {anime.releaseDate ? (
              <Text style={styles.compactYear}>{anime.releaseDate}</Text>
            ) : null}
          </View>
          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.compactRating}>
              <Feather name="star" size={10} color={Colors.gold} />
              <Text style={styles.compactRatingText}>{(anime.rating / 10).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], width: cw }}>
      <Pressable
        style={[styles.card, { width: cw }]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={[styles.imageContainer, { height: cw * 1.5 }]}>
          <Image source={{ uri: anime.image }} style={styles.image} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", "rgba(9,10,18,0.5)", "rgba(9,10,18,0.98)"]}
            locations={[0.45, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.topLeftBadges}>
            <View style={styles.subBadge}>
              <Text style={styles.subText}>SUB</Text>
            </View>
            {anime.totalEpisodes ? (
              <View style={styles.epBadge}>
                <Text style={styles.epText}>{anime.totalEpisodes} EP</Text>
              </View>
            ) : null}
          </View>

          <Pressable
            style={[styles.favBtn, fav && styles.favBtnActive]}
            onPress={handleFav}
            hitSlop={8}
          >
            <Feather name="heart" size={11} color={fav ? Colors.pink : "rgba(255,255,255,0.55)"} />
          </Pressable>

          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.ratingBadge}>
              <Feather name="star" size={8} color={Colors.gold} />
              <Text style={styles.ratingBadgeText}>{(anime.rating / 10).toFixed(1)}</Text>
            </View>
          )}

          {anime.status === "Ongoing" && (
            <View style={styles.ongoingBadge}>
              <View style={styles.ongoingDot} />
              <Text style={styles.ongoingText}>LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <View style={styles.metaRow}>
            {anime.type && <Text style={styles.typeChip}>{anime.type}</Text>}
            {anime.releaseDate ? <Text style={styles.year}>{anime.releaseDate}</Text> : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default memo(AnimeCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  topLeftBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 4,
  },
  subBadge: {
    backgroundColor: Colors.success,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subText: { color: "#fff", fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  epBadge: {
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  epText: { color: "rgba(255,255,255,0.9)", fontSize: 8, fontWeight: "800" },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(9,10,18,0.8)",
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  favBtnActive: {
    backgroundColor: Colors.pink + "25",
    borderColor: Colors.pink + "60",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 6,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingBadgeText: { color: Colors.gold, fontSize: 9, fontWeight: "800" },
  ongoingBadge: {
    position: "absolute",
    bottom: 6,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success + "22",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.success + "55",
  },
  ongoingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  ongoingText: { color: Colors.success, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  info: { padding: 10, gap: 5 },
  title: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeChip: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: Colors.primary + "18",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  year: { color: Colors.textMuted, fontSize: 10 },

  compact: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  compactImage: { width: 65, height: 90 },
  compactInfo: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    gap: 4,
  },
  compactTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  compactMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  compactType: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: Colors.primary + "18",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  compactYear: { color: Colors.textMuted, fontSize: 10 },
  compactRating: { flexDirection: "row", alignItems: "center", gap: 3 },
  compactRatingText: { color: Colors.gold, fontSize: 11, fontWeight: "700" },
});
