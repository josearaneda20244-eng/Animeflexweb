import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Camera, User, Mail, Shield, Crown, ArrowLeft, Check, X, Upload, Link as LinkIcon, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";

export default function Settings() {
  const { user, isMegaFan, isOwner, updateProfile } = useAuth();
  const [, navigate] = useLocation();

  const [username, setUsername] = useState(user?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url ?? "");
  const [avatarMode, setAvatarMode] = useState<"url" | "upload">("url");
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#090A12", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Debes iniciar sesión para ver esta página.</div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setAvatarError("Solo se permiten imágenes."); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarError("La imagen no debe superar 2 MB."); return; }
    setAvatarError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 256;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarBase64(compressed);
        setAvatarPreview(compressed);
        setAvatarUrl("");
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async () => {
    setSavingAvatar(true);
    setAvatarError("");
    setAvatarSuccess(false);
    try {
      const newAvatar = avatarMode === "upload" && avatarBase64 ? avatarBase64 : avatarUrl.trim() || null;
      await updateProfile({ avatar_url: newAvatar ?? "" });
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 2500);
    } catch (err: any) {
      setAvatarError(err.message ?? "Error al guardar avatar");
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveUsername = async () => {
    if (username.trim().length < 2 || username.trim().length > 30) {
      setUsernameError("El nombre debe tener entre 2 y 30 caracteres");
      return;
    }
    setSavingUsername(true);
    setUsernameError("");
    setUsernameSuccess(false);
    try {
      await updateProfile({ username: username.trim() });
      setUsernameSuccess(true);
      setTimeout(() => setUsernameSuccess(false), 2500);
    } catch (err: any) {
      setUsernameError(err.message ?? "Error al guardar nombre");
    } finally {
      setSavingUsername(false);
    }
  };

  const initials = user.username.charAt(0).toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("es", { month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#090A12" }}>
      <Navbar />
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 16px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "rgba(255,255,255,0.07)", border: "none", borderRadius: 10, padding: 8, cursor: "pointer", display: "flex" }}
          >
            <ArrowLeft size={18} color="rgba(255,255,255,0.7)" />
          </button>
          <div>
            <h1 style={{ color: "#F1F1F5", fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: -0.3 }}>Configuración</h1>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, margin: 0, marginTop: 2 }}>Personaliza tu perfil</p>
          </div>
        </div>

        {/* Profile card */}
        <div style={{
          background: "linear-gradient(180deg,#16172A,#111220)",
          border: "1px solid rgba(108,99,255,0.2)",
          borderRadius: 20, overflow: "hidden", marginBottom: 16,
        }}>
          {/* Banner */}
          <div style={{ height: 80, background: "linear-gradient(135deg,#2D1B69,#1A1A3E,#0D0D1F)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 60%,rgba(108,99,255,0.4),transparent 65%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 40%,rgba(245,158,11,0.15),transparent 65%)" }} />
          </div>

          <div style={{ padding: "0 20px 20px" }}>
            {/* Avatar overlapping */}
            <div style={{ marginTop: -36, marginBottom: 12, display: "flex", alignItems: "flex-end", gap: 12 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 20,
                  background: "linear-gradient(135deg,#6C63FF,#4F46E5)",
                  border: "4px solid #111220",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(108,99,255,0.5)",
                }}>
                  {avatarPreview
                    ? <img src={avatarPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setAvatarPreview("")} />
                    : <span style={{ color: "#fff", fontSize: 28, fontWeight: 900 }}>{initials}</span>
                  }
                </div>
              </div>
              <div style={{ paddingBottom: 4 }}>
                <div style={{ color: "#F1F1F5", fontSize: 17, fontWeight: 900 }}>{user.username}</div>
                <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
                  {isOwner && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: 100, padding: "2px 8px", fontSize: 9, fontWeight: 900, color: "#FCA5A5" }}>
                      <Shield size={8} /> DUEÑO
                    </span>
                  )}
                  {isMegaFan && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(245,158,11,0.2)", border: "1px solid rgba(245,158,11,0.5)", borderRadius: 100, padding: "2px 8px", fontSize: 9, fontWeight: 900, color: "#FCD34D" }}>
                      <Crown size={8} /> MEGAFAN
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                <Mail size={11} /> {user.email}
              </span>
              {memberSince && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                  Miembro desde {memberSince}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Avatar section */}
        <div style={{ background: "linear-gradient(180deg,#16172A,#111220)", border: "1px solid rgba(108,99,255,0.15)", borderRadius: 20, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Camera size={14} color="#A78BFA" />
            </div>
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Foto de perfil</span>
          </div>

          {/* Tab selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "rgba(255,255,255,0.04)", padding: 4, borderRadius: 12 }}>
            {([["url", "URL de imagen", <LinkIcon size={12} />], ["upload", "Subir foto", <Upload size={12} />]] as const).map(([mode, label, icon]) => (
              <button key={mode} onClick={() => { setAvatarMode(mode as "url" | "upload"); setAvatarError(""); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  padding: "8px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: avatarMode === mode ? "rgba(108,99,255,0.25)" : "none",
                  color: avatarMode === mode ? "#A78BFA" : "rgba(255,255,255,0.4)",
                  transition: "all 0.15s",
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {avatarMode === "url" ? (
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => { setAvatarUrl(e.target.value); setAvatarPreview(e.target.value); }}
              placeholder="https://ejemplo.com/mi-foto.jpg"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 12, boxSizing: "border-box",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(108,99,255,0.3)",
                color: "#F1F1F5", fontSize: 13, outline: "none", fontFamily: "inherit",
              }}
            />
          ) : (
            <div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              <button onClick={() => fileRef.current?.click()}
                style={{
                  width: "100%", padding: "24px 14px", borderRadius: 12,
                  background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(108,99,255,0.35)",
                  color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(108,99,255,0.6)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(108,99,255,0.35)"; }}
              >
                <Upload size={22} color="#6C63FF" />
                <span>{avatarBase64 ? "Foto seleccionada ✓ — Click para cambiar" : "Click para seleccionar imagen (máx. 2 MB)"}</span>
              </button>
            </div>
          )}

          {avatarError && (
            <div style={{ color: "#FCA5A5", fontSize: 12, marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <X size={12} /> {avatarError}
            </div>
          )}

          <button onClick={handleSaveAvatar} disabled={savingAvatar}
            style={{
              marginTop: 12, width: "100%", padding: "11px", borderRadius: 12, border: "none",
              background: avatarSuccess ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#6C63FF,#4F46E5)",
              color: "#fff", fontSize: 13, fontWeight: 800, cursor: savingAvatar ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              opacity: savingAvatar ? 0.7 : 1, transition: "all 0.2s",
            }}
          >
            {savingAvatar ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
              : avatarSuccess ? <><Check size={14} /> ¡Foto actualizada!</>
              : <><Camera size={14} /> Guardar foto de perfil</>}
          </button>
        </div>

        {/* Username section */}
        <div style={{ background: "linear-gradient(180deg,#16172A,#111220)", border: "1px solid rgba(108,99,255,0.15)", borderRadius: 20, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(108,99,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={14} color="#A78BFA" />
            </div>
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Nombre de usuario</span>
          </div>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            placeholder="Tu nombre de usuario"
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 12, boxSizing: "border-box",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(108,99,255,0.3)",
              color: "#F1F1F5", fontSize: 13, outline: "none", fontFamily: "inherit",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {usernameError
              ? <span style={{ color: "#FCA5A5", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}><X size={11} />{usernameError}</span>
              : <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>Entre 2 y 30 caracteres</span>
            }
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>{username.length}/30</span>
          </div>

          <button onClick={handleSaveUsername} disabled={savingUsername || username.trim() === user.username}
            style={{
              marginTop: 12, width: "100%", padding: "11px", borderRadius: 12, border: "none",
              background: usernameSuccess ? "linear-gradient(135deg,#22C55E,#16A34A)" : "linear-gradient(135deg,#6C63FF,#4F46E5)",
              color: "#fff", fontSize: 13, fontWeight: 800,
              cursor: (savingUsername || username.trim() === user.username) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              opacity: (savingUsername || username.trim() === user.username) ? 0.5 : 1, transition: "all 0.2s",
            }}
          >
            {savingUsername ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Guardando...</>
              : usernameSuccess ? <><Check size={14} /> ¡Nombre actualizado!</>
              : <><User size={14} /> Guardar nombre</>}
          </button>
        </div>

        {/* Email (read-only) */}
        <div style={{ background: "linear-gradient(180deg,#16172A,#111220)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={14} color="rgba(255,255,255,0.4)" />
            </div>
            <span style={{ color: "#F1F1F5", fontSize: 14, fontWeight: 800 }}>Correo electrónico</span>
          </div>
          <div style={{
            padding: "11px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.4)", fontSize: 13,
          }}>
            {user.email}
          </div>
          <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 6 }}>El correo no se puede cambiar por seguridad.</div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
