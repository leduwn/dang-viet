-- Migration 003: Multi-user session isolation and Lookbook ownership protection
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  current_look_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT
);

-- Reserved quarantine session for legacy data
INSERT OR IGNORE INTO sessions (id, current_look_id, created_at, updated_at, expires_at)
VALUES (
  'legacy_migration_archive',
  NULL,
  '1970-01-01T00:00:00.000Z',
  '1970-01-01T00:00:00.000Z',
  NULL
);

-- Add session_id to looks if not exists (SQLite ADD COLUMN)
ALTER TABLE looks ADD COLUMN session_id TEXT;

-- Quarantine unowned looks into legacy archive
UPDATE looks
SET session_id = 'legacy_migration_archive'
WHERE session_id IS NULL;

-- Add session_id to lookbook
ALTER TABLE lookbook ADD COLUMN session_id TEXT;

-- Quarantine unowned lookbook items into legacy archive
UPDATE lookbook
SET session_id = 'legacy_migration_archive'
WHERE session_id IS NULL;

-- Indexes for session queries
CREATE INDEX IF NOT EXISTS idx_looks_session_id ON looks(session_id);
CREATE INDEX IF NOT EXISTS idx_lookbook_session_id ON lookbook(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);
