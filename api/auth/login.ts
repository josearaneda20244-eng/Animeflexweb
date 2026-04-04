import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password } = req.body as Record<string, string>;
    if (!email || !password)
      return res.status(400).json({ error: "Faltan campos obligatorios" });

    const { neon } = await import("@neondatabase/serverless");
    const bcrypt = (await import("bcryptjs")).default;
    const jwt = (await import("jsonwebtoken")).default;

    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      SELECT id, username, email, password_hash, avatar_url, created_at
      FROM users WHERE email = ${email.trim().toLowerCase()}
    `;
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Email o contraseña incorrectos" });

    const valid = await bcrypt.compare(password, user.password_hash as string);
    if (!valid) return res.status(401).json({ error: "Email o contraseña incorrectos" });

    const { password_hash, ...safeUser } = user;
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET ?? "animeflex_secret",
      { expiresIn: "30d" }
    );
    return res.json({ token, user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Error interno del servidor" });
  }
}
