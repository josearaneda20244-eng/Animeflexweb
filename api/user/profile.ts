import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const payload = await verifyToken(req, res);
  if (!payload) return;

  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL!);

    const body = req.body ?? {};
    const newUsername: string | null = body.username !== undefined ? String(body.username).trim() || null : null;
    const newAvatarUrl: string | null = body.avatar_url !== undefined ? String(body.avatar_url).trim() || null : null;
    const updateUsername = body.username !== undefined;
    const updateAvatar = body.avatar_url !== undefined;

    if (!updateUsername && !updateAvatar) {
      return res.status(400).json({ error: "Nada que actualizar" });
    }

    if (updateUsername && newUsername !== null && (newUsername.length < 2 || newUsername.length > 30)) {
      return res.status(400).json({ error: "El nombre debe tener entre 2 y 30 caracteres" });
    }

    if (updateUsername && updateAvatar) {
      const rows = await sql`
        UPDATE users
        SET username = ${newUsername}, avatar_url = ${newAvatarUrl}
        WHERE id = ${payload.userId}
        RETURNING id, username, email, avatar_url, created_at,
          COALESCE(membership_tier, 'free') AS membership_tier,
          subscription_expires_at, COALESCE(role, 'user') AS role
      `;
      return res.json({ user: rows[0] });
    } else if (updateUsername) {
      const rows = await sql`
        UPDATE users SET username = ${newUsername}
        WHERE id = ${payload.userId}
        RETURNING id, username, email, avatar_url, created_at,
          COALESCE(membership_tier, 'free') AS membership_tier,
          subscription_expires_at, COALESCE(role, 'user') AS role
      `;
      return res.json({ user: rows[0] });
    } else {
      const rows = await sql`
        UPDATE users SET avatar_url = ${newAvatarUrl}
        WHERE id = ${payload.userId}
        RETURNING id, username, email, avatar_url, created_at,
          COALESCE(membership_tier, 'free') AS membership_tier,
          subscription_expires_at, COALESCE(role, 'user') AS role
      `;
      return res.json({ user: rows[0] });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Error interno del servidor" });
  }
}
