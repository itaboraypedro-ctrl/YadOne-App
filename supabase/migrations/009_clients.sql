-- Migration 009: Clientes finais (com unified_id e secondary_phones — gap #3)
-- ROLLBACK:
--   DROP TABLE IF EXISTS clients CASCADE;

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  notes TEXT,
  crm_status TEXT DEFAULT 'new',
  crm_tags TEXT[],
  unified_id UUID,
  secondary_phones TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id, phone)
);
