import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";

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
  const { user } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);

  const save = useCallback((list: WatchProgressEntry[]) => {
    setProgress(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  useEffect(() => {
    if (!user) { prevUserIdRef.current = null; return; }
    if (prevUserIdRef.current === user.id) return;
    prevUserIdRef.current = user.id;
    apiClient.get<Array<{ episode_id: string; anime_id: string; anime_title: string; anime_image: string; episode_num: number; watch_time: number; duration: number; updated_at: string }>>("/user/progress")
      .then((rows) => {
        const serverEntries: WatchProgressEntry[] = rows.map((r) => ({
          episodeId: r.episode_id,
          animeId: r.anime_id,
          animeTitle: r.anime_title,
          animeImage: r.anime_image,
          episodeNum: r.episode_num,
          currentTime: r.watch_time,
          duration: r.duration,
          updatedAt: new Date(r.updated_at).getTime(),
        }));
        setProgress((local) => {
          const merged = [...local];
          for (const se of serverEntries) {
            const idx = merged.findIndex((m) => m.episodeId === se.episodeId);
            if (idx === -1) merged.push(se);
            else if (se.updatedAt > merged[idx].updatedAt) merged[idx] = se;
          }
          merged.sort((a, b) => b.updatedAt - a.updatedAt);
          const sliced = merged.slice(0, MAX_ENTRIES);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced)); } catch {}
          return sliced;
        });
      })
      .catch(() => {});
  }, [user]);

  const saveProgress = useCallback(
    (entry: Omit<WatchProgressEntry, "updatedAt">) => {
      if (!entry.duration || entry.duration < 30) return;
      const percent = entry.currentTime / entry.duration;
      if (percent < 0.02 || percent > 0.97) return;
      const updated: WatchProgressEntry = { ...entry, updatedAt: Date.now() };
      const filtered = progress.filter((p) => p.episodeId !== entry.episodeId);
      save([updated, ...filtered].slice(0, MAX_ENTRIES));
      if (user) {
        apiClient.put(`/user/progress/${encodeURIComponent(entry.episodeId)}`, {
          animeId: entry.animeId,
          animeTitle: entry.animeTitle,
          animeImage: entry.animeImage,
          episodeNum: entry.episodeNum,
          watchTime: entry.currentTime,
          duration: entry.duration,
        }).catch(() => {});
      }
    },
    [progress, save, user]
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
