# SPEC_AUTH.md
# Autenticação, Multi-tenancy, Planos e Billing

> **Versão:** 1.1 — corrigida após gap analysis  
> **Status:** Spec aprovado — pronto para implementação  
> **Stack:** Next.js App Router + Supabase Auth + Stripe  
> **Companion docs:** SPEC_MOTOR_BACKEND.md, SPEC_OBSERVABILITY.md (futuro), IMPLEMENTATION_PLAN_AUTH_GAPS.md

**Mudanças da v1.0 → v1.1:**
- Estado de onboarding persistido (resume from where you left off)
- Status do workspace verificado em middleware E em todos os endpoints de escrita
- Cancelamento pelo Owner com retenção de dados (LGPD-aware)
- Job de reset mensal definido + ciclo de mensagens explícito (mês de assinatura, não calendário)
- Multi-workspace por usuário (Maria pode trabalhar em 2 barbearias)
- Webhook fora de ordem tratado por timestamp
- RLS em TODAS as tabelas novas (não só 2)
- Race condition no checkout resolvido com transação atômica + idempotência
- 2FA obrigatório para Super Admin
- Lógica de cancelamento e exclusão de dados completa

---

## 1. Visão Geral

O sistema tem **3 níveis de acesso** completamente separados:

```
NÍVEL 1 — Super Admin (Pedro)
  Acesso total à plataforma. Vê todos os workspaces, 
  métricas globais, pode impersonar qualquer workspace.
  ⚠️ 2FA OBRIGATÓRIO.

NÍVEL 2 — Owner (dono da barbearia)
  Acesso total ao próprio workspace. Configura tudo,
  convida profissionais, define permissões deles.

NÍVEL 3 — Professional (barbeiro, recepcionista)
  Acesso restrito ao que o Owner liberou.
  Cada área pode ser: sem acesso / só visualização / edição completa.
  ⚠️ Pode pertencer a múltiplos workspaces simultaneamente.
```

---

## 2. Papéis e Permissões

### 2.1 Super Admin

```typescript
interface SuperAdmin {
  id: string
  user_id: string
  email: string
  role: 'super_admin'
  totp_secret_encrypted: string  // 2FA obrigatório
  totp_enabled: boolean
  created_at: Date
}
```

**Capacidades:**
- Ver todos os workspaces, planos, status de pagamento
- Sala de comando (Observability) global
- Impersonar qualquer workspace para suporte (logado em audit_logs)
- Adicionar outros super admins (limite: 5)
- Ver métricas financeiras (MRR, churn, conversão)
- Suspender/reativar workspaces manualmente
- Forçar exclusão de workspace (LGPD)

**Acesso:** rota `/admin/*` — protegida por role `super_admin` + 2FA verificado na sessão

---

### 2.2 Owner

```typescript
interface WorkspaceUser {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'professional'
  name: string
  email: string
  avatar_url?: string
  is_active: boolean
  invited_by?: string
  last_active_at: Date
  created_at: Date
}
```

**Capacidades do Owner:**
- Acesso completo ao próprio workspace (quando status = 'active')
- Configurar agente, fluxos, knowledge base
- Conectar WhatsApp, gerenciar profissionais e permissões
- Ver conversas, CRM, agenda, relatórios
- Gerenciar assinatura e cancelamento (Stripe Portal)
- Solicitar exclusão de dados (LGPD)

**Quando workspace bloqueado/suspenso/cancelado:** acesso somente leitura (ver seção 5).

---

### 2.3 Professional

```typescript
type PermissionLevel = 'none' | 'view' | 'edit'

interface ProfessionalPermissions {
  workspace_user_id: string
  agenda: PermissionLevel
  crm: PermissionLevel
  conversas: PermissionLevel
  relatorios: PermissionLevel
  produtos: PermissionLevel
}

const AREAS_ALWAYS_BLOCKED = [
  'flows', 'agent', 'knowledge_base', 'billing', 'settings', 'team'
] as const
```

Professional nunca acessa essas áreas independente do que o Owner configure.

---

### 2.4 Multi-workspace por usuário (gap #5 corrigido)

