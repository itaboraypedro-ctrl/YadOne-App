# EXECUTION_PLAN_AUTH_SETTINGS.md
## Yadone — Auth, Logoff, Menu e Configurações de Conta
## Plano de Execução Paralela por Agentes

Leia o arquivo `SPEC_AUTH_ACCOUNT_SETTINGS.md` antes de executar qualquer agente.

---

## ORDEM DE EXECUÇÃO

```
FASE 1 — Banco + RLS (rodar PRIMEIRO, antes de qualquer código)
└── AGENTE 1 (SQL puro, simples)

FASE 2 — Backend + Auth (após FASE 1)
├── AGENTE 2 (logoff + proteção de rotas)
└── AGENTE 3 (server actions de configurações)

FASE 3 — UI (pode rodar em paralelo após FASE 1)
├── AGENTE 4 (sidebar + menu lateral)
├── AGENTE 5 (settings/profile + settings/security)
└── AGENTE 6 (settings/workspace + settings/team)

FASE 4 — Integração + type-check (após todas as fases)
└── AGENTE 7 (wiring final + tsc + build)
```

**IMPORTANTE:** A FASE 1 precisa rodar antes das outras.
O SQL gerado pelo Agente 1 deve ser executado manualmente no Supabase SQL Editor antes de lançar os demais agentes.

---

## AGENTE 1 — RLS e Banco de Dados (Simples)
**Quando:** PRIMEIRO. Bloqueia todos os outros.
**Tipo:** SQL puro, sem código de aplicação.

```
Leia o arquivo SPEC_AUTH_ACCOUNT_SETTINGS.md, seções 2 e 3.

Gere um único arquivo SQL: supabase/migrations/005_rls_and_auth.sql

O arquivo deve conter, nesta ordem:

1. Criar função get_my_workspace_id() conforme spec seção 3.2
2. Criar função is_workspace_owner() conforme spec seção 3.2
3. Habilitar RLS e criar policies para cada tabela conforme spec seção 3.3:
   - clients, messages, client_memory, client_episodic_memory,
     appointments, crm_events (isolamento por workspace)
   - flows, flow_nodes, flow_edges, flow_snapshots, flow_tool_policies,
     channel_configs, workspace_agent_config (isolamento por workspace)
   - knowledge_base, knowledge_chunks (isolamento por workspace)
   - daily_metrics, usage_metrics (isolamento por workspace)
   - workspace_cost_caps (owner only)
   - audit_logs (owner read, service_role insert)
4. Verificar se workspace_users tem campo permissions JSONB — adicionar se faltar
5. Verificar se workspace_users tem campo role text — adicionar se faltar
6. Criar tabela user_profiles se não existir (spec seção 2.5)
7. Adicionar campo lgpd_consent_at em workspaces se não existir

Importante:
- Usar IF NOT EXISTS em tudo
- Usar IF EXISTS antes de DROP
- Cada ALTER TABLE com IF NOT EXISTS no ADD COLUMN
- Nunca deletar dados existentes
- Adicionar comentário no topo: "-- RODAR MANUALMENTE NO SUPABASE SQL EDITOR"

Não crie nenhum arquivo .ts ou .tsx. Só SQL.
Ao terminar mostre o SQL completo e aguarde confirmação.
```

---

## AGENTE 2 — Logoff + Proteção de Rotas (Simples/Médio)
**Quando:** após SQL do Agente 1 estar aplicado no Supabase
**Depende de:** Agente 1

