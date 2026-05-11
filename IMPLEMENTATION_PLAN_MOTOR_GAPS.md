# IMPLEMENTATION_PLAN_MOTOR_GAPS.md
# Análise Crítica e Tarefas Complementares

> **Propósito:** Cobrir gaps identificados ao revisar Part 1 e Part 2 contra o SPEC v2.0 e a pesquisa.  
> **Como usar:** Adicione estas tarefas aos plans existentes antes de iniciar a execução. As tarefas estão numeradas continuando a partir do Part 2 (T27+) ou referenciadas como ajustes a tarefas existentes.

---

## Sumário dos gaps encontrados

| # | Gap | Impacto | Onde corrigir |
|---|---|---|---|
| 1 | flow_snapshots / rollback básico ausente | Médio — sem segurança ao editar fluxo em produção | NOVA T27 |
| 2 | Tabela monitor_decisions não usada | Alto — perde auditoria do Monitor | Ajustar T14 |
| 3 | Cross-channel unification ausente | Médio — cliente em múltiplos canais vira 2 clientes | NOVA T28 |
| 4 | Estrutura completa de memória episódica simplificada | Médio — perde topic_tags, excerpt_summary | Ajustar T09 e T20 |
| 5 | Estado `nested` de digressão | Alto — digressão dentro de digressão quebra fluxo | Ajustar T12 |
| 6 | Categoria FRUSTRATION ausente | Baixo — Monitor fica menos informado | Ajustar T12 |
| 7 | node_id em messages não populado | Médio — debug fica difícil | Ajustar T17 |
| 8 | Endpoints admin faltando | Baixo — gestão manual sofre | NOVA T29 |
| 9 | Detecção de anomalias no Job 7 | Baixo — alertas tardios | Ajustar T22 |
| 10 | Classificador LLM de prompt injection | Médio — defesa só com regex é fraca | Ajustar T06 |
| 11 | flow_version em sessions | Alto — edição de fluxo quebra sessões ativas | Ajustar T03 e T17 |
| 12 | ReAct multi-turn no Executor | Alto — Executor não consegue encadear tools | Ajustar T13 |
| 13 | Mixed-initiative concreto | Médio — proatividade fica só no prompt | Ajustar T13 |
| 14 | WARPP-style personalization | Baixo — diferencial competitivo perdido | Ignorar para MVP |
| 15 | Topic-shift detector dedicado | Baixo — embutido no Planner é OK no MVP | Ignorar para MVP |
| 16 | Idempotência de webhooks | **CRÍTICO** — duplicação em produção | NOVA T30 |
| 17 | Retry policy para APIs externas | **CRÍTICO** — falhas transitórias quebram | NOVA T31 |
| 18 | Connection pooling | Alto — performance sob carga | Ajustar T03 |
| 19 | Trace IDs distribuídos | Médio — debug em produção sofre | Ajustar T25 |
| 20 | Migrations seed | Médio — testes não rodam sem seed | Ajustar T01 |

---

## NOVAS TAREFAS

