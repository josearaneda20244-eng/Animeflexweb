import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Crown, Tv2, CheckCircle2, Flame, Heart, BookOpen, ArrowLeft } from "lucide-react";
import { resolveAvatarUrl } from "@/lib/utils";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api") as string;

interface PublicUser {
  id: number;
  username: string;
  avatar_url: string | null;
  created_at: string;
  membership_tier: string;
}

interface AnimeItem {
  anime_id: string;
  anime_title: string;
  anime_image: string;
  anime_type: string;
  status?: string;
}

interface PublicProfileData {
  user: PublicUser;
  stats: {
    totalEpisodes: number;
    completed: number;
    streak: number;
  };
  favorites: AnimeItem[];
  watchlist: AnimeItem[];
}

export default function PublicProfile() {
  const params = useParams<{ userId: string }>();
  const [, navigate] = useLocation();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const userId = params.userId;
    if (!userId) { setError("ID de usuario inválido"); setLoading(false); return; }

    fetch(`${API_BASE}/user/public/${userId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Usuario no encontrado");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message ?? "Error al cargar perfil"))
      .finally(() => setLoading(false));
  }, [params.userId]);

  const cardStyle = {
    background: "#13131C",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: "18px 16px",
    marginBottom: 14,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <Navbar />
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "72px 16px 48px" }}>

        <button
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, padding: "8px 14px", color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", marginBottom: 20 }}
        >
          <ArrowLeft size={14} /> Inicio
        </button>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            Cargando perfil...
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎌</div>
            <div style={{ color: "#F1F1F5", fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Perfil no encontrado</div>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>{error}</div>
          </div>
        )}

        {data && (
          <>
            {/* Profile header */}
            <div style={{
              background: "linear-gradient(135deg,#13131C,#1a1a2e)",
              border: "1px solid rgba(108,99,255,0.15)", borderRadius: 20,
              padding: "24px", marginBottom: 16,
              display: "flex", alignItems: "center", gap: 18,
            }}>
              <div style={{
                width: 70, height: 70, borderRadius: 18, flexShrink: 0,
                background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 900, color: "#fff", overflow: "hidden",
                boxShadow: "0 4px 20px rgba(108,99,255,0.4)",
              }}>
                {resolveAvatarUrl(data.user.avatar_url)
                  ? <img src={resolveAvatarUrl(data.user.avatar_url)!} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : data.user.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 900 }}>{data.user.username}</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 3 }}>
                  Miembro desde {new Date(data.user.created_at).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                </div>
                <div style={{ marginTop: 8 }}>
                  {data.user.membership_tier === "megafan" ? (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)",
                      borderRadius: 20, padding: "4px 12px", color: "#F59E0B", fontSize: 12, fontWeight: 800,
                    }}>
                      <Crown size={11} /> MegaFan
                    </div>
                  ) : (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.25)",
                      borderRadius: 20, padding: "4px 12px", color: "#A78BFA", fontSize: 12, fontWeight: 800,
                    }}>
                      ✦ Gratuito
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[
                { icon: <Tv2 size={18} color="#6C63FF" />, label: "Episodios", value: data.stats.totalEpisodes },
                { icon: <CheckCircle2 size={18} color="#EC4899" />, label: "Completados", value: data.stats.completed },
                { icon: <Flame size={18} color="#F59E0B" />, label: "Racha", value: `${data.stats.streak}d` },
              ].map(({ icon, label, value }) => (
                <div key={label} style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>{icon}</div>
                  <div style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900 }}>{value}</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Watchlist */}
            {data.watchlist.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <BookOpen size={14} color="#6C63FF" />
                  <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Viendo / Completados</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))", gap: 8 }}>
                  {data.watchlist.map((a) => (
                    <div key={a.anime_id} style={{ position: "relative" }}>
                      <img src={a.anime_image} alt={a.anime_title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 8, display: "block" }} />
                      {a.status === "completed" && (
                        <div style={{ position: "absolute", top: 3, right: 3, background: "rgba(34,197,94,0.9)", borderRadius: "50%", width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <CheckCircle2 size={9} color="#fff" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Favorites */}
            {data.favorites.length > 0 && (
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Heart size={14} color="#EC4899" />
                  <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Favoritos</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(58px, 1fr))", gap: 8 }}>
                  {data.favorites.map((a) => (
                    <div key={a.anime_id}>
                      <img src={a.anime_image} alt={a.anime_title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 8, display: "block" }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.favorites.length === 0 && data.watchlist.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                Este usuario aún no tiene actividad pública
              </div>
            )}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}
