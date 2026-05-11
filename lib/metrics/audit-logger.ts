// lib/metrics/audit-logger.ts — Wrapper estruturado sobre logAudit (lib/db/audit.ts).
// NUNCA loga conteúdo sensível (mensagens completas, credenciais, dados pessoais).
// Apenas IDs, contagens, flags.

import { logAudit } from '@/lib/db/audit'
import type { AuditEventType } from '@/types/metrics'

/**
 * Mapa de categorias de eventos de auditoria (SPEC §11).
 * Use para referência tipada em vez de strings literais espalhadas.
 */
export const AUDIT_EVENT_TYPES = {
  // Mensagens
  message: {
    received: 'message.received' as const,
    sent: 'message.sent' as const,
  },
  // Engine
  planner: {
    decision: 'planner.decision' as const,
  },
  executor: {
    response: 'executor.response' as const,
  },
  monitor: {
    report: 'monitor.report' as const,
    flag: 'monitor.flag' as const,
  },
  // Tools
  tool: {
    executed: 'tool.executed' as const,
    denied: 'tool.denied' as const,
    failed: 'tool.failed' as const,
  },
  // Guardrails
  guardrail: {
    input_blocked: 'guardrail.input_blocked' as const,
    output_blocked: 'guardrail.output_blocked' as const,
    rate_limited: 'guardrail.rate_limited' as const,
    cost_capped: 'guardrail.cost_capped' as const,
    signature_invalid: 'guardrail.signature_invalid' as const,
    output_validator_failed: 'guardrail.output_validator_failed' as const,
    output_filtered: 'guardrail.output_filtered' as const,
    leak_detected: 'guardrail.leak_detected' as const,
  },
  // Sessões
  session: {
    created: 'session.created' as const,
    expired: 'session.expired' as const,
    handoff: 'session.handoff' as const,
  },
  // Fluxos
  flow: {
    started: 'flow.started' as const,
    completed: 'flow.completed' as const,
    tool_denied: 'flow.tool_denied' as const,
  },
  // Memória
  memory: {
    updated: 'memory.updated' as const,
  },
  // Custo
  cost: {
    threshold_warning: 'cost.threshold_warning' as const,
    threshold_blocked: 'cost.threshold_blocked' as const,
  },
  // Mídia
  media: {
    processing_failed: 'media.processing_failed' as const,
  },
} as const

export interface AuditContext {
  workspace_id: string
  session_id?: string
  client_id?: string
  trace_id?: string
}

/**
 * Registra um evento de auditoria estruturado.
 * Fire-and-forget — nunca lança erro.
 * NUNCA inclua no payload: mensagens completas, credenciais, dados pessoais.
 */
export async function logAuditStructured(
  event_type: AuditEventType | string,
  payload: Record<string, unknown>,
  ctx: AuditContext,
): Promise<void> {
  await logAudit(event_type, payload, {
    workspace_id: ctx.workspace_id,
    session_id: ctx.session_id ?? null,
    client_id: ctx.client_id ?? null,
    trace_id: ctx.trace_id ?? null,
  })
}
