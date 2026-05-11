# STATUS.md — Motor de Conversação Yadone

> **Stack:** Next.js 16 + TypeScript + Supabase + Claude API
> **Spec:** SPEC_MOTOR_BACKEND.md v2.0
> **Atualizado:** 2026-05-07 15:20 (UTC-3)
> **Bloco atual:** 10 — CONCLUÍDO ✅
> **Progresso:** 31/31 (100%)

---

## Métricas de Progresso

| Bloco | Tarefas | Concluídas | % |
|---|---|---|---|
| 1 — Fundação | 1 | 1 | 100% |
| 2 — Infraestrutura | 3 | 3 | 100% |
| 3 — Guardrails Input | 3 | 3 | 100% |
| 4 — Pré-processamento | 5 | 5 | 100% |
| 5 — Prompt e Tools | 3 | 3 | 100% |
| 6 — Cérebro | 3 | 3 | 100% |
| 7 — Guardrails Output | 2 | 2 | 100% |
| 8 — Orquestrador | 3 | 3 | 100% |
| 9 — Jobs Assíncronos | 4 | 4 | 100% |
| 10 — Testes e Gov. | 4 | 4 | 100% |
| **TOTAL** | **31** | **31** | **100%** |

---

## Tarefas concluídas (resumo)

| Tarefa | Arquivos principais | Data |
|---|---|---|
| T01 Schema | 27 migrations + seed.sql | 2026-05-06 |
| T02 Types | /types/*.ts (14 arquivos) | 2026-05-06 |
| T03 DB Helpers | /lib/db/*.ts (17 arquivos) | 2026-05-06 |
| T04 Channels | /lib/channels/*.ts + 3 webhooks | 2026-05-06 |
| T05 Rate/Cost/Breaker | /lib/guardrails/{rate-limiter,cost-cap,circuit-breaker,index}.ts | 2026-05-06 |
| T06 Signature/Filter/Cipher | /lib/guardrails/{signature-validator,content-filter-input,credential-cipher}.ts | 2026-05-06 |
| T30 Idempotência | /lib/idempotency/{store,middleware}.ts | 2026-05-06 |
| T07 Mídia | /lib/media/{audio,vision,processor}.ts | 2026-05-06 |
| T08 Knowledge+RAG | /lib/knowledge/*.ts + /app/api/knowledge/ | 2026-05-06 |
| T09 Memória | /lib/memory/*.ts | 2026-05-06 |
| T28 Cross-channel | /lib/unification/*.ts | 2026-05-06 |
| T31 Retry+Breaker | /lib/resilience/*.ts | 2026-05-06 |
| T10 Prompt Builder | /lib/engine/{prompt-builder,context-builder}.ts | 2026-05-06 |
| T11 Tools | /lib/tools/*.ts + 5 implementations | 2026-05-06 |
| T27 Flow Versioning | /lib/flows/*.ts + 3 routes | 2026-05-06 |
| T12 Planner | /lib/engine/{planner,digression-detector}.ts | 2026-05-06 |
| T13 Executor | /lib/engine/{executor,mixed-initiative}.ts | 2026-05-06 |
| T14 Monitor | /lib/engine/{monitor,loop-detector,sentiment-analyzer}.ts | 2026-05-06 |
| T15 Output Guards | /lib/guardrails/{output-validator,content-filter-output,leak-detector}.ts | 2026-05-07 |
| T16 Cost+Audit | /lib/metrics/*.ts + edits em planner/executor | 2026-05-07 |
| T17 Orchestrator | /lib/engine/{orchestrator,orchestrator-helpers}.ts + /app/api/engine/process/ | 2026-05-07 |
| T18 Admin | /app/api/admin/*.ts (7 endpoints) | 2026-05-07 |
| T29 Followup Worker | /lib/jobs/followup-worker.ts + /app/api/cron/followups/ | 2026-05-07 |
| T19 Session Expirer | /lib/jobs/session-expirer.ts + /app/api/cron/expire-sessions/ | 2026-05-07 |
| T20 Memory Updater | /lib/jobs/memory-updater.ts + migration 027 | 2026-05-07 |
| T21 Knowledge Indexer | /lib/jobs/knowledge-indexer.ts + /app/api/cron/index-knowledge/ | 2026-05-07 |
| T22 Daily Aggregator | /lib/jobs/daily-aggregator.ts + /app/api/cron/daily-metrics/ | 2026-05-07 |
| T23 Testes integração | /tests/{helpers,fixtures,integration}/*.ts (15 cenários) | 2026-05-07 |
| T24 Edge cases + load | /tests/{edge-cases,load}/*.test.ts (15 cenários) | 2026-05-07 |
| T25 Logger + Trace + Metrics | /lib/logger.ts + /app/api/admin/{trace/[trace_id],metrics}/route.ts | 2026-05-07 |
| T26 Governance + README | /SPEC_MOTOR_GOVERNANCE.md + /README.md | 2026-05-07 |

---

## Bloco 10 — Detalhes (CONCLUÍDO ✅)

### T23 — Testes de integração (15/15 ✅)
- **Iniciada em:** 2026-05-07 12:42
- **Concluída em:** 2026-05-07 12:50
- **Duração:** 8min
- Arquivos: `/tests/fixtures/workspace.ts`, `/tests/helpers/{mock-llm,mock-channel,mock-db}.ts`, `/tests/integration/motor.test.ts` (1.612 linhas totais)
- Cenários: agendamento simples + tool, cancelamento, digressão (simples/aninhada/4ª força resume), multi-produto, rate limit, cost cap, content filter, output filter, loop detector, idempotência webhook, wait+timer, escalation
- Estratégia: jest.mock dos módulos `lib/db/*` + mutação direta de `anthropicClient`/`openaiClient`/`channelClient` com fila FIFO

### T24 — Testes de carga e edge cases (16/16 ✅)
- **Iniciada em:** 2026-05-07 12:43
- **Concluída em:** 2026-05-07 12:51
- **Duração:** 8min
- Arquivos: `/tests/edge-cases/{inputs,api-failures,idempotency}.test.ts`, `/tests/load/concurrent.test.ts` (1.441 linhas)
- Cenários: 5 inputs extremos (vazio, 10k chars, emojis, SQL injection, 10 phone formats); 5 falhas de API (Anthropic timeout, OpenAI fail, channel fail, saveMessage fail, JSON inválido → 3 replans → handoff); 3 idempotência (webhook 3x, timer 2x, memory updater 2x); 2 concorrência (10 msgs paralelas, 5 workspaces isolados)

### T25 — Logger + Trace + Metrics (✅)
- **Iniciada em:** 2026-05-07 12:53
- **Concluída em:** 2026-05-07 12:55
- **Duração:** 2min
- Arquivos: `/lib/logger.ts` (129), `/app/api/admin/trace/[trace_id]/route.ts` (132), `/app/api/admin/metrics/route.ts` (259)
- Logger: JSON em produção, legível em dev, sanitização recursiva (phone → SHA-256 16hex; content/text → trunca 80 chars; credentials/api_key/token/password/secret → `[REDACTED]`)
- `/admin/trace/[trace_id]`: timeline ordenada de audit_logs + messages + monitor_decisions; monitor_decisions junta via `message_id ∈ trace` ou janela temporal (não tem coluna `trace_id`)
- `/admin/metrics`: total_sessions, total_messages, avg_response_time_ms (calculado como diff user→assistant; null se ruído), handoff_rate, replan_rate, cost_usd, top_tools_used (top 5)

### T26 — Governance + README (✅)
- **Iniciada em:** 2026-05-07 12:54
- **Concluída em:** 2026-05-07 13:10
- **Duração:** 16min
- Arquivos: `/SPEC_MOTOR_GOVERNANCE.md` (375), `/README.md` (232 — substituiu boilerplate)
- SPEC_GOVERNANCE: 8 seções (versionamento de motor, simulação/replay, evaluation pipeline com targets, cost governance, audit/LGPD, multi-tenancy hardening, disaster recovery, roadmap Phases 2-4)
- README: setup, env vars (8), arquitetura, endpoints (webhooks/engine/admin/cron), banco, deploy, troubleshooting

### Wall-clock do bloco
- T23 ‖ T24 (paralelo): 12:42 → 12:51 = **9min**
- T25 ‖ T26 (paralelo): 12:53 → 13:10 = **17min**
- **Total Bloco 10:** ~26min wall-clock

---

## Decisões técnicas globais

| Decisão | Motivo | Registrado por |
|---|---|---|
| `objective_stack JSONB` (substitui `objective_pending`) | Stack de 3 níveis para digressão aninhada | T01 |
| Timestamps como `string` ISO 8601 (não `Date`) | supabase-js retorna strings; Date exigiria parse manual | T02 |
| Tipos inline em /lib/db/ com TODO de migrar para /types/ | T02/T03/T04 rodaram em paralelo | T03 |
| Migration 026 adicional (RPC vector search) | supabase-js não expõe operador `<=>` diretamente | T03 |
| Identificação de workspace via phone_number do payload | Webhook não recebe workspace_id explícito | T04 |
| Tool não autorizada → `re_plan` (não throw) | Mais robusto deixar circuit breaker de 3 replans decidir | T12 |
| Loop detector com fallback `sessions.monitor_flags` | `audit_logs` é fire-and-forget, pode ter latência <1s | T14 |
| `interest.product_enquiry` removido do Executor | Heurística inline gera muitos falsos positivos | T13 |
| Monitor NÃO incrementa `replan_count` — apenas recomenda | Separação: Monitor avalia, Orchestrator aplica | T14 |
| `AnthropicResponse` estendido com `usage_input/output` typed | Elimina cast `raw: unknown` no hot path | T16 |
| `trackUsage` fire-and-forget em Planner/Executor | Telemetria nunca bloqueia o motor | T16 |
| Output Validator: truncamento → `action='truncate'` (não re_plan) | Re-plan por tamanho é desperdício | T15 |
| Webhooks chamam `processMessage` por import direto (não fetch) | Evita self-fetch + preserva stack traces | T17 |
| Override ESCALATION/CANCELLATION → `action='handoff'` | Planner LLM pode classificar mas escolher action errada | T17 |
| Trace ID por mensagem (não por sessão) | Rastreabilidade de turno completo via `WHERE trace_id=...` | T17 |
| Jobs 6/7/8 do SPEC → 1 endpoint `daily-metrics` | Reduz superfície de cron, simplifica vercel.json | T22 |
| `getHistory(limit: number \| null)` — null = todas as mensagens | T20 precisa do histórico completo para extrair memória | T20 |
| `idempotency_keys` cleanup usa `expires_at` (não `created_at`) | `created_at` não existe na tabela (migration 024) | T22 |
| Migration 027 (`memory_processed` em sessions) | Flag de retry idempotente para o job de memória | T20 |
| `buildSystemPrompt(ctx, opts?)` com `extra_behavior_hints` | Mixed-initiative injeta sinais na Seção 7 sem quebrar numeração | T13 |
| Mocks de DB no nível dos módulos `lib/db/*` (não Supabase real) | Testes determinísticos, executam em <6s | T23/T24 |
| `monitor_decisions` join no `/admin/trace` via `message_id` ou janela temporal | Tabela não tem coluna `trace_id` (migration 023) | T25 |
| `avg_response_time_ms` calculado como diff user→assistant | Coluna `latency_ms` não existe em `messages` (migration 013) | T25 |
| Logger: phone → SHA-256 16hex prefix `phone_` | LGPD: PII nunca em plaintext nos logs | T25 |

---

## Modelos usados

| Modelo | Onde | Por quê |
|---|---|---|
| `claude-opus-4-7` | Planner (T12) | Único uso de Opus — raciocínio crítico de classificação |
| `claude-sonnet-4-6` | Executor, Monitor, Vision, Memory extractor | Qualidade/custo balanceados |
| `claude-haiku-4-5` | Content filter input (camada 2) | Classificação rápida e barata |
| `text-embedding-3-small` | RAG (T08), memória episódica (T09) | 1536 dim, custo baixo |
| `whisper-1` | Transcrição de áudio (T07) | Padrão OpenAI para pt-BR |

---

## Infraestrutura

- **Banco:** Supabase Cloud (ref: `nfvxgvoakaboesuqggko`) — 27 migrations, 28 tabelas
- **Crons (vercel.json):**
  - `* * * * *` → /api/cron/followups
  - `0 * * * *` → /api/cron/expire-sessions
  - `*/15 * * * *` → /api/cron/update-memory
  - `*/5 * * * *` → /api/cron/index-knowledge
  - `0 3 * * *` → /api/cron/daily-metrics
- **Env vars:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ENCRYPTION_KEY`, `ADMIN_TOKEN`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Testes:** Jest 30 + ts-jest 29; `jest.config.js` + `tsconfig.test.json`; `npm test` ou `npx jest`. **5 suites, 31 testes, ~3s.**

