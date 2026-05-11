# Yadone Motor de Conversação

Motor conversacional para WhatsApp baseado em Claude API. Recebe mensagens via webhook (YCloud, Z-API, Evolution), classifica intent, executa tools (agendamento, busca de horários), responde, e mantém memória semântica/episódica por cliente.

**Stack:** Next.js 16 (App Router) + TypeScript + Supabase + Claude API + OpenAI (embeddings/Whisper).

**Status:** Pós-MVP — 27/31 tarefas concluídas (Bloco 10 em finalização). Ver `STATUS.md`.

---

## Pré-requisitos

- Node 20+ (LTS)
- npm 10+
- Conta Supabase (Cloud) — plano Pro recomendado para PITR
- CLI Supabase: `npm i -g supabase`
- Chaves API:
  - `ANTHROPIC_API_KEY` (Claude — Planner/Executor/Monitor/Vision/Memory)
  - `OPENAI_API_KEY` (OpenAI — embeddings + Whisper)

## Setup rápido

```bash
git clone <repo>
cd yadone-app
npm install
cp .env.example .env.local           # preencher conforme tabela abaixo
npx supabase link --project-ref <ref>
npx supabase db push                 # aplicar 27 migrations
npm run db:seed                      # fixtures iniciais (opcional)
npm run dev                          # http://localhost:3000
```

Antes do primeiro `db push`, habilitar a extensão `pgvector` no Supabase (SQL Editor):

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

A migration `001_extensions.sql` também declara a extensão, mas em alguns projetos é mais seguro habilitar pelo painel antes.

## Variáveis de ambiente

| Nome | Obrigatório | Exemplo | Descrição |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Sim | `sk-ant-...` | Chave Claude (Planner/Executor/Monitor/Vision) |
| `OPENAI_API_KEY` | Sim | `sk-...` | Chave OpenAI (embeddings `text-embedding-3-small` + Whisper) |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | `https://xxx.supabase.co` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | `eyJh...` | Anon key (client-side reads) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | `eyJh...` | Service role (server-side; bypassa RLS) |
| `ENCRYPTION_KEY` | Sim | 64-char hex | AES-256 para `channel_configs.credentials_encrypted` |
| `ADMIN_TOKEN` | Sim | random 32+ chars | Bearer token para `/api/admin/*` |
| `CRON_SECRET` | Sim | random 32+ chars | Bearer token para `/api/cron/*` (Vercel) |

Gerar tokens random:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Arquitetura

```
[Webhook canal] → orchestrator.processMessage
                      |
                      ├─ runInputGuards          (rate-limit, cost-cap, idempotency)
                      ├─ processInboundMedia     (Whisper / Vision)
                      ├─ resolveOrCreateSession  (fixa flow_version)
                      ├─ saveMessage(user)
                      ├─ Loop ≤3 iterações:
                      |    ├─ buildPromptContext  (RAG + memória + catálogo)
                      |    ├─ planner             (Opus → classification + action)
                      |    ├─ executor            (Sonnet → response_text)
                      |    ├─ monitor             (Sonnet → quality check)
                      |    └─ output guards       (validate, filter, leak detect)
                      ├─ saveMessage(assistant)
                      └─ channelClient.send       (com typing simulation)
```

Pipeline detalhado: `lib/engine/orchestrator.ts`. Spec completo: `SPEC_MOTOR_BACKEND.md`.

### Modelos

| Modelo | Onde | Por quê |
|---|---|---|
| `claude-opus-4-7` | Planner | Único uso de Opus — raciocínio crítico de classificação |
| `claude-sonnet-4-6` | Executor, Monitor, Vision, Memory extractor | Qualidade/custo balanceados |
| `claude-haiku-4-5` | Content filter input | Classificação rápida e barata |
| `text-embedding-3-small` | RAG, memória episódica | 1536 dim, custo baixo |
| `whisper-1` | Transcrição de áudio | Padrão OpenAI para pt-BR |

## Endpoints

### Webhooks (públicos, validação por assinatura)

- `POST /api/webhooks/ycloud` — YCloud
- `POST /api/webhooks/zapi` — Z-API
- `POST /api/webhooks/evolution` — Evolution API

### Engine

- `POST /api/engine/process` — invocação manual (debug; mesma `processMessage` dos webhooks)

### Admin (Bearer `ADMIN_TOKEN`)

- `GET /api/admin/audit?workspace_id=&trace_id=&...` — audit log
- `GET /api/admin/sessions?workspace_id=&...` — listar sessões
- `GET /api/admin/sessions/[id]` — detalhe da sessão
- `POST /api/admin/sessions/[id]/handoff` — forçar handoff humano
- `GET /api/admin/clients?workspace_id=&phone=&...` — listar clientes
- `GET /api/admin/cost?workspace_id=&period=` — custo agregado
- `GET /api/admin/trace/[trace_id]` — timeline completa de um turno (T25)
- `GET /api/admin/metrics?workspace_id=&period=` — métricas agregadas (T25)

### Knowledge / Tools / Flows

- `GET POST /api/knowledge` — listar/criar knowledge entries
- `GET PATCH DELETE /api/knowledge/[id]` — gerenciar entry
- `GET /api/tools` — registry de tools disponíveis
- `POST /api/flows/[id]/snapshot` — congelar versão atual
- `GET /api/flows/[id]/versions` — listar versões
- `POST /api/flows/[id]/rollback/[version]` — restaurar versão anterior

