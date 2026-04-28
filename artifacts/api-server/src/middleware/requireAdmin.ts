import { Response, NextFunction } from "express";
import pool from "../db.js";
import { type AuthRequest } from "./authMiddleware.js";

/**
 * Allows both `admin` and `owner` roles.
 * Use for general admin operations (read stats, moderate, etc.).
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = rows[0];
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      res.status(403).json({ error: "Acceso denegado. Solo administradores." });
      return;
    }
    (req as AuthRequest & { userRole?: string }).userRole = user.role;
    next();
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
}

/**
 * Strict: only `owner` role passes.
 * Use for sensitive operations: changing roles, system config, payments, mass email.
 */
export async function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: "No autenticado" });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = rows[0];
    if (!user || user.role !== "owner") {
      res.status(403).json({ error: "Acción restringida al propietario." });
      return;
    }
    (req as AuthRequest & { userRole?: string }).userRole = user.role;
    next();
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