### TAREFA 27 — Versionamento básico de fluxos (snapshots + rollback)
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/flow-versioning`  
**Quando:** Bloco 5 (paralelo com T10 e T11)  
**Cobre gap:** #1

**O que fazer:**
Implementar versionamento básico via snapshots, conforme tabela `flow_snapshots` no SPEC linha 743 e endpoints linhas 1198-1199.

**Por que não está em GOVERNANCE:**
GOVERNANCE cobre versionamento avançado (A/B testing, simulação de versões). Mas snapshot e rollback são funcionalidade básica que protege o usuário de perder trabalho. Devem estar no MVP.

**Entregáveis:**
- `/lib/flows/snapshot-manager.ts` — createSnapshot, restoreFromSnapshot, listVersions
- `/app/api/flows/[id]/snapshot/route.ts` — POST cria snapshot manual
- `/app/api/flows/[id]/rollback/[version]/route.ts` — POST faz rollback
- `/app/api/flows/[id]/versions/route.ts` — GET lista versões

**Lógica de snapshot:**
```typescript
async function createSnapshot(flow_id: string, created_by: string): Promise<FlowSnapshot> {
  // 1. Lê estado completo do fluxo
  const flow = await getFlow(flow_id)
  const nodes = await getFlowNodes(flow_id)
  const edges = await getFlowEdges(flow_id)
  const tags = await getNodeTags(flow_id)
  const policies = await getFlowToolPolicies(flow_id)
  
  // 2. Empacota em snapshot JSONB
  const snapshot = { flow, nodes, edges, tags, policies }
  
  // 3. Calcula próxima versão
  const latestVersion = await getLatestVersion(flow_id)
  const newVersion = latestVersion + 1
  
  // 4. Salva
  return await db.flow_snapshots.create({
    flow_id,
    version: newVersion,
    snapshot,
    created_by
  })
}
```

**Lógica de rollback:**
```typescript
async function restoreFromSnapshot(flow_id: string, version: number): Promise<void> {
  // 1. Cria snapshot do estado atual ANTES de rollback (para poder desfazer)
  await createSnapshot(flow_id, 'system_pre_rollback')
  
  // 2. Lê snapshot alvo
  const target = await getSnapshot(flow_id, version)
  
  // 3. Em transação:
  //    - Deleta nodes, edges, tags, policies atuais
  //    - Restaura do snapshot
  //    - Atualiza flow.version
  
  // 4. CRÍTICO: sessões ativas com flow_version diferente continuam na versão antiga
  //    (por isso flow_version em sessions é importante — gap #11)
}
```

**Snapshot automático:**
- Toda vez que um fluxo é publicado (`POST /flows/[id]/activate`), criar snapshot automático
- Toda vez que um fluxo passa de `draft` para `active`

**Critério de conclusão:**
- Snapshot manual cria registro com versão incremental
- Rollback restaura nodes/edges/tags exatamente como estavam
- Sessões em andamento com versão antiga continuam funcionando

---

### TAREFA 28 — Cross-channel client unification
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/cross-channel-unify`  
**Quando:** Bloco 4 (paralelo com T07, T08, T09)  
**Cobre gap:** #3

**O que fazer:**
Implementar unificação de cliente entre canais conforme `unified_id` em clients (SPEC linha 804) e `WorkspaceChannelPolicy` (linha 1063).

**Caso de uso real:**
Cliente conversa pelo YCloud (WhatsApp oficial). Depois manda mensagem pelo Evolution (WhatsApp não-oficial). Sem unificação, vira 2 clientes diferentes — perdem memória cross-channel.

**Entregáveis:**
- `/lib/unification/strategy.ts` — detectExistingClient(workspace_id, phone, email?)
- `/lib/unification/merger.ts` — mergeClients(primary_id, secondary_id)
- `/app/api/clients/[id]/unify/route.ts` — POST unificação manual
- `/lib/unification/policy.ts` — getWorkspaceUnificationPolicy(workspace_id)

**Estratégias de unificação:**
```typescript
type UnificationStrategy = 'phone' | 'email' | 'manual_link' | 'disabled'

// 'phone': normaliza phone (remove +, espaços, parênteses) e busca match
// 'email': se cliente forneceu email, busca por email
// 'manual_link': admin precisa unificar manualmente
// 'disabled': nunca unifica (cada canal = cliente separado)
```

**Lógica de detecção:**
```typescript
async function detectExistingClient(
  workspace_id: string,
  phone: string,
  email?: string
): Promise<Client | null> {
  const policy = await getWorkspaceUnificationPolicy(workspace_id)
  
  if (policy.strategy === 'disabled') return null
  
  if (policy.strategy === 'phone') {
    const normalized = normalizePhone(phone)
    return await findClientByPhone(workspace_id, normalized) 
      || await findClientBySecondaryPhone(workspace_id, normalized)
  }
  
  if (policy.strategy === 'email' && email) {
    return await findClientByEmail(workspace_id, email)
  }
  
  return null
}
```

**Integração:**
- T17 (Orchestrator) chama `detectExistingClient` antes de criar cliente novo
- Se encontrou: cria sessão com mesmo client_id mas channel diferente
- Memória semântica é compartilhada (mesmo client_id)
- Sessões continuam separadas por canal

