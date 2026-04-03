import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();
router.use(requireAuth);

/* ── FAVORITES ── */
router.get("/user/favorites", async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT anime_id, anime_title, anime_image, anime_type, anime_rating, added_at
     FROM user_favorites WHERE user_id = $1 ORDER BY added_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

router.post("/user/favorites", async (req: AuthRequest, res) => {
  const { animeId, animeTitle, animeImage, animeType, animeRating } = req.body;
  await pool.query(
    `INSERT INTO user_favorites (user_id, anime_id, anime_title, anime_image, anime_type, anime_rating)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, anime_id) DO NOTHING`,
    [req.userId, animeId, animeTitle, animeImage, animeType, animeRating ?? null]
  );
  res.json({ ok: true });
});

router.delete("/user/favorites/:animeId", async (req: AuthRequest, res) => {
  await pool.query(
    `DELETE FROM user_favorites WHERE user_id = $1 AND anime_id = $2`,
    [req.userId, req.params.animeId]
  );
  res.json({ ok: true });
});

/* ── WATCHLIST ── */
router.get("/user/watchlist", async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT anime_id, anime_title, anime_image, anime_type, status, updated_at
     FROM user_watchlist WHERE user_id = $1 ORDER BY updated_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

router.put("/user/watchlist/:animeId", async (req: AuthRequest, res) => {
  const { animeTitle, animeImage, animeType, status } = req.body;
  await pool.query(
    `INSERT INTO user_watchlist (user_id, anime_id, anime_title, anime_image, anime_type, status)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (user_id, anime_id)
     DO UPDATE SET status = $6, anime_title = $3, anime_image = $4, updated_at = NOW()`,
    [req.userId, req.params.animeId, animeTitle, animeImage, animeType, status]
  );
  res.json({ ok: true });
});

router.delete("/user/watchlist/:animeId", async (req: AuthRequest, res) => {
  await pool.query(
    `DELETE FROM user_watchlist WHERE user_id = $1 AND anime_id = $2`,
    [req.userId, req.params.animeId]
  );
  res.json({ ok: true });
});

/* ── HISTORY ── */
router.get("/user/history", async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (anime_id) anime_id, anime_title, anime_image, episode_number, watched_at
     FROM user_history WHERE user_id = $1
     ORDER BY anime_id, watched_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

router.post("/user/history", async (req: AuthRequest, res) => {
  const { animeId, animeTitle, animeImage, episodeNumber } = req.body;
  await pool.query(
    `INSERT INTO user_history (user_id, anime_id, anime_title, anime_image, episode_number)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id, anime_id, episode_number) DO UPDATE SET watched_at = NOW()`,
    [req.userId, animeId, animeTitle, animeImage, episodeNumber ?? 0]
  );
  res.json({ ok: true });
});

/* ── WATCH PROGRESS ── */
router.get("/user/progress", async (req: AuthRequest, res) => {
  const { rows } = await pool.query(
    `SELECT episode_id, anime_id, anime_title, anime_image, episode_num,
            watch_time, duration, updated_at
     FROM user_watch_progress WHERE user_id = $1 ORDER BY updated_at DESC`,
    [req.userId]
  );
  res.json(rows);
});

router.put("/user/progress/:episodeId", async (req: AuthRequest, res) => {
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
});

export default router;
