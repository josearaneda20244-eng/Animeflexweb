import { Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();
const JWT_SECRET = (process.env.JWT_SECRET || process.env.SESSION_SECRET)!;

function optionalAuth(req: AuthRequest, _res: import("express").Response, next: () => void) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as { userId: number; email: string };
      req.userId = payload.userId;
    } catch {}
  }
  next();
}

/* ── GET /anime/:animeId/rating — community avg + user score ── */
router.get("/anime/:animeId/rating", optionalAuth, async (req: AuthRequest, res) => {
  const { animeId } = req.params;
  try {
    const avgResult = await pool.query(
      `SELECT ROUND(AVG(score)::numeric, 1) as avg, COUNT(*) as total
       FROM anime_ratings WHERE anime_id = $1`,
      [animeId]
    );
    const avg = parseFloat(avgResult.rows[0]?.avg ?? "0") || 0;
    const total = parseInt(avgResult.rows[0]?.total ?? "0") || 0;

    let userScore: number | null = null;
    if (req.userId) {
      const userResult = await pool.query(
        `SELECT score FROM anime_ratings WHERE user_id = $1 AND anime_id = $2`,
        [req.userId, animeId]
      );
      userScore = userResult.rows[0]?.score ?? null;
    }

    res.json({ avg, total, userScore });
  } catch (err) {
    console.error("Rating GET error:", err);
    res.status(500).json({ error: "Error al obtener valoración" });
  }
});

/* ── POST /anime/:animeId/rating — set or remove user rating (requires auth) ── */
router.post("/anime/:animeId/rating", requireAuth, async (req: AuthRequest, res) => {
  const { animeId } = req.params;
  const { score } = req.body as { score: number | null };

  try {
    if (score === null || score === 0) {
      await pool.query(
        `DELETE FROM anime_ratings WHERE user_id = $1 AND anime_id = $2`,
        [req.userId, animeId]
      );
    } else {
      if (score < 1 || score > 5) {
        res.status(400).json({ error: "Score debe ser entre 1 y 5" });
        return;
      }
      await pool.query(
        `INSERT INTO anime_ratings (user_id, anime_id, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, anime_id) DO UPDATE SET score = $3, created_at = NOW()`,
        [req.userId, animeId, score]
      );
    }

    const avgResult = await pool.query(
      `SELECT ROUND(AVG(score)::numeric, 1) as avg, COUNT(*) as total
       FROM anime_ratings WHERE anime_id = $1`,
      [animeId]
    );
    res.json({
      ok: true,
      avg: parseFloat(avgResult.rows[0]?.avg ?? "0") || 0,
      total: parseInt(avgResult.rows[0]?.total ?? "0") || 0,
      userScore: score,
    });
  } catch (err) {
    console.error("Rating POST error:", err);
    res.status(500).json({ error: "Error al guardar valoración" });
  }
});

export default router;