**Critério de conclusão:**
- Cliente em YCloud + Evolution com mesmo número → 1 cliente, 2 sessões
- Memória semântica acessada de qualquer canal
- Política `disabled` mantém clientes separados

---

### TAREFA 29 — Endpoints administrativos
**Agente:** Claude Haiku  
**Effort:** Baixo  
**Branch:** `task/admin-endpoints`  
**Quando:** Bloco 8 (paralelo com T18)  
**Cobre gap:** #8

**O que fazer:**
Implementar endpoints de administração listados no SPEC seção 13 que não estão em outras tarefas.

**Entregáveis:**
- `/app/api/sessions/[id]/replan/route.ts` — POST força re-plan manual
- `/app/api/monitor/[session_id]/flags/route.ts` — GET lista flags
- `/app/api/audit-logs/route.ts` — GET query de audit logs (com filtros)
- `/app/api/usage/[workspace_id]/route.ts` — GET métricas de uso
- `/app/api/usage/[workspace_id]/cap/route.ts` — POST configura cost cap
- `/app/api/clients/[id]/episodic-memory/route.ts` — GET memória episódica
- `/app/api/clients/[id]/memory/reset/route.ts` — POST reseta memória

**Autenticação:**
Todos esses endpoints exigem header `Authorization: Bearer ADMIN_TOKEN` configurado por workspace. Validação simples via env var no MVP.

**Filtros para audit-logs:**
```
GET /api/audit-logs?workspace_id=X&from=2026-01-01&to=2026-12-31&action=tool.executed&limit=100
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 13 (API Routes).
Implemente os endpoints administrativos listados.

REGRAS:
- Todos protegidos por Bearer token (ADMIN_TOKEN env var)
- Validam workspace_id no path/body contra o token
- Retornam JSON estruturado
- Erros: 401 (sem token), 403 (token inválido), 404 (não encontrado), 500 (erro)

PAGINAÇÃO:
- Endpoints de listagem: ?limit=X&offset=Y
- Default limit=50, max=500
```

**Critério de conclusão:**
- Cada endpoint testado com curl
- Retornos tipados conforme interfaces
- Auth funcionando

---

### TAREFA 30 — Idempotência de webhooks
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/webhook-idempotency`  
**Quando:** Bloco 3 (paralelo com T05 e T06)  
**Cobre gap:** #16  
**Prioridade:** **CRÍTICA**

**O que fazer:**
Implementar idempotência de processamento de webhooks. WhatsApp APIs costumam re-enviar mensagens em caso de falha de network — sem idempotência, mensagens são processadas múltiplas vezes.

**Por que é crítico:**
Sem isso, em produção:
- Cliente envia 1 mensagem, agente responde 3 vezes
- Tool é executada múltiplas vezes (ex: cria 3 agendamentos)
- Métricas inflam custo

**Entregáveis:**
- `/lib/idempotency/store.ts` — armazenamento de IDs processados
- `/lib/idempotency/middleware.ts` — middleware para webhooks
- Migration adicional: `/supabase/migrations/022_idempotency_keys.sql`

**Schema:**
```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,            -- channel:channel_message_id
  workspace_id UUID REFERENCES workspaces(id),
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  result JSONB,                    -- resposta cacheada
  expires_at TIMESTAMPTZ NOT NULL  -- TTL de 24h
);
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

**Lógica:**
```typescript
async function withIdempotency<T>(
  key: string,
  workspace_id: string,
  handler: () => Promise<T>
): Promise<T> {
  // 1. Verifica se já foi processado
  const existing = await db.idempotency_keys.findUnique({ where: { key } })
  if (existing) {
    // Retorna resultado cacheado
    return existing.result as T
  }
  
  // 2. Marca como em processamento (evita race condition)
  await db.idempotency_keys.create({
    key,
    workspace_id,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
  })
  
  // 3. Processa
  try {
    const result = await handler()
    await db.idempotency_keys.update({ where: { key }, data: { result } })
    return result
  } catch (error) {
    // Se falhou, remove a chave para permitir retry
    await db.idempotency_keys.delete({ where: { key } })
    throw error
  }
}
```

