import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AnimeResult } from "@/lib/consumet";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";

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
  const { user } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);

  const save = useCallback((list: AnimeResult[]) => {
    setFavorites(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  useEffect(() => {
    if (!user) { prevUserIdRef.current = null; return; }
    if (prevUserIdRef.current === user.id) return;
    prevUserIdRef.current = user.id;
    apiClient.get<Array<{ anime_id: string; anime_title: any; anime_image: string; anime_type: string; anime_rating: number }>>("/user/favorites")
      .then((rows) => {
        const serverFavs: AnimeResult[] = rows.map((r) => ({
          id: r.anime_id,
          title: typeof r.anime_title === "string" ? r.anime_title : r.anime_title?.english ?? r.anime_title?.romaji ?? "",
          image: r.anime_image,
          type: r.anime_type,
          rating: r.anime_rating,
        } as AnimeResult));
        setFavorites((local) => {
          const merged = [...local];
          for (const sf of serverFavs) {
            if (!merged.find((m) => m.id === sf.id)) merged.push(sf);
          }
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
          return merged;
        });
      })
      .catch(() => {});
  }, [user]);

  const isFavorite = useCallback((id: string) => favorites.some((f) => f.id === id), [favorites]);

  const addFavorite = useCallback(
    (anime: AnimeResult) => {
      if (favorites.some((f) => f.id === anime.id)) return;
      save([...favorites, anime]);
      if (user) {
        apiClient.post("/user/favorites", {
          animeId: anime.id,
          animeTitle: anime.title,
          animeImage: anime.image,
          animeType: anime.type,
          animeRating: anime.rating,
          animeGenres: anime.genres ?? [],
        }).catch(() => {});
      }
    },
    [favorites, save, user]
  );

  const removeFavorite = useCallback(
    (id: string) => {
      save(favorites.filter((f) => f.id !== id));
      if (user) {
        apiClient.delete(`/user/favorites/${id}`).catch(() => {});
      }
    },
    [favorites, save, user]
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
