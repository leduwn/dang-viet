-- Migration 004: AI Image Generation Job Queue and Metadata Storage
CREATE TABLE IF NOT EXISTS ai_image_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  look_id TEXT,
  prompt TEXT NOT NULL,
  style_preset TEXT NOT NULL DEFAULT 'elegant_fashion_2d',
  status TEXT NOT NULL, -- 'pending' | 'processing' | 'completed' | 'failed'
  storage_path TEXT,
  mime_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  model_used TEXT,
  duration_ms INTEGER,
  parsed_details TEXT, -- JSON serialized AIImageParsedDetails
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_image_jobs_session ON ai_image_jobs(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_image_jobs_status ON ai_image_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_image_jobs_created_at ON ai_image_jobs(created_at);

-- Support rich design metadata and 2D AI image linkage in Lookbook
ALTER TABLE lookbook ADD COLUMN design_metadata_json TEXT;

