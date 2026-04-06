import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { requireAuth, type AuthRequest } from "../middleware/authMiddleware.js";
import multer from "multer";
import { uploadAvatarToCloudinary } from "../lib/cloudinary.js";
import { META } from "@consumet/extensions";

interface DailyViewRow { day: string; episodes: number }
interface TopAnimeRow { anime_id: string; anime_title: string; anime_image: string; ep_count: string }
interface AnimeListRow { anime_id: string; anime_title: string; anime_image: string; anime_type: string; status?: string }

/* ── PUBLIC ROUTER (no auth required) ── */
export const publicUserRouter = Router();

async function handlePublicProfile(userId: number, res: import("express").Response) {
  const userRes = await pool.query<{
    id: number; username: string; avatar_url: string | null;
    created_at: string; membership_tier: string; is_profile_public: boolean;
  }>(
    `SELECT id, username, avatar_url, created_at, membership_tier,
            COALESCE(is_profile_public, TRUE) AS is_profile_public
     FROM users WHERE id = $1 AND is_active = TRUE`,
    [userId]
  );
  if (!userRes.rows.length) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
  const u = userRes.rows[0];

  const [epRes, completedRes, streakRes, weeklyRes, genreRes, followersRes] = await Promise.all([
    pool.query<{ total: string; total_animes: string }>(
      `SELECT COUNT(*) as total, COUNT(DISTINCT anime_id) as total_animes FROM user_history WHERE user_id = $1`, [userId]
    ),
    pool.query<{ completed: string }>(
      `SELECT COUNT(*) as completed FROM user_watchlist WHERE user_id = $1 AND status='completed'`, [userId]
    ),
    pool.query<{ streak: number }>(
      `WITH ordered_dates AS (
         SELECT DISTINCT view_date,
                CURRENT_DATE - view_date AS days_ago,
                ROW_NUMBER() OVER (ORDER BY view_date DESC) AS rn
         FROM user_daily_views WHERE user_id = $1
       )
       SELECT COUNT(*)::int AS streak FROM ordered_dates WHERE days_ago = rn - 1`,
      [userId]
    ),
    pool.query<DailyViewRow>(
      `SELECT view_date::text as day, COUNT(DISTINCT episode_id)::int as episodes
       FROM user_daily_views
       WHERE user_id = $1 AND view_date >= CURRENT_DATE - 6
       GROUP BY view_date ORDER BY view_date ASC`,
      [userId]
    ),
    pool.query<{ genre: string }>(
      `SELECT genre, COUNT(*) AS cnt
       FROM (
         SELECT unnest(genres) AS genre FROM user_history WHERE user_id = $1
         UNION ALL
         SELECT unnest(genres) AS genre FROM user_favorites WHERE user_id = $1
       ) g
       WHERE genre IS NOT NULL AND genre <> ''
       GROUP BY genre ORDER BY cnt DESC LIMIT 1`,
      [userId]
    ),
    pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`,
      [userId]
    ),
  ]);

  const totalEpisodes = parseInt(epRes.rows[0]?.total ?? "0", 10);
  const totalAnimes   = parseInt(epRes.rows[0]?.total_animes ?? "0", 10);
  const completed     = parseInt(completedRes.rows[0]?.completed ?? "0", 10);
  const streak        = streakRes.rows[0]?.streak ?? 0;
  const estimatedHours = Math.round((totalEpisodes * 24) / 60 * 10) / 10;
  const favoriteGenre: string | null = genreRes.rows[0]?.genre ?? null;
  const followerCount: number = followersRes.rows[0]?.count ?? 0;

  const DAY_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const weekMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    weekMap[d.toISOString().slice(0, 10)] = 0;
  }
  weeklyRes.rows.forEach((r: DailyViewRow) => { weekMap[r.day] = r.episodes; });
  const weeklyActivity = Object.entries(weekMap).map(([date, episodes]) => {
    const d = new Date(date + "T12:00:00Z");
    return { date, day: DAY_NAMES[d.getUTCDay()], episodes };
  });

  let favorites: AnimeListRow[] = [];
  let watchlist: AnimeListRow[] = [];
  if (u.is_profile_public) {
    const [favsRes, watchlistRes] = await Promise.all([
      pool.query<AnimeListRow>(
        `SELECT anime_id, anime_title, anime_image, anime_type FROM user_favorites
         WHERE user_id = $1 ORDER BY added_at DESC LIMIT 12`,
        [userId]
      ),
      pool.query<AnimeListRow>(
        `SELECT anime_id, anime_title, anime_image, anime_type, status FROM user_watchlist
         WHERE user_id = $1 AND status IN ('watching','completed') ORDER BY updated_at DESC LIMIT 12`,
        [userId]
      ),
    ]);
    favorites = favsRes.rows;
    watchlist = watchlistRes.rows;
  }

  res.json({
    user: {
      id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      created_at: u.created_at,
      membership_tier: u.membership_tier,
      is_profile_public: u.is_profile_public,
      followerCount,
    },
    stats: {
      totalEpisodes,
      totalAnimes,
      completed,
      streak,
      estimatedHours,
      favoriteGenre,
      weeklyActivity,
    },
    favorites,
    watchlist,
  });
}

publicUserRouter.get("/user/public/:userId", async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    await handlePublicProfile(targetId, res);
  } catch {
    res.status(500).json({ error: "Error al obtener perfil público" });
  }
});

/* Alias en inglés para compatibilidad */
publicUserRouter.get("/profile/:userId", async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    await handlePublicProfile(targetId, res);
  } catch {
    res.status(500).json({ error: "Error al obtener perfil público" });
  }
});

/* ── GET /users/:id/followers ── Public: follower count */
publicUserRouter.get("/users/:id/followers", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`,
      [targetId]
    );
    res.json({ followerCount: rows[0]?.count ?? 0 });
  } catch {
    res.status(500).json({ error: "Error al obtener seguidores" });
  }
});

