import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

async function unregisterAdServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const scriptURL = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
      if (
        scriptURL.includes("al5sm") ||
        scriptURL.includes("monetag") ||
        scriptURL.includes("push") ||
        scriptURL.includes("sw.js") ||
        scriptURL.includes("serviceworker")
      ) {
        await reg.unregister();
      }
    }
  } catch {}
}

export default function AdScript() {
  const { isMegaFan, loading, user } = useAuth();
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (loading) return;

    if (isMegaFan) {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      unregisterAdServiceWorkers();
      return;
    }

    if (!user) return;

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
