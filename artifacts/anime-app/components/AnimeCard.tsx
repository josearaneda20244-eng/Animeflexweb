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
        pressed && { transform: [{ scale: 0.96 }], opacity: 0.88 },
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
          colors={["transparent", "rgba(8,10,18,0.5)", "rgba(8,10,18,0.98)"]}
          locations={[0.38, 0.68, 1]}
          style={styles.gradient}
        />

        {/* HD Badge top-left */}
        <View style={styles.hdBadge}>
          <Text style={styles.hdText}>HD</Text>
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
            color={fav ? Colors.primary : "rgba(255,255,255,0.7)"}
          />
        </Pressable>

        {/* Episode count */}
        {anime.totalEpisodes ? (
          <View style={styles.epBadge}>
            <Feather name="play-circle" size={9} color={Colors.primary} />
            <Text style={styles.epText}>{anime.totalEpisodes} eps</Text>
          </View>
        ) : null}

        {/* Ongoing dot */}
        {anime.status === "Ongoing" && (
          <View style={styles.ongoingBadge}>
            <View style={styles.ongoingDot} />
            <Text style={styles.ongoingText}>Nuevo</Text>
          </View>
        )}

        {/* Type pill bottom */}
        <View style={styles.imageBottom}>
          {anime.type && (
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{anime.type}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.metaRow}>
          {anime.rating != null && anime.rating > 0 && (
            <View style={styles.ratingRow}>
              <Feather name="star" size={9} color={Colors.accent} />
              <Text style={styles.ratingText}>{(anime.rating / 10).toFixed(1)}</Text>
            </View>
          )}
          {anime.releaseDate ? (
            <Text style={styles.year}>{anime.releaseDate}</Text>
          ) : null}
        </View>
        {anime.genres && anime.genres.length > 0 && (
          <Text style={styles.genres} numberOfLines={1}>
            {anime.genres.slice(0, 3).join(" · ")}
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
    height: CARD_WIDTH * 1.45,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  hdBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hdText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(8,10,18,0.7)",
    borderRadius: 20,
    padding: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  favBtnActive: {
    backgroundColor: Colors.primary + "33",
    borderColor: Colors.primary + "88",
  },
  epBadge: {
    position: "absolute",
    bottom: 36,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(8,10,18,0.75)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  epText: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  ongoingBadge: {
    position: "absolute",
    bottom: 36,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success + "22",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.success + "55",
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
  imageBottom: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
  },
  typePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(8,10,18,0.8)",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  typePillText: {
    color: Colors.textSecondary,
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
    fontWeight: "700",
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  year: {
    color: Colors.textMuted,
    fontSize: 11,
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
