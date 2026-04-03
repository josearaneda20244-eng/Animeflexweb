import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AnimeResult } from "@/lib/consumet";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";

const STORAGE_KEY = "anime_history";
const MAX_HISTORY = 50;

export interface HistoryEntry extends AnimeResult {
  watchedAt: number;
  episodeNum?: number;
}

interface HistoryContextType {
  history: HistoryEntry[];
  addToHistory: (anime: AnimeResult, episodeNum?: number) => void;
  removeFromHistory: (id: string) => void;
  clearHistory: () => void;
  isInHistory: (id: string) => boolean;
}

const HistoryContext = createContext<HistoryContextType | null>(null);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });
  const { user } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);

  const save = useCallback((list: HistoryEntry[]) => {
    setHistory(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  useEffect(() => {
    if (!user) { prevUserIdRef.current = null; return; }
    if (prevUserIdRef.current === user.id) return;
    prevUserIdRef.current = user.id;
    apiClient.get<Array<{ anime_id: string; anime_title: any; anime_image: string; episode_number: number; watched_at: string }>>("/user/history")
      .then((rows) => {
        const serverEntries: HistoryEntry[] = rows.map((r) => ({
          id: r.anime_id,
          title: typeof r.anime_title === "string" ? r.anime_title : r.anime_title?.english ?? r.anime_title?.romaji ?? "",
          image: r.anime_image,
          episodeNum: r.episode_number,
          watchedAt: new Date(r.watched_at).getTime(),
        } as HistoryEntry));
        setHistory((local) => {
          const merged = [...local];
          for (const se of serverEntries) {
            if (!merged.find((m) => m.id === se.id)) merged.push(se);
          }
          merged.sort((a, b) => b.watchedAt - a.watchedAt);
          const sliced = merged.slice(0, MAX_HISTORY);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced)); } catch {}
          return sliced;
        });
      })
      .catch(() => {});
  }, [user]);

  const addToHistory = useCallback(
    (anime: AnimeResult, episodeNum?: number) => {
      const entry: HistoryEntry = { ...anime, watchedAt: Date.now(), episodeNum };
      const filtered = history.filter((h) => h.id !== anime.id);
      save([entry, ...filtered].slice(0, MAX_HISTORY));
      if (user) {
        apiClient.post("/user/history", {
          animeId: anime.id,
          animeTitle: anime.title,
          animeImage: anime.image,
          episodeNumber: episodeNum ?? 0,
        }).catch(() => {});
      }
    },
    [history, save, user]
  );

  const removeFromHistory = useCallback(
    (id: string) => save(history.filter((h) => h.id !== id)),
    [history, save]
  );

  const clearHistory = useCallback(() => save([]), [save]);
  const isInHistory = useCallback((id: string) => history.some((h) => h.id === id), [history]);

  return (
    <HistoryContext.Provider value={{ history, addToHistory, removeFromHistory, clearHistory, isInHistory }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider");
  return ctx;
}
