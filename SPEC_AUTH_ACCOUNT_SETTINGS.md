# SPEC_AUTH_ACCOUNT_SETTINGS.md
## Yadone — Auth, Logoff, Configurações de Conta e Segurança Multi-tenant
**Versão:** 1.0
**Stack:** Next.js + Supabase Auth + Supabase RLS

---

## 1. CONTEXTO E PROBLEMA ATUAL

### O que existe hoje
- Tabelas `workspaces` e `workspace_users` já criadas — estrutura multi-tenant existe
- Tabela `sessions` com ícone de globo (RLS ativo parcialmente)
- **Todas as outras tabelas: UNRESTRICTED** — qualquer usuário autenticado lê dados de qualquer organização
- Sem logoff funcional
- Sem menu lateral completo
- Sem área de configurações de conta

### Riscos imediatos
1. **Vazamento entre organizações** — farmácia A consegue ler dados da farmácia B
2. **Dados de pacientes expostos** — `clients`, `messages`, `client_memory` sem RLS = LGPD violada
3. **Sem audit trail de acesso** — `audit_logs` existe mas provavelmente não está sendo usado corretamente

---

## 2. MODELO DE DADOS — ORGANIZAÇÃO E USUÁRIOS

### 2.1 Hierarquia de papéis

```
Workspace (organização = grupo de farmácias)
├── Owner (dono pagante)
│   └── Acesso total a todos os módulos
│   └── Pode adicionar/remover membros
│   └── Pode definir permissões por membro
│   └── Único que acessa Financeiro
│
└── Member (adicionado pelo dono)
    └── Acesso apenas aos módulos liberados pelo Owner
    └── Cada módulo pode ser: sem acesso / visualizar / editar
    └── Não acessa Financeiro
    └── Não pode adicionar outros membros
```

### 2.2 Tabela `workspaces` (verificar campos existentes, adicionar se faltar)
```sql
workspaces (
  id          uuid primary key,
  name        text not null,           -- "Farmácia São João"
  slug        text unique,             -- "farmacia-sao-joao"
  owner_id    uuid references auth.users(id),
  plan        text default 'active',   -- 'active' | 'suspended' | 'cancelled'
  created_at  timestamptz,
  updated_at  timestamptz
)
```

### 2.3 Tabela `workspace_users` (verificar campos existentes, adicionar se faltar)
```sql
workspace_users (
  id            uuid primary key,
  workspace_id  uuid references workspaces(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  role          text not null,         -- 'owner' | 'member'
  permissions   jsonb default '{}',   -- {"chat": "edit", "flows": "view", "crm": "none", ...}
  invited_by    uuid references auth.users(id),
  invited_at    timestamptz,
  accepted_at   timestamptz,
  created_at    timestamptz,
  unique(workspace_id, user_id)
)
```

### 2.4 Estrutura de permissões (jsonb `permissions`)
```json
{
  "chat": "edit",       -- "none" | "view" | "edit"
  "flows": "view",
  "ai_config": "none",
  "crm": "edit",
  "settings": "none"    -- Financeiro nunca aparece para member
}
```

### 2.5 Tabela `user_profiles` (criar se não existir)
```sql
user_profiles (
  id            uuid primary key references auth.users(id),
  full_name     text,
  phone         text,
  avatar_url    text,
  created_at    timestamptz,
  updated_at    timestamptz
)
```

---

## 3. RLS — ROW LEVEL SECURITY (CRÍTICO)

### 3.1 Princípio
**Cada tabela só retorna dados do workspace do usuário logado.**
Nenhuma query retorna dados de outro workspace. Nunca.

### 3.2 Função auxiliar (criar no Supabase)
```sql
-- Retorna o workspace_id do usuário logado
CREATE OR REPLACE FUNCTION get_my_workspace_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT workspace_id
  FROM workspace_users
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Verifica se usuário é owner do workspace
CREATE OR REPLACE FUNCTION is_workspace_owner(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_users
    WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND role = 'owner'
  );
$$;
```

### 3.3 RLS por tabela

**Tabelas com dados de pacientes (LGPD — máxima prioridade):**
```sql
-- clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON clients
  USING (workspace_id = get_my_workspace_id());

-- messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON messages
  USING (workspace_id = get_my_workspace_id());

-- client_memory
ALTER TABLE client_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON client_memory
  USING (workspace_id = get_my_workspace_id());

-- client_episodic_memory
ALTER TABLE client_episodic_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON client_episodic_memory
  USING (workspace_id = get_my_workspace_id());

-- appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON appointments
  USING (workspace_id = get_my_workspace_id());

-- crm_events
ALTER TABLE crm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON crm_events
  USING (workspace_id = get_my_workspace_id());
```