### Clients

- `POST /api/clients/[id]/unify` — unificar dois client IDs (cross-channel; T28)

### Cron (Bearer `CRON_SECRET`, schedule via `vercel.json`)

| Path | Schedule | O que faz |
|---|---|---|
| `/api/cron/followups` | `* * * * *` | Dispara timers de followup vencidos (T29) |
| `/api/cron/expire-sessions` | `0 * * * *` | Expira sessões inativas (>24h) (T19) |
| `/api/cron/update-memory` | `*/15 * * * *` | Extrai memória de sessões fechadas (T20) |
| `/api/cron/index-knowledge` | `*/5 * * * *` | Indexa knowledge novos para RAG (T21) |
| `/api/cron/daily-metrics` | `0 3 * * *` | Agrega métricas diárias por workspace (T22) |

## Banco de dados

27 migrations em `supabase/migrations/`. Tabelas-chave:

- `workspaces` + `agent_configs` — cliente (multi-tenant) + config do motor
- `flows` + `flow_nodes` + `flow_edges` + `flow_versions` — fluxo conversacional versionado
- `knowledge_base` + `knowledge_chunks` (pgvector) — RAG
- `clients` + `client_memory` + `client_episodic_memory` — perfil + memória
- `sessions` + `messages` — conversas
- `appointments` + `crm_events` — agendamentos e eventos
- `tools_registry` — tools habilitadas por workspace
- `channel_configs` — credenciais de canal (criptografadas via `ENCRYPTION_KEY`)
- `followup_timers` — timers para followup proativo
- `rate_limit_buckets` + `workspace_cost_caps` — guardrails
- `audit_logs` + `monitor_decisions` — observabilidade
- `idempotency_keys` — dedup de webhooks

## Deploy

### Vercel

```bash
vercel link
# preencher cada env var em production:
vercel env add ANTHROPIC_API_KEY production
vercel env add OPENAI_API_KEY production
# ... (todas as vars da tabela acima)
git push origin main   # deploy automático
```

`vercel.json` já habilita os 5 crons. Confirmar em Vercel → Settings → Cron Jobs.

### Supabase

```bash
npx supabase link --project-ref <ref>
npx supabase db push     # aplica todas as migrations
```

Habilitar `pgvector` antes (ver Setup rápido).

## Troubleshooting

**Webhook retorna 400 `channel_config not found`**
Confirmar registro ativo em `channel_configs` com o `phone_number` correto e `is_active=true`.

**Motor não responde, audit log mostra `circuit_breaker.open`**
Anthropic ou OpenAI estão indisponíveis. Reset automático após cooldown (1 min). Reset manual: `UPDATE workspaces SET breaker_state=...` ou aguardar.

**Cliente recebe "Tive um problema técnico"**
Erro inesperado no orchestrator. Buscar:
```sql
SELECT * FROM audit_logs
WHERE event_type LIKE 'orchestrator.fallback_%'
  AND trace_id = '<trace_id>';
```

**Cost cap bloqueando todas as mensagens**
Workspace atingiu 100% do budget mensal. Ajustar em `workspace_cost_caps` ou aguardar reset no dia 1 do mês.

**`npx tsc --noEmit` falhando após `git pull`**
Migrations Supabase podem ter alterado tipos. Revisar `types/*.ts` vs migrations recentes; se aplicável, regenerar com `npx supabase gen types typescript`.

**Loop de replan saturando custo**
Sessão com `replan_count >= 3` força handoff (`lib/guardrails/circuit-breaker.ts`). Se ainda assim consumindo: verificar `audit_logs` por `event_type='monitor.recommendation'` com `recommended_action='replan'` recorrente — indica problema no Planner ou prompt.

**Webhook não dispara processMessage**
T17 chamou `processMessage` por import direto (não fetch). Se webhook responde 200 mas nada acontece, ler logs do Vercel para o handler do webhook (não do `/engine/process`).

## Testes

```bash
npm test                        # todos os testes
npx jest tests/integration      # 15 cenários end-to-end (T23)
npx jest tests/edge-cases       # inputs extremos + falhas (T24)
npx jest tests/load             # concorrência (T24)
```

Ver `tests/golden/` para o golden set de evaluation contínuo (`SPEC_MOTOR_GOVERNANCE.md` §3.3).

## Convenções para contribuintes

- Validar `npx tsc --noEmit` (exit 0) antes de cada commit
- `STATUS.md` é a única fonte de verdade do progresso — atualizar ao concluir tarefa
- Decisões técnicas que divergem do spec ficam no bloco da tarefa em `HISTORY.md`
- Documentação em pt-BR
- PRs que toquem em queries multi-tenant precisam de filtro `workspace_id` explícito + teste de isolamento

## Documentação adicional

- `SPEC_MOTOR_BACKEND.md` — especificação completa do motor (arquitetura, pipeline, prompts)
- `SPEC_MOTOR_GOVERNANCE.md` — governança pós-MVP (versionamento, replay, eval, LGPD, DR, roadmap)
- `STATUS.md` — estado atual do projeto e tarefas pendentes
- `HISTORY.md` — histórico detalhado por tarefa
- `CLAUDE.md` — convenções para agentes IA contribuindo (tracking de tempo, etc)