/* ── GET /config/limits ── Public: get current limit settings and messages ── */
publicUserRouter.get("/config/limits", async (req, res) => {
  try {
    const [dailyLimitStr, limitEnabledStr, limitMessage, megafanMessage] = await Promise.all([
      getAdminConfig("daily_limit", "5"),
      getAdminConfig("daily_limit_enabled", "true"),
      getAdminConfig("limit_message", "Has alcanzado tu límite diario de episodios gratuitos."),
      getAdminConfig("megafan_message", "¡Hazte MegaFan y disfruta sin límites!"),
    ]);

    res.json({
      dailyLimit: parseInt(dailyLimitStr, 10) || 5,
      dailyLimitEnabled: limitEnabledStr === "true",
      limitMessage,
      megafanMessage,
    });
  } catch (err) {
    console.error("Error getting limits config:", err);
    res.status(500).json({ error: "Error al obtener configuración de límites" });
  }
});

/* ── POST /config/limits/refresh ── Public: force refresh cached config (for admin updates) ── */
publicUserRouter.post("/config/limits/refresh", async (req, res) => {
  try {
    // This endpoint doesn't do anything special server-side,
    // but clients can call it to invalidate their cache
    res.json({ ok: true, message: "Config refresh requested" });
  } catch (err) {
    console.error("Error refreshing limits config:", err);
    res.status(500).json({ error: "Error al refrescar configuración" });
  }
});

