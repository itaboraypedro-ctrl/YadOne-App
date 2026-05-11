// types/monitor.ts — Monitor (4ª camada) e self-evaluation

export type MonitorAction = 'continue' | 'replan' | 'handoff' | 'alert'

export type MonitorFlagType =
  | 'hallucination'
  | 'loop'
  | 'frustration'
  | 'low_confidence'
  | 'incoherent'

export interface MonitorFlag {
  type: MonitorFlagType
  confidence: number
  details: string
}

export interface MonitorReport {
  flags: MonitorFlag[]
  recommended_action: MonitorAction
  reasoning: string
}

export type Sentiment = 'positive' | 'neutral' | 'frustrated' | 'angry'

export interface SentimentTrend {
  trend: Sentiment[]
  is_escalating: boolean
}

export interface MonitorDecision {
  id: string
  session_id: string
  message_id: string | null
  flag: MonitorFlagType
  confidence: number | null
  details: Record<string, unknown>
  action_taken: MonitorAction
  created_at: string // ISO 8601
}
