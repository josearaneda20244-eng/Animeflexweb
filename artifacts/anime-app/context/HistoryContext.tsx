import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { AnimeResult } from "@/lib/consumet";

const STORAGE_KEY = "@anime_history";
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) setHistory(JSON.parse(data));
    });
  }, []);

  const save = useCallback((list: HistoryEntry[]) => {
    setHistory(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const addToHistory = useCallback(
    (anime: AnimeResult, episodeNum?: number) => {
      const entry: HistoryEntry = { ...anime, watchedAt: Date.now(), episodeNum };
      const filtered = history.filter((h) => h.id !== anime.id);
      save([entry, ...filtered].slice(0, MAX_HISTORY));
    },
    [history, save]
  );

  const removeFromHistory = useCallback(
    (id: string) => save(history.filter((h) => h.id !== id)),
    [history, save]
  );

  const clearHistory = useCallback(() => save([]), [save]);

  const isInHistory = useCallback(
    (id: string) => history.some((h) => h.id === id),
    [history]
  );

  return (
    <HistoryContext.Provider
      value={{ history, addToHistory, removeFromHistory, clearHistory, isInHistory }}
    >
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used within HistoryProvider");
  return ctx;
}
