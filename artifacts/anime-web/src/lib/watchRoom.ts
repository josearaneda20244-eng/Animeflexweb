import { useEffect, useSyncExternalStore } from "react";
import { IZIFF_AUTH_URL, getIziffAccessToken, iziffAuthed } from "@/lib/iziffAuth";

/**
 * "Ver juntos" — las mismas salas privadas de la app (servicio IZIFF).
 * La conexión vive a nivel de módulo para sobrevivir al cambiar de página o episodio.
 */

export type RoomMedia = { mediaId: number; episode: number; title: string | null; image: string | null };
export type RoomMember = { userId: string; userName: string; premium: boolean; creator: boolean; isHost: boolean };
export type RoomChatMessage = {
  id: string;
  kind: "user" | "system";
  userId?: string;
  userName?: string;
  premium?: boolean;
  creator?: boolean;
  text: string;
  at: number;
};
export type RoomPlayback = { paused: boolean; position: number; at: number };
export type RoomSyncSnapshot = {
  media: RoomMedia | null;
  playback: RoomPlayback | null;
  receivedAt: number;
  serverTime: number;
  seq: number;
};
export type WatchRoomStatus = "idle" | "connecting" | "connected" | "reconnecting";
export type WatchRoomState = {
  status: WatchRoomStatus;
  code: string | null;
  error: string | null;
  you: { userId: string; isHost: boolean } | null;
  hostId: string | null;
  hostName: string | null;
  members: RoomMember[];
  messages: RoomChatMessage[];
  unread: number;
  sync: RoomSyncSnapshot | null;
};

const INITIAL: WatchRoomState = {
  status: "idle", code: null, error: null, you: null, hostId: null, hostName: null,
  members: [], messages: [], unread: 0, sync: null,
};

const CODE_RE = /^[A-Z0-9]{6}$/;
const STORE_KEY = "iz_watch_room";
const MAX_RECONNECT = 6;
const KEEPALIVE_MS = 25_000;

let state: WatchRoomState = INITIAL;
const listeners = new Set<() => void>();
let socket: WebSocket | null = null;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let intentionalClose = false;
let chatVisible = 0;
let syncSeq = 0;

function setState(patch: Partial<WatchRoomState> | ((s: WatchRoomState) => Partial<WatchRoomState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getWatchRoomState = () => state;
export function useWatchRoom(): WatchRoomState {
  return useSyncExternalStore(subscribe, getWatchRoomState, getWatchRoomState);
}

export function normalizeRoomCode(raw: string) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function withHost(members: RoomMember[], hostId: string | null) {
  return members.map((m) => ({ ...m, isHost: m.userId === hostId }));
}

function handleMessage(raw: string) {
  if (raw === "pong") return;
  let data: any;
  try { data = JSON.parse(raw); } catch { return; }
  switch (data.type) {
    case "welcome": {
      reconnectAttempts = 0;
      const hostId: string | null = data.room?.hostId ?? null;
      setState({
        status: "connected",
        error: null,
        you: { userId: data.you.userId, isHost: data.you.userId === hostId },
        hostId,
        hostName: data.room?.hostName ?? null,
        members: withHost(data.members ?? [], hostId),
        messages: data.messages ?? [],
        sync: { media: data.room?.media ?? null, playback: data.room?.playback ?? null, receivedAt: Date.now(), serverTime: data.serverTime ?? Date.now(), seq: ++syncSeq },
      });
      break;
    }
    case "presence":
      setState((s) => ({ members: withHost(data.members ?? [], s.hostId) }));
      break;
    case "host":
      setState((s) => ({
        hostId: data.hostId,
        hostName: data.hostName,
        you: s.you ? { ...s.you, isHost: s.you.userId === data.hostId } : null,
        members: withHost(s.members, data.hostId),
      }));
      break;
    case "chat": {
      const msg = data.message as RoomChatMessage;
      setState((s) => ({
        messages: [...s.messages, msg].slice(-120),
        unread: chatVisible > 0 || msg.userId === s.you?.userId ? s.unread : s.unread + 1,
      }));
      break;
    }
    case "sync":
      setState({ sync: { media: data.media ?? null, playback: data.playback ?? null, receivedAt: Date.now(), serverTime: data.serverTime ?? Date.now(), seq: ++syncSeq } });
      break;
  }
}

function socketUrl(code: string) {
  return `${IZIFF_AUTH_URL.replace(/^http/, "ws")}/v1/rooms/${code}/ws`;
}

async function openSocket(code: string, forceRefresh: boolean) {
  const token = await getIziffAccessToken(forceRefresh);
  if (!token) {
    setState({ ...INITIAL, error: "Inicia sesión de nuevo para usar las salas." });
    try { localStorage.removeItem(STORE_KEY); } catch { /* */ }
    return;
  }
  if (intentionalClose || state.code !== code) return;
  // El navegador no puede enviar Authorization en un WebSocket: el token va como subprotocolo.
  const ws = new WebSocket(socketUrl(code), ["iziff", `bearer.${token}`]);
  socket = ws;
  ws.onmessage = (ev) => { if (typeof ev.data === "string") handleMessage(ev.data); };
  ws.onopen = () => {
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send("ping"); }, KEEPALIVE_MS);
  };
  ws.onclose = () => {
    if (socket !== ws) return;
    socket = null;
    if (keepAlive) clearInterval(keepAlive);
    keepAlive = null;
    if (intentionalClose || state.code !== code) return;
    scheduleReconnect(code);
  };
}

