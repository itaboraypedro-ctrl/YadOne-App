# HISTORY.md — Histórico detalhado do Motor de Conversação Yadone

> Arquivo de referência. Contém decisões técnicas, bloqueios e critérios de cada tarefa.  
> Para estado atual do projeto, ver STATUS.md.

---

## BLOCO 1 — Fundação

### T01 — Schema completo do banco + pgvector + seed
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:**
- 27 migrations (001–027): extensões, workspaces, knowledge, flows, clients, sessions, messages, appointments, CRM, tools, channels, timers, rate limits, cost caps, metrics, audit, idempotency, indexes, RPC functions, memory_processed
- seed.sql idempotente: 1 workspace (barbershop "Edvan"), 5 produtos, 4 knowledge tags globais, 1 fluxo com 5 nós, 3 clientes com memória, 5 tools no registry

**Decisões:**
- `objective_stack JSONB DEFAULT '[]'` em vez de `objective_pending` — stack de 3 níveis para digressão aninhada
- `session_id` em `client_episodic_memory` sem FK — episódios sobrevivem à exclusão de sessões
- Migration 021 renomeada para `021_metrics.sql` (engloba `usage_metrics` + `daily_metrics`)

---

## BLOCO 2 — Infraestrutura Base

### T02 — Types e interfaces TypeScript globais
**Data:** 2026-05-06 | **Agente:** Claude Sonnet (orquestrador direto)

**Implementado:** 14 arquivos em /types/ cobrindo todos os domínios: workspace, flow (discriminated union 5 nós), session (4 estados digressão, 6 classificações, objective_stack), message, client, memory, crm, tools (3 classes de erro throwable), knowledge, channel, monitor, guardrails, metrics, planner.

**Decisões:**
- Timestamps como `string` ISO 8601 (não `Date`) — supabase-js retorna strings
- `FlowNode` como discriminated union — type-narrowing automático no Planner/Executor
- 3 classes de erro em tools.ts (`ToolNotAuthorizedError`, `InvalidParamsError`, `CircuitBreakerOpenError`) — únicas exceções a "só types"

### T03 — Supabase client + helpers de banco
**Data:** 2026-05-06 | **Agente:** Claude Sonnet (orquestrador direto)

**Implementado:** 17 helpers em /lib/db/ + Migration 026 adicional (RPC functions para vector search via `<=>` operator).

**Decisões:**
- Tipos inline com TODO de migrar para /types/ (T02 rodou em paralelo)
- Migration 026 adicional: `vector_search_episodes` e `vector_search_chunks` como funções PG

### T04 — Channel Adapters (YCloud + ZAPI + Evolution)
**Data:** 2026-05-06 | **Agente:** Claude Sonnet (orquestrador direto)

**Implementado:** 3 adapters + factory + 3 webhook routes com signature validation, typing simulation (≈50 chars/s, clamp 1000-3000ms).

**Decisões:**
- Identificação de workspace via phone_number do payload (não workspace_id no path)
- Credenciais em plaintext — descriptografia AES-256-GCM implementada separadamente em T06

---

## BLOCO 3 — Guardrails Input

### T05 — Rate Limiter + Cost Cap + Circuit Breaker
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:** Sliding window 60msg/h por (workspace+phone), cost cap warning 80%/block 100%, circuit breaker sessão (3 replans → handoff) e tools (3 falhas em 5min → open 5min). State em memória (Map) — single-process MVP.

### T06 — Webhook Signature + Content Filter + Credential Cipher
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:** HMAC-SHA256 por canal, content filter em 2 camadas (regex + Claude Haiku se suspicion_score > 0.5), AES-256-GCM com ENCRYPTION_KEY.

### T30 — Idempotência de webhooks
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:** `withIdempotency<T>()` + `processWebhookOnce()`. Race detection via 23505. Integrado nos 3 webhooks.

---

## BLOCO 4 — Pré-processamento e Knowledge

### T07 — Pré-processador de mídia
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:** Whisper (áudio OGG → texto pt-BR), Claude Vision (imagem + PDF nativo), processor orquestrando com prefixos `[ÁUDIO TRANSCRITO]`, `[IMAGEM RECEBIDA]`, `[DOCUMENTO RECEBIDO]`. Skip graceful sem API keys.

### T08 — Knowledge Base + RAG semântico
**Data:** 2026-05-06 | **Agente:** Claude Opus

**Implementado:** text-embedding-3-small + cache LRU (SHA-256, capacidade 1000), chunker cl100k_base (500 tokens, overlap 50), fetcher híbrido (<2k tokens direto, >2k RAG top-3), indexer + CRUD API.

