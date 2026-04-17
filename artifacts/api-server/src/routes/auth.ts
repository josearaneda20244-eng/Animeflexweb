import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../db.js";
import { requireAuth, signToken, type AuthRequest } from "../middleware/authMiddleware.js";
import { sendEmail, emailTemplate } from "../lib/email.js";

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
                 COALESCE(is_profile_public, TRUE) AS is_profile_public,
                 COALESCE(email_verified, FALSE) AS email_verified`,
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
              COALESCE(is_profile_public, TRUE) AS is_profile_public,
              COALESCE(email_verified, FALSE) AS email_verified
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
              COALESCE(email_verified, FALSE) AS email_verified
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
                 COALESCE(is_profile_public, TRUE) AS is_profile_public,
                 COALESCE(email_verified, FALSE) AS email_verified`,
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

/* ── POST /auth/forgot-password ── */
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: "Email requerido" });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, username FROM users WHERE email = $1 AND is_active = TRUE`,
      [email.trim().toLowerCase()]
    );
    if (!rows[0]) {
      res.json({ ok: true });
      return;
    }
    const user = rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await pool.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [user.id]
    );
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt]
    );

    const proto  = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
    const host   = req.get("host") ?? "animeflex.lat";
    const basePath = process.env["FRONTEND_BASE_PATH"] ?? "/anime-web";
    const frontendBase = process.env["APP_URL"] ?? `${proto}://${host}${basePath}`;
    const resetUrl = `${frontendBase}/reset-password?token=${token}`;

    await sendEmail({
      to: email.trim().toLowerCase(),
      subject: "Restablecer contraseña — AnimeFlex",
      text: `Restablece tu contraseña de AnimeFlex: ${resetUrl} (válido 1 hora)`,
      html: emailTemplate(`
        <h2 style="margin:0 0 12px;font-size:20px">Restablecer contraseña</h2>
        <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;line-height:1.6">
          Hola <strong style="color:#F1F1F5">${user.username}</strong>, recibimos una solicitud para restablecer tu contraseña.
          El enlace es válido por <strong style="color:#F1F1F5">1 hora</strong>.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6C63FF,#4F46E5);color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
          Restablecer contraseña
        </a>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px">
          Si no solicitaste esto, ignora este correo. Tu contraseña no cambiará.
        </p>
      `),
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error("forgot-password error:", err?.message ?? err);
    res.json({ ok: true });
  }
});

/* ── POST /auth/reset-password ── */
router.post("/auth/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password || password.length < 6) {
    res.status(400).json({ error: "Token inválido o contraseña muy corta (mínimo 6 caracteres)" });
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
    const hash = await bcrypt.hash(password, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, user_id]);
    await pool.query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [tokenId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* ── POST /auth/send-verification ── */
router.post("/auth/send-verification", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT email, username, COALESCE(email_verified, FALSE) AS email_verified FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = rows[0];
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    if (user.email_verified) {
      res.status(400).json({ error: "El correo ya está verificado" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(`DELETE FROM email_verification_tokens WHERE user_id = $1`, [req.userId]);
    await pool.query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [req.userId, token, expiresAt]
    );

    const vProto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
    const vHost  = req.get("host") ?? "animeflex.lat";
    const verifyUrl = `${vProto}://${vHost}/api/auth/verify-email?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Verifica tu correo — AnimeFlex",
      html: emailTemplate(`
        <h2 style="margin:0 0 12px;font-size:20px">Verifica tu correo electrónico</h2>
        <p style="color:rgba(255,255,255,0.6);margin:0 0 24px;line-height:1.6">
          Hola <strong style="color:#F1F1F5">${user.username}</strong>, haz clic en el botón para confirmar tu dirección de correo.
          El enlace es válido por <strong style="color:#F1F1F5">24 horas</strong>.
        </p>
        <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#22C55E,#16A34A);color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">
          ✓ Verificar correo
        </a>
        <p style="color:rgba(255,255,255,0.3);font-size:12px;margin-top:24px">
          Si no creaste una cuenta en AnimeFlex, ignora este correo.
        </p>
      `),
    });

    res.json({ ok: true });
  } catch (err: any) {
    if (err?.message === "SMTP_NOT_CONFIGURED") {
      res.status(503).json({ error: "Correo no configurado. Configura RESEND_API_KEY en las variables de entorno del servidor." });
    } else {
      console.error("send-verification error:", err);
      res.status(500).json({ error: `No se pudo enviar el correo: ${(err?.message ?? String(err)).slice(0, 100)}` });
    }
  }
});

/* ── GET /auth/verify-email?token= ── */
router.get("/auth/verify-email", async (req, res) => {
  const { token } = req.query as { token?: string };

  const rProto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim();
  const rHost  = req.get("host") ?? "animeflex.lat";
  const basePath = process.env["FRONTEND_BASE_PATH"] ?? "/anime-web";
  const frontendBase = process.env["APP_URL"] ?? `${rProto}://${rHost}${basePath}`;

  if (!token) {
    return res.redirect(302, `${frontendBase}/verify-email?status=error&msg=${encodeURIComponent("Token requerido")}`);
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
    await pool.query(`UPDATE users SET email_verified = TRUE WHERE id = $1`, [user_id]);
    await pool.query(
      `UPDATE email_verification_tokens SET verified_at = NOW() WHERE id = $1`,
      [tokenId]
    );
    return res.redirect(302, `${frontendBase}/verify-email?status=success`);
  } catch {
    return res.redirect(302, `${frontendBase}/verify-email?status=error&msg=${encodeURIComponent("Error interno del servidor")}`);
  }
});

export default router;
