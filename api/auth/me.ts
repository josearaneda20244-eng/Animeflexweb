import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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