**Integração:**
- T04 (Channel Adapters) usa esse middleware em todos os webhooks
- Chave: `${channel}:${channel_message_id}`
- TTL de 24h

**Job de limpeza:**
Adicionar ao Job 8 (cleanup de buckets) também limpar `idempotency_keys` expirados.

**Critério de conclusão:**
- Webhook com mesmo channel_message_id 2x → processa 1x
- Resposta consistente em retries
- TTL expira corretamente

---

### TAREFA 31 — Retry policy + Circuit breaker para APIs externas
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/external-api-resilience`  
**Quando:** Bloco 4 (paralelo com T07, T08, T09)  
**Cobre gap:** #17  
**Prioridade:** **CRÍTICA**

**O que fazer:**
Implementar retry com exponential backoff e circuit breaker para todas as APIs externas (Anthropic, OpenAI, YCloud, ZAPI, Evolution).

**Por que é crítico:**
APIs falham com frequência — rate limit transitório, timeout, 5xx. Sem retry:
- Cliente recebe "Tive problema técnico" 50% mais que o necessário
- Falhas pontuais viram experiência ruim

**Entregáveis:**
- `/lib/resilience/retry.ts` — withRetry(fn, options)
- `/lib/resilience/circuit-breaker.ts` — withCircuitBreaker(service, fn)
- `/lib/resilience/external-clients.ts` — wrappers tipados para cada API

**Retry policy:**
```typescript
interface RetryOptions {
  max_attempts: number          // default 3
  initial_delay_ms: number       // default 500
  max_delay_ms: number           // default 5000
  backoff_factor: number         // default 2 (exponential)
  retryable_errors: (e: Error) => boolean
  on_retry?: (attempt: number, error: Error) => void
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: Error
  for (let attempt = 1; attempt <= options.max_attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!options.retryable_errors(error)) throw error
      if (attempt === options.max_attempts) throw error
      
      const delay = Math.min(
        options.initial_delay_ms * Math.pow(options.backoff_factor, attempt - 1),
        options.max_delay_ms
      )
      // Adiciona jitter (±25%)
      const jitter = delay * (0.75 + Math.random() * 0.5)
      
      options.on_retry?.(attempt, error)
      await sleep(jitter)
    }
  }
  throw lastError
}
```

**Erros retryable (por API):**
```typescript
const ANTHROPIC_RETRYABLE = (e: Error) => {
  if (e.status === 429) return true  // rate limit
  if (e.status >= 500) return true   // server error
  if (e.code === 'ETIMEDOUT') return true
  if (e.code === 'ECONNRESET') return true
  return false
}
```

**Circuit breaker por serviço:**
```typescript
type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreaker {
  service: string                // 'anthropic' | 'openai' | 'ycloud' | etc
  state: CircuitState
  failures: number
  threshold: number              // default 5
  timeout_ms: number             // default 30000 (30s antes de tentar half-open)
}

// closed → 5 falhas → open (rejeita requests imediato por 30s) → half-open → sucesso → closed
```

**Integração:**
- Wrapper para Anthropic API com retry + circuit breaker
- Wrapper para OpenAI Whisper com retry + circuit breaker  
- Wrapper para Channel APIs (YCloud, ZAPI, Evolution) com retry + circuit breaker
- T07 (mídia), T08 (knowledge), T12 (planner), T13 (executor), T14 (monitor) usam esses wrappers

**Critério de conclusão:**
- API com 1 falha transitória → retry → sucesso
- API com 5 falhas seguidas → circuit aberto, rejeita imediato
- Após 30s, half-open testa novamente
- Latência total respeita limite (max_attempts × max_delay_ms)

---

## AJUSTES EM TAREFAS EXISTENTES

### Ajuste T01 — Adicionar seeds e rollback (gap #20)

**O que adicionar:**
```
- /supabase/seed.sql — dados de teste para desenvolvimento
  - 1 workspace de teste (barbearia)
  - 1 agent_config
  - 5 produtos
  - 1 fluxo de exemplo com 5 nodes
  - Knowledge base com 4 tags globais
  - 3 clientes de teste com memória populada
  
