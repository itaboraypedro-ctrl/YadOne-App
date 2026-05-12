-- =================================================================
-- Migration 033 — Business profile (Google Places onboarding)
-- =================================================================
-- RODAR MANUALMENTE NO SUPABASE SQL EDITOR
--
-- Adiciona campos em workspaces com dados puxados da Google Places API
-- na etapa "Conte sobre o seu negócio" do onboarding, cria a tabela
-- workspace_units (para redes/multi-unidades) e adiciona a coluna
-- onboarding_status (controla a etapa atual do onboarding).
--
-- 100% idempotente — IF NOT EXISTS em tudo.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.workspace_units CASCADE;
--   ALTER TABLE public.workspaces
--     DROP COLUMN IF EXISTS business_name,
--     DROP COLUMN IF EXISTS google_place_id,
--     DROP COLUMN IF EXISTS google_places_data,
--     DROP COLUMN IF EXISTS address,
--     DROP COLUMN IF EXISTS zip_code,
--     DROP COLUMN IF EXISTS phone,
--     DROP COLUMN IF EXISTS website,
--     DROP COLUMN IF EXISTS business_hours,
--     DROP COLUMN IF EXISTS categories,
--     DROP COLUMN IF EXISTS services,
--     DROP COLUMN IF EXISTS rating,
--     DROP COLUMN IF EXISTS review_count,
--     DROP COLUMN IF EXISTS logo_url,
--     DROP COLUMN IF EXISTS unit_count,
--     DROP COLUMN IF EXISTS is_chain,
--     DROP COLUMN IF EXISTS onboarding_status;
-- =================================================================

-- Campos novos em workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS business_name       TEXT,
  ADD COLUMN IF NOT EXISTS google_place_id     TEXT,
  ADD COLUMN IF NOT EXISTS google_places_data  JSONB,
  ADD COLUMN IF NOT EXISTS address             TEXT,
  ADD COLUMN IF NOT EXISTS zip_code            TEXT,
  ADD COLUMN IF NOT EXISTS phone               TEXT,
  ADD COLUMN IF NOT EXISTS website             TEXT,
  ADD COLUMN IF NOT EXISTS business_hours      JSONB,
  ADD COLUMN IF NOT EXISTS categories          TEXT[],
  ADD COLUMN IF NOT EXISTS services            TEXT[],
  ADD COLUMN IF NOT EXISTS rating              NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS review_count        INTEGER,
  ADD COLUMN IF NOT EXISTS logo_url            TEXT,
  ADD COLUMN IF NOT EXISTS unit_count          INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_chain            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_status   TEXT DEFAULT 'business_pending';

COMMENT ON COLUMN public.workspaces.onboarding_status IS
  'Etapa atual do onboarding: business_pending | business_complete | agent_pending | complete';

-- Tabela de unidades (redes)
CREATE TABLE IF NOT EXISTS public.workspace_units (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  google_place_id  TEXT,
  name             TEXT NOT NULL,
  address          TEXT,
  city             TEXT,
  state            TEXT,
  phone            TEXT,
  business_hours   JSONB,
  is_primary       BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS em workspace_units
ALTER TABLE public.workspace_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workspace_isolation" ON public.workspace_units;
CREATE POLICY "workspace_isolation" ON public.workspace_units
  USING (workspace_id = public.get_my_workspace_id());

-- =================================================================
-- FIM — Migration 033
-- =================================================================
