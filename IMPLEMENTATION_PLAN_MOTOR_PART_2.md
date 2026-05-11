# IMPLEMENTATION_PLAN_MOTOR_PART_2.md
# Plano de Orquestração Multi-Agente — Motor de Conversação (Parte 2 de 2)

> **Continuação de:** IMPLEMENTATION_PLAN_MOTOR_PART_1.md  
> **Esta parte cobre:** Blocos 7-10 (Output Guards → Orquestrador → Jobs → Tests → Governance)  
> **Total de tarefas nesta parte:** 12  
> **Pré-requisito:** Parte 1 completa (T01-T14)

---

## Visão Geral dos Blocos (Parte 2)

```
BLOCO 7 — HARD GUARDRAILS — OUTPUT LAYER                      [paralelo: 2 agentes]
├── T15: Output Validator + Content Filter Output
└── T16: Cost Tracker + Audit Logger

BLOCO 8 — ORQUESTRADOR PRINCIPAL                              [sequencial]
├── T17: Orchestrator (engine/process)
└── T18: Followup Timers + Wait Mechanism

BLOCO 9 — JOBS ASSÍNCRONOS                                    [paralelo: 4 agentes]
├── T19: Jobs de Sessão (followup, expirer)
├── T20: Jobs de Memória (semantic + episodic indexer)
├── T21: Jobs de Indexação (KB chunks)
└── T22: Jobs de Métricas (aggregator, cost reset, rate limit cleanup)

BLOCO 10 — TESTES, HARDENING E GOVERNANCE                     [misto]
├── T23: Testes de integração end-to-end
├── T24: Testes de carga e edge cases
├── T25: Logging estruturado e observabilidade
└── T26: SPEC_MOTOR_GOVERNANCE.md (companion doc)
```

---

## BLOCO 7 — Hard Guardrails — Output Layer

> **Tipo:** Paralelo (2 agentes simultâneos)  
> **Dependência:** Parte 1 completa  
> **Por que aqui:** O Output Layer protege o que sai do motor. Vem após o Monitor para validar a resposta final.  
> **Tempo estimado:** 1 sessão paralela (~45 min)

---

