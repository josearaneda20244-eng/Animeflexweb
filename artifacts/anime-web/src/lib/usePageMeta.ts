import { useEffect } from "react";

export const SITE_NAME = "IZIFF ANIME";
export const SITE_URL = "https://animeflex.lat";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph.jpg`;
export const DEFAULT_DESCRIPTION =
  "Mira anime y lee manga online en 1080p con subtítulos en español latino y castellano. Tendencias, calendario de emisión y últimos episodios.";

type OgType = "website" | "video.episode" | "video.tv_show" | "video.movie" | "book" | "article" | "profile";

interface PageMeta {
  title: string;
  description?: string;
  /** Imagen para la tarjeta al compartir (absoluta o relativa al sitio). */
  image?: string;
  imageAlt?: string;
  url?: string;
  type?: OgType;
  /** Evita la indexación (p. ej. perfil, ajustes, lector). */
  noindex?: boolean;
  /** schema.org JSON-LD (objeto o array) para resultados enriquecidos. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const JSON_LD_SCRIPT_ID = "page-jsonld";

function absUrl(u?: string): string {
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!content) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function clip(text: string, max = 200): string {
  const t = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Metadatos dinámicos por página: título, descripción, OpenGraph (Facebook/WhatsApp/Discord),
 * Twitter Cards, canonical y JSON-LD. Los crawlers que ejecutan JS (Google, Bing, Discord)
 * leen estos valores; para Facebook/Twitter el servidor también sirve /api/og/* (ver vercel.json).
 */
export function usePageMeta({ title, description, image, imageAlt, url, type = "website", noindex, jsonLd }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const desc = clip(description || DEFAULT_DESCRIPTION);
    const img = absUrl(image) || DEFAULT_OG_IMAGE;
    const finalUrl = url ?? (typeof window !== "undefined" ? `${SITE_URL}${window.location.pathname}${window.location.search}` : SITE_URL);

    document.title = fullTitle;
    setMeta("description", desc);
    setMeta("robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");

    setMeta("og:site_name", SITE_NAME, "property");
    setMeta("og:locale", "es_LA", "property");
    setMeta("og:type", type, "property");
    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", desc, "property");
    setMeta("og:url", finalUrl, "property");
    setMeta("og:image", img, "property");
    setMeta("og:image:secure_url", img.startsWith("https://") ? img : "", "property");
    setMeta("og:image:alt", imageAlt || fullTitle, "property");

    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", desc);
    setMeta("twitter:image", img);
    setMeta("twitter:image:alt", imageAlt || fullTitle);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", finalUrl);

    if (jsonLd) {
      let el = document.head.querySelector<HTMLScriptElement>(`script#${JSON_LD_SCRIPT_ID}`);
      if (!el) {
        el = document.createElement("script");
        el.id = JSON_LD_SCRIPT_ID;
        el.type = "application/ld+json";
        document.head.appendChild(el);
      }
      try { el.textContent = JSON.stringify(jsonLd); } catch { /* ignore */ }
    }

    return () => {
      document.title = prevTitle;
      if (jsonLd) document.head.querySelector(`script#${JSON_LD_SCRIPT_ID}`)?.remove();
      if (noindex) setMeta("robots", "index, follow, max-image-preview:large");
    };
  }, [title, description, image, imageAlt, url, type, noindex, jsonLd]);
}
