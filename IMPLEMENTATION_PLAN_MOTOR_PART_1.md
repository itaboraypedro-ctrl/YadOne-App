# IMPLEMENTATION_PLAN_MOTOR_PART_1.md
# Plano de Orquestração Multi-Agente — Motor de Conversação (Parte 1 de 2)

> **Metodologia:** Agentic Task Decomposition com Orchestrator-Workers Pattern  
> **Spec de referência:** SPEC_MOTOR_BACKEND.md v2.0  
> **Esta parte cobre:** Blocos 1 a 4 (Fundação → Infraestrutura → Pré-processamento → Motor Central)  
> **Total de tarefas nesta parte:** 14  
> **Continuação em:** IMPLEMENTATION_PLAN_MOTOR_PART_2.md (Monitor, Hard Guardrails, Memória, Jobs, Tests)

---

## Sobre a metodologia

Esta abordagem é conhecida no mercado como:
- **Orchestrator-Workers Pattern** (nome oficial da Anthropic em "Building Effective Agents")
- **Agentic Task Decomposition** (literatura acadêmica)
- **Parallel Subagents via Git Worktrees** (prática Claude Code)

Princípios:
1. Quebrar trabalho complexo em tarefas atômicas e bem especificadas
2. Atribuir o modelo certo para cada tarefa (Haiku/Sonnet/Opus por complexidade)
3. Executar em paralelo o que não tem dependência mútua
4. Sequenciar apenas o que tem dependência real
5. Validar cada bloco antes de avançar

---

## Como usar este plano no Claude Code

### Setup inicial
```bash
# Antes de qualquer tarefa, garanta que estes arquivos estão na raiz do projeto:
- SPEC_MOTOR_BACKEND.md
- SPEC_MOTOR_GOVERNANCE.md (companion)
- IMPLEMENTATION_PLAN_MOTOR_PART_1.md (este arquivo)
- IMPLEMENTATION_PLAN_MOTOR_PART_2.md
- STATUS.md (criar vazio — você atualiza após cada tarefa)
```

### Execução em paralelo (blocos paralelos)
```bash
# Para cada tarefa do bloco paralelo, abra um worktree:
git worktree add ../motor-task-02 -b task/types-globais
git worktree add ../motor-task-03 -b task/db-helpers
git worktree add ../motor-task-04 -b task/channel-adapters

# Em cada terminal separado:
cd ../motor-task-02 && claude
cd ../motor-task-03 && claude
cd ../motor-task-04 && claude

# Após conclusão de TODAS as tarefas do bloco, mergeie na main:
git checkout main
git merge task/types-globais
git merge task/db-helpers
git merge task/channel-adapters

# Atualize STATUS.md marcando o bloco como concluído.
# Só então inicie o próximo bloco.
```

### Execução sequencial (blocos sequenciais)
```bash
# Tarefa por tarefa, sem worktree paralelo:
git checkout -b task/schema-banco
claude
# ...trabalha na tarefa...
git checkout main && git merge task/schema-banco
git checkout -b task/proxima-tarefa
```

### Regra de ouro
Só inicie o próximo bloco quando **todas** as tarefas do bloco atual estiverem mergeadas, testadas e marcadas no STATUS.md.

---

## Visão Geral dos Blocos (Parte 1)

```
BLOCO 1 — FUNDAÇÃO                                            [sequencial]
└── T01: Schema completo do banco + pgvector

BLOCO 2 — INFRAESTRUTURA BASE                                 [paralelo: 3 agentes]
├── T02: Types e interfaces TypeScript globais
├── T03: Supabase client e helpers de banco
└── T04: Channel Adapters (YCloud + ZAPI + Evolution)

BLOCO 3 — HARD GUARDRAILS — INPUT LAYER                       [paralelo: 2 agentes]
├── T05: Rate Limiter + Cost Cap + Circuit Breaker
└── T06: Webhook Signature Validator + Content Filter Input

BLOCO 4 — PRÉ-PROCESSAMENTO E KNOWLEDGE                       [paralelo: 3 agentes]
├── T07: Pré-processador de mídia (Whisper + Claude Vision)
├── T08: Sistema de Knowledge Base + RAG semântico
└── T09: Sistema de Memória do Cliente (semântica + episódica)

BLOCO 5 — CONSTRUÇÃO DO PROMPT E TOOLS                        [paralelo: 2 agentes]
├── T10: Construtor de System Prompt
└── T11: Tool Registry + Executor + Hard Guardrail (autorização)

BLOCO 6 — CÉREBRO DO MOTOR                                    [sequencial]
├── T12: Planner (Claude Haiku) + Detector de Digressão
├── T13: Executor (Claude Sonnet) + Gerador de Resposta
└── T14: Monitor (Claude Haiku) + Self-Evaluation
```

---

## BLOCO 1 — Fundação

> **Tipo:** Sequencial  
> **Por que:** Tudo depende do banco existir.  
> **Tempo estimado:** 1 sessão (~60 min)

---