```
Leia o arquivo SPEC_AUTH_ACCOUNT_SETTINGS.md, seções 4 e 9.3.

Implemente:

1. app/api/auth/logout/route.ts
   - POST handler
   - Chama supabase.auth.signOut() server-side via createRouteHandlerClient
   - Limpa cookies
   - Retorna redirect para /login
   - Se já existir esse arquivo, verificar se está correto e ajustar

2. Proteção de rotas no middleware/proxy existente
   - Verificar qual arquivo faz proteção de rotas hoje (middleware.ts ou proxy.ts)
   - Adicionar proteção para:
     /settings/* → requer usuário autenticado
     /settings/workspace → requer role = owner em workspace_users
     /settings/team → requer role = owner
     /settings/billing → requer role = owner
   - Se não autenticado: redirect /login
   - Se não é owner: redirect /unauthorized

3. Verificar se página /unauthorized existe — se não, criar página simples:
   "Você não tem permissão para acessar esta área."
   com link de volta ao dashboard

Ao terminar: npx tsc --noEmit nos arquivos criados/modificados.
```

---

## AGENTE 3 — Server Actions de Configurações (Médio)
**Quando:** após SQL do Agente 1 estar aplicado
**Depende de:** Agente 1

```
Leia o arquivo SPEC_AUTH_ACCOUNT_SETTINGS.md, seções 6 e 8.

Crie o arquivo app/settings/actions.ts com as seguintes server actions:

1. updateProfile(data: { full_name, phone, avatar_url })
   - Auth check
   - Upsert em user_profiles WHERE id = auth.uid()
   - Retorna { success, error }

2. updateWorkspace(data: { name, logo_url })
   - Auth check + owner check
   - Update em workspaces WHERE id = workspace_id AND owner_id = user_id
   - Retorna { success, error }

3. inviteMember(email: string, permissions: PermissionsMap)
   - Auth check + owner check
   - Verifica se email já é membro
   - Chama supabase.auth.admin.inviteUserByEmail() via service_role
   - INSERT em workspace_users com role='member', permissions, status='pending'
   - Retorna { success, error }

4. updateMemberPermissions(memberId: string, permissions: PermissionsMap)
   - Auth check + owner check
   - Nunca permite alterar permissões do próprio owner
   - UPDATE workspace_users SET permissions = $permissions
     WHERE id = memberId AND workspace_id = workspace_id
   - Retorna { success, error }

5. removeMember(memberId: string)
   - Auth check + owner check
   - Nunca permite remover o owner
   - DELETE workspace_users WHERE id = memberId
   - Chamar supabase.auth.admin.signOut(userId) via service_role para invalidar sessão
   - Retorna { success, error }

6. changePassword(currentPassword: string, newPassword: string)
   - Verificar senha atual via signInWithPassword
   - Se válida: updateUser({ password: newPassword })
   - Retorna { success, error }

7. getActiveSessions()
   - Retorna lista de sessões ativas do usuário via admin API
   - Retorna { sessions[], error }

8. revokeOtherSessions()
   - Invalida todas as sessões exceto a atual
   - Retorna { success, error }

Criar também lib/permissions.ts com:
- Tipo PermissionsMap
- Função hasPermission(userId, module, level) → boolean
- Função getWorkspaceRole(userId) → 'owner' | 'member' | null
- Constante MODULES com os 5 módulos

Ao terminar: npx tsc --noEmit
```

---

## AGENTE 4 — Sidebar + Menu Lateral (Médio)
**Quando:** pode rodar em paralelo com Agentes 2 e 3
**Depende de:** Agente 1 (SQL aplicado)

