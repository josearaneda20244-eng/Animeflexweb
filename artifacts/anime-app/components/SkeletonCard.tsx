import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

interface Props {
  cardWidth?: number;
  horizontal?: boolean;
}

export function SkeletonCard({ cardWidth, horizontal }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const cw = cardWidth ?? CARD_WIDTH;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.55] });

  if (horizontal) {
    return (
      <Animated.View style={[styles.hCard, { opacity, width: cw, height: cw * 0.62 }]}>
        <View style={[styles.hImage, { width: "100%", height: "100%" }]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, { opacity, width: cw }]}>
      <View style={[styles.image, { height: cw * 1.5 }]} />
      <View style={styles.info}>
        <View style={styles.line} />
        <View style={styles.lineShort} />
      </View>
    </Animated.View>
  );
}

export function SkeletonRow({ count = 4, cardWidth }: { count?: number; cardWidth?: number }) {
  const cw = cardWidth ?? width * 0.36;
  return (
    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} cardWidth={cw} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    width: "100%",
    backgroundColor: Colors.bgSurface,
  },
  info: { padding: 10, gap: 8 },
  line: {
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.bgSurface,
    width: "90%",
  },
  lineShort: {
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.bgSurface,
    width: "50%",
  },
  hCard: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hImage: { backgroundColor: Colors.bgSurface },
});
