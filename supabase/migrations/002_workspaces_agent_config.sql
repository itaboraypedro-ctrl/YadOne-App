-- Migration 002: Workspaces e configuração do agente
-- ROLLBACK:
--   DROP TABLE IF EXISTS workspace_agent_config CASCADE;
--   DROP TABLE IF EXISTS workspaces CASCADE;

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  segment TEXT,
  plan TEXT DEFAULT 'trial',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  persona_name TEXT NOT NULL,
  persona_tone TEXT NOT NULL,
  persona_rules TEXT,
  response_length TEXT DEFAULT 'short',
  emoji_usage BOOLEAN DEFAULT true,
  tratamento TEXT DEFAULT 'você',
  business_info TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workspace_id)
);
