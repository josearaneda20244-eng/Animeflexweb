import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSql } from "../_lib/db";
import { signToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { username, email, password } = req.body as Record<string, string>;
    if (!username || !email || !password)
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    if (password.length < 6)
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });

    const bcrypt = (await import("bcryptjs")).default;
    const sql = getSql();
    const hash = await bcrypt.hash(password, 10);
    const rows = await sql`
      INSERT INTO users (username, email, password_hash)
      VALUES (${username.trim()}, ${email.trim().toLowerCase()}, ${hash})
      RETURNING id, username, email, avatar_url, created_at
    `;
    const user = rows[0];
    const token = await signToken(user.id as number, user.email as string);
    return res.status(201).json({ token, user });
  } catch (err: any) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("email") ? "email" : "username";
      return res.status(409).json({ error: `El ${field} ya está en uso` });
    }
    return res.status(500).json({ error: err.message ?? "Error interno del servidor" });
  }
}
