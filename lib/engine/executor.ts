// lib/engine/executor.ts — Camada 3 do motor (Executor).
// Modelo: claude-sonnet-4-6, temperature 0.7, max_tokens 1024 por iteração.
// SPEC §2, §3, §11 + GAPS #12 (ReAct multi-turn) e #13 (mixed-initiative).
//
// Recebe a decisão do Planner (T12) e gera a resposta final ao usuário.
// Despacha por action: respond | call_tool | digress | resume | handoff | wait | advance | re_plan.
// Para call_tool, roda loop ReAct (max 5 iterações) com tool_use blocks da Anthropic API.
// Mixed-initiative via buildMixedInitiativeContext → injetado na Seção 7 do system prompt.
//
// Eventos CRM emitidos:
//   - conversation.handoff (action=handoff ou forced_handoff)
//   - appointment.created (criar_agendamento sucesso)
//   - interest.product_enquiry: REMOVIDO desta task (gera muito falso positivo).
//     Será coberto por job dedicado no Bloco 9.

import { anthropicClient } from '@/lib/resilience/external-clients'
import type {
  AnthropicContentBlock,
  AnthropicToolSpec,
} from '@/lib/resilience/external-clients'
import { trackUsage } from '@/lib/metrics/cost-tracker'
import { buildSystemPrompt } from './prompt-builder'
import { buildMixedInitiativeContext } from './mixed-initiative'
import { executeTool } from '@/lib/tools/executor'
import { getFlowToolPolicies } from '@/lib/db/flows'
import { getToolDefinition, listAvailableTools } from '@/lib/tools/registry'
import { emitEvent } from '@/lib/db/crm-events'
import { logAudit } from '@/lib/db/audit'
import { createTimer } from '@/lib/db/followup-timers'
import type { PromptContext } from './context-builder'
import type { PlannerDecision } from '@/types/planner'
import type {
  DigressionState,
  ObjectivePending,
  Session,
} from '@/types/session'
import type { ToolDefinition, ToolExecutionResult } from '@/types/tools'

const EXECUTOR_MODEL = 'claude-sonnet-4-6'
const EXECUTOR_TEMPERATURE = 0.7
const EXECUTOR_MAX_TOKENS = 1024
const REACT_MAX_ITERATIONS = 5

export interface ExecutorToolCallTrace {
  tool_id: string
  success: boolean
  duration_ms: number
  error?: string
}

export interface ExecutorResult {
  /** Texto a enviar ao cliente. '' quando advance/wait/re_plan. */
  response_text: string
  /** Diff a aplicar via updateSession (orchestrator T17). */
  session_updates: Partial<Session>
  /** Trace de cada tool executada na ReAct loop. */
  tool_calls_made: ExecutorToolCallTrace[]
  /** Iterações usadas (1 para respond/digress/resume/handoff; 1..5 para call_tool). */
  iterations_used: number
  /** Próximo nó quando action='advance'. */
  next_node_id?: string
  /** Sinaliza handoff forçado (max_iterations excedido). */
  forced_handoff?: boolean
  forced_handoff_reason?: string
  model_used: string
  tokens_in: number
  tokens_out: number
}

interface SystemPromptInput {
  ctx: PromptContext
  withMixedInitiative?: boolean
  extraHint?: string
}

function buildPrompt(input: SystemPromptInput): string {
  const hints: string[] = []
  if (input.withMixedInitiative !== false) {
    const mi = buildMixedInitiativeContext(input.ctx)
    if (mi) hints.push(mi)
  }
  if (input.extraHint) hints.push(input.extraHint.trim())
  const extra_behavior_hints = hints.length > 0 ? hints.join('\n') : undefined
  return buildSystemPrompt(input.ctx, { extra_behavior_hints })
}

function emptyResult(model_used: string = EXECUTOR_MODEL): ExecutorResult {
  return {
    response_text: '',
    session_updates: {},
    tool_calls_made: [],
    iterations_used: 0,
    model_used,
    tokens_in: 0,
    tokens_out: 0,
  }
}

