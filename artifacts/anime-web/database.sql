-- Run this SQL in your Neon (or PostgreSQL) database console to create all required tables

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  membership_tier VARCHAR(20) DEFAULT 'free',
  paypal_subscription_id TEXT,
  subscription_expires_at TIMESTAMP,
  role VARCHAR(20) DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE
);

-- Migration: add missing columns to existing users table (safe to run multiple times)
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL,
  anime_title TEXT,
  anime_image TEXT,
  anime_type TEXT,
  anime_rating TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

CREATE TABLE IF NOT EXISTS user_watchlist (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL,
  anime_title TEXT,
  anime_image TEXT,
  anime_type TEXT,
  status TEXT DEFAULT 'plan_to_watch',
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

CREATE TABLE IF NOT EXISTS user_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  anime_id TEXT NOT NULL,
  anime_title TEXT,
  anime_image TEXT,
  episode_number INTEGER DEFAULT 0,
  watched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id, episode_number)
);

CREATE TABLE IF NOT EXISTS user_watch_progress (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL,
  anime_id TEXT,
  anime_title TEXT,
  anime_image TEXT,
  episode_num INTEGER,
  watch_time REAL DEFAULT 0,
  duration REAL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, episode_id)
);

-- Server-side daily episode limit tracking (prevents localStorage bypass)
CREATE TABLE IF NOT EXISTS user_daily_views (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, episode_id, view_date)
);

-- Shared comments system (visible to all users)
CREATE TABLE IF NOT EXISTS anime_comments (
  id SERIAL PRIMARY KEY,
  anime_id TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  spoiler BOOLEAN DEFAULT FALSE,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anime_comments_anime_id ON anime_comments(anime_id);

-- Comment likes (one like per user per comment)
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER REFERENCES anime_comments(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

-- Admin tables
CREATE TABLE IF NOT EXISTS admin_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_content (
  id SERIAL PRIMARY KEY,
  anime_id VARCHAR(200) NOT NULL,
  anime_title VARCHAR(500),
  anime_image TEXT,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(anime_id, action)
);

-- Default admin config values
INSERT INTO admin_config (key, value) VALUES
  ('daily_limit', '5'),
  ('daily_limit_enabled', 'true'),
  ('limit_message', 'Has alcanzado tu límite diario de episodios gratuitos.'),
  ('megafan_message', '¡Hazte MegaFan y disfruta sin límites!'),
  ('registration_enabled', 'true'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- Ratings (1-5 stars from users)
CREATE TABLE IF NOT EXISTS anime_ratings (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  anime_id VARCHAR(200) NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

-- Platform announcements
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'info',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search query log
CREATE TABLE IF NOT EXISTS search_logs (
  query VARCHAR(300) NOT NULL PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  last_searched TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========== MEMBERSHIP & PAYPAL TABLES ==========

-- Promo codes for membership discounts
CREATE TABLE IF NOT EXISTS promo_codes (
  code VARCHAR(50) PRIMARY KEY,
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pending PayPal orders (before capture)
CREATE TABLE IF NOT EXISTS paypal_pending_orders (
  order_id VARCHAR(100) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('monthly', 'annual')),
  promo_code VARCHAR(50),
  expected_usd NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id)
);

-- Completed PayPal transactions (audit log)
CREATE TABLE IF NOT EXISTS paypal_transactions (
  order_id VARCHAR(100) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usd NUMERIC(10, 2) NOT NULL,
  plan VARCHAR(20) NOT NULL CHECK (plan IN ('monthly', 'annual')),
  promo_code VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'refunded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(order_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_paypal_pending_orders_user_id ON paypal_pending_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_paypal_pending_orders_created_at ON paypal_pending_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_paypal_transactions_user_id ON paypal_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_paypal_transactions_created_at ON paypal_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(active, expires_at);