```
Leia o arquivo SPEC_AUTH_ACCOUNT_SETTINGS.md, seções 5 e 10.

Implemente o menu lateral (sidebar) do app:

1. Identificar onde está o layout principal do app autenticado
   (provavelmente app/(dashboard)/layout.tsx ou similar)
   Ler esse arquivo antes de criar qualquer componente.

2. components/sidebar/AppSidebar.tsx
   - Logo Yadone no topo
   - Nome do workspace abaixo da logo
   - Lista de módulos com ícones (spec seção 5.1)
   - Cada item verifica permissão antes de renderizar:
     owner → vê todos
     member → vê apenas módulos com permissions != "none"
   - Rodapé: avatar + nome do usuário + botão "Sair"

3. components/sidebar/SidebarItem.tsx
   - Props: { icon, label, href, permission: 'none'|'view'|'edit'|'owner' }
   - Se permission = 'none': não renderiza
   - Se permission = 'view': renderiza com badge "Somente leitura"
   - Highlight na rota ativa

4. components/sidebar/LogoutButton.tsx
   - Botão "Sair" no rodapé do sidebar
   - Chama POST /api/auth/logout
   - Loading state durante o logout
   - Após logout: router.push('/login')

5. Hook: hooks/useWorkspacePermissions.ts
   - Retorna { role, permissions, isOwner, can(module, level) }
   - Busca dados de workspace_users via Supabase client
   - Memoizado para não refazer query em cada render

Itens do menu e rotas:
- 💬 Chat → /chat → módulo 'chat'
- ⚙️ Automações → /flows → módulo 'flows'
- 🤖 IA e Dados → /ai-config → módulo 'ai_config'
- 📊 CRM → /crm → módulo 'crm'
- 🔧 Configurações → /settings → qualquer usuário autenticado
- 💳 Financeiro (sub-item de Config) → /settings/billing → owner only

Visual: manter design system existente do projeto (cores, fontes, bordas).
Não inventar design novo.

Ao terminar: npx tsc --noEmit
```

---

## AGENTE 5 — Settings: Perfil + Segurança (Simples/Médio)
**Quando:** pode rodar em paralelo com Agentes 2, 3 e 4
**Depende de:** Agente 3 (server actions) — pode usar stubs se necessário

```
Leia o arquivo SPEC_AUTH_ACCOUNT_SETTINGS.md, seções 6.2 e 6.5.

Crie as páginas:

1. app/settings/page.tsx
   - Redirect para /settings/profile

2. app/settings/profile/page.tsx
   - Server component: busca dados atuais do user_profiles
   - Renderiza ProfileForm (client component)

3. components/settings/ProfileForm.tsx (client)
   - Campos: Nome completo, Telefone, Avatar (upload)
   - Email em somente leitura com link "Alterar em Segurança →"
   - Submit chama server action updateProfile()
   - Toast de sucesso/erro após submit
   - Loading state no botão

4. app/settings/security/page.tsx
   - Server component

5. components/settings/SecurityForm.tsx (client)
   - Seção "Trocar senha":
     inputs: senha atual, nova senha, confirmar nova senha
     validação client-side: nova === confirmar
     submit chama changePassword()
   - Seção "Sessões ativas":
     lista de sessões (dispositivo, IP, data)
     botão "Encerrar outras sessões" chama revokeOtherSessions()
   - Toast de sucesso/erro

Layout de todas as páginas /settings/*:
- Sidebar esquerda com sub-navegação:
  Perfil | Organização | Equipe | Segurança | Financeiro
  (Organização, Equipe e Financeiro só aparecem para owner)
- Conteúdo à direita

Ao terminar: npx tsc --noEmit
```

---

## AGENTE 6 — Settings: Workspace + Equipe (Complexo)
**Quando:** pode rodar em paralelo com Agentes 2, 3, 4 e 5
**Depende de:** Agente 3 (server actions)

