# IMPLEMENTATION_PLAN_AUTH_GAPS.md
# Gaps e tarefas adicionais identificados na revisão crítica

> **Spec de referência:** SPEC_AUTH.md v1.1  
> **Plan principal:** IMPLEMENTATION_PLAN_AUTH.md  
> **Total de gaps identificados:** 10  
> **Tarefas adicionais:** A15-A22 (8 tarefas)  
> **Ajustes em tarefas existentes:** A05, A07, A09, A12, A13

---

## Como usar este documento

Este arquivo lista os **gaps identificados** entre o spec original (v1.0) e a versão corrigida (v1.1), e adiciona tarefas que não estavam no plano principal.

**Antes de executar o plano:**
1. Leia o IMPLEMENTATION_PLAN_AUTH.md primeiro
2. Leia este arquivo para entender as adições e ajustes
3. Adicione as tarefas A15-A22 ao seu STATUS.md
4. Aplique os ajustes nas tarefas existentes (descritos abaixo)

---

## Resumo dos Gaps

| # | Gap | Severidade | Solução |
|---|---|---|---|
| 1 | Onboarding sem estado persistido | Alta | A15 + ajuste A05 |
| 2 | Status do workspace não checado em endpoints | **Crítica** | Ajuste A06 + verificação em todos endpoints |
| 3 | Cancelamento e LGPD ausentes | **Crítica** | A16 + A17 |
| 4 | Reset mensal sem job + ciclo confuso | Alta | A18 |
| 5 | Multi-workspace por usuário não tratado | Média | A19 |
| 6 | Stripe Customer Portal incompleto | Média | A20 |
| 7 | Webhook fora de ordem | Alta | Ajuste A07 |
| 8 | RLS incompleto | **Crítica** | Ajuste A01 |
| 9 | Race condition no checkout | **Crítica** | Ajuste A07 |
| 10 | Super Admin sem 2FA | Alta | A21 |

**Bônus:**
- A22 — Decomposição da A09 em sub-tarefas (recomendação metodológica)

---

## Tarefas Adicionais (A15-A22)

---

### A15 — Onboarding com estado persistido (gap #1)
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/auth-onboarding-state`  
**Bloco proposto:** Bloco 3 (junto com A05)  
**Pode rodar com:** A05, A06

**Por quê esta tarefa existe:**
A v1.0 tratava onboarding como linear sem permitir resume. Se Owner fechasse a aba no meio, perdia tudo. O Stripe pode demorar 30+ segundos para confirmar pagamento, e o usuário pode mudar de ideia.

**O que fazer:**
Implementar onboarding com estado persistido permitindo resume e skip.

**Entregáveis:**
- Adicionar coluna `onboarding_status` em workspaces (já está em A01 v1.1)
- `/lib/onboarding/resume-handler.ts` — determina próximo passo baseado no estado
- `/app/onboarding/agent/page.tsx` — passo 1 (configurar persona)
- `/app/onboarding/whatsapp/page.tsx` — passo 2 (QR Code)
- `/app/onboarding/product/page.tsx` — passo 3 (primeiro produto)
- `/app/api/onboarding/skip/[step]/route.ts` — POST pula um passo
- `/app/api/onboarding/complete/[step]/route.ts` — POST marca passo como concluído
- `/components/onboarding/skip-banner.tsx` — banner persistente no dashboard quando algo foi pulado

**Lógica do resume:**
```typescript
// Middleware verifica onboarding_status no login
const workspace = await getWorkspace(req)

switch (workspace.onboarding_status) {
  case 'agent_pending':    return redirect('/onboarding/agent')
  case 'whatsapp_pending': return redirect('/onboarding/whatsapp')
  case 'product_pending':  return redirect('/onboarding/product')
  case 'complete':         return // segue normal
}

// Cada passo tem botão "Pular por agora":
// → POST /api/onboarding/skip/agent → onboarding_status avança
// → marca skipped_steps no workspace para mostrar banner
```

**Critério de conclusão:**
- Owner fecha aba no passo 2 → ao logar de novo cai no passo 2
- Pular passo → banner aparece no dashboard com link
- Concluir todos → onboarding_status = 'complete'

---

### A16 — Cancelamento de assinatura e estados estendidos (gap #3)
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/auth-cancellation`  
**Bloco proposto:** Bloco 4 (junto com A07)  
**Depende de:** A07

**Por quê:**
v1.0 não tinha endpoint de cancelamento, não tratava `cancel_at_period_end`, e não definia o que acontece com dados após cancelar.

