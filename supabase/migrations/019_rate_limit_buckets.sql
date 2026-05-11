-- Migration 019: Buckets de rate limiting (sliding window)
-- UNIQUE(scope_key, window_start) permite INSERT ... ON CONFLICT (...) DO UPDATE
-- evitando duplicação sob concorrência.
-- ROLLBACK:
--   DROP TABLE IF EXISTS rate_limit_buckets CASCADE;

CREATE TABLE rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  count INT DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scope_key, window_start)
);
