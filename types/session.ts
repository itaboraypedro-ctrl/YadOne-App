// types/session.ts — Sessões de conversa, estados de digressão, classificação de mensagem

export type DigressionState = 'none' | 'active' | 'nested' | 'resuming'

export type SessionStatus = 'active' | 'waiting' | 'handoff' | 'completed' | 'expired'

export type MessageClassification =
  | 'ON_TOPIC'
  | 'DIGRESSION'
  | 'CHITCHAT'
  | 'ESCALATION'
  | 'CANCELLATION'
  | 'FRUSTRATION'

export type CollectedData = Record<string, unknown>

export interface ObjectivePending {
  node_id: string
  objective: string
  collected_so_far: CollectedData
  topic_at_digression?: string
}

export interface MonitorFlagSnapshot {
  type: string
  confidence: number
  details: string
  flagged_at: string // ISO 8601
}

export interface Session {
  id: string
  workspace_id: string
  client_id: string
  flow_id: string | null
  flow_version: number | null
  current_node_id: string | null
  channel: string
  channel_session_id: string | null
  status: SessionStatus
  digression_state: DigressionState
  objective_stack: ObjectivePending[]
  collected_data: CollectedData
  completed_steps: string[]
  wait_until: string | null // ISO 8601
  expires_at: string | null // ISO 8601
  replan_count: number
  monitor_flags: MonitorFlagSnapshot[]
  current_trace_id: string | null
  memory_processed: boolean
  /** F13/migration 028: pausa por conversa (humano assumiu o controle). */
  ai_paused?: boolean
  ai_paused_by?: string | null
  ai_paused_at?: string | null
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

export interface SessionCreateInput {
  workspace_id: string
  client_id: string
  flow_id: string | null
  flow_version: number | null
  current_node_id: string | null
  channel: string
  channel_session_id?: string | null
  expires_at?: string | null
  current_trace_id?: string | null
}
