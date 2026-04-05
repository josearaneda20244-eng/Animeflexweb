import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";
import { ObjectStorageService } from "../lib/objectStorage.js";

interface DailyViewRow { day: string; episodes: number }
interface TopAnimeRow { anime_id: string; anime_title: string; anime_image: string; ep_count: string }
interface AnimeListRow { anime_id: string; anime_title: string; anime_image: string; anime_type: string; status?: string }

/* ── PUBLIC ROUTER (no auth required) ── */
export const publicUserRouter = Router();

async function handlePublicProfile(userId: number, res: import("express").Response) {
  const userRes = await pool.query<{
    id: number; username: string; avatar_url: string | null;
    created_at: string; membership_tier: string; is_profile_public: boolean;
  }>(
    `SELECT id, username, avatar_url, created_at, membership_tier,
            COALESCE(is_profile_public, TRUE) AS is_profile_public
     FROM users WHERE id = $1 AND is_active = TRUE`,
    [userId]
  );
  if (!userRes.rows.length) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
  const u = userRes.rows[0];

  const [epRes, completedRes, streakRes] = await Promise.all([
    pool.query<{ total: string }>(
      `SELECT COUNT(*) as total FROM user_history WHERE user_id = $1`, [userId]
    ),
    pool.query<{ completed: string }>(
      `SELECT COUNT(*) as completed FROM user_watchlist WHERE user_id = $1 AND status='completed'`, [userId]
    ),
    pool.query<{ streak: number }>(
      `WITH ordered_dates AS (
         SELECT DISTINCT view_date,
                CURRENT_DATE - view_date AS days_ago,
                ROW_NUMBER() OVER (ORDER BY view_date DESC) AS rn
         FROM user_daily_views WHERE user_id = $1
       )
       SELECT COUNT(*)::int AS streak FROM ordered_dates WHERE days_ago = rn - 1`,
      [userId]
    ),
  ]);

  let favorites: AnimeListRow[] = [];
  let watchlist: AnimeListRow[] = [];
  if (u.is_profile_public) {
    const [favsRes, watchlistRes] = await Promise.all([
      pool.query<AnimeListRow>(
        `SELECT anime_id, anime_title, anime_image, anime_type FROM user_favorites
         WHERE user_id = $1 ORDER BY added_at DESC LIMIT 12`,
        [userId]
      ),
      pool.query<AnimeListRow>(
        `SELECT anime_id, anime_title, anime_image, anime_type, status FROM user_watchlist
         WHERE user_id = $1 AND status IN ('watching','completed') ORDER BY updated_at DESC LIMIT 12`,
        [userId]
      ),
    ]);
    favorites = favsRes.rows;
    watchlist = watchlistRes.rows;
  }

  res.json({
    user: {
      id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      membership_tier: u.membership_tier,
      is_profile_public: u.is_profile_public,
    },
    stats: {
      totalEpisodes: parseInt(epRes.rows[0]?.total ?? "0", 10),
      completed: parseInt(completedRes.rows[0]?.completed ?? "0", 10),
      streak: streakRes.rows[0]?.streak ?? 0,
    },
    favorites,
    watchlist,
  });
}

publicUserRouter.get("/user/public/:userId", async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    await handlePublicProfile(targetId, res);
  } catch {
    res.status(500).json({ error: "Error al obtener perfil público" });
  }
});

/* Alias en inglés para compatibilidad */
publicUserRouter.get("/profile/:userId", async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    await handlePublicProfile(targetId, res);
  } catch {
    res.status(500).json({ error: "Error al obtener perfil público" });
  }
});

/* ── PRIVATE ROUTER (auth required) ── */
const router = Router();
router.use(requireAuth);

const DAILY_LIMIT = 5;
const objectStorageService = new ObjectStorageService();

/* ── AVATAR UPLOAD ── */

/* POST /user/avatar/request-url — returns a presigned GCS URL for direct upload.
   Client sends JSON { name, size, contentType }, receives { uploadURL, objectPath }.
   Client PUTs the file to uploadURL, then calls PATCH /auth/me with
   avatar_url = objectPath to persist the avatar reference. */
router.post("/user/avatar/request-url", async (req: AuthRequest, res) => {
  const { name, size, contentType } = req.body as { name?: string; size?: number; contentType?: string };
  if (!name || !size || !contentType) {
    res.status(400).json({ error: "name, size y contentType son requeridos" });
    return;
  }
  if (!contentType.startsWith("image/")) {
    res.status(400).json({ error: "Solo se permiten imágenes" });
    return;
  }
  if (size > 2 * 1024 * 1024) {
    res.status(400).json({ error: "El archivo no debe superar 2 MB" });
    return;
  }
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    console.error("Avatar upload URL error:", err);
    res.status(500).json({ error: "Error al generar URL de subida" });
  }
});