### T09 — Memória do cliente
**Data:** 2026-05-06 | **Agente:** Claude Opus

**Implementado:** Semântica (preferred_name, preferences, last_service, observations) + episódica (excerpt_summary, topic_tags, embedding). Extractor via Claude Sonnet 4.6. Helper local embedText com TODO de dedup com T08.

### T28 — Cross-channel client unification
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:** Estratégias phone/email/manual_link/disabled. normalizePhone. mergeClients move messages, sessions, episodic; política conservadora em semântica (primary ganha). Política 'phone' hardcoded (TODO coluna em workspace).

**Decisão:** Secondary preservado com `unified_id` para auditoria (não deletado).

### T31 — Retry + Circuit Breaker para APIs externas
**Data:** 2026-05-06 | **Agente:** Claude Sonnet (orquestrador direto)

**Implementado:** `retryWithBackoff` (exponential backoff + jitter), `withBreaker` (5 falhas → open 30s → half-open), wrappers `anthropicClient.complete`, `openaiClient.embed/transcribe`, `channelClient.send`.

---

## BLOCO 5 — Prompt e Tools

### T10 — Construtor de System Prompt
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:** `buildPromptContext` (carrega session, workspace, flow, client, memory, knowledge, history, catalog) + `buildSystemPrompt` (7 seções: identidade, cliente, catálogo, conhecimento, objetivo, histórico, comportamento).

**Decisão:** Numeração estável 1-7 com placeholders mínimos. Seção 4 (knowledge) omitida se vazia.

### T11 — Tool Registry + Executor + Authorization
**Data:** 2026-05-06 | **Agente:** Claude Opus

**Implementado:** registry (query tools_registry), authorization (default-deny via flow_tool_policies), validator (Ajv strict:false), executor (3 hard guardrails + timeout Promise.race), 5 implementations. `buscar_horarios_livres` usa stub fictício (TODO calendário real fase 2).

### T27 — Versionamento de fluxos
**Data:** 2026-05-06 | **Agente:** Claude Sonnet

**Implementado:** `createSnapshot`, `restoreFromSnapshot` (safety snapshot antes + DELETE/INSERT best-effort), `listVersions`. 3 route handlers (snapshot, rollback, versions).

**Decisão:** Restore não-atômico — safety snapshot permite re-rollback em falha parcial.

---

## BLOCO 6 — Cérebro do Motor

### T12 — Planner + Detector de Digressão
**Data:** 2026-05-06 | **Agente:** claude-opus-4-7 (único uso de Opus)

**Implementado:** `plan(ctx) → PlannerDecision` com 6 classificações (ON_TOPIC, DIGRESSION, CHITCHAT, ESCALATION, CANCELLATION, FRUSTRATION) e 8 actions. `applyDigressionRules` pure function (4 estados, stack max 3, resume forçado na 4ª). Parse JSON tolerante com fallback `re_plan`.

**Decisões:**
- Planner não persiste — Orchestrator aplica
- Tool não autorizada → `re_plan` com audit `planner.tool_not_authorized`
- FRUSTRATION sinaliza `frustration_signal: true` sem mudar action

### T13 — Executor + ReAct multi-turn + Mixed-initiative
**Data:** 2026-05-06 | **Agente:** claude-sonnet-4-6

**Implementado:** Loop ReAct max 5 iterações, 8 actions despachadas. `buildMixedInitiativeContext` injeta sinais de memória na Seção 7. `completeWithTools` adicionado ao external-clients.ts.

**Decisões:**
- `interest.product_enquiry` removido — heurística gera falsos positivos (deferido para T20)
- Mixed-initiative via `extra_behavior_hints` na Seção 7 (não apêndice ao prompt)
- Executor não persiste — Orchestrator aplica session_updates

### T14 — Monitor + persistência em monitor_decisions
**Data:** 2026-05-06 | **Agente:** claude-sonnet-4-6

**Implementado:** 5 checks (coerência+alucinação em 1 chamada LLM, loop, sentiment, low_confidence). Toda flag persistida em `monitor_decisions`. Desabilitável por env e por nó.

**Decisões:**
- Monitor NÃO incrementa `replan_count` — apenas recomenda
- Loop detector: audit_logs + fallback sessions.monitor_flags
- `message_id: null` em monitor_decisions — Orchestrator preenche depois

---

## BLOCO 7 — Guardrails Output

### T15 — Output Validator + Content Filter + Leak Detector
**Data:** 2026-05-07 | **Agente:** Claude Sonnet

