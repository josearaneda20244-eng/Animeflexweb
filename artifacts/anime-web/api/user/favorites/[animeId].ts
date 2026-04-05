import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../../_lib/db";
import { verifyToken } from "../../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const payload = await verifyToken(req, res);
  if (!payload) return;

  const sql = getSql();
  await sql`DELETE FROM user_favorites WHERE user_id = ${payload.userId} AND anime_id = ${req.query.animeId as string}`;
  return res.json({ ok: true });
}
