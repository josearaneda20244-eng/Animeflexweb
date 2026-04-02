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
        pressed && { transform: [{ scale: 0.97 }], opacity: 0.92 },
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
          colors={["transparent", "rgba(13,13,13,0.92)"]}
          style={styles.gradient}
        />

        {/* Fav button */}
        <Pressable
          style={[styles.favBtn, fav && styles.favBtnActive]}
          onPress={handleFav}
          hitSlop={8}
        >
          <Feather
            name="heart"
            size={13}
            color={fav ? Colors.accent : "rgba(255,255,255,0.8)"}
          />
        </Pressable>

        {/* Top badges row */}
        <View style={styles.topBadges}>
          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.ratingBadge}>
              <Feather name="star" size={9} color={Colors.warning} />
              <Text style={styles.ratingText}>
                {(anime.rating / 10).toFixed(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom info inside image */}
        <View style={styles.imageBottom}>
          {anime.type && (
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{anime.type}</Text>
            </View>
          )}
          {anime.totalEpisodes ? (
            <View style={styles.epsPill}>
              <Text style={styles.epsPillText}>{anime.totalEpisodes} ep</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {anime.status && (
          <Text style={styles.status}>{anime.status}</Text>
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
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: CARD_WIDTH * 1.45,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    padding: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  favBtnActive: {
    backgroundColor: "rgba(241,91,181,0.35)",
    borderColor: Colors.accent,
  },
  topBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,214,10,0.3)",
  },
  ratingText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: "700",
  },
  imageBottom: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
  },
  typePill: {
    backgroundColor: Colors.primary + "CC",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typePillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  epsPill: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  epsPillText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    fontWeight: "600",
  },
  info: {
    padding: 10,
    paddingTop: 8,
    gap: 3,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  status: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  compact: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  compactType: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "500",
  },
});
