import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db";
import { verifyToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const payload = verifyToken(req, res);
  if (!payload) return;

  const sql = getSql();

  if (req.method === "GET") {
    const rows = await sql`
      SELECT anime_id, anime_title, anime_image, anime_type, anime_rating, added_at
      FROM user_favorites WHERE user_id = ${payload.userId} ORDER BY added_at DESC
    `;
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { animeId, animeTitle, animeImage, animeType, animeRating } = req.body;
    await sql`
      INSERT INTO user_favorites (user_id, anime_id, anime_title, anime_image, anime_type, anime_rating)
      VALUES (${payload.userId}, ${animeId}, ${animeTitle}, ${animeImage}, ${animeType}, ${animeRating ?? null})
      ON CONFLICT (user_id, anime_id) DO NOTHING
    `;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
