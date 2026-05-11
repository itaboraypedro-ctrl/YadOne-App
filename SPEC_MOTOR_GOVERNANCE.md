# SPEC_MOTOR_GOVERNANCE — Yadone Motor de Conversação

> **Versão:** 1.0
> **Stack:** Next.js 16 + TypeScript + Supabase + Claude API
> **Status:** Pós-MVP (Bloco 10 concluído)
> **Atualizado:** 2026-05-07

Este documento define a governança operacional do motor após o MVP. Cobre versionamento de modelos, simulação e replay, evaluation pipeline, custos, audit e LGPD, multi-tenancy, disaster recovery e roadmap. É complementar a `SPEC_MOTOR_BACKEND.md` (que define o motor) e `STATUS.md` (estado atual).

Toda decisão tomada aqui deve ser revisitada a cada release maior (X.0). Mudanças em produção exigem entrada no audit log com `event_type='governance.change'`.

---

## 1. Versionamento de motor

A troca de modelos da Anthropic e a evolução de prompts são eventos contínuos. Esta seção define como fazê-lo sem downtime e com rollback rápido (<5 min).

### 1.1 Modelos em uso

Definidos em `agent_configs.planner_model` e `agent_configs.executor_model` (string), não hard-coded em `lib/engine/`. Atual:

- Planner: `claude-opus-4-7` (raciocínio crítico de classificação)
- Executor: `claude-sonnet-4-6` (resposta conversacional)
- Monitor: `claude-sonnet-4-6` (avaliação de qualidade)
- Vision: `claude-sonnet-4-6` (descrição de imagem/doc)
- Memory extractor: `claude-sonnet-4-6` (job T20)
- Content filter: `claude-haiku-4-5` (filtro de input)

### 1.2 Estratégia de upgrade

1. **Shadow traffic** — novo modelo recebe payload em paralelo, resposta descartada, métricas comparadas (custo, latência, replan rate). Implementado via flag `agent_configs.shadow_executor_model` (campo a criar).
2. **Canário 10%** — `agent_configs.executor_model_canary_pct` direciona % do tráfego para o novo modelo (random per `trace_id`).
3. **Rollout 50% → 100%** — incrementos de 24h cada, com checkpoint em métricas-chave da Seção 3.
4. **Rollback** — `UPDATE agent_configs SET executor_model='<anterior>'` + invalidação do cache de config (TTL <60s no `lib/engine/context-builder.ts`).

### 1.3 Compatibilidade de prompts

- Prompt do system message é gerado em `lib/engine/prompt-builder.ts`. Mudanças no prompt devem subir o campo `agent_configs.system_prompt_version` (campo a criar pós-MVP, default `'v1'`).
- Cada versão fica no código sob `prompt-builder/v1.ts`, `v2.ts` etc; o builder despacha por versão.
- Suite de regressão (T23) deve passar para todas as versões em uso simultaneamente.

### 1.4 Audit obrigatório

Toda mudança de modelo ou prompt registra:

```json
{
  "event_type": "governance.model_change",
  "workspace_id": "...",
  "old_model": "claude-sonnet-4-6",
  "new_model": "claude-sonnet-4-7",
  "rollout_pct": 10,
  "actor": "ops@yadone.app"
}
```

---

## 2. Simulação e replay

Permite reexecutar conversas reais com modelo/prompt diferente para validar mudanças antes de promovê-las.

### 2.1 Captura

Já implementado pelo MVP via `audit_logs` + `messages`:

- `messages.tokens_input/output` por turno
- `audit_logs.event_type='planner.decision' | 'executor.response' | 'monitor.recommendation'` com payload completo
- `trace_id` correlaciona todos os eventos de um turno (uma mensagem inbound)

### 2.2 Replay

Endpoint pós-MVP: `POST /api/admin/replay/[trace_id]` (Bearer ADMIN_TOKEN).

Comportamento:
1. Busca mensagem inbound original via `trace_id`
2. Reconstrói `ProcessMessageInput` com `synthetic=true` (não envia ao cliente real)
3. Override opcional via body: `{ executor_model, system_prompt_version }`
4. Executa `processMessage` em workspace shadow (clone read-only de produção via `pg_dump --schema-only` + `INSERT ... SELECT`)
5. Retorna `{ original_response, replay_response, diff, cost_delta, latency_delta }`

### 2.3 Diffing

- Diff textual via `lib/eval/diff.ts` (a criar): tokens iguais / removidos / adicionados
- Diff semântico via LLM-as-judge: prompt "as duas respostas têm o mesmo significado funcional? (sim/não/parcial)"
- Resultado armazenado em tabela `replay_runs` (a criar)

