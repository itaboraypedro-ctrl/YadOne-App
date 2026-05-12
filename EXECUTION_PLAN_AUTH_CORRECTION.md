# EXECUTION_PLAN_AUTH_CORRECTION.md
## Yadone — Correção de Auth para Alinhar ao SPEC_AUTH.md v1.1
## Plano de Execução Paralela por Agentes

Leia `SPEC_AUTH_CORRECTION.md` e `SPEC_AUTH.md` antes de executar qualquer agente.

---

## ORDEM DE EXECUÇÃO

```
FASE 1 — SQL (rodar PRIMEIRO, manual no Supabase)
└── AGENTE 1 — SQL de correção

FASE 2 — Tipos e permissões (após SQL aplicado)
├── AGENTE 2 — Tipos TypeScript (role renaming)
└── AGENTE 3 — Server actions corrigidas

FASE 3 — UI (após Fase 2)
├── AGENTE 4 — Sidebar + hooks
└── AGENTE 5 — TeamManager + settings/team

FASE 4 — Validação final
└── AGENTE 6 — tsc + build + commit
```

---

## AGENTE 1 — SQL de Correção (Simples)
**Quando:** PRIMEIRO. Bloqueia todos os outros.
**Tipo:** SQL puro — gerar arquivo, rodar manualmente no Supabase.

```
Leia SPEC_AUTH_CORRECTION.md seções 2.1 completa.

Gere o arquivo supabase/migrations/031_auth_correction.sql com exatamente
o conteúdo das 4 partes da seção 2.1, nesta ordem:

Parte 1 — Corrigir roles:
- ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true em workspace_users
- UPDATE workspace_users SET role = 'professional' WHERE role IN ('member', 'agent')
- DROP e recriar CHECK constraint: role IN ('owner', 'professional')

Parte 2 — Criar tabelas faltantes (nesta ordem exata para respeitar FKs):
1. plan_definitions (sem FK)
2. super_admins
3. professional_permissions (FK para workspace_users)
4. workspace_invites
5. workspace_subscriptions (FK para plan_definitions)
6. message_usage_cycles
7. billing_events
8. admin_impersonations
9. lgpd_deletion_requests

Parte 3 — Migrar dados de permissions jsonb para professional_permissions:
- INSERT INTO professional_permissions mapeando crm e conversas
- DROP COLUMN permissions de workspace_users
- DROP COLUMN invited_by, invited_at, accepted_at de workspace_users
  (esses campos vão para workspace_invites)

Parte 4 — RLS e funções auxiliares:
- CREATE OR REPLACE FUNCTION user_has_workspace_access(target_workspace_id UUID)
- UPDATE get_my_workspace_id() para respeitar is_active = true
- RLS em todas as novas tabelas conforme spec
- Seed de plan_definitions (starter e pro)

Regras:
- Usar IF NOT EXISTS em todas as tabelas
- Usar IF EXISTS em todos os DROPs
- Usar ADD COLUMN IF NOT EXISTS em todos os ALTER TABLE
- Usar DROP POLICY IF EXISTS antes de CREATE POLICY
- Comentário no topo: -- RODAR MANUALMENTE NO SUPABASE SQL EDITOR
- Bloco ROLLBACK comentado no final

Ao terminar: mostrar o SQL completo e aguardar confirmação antes de qualquer
outra ação.
```

---

## AGENTE 2 — Tipos TypeScript (Simples)
**Quando:** após SQL do Agente 1 estar aplicado no Supabase
**Depende de:** Agente 1
**Arquivos exclusivos:** lib/types/frontend.ts, lib/permissions.ts,
lib/permissions-server.ts, hooks/useWorkspacePermissions.ts

```
Leia SPEC_AUTH_CORRECTION.md seção 2.2.

Faça APENAS substituições de tipo — não mude lógica, não mude UI.

1. lib/types/frontend.ts
   - Trocar role: 'owner' | 'agent' → role: 'owner' | 'professional'
   - Trocar qualquer outra referência a 'agent' ou 'member' como role

2. lib/permissions.ts
   - Trocar WorkspaceRole de 'owner' | 'member' | 'agent'
     para 'owner' | 'professional'
   - Remover 'member' e 'agent' do tipo
   - Atualizar DEFAULT_PERMISSIONS se necessário
   - Módulos: as áreas bloqueadas para profissionais são
     flows, ai_config, knowledge_base, billing, settings, team
     Adicionar constante exportada:
     export const AREAS_ALWAYS_BLOCKED_FOR_PROFESSIONAL = [
       'flows', 'ai_config', 'billing', 'settings'
     ] as const

3. lib/permissions-server.ts
   - Tipo de retorno de getWorkspaceRole():
     Promise<'owner' | 'professional' | null>
   - Remover 'member' e 'agent' das verificações
   - Atualizar lógica de isOwner: role === 'owner'
   - hasPermission: profissional nunca acessa AREAS_ALWAYS_BLOCKED_FOR_PROFESSIONAL

4. hooks/useWorkspacePermissions.ts
   - Trocar WorkspaceRole = 'owner' | 'member' | 'agent'
     para 'owner' | 'professional'
   - Atualizar verificação de role nas queries do Supabase

5. lib/auth/api-context.ts
   - Trocar 'agent' → 'professional' em todas as referências
   - Trocar tipo role: 'owner' | 'agent' → 'owner' | 'professional'

6. app/api/auth/me/route.ts
   - Trocar const role: CurrentUser['role'] = data.role === 'owner' ? 'owner' : 'agent'
     para: data.role === 'owner' ? 'owner' : 'professional'

Ao terminar:
- npx tsc --noEmit (só nos arquivos modificados)
- Reportar lista de arquivos e substituições feitas
```

