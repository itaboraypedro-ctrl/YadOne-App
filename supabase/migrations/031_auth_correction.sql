-- =================================================================
-- Migration 031 — Auth Correction (alinha ao SPEC_AUTH.md v1.1)
-- =================================================================
-- RODAR MANUALMENTE NO SUPABASE SQL EDITOR
--
-- Esta migration corrige o desalinhamento da migration 030 frente ao
-- SPEC_AUTH.md v1.1. Mudanças (SPEC_AUTH_CORRECTION.md §2.1):
--   • Roles: 'member'|'agent' → 'professional' (banco + CHECK)
--   • Campo workspace_users.is_active (suporte a multi-workspace)
--   • Tabelas novas: super_admins, professional_permissions,
--     workspace_invites, workspace_subscriptions, plan_definitions,
--     message_usage_cycles, billing_events, admin_impersonations,
--     lgpd_deletion_requests
--   • Migração de permissions jsonb → professional_permissions
--   • Remove permissions/invited_by/invited_at/accepted_at de
--     workspace_users (convites passam a viver em workspace_invites)
--   • Função user_has_workspace_access(target uuid) — multi-workspace aware
--   • get_my_workspace_id() respeita is_active=true
--   • RLS + policies nas novas tabelas
--   • Seed plan_definitions (starter, pro)
--
-- 100% idempotente — pode rodar várias vezes sem erro.
--
-- ROLLBACK (no rodapé do arquivo, comentado).
-- =================================================================

-- =================================================================
-- PARTE 1 — Corrigir roles em workspace_users
-- =================================================================

-- 1.1 — Adicionar is_active
ALTER TABLE public.workspace_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 1.2 — Migrar dados: 'member' e 'agent' → 'professional'
UPDATE public.workspace_users
  SET role = 'professional'
  WHERE role IN ('member', 'agent');

-- 1.3 — Recriar CHECK constraint (aceita só 'owner' e 'professional')
ALTER TABLE public.workspace_users
  DROP CONSTRAINT IF EXISTS workspace_users_role_check;

ALTER TABLE public.workspace_users
  ADD CONSTRAINT workspace_users_role_check
    CHECK (role IN ('owner', 'professional'));

-- =================================================================
-- PARTE 2 — Criar tabelas faltantes
-- Ordem respeita dependências de FK.
-- =================================================================

-- 2.1 — plan_definitions (sem FK)
CREATE TABLE IF NOT EXISTS public.plan_definitions (
  plan                       TEXT PRIMARY KEY,
  price_brl_yearly           NUMERIC(10,2) NOT NULL,
  messages_per_month         INTEGER NOT NULL,
  max_active_flows           INTEGER NOT NULL,
  max_professionals          INTEGER NOT NULL,
  max_whatsapp_channels      INTEGER NOT NULL,
  conversation_history_days  INTEGER NOT NULL
);

-- 2.2 — super_admins (FK auth.users)
CREATE TABLE IF NOT EXISTS public.super_admins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  totp_secret_encrypted TEXT,
  totp_enabled          BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 — professional_permissions (FK workspace_users)
