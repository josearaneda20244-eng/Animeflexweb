import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../db.js";
import { requireAuth, signToken, type AuthRequest } from "../middleware/authMiddleware.js";
import { sendEmail, verificationEmailHtml, resetPasswordEmailHtml } from "../lib/email.js";
import { validateEmail, validateUsername, validatePassword, validateSafeUrl } from "../lib/validation.js";
import { checkLockout, registerFailure, clearAttempts } from "../lib/loginAttempts.js";

const router = Router();

const BCRYPT_ROUNDS = 12;

/* Columnas base para INSERT/UPDATE RETURNING (solo columnas simples) */
const BASE_USER_COLS = `id, username, email, password_hash, avatar_url, created_at,
  membership_tier, subscription_expires_at, role, is_active`;

/* Columnas completas para SELECT (incluye campos opcionales con valores por defecto) */
const FULL_USER_COLS = `${BASE_USER_COLS},
  COALESCE(email_verified, FALSE) AS email_verified,
  COALESCE(is_profile_public, TRUE) AS is_profile_public`;

/** Limpia campos internos antes de devolver el usuario al cliente */
function safeUser(row: Record<string, unknown>) {
  const { password_hash, is_active, ...rest } = row;
  return rest;
}

function getClientIp(req: { ip?: string; headers: Record<string, unknown> }): string {
  return req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || "unknown";
}

router.post("/auth/register", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const username = validateUsername(body.username);
  const email = validateEmail(body.email);
  const pwCheck = validatePassword(body.password);

  if (!username) {
    res.status(400).json({ error: "Usuario inválido (3-20 caracteres, solo letras, números, '_' y '-')" });
    return;
  }
  if (!email) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }
  if (!pwCheck.ok) {
    res.status(400).json({ error: pwCheck.reason });
    return;
  }

  try {
    const hash = await bcrypt.hash(body.password as string, BCRYPT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING ${FULL_USER_COLS}`,
      [username, email, hash]
    );
    const user = safeUser(result.rows[0]);
    const token = signToken(user.id as number, user.email as string);
    res.status(201).json({ token, user });
  } catch (err: any) {
    if (err.code === "23505") {
      // Mensaje genérico anti-enumeración: no revelamos si fue email o username el duplicado
      res.status(409).json({ error: "El usuario o email ya están en uso" });
    } else {
      req.log?.error({ err: err?.message }, "register error");
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
});

router.post("/auth/login", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const email = validateEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    res.status(400).json({ error: "Email o contraseña incorrectos" });
    return;
  }

  const ip = getClientIp(req);
  const lock = checkLockout(email, ip);
  if (lock) {
    res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(lock.lockedFor / 60)} min.`,
    });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT ${FULL_USER_COLS} FROM users WHERE email = $1`,
      [email]
    );
    const row = result.rows[0];
    if (!row) {
      // Realizar un hash dummy para igualar el tiempo de respuesta y evitar enumeración por timing
      await bcrypt.compare(password, "$2a$12$abcdefghijklmnopqrstuv0123456789ABCDEFGHIJKLMNOPQRSTU");
      registerFailure(email, ip);
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }
    if (row.is_active === false) {
      res.status(403).json({ error: "Tu cuenta ha sido desactivada" });
      return;
    }
    const valid = await bcrypt.compare(password, row.password_hash as string);
    if (!valid) {
      const fail = registerFailure(email, ip);
      if (fail.lockedFor) {
        res.status(429).json({
          error: `Demasiados intentos fallidos. Cuenta bloqueada ${Math.ceil(fail.lockedFor / 60)} min.`,
        });
        return;
      }
      res.status(401).json({ error: "Email o contraseña incorrectos" });
      return;
    }

    clearAttempts(email, ip);

    // Re-hash transparente si la fuerza guardada está por debajo de la actual
    try {
      const currentHash = row.password_hash as string;
      const match = /^\$2[aby]\$(\d{2})\$/.exec(currentHash);
      const rounds = match ? parseInt(match[1], 10) : 0;
      if (rounds && rounds < BCRYPT_ROUNDS) {
        const upgraded = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [upgraded, row.id]);
      }
    } catch { /* upgrade silencioso */ }

    const token = signToken(row.id as number, row.email as string);
    res.json({ token, user: safeUser(row) });
  } catch (err: any) {
    req.log?.error({ err: err?.message }, "login error");
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT ${FULL_USER_COLS} FROM users WHERE id = $1`,
      [req.userId]
    );
    const row = result.rows[0];
    if (!row) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    res.json({ user: safeUser(row) });
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.patch("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  const body = req.body as Record<string, unknown>;
  const hasUsername = typeof body.username === "string";
  const hasAvatar = body.avatar_url !== undefined;
  const hasPublic = typeof body.is_profile_public === "boolean";

  if (!hasUsername && !hasAvatar && !hasPublic) {
    res.status(400).json({ error: "Nada que actualizar" });
    return;
  }

  let username: string | null = null;
  if (hasUsername) {
    username = validateUsername(body.username);
    if (!username) {
      res.status(400).json({ error: "Usuario inválido (3-20 caracteres, solo letras, números, '_' y '-')" });
      return;
    }
  }

  let avatarUrl: string | null | undefined;
  if (hasAvatar) {
    if (body.avatar_url === null || body.avatar_url === "") {
      avatarUrl = null;
    } else {
      avatarUrl = validateSafeUrl(body.avatar_url);
      if (!avatarUrl) {
        res.status(400).json({ error: "URL de avatar inválida (debe empezar por http:// o https://)" });
        return;
      }
    }
  }

  try {
    const fields: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let idx = 1;
    if (username !== null) { fields.push(`username = $${idx++}`); values.push(username); }
    if (avatarUrl !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(avatarUrl); }
    if (hasPublic) { fields.push(`is_profile_public = $${idx++}`); values.push(body.is_profile_public as boolean); }
    values.push(req.userId!);
    await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`,
      values
    );
    const updated = await pool.query(
      `SELECT ${FULL_USER_COLS} FROM users WHERE id = $1`,
      [req.userId]
    );
    res.json({ user: safeUser(updated.rows[0]) });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "El nombre de usuario ya está en uso" });
    } else {
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  const email = validateEmail((req.body as Record<string, unknown>).email);
  if (!email) { res.json({ ok: true }); return; }
  try {
    const { rows } = await pool.query(
      `SELECT id, username FROM users WHERE email = $1 AND is_active = TRUE`,
      [email]
    );
    if (!rows[0]) { res.json({ ok: true }); return; }
    const user = rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await pool.query(`DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`, [user.id]);
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );
    const feBase = (process.env["FRONTEND_URL"] ?? "https://animeflex.lat").replace(/\/$/, "");
    const resetUrl = `${feBase}/reset-password?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Restablecer contraseña — AnimeFlex",
      text: `Restablece tu contraseña de AnimeFlex: ${resetUrl} (válido 1 hora)`,
      html: resetPasswordEmailHtml(user.username as string, resetUrl),
    });
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err: err?.message ?? err }, "forgot-password error");
    res.json({ ok: true });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const pwCheck = validatePassword(body.password);
  if (!token || token.length !== 64) {
    res.status(400).json({ error: "Token inválido" });
    return;
  }
  if (!pwCheck.ok) {
    res.status(400).json({ error: pwCheck.reason });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );
    if (!rows[0]) {
      res.status(400).json({ error: "El enlace no es válido o ya expiró. Solicita uno nuevo." });
      return;
    }
    const { id: tokenId, user_id } = rows[0];
    const hash = await bcrypt.hash(body.password as string, BCRYPT_ROUNDS);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, user_id]);
    await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

