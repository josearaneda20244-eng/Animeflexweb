import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";
import { Request } from "express";

const router = Router();

/* ── GET /comments/:animeId ── Public: top-level comments with reply count */
router.get("/comments/:animeId", async (req: Request, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.spoiler, c.likes, c.created_at, c.parent_id,
              u.username AS author, u.avatar_url,
              (SELECT COUNT(*) FROM anime_comments r WHERE r.parent_id = c.id)::int AS reply_count
       FROM anime_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.anime_id = $1 AND c.parent_id IS NULL
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [req.params.animeId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener comentarios" });
  }
});

/* ── GET /comments/:animeId/replies/:commentId ── Public: replies to a comment */
router.get("/comments/:animeId/replies/:commentId", async (req: Request, res) => {
  try {
    const parentId = parseInt(req.params.commentId as string, 10);
    if (isNaN(parentId)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.spoiler, c.likes, c.created_at, c.parent_id,
              u.username AS author, u.avatar_url
       FROM anime_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.anime_id = $1 AND c.parent_id = $2
       ORDER BY c.created_at ASC
       LIMIT 50`,
      [req.params.animeId, parentId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener respuestas" });
  }
});

/* ── POST /comments/:animeId ── Auth required: post a comment or reply */
router.post("/comments/:animeId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { text, spoiler, parentId } = req.body as { text: string; spoiler?: boolean; parentId?: number };
    if (!text?.trim()) {
      res.status(400).json({ error: "El comentario no puede estar vacío" });
      return;
    }
    if (text.trim().length > 500) {
      res.status(400).json({ error: "El comentario es demasiado largo (máx. 500 caracteres)" });
      return;
    }
    if (parentId) {
      const parent = await pool.query(
        `SELECT id FROM anime_comments WHERE id = $1 AND anime_id = $2 AND parent_id IS NULL`,
        [parentId, req.params.animeId]
      );
      if (!parent.rows.length) {
        res.status(400).json({ error: "Comentario padre no encontrado" });
        return;
      }
    }
    const { rows } = await pool.query(
      `INSERT INTO anime_comments (anime_id, user_id, text, spoiler, parent_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, text, spoiler, likes, created_at, parent_id`,
      [req.params.animeId, req.userId, text.trim(), spoiler ?? false, parentId ?? null]
    );
    const userResult = await pool.query(
      `SELECT username, avatar_url FROM users WHERE id = $1`,
      [req.userId]
    );
    res.status(201).json({ ...rows[0], ...userResult.rows[0], reply_count: 0 });
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
