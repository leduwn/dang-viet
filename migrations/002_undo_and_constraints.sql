-- Migration 002: Add undo_stack_json to looks and index for commands
ALTER TABLE looks ADD COLUMN undo_stack_json TEXT NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_commands_look_id ON commands(look_id);
CREATE INDEX IF NOT EXISTS idx_look_revisions_look_id ON look_revisions(look_id);
