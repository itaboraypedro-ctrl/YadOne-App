-- Migration 013: Histórico de mensagens (com node_id — gap #7 — e trace_id — gap #19)
-- ROLLBACK:
--   DROP TABLE IF EXISTS messages CASCADE;

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  media_type TEXT DEFAULT 'text',
  media_url TEXT,
  media_transcription TEXT,
  node_id UUID,
  trace_id TEXT,
  tokens_used INT,
  llm_model TEXT,
  channel_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
