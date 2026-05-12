# SPEC_AUTH_CORRECTION.md
## Yadone — Correção da Implementação para Alinhar ao SPEC_AUTH.md v1.1
**Objetivo:** Alinhar o que foi implementado (SPEC_AUTH_ACCOUNT_SETTINGS.md) com o spec original (SPEC_AUTH.md v1.1)
**Prioridade:** Alta — questão de consistência de dados e segurança

---

## 1. DIAGNÓSTICO — O QUE ESTÁ ERRADO

### 1.1 Roles errados no banco e no código

**Hoje:**
```
'owner' | 'member' | 'agent'
```

**Correto (SPEC_AUTH.md §2):**
```
'owner' | 'professional'
```

- `'agent'` era nome temporário da migration 028
- `'member'` foi introduzido pelo spec novo sem consultar o original
- O código da aplicação já usa `'agent'` em vários lugares (`lib/types/frontend.ts`, `lib/auth/api-context.ts`, `app/api/auth/me/route.ts`)
- **Decisão:** migrar `'member'` e `'agent'` → `'professional'` no banco E no código

### 1.2 Tabela de permissões no lugar errado

**Hoje:** `permissions jsonb` dentro de `workspace_users`

**Correto:** tabela separada `professional_permissions` com campos tipados:
```
agenda | crm | conversas | relatorios | produtos
```

As áreas sempre bloqueadas para profissionais (independente de configuração):
```
flows | agent | knowledge_base | billing | settings | team
```

### 1.3 Tabelas que faltam

| Tabela | Propósito |
|---|---|
| `super_admins` | Nível 1 — Pedro, com 2FA |
| `professional_permissions` | Permissões granulares separadas |
| `workspace_invites` | Controle de convites com token e expiração |
| `workspace_subscriptions` | Dados do Stripe por workspace |
| `message_usage_cycles` | Ciclos de mensagens por mês de assinatura |
| `billing_events` | Histórico de eventos Stripe |
| `admin_impersonations` | Audit de impersonação do Super Admin |
| `lgpd_deletion_requests` | Solicitações de exclusão LGPD |
| `plan_definitions` | Definição de planos Starter/Pro |

### 1.4 Função auxiliar de RLS errada

**Hoje:** `get_my_workspace_id()` — retorna o primeiro workspace do usuário

**Correto (SPEC_AUTH.md §12):** `user_has_workspace_access(target_workspace_id UUID)` — verifica se o usuário tem acesso a um workspace específico com `is_active = true`

A diferença é importante: um usuário pode estar em múltiplos workspaces. A função atual pega apenas o primeiro, o que quebra o multi-workspace.

---

## 2. CORREÇÕES NECESSÁRIAS

### 2.1 Migration SQL (031_auth_correction.sql)

**Parte 1 — Corrigir roles:**
```sql
-- 1. Adicionar campo is_active em workspace_users (se não existir)
ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Migrar dados: 'member' e 'agent' → 'professional'
UPDATE workspace_users SET role = 'professional' WHERE role IN ('member', 'agent');

-- 3. Atualizar o CHECK constraint
ALTER TABLE workspace_users DROP CONSTRAINT IF EXISTS workspace_users_role_check;
ALTER TABLE workspace_users ADD CONSTRAINT workspace_users_role_check
  CHECK (role IN ('owner', 'professional'));

-- 4. Remover coluna permissions do workspace_users (migrar dados primeiro!)
-- Ver seção 2.2 abaixo
```

**Parte 2 — Criar tabelas faltantes:**

