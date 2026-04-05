import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Send, Heart, Trash2, Loader2, Reply, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { resolveAvatarUrl } from "@/lib/utils";

interface Comment {
  id: string;
  author: string;
  avatar_url: string | null;
  text: string;
  created_at: string;
  likes: number;
  likedByMe: boolean;
  spoiler: boolean;
  parent_id: string | null;
  reply_count: number;
}

const AVATAR_COLORS = ["#6C63FF", "#EC4899", "#22C55E", "#F59E0B", "#06B6D4", "#EF4444", "#8B5CF6"];

function getAvatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ username, avatar_url, size = 32 }: { username: string; avatar_url: string | null; size?: number }) {
  const resolved = resolveAvatarUrl(avatar_url);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: getAvatarColor(username),
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size * 0.4, fontWeight: 900, overflow: "hidden",
    }}>
      {resolved
        ? <img src={resolved} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        : username.charAt(0).toUpperCase()}
    </div>
  );
}

function ReplyThread({ animeId, parentId, parentAuthor, onClose }: {
  animeId: string;
  parentId: string;
  parentAuthor: string;
  onClose: () => void;
}) {
  const { user, token } = useAuth();
  const [replies, setReplies] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState(`@${parentAuthor} `);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiClient.get<Comment[]>(`/comments/${animeId}/replies/${parentId}`)
      .then((rows) => setReplies(rows))
      .catch(() => setReplies([]))
      .finally(() => setLoading(false));
  }, [animeId, parentId]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !user || posting) return;
    setPosting(true);
    setError(null);
    try {
      const newReply = await apiClient.post<Comment>(`/comments/${animeId}`, {
        text: replyText.trim(),
        parentId: parseInt(parentId, 10),
      });
      setReplies((prev) => [...prev, { ...newReply, likedByMe: false }]);
      setReplyText("");
    } catch (err: any) {
      setError(err.message ?? "Error al publicar respuesta");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (id: string) => {
    if (!token) return;
    const reply = replies.find((r) => r.id === id);
    if (!reply) return;
    setReplies((prev) => prev.map((r) =>
      r.id !== id ? r : { ...r, likes: r.likedByMe ? r.likes - 1 : r.likes + 1, likedByMe: !r.likedByMe }
    ));
    try {
      if (reply.likedByMe) {
        await apiClient.delete(`/comments/${animeId}/${id}/like`);
      } else {
        await apiClient.post(`/comments/${animeId}/${id}/like`, {});
      }
    } catch { /* noop */ }
  };

  const deleteReply = async (id: string) => {
    try {
      await apiClient.delete(`/comments/${animeId}/${id}`);
      setReplies((prev) => prev.filter((r) => r.id !== id));
    } catch { /* noop */ }
  };

  return (
    <div style={{ marginTop: 8, marginLeft: 40, borderLeft: "2px solid rgba(108,99,255,0.2)", paddingLeft: 12 }}>
      {loading ? (
        <div style={{ padding: "8px 0" }}>
          <Loader2 size={14} color="rgba(108,99,255,0.5)" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {replies.map((r) => {
            const isMine = user?.username === r.author;
            const spoilerRevealed = revealedSpoilers.has(r.id);
            return (
              <div key={r.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Avatar username={r.author} avatar_url={r.avatar_url} size={26} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: "#F1F1F5", fontSize: 12, fontWeight: 700 }}>{r.author}</span>
                    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, marginLeft: 6 }}>
                      {new Date(r.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                  {isMine && (
                    <button onClick={() => deleteReply(r.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      <Trash2 size={11} color="rgba(255,255,255,0.2)" />
                    </button>
                  )}
                </div>
                {r.spoiler && !spoilerRevealed ? (
                  <div onClick={() => setRevealedSpoilers((p) => new Set([...p, r.id]))}
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px dashed rgba(245,158,11,0.25)", borderRadius: 6, padding: "6px 10px", cursor: "pointer", textAlign: "center", color: "#F59E0B", fontSize: 11 }}>
                    Ver spoiler
                  </div>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, lineHeight: 1.5, margin: "0 0 6px" }}>{r.text}</p>
                )}
                <button onClick={() => toggleLike(r.id)} disabled={!token}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: r.likedByMe ? "rgba(236,72,153,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${r.likedByMe ? "rgba(236,72,153,0.3)" : "rgba(255,255,255,0.07)"}`, color: r.likedByMe ? "#EC4899" : "rgba(255,255,255,0.35)", cursor: token ? "pointer" : "default", fontSize: 11, fontWeight: 600 }}>
                  <Heart size={10} fill={r.likedByMe ? "currentColor" : "none"} />
                  {r.likes > 0 && r.likes}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {user ? (
        <form onSubmit={handleReply} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <Avatar username={user.username} avatar_url={user.avatar_url} size={26} />
          <div style={{ flex: 1 }}>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Responder a @${parentAuthor}...`}
              maxLength={500}
              rows={2}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F1F5", fontSize: 12, outline: "none", fontFamily: "inherit", resize: "none", boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
            {error && <div style={{ color: "#EF4444", fontSize: 11, marginTop: 3 }}>{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 5 }}>
              <button type="button" onClick={onClose}
                style={{ padding: "5px 10px", borderRadius: 7, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontSize: 11, cursor: "pointer" }}>
                Cancelar
              </button>
              <button type="submit" disabled={!replyText.trim() || posting}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7, background: replyText.trim() && !posting ? "linear-gradient(135deg,#6C63FF,#4F46E5)" : "rgba(255,255,255,0.07)", border: "none", color: replyText.trim() && !posting ? "#fff" : "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: 700, cursor: replyText.trim() && !posting ? "pointer" : "not-allowed" }}>
                {posting ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={11} />}
                {posting ? "..." : "Responder"}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, padding: "4px 0" }}>
          Inicia sesión para responder
        </div>
      )}
    </div>
  );
}

export default function CommentsSection({ animeId }: { animeId: string }) {
  const { user, token } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [text, setText] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"new" | "top">("new");
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await apiClient.get<Comment[]>(`/comments/${animeId}`);
      setComments(rows);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [animeId]);

  useEffect(() => {
    fetchComments();
    setRevealedSpoilers(new Set());
    setReplyingTo(null);
    setExpandedReplies(new Set());
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || posting) return;
    setPosting(true);
    setError(null);
    try {
      const newComment = await apiClient.post<Comment>(`/comments/${animeId}`, {
        text: text.trim(),
        spoiler: isSpoiler,
      });
      setComments((prev) => [{ ...newComment, likedByMe: false }, ...prev]);
      setText("");
      setIsSpoiler(false);
    } catch (err: any) {
      setError(err.message ?? "Error al publicar el comentario");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (id: string) => {
    if (!token) return;
    const comment = comments.find((c) => c.id === id);
    if (!comment) return;
    setComments((prev) =>
      prev.map((c) => c.id !== id ? c : { ...c, likes: c.likedByMe ? c.likes - 1 : c.likes + 1, likedByMe: !c.likedByMe })
    );
    try {
      if (comment.likedByMe) {
        await apiClient.delete(`/comments/${animeId}/${id}/like`);
      } else {
        await apiClient.post(`/comments/${animeId}/${id}/like`, {});
      }
    } catch {
      await fetchComments();
    }
  };

  const deleteComment = async (id: string) => {
    try {
      await apiClient.delete(`/comments/${animeId}/${id}`);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.message ?? "Error al eliminar el comentario");
    }
  };

  const toggleReplies = (id: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const sorted = [...comments].sort((a, b) => {
    if (sortBy === "top") return b.likes - a.likes || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
                style={{ padding: "6px 14px", background: sortBy === s ? "rgba(108,99,255,0.2)" : "transparent", border: "none", color: sortBy === s ? "#A78BFA" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {s === "new" ? "Recientes" : "Populares"}
              </button>
            ))}
          </div>
        )}
      </div>

      {user ? (
        <form onSubmit={handleSubmit} style={{ background: "#13131C", borderRadius: 16, padding: 16, marginBottom: 20, border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Avatar username={user.username} avatar_url={user.avatar_url} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{user.username}</span>
          </div>
          <div style={{ position: "relative" }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe un comentario..."
              maxLength={500}
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", color: "#F1F1F5", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(108,99,255,0.4)")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
            <span style={{ position: "absolute", bottom: 8, right: 10, color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{text.length}/500</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
              <div onClick={() => setIsSpoiler((v) => !v)}
                style={{ width: 32, height: 18, borderRadius: 9, background: isSpoiler ? "#6C63FF" : "rgba(255,255,255,0.1)", position: "relative", cursor: "pointer", transition: "background 0.2s" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: isSpoiler ? 16 : 2, transition: "left 0.2s" }} />
              </div>
              <span style={{ color: isSpoiler ? "#A78BFA" : "rgba(255,255,255,0.4)", fontSize: 12, fontWeight: 600 }}>Spoiler</span>
            </label>
            <button type="submit" disabled={!text.trim() || posting}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: text.trim() && !posting ? "linear-gradient(135deg,#6C63FF,#4F46E5)" : "rgba(255,255,255,0.07)", border: "none", color: text.trim() && !posting ? "#fff" : "rgba(255,255,255,0.25)", fontSize: 13, fontWeight: 700, cursor: text.trim() && !posting ? "pointer" : "not-allowed" }}>
              {posting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={13} />}
              {posting ? "Publicando..." : "Publicar"}
            </button>
          </div>
          {error && <div style={{ marginTop: 8, color: "#EF4444", fontSize: 12 }}>{error}</div>}
        </form>
      ) : (
        <div style={{ background: "#13131C", borderRadius: 16, padding: 16, marginBottom: 20, border: "1px solid rgba(255,255,255,0.07)", textAlign: "center", color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
          Inicia sesión para dejar un comentario
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <Loader2 size={24} color="rgba(108,99,255,0.5)" style={{ margin: "0 auto", animation: "spin 1s linear infinite" }} />
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <MessageCircle size={40} color="rgba(255,255,255,0.1)" style={{ margin: "0 auto 10px" }} />
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Sé el primero en comentar</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((c) => {
            const isMine = user?.username === c.author;
            const spoilerRevealed = revealedSpoilers.has(c.id);
            const repliesExpanded = expandedReplies.has(c.id);
            const isReplying = replyingTo === c.id;
            return (
              <div key={c.id} style={{ background: "#13131C", borderRadius: 14, padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <Avatar username={c.author} avatar_url={c.avatar_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>{c.author}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>
                      {new Date(c.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </div>
                  {c.spoiler && (
                    <span style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "2px 7px", color: "#F59E0B", fontSize: 10, fontWeight: 700 }}>SPOILER</span>
                  )}
                  {isMine && (
                    <button onClick={() => deleteComment(c.id)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
                      <Trash2 size={13} color="rgba(255,255,255,0.25)" />
                    </button>
                  )}
                </div>

                {c.spoiler && !spoilerRevealed ? (
                  <div onClick={() => setRevealedSpoilers((prev) => new Set([...prev, c.id]))}
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px dashed rgba(245,158,11,0.25)", borderRadius: 8, padding: "10px 14px", cursor: "pointer", textAlign: "center", color: "#F59E0B", fontSize: 12, fontWeight: 600 }}>
                    Toca para ver el spoiler
                  </div>
                ) : (
                  <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }}>{c.text}</p>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <button onClick={() => toggleLike(c.id)} disabled={!token}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: c.likedByMe ? "rgba(236,72,153,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${c.likedByMe ? "rgba(236,72,153,0.3)" : "rgba(255,255,255,0.08)"}`, color: c.likedByMe ? "#EC4899" : "rgba(255,255,255,0.4)", cursor: token ? "pointer" : "default", fontSize: 12, fontWeight: 600 }}>
                    <Heart size={11} fill={c.likedByMe ? "currentColor" : "none"} />
                    {c.likes > 0 && c.likes}
                  </button>

                  {token && (
                    <button onClick={() => { setReplyingTo(isReplying ? null : c.id); if (!repliesExpanded && !isReplying) setExpandedReplies((p) => new Set([...p, c.id])); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: isReplying ? "rgba(108,99,255,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${isReplying ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.08)"}`, color: isReplying ? "#A78BFA" : "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      <Reply size={11} />
                      Responder
                    </button>
                  )}

                  {c.reply_count > 0 && (
                    <button onClick={() => toggleReplies(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, background: repliesExpanded ? "rgba(108,99,255,0.08)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                      {repliesExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      {repliesExpanded ? "Ocultar" : `${c.reply_count} respuesta${c.reply_count > 1 ? "s" : ""}`}
                    </button>
                  )}
                </div>

                {(repliesExpanded || isReplying) && (
                  <ReplyThread
                    animeId={animeId}
                    parentId={c.id}
                    parentAuthor={c.author}
                    onClose={() => { setReplyingTo(null); setExpandedReplies((p) => { const n = new Set(p); n.delete(c.id); return n; }); }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
