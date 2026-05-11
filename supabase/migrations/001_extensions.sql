-- Migration 001: Extensões PostgreSQL (pgvector + uuid-ossp)
-- ROLLBACK:
--   DROP EXTENSION IF EXISTS vector;
--   DROP EXTENSION IF EXISTS "uuid-ossp";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