```
Leia o arquivo SPEC_AUTH_ACCOUNT_SETTINGS.md, seções 6.3, 6.4 e 8.

Crie:

1. app/settings/workspace/page.tsx
   - Server component: verifica se é owner (redirect /unauthorized se não)
   - Busca dados do workspace atual
   - Renderiza WorkspaceForm

2. components/settings/WorkspaceForm.tsx (client)
   - Campos: nome da organização, upload de logo
   - CNPJ em somente leitura
   - Submit chama updateWorkspace()
   - Toast de sucesso/erro

3. app/settings/team/page.tsx
   - Server component: verifica se é owner
   - Busca lista de workspace_users com dados de auth.users (via service_role server-side)
   - Renderiza TeamManager

4. components/settings/TeamManager.tsx (client)
   Lista de membros:
   - Para cada membro: avatar, nome, email, role badge, botão "Permissões", botão "Remover"
   - Membros pendentes (sem accepted_at) mostram badge "Convite pendente"
   - Owner aparece no topo com badge "Proprietário" sem botões de ação

   Modal de permissões (abre ao clicar em "Permissões"):
   - Tabela com 5 módulos × 3 opções (Sem acesso / Visualizar / Editar)
   - Radio buttons por linha
   - Financeiro NÃO aparece nessa lista (nunca para membros)
   - Botão "Salvar" chama updateMemberPermissions()

   Adicionar membro:
   - Input de email + botão "Convidar"
   - Após clicar: modal de permissões ANTES de enviar o convite
   - Confirmar envia o convite via inviteMember()
   - Toast de sucesso com "Convite enviado para email@..."

   Remover membro:
   - Botão "Remover" abre confirm dialog:
     "Tem certeza? [nome] perderá acesso imediatamente."
   - Confirmar chama removeMember()
   - Remove da lista sem reload (optimistic update)

5. app/settings/billing/page.tsx
   - Server component: verifica se é owner
   - Renderiza placeholder:
     Título: "Financeiro"
     Texto: "Gerencie sua assinatura Yadone. Em breve disponível nesta área."
     Info atual: plano ativo, data de início

Ao terminar: npx tsc --noEmit
```

---

## AGENTE 7 — Integração Final + Validação (Médio)
**Quando:** APÓS todos os outros agentes terminarem
**Depende de:** todos

```
Leia o arquivo SPEC_AUTH_ACCOUNT_SETTINGS.md completo.

Faça a integração final:

1. Verificar que o layout do app autenticado importa AppSidebar corretamente
2. Verificar que todas as páginas /settings/* estão no grupo de rotas correto
3. Verificar que o hook useWorkspacePermissions está sendo usado na Sidebar
4. Verificar que as server actions em app/settings/actions.ts estão importadas
   corretamente nas páginas/componentes

5. Rodar type-check completo:
   npx tsc --noEmit
   Corrigir TODOS os erros antes de continuar.

6. Rodar build:
   npm run build
   Corrigir erros de build.

7. Checklist de segurança — verificar manualmente:
   □ SUPABASE_SERVICE_ROLE_KEY só usada em server-side (api routes, server actions)
   □ Nenhuma query de clients/messages sem filtro workspace_id
   □ Todas as server actions têm auth check no início
   □ Middleware/proxy protege /settings/* corretamente
   □ LogoutButton faz POST (não GET) para /api/auth/logout

8. Listar todos os arquivos criados/modificados em todos os agentes.

9. Gerar commit semântico:
   feat(auth): logoff, sidebar, configurações de conta e RLS multi-tenant

   - RLS em todas as tabelas com isolamento por workspace
   - Logoff server-side com invalidação de cookie
   - Sidebar com permissões por módulo (owner/member)
   - /settings com perfil, segurança, organização e equipe
   - Convite e gestão de membros com permissões granulares
   - LGPD: dados de pacientes isolados por workspace
```

---

## CHECKLIST FINAL (após tudo pronto)

**No Supabase (manual):**
- [ ] SQL do Agente 1 rodado no SQL Editor
- [ ] Verificar que policies aparecem em Authentication → Policies
- [ ] Testar com 2 usuários de workspaces diferentes — confirmar que não veem dados um do outro

**No app:**
- [ ] Logoff funciona e redireciona para /login
- [ ] Menu lateral aparece com os módulos corretos por role
- [ ] Settings/profile salva corretamente
- [ ] Settings/team consegue convidar e configurar permissões
- [ ] Membro com permissão "view" não consegue editar
- [ ] Membro sem permissão não consegue acessar a rota

**Deploy:**
- [ ] npm run build passa sem erro
- [ ] git push origin main
- [ ] Vercel redeploy automático
