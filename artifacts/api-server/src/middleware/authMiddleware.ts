import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[SECURITY] JWT_SECRET no está configurado. Define JWT_SECRET en las variables de entorno.");
  process.exit(1);
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET!) as { userId: number; email: string };
    req.userId = payload.userId;
    req.userEmail = payload.email;

    pool
      .query("SELECT is_active FROM users WHERE id = $1", [payload.userId])
      .then(({ rows }) => {
        if (!rows[0] || rows[0].is_active === false) {
          res.status(401).json({ error: "Cuenta desactivada" });
          return;
        }
        next();
      })
      .catch(() => next());
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET!, { expiresIn: "30d" });
}
