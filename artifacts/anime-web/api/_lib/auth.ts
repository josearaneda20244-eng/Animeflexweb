import type { VercelRequest, VercelResponse } from "@vercel/node";

const JWT_SECRET = process.env.JWT_SECRET ?? "animeflex_secret_change_in_prod";

export async function signToken(userId: number, email: string): Promise<string> {
  const jwt = (await import("jsonwebtoken")).default;
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "30d" });
}

export async function verifyToken(
  req: VercelRequest,
  res: VercelResponse
): Promise<{ userId: number; email: string } | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" });
    return null;
  }
  const token = header.slice(7);
  try {
    const jwt = (await import("jsonwebtoken")).default;
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
    return null;
  }
}
