-- Migration 015: Eventos para o CRM (com trace_id — gap #19)
-- ROLLBACK:
--   DROP TABLE IF EXISTS crm_events CASCADE;

CREATE TABLE crm_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  trace_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