function applyDigressionStateUpdate(
  decision: PlannerDecision,
  current: PromptContext,
): Partial<Session> {
  // Calcula próximo digression_state e objective_stack a partir da decisão.
  // Reaplica lógica enxuta do digression-detector (que já foi rodado no Planner)
  // — mas como o Planner não retorna explicitamente next_state/next_stack para
  // evitar acoplamento, recalculamos aqui de forma defensiva.
  const stack: ObjectivePending[] = current.session.objective_stack ?? []
  const updates: Partial<Session> = {}

  if (decision.action === 'digress' && decision.objective_pending) {
    const nextStack = [...stack, decision.objective_pending].slice(-3)
    updates.objective_stack = nextStack
    updates.digression_state = (nextStack.length === 1 ? 'active' : 'nested') as DigressionState
  } else if (decision.action === 'resume') {
    const nextStack = stack.slice(0, -1)
    updates.objective_stack = nextStack
    updates.digression_state = (
      nextStack.length === 0 ? 'resuming' : nextStack.length === 1 ? 'active' : 'nested'
    ) as DigressionState
  }
  return updates
}

function asAnthropicTool(def: ToolDefinition): AnthropicToolSpec {
  return {
    name: def.tool_id,
    description: def.description,
    input_schema: def.params_schema as Record<string, unknown>,
  }
}

async function listToolsForPrompt(flow_id: string | null): Promise<AnthropicToolSpec[]> {
  if (!flow_id) return []
  const policies = await getFlowToolPolicies(flow_id)
  const allowedIds = policies.filter((p) => p.allowed === true).map((p) => p.tool_id)
  if (allowedIds.length === 0) return []
  const all = await listAvailableTools()
  return all.filter((t) => allowedIds.includes(t.tool_id)).map(asAnthropicTool)
}

function summarizeText(blocks: AnthropicContentBlock[]): string {
  return blocks
    .filter((b) => (b as { type?: string }).type === 'text')
    .map((b) => ((b as { text?: string }).text ?? '').trim())
    .filter(Boolean)
    .join('\n')
}

function extractToolUses(blocks: AnthropicContentBlock[]): Array<{
  id: string
  name: string
  input: Record<string, unknown>
}> {
  const out: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
  for (const b of blocks) {
    if ((b as { type?: string }).type === 'tool_use') {
      const tu = b as { id: string; name: string; input: Record<string, unknown> }
      out.push({ id: tu.id, name: tu.name, input: tu.input ?? {} })
    }
  }
  return out
}

async function callExecutorPlain(
  ctx: PromptContext,
  extraHint?: string,
  user_text?: string,
): Promise<{ text: string; tokens_in: number; tokens_out: number }> {
  const system = buildPrompt({ ctx, extraHint })
  const resp = await anthropicClient.complete({
    model: EXECUTOR_MODEL,
    system,
    messages: [{ role: 'user', content: user_text ?? ctx.current_message }],
    max_tokens: EXECUTOR_MAX_TOKENS,
    temperature: EXECUTOR_TEMPERATURE,
  })
  void trackUsage(
    ctx.workspace.id,
    EXECUTOR_MODEL,
    resp.usage_input,
    resp.usage_output,
    ctx.session.id,
    { component: 'executor', trace_id: ctx.session.current_trace_id ?? null },
  )
  return {
    text: (resp.content ?? '').trim(),
    tokens_in: resp.usage_input,
    tokens_out: resp.usage_output,
  }
}

// ============================================================
// Despacho por action
// ============================================================

async function handleRespond(ctx: PromptContext): Promise<ExecutorResult> {
  const out = await callExecutorPlain(ctx)
  return {
    response_text: out.text,
    session_updates: {},
    tool_calls_made: [],
    iterations_used: 1,
    model_used: EXECUTOR_MODEL,
    tokens_in: out.tokens_in,
    tokens_out: out.tokens_out,
  }
}

async function handleDigress(
  ctx: PromptContext,
  decision: PlannerDecision,
): Promise<ExecutorResult> {
  const hint =
    'Esta resposta endereça uma DIGRESSÃO. Responda a pergunta do cliente com naturalidade e, ao final, plante um gancho sutil de retomada do objetivo pausado (sem ser robótico, em tom conversacional).'
  const out = await callExecutorPlain(ctx, hint)
  const updates = applyDigressionStateUpdate(decision, ctx)
  return {
    response_text: out.text,
    session_updates: updates,
    tool_calls_made: [],
    iterations_used: 1,
    model_used: EXECUTOR_MODEL,
    tokens_in: out.tokens_in,
    tokens_out: out.tokens_out,
  }
}

