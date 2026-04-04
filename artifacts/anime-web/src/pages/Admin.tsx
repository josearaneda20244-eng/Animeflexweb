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
    Zap, BarChart2, ArrowUpRight, Clock,
  } from "lucide-react";

  /* ── Types ── */
  interface AdminUser {
    id: number; username: string; email: string; avatar_url: string | null;
    role: "user" | "admin" | "owner"; membership_tier: "free" | "megafan";
    is_active: boolean; created_at: string;
  }
  interface AdminStats {
    totalUsers: number; megafanUsers: number; episodesToday: number; newUsersWeek: number;
    topAnime: { anime_id: string; anime_title: string; anime_image: string; views: string }[];
  }
  interface ContentItem {
    id: number; anime_id: string; anime_title: string; anime_image: string;
    action: "hidden" | "featured" | "blocked"; created_at: string;
  }
  type Section = "dashboard" | "users" | "content" | "monetization" | "config";

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
      if (target === 0) return;
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

  /* ── Dashboard Section ── */
  function DashboardSection({ toast, user }: { toast: (m: string, t: "ok" | "err") => void; user: { username: string } }) {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [, navigate] = useLocation();

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
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#6C63FF22,#4F46E522)", border: "2px solid #6C63FF44", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 size={24} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} />
        </div>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 14 }}>Cargando estadísticas...</span>
      </div>
    );

    const conversionRate = stats && stats.totalUsers > 0
      ? ((stats.megafanUsers / stats.totalUsers) * 100).toFixed(1)
      : "0.0";

    const maxViews = stats?.topAnime[0] ? parseInt(stats.topAnime[0].views) : 1;

    const CARDS = [
      {
        label: "Usuarios totales", value: stats?.totalUsers ?? 0,
        sub: `+${stats?.newUsersWeek ?? 0} esta semana`,
        icon: <Users size={22} />, color: "#6C63FF",
        gradient: "linear-gradient(135deg,rgba(108,99,255,0.15),rgba(108,99,255,0.05))",
        border: "rgba(108,99,255,0.3)",
      },
      {
        label: "Usuarios MegaFan", value: stats?.megafanUsers ?? 0,
        sub: `${conversionRate}% conversión`,
        icon: <Crown size={22} />, color: "#F59E0B",
        gradient: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.05))",
        border: "rgba(245,158,11,0.3)",
      },
      {
        label: "Episodios vistos hoy", value: stats?.episodesToday ?? 0,
        sub: "últimas 24 horas",
        icon: <Eye size={22} />, color: "#22C55E",
        gradient: "linear-gradient(135deg,rgba(34,197,94,0.15),rgba(34,197,94,0.05))",
        border: "rgba(34,197,94,0.3)",
      },
      {
        label: "Nuevos registros", value: stats?.newUsersWeek ?? 0,
        sub: "últimos 7 días",
        icon: <TrendingUp size={22} />, color: "#06B6D4",
        gradient: "linear-gradient(135deg,rgba(6,182,212,0.15),rgba(6,182,212,0.05))",
        border: "rgba(6,182,212,0.3)",
      },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 4, textTransform: "capitalize" }}>{dateStr}</div>
            <h2 style={{ color: "#F1F1F5", fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>
              Hola, <span style={{ color: "#A78BFA" }}>{user.username}</span> 👋
            </h2>
            <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 14, marginTop: 4 }}>Aquí está el resumen de tu plataforma</div>
          </div>
          <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(108,99,255,0.1)", border: "1px solid rgba(108,99,255,0.25)", borderRadius: 10, padding: "8px 14px", color: "#A78BFA", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            <Activity size={14} /> Actualizar
          </button>
        </div>

        {/* Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
          {CARDS.map(c => (
            <div key={c.label} style={{ background: c.gradient, border: `1px solid ${c.border}`, borderRadius: 18, padding: "22px 20px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `${c.color}10`, border: `1px solid ${c.color}20` }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${c.color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: c.color }}>
                  {c.icon}
                </div>
                <ArrowUpRight size={16} color={`${c.color}80`} />
              </div>
              <div style={{ color: "#F1F1F5", fontSize: 34, fontWeight: 900, letterSpacing: -1, lineHeight: 1 }}>
                <Counter target={c.value} />
              </div>
              <div style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 700, marginTop: 6, opacity: 0.8 }}>{c.label}</div>
              <div style={{ color: `${c.color}`, fontSize: 12, marginTop: 4, fontWeight: 600, opacity: 0.9 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Conversion + Activity row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Conversion rate */}
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Zap size={15} color="#F59E0B" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Tasa de conversión</span>
            </div>
            <div style={{ color: "#F59E0B", fontSize: 38, fontWeight: 900, letterSpacing: -1, marginBottom: 8 }}>{conversionRate}%</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, marginBottom: 14 }}>Free → MegaFan</div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(parseFloat(conversionRate), 100)}%`, background: "linear-gradient(90deg,#F59E0B,#FCD34D)", borderRadius: 99, transition: "width 1s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>0%</span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>100%</span>
            </div>
          </div>

          {/* Platform health */}
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <BarChart2 size={15} color="#22C55E" />
              <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Estado de la plataforma</span>
            </div>
            {[
              { label: "Usuarios activos", pct: Math.min(100, ((stats?.totalUsers ?? 0) / Math.max(stats?.totalUsers ?? 1, 100)) * 100), color: "#6C63FF" },
              { label: "Actividad hoy", pct: Math.min(100, ((stats?.episodesToday ?? 0) / 200) * 100), color: "#22C55E" },
              { label: "Premium ratio", pct: Math.min(100, parseFloat(conversionRate)), color: "#F59E0B" },
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
              const BAR_COLORS = ["#6C63FF","#A78BFA","#22C55E","#06B6D4","#F59E0B"];
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
              { label: "Ver usuarios", icon: <Users size={14} />, color: "#6C63FF", section: "users" },
              { label: "Gestionar contenido", icon: <Film size={14} />, color: "#22C55E", section: "content" },
              { label: "Monetización", icon: <Crown size={14} />, color: "#F59E0B", section: "monetization" },
              { label: "Configuración", icon: <Settings size={14} />, color: "#06B6D4", section: "config" },
            ].map(q => (
              <button key={q.label} style={{ display: "flex", alignItems: "center", gap: 7, background: `${q.color}14`, border: `1px solid ${q.color}30`, borderRadius: 10, padding: "9px 14px", color: q.color, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                {q.icon} {q.label}
              </button>
            ))}
          </div>
        </div>

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

    const load = useCallback(async (query = q, pg = page) => {
      setLoading(true);
      try {
        const data = await apiClient.get<{ users: AdminUser[]; total: number }>(
          `/admin/users?q=${encodeURIComponent(query)}&page=${pg}&limit=15`
        );
        setUsers(data.users); setTotal(data.total);
      } catch { toast("Error al cargar usuarios", "err"); }
      finally { setLoading(false); }
    }, [q, page]);

    useEffect(() => { load(); }, []);

    const update = async (id: number, patch: Partial<AdminUser>) => {
      try {
        await apiClient.patch<{ user: AdminUser }>(`/admin/users/${id}`, patch);
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
        toast("Usuario actualizado", "ok");
      } catch { toast("Error al actualizar", "err"); }
    };

    const roleColor: Record<string, string> = { owner: "#F59E0B", admin: "#6C63FF", user: "rgba(255,255,255,0.4)" };
    const tierColor: Record<string, string> = { megafan: "#F59E0B", free: "rgba(255,255,255,0.3)" };

    return (
      <div>
        <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 16 }}>Gestión de Usuarios</h2>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={15} color="rgba(255,255,255,0.3)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setPage(1); load(q, 1); } }}
              placeholder="Buscar por nombre o email..."
              style={{ width: "100%", background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px 10px 36px", color: "#F1F1F5", fontSize: 14, outline: "none" }} />
          </div>
          <button onClick={() => { setPage(1); load(q, 1); }} style={{ background: "#6C63FF", border: "none", borderRadius: 10, padding: "10px 16px", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Buscar</button>
        </div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>
        ) : (
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, overflow: "hidden" }}>
            {users.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No se encontraron usuarios</div>
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
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>{u.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ color: roleColor[u.role] ?? "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 800, background: `${roleColor[u.role]}18`, borderRadius: 6, padding: "3px 8px" }}>{u.role.toUpperCase()}</span>
                    <span style={{ color: tierColor[u.membership_tier], fontSize: 11, fontWeight: 700 }}>{u.membership_tier === "megafan" ? "⭐ MegaFan" : "Free"}</span>
                    <button onClick={() => setExpanding(expanding === u.id ? null : u.id)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center" }}>
                      <ChevronDown size={14} style={{ transform: expanding === u.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                    </button>
                  </div>
                </div>
                {expanding === u.id && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select value={u.role} onChange={e => confirm(`¿Cambiar rol de ${u.username} a ${e.target.value}?`, () => update(u.id, { role: e.target.value as AdminUser["role"] }))} style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", color: "#F1F1F5", fontSize: 13, cursor: "pointer" }}>
                      <option value="user">Rol: User</option>
                      <option value="admin">Rol: Admin</option>
                      <option value="owner">Rol: Owner</option>
                    </select>
                    <select value={u.membership_tier} onChange={e => update(u.id, { membership_tier: e.target.value as AdminUser["membership_tier"] })} style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "7px 10px", color: "#F1F1F5", fontSize: 13, cursor: "pointer" }}>
                      <option value="free">Tier: Free</option>
                      <option value="megafan">Tier: MegaFan</option>
                    </select>
                    <button onClick={() => confirm(`¿${u.is_active ? "Desactivar" : "Activar"} cuenta de ${u.username}?`, () => update(u.id, { is_active: !u.is_active }))} style={{ display: "flex", alignItems: "center", gap: 6, background: u.is_active ? "rgba(220,38,38,0.12)" : "rgba(34,197,94,0.12)", border: `1px solid ${u.is_active ? "#DC262640" : "#22C55E40"}`, borderRadius: 8, padding: "7px 12px", color: u.is_active ? "#DC2626" : "#22C55E", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                      {u.is_active ? <><UserX size={13} /> Desactivar</> : <><UserCheck size={13} /> Activar</>}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {total > 15 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(q, p); }} style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page === 1 ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page === 1 ? "default" : "pointer", fontSize: 13 }}>← Anterior</button>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, padding: "8px 12px" }}>Pág. {page} / {Math.ceil(total / 15)}</span>
            <button disabled={page * 15 >= total} onClick={() => { const p = page + 1; setPage(p); load(q, p); }} style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 14px", color: page * 15 >= total ? "rgba(255,255,255,0.2)" : "#F1F1F5", cursor: page * 15 >= total ? "default" : "pointer", fontSize: 13 }}>Siguiente →</button>
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
            <input value={animeId} onChange={e => setAnimeId(e.target.value)} placeholder="ID del anime" style={{ flex: 2, minWidth: 140, background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 12px", color: "#F1F1F5", fontSize: 14, outline: "none" }} />
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
        {loading ? <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>
        : items.length === 0 ? <div style={{ background: "#13131C", borderRadius: 16, padding: 40, textAlign: "center", color: "rgba(255,255,255,0.3)" }}>No hay contenido gestionado aún</div>
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
                  <span style={{ display: "flex", alignItems: "center", gap: 4, background: s.bg, color: s.color, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>{s.icon} {s.label}</span>
                  <button onClick={() => remove(item.id, item.anime_title || item.anime_id)} style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center" }}>
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

  /* ── Monetization Section ── */
  function MonetizationSection({ toast }: { toast: (m: string, t: "ok" | "err") => void }) {
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
    const isEnabled = config["daily_limit_enabled"] === "true";

    if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><Loader2 size={28} color="#6C63FF" style={{ animation: "spin 1s linear infinite" }} /></div>;

    return (
      <div>
        <h2 style={{ color: "#F1F1F5", fontSize: 22, fontWeight: 900, marginBottom: 20 }}>Control de Monetización</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              <input type="number" min={1} max={100} value={config["daily_limit"] ?? "5"} onChange={e => setConfig(prev => ({ ...prev, daily_limit: e.target.value }))} onBlur={e => save({ daily_limit: e.target.value })} style={{ width: 70, background: "#0D0D1A", border: "1px solid rgba(108,99,255,0.3)", borderRadius: 8, padding: "8px 10px", color: "#F1F1F5", fontSize: 15, fontWeight: 800, textAlign: "center", outline: "none" }} />
            </div>
          </div>
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
            <div style={{ color: "#F1F1F5", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Mensaje de límite alcanzado</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 12 }}>Lo que ve el usuario al superar su límite</div>
            <textarea value={config["limit_message"] ?? ""} onChange={e => setConfig(prev => ({ ...prev, limit_message: e.target.value }))} onBlur={e => save({ limit_message: e.target.value })} rows={3} style={{ width: "100%", background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", color: "#F1F1F5", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ background: "#13131C", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
            <div style={{ color: "#F1F1F5", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Mensaje "Hazte MegaFan"</div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 12 }}>Propuesta de valor premium</div>
            <textarea value={config["megafan_message"] ?? ""} onChange={e => setConfig(prev => ({ ...prev, megafan_message: e.target.value }))} onBlur={e => save({ megafan_message: e.target.value })} rows={3} style={{ width: "100%", background: "#0D0D1A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 12px", color: "#F1F1F5", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
          </div>
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
          <BoolRow label="Registro de usuarios" desc="Permite que nuevos usuarios se registren" k="registration_enabled" />
          <BoolRow label="Modo mantenimiento" desc="Muestra un aviso de mantenimiento a todos" k="maintenance_mode" />
          <BoolRow label="Límite diario activo" desc="Activa el sistema de límite de episodios" k="daily_limit_enabled" />
        </div>
        {saving && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, marginTop: 10, textAlign: "center" }}>Guardando...</div>}
      </div>
    );
  }

  /* ── Sidebar nav ── */
  const NAV: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard",    label: "Dashboard",    icon: <LayoutDashboard size={18} /> },
    { key: "users",        label: "Usuarios",     icon: <Users size={18} /> },
    { key: "content",      label: "Contenido",    icon: <Film size={18} /> },
    { key: "monetization", label: "Monetización", icon: <Crown size={18} /> },
    { key: "config",       label: "Configuración",icon: <Settings size={18} /> },
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
              <button key={n.key} onClick={() => { setSection(n.key); setSidebarOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 600, background: section === n.key ? "rgba(108,99,255,0.15)" : "transparent", color: section === n.key ? "#A78BFA" : "rgba(255,255,255,0.5)", transition: "all 0.15s", borderLeft: section === n.key ? "2px solid #6C63FF" : "2px solid transparent" }}>
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
              <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#6C63FF,#4F46E5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 900, boxShadow: "0 2px 8px rgba(108,99,255,0.4)" }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: 600 }}>{user.username}</span>
            </div>
          </div>

          <div style={{ flex: 1, padding: "28px 24px", maxWidth: 1000, width: "100%" }}>
            {section === "dashboard"    && <DashboardSection toast={showToast} user={user} />}
            {section === "users"        && <UsersSection toast={showToast} confirm={showConfirm} />}
            {section === "content"      && <ContentSection toast={showToast} confirm={showConfirm} />}
            {section === "monetization" && <MonetizationSection toast={showToast} />}
            {section === "config"       && <ConfigSection toast={showToast} />}
          </div>
        </div>

        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        {confirmState && <Confirm msg={confirmState.msg} onOk={() => { confirmState.cb(); setConfirmState(null); }} onCancel={() => setConfirmState(null)} />}
      </div>
    );
  }
  