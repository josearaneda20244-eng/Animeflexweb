import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { getPool } from "../_lib/db";
import { signToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password } = req.body as Record<string, string>;
  if (!email || !password)
    return res.status(400).json({ error: "Faltan campos obligatorios" });

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, username, email, password_hash, avatar_url, created_at FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Email o contraseña incorrectos" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Email o contraseña incorrectos" });

    const { password_hash, ...safeUser } = user;
    const token = signToken(user.id, user.email);
    return res.json({ token, user: safeUser });
  } catch {
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
