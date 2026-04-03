import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db";
import { verifyToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const payload = verifyToken(req, res);
  if (!payload) return;

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, username, email, avatar_url, created_at FROM users WHERE id = ${payload.userId}
    `;
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    return res.json({ user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Error interno del servidor" });
  }
}
