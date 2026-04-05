import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import {
  LayoutDashboard, Users, Shield, Settings, Film,
  TrendingUp, Crown, Eye, EyeOff, Star, Ban,
  Search, ChevronDown, Check, X, AlertTriangle,
  ToggleLeft, ToggleRight, Menu, ArrowLeft,
  Trash2, UserCheck, UserX, Loader2, Activity,
  Zap, BarChart2, ArrowUpRight, MessageSquare,
  DollarSign, UserMinus, Megaphone, Download,
  Radio, Hash, Plus, Info,
  Send, CreditCard, Mail, CalendarRange, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ── Types ── */
interface AdminUser {
  id: number; username: string; email: string; avatar_url: string | null;
  role: "user" | "admin" | "owner"; membership_tier: "free" | "megafan";
  is_active: boolean; created_at: string;
}
interface AdminStats {
  totalUsers: number; megafanUsers: number; episodesToday: number; newUsersWeek: number;
  totalComments: number; inactiveUsers: number; newUsersToday: number; totalRevenue: number;
  activeUsers: number; totalRatings: number;
  topAnime: { anime_id: string; anime_title: string; anime_image: string; views: string }[];
  recentUsers: { id: number; username: string; email: string; membership_tier: string; role: string; created_at: string }[];
  megafanList: { id: number; username: string; email: string; created_at: string; subscription_expires_at: string | null }[];
  recentActivity: { username: string; anime_title: string; episode_num: number; updated_at: string }[];
  growthChart: { day: string; count: string }[];
  searchTrends: { query: string; count: number }[];
}
interface Announcement {
  id: number; message: string; type: string; active: boolean; created_at: string;
}
interface ContentItem {
  id: number; anime_id: string; anime_title: string; anime_image: string;
  action: "hidden" | "featured" | "blocked"; created_at: string;
}
interface AdminComment {
  id: number; text: string; spoiler: boolean; likes: number;
  created_at: string; anime_id: string; author: string; user_id: number;
}
type Section = "dashboard" | "users" | "content" | "comments" | "monetization" | "transactions" | "emails" | "config";

/* ── Toast ── */
function Toast({ msg, type, onClose }: { msg: string; type: "ok" | "err"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: type === "ok" ? "#16A34A" : "#DC2626",
      color: "#fff", borderRadius: 12, padding: "12px 20px",
      fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 10,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)", animation: "slideIn 0.2s ease",
    }}>
      {type === "ok" ? <Check size={16} /> : <X size={16} />}
      {msg}
    </div>
  );
}

/* ── Confirm Dialog ── */
function Confirm({ msg, onOk, onCancel }: { msg: string; onOk: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#1a1a2e", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 20, padding: 28, maxWidth: 360, width: "90%", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <AlertTriangle size={20} color="#F59E0B" />
          <span style={{ color: "#F1F1F5", fontWeight: 800, fontSize: 16 }}>Confirmar acción</span>
        </div>
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>{msg}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onOk} style={{ flex: 1, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", border: "none", borderRadius: 10, padding: "10px 0", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>Confirmar</button>
          <button onClick={onCancel} style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 0", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Animated Counter ── */
function Counter({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let start = 0;
    const step = Math.ceil(target / 40);
    const t = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(t);
    }, 18);
    return () => clearInterval(t);
  }, [target]);
  return <>{val.toLocaleString()}</>;
}