**Cenário:** Maria trabalha em 2 barbearias. Ambas a convidam.

**Comportamento:**
- Email único na tabela `auth.users` (Supabase Auth)
- N registros em `workspace_users` (um por workspace)
- Permissões podem ser diferentes em cada workspace
- Login leva ao seletor de workspace se houver mais de 1
- Sessão guarda o workspace ativo (cookie `active_workspace_id`)
- Botão de troca rápida no header

**Fluxo:**
- 1 workspace → redireciona direto
- 2+ workspaces → tela `/select-workspace`
- Owner também pode ter múltiplos workspaces (caso raro mas permitido)

---

## 3. Planos e Limites

### 3.1 Tabela de planos

| Feature | Starter | Pro |
|---|---|---|
| **Preço** | R$ 497/ano | R$ 799/ano |
| **Mensagens recebidas/ciclo** | 5.000 | 10.000 |
| **Fluxos ativos simultâneos** | 5 | 20 |
| **Profissionais no workspace** | 3 | 10 |
| **Canais WhatsApp conectados** | 1 | 3 |
| **Histórico de conversas** | 90 dias | 365 dias |

Todas as features (Observability, CRM, Agenda, Comissão) são iguais nos dois planos.

### 3.2 Ciclo de mensagens (gap #4 corrigido)

**Decisão:** ciclo por **mês de assinatura**, não calendário. Alinha com a cobrança do Stripe.

```typescript
// Cliente que assina dia 20/maio:
// → subscription_anchor_day = 20
// → ciclos: 20/05 a 19/06, 20/06 a 19/07, ...
// 
// Cliente que assina dia 31/janeiro:
// → anchor_day = 31
// → fevereiro (28 dias) → reset no último dia do mês
// → março → reset dia 31

interface MessageUsageCycle {
  workspace_id: string
  cycle_start: Date
  cycle_end: Date
  message_count: number
  is_current: boolean
  warning_80_sent: boolean
  warning_100_sent: boolean
}
```

**Job de reset:** roda diariamente às 00:05 UTC. Para cada workspace com `cycle_end < now`:
1. Marca ciclo atual como `is_current = false`
2. Cria novo ciclo com count = 0
3. Define novo `cycle_end = cycle_start + 1 mês` (com tratamento de meses curtos)

### 3.3 Comportamento ao atingir limites

**Mensagens (5k/10k por ciclo):**
- 80% → notificação no painel + email
- 100% → motor para de responder novas mensagens (turno atual finaliza)
- Reset automático no início do próximo ciclo

**Fluxos ativos:**
- Tentar publicar além do limite → bloqueio com mensagem de upgrade
- Existentes continuam funcionando

**Profissionais:**
- Tentar convidar além do limite → bloqueio
- Convites pendentes contam no limite (evita burlar)

**Canais WhatsApp:**
- Canal desconectado conta no limite até deletado explicitamente

---

## 4. Fluxo de Onboarding

### 4.1 Cadastro pelo site

```
1. /signup → preenche dados + escolhe plano
2. POST /api/auth/signup → cria user no Supabase Auth + signup_token
3. POST /api/billing/checkout com signup_token → cria Stripe Checkout
4. Cliente paga
5. Stripe redireciona para /onboarding?session_id=xxx
6. Webhook checkout.session.completed → cria workspace EM TRANSAÇÃO
7. Onboarding (3 passos com estado persistido)
8. /dashboard
```

### 4.2 Estado de onboarding persistido (gap #1 corrigido)

```typescript
type OnboardingStatus = 
  | 'agent_pending'      // configurar persona
  | 'whatsapp_pending'   // conectar WhatsApp
  | 'product_pending'    // criar primeiro produto
  | 'complete'           // pode usar o sistema

// Salvo em workspaces.onboarding_status
```

**Fluxo de resume:**
```
Login → check onboarding_status:
  - 'agent_pending'   → /onboarding/agent
  - 'whatsapp_pending'→ /onboarding/whatsapp
  - 'product_pending' → /onboarding/product
  - 'complete'        → /dashboard

Cada passo tem botão "Pular por agora":
  - Permite avançar, mas mostra banner persistente no dashboard
  - Banner: "Complete sua configuração — [link para o passo pulado]"
```

