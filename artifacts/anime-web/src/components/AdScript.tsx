import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

// Aggressive SW cleanup — kills Monetag (5gvci.com) and similar ad networks
async function killAdServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const url =
        reg.active?.scriptURL ||
        reg.installing?.scriptURL ||
        reg.waiting?.scriptURL ||
        "";
      const isAd =
        url.includes("5gvci.com") ||
        url.includes("monetag") ||
        url.includes("multitag") ||
        url.includes("al5sm") ||
        url.includes("push") ||
        url.includes("sw_") ||
        /\/sw_\d+\.js/.test(url);
      if (isAd) await reg.unregister();
    }
  } catch {}
}

export default function AdScript() {
  const { isMegaFan, loading, user } = useAuth();
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (loading) return;

    if (isMegaFan) {
      // Remove ad script if loaded
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      // Kill any remaining ad service workers
      killAdServiceWorkers();
      return;
    }

    // Not MegaFan: load ad script for authenticated or anonymous users
    if (scriptRef.current) return;

    const s = document.createElement("script");
    s.dataset.zone = "10828787";
    s.src = "https://al5sm.com/tag.min.js";
    document.head.appendChild(s);
    scriptRef.current = s;

    return () => {
      s.remove();
      scriptRef.current = null;
    };
  }, [isMegaFan, loading, user]);

  return null;
}
