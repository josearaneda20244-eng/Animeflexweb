import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  image?: string;
  url?: string;
}

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

export function usePageMeta({ title, description, image, url }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
    }

    setMeta("og:title", title, "property");
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

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, image, url]);
}