**Edge case:** se Owner pular WhatsApp e tentar conversas → tela explica que precisa conectar.

### 4.3 Visão do Pedro (admin)

```
/admin/workspaces → lista cada workspace com:
  - plano: starter | pro
  - payment_status: confirmed | failed | pending
  - onboarding_status
  - whatsapp_connected
  - configured_by_admin (flag manual de Pedro)
  - created_at
```

Pedro recebe email + Slack quando novo workspace é criado.

---

## 5. Bloqueio, Cancelamento e LGPD

### 5.1 Ciclo de cobrança

```
Dia 0    → Stripe cobra anualmente
Dia 0    → Falha: 3 retries em 7 dias
Dia 7    → Todas falharam → 'grace_period' (3 dias)
Dia 10   → 'blocked'
```

### 5.2 Estado bloqueado/suspenso/cancelado (gap #2 corrigido)

**TODA escrita é negada em 3 camadas:**

**1. Middleware Next.js:**
```typescript
const ROUTE_POLICIES = {
  '/admin/*':           { roles: ['super_admin'], require_2fa: true },
  '/dashboard/*':       { roles: ['owner', 'professional'] },
  '/onboarding/*':      { roles: ['owner'], require_status: ['active'] },
  '/settings/billing':  { roles: ['owner'] },  // permite em qualquer status
  '/settings/team':     { roles: ['owner'], require_status: ['active', 'grace_period'] },
  '/flows/*':           { roles: ['owner'], require_status: ['active', 'grace_period'] },
  '/agent/*':           { roles: ['owner'], require_status: ['active', 'grace_period'] },
  '/knowledge/*':       { roles: ['owner'], require_status: ['active', 'grace_period'] },
}
```

**2. Endpoints de API:**
```typescript
async function POST(req) {
  const { workspace } = await getWorkspace(req)
  if (!['active', 'grace_period'].includes(workspace.status)) {
    return Response.json(
      { error: 'WORKSPACE_BLOCKED', status: workspace.status },
      { status: 423 }  // Locked
    )
  }
  // ...
}
```

**3. Motor (orchestrator):**
```typescript
if (!['active', 'grace_period'].includes(workspace.status)) {
  await logAudit('motor.skipped_blocked_workspace', { workspace_id })
  return // não responde
}
```

**Visualização para Owner:**
- Logam normalmente
- Banner persistente: "Acesso bloqueado — atualize o pagamento"
- Conversas, CRM, agenda, produtos: somente leitura
- Botão "Atualizar pagamento" → Stripe Portal
- Após pagar → reativa em segundos

### 5.3 Cancelamento pelo Owner (gap #3 corrigido)

**Como:** Stripe Portal → "Cancel subscription"

**Comportamento:**
```
Dia do cancelamento:
  → webhook customer.subscription.updated com cancel_at_period_end=true
  → workspace.status permanece 'active'
  → cancel_at_period_end=true salvo no banco
  → Owner usa normalmente até fim do período pago
  → Email: "Cancelamento agendado para [data]"

Fim do período pago:
  → webhook customer.subscription.deleted
  → workspace.status = 'cancelled'
  → Bot para de responder
  → Painel em modo somente leitura
  → Email: "Sua assinatura encerrou"
```

**Reverter cancelamento:** Owner pode reativar enquanto não terminou o período pago.
- POST /api/billing/reactivate → atualiza Stripe (cancel_at_period_end=false)

**Reativação após cancelado:** novo cadastro completo.

### 5.4 Política LGPD (gap #3 corrigido)

**Workspace `cancelled`:**
- Dados mantidos por **90 dias** (recuperação se cliente voltar atrás)
- Após 90 dias: anonimização automática
  - Mensagens: `content` → `[REMOVIDO_LGPD]`
  - Clients: `phone`, `name`, `email` → hash
  - Memórias semânticas e episódicas: deletadas
  - Backups: rotação de 30 dias