CREATE TABLE IF NOT EXISTS public.professional_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_user_id UUID NOT NULL UNIQUE
                    REFERENCES public.workspace_users(id) ON DELETE CASCADE,
  agenda            TEXT NOT NULL DEFAULT 'none'
                    CHECK (agenda IN ('none','view','edit')),
  crm               TEXT NOT NULL DEFAULT 'none'
                    CHECK (crm IN ('none','view','edit')),
  conversas         TEXT NOT NULL DEFAULT 'none'
                    CHECK (conversas IN ('none','view','edit')),
  relatorios        TEXT NOT NULL DEFAULT 'none'
                    CHECK (relatorios IN ('none','view','edit')),
  produtos          TEXT NOT NULL DEFAULT 'none'
                    CHECK (produtos IN ('none','view','edit')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 — workspace_invites (FK workspaces, workspace_users)
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  token          TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role           TEXT NOT NULL DEFAULT 'professional'
                 CHECK (role IN ('owner', 'professional')),
  permissions    JSONB NOT NULL DEFAULT '{}',
  invited_by     UUID REFERENCES public.workspace_users(id),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 — workspace_subscriptions (FK workspaces, plan_definitions)
CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                UUID NOT NULL UNIQUE
                              REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan                        TEXT NOT NULL REFERENCES public.plan_definitions(plan),
  status                      TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','grace_period','blocked','cancelled')),
  stripe_customer_id          TEXT,
  stripe_subscription_id      TEXT,
  stripe_price_id             TEXT,
  current_period_start        TIMESTAMPTZ,
  current_period_end          TIMESTAMPTZ,
  cancel_at_period_end        BOOLEAN NOT NULL DEFAULT false,
  cancelled_at                TIMESTAMPTZ,
  grace_period_ends_at        TIMESTAMPTZ,
  last_stripe_event_timestamp BIGINT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 — message_usage_cycles (FK workspaces)
CREATE TABLE IF NOT EXISTS public.message_usage_cycles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  cycle_start      TIMESTAMPTZ NOT NULL,
  cycle_end        TIMESTAMPTZ NOT NULL,
  message_count    INTEGER NOT NULL DEFAULT 0,
  is_current       BOOLEAN NOT NULL DEFAULT true,
  warning_80_sent  BOOLEAN NOT NULL DEFAULT false,
  warning_100_sent BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 — billing_events (FK workspaces, idempotência por stripe_event_id)
CREATE TABLE IF NOT EXISTS public.billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 — admin_impersonations (FK auth.users, workspaces)
CREATE TABLE IF NOT EXISTS public.admin_impersonations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  reason        TEXT
);

-- 2.9 — lgpd_deletion_requests (FK workspaces, auth.users)
CREATE TABLE IF NOT EXISTS public.lgpd_deletion_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requested_by  UUID NOT NULL REFERENCES auth.users(id),
  confirm_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  confirmed_at  TIMESTAMPTZ,
  executed_at   TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','executed','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================
-- PARTE 3 — Migrar permissions jsonb → professional_permissions
--           e dropar colunas obsoletas de workspace_users
-- =================================================================

-- 3.1 — Migra dados de workspace_users.permissions (se a coluna ainda existir).
-- Mapeamento de melhor esforço: chat → conversas; crm → crm; demais campos
-- da nova tabela ficam no default 'none'. Valores inválidos viram 'none'.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'workspace_users'
      AND column_name  = 'permissions'
  ) THEN
    INSERT INTO public.professional_permissions (
      workspace_user_id, crm, conversas
    )
    SELECT
      wu.id,
      CASE WHEN wu.permissions->>'crm'  IN ('view','edit') THEN wu.permissions->>'crm'  ELSE 'none' END,
      CASE WHEN wu.permissions->>'chat' IN ('view','edit') THEN wu.permissions->>'chat' ELSE 'none' END
    FROM public.workspace_users wu
    WHERE wu.role = 'professional'
      AND wu.permissions IS NOT NULL
      AND wu.permissions <> '{}'::jsonb
    ON CONFLICT (workspace_user_id) DO NOTHING;
  END IF;
END$$;

-- 3.2 — Remover colunas obsoletas de workspace_users.
-- Convites agora vivem em workspace_invites; permissões em professional_permissions.
ALTER TABLE public.workspace_users DROP COLUMN IF EXISTS permissions;
ALTER TABLE public.workspace_users DROP COLUMN IF EXISTS invited_by;
ALTER TABLE public.workspace_users DROP COLUMN IF EXISTS invited_at;
ALTER TABLE public.workspace_users DROP COLUMN IF EXISTS accepted_at;

-- =================================================================
-- PARTE 4 — RLS, funções auxiliares e seed
-- =================================================================

-- 4.1 — user_has_workspace_access (multi-workspace aware)
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(target_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_users
    WHERE user_id = auth.uid()
      AND workspace_id = target_workspace_id
      AND is_active = true
  );
$$;

-- 4.2 — get_my_workspace_id atualizada para respeitar is_active
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
    AND is_active = true
  LIMIT 1;
$$;

-- 4.3 — RLS: super_admins
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sa_self" ON public.super_admins;
CREATE POLICY "sa_self" ON public.super_admins
  FOR SELECT USING (user_id = auth.uid());

-- 4.4 — RLS: professional_permissions
ALTER TABLE public.professional_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_select" ON public.professional_permissions;
CREATE POLICY "pp_select" ON public.professional_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_users wu
      WHERE wu.id = professional_permissions.workspace_user_id
        AND public.user_has_workspace_access(wu.workspace_id)
    )
  );