### TAREFA 15 — Output Validator + Content Filter Output
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/guardrails-output`  
**Pode rodar com:** T16

**O que fazer:**
Implementar validação de output conforme SPEC seções 14.2 e 14.8.

**Entregáveis:**
- `/lib/guardrails/output-validator.ts` — validateOutput(response, context)
- `/lib/guardrails/content-filter-output.ts` — filterOutput(text)
- `/lib/guardrails/leak-detector.ts` — detectLeaks(text, context)

**Verificações Output Validator:**
1. Tamanho da resposta dentro do limite (max 4000 chars default)
2. Não contém prompt interno vazado (regex de defesa)
3. Não contém credenciais ou keys
4. Não contém IDs internos (UUIDs do banco)
5. JSON schema validation se a resposta deve ser estruturada

**Padrões bloqueados (Output):**
```typescript
const OUTPUT_BLOCKED_PATTERNS = [
  /sk-[a-zA-Z0-9]{32,}/,  // API keys
  /Bearer [a-zA-Z0-9]{20,}/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/, // UUIDs
  /SYSTEM:|SECTION \d+|═══/,  // resíduo do system prompt
  /As an AI|I am an AI/i,  // quebra de persona
  /process\.env|API_KEY|SECRET/i
]
```

**Comportamento ao detectar:**
```typescript
async function validateOutput(response: string, context: PromptContext): Promise<OutputValidation> {
  const violations = []
  
  // 1. Tamanho
  if (response.length > 4000) violations.push('size_exceeded')
  
  // 2. Padrões bloqueados
  for (const pattern of OUTPUT_BLOCKED_PATTERNS) {
    if (pattern.test(response)) violations.push(`blocked_pattern: ${pattern}`)
  }
  
  // 3. Vazamento de IDs internos
  const internalIds = extractInternalIds(response)
  if (internalIds.length > 0) violations.push('internal_id_leak')
  
  if (violations.length > 0) {
    await logAudit('output.violation', { violations, response_length: response.length })
    return { valid: false, violations, action: 'force_replan' }
  }
  
  return { valid: true, violations: [], action: 'continue' }
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 14.2 e 14.8.
Implemente em /lib/guardrails/.

OUTPUT VALIDATOR:
- Verifica 5 categorias: tamanho, padrões bloqueados, leak de credenciais, leak de IDs internos, schema (se aplicável)
- Em violação: força re-plan (volta ao Planner)
- Sempre registra em audit_logs

CONTENT FILTER OUTPUT:
- Detecta tentativa de quebra de persona ("As an AI...")
- Detecta vazamento de prompt
- Detecta credenciais ou tokens

LEAK DETECTOR:
- Recebe response + context
- context.workspace_id, session_id, etc. NÃO podem aparecer na response
- Verifica padrões de UUID, sk-keys, Bearer tokens

INTEGRAÇÃO:
- Chamado pelo Orchestrator APÓS o Monitor
- Se invalid: força re-plan (incrementa replan_count)
- Se replan_count >= 3 (circuit breaker): força handoff
```

**Critério de conclusão:**
- Resposta com "sk-..." → bloqueada
- Resposta com UUID → bloqueada
- Resposta de 5000 chars → bloqueada
- Resposta limpa → passa

---

### TAREFA 16 — Cost Tracker + Audit Logger
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/cost-audit`  
**Pode rodar com:** T15

**O que fazer:**
Implementar tracking de custo (tokens × modelo) e audit logging completo.

**Entregáveis:**
- `/lib/metrics/cost-tracker.ts` — recordUsage(workspace_id, model, input_tokens, output_tokens)
- `/lib/metrics/cost-calculator.ts` — calculateCost(model, input_tokens, output_tokens) → USD
- `/lib/metrics/audit-logger.ts` — logAudit(event, payload, context)
- `/lib/metrics/aggregator.ts` — funções de agregação para reports

**Tabela de preços (atualizada para 2026):**
```typescript
const MODEL_PRICING_USD_PER_MTOK = {
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-4-7': { input: 15.0, output: 75.0 },
  'whisper-1': { input: 0, output: 0, per_minute: 0.006 },
  'text-embedding-3-small': { input: 0.02, output: 0 }
}

function calculateCost(model: string, input_tokens: number, output_tokens: number): number {
  const pricing = MODEL_PRICING_USD_PER_MTOK[model]
  if (!pricing) return 0
  return (input_tokens / 1_000_000) * pricing.input + (output_tokens / 1_000_000) * pricing.output
}
```

**Categorias de Audit Log:**
```typescript
type AuditEventType =
  | 'message.received'
  | 'message.sent'
  | 'planner.decision'
  | 'executor.response'
  | 'monitor.report'
  | 'tool.executed'
  | 'tool.denied'
  | 'tool.failed'
  | 'guardrail.input_blocked'
  | 'guardrail.output_blocked'
  | 'guardrail.rate_limited'
  | 'guardrail.cost_capped'
  | 'guardrail.signature_invalid'
  | 'session.created'
  | 'session.expired'
  | 'session.handoff'
  | 'flow.started'
  | 'flow.completed'
  | 'flow.tool_denied'
  | 'memory.updated'
  | 'cost.threshold_warning'
  | 'cost.threshold_blocked'
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 9 (tabelas usage_metrics e audit_logs) e 14.4 (Cost Cap).
Implemente em /lib/metrics/.

COST TRACKER:
- Cada chamada LLM registra em usage_metrics:
  { workspace_id, session_id, model, input_tokens, output_tokens, cost_usd, timestamp }
- recordUsage é assíncrono, não bloqueia
- Triggera check de cost_cap após registrar (se atingiu 80% ou 100%)

COST CALCULATOR:
- Tabela de preços por modelo (use os 2026 atuais)
- Função pura: input_tokens, output_tokens → USD

AUDIT LOGGER:
- TODA ação relevante registrada em audit_logs
- Formato: { event_type, workspace_id, session_id?, client_id?, payload, timestamp }
- payload: JSONB com detalhes específicos do evento
- NUNCA logue conteúdo sensível: mensagens completas, credenciais, dados pessoais
- Logue apenas IDs, contagens, flags

AGGREGATOR:
- Funções para queries comuns:
  - getCostByWorkspace(workspace_id, period)
  - getCostByModel(workspace_id, period)
  - getEventCounts(workspace_id, period)
  - getTopErrors(workspace_id, period)
```

**Critério de conclusão:**
- Cada chamada LLM registrada com custo correto
- Cost cap dispara warning aos 80%
- Audit log estruturado e queriável
- Aggregator retorna dados agregados corretamente

---

## BLOCO 8 — Orquestrador Principal

> **Tipo:** Sequencial  
> **Dependência:** Bloco 7 completo  
> **Tempo estimado:** 2 sessões (~120 min)

---

### TAREFA 17 — Orquestrador (engine/process)
**Agente:** Claude Sonnet  
**Effort:** Muito Alto  
**Branch:** `task/orchestrator`

**O que fazer:**
Implementar o orquestrador que conecta todas as peças e processa cada mensagem end-to-end.

**Entregáveis:**
- `/lib/engine/orchestrator.ts` — processMessage(inbound, workspace_id, channel)
- `/app/api/engine/process/route.ts` — endpoint POST interno

**Fluxo completo (implementar EXATAMENTE nessa ordem, conforme SPEC seção 2):**
```typescript
async function processMessage(
  inbound: InboundMessage,
  workspace_id: string,
  channel: ChannelAdapter
): Promise<void> {
  const traceId = generateTraceId()
  await logAudit('message.received', { trace_id: traceId, ...inbound })
  
  try {
    // ═══ HARD GUARDRAIL — Input Layer ═══
    const inputGuards = await runInputGuards(inbound, workspace_id)
    if (!inputGuards.allowed) {
      await sendStandardResponse(channel, inbound.from, inputGuards.reason)
      return
    }
    
    // ═══ Pré-processamento de mídia ═══
    const processedContent = await processInboundMedia(inbound)
    
    // ═══ Busca de contexto ═══
    const client = await getOrCreateClient(workspace_id, inbound.from)
    const session = await getOrCreateSession(workspace_id, client.id, channel.type)
    const context = await buildPromptContext(session.id, processedContent)
    
    // ═══ PLANNER ═══
    const planStart = Date.now()
    const decision = await plan(context)
    await recordUsage(workspace_id, 'claude-haiku', context.input_tokens, decision.output_tokens)
    await logAudit('planner.decision', { trace_id: traceId, decision, latency_ms: Date.now() - planStart })
    
    // ═══ HARD GUARDRAIL — Tool Authorization ═══
    if (decision.action === 'call_tool') {
      const auth = await checkToolAuthorization(session.flow_id, decision.tool_name)
      if (!auth) {
        await emitEvent('flow.tool_denied', { workspace_id, session_id: session.id, tool: decision.tool_name })
        // Força re-plan
        decision.action = 'respond'  // fallback
      }
    }
    
    // ═══ EXECUTOR ═══
    const execStart = Date.now()
    const executorResult = await execute(decision, context)
    await recordUsage(workspace_id, executorResult.model_used, ..., ...)
    await logAudit('executor.response', { trace_id: traceId, latency_ms: Date.now() - execStart })
    
    // ═══ MONITOR ═══
    if (shouldRunMonitor(context.current_node, workspace_id)) {
      const monitorReport = await monitor(context, executorResult)
      await logAudit('monitor.report', { trace_id: traceId, report: monitorReport })
      
      if (monitorReport.recommended_action === 'replan') {
        await incrementReplanCount(session.id)
        if (await getReplanCount(session.id) < 3) {
          // Volta ao Planner com flag de replan
          return processMessage(inbound, workspace_id, channel) // recursão controlada
        } else {
          // Circuit breaker: força handoff
          executorResult = await forceHandoff(context, 'max_replans_exceeded')
        }
      }
      
      if (monitorReport.recommended_action === 'handoff') {
        executorResult = await forceHandoff(context, monitorReport.reasoning)
      }
    }
    
    // ═══ HARD GUARDRAIL — Output Layer ═══
    const outputValidation = await validateOutput(executorResult.response_text, context)
    if (!outputValidation.valid) {
      await logAudit('guardrail.output_blocked', { trace_id: traceId, violations: outputValidation.violations })
      // Força re-plan ou usa resposta padrão
      executorResult.response_text = "Tive um problema com essa resposta. Pode reformular sua pergunta?"
    }
    
    // ═══ Pós-processamento ═══
    await saveMessage(session.id, 'user', processedContent, inbound)
    await saveMessage(session.id, 'assistant', executorResult.response_text)
    await updateSession(session.id, executorResult.session_updates)
    
    for (const event of executorResult.crm_events) {
      await emitEvent(event.event_type, event)
    }
    
    if (executorResult.next_node_id) {
      const nextNode = await getNode(executorResult.next_node_id)
      if (nextNode.type === 'wait') {
        await scheduleFollowupTimer(session.id, nextNode)
      }
    }
    
    // ═══ Envio ═══
    await channel.sendMessage(inbound.from, {
      text: executorResult.response_text,
      typing_simulation: true,
      typing_delay_ms: calculateTypingDelay(executorResult.response_text)
    })
    
    await logAudit('message.sent', { trace_id: traceId, length: executorResult.response_text.length })
    
  } catch (error) {
    await logAudit('error', { trace_id: traceId, error: error.message, stack: error.stack })
    // Resposta padrão de erro (não vaza detalhes)
    await channel.sendMessage(inbound.from, {
      text: "Tive um problema técnico. Já vou retornar com sua resposta."
    })
    // Notificar admin
    await alertAdmin({ trace_id: traceId, error })
  }
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 2 INTEGRALMENTE.
Implemente em /lib/engine/orchestrator.ts.

ESTE É O PONTO DE INTEGRAÇÃO DE TODAS AS CAMADAS.

ORDEM EXATA (não pode alterar):
1. Input Guards (rate limit, content filter, cost cap, signature)
2. Pré-processamento de mídia
3. Busca de contexto (workspace, agente, cliente, memória, sessão, fluxo, knowledge)
4. Planner (Claude Haiku)
5. Tool Authorization (se action = call_tool)
6. Executor (Claude Sonnet)
7. Monitor (Claude Haiku, se habilitado)
8. Output Validator + Content Filter Output
9. Pós-processamento (salvar mensagens, atualizar sessão, emitir eventos)
10. Envio (channel adapter)

REQUISITOS CRÍTICOS:
- TraceId em TODA operação para debug
- Audit log em CADA etapa
- Cost tracking em CADA chamada LLM
- Erro em qualquer etapa NÃO deve deixar o usuário sem resposta
- Re-plan tem limite de 3 (circuit breaker)
- Latência total de cada mensagem registrada

API ROUTE:
- POST /api/engine/process
- Body: { inbound, workspace_id, channel_type }
- Response 200 imediato (processamento async se demorar)
```

**Critério de conclusão:**
- Mensagem de texto end-to-end → resposta enviada
- Mensagem com áudio → transcrita e respondida
- Mensagem fora do tema → digressão funcionando
- Tool call → executada e resultado incorporado
- Erro em camada → fallback graceful

---

### TAREFA 18 — Followup Timers + Wait Mechanism
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/wait-followup`  
**Depende de:** T17

**O que fazer:**
Implementar o mecanismo de wait nodes e os followup timers conforme SPEC seção 3.4.

**Entregáveis:**
- `/lib/engine/wait-handler.ts` — handleWaitNode(session, node)
- `/lib/engine/followup-scheduler.ts` — scheduleFollowupTimer, cancelTimer
- `/lib/engine/followup-resumer.ts` — resumeFromTimer(timer_id)
- `/app/api/engine/resume/route.ts` — endpoint chamado pelo job de timer

**Lógica do Wait:**
```typescript
async function handleWaitNode(session: Session, node: WaitNode): Promise<void> {
  const waitUntil = new Date(Date.now() + getDurationMs(node.config.duration))
  
  // Atualiza sessão para status 'waiting'
  await updateSession(session.id, {
    status: 'waiting',
    wait_until: waitUntil,
    current_node_id: node.id
  })
  
  // Agenda timer
  await scheduleFollowupTimer(session.id, {
    target_node_id: node.config.timeout_node_id,
    scheduled_at: waitUntil
  })
  
  // Se message_on_timeout configurado: envia quando expirar
  // Se advance_on_response: cliente respondendo cancela o timer
}
```

**Lógica de Resumo por Timer:**
```typescript
async function resumeFromTimer(timer_id: string): Promise<void> {
  const timer = await getTimer(timer_id)
  if (timer.status !== 'pending') return
  
  const session = await getSession(timer.session_id)
  if (session.status !== 'waiting') return
  
  // Avança para target_node_id
  await updateSession(session.id, {
    status: 'active',
    current_node_id: timer.target_node_id,
    wait_until: null
  })
  
  // Marca timer como fired
  await markTimerFired(timer_id)
  
  // Se há message_on_timeout: gera resposta no novo nó
  const newNode = await getNode(timer.target_node_id)
  if (newNode.type === 'step') {
    // Aciona o orquestrador como se fosse uma "auto-message"
    await processAutoMessage(session, newNode)
  }
}
```

**Lógica de Cancel por Resposta:**
```typescript
// No orchestrator, antes de processar:
if (session.status === 'waiting' && session.wait_until) {
  // Cliente respondeu antes do timer
  const node = await getNode(session.current_node_id)
  if (node.type === 'wait' && node.config.advance_on_response) {
    await cancelPendingTimers(session.id)
    await updateSession(session.id, {
      status: 'active',
      current_node_id: node.config.response_node_id || node.edges[0].target_node_id,
      wait_until: null
    })
  }
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 3.4 (wait node).
Implemente em /lib/engine/wait-handler.ts e relacionados.

WAIT NODE COMPORTAMENTO:
- Quando o orquestrador chega num wait node:
  1. Atualiza sessão para status 'waiting'
  2. Define wait_until = now + duration
  3. Cria followup_timer com target_node_id e scheduled_at
- Quando o timer expira (job assíncrono):
  1. Sessão volta para 'active'
  2. Avança para timeout_node_id
  3. Se message_on_timeout: gera resposta automaticamente
- Quando cliente responde antes do timer:
  1. Cancela timer (status = 'cancelled')
  2. Sessão volta para 'active'
  3. Avança para response_node_id (se configurado) ou primeira edge
  4. Processa a mensagem normalmente

INTEGRAÇÃO COM ORQUESTRADOR:
- O orquestrador verifica session.status no início
- Se 'waiting': aplica lógica de cancel-by-response

ENDPOINT /api/engine/resume:
- Chamado pelo job de followup
- Body: { timer_id }
- Aciona resumeFromTimer
```

**Critério de conclusão:**
- Wait de 60s expira e avança para timeout_node_id
- Cliente respondendo em 30s cancela timer e avança para response_node_id
- Message_on_timeout envia mensagem automática
- Múltiplos timers da mesma sessão são cancelados quando uma resposta chega

---

## BLOCO 9 — Jobs Assíncronos

> **Tipo:** Paralelo (4 agentes simultâneos)  
> **Dependência:** Bloco 8 completo  
> **Tempo estimado:** 1 sessão paralela (~75 min)

> **Nota:** O SPEC v2.0 lista 8 jobs. Agrupamos em 4 tarefas para paralelizar.

---

### TAREFA 19 — Jobs de Sessão (followup + expirer)
**Agente:** Claude Haiku  
**Effort:** Médio  
**Branch:** `task/jobs-session`  
**Pode rodar com:** T20, T21, T22

**O que fazer:**
Implementar jobs 1 (Followup Timers) e 3 (Session Expirer) do SPEC seção 12.

**Entregáveis:**
- `/jobs/followup-timer-processor.ts` — Job 1
- `/jobs/session-expirer.ts` — Job 3
- `/app/api/jobs/followup/route.ts` — endpoint cron
- `/app/api/jobs/expire-sessions/route.ts` — endpoint cron

**Job 1: Processador de Followup Timers**
```typescript
// Frequência: a cada 1 minuto
async function processFollowupTimers(): Promise<void> {
  const pendingTimers = await db.followup_timers.findMany({
    where: { 
      scheduled_at: { lte: new Date() },
      status: 'pending'
    },
    take: 100  // batch
  })
  
  for (const timer of pendingTimers) {
    try {
      await fetch(`${BASE_URL}/api/engine/resume`, {
        method: 'POST',
        body: JSON.stringify({ timer_id: timer.id })
      })
    } catch (error) {
      await logAudit('job.followup_failed', { timer_id: timer.id, error: error.message })
    }
  }
}
```

**Job 3: Expirador de Sessões**
```typescript
// Frequência: a cada 15 minutos
async function expireSessions(): Promise<void> {
  const expiredSessions = await db.sessions.findMany({
    where: {
      expires_at: { lte: new Date() },
      status: 'active'
    },
    take: 200
  })
  
  for (const session of expiredSessions) {
    await emitEvent('conversation.abandoned', { session_id: session.id })
    await updateSession(session.id, { status: 'completed' })
    
    // Triggera geração de memória semântica (job 2)
    await fetch(`${BASE_URL}/api/jobs/generate-memory`, {
      method: 'POST',
      body: JSON.stringify({ session_id: session.id })
    })
  }
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 12 (jobs 1 e 3).
Implemente em /jobs/.

JOB 1 (Followup):
- Roda a cada 1 minuto via Vercel Cron ou Supabase pg_cron
- Busca timers vencidos (scheduled_at <= now, status = 'pending')
- Para cada: chama /api/engine/resume
- Marca como 'fired' (feito pelo resumer, não pelo job)

JOB 3 (Expirer):
- Roda a cada 15 minutos
- Busca sessões com expires_at vencido
- Para cada: emite conversation.abandoned, marca como 'completed', triggera geração de memória

CRON CONFIG:
- vercel.json:
  "crons": [
    { "path": "/api/jobs/followup", "schedule": "*/1 * * * *" },
    { "path": "/api/jobs/expire-sessions", "schedule": "*/15 * * * *" }
  ]
- Endpoint protegido por bearer token (CRON_SECRET)
```

**Critério de conclusão:**
- Job de followup processa timers vencidos corretamente
- Job de expiração marca sessões inativas
- Cron config funcional na Vercel

---

### TAREFA 20 — Jobs de Memória (semantic + episodic)
**Agente:** Claude Haiku  
**Effort:** Médio  
**Branch:** `task/jobs-memory`  
**Pode rodar com:** T19, T21, T22

**O que fazer:**
Implementar jobs 2 (Memória Semântica) e 4 (Memória Episódica).

**Entregáveis:**
- `/jobs/memory-semantic-generator.ts` — Job 2
- `/jobs/memory-episodic-indexer.ts` — Job 4
- `/app/api/jobs/generate-memory/route.ts`
- `/app/api/jobs/index-episode/route.ts`

**Job 2: Gerador de Memória Semântica**
```typescript
// Trigger: evento conversation.completed ou conversation.abandoned
async function generateSemanticMemory(session_id: string): Promise<void> {
  const session = await getSession(session_id)
  const messages = await getMessages(session_id, { limit: 100 })
  const existingMemory = await getSemanticMemory(session.client_id)
  
  // Claude Haiku analisa e atualiza
  const updatedMemory = await callClaude({
    model: 'claude-haiku',
    system: SEMANTIC_MEMORY_PROMPT,
    user: JSON.stringify({ existingMemory, messages })
  })
  
  await upsertSemanticMemory(session.client_id, session.workspace_id, updatedMemory)
  await emitEvent('memory.updated', { client_id: session.client_id })
}

const SEMANTIC_MEMORY_PROMPT = `
Você é um analista de relacionamento com clientes.
Dada uma conversa concluída e um resumo prévio do cliente,
ATUALIZE o resumo mantendo o que ainda é relevante e adicionando novos insights.

Estrutura esperada:
- preferred_name: apelido/nome preferido (string ou null)
- preferences: array de strings (preferências de serviço, estilo, profissional)
- last_service: string (último serviço realizado, com data)
- observations: string (comportamento, sensibilidade a preço, etc.)
- raw_insights: object (dados estruturados adicionais)

Seja conciso. Resumo total < 500 chars.
`
```

**Job 4: Indexador de Memória Episódica**
```typescript
// Trigger: conversation.completed
async function indexEpisode(session_id: string): Promise<void> {
  const session = await getSession(session_id)
  const messages = await getMessages(session_id, { limit: 100 })
  
  // Claude Haiku gera resumo da conversa
  const summary = await summarizeConversation(messages)
  
  // OpenAI gera embedding
  const embedding = await generateEmbedding(summary)
  
  // Salva episódio
  await insertEpisode({
    client_id: session.client_id,
    workspace_id: session.workspace_id,
    session_id: session.id,
    summary,
    embedding,
    flow_id: session.flow_id,
    completed_at: session.updated_at
  })
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 7 e 12 (jobs 2 e 4).
Implemente em /jobs/.

JOB 2 (Semântica):
- Trigger por evento (não cron) — chamado quando conversa completa/abandona
- Claude Haiku gera resumo estruturado (preferred_name, preferences, last_service, observations)
- Upsert em client_memory_semantic

JOB 4 (Episódica):
- Trigger por evento — após conversa completar
- Claude Haiku resume a conversa em < 200 chars
- OpenAI text-embedding-3-small gera embedding (1536 dim)
- Insere em client_memory_episodic

ENDPOINTS:
- /api/jobs/generate-memory
- /api/jobs/index-episode
- Body: { session_id }

NOTA: Estes jobs NÃO rodam por cron. São acionados via fetch quando
o evento ocorre. Sessão expirada → trigger ambos via API.
```

**Critério de conclusão:**
- Conversa concluída gera/atualiza memória semântica
- Conversa concluída gera embedding e salva episódio
- Vector search retorna episódios similares corretamente

---

### TAREFA 21 — Job de Indexação de Knowledge Base
**Agente:** Claude Haiku  
**Effort:** Médio  
**Branch:** `task/jobs-knowledge`  
**Pode rodar com:** T19, T20, T22

**O que fazer:**
Implementar job 5 (Indexador de KB) do SPEC seção 12.

**Entregáveis:**
- `/jobs/knowledge-indexer.ts` — Job 5
- `/app/api/jobs/index-knowledge/route.ts`

**Job 5: Indexador de Knowledge Base**
```typescript
// Trigger: knowledge_base item criado ou atualizado
// Frequência: a cada 5 minutos para itens "dirty"
async function indexKnowledge(kb_id?: string): Promise<void> {
  const items = kb_id 
    ? [await getKnowledgeItem(kb_id)]
    : await getDirtyKnowledgeItems()  // items com is_indexed = false
  
  for (const item of items) {
    try {
      // 1. Limpa chunks antigos
      await deleteChunksByKbId(item.id)
      
      // 2. Chunka o conteúdo
      const chunks = chunkText(item.content, { chunk_size: 500, overlap: 50 })
      
      // 3. Gera embeddings em batch (mais eficiente)
      const embeddings = await batchEmbeddings(chunks.map(c => c.text))
      
      // 4. Salva chunks
      for (let i = 0; i < chunks.length; i++) {
        await insertKnowledgeChunk({
          kb_id: item.id,
          workspace_id: item.workspace_id,
          chunk_index: i,
          content: chunks[i].text,
          embedding: embeddings[i],
          token_count: chunks[i].token_count
        })
      }
      
      // 5. Marca como indexado
      await markKbIndexed(item.id)
      
    } catch (error) {
      await logAudit('job.kb_index_failed', { kb_id: item.id, error: error.message })
    }
  }
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 4 (RAG) e 12 (job 5).
Implemente em /jobs/knowledge-indexer.ts.

LÓGICA:
- Trigger por evento (criação/atualização de KB) OU cron a cada 5 min
- Para cada item "dirty" (is_indexed = false):
  1. Deleta chunks antigos
  2. Chunka (500 tokens, overlap 50)
  3. Batch embeddings (OpenAI text-embedding-3-small)
  4. Salva chunks com embedding
  5. Marca is_indexed = true

EFICIÊNCIA:
- Use batch embeddings (OpenAI aceita até 2048 inputs por chamada)
- Delete em transação para evitar estado inconsistente
- Se embedding falhar: rollback do delete

CRON CONFIG:
- "*/5 * * * *" — a cada 5 minutos
- Endpoint: /api/jobs/index-knowledge

TRIGGER POR EVENTO:
- Adicione hook no CRUD de knowledge: ao salvar, marque is_indexed = false
- Job pega na próxima execução
```

**Critério de conclusão:**
- KB de 10k tokens é chunked em ~25 chunks
- Embeddings gerados em batch (não 1 por 1)
- Vector search funciona após indexação
- Atualização de KB triggera re-indexação

---

### TAREFA 22 — Jobs de Métricas (aggregator, cost reset, rate limit cleanup)
**Agente:** Claude Haiku  
**Effort:** Baixo  
**Branch:** `task/jobs-metrics`  
**Pode rodar com:** T19, T20, T21

**O que fazer:**
Implementar jobs 6, 7 e 8 do SPEC seção 12.

**Entregáveis:**
- `/jobs/cost-cap-reset.ts` — Job 6 (mensal)
- `/jobs/metrics-aggregator.ts` — Job 7 (diário)
- `/jobs/rate-limit-cleanup.ts` — Job 8 (a cada 1h)
- `/app/api/jobs/reset-cost-caps/route.ts`
- `/app/api/jobs/aggregate-metrics/route.ts`
- `/app/api/jobs/cleanup-buckets/route.ts`

**Job 6: Reset mensal de cost caps**
```typescript
// Frequência: 1º de cada mês às 00:00
async function resetCostCaps(): Promise<void> {
  // Reseta contador mensal de todos os workspaces
  await db.workspace_cost_caps.updateMany({
    data: { current_month_usd: 0, last_reset: new Date() }
  })
  
  // Desbloqueia workspaces que estavam blocked
  await db.workspaces.updateMany({
    where: { status: 'blocked_cost_cap' },
    data: { status: 'active' }
  })
  
  await logAudit('cost_caps.monthly_reset', {})
}
```

**Job 7: Agregador de métricas**
```typescript
// Frequência: 1x por dia às 02:00
async function aggregateMetrics(): Promise<void> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  for (const workspace of await getActiveWorkspaces()) {
    const metrics = await calculateDailyMetrics(workspace.id, yesterday)
    await insertDailyMetrics({
      workspace_id: workspace.id,
      date: yesterday,
      total_messages: metrics.total_messages,
      total_sessions: metrics.total_sessions,
      avg_session_length: metrics.avg_session_length,
      total_cost_usd: metrics.total_cost_usd,
      handoff_rate: metrics.handoff_rate,
      replan_rate: metrics.replan_rate,
      tool_usage_breakdown: metrics.tool_usage_breakdown
    })
  }
}
```

**Job 8: Limpeza de rate limit buckets**
```typescript
// Frequência: a cada 1 hora
async function cleanupRateLimitBuckets(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)  // 24h atrás
  await db.rate_limit_buckets.deleteMany({
    where: { window_end: { lt: cutoff } }
  })
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 12 (jobs 6, 7, 8).
Implemente em /jobs/.

JOB 6 (Cost Reset):
- Cron: "0 0 1 * *" (1º de cada mês 00:00)
- Reseta current_month_usd para 0
- Desbloqueia workspaces blocked_cost_cap

JOB 7 (Aggregator):
- Cron: "0 2 * * *" (todo dia 02:00)
- Calcula métricas do dia anterior por workspace
- Insere em daily_metrics
- Métricas: total_messages, total_sessions, avg_session_length, total_cost_usd, handoff_rate, replan_rate, tool_usage_breakdown

JOB 8 (Bucket Cleanup):
- Cron: "0 * * * *" (de hora em hora)
- Deleta rate_limit_buckets com window_end < now - 24h
- Mantém banco limpo
```

**Critério de conclusão:**
- Reset mensal funciona corretamente
- Aggregator gera métricas diárias precisas
- Cleanup remove buckets antigos sem afetar ativos

---

## BLOCO 10 — Testes, Hardening e Governance

> **Tipo:** Misto (T23 e T24 paralelos, T25 e T26 sequenciais após)  
> **Dependência:** Blocos 1-9 completos  
> **Tempo estimado:** 3 sessões (~180 min)

---

### TAREFA 23 — Testes de Integração End-to-End
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/integration-tests`  
**Pode rodar com:** T24

**O que fazer:**
Criar suite completa de testes que valida o fluxo end-to-end.

**Cenários obrigatórios (15 cenários):**
```
HAPPY PATH:
1. Conversa simples: cliente pede agendamento → bot agenda → confirma
2. Agendamento com profissional específico
3. Cancelamento de agendamento existente

DIGRESSÃO E RETOMADA:
4. Digressão simples: cliente muda de assunto → bot responde → retoma
5. Digressão durante tool call: bot busca horários → cliente pergunta preço → bot responde → retoma horários
6. Múltiplas digressões em sequência (cliente é distraído)
7. Cliente muda de produto no meio (1 → 8 → 2) e bot mantém visão global

MÍDIA:
8. Cliente envia foto do cabelo → bot analisa → continua fluxo
9. Cliente envia áudio → bot transcreve → responde
10. Cliente envia PDF (ex: receita médica em farmácia) → bot extrai info

WAIT/FOLLOWUP:
11. Bot agenda wait de 1 min → timer dispara → bot envia FUP
12. Bot agenda wait → cliente responde antes → cancela timer e avança

GUARDRAILS:
13. Cliente tenta prompt injection → bloqueado pelo Content Filter
14. Workspace atinge cost cap → próxima mensagem bloqueada
15. Loop detectado pelo Monitor → handoff forçado
```

**Entregáveis:**
- `/tests/integration/motor-happy-path.test.ts`
- `/tests/integration/motor-digression.test.ts`
- `/tests/integration/motor-media.test.ts`
- `/tests/integration/motor-wait-followup.test.ts`
- `/tests/integration/motor-guardrails.test.ts`
- `/tests/fixtures/workspaces.ts`
- `/tests/fixtures/flows.ts` — fluxos de teste para barbearia
- `/tests/fixtures/clients.ts`
- `/tests/helpers/mock-channel.ts`
- `/tests/helpers/mock-llm.ts`

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md COMPLETO.
Crie testes de integração em /tests/integration/ usando vitest.

15 CENÁRIOS OBRIGATÓRIOS (listados no plan).

FIXTURES:
- Workspace de teste: barbearia "Edvan"
- 3 serviços: corte (R$45), barba (R$25), loiro (R$200)
- 2 fluxos: agendamento, curso
- KB com 5 tags: corte_info, barba_info, loiro_info, edvan_perfil, espaco_info
- Cliente de teste: "João" com 3 visitas anteriores (memória populada)

MOCKS:
- Channel: mock-channel grava mensagens enviadas em array
- LLM: mock-llm retorna respostas determinísticas baseadas em prompt
- Whisper: mock retorna transcrição fixa
- Vision: mock retorna descrição fixa

ASSERTIONS:
- Mensagens enviadas na ordem correta
- Estado da sessão após cada turno
- Eventos CRM emitidos
- Audit logs registrados
- Custos contabilizados

ATENÇÃO: Use Supabase local para banco. Reset entre testes.
```

**Critério de conclusão:** 15/15 cenários passando.

---

### TAREFA 24 — Testes de Carga e Edge Cases
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/load-tests`  
**Pode rodar com:** T23

**O que fazer:**
Validar comportamento sob carga e em casos extremos.

**Cenários:**
```
CARGA:
1. 100 mensagens simultâneas (mesma sessão) → ordem mantida
2. 1000 mensagens simultâneas (sessões diferentes) → todos atendidos
3. Webhook recebe 10k requests em 1 min → rate limit funcionando

EDGE CASES:
4. Mensagem vazia
5. Mensagem com 10k caracteres
6. Áudio de 5 minutos
7. Imagem de 20MB
8. PDF de 50 páginas
9. Cliente envia 50 mensagens em 1 segundo (flood)
10. Sessão antiga (180 dias) recebendo mensagem

FALHAS:
11. Whisper API down → fallback graceful
12. Anthropic API timeout → retry + fallback
13. Tool externa falha → erro para o cliente sem expor detalhes
14. Banco fica indisponível → mensagem queue
15. Webhook duplicado → idempotência
```

**Entregáveis:**
- `/tests/load/concurrent-messages.test.ts`
- `/tests/load/webhook-flood.test.ts`
- `/tests/edge-cases/edge-inputs.test.ts`
- `/tests/edge-cases/api-failures.test.ts`
- `/tests/edge-cases/idempotency.test.ts`

**Prompt de abertura:**
```
Crie testes de carga e edge cases em /tests/load/ e /tests/edge-cases/.

CARGA:
- Use vitest com concurrent: true
- Promise.all para mensagens simultâneas
- Verifique consistência de ordem na sessão

EDGE CASES:
- Inputs extremos não devem quebrar o sistema
- API failures devem ter retry com exponential backoff
- Tool failures devem ser registradas e o cliente recebe mensagem genérica

IDEMPOTÊNCIA:
- Webhook duplicado (mesmo channel_message_id) deve ser ignorado
- Use unique constraint em messages para garantir
```

**Critério de conclusão:** 15/15 cenários passando, sem flakes.

---

### TAREFA 25 — Logging Estruturado e Observabilidade
**Agente:** Claude Haiku  
**Effort:** Baixo  
**Branch:** `task/observability`  
**Depende de:** T23, T24

**O que fazer:**
Adicionar logging estruturado completo e instrumentar métricas para observabilidade.

**Entregáveis:**
- `/lib/logger.ts` — logger centralizado (pino ou similar)
- `/lib/metrics/dashboards.ts` — queries para dashboards
- `/app/api/admin/metrics/route.ts` — endpoint para visualização
- Instrumentação em todos os componentes críticos

**Estrutura de log:**
```typescript
interface StructuredLog {
  level: 'info' | 'warn' | 'error'
  timestamp: string
  trace_id: string
  component: 'orchestrator' | 'planner' | 'executor' | 'monitor' | 'tool' | 'channel' | 'job'
  workspace_id?: string
  session_id?: string
  client_phone_hash?: string  // hash, não plaintext
  action?: string
  duration_ms?: number
  tokens_used?: number
  cost_usd?: number
  error?: string
  metadata?: Record<string, any>  // sem PII
}
```

**Métricas-chave para dashboard:**
- Mensagens por minuto (último 24h)
- Latência média por componente (P50, P95, P99)
- Custo por workspace (mensal)
- Taxa de handoff (por workspace e flow)
- Taxa de re-plan (sinal de qualidade)
- Top tools usadas
- Top patterns de digressão

**Prompt de abertura:**
```
Implemente logging estruturado em /lib/logger.ts.
Use pino ou winston. Output JSON.

REGRAS DE PRIVACIDADE:
- NUNCA logue conteúdo de mensagens (apenas length)
- Phone: hash SHA-256, primeiros 8 chars
- API keys: nunca
- Erros: stack trace OK, mas sem variáveis sensíveis

INSTRUMENTAÇÃO:
- Cada componente principal: logger.info({ component: 'X', ... })
- Cada chamada LLM: latência + tokens + custo
- Cada erro: logger.error com contexto completo

DASHBOARDS:
- Endpoint /api/admin/metrics
- Queries agregadas em /lib/metrics/dashboards.ts
- Suporte a filtro por workspace_id e período

PERFORMANCE:
- Log assíncrono (não bloqueia)
- Sample em produção (10% dos logs info, 100% warn/error)
```

**Critério de conclusão:** Logs estruturados em todos os componentes, dashboard funcional.

---

### TAREFA 26 — SPEC_MOTOR_GOVERNANCE.md (Companion Doc)
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/spec-governance`  
**Depende de:** T25

**O que fazer:**
Criar o spec companion mencionado no SPEC_MOTOR_BACKEND.md cobrindo aspectos de governance que o spec principal referencia mas não detalha.

**Conteúdo do SPEC_MOTOR_GOVERNANCE.md:**
```
1. Versionamento de Fluxos
   - Histórico de versões por fluxo
   - Rollback de versão
   - A/B testing de versões
   
2. Simulação de Fluxos
   - Modo "simulator" — testa fluxo com personas sintéticas
   - Geração de conversas sintéticas via Claude Opus
   - Detecção de problemas antes de publicar
   
3. Evaluation Framework
   - Métricas: adherence, satisfaction, completion_rate, handoff_rate
   - LLM-as-judge para avaliação retroativa
   - Coletas de feedback do cliente
   
4. Cost Tracking & Budgets UI
   - Visualização por workspace
   - Alertas configuráveis
   - Breakdown por modelo, fluxo, dia
   
5. Audit Trail Completo
   - Queries para investigação de incidentes
   - Retenção de logs (90 dias default)
   - LGPD: direito ao esquecimento
   
6. Privacidade e Compliance
   - PII handling
   - LGPD requirements
   - Direito ao esquecimento
   - Exportação de dados do cliente
   
7. Multi-tenancy & Isolation
   - Garantias de isolamento entre workspaces
   - RLS no Supabase
   - Estratégias de tenant tier (free, pro, enterprise)
   
8. Disaster Recovery
   - Backup strategy
   - RTO/RPO targets
   - Failover procedures
```

**Entregáveis:**
- `/SPEC_MOTOR_GOVERNANCE.md` — companion doc completo
- `/IMPLEMENTATION_PLAN_GOVERNANCE.md` — plan separado para implementar (não nesta fase)

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md (especialmente referências ao GOVERNANCE).
Crie o companion doc /SPEC_MOTOR_GOVERNANCE.md.

ESCOPO:
- Versionamento, simulação, evaluation, cost UI, audit, privacidade, multi-tenancy, DR
- Mesmo nível de detalhe técnico do SPEC principal
- Schema additions necessárias (novas tabelas: flow_versions, simulations, eval_runs, etc.)
- Interfaces TypeScript
- Casos de uso e exemplos
- Não está no MVP — é o roadmap pós-MVP de governance

EXPLICITAR:
- Quais funcionalidades são MVP (já cobertas no SPEC principal)
- Quais são "Phase 2 — Governance" (este spec)
- Quais são "Phase 3 — Enterprise" (futuro)

CONEXÃO:
- Cada seção referencia tabelas e componentes do SPEC principal
- Indica quando precisa modificar o SPEC principal vs criar nova estrutura
```

**Critério de conclusão:** Doc completo, cobrindo as 8 áreas, sem sobreposição com SPEC principal.

---

## Resumo Visual da Parte 2

```
T15: Output Validator (Sonnet, MÉDIO) ─┐
T16: Cost+Audit (Sonnet, MÉDIO) ───────┴── [Bloco 7: paralelo, 2 agentes]
                                        ↓
T17: ORCHESTRATOR (Sonnet, M.ALTO) ────────[Bloco 8: sequencial]
                                        ↓
T18: Wait+Followup (Sonnet, MÉDIO)
                                        ↓
T19: Jobs Sessão (Haiku, MÉDIO) ─┐
T20: Jobs Memória (Haiku, MÉDIO) ─┼── [Bloco 9: paralelo, 4 agentes]
T21: Jobs Knowledge (Haiku, MÉDIO) ─┤
T22: Jobs Métricas (Haiku, BAIXO) ──┘
                                        ↓
T23: E2E Tests (Sonnet, ALTO) ─┐
T24: Load Tests (Sonnet, MÉDIO) ┴── [Bloco 10a: paralelo, 2 agentes]
                                        ↓
T25: Observability (Haiku, BAIXO) ─[Bloco 10b: sequencial]
                                        ↓
T26: SPEC Governance (Sonnet, ALTO)
```

**Tempo estimado total da Parte 2:** ~6-7 sessões  
**Total geral (Parte 1 + 2):** ~13-15 sessões de Claude Code

---

## Tabela Consolidada de Modelos por Tarefa

| Tarefas | Modelo | Quantidade | Justificativa |
|---|---|---|---|
| T01, T04, T07, T08, T09, T10, T11, T13, T14, T15, T16, T17, T18, T23, T24, T26 | **Sonnet** | 16 | Complexidade técnica média-alta, requer raciocínio de arquitetura |
| T12 | **Opus** | 1 | Componente mais crítico do sistema (Planner). Erro aqui quebra tudo. |
| T02, T03, T05, T06, T19, T20, T21, T22, T25 | **Haiku** | 9 | Tarefas mecânicas, bem especificadas, padrões repetitivos |

**Total:** 26 tarefas, 10 blocos de execução, ~13-15 sessões de Claude Code.

---

## Estrutura final de pastas após implementação

```
/
├── app/
│   └── api/
│       ├── webhooks/
│       │   ├── ycloud/route.ts
│       │   ├── zapi/route.ts
│       │   └── evolution/route.ts
│       ├── engine/
│       │   ├── process/route.ts
│       │   └── resume/route.ts
│       ├── jobs/
│       │   ├── followup/route.ts
│       │   ├── expire-sessions/route.ts
│       │   ├── generate-memory/route.ts
│       │   ├── index-episode/route.ts
│       │   ├── index-knowledge/route.ts
│       │   ├── reset-cost-caps/route.ts
│       │   ├── aggregate-metrics/route.ts
│       │   └── cleanup-buckets/route.ts
│       ├── tools/route.ts
│       ├── knowledge/route.ts
│       └── admin/
│           └── metrics/route.ts
├── lib/
│   ├── channels/
│   ├── db/
│   ├── engine/         (planner, executor, monitor, orchestrator, prompt-builder)
│   ├── guardrails/
│   ├── knowledge/
│   ├── media/
│   ├── memory/
│   ├── metrics/
│   ├── tools/
│   └── logger.ts
├── jobs/               (8 jobs)
├── supabase/
│   └── migrations/     (21 migrations)
├── tests/
│   ├── integration/
│   ├── load/
│   ├── edge-cases/
│   ├── fixtures/
│   └── helpers/
├── types/              (14 arquivos)
├── SPEC_MOTOR_BACKEND.md
├── SPEC_MOTOR_GOVERNANCE.md
├── IMPLEMENTATION_PLAN_MOTOR_PART_1.md
├── IMPLEMENTATION_PLAN_MOTOR_PART_2.md
└── STATUS.md           (você atualiza)
```

---

## Regras de Ouro Consolidadas

1. **Sempre comece a sessão com:** "Leia o SPEC_MOTOR_BACKEND.md e os IMPLEMENTATION_PLAN antes de qualquer ação."
2. **Nunca pule um bloco.** Cada bloco depende do anterior estar mergeado e funcionando.
3. **Antes de fechar o worktree:** rode `npx tsc --noEmit` e garanta zero erros de tipo.
4. **Ao mergear:** atualize o `STATUS.md` marcando a tarefa como concluída.
5. **Se o agente travar:** quebre a tarefa em sub-tarefas menores e passe uma por sessão.
6. **Branches sempre limpas:** `git status` deve estar clean antes de iniciar nova tarefa.
7. **Testes antes do merge:** cada tarefa que tem critério de conclusão testável → escreve teste e roda.

---

*Fim do IMPLEMENTATION_PLAN_MOTOR_PART_2.md*  
*Total: 26 tarefas, 10 blocos, ~13-15 sessões de Claude Code*
