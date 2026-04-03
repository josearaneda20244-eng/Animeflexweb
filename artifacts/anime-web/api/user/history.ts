import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db";
import { verifyToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const payload = await verifyToken(req, res);
  if (!payload) return;

  const sql = getSql();

  if (req.method === "GET") {
    const rows = await sql`
      SELECT DISTINCT ON (anime_id) anime_id, anime_title, anime_image, episode_number, watched_at
      FROM user_history WHERE user_id = ${payload.userId}
      ORDER BY anime_id, watched_at DESC
    `;
    return res.json(rows);
  }

  if (req.method === "POST") {
    const { animeId, animeTitle, animeImage, episodeNumber } = req.body;
    await sql`
      INSERT INTO user_history (user_id, anime_id, anime_title, anime_image, episode_number)
      VALUES (${payload.userId}, ${animeId}, ${animeTitle}, ${animeImage}, ${episodeNumber ?? 0})
      ON CONFLICT (user_id, anime_id, episode_number) DO UPDATE SET watched_at = NOW()
    `;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