### 2.4 Storage

`replay_runs (id, trace_id, executor_model, prompt_version, original_response, replay_response, diff_json, cost_delta_cents, latency_delta_ms, created_at)`

Retenção: 90 dias. Replays em batch usam `replay_runs.batch_id` para agrupar.

---

## 3. Evaluation pipeline

Métricas que decidem se um modelo/prompt vai a produção.

### 3.1 Métricas-chave

| Métrica | Fonte | Target MVP |
|---|---|---|
| Task completion rate | % de sessões com `appointments` criado | >40% |
| Replan rate | `audit_logs` `event_type='orchestrator.replan'` / total turnos | <8% |
| Handoff rate | sessions `status='handoff'` / total | <12% |
| Latência p50 | `audit_logs.latency_ms` | <3500ms |
| Latência p95 | idem | <8000ms |
| Latência p99 | idem | <15000ms |
| Custo médio/sessão | `messages.tokens_*` agregado por session_id | <$0.08 |
| Customer satisfaction (proxy) | `sessions.last_sentiment_score` médio | >0.5 |
| Leak rate | `audit_logs` `event_type='output.leak_detected'` / total | <0.1% |

### 3.2 Cron de evaluation

Existe `/api/cron/daily-metrics` (T22, schedule `0 3 * * *`). Pós-MVP, expandir para também:
- Rodar suite de regressão sobre 50 conversas do golden set
- Gravar resultado em `evaluations (id, run_at, golden_set_version, model, pass_rate, ...)`
- Alertar via webhook se `pass_rate < 95%`

### 3.3 Golden set

- 50 conversas curadas (15 happy paths, 15 digressões, 10 edge cases, 10 falhas esperadas)
- Versionado em `tests/golden/<version>/conversation_*.json`
- Cada conversa tem `assertions`: respostas esperadas (substring match ou LLM-as-judge)
- Atualizar quando comportamento intencional mudar; bloquear commits no CI quando golden falhar sem `[golden-bump]` no commit message

### 3.4 LLM-as-judge

Prompt fixo em `lib/eval/judge.ts`:

> "Avalie se a resposta da IA está correta dado o objetivo da etapa do fluxo, o tom esperado e a mensagem do cliente. Pontue de 0–5 nas dimensões: aderência ao objetivo, tom, completude, ausência de invenção. Retorne JSON."

Modelo do judge: `claude-opus-4-7` (mais conservador).

---

## 4. Cost governance

Custo é o principal risco operacional do motor (escala N de conversas × custo de Claude).

### 4.1 Cap atual

`lib/guardrails/cost-cap.ts` aplica budget mensal por workspace via `workspace_cost_caps` (migration 020). Bloqueio é hard: ao atingir 100%, novas mensagens retornam `status='blocked'` com `reason='cost_cap_exceeded'`.

### 4.2 Alertas progressivos (a implementar)

| Threshold | Ação |
|---|---|
| 70% | Email para owner do workspace + audit `cost.warning_70` |
| 85% | Email + Slack webhook + audit `cost.warning_85` |
| 100% | Bloqueio + email crítico + audit `cost.cap_reached` |

### 4.3 Dashboards

Endpoint `/api/admin/metrics` (T25) já expõe:
- Custo agregado por workspace, por dia, por modelo, por tool
- Breakdown de tokens input/output

Pós-MVP, adicionar:
- Projeção de custo até fim do mês (regressão linear sobre últimos 7 dias)
- Comparação entre workspaces (ranking de custo/sessão)
- Alertas de anomalia: custo do dia >200% da mediana dos últimos 14 dias

### 4.4 Anomaly detection

Job `/api/cron/anomaly-detection` (a criar, schedule `0 */6 * * *`):
- Detecta workspaces com custo/sessão >3σ da média
- Detecta picos de uso de tool >5x mediana
- Detecta loops do executor (replan_count médio >1.5)
- Resultado em `anomalies` table + email ao admin

---

## 5. Audit e compliance (LGPD)

LGPD aplica diretamente: workspace IDs identificam clientes finais (pessoas físicas) por `phone_number`.

### 5.1 PII — onde está

- `clients.phone_number` (texto puro — necessário para webhook lookup)
- `clients.name` (texto puro — opcional, default NULL)
- `messages.content` (pode conter dados pessoais ditos pelo cliente)
- `client_memory.summary` (resumo extraído pelo job de memória)
- `audit_logs.payload` JSONB (hash de `phone` aplicado pelo `lib/logger.ts` da T25)

### 5.2 Direito ao esquecimento

Endpoint pós-MVP: `DELETE /api/admin/clients/[id]` (Bearer ADMIN_TOKEN).