- /supabase/migrations/rollback_template.md — instruções para reverter

- Adicionar comando `npm run db:seed` no package.json
```

**Atualizar critério de conclusão:**
- Adicionar: "Após `npm run db:seed`, dados de teste populados"
- Adicionar: "Cada migration tem comentário com a query de rollback"

---

### Ajuste T03 — Connection pooling + flow_version helpers (gaps #11 e #18)

**O que adicionar:**

1. **Connection pooling no client.ts:**
```typescript
import { createClient } from '@supabase/supabase-js'

// Em vez de createClient direto, usar pgbouncer/pooler URL
const SUPABASE_URL = process.env.NODE_ENV === 'production'
  ? process.env.SUPABASE_POOLER_URL  // pooler para produção
  : process.env.SUPABASE_DIRECT_URL   // direct para dev
  
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'public' },
  auth: { persistSession: false },  // server-side
  global: {
    fetch: customFetch  // com timeout
  }
})
```

2. **Helpers de flow versioning em flows.ts:**
```typescript
async function getFlowAtVersion(flow_id: string, version: number): Promise<Flow>
async function getActiveFlow(workspace_id: string): Promise<Flow>  // sempre versão atual ativa
async function getFlowForSession(session_id: string): Promise<Flow>  // versão fixada na sessão
```

---

### Ajuste T06 — Classificador LLM de prompt injection (gap #10)

**O que adicionar:**

Manter o regex como primeira camada (rápido, barato), adicionar Claude Haiku como segunda camada para casos ambíguos:

```typescript
async function filterInput(message: string): Promise<FilterResult> {
  // CAMADA 1: Regex (rápido)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(message)) {
      return { safe: false, layer: 'regex', pattern_matched: pattern.toString() }
    }
  }
  
  // CAMADA 2: Classificador LLM (apenas se mensagem suspeita)
  const suspicionScore = calculateSuspicionScore(message)
  if (suspicionScore > 0.5) {
    const classification = await classifyWithClaude(message)
    if (classification.is_injection_attempt) {
      return { safe: false, layer: 'llm', confidence: classification.confidence }
    }
  }
  
  return { safe: true }
}
```

**Heurísticas para suspicion score:**
- Mensagem com >500 chars
- Mensagem em inglês quando workspace é pt-BR
- Mensagem com palavras técnicas ("system", "instructions", "prompt", "model")
- Mensagem com formatação estranha (muitos caracteres especiais)

---

### Ajuste T09 — Estrutura completa de memória episódica (gap #4)

**O que adicionar:**

Estrutura completa conforme SPEC linha 599-612:
```typescript
interface ClientEpisodicMemory {
  id: string
  client_id: string
  workspace_id: string
  conversation_excerpt: string      // trecho completo da conversa
  excerpt_summary: string           // resumo curto (~50 chars)
  topic_tags: string[]              // ex: ["loiro", "preco", "objecao"]
  embedding: number[]               // vector(1536)
  occurred_at: Date
}
```

**Geração de excerpt + summary + tags:**
```typescript
async function extractEpisodes(messages: Message[]): Promise<EpisodeData[]> {
  // Claude Haiku analisa a conversa e identifica trechos relevantes
  // Para cada trecho: gera summary curto, identifica topic_tags
  // Retorna array (uma conversa pode gerar múltiplos episódios)
}
```

**Critérios para considerar trecho relevante:**
- Tool call executada (decisão importante)
- Cliente expressou objeção
- Cliente fez pergunta sobre produto/preço
- Cliente mencionou problema/dor

---

### Ajuste T12 — Estado nested + categoria FRUSTRATION (gaps #5 e #6)

**O que adicionar:**

1. **4º estado de digressão:**
```typescript
type DigressionState = 
  | 'none'
  | 'active'        // 1 nível de digressão
  | 'nested'        // digressão dentro de digressão (até 3 níveis)
  | 'resuming'
