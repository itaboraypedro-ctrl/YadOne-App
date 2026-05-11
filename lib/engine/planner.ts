// lib/engine/planner.ts — Camada 2 do motor (Cérebro).
// Modelo: claude-opus-4-7 (única tarefa do projeto que usa Opus).
// SPEC §2, §6 + GAPS #5 (nested) e #6 (FRUSTRATION).
//
// Decide o que fazer a cada turno. Não gera resposta ao usuário.
// Output: JSON estruturado que o Executor (T13) consome em seguida.
//
// Ordem do algoritmo:
//   1. Monta system prompt (buildSystemPrompt) + envelope <planner_role>.
//   2. Lista tools allowed na flow ativa.
//   3. Chama Anthropic via anthropicClient.complete (retry + breaker já cobertos).
//   4. Parse JSON tolerante; falha → fallback re_plan.
//   5. Valida classification ∈ 6, action ∈ 8, confidence ∈ [0,1].
//   6. Tool não-autorizada → re_plan + audit (gap allowlist; ajuste #1).
//   7. Aplica regras determinísticas via applyDigressionRules.
//   8. Audit planner.decision (fire-and-forget).

import { anthropicClient } from '@/lib/resilience/external-clients'
import { trackUsage } from '@/lib/metrics/cost-tracker'
import { buildSystemPrompt } from './prompt-builder'
import {
  applyDigressionRules,
  MAX_DIGRESSION_DEPTH,
} from './digression-detector'
import { getFlowToolPolicies } from '@/lib/db/flows'
import { logAudit } from '@/lib/db/audit'
import type { PromptContext } from './context-builder'
import type {
  DigressionState,
  MessageClassification,
  ObjectivePending,
} from '@/types/session'
import type { PlannerAction, PlannerDecision } from '@/types/planner'

const PLANNER_MODEL = 'claude-opus-4-7'
const PLANNER_TEMPERATURE = 0.0
const PLANNER_MAX_TOKENS = 600

const VALID_CLASSIFICATIONS: ReadonlyArray<MessageClassification> = [
  'ON_TOPIC',
  'DIGRESSION',
  'CHITCHAT',
  'ESCALATION',
  'CANCELLATION',
  'FRUSTRATION',
]
const VALID_ACTIONS: ReadonlyArray<PlannerAction> = [
  'respond',
  'call_tool',
  'digress',
  'resume',
  'handoff',
  'wait',
  'advance',
  're_plan',
]

const HISTORY_LIMIT_FOR_PLANNER = 5
const LOW_CONFIDENCE_THRESHOLD = 0.5

interface RawPlannerOutput {
  classification?: string
  action?: string
  reasoning?: string
  confidence?: number
  tool_call?: { name?: string; input?: Record<string, unknown> } | null
  tool_name?: string
  tool_params?: Record<string, unknown>
  digression_topic?: string
  suggested_node_id?: string
  next_node_id?: string
  objective_to_push?: ObjectivePending
}

function plannerEnvelope(allowed_tools: string[]): string {
  const toolList = allowed_tools.length === 0
    ? '(nenhuma tool disponível neste fluxo)'
    : allowed_tools.map((t) => `- ${t}`).join('\n')
  return `<planner_role>
Você é o componente PLANNER. NÃO gere resposta ao usuário. NÃO converse.
Apenas analise a última mensagem do cliente e decida a próxima ação.

Classifique a mensagem em UMA das categorias:
- ON_TOPIC: a mensagem avança o objetivo atual da etapa.
- DIGRESSION: muda de assunto, mas é pergunta legítima (ex: pergunta de preço durante agendamento).
- CHITCHAT: conversa casual sem direção (cumprimento, comentário do tempo).
- ESCALATION: cliente quer falar com humano.
- CANCELLATION: cliente quer cancelar/encerrar.
- FRUSTRATION: cliente demonstra irritação ou impaciência (sinal — não muda fluxo).

Escolha UMA action:
- respond: gerar resposta natural ao cliente.
- call_tool: executar uma tool (informe tool_call.name e tool_call.input).
- digress: tratar a digressão (push objetivo atual e responder o desvio).
- resume: retomar objetivo pausado no topo do stack.
- handoff: transferir para humano.
- wait: aguardar (timer/followup).
- advance: avançar para próximo nó (sem gerar resposta).
- re_plan: replanejar (use só se não souber decidir).

Tools disponíveis neste fluxo:
${toolList}

Regras:
- Se action='call_tool', tool_call.name DEVE ser uma das listadas acima.
- confidence ∈ [0.0, 1.0]. Se < 0.5, será revisado pelo Monitor.
- objective_to_push: usar quando action='digress' para registrar o que está sendo pausado.

Responda APENAS com um único bloco JSON entre \`\`\`json ... \`\`\`, sem texto antes ou depois.
Schema:
{
  "classification": "ON_TOPIC | DIGRESSION | CHITCHAT | ESCALATION | CANCELLATION | FRUSTRATION",
  "action": "respond | call_tool | digress | resume | handoff | wait | advance | re_plan",
  "reasoning": "1-2 frases explicando a decisão",
  "confidence": 0.0,
  "tool_call": null | { "name": "...", "input": { ... } },
  "digression_topic": "string opcional quando action=digress",
  "suggested_node_id": "uuid opcional quando action=advance",
  "objective_to_push": null | { "node_id": "...", "objective": "...", "collected_so_far": {} }
}
</planner_role>`
}