async function handleResume(
  ctx: PromptContext,
  decision: PlannerDecision,
): Promise<ExecutorResult> {
  const top = decision.objective_pending
  const objectiveText = top?.objective || 'o objetivo anterior'
  const hint = `Esta resposta RETOMA um objetivo pausado: "${objectiveText}". Comece com um gancho sutil ("voltando ao seu agendamento...", "retomando aquilo que estávamos vendo...") e siga adiante naturalmente.`
  const out = await callExecutorPlain(ctx, hint)
  const updates = applyDigressionStateUpdate(decision, ctx)
  return {
    response_text: out.text,
    session_updates: updates,
    tool_calls_made: [],
    iterations_used: 1,
    model_used: EXECUTOR_MODEL,
    tokens_in: out.tokens_in,
    tokens_out: out.tokens_out,
  }
}

async function handleHandoff(
  ctx: PromptContext,
  decision: PlannerDecision,
): Promise<ExecutorResult> {
  const hint =
    'Esta resposta TRANSFERE o atendimento para um humano. Diga ao cliente, com cordialidade, que vai chamar alguém da equipe para ajudar, sem detalhes técnicos. Mantenha curto (1-2 frases).'
  const out = await callExecutorPlain(ctx, hint)
  void emitEvent(
    'conversation.handoff',
    { reason: decision.reasoning, classification: decision.classification },
    {
      workspace_id: ctx.workspace.id,
      session_id: ctx.session.id,
      client_id: ctx.session.client_id,
      trace_id: ctx.session.current_trace_id ?? null,
    },
  )
  return {
    response_text: out.text,
    session_updates: { status: 'handoff' },
    tool_calls_made: [],
    iterations_used: 1,
    model_used: EXECUTOR_MODEL,
    tokens_in: out.tokens_in,
    tokens_out: out.tokens_out,
  }
}

async function handleAdvance(
  ctx: PromptContext,
  decision: PlannerDecision,
): Promise<ExecutorResult> {
  // advance: muda current_node_id, sem gerar resposta. orchestrator (T17) decide se
  // chama o engine novamente para o nó-alvo gerar a próxima fala.
  const next = decision.next_node_id
  const updates: Partial<Session> = next ? { current_node_id: next } : {}
  if (ctx.session.current_node_id) {
    const completed = ctx.session.completed_steps ?? []
    if (!completed.includes(ctx.session.current_node_id)) {
      updates.completed_steps = [...completed, ctx.session.current_node_id]
    }
  }
  return {
    response_text: '',
    session_updates: updates,
    tool_calls_made: [],
    iterations_used: 0,
    next_node_id: next,
    model_used: EXECUTOR_MODEL,
    tokens_in: 0,
    tokens_out: 0,
  }
}

async function handleWait(ctx: PromptContext): Promise<ExecutorResult> {
  // wait: cria followup_timer + emite resposta neutra de "vou aguardar".
  // O nó wait deve estar configurado com duration; aqui usamos default 1h se ausente.
  const node = ctx.current_node
  const cfg = (node?.config as unknown) as
    | { duration?: { value: number; unit: 'minutes' | 'hours' | 'days' }; timeout_node_id?: string }
    | undefined
  const duration = cfg?.duration ?? { value: 60, unit: 'minutes' as const }
  const ms =
    duration.unit === 'days'
      ? duration.value * 24 * 60 * 60 * 1000
      : duration.unit === 'hours'
        ? duration.value * 60 * 60 * 1000
        : duration.value * 60 * 1000
  const scheduled = new Date(Date.now() + ms).toISOString()

  try {
    if (cfg?.timeout_node_id) {
      await createTimer({
        session_id: ctx.session.id,
        workspace_id: ctx.workspace.id,
        client_id: ctx.session.client_id,
        target_node_id: cfg.timeout_node_id,
        scheduled_at: scheduled,
      })
    }
  } catch (e) {
    void logAudit(
      'executor.wait_timer_failed',
      { error: (e as Error).message },
      { workspace_id: ctx.workspace.id, session_id: ctx.session.id },
    )
  }

  const hint =
    'Esta resposta sinaliza que você vai aguardar a resposta do cliente sem pressionar. Seja curta e leve.'
  const out = await callExecutorPlain(ctx, hint)
  return {
    response_text: out.text,
    session_updates: { status: 'waiting', wait_until: scheduled },
    tool_calls_made: [],
    iterations_used: 1,
    model_used: EXECUTOR_MODEL,
    tokens_in: out.tokens_in,
    tokens_out: out.tokens_out,
  }
}