```

2. **Stack de objetivos pendentes:**
```typescript
interface SessionDigressionContext {
  state: DigressionState
  objective_stack: ObjectivePending[]  // LIFO, max 3 itens
  current_topic: string
}
```

3. **Categoria FRUSTRATION na classificação:**
```typescript
type MessageClassification = 
  | 'ON_TOPIC'
  | 'DIGRESSION'
  | 'CHITCHAT'
  | 'ESCALATION'
  | 'CANCELLATION'
  | 'FRUSTRATION'   // novo
```

4. **Comportamento por classificação:**
```typescript
case 'FRUSTRATION':
  // Não muda o fluxo, mas alimenta Monitor com flag
  decision.action = 'respond'  // continua normalmente
  decision.frustration_signal = true  // Monitor usa como input
  break
```

5. **Limite de profundidade:**
```typescript
if (objective_stack.length >= 3) {
  // Não permite 4ª digressão — força resume da última
  return { action: 'resume', ... }
}
```

---

### Ajuste T13 — ReAct multi-turn no Executor (gap #12)

**O que adicionar:**

Atualmente meu T13 implementa "execute uma vez". Mas o Executor pode precisar encadear múltiplas tools antes de responder.

Exemplo: cliente pede agendamento → executor precisa (1) buscar histórico do cliente, (2) buscar horários livres, (3) confirmar com cliente. Cada tool resulta em mais informação para a próxima.

**Loop ReAct:**
```typescript
async function executeWithToolLoop(
  decision: PlannerDecision,
  context: PromptContext,
  max_iterations: number = 5
): Promise<ExecutorResult> {
  let iterations = 0
  let toolResults: ToolResult[] = []
  
  while (iterations < max_iterations) {
    // 1. Claude Sonnet decide se chama tool ou responde
    const response = await callClaudeWithTools(context, toolResults, decision)
    
    if (response.type === 'final_response') {
      return formatExecutorResult(response, toolResults)
    }
    
    if (response.type === 'tool_call') {
      // 2. Executa tool (com hard guardrails de T11)
      const result = await executeTool(response.tool, response.params, context)
      toolResults.push(result)
      iterations++
    }
  }
  
  // Atingiu max_iterations sem resposta final — força handoff
  return forceHandoff(context, 'max_tool_iterations_exceeded')
}
```

**Limite:** 5 iterações por mensagem do cliente. Se exceder, força handoff (sinal de problema).

**Mixed-initiative (gap #13):**
Adicionar instrução explícita no prompt do Executor:
```
PROATIVIDADE:
Antes de finalizar a resposta, considere se há ação proativa relevante:
- Cliente fez agendamento? Pergunte se quer adicionar serviço complementar.
- Cliente está há > 30 dias sem visita? Mencione carinho ("senti sua falta").
- Cliente pediu serviço X mas memória mostra que sempre faz X+Y? Sugira o combo.

