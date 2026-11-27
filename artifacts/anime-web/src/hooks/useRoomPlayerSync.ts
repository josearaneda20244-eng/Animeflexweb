import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { expectedHostPosition, getWatchRoomState, sendRoomSync, useWatchRoom } from "@/lib/watchRoom";
import { goToRoomMedia } from "@/components/WatchTogether";

/** Video activo del reproductor (HLS o MP4), sea cual sea el servidor elegido. */
function activeVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("#plyr-fullscreen-container video");
}

const DRIFT_TOLERANCE = 2.5; // segundos
const HEARTBEAT_MS = 5_000;

/**
 * Sincroniza el reproductor con la sala "Ver juntos":
 * - Anfitrión: envía play/pausa/posición (al cambiar y cada 5 s).
 * - Invitados: siguen el episodio del anfitrión y ajustan minuto y pausa.
 */
export function useRoomPlayerSync(media: { animeId: string; episodeNum: string; title: string; image: string }) {
  const room = useWatchRoom();
  const [, navigate] = useLocation();
  const mediaId = Number(media.animeId) || 0;
  const episode = parseInt(media.episodeNum) || 0;
  const followedSeqRef = useRef(0);
  const inRoom = room.status === "connected";
  const isHost = !!room.you?.isHost;

  // ── Anfitrión ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!inRoom || !isHost || !mediaId || !episode) return;
    let lastPaused: boolean | null = null;
    let lastPos = -1;
    let lastSentAt = 0;
    const tick = () => {
      const v = activeVideo();
      if (!v || !(v.duration > 0)) return;
      const now = Date.now();
      const pos = v.currentTime;
      const paused = v.paused;
      const expected = lastPos < 0 ? pos : lastPos + (lastPaused ? 0 : (now - lastSentAt) / 1000);
      const jumped = Math.abs(pos - expected) > 2;
      if (paused !== lastPaused || jumped || now - lastSentAt >= HEARTBEAT_MS) {
        if (sendRoomSync({ mediaId, episode, title: media.title || undefined, image: /^https:\/\//.test(media.image) ? media.image : undefined, paused, position: pos })) {
          lastPaused = paused; lastPos = pos; lastSentAt = now;
        }
      }
    };
    tick();
    const id = setInterval(tick, 700);
    return () => clearInterval(id);
  }, [inRoom, isHost, mediaId, episode, media.title, media.image]);

  // ── Invitado: seguir el episodio del anfitrión ─────────────────────────
  useEffect(() => {
    if (!inRoom || isHost) return;
    const sync = room.sync;
    const m = sync?.media;
    if (!sync || !m) return;
    if ((m.mediaId !== mediaId || m.episode !== episode) && followedSeqRef.current !== sync.seq) {
      followedSeqRef.current = sync.seq;
      void goToRoomMedia(m, navigate);
    }
  }, [inRoom, isHost, room.sync, mediaId, episode, navigate]);

  // ── Invitado: ajustar minuto y pausa ───────────────────────────────────
  useEffect(() => {
    if (!inRoom || isHost) return;
    const apply = () => {
      const s = getWatchRoomState();
      const sync = s.sync;
      if (!sync?.media || !sync.playback) return;
      if (sync.media.mediaId !== mediaId || sync.media.episode !== episode) return;
      const v = activeVideo();
      if (!v || !(v.duration > 0) || v.seeking) return;
      const target = expectedHostPosition(sync);
      if (target == null) return;
      if (Math.abs(v.currentTime - target) > DRIFT_TOLERANCE && target < v.duration - 1) v.currentTime = target;
      if (sync.playback.paused && !v.paused) v.pause();
      if (!sync.playback.paused && v.paused) v.play().catch(() => { /* el navegador pide un toque primero */ });
    };
    apply();
    const id = setInterval(apply, 1_000);
    return () => clearInterval(id);
  }, [inRoom, isHost, room.sync?.seq, mediaId, episode]);

  return { inRoom, isHost };
}
