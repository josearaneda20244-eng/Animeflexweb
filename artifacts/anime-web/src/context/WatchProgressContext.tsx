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
  // Sincronización con backend: un envío por episodio cada 5 s (máx. 15 s) y flush real al salir.
  const pendingTimers = useRef<Map<string, number>>(new Map());
  const pendingBodies = useRef<Map<string, Record<string, unknown>>>(new Map());
  const lastSentAt = useRef<Map<string, number>>(new Map());
  const lastLocalSave = useRef<{ epId: string; at: number; time: number }>({ epId: "", at: 0, time: 0 });
  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  const PROGRESS_DEBOUNCE_MS = 5000;
  const PROGRESS_FLUSH_MAX_MS = 15000;
  const LOCAL_THROTTLE_MS = 2500;

  const save = useCallback((list: WatchProgressEntry[]) => {
    progressRef.current = list;
    setProgress(list);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }, []);

  const sendNow = useCallback((epId: string, keepalive = false) => {
    const body = pendingBodies.current.get(epId);
    const timer = pendingTimers.current.get(epId);
    if (timer) window.clearTimeout(timer);
    pendingTimers.current.delete(epId);
    if (!body) return;
    pendingBodies.current.delete(epId);
    lastSentAt.current.set(epId, Date.now());
    if (keepalive) {
      // fetch keepalive sobrevive al cierre de la pestaña (apiClient no lo soporta)
      try {
        const base = import.meta.env.VITE_API_URL ?? import.meta.env.VITE_API_BASE_URL ?? "/api";
        const token = localStorage.getItem("af_token");
        fetch(`${base}/user/progress/${encodeURIComponent(epId)}`, {
          method: "PUT",
          keepalive: true,
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body),
        }).catch(() => {});
      } catch {}
      return;
    }
    apiClient.put(`/user/progress/${encodeURIComponent(epId)}`, body).catch(() => {});
  }, []);

  // Al cerrar/ocultar la pestaña se ENVÍA el progreso pendiente (antes se descartaba).
  useEffect(() => {
    const flushAll = () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progressRef.current)); } catch {}
      Array.from(pendingBodies.current.keys()).forEach((id) => sendNow(id, true));
    };
    const onVis = () => { if (document.visibilityState === "hidden") flushAll(); };
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onVis);
      flushAll();
    };
  }, [sendNow]);

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
      // < 2 %: aún no empezó. Al final (>97 %) guardamos el 97 % para marcarlo como visto.
      if (percent < 0.02) return;
      const currentTime = percent > 0.97 ? entry.duration * 0.97 : entry.currentTime;

      // Guardado local con throttle: timeupdate dispara ~4 veces/s
      const now = Date.now();
      const last = lastLocalSave.current;
      const jumped = Math.abs(currentTime - last.time) > 10;
      if (last.epId === entry.episodeId && now - last.at < LOCAL_THROTTLE_MS && !jumped) {
        // aun así dejamos listo el cuerpo para el backend
      } else {
        lastLocalSave.current = { epId: entry.episodeId, at: now, time: currentTime };
        const updated: WatchProgressEntry = { ...entry, currentTime, updatedAt: now };
        const filtered = progressRef.current.filter((p) => p.episodeId !== entry.episodeId);
        save([updated, ...filtered].slice(0, MAX_ENTRIES));
      }
      if (!user) return;

      const epId = entry.episodeId;
      pendingBodies.current.set(epId, {
        animeId: entry.animeId,
        animeTitle: entry.animeTitle,
        animeImage: entry.animeImage,
        episodeNum: entry.episodeNum,
        watchTime: currentTime,
        duration: entry.duration,
      });
      const lastSent = lastSentAt.current.get(epId) ?? 0;
      if (now - lastSent >= PROGRESS_FLUSH_MAX_MS) { sendNow(epId); return; }
      if (!pendingTimers.current.has(epId)) {
        pendingTimers.current.set(epId, window.setTimeout(() => sendNow(epId), PROGRESS_DEBOUNCE_MS));
      }
    },
    [save, user, sendNow]
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
    (episodeId: string) => save(progressRef.current.filter((p) => p.episodeId !== episodeId)),
    [save]
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
