import React from "react";
import { StyleSheet, Text, View } from "react-native";

import Colors from "@/constants/colors";

interface Props {
  genre: string;
}

export function GenreBadge({ genre }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{genre}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: Colors.primary + "22",
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  text: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "500",
  },
});