---

## AGENTE 3 — Server Actions Corrigidas (Médio)
**Quando:** após SQL do Agente 1 estar aplicado
**Depende de:** Agente 1
**Arquivos exclusivos:** app/settings/actions.ts, middleware.ts

```
Leia SPEC_AUTH_CORRECTION.md seção 2.2 e SPEC_AUTH.md §2.3.

Corrija app/settings/actions.ts:

1. inviteMember(email, permissions):
   - Em vez de INSERT direto em workspace_users, agora:
     a. INSERT em workspace_invites com token, email, permissions, expires_at
     b. Chamar supabase.auth.admin.inviteUserByEmail() com redirectTo
        apontando para /api/team/invite/[token]/accept
   - Retorna { success, error? }

2. updateMemberPermissions(workspaceUserId, permissions):
   - Em vez de UPDATE workspace_users SET permissions = jsonb
   - Agora: UPSERT em professional_permissions
     WHERE workspace_user_id = workspaceUserId
   - Campos: agenda, crm, conversas, relatorios, produtos
     (mapear de PermissionsMap para os campos da tabela)
   - Bloquear se workspace_user tem role = 'owner'
   - Retorna { success, error? }

3. removeMember(workspaceUserId):
   - Em vez de DELETE, agora:
     UPDATE workspace_users SET is_active = false WHERE id = workspaceUserId
   - Manter o registro para audit trail (LGPD)
   - Ainda invalida sessão do usuário (TODO se API não disponível)
   - Retorna { success, error? }

4. getMemberPermissions(workspaceUserId):
   - Nova action: SELECT de professional_permissions
     WHERE workspace_user_id = workspaceUserId
   - Retorna { permissions: ProfessionalPermissions | null, error? }

Corrija middleware.ts:
- Trocar verificações de role 'agent' e 'member' → 'professional'
- Em rotas owner-only (/settings/workspace, /settings/team, /settings/billing):
  verificar role !== 'owner' (não muda)
- Adicionar verificação: profissionais NÃO acessam rotas bloqueadas:
  /flows, /ai-config, /settings/workspace, /settings/team, /settings/billing
  → redirect /unauthorized

Ao terminar:
- npx tsc --noEmit
- Reportar o que mudou em cada action
```

---

## AGENTE 4 — Sidebar + Hooks UI (Simples)
**Quando:** após Agente 2 terminar
**Depende de:** Agente 2 (tipos atualizados)
**Arquivos exclusivos:** components/layout/Sidebar.tsx,
components/settings/SettingsSubNav.tsx, components/layout/SidebarItem.tsx

```
Leia SPEC_AUTH_CORRECTION.md seção 2.2.

Faça APENAS substituições de tipo e role — não mude layout, não mude visual.

1. components/layout/Sidebar.tsx
   - Trocar type WorkspaceRole = 'owner' | 'member' | 'agent'
     para 'owner' | 'professional'
   - Atualizar verificação:
     wuRaw?.role === 'owner' || wuRaw?.role === 'member' || wuRaw?.role === 'agent'
     para:
     wuRaw?.role === 'owner' || wuRaw?.role === 'professional'
   - Buscar permissões agora via professional_permissions (JOIN com workspace_users)
     em vez de workspace_users.permissions jsonb
   - Para owner: permission level = 'edit' em todos os módulos
   - Para professional: buscar da tabela professional_permissions
     mapeando: conversas → chat, crm → crm, resto → 'none' por padrão

2. components/settings/SettingsSubNav.tsx
   - Trocar type Role = 'owner' | 'member' | 'agent' | null
     para 'owner' | 'professional' | null

3. components/layout/SidebarItem.tsx
   - Sem mudança de tipo necessária (usa PermissionLevel que já é correto)
   - Verificar se há referência a 'agent' ou 'member' e trocar

Ao terminar:
- npx tsc --noEmit nos arquivos modificados
- Reportar substituições
```

---

## AGENTE 5 — TeamManager Corrigido (Complexo)
**Quando:** após Agentes 2 e 3 terminarem
**Depende de:** Agente 2 (tipos), Agente 3 (actions)
**Arquivos exclusivos:** components/settings/TeamManager.tsx,
app/(app)/settings/team/page.tsx

