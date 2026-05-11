-- Migration 016: Registry central de tools (com rate_limit_per_minute, timeout_ms, audit_log)
-- ROLLBACK:
--   DROP TABLE IF EXISTS tools_registry CASCADE;

CREATE TABLE tools_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  params_schema JSONB NOT NULL,
  returns_schema JSONB NOT NULL,
  requires_confirmation BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INT DEFAULT 60,
  timeout_ms INT DEFAULT 30000,
  audit_log BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