/* ── Announcements Manager (embedded in dashboard) ── */
function AnnouncementsManager({ toast }: { toast: (m: string, t: "ok" | "err") => void }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [msg, setMsg] = useState("");
  const [type, setType] = useState<"info" | "warning" | "success">("info");
  const [loading, setLoading] = useState(false);

  const load = () => {
    apiClient.get<{ announcements: Announcement[] }>("/announcements")
      .then(d => setAnnouncements(d.announcements))
      .catch(() => {});
  };
  useEffect(load, []);

  const send = async () => {
    if (!msg.trim()) return;
    setLoading(true);
    try {
      await apiClient.post("/admin/announcements", { message: msg.trim(), type });
      setMsg("");
      load();
      toast("Anuncio enviado", "ok");
    } catch { toast("Error al enviar anuncio", "err"); }
    finally { setLoading(false); }
  };

  const remove = async (id: number) => {
    try {
      await apiClient.delete(`/admin/announcements/${id}`);
      load();
      toast("Anuncio eliminado", "ok");
    } catch { toast("Error al eliminar", "err"); }
  };

  const TYPE_COLORS: Record<string, string> = { info: "#06B6D4", warning: "#F59E0B", success: "#22C55E" };

  return (
    <div style={{ background: "#13131C", border: "1px solid rgba(108,99,255,0.15)", borderRadius: 18, padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Megaphone size={14} color="#A78BFA" />
        </div>
        <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Anuncios a usuarios</span>
      </div>

      {/* New announcement form */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Escribe un anuncio para todos los usuarios..."
          style={{ flex: 1, minWidth: 200, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 14px", color: "#F1F1F5", fontSize: 13, outline: "none", fontFamily: "inherit" }}
          onKeyDown={e => e.key === "Enter" && send()}
        />
        <select
          value={type}
          onChange={e => setType(e.target.value as any)}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#F1F1F5", fontSize: 13, cursor: "pointer", outline: "none", fontFamily: "inherit" }}
        >
          <option value="info">ℹ️ Info</option>
          <option value="warning">⚠️ Aviso</option>
          <option value="success">✅ Éxito</option>
        </select>
        <button
          onClick={send} disabled={loading || !msg.trim()}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", opacity: loading || !msg.trim() ? 0.5 : 1 }}
        >
          {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={14} />}
          Enviar
        </button>
      </div>

      {/* Active announcements list */}
      {announcements.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>Sin anuncios activos</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {announcements.map(a => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, background: `${TYPE_COLORS[a.type] ?? "#6C63FF"}10`, border: `1px solid ${TYPE_COLORS[a.type] ?? "#6C63FF"}28`, borderRadius: 10, padding: "10px 14px" }}>
              <Info size={14} color={TYPE_COLORS[a.type] ?? "#6C63FF"} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, color: "#F1F1F5", fontSize: 13 }}>{a.message}</span>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, flexShrink: 0 }}>
                {new Date(a.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
              </span>
              <button
                onClick={() => remove(a.id)}
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "4px 8px", color: "#F87171", cursor: "pointer", display: "flex", alignItems: "center" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard Section ── */
function DashboardSection({ toast, user, onNavigate }: { toast: (m: string, t: "ok" | "err") => void; user: { username: string }; onNavigate: (s: Section) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiClient.get<AdminStats>("/admin/stats")
      .then(setStats)
      .catch(() => toast("Error al cargar estadísticas", "err"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const now = new Date();
  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 16 }}>
      <Loader2 size={32} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Cargando estadísticas...</span>
    </div>
  );

  const conversionRate = stats && stats.totalUsers > 0
    ? ((stats.megafanUsers / stats.totalUsers) * 100).toFixed(1)
    : "0.0";
  const estimatedRevenue = (stats?.megafanUsers ?? 0) * 4;
  const maxViews = stats?.topAnime[0] ? parseInt(stats.topAnime[0].views) : 1;

  const CARDS = [
    {
      label: "Usuarios totales", value: stats?.totalUsers ?? 0,
      sub: `+${stats?.newUsersToday ?? 0} hoy`,
      icon: <Users size={20} />, color: "#6C63FF",
      gradient: "linear-gradient(135deg,rgba(108,99,255,0.15),rgba(108,99,255,0.04))",
      border: "rgba(108,99,255,0.25)",
    },
    {
      label: "Usuarios MegaFan", value: stats?.megafanUsers ?? 0,
      sub: `${conversionRate}% conversión`,
      icon: <Crown size={20} />, color: "#F59E0B",
      gradient: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.04))",
      border: "rgba(245,158,11,0.25)",
    },
    {
      label: "Episodios vistos hoy", value: stats?.episodesToday ?? 0,
      sub: "últimas 24 h",
      icon: <Eye size={20} />, color: "#22C55E",
      gradient: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.04))",
      border: "rgba(34,197,94,0.25)",
    },
    {
      label: "Nuevos esta semana", value: stats?.newUsersWeek ?? 0,
      sub: "últimos 7 días",
      icon: <TrendingUp size={20} />, color: "#06B6D4",
      gradient: "linear-gradient(135deg,rgba(6,182,212,0.15),rgba(6,182,212,0.04))",
      border: "rgba(6,182,212,0.25)",
    },
    {
      label: "Comentarios totales", value: stats?.totalComments ?? 0,
      sub: "en toda la plataforma",
      icon: <MessageSquare size={20} />, color: "#8B5CF6",
      gradient: "linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.04))",
      border: "rgba(139,92,246,0.25)",
    },
    {
      label: "Ingresos estimados", value: estimatedRevenue,
      sub: `${stats?.megafanUsers ?? 0} suscriptores × $4`,
      icon: <DollarSign size={20} />, color: "#10B981",
      gradient: "linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.04))",
      border: "rgba(16,185,129,0.25)",
      prefix: "$",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 4, textTransform: "capitalize" }}>{dateStr}</div>
          <h2 style={{ color: "#F1F1F5", fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
            Hola, <span style={{ color: "#A78BFA" }}>{user.username}</span>
          </h2>
          <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, marginTop: 4 }}>Aquí está el resumen de tu plataforma</div>
        </div>
        <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.25)", borderRadius: 10, padding: "8px 14px", color: "#A78BFA", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
          <Activity size={14} /> Actualizar
        </button>
      </div>

      {/* Alert: inactive users */}
      {(stats?.inactiveUsers ?? 0) > 0 && (
        <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <UserMinus size={16} color="#DC2626" />
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
            Hay <strong style={{ color: "#F87171" }}>{stats?.inactiveUsers}</strong> cuenta(s) desactivada(s)
          </span>
          <button onClick={() => onNavigate("users")} style={{ marginLeft: "auto", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "5px 12px", color: "#F87171", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
            Ver usuarios
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {CARDS.map(c => (
          <div key={c.label} style={{ background: c.gradient, border: `1px solid ${c.border}`, borderRadius: 18, padding: "20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -16, right: -16, width: 64, height: 64, borderRadius: "50%", background: `${c.color}10` }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: `${c.color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>
                {c.icon}
              </div>
              <ArrowUpRight size={15} color={`${c.color}70`} />
            </div>
            <div style={{ color: "#F1F1F5", fontSize: 32, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
              {c.prefix ?? ""}<Counter target={c.value} />
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 700, marginTop: 6 }}>{c.label}</div>
            <div style={{ color: c.color, fontSize: 11, marginTop: 3, fontWeight: 600 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Conversion + Health row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Zap size={15} color="#F59E0B" />
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Tasa de conversión</span>
          </div>
          <div style={{ color: "#F59E0B", fontSize: 38, fontWeight: 900, letterSpacing: -1, marginBottom: 6 }}>{conversionRate}%</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginBottom: 12 }}>Free → MegaFan</div>
          <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(parseFloat(conversionRate), 100)}%`, background: "linear-gradient(90deg,#F59E0B,#FCD34D)", borderRadius: 99, transition: "width 1s ease" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>0%</span>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>100%</span>
          </div>
        </div>

        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <BarChart2 size={15} color="#22C55E" />
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Estado de la plataforma</span>
          </div>
          {[
            { label: "Ratio premium", pct: Math.min(100, parseFloat(conversionRate)), color: "#F59E0B" },
            { label: "Actividad (ep. hoy / 200)", pct: Math.min(100, ((stats?.episodesToday ?? 0) / 200) * 100), color: "#22C55E" },
            { label: "Cuentas activas", pct: stats?.totalUsers ? Math.max(0, 100 - ((stats.inactiveUsers ?? 0) / stats.totalUsers) * 100) : 100, color: "#6C63FF" },
          ].map(row => (
            <div key={row.label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{row.label}</span>
                <span style={{ color: row.color, fontSize: 12, fontWeight: 700 }}>{row.pct.toFixed(0)}%</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${row.pct}%`, background: row.color, borderRadius: 99, transition: "width 1s ease", opacity: 0.85 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Anime Chart */}
      {stats?.topAnime && stats.topAnime.length > 0 && (
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "22px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={16} color="#6C63FF" />
              </div>
              <span style={{ color: "#F1F1F5", fontSize: 15, fontWeight: 800 }}>Animes más vistos</span>
            </div>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>Top {stats.topAnime.length}</span>
          </div>
          {(() => {
            const BAR_COLORS = ["#6C63FF", "#A78BFA", "#22C55E", "#06B6D4", "#F59E0B"];
            return stats.topAnime.map((a, i) => {
              const pct = (parseInt(a.views) / maxViews) * 100;
              return (
                <div key={a.anime_id} style={{ marginBottom: i < stats.topAnime.length - 1 ? 16 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: `${BAR_COLORS[i]}22`, color: BAR_COLORS[i], fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    {a.anime_image && (
                      <img src={a.anime_image} alt={a.anime_title} style={{ width: 28, height: 38, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                    )}
                    <span style={{ flex: 1, color: "#F1F1F5", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.anime_title || a.anime_id}
                    </span>
                    <span style={{ color: BAR_COLORS[i], fontSize: 13, fontWeight: 800, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                      <Eye size={12} /> {parseInt(a.views).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 99, overflow: "hidden", marginLeft: 34 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${BAR_COLORS[i]},${BAR_COLORS[i]}88)`, borderRadius: 99, transition: "width 1.2s ease" }} />
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ background: "linear-gradient(135deg,rgba(108,99,255,0.08),rgba(79,70,229,0.04))", border: "1px solid rgba(108,99,255,0.15)", borderRadius: 18, padding: "20px" }}>
        <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={15} color="#A78BFA" /> Accesos rápidos
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[
            { label: "Ver usuarios", icon: <Users size={14} />, color: "#6C63FF", section: "users" as Section },
            { label: "Contenido", icon: <Film size={14} />, color: "#22C55E", section: "content" as Section },
            { label: "Comentarios", icon: <MessageSquare size={14} />, color: "#8B5CF6", section: "comments" as Section },
            { label: "Monetización", icon: <Crown size={14} />, color: "#F59E0B", section: "monetization" as Section },
            { label: "Configuración", icon: <Settings size={14} />, color: "#06B6D4", section: "config" as Section },
          ].map(q => (
            <button key={q.label} onClick={() => onNavigate(q.section)} style={{ display: "flex", alignItems: "center", gap: 7, background: `${q.color}14`, border: `1px solid ${q.color}30`, borderRadius: 10, padding: "9px 14px", color: q.color, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
              {q.icon} {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent users + MegaFan list */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

        {/* Recent registrations */}
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <UserCheck size={14} color="#6C63FF" />
              </div>
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Últimos registros</span>
            </div>
            <button onClick={() => onNavigate("users")} style={{ background: "none", border: "none", color: "rgba(108,99,255,0.7)", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Ver todos →</button>
          </div>
          {(stats?.recentUsers ?? []).length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Sin usuarios aún</div>
          ) : (stats?.recentUsers ?? []).map((u, i) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < (stats!.recentUsers.length - 1) ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: u.membership_tier === "megafan" ? "linear-gradient(135deg,#F59E0B,#D97706)" : "linear-gradient(135deg,#6C63FF,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                {u.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                  {u.username}
                  {u.membership_tier === "megafan" && <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", borderRadius: 4, padding: "1px 5px", fontSize: 9, fontWeight: 900 }}>👑</span>}
                  {u.role === "owner" && <span style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", borderRadius: 4, padding: "1px 5px", fontSize: 9, fontWeight: 900 }}>OWNER</span>}
                  {u.role === "admin" && <span style={{ background: "rgba(108,99,255,0.15)", color: "#A78BFA", borderRadius: 4, padding: "1px 5px", fontSize: 9, fontWeight: 900 }}>ADMIN</span>}
                </div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{u.email}</div>
              </div>
              <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, textAlign: "right", flexShrink: 0 }}>
                {new Date(u.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
              </div>
            </div>
          ))}
        </div>

        {/* MegaFan subscribers */}
        <div style={{ background: "#13131C", border: "1px solid rgba(245,158,11,0.12)", borderRadius: 18, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Crown size={14} color="#F59E0B" />
              </div>
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Suscriptores MegaFan</span>
            </div>
            <span style={{ background: "rgba(245,158,11,0.12)", color: "#F59E0B", borderRadius: 20, padding: "2px 10px", fontSize: 12, fontWeight: 800 }}>
              ${(stats?.megafanUsers ?? 0) * 4}/mes
            </span>
          </div>
          {(stats?.megafanList ?? []).length === 0 ? (
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, textAlign: "center", padding: "16px 0" }}>Sin suscriptores aún</div>
          ) : (stats?.megafanList ?? []).map((u, i) => (
            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < (stats!.megafanList.length - 1) ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#F59E0B,#D97706)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
                {u.username.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>{u.username}</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{u.email}</div>
              </div>
              <div style={{ color: "#F59E0B", fontSize: 10, fontWeight: 700, textAlign: "right", flexShrink: 0 }}>
                <div>$4/mes</div>
                <div style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>
                  {new Date(u.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Growth Chart + Active Users */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "stretch" }}>
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={14} color="#6C63FF" />
              </div>
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Crecimiento de usuarios (30 días)</span>
            </div>
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem("af_token");
                  const api = import.meta.env.VITE_API_BASE_URL ?? "/api";
                  const res = await fetch(`${api}/admin/export/users`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                  });
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `usuarios_${Date.now()}.csv`;
                  document.body.appendChild(a); a.click();
                  document.body.removeChild(a); URL.revokeObjectURL(url);
                } catch {}
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 9, padding: "7px 12px", color: "#22C55E", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <Download size={13} /> Exportar CSV
            </button>
          </div>
          {(stats?.growthChart ?? []).length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={(stats?.growthChart ?? []).map(d => ({ day: d.day, Usuarios: parseInt(d.count) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 10, color: "#F1F1F5", fontSize: 12 }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Line type="monotone" dataKey="Usuarios" stroke="#6C63FF" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#6C63FF", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 13 }}>Sin datos de crecimiento aún</span>
            </div>
          )}
        </div>
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px", minWidth: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Radio size={22} color="#22C55E" />
          </div>
          <div style={{ color: "#22C55E", fontSize: 38, fontWeight: 900, letterSpacing: -2 }}>{stats?.activeUsers ?? 0}</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 700, textAlign: "center" }}>Usuarios activos</div>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center" }}>últimos 30 min</div>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E", animation: "pulse 2s infinite" }} />
        </div>
      </div>

      {/* Search Trends */}
      {(stats?.searchTrends ?? []).length > 0 && (
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(6,182,212,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Hash size={14} color="#06B6D4" />
            </div>
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Búsquedas populares</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(stats?.searchTrends ?? []).map((t, i) => (
              <div key={t.query} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(6,182,212,0.07)", border: "1px solid rgba(6,182,212,0.15)", borderRadius: 20, padding: "5px 12px" }}>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, fontWeight: 900 }}>#{i + 1}</span>
                <span style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 600 }}>{t.query}</span>
                <span style={{ color: "#06B6D4", fontSize: 11, fontWeight: 800 }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Announcements Manager */}
      <AnnouncementsManager toast={toast} />

      {/* Recent activity */}
      {(stats?.recentActivity ?? []).length > 0 && (
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={14} color="#22C55E" />
            </div>
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Actividad reciente</span>
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 12, marginLeft: "auto" }}>Últimos episodios vistos</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {(stats?.recentActivity ?? []).map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < (stats!.recentActivity.length - 1) ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", flexShrink: 0, boxShadow: "0 0 6px #22C55E" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: "#A78BFA", fontWeight: 700, fontSize: 13 }}>{a.username}</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}> vio </span>
                  <span style={{ color: "#F1F1F5", fontWeight: 600, fontSize: 13 }}>{a.anime_title || "un anime"}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}> ep. {a.episode_num}</span>
                </div>
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, flexShrink: 0 }}>
                  {new Date(a.updated_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Users Section ── */
function UsersSection({ toast, confirm }: { toast: (m: string, t: "ok" | "err") => void; confirm: (m: string, cb: () => void) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [expanding, setExpanding] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "megafan" | "free" | "inactive">("all");

  const load = useCallback(async (query = q, pg = page, f = filter) => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ users: AdminUser[]; total: number }>(
        `/admin/users?q=${encodeURIComponent(query)}&page=${pg}&limit=15&filter=${f}`
      );
      setUsers(data.users); setTotal(data.total);
    } catch { toast("Error al cargar usuarios", "err"); }
    finally { setLoading(false); }
  }, [q, page, filter]);

  useEffect(() => { load(); }, []);

  const update = async (id: number, patch: Partial<AdminUser>) => {
    try {
      await apiClient.patch<{ user: AdminUser }>(`/admin/users/${id}`, patch);
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
      toast("Usuario actualizado", "ok");
    } catch { toast("Error al actualizar", "err"); }
  };

  const roleColor: Record<string, string> = { owner: "#F59E0B", admin: "#6C63FF", user: "rgba(255,255,255,0.4)" };
  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "megafan", label: "MegaFan" },
    { key: "free", label: "Gratuitos" },
    { key: "inactive", label: "Inactivos" },
  ];

  return (
    <div>
      <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 16 }}>Gestión de Usuarios</h2>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#13131C", borderRadius: 12, padding: 6, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); load(q, 1, f.key); }}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: filter === f.key ? "rgba(108,99,255,0.2)" : "transparent",
              color: filter === f.key ? "#A78BFA" : "rgba(255,255,255,0.45)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={15} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setPage(1); load(q, 1, filter); } }}
            placeholder="Buscar por nombre o email..."
            style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px 10px 36px", color: "#F1F1F5", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={() => { setPage(1); load(q, 1, filter); }} style={{ background: "#6C63FF", border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Buscar</button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : (
        <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
          {users.length === 0
            ? <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No se encontraron usuarios</div>
            : users.map((u, i) => (
              <div key={u.id} style={{ padding: "14px 16px", borderBottom: i < users.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 16, flexShrink: 0, overflow: "hidden" }}>
                    {u.avatar_url ? <img src={u.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                      {u.username}
                      {!u.is_active && <span style={{ background: "#DC262620", color: "#DC2626", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>INACTIVO</span>}
                      {u.membership_tier === "megafan" && <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>MEGAFAN</span>}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{u.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ color: roleColor[u.role] ?? "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 800, background: `${roleColor[u.role]}18`, borderRadius: 6, padding: "3px 8px" }}>{u.role.toUpperCase()}</span>
                    <button onClick={() => setExpanding(expanding === u.id ? null : u.id)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center" }}>
                      <ChevronDown size={14} style={{ transform: expanding === u.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </button>
                  </div>
                </div>
                {expanding === u.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={u.role} onChange={e => confirm(`¿Cambiar rol de ${u.username} a ${e.target.value}?`, () => update(u.id, { role: e.target.value as AdminUser["role"] }))}
                      style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", color: "#F1F1F5", fontSize: 13, cursor: "pointer" }}>
                      <option value="user">Rol: User</option>
                      <option value="admin">Rol: Admin</option>
                      <option value="owner">Rol: Owner</option>
                    </select>
                    <select value={u.membership_tier} onChange={e => update(u.id, { membership_tier: e.target.value as AdminUser["membership_tier"] })}
                      style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", color: "#F1F1F5", fontSize: 13, cursor: "pointer" }}>
                      <option value="free">Tier: Free</option>
                      <option value="megafan">Tier: MegaFan</option>
                    </select>
                    <button onClick={() => confirm(`¿${u.is_active ? "Desactivar" : "Activar"} la cuenta de ${u.username}?`, () => update(u.id, { is_active: !u.is_active }))}
                      style={{ display: "flex", alignItems: "center", gap: 6, background: u.is_active ? "rgba(220,38,38,0.12)" : "rgba(34,197,94,0.12)", border: `1px solid ${u.is_active ? "#DC262640" : "#22C55E40"}`, borderRadius: 8, padding: "7px 12px", color: u.is_active ? "#DC2626" : "#22C55E", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                      {u.is_active ? <><UserX size={13} /> Desactivar</> : <><UserCheck size={13} /> Activar</>}
                    </button>
                    <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, display: "flex", alignItems: "center", marginLeft: "auto" }}>
                      Registrado: {new Date(u.created_at).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
      {total > 15 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(q, p, filter); }}
            style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page === 1 ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>
            ← Anterior
          </button>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Pág. {page} / {Math.ceil(total / 15)}</span>
          <button disabled={page * 15 >= total} onClick={() => { const p = page + 1; setPage(p); load(q, p, filter); }}
            style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page * 15 >= total ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page * 15 >= total ? "default" : "pointer", fontSize: 13 }}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Content Section ── */
function ContentSection({ toast, confirm }: { toast: (m: string, t: "ok" | "err") => void; confirm: (m: string, cb: () => void) => void }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [animeId, setAnimeId] = useState("");
  const [animeTitle, setAnimeTitle] = useState("");
  const [action, setAction] = useState<"hidden" | "featured" | "blocked">("hidden");
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    apiClient.get<{ items: ContentItem[] }>("/admin/content")
      .then(d => setItems(d.items))
      .catch(() => toast("Error al cargar contenido", "err"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const add = async () => {
    if (!animeId.trim()) { toast("Ingresa el ID del anime", "err"); return; }
    setAdding(true);
    try {
      await apiClient.post("/admin/content", { animeId: animeId.trim(), animeTitle: animeTitle.trim(), action });
      toast("Anime añadido", "ok"); setAnimeId(""); setAnimeTitle(""); load();
    } catch { toast("Error al añadir", "err"); }
    finally { setAdding(false); }
  };

  const remove = (id: number, title: string) => {
    confirm(`¿Eliminar "${title}" de la lista?`, async () => {
      try { await apiClient.delete(`/admin/content/${id}`); setItems(prev => prev.filter(i => i.id !== id)); toast("Eliminado", "ok"); }
      catch { toast("Error al eliminar", "err"); }
    });
  };

  const actionStyles: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
    hidden:   { bg: "rgba(245,158,11,0.12)", color: "#F59E0B",  label: "Oculto",    icon: <EyeOff size={13} /> },
    featured: { bg: "rgba(108,99,255,0.12)", color: "#6C63FF",  label: "Destacado", icon: <Star size={13} /> },
    blocked:  { bg: "rgba(220,38,38,0.12)", color: "#DC2626",   label: "Bloqueado", icon: <Ban size={13} /> },
  };

  return (
    <div>
      <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 16 }}>Control de Contenido</h2>
      <div style={{ background: "#13131C", border: "1px solid rgba(108,99,255,0.15)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <div style={{ color: "#F1F1F5", fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Añadir anime</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={animeId} onChange={e => setAnimeId(e.target.value)} placeholder="ID del anime (ej: 21)" style={{ flex: 2, minWidth: 140, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, outline: "none" }} />
          <input value={animeTitle} onChange={e => setAnimeTitle(e.target.value)} placeholder="Título (opcional)" style={{ flex: 3, minWidth: 140, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, outline: "none" }} />
          <select value={action} onChange={e => setAction(e.target.value as typeof action)} style={{ background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, cursor: "pointer" }}>
            <option value="hidden">Ocultar</option>
            <option value="featured">Destacar</option>
            <option value="blocked">Bloquear</option>
          </select>
          <button onClick={add} disabled={adding} style={{ background: "linear-gradient(135deg,#6C63FF,#4F46E5)", border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            {adding ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />} Añadir
          </button>
        </div>
      </div>
      {loading
        ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>
        : items.length === 0
          ? <div style={{ background: "#13131C", borderRadius: 16, padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No hay contenido gestionado aún</div>
          : (
            <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              {items.map((item, i) => {
                const s = actionStyles[item.action];
                return (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    {item.anime_image && <img src={item.anime_image} alt={item.anime_title} style={{ width: 32, height: 44, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>{item.anime_title || item.anime_id}</div>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>ID: {item.anime_id}</div>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, background: s.bg, color: s.color, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{s.icon} {s.label}</span>
                    <button onClick={() => remove(item.id, item.anime_title || item.anime_id)} style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
    </div>
  );
}

/* ── Comments Moderation Section ── */
function CommentsSection({ toast, confirm }: { toast: (m: string, t: "ok" | "err") => void; confirm: (m: string, cb: () => void) => void }) {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (pg = page) => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ comments: AdminComment[]; total: number }>(`/admin/comments?page=${pg}&limit=20`);
      setComments(data.comments); setTotal(data.total);
    } catch { toast("Error al cargar comentarios", "err"); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, []);

  const remove = (id: number, text: string) => {
    confirm(`¿Eliminar este comentario?\n"${text.slice(0, 60)}..."`, async () => {
      try {
        await apiClient.delete(`/admin/comments/${id}`);
        setComments(prev => prev.filter(c => c.id !== id));
        setTotal(prev => prev - 1);
        toast("Comentario eliminado", "ok");
      } catch { toast("Error al eliminar", "err"); }
    });
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, margin: 0 }}>Moderación de Comentarios</h2>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{total} comentario(s) en total</span>
      </div>

      {loading
        ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>
        : comments.length === 0
          ? <div style={{ background: "#13131C", borderRadius: 16, padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No hay comentarios aún</div>
          : (
            <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              {comments.map((c, i) => (
                <div key={c.id} style={{ padding: "14px 16px", borderBottom: i < comments.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ color: "#A78BFA", fontSize: 13, fontWeight: 700 }}>{c.author}</span>
                        <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>·</span>
                        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Anime ID: {c.anime_id}</span>
                        {c.spoiler && <span style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 800 }}>SPOILER</span>}
                        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginLeft: "auto" }}>
                          {new Date(c.created_at).toLocaleDateString("es-ES")}
                        </span>
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>{c.text}</p>
                      {c.likes > 0 && <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 4 }}>{c.likes} like(s)</div>}
                    </div>
                    <button onClick={() => remove(c.id, c.text)} style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "7px 10px", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

      {total > 20 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
          <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(p); }}
            style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page === 1 ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>
            ← Anterior
          </button>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Pág. {page} / {Math.ceil(total / 20)}</span>
          <button disabled={page * 20 >= total} onClick={() => { const p = page + 1; setPage(p); load(p); }}
            style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page * 20 >= total ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page * 20 >= total ? "default" : "pointer", fontSize: 13 }}>
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

/* ── PromoCode type ── */
interface PromoCode {
  id: number;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

/* ── Monetization Section ── */
function MonetizationSection({ toast }: { toast: (m: string, t: "ok" | "err") => void }) {
  const [config, setConfig]       = useState<Record<string, string>>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [codes, setCodes]         = useState<PromoCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [newCode, setNewCode]     = useState({ code: "", discountPercent: 20, maxUses: "", expiresAt: "" });
  const [creating, setCreating]   = useState(false);

  useEffect(() => {
    apiClient.get<{ config: Record<string, string> }>("/admin/config")
      .then(d => setConfig(d.config))
      .catch(() => toast("Error al cargar config", "err"))
      .finally(() => setLoading(false));

    apiClient.get<{ codes: PromoCode[] }>("/admin/promo-codes")
      .then(d => setCodes(d.codes))
      .catch(() => {})
      .finally(() => setCodesLoading(false));
  }, []);

  const save = async (patch: Record<string, string>) => {
    setSaving(true);
    try { await apiClient.put("/admin/config", patch); setConfig(prev => ({ ...prev, ...patch })); toast("Guardado", "ok"); }
    catch { toast("Error al guardar", "err"); }
    finally { setSaving(false); }
  };

  const toggle = (key: string) => save({ [key]: config[key] === "true" ? "false" : "true" });
  const isEnabled = config["daily_limit_enabled"] === "true";

  const createCode = async () => {
    if (!newCode.code || !newCode.discountPercent) { toast("Completa el código y descuento", "err"); return; }
    setCreating(true);
    try {
      const data = await apiClient.post<{ code: PromoCode }>("/admin/promo-codes", {
        code: newCode.code,
        discountPercent: newCode.discountPercent,
        maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
        expiresAt: newCode.expiresAt || null,
      });
      setCodes(prev => [data.code, ...prev]);
      setNewCode({ code: "", discountPercent: 20, maxUses: "", expiresAt: "" });
      setShowForm(false);
      toast("Cupón creado", "ok");
    } catch (e: any) {
      toast(e.message ?? "Error creando cupón", "err");
    } finally {
      setCreating(false);
    }
  };

  const toggleCode = async (id: number, active: boolean) => {
    try {
      const data = await apiClient.patch<{ code: PromoCode }>(`/admin/promo-codes/${id}`, { active });
      setCodes(prev => prev.map(c => c.id === id ? data.code : c));
      toast(active ? "Cupón activado" : "Cupón desactivado", "ok");
    } catch { toast("Error", "err"); }
  };

  const deleteCode = async (id: number) => {
    try {
      await apiClient.delete(`/admin/promo-codes/${id}`);
      setCodes(prev => prev.filter(c => c.id !== id));
      toast("Cupón eliminado", "ok");
    } catch { toast("Error eliminando cupón", "err"); }
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 0 }}>Control de Monetización</h2>

      {/* Daily limit */}
      <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 800, fontSize: 15 }}>Sistema de límite diario</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Episodios gratuitos por día</div>
          </div>
          <button onClick={() => toggle("daily_limit_enabled")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            {isEnabled ? <ToggleRight size={40} color="#22C55E" /> : <ToggleLeft size={40} color="rgba(255,255,255,0.2)" />}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Límite diario:</label>
          <input type="number" min={1} max={100} value={config["daily_limit"] ?? "5"}
            onChange={e => setConfig(prev => ({ ...prev, daily_limit: e.target.value }))}
            onBlur={e => save({ daily_limit: e.target.value })}
            style={{ width: 70, background: "#0D0D1A", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 8, padding: "8px 10px", color: "#F1F1F5", fontSize: 15, fontWeight: 800, textAlign: "center", outline: "none" }} />
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>episodios/día para usuarios gratuitos</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ color: "#F1F1F5", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Mensaje de límite alcanzado</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 12 }}>Lo que ve el usuario al superar su límite diario</div>
        <textarea value={config["limit_message"] ?? ""}
          onChange={e => setConfig(prev => ({ ...prev, limit_message: e.target.value }))}
          onBlur={e => save({ limit_message: e.target.value })}
          rows={3}
          style={{ width: "100%", background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", color: "#F1F1F5", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>

      <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ color: "#F1F1F5", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Mensaje "Hazte MegaFan"</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 12 }}>Propuesta de valor para convertir a premium</div>
        <textarea value={config["megafan_message"] ?? ""}
          onChange={e => setConfig(prev => ({ ...prev, megafan_message: e.target.value }))}
          onBlur={e => save({ megafan_message: e.target.value })}
          rows={3}
          style={{ width: "100%", background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", color: "#F1F1F5", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>

      {saving && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, textAlign: "center" }}>Guardando...</div>}

      {/* ── Promo Codes ── */}
      <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ color: "#F1F1F5", fontWeight: 800, fontSize: 15 }}>Cupones de descuento</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>{codes.length} cupones creados</div>
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#6C63FF", border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 13 }}
          >
            <Plus size={14} /> Nuevo cupón
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div style={{ background: "#0D0D1A", border: "1px solid rgba(108,99,255,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 4 }}>Código</label>
                <input
                  type="text"
                  placeholder="VERANO2025"
                  value={newCode.code}
                  onChange={e => setNewCode(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 4 }}>Descuento %</label>
                <input
                  type="number" min={1} max={100}
                  value={newCode.discountPercent}
                  onChange={e => setNewCode(p => ({ ...p, discountPercent: parseInt(e.target.value) || 1 }))}
                  style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, outline: "none", textAlign: "center", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 4 }}>Máx. usos (vacío = ilimitado)</label>
                <input
                  type="number" min={1} placeholder="∞"
                  value={newCode.maxUses}
                  onChange={e => setNewCode(p => ({ ...p, maxUses: e.target.value }))}
                  style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, display: "block", marginBottom: 4 }}>Fecha expiración</label>
                <input
                  type="date"
                  value={newCode.expiresAt}
                  onChange={e => setNewCode(p => ({ ...p, expiresAt: e.target.value }))}
                  style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={createCode}
                disabled={creating}
                style={{ flex: 1, background: "#6C63FF", border: "none", borderRadius: 9, padding: "9px 0", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
              >
                {creating ? "Creando..." : "Crear cupón"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 9, padding: "9px 16px", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 14 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {codesLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Loader2 size={22} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : codes.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "24px 0", fontSize: 14 }}>
            No hay cupones. Crea el primero.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Código", "Descuento", "Usos", "Expira", "Estado", ""].map(h => (
                    <th key={h} style={{ padding: "8px 10px", color: "rgba(255,255,255,0.4)", fontWeight: 700, textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {codes.map(c => {
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  const maxed   = c.max_uses !== null && c.uses_count >= c.max_uses;
                  const status  = !c.active ? "inactivo" : expired ? "expirado" : maxed ? "agotado" : "activo";
                  const statusColor: Record<string, string> = { activo: "#22C55E", inactivo: "rgba(255,255,255,0.3)", expirado: "#F59E0B", agotado: "#EF4444" };
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "10px 10px", color: "#A78BFA", fontFamily: "monospace", fontWeight: 700 }}>{c.code}</td>
                      <td style={{ padding: "10px 10px", color: "#F1F1F5", fontWeight: 700 }}>−{c.discount_percent}%</td>
                      <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.6)" }}>
                        {c.uses_count}{c.max_uses !== null ? `/${c.max_uses}` : ""}
                      </td>
                      <td style={{ padding: "10px 10px", color: "rgba(255,255,255,0.5)" }}>
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString("es-ES") : "—"}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ color: statusColor[status], fontSize: 12, fontWeight: 700, background: `${statusColor[status]}18`, padding: "3px 8px", borderRadius: 6 }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => toggleCode(c.id, !c.active)}
                            title={c.active ? "Desactivar" : "Activar"}
                            style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: c.active ? "#F59E0B" : "#22C55E" }}
                          >
                            {c.active ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                          <button
                            onClick={() => deleteCode(c.id)}
                            title="Eliminar"
                            style={{ background: "none", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#EF4444" }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Config Section ── */
function ConfigSection({ toast }: { toast: (m: string, t: "ok" | "err") => void }) {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get<{ config: Record<string, string> }>("/admin/config")
      .then(d => setConfig(d.config))
      .catch(() => toast("Error al cargar", "err"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (patch: Record<string, string>) => {
    setSaving(true);
    try { await apiClient.put("/admin/config", patch); setConfig(prev => ({ ...prev, ...patch })); toast("Guardado", "ok"); }
    catch { toast("Error al guardar", "err"); }
    finally { setSaving(false); }
  };

  const toggle = (key: string) => save({ [key]: config[key] === "true" ? "false" : "true" });

  const BoolRow = ({ label, desc, k }: { label: string; desc: string; k: string }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 700 }}>{label}</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{desc}</div>
      </div>
      <button onClick={() => toggle(k)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {config[k] === "true" ? <ToggleRight size={36} color="#22C55E" /> : <ToggleLeft size={36} color="rgba(255,255,255,0.2)" />}
      </button>
    </div>
  );

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>;

  return (
    <div>
      <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 20 }}>Configuración General</h2>
      <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: "4px 20px" }}>
        <BoolRow label="Registro de usuarios" desc="Permite que nuevos usuarios se registren en la plataforma" k="registration_enabled" />
        <BoolRow label="Modo mantenimiento" desc="Muestra un aviso de mantenimiento a todos los visitantes" k="maintenance_mode" />
        <BoolRow label="Límite diario activo" desc="Activa el sistema de límite de episodios para usuarios gratuitos" k="daily_limit_enabled" />
      </div>
      {saving && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 10, textAlign: "center" }}>Guardando...</div>}
    </div>
  );
}

/* ── Transactions Section ── */
interface PayPalTx {
  id: number; order_id: string; amount_usd: string; plan: string;
  promo_code: string | null; status: string; created_at: string;
  username: string; email: string;
}

interface PayPalSub {
  subscription_id: string; status: string; username: string; email: string;
  last_payment_amount?: string; last_payment_time?: string; next_billing_time?: string;
  start_time: string;
}
interface TxData {
  transactions: PayPalTx[]; total: number; totalRevenue: number;
  subscriptions: PayPalSub[]; paypalConfigured: boolean; paypalError: string | null;
}

function TransactionsSection({ toast }: { toast: (m: string, t: "ok" | "err") => void }) {
  const [data, setData] = useState<TxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [tab, setTab] = useState<"onetime" | "subscriptions">("onetime");

  const load = useCallback(async (pg = page, f = from, t = to) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "20" });
      if (f) params.set("from", f);
      if (t) params.set("to", t);
      const res = await apiClient.get<TxData>(`/admin/transactions?${params.toString()}`);
      setData(res);
    } catch { toast("Error al cargar transacciones", "err"); }
    finally { setLoading(false); }
  }, [page, from, to]);

  useEffect(() => { load(1); }, []);

  const planColor: Record<string, string> = { monthly: "#6C63FF", annual: "#F59E0B" };
  const statusColor: Record<string, string> = {
    completed: "#22C55E", ACTIVE: "#22C55E", pending: "#F59E0B", SUSPENDED: "#F59E0B",
    failed: "#DC2626", CANCELLED: "#DC2626", EXPIRED: "#DC2626",
  };

  return (
    <div>
      <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 16 }}>Transacciones PayPal</h2>

      {/* PayPal config warning */}
      {data && !data.paypalConfigured && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={15} color="#F59E0B" />
          <span style={{ color: "#F59E0B", fontSize: 13 }}>PayPal no configurado — suscripciones no disponibles. Añade PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET.</span>
        </div>
      )}
      {data?.paypalError && (
        <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <AlertTriangle size={15} color="#DC2626" />
          <span style={{ color: "#DC2626", fontSize: 13 }}>{data.paypalError}</span>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { label: "Pagos únicos", value: data?.total ?? 0, icon: <CreditCard size={18} />, color: "#6C63FF" },
          { label: "Ingresos capturados", value: `$${(data?.totalRevenue ?? 0).toFixed(2)}`, icon: <DollarSign size={18} />, color: "#22C55E" },
          { label: "Suscripciones activas", value: data?.subscriptions.filter(s => s.status === "ACTIVE").length ?? 0, icon: <Crown size={18} />, color: "#F59E0B" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 160px", background: "#13131C", border: `1px solid ${c.color}30`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
              <div style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 900 }}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#13131C", borderRadius: 12, padding: 6, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {([["onetime", "Pagos únicos"], ["subscriptions", "Suscripciones PayPal"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
              background: tab === key ? "rgba(108,99,255,0.2)" : "transparent",
              color: tab === key ? "#A78BFA" : "rgba(255,255,255,0.45)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Date filter (only for one-time) */}
      {tab === "onetime" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <CalendarRange size={15} color="rgba(255,255,255,0.3)" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px", color: "#F1F1F5", fontSize: 13, outline: "none" }} />
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px", color: "#F1F1F5", fontSize: 13, outline: "none" }} />
          <button onClick={() => { setPage(1); load(1, from, to); }}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#6C63FF", border: "none", borderRadius: 8, padding: "8px 14px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <RefreshCw size={13} /> Filtrar
          </button>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); setPage(1); load(1, "", ""); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "8px 12px", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 13 }}>
              Limpiar
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>
      ) : tab === "onetime" ? (
        <>
          {(!data || data.transactions.length === 0) ? (
            <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
              <CreditCard size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>No hay pagos únicos registrados todavía.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Se registran al capturar órdenes PayPal con cupón.</p>
            </div>
          ) : (
            <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 80px 80px 100px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                {["Usuario", "Orden", "Monto", "Plan", "Estado", "Fecha"].map(h => (
                  <div key={h} style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
                ))}
              </div>
              {data.transactions.map((tx, i) => (
                <div key={tx.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px 80px 80px 100px", padding: "12px 16px", borderBottom: i < data.transactions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>{tx.username}</div>
                    <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{tx.email}</div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "monospace" }} title={tx.order_id}>
                    {tx.order_id.substring(0, 16)}…
                    {tx.promo_code && <span style={{ marginLeft: 4, background: "rgba(245,158,11,0.15)", color: "#F59E0B", borderRadius: 4, padding: "1px 5px", fontSize: 10 }}>{tx.promo_code}</span>}
                  </div>
                  <div style={{ color: "#22C55E", fontSize: 14, fontWeight: 800 }}>${parseFloat(tx.amount_usd).toFixed(2)}</div>
                  <div style={{ background: `${planColor[tx.plan] ?? "#6C63FF"}18`, color: planColor[tx.plan] ?? "#6C63FF", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, width: "fit-content" }}>
                    {tx.plan === "annual" ? "Anual" : "Mensual"}
                  </div>
                  <div style={{ background: `${statusColor[tx.status] ?? "#6C63FF"}18`, color: statusColor[tx.status] ?? "#6C63FF", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, width: "fit-content" }}>
                    {tx.status}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                    {new Date(tx.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(data?.total ?? 0) > 20 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16, alignItems: "center" }}>
              <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(p); }}
                style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page === 1 ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>
                ← Anterior
              </button>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Pág. {page} / {Math.ceil((data?.total ?? 0) / 20)}</span>
              <button disabled={page * 20 >= (data?.total ?? 0)} onClick={() => { const p = page + 1; setPage(p); load(p); }}
                style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page * 20 >= (data?.total ?? 0) ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page * 20 >= (data?.total ?? 0) ? "default" : "pointer", fontSize: 13 }}>
                Siguiente →
              </button>
            </div>
          )}
        </>
      ) : (
        /* Subscriptions tab — live from PayPal API */
        (!data || data.subscriptions.length === 0) ? (
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>
            <Crown size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>{!data?.paypalConfigured ? "PayPal no configurado." : "No hay suscriptores activos con ID de suscripción PayPal."}</p>
          </div>
        ) : (
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 120px 120px", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
              {["Usuario", "Estado", "Últ. pago", "Próx. cobro", "Inicio"].map(h => (
                <div key={h} style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
              ))}
            </div>
            {data.subscriptions.map((s, i) => (
              <div key={s.subscription_id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 110px 120px 120px", padding: "12px 16px", borderBottom: i < data.subscriptions.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700 }}>{s.username}</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>{s.email}</div>
                  <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, fontFamily: "monospace", marginTop: 2 }} title={s.subscription_id}>{s.subscription_id.substring(0, 18)}…</div>
                </div>
                <div style={{ background: `${statusColor[s.status] ?? "#6C63FF"}18`, color: statusColor[s.status] ?? "#6C63FF", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, width: "fit-content" }}>
                  {s.status}
                </div>
                <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                  {s.last_payment_amount ? `$${s.last_payment_amount}` : "—"}
                  {s.last_payment_time && <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{new Date(s.last_payment_time).toLocaleDateString("es-ES")}</div>}
                </div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                  {s.next_billing_time ? new Date(s.next_billing_time).toLocaleDateString("es-ES") : "—"}
                </div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                  {new Date(s.start_time).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

/* ── Emails Section ── */
function EmailsSection({ toast, confirm }: { toast: (m: string, t: "ok" | "err") => void; confirm: (m: string, cb: () => void) => void }) {
  const [to, setTo] = useState<"all" | "megafan" | "free">("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; total: number; errors: string[] } | null>(null);

  const SEGMENTS = [
    { key: "all" as const, label: "Todos los usuarios", color: "#6C63FF", desc: "Activos en la plataforma" },
    { key: "megafan" as const, label: "Solo MegaFan", color: "#F59E0B", desc: "Usuarios de pago" },
    { key: "free" as const, label: "Solo Gratuitos", color: "#22C55E", desc: "Tier free activos" },
  ];

  const doSend = async () => {
    setSending(true);
    setLastResult(null);
    try {
      const data = await apiClient.post<{ ok: boolean; sent: number; total: number; errors: string[]; error?: string }>(
        "/admin/send-email", { to, subject, body }
      );
      if (!data.ok && data.error) {
        toast(data.error, "err");
      } else {
        setLastResult({ sent: data.sent, total: data.total, errors: data.errors ?? [] });
        toast(`Enviado a ${data.sent} de ${data.total} destinatarios`, "ok");
        setSubject(""); setBody("");
      }
    } catch (e: any) {
      toast(e?.message ?? "Error al enviar emails", "err");
    } finally { setSending(false); }
  };

  return (
    <div>
      <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Envío de Emails</h2>
      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 20 }}>
        Envía mensajes a segmentos de usuarios. Requiere configurar SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM en las variables de entorno.
      </p>

      {/* Segment selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Destinatarios</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {SEGMENTS.map(s => (
            <button key={s.key} onClick={() => setTo(s.key)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "flex-start",
                gap: 2, padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                background: to === s.key ? `${s.color}18` : "#13131C",
                border: `1px solid ${to === s.key ? s.color + "60" : "rgba(255,255,255,0.07)"}`,
                color: to === s.key ? s.color : "rgba(255,255,255,0.5)",
                transition: "all 0.15s", minWidth: 140,
              }}>
              <span style={{ fontWeight: 800, fontSize: 13 }}>{s.label}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Asunto</div>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del email..."
          style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "11px 14px", color: "#F1F1F5", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Body */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Mensaje</div>
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Escribe tu mensaje aquí..." rows={7}
          style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 14px", color: "#F1F1F5", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }} />
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 4 }}>Soporta saltos de línea. Se convierte a HTML automáticamente.</div>
      </div>

      {/* Send button */}
      <button
        disabled={sending || !subject.trim() || !body.trim()}
        onClick={() => confirm(`¿Enviar email a "${SEGMENTS.find(s => s.key === to)?.label}"?\n\nAsunto: "${subject}"`, doSend)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: sending || !subject.trim() || !body.trim() ? "rgba(108,99,255,0.3)" : "linear-gradient(135deg,#6C63FF,#4F46E5)",
          border: "none", borderRadius: 12, padding: "13px 24px",
          color: "#fff", cursor: sending || !subject.trim() || !body.trim() ? "default" : "pointer",
          fontSize: 14, fontWeight: 800, boxShadow: "0 4px 16px rgba(108,99,255,0.3)",
        }}>
        {sending ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Enviando...</> : <><Send size={15} /> Enviar Email</>}
      </button>

      {/* Result */}
      {lastResult && (
        <div style={{ marginTop: 20, background: "#13131C", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Check size={16} color="#22C55E" />
            <span style={{ color: "#22C55E", fontWeight: 700, fontSize: 14 }}>Envío completado</span>
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
            Enviados: <strong style={{ color: "#F1F1F5" }}>{lastResult.sent}</strong> de <strong style={{ color: "#F1F1F5" }}>{lastResult.total}</strong> destinatarios
          </div>
          {lastResult.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#F59E0B", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Errores ({lastResult.errors.length}):</div>
              {lastResult.errors.map((e, i) => <div key={i} style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontFamily: "monospace" }}>{e}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar nav ── */
const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard",    label: "Dashboard",      icon: <LayoutDashboard size={18} /> },
  { key: "users",        label: "Usuarios",       icon: <Users size={18} /> },
  { key: "content",      label: "Contenido",      icon: <Film size={18} /> },
  { key: "comments",     label: "Comentarios",    icon: <MessageSquare size={18} /> },
  { key: "monetization", label: "Monetización",   icon: <Crown size={18} /> },
  { key: "transactions", label: "Transacciones",  icon: <CreditCard size={18} /> },
  { key: "emails",       label: "Emails",         icon: <Mail size={18} /> },
  { key: "config",       label: "Configuración",  icon: <Settings size={18} /> },
];

/* ── Main Admin Page ── */
export default function Admin() {
  const { user, isOwner, loading } = useAuth();
  const [, navigate] = useLocation();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [confirmState, setConfirmState] = useState<{ msg: string; cb: () => void } | null>(null);

  const showToast = useCallback((msg: string, type: "ok" | "err") => setToast({ msg, type }), []);
  const showConfirm = useCallback((msg: string, cb: () => void) => setConfirmState({ msg, cb }), []);
  const handleNavigate = useCallback((s: Section) => { setSection(s); setSidebarOpen(false); }, []);

  useEffect(() => { if (!loading && (!user || !isOwner)) navigate("/"); }, [loading, user, isOwner]);

  if (loading || !user || !isOwner) return (
    <div style={{ minHeight: "100vh", background: "#090A12", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={32} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#090A12", display: "flex" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (max-width: 768px) {
          .admin-sidebar { transform: translateX(-100%) !important; }
          .sidebar-toggle { display: flex !important; }
          .admin-main { margin-left: 0 !important; }
        }
      `}</style>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, backdropFilter: "blur(2px)" }} />}

      {/* Sidebar */}
      <aside className="admin-sidebar" style={{ width: 230, flexShrink: 0, background: "#0D0D1A", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 50, transition: "transform 0.2s ease" }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(108,99,255,0.35)" }}>
              <Shield size={18} color="#fff" />
            </div>
            <div>
              <div style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 900 }}>Panel Admin</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>AnimeFlex</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map(n => (
            <button key={n.key} onClick={() => handleNavigate(n.key)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 600, background: section === n.key ? "rgba(108,99,255,0.15)" : "transparent", color: section === n.key ? "#A78BFA" : "rgba(255,255,255,0.5)", transition: "all 0.15s", borderLeft: section === n.key ? "2px solid #6C63FF" : "2px solid transparent" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => navigate("/")} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: 13 }}>
            <ArrowLeft size={15} /> Volver al sitio
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="admin-main" style={{ flex: 1, marginLeft: 230, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div style={{ height: 60, background: "#0D0D1A", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 24px", gap: 12, flexShrink: 0, position: "sticky", top: 0, zIndex: 30, backdropFilter: "blur(8px)" }}>
          <button onClick={() => setSidebarOpen(true)} className="sidebar-toggle" style={{ display: "none", background: "none", border: "none", cursor: "pointer", color: "#F1F1F5", padding: 4 }}>
            <Menu size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>AnimeFlex</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>{NAV.find(n => n.key === section)?.label}</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px #22C55E" }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>Online</span>
            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 900 }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>{user.username}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "28px 24px", maxWidth: 1100, width: "100%" }}>
          {section === "dashboard"    && <DashboardSection toast={showToast} user={user} onNavigate={handleNavigate} />}
          {section === "users"        && <UsersSection toast={showToast} confirm={showConfirm} />}
          {section === "content"      && <ContentSection toast={showToast} confirm={showConfirm} />}
          {section === "comments"     && <CommentsSection toast={showToast} confirm={showConfirm} />}
          {section === "monetization" && <MonetizationSection toast={showToast} />}
          {section === "transactions" && <TransactionsSection toast={showToast} />}
          {section === "emails"       && <EmailsSection toast={showToast} confirm={showConfirm} />}
          {section === "config"       && <ConfigSection toast={showToast} />}
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirmState && <Confirm msg={confirmState.msg} onOk={() => { confirmState.cb(); setConfirmState(null); }} onCancel={() => setConfirmState(null)} />}
    </div>
  );
}