Comportamento:
1. Recebe `client_id` + motivo (LGPD §18)
2. Pseudonimiza:
   - `clients.phone_number` → `'DELETED-<random>'`
   - `clients.name` → NULL
3. Anula:
   - `messages.content` → `'[redacted]'` (mantém estrutura para métricas)
   - `client_memory.summary` → NULL
   - `client_episodic_memory` → DELETE WHERE client_id
4. Audit log mantém apenas `client_id` (não phone)
5. Janela: 30 dias para responder (LGPD §19)

### 5.3 Retenção

| Tabela | Retenção | Limpeza |
|---|---|---|
| messages | 12 meses | Job mensal `purge-old-messages` (a criar) |
| audit_logs | 6 meses | Job mensal `purge-old-audit` (a criar) |
| idempotency_keys | 24h | T22 já cleanup via `expires_at` |
| sessions (status='closed') | 12 meses | Idem messages |
| client_episodic_memory | 12 meses | Idem |
| crm_events | 24 meses | Job a criar |

### 5.4 PII em logs

T25 (`lib/logger.ts`) força:
- `phone` → SHA-256 hex truncado em 12 chars
- `content` → truncado em 80 chars
- Stack traces de erro removem args dos frames

Code review obrigatório para PR que toque em `lib/logger.ts`.

### 5.5 DPO (Data Protection Officer)

Contato a definir. Email padrão temporário: `dpo@yadone.app`. Tempo de resposta: 15 dias úteis.

---

## 6. Multi-tenancy hardening

Todo dado é segregado por `workspace_id`. Isolamento incorreto = vazamento entre clientes — risco crítico.

### 6.1 Estado atual (MVP)

- `workspace_id` é coluna NOT NULL em todas as tabelas operacionais (clients, sessions, messages, knowledge, products, flows, audit_logs, etc)
- Isolamento aplicado em **código**, não em RLS Postgres
- Service role key bypassa qualquer RLS — usada por todos os endpoints server-side
- Endpoints admin recebem `workspace_id` via query string e filtram explicitamente

### 6.2 RLS pós-MVP

Habilitar Row Level Security:
1. `ALTER TABLE clients ENABLE ROW LEVEL SECURITY;` (idem todas)
2. Policy: `USING (workspace_id = current_setting('app.workspace_id')::uuid)`
3. Wrapper em `lib/db/supabase-admin.ts` que faz `SET app.workspace_id = '<uuid>'` antes de toda query
4. Service role passa a respeitar RLS via `SET ROLE authenticated`

### 6.3 Pen test checklist

Antes de habilitar primeiros 10 workspaces de produção:

- [ ] Tentar acessar `/api/admin/audit?workspace_id=A` com session de B
- [ ] Tentar acessar `/api/admin/sessions/[id]` onde id é de outro workspace
- [ ] Tentar acessar `/api/admin/trace/[trace_id]` cross-tenant
- [ ] Verificar que `lib/knowledge/fetcher.ts` filtra workspace antes do RAG
- [ ] Verificar que tools (especialmente `buscar_horarios_livres`) não vazam dados
- [ ] Cross-channel unification (T28) — confirmar que `lib/unification/strategy.ts` não junta phones de workspaces diferentes
- [ ] Webhook recebe payload com `phone_number` que existe em outro workspace — não criar sessão errada

### 6.4 Code review obrigatório

PR que adicione query nova em `lib/db/*` deve ter:
- Filtro `.eq('workspace_id', workspace_id)` explícito
- Argumento `workspace_id: string` na assinatura
- Teste em `tests/integration` que prove isolamento

CI bloqueia merge se grep `from('messages')` (ou outras tabelas multi-tenant) sem `eq('workspace_id'` no mesmo arquivo.

---

## 7. Disaster recovery

### 7.1 Targets

- **RTO (Recovery Time Objective):** 1 hora
- **RPO (Recovery Point Objective):** 5 minutos
- **Data loss tolerable:** janela de 5 min de mensagens recentes (cliente pode reenviar)

### 7.2 Backup

- **Banco:** Supabase Pro tem Point-in-Time Recovery (PITR) com janela de 7 dias. Confirmar plano = Pro em supabase.com/dashboard.
- **Storage:** mídia inbound (áudio, imagem) salva em Supabase Storage com versionamento — default 30 dias.
- **Código:** Git em GitHub + Vercel (backup natural).
- **Secrets:** `ENCRYPTION_KEY` (cripto AES-256 de credenciais de canal em `channel_configs.credentials_encrypted`) deve ter cópia em vault separado (1Password Business). Perda dessa chave torna credenciais de canal irrecuperáveis.

