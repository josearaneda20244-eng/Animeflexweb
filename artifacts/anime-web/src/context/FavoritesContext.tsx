import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { AnimeResult } from "@/lib/consumet";

const STORAGE_KEY = "anime_favorites";

interface FavoritesContextType {
  favorites: AnimeResult[];
  isFavorite: (id: string) => boolean;
  addFavorite: (anime: AnimeResult) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (anime: AnimeResult) => void;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<AnimeResult[]>(() => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  const save = useCallback((list: AnimeResult[]) => {
    setFavorites(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);
  const addFavorite = useCallback(
    (anime: AnimeResult) => { if (!favorites.some((f) => f.id === anime.id)) save([...favorites, anime]); },
    [favorites, save]
  );
  const removeFavorite = useCallback(
    (id: string) => save(favorites.filter((f) => f.id !== id)),
    [favorites, save]
  );
  const toggleFavorite = useCallback(
    (anime: AnimeResult) => {
      if (favorites.some((f) => f.id === anime.id)) removeFavorite(anime.id);
      else addFavorite(anime);
    },
    [favorites, addFavorite, removeFavorite]
  );

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