```sql
-- super_admins
CREATE TABLE IF NOT EXISTS super_admins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  totp_secret_encrypted TEXT,
  totp_enabled          BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- professional_permissions
CREATE TABLE IF NOT EXISTS professional_permissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_user_id UUID NOT NULL UNIQUE REFERENCES workspace_users(id) ON DELETE CASCADE,
  agenda            TEXT NOT NULL DEFAULT 'none' CHECK (agenda IN ('none','view','edit')),
  crm               TEXT NOT NULL DEFAULT 'none' CHECK (crm IN ('none','view','edit')),
  conversas         TEXT NOT NULL DEFAULT 'none' CHECK (conversas IN ('none','view','edit')),
  relatorios        TEXT NOT NULL DEFAULT 'none' CHECK (relatorios IN ('none','view','edit')),
  produtos          TEXT NOT NULL DEFAULT 'none' CHECK (produtos IN ('none','view','edit')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- workspace_invites
CREATE TABLE IF NOT EXISTS workspace_invites (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email          TEXT NOT NULL,
  token          TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role           TEXT NOT NULL DEFAULT 'professional' CHECK (role IN ('owner','professional')),
  permissions    JSONB NOT NULL DEFAULT '{}',
  invited_by     UUID REFERENCES workspace_users(id),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- plan_definitions
CREATE TABLE IF NOT EXISTS plan_definitions (
  plan                       TEXT PRIMARY KEY,
  price_brl_yearly           NUMERIC(10,2) NOT NULL,
  messages_per_month         INTEGER NOT NULL,
  max_active_flows           INTEGER NOT NULL,
  max_professionals          INTEGER NOT NULL,
  max_whatsapp_channels      INTEGER NOT NULL,
  conversation_history_days  INTEGER NOT NULL
);

-- workspace_subscriptions
CREATE TABLE IF NOT EXISTS workspace_subscriptions (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id               UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  plan                       TEXT NOT NULL REFERENCES plan_definitions(plan),
  status                     TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','grace_period','blocked','cancelled')),
  stripe_customer_id         TEXT,
  stripe_subscription_id     TEXT,
  stripe_price_id            TEXT,
  current_period_start       TIMESTAMPTZ,
  current_period_end         TIMESTAMPTZ,
  cancel_at_period_end       BOOLEAN NOT NULL DEFAULT false,
  cancelled_at               TIMESTAMPTZ,
  grace_period_ends_at       TIMESTAMPTZ,
  last_stripe_event_timestamp BIGINT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- message_usage_cycles
CREATE TABLE IF NOT EXISTS message_usage_cycles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  cycle_start         TIMESTAMPTZ NOT NULL,
  cycle_end           TIMESTAMPTZ NOT NULL,
  message_count       INTEGER NOT NULL DEFAULT 0,
  is_current          BOOLEAN NOT NULL DEFAULT true,
  warning_80_sent     BOOLEAN NOT NULL DEFAULT false,
  warning_100_sent    BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- billing_events
CREATE TABLE IF NOT EXISTS billing_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type     TEXT NOT NULL,
  payload        JSONB NOT NULL DEFAULT '{}',
  processed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- admin_impersonations
CREATE TABLE IF NOT EXISTS admin_impersonations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id   UUID NOT NULL REFERENCES auth.users(id),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  reason          TEXT
);

-- lgpd_deletion_requests
CREATE TABLE IF NOT EXISTS lgpd_deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES auth.users(id),
  confirm_token   TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  confirmed_at    TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','confirmed','executed','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Parte 3 — Migrar permissions do jsonb para professional_permissions:**
```sql
-- Para cada workspace_user com role='professional' que tinha permissions,
-- criar registro em professional_permissions com os valores mapeados.
-- Como as áreas mudaram (chat/flows/ai_config/crm → agenda/crm/conversas/relatorios/produtos),
-- fazer mapeamento de melhor esforço:
INSERT INTO professional_permissions (workspace_user_id, crm, conversas)
SELECT 
  wu.id,
  COALESCE((wu.permissions->>'crm')::text, 'none') as crm,
  COALESCE((wu.permissions->>'chat')::text, 'none') as conversas
FROM workspace_users wu
WHERE wu.role = 'professional'
  AND wu.permissions IS NOT NULL
  AND wu.permissions != '{}'
ON CONFLICT (workspace_user_id) DO NOTHING;

-- Após migrar, remover coluna permissions de workspace_users
ALTER TABLE workspace_users DROP COLUMN IF EXISTS permissions;
ALTER TABLE workspace_users DROP COLUMN IF EXISTS invited_by;
ALTER TABLE workspace_users DROP COLUMN IF EXISTS invited_at;
ALTER TABLE workspace_users DROP COLUMN IF EXISTS accepted_at;
-- Esses campos vão para workspace_invites
```

**Parte 4 — Atualizar RLS:**
```sql
-- Criar função correta do spec original
CREATE OR REPLACE FUNCTION user_has_workspace_access(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_users
    WHERE user_id = auth.uid()
      AND workspace_id = target_workspace_id
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- Manter get_my_workspace_id() por compatibilidade com código existente
-- mas atualizar para respeitar is_active
CREATE OR REPLACE FUNCTION get_my_workspace_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT workspace_id
  FROM workspace_users
  WHERE user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

-- RLS nas novas tabelas
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_self ON super_admins FOR SELECT USING (user_id = auth.uid());

ALTER TABLE professional_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pp_select ON professional_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_users wu
      WHERE wu.id = professional_permissions.workspace_user_id
        AND user_has_workspace_access(wu.workspace_id)
    )
  );
