import { Router } from "express";
import nodemailer from "nodemailer";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  isPayPalConfigured, getPayPalToken, fetchSubscription, fetchReportingTransactions,
  type PayPalReportingTx,
} from "../lib/paypal.js";

const router = Router();
router.use("/admin", requireAuth);
router.use("/admin", requireAdmin);

/* ── Setup tables on first run ── */
async function ensureAdminTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_config (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_content (
      id SERIAL PRIMARY KEY,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      action VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(anime_id, action)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      episode_number INTEGER DEFAULT 0,
      watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(user_id, anime_id, episode_number)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_watch_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      episode_id VARCHAR(300) NOT NULL,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      episode_num INTEGER DEFAULT 0,
      watch_time FLOAT NOT NULL DEFAULT 0,
      duration FLOAT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, episode_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_daily_views (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      episode_id VARCHAR(300) NOT NULL,
      view_date DATE NOT NULL DEFAULT CURRENT_DATE,
      PRIMARY KEY (user_id, episode_id, view_date)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anime_comments (
      id SERIAL PRIMARY KEY,
      anime_id VARCHAR(200) NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      spoiler BOOLEAN DEFAULT FALSE,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id INTEGER NOT NULL REFERENCES anime_comments(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, comment_id)
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS anime_ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_id VARCHAR(200) NOT NULL,
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (user_id, anime_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'info',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_logs (
      query VARCHAR(300) NOT NULL PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      last_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE anime_comments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES anime_comments(id) ON DELETE CASCADE`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 100),
      max_uses INTEGER,
      uses_count INTEGER NOT NULL DEFAULT 0,
      expires_at TIMESTAMP WITH TIME ZONE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(200)`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(200)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS paypal_pending_orders (
      order_id      VARCHAR(100) PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan          VARCHAR(20) NOT NULL CHECK (plan IN ('monthly', 'annual')),
      promo_code    VARCHAR(50),
      expected_usd  VARCHAR(20) NOT NULL,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
  const defaults = [
    ["daily_limit", "5"],
    ["daily_limit_enabled", "true"],
    ["limit_message", "Has alcanzado tu límite diario de episodios gratuitos."],
    ["megafan_message", "¡Hazte MegaFan y disfruta sin límites!"],
    ["registration_enabled", "true"],
    ["maintenance_mode", "false"],
  ];
  for (const [key, value] of defaults) {
    await pool.query(
      `INSERT INTO admin_config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }
}
ensureAdminTables().catch((err) => console.error("ensureAdminTables error:", err));

/* ── GET /admin/stats ── */
router.get("/admin/stats", async (_req: AuthRequest, res) => {
  const safe = (p: Promise<any>, fallback: any) => p.catch(() => fallback);
  const zeroRow = { rows: [{ count: "0" }] };

  try {
    const [
      totalUsers, megafanUsers, episodesTodayRow, topAnime,
      newUsersWeek, totalComments, inactiveUsers, newUsersToday,
      recentUsers, megafanList, recentActivity, totalRevenueRow,
      growthChart, activeUsers, searchTrends, totalRatings,
    ] = await Promise.all([
      safe(pool.query(`SELECT COUNT(*) as count FROM users`), zeroRow),
      safe(pool.query(`SELECT COUNT(*) as count FROM users WHERE membership_tier = 'megafan'`), zeroRow),
      safe(pool.query(`
        SELECT COUNT(*) as count FROM (
          SELECT user_id, episode_id FROM user_daily_views WHERE view_date = CURRENT_DATE
          UNION
          SELECT user_id, episode_id FROM user_watch_progress
          WHERE DATE(updated_at) = CURRENT_DATE AND watch_time > 30
        ) combined
      `), zeroRow),
      safe(pool.query(`
        SELECT anime_id, anime_title, anime_image, COUNT(*) as views
        FROM user_history
        GROUP BY anime_id, anime_title, anime_image
        ORDER BY views DESC LIMIT 5
      `), { rows: [] }),
      safe(pool.query(`SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`), zeroRow),
      safe(pool.query(`SELECT COUNT(*) as count FROM anime_comments`), zeroRow),
      safe(pool.query(`SELECT COUNT(*) as count FROM users WHERE is_active = false`), zeroRow),
      safe(pool.query(`SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '1 day'`), zeroRow),
      safe(pool.query(`
        SELECT id, username, email, membership_tier, role, created_at
        FROM users ORDER BY created_at DESC LIMIT 8
      `), { rows: [] }),
      safe(pool.query(`
        SELECT id, username, email, created_at, subscription_expires_at
        FROM users WHERE membership_tier = 'megafan'
        ORDER BY created_at DESC LIMIT 20
      `), { rows: [] }),
      safe(pool.query(`
        SELECT u.username, p.anime_title, p.episode_num, p.updated_at
        FROM user_watch_progress p
        JOIN users u ON u.id = p.user_id
        WHERE p.watch_time > 30
        ORDER BY p.updated_at DESC LIMIT 10
      `), { rows: [] }),
      safe(pool.query(`SELECT COUNT(*) as count FROM users WHERE membership_tier = 'megafan'`), zeroRow),
      // Growth chart: daily new users last 30 days
      safe(pool.query(`
        SELECT TO_CHAR(created_at::date, 'DD/MM') as day, COUNT(*) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY created_at::date
        ORDER BY created_at::date
      `), { rows: [] }),
      // Active users: watched something in last 30 minutes
      safe(pool.query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM user_watch_progress
        WHERE updated_at >= NOW() - INTERVAL '30 minutes'
      `), zeroRow),
      // Search trends: top 10 queries
      safe(pool.query(`
        SELECT query, count FROM search_logs
        ORDER BY count DESC LIMIT 10
      `), { rows: [] }),
      // Total ratings in DB
      safe(pool.query(`SELECT COUNT(*) as count FROM anime_ratings`), zeroRow),
    ]);
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count) || 0,
      megafanUsers: parseInt(megafanUsers.rows[0].count) || 0,
      episodesToday: parseInt(episodesTodayRow.rows[0].count) || 0,
      topAnime: topAnime.rows,
      newUsersWeek: parseInt(newUsersWeek.rows[0].count) || 0,
      totalComments: parseInt(totalComments.rows[0].count) || 0,
      inactiveUsers: parseInt(inactiveUsers.rows[0].count) || 0,
      newUsersToday: parseInt(newUsersToday.rows[0].count) || 0,
      recentUsers: recentUsers.rows,
      megafanList: megafanList.rows,
      recentActivity: recentActivity.rows,
      totalRevenue: (parseInt(totalRevenueRow.rows[0].count) || 0) * 4,
      growthChart: growthChart.rows,
      activeUsers: parseInt(activeUsers.rows[0]?.count ?? "0") || 0,
      searchTrends: searchTrends.rows,
      totalRatings: parseInt(totalRatings.rows[0]?.count ?? "0") || 0,
    });
  } catch (err) {
    console.error("Admin stats error", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

/* ── GET /admin/export/users — CSV export ── */
router.get("/admin/export/users", async (_req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, role, membership_tier, is_active, created_at, subscription_expires_at
       FROM users ORDER BY created_at DESC`
    );
    const header = "ID,Usuario,Email,Rol,Tier,Activo,Registrado,Suscripción hasta\n";
    const csv = rows.map((r) =>
      [r.id, r.username, r.email, r.role, r.membership_tier,
       r.is_active ? "sí" : "no",
       new Date(r.created_at).toISOString().split("T")[0],
       r.subscription_expires_at ? new Date(r.subscription_expires_at).toISOString().split("T")[0] : ""
      ].join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="usuarios_${Date.now()}.csv"`);
    res.send(header + csv);
  } catch {
    res.status(500).json({ error: "Error al exportar" });
  }
});

/* ── GET /admin/users ── */
router.get("/admin/users", async (req: AuthRequest, res) => {
  const { q = "", page = "1", limit = "20", filter = "all" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const search = `%${q}%`;
    let filterClause = "";
    if (filter === "megafan") filterClause = "AND membership_tier = 'megafan'";
    else if (filter === "free") filterClause = "AND membership_tier = 'free'";
    else if (filter === "inactive") filterClause = "AND is_active = false";

    const { rows } = await pool.query(
      `SELECT id, username, email, avatar_url, role, membership_tier,
              subscription_expires_at, created_at, is_active
       FROM users
       WHERE (username ILIKE $1 OR email ILIKE $1) ${filterClause}
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [search, parseInt(limit), offset]
    );
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as count FROM users WHERE (username ILIKE $1 OR email ILIKE $1) ${filterClause}`,
      [search]
    );
    res.json({ users: rows, total: parseInt(countRows[0].count) });
  } catch (err) {
    console.error("Admin users error", err);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

/* ── PATCH /admin/users/:id ── */
router.patch("/admin/users/:id", async (req: AuthRequest, res) => {
  const { role, membership_tier, is_active } = req.body as Record<string, string | boolean>;
  const userId = parseInt(req.params.id as string);
  try {
    const updates: string[] = [];
    const values: (string | boolean | number)[] = [];
    let idx = 1;
    if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role as string); }
    if (membership_tier !== undefined) { updates.push(`membership_tier = $${idx++}`); values.push(membership_tier as string); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active as boolean); }
    if (updates.length === 0) { res.status(400).json({ error: "Nada que actualizar" }); return; }
    values.push(userId);
    const { rows } = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}
       RETURNING id, username, email, role, membership_tier, is_active`,
      values
    );
    if (!rows[0]) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error("Admin update user error", err);
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

/* ── GET /admin/config ── */
router.get("/admin/config", async (_req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(`SELECT key, value FROM admin_config`);
    const config: Record<string, string> = {};
    for (const row of rows) config[row.key] = row.value;
    res.json({ config });
  } catch {
    res.status(500).json({ error: "Error al obtener configuración" });
  }
});

/* ── PUT /admin/config ── */
router.put("/admin/config", async (req: AuthRequest, res) => {
  const updates = req.body as Record<string, string>;
  try {
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        `INSERT INTO admin_config (key, value, updated_at) VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)]
      );
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar configuración" });
  }
});

