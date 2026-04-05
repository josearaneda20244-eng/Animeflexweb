import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { requireAuth, signToken, type AuthRequest } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body as Record<string, string>;
  if (!username || !email || !password) {
    res.status(400).json({ error: "Faltan campos obligatorios" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    return;
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, avatar_url, created_at, membership_tier,
                 subscription_expires_at, role,
                 COALESCE(is_profile_public, TRUE) AS is_profile_public`,
      [username.trim(), email.trim().toLowerCase(), hash]
    );
    const user = result.rows[0];
    const token = signToken(user.id, user.email);
    res.status(201).json({ token, user });
  } catch (err: any) {
    if (err.code === "23505") {
      const field = err.constraint?.includes("email") ? "email" : "username";
      res.status(409).json({ error: `El ${field} ya está en uso` });
    } else {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
});

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as Record<string, string>;
  if (!email || !password) {
    res.status(400).json({ error: "Faltan campos obligatorios" });
    return;
  }
  try {
    const result = await pool.query(
      `SELECT id, username, email, password_hash, avatar_url, created_at,
              membership_tier, subscription_expires_at, role, is_active,
              COALESCE(is_profile_public, TRUE) AS is_profile_public
       FROM users WHERE email = $1`,
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }
    if (user.is_active === false) {
      res.status(403).json({ error: "Tu cuenta ha sido desactivada" });
      return;
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }
    const { password_hash, is_active, ...safeUser } = user;
    const token = signToken(user.id, user.email);
    res.json({ token, user: safeUser });
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, avatar_url, created_at,
              membership_tier, subscription_expires_at, role,
              COALESCE(is_profile_public, TRUE) AS is_profile_public,
              stripe_customer_id
       FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    res.json({ user });
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.patch("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const { username, avatar_url, is_profile_public } = req.body as {
    username?: string; avatar_url?: string; is_profile_public?: boolean;
  };
  if (!username && avatar_url === undefined && is_profile_public === undefined) {
    res.status(400).json({ error: "Nada que actualizar" });
    return;
  }
  try {
    const fields: string[] = [];
    const values: (string | number | boolean)[] = [];
    let idx = 1;
    if (username) { fields.push(`username = $${idx++}`); values.push(username.trim()); }
    if (avatar_url !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(avatar_url); }
    if (is_profile_public !== undefined) { fields.push(`is_profile_public = $${idx++}`); values.push(is_profile_public); }
    values.push(req.userId!);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING id, username, email, avatar_url, created_at, membership_tier, subscription_expires_at, role,
                 COALESCE(is_profile_public, TRUE) AS is_profile_public`,
      values
    );
    res.json({ user: result.rows[0] });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "El nombre de usuario ya está en uso" });
    } else {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
});

export default router;
