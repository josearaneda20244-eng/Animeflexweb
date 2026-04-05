import app from "./app";
import { logger } from "./lib/logger";
import pool from "./db";

async function safeQuery(sql: string, label: string): Promise<void> {
  try {
    await pool.query(sql);
  } catch (err: any) {
    if (err.code === "42P07" || err.code === "23505" || err.code === "42701") {
      logger.info({ label }, "Migration: already exists, skipping");
    } else {
      logger.warn({ label, code: err.code, msg: err.message }, "Migration warning");
    }
  }
}

async function runMigrations() {
  await safeQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      membership_tier VARCHAR(50) NOT NULL DEFAULT 'free',
      subscription_expires_at TIMESTAMPTZ,
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, "users");

  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(50) NOT NULL DEFAULT 'free'`, "users.membership_tier");
  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ`, "users.subscription_expires_at");
  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'`, "users.role");
  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`, "users.is_active");
  await safeQuery(`ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT`, "users.paypal_subscription_id");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS user_favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      anime_type VARCHAR(100),
      anime_rating FLOAT,
      added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, anime_id)
    )
  `, "user_favorites");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS user_watchlist (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      anime_type VARCHAR(100),
      status VARCHAR(50) DEFAULT 'plan_to_watch',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, anime_id)
    )
  `, "user_watchlist");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS user_history (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      episode_number INTEGER DEFAULT 0,
      watched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, anime_id, episode_number)
    )
  `, "user_history");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS user_watch_progress (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      episode_id VARCHAR(300) NOT NULL,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      episode_num INTEGER DEFAULT 0,
      watch_time FLOAT NOT NULL DEFAULT 0,
      duration FLOAT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, episode_id)
    )
  `, "user_watch_progress");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS user_daily_views (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      episode_id VARCHAR(300) NOT NULL,
      view_date DATE NOT NULL DEFAULT CURRENT_DATE,
      PRIMARY KEY (user_id, episode_id, view_date)
    )
  `, "user_daily_views");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS anime_comments (
      id SERIAL PRIMARY KEY,
      anime_id VARCHAR(200) NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      spoiler BOOLEAN DEFAULT FALSE,
      likes INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, "anime_comments");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      comment_id INTEGER NOT NULL REFERENCES anime_comments(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, comment_id)
    )
  `, "comment_likes");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS admin_config (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `, "admin_config");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS anime_ratings (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      anime_id VARCHAR(200) NOT NULL,
      score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, anime_id)
    )
  `, "anime_ratings");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'info',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, "announcements");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS search_logs (
      query VARCHAR(500) PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 1,
      last_searched TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, "search_logs");

  await safeQuery(`
    CREATE TABLE IF NOT EXISTS admin_content (
      id SERIAL PRIMARY KEY,
      anime_id VARCHAR(200) NOT NULL,
      anime_title VARCHAR(500),
      anime_image TEXT,
      action VARCHAR(50) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(anime_id, action)
    )
  `, "admin_content");

  const defaults = [
    ["daily_limit", "5"],
    ["daily_limit_enabled", "true"],
    ["limit_message", "Has alcanzado tu límite diario de episodios gratuitos."],
    ["megafan_message", "¡Hazte MegaFan y disfruta sin límites!"],
    ["registration_enabled", "true"],
    ["maintenance_mode", "false"],
  ];
  for (const [key, value] of defaults) {
    await safeQuery(
      `INSERT INTO admin_config (key, value) VALUES ('${key}', '${value}') ON CONFLICT (key) DO NOTHING`,
      `admin_config.${key}`
    );
  }

  logger.info("Migrations applied successfully");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Migration failed");
    process.exit(1);
  });
