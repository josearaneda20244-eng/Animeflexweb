import app from "./app";
import { logger } from "./lib/logger";
import pool from "./db";

async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(50) NOT NULL DEFAULT 'free';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
    `);
    logger.info("Migrations applied successfully");
  } catch (err) {
    logger.warn({ err }, "Migration warning (table may not exist yet)");
  }
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

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