// ============================================================
// ReAct loop (action=call_tool)
// ============================================================

interface AnthropicMessageRecord {
  role: 'user' | 'assistant'
  content: AnthropicContentBlock[] | string
}

async function emitToolEvents(
  ctx: PromptContext,
  tool_id: string,
  result: ToolExecutionResult,
): Promise<void> {
  if (!result.success) return
  if (tool_id === 'criar_agendamento') {
    const r = (result.result ?? {}) as Record<string, unknown>
    void emitEvent('appointment.created', r, {
      workspace_id: ctx.workspace.id,
      session_id: ctx.session.id,
      client_id: ctx.session.client_id,
      trace_id: ctx.session.current_trace_id ?? null,
    })
  }
  // TODO Bloco 9: emitir 'interest.product_enquiry' via job dedicado com classificação Haiku.
  // Heurística inline foi removida para evitar falso positivo (decisão do plano, ajuste #3).
}

async function reActLoop(
  ctx: PromptContext,
  decision: PlannerDecision,
): Promise<ExecutorResult> {
  const tools = await listToolsForPrompt(ctx.session.flow_id)
  if (tools.length === 0) {
    // Sem tools disponíveis: degrada para respond.
    void logAudit(
      'executor.no_tools_available',
      { flow_id: ctx.session.flow_id },
      { workspace_id: ctx.workspace.id, session_id: ctx.session.id },
    )
    return handleRespond(ctx)
  }

  const system = buildPrompt({ ctx })
  const messages: AnthropicMessageRecord[] = [
    { role: 'user', content: ctx.current_message },
  ]
  // Se o Planner já indicou tool_name + tool_params, dá um nudge inicial colocando
  // a sugestão como hint na primeira mensagem do user. O modelo decide se segue.
  if (decision.tool_name) {
    messages[0] = {
      role: 'user',
      content: `${ctx.current_message}\n\n<planner_hint>O Planner sugere usar a tool "${decision.tool_name}" com input ${JSON.stringify(
        decision.tool_params ?? {},
      )}. Use seu julgamento.</planner_hint>`,
    }
  }

  const tool_calls_made: ExecutorToolCallTrace[] = []
  let tokens_in = 0
  let tokens_out = 0
  let iterations = 0

  while (iterations < REACT_MAX_ITERATIONS) {
    iterations++
    const resp = await anthropicClient.completeWithTools({
      model: EXECUTOR_MODEL,
      system,
      messages: messages as unknown as { role: 'user' | 'assistant'; content: string | Array<Record<string, unknown>> }[],
      max_tokens: EXECUTOR_MAX_TOKENS,
      temperature: EXECUTOR_TEMPERATURE,
      tools,
      tool_choice: { type: 'auto' },
    })
    tokens_in += resp.usage_input
    tokens_out += resp.usage_output
    void trackUsage(
      ctx.workspace.id,
      EXECUTOR_MODEL,
      resp.usage_input,
      resp.usage_output,
      ctx.session.id,
      {
        component: 'executor',
        iteration: iterations,
        trace_id: ctx.session.current_trace_id ?? null,
      },
    )

    // Append assistant message com seus content_blocks
    messages.push({ role: 'assistant', content: resp.content_blocks })

    const toolUses = extractToolUses(resp.content_blocks)
    if (toolUses.length === 0 || resp.stop_reason === 'end_turn') {
      // Resposta final.
      return {
        response_text: summarizeText(resp.content_blocks),
        session_updates: applyDigressionStateUpdate(decision, ctx),
        tool_calls_made,
        iterations_used: iterations,
        model_used: EXECUTOR_MODEL,
        tokens_in,
        tokens_out,
      }
    }

    // Executa cada tool_use chamada nesta iteração.
    const toolResultBlocks: AnthropicContentBlock[] = []
    for (const tu of toolUses) {
      const def = await getToolDefinition(tu.name)
      if (!def) {
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ error: `tool_not_found: ${tu.name}` }),
          is_error: true,
        } as unknown as AnthropicContentBlock)
        tool_calls_made.push({
          tool_id: tu.name,
          success: false,
          duration_ms: 0,
          error: 'tool_not_found',
        })
        continue
      }
      const start = Date.now()
      try {
        const result = await executeTool(tu.name, tu.input, {
          workspace_id: ctx.workspace.id,
          session_id: ctx.session.id,
          flow_id: ctx.session.flow_id,
          trace_id: ctx.session.current_trace_id ?? undefined,
        })
        tool_calls_made.push({
          tool_id: tu.name,
          success: !!result.success,
          duration_ms: result.duration_ms ?? Date.now() - start,
        })
        await emitToolEvents(ctx, tu.name, result)
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        } as unknown as AnthropicContentBlock)
      } catch (e) {
        const err = (e as Error).message
        tool_calls_made.push({
          tool_id: tu.name,
          success: false,
          duration_ms: Date.now() - start,
          error: err,
        })
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ error: err }),
          is_error: true,
        } as unknown as AnthropicContentBlock)
      }
    }

    // Append user message com os tool_result blocks.
    messages.push({ role: 'user', content: toolResultBlocks })
  }

  // Atingiu MAX_ITERATIONS sem encerrar: força handoff.
  void emitEvent(
    'conversation.handoff',
    { reason: 'max_tool_iterations_exceeded', iterations },
    {
      workspace_id: ctx.workspace.id,
      session_id: ctx.session.id,
      client_id: ctx.session.client_id,
      trace_id: ctx.session.current_trace_id ?? null,
    },
  )
  void logAudit(
    'executor.max_iterations_handoff',
    { iterations, tool_calls_made },
    { workspace_id: ctx.workspace.id, session_id: ctx.session.id },
  )

  // Mensagem fallback ao cliente (sem chamada extra ao LLM para não estourar).
  return {
    response_text:
      'Vou chamar alguém da equipe pra te ajudar com isso, um instante.',
    session_updates: { status: 'handoff' },
    tool_calls_made,
    iterations_used: iterations,
    forced_handoff: true,
    forced_handoff_reason: 'max_tool_iterations_exceeded',
    model_used: EXECUTOR_MODEL,
    tokens_in,
    tokens_out,
  }
}

