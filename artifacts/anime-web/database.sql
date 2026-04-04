-- Run this SQL in your Neon database console to create the required tables

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  membership_tier VARCHAR(20) DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_expires_at TIMESTAMP
);

-- Migration: add membership + role columns to existing users table (run if table already exists)
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

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