**O que fazer:**
Implementar cancelamento pelo Owner via Stripe Portal e estados estendidos do workspace.

**Entregáveis:**
- `/app/api/billing/cancel/route.ts` — POST cancela (chama Stripe API)
- `/app/api/billing/reactivate/route.ts` — POST reverte cancelamento
- Editar `/app/api/billing/webhook/route.ts` — adicionar handler `customer.subscription.updated` para `cancel_at_period_end`
- `/app/settings/billing/cancel-modal.tsx` — modal de confirmação de cancelamento
- `/components/billing/cancellation-banner.tsx` — banner no dashboard quando cancel_at_period_end=true

**Webhook handler novo:**
```typescript
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  // Detecta mudança em cancel_at_period_end
  if (sub.cancel_at_period_end) {
    await updateSubscription(workspace_id, {
      cancel_at_period_end: true,
      cancelled_at: new Date()
    })
    await sendEmail('cancellation_scheduled', ownerEmail, {
      end_date: sub.current_period_end
    })
  } else {
    // Reativação (cliente desistiu de cancelar)
    await updateSubscription(workspace_id, {
      cancel_at_period_end: false,
      cancelled_at: null
    })
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await updateWorkspace(workspace_id, { status: 'cancelled' })
  await sendEmail('cancellation_effective', ownerEmail)
  // Bot para de responder automaticamente (motor verifica status)
}
```

**Critério de conclusão:**
- Owner cancela → workspace permanece active até fim do período
- Banner aparece com data do encerramento
- Owner reativa antes do fim → banner some
- Fim do período → status='cancelled', bot para

---

