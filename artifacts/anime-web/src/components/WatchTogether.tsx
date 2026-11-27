import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Copy, Crown, LogOut, MessageCircle, Send, Users, X, Check, Loader2, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { hasIziffSession } from "@/lib/iziffAuth";
import { consumet } from "@/lib/consumet";
import {
  createWatchRoom, joinWatchRoom, leaveWatchRoom, sendRoomChat, useRoomChatVisible, useWatchRoom,
  restoreWatchRoom, type RoomMedia,
} from "@/lib/watchRoom";

/* ── Estilos compartidos ───────────────────────────────────────────────── */
const card: CSSProperties = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
};
const input: CSSProperties = {
  flex: 1, minWidth: 0, height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: 14, outline: "none",
};

export function roomShareUrl(code: string) {
  return `${window.location.origin}/sala/${code}`;
}

/** Abre el episodio que está viendo el anfitrión. */
export async function goToRoomMedia(media: RoomMedia, navigate: (to: string) => void) {
  const p = new URLSearchParams({
    episodeNum: String(media.episode),
    animeId: String(media.mediaId),
    animeTitle: media.title ?? "",
    animeImage: media.image ?? "",
  });
  try {
    const info = await consumet.episodesById(String(media.mediaId));
    const eps = info.episodes ?? [];
    const ep = eps.find((e) => e.number === media.episode);
    const next = eps.find((e) => e.number === media.episode + 1);
    if (ep) p.set("episodeId", ep.id);
    if (!p.get("animeTitle") && info.title) p.set("animeTitle", typeof info.title === "string" ? info.title : String((info.title as any)?.romaji ?? ""));
    if (next) { p.set("nextEpisodeId", next.id); p.set("nextEpisodeNum", String(next.number)); }
  } catch { /* el motor funciona solo con id + título + número */ }
  if (!p.get("episodeId")) p.set("episodeId", `room-${media.mediaId}-${media.episode}`);
  navigate(`/watch?${p.toString()}`);
}

