import { useState, useEffect } from "react";
import { apiClient } from "@/lib/apiClient";
import { X, Info, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Announcement {
  id: number;
  message: string;
  type: string;
  created_at: string;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; color: string; icon: React.ReactNode }> = {
  info: { bg: "rgba(6,182,212,0.08)", border: "rgba(6,182,212,0.25)", color: "#06B6D4", icon: <Info size={15} /> },
  warning: { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", color: "#F59E0B", icon: <AlertTriangle size={15} /> },
  success: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", color: "#22C55E", icon: <CheckCircle2 size={15} /> },
};

const DISMISSED_KEY = "af_dismissed_announcements";

function getDismissed(): number[] {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); } catch { return []; }
}
function dismiss(id: number) {
  try {
    const d = getDismissed();
    if (!d.includes(id)) localStorage.setItem(DISMISSED_KEY, JSON.stringify([...d, id]));
  } catch {}
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    apiClient.get<{ announcements: Announcement[] }>("/announcements")
      .then(d => {
        const dismissed = getDismissed();
        setAnnouncements(d.announcements.filter(a => !dismissed.includes(a.id)));
      })
      .catch(() => {});
  }, []);

  const handleDismiss = (id: number) => {
    dismiss(id);
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  if (announcements.length === 0) return null;

  const ann = announcements[0];
  const style = TYPE_STYLES[ann.type] ?? TYPE_STYLES.info;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9000,
      background: style.bg, borderBottom: `1px solid ${style.border}`,
      backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px",
    }}>
      <span style={{ color: style.color, flexShrink: 0 }}>{style.icon}</span>
      <span style={{ color: "#F1F1F5", fontSize: 13, fontWeight: 600, flex: 1 }}>{ann.message}</span>
      <button
        onClick={() => handleDismiss(ann.id)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.4)", padding: 4, flexShrink: 0,
          display: "flex", alignItems: "center",
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
