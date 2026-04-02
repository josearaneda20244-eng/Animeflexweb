import React, { createContext, useCallback, useContext, useState } from "react";

const STORAGE_KEY = "anime_watch_progress";
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
  const [progress, setProgress] = useState<WatchProgressEntry[]>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  const save = useCallback((list: WatchProgressEntry[]) => {
    setProgress(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
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
      progress.filter((p) => p.animeId === animeId).sort((a, b) => b.updatedAt - a.updatedAt)[0],
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
