import { Router } from "express";

const router = Router();

interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image?: string;
  source: string;
}

let cache: { items: NewsItem[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const NEWS_CACHE_VERSION = 4; // bump para invalidar cualquier caché en memoria al desplegar

function stripTagsOnce(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, " $1 ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/<\/?[a-zA-Z][^>]*$/g, " "); // tag cortada al final del slice
}

// Tabla de entidades HTML con nombre (cubre todos los acentos en español
// + signos comunes). Crítico para feeds que escapan tildes y eñes (Kudasai),
// que de lo contrario aparecen como "v&iacute;ctima" en la UI.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  // Vocales acentuadas (minúsculas)
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  // Vocales acentuadas (mayúsculas)
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
  // Eñe
  ntilde: "ñ", Ntilde: "Ñ",
  // Diéresis (pingüino)
  auml: "ä", euml: "ë", iuml: "ï", ouml: "ö", uuml: "ü",
  Auml: "Ä", Euml: "Ë", Iuml: "Ï", Ouml: "Ö", Uuml: "Ü",
  // Acentos graves / circunflejos / tildes (texto importado del francés/portugués)
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  Agrave: "À", Egrave: "È", Igrave: "Ì", Ograve: "Ò", Ugrave: "Ù",
  acirc: "â", ecirc: "ê", icirc: "î", ocirc: "ô", ucirc: "û",
  Acirc: "Â", Ecirc: "Ê", Icirc: "Î", Ocirc: "Ô", Ucirc: "Û",
  atilde: "ã", otilde: "õ", Atilde: "Ã", Otilde: "Õ",
  aring: "å", Aring: "Å", aelig: "æ", AElig: "Æ",
  ccedil: "ç", Ccedil: "Ç", oslash: "ø", Oslash: "Ø",
  szlig: "ß",
  // Signos de puntuación españoles
  iexcl: "¡", iquest: "¿",
  // Comillas tipográficas y guiones
  laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  sbquo: "‚", bdquo: "„", lsaquo: "‹", rsaquo: "›",
  mdash: "—", ndash: "–", hellip: "…",
  // Símbolos comunes
  copy: "©", reg: "®", trade: "™", deg: "°",
  middot: "·", bull: "•", dagger: "†", Dagger: "‡",
  permil: "‰", para: "¶", sect: "§",
  euro: "€", pound: "£", yen: "¥", cent: "¢",
  plusmn: "±", times: "×", divide: "÷",
  frac12: "½", frac14: "¼", frac34: "¾",
  larr: "←", uarr: "↑", rarr: "→", darr: "↓",
  // Especial: &#039; numérico ya cubierto, pero por compatibilidad explícita
  "#039": "'", "#39": "'",
};

function decodeEntitiesOnce(s: string): string {
  return s
    // Entidades con nombre (incluyendo Spanish: &iacute; etc.)
    .replace(/&([a-zA-Z]{2,8});/g, (m, name) => NAMED_ENTITIES[name] ?? m)
    // Decimal: &#123;
    .replace(/&#(\d+);/g, (_, n) => {
      const code = parseInt(n, 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    })
    // Hex: &#x7B;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : "";
    });
}

