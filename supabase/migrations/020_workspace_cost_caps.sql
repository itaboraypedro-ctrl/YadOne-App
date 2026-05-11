-- Migration 020: Cap mensal de custo por workspace
-- ROLLBACK:
--   DROP TABLE IF EXISTS workspace_cost_caps CASCADE;

CREATE TABLE workspace_cost_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  monthly_cap_usd DECIMAL(10, 2) DEFAULT 100.00,
  current_month_usd DECIMAL(10, 2) DEFAULT 0.00,
  last_reset TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'ok',
  warning_threshold DECIMAL(3, 2) DEFAULT 0.80,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id)
);
