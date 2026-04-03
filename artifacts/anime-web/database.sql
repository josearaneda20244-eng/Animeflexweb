-- Run this SQL in your Neon database console to create the required tables

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

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