### A17 — LGPD: exportação e exclusão de dados (gap #3)
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/auth-lgpd`  
**Bloco proposto:** Bloco 6 (junto com testes)  
**Depende de:** A16

**Por quê:**
LGPD Art. 18 garante ao titular o direito de exclusão dos dados. Sem isso, sistema está em violação legal no Brasil.

**O que fazer:**
Implementar fluxo de solicitação de exclusão LGPD + job de anonimização automática após 90 dias.

**Entregáveis:**
- `/app/api/account/export-data/route.ts` — exporta JSON com todos os dados do workspace
- `/app/api/account/delete-data/route.ts` — POST cria solicitação + envia email
- `/app/api/account/delete-confirm/[token]/route.ts` — GET confirma exclusão
- `/app/account/delete-confirmation/page.tsx` — UI de confirmação
- `/lib/lgpd/anonymizer.ts` — função que anonimiza um workspace
- `/app/api/jobs/anonymize-cancelled/route.ts` — job diário
- Email template `lgpd_confirmation` + `lgpd_completed`

**Lógica de anonimização:**
```typescript
async function anonymizeWorkspace(workspace_id: string) {
  await db.transaction(async (tx) => {
    // 1. Mensagens: substitui content
    await tx.execute(`UPDATE messages SET content='[REMOVIDO_LGPD]', media_url=NULL, media_transcription=NULL WHERE workspace_id=$1`, [workspace_id])
    
    // 2. Clients: hasheia PII
    await tx.execute(`
      UPDATE clients SET 
        phone = encode(sha256(phone::bytea), 'hex'),
        name = '[REMOVIDO_LGPD]',
        email = NULL,
        notes = NULL
      WHERE workspace_id=$1
    `, [workspace_id])
    
    // 3. Memórias: deleta
    await tx.execute(`DELETE FROM client_memory WHERE workspace_id=$1`, [workspace_id])
    await tx.execute(`DELETE FROM client_episodic_memory WHERE workspace_id=$1`, [workspace_id])
    
    // 4. Workspace: marca
    await tx.execute(`UPDATE workspaces SET status='deleted', name='[REMOVIDO_LGPD]' WHERE id=$1`, [workspace_id])
    
    // 5. Audit log permanente
    await tx.execute(`INSERT INTO audit_logs (event_type, workspace_id, payload) VALUES ('lgpd.anonymized', $1, $2)`, [workspace_id, { reason: 'request' | 'auto_90_days' }])
  })
}
```

**Job diário de anonimização automática:**
```typescript
// /api/jobs/anonymize-cancelled
async function GET(req) {
  if (req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) return 401
  
  const cancelled90DaysAgo = await getWorkspacesCancelledBefore(90)
  
  for (const ws of cancelled90DaysAgo) {
    await anonymizeWorkspace(ws.id)
  }
  
  return Response.json({ anonymized: cancelled90DaysAgo.length })
}
```

**Critério de conclusão:**
- Owner solicita exclusão → email enviado em 5 segundos
- Token expira em 24h
- Após confirmar → workspace anonimizado em transação
- Job diário processa workspaces cancelados há 90+ dias

---

### A18 — Job de reset de ciclos de mensagem (gap #4)
**Agente:** Claude Haiku  
**Effort:** Médio  
**Branch:** `task/auth-message-cycles`  
**Bloco proposto:** Bloco 6 (paralelo com A11/A12)  
**Depende de:** A08

**Por quê:**
v1.0 dizia "5k/10k por mês" mas não definia se era mês calendário ou mês de assinatura. Sem job de reset, contador acumula infinitamente.

**O que fazer:**
Implementar ciclos de mensagem alinhados com a assinatura Stripe.

**Entregáveis:**
- Editar A08 — substituir `monthly_message_usage` (calendário) por `message_usage_cycles` (assinatura)
- `/app/api/jobs/reset-message-cycles/route.ts` — job diário
- `/lib/billing/cycle-manager.ts` — getCurrentCycle, createNextCycle
- Atualizar A07 — webhook checkout cria primeiro ciclo na transação

**Lógica de criação de ciclo:**
```typescript
async function createNextCycle(workspace_id: string, currentCycleEnd: Date) {
  const sub = await getSubscription(workspace_id)
  const anchorDay = sub.subscription_anchor_day  // ex: 20
  
  // Próximo ciclo começa onde o atual terminou
  const cycleStart = currentCycleEnd
  
  // cycleEnd = mesmo dia do mês seguinte, com tratamento de meses curtos
  let cycleEnd = addMonths(cycleStart, 1)
  
  // Tratamento: se anchor_day=31 e mês tem 30 dias → último dia do mês
  const lastDayOfMonth = endOfMonth(cycleEnd)
  if (anchorDay > getDate(lastDayOfMonth)) {
    cycleEnd = lastDayOfMonth
  }
  
  await createCycle({ workspace_id, cycle_start: cycleStart, cycle_end: cycleEnd })
}
```

**Job diário:**
```typescript
// /api/jobs/reset-message-cycles (00:05 UTC)
async function GET(req) {
  const expiredCycles = await getCyclesEndedBefore(now)
  
  for (const cycle of expiredCycles) {
    await db.transaction(async (tx) => {
      await tx.markCycleNotCurrent(cycle.id)
      await createNextCycle(cycle.workspace_id, cycle.cycle_end)
    })
  }
  
  return Response.json({ rotated: expiredCycles.length })
}
```

**Critério de conclusão:**
- Workspace com cycle_end < now → novo ciclo criado, antigo marcado is_current=false
- Cliente assinou 31/jan → ciclo de fevereiro termina dia 28
- Cliente assinou 31/jan → ciclo de março termina dia 31

---

### A19 — Multi-workspace selector (gap #5)
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/auth-multi-workspace`  
**Bloco proposto:** Bloco 3 (junto com A06)  
**Pode rodar com:** A06

**Por quê:**
v1.0 não tratava o caso de Maria trabalhar em 2 barbearias. O schema permitia, mas não tinha UI nem lógica.

**O que fazer:**
Implementar seletor de workspace e troca rápida.

**Entregáveis:**
- `/app/select-workspace/page.tsx` — tela de seleção pós-login
- `/app/api/auth/workspaces/route.ts` — GET lista workspaces do user
- `/app/api/auth/select-workspace/route.ts` — POST define active_workspace_id
- `/components/header/workspace-switcher.tsx` — dropdown no header para troca rápida
- Editar middleware — usar active_workspace_id do cookie como contexto

**Fluxo de login:**
```typescript
// Após autenticar
const workspaces = await getUserWorkspaces(user_id)

if (workspaces.length === 0) {
  // User sem workspace = caso anormal, redireciona para signup
  return redirect('/signup')
}

if (workspaces.length === 1) {
  // 1 workspace = redireciona direto e seta cookie
  setCookie('active_workspace_id', workspaces[0].id)
  return redirect('/dashboard')
}

// 2+ workspaces = seletor
return redirect('/select-workspace')
```

