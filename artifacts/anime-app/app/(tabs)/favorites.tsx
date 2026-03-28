import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimeCard from "@/components/AnimeCard";
import Colors from "@/constants/colors";
import { useFavorites } from "@/context/FavoritesContext";

const { width } = Dimensions.get("window");

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { favorites } = useFavorites();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <Text style={styles.heading}>Favorites</Text>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="heart" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptyText}>
            Tap the heart on any anime to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 90 + (Platform.OS === "web" ? 34 : insets.bottom) },
          ]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <AnimeCard anime={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  heading: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  list: {
    padding: 16,
    gap: 16,
  },
  row: {
    justifyContent: "space-between",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 20,
    fontWeight: "700",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
