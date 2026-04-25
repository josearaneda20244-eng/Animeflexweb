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

function decodeText(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(item: string, tag: string): string {
  const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
}

function findImage(raw: string): string | undefined {
  const patterns = [
    /<media:content[^>]+url=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i,
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
    /<enclosure[^>]+url=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i,
    /<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i,
    /src=["']([^"']*wp-content[^"']+\.(?:jpe?g|png|webp))["']/i,
    /url=["']([^"']+\.(?:jpe?g|png|webp))["']/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
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
