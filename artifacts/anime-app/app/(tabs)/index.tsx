import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimeCard from "@/components/AnimeCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import Colors from "@/constants/colors";
import { consumet } from "@/lib/consumet";

const { width } = Dimensions.get("window");

const SECTIONS = [
  { key: "trending", label: "Trending" },
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
] as const;

type Section = (typeof SECTIONS)[number]["key"];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>("trending");
  const [refreshing, setRefreshing] = useState(false);

  const trendingQuery = useQuery({
    queryKey: ["trending"],
    queryFn: () => consumet.trending(),
  });

  const popularQuery = useQuery({
    queryKey: ["popular"],
    queryFn: () => consumet.popular(),
  });

  const recentQuery = useQuery({
    queryKey: ["recent"],
    queryFn: () => consumet.recentEpisodes(),
  });

  const activeQuery =
    section === "trending"
      ? trendingQuery
      : section === "popular"
        ? popularQuery
        : recentQuery;

  const data = activeQuery.data?.results ?? [];
  const isLoading = activeQuery.isLoading;
  const isError = activeQuery.isError;

  const handleRefresh = async () => {
    setRefreshing(true);
    await activeQuery.refetch();
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={styles.logoAccent}>Ani</Text>
          <Text style={styles.logoMain}>Flow</Text>
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabs}
        contentContainerStyle={styles.tabsContent}
      >
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, section === s.key && styles.tabActive]}
            onPress={() => setSection(s.key)}
          >
            <Text
              style={[styles.tabText, section === s.key && styles.tabTextActive]}
            >
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load anime.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => activeQuery.refetch()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={isLoading ? Array(8).fill(null) : data}
          numColumns={2}
          keyExtractor={(item, i) => item?.id ?? `skeleton-${i}`}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: 90 + (Platform.OS === "web" ? 34 : insets.bottom) },
          ]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) =>
            item === null ? (
              <SkeletonCard />
            ) : (
              <AnimeCard anime={item} />
            )
          }
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
    paddingBottom: 8,
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: Colors.primary,
  },
  logoMain: {
    color: Colors.textPrimary,
  },
  tabs: {
    marginBottom: 8,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#fff",
  },
  list: {
    padding: 16,
    gap: 16,
  },
  row: {
    justifyContent: "space-between",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
  },
});
