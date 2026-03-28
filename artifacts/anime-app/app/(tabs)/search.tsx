import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AnimeCard from "@/components/AnimeCard";
import Colors from "@/constants/colors";
import { consumet } from "@/lib/consumet";

const { width } = Dimensions.get("window");

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const searchQuery = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => consumet.search(submitted),
    enabled: submitted.length > 0,
  });

  const handleSearch = () => {
    const q = query.trim();
    if (q) setSubmitted(q);
  };

  const data = searchQuery.data?.results ?? [];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <Text style={styles.heading}>Search</Text>
      <View style={styles.searchRow}>
        <View style={styles.inputWrap}>
          <Feather name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Search anime..."
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(""); setSubmitted(""); }}>
              <Feather name="x" size={16} color={Colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
          onPress={handleSearch}
        >
          <Feather name="search" size={18} color="#fff" />
        </Pressable>
      </View>

      {searchQuery.isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      )}

      {searchQuery.isError && (
        <View style={styles.center}>
          <Feather name="alert-circle" size={40} color={Colors.error} />
          <Text style={styles.errorText}>Failed to search. Try again.</Text>
          <Pressable style={styles.retryBtn} onPress={() => searchQuery.refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!searchQuery.isLoading && !searchQuery.isError && submitted && data.length === 0 && (
        <View style={styles.center}>
          <Feather name="film" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No results for "{submitted}"</Text>
        </View>
      )}

      {!submitted && !searchQuery.isLoading && (
        <View style={styles.center}>
          <Feather name="search" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Search for your favorite anime</Text>
        </View>
      )}

      {data.length > 0 && (
        <FlatList
          data={data}
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
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: 16,
    gap: 16,
  },
  row: {
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 32,
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