**Workspace switcher (header):**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Avatar src={activeWorkspace.logo} />
    <span>{activeWorkspace.name}</span>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {userWorkspaces.map(ws => (
      <DropdownMenuItem 
        onClick={() => switchWorkspace(ws.id)}
        active={ws.id === activeWorkspace.id}
      >
        {ws.name}
      </DropdownMenuItem>
    ))}
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={logout}>Sair</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Critério de conclusão:**
- User com 1 workspace → login direto para /dashboard
- User com 2+ workspaces → /select-workspace mostra todos
- Trocar workspace pelo header → recarrega página com novo contexto
- Cookie active_workspace_id atualizado

---

### A20 — Stripe Customer Portal completo (gap #6)
**Agente:** Claude Haiku  
**Effort:** Baixo  
**Branch:** `task/auth-stripe-portal`  
**Bloco proposto:** Bloco 4 (junto com A07)  
**Pode rodar com:** A07, A08

**Por quê:**
v1.0 mencionava /api/billing/portal mas não detalhava configuração. Customer Portal precisa ser configurado no Dashboard Stripe.

**O que fazer:**
Configurar Customer Portal e implementar a integração.

**Entregáveis:**
- `/app/api/billing/portal/route.ts` — POST cria session do Portal
- `/app/settings/billing/page.tsx` — botão "Gerenciar assinatura" → Portal
- `/docs/stripe-portal-setup.md` — passos manuais no Dashboard Stripe

**Stripe Portal config (manual):**
```
Stripe Dashboard → Settings → Customer Portal → Configurations
- Permite: atualizar cartão, ver histórico de faturas, cancelar
- Não permite: trocar de plano (fase 2)
- Após cancelar: redireciona para [APP_URL]/billing/cancelled
- Após atualizar pagamento: [APP_URL]/billing/updated
```

**Endpoint:**
```typescript
async function POST(req) {
  const { workspace } = await getWorkspace(req)
  const sub = await getSubscription(workspace.id)
  
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${APP_URL}/settings/billing`
  })
  
  return Response.json({ url: session.url })
}
```

**Critério de conclusão:**
- Owner clica "Gerenciar assinatura" → abre Customer Portal
- Atualiza cartão lá → webhook payment_method.attached recebido
- Cancela lá → webhook subscription.updated com cancel_at_period_end=true

---

### A21 — 2FA obrigatório para Super Admin (gap #10)
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/auth-2fa`  
**Bloco proposto:** Bloco 5 (junto com A10)  
**Depende de:** A10

**Por quê:**
Super Admin tem acesso a todos os workspaces. Email/senha apenas é insuficiente para esse nível.

**O que fazer:**
Implementar TOTP (Time-based One-Time Password) obrigatório para super admins.

**Entregáveis:**
- `/lib/auth/totp.ts` — generateSecret, verifyCode, generateBackupCodes
- `/lib/auth/encryption.ts` — encrypt/decrypt com AES-256-GCM
- `/app/admin/setup-2fa/page.tsx` — tela de setup com QR code
- `/app/admin/2fa-verify/page.tsx` — tela de verificação no login
- `/app/api/admin/2fa/setup/route.ts` — POST inicia setup
- `/app/api/admin/2fa/verify-setup/route.ts` — POST confirma setup
- `/app/api/admin/2fa/verify/route.ts` — POST verifica TOTP no login
- Editar middleware — verificar totp_verified na sessão

**Stack:**
```bash
npm install otplib qrcode
```

**Setup flow:**
```typescript
// POST /api/admin/2fa/setup
async function setup2FA(super_admin_id: string) {
  const secret = authenticator.generateSecret()
  const qrCodeUrl = authenticator.keyuri(email, 'YadOne Admin', secret)
  
  // Salva temporariamente (não confirmado ainda)
  await savePendingSetup(super_admin_id, secret)
  
  return { qr_code: qrCodeUrl, manual_secret: secret }
}

// POST /api/admin/2fa/verify-setup
async function verifySetup(super_admin_id: string, code: string) {
  const pending = await getPendingSetup(super_admin_id)
  
  if (!authenticator.verify({ token: code, secret: pending.secret })) {
    return { error: 'Invalid code' }
  }
  
  // Gera 10 backup codes
  const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(8).toString('hex'))
  const hashedBackups = await Promise.all(backupCodes.map(c => bcrypt.hash(c, 10)))
  
  await db.execute(`
    UPDATE super_admins SET 
      totp_secret_encrypted = $1,
      totp_enabled = true,
      backup_codes_hashed = $2
    WHERE id = $3
  `, [encrypt(pending.secret), hashedBackups, super_admin_id])
  
  return { success: true, backup_codes: backupCodes }  // mostra 1 vez só
}
```

