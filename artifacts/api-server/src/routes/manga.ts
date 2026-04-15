import { MANGA } from "@consumet/extensions";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

let mangaDex: InstanceType<typeof MANGA.MangaDex>;
function getMangaDex() {
  if (!mangaDex) mangaDex = new MANGA.MangaDex();
  return mangaDex;
}

// Simple in-memory cache
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 1000 * 60 * 10; // 10 min

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data as T;
}
function setCached(key: string, data: unknown) {
  if (cache.size > 200) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { data, ts: Date.now() });
}

/**
 * GET /api/manga/trending
 * Returns trending/popular manga
 */
router.get("/manga/trending", async (req, res) => {
  const page = parseInt((req.query.page as string) ?? "1", 10) || 1;
  const key = `trending:${page}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await getMangaDex().fetchPopular(page);
    setCached(key, data);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trending manga");
    res.status(500).json({ error: "Failed to fetch trending manga" });
  }
});

/**
 * GET /api/manga/recent
 * Returns recently updated manga
 */
router.get("/manga/recent", async (req, res) => {
  const page = parseInt((req.query.page as string) ?? "1", 10) || 1;
  const key = `recent:${page}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await getMangaDex().fetchRecentlyAdded(page);
    setCached(key, data);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch recent manga");
    res.status(500).json({ error: "Failed to fetch recent manga" });
  }
});

/**
 * GET /api/manga/search?q=...&page=1
 */
router.get("/manga/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  const page = parseInt((req.query.page as string) ?? "1", 10) || 1;
  if (!q) { res.status(400).json({ error: "Query param 'q' is required" }); return; }
  const key = `search:${q}:${page}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await getMangaDex().search(q, page);
    setCached(key, data);
    res.json(data);
  } catch (err) {
    req.log.error({ err, q }, "Failed to search manga");
    res.status(500).json({ error: "Failed to search manga" });
  }
});

/**
 * GET /api/manga/info/:id
 */
router.get("/manga/info/:id", async (req, res) => {
  const { id } = req.params;
  const key = `info:${id}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await getMangaDex().fetchMangaInfo(id);
    setCached(key, data);
    res.json(data);
  } catch (err) {
    req.log.error({ err, id }, "Failed to fetch manga info");
    res.status(500).json({ error: "Failed to fetch manga info" });
  }
});

/**
 * GET /api/manga/chapter/:id
 * Returns chapter pages
 */
router.get("/manga/chapter/:id", async (req, res) => {
  const { id } = req.params;
  const key = `chapter:${id}`;
  const cached = getCached(key);
  if (cached) { res.json(cached); return; }
  try {
    const data = await getMangaDex().fetchChapterPages(id);
    setCached(key, data);
    res.json(data);
  } catch (err) {
    req.log.error({ err, id }, "Failed to fetch chapter pages");
    res.status(500).json({ error: "Failed to fetch chapter pages" });
  }
});

export default router;