Aja como funcionário experiente que enxerga oportunidades, não como executor robótico.
```

---

### Ajuste T14 — Persistir em monitor_decisions (gap #2)

**O que adicionar:**

Após cada execução do Monitor, salvar decisão na tabela `monitor_decisions`:

```typescript
async function monitor(context, executorResult): Promise<MonitorReport> {
  const report = await runMonitorChecks(context, executorResult)
  
  // NOVO: persiste cada flag em monitor_decisions
  for (const flag of report.flags) {
    await db.monitor_decisions.create({
      session_id: context.session.id,
      message_id: executorResult.message_id,
      flag: flag.type,
      confidence: flag.confidence,
      details: { ...flag.details, full_report: report },
      action_taken: report.recommended_action
    })
  }
  
  return report
}
```

**Por que importa:**
- Permite análise retrospectiva de qualidade do agente
- Identifica padrões: "fluxo X gera 3x mais alucinações"
- Alimenta dashboards de qualidade

---

### Ajuste T17 — node_id em messages + flow_version (gaps #7 e #11)

**O que adicionar:**

1. **Popular node_id em todas as mensagens:**
```typescript
await saveMessage(session.id, 'user', processedContent, {
  ...inbound,
  node_id: session.current_node_id  // qual nó estava ativo
})
```

2. **Fixar flow_version na sessão:**
```typescript
async function getOrCreateSession(workspace_id, client_id, channel) {
  const existing = await getActiveSession(workspace_id, client_id, channel)
  if (existing) return existing
  
  // Sessão nova: pega versão atual do fluxo ativo
  const activeFlow = await getActiveFlow(workspace_id)
  return createSession({
    workspace_id,
    client_id,
    channel,
    flow_id: activeFlow.id,
    flow_version: activeFlow.version  // FIXA aqui
  })
}
```

3. **Buscar fluxo respeitando versão da sessão:**
```typescript
async function getFlowForSession(session: Session): Promise<Flow> {
  // Não busca a versão atual — busca a versão fixada na sessão
  return await getFlowAtVersion(session.flow_id, session.flow_version)
}
```

---

### Ajuste T22 — Detecção de anomalias (gap #9)

**O que adicionar:**

No Job 7 (Aggregator), além de agregar, detectar padrões anômalos:

```typescript
async function detectAnomalies(workspace_id: string, today_metrics: DailyMetrics) {
  const baseline = await calculateBaseline(workspace_id, last_30_days)
  
  // Detecções:
  if (today_metrics.handoff_rate > baseline.handoff_rate * 2) {
    await emitEvent('anomaly.handoff_spike', { workspace_id, today: today_metrics.handoff_rate })
  }
  
  if (today_metrics.replan_rate > baseline.replan_rate * 2) {
    await emitEvent('anomaly.replan_spike', { workspace_id })
  }
  
  if (today_metrics.total_cost_usd > baseline.avg_cost_usd * 3) {
    await emitEvent('anomaly.cost_spike', { workspace_id })
  }
  
  if (today_metrics.total_messages < baseline.avg_messages * 0.3) {
    await emitEvent('anomaly.traffic_drop', { workspace_id })
  }
}
```

**Threshold:** baseline (média móvel 30d) × multiplicador, configurável por workspace.

---

### Ajuste T25 — Trace IDs distribuídos (gap #19)

**O que adicionar:**

Trace ID precisa propagar entre componentes assíncronos (orchestrator → jobs → eventos).

**Como:**
```typescript
// 1. TraceID gerado no entry-point (webhook)
const traceId = generateTraceId()  // formato: trace_<timestamp>_<random>

// 2. Propagado em TODOS os contextos:
context.trace_id = traceId

// 3. Salvo em sessions (campo novo): current_trace_id
// 4. Passado em todos os events emitidos: payload.trace_id
// 5. Logado em todas as operações
// 6. Quando job processa: lê trace_id da sessão/evento e continua
```

**Migration adicional:**
```sql
ALTER TABLE sessions ADD COLUMN current_trace_id TEXT;
ALTER TABLE crm_events ADD COLUMN trace_id TEXT;
ALTER TABLE messages ADD COLUMN trace_id TEXT;
ALTER TABLE audit_logs ADD COLUMN trace_id TEXT;
```

**Visualização:**
Endpoint de debug:
```
GET /api/admin/trace/:trace_id
→ retorna timeline completa: webhook → planner → tools → executor → monitor → response
```

---

## Visão Atualizada dos Blocos

```
BLOCO 1 — FUNDAÇÃO                                            [sequencial]
└── T01 (+ seed e rollback)

BLOCO 2 — INFRAESTRUTURA BASE                                 [paralelo: 3 agentes]
├── T02
├── T03 (+ pooling + flow_version helpers)
└── T04

BLOCO 3 — HARD GUARDRAILS — INPUT LAYER                       [paralelo: 3 agentes]
├── T05
├── T06 (+ classificador LLM)
└── T30 — NOVA: Idempotência de webhooks ⚠️ CRÍTICA

BLOCO 4 — PRÉ-PROCESSAMENTO E KNOWLEDGE                       [paralelo: 5 agentes]
├── T07
├── T08
├── T09 (+ topic_tags, excerpt_summary)
├── T28 — NOVA: Cross-channel unification
└── T31 — NOVA: Retry + Circuit Breaker external APIs ⚠️ CRÍTICA