### 7.3 Runbook de incidente

Em caso de corrupção/perda de dados:

1. **Confirmar** — abrir incidente em status page; congelar deploys (Vercel → Pause Production Branch)
2. **Pausar crons** — Vercel → Settings → Cron Jobs → Disable All (impede que jobs operem em estado inconsistente)
3. **Decidir PITR** — escolher timestamp anterior ao incidente. Supabase dashboard → Database → Backups → Restore PITR
4. **Provisionar restore** — Supabase cria branch novo; aplicação aponta para ele via mudança de `NEXT_PUBLIC_SUPABASE_URL` em Vercel env
5. **Validar** — rodar `tests/integration` contra restore; conferir contagens-chave (messages, sessions, clients) vs último snapshot conhecido
6. **Cutover** — atualizar Vercel env de produção; redeployar; reabilitar crons em ordem (1 cada 5 min, monitorando)
7. **Post-mortem** — documento em 5 dias úteis em `HISTORY.md` com timeline e ação corretiva

### 7.4 Drill

Executar restore drill em ambiente staging trimestralmente (mês 1 de cada quarter). Documento de drill em `HISTORY.md` registra:
- Tempo até restore funcional
- Issues encontradas
- Diff em relação ao runbook (atualizar se necessário)

### 7.5 Falha de provedor LLM

Anthropic indisponível por >10 min:
- Circuit breaker (`lib/guardrails/circuit-breaker.ts`) já abre em 3 falhas seguidas
- Cliente recebe "Tive um problema técnico" via fallback do `orchestrator.ts`
- Pós-MVP: failover para `gpt-4.1-mini` (OpenAI) como executor secundário, ativado por flag `agent_configs.executor_failover_enabled`

OpenAI indisponível (Whisper/embeddings):
- Whisper falha → mensagem de áudio retorna pedido de transcrever em texto
- Embeddings falham → RAG opera em fallback (full-text search via Postgres)

---

## 8. Roadmap pós-MVP

### Phase 2 — Calendário real e agendamento robusto (Q3 2026)

**Substituir stub** `buscar_horarios_livres` por integração real:

- Integração Google Calendar (OAuth 2.0 por workspace)
- Integração Cal.com (webhook + API)
- `agent_configs.calendar_provider` decide qual usar
- Tool `criar_agendamento` cria evento real e persiste `appointments.external_event_id`
- Webhook de no-show / cancelamento → atualiza `appointments.status` + dispara followup

**Multi-profissional:**
- `professionals` table com `availability_rules JSONB`
- Tool `buscar_horarios_livres` aceita filtro `professional_id`
- Round-robin / load-balancing entre profissionais com mesma especialidade

**Lembretes automáticos:**
- 24h antes: confirmação via WhatsApp
- 2h antes: lembrete final
- Job `/api/cron/appointment-reminders` (schedule `*/15 * * * *`)

### Phase 3 — Multi-canal ativo (Q4 2026)

**Motor proativo cross-channel:**
- Atualmente o motor é reativo (responde a webhook). Phase 3 permite iniciar conversas.
- `outbound_campaigns` table define audiência + mensagem inicial
- Worker `lib/jobs/outbound-worker.ts` envia em batch respeitando rate-limits do canal
- Opt-out obrigatório (LGPD): `clients.outbound_opt_out=true` exclui da audiência

**SMS/Email:**
- Adapters em `lib/channels/sms.ts` (Twilio) e `lib/channels/email.ts` (Resend)
- Mesma orchestrator pipeline; diferença é só o `channelClient.send`
- Cross-channel unification (T28) já permite identificar mesmo cliente em múltiplos canais

**Workflow builder visual:**
- Editor drag-drop em `/admin/flows/[id]/edit` (frontend separado)
- Valida fluxo antes de publicar (todos os nós alcançáveis, edges válidas)
- Versionamento já existe (T27) — cada save bumpa `flows.version` e snapshot em `flow_versions`

### Phase 4 — Inteligência operacional (2027)

**Auto-tuning de prompts:**
- Análise contínua de métricas + fine-tuning automático de instruções
- A/B test de variantes de prompt selecionando vencedor por task completion rate

**Cliente Insights:**
- Resumo automático de cluster de clientes (segmentação por LLM)
- Recomendações de novo produto baseadas em conversas históricas
- Predição de churn por sentiment trajectory

**Self-healing:**
- Quando replan rate >threshold em 1h, reverter automaticamente para versão anterior do prompt/modelo
- Quando handoff rate >threshold, alertar product owner com sample de conversas

---

*Documento operacional — revisar a cada release maior. Mudanças em produção exigem audit log com `event_type='governance.change'`.*