**Login flow:**
```typescript
// Middleware: super_admin tentando acessar /admin/*
const superAdmin = await getSuperAdmin(user_id)

if (!superAdmin.totp_enabled) {
  return redirect('/admin/setup-2fa')
}

if (!session.totp_verified) {
  return redirect('/admin/2fa-verify')
}

// Acesso liberado
```

**Critério de conclusão:**
- Super admin novo → forçado a configurar 2FA antes de acessar
- Login subsequente exige código TOTP
- 10 backup codes gerados e mostrados 1x
- Backup code de uso único (após usado, removido)
- Sessão com totp_verified expira em 7 dias

---

### A22 — Decomposição de A09 em sub-tarefas
**Tipo:** Refactor metodológico  
**Bloco proposto:** Bloco 5

**Por quê:**
A09 original mistura backend + frontend + lógica de permissões + emails. Padrão Anthropic recomenda decomposição máxima.

**Refactor proposto:**
Substituir A09 por 3 sub-tarefas paralelas:

**A09a — API + lógica de convite (Sonnet, Médio)**
- /app/api/team/invite/route.ts
- /app/api/team/invite/[token]/route.ts
- /app/api/team/invite/[token]/accept/route.ts
- /app/api/team/[user_id]/permissions/route.ts
- /app/api/team/[user_id]/route.ts
- /lib/team/invite-manager.ts
- Lógica de verificação de limite + tokens 48h

**A09b — UI de gestão de equipe (Sonnet, Médio)**
- /app/settings/team/page.tsx
- /app/settings/team/invite-modal.tsx
- /app/settings/team/permissions-editor.tsx
- /app/invite/[token]/page.tsx — página pública de aceite
- Componentes de matriz de permissões

**A09c — Emails de convite + integração (Haiku, Baixo)**
- Template `professional_invite`
- Integração com sender de A11
- Validação de fluxo end-to-end

**Pode rodar:** todas em paralelo no mesmo bloco.

---

## Ajustes em Tarefas Existentes

### Ajuste em A01 (Schema) — gap #8

Adicionar à seção "O que fazer":
- RLS em **todas** as 8 tabelas novas (não só workspace_users e workspaces)
- Helper functions: `user_has_workspace_access()`
- Policies separadas para SELECT, INSERT, UPDATE, DELETE em cada tabela

Substituir migration 035 (rls_policies.sql) pela versão completa do SPEC v1.1 seção 12.

### Ajuste em A05 (Signup) — gap #1

Adicionar à seção "Onboarding":
- Cada passo do onboarding chama `/api/onboarding/complete/[step]` para atualizar `onboarding_status`
- Cada passo tem botão "Pular por agora" → `/api/onboarding/skip/[step]`
- Resume automático no login (middleware verifica onboarding_status)

### Ajuste em A06 (Middleware) — gap #2

Substituir ROUTE_POLICIES pela versão completa da SPEC v1.1 seção 6.4 com `require_status`.

Adicionar verificação em CADA endpoint de escrita de `/api/*`:
```typescript
// Helper compartilhado
async function requireActiveWorkspace(req): Promise<{ workspace, error?: Response }> {
  const workspace = await getWorkspace(req)
  if (!['active', 'grace_period'].includes(workspace.status)) {
    return {
      workspace,
      error: Response.json(
        { error: 'WORKSPACE_BLOCKED', status: workspace.status },
        { status: 423 }
      )
    }
  }
  return { workspace }
}
```

### Ajuste em A07 (Webhook Stripe) — gap #7, #9

**Adicionar handler `customer.subscription.updated`** para detectar mudança em `cancel_at_period_end`.

**Adicionar verificação de timestamp:**
```typescript
// Antes de processar evento:
const sub = await getSubscription(workspace_id)
if (event.created < sub.last_stripe_event_timestamp) {
  await logAudit('billing.stale_event_ignored')
  return Response.json({ received: true }, { status: 200 })
}

// Depois de processar:
await updateSubscription(workspace_id, { 
  last_stripe_event_timestamp: event.created 
})
```

**Garantir que toda criação no checkout.session.completed é em transação:**
```typescript
await db.transaction(async (tx) => {
  // Insere billing_event PRIMEIRO (UNIQUE previne duplicação)
  // Cria workspace
  // Cria workspace_user
  // Cria subscription
  // Cria cost_cap
  // Cria agent_config
  // Cria primeiro message_usage_cycle
})
```

