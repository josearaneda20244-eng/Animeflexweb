import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.8 }]}
      onPress={handlePress}
    >
      <View style={[styles.numBadge, watched && styles.numBadgeWatched]}>
        <Text style={[styles.num, watched && styles.numWatched]}>
          {episode.number}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {episode.title || `Episode ${episode.number}`}
        </Text>
        {episode.isFiller && (
          <View style={styles.fillerBadge}>
            <Text style={styles.fillerText}>Filler</Text>
          </View>
        )}
      </View>
      <Feather name="play-circle" size={20} color={Colors.primary} />
    </Pressable>
  );
}

export default memo(EpisodeItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  numBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  numBadgeWatched: {
    backgroundColor: Colors.primary + "33",
    borderColor: Colors.primary,
  },
  num: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  numWatched: {
    color: Colors.primary,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
  },
  fillerBadge: {
    alignSelf: "flex-start",
    backgroundColor: Colors.warning + "22",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  fillerText: {
    color: Colors.warning,
    fontSize: 10,
    fontWeight: "600",
  },
});