function plannerStateSnippet(ctx: PromptContext): string {
  const stack = ctx.session.objective_stack ?? []
  const topItems = stack
    .slice(-MAX_DIGRESSION_DEPTH)
    .reverse()
    .map((o, i) => `  ${i + 1}. ${o.objective}`)
    .join('\n')
  const lines = [
    '<planner_state>',
    `digression_state: ${ctx.session.digression_state}`,
    `objective_stack_depth: ${stack.length}/${MAX_DIGRESSION_DEPTH}`,
  ]
  if (stack.length > 0) {
    lines.push('objective_stack (topo primeiro):')
    lines.push(topItems)
  }
  lines.push('</planner_state>')
  return lines.join('\n')
}

function recentHistoryForPlanner(ctx: PromptContext): string {
  const recent = ctx.conversation_history.slice(-HISTORY_LIMIT_FOR_PLANNER)
  if (recent.length === 0) return '(sem histórico)'
  return recent.map((m) => `[${m.role}]: ${(m.content ?? '').trim()}`).join('\n')
}

function extractJsonBlock(raw: string): string | null {
  if (!raw) return null
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  if (fenced && fenced[1]) return fenced[1].trim()
  // fallback: primeiro {...} balanceado top-level
  const first = raw.indexOf('{')
  if (first < 0) return null
  let depth = 0
  for (let i = first; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return raw.slice(first, i + 1)
    }
  }
  return null
}

function parsePlannerOutput(raw: string): RawPlannerOutput | null {
  const block = extractJsonBlock(raw)
  if (!block) return null
  try {
    return JSON.parse(block) as RawPlannerOutput
  } catch {
    return null
  }
}

function isValidClassification(v: unknown): v is MessageClassification {
  return typeof v === 'string' && (VALID_CLASSIFICATIONS as readonly string[]).includes(v)
}
function isValidAction(v: unknown): v is PlannerAction {
  return typeof v === 'string' && (VALID_ACTIONS as readonly string[]).includes(v)
}

function clampConfidence(v: unknown): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function buildCurrentObjective(ctx: PromptContext): ObjectivePending | null {
  const node = ctx.current_node
  if (!node) return null
  return {
    node_id: node.id,
    objective: node.config?.objective ?? '',
    collected_so_far: ctx.session.collected_data ?? {},
  }
}

function fallbackReplan(reasoning: string): PlannerDecision {
  return {
    classification: 'ON_TOPIC',
    action: 're_plan',
    confidence: 0,
    reasoning,
  }
}

/**
 * Decide a próxima ação do agente para uma mensagem do cliente.
 *
 * NÃO incrementa replan_count — caller (orchestrator T17) é responsável.
 * NÃO persiste em sessions.objective_stack — devolve next_state/next_stack
 * via campos da decisão para o orchestrator aplicar.
 */