**Solicitação explícita (LGPD Art. 18):**
```
1. Owner: POST /api/account/delete-data
2. Email com token (24h validade)
3. Owner clica → confirma identidade
4. Anonimização imediata (sem esperar 90 dias)
5. Audit log permanente do pedido
6. Email: "Seus dados foram removidos"
```

**Workspace `suspended` (Pedro):**
- Tratado igual a `blocked` mas sem grace period
- Pedro pode reativar manualmente
- Sem retenção automática

### 5.5 Estados do workspace

```typescript
type WorkspaceStatus = 
  | 'active'             
  | 'grace_period'       
  | 'blocked'            
  | 'suspended'          
  | 'cancelled'          
  | 'pending_deletion'    // exclusão LGPD em processamento
  | 'deleted'            // anonimizado (registro mantido para auditoria)

// Transições válidas:
// active ⟷ grace_period ⟷ blocked
// active → cancelled (após período pago expirar)
// any → suspended (decisão de Pedro)
// suspended → active (reativação manual)
// cancelled → pending_deletion → deleted (após 90 dias ou pedido LGPD)
```

---

## 6. Autenticação Técnica

### 6.1 Stack

- **Supabase Auth** — sessions, JWT, refresh tokens
- **Email/senha** — única opção para Owner/Professional na v1
- **Email/senha + TOTP** — obrigatório para Super Admin
- **Next.js Middleware** — protege rotas por role + workspace status
- **Stripe** — billing e webhooks

### 6.2 2FA para Super Admin (gap #10 corrigido)

**Setup obrigatório no primeiro login:**
```
1. Login com email/senha
2. Sistema detecta totp_enabled=false
3. Redirect para /admin/setup-2fa
4. Mostra QR code (otpauth://totp/...)
5. Usuário escaneia (Google Auth / Authy / 1Password)
6. Digita código de 6 dígitos para confirmar
7. Sistema salva totp_secret_encrypted (AES-256-GCM com ENCRYPTION_KEY)
8. Gera 10 backup codes (mostrados 1x, hashed no banco)
9. totp_enabled=true → libera /admin/*
```

**Login subsequente:**
```
1. Email + senha
2. Tela TOTP → digita código de 6 dígitos
3. Verifica contra totp_secret (window de 30s ± 1)
4. Sessão tem flag totp_verified=true
5. Acesso a /admin/* exige totp_verified
```

### 6.3 Fluxo de login

```
1. /login → email + senha
2. Supabase Auth valida
3. Middleware identifica role:
   - super_admin → /admin/2fa-verify
   - owner/professional com 1 workspace → /dashboard
   - owner/professional com 2+ workspaces → /select-workspace
4. Session: 7 dias com refresh automático
```

### 6.4 Verificação de permissão granular

```typescript
function usePermission(area: keyof ProfessionalPermissions): PermissionLevel {
  const { user, workspace } = useAuth()
  
  // Owner = edit
  if (user.role === 'owner') return 'edit'
  
  // Workspace bloqueado/suspenso/cancelado = view (somente leitura)
  if (['blocked', 'suspended', 'cancelled'].includes(workspace.status)) {
    return user.permissions[area] === 'none' ? 'none' : 'view'
  }
  
  // Áreas hardcoded
  if (AREAS_ALWAYS_BLOCKED.includes(area)) return 'none'
  
  return user.permissions[area] ?? 'none'
}
```

---

## 7. Schema do Banco

