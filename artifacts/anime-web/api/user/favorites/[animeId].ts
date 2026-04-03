import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../_lib/db";
import { verifyToken } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const payload = verifyToken(req, res);
  if (!payload) return;

  const pool = getPool();
  await pool.query(
    `DELETE FROM user_favorites WHERE user_id = $1 AND anime_id = $2`,
    [payload.userId, req.query.animeId]
  );
  return res.json({ ok: true });
}
