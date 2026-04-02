import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "@anime_watch_progress";
const MAX_ENTRIES = 30;

export interface WatchProgressEntry {
  episodeId: string;
  episodeNum: number;
  animeId: string;
  animeTitle: string;
  animeImage: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

interface WatchProgressContextType {
  progress: WatchProgressEntry[];
  saveProgress: (entry: Omit<WatchProgressEntry, "updatedAt">) => void;
  getProgress: (episodeId: string) => WatchProgressEntry | undefined;
  getAnimeProgress: (animeId: string) => WatchProgressEntry | undefined;
  removeProgress: (episodeId: string) => void;
  clearAllProgress: () => void;
}

const WatchProgressContext = createContext<WatchProgressContextType | null>(null);

export function WatchProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<WatchProgressEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) setProgress(JSON.parse(data));
    });
  }, []);

  const save = useCallback((list: WatchProgressEntry[]) => {
    setProgress(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const saveProgress = useCallback(
    (entry: Omit<WatchProgressEntry, "updatedAt">) => {
      if (!entry.duration || entry.duration < 30) return;
      const percent = entry.currentTime / entry.duration;
      if (percent < 0.02 || percent > 0.97) return;
      const updated: WatchProgressEntry = { ...entry, updatedAt: Date.now() };
      const filtered = progress.filter((p) => p.episodeId !== entry.episodeId);
      save([updated, ...filtered].slice(0, MAX_ENTRIES));
    },
    [progress, save]
  );

  const getProgress = useCallback(
    (episodeId: string) => progress.find((p) => p.episodeId === episodeId),
    [progress]
  );

  const getAnimeProgress = useCallback(
    (animeId: string) =>
      progress
        .filter((p) => p.animeId === animeId)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0],
    [progress]
  );

  const removeProgress = useCallback(
    (episodeId: string) => save(progress.filter((p) => p.episodeId !== episodeId)),
    [progress, save]
  );

  const clearAllProgress = useCallback(() => save([]), [save]);

  return (
    <WatchProgressContext.Provider
      value={{ progress, saveProgress, getProgress, getAnimeProgress, removeProgress, clearAllProgress }}
    >
      {children}
    </WatchProgressContext.Provider>
  );
}

export function useWatchProgress() {
  const ctx = useContext(WatchProgressContext);
  if (!ctx) throw new Error("useWatchProgress must be used within WatchProgressProvider");
  return ctx;
}
