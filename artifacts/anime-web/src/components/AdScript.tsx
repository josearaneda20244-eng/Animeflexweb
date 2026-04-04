import { useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AdScript() {
  const { isMegaFan, loading } = useAuth();
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  useEffect(() => {
    if (loading) return;

    if (isMegaFan) {
      if (scriptRef.current) {
        scriptRef.current.remove();
        scriptRef.current = null;
      }
      return;
    }

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
  }, [isMegaFan, loading]);

  return null;
}