### TAREFA 01 — Schema completo do banco + pgvector
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/schema-banco`

**O que fazer:**
Implementar todas as migrations conforme SPEC_MOTOR_BACKEND.md seção 9, incluindo extensão pgvector para memória episódica e RAG.

**Entregáveis:**
- `/supabase/migrations/001_extensions.sql` — habilita pgvector e uuid-ossp
- `/supabase/migrations/002_workspaces_agent_config.sql`
- `/supabase/migrations/003_knowledge_base.sql` — texto + tabela de chunks com embeddings
- `/supabase/migrations/004_products.sql`
- `/supabase/migrations/005_flows_nodes_edges.sql`
- `/supabase/migrations/006_flow_tool_policies.sql` — allowlist de tools por fluxo
- `/supabase/migrations/007_clients.sql`
- `/supabase/migrations/008_client_memory_semantic.sql`
- `/supabase/migrations/009_client_memory_episodic.sql` — com vector(1536)
- `/supabase/migrations/010_sessions.sql`
- `/supabase/migrations/011_messages.sql`
- `/supabase/migrations/012_appointments.sql`
- `/supabase/migrations/013_crm_events.sql`
- `/supabase/migrations/014_tools_registry.sql`
- `/supabase/migrations/015_channel_configs.sql`
- `/supabase/migrations/016_followup_timers.sql`
- `/supabase/migrations/017_rate_limit_buckets.sql`
- `/supabase/migrations/018_workspace_cost_caps.sql`
- `/supabase/migrations/019_usage_metrics.sql`
- `/supabase/migrations/020_audit_logs.sql`
- `/supabase/migrations/021_indexes.sql` — todos os índices, incluindo HNSW para vector

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 9 (Schema Completo do Banco) integralmente.
Implemente TODAS as tabelas como migrations do Supabase, uma por arquivo.

CRÍTICO:
1. A primeira migration habilita pgvector: CREATE EXTENSION IF NOT EXISTS vector;
2. A tabela client_memory_episodic e knowledge_chunks usam vector(1536) para embeddings OpenAI;
3. Crie índices HNSW nas colunas vector: USING hnsw (embedding vector_cosine_ops);
4. Use os tipos exatos do spec. Não adicione colunas extras.
5. Foreign keys com ON DELETE CASCADE conforme indicado.

Ao final:
- Rode `npx supabase db reset` localmente
- Confirme que todas as 20+ tabelas existem
- Confirme que pgvector está habilitado
```

**Critério de conclusão:**
- `npx supabase db push` sem erros
- Query `SELECT * FROM pg_extension WHERE extname = 'vector';` retorna 1 linha
- Todas as tabelas visíveis no Supabase Studio

---

## BLOCO 2 — Infraestrutura Base

> **Tipo:** Paralelo (3 agentes simultâneos)  
> **Dependência:** Bloco 1 concluído  
> **Tempo estimado:** 1 sessão paralela (~75 min)

---

### TAREFA 02 — Types e interfaces TypeScript globais
**Agente:** Claude Haiku  
**Effort:** Médio  
**Branch:** `task/types-globais`  
**Pode rodar com:** T03, T04

**O que fazer:**
Criar todas as interfaces TypeScript do projeto baseadas no SPEC v2.0.

**Entregáveis:**
- `/types/workspace.ts` — Workspace, WorkspaceAgentConfig, WorkspaceCostCap
- `/types/flow.ts` — Flow, FlowNode (todos os 5 tipos), FlowEdge, FlowToolPolicy
- `/types/session.ts` — Session, DigressionState, CollectedData, ObjectivePending
- `/types/message.ts` — InboundMessage, OutboundMessage, Message
- `/types/client.ts` — Client
- `/types/memory.ts` — ClientMemorySemantic, ClientMemoryEpisodic
- `/types/crm.ts` — CRMEvent, CRMEventType (lista completa do spec seção 11)
- `/types/tools.ts` — ToolDefinition, ToolExecutionResult, AvailableTools
- `/types/knowledge.ts` — KnowledgeBase, KnowledgeChunk, KnowledgeTag
- `/types/channel.ts` — ChannelAdapter (interface), ChannelConfig
- `/types/monitor.ts` — MonitorReport, MonitorAction, MonitorFlag
- `/types/guardrails.ts` — RateLimitBucket, CostCapStatus, CircuitBreakerState
- `/types/metrics.ts` — UsageMetric, AuditLog
- `/types/planner.ts` — PlannerDecision, PlannerAction, PlannerInput

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 3, 9, 10, 11, 14, 15.
Crie os arquivos de tipos TypeScript em /types/.
Cada interface deve refletir EXATAMENTE o schema do banco e as interfaces do spec.
Não implemente lógica — apenas tipos. Exporte tudo com `export`.

ATENÇÃO ESPECIAL:
- Vector columns: number[] (representação JS do vector PG)
- Timestamps: Date
- JSONB columns: defina interfaces específicas, não use 'any'
- Enums (status, role, type): use union types literais ('active' | 'completed' | ...)
```

**Critério de conclusão:**
- `npx tsc --noEmit` sem erros
- 14 arquivos criados em `/types/`
- Todas as interfaces do spec representadas

---

### TAREFA 03 — Supabase client e helpers de banco
**Agente:** Claude Haiku  
**Effort:** Médio  
**Branch:** `task/db-helpers`  
**Pode rodar com:** T02, T04

**O que fazer:**
Criar camada de acesso ao banco com funções tipadas para cada tabela principal.

**Entregáveis:**
- `/lib/db/client.ts` — cliente Supabase singleton (server-side)
- `/lib/db/workspaces.ts` — getWorkspace, getAgentConfig
- `/lib/db/flows.ts` — getActiveFlow, getFlowNodes, getFlowEdges, getFlowToolPolicies
- `/lib/db/sessions.ts` — getSession, createSession, updateSession, expireSession
- `/lib/db/messages.ts` — saveMessage, getHistory(limit)
- `/lib/db/clients.ts` — getOrCreateClient, updateClient
- `/lib/db/memory.ts` — getMemorySemantic, upsertMemorySemantic, getMemoryEpisodic, insertMemoryEpisodic, vectorSearch
- `/lib/db/knowledge.ts` — getKnowledgeByTags, getGlobalKnowledge, getKnowledgeChunks, vectorSearchChunks
- `/lib/db/crm-events.ts` — emitEvent, getUnprocessedEvents, markProcessed
- `/lib/db/followup-timers.ts` — createTimer, getPendingTimers, fireTimer
- `/lib/db/rate-limits.ts` — incrementBucket, getBucketState, resetExpiredBuckets
- `/lib/db/cost-caps.ts` — getCostCap, recordUsage, checkCapStatus
- `/lib/db/audit.ts` — logAudit (entry-point para audit_logs)
- `/lib/db/metrics.ts` — recordMetric (entry-point para usage_metrics)

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 9 (todo o schema).
Crie funções de acesso ao banco em /lib/db/ usando @supabase/supabase-js.

REGRAS:
1. Cada função tipada com as interfaces de /types/ (criadas em T02)
2. async/await sempre
3. Erros: throw com mensagem clara
4. Não embuta lógica de negócio — apenas queries
5. Para vector search: use o operador <=> (cosine distance) com LIMIT
6. RPC para queries complexas: crie functions PG quando precisar (ex: vector search com filtro)

Para a função vectorSearch (memória episódica):
- Recebe: client_id, query_embedding (number[]), top_k (default 3)
- Retorna: ClientMemoryEpisodic[] ordenado por similaridade
```