/* ── FAVORITES ── */
router.get("/user/favorites", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT anime_id, anime_title, anime_image, anime_type, anime_rating, added_at
       FROM user_favorites WHERE user_id = $1 ORDER BY added_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener favoritos" });
  }
});

router.post("/user/favorites", async (req: AuthRequest, res) => {
  try {
    const { animeId, animeTitle, animeImage, animeType, animeRating, animeGenres } = req.body;
    const genres: string[] = Array.isArray(animeGenres) ? animeGenres.filter((g: unknown) => typeof g === "string") : [];
    await pool.query(
      `INSERT INTO user_favorites (user_id, anime_id, anime_title, anime_image, anime_type, anime_rating, genres)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, anime_id) DO UPDATE SET genres = EXCLUDED.genres`,
      [req.userId, animeId, animeTitle, animeImage, animeType, animeRating ?? null, genres]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar favorito" });
  }
});

router.delete("/user/favorites/:animeId", async (req: AuthRequest, res) => {
  try {
    await pool.query(
      `DELETE FROM user_favorites WHERE user_id = $1 AND anime_id = $2`,
      [req.userId, req.params.animeId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar favorito" });
  }
});

/* ── WATCHLIST ── */
router.get("/user/watchlist", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT anime_id, anime_title, anime_image, anime_type, status, updated_at
       FROM user_watchlist WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener watchlist" });
  }
});

router.put("/user/watchlist/:animeId", async (req: AuthRequest, res) => {
  try {
    const { animeTitle, animeImage, animeType, status } = req.body;
    await pool.query(
      `INSERT INTO user_watchlist (user_id, anime_id, anime_title, anime_image, anime_type, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, anime_id)
       DO UPDATE SET status = $6, anime_title = $3, anime_image = $4, updated_at = NOW()`,
      [req.userId, req.params.animeId, animeTitle, animeImage, animeType, status]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al actualizar watchlist" });
  }
});

router.delete("/user/watchlist/:animeId", async (req: AuthRequest, res) => {
  try {
    await pool.query(
      `DELETE FROM user_watchlist WHERE user_id = $1 AND anime_id = $2`,
      [req.userId, req.params.animeId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar de watchlist" });
  }
});

/* ── HISTORY ── */
router.get("/user/history", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (anime_id) anime_id, anime_title, anime_image, episode_number, watched_at
       FROM user_history WHERE user_id = $1
       ORDER BY anime_id, watched_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

router.post("/user/history", async (req: AuthRequest, res) => {
  try {
    const { animeId, animeTitle, animeImage, episodeNumber } = req.body;
    await pool.query(
      `INSERT INTO user_history (user_id, anime_id, anime_title, anime_image, episode_number)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, anime_id, episode_number) DO UPDATE SET watched_at = NOW()`,
      [req.userId, animeId, animeTitle, animeImage, episodeNumber ?? 0]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar historial" });
  }
});

/* ── WATCH PROGRESS ── */
router.get("/user/progress", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT episode_id, anime_id, anime_title, anime_image, episode_num,
              watch_time, duration, updated_at
       FROM user_watch_progress WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener progreso" });
  }
});

router.put("/user/progress/:episodeId", async (req: AuthRequest, res) => {
  try {
    const { animeId, animeTitle, animeImage, episodeNum, watchTime, duration } = req.body;
    await pool.query(
      `INSERT INTO user_watch_progress
         (user_id, episode_id, anime_id, anime_title, anime_image, episode_num, watch_time, duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, episode_id)
       DO UPDATE SET watch_time=$7, duration=$8, anime_title=$4, anime_image=$5, updated_at=NOW()`,
      [req.userId, req.params.episodeId, animeId, animeTitle, animeImage, episodeNum, watchTime, duration]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar progreso" });
  }
});

/* ── DAILY ACCESS CONTROL (server-side) ── */
router.get("/user/daily-access", async (req: AuthRequest, res) => {
  try {
    const memberResult = await pool.query(
      `SELECT membership_tier FROM users WHERE id = $1`,
      [req.userId]
    );
    const tier = memberResult.rows[0]?.membership_tier ?? "free";
    if (tier === "megafan") {
      res.json({ isPremium: true, remaining: null, limit: null });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT episode_id) as count
       FROM user_daily_views
       WHERE user_id = $1 AND view_date = $2`,
      [req.userId, today]
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    res.json({
      isPremium: false,
      watched: count,
      remaining: Math.max(0, DAILY_LIMIT - count),
      limit: DAILY_LIMIT,
    });
  } catch {
    res.status(500).json({ error: "Error al verificar acceso" });
  }
});

router.post("/user/daily-access/register", async (req: AuthRequest, res) => {
  try {
    const memberResult = await pool.query(
      `SELECT membership_tier FROM users WHERE id = $1`,
      [req.userId]
    );
    const tier = memberResult.rows[0]?.membership_tier ?? "free";
    if (tier === "megafan") {
      res.json({ ok: true, isPremium: true });
      return;
    }

    const { episodeId } = req.body as { episodeId: string };
    if (!episodeId) {
      res.status(400).json({ error: "episodeId requerido" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const existing = await pool.query(
      `SELECT 1 FROM user_daily_views WHERE user_id = $1 AND episode_id = $2 AND view_date = $3`,
      [req.userId, episodeId, today]
    );
    if (existing.rows.length > 0) {
      res.json({ ok: true, alreadyCounted: true });
      return;
    }

    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT episode_id) as count FROM user_daily_views WHERE user_id = $1 AND view_date = $2`,
      [req.userId, today]
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    if (count >= DAILY_LIMIT) {
      res.status(403).json({ error: "Límite diario alcanzado", remaining: 0 });
      return;
    }

    await pool.query(
      `INSERT INTO user_daily_views (user_id, episode_id, view_date) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [req.userId, episodeId, today]
    );
    res.json({ ok: true, remaining: Math.max(0, DAILY_LIMIT - count - 1) });
  } catch {
    res.status(500).json({ error: "Error al registrar episodio" });
  }
});

/* ── USER STATS ── */
router.get("/user/stats", async (req: AuthRequest, res) => {
  try {
    const uid = req.userId;

    const [epResult, completedResult, weeklyResult, topResult, streakResult, weekTotalResult, genreResult] = await Promise.all([
      pool.query<{ total_episodes: string; total_animes: string }>(
        `SELECT COUNT(*) as total_episodes, COUNT(DISTINCT anime_id) as total_animes
         FROM user_history WHERE user_id = $1`,
        [uid]
      ),
      pool.query<{ completed: string }>(
        `SELECT COUNT(*) as completed FROM user_watchlist
         WHERE user_id = $1 AND status = 'completed'`,
        [uid]
      ),
      pool.query<DailyViewRow>(
        `SELECT view_date::text as day, COUNT(DISTINCT episode_id)::int as episodes
         FROM user_daily_views
         WHERE user_id = $1 AND view_date >= CURRENT_DATE - 6
         GROUP BY view_date ORDER BY view_date ASC`,
        [uid]
      ),
      pool.query<TopAnimeRow>(
        `SELECT anime_id, anime_title, anime_image, COUNT(*) as ep_count
         FROM user_history WHERE user_id = $1
         GROUP BY anime_id, anime_title, anime_image
         ORDER BY ep_count DESC LIMIT 3`,
        [uid]
      ),
      pool.query<{ streak: number }>(
        `WITH ordered_dates AS (
           SELECT DISTINCT view_date,
                  CURRENT_DATE - view_date AS days_ago,
                  ROW_NUMBER() OVER (ORDER BY view_date DESC) AS rn
           FROM user_daily_views WHERE user_id = $1
         )
         SELECT COUNT(*)::int AS streak FROM ordered_dates
         WHERE days_ago = rn - 1`,
        [uid]
      ),
      pool.query<{ episodes_this_week: string }>(
        `SELECT COUNT(DISTINCT episode_id)::text as episodes_this_week
         FROM user_daily_views
         WHERE user_id = $1
           AND view_date >= date_trunc('week', CURRENT_DATE)`,
        [uid]
      ),
      pool.query<{ genre: string }>(
        `SELECT genre, COUNT(*) AS cnt
         FROM user_favorites, unnest(genres) AS genre
         WHERE user_id = $1
         GROUP BY genre
         ORDER BY cnt DESC
         LIMIT 1`,
        [uid]
      ),
    ]);

    const totalEpisodes    = parseInt(epResult.rows[0]?.total_episodes ?? "0", 10);
    const totalAnimes      = parseInt(epResult.rows[0]?.total_animes ?? "0", 10);
    const completed        = parseInt(completedResult.rows[0]?.completed ?? "0", 10);
    const streak           = streakResult.rows[0]?.streak ?? 0;
    const episodesThisWeek = parseInt(weekTotalResult.rows[0]?.episodes_this_week ?? "0", 10);
    const estimatedHours   = Math.round((totalEpisodes * 24) / 60 * 10) / 10;
    const favoriteGenre: string | null = genreResult.rows[0]?.genre ?? null;

    const DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const weekMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weekMap[d.toISOString().slice(0, 10)] = 0;
    }
    weeklyResult.rows.forEach((r: DailyViewRow) => { weekMap[r.day] = r.episodes; });
    const weeklyActivity = Object.entries(weekMap).map(([date, episodes]) => {
      const d = new Date(date + "T12:00:00Z");
      return { date, day: DAY_NAMES[d.getUTCDay()], episodes };
    });

    res.json({
      totalEpisodes,
      totalAnimes,
      completed,
      streak,
      episodesThisWeek,
      estimatedHours,
      favoriteGenre,
      weeklyActivity,
      topAnime: topResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

export default router;
