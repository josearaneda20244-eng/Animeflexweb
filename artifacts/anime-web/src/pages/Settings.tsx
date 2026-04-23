import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Camera, User, Mail, Shield, Crown, ArrowLeft, Check, X, Upload, Link as LinkIcon, Loader2, Eye, EyeOff, KeyRound, CheckCircle2, SendHorizonal } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/lib/apiClient";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const CLIP_8 = "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)";
const CLIP_10 = "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)";
const CLIP_14 = "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)";
const CLIP_6 = "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)";

const cardStyle = (accent: "carmesi" | "ambar" | "neutro" = "carmesi"): React.CSSProperties => {
  const colors = {
    carmesi: { border: "rgba(220,38,38,0.4)", glow: "rgba(220,38,38,0.18)" },
    ambar:   { border: "rgba(249,115,22,0.45)", glow: "rgba(249,115,22,0.18)" },
    neutro:  { border: "rgba(249,115,22,0.18)", glow: "rgba(0,0,0,0)" },
  }[accent];
  return {
    background: "linear-gradient(160deg, rgba(20,6,16,0.92), rgba(8,4,18,0.96))",
    border: `1px solid ${colors.border}`,
    clipPath: CLIP_14,
    padding: 22,
    marginBottom: 14,
    position: "relative",
    boxShadow: `0 0 24px ${colors.glow}`,
  };
};

const sectionHeader = (icon: React.ReactNode, tag: string, title: string) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 34, height: 34,
        background: "linear-gradient(135deg, rgba(220,38,38,0.2), rgba(249,115,22,0.15))",
        border: "1px solid rgba(249,115,22,0.4)",
        clipPath: CLIP_6,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <div>
        <div style={{ color: "#F97316", fontSize: 9, fontWeight: 900, letterSpacing: 2, fontFamily: MONO, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 4, height: 4, background: "#F97316", borderRadius: "50%", boxShadow: "0 0 6px #F97316" }} />
          {tag}
        </div>
        <div style={{ color: "#FECACA", fontSize: 14, fontWeight: 900, letterSpacing: 0.3, marginTop: 1 }}>{title}</div>
      </div>
    </div>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", boxSizing: "border-box",
  background: "rgba(8,4,18,0.7)",
  border: "1px solid rgba(249,115,22,0.35)",
  clipPath: CLIP_8,
  color: "#FECACA", fontSize: 13, outline: "none",
  fontFamily: "inherit",
};

const primaryBtn = (success = false): React.CSSProperties => ({
  width: "100%", padding: "12px", border: "1px solid rgba(253,186,116,0.5)",
  background: success
    ? "linear-gradient(135deg,#16A34A,#15803D)"
    : "linear-gradient(135deg,#DC2626,#991B1B)",
  color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: 2,
  fontFamily: MONO,
  clipPath: CLIP_8,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  boxShadow: success ? "0 0 16px rgba(34,197,94,0.4)" : "0 0 16px rgba(220,38,38,0.4)",
  transition: "all 0.2s",
});

