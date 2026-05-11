-- Migration 017: Configuração de canais por workspace (credentials criptografadas em prod)
-- ROLLBACK:
--   DROP TABLE IF EXISTS channel_configs CASCADE;

CREATE TABLE channel_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL,
  credentials JSONB NOT NULL,
  phone_number TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