```sql
-- =========================================================
-- SUPER ADMIN (com 2FA)
-- =========================================================
CREATE TABLE super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  totp_secret_encrypted TEXT,
  totp_enabled BOOLEAN DEFAULT false,
  backup_codes_hashed TEXT[],
  last_2fa_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- =========================================================
-- USUÁRIOS DO WORKSPACE
-- =========================================================
CREATE TABLE workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'professional',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  invited_by UUID REFERENCES workspace_users(id),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)  -- gap #5
);

CREATE INDEX idx_workspace_users_user_id ON workspace_users(user_id);

-- =========================================================
-- PERMISSÕES DOS PROFISSIONAIS
-- =========================================================
CREATE TABLE professional_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_user_id UUID NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
  agenda TEXT DEFAULT 'none',
  crm TEXT DEFAULT 'none',
  conversas TEXT DEFAULT 'none',
  relatorios TEXT DEFAULT 'none',
  produtos TEXT DEFAULT 'none',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_user_id)
);

-- =========================================================
-- CONVITES PENDENTES
-- =========================================================
CREATE TABLE workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professional',
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES workspace_users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- ASSINATURAS
-- =========================================================
CREATE TABLE workspace_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  subscription_anchor_day INT,                  -- gap #4
  cancel_at_period_end BOOLEAN DEFAULT false,   -- gap #3
  cancelled_at TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ,
  last_stripe_event_timestamp BIGINT,           -- gap #7
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id)
);

-- =========================================================
-- DEFINIÇÕES DE PLANO
-- =========================================================
CREATE TABLE plan_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan TEXT UNIQUE NOT NULL,
  price_brl_yearly DECIMAL(10,2),
  messages_per_month INT,
  max_active_flows INT,
  max_professionals INT,
  max_whatsapp_channels INT,
  conversation_history_days INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- CICLOS DE USO DE MENSAGENS (gap #4)
-- =========================================================
CREATE TABLE message_usage_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  message_count INT DEFAULT 0,
  is_current BOOLEAN DEFAULT true,
  warning_80_sent BOOLEAN DEFAULT false,
  warning_100_sent BOOLEAN DEFAULT false,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, cycle_start)
);

CREATE INDEX idx_message_usage_current ON message_usage_cycles(workspace_id, is_current) WHERE is_current = true;

-- =========================================================
-- BILLING EVENTS (idempotência + ordem)
-- =========================================================
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  stripe_event_id TEXT UNIQUE NOT NULL,
  stripe_event_timestamp BIGINT NOT NULL,        -- gap #7
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_events_workspace ON billing_events(workspace_id, processed_at DESC);

-- =========================================================
-- IMPERSONATIONS (Super Admin agindo como cliente)
-- =========================================================
CREATE TABLE admin_impersonations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id UUID NOT NULL REFERENCES super_admins(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- =========================================================
-- LGPD: SOLICITAÇÕES DE EXCLUSÃO
-- =========================================================
CREATE TABLE lgpd_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  requested_by UUID NOT NULL REFERENCES workspace_users(id),
  request_token TEXT UNIQUE,
  confirmed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- COLUNAS ADICIONAIS EM workspaces
-- =========================================================
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'agent_pending';
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS configured_by_admin BOOLEAN DEFAULT false;
```

---

## 8. Integração Stripe

### 8.1 Fluxo de pagamento (gap #9 corrigido)

```
1. POST /api/auth/signup
   → cria user no Supabase Auth
   → salva metadata temporário
   → retorna { user_id, signup_token }

2. POST /api/billing/checkout com signup_token
   → cria Stripe Customer
   → cria Stripe Checkout Session com metadata { user_id, plan, business_name }
   → retorna { checkout_url }

3. Cliente paga no Stripe Checkout

4. Stripe redireciona para /onboarding?session_id=xxx
   → frontend faz polling em /api/billing/status?session_id=xxx
   → polling para quando subscription.status = 'active'

5. Webhook checkout.session.completed (em paralelo):
   → verifica idempotência (billing_events.stripe_event_id UNIQUE)
   → cria workspace + user + subscription EM TRANSAÇÃO
   → SE já existe workspace para esse stripe_customer_id → ignora
```

**Transação atômica do webhook:**
```sql
BEGIN;
  -- 1. Insere billing_event (UNIQUE previne duplicação)
  INSERT INTO billing_events (stripe_event_id, ...) VALUES (...);

  -- 2. Cria workspace
  INSERT INTO workspaces (...) RETURNING id INTO workspace_id;

  -- 3. Cria workspace_user (Owner)
  INSERT INTO workspace_users (workspace_id, user_id, role, ...) VALUES (workspace_id, ..., 'owner', ...);

  -- 4. Cria subscription
  INSERT INTO workspace_subscriptions (workspace_id, ...) VALUES (workspace_id, ...);

  -- 5. Cost cap default
  INSERT INTO workspace_cost_caps (workspace_id, ...) VALUES (workspace_id, ...);

  -- 6. Agent config vazio
  INSERT INTO workspace_agent_config (workspace_id, ...) VALUES (workspace_id, ...);

  -- 7. Primeiro ciclo de mensagens
  INSERT INTO message_usage_cycles (workspace_id, cycle_start, cycle_end, ...) VALUES (...);
COMMIT;
```

