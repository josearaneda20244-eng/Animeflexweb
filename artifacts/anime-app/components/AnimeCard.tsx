import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { memo } from "react";
import {
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

function AnimeCard({ anime, compact }: Props) {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(anime.id);
  const title = resolveTitle(anime);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        <Image
          source={{ uri: anime.image }}
          style={styles.compactImage}
          resizeMode="cover"
        />
        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle} numberOfLines={2}>
            {title}
          </Text>
          {anime.type && (
            <Text style={styles.compactType}>{anime.type}</Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: anime.image }}
          style={styles.image}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["transparent", "rgba(10,10,18,0.55)", "rgba(10,10,18,0.98)"]}
          locations={[0.4, 0.68, 1]}
          style={styles.gradient}
        />

        {/* Top left badges */}
        <View style={styles.topLeftBadges}>
          <View style={styles.subBadge}>
            <Text style={styles.subText}>SUB</Text>
          </View>
          {anime.totalEpisodes ? (
            <View style={styles.epBadge}>
              <Text style={styles.epText}>{anime.totalEpisodes}</Text>
            </View>
          ) : null}
        </View>

        {/* Fav button top-right */}
        <Pressable
          style={[styles.favBtn, fav && styles.favBtnActive]}
          onPress={handleFav}
          hitSlop={8}
        >
          <Feather
            name="heart"
            size={12}
            color={fav ? Colors.primary : "rgba(255,255,255,0.6)"}
          />
        </Pressable>

        {/* Rating */}
        {anime.rating != null && anime.rating > 0 && (
          <View style={styles.ratingBadge}>
            <Feather name="star" size={8} color="#FBBF24" />
            <Text style={styles.ratingBadgeText}>{(anime.rating / 10).toFixed(1)}</Text>
          </View>
        )}

        {/* Ongoing dot */}
        {anime.status === "Ongoing" && (
          <View style={styles.ongoingBadge}>
            <View style={styles.ongoingDot} />
            <Text style={styles.ongoingText}>Nuevo</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.metaRow}>
          {anime.type && (
            <Text style={styles.typeText}>{anime.type}</Text>
          )}
          {anime.releaseDate ? (
            <Text style={styles.year}>{anime.releaseDate}</Text>
          ) : null}
        </View>
        {anime.genres && anime.genres.length > 0 && (
          <Text style={styles.genres} numberOfLines={1}>
            {anime.genres.slice(0, 2).join(" · ")}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default memo(AnimeCard);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: CARD_WIDTH * 1.5,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  topLeftBadges: {
    position: "absolute",
    top: 7,
    left: 7,
    flexDirection: "row",
    gap: 3,
  },
  subBadge: {
    backgroundColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  subText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  epBadge: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  epText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 9,
    fontWeight: "800",
  },
  favBtn: {
    position: "absolute",
    top: 7,
    right: 7,
    backgroundColor: "rgba(10,10,18,0.75)",
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  favBtnActive: {
    backgroundColor: Colors.primary + "30",
    borderColor: Colors.primary + "80",
  },
  ratingBadge: {
    position: "absolute",
    bottom: 28,
    right: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingBadgeText: {
    color: "#FBBF24",
    fontSize: 9,
    fontWeight: "800",
  },
  ongoingBadge: {
    position: "absolute",
    bottom: 28,
    left: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success + "20",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.success + "50",
  },
  ongoingDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  ongoingText: {
    color: Colors.success,
    fontSize: 9,
    fontWeight: "800",
  },
  info: {
    padding: 9,
    gap: 4,
  },
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
  typeText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  year: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  genres: {
    color: Colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  compact: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  compactImage: {
    width: 60,
    height: 80,
  },
  compactInfo: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    gap: 4,
  },
  compactTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  compactType: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "600",
  },
});
