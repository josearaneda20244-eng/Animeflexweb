import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../../_lib/db";
import { verifyToken } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const payload = verifyToken(req, res);
  if (!payload) return;

  const sql = getSql();
  const { animeId, animeTitle, animeImage, episodeNum, watchTime, duration } = req.body;
  await sql`
    INSERT INTO user_watch_progress
      (user_id, episode_id, anime_id, anime_title, anime_image, episode_num, watch_time, duration)
    VALUES (${payload.userId}, ${req.query.episodeId as string}, ${animeId}, ${animeTitle}, ${animeImage}, ${episodeNum}, ${watchTime}, ${duration})
    ON CONFLICT (user_id, episode_id)
    DO UPDATE SET watch_time=${watchTime}, duration=${duration}, anime_title=${animeTitle}, anime_image=${animeImage}, updated_at=NOW()
  `;
  return res.json({ ok: true });
}
