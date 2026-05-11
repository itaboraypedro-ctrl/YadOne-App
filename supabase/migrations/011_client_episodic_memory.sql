-- Migration 011: Memória episódica do cliente (vector + topic_tags — gap #4)
-- session_id sem FK proposital: episódios sobrevivem à exclusão de sessões para preservar histórico analítico.
-- ROLLBACK:
--   DROP TABLE IF EXISTS client_episodic_memory CASCADE;

CREATE TABLE client_episodic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID,
  conversation_excerpt TEXT,
  excerpt_summary TEXT,
  topic_tags TEXT[] DEFAULT '{}',
  embedding vector(1536),
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