### 8.2 Webhooks processados (gap #3, #7 corrigidos)

```typescript
type StripeWebhookEvent =
  | 'checkout.session.completed'      // → criar workspace + ativar
  | 'invoice.payment_succeeded'       // → renovar período
  | 'invoice.payment_failed'          // → iniciar grace period
  | 'customer.subscription.updated'   // → cancel_at_period_end mudou
  | 'customer.subscription.deleted'   // → cancelar workspace
```

**Tratamento de eventos fora de ordem:**
```typescript
// Antes de processar:
const sub = await getSubscription(workspace_id)
if (event.created < sub.last_stripe_event_timestamp) {
  await logAudit('billing.stale_event_ignored', { event_id })
  return Response.json({ received: true }, { status: 200 })
}

// Após processar:
await updateSubscription(workspace_id, { last_stripe_event_timestamp: event.created })
```

### 8.3 Endpoints de billing

```
POST /api/billing/checkout              → Stripe Checkout Session
POST /api/billing/webhook               → eventos Stripe (HMAC validado)
POST /api/billing/portal                → Stripe Portal Session
GET  /api/billing/status                → status atual
GET  /api/billing/usage                 → uso do ciclo
POST /api/billing/cancel                → cancela (chama Stripe)
POST /api/billing/reactivate            → reverte cancelamento
```

---

## 9. API Routes

```
# AUTH
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/reset-password
POST /api/auth/update-password
GET  /api/auth/workspaces               → lista workspaces do user
POST /api/auth/select-workspace         → define active_workspace_id

# 2FA (Super Admin)
POST /api/admin/2fa/setup
POST /api/admin/2fa/verify-setup
POST /api/admin/2fa/verify
POST /api/admin/2fa/disable

# TEAM
POST /api/team/invite
GET  /api/team/invite/[token]
POST /api/team/invite/[token]/accept
PUT  /api/team/[user_id]/permissions
DELETE /api/team/[user_id]
GET  /api/team

# ADMIN
GET  /api/admin/workspaces
GET  /api/admin/workspaces/[id]
POST /api/admin/workspaces/[id]/suspend
POST /api/admin/workspaces/[id]/reactivate
POST /api/admin/workspaces/[id]/impersonate
POST /api/admin/workspaces/[id]/end-impersonation
DELETE /api/admin/workspaces/[id]
POST /api/admin/super-admins

# LGPD
POST /api/account/export-data
POST /api/account/delete-data
GET  /api/account/delete-confirm/[token]

# JOBS (cron)
POST /api/jobs/check-grace-periods
POST /api/jobs/reset-message-cycles
POST /api/jobs/anonymize-cancelled
POST /api/jobs/expire-invites
```

---

## 10. Emails Transacionais (15 templates)

| Evento | Destinatário |
|---|---|
| Cadastro confirmado | Owner |
| Novo workspace criado | Pedro |
| Convite de profissional | Professional |
| Pagamento confirmado | Owner |
| Pagamento falhou | Owner |
| Grace period dia 1 | Owner |
| Grace period dia 2 | Owner |
| Grace period dia 3 | Owner |
| Bloqueio | Owner |
| Desbloqueio | Owner |
| Mensagens 80% | Owner |
| Mensagens 100% | Owner |
| Cancelamento agendado | Owner |
| Cancelamento efetivo | Owner |
| LGPD: confirmação de exclusão | Owner |
| LGPD: exclusão concluída | Owner |
| Reset de senha | User |

---

## 11. Seed de Dados Iniciais

```sql
INSERT INTO plan_definitions (
  plan, price_brl_yearly, messages_per_month,
  max_active_flows, max_professionals,
  max_whatsapp_channels, conversation_history_days
) VALUES
  ('starter', 497.00, 5000, 5, 3, 1, 90),
  ('pro',     799.00, 10000, 20, 10, 3, 365)
ON CONFLICT (plan) DO NOTHING;
```