**Implementado:** `validateOutput` (tamanho 1-4096, UUIDs internos, termos técnicos), `filterOutput` (16 padrões: API keys, DB errors, stack traces, path leaks, persona breaks), `detectLeaks` (UUIDs cross-tenant + telefones normalizados).

**Decisão:** Truncamento → `action='truncate'` com sanitized_text (não re_plan).

### T16 — Cost Tracker + Audit Logger
**Data:** 2026-05-07 | **Agente:** Claude Sonnet

**Implementado:** Pricing table 2026 (opus-4-7 $15/$75, sonnet-4-6 $3/$15, haiku-4-5 $1/$5, embedding $0.02, whisper $0.006/min), `trackUsage` fire-and-forget, `logAuditStructured` com AUDIT_EVENT_TYPES agrupados, `aggregateDailyMetrics`.

**Gap corrigido:** Monitor não estava trackando custo LLM — adicionado durante T17.

---

## BLOCO 8 — Orquestrador

### T17 — Orchestrator (processMessage end-to-end)
**Data:** 2026-05-07 | **Agente:** claude-opus-4-7 (orquestrador direto)

**Implementado:** Pipeline 13 passos: workspace → client → mídia → sessão → input guards → idempotency → saveMessage(user) → buildContext → plan → execute → monitor → output guards → send. Loop re-plan iterativo max 3. Try/catch global aninhado com fallback ao canal.

**Decisões:**
- Webhooks chamam `processMessage` por import direto (não fetch)
- Override determinístico ESCALATION/CANCELLATION → `action='handoff'`
- Trace ID por mensagem (sessions.current_trace_id atualizado a cada turno)
- `synthetic: true` pula input guards, mídia e saveMessage(user) — viabiliza T29
- Gap descoberto: Monitor não tinha trackUsage — corrigido aqui

### T18 — Endpoints admin
**Data:** 2026-05-07 | **Agente:** Claude Sonnet

**Implementado:** `_auth.ts` (Bearer ADMIN_TOKEN), 6 endpoints (sessions list/detail/handoff, clients, audit, cost dashboard). Paginação via `.range()`.

### T29 — Followup timer worker
**Data:** 2026-05-07 | **Agente:** Claude Sonnet

**Implementado:** `processFollowupTimers()` — verifica sessão em 'waiting', avança para target_node_id, dispara `processMessage(synthetic:true)`. `getClient(id)` adicionado em /lib/db/clients.ts.

**Decisão:** `synthetic: true` fica no input outer (ProcessMessageInput), não dentro de inbound.

---

## BLOCO 9 — Jobs Assíncronos

> Wall-clock total: **3 min** (12:14→12:17 UTC-3, 2026-05-07)  
> Subagents travaram em plan mode — orquestrador executou sequencialmente.

### T19 — Session Expirer
**Data:** 2026-05-07 | **Duração:** ~1min

**Implementado:** `processExpiredSessions()` — sessões `active` com `updated_at < now-24h` (limit 200). `updateSession({status:'expired'})` → `cancelTimersBySession` → `emitEvent('session.expired')`.

**Decisão:** `updated_at < now-24h` (não `expires_at` da SPEC — campo não populado consistentemente).

### T20 — Memory Updater + Episode Indexer
**Data:** 2026-05-07 | **Duração:** ~1min

**Implementado:** Migration 027 (`memory_processed BOOLEAN DEFAULT false`). `getHistory` estendido para `limit: number | null`. `processMemoryUpdates()` — 10 sessões/execução, extrai insights + episódios via Claude Sonnet, marca `memory_processed=true`.

**Decisões:**
- Falha antes de marcar → flag permanece false → retry natural
- `buildMemorySummary` helper local para montar `memory_summary` obrigatório
- Session interface local em sessions.ts + types/session.ts ambas atualizadas

### T21 — Knowledge Indexer
**Data:** 2026-05-07 | **Duração:** ~1min

**Implementado:** Wrapper sobre `indexAllDirty(workspace_id)` (T08). Itera workspaces ativos (limit 50) via query direta (`getActiveWorkspaces` não existe).

### T22 — Daily Aggregator + Cost Reset + Cleanup
**Data:** 2026-05-07 | **Duração:** ~1min

**Implementado:** 4 fases isoladas: agregação diária, reset mensal (dia 1 UTC), cleanup rate_limit_buckets, cleanup idempotency_keys. Consolidou jobs 6+7+8 do SPEC em 1 endpoint diário.

**Decisões:**
- `idempotency_keys.expires_at` para cleanup (não `created_at` — não existe na tabela)
- Reset mensal desbloqueia workspaces com `status='blocked_cost_cap'`

---

*STATUS.md contém o estado atual do projeto. Este arquivo é somente leitura após concluído.*
