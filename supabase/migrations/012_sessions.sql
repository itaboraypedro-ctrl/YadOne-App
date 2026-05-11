-- Migration 012: Sessões de conversa (estado em tempo real)
-- Inclui: flow_version (gap #11), objective_stack (gap #5), replan_count, monitor_flags, current_trace_id (gap #19)
-- ROLLBACK:
--   DROP TABLE IF EXISTS sessions CASCADE;

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  flow_version INT,
  current_node_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  channel_session_id TEXT,
  status TEXT DEFAULT 'active',
  digression_state TEXT DEFAULT 'none',
  objective_stack JSONB DEFAULT '[]',
  collected_data JSONB DEFAULT '{}',
  completed_steps TEXT[] DEFAULT '{}',
  wait_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  replan_count INT DEFAULT 0,
  monitor_flags JSONB DEFAULT '[]',
  current_trace_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, client_id, channel)
);
