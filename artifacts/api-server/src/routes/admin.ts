import { Router } from "express";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

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
    ] = await Promise.all([
      safe(pool.query(`SELECT COUNT(*) as count FROM users`), zeroRow),
      safe(pool.query(`SELECT COUNT(*) as count FROM users WHERE membership_tier = 'megafan'`), zeroRow),
      // Episodios vistos hoy: user_daily_views (todos los usuarios, incluyendo megafan)
      safe(pool.query(`
        SELECT COUNT(*) as count FROM (
          SELECT user_id, episode_id FROM user_daily_views WHERE view_date = CURRENT_DATE
          UNION
          SELECT user_id, episode_id FROM user_watch_progress
          WHERE DATE(updated_at) = CURRENT_DATE AND watch_time > 30
        ) combined
      `), zeroRow),
      // Top anime desde user_history
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
      // Últimos 8 usuarios registrados
      safe(pool.query(`
        SELECT id, username, email, membership_tier, role, created_at
        FROM users ORDER BY created_at DESC LIMIT 8
      `), { rows: [] }),
      // Lista de suscriptores MegaFan
      safe(pool.query(`
        SELECT id, username, email, created_at, subscription_expires_at
        FROM users WHERE membership_tier = 'megafan'
        ORDER BY created_at DESC LIMIT 20
      `), { rows: [] }),
      // Actividad reciente (últimos episodios vistos)
      safe(pool.query(`
        SELECT u.username, p.anime_title, p.episode_num, p.updated_at
        FROM user_watch_progress p
        JOIN users u ON u.id = p.user_id
        WHERE p.watch_time > 30
        ORDER BY p.updated_at DESC LIMIT 10
      `), { rows: [] }),
      // Ingresos totales acumulados (megafan × $4)
      safe(pool.query(`SELECT COUNT(*) as count FROM users WHERE membership_tier = 'megafan'`), zeroRow),
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
    });
  } catch (err) {
    console.error("Admin stats error", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
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

export default router;
