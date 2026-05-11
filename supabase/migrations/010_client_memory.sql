-- Migration 010: Memória semântica do cliente (resumo persistente)
-- ROLLBACK:
--   DROP TABLE IF EXISTS client_memory CASCADE;

CREATE TABLE client_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_summary TEXT,
  preferred_name TEXT,
  preferences JSONB DEFAULT '[]',
  last_service TEXT,
  observations TEXT,
  raw_insights JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (client_id, workspace_id)
);