/* ── Panel principal (crear / unirse / sala) ───────────────────────────── */
export function WatchTogetherPanel({ onClose, compact }: { onClose?: () => void; compact?: boolean }) {
  const room = useWatchRoom();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inRoom = room.status !== "idle";
  useRoomChatVisible(inRoom);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [room.messages.length]);

  const needsLogin = !user || !hasIziffSession();

  const run = async (kind: "create" | "join") => {
    setError(null); setBusy(kind);
    try {
      if (kind === "create") await createWatchRoom();
      else await joinWatchRoom(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con la sala.");
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!room.code) return;
    try { await navigator.clipboard.writeText(roomShareUrl(room.code)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
  };

  const submitChat = (e: FormEvent) => {
    e.preventDefault();
    if (sendRoomChat(text)) setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: compact ? "100%" : undefined, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Users size={18} />
        <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>Ver juntos</div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar" className="iz-btn iz-btn--ghost iz-btn--sm" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        )}
      </div>

      {needsLogin ? (
        <div style={{ ...card, padding: 16, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
          {user
            ? "Cierra sesión y vuelve a entrar con tu cuenta de la app para usar las salas."
            : "Inicia sesión con tu cuenta de la app para crear o unirte a una sala."}
        </div>
      ) : !inRoom ? (
        <>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
            Crea una sala privada, comparte el código y vean el mismo episodio al mismo tiempo (hasta 10 personas). Funciona igual que en la app.
          </p>
          <button type="button" className="iz-btn iz-btn--primary" disabled={!!busy} onClick={() => run("create")}>
            {busy === "create" ? <Loader2 size={16} className="iz-spin" /> : <Users size={16} />} Crear sala
          </button>
          <form onSubmit={(e) => { e.preventDefault(); run("join"); }} style={{ display: "flex", gap: 8 }}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="Código de 6 caracteres"
              style={{ ...input, letterSpacing: 3, fontWeight: 700, textTransform: "uppercase" }}
            />
            <button type="submit" className="iz-btn" disabled={!!busy || code.trim().length !== 6}>
              {busy === "join" ? <Loader2 size={16} className="iz-spin" /> : "Unirse"}
            </button>
          </form>
          {(error || room.error) && <div style={{ color: "#f87171", fontSize: 13 }}>{error || room.error}</div>}
        </>
      ) : (
        <>
          <div style={{ ...card, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                {room.status === "connected" ? "Código de la sala" : room.status === "reconnecting" ? "Reconectando…" : "Conectando…"}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 4 }}>{room.code}</div>
            </div>
            <button type="button" className="iz-btn iz-btn--sm" onClick={copy} title="Copiar enlace de invitación">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Invitar"}
            </button>
          </div>

          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
            {room.you?.isHost
              ? "Tú controlas la reproducción: play, pausa y adelantar se sincronizan con todos."
              : `${room.hostName ?? "El anfitrión"} controla la reproducción. Tu video se ajusta solo.`}
          </div>

          {!room.you?.isHost && room.sync?.media && (
            <button type="button" className="iz-btn iz-btn--sm" onClick={() => goToRoomMedia(room.sync!.media!, navigate)}>
              <Play size={14} /> Ir a {room.sync.media.title ?? "lo que ven"} · Ep {room.sync.media.episode}
            </button>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {room.members.map((m) => (
              <span key={m.userId} className="iz-chip" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                {m.isHost && <Crown size={12} color="#fbbf24" />}{m.userName}
              </span>
            ))}
          </div>

          <div style={{ ...card, display: "flex", flexDirection: "column", minHeight: 0, flex: compact ? 1 : undefined }}>
            <div ref={listRef} style={{ overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6, height: compact ? undefined : 240, flex: compact ? 1 : undefined, minHeight: 120 }}>
              {room.messages.length === 0 && (
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, textAlign: "center", padding: 12 }}>
                  <MessageCircle size={16} style={{ marginBottom: 4 }} /><br />Aún no hay mensajes
                </div>
              )}
              {room.messages.map((m) =>
                m.kind === "system" ? (
                  <div key={m.id} style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center" }}>{m.text}</div>
                ) : (
                  <div key={m.id} style={{ fontSize: 13, lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 800, color: m.userId === room.you?.userId ? "#a5b4fc" : "#fff" }}>{m.userName}</span>{" "}
                    <span style={{ color: "rgba(255,255,255,0.82)", wordBreak: "break-word" }}>{m.text}</span>
                  </div>
                ),
              )}
            </div>
            <form onSubmit={submitChat} style={{ display: "flex", gap: 6, padding: 8, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <input value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} placeholder="Escribe un mensaje…" style={{ ...input, height: 36 }} />
              <button type="submit" className="iz-btn iz-btn--sm" disabled={!text.trim() || room.status !== "connected"} aria-label="Enviar">
                <Send size={14} />
              </button>
            </form>
          </div>

          <button type="button" className="iz-btn iz-btn--ghost iz-btn--sm" onClick={leaveWatchRoom} style={{ color: "#f87171" }}>
            <LogOut size={14} /> Salir de la sala
          </button>
        </>
      )}
    </div>
  );
}

/* ── Cajón lateral (en el reproductor y en el aviso flotante) ──────────── */
export function WatchTogetherDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
      <div style={{
        position: "relative", width: "min(380px, 100vw)", height: "100%", background: "#0a0a0b",
        borderLeft: "1px solid rgba(255,255,255,0.08)", padding: 16, display: "flex", flexDirection: "column", color: "#fff",
      }}>
        <WatchTogetherPanel onClose={onClose} compact />
      </div>
    </div>
  );
}

/** Botón "Ver juntos" con contador de mensajes no leídos. */
export function WatchTogetherButton({ onClick, style }: { onClick: () => void; style?: CSSProperties }) {
  const room = useWatchRoom();
  const inRoom = room.status !== "idle";
  return (
    <button type="button" onClick={onClick} title="Ver juntos" style={{
      position: "relative", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
      borderRadius: 10, cursor: "pointer", fontSize: 12, fontWeight: 700,
      background: inRoom ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.05)",
      border: `1px solid ${inRoom ? "rgba(129,140,248,0.5)" : "rgba(255,255,255,0.1)"}`,
      color: inRoom ? "#c7d2fe" : "rgba(255,255,255,0.7)", ...style,
    }}>
      <Users size={14} />
      <span className="hidden md:inline">{inRoom ? `Sala ${room.code}` : "Ver juntos"}</span>
      {room.unread > 0 && (
        <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 800, display: "grid", placeItems: "center", padding: "0 4px" }}>
          {room.unread > 9 ? "9+" : room.unread}
        </span>
      )}
    </button>
  );
}

/**
 * Global: reconecta la sala al recargar y, fuera del reproductor, muestra una
 * píldora flotante con la sala (para invitados: "Ir" a lo que pone el anfitrión).
 */
export function WatchRoomDock() {
  const room = useWatchRoom();
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => { if (user) restoreWatchRoom(); }, [user]);

  if (room.status === "idle" || location.startsWith("/watch") || location.startsWith("/sala")) {
    return <WatchTogetherDrawer open={open} onClose={() => setOpen(false)} />;
  }
  const media = room.sync?.media;
  return (
    <>
      <div style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(16px + var(--iz-tabbar-h, 0px))", zIndex: 90,
        display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px 14px", borderRadius: 999,
        background: "rgba(15,15,20,0.92)", border: "1px solid rgba(129,140,248,0.4)", backdropFilter: "blur(12px)",
        color: "#fff", fontSize: 13, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", maxWidth: "calc(100vw - 24px)",
      }}>
        <Users size={14} color="#a5b4fc" />
        <span style={{ fontWeight: 800, letterSpacing: 1 }}>{room.code}</span>
        {media && !room.you?.isHost && (
          <button type="button" className="iz-btn iz-btn--primary iz-btn--sm" onClick={() => goToRoomMedia(media, navigate)}>
            <Play size={12} /> Ep {media.episode}
          </button>
        )}
        <button type="button" className="iz-btn iz-btn--sm" onClick={() => setOpen(true)} style={{ position: "relative" }}>
          <MessageCircle size={14} />
          {room.unread > 0 && <span style={{ marginLeft: 2, fontWeight: 800 }}>{room.unread}</span>}
        </button>
      </div>
      <WatchTogetherDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