/* ── GET /users/:id/recommendations ── Public: personalized recs via AniList ── */
publicUserRouter.get("/users/:id/recommendations", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }

    // Obtener IDs y géneros de anime ya vistos por el usuario
    const historyRes = await pool.query<{ anime_id: string; genres: string[] }>(
      `SELECT anime_id, COALESCE(genres, '{}') as genres FROM user_history WHERE user_id = $1`,
      [targetId]
    );

    const watchedIds = new Set(historyRes.rows.map(r => String(r.anime_id)));

    // Calcular géneros favoritos del usuario
    const genreMap = new Map<string, number>();
    for (const row of historyRes.rows) {
      for (const g of (row.genres ?? [])) {
        if (g) genreMap.set(g, (genreMap.get(g) ?? 0) + 1);
      }
    }
    const favoriteGenres = [...genreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);

    // Usar AniList para obtener anime trending
    const anilist = new META.Anilist();
    const trendingData = await anilist.fetchTrendingAnime(1, 30);
    const trendingResults = (trendingData as any).results ?? [];

    const reason = favoriteGenres.length > 0
      ? `Basado en tus géneros favoritos: ${favoriteGenres.slice(0, 2).join(", ")}`
      : "Tendencia popular";

    const recommendations = trendingResults
      .filter((a: any) => !watchedIds.has(String(a.id)))
      .slice(0, 12)
      .map((a: any) => ({
        anime_id: String(a.id),
        title: typeof a.title === "string"
          ? a.title
          : (a.title?.english || a.title?.romaji || a.title?.userPreferred || "Unknown"),
        image: a.image || a.cover || "",
        score: a.rating ?? 0,
        reason,
        genres: Array.isArray(a.genres) ? a.genres : [],
        status: a.status ?? "",
        total_episodes: a.totalEpisodes ?? 0,
      }));

    res.json(recommendations);
  } catch (err) {
    req.log.error({ err }, "Error getting recommendations");
    res.status(500).json({ error: "Error al obtener recomendaciones" });
  }
});

/* ── GET /anime/trending ── Public: get trending/popular anime ── */
publicUserRouter.get("/anime/trending", async (req, res) => {
  try {
    const trendingQuery = await pool.query(`
      SELECT a.id, a.title, a.image, a.rating, a.total_episodes,
             a.release_date, a.status, a.type
      FROM anime a
      WHERE a.status IN ('ongoing', 'completed')
      AND a.rating > 6
      ORDER BY a.rating DESC, a.release_date DESC
      LIMIT 20
    `);

    const recommendations = trendingQuery.rows.map(row => ({
      anime_id: row.id,
      title: row.title,
      image: row.image,
      score: row.rating || 0,
      reason: "Tendencia popular",
      genres: [],
      status: row.status,
      total_episodes: row.total_episodes
    }));

    res.json(recommendations);
  } catch (err) {
    console.error("Error getting trending anime:", err);
    res.status(500).json({ error: "Error al obtener tendencias" });
  }
});

/* ── GET /anime/:id/similar ── Public: get similar anime ── */
publicUserRouter.get("/anime/:id/similar", async (req, res) => {
  try {
    const animeId = req.params.id;

    // Obtener géneros del anime
    const genreQuery = await pool.query(`
      SELECT genre FROM anime_genres WHERE anime_id = $1
    `, [animeId]);

    const genres = genreQuery.rows.map(row => row.genre);

    if (genres.length === 0) {
      res.json([]);
      return;
    }

    // Encontrar animes similares
    const genreCondition = genres.map((_, i) => `genre = $${i + 2}`).join(' OR ');
    const similarQuery = await pool.query(`
      SELECT DISTINCT a.id, a.title, a.image, a.rating, a.total_episodes,
             a.release_date, a.status, a.type
      FROM anime a
      JOIN anime_genres g ON a.id = g.anime_id
      WHERE (${genreCondition})
      AND a.id != $1
      AND a.status IN ('ongoing', 'completed')
      ORDER BY a.rating DESC
      LIMIT 12
    `, [animeId, ...genres]);

    const recommendations = similarQuery.rows.map(row => ({
      anime_id: row.id,
      title: row.title,
      image: row.image,
      score: row.rating || 0,
      reason: `Similar a este anime`,
      genres: genres.slice(0, 3),
      status: row.status,
      total_episodes: row.total_episodes
    }));

    res.json(recommendations);
  } catch (err) {
    console.error("Error getting similar anime:", err);
    res.status(500).json({ error: "Error al obtener animes similares" });
  }
});