```
Leia SPEC_AUTH_CORRECTION.md seção 2.2 e SPEC_AUTH.md §2.3.

Corrija components/settings/TeamManager.tsx:

1. Tipo Member:
   - Trocar role: 'owner' | 'member' | 'agent' → 'owner' | 'professional'
   - Adicionar campo permissions de professional_permissions:
     { agenda, crm, conversas, relatorios, produtos }
     cada um com type 'none' | 'view' | 'edit'

2. Modal de permissões:
   - As áreas configuráveis são: agenda, crm, conversas, relatorios, produtos
     (NÃO mais: chat, flows, ai_config, crm, settings)
   - Áreas sempre bloqueadas NÃO aparecem no modal:
     flows, agent, knowledge_base, billing, settings, team
   - Atualizar labels PT-BR:
     agenda → "Agenda"
     crm → "CRM"
     conversas → "Conversas"
     relatorios → "Relatórios"
     produtos → "Produtos"
   - Botão Salvar chama updateMemberPermissions() com o novo formato

3. Convidar membro:
   - Após confirmar permissões no modal, chama inviteMember()
   - Membro aparece com badge "Convite enviado" (não "Convite pendente")
   - Email enviado via Supabase Auth invite

4. Remover membro:
   - Chama removeMember() que agora desativa (is_active = false)
   - Texto do confirm dialog: "Tem certeza? {nome} perderá acesso imediatamente."

Corrija app/(app)/settings/team/page.tsx:

1. Buscar professional_permissions junto com workspace_users:
   SELECT wu.*, pp.*
   FROM workspace_users wu
   LEFT JOIN professional_permissions pp ON pp.workspace_user_id = wu.id
   WHERE wu.workspace_id = [my_workspace_id]
     AND wu.is_active = true

2. Montar objeto Member com permissões já populadas

3. Trocar cast de role para 'owner' | 'professional'

Ao terminar:
- npx tsc --noEmit nos arquivos modificados
- Reportar o que mudou
```

---

## AGENTE 6 — Validação Final + Commit (Médio)
**Quando:** APÓS todos os agentes anteriores terminarem
**Depende de:** todos

```
Faça a validação final do projeto.

1. Verificar que não existe NENHUMA referência a 'agent' ou 'member'
   como role no código da aplicação:

   grep -r "'agent'\|'member'" app/ components/ hooks/ lib/ \
     --include="*.ts" --include="*.tsx" | grep -v node_modules

   Se encontrar alguma, corrigir para 'professional'.

2. Verificar que não existe NENHUMA referência a permissions jsonb
   em workspace_users no código:

   grep -r "workspace_users.*permissions\|permissions.*workspace_users" \
     app/ components/ hooks/ lib/ --include="*.ts" --include="*.tsx" \
     | grep -v node_modules

3. Rodar type-check completo:
   npx tsc --noEmit
   Corrigir TODOS os erros.

4. Rodar build:
   npm run build
   Corrigir erros de build.

5. Commit semântico:
   git add -A
   git commit -m "fix(auth): alinhar roles e permissões ao SPEC_AUTH.md v1.1

   - Role 'agent'/'member' → 'professional' no banco e em todo o código
   - Tabelas criadas: super_admins, professional_permissions, workspace_invites,
     workspace_subscriptions, message_usage_cycles, billing_events,
     admin_impersonations, lgpd_deletion_requests, plan_definitions
   - permissions jsonb migrado de workspace_users → professional_permissions
   - Áreas configuráveis: agenda, crm, conversas, relatorios, produtos
   - Áreas sempre bloqueadas para professional: flows, ai_config, billing,
     settings, team
   - Função user_has_workspace_access() adicionada (multi-workspace aware)
   - get_my_workspace_id() atualizado para respeitar is_active = true
   - inviteMember agora usa workspace_invites + token
   - removeMember agora desativa (is_active = false) em vez de deletar
   - Seed: plan_definitions com planos starter e pro"

6. git push origin main

Reportar: lista de arquivos modificados e resultado do build.
```

---

## CHECKLIST MANUAL APÓS EXECUÇÃO

**No Supabase SQL Editor:**
- [ ] Rodar 031_auth_correction.sql
- [ ] Verificar que workspace_users não tem mais coluna permissions
- [ ] Verificar que professional_permissions existe com os campos corretos
- [ ] Verificar que role CHECK aceita apenas 'owner' e 'professional'
- [ ] Verificar policies em Authentication → Policies nas novas tabelas

**No app:**
- [ ] Login funciona normalmente
- [ ] Sidebar aparece com módulos corretos
- [ ] /settings/team mostra membros com permissões corretas
- [ ] Modal de permissões mostra: Agenda, CRM, Conversas, Relatórios, Produtos
- [ ] Profissional não consegue acessar /flows ou /settings/team
- [ ] Convidar membro envia email com link de aceite
