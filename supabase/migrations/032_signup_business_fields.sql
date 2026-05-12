-- =================================================================
-- Migration 032 — Signup business fields
-- =================================================================
-- RODAR MANUALMENTE NO SUPABASE SQL EDITOR
--
-- Adiciona em workspaces os campos coletados no cadastro:
--   units_count, city, state, biggest_challenge, contact_phone,
--   pending_team_setup (flag de "aguardando setup do time Yadone")
--
-- Idempotente — ADD COLUMN IF NOT EXISTS em todos.
--
-- ROLLBACK:
--   ALTER TABLE workspaces
--     DROP COLUMN IF EXISTS units_count,
--     DROP COLUMN IF EXISTS city,
--     DROP COLUMN IF EXISTS state,
--     DROP COLUMN IF EXISTS biggest_challenge,
--     DROP COLUMN IF EXISTS contact_phone,
--     DROP COLUMN IF EXISTS pending_team_setup;
-- =================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS units_count         INTEGER,
  ADD COLUMN IF NOT EXISTS city                TEXT,
  ADD COLUMN IF NOT EXISTS state               TEXT,
  ADD COLUMN IF NOT EXISTS biggest_challenge   TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone       TEXT,
  ADD COLUMN IF NOT EXISTS pending_team_setup  BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.workspaces.units_count IS
  'Número de unidades/filiais informadas no cadastro.';
COMMENT ON COLUMN public.workspaces.biggest_challenge IS
  'Maior desafio relatado pelo owner no cadastro (texto livre ou opção).';
COMMENT ON COLUMN public.workspaces.pending_team_setup IS
  'true enquanto o time Yadone ainda não configurou a plataforma. Banner de boas-vindas usa esse flag.';
