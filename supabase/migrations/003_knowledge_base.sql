-- Migration 003: Base de conhecimento (texto)
-- ROLLBACK:
--   DROP TABLE IF EXISTS knowledge_base CASCADE;

CREATE TABLE knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text',
  is_global BOOLEAN DEFAULT false,
  is_indexed BOOLEAN DEFAULT false,
  token_estimate INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