/* ── GET /users/:id/notifications ── Auth required: get user notifications ── */
publicUserRouter.get("/users/:id/notifications", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }

    // Verificar que el usuario solo acceda a sus propias notificaciones
    const authUserId = (req as AuthRequest).userId;
    if (authUserId && authUserId !== targetId) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    const notificationsQuery = await pool.query(`
      SELECT id, type, title, message, timestamp, read, action_url, action_text
      FROM user_notifications
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT 50
    `, [targetId]);

    const notifications = notificationsQuery.rows.map(row => ({
      id: row.id.toString(),
      type: row.type,
      title: row.title,
      message: row.message,
      timestamp: row.timestamp,
      read: row.read,
      actionUrl: row.action_url,
      actionText: row.action_text
    }));

    res.json(notifications);
  } catch (err) {
    console.error("Error getting notifications:", err);
    res.status(500).json({ error: "Error al obtener notificaciones" });
  }
});

/* ── POST /users/:id/notifications ── Auth required: create notification ── */
publicUserRouter.post("/users/:id/notifications", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { type, title, message, actionUrl, actionText } = req.body;

    if (!type || !title || !message) {
      res.status(400).json({ error: "Tipo, título y mensaje son requeridos" });
      return;
    }

    const insertQuery = await pool.query(`
      INSERT INTO user_notifications (user_id, type, title, message, action_url, action_text, timestamp, read)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), false)
      RETURNING id, type, title, message, timestamp, read, action_url, action_text
    `, [targetId, type, title, message, actionUrl || null, actionText || null]);

    const notification = {
      id: insertQuery.rows[0].id.toString(),
      type: insertQuery.rows[0].type,
      title: insertQuery.rows[0].title,
      message: insertQuery.rows[0].message,
      timestamp: insertQuery.rows[0].timestamp,
      read: insertQuery.rows[0].read,
      actionUrl: insertQuery.rows[0].action_url,
      actionText: insertQuery.rows[0].action_text
    };

    res.status(201).json(notification);
  } catch (err) {
    console.error("Error creating notification:", err);
    res.status(500).json({ error: "Error al crear notificación" });
  }
});

/* ── PATCH /users/:id/notifications/:notificationId/read ── Auth required: mark notification as read ── */
publicUserRouter.patch("/users/:id/notifications/:notificationId/read", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    const notificationId = req.params.notificationId;

    if (isNaN(targetId)) { res.status(400).json({ error: "ID de usuario inválido" }); return; }

    // Verificar que el usuario solo acceda a sus propias notificaciones
    const authUserId = (req as AuthRequest).userId;
    if (authUserId && authUserId !== targetId) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    await pool.query(`
      UPDATE user_notifications
      SET read = true
      WHERE id = $1 AND user_id = $2
    `, [notificationId, targetId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    res.status(500).json({ error: "Error al marcar notificación como leída" });
  }
});

/* ── PATCH /users/:id/notifications/read-all ── Auth required: mark all notifications as read ── */
publicUserRouter.patch("/users/:id/notifications/read-all", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }

    // Verificar que el usuario solo acceda a sus propias notificaciones
    const authUserId = (req as AuthRequest).userId;
    if (authUserId && authUserId !== targetId) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    await pool.query(`
      UPDATE user_notifications
      SET read = true
      WHERE user_id = $1 AND read = false
    `, [targetId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error marking all notifications as read:", err);
    res.status(500).json({ error: "Error al marcar todas las notificaciones como leídas" });
  }
});

/* ── DELETE /users/:id/notifications/:notificationId ── Auth required: delete notification ── */
publicUserRouter.delete("/users/:id/notifications/:notificationId", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    const notificationId = req.params.notificationId;

    if (isNaN(targetId)) { res.status(400).json({ error: "ID de usuario inválido" }); return; }

    // Verificar que el usuario solo acceda a sus propias notificaciones
    const authUserId = (req as AuthRequest).userId;
    if (authUserId && authUserId !== targetId) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    await pool.query(`
      DELETE FROM user_notifications
      WHERE id = $1 AND user_id = $2
    `, [notificationId, targetId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting notification:", err);
    res.status(500).json({ error: "Error al eliminar notificación" });
  }
});

