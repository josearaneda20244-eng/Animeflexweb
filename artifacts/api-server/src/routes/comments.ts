import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";
import { Request } from "express";

const router = Router();

/* ── GET /comments/:animeId ── Public: returns comments for an anime */
router.get("/comments/:animeId", async (req: Request, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.spoiler, c.likes, c.created_at,
              u.username AS author, u.avatar_url
       FROM anime_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.anime_id = $1
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [req.params.animeId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener comentarios" });
  }
});

/* ── POST /comments/:animeId ── Auth required: post a comment */
router.post("/comments/:animeId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text, spoiler } = req.body as { text: string; spoiler?: boolean };
    if (!text?.trim()) {
      res.status(400).json({ error: "El comentario no puede estar vacío" });
      return;
    }
    if (text.trim().length > 500) {
      res.status(400).json({ error: "El comentario es demasiado largo (máx. 500 caracteres)" });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO anime_comments (anime_id, user_id, text, spoiler)
       VALUES ($1, $2, $3, $4)
       RETURNING id, text, spoiler, likes, created_at`,
      [req.params.animeId, req.userId, text.trim(), spoiler ?? false]
    );
    const userResult = await pool.query(
      `SELECT username, avatar_url FROM users WHERE id = $1`,
      [req.userId]
    );
    res.status(201).json({ ...rows[0], ...userResult.rows[0] });
  } catch {
    res.status(500).json({ error: "Error al publicar comentario" });
  }
});

/* ── POST /comments/:animeId/:commentId/like ── Toggle like */
router.post("/comments/:animeId/:commentId/like", requireAuth, async (req: AuthRequest, res) => {
  try {
    const commentId = parseInt(req.params.commentId as string, 10);
    const existing = await pool.query(
      `SELECT 1 FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
      [commentId, req.userId]
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2`,
        [commentId, req.userId]
      );
      await pool.query(
        `UPDATE anime_comments SET likes = GREATEST(0, likes - 1) WHERE id = $1`,
        [commentId]
      );
      res.json({ liked: false });
    } else {
      await pool.query(
        `INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [commentId, req.userId]
      );
      await pool.query(
        `UPDATE anime_comments SET likes = likes + 1 WHERE id = $1`,
        [commentId]
      );
      res.json({ liked: true });
    }
  } catch {
    res.status(500).json({ error: "Error al procesar like" });
  }
});

/* ── DELETE /comments/:animeId/:commentId ── Auth: delete own comment */
router.delete("/comments/:animeId/:commentId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const commentId = parseInt(req.params.commentId as string, 10);
    const result = await pool.query(
      `DELETE FROM anime_comments WHERE id = $1 AND user_id = $2`,
      [commentId, req.userId]
    );
    if (result.rowCount === 0) {
      res.status(403).json({ error: "No puedes eliminar este comentario" });
      return;
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar comentario" });
  }
});

export default router;
