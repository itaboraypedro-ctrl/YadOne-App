// types/metrics.ts — Cost tracking, métricas agregadas, audit logs

export interface UsageMetric {
  id: string
  workspace_id: string
  session_id: string | null
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  recorded_at: string // ISO 8601
}

export interface DailyMetric {
  id: string
  workspace_id: string
  date: string // YYYY-MM-DD
  total_messages: number
  total_sessions: number
  avg_session_length: number
  total_cost_usd: number
  handoff_rate: number
  replan_rate: number
  tool_usage_breakdown: Record<string, number>
  created_at: string // ISO 8601
}

export type AuditEventType =
  // Mensagens
  | 'message.received'
  | 'message.sent'
  // Engine
  | 'planner.decision'
  | 'executor.response'
  | 'monitor.report'
  // Tools
  | 'tool.executed'
  | 'tool.denied'
  | 'tool.failed'
  // Guardrails
  | 'guardrail.input_blocked'
  | 'guardrail.output_blocked'
  | 'guardrail.rate_limited'
  | 'guardrail.cost_capped'
  | 'guardrail.signature_invalid'
  | 'guardrail.output_validator_failed'
  | 'guardrail.output_filtered'
  | 'guardrail.leak_detected'
  // Sessões
  | 'session.created'
  | 'session.expired'
  | 'session.handoff'
  // Fluxos
  | 'flow.started'
  | 'flow.completed'
  | 'flow.tool_denied'
  // Memória
  | 'memory.updated'
  // Custo
  | 'cost.threshold_warning'
  | 'cost.threshold_blocked'
  // Monitor flags
  | 'monitor.flag'
  // Job lifecycle
  | 'job.followup_failed'
  | 'job.kb_index_failed'
  | 'cost_caps.monthly_reset'
  // Output violations
  | 'output.violation'
  // Erros genéricos
  | 'error'

export interface AuditLog {
  id: string
  event_type: AuditEventType | string
  workspace_id: string | null
  session_id: string | null
  client_id: string | null
  payload: Record<string, unknown>
  trace_id: string | null
  created_at: string // ISO 8601
}

export interface AuditLogInput {
  event_type: AuditEventType | string
  workspace_id?: string | null
  session_id?: string | null
  client_id?: string | null
  trace_id?: string | null
  payload?: Record<string, unknown>
}
