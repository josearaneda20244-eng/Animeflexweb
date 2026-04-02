import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleAccent} />
          <View>
            <Text style={styles.heading}>Favoritos</Text>
            <Text style={styles.subheading}>
              {favorites.length > 0
                ? `${favorites.length} anime${favorites.length !== 1 ? "s" : ""} guardado${favorites.length !== 1 ? "s" : ""}`
                : "Tu lista personal"}
            </Text>
          </View>
        </View>
        {favorites.length > 0 && (
          <View style={styles.countBadge}>
            <LinearGradient
              colors={[Colors.primary, "#C2410C"]}
              style={styles.countGrad}
            >
              <Text style={styles.countText}>{favorites.length}</Text>
            </LinearGradient>
          </View>
        )}
      </View>

      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <LinearGradient
              colors={[Colors.primary + "22", Colors.primary + "0A"]}
              style={styles.emptyGlow}
            >
              <Feather name="heart" size={48} color={Colors.primary} />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>Aún no tienes favoritos</Text>
          <Text style={styles.emptyText}>
            Toca el corazón en cualquier anime para guardarlo aquí
          </Text>
          <View style={styles.emptyHint}>
            <Feather name="arrow-down" size={14} color={Colors.primary} />
            <Text style={styles.emptyHintText}>Explora la pantalla de inicio</Text>
          </View>
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
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View style={styles.listHeaderLine} />
            </View>
          }
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
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleAccent: {
    width: 4,
    height: 28,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  heading: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subheading: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  countBadge: {
    borderRadius: 14,
    overflow: "hidden",
  },
  countGrad: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  countText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
  },
  listHeader: {
    marginBottom: 14,
  },
  listHeaderLine: {
    height: 1,
    backgroundColor: Colors.border,
    borderRadius: 1,
  },
  list: {
    padding: 16,
    paddingTop: 8,
    gap: 14,
  },
  row: {
    justifyContent: "space-between",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    marginBottom: 4,
  },
  emptyGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.primary + "33",
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
    marginTop: 4,
  },
  emptyHintText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
});