function decodeText(s: string): string {
  if (!s) return "";
  let out = String(s);
  // Iterar: limpiar tags, decodificar entidades, repetir.
  // Esto cubre HTML simple (<div>), HTML escapado (&lt;div&gt;) y doble-escapado
  // (&amp;lt;div&amp;gt;) que aparecen frecuentemente en feeds de Blogger/WordPress.
  for (let i = 0; i < 6; i++) {
    const before = out;
    out = stripTagsOnce(out);
    out = decodeEntitiesOnce(out);
    if (out === before) break;
  }
  // Pasadas finales por si quedaron tags tras la última decodificación
  out = stripTagsOnce(out);
  // Limpieza visual final
  out = out
    .replace(/\[…\]|\[\.\.\.\]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width chars
    .replace(/\s+([.,;:!?])/g, "$1") // espacios antes de puntuación
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

function upgradeImageUrl(url: string): string {
  if (!url) return url;
  try {
    let upgraded = url
      // WordPress: archivo-300x200.jpg → archivo.jpg (quita el sufijo de redimensión)
      .replace(/-(\d{2,4})x(\d{2,4})(\.(?:jpe?g|png|webp|gif))(\?.*)?$/i, "$3$4")
      // Google/Blogger: /s72-c/ /s320/ /w200-h300/ → /s1600/
      .replace(/\/s\d{2,4}(?:-c)?\//, "/s1600/")
      .replace(/\/w\d+-h\d+(?:-[a-z\-]+)?\//, "/s1600/")
      // Parámetros de querystring de tamaño
      .replace(/([?&])(?:w|width|h|height|resize|size|quality)=\d+/gi, "$1")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
    // Forzar https
    if (upgraded.startsWith("http://")) upgraded = "https://" + upgraded.slice(7);
    return upgraded;
  } catch {
    return url;
  }
}

function extractTag(item: string, tag: string): string {
  const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
}

function findImage(raw: string): string | undefined {
  // 1) Preferir <media:content url=... width=... height=...> con dimensiones grandes
  const mediaContentAll = [...raw.matchAll(/<media:content\s+([^>]+)>/gi)];
  let bestMedia: { url: string; area: number } | null = null;
  for (const mc of mediaContentAll) {
    const attrs = mc[1];
    const url = (attrs.match(/url=["']([^"']+)["']/i) || [])[1];
    if (!url || !/\.(?:jpe?g|png|webp|gif)/i.test(url)) continue;
    const w = parseInt((attrs.match(/width=["']?(\d+)/i) || [])[1] || "0", 10);
    const h = parseInt((attrs.match(/height=["']?(\d+)/i) || [])[1] || "0", 10);
    const area = w * h || 1;
    if (!bestMedia || area > bestMedia.area) bestMedia = { url, area };
  }
  if (bestMedia) return upgradeImageUrl(bestMedia.url);

  // 2) Si hay <img srcset="...">, escoger la URL con mayor descriptor (1024w, 2x, etc.)
  const srcsetMatches = [...raw.matchAll(/srcset=["']([^"']+)["']/gi)];
  let bestSrcset: { url: string; weight: number } | null = null;
  for (const sm of srcsetMatches) {
    const candidates = sm[1].split(",").map(c => c.trim());
    for (const c of candidates) {
      const parts = c.split(/\s+/);
      const url = parts[0];
      if (!url || !/\.(?:jpe?g|png|webp|gif)/i.test(url)) continue;
      const desc = parts[1] || "";
      const wMatch = desc.match(/(\d+)w/);
      const xMatch = desc.match(/(\d+(?:\.\d+)?)x/);
      const weight = wMatch ? parseInt(wMatch[1], 10) : (xMatch ? parseFloat(xMatch[1]) * 1000 : 100);
      if (!bestSrcset || weight > bestSrcset.weight) bestSrcset = { url, weight };
    }
  }
  if (bestSrcset) return upgradeImageUrl(bestSrcset.url);

  // 3) Patrones generales
  const patterns = [
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i,
    /<img[^>]+data-src=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i,
    /<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i,
    /src=["']([^"']*wp-content[^"']+\.(?:jpe?g|png|webp))["']/i,
    /url=["']([^"']+\.(?:jpe?g|png|webp))["']/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return upgradeImageUrl(m[1]);
  }
  return undefined;
}

function extractAtomLink(raw: string): string {
  // Atom: <link rel="alternate" href="..."/> — prefer alternate over self
  const altMatch = raw.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i)
    || raw.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["']/i);
  if (altMatch) return altMatch[1];
  // First link without self
  const links = [...raw.matchAll(/<link\s+([^>]+)>/gi)];
  for (const l of links) {
    if (/rel=["']self["']/i.test(l[1])) continue;
    const h = l[1].match(/href=["']([^"']+)["']/i);
    if (h) return h[1];
  }
  return "";
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  // Try RSS <item>
  const itemRegex = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const raw = m[1];
    const title = decodeText(extractTag(raw, "title"));
    const link = decodeText(extractTag(raw, "link"));
    const description = decodeText(extractTag(raw, "description") || extractTag(raw, "content:encoded")).slice(0, 240);
    const pubDate = decodeText(extractTag(raw, "pubDate") || extractTag(raw, "dc:date"));
    if (!title || !link) continue;
    items.push({ title, link, description, pubDate, image: findImage(raw), source });
  }
  if (items.length > 0) return items;

  // Try Atom <entry>
  const entryRegex = /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRegex.exec(xml)) !== null) {
    const raw = m[1];
    const title = decodeText(extractTag(raw, "title"));
    const link = extractAtomLink(raw);
    const description = decodeText(extractTag(raw, "summary") || extractTag(raw, "content")).slice(0, 240);
    const pubDate = decodeText(extractTag(raw, "published") || extractTag(raw, "updated"));
    if (!title || !link) continue;
    items.push({ title, link, description, pubDate, image: findImage(raw), source });
  }
  return items;
}

async function fetchSource(url: string, name: string, perSourceLimit: number): Promise<NewsItem[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!r.ok) {
      console.warn(`[news] ${name} returned ${r.status}`);
      return [];
    }
    const xml = await r.text();
    const parsed = parseRss(xml, name).slice(0, perSourceLimit);
    if (parsed.length === 0) {
      console.warn(`[news] ${name} parsed 0 items (size=${xml.length})`);
    }
    return parsed;
  } catch (err) {
    console.warn(`[news] ${name} error:`, (err as Error).message);
    return [];
  }
}

/* ── GET /news/anime — aggregated Spanish anime news (cached 30min) ── */
router.get("/news/anime", async (_req, res) => {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    res.json({ items: cache.items, cached: true, count: cache.items.length });
    return;
  }
  const sources = [
    { url: "https://somoskudasai.com/feed/", name: "Kudasai" },
    { url: "https://www.anmtvla.com/feeds/posts/default?alt=rss&max-results=15", name: "ANMTV" },
    { url: "https://www.ramenparados.com/feed/", name: "Ramen Para Dos" },
  ];
  const buckets = await Promise.all(
    sources.map((s) => fetchSource(s.url, s.name, 8))
  );
  const all = buckets.flat();
  // Sort by pubDate desc
  all.sort((a, b) => {
    const da = new Date(a.pubDate).getTime() || 0;
    const db = new Date(b.pubDate).getTime() || 0;
    return db - da;
  });
  // Dedupe by link
  const seen = new Set<string>();
  const deduped = all.filter((n) => (seen.has(n.link) ? false : (seen.add(n.link), true)));
  const items = deduped.slice(0, 18);
  if (items.length > 0) {
    cache = { items, timestamp: Date.now() };
  }
  res.json({ items, cached: false, count: items.length });
});

/* ── POST /news/anime/refresh — clear cache (admin/debug helper) ── */
router.post("/news/anime/refresh", (_req, res) => {
  cache = null;
  res.json({ ok: true, message: "News cache cleared" });
});

export default router;
