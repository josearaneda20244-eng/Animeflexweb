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
        pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
      ]}
      onPress={handlePress}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: anime.image }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Deep gradient for text readability */}
        <LinearGradient
          colors={["transparent", "rgba(8,11,20,0.6)", "rgba(8,11,20,0.97)"]}
          locations={[0.4, 0.72, 1]}
          style={styles.gradient}
        />

        {/* Fav button */}
        <Pressable
          style={[styles.favBtn, fav && styles.favBtnActive]}
          onPress={handleFav}
          hitSlop={8}
        >
          {fav ? (
            <LinearGradient
              colors={[Colors.accent, "#BE185D"]}
              style={styles.favGrad}
            >
              <Feather name="heart" size={12} color="#fff" />
            </LinearGradient>
          ) : (
            <View style={styles.favGrad}>
              <Feather name="heart" size={12} color="rgba(255,255,255,0.75)" />
            </View>
          )}
        </Pressable>

        {/* Rating badge top-left */}
        {anime.rating != null && anime.rating > 0 && (
          <View style={styles.ratingBadge}>
            <Feather name="star" size={9} color={Colors.warning} />
            <Text style={styles.ratingText}>
              {(anime.rating / 10).toFixed(1)}
            </Text>
          </View>
        )}

        {/* Status dot */}
        {anime.status === "Ongoing" && (
          <View style={styles.statusDot} />
        )}

        {/* Bottom info inside image */}
        <View style={styles.imageBottom}>
          <View style={styles.pillsRow}>
            {anime.type && (
              <LinearGradient
                colors={[Colors.primary + "EE", "#5B21B6EE"]}
                style={styles.typePill}
              >
                <Text style={styles.typePillText}>{anime.type}</Text>
              </LinearGradient>
            )}
            {anime.totalEpisodes ? (
              <View style={styles.epsPill}>
                <Text style={styles.epsPillText}>{anime.totalEpisodes} ep</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          {anime.status && (
            <Text style={[
              styles.status,
              anime.status === "Ongoing" && styles.statusOngoing,
            ]}>
              {anime.status === "Ongoing" ? "● En emisión" : anime.status}
            </Text>
          )}
        </View>
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
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
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  favBtnActive: {
    borderColor: Colors.accent + "88",
  },
  favGrad: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  ratingBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(245,197,24,0.35)",
  },
  ratingText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },
  statusDot: {
    position: "absolute",
    top: 11,
    left: 58,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.5)",
  },
  imageBottom: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
  },
  pillsRow: {
    flexDirection: "row",
    gap: 5,
    flexWrap: "wrap",
  },
  typePill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typePillText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  epsPill: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  epsPillText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontWeight: "600",
  },
  info: {
    padding: 10,
    paddingTop: 9,
    gap: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    letterSpacing: -0.1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  status: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "500",
  },
  statusOngoing: {
    color: Colors.success,
    fontWeight: "700",
    fontSize: 10,
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
