-- Migration 001: Initial schema for Dáng Việt
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS looks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  title TEXT NOT NULL,
  event_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  config_json TEXT NOT NULL,
  locks_json TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  is_design INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS look_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  look_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  locks_json TEXT NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(look_id, revision)
);

CREATE TABLE IF NOT EXISTS lookbook (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  look_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  snapshot_config_json TEXT NOT NULL,
  event_id TEXT NOT NULL,
  style_id TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commands (
  id TEXT PRIMARY KEY,
  look_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  action TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS culture_cards (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_author TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  source_evidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TEXT NOT NULL
);