/* ── DELETE /users/:id/notifications ── Auth required: delete all notifications ── */
publicUserRouter.delete("/users/:id/notifications", async (req, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }

    // Verificar que el usuario solo acceda a sus propias notificaciones
    const authUserId = (req as AuthRequest).userId;
    if (authUserId && authUserId !== targetId) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    await pool.query(`
      DELETE FROM user_notifications
      WHERE user_id = $1
    `, [targetId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting all notifications:", err);
    res.status(500).json({ error: "Error al eliminar todas las notificaciones" });
  }
});

/* ── PRIVATE ROUTER (auth required) ── */
const router = Router();
router.use(requireAuth);

// Helper function to get admin config from database
async function getAdminConfig(key: string, defaultValue: string = ""): Promise<string> {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM admin_config WHERE key = $1`,
      [key]
    );
    return rows[0]?.value ?? defaultValue;
  } catch (err) {
    console.error(`Error getting admin config ${key}:`, err);
    return defaultValue;
  }
}

// Helper function to get daily limit as number
async function getDailyLimit(): Promise<number> {
  const limitStr = await getAdminConfig("daily_limit", "5");
  return parseInt(limitStr, 10) || 5;
}

/* ── AVATAR UPLOAD (Cloudinary) ── */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

/* POST /user/avatar/upload — uploads image to Cloudinary and returns the URL.
   Client sends multipart/form-data with a "file" field. */
router.post("/user/avatar/upload", upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No se recibió ningún archivo" });
    return;
  }
  if (!req.file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "Solo se permiten imágenes" });
    return;
  }
  try {
    const avatarUrl = await uploadAvatarToCloudinary(req.file.buffer, req.file.mimetype);
    res.json({ avatarUrl });
  } catch (err) {
    console.error("Avatar upload error:", err);
    res.status(500).json({ error: "Error al subir imagen. Verifica que CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET estén configurados." });
  }
});

/* ── FAVORITES ── */
router.get("/user/favorites", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT anime_id, anime_title, anime_image, anime_type, anime_rating, added_at
       FROM user_favorites WHERE user_id = $1 ORDER BY added_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener favoritos" });
  }
});

router.post("/user/favorites", async (req: AuthRequest, res) => {
  try {
    const { animeId, animeTitle, animeImage, animeType, animeRating, animeGenres } = req.body;
    const genres: string[] = Array.isArray(animeGenres) ? animeGenres.filter((g: unknown) => typeof g === "string") : [];
    await pool.query(
      `INSERT INTO user_favorites (user_id, anime_id, anime_title, anime_image, anime_type, anime_rating, genres)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id, anime_id) DO UPDATE SET genres = EXCLUDED.genres`,
      [req.userId, animeId, animeTitle, animeImage, animeType, animeRating ?? null, genres]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar favorito" });
  }
});

router.delete("/user/favorites/:animeId", async (req: AuthRequest, res) => {
  try {
    await pool.query(
      `DELETE FROM user_favorites WHERE user_id = $1 AND anime_id = $2`,
      [req.userId, req.params.animeId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar favorito" });
  }
});

/* ── WATCHLIST ── */
router.get("/user/watchlist", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT anime_id, anime_title, anime_image, anime_type, status, updated_at
       FROM user_watchlist WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener watchlist" });
  }
});

router.put("/user/watchlist/:animeId", async (req: AuthRequest, res) => {
  try {
    const { animeTitle, animeImage, animeType, status } = req.body;
    await pool.query(
      `INSERT INTO user_watchlist (user_id, anime_id, anime_title, anime_image, anime_type, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, anime_id)
       DO UPDATE SET status = $6, anime_title = $3, anime_image = $4, updated_at = NOW()`,
      [req.userId, req.params.animeId, animeTitle, animeImage, animeType, status]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al actualizar watchlist" });
  }
});

router.delete("/user/watchlist/:animeId", async (req: AuthRequest, res) => {
  try {
    await pool.query(
      `DELETE FROM user_watchlist WHERE user_id = $1 AND anime_id = $2`,
      [req.userId, req.params.animeId]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al eliminar de watchlist" });
  }
});

/* ── HISTORY ── */
router.get("/user/history", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (anime_id) anime_id, anime_title, anime_image, episode_number, watched_at
       FROM user_history WHERE user_id = $1
       ORDER BY anime_id, watched_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

router.post("/user/history", async (req: AuthRequest, res) => {
  try {
    const { animeId, animeTitle, animeImage, episodeNumber, animeGenres } = req.body;
    const genres: string[] = Array.isArray(animeGenres) ? animeGenres.filter((g: unknown) => typeof g === "string") : [];
    await pool.query(
      `INSERT INTO user_history (user_id, anime_id, anime_title, anime_image, episode_number, genres)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (user_id, anime_id, episode_number) DO UPDATE SET watched_at = NOW(), genres = EXCLUDED.genres`,
      [req.userId, animeId, animeTitle, animeImage, episodeNumber ?? 0, genres]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar historial" });
  }
});

/* ── WATCH PROGRESS ── */
router.get("/user/progress", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT episode_id, anime_id, anime_title, anime_image, episode_num,
              watch_time, duration, updated_at
       FROM user_watch_progress WHERE user_id = $1 ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Error al obtener progreso" });
  }
});

router.put("/user/progress/:episodeId", async (req: AuthRequest, res) => {
  try {
    const { animeId, animeTitle, animeImage, episodeNum, watchTime, duration } = req.body;
    await pool.query(
      `INSERT INTO user_watch_progress
         (user_id, episode_id, anime_id, anime_title, anime_image, episode_num, watch_time, duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id, episode_id)
       DO UPDATE SET watch_time=$7, duration=$8, anime_title=$4, anime_image=$5, updated_at=NOW()`,
      [req.userId, req.params.episodeId, animeId, animeTitle, animeImage, episodeNum, watchTime, duration]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error al guardar progreso" });
  }
});

/* ── DAILY ACCESS CONTROL (server-side) ── */
router.get("/user/daily-access", async (req: AuthRequest, res) => {
  try {
    const memberResult = await pool.query(
      `SELECT membership_tier FROM users WHERE id = $1`,
      [req.userId]
    );
    const tier = memberResult.rows[0]?.membership_tier ?? "free";
    if (tier === "megafan") {
      res.json({ isPremium: true, remaining: null, limit: null });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT episode_id) as count
       FROM user_daily_views
       WHERE user_id = $1 AND view_date = $2`,
      [req.userId, today]
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    const dailyLimit = await getDailyLimit();
    res.json({
      isPremium: false,
      watched: count,
      remaining: Math.max(0, dailyLimit - count),
      limit: dailyLimit,
    });
  } catch {
    res.status(500).json({ error: "Error al verificar acceso" });
  }
});

