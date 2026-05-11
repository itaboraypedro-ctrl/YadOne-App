-- Migration 021: Métricas — usage_metrics (granular por chamada LLM) + daily_metrics (agregada por Job 7)
-- ROLLBACK:
--   DROP TABLE IF EXISTS daily_metrics CASCADE;
--   DROP TABLE IF EXISTS usage_metrics CASCADE;

CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_messages INT DEFAULT 0,
  total_sessions INT DEFAULT 0,
  avg_session_length DECIMAL(10, 2) DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) DEFAULT 0,
  handoff_rate DECIMAL(5, 4) DEFAULT 0,
  replan_rate DECIMAL(5, 4) DEFAULT 0,
  tool_usage_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, date)
);
