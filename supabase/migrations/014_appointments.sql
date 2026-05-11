-- Migration 014: Agendamentos
-- ROLLBACK:
--   DROP TABLE IF EXISTS appointments CASCADE;

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  professional_name TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  status TEXT DEFAULT 'confirmed',
  notes TEXT,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