function scheduleReconnect(code: string) {
  if (reconnectAttempts >= MAX_RECONNECT) {
    setState({ status: "idle", error: "Se perdió la conexión con la sala." });
    return;
  }
  reconnectAttempts += 1;
  setState({ status: "reconnecting" });
  const delay = Math.min(15_000, 1000 * 2 ** (reconnectAttempts - 1));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void openSocket(code, reconnectAttempts > 1);
  }, delay);
}

export async function createWatchRoom(): Promise<string> {
  const { code } = await iziffAuthed<{ code: string }>("/v1/rooms", { method: "POST", body: {} });
  await joinWatchRoom(code);
  return code;
}

export async function joinWatchRoom(raw: string): Promise<void> {
  const code = normalizeRoomCode(raw);
  if (!CODE_RE.test(code)) throw new Error("El código tiene 6 caracteres.");
  if (state.code === code && state.status !== "idle") return;
  leaveWatchRoom();
  const info = await iziffAuthed<{ memberCount: number; maxMembers: number }>(`/v1/rooms/${code}`);
  if (info.memberCount >= info.maxMembers) throw new Error("La sala está llena.");
  intentionalClose = false;
  reconnectAttempts = 0;
  setState({ ...INITIAL, status: "connecting", code });
  try { localStorage.setItem(STORE_KEY, code); } catch { /* */ }
  await openSocket(code, false);
}

export function leaveWatchRoom() {
  intentionalClose = true;
  if (keepAlive) clearInterval(keepAlive);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  keepAlive = null;
  reconnectTimer = null;
  const ws = socket;
  socket = null;
  if (ws) { try { ws.close(1000, "leave"); } catch { /* */ } }
  try { localStorage.removeItem(STORE_KEY); } catch { /* */ }
  setState(INITIAL);
}

function send(payload: Record<string, unknown>) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(payload));
  return true;
}

export function sendRoomChat(text: string) {
  const t = text.trim();
  return t ? send({ type: "chat", text: t.slice(0, 300) }) : false;
}

export type HostSyncPayload = { mediaId: number; episode: number; title?: string; image?: string; paused: boolean; position: number };
export function sendRoomSync(p: HostSyncPayload) {
  if (!state.you?.isHost) return false;
  return send({ type: "sync", ...p });
}

/** Mientras el chat esté visible, sus mensajes no cuentan como no leídos. */
export function useRoomChatVisible(visible: boolean) {
  useEffect(() => {
    if (!visible) return;
    chatVisible += 1;
    setState({ unread: 0 });
    return () => { chatVisible = Math.max(0, chatVisible - 1); };
  }, [visible]);
}

/** Dónde debería ir el video del anfitrión ahora (usa el reloj del servidor). */
export function expectedHostPosition(sync: RoomSyncSnapshot, now = Date.now()): number | null {
  if (!sync.playback) return null;
  if (sync.playback.paused) return sync.playback.position;
  const ageAtSend = Math.max(0, sync.serverTime - sync.playback.at);
  const sinceReceived = Math.max(0, now - sync.receivedAt);
  return sync.playback.position + (ageAtSend + sinceReceived) / 1000;
}

/** Al recargar la página, volver a la sala en la que estabas. */
export function restoreWatchRoom() {
  let code: string | null = null;
  try { code = localStorage.getItem(STORE_KEY); } catch { /* */ }
  if (code && CODE_RE.test(code) && state.status === "idle") {
    joinWatchRoom(code).catch(() => { try { localStorage.removeItem(STORE_KEY); } catch { /* */ } });
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const code = state.code;
    if (!code || intentionalClose || socket || reconnectTimer) return;
    reconnectAttempts = 0;
    void openSocket(code, true);
  });
}