**Tabelas de configuração:**
```sql
-- flows / flow_nodes / flow_edges / flow_snapshots / flow_tool_policies
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON flows
  USING (workspace_id = get_my_workspace_id());
-- repetir para flow_nodes, flow_edges, flow_snapshots, flow_tool_policies

-- channel_configs
ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON channel_configs
  USING (workspace_id = get_my_workspace_id());

-- workspace_agent_config
ALTER TABLE workspace_agent_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON workspace_agent_config
  USING (workspace_id = get_my_workspace_id());

-- knowledge_base / knowledge_chunks
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON knowledge_base
  USING (workspace_id = get_my_workspace_id());
```

**Tabelas de métricas:**
```sql
-- daily_metrics / usage_metrics
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_isolation" ON daily_metrics
  USING (workspace_id = get_my_workspace_id());

-- somente owner vê financeiro/custos
ALTER TABLE workspace_cost_caps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON workspace_cost_caps
  USING (is_workspace_owner(workspace_id));
```

**Audit logs (somente leitura para owner):**
```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_read" ON audit_logs
  FOR SELECT USING (
    workspace_id = get_my_workspace_id()
    AND is_workspace_owner(get_my_workspace_id())
  );
-- INSERT via service_role apenas (backend, nunca client)
```

---

## 4. LOGOFF

### 4.1 Comportamento
- Botão "Sair" no menu lateral (rodapé do sidebar)
- Chama `supabase.auth.signOut()`
- Limpa cookies de sessão
- Redireciona para `/login`
- Server-side: invalidar token via API route pra garantir

### 4.2 Implementação
```typescript
// app/api/auth/logout/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies })
  await supabase.auth.signOut()
  return NextResponse.redirect('/login')
}
```

```typescript
// components/sidebar/LogoutButton.tsx
'use client'
export function LogoutButton() {
  const router = useRouter()
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }
  return <button onClick={handleLogout}>Sair</button>
}
```

---

## 5. MENU LATERAL (SIDEBAR)

### 5.1 Estrutura
```
┌─────────────────────┐
│  [logo Yadone]      │
│  [nome workspace]   │
├─────────────────────┤
│  Módulos:           │
│                     │
│  💬 Chat            │  ← sempre visível se tem permissão
│  ⚙️ Automações      │
│  🤖 IA e Dados      │
│  📊 CRM             │
│  🔧 Configurações   │  ← só owner vê sub-item Financeiro
├─────────────────────┤
│  [avatar] [nome]    │
│  [Sair →]           │
└─────────────────────┘
```

### 5.2 Regras de visibilidade
- Item aparece no menu apenas se `permissions[modulo] !== "none"`
- Owner vê todos os itens sempre
- Membro vê apenas módulos com `"view"` ou `"edit"`
- Item "Financeiro" (dentro de Configurações) → apenas owner

### 5.3 Regras de interação
- Se permissão = `"view"`: usuário acessa a página mas todos os botões de ação ficam desabilitados (disabled + tooltip "Sem permissão de edição")
- Se permissão = `"edit"`: acesso completo
- Se permissão = `"none"`: redireciona para `/unauthorized`

---

## 6. ÁREA DE CONFIGURAÇÕES DE CONTA

### 6.1 Estrutura de rotas
```
/settings
├── /settings/profile        → Dados pessoais
├── /settings/workspace      → Dados da organização (owner only)
├── /settings/team           → Gerenciar membros (owner only)
├── /settings/security       → Trocar senha, sessões ativas
└── /settings/billing        → Financeiro (owner only) — fase 2
```

### 6.2 `/settings/profile` — Dados pessoais (todos os usuários)
Campos editáveis:
- Nome completo
- Telefone
- Avatar (upload de imagem)
- Email (somente leitura — alterar email via `/settings/security`)

Botão: "Salvar alterações"

### 6.3 `/settings/workspace` — Dados da organização (owner only)
Campos:
- Nome da farmácia/organização
- CNPJ (somente leitura após cadastro)
- Endereço principal
- Logo da farmácia (usada nos áudios e mensagens enviadas pelo Yadone)