export async function plan(ctx: PromptContext): Promise<PlannerDecision> {
  const auditCtx = {
    workspace_id: ctx.workspace.id,
    session_id: ctx.session.id,
    trace_id: ctx.session.current_trace_id ?? null,
  }

  // 1) Tools allowed para este fluxo.
  let allowedToolIds: string[] = []
  if (ctx.session.flow_id) {
    try {
      const policies = await getFlowToolPolicies(ctx.session.flow_id)
      allowedToolIds = policies
        .filter((p) => p.allowed === true)
        .map((p) => p.tool_id)
    } catch (e) {
      void logAudit(
        'planner.policy_fetch_failed',
        { error: (e as Error).message, flow_id: ctx.session.flow_id },
        auditCtx,
      )
    }
  }

  // 2) Monta prompts.
  const systemPrompt = buildSystemPrompt(ctx)
  const envelope = plannerEnvelope(allowedToolIds)
  const stateSnippet = plannerStateSnippet(ctx)
  const historySnippet = recentHistoryForPlanner(ctx)

  const userContent =
    `${envelope}\n\n` +
    `${stateSnippet}\n\n` +
    `<recent_history>\n${historySnippet}\n</recent_history>\n\n` +
    `<current_message>${ctx.current_message}</current_message>\n\n` +
    `Decida agora. Responda apenas com o bloco JSON.`

  // 3) Chamada Anthropic.
  let raw: string
  try {
    const resp = await anthropicClient.complete({
      model: PLANNER_MODEL,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
      max_tokens: PLANNER_MAX_TOKENS,
    })
    void trackUsage(
      ctx.workspace.id,
      PLANNER_MODEL,
      resp.usage_input,
      resp.usage_output,
      ctx.session.id,
      { component: 'planner', trace_id: ctx.session.current_trace_id ?? null },
    )
    raw = resp.content ?? ''
  } catch (e) {
    void logAudit(
      'planner.api_failed',
      { error: (e as Error).message },
      auditCtx,
    )
    return fallbackReplan('planner_api_failed')
  }

  // 4) Parse tolerante.
  const parsed = parsePlannerOutput(raw)
  if (!parsed) {
    void logAudit('planner.parse_error', { raw: raw.slice(0, 500) }, auditCtx)
    return fallbackReplan('planner_parse_error')
  }

  // 5) Validar campos obrigatórios.
  if (!isValidClassification(parsed.classification)) {
    void logAudit(
      'planner.invalid_classification',
      { received: parsed.classification },
      auditCtx,
    )
    return fallbackReplan('planner_invalid_classification')
  }
  if (!isValidAction(parsed.action)) {
    void logAudit('planner.invalid_action', { received: parsed.action }, auditCtx)
    return fallbackReplan('planner_invalid_action')
  }

  let action: PlannerAction = parsed.action
  let tool_name: string | undefined =
    parsed.tool_call?.name ?? parsed.tool_name
  let tool_params: Record<string, unknown> | undefined =
    parsed.tool_call?.input ?? parsed.tool_params
  let reasoning = (parsed.reasoning ?? '').trim() || 'no_reasoning_provided'

  // 6) Tool fora da allowlist → re_plan (ajuste #1).
  if (action === 'call_tool') {
    if (!tool_name) {
      reasoning = `tool_not_authorized: missing_tool_name | ${reasoning}`
      action = 're_plan'
      tool_name = undefined
      tool_params = undefined
      void logAudit('planner.tool_not_authorized', { reason: 'missing_name' }, auditCtx)
    } else if (!allowedToolIds.includes(tool_name)) {
      reasoning = `tool_not_authorized: ${tool_name} | ${reasoning}`
      void logAudit(
        'planner.tool_not_authorized',
        { tool_name, allowed: allowedToolIds, flow_id: ctx.session.flow_id },
        auditCtx,
      )
      action = 're_plan'
      tool_name = undefined
      tool_params = undefined
    }
  }

  // 7) Aplicar regras determinísticas de digressão.
  const transition = applyDigressionRules({
    current_state: ctx.session.digression_state as DigressionState,
    current_stack: ctx.session.objective_stack ?? [],
    classification: parsed.classification,
    llm_action: action,
    current_objective: buildCurrentObjective(ctx),
  })

  // Se a regra sobrescreveu a action (depth/escalation), audita.
  if (transition.audit_event) {
    void logAudit(
      transition.audit_event,
      {
        original_action: action,
        resolved_action: transition.resolved_action,
        stack_depth: ctx.session.objective_stack?.length ?? 0,
      },
      auditCtx,
    )
  }
  action = transition.resolved_action

  // Build decisão final.
  const confidence = clampConfidence(parsed.confidence)
  const low_confidence_flag = confidence < LOW_CONFIDENCE_THRESHOLD
  const frustration_signal = parsed.classification === 'FRUSTRATION' ? true : undefined

  // objective_pending: usado em digress (push) e em resume (top do stack consumido).
  let objective_pending: ObjectivePending | undefined
  if (action === 'digress') {
    objective_pending = transition.pushed_objective ?? parsed.objective_to_push
  } else if (action === 'resume') {
    objective_pending = transition.resumed_objective
  }

  const decision: PlannerDecision = {
    classification: parsed.classification,
    action,
    tool_name,
    tool_params,
    digression_topic: parsed.digression_topic,
    objective_pending,
    next_node_id: parsed.next_node_id ?? parsed.suggested_node_id,
    confidence,
    reasoning,
    frustration_signal,
    low_confidence_flag: low_confidence_flag || undefined,
  }

  // 8) Audit final.
  void logAudit(
    'planner.decision',
    {
      classification: decision.classification,
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      frustration_signal: decision.frustration_signal ?? false,
      low_confidence_flag: decision.low_confidence_flag ?? false,
      tool_name: decision.tool_name ?? null,
      next_state: transition.next_state,
      next_stack_depth: transition.next_stack.length,
    },
    auditCtx,
  )

  return decision
}

/**
 * Reaplicação dos efeitos de transição de estado para o caller (orchestrator).
 * Reexpõe a função pura para que T17 possa derivar `next_state`/`next_stack`
 * sem chamar o Planner novamente.
 */
export { applyDigressionRules } from './digression-detector'