// ============================================================
// Entry point
// ============================================================

/**
 * Executa a decisão do Planner, gerando resposta ao cliente.
 *
 * Não persiste session_updates — devolve para o orchestrator (T17) aplicar
 * via updateSession. Eventos CRM (handoff, appointment.created) são emitidos
 * fire-and-forget aqui mesmo.
 */
export async function execute(
  decision: PlannerDecision,
  ctx: PromptContext,
): Promise<ExecutorResult> {
  switch (decision.action) {
    case 'respond':
      return handleRespond(ctx)
    case 'call_tool':
      return reActLoop(ctx, decision)
    case 'digress':
      return handleDigress(ctx, decision)
    case 'resume':
      return handleResume(ctx, decision)
    case 'handoff':
      return handleHandoff(ctx, decision)
    case 'wait':
      return handleWait(ctx)
    case 'advance':
      return handleAdvance(ctx, decision)
    case 're_plan':
      // Orchestrator (T17) trata: incrementa replan_count e re-chama plan().
      // Executor é no-op nesta action.
      return emptyResult()
    default: {
      void logAudit(
        'executor.unknown_action',
        { action: (decision as PlannerDecision).action },
        { workspace_id: ctx.workspace.id, session_id: ctx.session.id },
      )
      return emptyResult()
    }
  }
}
