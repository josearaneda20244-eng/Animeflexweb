import { useEffect, useState } from "react";
import { useParams } from "wouter";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePageMeta } from "@/lib/usePageMeta";
import { useAuth } from "@/context/AuthContext";
import { hasIziffSession } from "@/lib/iziffAuth";
import { joinWatchRoom, normalizeRoomCode, useWatchRoom } from "@/lib/watchRoom";
import { WatchTogetherPanel } from "@/components/WatchTogether";

/** /sala y /sala/:code — crear o unirse a una sala "Ver juntos" (enlace de invitación). */
export default function WatchRoomPage() {
  const params = useParams<{ code?: string }>();
  const code = normalizeRoomCode(params.code ?? "");
  const { user, loading } = useAuth();
  const room = useWatchRoom();
  const [error, setError] = useState<string | null>(null);
  usePageMeta({ title: "Ver juntos", description: "Mira anime al mismo tiempo que tus amigos en una sala privada.", noindex: true });

  useEffect(() => {
    if (loading || !user || !hasIziffSession() || code.length !== 6) return;
    if (room.code === code && room.status !== "idle") return;
    joinWatchRoom(code).catch((e) => setError(e instanceof Error ? e.message : "No se pudo entrar a la sala."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user, loading]);

  return (
    <div className="iz-page">
      <Navbar />
      <main className="iz-container" style={{ maxWidth: 560 }}>
        <header className="iz-pagehead">
          <h1>Ver <span className="iz-serif">juntos</span></h1>
          <p>{code ? `Te invitaron a la sala ${code}.` : "Salas privadas para ver el mismo episodio al mismo tiempo."}</p>
        </header>
        {error && <div style={{ color: "#f87171", fontSize: 14, marginBottom: 12 }}>{error}</div>}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 18, color: "#fff" }}>
          <WatchTogetherPanel />
        </div>
      </main>
      <Footer />
    </div>
  );
}