### Ajuste em A12 (Hook do orchestrator)

**Adicionar dependência explícita:** A12 só pode rodar **após** T17 do plano do motor estar mergeado.

**Adicionar ao Bloco 6:** ⚠️ **Aguardar T17 do motor antes de iniciar**

### Ajuste em A13 (Testes) — adicionar 7 cenários

Adicionar aos cenários obrigatórios:

**WEBHOOK FORA DE ORDEM (gap #7):**
17. Webhook payment_failed seguido de payment_succeeded em ordem reversa → estado final correto

**RACE CONDITION (gap #9):**
18. 2 entregas simultâneas do mesmo checkout.session.completed → 1 workspace criado

**MULTI-WORKSPACE (gap #5):**
19. User com 2 workspaces faz login → vai para /select-workspace
20. Trocar workspace → contexto muda corretamente

**CANCELAMENTO (gap #3):**
21. Owner cancela → workspace ativo até fim do período
22. Reativar antes do fim → cancel_at_period_end=false
23. Fim do período → status='cancelled', motor para

**RESET DE CICLO (gap #4):**
24. Job de reset → ciclo expirado vira novo ciclo com count=0

**LGPD (gap #3):**
25. Solicitar exclusão → email com token enviado
26. Confirmar token → anonimização imediata

**2FA (gap #10):**
27. Super admin sem 2FA → forçado a configurar antes de acessar /admin
28. Backup code de uso único → não funciona 2 vezes

---

## Estrutura Final dos Blocos (atualizada)

```
BLOCO 1 — FUNDAÇÃO                          [sequencial]
└── A01 (com RLS completo)

BLOCO 2 — CONFIGURAÇÃO BASE                 [paralelo: 3]
├── A02, A03, A04

BLOCO 3 — AUTH CORE + ONBOARDING            [paralelo: 4]
├── A05 (signup + checkout)
├── A06 (login + middleware com status)
├── A15 (onboarding com estado)
└── A19 (multi-workspace selector)

BLOCO 4 — BILLING                            [paralelo: 4]
├── A07 (webhook + transação + timestamp)
├── A08 (limit checker)
├── A16 (cancelamento)
└── A20 (Stripe Customer Portal)

BLOCO 5 — EQUIPE + ADMIN + 2FA              [paralelo: 5]
├── A09a (API team)
├── A09b (UI team)
├── A09c (emails team)
├── A10 (super admin panel)
└── A21 (2FA super admin)

BLOCO 6 — INTEGRAÇÃO + LGPD                  [paralelo: 4]
├── A11 (emails transacionais — 17 templates agora, não 13)
├── A17 (LGPD)
├── A18 (job de ciclos de mensagem)
└── A12 (hook orchestrator) ⚠️ aguardar T17 do motor

BLOCO 7 — TESTES + SETUP                     [sequencial]
├── A13 (testes — 28 cenários agora, não 16)
└── A14 (seed super admin + env docs)
```

**Totais atualizados:**
- 22 tarefas (era 14)
- 7 blocos (era 6)
- 28 cenários de teste (era 16)
- 17 templates de email (era 13)

---

## Modelos por Tarefa (atualizado)

| Tarefa | Modelo | Justificativa |
|---|---|---|
| A01, A03, A04, A05, A06, A07, A08, A09a, A09b, A10, A13, A15, A16, A17, A19, A21 | **Sonnet** | Complexidade média-alta |
| A02, A09c, A11, A12, A14, A18, A20 | **Haiku** | Tarefas mecânicas |

Nenhuma tarefa exige Opus.

---

## Resumo das Mudanças

**Adicionado:**
- 8 novas tarefas (A15-A22)
- 12 cenários de teste novos
- 4 templates de email novos (LGPD, cancelamento)
- 1 bloco novo (Bloco 7 separando testes do setup)

**Modificado:**
- A01: RLS completo
- A05: integração com onboarding state
- A06: middleware com status check
- A07: transação atômica + timestamp
- A09: decomposto em A09a/b/c
- A12: dependência de T17 explícita
- A13: 28 cenários

**Resultado:**
- Spec robusto a falhas comuns (race conditions, fora de ordem, idempotência)
- LGPD compliant
- 2FA para acesso admin
- Multi-tenancy real (multi-workspace)
- Resume de onboarding
- Decomposição máxima por agente

---

*Fim do IMPLEMENTATION_PLAN_AUTH_GAPS.md*
