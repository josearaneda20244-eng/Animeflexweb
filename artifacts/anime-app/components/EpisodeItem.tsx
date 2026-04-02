import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";
import type { Episode } from "@/lib/consumet";

interface Props {
  episode: Episode;
  onPress: (episode: Episode) => void;
  watched?: boolean;
}

function EpisodeItem({ episode, onPress, watched }: Props) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(episode);
  };

  const displayTitle = episode.title || `Episodio ${episode.number}`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
        watched && styles.containerWatched,
      ]}
      onPress={handlePress}
    >
      {/* Thumbnail or number badge */}
      {episode.image ? (
        <View style={styles.thumbWrapper}>
          <Image
            source={{ uri: episode.image }}
            style={styles.thumb}
            resizeMode="cover"
          />
          <View style={styles.thumbOverlay}>
            <Feather name="play" size={16} color="#fff" />
          </View>
          {watched && (
            <View style={styles.watchedDot}>
              <Feather name="check" size={9} color="#fff" />
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.numBadge, watched && styles.numBadgeWatched]}>
          {watched ? (
            <Feather name="check" size={14} color={Colors.primary} />
          ) : (
            <Text style={[styles.num, watched && styles.numWatched]}>
              {episode.number}
            </Text>
          )}
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, watched && styles.titleWatched]} numberOfLines={1}>
          {displayTitle}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.epNum}>Ep. {episode.number}</Text>
          {episode.isFiller && (
            <View style={styles.fillerBadge}>
              <Text style={styles.fillerText}>Filler</Text>
            </View>
          )}
          {watched && (
            <View style={styles.watchedBadge}>
              <Text style={styles.watchedText}>Visto</Text>
            </View>
          )}
        </View>
      </View>

      {/* Play icon */}
      <View style={[styles.playBtn, watched && styles.playBtnWatched]}>
        <Feather
          name={watched ? "check-circle" : "play-circle"}
          size={22}
          color={watched ? Colors.success : Colors.primary}
        />
      </View>
    </Pressable>
  );
}

export default memo(EpisodeItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  containerWatched: {
    backgroundColor: Colors.bgCard + "CC",
  },
  thumbWrapper: {
    position: "relative",
    width: 80,
    height: 52,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
  },
  thumb: {
    width: "100%",
    height: "100%",
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  watchedDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  numBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  numBadgeWatched: {
    backgroundColor: Colors.primary + "22",
    borderColor: Colors.primary + "66",
  },
  num: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "800",
  },
  numWatched: {
    color: Colors.primary,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
  },
  titleWatched: {
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  epNum: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  fillerBadge: {
    backgroundColor: Colors.warning + "22",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  fillerText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: "700",
  },
  watchedBadge: {
    backgroundColor: Colors.success + "22",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  watchedText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: "700",
  },
  playBtn: {
    padding: 4,
  },
  playBtnWatched: {
    opacity: 0.7,
  },
});
