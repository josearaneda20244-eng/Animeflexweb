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
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m) return m[1];
  }
  return undefined;
}

function parseRss(xml: string, source: string): NewsItem[] {
  const itemRegex = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  const items: NewsItem[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const raw = m[1];
    const title = decodeText(extractTag(raw, "title"));
    const link = decodeText(extractTag(raw, "link"));
    const description = decodeText(extractTag(raw, "description")).slice(0, 240);
    const pubDate = decodeText(extractTag(raw, "pubDate") || extractTag(raw, "dc:date"));
    if (!title || !link) continue;
    items.push({
      title,
      link,
      description,
      pubDate,
      image: findImage(raw),
      source,
    });
  }
  return items;
}

async function fetchSource(url: string, name: string, perSourceLimit: number): Promise<NewsItem[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AnimeFlex/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const xml = await r.text();
    return parseRss(xml, name).slice(0, perSourceLimit);
  } catch {
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
    { url: "https://www.kudasai.community/rss/", name: "Kudasai" },
    { url: "https://anmtvla.com/feed", name: "ANMTV" },
    { url: "https://www.ramenparados.com/feed/", name: "Ramen Para Dos" },
  ];
  const buckets = await Promise.all(
    sources.map((s) => fetchSource(s.url, s.name, 6))
  );
  const all = buckets.flat();
  // Sort by pubDate desc (fallback: keep original order)
  all.sort((a, b) => {
    const da = new Date(a.pubDate).getTime() || 0;
    const db = new Date(b.pubDate).getTime() || 0;
    return db - da;
  });
  const items = all.slice(0, 12);
  if (items.length > 0) {
    cache = { items, timestamp: Date.now() };
  }
  res.json({ items, cached: false, count: items.length });
});

export default router;