---

## 12. RLS — em TODAS as tabelas (gap #8 corrigido)

```sql
-- Helper functions
CREATE OR REPLACE FUNCTION user_has_workspace_access(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_users
    WHERE user_id = auth.uid()
      AND workspace_id = target_workspace_id
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE;

-- workspaces
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspaces_select ON workspaces
  FOR SELECT USING (user_has_workspace_access(id));
CREATE POLICY workspaces_update ON workspaces
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM workspace_users WHERE user_id = auth.uid() AND workspace_id = workspaces.id AND role = 'owner')
  );

-- workspace_users
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY wu_select ON workspace_users
  FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY wu_modify ON workspace_users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM workspace_users wu WHERE wu.user_id = auth.uid() AND wu.workspace_id = workspace_users.workspace_id AND wu.role = 'owner')
  );

-- professional_permissions
ALTER TABLE professional_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pp_select ON professional_permissions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM workspace_users wu WHERE wu.id = professional_permissions.workspace_user_id AND user_has_workspace_access(wu.workspace_id))
  );
CREATE POLICY pp_modify ON professional_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM workspace_users wu_target, workspace_users wu_actor
            WHERE wu_target.id = professional_permissions.workspace_user_id
              AND wu_actor.workspace_id = wu_target.workspace_id
              AND wu_actor.user_id = auth.uid()
              AND wu_actor.role = 'owner')
  );

-- workspace_invites
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY wi_select ON workspace_invites FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY wi_modify ON workspace_invites FOR ALL USING (
  EXISTS (SELECT 1 FROM workspace_users WHERE user_id = auth.uid() AND workspace_id = workspace_invites.workspace_id AND role = 'owner')
);

-- workspace_subscriptions (read-only para usuários, write apenas service_role)
ALTER TABLE workspace_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ws_select ON workspace_subscriptions FOR SELECT USING (user_has_workspace_access(workspace_id));

-- message_usage_cycles
ALTER TABLE message_usage_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY muc_select ON message_usage_cycles FOR SELECT USING (user_has_workspace_access(workspace_id));

-- billing_events: apenas service_role (sem policy SELECT pública)
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- admin_impersonations: apenas super admins
ALTER TABLE admin_impersonations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_select ON admin_impersonations
  FOR SELECT USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- lgpd_deletion_requests
ALTER TABLE lgpd_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY lgpd_select ON lgpd_deletion_requests FOR SELECT USING (user_has_workspace_access(workspace_id));
CREATE POLICY lgpd_insert ON lgpd_deletion_requests FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM workspace_users WHERE user_id = auth.uid() AND workspace_id = lgpd_deletion_requests.workspace_id AND role = 'owner')
);

-- super_admins: apenas o próprio super admin
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_self ON super_admins FOR SELECT USING (user_id = auth.uid());

-- Service role bypassa RLS. NUNCA expor service_role no frontend.
```

---

## 13. Fora do Escopo

- OAuth (Google, GitHub) → fase 2
- 2FA opcional para Owner → fase 2
- SSO enterprise → fase 3
- API Keys externas → fase 2
- Audit log → SPEC_OBSERVABILITY.md
- Upgrade/downgrade de plano → fase 2
- Convite via SMS/Slack → fase 2

---

## 14. Ordem de Implementação

```
1. Migrations (este spec) — A01
2. Seed plan_definitions
3. Stripe configurado (produtos + webhook endpoint)
4. Supabase Auth (email/senha, templates)
5. Middleware com role + status check
6. Signup + checkout
7. Webhook Stripe TRANSACIONAL + idempotente
8. Login + multi-workspace selector
9. 2FA Super Admin
10. Onboarding com estado persistido
11. Convite + permissões granulares
12. Cancelamento + ciclos de mensagem (jobs)
13. Bloqueio (grace period)
14. Super Admin panel + impersonation
15. Emails (15 templates)
16. LGPD: solicitações de exclusão
17. Hook do orchestrator (depende de T17 do motor)
```

---

*Fim do SPEC_AUTH.md v1.1*
