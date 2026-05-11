// lib/engine/orchestrator-helpers.ts — Auxiliares para o Orchestrator (T17).
// Pequenas utilities que mantêm processMessage enxuto e testável.

import { randomBytes } from 'node:crypto'

import { getSession, getActiveSession, createSession, updateSession } from '@/lib/db/sessions'
import { getActiveFlow, getFlowNodes } from '@/lib/db/flows'
import { cancelTimersBySession } from '@/lib/db/followup-timers'
import { logAudit } from '@/lib/db/audit'
import { emitEvent } from '@/lib/db/crm-events'
import { execute } from './executor'
import { buildPromptContext } from './context-builder'
import type { ExecutorResult } from './executor'
import type { Session, SessionStatus } from '@/types/session'
import type { PlannerDecision } from '@/types/planner'
import type { PromptContext } from './context-builder'

/** Gera um trace_id no formato `trace_<timestamp>_<rand6>`. */
export function generateTraceId(): string {
  return `trace_${Date.now()}_${randomBytes(3).toString('hex')}`
}

/** ≈50 chars/seg, clamp [1000, 3000] ms. Reusa lógica do canais/types. */
export function calculateTypingDelay(text: string): number {
  const charsPerSecond = 50
  const ms = (text.length / charsPerSecond) * 1000
  return Math.max(1000, Math.min(3000, Math.round(ms)))
}

/**
 * Carrega sessão ativa ou cria nova fixando flow_version (gap #11).
 * Marca current_trace_id já na criação para garantir propagação consistente.
 *
 * Retorna `is_new=true` quando uma sessão foi criada — caller emite `conversation.started`.
 */
export async function resolveOrCreateSession(args: {
  workspace_id: string
  client_id: string
  channel: string
  trace_id: string
}): Promise<{ session: Session; is_new: boolean }> {
  const existing = await getActiveSession(args.workspace_id, args.client_id, args.channel)
  if (existing) {
    return { session: existing as unknown as Session, is_new: false }
  }

  // Sessão nova: pega flow ativo e o primeiro step como ponto de partida.
  const activeFlow = await getActiveFlow(args.workspace_id)
  let current_node_id: string | null = null
  let flow_id: string | null = null
  let flow_version: number | null = null

  if (activeFlow) {
    flow_id = activeFlow.id
    flow_version = activeFlow.version
    const nodes = await getFlowNodes(activeFlow.id)
    const firstStep = nodes.find((n) => n.type === 'step') ?? nodes[0]
    current_node_id = firstStep?.id ?? null
  }

  const created = await createSession({
    workspace_id: args.workspace_id,
    client_id: args.client_id,
    flow_id,
    flow_version,
    current_node_id,
    channel: args.channel,
    current_trace_id: args.trace_id,
  })

  return { session: created as unknown as Session, is_new: true }
}

/**
 * Aplica updates parciais à sessão. No-op quando partial está vazio
 * (evita UPDATE supérfluo, latência e contagem inflada de updated_at).
 */
export async function applySessionUpdates(
  session_id: string,
  partial: Partial<Session>,
): Promise<void> {
  if (!partial || Object.keys(partial).length === 0) return
  await updateSession(session_id, partial as Record<string, unknown> as Partial<Session>)
}

/**
 * Detecta se a sessão estava em status='waiting' aguardando resposta do cliente.
 * Quando o nó atual é `wait` com `advance_on_response: true`, cancela timers
 * pendentes e avança para `response_node_id` (se configurado) — antes de processar
 * a mensagem como "on-topic".
 *
 * Retorna a sessão (potencialmente atualizada) para continuar o pipeline.
 */
export async function handleWaitCancelByResponse(session: Session): Promise<Session> {
  if (session.status !== 'waiting') return session
  if (!session.current_node_id || !session.flow_id) return session

  // Carrega nodes para ler config do nó atual.
  const nodes = await getFlowNodes(session.flow_id)
  const node = nodes.find((n) => n.id === session.current_node_id)
  if (!node || node.type !== 'wait') {
    // Sessão em waiting mas nó atual não é wait — apenas reativa.
    await updateSession(session.id, { status: 'active' as SessionStatus, wait_until: null })
    return { ...session, status: 'active' as SessionStatus, wait_until: null }
  }

  const cfg = node.config as {
    advance_on_response?: boolean
    response_node_id?: string
  }

  if (cfg.advance_on_response === false) {
    // wait não permite cancelamento por resposta — mantém em waiting.
    return session
  }

  // Cancela timers pendentes da sessão.
  try {
    await cancelTimersBySession(session.id)
  } catch (e) {
    void logAudit(
      'orchestrator.cancel_timers_failed',
      { error: (e as Error).message, session_id: session.id },
      { workspace_id: session.workspace_id, session_id: session.id },
    )
  }

  const next_node_id = cfg.response_node_id ?? session.current_node_id
  await updateSession(session.id, {
    status: 'active' as SessionStatus,
    wait_until: null,
    current_node_id: next_node_id,
  })

  return {
    ...session,
    status: 'active' as SessionStatus,
    wait_until: null,
    current_node_id: next_node_id,
  }
}

/**
 * Gera mensagem de handoff e marca sessão como handoff. Emite `conversation.handoff`
 * com o `reason` informado. Em caso de falha do LLM, devolve fallback hardcoded
 * — nunca propaga erro.
 */
export async function forceHandoff(
  ctx: PromptContext,
  reason: string,
): Promise<ExecutorResult> {
  void emitEvent(
    'conversation.handoff',
    { reason, forced: true },
    {
      workspace_id: ctx.workspace.id,
      session_id: ctx.session.id,
      client_id: ctx.session.client_id,
      trace_id: ctx.session.current_trace_id ?? null,
    },
  )

  // Tenta gerar mensagem via Executor (ação handoff).
  try {
    const synthetic_decision: PlannerDecision = {
      classification: 'ESCALATION',
      action: 'handoff',
      confidence: 1,
      reasoning: `force_handoff: ${reason}`,
    }
    const result = await execute(synthetic_decision, ctx)
    return {
      ...result,
      session_updates: { ...result.session_updates, status: 'handoff' as SessionStatus },
      forced_handoff: true,
      forced_handoff_reason: reason,
    }
  } catch (e) {
    void logAudit(
      'orchestrator.handoff_llm_failed',
      { reason, error: (e as Error).message },
      { workspace_id: ctx.workspace.id, session_id: ctx.session.id },
    )
    // Fallback hardcoded — não chama LLM novamente.
    return {
      response_text: 'Vou chamar alguém da equipe pra te ajudar com isso, um instante.',
      session_updates: { status: 'handoff' as SessionStatus },
      tool_calls_made: [],
      iterations_used: 0,
      forced_handoff: true,
      forced_handoff_reason: reason,
      model_used: 'fallback',
      tokens_in: 0,
      tokens_out: 0,
    }
  }
}

/**
 * Helper que recarrega o ctx após session_updates aplicados — buildPromptContext
 * lê estado fresco da sessão. Usado entre iterações do loop replan.
 */
export async function refreshContext(
  session_id: string,
  current_message: string,
): Promise<PromptContext> {
  // Garante que getSession devolva o estado mais recente
  const refreshed = await getSession(session_id)
  if (!refreshed) {
    throw new Error(`refreshContext: session ${session_id} not found`)
  }
  return buildPromptContext(session_id, current_message)
}
