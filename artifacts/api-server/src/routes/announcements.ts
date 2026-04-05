import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();

/* ── GET /announcements — public, active only ── */
router.get("/announcements", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, message, type, created_at
       FROM announcements WHERE active = TRUE
       ORDER BY created_at DESC LIMIT 3`
    );
    res.json({ announcements: rows });
  } catch {
    res.json({ announcements: [] });
  }
});

/* ── POST /admin/announcements — admin only ── */
router.post("/admin/announcements", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { message, type = "info" } = req.body as { message: string; type?: string };
  if (!message?.trim()) {
    res.status(400).json({ error: "Mensaje requerido" });
    return;
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO announcements (message, type) VALUES ($1, $2) RETURNING *`,
      [message.trim(), type]
    );
    res.json({ announcement: rows[0] });
  } catch {
    res.status(500).json({ error: "Error al crear anuncio" });
  }
});

/* ── DELETE /admin/announcements/:id — admin only ── */
router.delete("/admin/announcements/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  try {
    await pool.query(`DELETE FROM announcements WHERE id = $1`, [id]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar anuncio" });
  }
});

/* ── PUT /admin/announcements/:id/toggle — activate/deactivate ── */
router.put("/admin/announcements/:id/toggle", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id as string);
  try {
    const { rows } = await pool.query(
      `UPDATE announcements SET active = NOT active WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json({ announcement: rows[0] });
  } catch {
    res.status(500).json({ error: "Error al actualizar anuncio" });
  }
});

export default router;