---

## Validação final do MVP

| Check | Status |
|---|---|
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx jest --passWithNoTests` | ✅ 5 suites / 31 tests passing / 0 skipped |
| Bloco 10 completo (T23+T24+T25+T26) | ✅ 4/4 |
| **TOTAL projeto** | ✅ **31/31 = 100%** |

---

## Problemas conhecidos (carry-over para fase 2)

| Problema | Severidade | Status |
|---|---|---|
| Tipos inline em /lib/db/ (TODO migrar para /types/) | Baixo | Aberto — refactor pós-MVP |
| `buscar_horarios_livres` retorna stub fictício | Médio | Aberto — integração calendário fase 2 (ver SPEC_GOVERNANCE §8) |
| Webhook com phone_number não exposto → 400 | Baixo | Aberto — refinamento por canal fase 2 |
| RLS Postgres não habilitado (isolamento por workspace_id em código) | Médio | Aberto — pen test + RLS pós-MVP (ver SPEC_GOVERNANCE §6) |

---

## Tracking de tempo

| Bloco | Wall-clock | Data |
|---|---|---|
| Bloco 9 (4 jobs) | 3 min | 2026-05-07 |
| Bloco 10 (T23+T24 ‖, T25+T26 ‖) | 26 min | 2026-05-07 |
| Blocos 1–8 | Sem tracking (convenção criada no Bloco 9) | 2026-05-06/07 |

> *Tempo total de implementação rastreado: 29 min wall-clock acumulados em 2 sessões (Blocos 9–10). Blocos 1–8 sem instrumentação.*

---

*Histórico detalhado de cada tarefa em HISTORY.md. Governança pós-MVP em SPEC_MOTOR_GOVERNANCE.md.*
