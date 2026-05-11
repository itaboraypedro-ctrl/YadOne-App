// types/crm.ts — Eventos para o CRM

export type CRMEventType =
  // Conversação
  | 'conversation.started'
  | 'conversation.completed'
  | 'conversation.abandoned'
  | 'conversation.handoff'
  // Cliente
  | 'client.identified'
  | 'client.memory_updated'
  // Agendamento
  | 'appointment.created'
  | 'appointment.cancelled'
  | 'appointment.reminder_sent'
  // Interesse
  | 'interest.product_enquiry'
  | 'interest.price_enquiry'
  | 'interest.not_ready'
  // Follow-up
  | 'followup.scheduled'
  | 'followup.fired'
  | 'followup.responded'
  // Monitor
  | 'monitor.flag'
  // Cost
  | 'cost.threshold_warning'
  | 'cost.threshold_blocked'
  // Anomalia (gap #9)
  | 'anomaly.handoff_spike'
  | 'anomaly.replan_spike'
  | 'anomaly.cost_spike'
  | 'anomaly.traffic_drop'
  // Flow guardrail
  | 'flow.tool_denied'

export interface CRMEvent {
  id: string
  event_type: CRMEventType
  workspace_id: string
  client_id: string | null
  session_id: string | null
  payload: Record<string, unknown>
  processed: boolean
  trace_id: string | null
  created_at: string // ISO 8601
}

export interface CRMEventInput {
  event_type: CRMEventType
  workspace_id: string
  client_id?: string | null
  session_id?: string | null
  trace_id?: string | null
  payload?: Record<string, unknown>
}
