import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../_lib/db";
import { verifyToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const payload = verifyToken(req, res);
  if (!payload) return;

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT anime_id, anime_title, anime_image, anime_type, status, updated_at
     FROM user_watchlist WHERE user_id = $1 ORDER BY updated_at DESC`,
    [payload.userId]
  );
  return res.json(rows);
}