BLOCO 5 — CONSTRUÇÃO DO PROMPT E TOOLS                        [paralelo: 3 agentes]
├── T10
├── T11
└── T27 — NOVA: Versionamento de fluxos (snapshots)

BLOCO 6 — CÉREBRO DO MOTOR                                    [sequencial]
├── T12 (+ nested + FRUSTRATION)
├── T13 (+ ReAct multi-turn + mixed-initiative)
└── T14 (+ persistir monitor_decisions)

BLOCO 7 — HARD GUARDRAILS — OUTPUT LAYER                      [paralelo: 2 agentes]
├── T15
└── T16

BLOCO 8 — ORQUESTRADOR PRINCIPAL                              [paralelo: 2 + sequencial]
├── T17 (+ node_id messages + flow_version sessions)
├── T18
└── T29 — NOVA: Endpoints administrativos (paralelo a T18)

BLOCO 9 — JOBS ASSÍNCRONOS                                    [paralelo: 4 agentes]
├── T19
├── T20 (+ topic_tags na geração episódica)
├── T21
└── T22 (+ detecção de anomalias)

BLOCO 10 — TESTES, HARDENING E GOVERNANCE                     [misto]
├── T23 (+ cenários para idempotência, retry, cross-channel)
├── T24
├── T25 (+ trace IDs distribuídos)
└── T26
```

**Total revisado:** 31 tarefas (era 26), 10 blocos.

**Tempo adicional:** ~2 sessões a mais (~14-17 sessões total).

---

## Tabela Atualizada de Modelos por Tarefa

| Tarefas | Modelo | Quantidade |
|---|---|---|
| T01, T04, T07, T08, T09, T10, T11, T13, T14, T15, T16, T17, T18, T23, T24, T26, T27, T28, T30, T31 | **Sonnet** | 20 |
| T12 | **Opus** | 1 |
| T02, T03, T05, T06, T19, T20, T21, T22, T25, T29 | **Haiku** | 10 |

---

## O que NÃO foi adicionado (e por quê)

**Gap #14 — WARPP-style runtime personalization:**
Diferencial competitivo, não MVP. Adicione no roadmap pós-MVP.

**Gap #15 — Topic-shift detector dedicado (XLNet):**
Embutido no Planner é OK no MVP. Se o Monitor identificar que digressão está mal detectada, criar componente dedicado depois.

---

## Status Final — Cobertura

Após adicionar essas 5 novas tarefas + 9 ajustes:

| Categoria do SPEC | Coberto? |
|---|---|
| Filosofia + 4 camadas | ✅ |
| 5 tipos de nó | ✅ |
| Knowledge tags + RAG | ✅ |
| Construção de system prompt | ✅ |
| Mecanismo de digressão (4 estados) | ✅ (após ajuste T12) |
| Memória dual completa | ✅ (após ajuste T09 e T20) |
| Processamento de mídia | ✅ |
| Schema completo (incluindo monitor_decisions, idempotency_keys, snapshots) | ✅ (após T01 + T30) |
| Integração de canais (3 canais + cross-channel) | ✅ (após T28) |
| Eventos CRM (incluindo monitor.* e cost.*) | ✅ |
| 8 jobs assíncronos | ✅ |
| API Routes completos | ✅ (após T29) |
| 8 hard guardrails | ✅ |
| Monitor com persistência | ✅ (após ajuste T14) |
| Versionamento básico | ✅ (após T27) |
| Idempotência | ✅ (após T30) |
| Resilência (retry + circuit breaker) | ✅ (após T31) |
| Trace IDs distribuídos | ✅ (após ajuste T25) |
| Cobertura ReAct multi-turn | ✅ (após ajuste T13) |
| Mixed-initiative | ✅ (após ajuste T13) |

---

*Fim do IMPLEMENTATION_PLAN_MOTOR_GAPS.md*  
*Use junto com Part 1 e Part 2 antes de iniciar a execução.*
