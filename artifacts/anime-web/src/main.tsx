import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Kill ALL ad/push-notification service workers immediately on page load
// This runs before React mounts so it catches Monetag (5gvci.com) SW fast
if ("serviceWorker" in navigator) {
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
        url.includes("push-sw") ||
        /\/sw_\d+\.js/.test(url);
      if (isAd) {
        reg.unregister();
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
