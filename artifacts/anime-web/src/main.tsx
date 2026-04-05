import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  // 1. Registrar el SW de AnimeFlex que bloquea notificaciones push de anuncios
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}afsw.js`)
    .catch(() => {});

  // 2. Eliminar todos los SWs de redes publicitarias (Monetag/5gvci.com)
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
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
        url.includes("sw_") ||
        /\/sw_\d+\.js/.test(url);
      if (isAd) reg.unregister();
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
