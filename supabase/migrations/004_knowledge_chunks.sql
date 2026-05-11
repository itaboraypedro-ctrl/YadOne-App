-- Migration 004: Chunks vetorizados da knowledge base (RAG)
-- ROLLBACK:
--   DROP TABLE IF EXISTS knowledge_chunks CASCADE;

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kb_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  token_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
