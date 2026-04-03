import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../../_lib/db";
import { verifyToken } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const payload = await verifyToken(req, res);
  if (!payload) return;

  const sql = getSql();

  if (req.method === "PUT") {
    const { animeTitle, animeImage, animeType, status } = req.body;
    await sql`
      INSERT INTO user_watchlist (user_id, anime_id, anime_title, anime_image, anime_type, status)
      VALUES (${payload.userId}, ${req.query.animeId as string}, ${animeTitle}, ${animeImage}, ${animeType}, ${status})
      ON CONFLICT (user_id, anime_id)
      DO UPDATE SET status = ${status}, anime_title = ${animeTitle}, anime_image = ${animeImage}, updated_at = NOW()
    `;
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await sql`DELETE FROM user_watchlist WHERE user_id = ${payload.userId} AND anime_id = ${req.query.animeId as string}`;
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
