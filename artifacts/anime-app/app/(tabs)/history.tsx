import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useHistory, type HistoryEntry } from "@/context/HistoryContext";

function resolveTitle(entry: HistoryEntry): string {
  if (!entry.title) return "Unknown";
  if (typeof entry.title === "string") return entry.title;
  return (entry.title as any).english || (entry.title as any).romaji || "Unknown";
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(diff / 86400000);
  return `Hace ${days}d`;
}

function groupByDay(entries: HistoryEntry[]) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const today: HistoryEntry[] = [];
  const yesterday: HistoryEntry[] = [];
  const week: HistoryEntry[] = [];
  const older: HistoryEntry[] = [];

  for (const e of entries) {
    if (e.watchedAt >= todayStart.getTime()) today.push(e);
    else if (e.watchedAt >= yesterdayStart.getTime()) yesterday.push(e);
    else if (e.watchedAt >= weekStart.getTime()) week.push(e);
    else older.push(e);
  }

  const sections = [];
  if (today.length) sections.push({ title: "Hoy", data: today });
  if (yesterday.length) sections.push({ title: "Ayer", data: yesterday });
  if (week.length) sections.push({ title: "Esta semana", data: week });
  if (older.length) sections.push({ title: "Más antiguo", data: older });
  return sections;
}

function HistoryItem({ entry, onRemove }: { entry: HistoryEntry; onRemove: () => void }) {
  const router = useRouter();
  const title = resolveTitle(entry);

  const handlePress = () => {
    router.push({
      pathname: "/detail/[id]",
      params: {
        id: entry.id,
        title,
        image: entry.image,
        cover: entry.cover || "",
        rating: String(entry.rating ?? ""),
        type: entry.type ?? "",
        status: entry.status ?? "",
        releaseDate: String(entry.releaseDate ?? ""),
        totalEpisodes: String(entry.totalEpisodes ?? ""),
        description: entry.description ?? "",
        genres: JSON.stringify(entry.genres ?? []),
      },
    });
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: Colors.bgSurface }]}
      onPress={handlePress}
    >
      <Image source={{ uri: entry.image }} style={styles.itemImg} resizeMode="cover" />
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>{title}</Text>
        <View style={styles.itemMeta}>
          {entry.type && <Text style={styles.itemType}>{entry.type}</Text>}
          {entry.episodeNum && (
            <View style={styles.itemEpBadge}>
              <Feather name="play" size={9} color={Colors.cyan} />
              <Text style={styles.itemEpText}>EP {entry.episodeNum}</Text>
            </View>
          )}
        </View>
        <Text style={styles.itemTime}>{timeAgo(entry.watchedAt)}</Text>
      </View>
      <View style={styles.itemActions}>
        <Pressable
          style={styles.removeBtn}
          onPress={onRemove}
          hitSlop={8}
        >
          <Feather name="x" size={14} color={Colors.textMuted} />
        </Pressable>
        <Feather name="chevron-right" size={16} color={Colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { history, removeFromHistory, clearHistory } = useHistory();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const sections = groupByDay(history);

  const handleClearAll = () => {
    Alert.alert(
      "Borrar historial",
      "¿Estás seguro de que quieres borrar todo el historial?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Borrar", style: "destructive", onPress: clearHistory },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleAccent} />
          <View>
            <Text style={styles.heading}>Historial</Text>
            <Text style={styles.subheading}>
              {history.length > 0
                ? `${history.length} anime${history.length !== 1 ? "s" : ""} vistos`
                : "Tu actividad reciente"}
            </Text>
          </View>
        </View>
        {history.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
            <Feather name="trash-2" size={16} color={Colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient
            colors={[Colors.bgSurface, Colors.bgCard]}
            style={styles.emptyGlow}
          >
            <Feather name="clock" size={48} color={Colors.textMuted} />
          </LinearGradient>
          <Text style={styles.emptyTitle}>Sin historial</Text>
          <Text style={styles.emptyText}>
            Los anime que veas aparecerán aquí automáticamente
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id + item.watchedAt}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 100 + (Platform.OS === "web" ? 0 : insets.bottom),
          }}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionLine} />
            </View>
          )}
          renderItem={({ item }) => (
            <HistoryItem
              entry={item}
              onRemove={() => removeFromHistory(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleAccent: { width: 4, height: 28, borderRadius: 2, backgroundColor: Colors.primary },
  heading: { color: Colors.textPrimary, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  subheading: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  clearBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.error + "15",
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemImg: {
    width: 56,
    height: 78,
    borderRadius: 10,
    backgroundColor: Colors.bgSurface,
  },
  itemInfo: { flex: 1, gap: 5 },
  itemTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  itemType: {
    color: Colors.primary,
    fontSize: 9,
    fontWeight: "700",
    backgroundColor: Colors.primary + "18",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: "hidden",
  },
  itemEpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.cyan + "18",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.cyan + "35",
  },
  itemEpText: { color: Colors.cyan, fontSize: 9, fontWeight: "800" },
  itemTime: { color: Colors.textMuted, fontSize: 11 },
  itemActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  removeBtn: {
    padding: 5,
    borderRadius: 8,
    backgroundColor: Colors.bgSurface,
  },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 32 },
  emptyGlow: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 4,
  },
  emptyTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: "800" },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },
});
