import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
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

const QUICK_TAGS = ["Shonen", "Isekai", "Romance", "Action", "Fantasy", "Comedia", "Horror", "Mecha"];
const GENRE_FILTERS = ["Todos", "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Romance", "Sci-Fi", "Thriller", "Horror"];
const STATUS_FILTERS = ["Todos", "Ongoing", "Completed", "Not yet aired"];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? "");
  const [submitted, setSubmitted] = useState(params.q ?? "");
  const [genre, setGenre] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (params.q) {
      setQuery(params.q);
      setSubmitted(params.q);
    }
  }, [params.q]);

  const searchQuery = useQuery({
    queryKey: ["search", submitted],
    queryFn: () => consumet.search(submitted),
    enabled: submitted.length > 0,
  });

  const handleChangeText = (t: string) => {
    setQuery(t);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (t.trim().length > 1) setSubmitted(t.trim());
      else if (t.trim().length === 0) setSubmitted("");
    }, 500);
  };

  const handleSearch = () => {
    const q = query.trim();
    if (q) setSubmitted(q);
  };

  const handleQuick = (tag: string) => {
    setQuery(tag);
    setSubmitted(tag);
  };

  const handleClear = () => {
    setQuery("");
    setSubmitted("");
    inputRef.current?.focus();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  let data = searchQuery.data?.results ?? [];
  if (genre !== "Todos") {
    data = data.filter((a) => a.genres?.some((g) => g.toLowerCase() === genre.toLowerCase()));
  }
  if (status !== "Todos") {
    data = data.filter((a) => a.status === status);
  }

  const activeFilters = (genre !== "Todos" ? 1 : 0) + (status !== "Todos" ? 1 : 0);

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
              ref={inputRef}
              style={styles.input}
              placeholder="Buscar anime..."
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={handleChangeText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {query.length > 0 && (
              <Pressable onPress={handleClear} hitSlop={8}>
                <View style={styles.clearBtn}>
                  <Feather name="x" size={12} color={Colors.textSecondary} />
                </View>
              </Pressable>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.filterToggle,
              showFilters && styles.filterToggleActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setShowFilters((v) => !v)}
          >
            <Feather name="sliders" size={18} color={showFilters ? Colors.primary : Colors.textSecondary} />
            {activeFilters > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilters}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
            onPress={handleSearch}
          >
            <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.searchBtnGrad}>
              <Feather name="search" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>

        {/* Quick search tags */}
        {!submitted && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsRow}
          >
            {QUICK_TAGS.map((tag) => (
              <Pressable
                key={tag}
                style={({ pressed }) => [styles.tag, pressed && { opacity: 0.7 }]}
                onPress={() => handleQuick(tag)}
              >
                <Text style={styles.tagText}>{tag}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Filters panel */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Género</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {GENRE_FILTERS.map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.filterChip, genre === g && styles.filterChipActive]}
                    onPress={() => setGenre(g)}
                  >
                    <Text style={[styles.filterChipText, genre === g && styles.filterChipTextActive]}>{g}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Estado</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {STATUS_FILTERS.map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.filterChip, status === s && styles.filterChipActive]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[styles.filterChipText, status === s && styles.filterChipTextActive]}>{s}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            {activeFilters > 0 && (
              <Pressable
                style={styles.clearFiltersBtn}
                onPress={() => { setGenre("Todos"); setStatus("Todos"); }}
              >
                <Feather name="x-circle" size={14} color={Colors.error} />
                <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
              </Pressable>
            )}
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
            <LinearGradient colors={[Colors.primary, Colors.secondary]} style={styles.retryGrad}>
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
          <Text style={styles.emptyText}>
            No encontramos nada para "{submitted}"
            {activeFilters > 0 ? " con esos filtros" : ""}
          </Text>
        </View>
      )}

      {/* Empty state */}
      {!submitted && !searchQuery.isLoading && (
        <View style={styles.center}>
          <LinearGradient
            colors={[Colors.primary + "22", Colors.accent + "11"]}
            style={styles.emptyGlow}
          >
            <Feather name="search" size={48} color={Colors.primary} />
          </LinearGradient>
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
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleAccent: { width: 4, height: 28, borderRadius: 2, backgroundColor: Colors.primary },
  heading: { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  subheading: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },

  searchSection: { paddingHorizontal: 16, marginBottom: 8, gap: 12 },
  searchRow: { flexDirection: "row", gap: 8 },
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
  input: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: "500" },
  clearBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  filterToggle: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  filterToggleActive: {
    backgroundColor: Colors.primary + "18",
    borderColor: Colors.primary + "60",
  },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: "#fff", fontSize: 8, fontWeight: "900" },
  searchBtn: { width: 50, height: 50, borderRadius: 14, overflow: "hidden" },
  searchBtnGrad: { flex: 1, alignItems: "center", justifyContent: "center" },

  tagsRow: { gap: 8, paddingRight: 4 },
  tag: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },

  filtersPanel: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterSection: { gap: 8 },
  filterLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  filterRow: { gap: 7, paddingRight: 4 },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary + "22",
    borderColor: Colors.primary,
  },
  filterChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: Colors.primary, fontWeight: "700" },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  clearFiltersText: { color: Colors.error, fontSize: 12, fontWeight: "700" },

  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsCount: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600" },
  resultsBadge: {
    backgroundColor: Colors.primary + "22",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.primary + "44",
  },
  resultsBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },

  list: { padding: 16, paddingTop: 0, gap: 14 },
  row: { justifyContent: "space-between" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
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
  loadingText: { color: Colors.textMuted, fontSize: 14, fontWeight: "500" },
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
  errorTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: "800" },
  errorText: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: { borderRadius: 22, overflow: "hidden", marginTop: 4 },
  retryGrad: { paddingHorizontal: 28, paddingVertical: 11 },
  retryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
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
  emptyTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },
});
