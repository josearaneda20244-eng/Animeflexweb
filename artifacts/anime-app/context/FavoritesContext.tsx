import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import type { AnimeResult } from "@/lib/consumet";

const STORAGE_KEY = "@anime_favorites";

interface FavoritesContextType {
  favorites: AnimeResult[];
  isFavorite: (id: string) => boolean;
  addFavorite: (anime: AnimeResult) => void;
  removeFavorite: (id: string) => void;
  toggleFavorite: (anime: AnimeResult) => void;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<AnimeResult[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((data) => {
      if (data) setFavorites(JSON.parse(data));
    });
  }, []);

  const save = useCallback((list: AnimeResult[]) => {
    setFavorites(list);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites]
  );

  const addFavorite = useCallback(
    (anime: AnimeResult) => {
      if (!isFavorite(anime.id)) save([...favorites, anime]);
    },
    [favorites, isFavorite, save]
  );

  const removeFavorite = useCallback(
    (id: string) => save(favorites.filter((f) => f.id !== id)),
    [favorites, save]
  );

  const toggleFavorite = useCallback(
    (anime: AnimeResult) => {
      if (isFavorite(anime.id)) removeFavorite(anime.id);
      else addFavorite(anime);
    },
    [isFavorite, addFavorite, removeFavorite]
  );

  return (
    <FavoritesContext.Provider
      value={{ favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