**Critério de conclusão:**
- 14 arquivos criados em `/lib/db/`
- Todas as funções tipadas
- Sem lógica de negócio embutida

---

### TAREFA 04 — Channel Adapters (YCloud + ZAPI + Evolution)
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/channel-adapters`  
**Pode rodar com:** T02, T03

**O que fazer:**
Implementar os três adapters de canal conforme Seção 10 do SPEC.

**Entregáveis:**
- `/lib/channels/types.ts` — interface ChannelAdapter (já em /types, importar e reexportar se necessário)
- `/lib/channels/ycloud.ts` — YCloudAdapter (send + parse + downloadMedia + signature validation)
- `/lib/channels/zapi.ts` — ZAPIAdapter
- `/lib/channels/evolution.ts` — EvolutionAdapter
- `/lib/channels/factory.ts` — `getChannelAdapter(workspace_id)` retorna adapter correto
- `/app/api/webhooks/ycloud/route.ts` — webhook YCloud (POST)
- `/app/api/webhooks/zapi/route.ts` — webhook ZAPI
- `/app/api/webhooks/evolution/route.ts` — webhook Evolution

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 10 (Integração de Canais) e 14.6 (Webhook Signature Validation).
Implemente os três channel adapters seguindo a interface ChannelAdapter.

PARA CADA ADAPTER:
1. Método send(to, message): envia mensagem (texto, mídia)
2. Método parseInbound(payload): converte payload do canal em InboundMessage
3. Método downloadMedia(url): baixa áudio/imagem/doc do canal
4. Método validateSignature(headers, body): valida HMAC/token (YCloud usa HMAC-SHA256)

WEBHOOKS:
- Recebe POST do canal
- Valida signature ANTES de processar (rejeita 401 se inválida)
- Chama internamente /api/engine/process
- Retorna 200 imediatamente (processamento async se demorar)
- Simule typing_delay de 1-3s antes de enviar resposta (baseado no tamanho)

CREDENCIAIS:
- Buscadas de channel_configs (criptografadas — descriptografia será implementada em outra task, por agora use plaintext)
```

**Critério de conclusão:**
- Webhook YCloud recebe mensagem de teste e loga corretamente
- Signature validation rejeita request inválido
- Send envia mensagem e recebe response 200 do canal

---

## BLOCO 3 — Hard Guardrails — Input Layer

> **Tipo:** Paralelo (2 agentes simultâneos)  
> **Dependência:** Bloco 2 concluído  
> **Por que vem agora:** O SPEC v2.0 explicita que hard guardrails são camada **transversal** que protege todas as outras. Implementar antes do motor garante que cada componente já nasce protegido.  
> **Tempo estimado:** 1 sessão paralela (~45 min)

---

### TAREFA 05 — Rate Limiter + Cost Cap + Circuit Breaker
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/guardrails-throttle`  
**Pode rodar com:** T06

**O que fazer:**
Implementar as proteções de runtime relacionadas a volume e custo, conforme SPEC seções 14.3, 14.4, 14.5.

**Entregáveis:**
- `/lib/guardrails/rate-limiter.ts` — checkRateLimit(workspace_id, phone, scope) → boolean
- `/lib/guardrails/cost-cap.ts` — checkCostCap(workspace_id) → CostCapStatus
- `/lib/guardrails/circuit-breaker.ts` — checkBreaker(workspace_id, scope) → boolean, recordFailure
- `/lib/guardrails/index.ts` — orchestrator: runInputGuards(message, workspace_id)

**Limites default:**
```typescript
const RATE_LIMITS = {
  per_phone_hour: 60,
  per_workspace_day: 10000,
  per_tool_minute: 30  // configurável em tools_registry
}