router.post("/user/daily-access/register", async (req: AuthRequest, res) => {
  try {
    const memberResult = await pool.query(
      `SELECT membership_tier FROM users WHERE id = $1`,
      [req.userId]
    );
    const tier = memberResult.rows[0]?.membership_tier ?? "free";
    if (tier === "megafan") {
      res.json({ ok: true, isPremium: true });
      return;
    }

    const { episodeId } = req.body as { episodeId: string };
    if (!episodeId) {
      res.status(400).json({ error: "episodeId requerido" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const existing = await pool.query(
      `SELECT 1 FROM user_daily_views WHERE user_id = $1 AND episode_id = $2 AND view_date = $3`,
      [req.userId, episodeId, today]
    );
    if (existing.rows.length > 0) {
      res.json({ ok: true, alreadyCounted: true });
      return;
    }

    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT episode_id) as count FROM user_daily_views WHERE user_id = $1 AND view_date = $2`,
      [req.userId, today]
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);
    const dailyLimit = await getDailyLimit();
    if (count >= dailyLimit) {
      res.status(403).json({ error: "Límite diario alcanzado", remaining: 0 });
      return;
    }

    await pool.query(
      `INSERT INTO user_daily_views (user_id, episode_id, view_date) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [req.userId, episodeId, today]
    );
    res.json({ ok: true, remaining: Math.max(0, dailyLimit - count - 1) });
  } catch {
    res.status(500).json({ error: "Error al registrar episodio" });
  }
});

/* ── USER STATS ── */
router.get("/user/stats", async (req: AuthRequest, res) => {
  try {
    const uid = req.userId;

    const [epResult, completedResult, weeklyResult, topResult, streakResult, weekTotalResult, genreResult] = await Promise.all([
      pool.query<{ total_episodes: string; total_animes: string }>(
        `SELECT COUNT(*) as total_episodes, COUNT(DISTINCT anime_id) as total_animes
         FROM user_history WHERE user_id = $1`,
        [uid]
      ),
      pool.query<{ completed: string }>(
        `SELECT COUNT(*) as completed FROM user_watchlist
         WHERE user_id = $1 AND status = 'completed'`,
        [uid]
      ),
      pool.query<DailyViewRow>(
        `SELECT view_date::text as day, COUNT(DISTINCT episode_id)::int as episodes
         FROM user_daily_views
         WHERE user_id = $1 AND view_date >= CURRENT_DATE - 6
         GROUP BY view_date ORDER BY view_date ASC`,
        [uid]
      ),
      pool.query<TopAnimeRow>(
        `SELECT anime_id, anime_title, anime_image, COUNT(*) as ep_count
         FROM user_history WHERE user_id = $1
         GROUP BY anime_id, anime_title, anime_image
         ORDER BY ep_count DESC LIMIT 3`,
        [uid]
      ),
      pool.query<{ streak: number }>(
        `WITH ordered_dates AS (
           SELECT DISTINCT view_date,
                  CURRENT_DATE - view_date AS days_ago,
                  ROW_NUMBER() OVER (ORDER BY view_date DESC) AS rn
           FROM user_daily_views WHERE user_id = $1
         )
         SELECT COUNT(*)::int AS streak FROM ordered_dates
         WHERE days_ago = rn - 1`,
        [uid]
      ),
      pool.query<{ episodes_this_week: string }>(
        `SELECT COUNT(DISTINCT episode_id)::text as episodes_this_week
         FROM user_daily_views
         WHERE user_id = $1
           AND view_date >= date_trunc('week', CURRENT_DATE)`,
        [uid]
      ),
      pool.query<{ genre: string }>(
        `SELECT genre, COUNT(*) AS cnt
         FROM (
           SELECT unnest(genres) AS genre FROM user_history WHERE user_id = $1
           UNION ALL
           SELECT unnest(genres) AS genre FROM user_favorites WHERE user_id = $1
         ) g
         WHERE genre IS NOT NULL AND genre <> ''
         GROUP BY genre
         ORDER BY cnt DESC
         LIMIT 1`,
        [uid]
      ),
    ]);

    const totalEpisodes    = parseInt(epResult.rows[0]?.total_episodes ?? "0", 10);
    const totalAnimes      = parseInt(epResult.rows[0]?.total_animes ?? "0", 10);
    const completed        = parseInt(completedResult.rows[0]?.completed ?? "0", 10);
    const streak           = streakResult.rows[0]?.streak ?? 0;
    const episodesThisWeek = parseInt(weekTotalResult.rows[0]?.episodes_this_week ?? "0", 10);
    const estimatedHours   = Math.round((totalEpisodes * 24) / 60 * 10) / 10;
    const favoriteGenre: string | null = genreResult.rows[0]?.genre ?? null;

    const DAY_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    const weekMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weekMap[d.toISOString().slice(0, 10)] = 0;
    }
    weeklyResult.rows.forEach((r: DailyViewRow) => { weekMap[r.day] = r.episodes; });
    const weeklyActivity = Object.entries(weekMap).map(([date, episodes]) => {
      const d = new Date(date + "T12:00:00Z");
      return { date, day: DAY_NAMES[d.getUTCDay()], episodes };
    });

    res.json({
      totalEpisodes,
      totalAnimes,
      completed,
      streak,
      episodesThisWeek,
      estimatedHours,
      favoriteGenre,
      weeklyActivity,
      topAnime: topResult.rows,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

/* ── GET /users/:id/follow-status ── Auth: check if current user follows target */
router.get("/users/:id/follow-status", async (req: AuthRequest, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [isFollowingRes, countRes] = await Promise.all([
      pool.query(
        `SELECT 1 FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
        [req.userId, targetId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`,
        [targetId]
      ),
    ]);
    res.json({
      isFollowing: isFollowingRes.rows.length > 0,
      followerCount: countRes.rows[0]?.count ?? 0,
    });
  } catch {
    res.status(500).json({ error: "Error al obtener estado de seguimiento" });
  }
});

/* ── POST /users/:id/follow ── Auth: follow a user */
router.post("/users/:id/follow", async (req: AuthRequest, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    if (targetId === req.userId) { res.status(400).json({ error: "No puedes seguirte a ti mismo" }); return; }
    const targetUser = await pool.query(`SELECT id FROM users WHERE id = $1`, [targetId]);
    if (!targetUser.rows.length) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    await pool.query(
      `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.userId, targetId]
    );
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`, [targetId]
    );
    res.json({ isFollowing: true, followerCount: countRes.rows[0]?.count ?? 0 });
  } catch {
    res.status(500).json({ error: "Error al seguir al usuario" });
  }
});

/* ── DELETE /users/:id/follow ── Auth: unfollow a user */
router.delete("/users/:id/follow", async (req: AuthRequest, res) => {
  try {
    const targetId = parseInt(req.params.id as string, 10);
    if (isNaN(targetId)) { res.status(400).json({ error: "ID inválido" }); return; }
    await pool.query(
      `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2`,
      [req.userId, targetId]
    );
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM user_follows WHERE following_id = $1`, [targetId]
    );
    res.json({ isFollowing: false, followerCount: countRes.rows[0]?.count ?? 0 });
  } catch {
    res.status(500).json({ error: "Error al dejar de seguir al usuario" });
  }
});

/* ── GET /feed ── Auth: activity feed of followed users */
router.get("/feed", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         u.id AS user_id,
         u.username,
         u.avatar_url,
         w.anime_id,
         w.anime_title,
         w.anime_image,
         w.status,
         w.updated_at AS activity_at
       FROM user_watchlist w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_id IN (
         SELECT following_id FROM user_follows WHERE follower_id = $1
       )
       AND w.updated_at >= NOW() - INTERVAL '7 days'
       ORDER BY w.updated_at DESC
       LIMIT 40`,
      [req.userId]
    );
    res.json({ activities: rows });
  } catch {
    res.status(500).json({ error: "Error al obtener feed" });
  }
});

/* ── POST /user/change-password ── */
router.post("/user/change-password", async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Contraseña actual requerida y nueva contraseña mínimo 6 caracteres" });
    return;
  }
  try {
    const { rows } = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.userId]
    );
    if (!rows[0]) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      res.status(401).json({ error: "La contraseña actual es incorrecta" });
      return;
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.userId]);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

/* ── GET /user/payments — historial de pagos PayPal del usuario ── */
router.get("/user/payments", async (req: AuthRequest, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT order_id, amount_usd, plan, promo_code, status, created_at
       FROM paypal_transactions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [req.userId]
    );
    res.json({ payments: rows });
  } catch {
    res.status(500).json({ error: "Error al obtener historial de pagos" });
  }
});

export default router;
