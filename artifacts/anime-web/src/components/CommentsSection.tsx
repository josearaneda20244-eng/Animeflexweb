import { useState, useEffect } from "react";
import { MessageCircle, Send, ThumbsUp, Trash2, User } from "lucide-react";

interface Comment {
  id: string;
  author: string;
  avatar: string;
  text: string;
  timestamp: number;
  likes: number;
  likedByMe: boolean;
  spoiler: boolean;
}

function getStorageKey(animeId: string) {
  return `animeflex_comments_${animeId}`;
}

function loadComments(animeId: string): Comment[] {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(animeId)) ?? "[]");
  } catch {
    return [];
  }
}

function saveComments(animeId: string, comments: Comment[]) {
  localStorage.setItem(getStorageKey(animeId), JSON.stringify(comments));
}

const AVATAR_COLORS = ["#6C63FF", "#EC4899", "#22C55E", "#F59E0B", "#06B6D4", "#EF4444", "#8B5CF6"];

function getAvatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function CommentsSection({ animeId }: { animeId: string }) {
  const [comments, setComments] = useState<Comment[]>(() => loadComments(animeId));
  const [author, setAuthor] = useState(() => localStorage.getItem("animeflex_username") ?? "");
  const [text, setText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"new" | "top">("new");

  useEffect(() => {
    setComments(loadComments(animeId));
    setRevealedSpoilers(new Set());
  }, [animeId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !author.trim()) return;

    localStorage.setItem("animeflex_username", author.trim());

    const newComment: Comment = {
      id: `${Date.now()}-${Math.random()}`,
      author: author.trim(),
      avatar: author.trim()[0].toUpperCase(),
      text: text.trim(),
      timestamp: Date.now(),
      likes: 0,
      likedByMe: false,
      spoiler: isSpoiler,
    };

    const updated = [newComment, ...comments];
    saveComments(animeId, updated);
    setComments(updated);
    setText("");
    setIsSpoiler(false);
  };

  const toggleLike = (id: string) => {
    const updated = comments.map((c) => {
      if (c.id !== id) return c;
      return { ...c, likes: c.likedByMe ? c.likes - 1 : c.likes + 1, likedByMe: !c.likedByMe };
    });
    saveComments(animeId, updated);
    setComments(updated);
  };

  const deleteComment = (id: string) => {
    const updated = comments.filter((c) => c.id !== id);
    saveComments(animeId, updated);
    setComments(updated);
  };

  const revealSpoiler = (id: string) => {
    setRevealedSpoilers((prev) => new Set([...prev, id]));
  };

  const sorted = [...comments].sort((a, b) => {
    if (sortBy === "top") return b.likes - a.likes || b.timestamp - a.timestamp;
    return b.timestamp - a.timestamp;
  });

  return (
    <div style={{ marginTop: 32, padding: "0 0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 20, borderRadius: 2, background: "#6C63FF" }} />
          <MessageCircle size={16} color="#6C63FF" />
          <span style={{ color: "#F1F1F5", fontSize: 16, fontWeight: 800 }}>
            Comentarios <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 600 }}>({comments.length})</span>
          </span>
        </div>
        {comments.length > 1 && (
          <div style={{ display: "flex", background: "#13131C", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["new", "top"] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                style={{
                  padding: "6px 14px", background: sortBy === s ? "rgba(108,99,255,0.2)" : "transparent",
                  border: "none", color: sortBy === s ? "#A78BFA" : "rgba(255,255,255,0.4)",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                {s === "new" ? "Recientes" : "Populares"}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ background: "#13131C", borderRadius: 16, padding: 16, marginBottom: 20, border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Tu nombre o alias..."
            maxLength={30}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 10,
              background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)",
              color: "#F1F1F5", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
        <div style={{ position: "relative" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escribe un comentario..."
            maxLength={500}
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)",
              color: "#F1F1F5", fontSize: 13, outline: "none", fontFamily: "inherit",
              resize: "vertical", boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,0.4)")}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
          <span style={{ position: "absolute", bottom: 8, right: 10, color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{text.length}/500</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
            <div
              onClick={() => setIsSpoiler((v) => !v)}
              style={{
                width: 32, height: 18, borderRadius: 9,
                background: isSpoiler ? "#6C63FF" : "rgba(255,255,255,0.1)",
                position: "relative", cursor: "pointer", transition: "background 0.2s",
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 2, left: isSpoiler ? 16 : 2, transition: "left 0.2s",
              }} />
            </div>
            <span style={{ color: isSpoiler ? "#A78BFA" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600 }}>
              ⚠️ Spoiler
            </span>
          </label>
          <button
            type="submit"
            disabled={!text.trim() || !author.trim()}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10,
              background: text.trim() && author.trim() ? "linear-gradient(135deg,#6C63FF,#4F46E5)" : "rgba(255,255,255,0.07)",
              border: "none", color: text.trim() && author.trim() ? "#fff" : "rgba(255,255,255,0.25)",
              fontSize: 13, fontWeight: 700, cursor: text.trim() && author.trim() ? "pointer" : "not-allowed",
            }}
          >
            <Send size={13} /> Publicar
          </button>
        </div>
      </form>

      {sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <MessageCircle size={40} color="rgba(255,255,255,0.1)" style={{ margin: "0 auto 10px" }} />
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Sé el primero en comentar</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map((c) => {
          const isMine = c.author === (localStorage.getItem("animeflex_username") ?? "");
          const spoilerRevealed = revealedSpoilers.has(c.id);
          return (
            <div key={c.id} style={{ background: "#13131C", borderRadius: 14, padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: getAvatarColor(c.author),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 13, fontWeight: 900, flexShrink: 0,
                }}>
                  {c.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>{c.author}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
                    {new Date(c.timestamp).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
                {c.spoiler && (
                  <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "2px 7px", color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>
                    ⚠️ SPOILER
                  </span>
                )}
                {isMine && (
                  <button onClick={() => deleteComment(c.id)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
                    <Trash2 size={13} color="rgba(255,255,255,0.25)" />
                  </button>
                )}
              </div>
              {c.spoiler && !spoilerRevealed ? (
                <div
                  onClick={() => revealSpoiler(c.id)}
                  style={{
                    background: "rgba(245,158,11,0.08)", border: "1px dashed rgba(245,158,11,0.25)",
                    borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "center",
                    color: "#F59E0B", fontSize: 12, fontWeight: 600,
                  }}
                >
                  Toca para ver el spoiler
                </div>
              ) : (
                <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }}>{c.text}</p>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => toggleLike(c.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8,
                    background: c.likedByMe ? "rgba(108,99,255,0.15)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${c.likedByMe ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: c.likedByMe ? "#A78BFA" : "rgba(255,255,255,0.4)",
                    cursor: "pointer", fontSize: 12, fontWeight: 600,
                  }}
                >
                  <ThumbsUp size={11} fill={c.likedByMe ? "currentColor" : "none"} />
                  {c.likes > 0 && c.likes}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
