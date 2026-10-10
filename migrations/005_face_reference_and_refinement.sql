-- Migration 005: Face-referenced 2D Generation and Conversational Refinement
CREATE TABLE IF NOT EXISTS face_references (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_face_references_session ON face_references(session_id);
CREATE INDEX IF NOT EXISTS idx_face_references_expires_at ON face_references(expires_at);

-- Support parent-child lineage and face reference in ai_image_jobs
ALTER TABLE ai_image_jobs ADD COLUMN parent_image_id TEXT;
ALTER TABLE ai_image_jobs ADD COLUMN reference_id TEXT;
ALTER TABLE ai_image_jobs ADD COLUMN iteration INTEGER DEFAULT 1;
ALTER TABLE ai_image_jobs ADD COLUMN refinement_prompt TEXT;
ALTER TABLE ai_image_jobs ADD COLUMN background_setting TEXT;
ALTER TABLE ai_image_jobs ADD COLUMN pose_style TEXT;
