-- Migration 027: flag memory_processed em sessions (T20 — Memory Updater Job)
-- Permite que o job de memória identifique sessões já processadas e evite reprocessamento.
-- Índice parcial cobre o caminho quente: WHERE memory_processed = false.
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_sessions_memory_processed;
--   ALTER TABLE sessions DROP COLUMN IF EXISTS memory_processed;

ALTER TABLE sessions ADD COLUMN memory_processed BOOLEAN DEFAULT false;
CREATE INDEX idx_sessions_memory_processed ON sessions(memory_processed) WHERE memory_processed = false;
