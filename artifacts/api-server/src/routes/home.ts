import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

const ANILIST_URL = "https://graphql.anilist.co";

const featuredCache = new Map<string, { at: number; data: any }>();
const FEATURED_TTL = 60 * 1000;
const watchlistCache = new Map<number, { at: number; data: any }>();
const WATCHLIST_TTL = 5 * 60 * 1000;
const discussionsCache = new Map<string, { at: number; data: any }>();
const DISCUSSIONS_TTL = 60 * 1000;

router.get("/featured-content", async (_req, res) => {
  const cacheKey = "featured";
  const hit = featuredCache.get(cacheKey);
  if (hit && Date.now() - hit.at < FEATURED_TTL) {
    res.json(hit.data);
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, anime_id, anime_title, anime_image, action, created_at
       FROM admin_content
       WHERE action IN ('featured', 'highlight', 'destacado', 'pin')
       ORDER BY created_at DESC LIMIT 12`
    );
    const data = { items: rows };
    featuredCache.set(cacheKey, { at: Date.now(), data });
    res.json(data);
  } catch {
    res.json({ items: [] });
  }
});

router.get("/discussions/active", async (_req, res) => {
  const cacheKey = "active";
  const hit = discussionsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < DISCUSSIONS_TTL) {
    res.json(hit.data);
    return;
  }
  try {
    const { rows } = await pool.query(
      `WITH ranked AS (
         SELECT
           c.anime_id,
           COUNT(*)::int AS comment_count,
           MAX(c.created_at) AS last_at,
           (SELECT text FROM anime_comments c2
              WHERE c2.anime_id = c.anime_id
              ORDER BY c2.likes DESC, c2.created_at DESC LIMIT 1) AS top_comment,
           (SELECT u.username FROM anime_comments c3
              JOIN users u ON u.id = c3.user_id
              WHERE c3.anime_id = c.anime_id
              ORDER BY c3.likes DESC, c3.created_at DESC LIMIT 1) AS top_user
         FROM anime_comments c
         WHERE c.created_at >= NOW() - INTERVAL '7 days'
         GROUP BY c.anime_id
         ORDER BY comment_count DESC, last_at DESC
         LIMIT 6
       )
       SELECT r.*, h.anime_title, h.anime_image
       FROM ranked r
       LEFT JOIN LATERAL (
         SELECT anime_title, anime_image FROM user_history
         WHERE anime_id = r.anime_id
         ORDER BY watched_at DESC LIMIT 1
       ) h ON TRUE`
    );
    const data = { items: rows };
    discussionsCache.set(cacheKey, { at: Date.now(), data });
    res.json(data);
  } catch {
    res.json({ items: [] });
  }
});

router.get("/user/watchlist/new-episodes", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const cached = watchlistCache.get(userId);
  if (cached && Date.now() - cached.at < WATCHLIST_TTL) {
    res.json(cached.data);
    return;
  }
  try {
    const { rows } = await pool.query<{ anime_id: string; anime_title: string; anime_image: string }>(
      `SELECT anime_id, anime_title, anime_image
       FROM user_watchlist
       WHERE user_id = $1 AND status IN ('watching', 'plan_to_watch', 'planning')`,
      [userId]
    );
    const ids = rows
      .map((r) => parseInt(r.anime_id, 10))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 50);
    if (ids.length === 0) {
      const empty = { items: [] };
      watchlistCache.set(userId, { at: Date.now(), data: empty });
      res.json(empty);
      return;
    }

    const lastSeenRes = await pool.query<{ anime_id: string; max_ep: number }>(
      `SELECT anime_id, MAX(episode_number)::int AS max_ep
       FROM user_history
       WHERE user_id = $1 AND anime_id = ANY($2::text[])
       GROUP BY anime_id`,
      [userId, rows.map((r) => r.anime_id)]
    );
    const lastSeen = new Map(lastSeenRes.rows.map((r) => [r.anime_id, r.max_ep ?? 0]));

    const query = `
      query ($ids: [Int]) {
        Page(perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id
            title { romaji english }
            coverImage { large }
            status
            episodes
            nextAiringEpisode { airingAt episode timeUntilAiring }
          }
        }
      }
    `;
    const aniRes = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { ids } }),
    });
    if (!aniRes.ok) throw new Error("anilist");
    const aniJson: any = await aniRes.json();
    const media: any[] = aniJson?.data?.Page?.media ?? [];

    const now = Math.floor(Date.now() / 1000);
    const items = media
      .map((m) => {
        const id = String(m.id);
        const seen = lastSeen.get(id) ?? 0;
        const next = m.nextAiringEpisode?.episode ?? null;
        const aired = next ? Math.max(0, next - 1) : m.episodes ?? 0;
        const timeUntil: number | null = m.nextAiringEpisode?.timeUntilAiring ?? null;
        const justAired = m.nextAiringEpisode?.airingAt
          ? now - m.nextAiringEpisode.airingAt < 7 * 24 * 3600 && now > m.nextAiringEpisode.airingAt
          : false;
        const hasNew = aired > seen;
        const upcomingSoon = timeUntil != null && timeUntil > 0 && timeUntil < 24 * 3600;
        if (!hasNew && !upcomingSoon) return null;
        const fallback = rows.find((r) => r.anime_id === id);
        return {
          animeId: id,
          title: m.title?.english || m.title?.romaji || fallback?.anime_title || "",
          image: m.coverImage?.large || fallback?.anime_image || "",
          airedEpisodes: aired,
          lastSeenEpisode: seen,
          newEpisodes: Math.max(0, aired - seen),
          nextEpisode: next,
          nextAiringAt: m.nextAiringEpisode?.airingAt ?? null,
          timeUntilAiring: timeUntil,
          status: m.status,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => (b.newEpisodes ?? 0) - (a.newEpisodes ?? 0));

    const data = { items };
    watchlistCache.set(userId, { at: Date.now(), data });
    res.json(data);
  } catch {
    res.json({ items: [] });
  }
});

export default router;
