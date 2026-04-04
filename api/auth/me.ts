import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyToken } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer "))
        return res.status(401).json({ error: "No autenticado" });

      const jwt = (await import("jsonwebtoken")).default;
      const { neon } = await import("@neondatabase/serverless");

      const payload = jwt.verify(
        header.slice(7),
        process.env.JWT_SECRET ?? "animeflex_secret"
      ) as { userId: number };

      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT id, username, email, avatar_url, created_at,
               COALESCE(membership_tier, 'free') AS membership_tier,
               subscription_expires_at,
               COALESCE(role, 'user') AS role
        FROM users WHERE id = ${payload.userId}
      `;
      const user = rows[0];
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
      return res.json({ user });
    } catch (err: any) {
      return res.status(500).json({ error: err.message ?? "Error interno del servidor" });
    }
  }

  if (req.method === "PATCH") {
    const payload = await verifyToken(req, res);
    if (!payload) return;

    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);

      const body = req.body ?? {};
      const updateUsername = body.username !== undefined;
      const updateAvatar = body.avatar_url !== undefined;

      if (!updateUsername && !updateAvatar) {
        return res.status(400).json({ error: "Nada que actualizar" });
      }

      const newUsername: string | null = updateUsername ? (String(body.username).trim() || null) : null;
      const newAvatarUrl: string | null = updateAvatar ? (String(body.avatar_url).trim() || null) : null;

      if (updateUsername && newUsername !== null && (newUsername.length < 2 || newUsername.length > 30)) {
        return res.status(400).json({ error: "El nombre debe tener entre 2 y 30 caracteres" });
      }

      let rows;
      if (updateUsername && updateAvatar) {
        rows = await sql`
          UPDATE users SET username = ${newUsername}, avatar_url = ${newAvatarUrl}
          WHERE id = ${payload.userId}
          RETURNING id, username, email, avatar_url, created_at,
            COALESCE(membership_tier, 'free') AS membership_tier,
            subscription_expires_at, COALESCE(role, 'user') AS role
        `;
      } else if (updateUsername) {
        rows = await sql`
          UPDATE users SET username = ${newUsername}
          WHERE id = ${payload.userId}
          RETURNING id, username, email, avatar_url, created_at,
            COALESCE(membership_tier, 'free') AS membership_tier,
            subscription_expires_at, COALESCE(role, 'user') AS role
        `;
      } else {
        rows = await sql`
          UPDATE users SET avatar_url = ${newAvatarUrl}
          WHERE id = ${payload.userId}
          RETURNING id, username, email, avatar_url, created_at,
            COALESCE(membership_tier, 'free') AS membership_tier,
            subscription_expires_at, COALESCE(role, 'user') AS role
        `;
      }

      return res.json({ user: rows[0] });
    } catch (err: any) {
      return res.status(500).json({ error: err.message ?? "Error interno del servidor" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
