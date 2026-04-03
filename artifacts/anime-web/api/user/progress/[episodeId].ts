import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool } from "../../_lib/db";
import { verifyToken } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PUT") return res.status(405).json({ error: "Method not allowed" });

  const payload = verifyToken(req, res);
  if (!payload) return;

  const pool = getPool();
  const { animeId, animeTitle, animeImage, episodeNum, watchTime, duration } = req.body;
  await pool.query(
    `INSERT INTO user_watch_progress
       (user_id, episode_id, anime_id, anime_title, anime_image, episode_num, watch_time, duration)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id, episode_id)
     DO UPDATE SET watch_time=$7, duration=$8, anime_title=$4, anime_image=$5, updated_at=NOW()`,
    [payload.userId, req.query.episodeId, animeId, animeTitle, animeImage, episodeNum, watchTime, duration]
  );
  return res.json({ ok: true });
}
