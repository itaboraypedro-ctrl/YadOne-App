-- Migration 022: Audit logs estruturados (com trace_id — gap #19)
-- ROLLBACK:
--   DROP TABLE IF EXISTS audit_logs CASCADE;

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  payload JSONB DEFAULT '{}',
  trace_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