router.post("/auth/send-verification", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT email, username, COALESCE(email_verified, FALSE) AS email_verified FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = rows[0];
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    if (user.email_verified) { res.json({ ok: true, alreadyVerified: true }); return; }
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [req.userId]);
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [req.userId, token, expiresAt]
    );
    const appUrl = process.env["APP_URL"];
    let verifyUrl: string;
    if (appUrl) {
      verifyUrl = `${appUrl.replace(/\/$/, "")}/api/auth/verify-email?token=${token}`;
    } else {
      const vProto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
      const vHost  = req.get("host") ?? "animeflex.lat";
      verifyUrl = `${vProto}://${vHost}/api/auth/verify-email?token=${token}`;
    }
    req.log.info({ to: user.email, verifyUrl }, "Sending verification email");
    await sendEmail({
      to: user.email,
      subject: "Verifica tu correo — AnimeFlex",
      text: `Hola ${user.username}, verifica tu correo en AnimeFlex: ${verifyUrl} (válido 24 horas)`,
      html: verificationEmailHtml(user.username as string, verifyUrl),
    });
    req.log.info({ to: user.email }, "Verification email sent successfully");
    res.json({ ok: true });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "send-verification failed");
    if (err?.message === "SMTP_NOT_CONFIGURED") {
      res.status(503).json({ error: "El servidor de correo no está configurado. Contacta al administrador." });
    } else {
      res.status(500).json({ error: `No se pudo enviar el correo: ${err?.message ?? "error desconocido"}` });
    }
  }
});

router.get("/auth/verify-email", async (req, res) => {
  const { token } = req.query as { token?: string };
  const frontendBase = (process.env["FRONTEND_URL"] ?? "https://animeflex.lat").replace(/\/$/, "");
  if (!token || typeof token !== "string" || token.length !== 64) {
    return res.redirect(302, `${frontendBase}/verify-email?status=error&msg=${encodeURIComponent("Token inválido")}`);
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id FROM email_verification_tokens
       WHERE token = $1 AND expires_at > NOW() AND verified_at IS NULL`,
      [token]
    );
    if (!rows[0]) {
      return res.redirect(302, `${frontendBase}/verify-email?status=error&msg=${encodeURIComponent("El enlace no es válido o ya expiró")}`);
    }
    const { id: tokenId, user_id } = rows[0];
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [user_id]).catch(() => {});
    await pool.query(`UPDATE email_verification_tokens SET verified_at = NOW() WHERE id = $1`, [tokenId]);
    return res.redirect(302, `${frontendBase}/verify-email?status=success`);
  } catch {
    return res.redirect(302, `${frontendBase}/verify-email?status=error&msg=${encodeURIComponent("Error interno del servidor")}`);
  }
});

export default router;
