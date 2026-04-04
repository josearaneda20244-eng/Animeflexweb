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
    // Add is_active column to users if not exists
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
    `);
    // Default config values
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
  ensureAdminTables().catch(() => {});

  /* ── GET /admin/stats ── */
  router.get("/admin/stats", async (req: AuthRequest, res) => {
    try {
      const [totalUsers, megafanUsers, historyToday, topAnime, newUsersWeek] = await Promise.all([
        pool.query(`SELECT COUNT(*) as count FROM users`),
        pool.query(`SELECT COUNT(*) as count FROM users WHERE membership_tier = 'megafan'`),
        pool.query(`SELECT COUNT(*) as count FROM user_history WHERE watched_at >= NOW() - INTERVAL '1 day'`),
        pool.query(`
          SELECT anime_id, anime_title, anime_image, COUNT(*) as views
          FROM user_history
          GROUP BY anime_id, anime_title, anime_image
          ORDER BY views DESC LIMIT 5
        `),
        pool.query(`SELECT COUNT(*) as count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`),
      ]);
      res.json({
        totalUsers: parseInt(totalUsers.rows[0].count),
        megafanUsers: parseInt(megafanUsers.rows[0].count),
        episodesToday: parseInt(historyToday.rows[0].count),
        topAnime: topAnime.rows,
        newUsersWeek: parseInt(newUsersWeek.rows[0].count),
      });
    } catch (err: any) {
      req.log.error({ err }, "Admin stats error");
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  /* ── GET /admin/users ── */
  router.get("/admin/users", async (req: AuthRequest, res) => {
    const { q = "", page = "1", limit = "20" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
      const search = `%${q}%`;
      const { rows } = await pool.query(
        `SELECT id, username, email, avatar_url, role, membership_tier,
                subscription_expires_at, created_at, is_active
         FROM users
         WHERE (username ILIKE $1 OR email ILIKE $1)
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [search, parseInt(limit), offset]
      );
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) as count FROM users WHERE (username ILIKE $1 OR email ILIKE $1)`,
        [search]
      );
      res.json({ users: rows, total: parseInt(countRows[0].count) });
    } catch (err: any) {
      req.log.error({ err }, "Admin users error");
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  /* ── PATCH /admin/users/:id ── */
  router.patch("/admin/users/:id", async (req: AuthRequest, res) => {
    const { role, membership_tier, is_active } = req.body as Record<string, string | boolean>;
    const userId = parseInt(req.params.id);
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
    } catch (err: any) {
      req.log.error({ err }, "Admin update user error");
      res.status(500).json({ error: "Error al actualizar usuario" });
    }
  });

  /* ── GET /admin/config ── */
  router.get("/admin/config", async (req: AuthRequest, res) => {
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
  router.get("/admin/content", async (req: AuthRequest, res) => {
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
      await pool.query(`DELETE FROM admin_content WHERE id = $1`, [parseInt(req.params.id)]);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Error al eliminar" });
    }
  });

  export default router;
  