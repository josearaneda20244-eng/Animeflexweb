import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();
router.use(requireAuth);

const DAILY_LIMIT = 5;

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
    const { animeId, animeTitle, animeImage, animeType, animeRating } = req.body;
    await pool.query(
      `INSERT INTO user_favorites (user_id, anime_id, anime_title, anime_image, anime_type, anime_rating)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, anime_id) DO NOTHING`,
      [req.userId, animeId, animeTitle, animeImage, animeType, animeRating ?? null]
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

export default router;