export default function Settings() {
  const { user, isMegaFan, isOwner, updateProfile } = useAuth();
  const [, navigate] = useLocation();

  const [username, setUsername] = useState(user?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string>(() => {
    const url = user?.avatar_url ?? "";
    if (!url || url.startsWith("data:")) return url;
    return url;
  });
  const [avatarMode, setAvatarMode] = useState<"url" | "upload">("url");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const [isProfilePublic, setIsProfilePublic] = useState(user?.is_profile_public ?? true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState(false);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPassFields, setShowPassFields] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState("");

  const [sendingVerif, setSendingVerif] = useState(false);
  const [verifSent, setVerifSent] = useState(false);
  const [verifError, setVerifError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#07060b", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO }}>
        <div style={{ color: "#FDBA74", fontSize: 13, letterSpacing: 2, fontWeight: 800 }}>// SISTEMA: SESION_REQUERIDA</div>
      </div>
    );
  }

  function cropToCircle(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas no disponible")); return; }
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, size, size);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Error al recortar imagen")); return; }
          resolve(new File([blob], "avatar.png", { type: "image/png" }));
        }, "image/png", 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Error al cargar imagen")); };
      img.src = objectUrl;
    });
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setAvatarError("Solo se permiten imágenes."); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarError("La imagen no debe superar 2 MB."); return; }
    setAvatarError("");
    try {
      const cropped = await cropToCircle(file);
      setSelectedFile(cropped);
      setAvatarPreview(URL.createObjectURL(cropped));
    } catch {
      setAvatarError("No se pudo recortar la imagen. Intenta con otra.");
    }
  };

  const handleSaveAvatar = async () => {
    setSavingAvatar(true);
    setAvatarError("");
    setAvatarSuccess(false);
    try {
      let finalAvatarUrl: string | null = null;
      if (avatarMode === "upload" && selectedFile) {
        const token = localStorage.getItem("af_token");
        const formData = new FormData();
        formData.append("file", selectedFile);
        const uploadRes = await fetch(`${API_BASE}/user/avatar/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Error al subir imagen");
        }
        const { avatarUrl: cloudinaryUrl } = await uploadRes.json() as { avatarUrl: string };
        finalAvatarUrl = cloudinaryUrl;
      } else if (avatarMode === "url") {
        finalAvatarUrl = avatarUrl.trim() || null;
      }
      await updateProfile({ avatar_url: finalAvatarUrl ?? "" });
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 2500);
    } catch (err: unknown) {
      setAvatarError(err instanceof Error ? err.message : "Error al guardar avatar");
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
    } catch (err: unknown) {
      setUsernameError(err instanceof Error ? err.message : "Error al guardar nombre");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleSavePrivacy = async (newValue: boolean) => {
    setSavingPrivacy(true);
    setPrivacySuccess(false);
    try {
      await updateProfile({ is_profile_public: newValue });
      setIsProfilePublic(newValue);
      setPrivacySuccess(true);
      setTimeout(() => setPrivacySuccess(false), 2500);
    } catch { /* ignore */ }
    finally { setSavingPrivacy(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError("");
    if (newPass.length < 6) { setPassError("La nueva contraseña debe tener al menos 6 caracteres"); return; }
    if (newPass !== confirmPass) { setPassError("Las contraseñas no coinciden"); return; }
    setSavingPass(true);
    try {
      await apiClient.post("/user/change-password", { currentPassword: currentPass, newPassword: newPass });
      setPassSuccess(true);
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      setTimeout(() => { setPassSuccess(false); setShowPassFields(false); }, 3000);
    } catch (err: unknown) {
      setPassError(err instanceof Error ? err.message : "Error al cambiar contraseña");
    } finally {
      setSavingPass(false);
    }
  };

  const handleSendVerification = async () => {
    setSendingVerif(true);
    setVerifError("");
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("El servidor de correo tardó demasiado. Intenta de nuevo en unos minutos.")), 30000)
      );
      await Promise.race([apiClient.post<{ ok: boolean }>("/auth/send-verification", {}), timeout]);
      setVerifSent(true);
    } catch (err: unknown) {
      setVerifError(err instanceof Error ? err.message : "Error al enviar verificación");
    } finally {
      setSendingVerif(false);
    }
  };

  const initials = user.username.charAt(0).toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString("es", { month: "long", year: "numeric" })
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at top, #14060c 0%, #07060b 60%)", position: "relative" }}>
      <Navbar />

      {/* Background scan lines */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "repeating-linear-gradient(0deg, rgba(249,115,22,0.025) 0px, rgba(249,115,22,0.025) 1px, transparent 1px, transparent 4px)",
      }} />

      {/* Hex grid bg */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(220,38,38,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(220,38,38,0.04) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at top, black 10%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at top, black 10%, transparent 70%)",
      }} />

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 16px 48px", position: "relative", zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "rgba(220,38,38,0.1)",
              border: "1px solid rgba(249,115,22,0.4)",
              clipPath: CLIP_6,
              padding: "9px 12px", cursor: "pointer", display: "flex", alignItems: "center",
              color: "#FDBA74",
            }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ color: "#F97316", fontSize: 9, fontWeight: 900, letterSpacing: 3, fontFamily: MONO, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 5, height: 5, background: "#F97316", borderRadius: "50%", boxShadow: "0 0 6px #F97316", animation: "syspulse 1.6s ease-in-out infinite" }} />
              [ SISTEMA · PANEL_DE_CONTROL ]
            </div>
            <h1 style={{
              color: "#FECACA", fontSize: 24, fontWeight: 900, margin: "4px 0 0", letterSpacing: 0.5,
              fontFamily: MONO,
              textShadow: "0 0 16px rgba(220,38,38,0.4)",
            }}>
              CONFIGURACION
            </h1>
            <p style={{ color: "rgba(253,186,116,0.6)", fontSize: 11, margin: "2px 0 0", letterSpacing: 1, fontFamily: MONO }}>
              &gt; Personaliza tu rango y datos de cazador
            </p>
          </div>
        </div>

        {/* Profile card */}
        <div style={{ ...cardStyle("carmesi"), padding: 0, overflow: "visible" }}>
          {/* Banner */}
          <div style={{
            height: 90,
            background: "linear-gradient(135deg, #2D0A14 0%, #14060c 50%, #1A0E1F 100%)",
            position: "relative",
            clipPath: "polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px)",
            overflow: "hidden",
          }}>
            {/* Magic circle in banner */}
            <svg width={90} height={90} viewBox="0 0 100 100" style={{ position: "absolute", right: 12, top: -8, opacity: 0.35, animation: "spin 30s linear infinite", filter: "drop-shadow(0 0 8px #DC2626)" }}>
              <circle cx="50" cy="50" r="46" fill="none" stroke="#DC2626" strokeWidth="0.6" strokeDasharray="2 4" />
              <circle cx="50" cy="50" r="34" fill="none" stroke="#F97316" strokeWidth="0.5" />
              <polygon points="50,12 82,68 18,68" fill="none" stroke="#FDBA74" strokeWidth="0.5" />
            </svg>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 20% 60%, rgba(220,38,38,0.4), transparent 65%)" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 40%, rgba(249,115,22,0.25), transparent 65%)" }} />
            {/* Top accent line */}
            <div style={{ position: "absolute", top: 0, left: 14, right: 0, height: 1, background: "linear-gradient(90deg, transparent, #F97316, #DC2626, transparent)", boxShadow: "0 0 8px #F97316" }} />
          </div>

          {/* Avatar */}
          <div style={{
            position: "absolute", top: 50, left: 22, zIndex: 2,
            width: 78, height: 78,
            background: "linear-gradient(135deg,#DC2626,#F97316)",
            border: "3px solid #07060b",
            clipPath: CLIP_8,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            boxShadow: "0 4px 24px rgba(220,38,38,0.6), 0 0 0 1px rgba(253,186,116,0.5)",
          }}>
            {avatarPreview
              ? <img src={avatarPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setAvatarPreview("")} />
              : <span style={{ color: "#fff", fontSize: 32, fontWeight: 900, fontFamily: MONO }}>{initials}</span>
            }
          </div>

          {/* Content */}
          <div style={{ padding: "44px 22px 22px" }}>
            <div style={{ color: "#FECACA", fontSize: 18, fontWeight: 900, marginBottom: 8, letterSpacing: 0.3, textShadow: "0 0 12px rgba(220,38,38,0.4)" }}>
              {user.username}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {isOwner && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(153,27,27,0.2))",
                  border: "1px solid rgba(252,165,165,0.5)",
                  clipPath: CLIP_6,
                  padding: "3px 10px", fontSize: 9, fontWeight: 900, color: "#FCA5A5",
                  letterSpacing: 1.5, fontFamily: MONO,
                }}>
                  <Shield size={9} /> MONARCA
                </span>
              )}
              {isMegaFan && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "linear-gradient(135deg, rgba(249,115,22,0.3), rgba(180,83,9,0.2))",
                  border: "1px solid rgba(253,186,116,0.6)",
                  clipPath: CLIP_6,
                  padding: "3px 10px", fontSize: 9, fontWeight: 900, color: "#FDBA74",
                  letterSpacing: 1.5, fontFamily: MONO,
                  boxShadow: "0 0 10px rgba(249,115,22,0.3)",
                }}>
                  <Crown size={9} /> MEGAFAN
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: "rgba(8,4,18,0.5)",
                border: "1px solid rgba(249,115,22,0.25)",
                clipPath: CLIP_6,
                padding: "5px 10px", fontSize: 10, color: "rgba(253,186,116,0.7)",
                fontFamily: MONO, letterSpacing: 0.5,
              }}>
                <Mail size={11} /> {user.email}
              </span>
              {memberSince && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  background: "rgba(8,4,18,0.5)",
                  border: "1px solid rgba(249,115,22,0.25)",
                  clipPath: CLIP_6,
                  padding: "5px 10px", fontSize: 10, color: "rgba(253,186,116,0.7)",
                  fontFamily: MONO, letterSpacing: 0.5,
                }}>
                  &gt; DESDE {memberSince.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Avatar section */}
        <div style={cardStyle("carmesi")}>
          {sectionHeader(<Camera size={14} color="#FDBA74" />, "// MODULO_01", "Foto de perfil")}

          {/* Tab selector */}
          <div style={{
            display: "flex", gap: 4, marginBottom: 14,
            background: "rgba(8,4,18,0.7)",
            border: "1px solid rgba(249,115,22,0.25)",
            padding: 4, clipPath: CLIP_6,
          }}>
            {([["url", "URL_REMOTA", <LinkIcon size={11} key="l" />], ["upload", "SUBIR_LOCAL", <Upload size={11} key="u" />]] as const).map(([mode, label, icon]) => (
              <button key={mode} onClick={() => { setAvatarMode(mode as "url" | "upload"); setAvatarError(""); }}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  padding: "8px 10px", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 900,
                  letterSpacing: 1.5, fontFamily: MONO,
                  background: avatarMode === mode ? "linear-gradient(135deg,#DC2626,#991B1B)" : "transparent",
                  color: avatarMode === mode ? "#fff" : "rgba(253,186,116,0.5)",
                  clipPath: CLIP_6,
                  transition: "all 0.15s",
                  boxShadow: avatarMode === mode ? "0 0 10px rgba(220,38,38,0.4)" : "none",
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
              style={inputStyle}
            />
          ) : (
            <div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
              <button onClick={() => fileRef.current?.click()}
                style={{
                  width: "100%", padding: "26px 14px",
                  background: "rgba(8,4,18,0.5)",
                  border: "2px dashed rgba(249,115,22,0.4)",
                  clipPath: CLIP_8,
                  color: "#FDBA74", fontSize: 11, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  fontFamily: MONO, letterSpacing: 1, fontWeight: 700,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(249,115,22,0.7)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(249,115,22,0.4)"; }}
              >
                <Upload size={22} color="#F97316" />
                <span>{selectedFile ? `> ${selectedFile.name} ✓` : "> CLICK_PARA_SELECCIONAR (max 2MB)"}</span>
              </button>
            </div>
          )}

          {avatarError && (
            <div style={{ color: "#FCA5A5", fontSize: 11, marginTop: 8, display: "flex", alignItems: "center", gap: 5, fontFamily: MONO, letterSpacing: 1 }}>
              <X size={12} /> [ERR] {avatarError}
            </div>
          )}

          <button onClick={handleSaveAvatar} disabled={savingAvatar} style={{ ...primaryBtn(avatarSuccess), marginTop: 12, opacity: savingAvatar ? 0.7 : 1 }}>
            {savingAvatar ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> GUARDANDO...</>
              : avatarSuccess ? <><Check size={13} /> AVATAR_ACTUALIZADO</>
              : <><Camera size={13} /> &gt;&gt;&gt; GUARDAR AVATAR</>}
          </button>
        </div>

        {/* Username section */}
        <div style={cardStyle("carmesi")}>
          {sectionHeader(<User size={14} color="#FDBA74" />, "// MODULO_02", "Nombre de cazador")}

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            placeholder="Tu nombre de usuario"
            style={inputStyle}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: MONO, fontSize: 10, letterSpacing: 0.5 }}>
            {usernameError
              ? <span style={{ color: "#FCA5A5", display: "flex", alignItems: "center", gap: 4 }}><X size={11} />[ERR] {usernameError}</span>
              : <span style={{ color: "rgba(253,186,116,0.4)" }}>&gt; ENTRE 2 Y 30 CARACTERES</span>
            }
            <span style={{ color: "rgba(253,186,116,0.5)" }}>{username.length}/30</span>
          </div>

          <button
            onClick={handleSaveUsername}
            disabled={savingUsername || username.trim() === user.username}
            style={{
              ...primaryBtn(usernameSuccess),
              marginTop: 12,
              opacity: (savingUsername || username.trim() === user.username) ? 0.5 : 1,
              cursor: (savingUsername || username.trim() === user.username) ? "not-allowed" : "pointer",
            }}
          >
            {savingUsername ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> GUARDANDO...</>
              : usernameSuccess ? <><Check size={13} /> NOMBRE_ACTUALIZADO</>
              : <><User size={13} /> &gt;&gt;&gt; GUARDAR NOMBRE</>}
          </button>
        </div>

        {/* Email (read-only) */}
        <div style={cardStyle("neutro")}>
          {sectionHeader(<Mail size={14} color="rgba(253,186,116,0.6)" />, "// CANAL_RAIZ", "Correo electronico")}
          <div style={{
            padding: "11px 14px",
            background: "rgba(8,4,18,0.5)",
            border: "1px solid rgba(249,115,22,0.15)",
            clipPath: CLIP_6,
            color: "rgba(253,186,116,0.6)", fontSize: 13, fontFamily: MONO,
            letterSpacing: 0.5,
          }}>
            {user.email}
          </div>
          <div style={{ color: "rgba(253,186,116,0.35)", fontSize: 10, marginTop: 6, fontFamily: MONO, letterSpacing: 1 }}>
            &gt; CAMPO_INMUTABLE · SEGURIDAD_CRITICA
          </div>
        </div>

        {/* Privacy section */}
        <div style={cardStyle("carmesi")}>
          {sectionHeader(
            isProfilePublic ? <Eye size={14} color="#FDBA74" /> : <EyeOff size={14} color="#FDBA74" />,
            "// MODULO_03", "Privacidad del perfil"
          )}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px",
            background: "rgba(8,4,18,0.5)",
            border: "1px solid rgba(249,115,22,0.25)",
            clipPath: CLIP_8,
          }}>
            <div>
              <div style={{ color: "#FECACA", fontSize: 12, fontWeight: 900, fontFamily: MONO, letterSpacing: 1 }}>
                PERFIL_PUBLICO
              </div>
              <div style={{ color: "rgba(253,186,116,0.55)", fontSize: 10, marginTop: 3, fontFamily: MONO, letterSpacing: 0.5 }}>
                &gt; {isProfilePublic ? "VISIBLE: favoritos y watchlist" : "OCULTO: lista privada"}
              </div>
            </div>
            <button
              onClick={() => !savingPrivacy && handleSavePrivacy(!isProfilePublic)}
              style={{
                width: 50, height: 26,
                border: `1px solid ${isProfilePublic ? "rgba(253,186,116,0.6)" : "rgba(255,255,255,0.15)"}`,
                cursor: savingPrivacy ? "not-allowed" : "pointer",
                background: isProfilePublic ? "linear-gradient(135deg,#DC2626,#F97316)" : "rgba(8,4,18,0.7)",
                position: "relative", transition: "all 0.2s", flexShrink: 0,
                clipPath: "polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)",
                boxShadow: isProfilePublic ? "0 0 10px rgba(220,38,38,0.5)" : "none",
              }}
            >
              <div style={{
                position: "absolute", top: 3, width: 18, height: 18,
                background: "#fff",
                clipPath: "polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)",
                transition: "left 0.2s", left: isProfilePublic ? 27 : 3,
              }} />
            </button>
          </div>
          {privacySuccess && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#22C55E", fontSize: 11, marginTop: 8, fontFamily: MONO, letterSpacing: 1 }}>
              <Check size={12} /> [ OK ] PRIVACIDAD_ACTUALIZADA
            </div>
          )}
        </div>

        {/* Email verification */}
        {!user.email_verified && (
          <div style={cardStyle("ambar")}>
            {sectionHeader(<Mail size={14} color="#F97316" />, "// ALERTA_PENDIENTE", "Verificar correo")}
            <p style={{ color: "rgba(253,186,116,0.7)", fontSize: 12, margin: "0 0 14px", lineHeight: 1.6, fontFamily: MONO, letterSpacing: 0.3 }}>
              &gt; Tu correo aun no esta verificado. Confirma tu cuenta para desbloquear todas las funciones del sistema.
            </p>
            {verifSent ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#22C55E", fontSize: 12, fontWeight: 800, fontFamily: MONO, letterSpacing: 1 }}>
                <CheckCircle2 size={14} /> [ OK ] EMAIL_ENVIADO · revisa tu bandeja
              </div>
            ) : (
              <>
                <button
                  onClick={handleSendVerification}
                  disabled={sendingVerif}
                  style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "10px 18px",
                    background: "linear-gradient(135deg, rgba(249,115,22,0.25), rgba(220,38,38,0.15))",
                    border: "1px solid rgba(249,115,22,0.6)",
                    clipPath: CLIP_8,
                    color: "#FDBA74", fontSize: 10, fontWeight: 900, letterSpacing: 1.5,
                    fontFamily: MONO,
                    cursor: sendingVerif ? "not-allowed" : "pointer",
                  }}
                >
                  {sendingVerif ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <SendHorizonal size={13} />}
                  {sendingVerif ? "ENVIANDO..." : ">>> ENVIAR VERIFICACION"}
                </button>
                {verifError && <div style={{ color: "#FCA5A5", fontSize: 11, marginTop: 8, fontFamily: MONO, letterSpacing: 0.5 }}>[ERR] {verifError}</div>}
              </>
            )}
          </div>
        )}

        {user.email_verified && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
            background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(22,163,74,0.05))",
            border: "1px solid rgba(34,197,94,0.4)",
            clipPath: CLIP_8,
            marginBottom: 14,
            fontFamily: MONO, letterSpacing: 1,
          }}>
            <CheckCircle2 size={15} color="#22C55E" />
            <span style={{ color: "#22C55E", fontSize: 11, fontWeight: 900 }}>[ OK ] CORREO_VERIFICADO</span>
          </div>
        )}

        {/* Change password */}
        <div style={cardStyle("neutro")}>
          <button
            onClick={() => { setShowPassFields(v => !v); setPassError(""); setPassSuccess(false); }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34,
                background: "linear-gradient(135deg, rgba(220,38,38,0.2), rgba(249,115,22,0.15))",
                border: "1px solid rgba(249,115,22,0.4)",
                clipPath: CLIP_6,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <KeyRound size={14} color="#FDBA74" />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ color: "#F97316", fontSize: 9, fontWeight: 900, letterSpacing: 2, fontFamily: MONO }}>// MODULO_04</div>
                <div style={{ color: "#FECACA", fontSize: 14, fontWeight: 900, letterSpacing: 0.3, marginTop: 1 }}>Cambiar contrase&ntilde;a</div>
              </div>
            </div>
            <span style={{
              color: "#F97316", fontSize: 18, lineHeight: 1, fontWeight: 900, fontFamily: MONO,
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(249,115,22,0.1)",
              border: "1px solid rgba(249,115,22,0.35)",
              clipPath: CLIP_6,
            }}>{showPassFields ? "−" : "+"}</span>
          </button>

          {showPassFields && (
            <form onSubmit={handleChangePassword} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {(["Contrase\u00f1a actual", "Nueva contrase\u00f1a", "Confirmar nueva"] as const).map((label, i) => {
                const value = i === 0 ? currentPass : i === 1 ? newPass : confirmPass;
                const setter = i === 0 ? setCurrentPass : i === 1 ? setNewPass : setConfirmPass;
                return (
                  <div key={label} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <KeyRound size={12} style={{ position: "absolute", left: 12, color: "rgba(253,186,116,0.5)", zIndex: 1 }} />
                    <input
                      type="password"
                      placeholder={label}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      required
                      style={{ ...inputStyle, paddingLeft: 34 }}
                      onFocus={(e) => (e.target.style.borderColor = "rgba(249,115,22,0.7)")}
                      onBlur={(e) => (e.target.style.borderColor = "rgba(249,115,22,0.35)")}
                    />
                  </div>
                );
              })}
              {passError && (
                <div style={{ color: "#FCA5A5", fontSize: 11, display: "flex", alignItems: "center", gap: 5, fontFamily: MONO, letterSpacing: 0.5 }}>
                  <X size={11} /> [ERR] {passError}
                </div>
              )}
              <button type="submit" disabled={savingPass} style={{ ...primaryBtn(passSuccess), opacity: savingPass ? 0.7 : 1 }}>
                {savingPass ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> GUARDANDO...</>
                  : passSuccess ? <><Check size={13} /> CONTRASE&Ntilde;A_ACTUALIZADA</>
                  : <><KeyRound size={13} /> &gt;&gt;&gt; ACTUALIZAR CONTRASE&Ntilde;A</>}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes syspulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
      `}</style>
    </div>
  );
}
