import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AnimeResult } from "@/lib/consumet";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";

export type WatchStatus = "watching" | "completed" | "plan_to_watch" | "dropped";

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
  const { user } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);

  const save = useCallback((list: WatchListEntry[]) => {
    setWatchList(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  useEffect(() => {
    if (!user) { prevUserIdRef.current = null; return; }
    if (prevUserIdRef.current === user.id) return;
    prevUserIdRef.current = user.id;
    apiClient.get<Array<{ anime_id: string; anime_title: any; anime_image: string; anime_type: string; status: WatchStatus; updated_at: string }>>("/user/watchlist")
      .then((rows) => {
        const serverEntries: WatchListEntry[] = rows.map((r) => ({
          anime: {
            id: r.anime_id,
            title: typeof r.anime_title === "string" ? r.anime_title : r.anime_title?.english ?? r.anime_title?.romaji ?? "",
            image: r.anime_image,
            type: r.anime_type,
          } as AnimeResult,
          status: r.status,
          addedAt: new Date(r.updated_at).getTime(),
        }));
        setWatchList((local) => {
          const merged = [...local];
          for (const se of serverEntries) {
            if (!merged.find((m) => m.anime.id === se.anime.id)) merged.push(se);
          }
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
          return merged;
        });
      })
      .catch(() => {});
  }, [user]);

  const getStatus = useCallback(
    (id: string): WatchStatus | null => watchList.find((e) => e.anime.id === id)?.status ?? null,
    [watchList]
  );

  const setStatus = useCallback(
    (anime: AnimeResult, status: WatchStatus | null) => {
      if (!status) {
        save(watchList.filter((e) => e.anime.id !== anime.id));
        if (user) apiClient.delete(`/user/watchlist/${anime.id}`).catch(() => {});
        return;
      }
      const existing = watchList.find((e) => e.anime.id === anime.id);
      if (existing) {
        save(watchList.map((e) => e.anime.id === anime.id ? { ...e, status } : e));
      } else {
        save([...watchList, { anime, status, addedAt: Date.now() }]);
      }
      if (user) {
        apiClient.put(`/user/watchlist/${anime.id}`, {
          animeTitle: anime.title,
          animeImage: anime.image,
          animeType: anime.type,
          status,
        }).catch(() => {});
      }
    },
    [watchList, save, user]
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
