import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import pool from "../db.js";

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  console.error("[SECURITY] JWT_SECRET o SESSION_SECRET no está configurado. Define una variable secreta para firmar tokens.");
  process.exit(1);
}
if (JWT_SECRET.length < 32) {
  console.error("[SECURITY] JWT_SECRET es demasiado corto (mínimo 32 caracteres). Genera uno con `openssl rand -base64 48`.");
  process.exit(1);
}

const JWT_ISSUER = process.env.JWT_ISSUER || "animeflex";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "animeflex-clients";

interface JwtPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  const token = header.slice(7).trim();
  if (!token || token.length > 4096) {
    res.status(401).json({ error: "Token inválido" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET!, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    }) as JwtPayload;
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

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) { next(); return; }
  const token = header.slice(7).trim();
  if (!token || token.length > 4096) { next(); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET!, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    }) as JwtPayload;
    req.userId = payload.userId;
    req.userEmail = payload.email;
  } catch { /* ignore */ }
  next();
}

export function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET!, {
    expiresIn: "7d",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: "HS256",
  });
}
