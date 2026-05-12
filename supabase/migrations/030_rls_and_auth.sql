-- =================================================================
-- Migration 030 — RLS Multi-tenant + Auth/Settings prerequisites
-- =================================================================
-- RODAR MANUALMENTE NO SUPABASE SQL EDITOR
--
-- Implementa (SPEC_AUTH_ACCOUNT_SETTINGS.md §2 e §3):
--   1. Funções auxiliares: get_my_workspace_id() e is_workspace_owner()
--   2. Ajustes em workspace_users (permissions jsonb, role check, convites)
--   3. Ajustes em workspaces (owner_id, lgpd_consent_at, updated_at)
--   4. Tabela user_profiles
--   5. RLS + policies de isolamento por workspace em todas as tabelas
--      sensíveis (clients, messages, flows, métricas, custos, audit_logs…)
--
-- 100% idempotente: pode ser re-executado sem erro e sem afetar dados.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.get_my_workspace_id() CASCADE;
--   DROP FUNCTION IF EXISTS public.is_workspace_owner(uuid) CASCADE;
--   DROP TABLE IF EXISTS public.user_profiles CASCADE;
--   ALTER TABLE public.workspace_users DROP COLUMN IF EXISTS permissions,
--     DROP COLUMN IF EXISTS invited_by, DROP COLUMN IF EXISTS invited_at,
--     DROP COLUMN IF EXISTS accepted_at;
--   ALTER TABLE public.workspaces DROP COLUMN IF EXISTS owner_id,
--     DROP COLUMN IF EXISTS lgpd_consent_at, DROP COLUMN IF EXISTS updated_at;
--   -- RLS pode ser desativado por tabela: ALTER TABLE <t> DISABLE ROW LEVEL SECURITY;
-- =================================================================

-- =================================================================
-- 1. FUNÇÕES AUXILIARES
-- =================================================================
-- SECURITY DEFINER faz a função rodar com permissões do criador
-- (postgres/supabase) e bypassa o RLS da workspace_users — necessário
-- para que a policy possa consultar a própria tabela sem recursão.

CREATE OR REPLACE FUNCTION public.get_my_workspace_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM public.workspace_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_users
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND role = 'owner'
  );
$$;

-- =================================================================
-- 2. workspace_users — campos pra auth e gestão de equipe
-- =================================================================

ALTER TABLE public.workspace_users
  ADD COLUMN IF NOT EXISTS permissions  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS invited_by   uuid,
  ADD COLUMN IF NOT EXISTS invited_at   timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at  timestamptz;

-- Garante que o campo "role" aceita 'owner', 'member' e 'agent' (compat).
-- A migration 028 criou um CHECK só com ('owner','agent'); aqui ampliamos.
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.workspace_users'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%role%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.workspace_users DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END$$;

ALTER TABLE public.workspace_users
  ADD CONSTRAINT workspace_users_role_check
    CHECK (role IN ('owner', 'member', 'agent'));

-- =================================================================
-- 3. workspaces — owner_id, lgpd_consent_at, updated_at
-- =================================================================

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS owner_id         uuid,
  ADD COLUMN IF NOT EXISTS lgpd_consent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.workspaces.lgpd_consent_at IS
  'Timestamp do aceite dos termos LGPD pelo owner no onboarding.';

-- =================================================================
-- 4. user_profiles
-- =================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS
  'Dados pessoais do usuário (uma linha por auth.users). Atualizado em /settings/profile.';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_self_select" ON public.user_profiles;
CREATE POLICY "user_profiles_self_select" ON public.user_profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_self_insert" ON public.user_profiles;
CREATE POLICY "user_profiles_self_insert" ON public.user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "user_profiles_self_update" ON public.user_profiles;
CREATE POLICY "user_profiles_self_update" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- =================================================================
-- 5. RLS — ISOLAMENTO POR WORKSPACE
-- =================================================================

-- ---------- 5.1 Dados de pacientes (LGPD — máxima prioridade) ----------
ALTER TABLE public.clients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_memory          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_episodic_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_events             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_isolation" ON public.clients;
CREATE POLICY "workspace_isolation" ON public.clients
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.messages;
CREATE POLICY "workspace_isolation" ON public.messages
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.client_memory;
CREATE POLICY "workspace_isolation" ON public.client_memory
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.client_episodic_memory;
CREATE POLICY "workspace_isolation" ON public.client_episodic_memory
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.appointments;
CREATE POLICY "workspace_isolation" ON public.appointments
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.crm_events;
CREATE POLICY "workspace_isolation" ON public.crm_events
  USING (workspace_id = public.get_my_workspace_id());

-- ---------- 5.2 Fluxos e configuração ----------
ALTER TABLE public.flows                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_nodes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_edges             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flow_tool_policies     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_configs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_agent_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_isolation" ON public.flows;
CREATE POLICY "workspace_isolation" ON public.flows
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.flow_nodes;
CREATE POLICY "workspace_isolation" ON public.flow_nodes
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.flow_edges;
CREATE POLICY "workspace_isolation" ON public.flow_edges
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.flow_snapshots;
CREATE POLICY "workspace_isolation" ON public.flow_snapshots
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.flow_tool_policies;
CREATE POLICY "workspace_isolation" ON public.flow_tool_policies
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.channel_configs;
CREATE POLICY "workspace_isolation" ON public.channel_configs
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.workspace_agent_config;
CREATE POLICY "workspace_isolation" ON public.workspace_agent_config
  USING (workspace_id = public.get_my_workspace_id());

-- ---------- 5.3 Base de conhecimento ----------
ALTER TABLE public.knowledge_base   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_isolation" ON public.knowledge_base;
CREATE POLICY "workspace_isolation" ON public.knowledge_base
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.knowledge_chunks;
CREATE POLICY "workspace_isolation" ON public.knowledge_chunks
  USING (workspace_id = public.get_my_workspace_id());

-- ---------- 5.4 Métricas ----------
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_isolation" ON public.daily_metrics;
CREATE POLICY "workspace_isolation" ON public.daily_metrics
  USING (workspace_id = public.get_my_workspace_id());

DROP POLICY IF EXISTS "workspace_isolation" ON public.usage_metrics;
CREATE POLICY "workspace_isolation" ON public.usage_metrics
  USING (workspace_id = public.get_my_workspace_id());

-- ---------- 5.5 Financeiro / custos (owner only) ----------
ALTER TABLE public.workspace_cost_caps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_only" ON public.workspace_cost_caps;
CREATE POLICY "owner_only" ON public.workspace_cost_caps
  USING (public.is_workspace_owner(workspace_id));

-- ---------- 5.6 Audit logs (owner read, INSERT via service_role) ----------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read" ON public.audit_logs;
CREATE POLICY "owner_read" ON public.audit_logs
  FOR SELECT USING (
    workspace_id = public.get_my_workspace_id()
    AND public.is_workspace_owner(public.get_my_workspace_id())
  );

-- (INSERT em audit_logs é feito sempre via service_role no backend, que
-- bypassa RLS por padrão — nenhuma policy de INSERT é necessária aqui.)

-- =================================================================
-- FIM — Migration 030
-- =================================================================
