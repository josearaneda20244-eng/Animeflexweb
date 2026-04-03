import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AnimeResult } from "@/lib/consumet";

export type WatchStatus = "watching" | "completed" | "plan_to_watch";

export interface WatchListEntry {
  anime: AnimeResult;
  status: WatchStatus;
  addedAt: number;
}

interface WatchListContextType {
  watchList: WatchListEntry[];
  getStatus: (id: string) => WatchStatus | null;
  setStatus: (anime: AnimeResult, status: WatchStatus | null) => void;
  getByStatus: (status: WatchStatus) => WatchListEntry[];
}

const STORAGE_KEY = "anime_watchlist";

const WatchListContext = createContext<WatchListContextType | null>(null);

export function WatchListProvider({ children }: { children: React.ReactNode }) {
  const [watchList, setWatchList] = useState<WatchListEntry[]>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  const save = useCallback((list: WatchListEntry[]) => {
    setWatchList(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const getStatus = useCallback(
    (id: string): WatchStatus | null => {
      return watchList.find((e) => e.anime.id === id)?.status ?? null;
    },
    [watchList]
  );

  const setStatus = useCallback(
    (anime: AnimeResult, status: WatchStatus | null) => {
      if (!status) {
        save(watchList.filter((e) => e.anime.id !== anime.id));
        return;
      }
      const existing = watchList.find((e) => e.anime.id === anime.id);
      if (existing) {
        save(watchList.map((e) => e.anime.id === anime.id ? { ...e, status } : e));
      } else {
        save([...watchList, { anime, status, addedAt: Date.now() }]);
      }
    },
    [watchList, save]
  );

  const getByStatus = useCallback(
    (status: WatchStatus) => watchList.filter((e) => e.status === status),
    [watchList]
  );

  return (
    <WatchListContext.Provider value={{ watchList, getStatus, setStatus, getByStatus }}>
      {children}
    </WatchListContext.Provider>
  );
}

export function useWatchList() {
  const ctx = useContext(WatchListContext);
  if (!ctx) throw new Error("useWatchList must be used within WatchListProvider");
  return ctx;
}
