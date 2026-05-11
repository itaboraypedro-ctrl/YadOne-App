-- Migration 023: Decisões do Monitor (gap #2 — auditoria de cada flag)
-- ROLLBACK:
--   DROP TABLE IF EXISTS monitor_decisions CASCADE;

CREATE TABLE monitor_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  flag TEXT NOT NULL,
  confidence DECIMAL(4, 3),
  details JSONB DEFAULT '{}',
  action_taken TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
