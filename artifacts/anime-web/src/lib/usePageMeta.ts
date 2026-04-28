import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  /** schema.org JSON-LD object (or array) for rich snippets in search engines. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const JSON_LD_SCRIPT_ID = "page-jsonld";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  if (!content) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function usePageMeta({ title, description, image, url, jsonLd }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
    }

    setMeta("og:title", title, "property");
    setMeta("og:type", "website", "property");
    setMeta("og:site_name", "AnimeFlex", "property");
    setMeta("twitter:title", title);
    setMeta("twitter:card", "summary_large_image");

    if (image) {
      setMeta("og:image", image, "property");
      setMeta("twitter:image", image);
    }

    const finalUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (finalUrl) {
      setMeta("og:url", finalUrl, "property");
      let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", finalUrl);
    }

    // Structured data (JSON-LD) — rich snippets for Google/Bing without UI changes.
    let jsonLdEl: HTMLScriptElement | null = null;
    if (jsonLd) {
      jsonLdEl = document.head.querySelector<HTMLScriptElement>(`script#${JSON_LD_SCRIPT_ID}`);
      if (!jsonLdEl) {
        jsonLdEl = document.createElement("script");
        jsonLdEl.id = JSON_LD_SCRIPT_ID;
        jsonLdEl.type = "application/ld+json";
        document.head.appendChild(jsonLdEl);
      }
      try {
        jsonLdEl.textContent = JSON.stringify(jsonLd);
      } catch {
        /* ignore serialization errors */
      }
    }

    return () => {
      document.title = prevTitle;
      if (jsonLd) {
        const el = document.head.querySelector<HTMLScriptElement>(`script#${JSON_LD_SCRIPT_ID}`);
        if (el) el.remove();
      }
    };
  }, [title, description, image, url, jsonLd]);
}
