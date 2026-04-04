import { Response, NextFunction } from "express";
import pool from "../db.js";
import { type AuthRequest } from "./authMiddleware.js";

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
    next();
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