Botão: "Salvar alterações"

### 6.4 `/settings/team` — Gerenciar membros (owner only)

**Lista de membros ativos:**
```
[avatar] [nome] [email] [role: Member] [permissões] [Remover]
```

**Adicionar membro:**
- Campo: email do usuário
- Sistema envia convite por email (Supabase invite)
- Até o aceite: aparece como "Pendente"

**Configurar permissões por membro (modal):**
```
Módulo              Sem acesso    Visualizar    Editar
Chat                    ○             ○           ●
Automações              ○             ●           ○
IA e Dados              ●             ○           ○
CRM                     ○             ○           ●
Configurações           ●             ○           ○
```
Botão: "Salvar permissões"

**Regras:**
- Owner não pode ser removido
- Owner não pode ter permissões alteradas
- Membro removido perde acesso imediatamente (session invalidada)
- Financeiro nunca aparece na lista de permissões para membros

### 6.5 `/settings/security` — Segurança
- Trocar senha (form: senha atual + nova + confirmar)
- Listar sessões ativas (dispositivo, IP, data de acesso)
- Botão "Encerrar todas as outras sessões"

### 6.6 `/settings/billing` — Financeiro (owner only) — FASE 2
Placeholder por ora com texto:
> "Gerencie sua assinatura. Em breve disponível nesta área."

---

## 7. LGPD — CONFORMIDADE

### 7.1 O que temos que garantir

**Isolamento de dados:**
- RLS em todas as tabelas (seção 3 deste spec)
- Service role key NUNCA exposta no client
- Queries de dados sensíveis sempre server-side

**Dados de pacientes (`clients`, `messages`, `client_memory`):**
- Nunca retornar dados de workspaces distintos
- Audit log em todo acesso a `messages` e `client_memory`
- Direito de exclusão: owner pode solicitar deleção de dados de um cliente específico

**Audit trail:**
- Toda ação de escrita em `clients`, `messages`, `flows` gera entrada em `audit_logs`
- `audit_logs` com campos: `workspace_id`, `user_id`, `action`, `table_name`, `record_id`, `timestamp`
- Só owner lê os logs do próprio workspace

**Consentimento (já em contrato):**
- Dados de conversas usados para ML — consentimento registrado no onboarding
- Campo `lgpd_consent_at` na tabela `workspaces` (timestamp do aceite dos termos)

### 7.2 O que NÃO fazer
- Nunca fazer JOIN entre tabelas de workspaces diferentes
- Nunca usar `select *` sem filtro de `workspace_id` em queries server-side
- Nunca logar conteúdo de mensagens em error logs (só IDs)

---

## 8. FLUXO DE CONVITE DE MEMBRO

```
Owner digita email → sistema cria registro em workspace_users (status: pending)
→ Supabase envia email de convite
→ Novo usuário clica no link
→ Se não tem conta: cria conta Supabase Auth
→ Se já tem conta: loga e aceita convite
→ workspace_users.accepted_at = now()
→ Redireciona para o workspace com as permissões definidas pelo owner
```

**Importante:** um usuário pode pertencer a múltiplos workspaces (farmacêutico que trabalha em 2 farmácias). O sistema mostra um seletor de workspace no login se tiver mais de um.

---

## 9. SEGURANÇA ADICIONAL

### 9.1 Rate limiting
- Tabela `rate_limit_buckets` já existe — usar em:
  - Login (máx 5 tentativas por IP em 15min)
  - Convite de membros (máx 10 convites por dia por workspace)

### 9.2 Proteção de rotas (middleware/proxy)
```
/settings/*     → requer auth
/settings/workspace → requer role = owner
/settings/team  → requer role = owner
/settings/billing → requer role = owner
```

### 9.3 Invalidação de sessão
- Ao remover membro: forçar signOut via Supabase Admin API
- Ao trocar senha: invalidar todas as sessões exceto a atual

---

## 10. MÓDULOS — DEFINIÇÃO FINAL

| ID | Nome no menu | Rota | Permissão mínima para ver |
|---|---|---|---|
| `chat` | 💬 Chat | `/chat` | view |
| `flows` | ⚙️ Automações | `/flows` | view |
| `ai_config` | 🤖 IA e Dados | `/ai-config` | view |
| `crm` | 📊 CRM | `/crm` | view |
| `settings` | 🔧 Configurações | `/settings` | qualquer usuário |
| `billing` | 💳 Financeiro | `/settings/billing` | owner only |
