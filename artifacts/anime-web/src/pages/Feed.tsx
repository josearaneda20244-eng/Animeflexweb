import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { resolveAvatarUrl } from "@/lib/utils";
import { Rss, Tv2, CheckCircle2, Clock, Loader2, BookOpen, UserPlus } from "lucide-react";

interface FeedActivity {
  user_id: number;
  username: string;
  avatar_url: string | null;
  anime_id: string;
  anime_title: string;
  anime_image: string;
  status: string;
  activity_at: string;
}

const AVATAR_COLORS = ["#7C6FFF", "#EC4899", "#22C55E", "#F59E0B", "#8B5CF6", "#EF4444", "#8B5CF6"];
function getAvatarColor(name: string) {
  let hash = 0;
  for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function statusLabel(status: string): { text: string; color: string; icon: React.ReactNode } {
  switch (status) {
    case "watching":     return { text: "está viendo",      color: "#7C6FFF", icon: <Tv2 size={13} /> };
    case "completed":    return { text: "completó",         color: "#22C55E", icon: <CheckCircle2 size={13} /> };
    case "plan_to_watch":return { text: "quiere ver",       color: "#F59E0B", icon: <BookOpen size={13} /> };
    case "dropped":      return { text: "abandonó",         color: "#EF4444", icon: <Clock size={13} /> };
    default:             return { text: "actualizó",        color: "#B39DFF", icon: <Rss size={13} /> };
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "ahora mismo";
  if (mins < 60)  return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

export default function Feed() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    apiClient.get<{ activities: FeedActivity[] }>("/feed")
      .then((d) => setActivities(d.activities))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#070714" }}>
      <Navbar />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "72px 16px 48px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 4, height: 24, borderRadius: 2, background: "linear-gradient(180deg,#7C6FFF,#EC4899)" }} />
          <Rss size={20} color="#7C6FFF" />
          <h1 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, margin: 0 }}>Feed de actividad</h1>
        </div>

        {!token ? (
          <div style={{ background: "#100e22", borderRadius: 20, padding: "48px 24px", textAlign: "center", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
            <div style={{ color: "#F1F1F5", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Inicia sesión para ver el feed</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>
              Sigue a otros usuarios para ver su actividad aquí
            </div>
            <button
              onClick={() => navigate("/")}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: "linear-gradient(135deg,#7C6FFF,#5B52F5)", border: "none", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              Ir al inicio
            </button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <Loader2 size={28} color="rgba(124,111,255,0.5)" style={{ margin: "0 auto", animation: "spin 1s linear infinite" }} />
          </div>
        ) : activities.length === 0 ? (
          <div style={{ background: "#100e22", borderRadius: 20, padding: "48px 24px", textAlign: "center", border: "1px solid rgba(255,255,255,0.07)" }}>
            <UserPlus size={48} color="rgba(124,111,255,0.3)" style={{ margin: "0 auto 16px", display: "block" }} />
            <div style={{ color: "#F1F1F5", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Sin actividad reciente</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.7 }}>
              Sigue a otros usuarios desde sus perfiles<br />para ver su actividad aquí
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activities.map((a, i) => {
              const { text, color, icon } = statusLabel(a.status);
              return (
                <div key={`${a.user_id}-${a.anime_id}-${i}`}
                  style={{ background: "#100e22", borderRadius: 14, padding: 14, border: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}
                  onClick={() => navigate(`/anime/${a.anime_id}`)}>

                  {/* Anime cover */}
                  <div style={{ flexShrink: 0, position: "relative" }}>
                    <img
                      src={a.anime_image}
                      alt={a.anime_title}
                      style={{ width: 52, height: 72, objectFit: "cover", borderRadius: 8, display: "block" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        background: getAvatarColor(a.username),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 12, fontWeight: 900, overflow: "hidden",
                      }}>
                        {resolveAvatarUrl(a.avatar_url)
                          ? <img src={resolveAvatarUrl(a.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                          : a.username.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{ color: "#B39DFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); navigate(`/profile/${a.user_id}`); }}>
                          {a.username}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}> {text} </span>
                      </div>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, flexShrink: 0 }}>
                        {timeAgo(a.activity_at)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ color, display: "flex", alignItems: "center" }}>{icon}</div>
                      <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {a.anime_title}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