DROP POLICY IF EXISTS "pp_modify" ON public.professional_permissions;
CREATE POLICY "pp_modify" ON public.professional_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_users wu_target
      JOIN public.workspace_users wu_actor
        ON wu_actor.workspace_id = wu_target.workspace_id
      WHERE wu_target.id = professional_permissions.workspace_user_id
        AND wu_actor.user_id = auth.uid()
        AND wu_actor.role = 'owner'
    )
  );

-- 4.5 — RLS: workspace_invites
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wi_select" ON public.workspace_invites;
CREATE POLICY "wi_select" ON public.workspace_invites
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "wi_modify" ON public.workspace_invites;
CREATE POLICY "wi_modify" ON public.workspace_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_users
      WHERE user_id = auth.uid()
        AND workspace_id = workspace_invites.workspace_id
        AND role = 'owner'
    )
  );

-- 4.6 — RLS: workspace_subscriptions (read-only para usuários do ws)
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ws_select" ON public.workspace_subscriptions;
CREATE POLICY "ws_select" ON public.workspace_subscriptions
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

-- 4.7 — RLS: message_usage_cycles
ALTER TABLE public.message_usage_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "muc_select" ON public.message_usage_cycles;
CREATE POLICY "muc_select" ON public.message_usage_cycles
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

-- 4.8 — RLS: billing_events (apenas service_role escreve/lê; nenhuma policy pública)
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- 4.9 — RLS: admin_impersonations (apenas super admins)
ALTER TABLE public.admin_impersonations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_select" ON public.admin_impersonations;
CREATE POLICY "ai_select" ON public.admin_impersonations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid())
  );

-- 4.10 — RLS: lgpd_deletion_requests
ALTER TABLE public.lgpd_deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lgpd_select" ON public.lgpd_deletion_requests;
CREATE POLICY "lgpd_select" ON public.lgpd_deletion_requests
  FOR SELECT USING (public.user_has_workspace_access(workspace_id));

DROP POLICY IF EXISTS "lgpd_insert" ON public.lgpd_deletion_requests;
CREATE POLICY "lgpd_insert" ON public.lgpd_deletion_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.workspace_users
      WHERE user_id = auth.uid()
        AND workspace_id = lgpd_deletion_requests.workspace_id
        AND role = 'owner'
    )
  );

-- 4.11 — Seed de planos (idempotente via ON CONFLICT)
INSERT INTO public.plan_definitions (
  plan, price_brl_yearly, messages_per_month,
  max_active_flows, max_professionals,
  max_whatsapp_channels, conversation_history_days
) VALUES
  ('starter', 497.00, 5000,  5,  3, 1,  90),
  ('pro',     799.00, 10000, 20, 10, 3, 365)
ON CONFLICT (plan) DO NOTHING;

-- =================================================================
-- FIM — Migration 031
-- =================================================================

-- ROLLBACK (manual, comentado):
-- DROP TABLE IF EXISTS public.lgpd_deletion_requests CASCADE;
-- DROP TABLE IF EXISTS public.admin_impersonations CASCADE;
-- DROP TABLE IF EXISTS public.billing_events CASCADE;
-- DROP TABLE IF EXISTS public.message_usage_cycles CASCADE;
-- DROP TABLE IF EXISTS public.workspace_subscriptions CASCADE;
-- DROP TABLE IF EXISTS public.workspace_invites CASCADE;
-- DROP TABLE IF EXISTS public.professional_permissions CASCADE;
-- DROP TABLE IF EXISTS public.super_admins CASCADE;
-- DROP TABLE IF EXISTS public.plan_definitions CASCADE;
-- DROP FUNCTION IF EXISTS public.user_has_workspace_access(uuid);
-- ALTER TABLE public.workspace_users DROP CONSTRAINT IF EXISTS workspace_users_role_check;
-- ALTER TABLE public.workspace_users ADD CONSTRAINT workspace_users_role_check
--   CHECK (role IN ('owner','member','agent'));
-- ALTER TABLE public.workspace_users DROP COLUMN IF EXISTS is_active;
-- ALTER TABLE public.workspace_users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
-- ALTER TABLE public.workspace_users ADD COLUMN IF NOT EXISTS invited_by UUID;
-- ALTER TABLE public.workspace_users ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
-- ALTER TABLE public.workspace_users ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
