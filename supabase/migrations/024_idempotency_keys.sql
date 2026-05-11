-- Migration 024: Chaves de idempotência para webhooks (gap #16, CRÍTICO)
-- TTL de 24h. Limpeza pelo Job 8.
-- ROLLBACK:
--   DROP TABLE IF EXISTS idempotency_keys CASCADE;

CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  result JSONB,
  expires_at TIMESTAMPTZ NOT NULL
);