const CIRCUIT_BREAKER = {
  max_replans_per_session: 3,
  tool_failures_before_disable: 3,
  tool_disable_duration_minutes: 5
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 14.3, 14.4, 14.5.
Implemente os 3 guardrails em /lib/guardrails/.

RATE LIMITER:
- Usa tabela rate_limit_buckets (sliding window)
- 3 escopos: phone+hour, workspace+day, tool+minute
- Retorna true se OK, false se excedeu

COST CAP:
- Lê workspace_cost_caps (limite mensal em USD)
- Soma usage_metrics do mês corrente
- Retorna { current_usd, cap_usd, percentage, status: 'ok' | 'warning' | 'blocked' }
- 80% → emite evento cost.threshold_warning (via emitEvent)
- 100% → bloqueia novas mensagens

CIRCUIT BREAKER:
- Sessões com replan_count >= 3: força handoff
- Tools com 3 falhas em sequência: desabilita por 5 min (em memória + cache)

ORCHESTRATOR runInputGuards:
- Roda os 3 em sequência
- Retorna { allowed: boolean, reason?: string }
- Se bloqueado: registra audit_log e emite evento
```

**Critério de conclusão:**
- 60 mensagens em 1 hora do mesmo número → 61ª bloqueada
- Workspace com 100% do cap → bloqueia próxima mensagem
- Sessão com 3 replans → força handoff

---

### TAREFA 06 — Webhook Signature Validator + Content Filter Input
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/guardrails-content`  
**Pode rodar com:** T05

**O que fazer:**
Implementar validação de assinatura de webhooks e filtro de conteúdo de input, conforme SPEC 14.6 e 14.7.

**Entregáveis:**
- `/lib/guardrails/signature-validator.ts` — validateSignature(channel, headers, body)
- `/lib/guardrails/content-filter-input.ts` — filterInput(message_text) → FilterResult
- `/lib/guardrails/credential-cipher.ts` — encrypt(plaintext), decrypt(ciphertext)
- Integração nos webhooks (T04) para chamar antes de processar

**Padrões bloqueados pelo Content Filter (Input):**
```typescript
const BLOCKED_PATTERNS = [
  /ignore (previous|all|the above) instructions/i,
  /forget (everything|all|previous)/i,
  /you are now/i,
  /system prompt/i,
  /reveal (your|the) prompt/i,
  /print (your|the) instructions/i,
  // Padrões de extração de credenciais
  /api[_\s]?key/i,
  /password/i,
  // Adicione conforme necessário
]
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 14.6, 14.7.
Implemente em /lib/guardrails/.

SIGNATURE VALIDATOR:
- YCloud: HMAC-SHA256 do body com secret do channel_config
- ZAPI: token simples no header
- Evolution: API key no header
- Função única validateSignature(channel, headers, body) → boolean

CONTENT FILTER (Input):
- Lista de regex patterns
- Se match: retorna { safe: false, pattern_matched, response: "Não posso ajudar com isso." }
- Logue todos os blocks em audit_logs (sem o conteúdo, só o pattern)

CREDENTIAL CIPHER:
- AES-256-GCM
- Key da env var ENCRYPTION_KEY (32 bytes)
- encrypt(plain) → base64 ciphertext
- decrypt(cipher) → plain
- Use Node crypto module
```

**Critério de conclusão:**
- Webhook YCloud sem signature → 401
- Webhook YCloud com signature válida → 200
- Mensagem com "ignore previous instructions" → bloqueada antes do LLM
- Credential ciphertext descriptografa corretamente

---

## BLOCO 4 — Pré-processamento e Knowledge

> **Tipo:** Paralelo (3 agentes simultâneos)  
> **Dependência:** Blocos 1, 2, 3 concluídos  
> **Tempo estimado:** 1 sessão paralela (~75 min)

---

### TAREFA 07 — Pré-processador de mídia
**Agente:** Claude Sonnet  
**Effort:** Médio  
**Branch:** `task/media-processor`  
**Pode rodar com:** T08, T09

**O que fazer:**
Implementar processamento de áudio (Whisper) e imagem/documento (Claude Vision).

**Entregáveis:**
- `/lib/media/audio.ts` — downloadAudio, transcribeWithWhisper
- `/lib/media/vision.ts` — describeWithVision (imagem), parseDocument (PDF/doc)
- `/lib/media/processor.ts` — processInboundMedia(message) → string

**Lógica de processInboundMedia:**
```typescript
async function processInboundMedia(message: InboundMessage): Promise<string> {
  if (message.media_type === 'text') return message.content
  
  if (message.media_type === 'audio') {
    const audio = await downloadAudio(message.media_url)
    const transcription = await transcribeWithWhisper(audio)
    return `[ÁUDIO TRANSCRITO]: ${transcription}`
  }
  
  if (message.media_type === 'image') {
    const description = await describeWithVision(message.media_url, workspace.segment)
    return `${message.content || ''}\n[IMAGEM RECEBIDA]: ${description}`.trim()
  }
  
  if (message.media_type === 'document') {
    const content = await parseDocument(message.media_url)
    return `${message.content || ''}\n[DOCUMENTO RECEBIDO]: ${content}`.trim()
  }
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 8 (Processamento de Mídia).
Implemente em /lib/media/.

ÁUDIO (Whisper):
- OpenAI API: model whisper-1, language pt, response_format text
- Endpoint: https://api.openai.com/v1/audio/transcriptions
- Suporta OGG (formato WhatsApp)

IMAGEM/DOC (Claude Vision):
- Anthropic API com claude-sonnet-4-5
- Prompt: "Descreva o conteúdo desta mídia de forma estruturada,
  focando em informações relevantes para atendimento em {workspace.segment}.
  Inclua textos visíveis, elementos principais e qualquer informação relevante."
- Para PDF: converta para imagens primeiro (use pdf-to-image lib) ou use Claude direto se suportar

PREFIX:
- Áudio: "[ÁUDIO TRANSCRITO]: ..."
- Imagem: "[IMAGEM RECEBIDA]: ..."
- Doc: "[DOCUMENTO RECEBIDO]: ..."

Múltiplas mídias: concatena todas com \n
```

**Critério de conclusão:**
- Áudio OGG → texto transcrito
- Imagem JPG → descrição estruturada
- PDF → texto extraído
- Texto puro → passa direto

---

### TAREFA 08 — Sistema de Knowledge Base + RAG semântico
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/knowledge-rag`  
**Pode rodar com:** T07, T09

**O que fazer:**
Implementar busca de conhecimento por tags e RAG semântico para bases grandes.

**Entregáveis:**
- `/lib/knowledge/fetcher.ts` — getKnowledgeForNode(node_id, workspace_id, query?)
- `/lib/knowledge/global.ts` — getGlobalKnowledge(workspace_id)
- `/lib/knowledge/formatter.ts` — formatKnowledgeForPrompt(items, max_tokens)
- `/lib/knowledge/embeddings.ts` — generateEmbedding(text), batchEmbeddings(texts)
- `/lib/knowledge/chunker.ts` — chunkText(text, chunk_size, overlap)
- `/lib/knowledge/indexer.ts` — indexKnowledge(workspace_id, kb_id) — chunka + gera embeddings + salva
- `/app/api/knowledge/route.ts` — CRUD de knowledge base
- `/app/api/knowledge/[id]/index/route.ts` — endpoint para reindexar

**Lógica de getKnowledgeForNode:**
```typescript
async function getKnowledgeForNode(
  node_id: string,
  workspace_id: string,
  query?: string  // mensagem atual do cliente, para RAG
): Promise<string> {
  // 1. Busca tags associadas ao nó
  const tags = await getNodeKnowledgeTags(node_id)
  
  // 2. Busca itens globais (@workspace.profile, .persona, .rules, .catalog)
  const globalItems = await getGlobalKnowledge(workspace_id)
  
  // 3. Para cada tag:
  //    a. Se conteúdo total < 2k tokens: pega tudo (sem RAG)
  //    b. Se > 2k tokens E query disponível: RAG (top-3 chunks por similaridade)
  //    c. Se > 2k tokens sem query: pega o resumo (primeiro chunk de cada item)
  const tagContent = await fetchTagContent(workspace_id, tags, query)
  
  // 4. Formata e retorna
  return formatKnowledgeForPrompt([...globalItems, ...tagContent])
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 4 e 5 (knowledge tags e RAG semântico).
Implemente em /lib/knowledge/.

EMBEDDING:
- OpenAI text-embedding-3-small (1536 dimensões)
- Endpoint: https://api.openai.com/v1/embeddings
- Cache de embeddings em memória (LRU 1000 entries)

CHUNKING:
- Chunks de 500 tokens com overlap de 50
- Use a lib `js-tiktoken` para contar tokens (model cl100k_base)

INDEXAÇÃO:
- Pega texto completo do knowledge_base item
- Chunka
- Gera embedding de cada chunk
- Salva em knowledge_chunks com kb_id, content, embedding

GETKNOWLEDGEFORNODE:
- Estratégia híbrida: textos pequenos vão diretos, grandes usam RAG
- RAG só ativa se query (mensagem do cliente) disponível
- Sempre inclui knowledge global do workspace

FORMATAÇÃO:
- Respeita knowledge_tags_limit em tokens
- Estrutura: ### {title}\n{content}\n\n---\n\n
```

**Critério de conclusão:**
- KB pequena (< 2k tokens) retorna todo o conteúdo
- KB grande (> 2k tokens) com query retorna top-3 chunks relevantes
- Indexação processa um item de 10k tokens corretamente

---

### TAREFA 09 — Sistema de Memória do Cliente (semântica + episódica)
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/client-memory`  
**Pode rodar com:** T07, T08

**O que fazer:**
Implementar memória dual do cliente conforme SPEC seção 7.

**Entregáveis:**
- `/lib/memory/semantic.ts` — getSemanticMemory, generateSemanticMemory, upsertSemantic
- `/lib/memory/episodic.ts` — searchEpisodicMemory, indexEpisode, embedEpisode
- `/lib/memory/builder.ts` — buildMemoryContext(client_id, current_query) → string
- `/lib/memory/extractor.ts` — extractInsightsFromConversation(messages) → MemoryInsights

**Memória Semântica:**
- Resumo persistente do cliente (texto curto)
- Atualizado ao final de cada conversa concluída
- Estrutura: { preferred_name, preferences, last_service, observations, raw_insights }

**Memória Episódica:**
- Cada conversa concluída vira 1 episódio
- Embedding do resumo da conversa salvo em vector(1536)
- Busca por similaridade quando uma nova conversa começa
- Top-3 episódios similares são incluídos no contexto

**Lógica de buildMemoryContext:**
```typescript
async function buildMemoryContext(
  client_id: string,
  current_query: string
): Promise<string> {
  // 1. Memória semântica (sempre presente)
  const semantic = await getSemanticMemory(client_id)
  
  // 2. Memória episódica (top-3 mais similares à query atual)
  const queryEmbedding = await generateEmbedding(current_query)
  const episodes = await searchEpisodicMemory(client_id, queryEmbedding, 3)
  
  // 3. Formata
  return `
## Memória persistente do cliente
${semantic.memory_summary}

## Conversas anteriores relevantes
${episodes.map(ep => `- ${ep.summary} (${ep.created_at})`).join('\n')}
  `.trim()
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 7 (Memória Dual).
Implemente em /lib/memory/.

SEMÂNTICA:
- Texto curto (< 500 chars) com resumo do cliente
- Gerada por Claude Haiku ao final de cada conversa
- Prompt: "Analise a conversa e atualize o resumo do cliente. 
  Mantenha apelidos preferidos, preferências de serviço, 
  observações de comportamento. Seja conciso."

EPISÓDICA:
- Cada conversa concluída vira embedding de seu resumo
- Salvo em client_memory_episodic com vector(1536)
- Busca: <=> (cosine distance), LIMIT 3, WHERE client_id = X

EXTRATOR:
- Recebe array de mensagens
- Chama Claude Haiku para extrair insights estruturados
- Retorna { preferred_name, preferences, last_service, observations }

BUILDER:
- Combina semântica (sempre) + episódica (top-3 relevantes)
- Formato pronto para injeção no system prompt
```

**Critério de conclusão:**
- Cliente novo: memória vazia retorna corretamente (sem erro)
- Cliente com 1 conversa: memória semântica gerada
- Cliente com 5+ conversas: episódica retorna top-3 mais similares à query

---

## BLOCO 5 — Construção do Prompt e Tools

> **Tipo:** Paralelo (2 agentes simultâneos)  
> **Dependência:** Bloco 4 concluído  
> **Tempo estimado:** 1 sessão paralela (~60 min)

---

### TAREFA 10 — Construtor de System Prompt
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/prompt-builder`  
**Pode rodar com:** T11

**O que fazer:**
Implementar o montador do system prompt conforme SPEC seção 5.

**Entregáveis:**
- `/lib/engine/prompt-builder.ts` — buildSystemPrompt(context) → string
- `/lib/engine/context-builder.ts` — buildPromptContext(session_id, message) → PromptContext

**Estrutura PromptContext:**
```typescript
interface PromptContext {
  workspace: Workspace
  agent_config: WorkspaceAgentConfig
  client: Client
  semantic_memory: ClientMemorySemantic | null
  episodic_memory: ClientMemoryEpisodic[]
  session: Session
  current_node: FlowNode
  knowledge_content: string
  conversation_history: Message[]
  current_message: string
  catalog: Product[]
}
```

**Seções do prompt (na ordem):**
1. IDENTIDADE (workspace + persona + regras)
2. CONTEXTO DO CLIENTE (semântica + episódica)
3. CATÁLOGO GLOBAL
4. CONHECIMENTO ATIVO (tags do nó)
5. OBJETIVO ATUAL (fluxo + node objective)
6. INSTRUÇÕES DE COMPORTAMENTO
7. CONVERSA ATUAL

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 5 INTEGRALMENTE.
Implemente buildSystemPrompt em /lib/engine/prompt-builder.ts.

REGRAS CRÍTICAS:
1. As 7 seções na ordem EXATA do spec
2. Campos opcionais ausentes não geram seção vazia
3. Seção 4 (knowledge) só aparece se knowledge_content não-vazio
4. Histórico limitado a context_window.message_history_limit
5. Catálogo: completo se include_full_catalog, senão resumido (nome + categoria)

Use template literals (backticks) para clareza.
A função retorna string pronta para envio à API do Claude.

CONTEXT BUILDER:
- buildPromptContext busca tudo no banco
- Combina: workspace, agente, cliente, memória, sessão, nó, knowledge, histórico
- Retorna PromptContext pronto para buildSystemPrompt
```

**Critério de conclusão:**
- Prompt contém todas as 7 seções quando dados disponíveis
- Seções vazias não aparecem
- Histórico respeita limit configurado

---

### TAREFA 11 — Tool Registry + Executor + Hard Guardrail (autorização)
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/tools-engine`  
**Pode rodar com:** T10

**O que fazer:**
Implementar registro, executor e validação de autorização de tools, conforme SPEC seções 3.3 e 14.1.

**Entregáveis:**
- `/lib/tools/registry.ts` — registro central com metadata
- `/lib/tools/executor.ts` — executeTool(tool_id, params, context)
- `/lib/tools/authorization.ts` — checkToolAuthorization(flow_id, tool_id) — Hard Guardrail
- `/lib/tools/validator.ts` — validateParams(params, schema)
- `/lib/tools/implementations/buscar-horarios-livres.ts`
- `/lib/tools/implementations/criar-agendamento.ts`
- `/lib/tools/implementations/cancelar-agendamento.ts`
- `/lib/tools/implementations/buscar-historico-cliente.ts`
- `/lib/tools/implementations/registrar-cliente.ts`
- `/app/api/tools/route.ts` — lista tools disponíveis para um workspace

**Fluxo do executor:**
```typescript
async function executeTool(
  tool_id: string,
  params: Record<string, any>,
  context: { workspace_id: string, session_id: string, flow_id: string }
): Promise<ToolExecutionResult> {
  // HARD GUARDRAIL 1: Tool está na allowlist do fluxo?
  const authorized = await checkToolAuthorization(context.flow_id, tool_id)
  if (!authorized) {
    await emitEvent('flow.tool_denied', context)
    throw new ToolNotAuthorizedError(tool_id)
  }
  
  // HARD GUARDRAIL 2: Params válidos contra schema?
  const tool = await getToolFromRegistry(tool_id)
  const validation = validateParams(params, tool.params_schema)
  if (!validation.valid) {
    throw new InvalidParamsError(validation.errors)
  }
  
  // HARD GUARDRAIL 3: Circuit breaker (3 falhas seguidas?)
  const breakerOpen = await isCircuitBreakerOpen(tool_id, context.workspace_id)
  if (breakerOpen) {
    throw new CircuitBreakerOpenError(tool_id)
  }
  
  // Execução
  try {
    const result = await tool.handler(params, context)
    return { success: true, result }
  } catch (error) {
    await recordToolFailure(tool_id, context.workspace_id)
    throw error
  }
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 3.3 e 14.1.
Implemente em /lib/tools/.

REGISTRY:
- Registra tools com metadata: id, name, description, params_schema, returns_schema, category, requires_confirmation
- 5 tools da fase 1 implementadas:
  - buscar_horarios_livres
  - criar_agendamento
  - cancelar_agendamento
  - buscar_historico_cliente
  - registrar_ou_atualizar_cliente

EXECUTOR:
- 3 hard guardrails antes de executar (autorização, validação, circuit breaker)
- Tipa retorno como ToolExecutionResult
- Registra falhas para o circuit breaker

VALIDATOR:
- JSON Schema validation usando ajv ou zod
- Retorna erros estruturados

IMPLEMENTAÇÕES:
- Cada tool é um arquivo separado em /lib/tools/implementations/
- Usa db helpers de T03
- Sem efeitos colaterais não documentados
```

**Critério de conclusão:**
- Tool executada com sucesso retorna resultado estruturado
- Tool não autorizada → ToolNotAuthorizedError + evento emitido
- Tool com params inválidos → InvalidParamsError
- 3 falhas seguidas → circuit breaker abre

---

## BLOCO 6 — Cérebro do Motor

> **Tipo:** Sequencial (cada tarefa depende da anterior)  
> **Dependência:** Bloco 5 concluído  
> **Tempo estimado:** 2 sessões (~120 min)

---

### TAREFA 12 — Planner (Claude Haiku) + Detector de Digressão
**Agente:** Claude Opus  
**Effort:** Muito Alto  
**Branch:** `task/planner`

**O que fazer:**
Implementar o Planner — o cérebro do motor. Decide o que fazer a cada turno.

**Entregáveis:**
- `/lib/engine/planner.ts` — plan(context: PromptContext) → PlannerDecision
- `/lib/engine/digression-detector.ts` — detectDigression(state, message)

**Interface PlannerDecision:**
```typescript
interface PlannerDecision {
  action: 'respond' | 'call_tool' | 'digress' | 'resume' | 'handoff' | 'wait' | 'advance' | 're_plan'
  tool_name?: string
  tool_params?: Record<string, any>
  digression_topic?: string
  objective_pending?: ObjectivePending
  next_node_id?: string
  confidence: number  // 0.0 a 1.0
  reasoning: string  // log interno
}
```

**Algoritmo do Planner (do SPEC seção 6):**
```
1. Se session.digression_state = 'active':
   a. Avalia se a digressão encerrou (Claude Haiku)
   b. Encerrada → action = 'resume'
   c. Ainda ativa → action = 'digress'

2. Se session.digression_state = 'none':
   a. Classifica mensagem:
      - ON_TOPIC: avança o objetivo atual
      - DIGRESSION: outro assunto, mas válido
      - CHITCHAT: casual
      - ESCALATION: cliente quer humano
      - CANCELLATION: cliente quer cancelar
   b. Decide action baseado na classificação
   c. Se DIGRESSION: salva objective_pending
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 2 e 6 com ATENÇÃO TOTAL.
Implemente em /lib/engine/planner.ts.

ESTE É O COMPONENTE MAIS CRÍTICO DO SISTEMA.

MODELO: Claude Haiku 4.5 (claude-haiku-4-5-20251001)
TEMPERATURE: 0.0 (decisões determinísticas)
MAX_TOKENS: 500

OUTPUT: JSON estruturado (use response_format ou parsing rigoroso)

ALGORITMO:
- Implemente EXATAMENTE como descrito no spec seção 6
- Estados de digressão: 'none' | 'active' | 'resuming'
- Classificação: ON_TOPIC | DIGRESSION | CHITCHAT | ESCALATION | CANCELLATION

PROMPT DO PLANNER:
- Receba o system prompt completo (de T10) como contexto
- Adicione: "Você é o componente Planner. NÃO gere resposta ao usuário.
  Apenas analise e decida a próxima ação. Retorne JSON estruturado."

CAMPOS OBRIGATÓRIOS NA SAÍDA:
- action (sempre)
- confidence (sempre, 0.0-1.0)
- reasoning (sempre, log interno)
- Outros campos conforme action

LOGGING:
- Cada decisão é registrada em audit_logs com action e reasoning
```

**Critério de conclusão:**
- 10 mensagens de teste manual classificam corretamente
- ON_TOPIC → action correta
- DIGRESSION → salva objective_pending
- ESCALATION → action 'handoff'
- digression_state 'active' + msg encerrando → action 'resume'

---

### TAREFA 13 — Executor (Claude Sonnet) + Gerador de Resposta
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/executor`  
**Depende de:** T12

**O que fazer:**
Implementar o Executor — gera a resposta final ao usuário baseado na decisão do Planner.

**Entregáveis:**
- `/lib/engine/executor.ts` — execute(decision, context) → ExecutorResult

**Interface:**
```typescript
interface ExecutorResult {
  response_text: string
  session_updates: Partial<Session>
  crm_events: CRMEvent[]
  next_node_id?: string
  tokens_used: number
  model_used: string
}
```

**Lógica por action:**
```typescript
switch (decision.action) {
  case 'respond':
    // Claude Sonnet gera resposta com system prompt completo
    return generateResponse(context)
  
  case 'call_tool':
    // 1. Executa tool (com hard guardrails de T11)
    // 2. Incorpora resultado no contexto
    // 3. Claude Sonnet gera resposta natural
    return executeWithTool(decision, context)
  
  case 'digress':
    // Claude Sonnet responde a digressão
    // Adiciona gancho sutil de retomada ao final
    return generateDigressionResponse(decision, context)
  
  case 'resume':
    // Retoma objetivo pendente naturalmente
    return generateResumeResponse(decision, context)
  
  case 'handoff':
    // Mensagem de transição + emite evento
    return generateHandoffResponse(decision, context)
  
  case 'advance':
    // Não gera resposta — apenas avança o nó
    return advanceFlow(decision, context)
}
```

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seções 2 e 3.
Implemente em /lib/engine/executor.ts.

MODELO: Claude Sonnet 4.6 (claude-sonnet-4-6)
TEMPERATURE: 0.7 (natural, mas consistente)

CADA ACTION É UMA FUNÇÃO SEPARADA:
- generateResponse(context) — resposta padrão
- executeWithTool(decision, context) — com tool call
- generateDigressionResponse — responde desvio + gancho de retomada
- generateResumeResponse — retoma objetivo pendente
- generateHandoffResponse — transição para humano
- advanceFlow — avança sem gerar resposta

INSTRUÇÕES CHAVE:
- Tom EXATAMENTE como agent_config.persona_tone
- Use memória do cliente ativamente (apelido, último serviço)
- NUNCA mencione: fluxo, sistema, IA, bot, prompt
- Comprimento conforme persona.response_length

EVENTOS CRM:
- conversation.started (primeira interação)
- interest.product_enquiry (cliente perguntou sobre produto)
- conversation.handoff (action = handoff)
- appointment.created (tool de agendamento)

session_updates retorna apenas campos alterados (Partial<Session>)
```

**Critério de conclusão:**
- Cada action gera resposta apropriada
- Tom consistente com persona configurada
- Tool result incorporado naturalmente na resposta
- Eventos CRM emitidos corretamente

---

### TAREFA 14 — Monitor (Claude Haiku) + Self-Evaluation
**Agente:** Claude Sonnet  
**Effort:** Alto  
**Branch:** `task/monitor`  
**Depende de:** T13

**O que fazer:**
Implementar o Monitor — quarta camada da arquitetura, conforme SPEC seção 15.

**Entregáveis:**
- `/lib/engine/monitor.ts` — monitor(context, executorResult) → MonitorReport
- `/lib/engine/loop-detector.ts` — detectLoop(session_id) → boolean
- `/lib/engine/sentiment-analyzer.ts` — analyzeSentiment(messages) → SentimentTrend

**Interface MonitorReport:**
```typescript
interface MonitorReport {
  flags: MonitorFlag[]
  recommended_action: 'continue' | 'replan' | 'handoff' | 'alert'
  reasoning: string
}

interface MonitorFlag {
  type: 'hallucination' | 'loop' | 'frustration' | 'low_confidence' | 'incoherent'
  confidence: number
  details: string
}
```

**Verificações executadas (do SPEC seção 15):**
1. Coerência com objetivo do nó
2. Detecção de alucinação (info fora do contexto)
3. Detecção de loop (mesma decisão > 3 vezes)
4. Sentiment (frustração crescente nas últimas 3 mensagens)
5. Confidence do Planner < 0.6

**Ações:**
- `continue` → segue normalmente
- `replan` → volta ao Planner com flag de re-plan
- `handoff` → força transferência humana
- `alert` → log mas continua

**Prompt de abertura:**
```
Leia o SPEC_MOTOR_BACKEND.md seção 15 INTEGRALMENTE.
Implemente em /lib/engine/monitor.ts.

MODELO: Claude Haiku 4.5 (rápido, barato — análise post-hoc)
TEMPERATURE: 0.0
MAX_TOKENS: 300

INPUT DO MONITOR:
- system_prompt resumido (300 chars max)
- objetivo do nó
- mensagem do cliente
- resposta gerada pelo Executor
- últimas 5 mensagens
- planner_confidence

OUTPUT: JSON estruturado (MonitorReport)

LOOP DETECTOR:
- Lê últimas 5 ações do Planner na sessão
- Se 3+ iguais consecutivas: flag 'loop' + recommended_action 'handoff'

SENTIMENT:
- Claude Haiku analisa últimas 3 mensagens do USUÁRIO
- Detecta: 'positive' | 'neutral' | 'frustrated' | 'angry'
- Frustração crescente nas 3 últimas → flag 'frustration'

ALUCINAÇÃO:
- Compara afirmações factuais da resposta com contexto fornecido
- Se afirmação não tem suporte: flag 'hallucination'

INTEGRAÇÃO:
- Se action = 'replan': adiciona replan_count++ na sessão
- Se replan_count >= 3 (circuit breaker): força handoff
- Se action = 'alert': loga em audit_logs mas envia resposta normalmente

CONFIGURAÇÃO:
- Pode ser desabilitado por nó (monitor_config.enabled = false)
- Pode ser desabilitado por env (DISABLE_MONITOR=true)
- Plano free do workspace: desabilitado por default
```

**Critério de conclusão:**
- Resposta com info inventada → flag 'hallucination'
- 3 decisões iguais consecutivas → flag 'loop' + handoff
- Cliente frustrado nas últimas 3 msgs → flag 'frustration'
- Disabled por nó → não executa

---

## Resumo Visual da Parte 1

```
T01: Schema (Sonnet, ALTO)                           [Bloco 1: sequencial]
                                ↓
T02: Types (Haiku, MÉDIO) ─┐
T03: DB Helpers (Haiku, MÉDIO) ─┼──── [Bloco 2: paralelo, 3 agentes]
T04: Channels (Sonnet, ALTO) ───┘
                                ↓
T05: Throttle Guards (Sonnet, MÉDIO) ─┐
T06: Content Guards (Sonnet, MÉDIO) ──┴── [Bloco 3: paralelo, 2 agentes]
                                ↓
T07: Media (Sonnet, MÉDIO) ─┐
T08: Knowledge+RAG (Sonnet, ALTO) ─┼──── [Bloco 4: paralelo, 3 agentes]
T09: Memory (Sonnet, ALTO) ─┘
                                ↓
T10: Prompt Builder (Sonnet, ALTO) ─┐
T11: Tools+Auth (Sonnet, ALTO) ─────┴── [Bloco 5: paralelo, 2 agentes]
                                ↓
T12: PLANNER (Opus, M.ALTO) ───────────[Bloco 6: sequencial]
                                ↓
T13: Executor (Sonnet, ALTO)
                                ↓
T14: Monitor (Sonnet, ALTO)
```

**Tempo estimado total da Parte 1:** ~7-8 sessões de Claude Code  
**Após esta parte:** o motor já roda end-to-end, mas sem jobs assíncronos, sem testes completos e sem governance.

---

**Continuação:** veja `IMPLEMENTATION_PLAN_MOTOR_PART_2.md` para Blocos 7-10:
- Output Guardrails
- Orquestrador Principal
- Jobs Assíncronos (8 jobs)
- Testes de Integração
- Hardening final
- Cost tracking e Audit logging completo
- SPEC_MOTOR_GOVERNANCE.md (companion doc)

---

*Fim do IMPLEMENTATION_PLAN_MOTOR_PART_1.md*
