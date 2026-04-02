import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
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

const QUICK_SEARCHES = ["Shonen", "Romance", "Isekai", "Acción", "Terror", "Comedia"];

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

  const handleQuick = (tag: string) => {
    setQuery(tag);
    setSubmitted(tag);
  };

  const data = searchQuery.data?.results ?? [];
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleAccent} />
          <View>
            <Text style={styles.heading}>Buscar</Text>
            <Text style={styles.subheading}>Encuentra tu próximo favorito</Text>
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.inputWrap}>
            <Feather name="search" size={17} color={Colors.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Buscar anime..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(""); setSubmitted(""); }} hitSlop={8}>
                <View style={styles.clearBtn}>
                  <Feather name="x" size={12} color={Colors.textSecondary} />
                </View>
              </Pressable>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
            onPress={handleSearch}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              style={styles.searchBtnGrad}
            >
              <Feather name="search" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Quick search tags */}
        {!submitted && (
          <View style={styles.tagsRow}>
            {QUICK_SEARCHES.map((tag) => (
              <Pressable
                key={tag}
                style={({ pressed }) => [styles.tag, pressed && { opacity: 0.7 }]}
                onPress={() => handleQuick(tag)}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Loading */}
      {searchQuery.isLoading && (
        <View style={styles.center}>
          <View style={styles.loadingRing}>
            <ActivityIndicator color={Colors.primary} size="large" />
          </View>
          <Text style={styles.loadingText}>Buscando anime...</Text>
        </View>
      )}

      {/* Error */}
      {searchQuery.isError && (
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Feather name="alert-circle" size={36} color={Colors.error} />
          </View>
          <Text style={styles.errorTitle}>Error de búsqueda</Text>
          <Text style={styles.errorText}>No se pudo conectar. Intenta de nuevo.</Text>
          <Pressable style={styles.retryBtn} onPress={() => searchQuery.refetch()}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              style={styles.retryGrad}
            >
              <Text style={styles.retryText}>Reintentar</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}

      {/* No results */}
      {!searchQuery.isLoading && !searchQuery.isError && submitted && data.length === 0 && (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Feather name="film" size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyText}>No encontramos nada para "{submitted}"</Text>
        </View>
      )}

      {/* Empty state */}
      {!submitted && !searchQuery.isLoading && (
        <View style={styles.center}>
          <View style={styles.emptyIllustration}>
            <LinearGradient
              colors={[Colors.primary + "22", Colors.accent + "11"]}
              style={styles.emptyGlow}
            >
              <Feather name="search" size={48} color={Colors.primary} />
            </LinearGradient>
          </View>
          <Text style={styles.emptyTitle}>¿Qué quieres ver?</Text>
          <Text style={styles.emptyText}>Busca por nombre, género o estudio</Text>
        </View>
      )}

      {/* Results */}
      {data.length > 0 && !searchQuery.isLoading && (
        <>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsCount}>
              {data.length} resultado{data.length !== 1 ? "s" : ""}
            </Text>
            <View style={styles.resultsBadge}>
              <Text style={styles.resultsBadgeText}>"{submitted}"</Text>
            </View>
          </View>
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
        </>
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
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "500",
  },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    overflow: "hidden",
  },
  searchBtnGrad: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsCount: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  resultsBadge: {
    backgroundColor: Colors.primary + "22",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  resultsBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    padding: 16,
    paddingTop: 0,
    gap: 14,
  },
  row: {
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  loadingRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.error + "15",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.error + "33",
  },
  errorTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  retryBtn: {
    borderRadius: 22,
    overflow: "hidden",
    marginTop: 4,
  },
  retryGrad: {
    paddingHorizontal: 28,
    paddingVertical: 11,
  },
  retryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  emptyIllustration: {
    marginBottom: 4,
  },
  emptyGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.primary + "33",
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
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
});
