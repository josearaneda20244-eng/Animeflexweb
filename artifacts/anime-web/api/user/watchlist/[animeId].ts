import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../_lib/db";
import { verifyToken } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const payload = verifyToken(req, res);
  if (!payload) return;

  const pool = getPool();

  if (req.method === "PUT") {
    const { animeTitle, animeImage, animeType, status } = req.body;
    await pool.query(
      `INSERT INTO user_watchlist (user_id, anime_id, anime_title, anime_image, anime_type, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, anime_id)
       DO UPDATE SET status = $6, anime_title = $3, anime_image = $4, updated_at = NOW()`,
      [payload.userId, req.query.animeId, animeTitle, animeImage, animeType, status]
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await pool.query(
      `DELETE FROM user_watchlist WHERE user_id = $1 AND anime_id = $2`,
      [payload.userId, req.query.animeId]
    );
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