/* ── GET /admin/content ── */
router.get("/admin/content", async (_req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, anime_id, anime_title, anime_image, action, created_at
       FROM admin_content ORDER BY created_at DESC`
    );
    res.json({ items: rows });
  } catch {
    res.status(500).json({ error: "Error al obtener contenido" });
  }
});

/* ── POST /admin/content ── */
router.post("/admin/content", async (req: AuthRequest, res) => {
  const { animeId, animeTitle, animeImage, action } = req.body as Record<string, string>;
  if (!animeId || !action) {
    res.status(400).json({ error: "animeId y action son requeridos" });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO admin_content (anime_id, anime_title, anime_image, action)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (anime_id, action)
       DO UPDATE SET anime_title = $2, anime_image = $3`,
      [animeId, animeTitle ?? "", animeImage ?? "", action]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar" });
  }
});

/* ── DELETE /admin/content/:id ── */
router.delete("/admin/content/:id", async (req: AuthRequest, res) => {
  try {
    await pool.query(`DELETE FROM admin_content WHERE id = $1`, [parseInt(req.params.id as string)]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

/* ── GET /admin/comments ── */
router.get("/admin/comments", async (req: AuthRequest, res) => {
  const { page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.text, c.spoiler, c.likes, c.created_at,
              c.anime_id, u.username as author, u.id as user_id
       FROM anime_comments c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    ).catch(() => ({ rows: [] }));
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as count FROM anime_comments`
    ).catch(() => ({ rows: [{ count: "0" }] }));
    res.json({ comments: rows, total: parseInt(countRows[0].count) });
  } catch {
    res.status(500).json({ error: "Error al obtener comentarios" });
  }
});

/* ── DELETE /admin/comments/:id ── */
router.delete("/admin/comments/:id", async (req: AuthRequest, res) => {
  try {
    await pool.query(`DELETE FROM anime_comments WHERE id = $1`, [parseInt(req.params.id as string)]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar comentario" });
  }
});

/* ── GET /admin/promo-codes ── */
router.get("/admin/promo-codes", async (_req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, code, discount_percent, max_uses, uses_count, expires_at, active, created_at
         FROM promo_codes
        ORDER BY created_at DESC`
    );
    res.json({ codes: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /admin/promo-codes ── */
router.post("/admin/promo-codes", async (req: AuthRequest, res) => {
  const { code, discountPercent, maxUses, expiresAt } = req.body as {
    code: string;
    discountPercent: number;
    maxUses?: number | null;
    expiresAt?: string | null;
  };

  if (!code || !discountPercent) {
    res.status(400).json({ error: "code y discountPercent son requeridos" });
    return;
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO promo_codes (code, discount_percent, max_uses, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, code, discount_percent, max_uses, uses_count, expires_at, active, created_at`,
      [
        code.toUpperCase().trim(),
        Math.min(100, Math.max(1, parseInt(String(discountPercent)))),
        maxUses ?? null,
        expiresAt ?? null,
      ]
    );
    res.json({ code: rows[0] });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Ya existe un cupón con ese código" });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

/* ── PATCH /admin/promo-codes/:id ── toggle active */
router.patch("/admin/promo-codes/:id", async (req: AuthRequest, res) => {
  const { active } = req.body as { active: boolean };
  try {
    const { rows } = await pool.query(
      `UPDATE promo_codes SET active = $1 WHERE id = $2
       RETURNING id, code, discount_percent, max_uses, uses_count, expires_at, active`,
      [active, parseInt(req.params.id as string)]
    );
    if (rows.length === 0) { res.status(404).json({ error: "No encontrado" }); return; }
    res.json({ code: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE /admin/promo-codes/:id ── */
router.delete("/admin/promo-codes/:id", async (req: AuthRequest, res) => {
  try {
    await pool.query(`DELETE FROM promo_codes WHERE id = $1`, [parseInt(req.params.id as string)]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET /admin/transactions ── */
router.get("/admin/transactions", async (req: AuthRequest, res) => {
  const { from, to, page = "1", limit = "20" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const paypalConfigured = isPayPalConfigured();

  try {
    /* ── 1. Local one-time PayPal captures ── */
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let idx = 1;
    if (from) { conditions.push(`t.created_at >= $${idx++}`); values.push(from); }
    if (to)   { conditions.push(`t.created_at <= $${idx++}`); values.push(to + "T23:59:59"); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [txRows, countRows, sumRows] = await Promise.all([
      pool.query(
        `SELECT t.id, t.order_id, t.amount_usd, t.plan, t.promo_code, t.status, t.created_at,
                u.username, u.email
           FROM paypal_transactions t
           JOIN users u ON u.id = t.user_id
           ${where}
           ORDER BY t.created_at DESC
           LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, parseInt(limit), offset]
      ),
      pool.query(`SELECT COUNT(*) as count FROM paypal_transactions t ${where}`, values),
      pool.query(`SELECT COALESCE(SUM(amount_usd), 0) as total FROM paypal_transactions t ${where}`, values),
    ]);

    /* ── 2. PayPal subscription details + reporting (real PayPal API calls) ── */
    let subscriptions: Array<{
      subscription_id: string; status: string; username: string; email: string;
      last_payment_amount?: string; last_payment_time?: string; next_billing_time?: string;
      start_time: string;
    }> = [];
    let paypalError: string | null = null;
    let paypalReporting: PayPalReportingTx[] = [];

    if (paypalConfigured) {
      try {
        const { rows: subUsers } = await pool.query(
          `SELECT id, username, email, paypal_subscription_id
             FROM users
            WHERE paypal_subscription_id IS NOT NULL
              AND membership_tier = 'megafan'
            ORDER BY id`
        );

        if (subUsers.length > 0) {
          const token = await getPayPalToken();
          const subDetails = await Promise.all(
            subUsers.map(async (u: { id: number; username: string; email: string; paypal_subscription_id: string }) => {
              const sub = await fetchSubscription(token, u.paypal_subscription_id);
              if (!sub) return null;
              return {
                subscription_id: u.paypal_subscription_id,
                status: sub.status,
                username: u.username,
                email: u.email,
                last_payment_amount: sub.billing_info?.last_payment?.amount?.value,
                last_payment_time:   sub.billing_info?.last_payment?.time,
                next_billing_time:   sub.billing_info?.next_billing_time,
                start_time:          sub.start_time,
              };
            })
          );
          subscriptions = subDetails.filter(Boolean) as typeof subscriptions;
        }

        /* ── 3. PayPal Reporting API — always fetch (default last 30 days) ── */
        const startDate = from
          ? new Date(from).toISOString()
          : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
        const endDate = to
          ? new Date(to + "T23:59:59").toISOString()
          : new Date().toISOString();
        const reportToken = await getPayPalToken();
        const reportResult = await fetchReportingTransactions(reportToken, startDate, endDate);
        paypalReporting = reportResult.rows;
        if (reportResult.error) {
          paypalError = (paypalError ? paypalError + " | " : "") + `Reporting: ${reportResult.error}`;
        }

      } catch (ppErr: any) {
        paypalError = `PayPal API: ${ppErr.message}`;
        console.warn("PayPal admin fetch error", ppErr);
      }
    }

    res.json({
      transactions: txRows.rows,
      total: parseInt(countRows.rows[0].count),
      totalRevenue: parseFloat(sumRows.rows[0].total),
      subscriptions,
      paypalConfigured,
      paypalError,
      paypalReporting: paypalReporting.slice(0, 200),
    });
  } catch (err: any) {
    console.error("Admin transactions error", err);
    res.status(500).json({ error: err.message });
  }
});

/* ── POST /admin/send-email ── */
router.post("/admin/send-email", async (req: AuthRequest, res) => {
  const { to, subject, body } = req.body as { to: "all" | "megafan" | "free"; subject: string; body: string };
  if (!to || !subject || !body) {
    res.status(400).json({ error: "to, subject y body son requeridos" });
    return;
  }

  /* Check SMTP config */
  const smtpHost = process.env["SMTP_HOST"];
  if (!smtpHost) {
    res.status(503).json({ error: "SMTP no configurado. Añade SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM a las variables de entorno." });
    return;
  }

  let tierFilter = "";
  if (to === "megafan") tierFilter = "WHERE membership_tier = 'megafan' AND is_active = TRUE";
  else if (to === "free") tierFilter = "WHERE membership_tier = 'free' AND is_active = TRUE";
  else tierFilter = "WHERE is_active = TRUE";

  try {
    const { rows: recipients } = await pool.query(
      `SELECT email, username FROM users ${tierFilter} ORDER BY id`
    );
    if (recipients.length === 0) {
      res.json({ ok: true, sent: 0, total: 0, errors: [], message: "No hay destinatarios para el segmento elegido" });
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env["SMTP_PORT"] ?? "587"),
      secure: process.env["SMTP_PORT"] === "465",
      auth: {
        user: process.env["SMTP_USER"],
        pass: process.env["SMTP_PASS"],
      },
    });

    const from = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"] ?? "noreply@animeflex.app";
    let sent = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      try {
        await transporter.sendMail({
          from,
          to: r.email,
          subject,
          text: body,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>${body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br>")}</p><hr><p style="font-size:11px;color:#888">AnimeFlex — Para darte de baja responde a este correo.</p></div>`,
        });
        sent++;
      } catch (e: any) {
        errors.push(`${r.email}: ${e.message}`);
      }
    }

    res.json({ ok: true, sent, total: recipients.length, errors: errors.slice(0, 5) });
  } catch (err: any) {
    console.error("Send email error", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
