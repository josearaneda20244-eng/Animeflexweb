import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

import Colors from "@/constants/colors";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

export function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={styles.image} />
      <View style={styles.info}>
        <View style={styles.line} />
        <View style={styles.lineShort} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  image: {
    width: "100%",
    height: CARD_WIDTH * 1.4,
    backgroundColor: Colors.bgSurface,
  },
  info: {
    padding: 10,
    gap: 8,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.bgSurface,
    width: "90%",
  },
  lineShort: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.bgSurface,
    width: "50%",
  },
});
