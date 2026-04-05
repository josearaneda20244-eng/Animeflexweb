import { Router } from "express";
import pool from "../db.js";

const router = Router();

/* ── POST /search-log — log search queries ── */
router.post("/search-log", async (req, res) => {
  const { query } = req.body as { query?: string };
  if (!query?.trim() || query.trim().length < 2) {
    res.json({ ok: true });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO search_logs (query, count, last_searched)
       VALUES ($1, 1, NOW())
       ON CONFLICT (query) DO UPDATE
       SET count = search_logs.count + 1, last_searched = NOW()`,
      [query.trim().toLowerCase()]
    );
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

export default router;
