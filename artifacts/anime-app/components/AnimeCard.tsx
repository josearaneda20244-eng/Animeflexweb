import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

function AnimeCard({ anime, compact }: Props) {
  const router = useRouter();
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(anime.id);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const resolvedTitle =
      typeof anime.title === "string"
        ? anime.title
        : (anime.title as any)?.english ||
          (anime.title as any)?.romaji ||
          (anime.title as any)?.userPreferred ||
          "Unknown";
    router.push({
      pathname: "/detail/[id]",
      params: {
        id: anime.id,
        title: resolvedTitle,
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

  const title =
    typeof anime.title === "string"
      ? anime.title
      : (anime.title as any)?.english ||
        (anime.title as any)?.romaji ||
        (anime.title as any)?.userPreferred ||
        "Unknown";

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
            <Text style={styles.badge}>{anime.type}</Text>
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
      onPress={handlePress}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: anime.image }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.overlay} />
        <Pressable
          style={[styles.favBtn, fav && styles.favBtnActive]}
          onPress={handleFav}
          hitSlop={8}
        >
          <Feather
            name={fav ? "heart" : "heart"}
            size={14}
            color={fav ? Colors.accent : "#fff"}
          />
        </Pressable>
        {anime.totalEpisodes && (
          <View style={styles.epsBadge}>
            <Text style={styles.epsBadgeText}>{anime.totalEpisodes} ep</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {anime.type && (
          <View style={styles.row}>
            <Text style={styles.type}>{anime.type}</Text>
          </View>
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
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: CARD_WIDTH * 1.4,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 6,
  },
  favBtnActive: {
    backgroundColor: "rgba(241,91,181,0.3)",
  },
  epsBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(155,93,229,0.85)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  epsBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  info: {
    padding: 10,
    gap: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  type: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "500",
  },
  badge: {
    color: Colors.textSecondary,
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
});