CREATE POLICY pp_modify ON professional_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_users wu_target
      JOIN workspace_users wu_actor ON wu_actor.workspace_id = wu_target.workspace_id
      WHERE wu_target.id = professional_permissions.workspace_user_id
        AND wu_actor.user_id = auth.uid()
        AND wu_actor.role = 'owner'
    )
  );

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY wi_select ON workspace_invites
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY wi_modify ON workspace_invites FOR ALL USING (
  EXISTS (
    SELECT 1 FROM workspace_users
    WHERE user_id = auth.uid()
      AND workspace_id = workspace_invites.workspace_id
      AND role = 'owner'
  )
);

ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select ON workspace_subscriptions
  FOR SELECT USING (user_has_workspace_access(workspace_id));

ALTER TABLE message_usage_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY muc_select ON message_usage_cycles
  FOR SELECT USING (user_has_workspace_access(workspace_id));

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
-- Sem policy SELECT pública — apenas service_role

ALTER TABLE admin_impersonations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_select ON admin_impersonations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

ALTER TABLE lgpd_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY lgpd_select ON lgpd_deletion_requests
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY lgpd_insert ON lgpd_deletion_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_users
      WHERE user_id = auth.uid()
        AND workspace_id = lgpd_deletion_requests.workspace_id
        AND role = 'owner'
    )
  );

-- Seed de planos
INSERT INTO plan_definitions (
  plan, price_brl_yearly, messages_per_month,
  max_active_flows, max_professionals,
  max_whatsapp_channels, conversation_history_days
) VALUES
  ('starter', 497.00, 5000, 5, 3, 1, 90),
  ('pro',     799.00, 10000, 20, 10, 3, 365)
ON CONFLICT (plan) DO NOTHING;
```

### 2.2 Arquivos de código a corrigir

**lib/types/frontend.ts**
- Trocar `role: 'owner' | 'agent'` → `role: 'owner' | 'professional'`

**lib/auth/api-context.ts**
- Trocar referências a `'agent'` → `'professional'`
- `const role: 'owner' | 'agent'` → `const role: 'owner' | 'professional'`

**lib/permissions.ts**
- Atualizar `WorkspaceRole` para `'owner' | 'professional'`
- Remover `'member'` e `'agent'` do tipo

**lib/permissions-server.ts**
- Atualizar tipo de retorno de `getWorkspaceRole()`
- Trocar verificações de `'member'` e `'agent'` por `'professional'`

**hooks/useWorkspacePermissions.ts**
- Trocar `WorkspaceRole = 'owner' | 'member' | 'agent'` → `'owner' | 'professional'`

**components/layout/Sidebar.tsx**
- Trocar `WorkspaceRole = 'owner' | 'member' | 'agent'`

**components/settings/TeamManager.tsx**
- Trocar `role: 'owner' | 'member' | 'agent'`
- Adaptar para buscar permissões de `professional_permissions` em vez de `permissions jsonb`

**components/settings/SettingsSubNav.tsx**
- Trocar `type Role = 'owner' | 'member' | 'agent' | null`

**app/(app)/settings/team/page.tsx**
- Trocar cast de role

**app/api/auth/me/route.ts**
- Trocar `'agent'` → `'professional'`

**app/settings/actions.ts**
- `inviteMember` → usar `workspace_invites` em vez de `workspace_users` diretamente
- `updateMemberPermissions` → usar `professional_permissions` em vez de `permissions jsonb`
- `removeMember` → desativar (`is_active = false`) em vez de deletar

### 2.3 Áreas sempre bloqueadas para profissionais

No código, adicionar guard explícito para as áreas que nunca podem ser acessadas por `professional`:
```typescript
const AREAS_ALWAYS_BLOCKED_FOR_PROFESSIONAL = [
  'flows', 'ai_config', 'knowledge_base', 'billing', 'settings', 'team'
] as const
```

Isso vai no middleware e em `hasPermission()`.

---

## 3. O QUE NÃO MUDA

- RLS das tabelas de dados (clients, messages, flows, etc.) — permanece igual
- Estrutura de `workspaces` e `workspace_users` (só adiciona `is_active`)
- `user_profiles` — permanece igual
- Logoff — permanece igual
- Páginas de settings/profile e settings/security — permanecem iguais
- Sidebar visual — só mudam os tipos TypeScript
