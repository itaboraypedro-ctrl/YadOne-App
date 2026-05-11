-- Migration 006: Fluxos de conversa + snapshots de versão (gap #1)
-- ROLLBACK:
--   DROP TABLE IF EXISTS flow_snapshots CASCADE;
--   DROP TABLE IF EXISTS flows CASCADE;

CREATE TABLE flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_keywords TEXT[],
  trigger_products UUID[],
  status TEXT DEFAULT 'draft',
  is_default BOOLEAN DEFAULT false,
  version INT DEFAULT 1,
  parent_version_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE flow_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (flow_id, version)
);
