// types/guardrails.ts — Estados e resultados das hard guardrails

export type CostCapStatus = 'ok' | 'warning' | 'blocked'
export type CircuitBreakerState = 'closed' | 'open' | 'half-open'

export interface RateLimitBucket {
  id: string
  scope_key: string
  scope_type: string
  count: number
  window_start: string // ISO 8601
  window_end: string // ISO 8601
  created_at: string // ISO 8601
}

export interface RateLimitCheckResult {
  allowed: boolean
  current: number
  limit: number
  scope: string
}

export interface CostCapStatusResult {
  current_usd: number
  cap_usd: number
  percentage: number
  status: CostCapStatus
}

export interface CircuitBreakerInfo {
  service: string
  state: CircuitBreakerState
  failures: number
  threshold: number
  opened_at: string | null // ISO 8601
}

export interface FilterResult {
  safe: boolean
  layer?: 'regex' | 'llm'
  pattern_matched?: string
  confidence?: number
  response?: string
}

export interface OutputValidation {
  valid: boolean
  violations: string[]
  action: 'continue' | 'force_replan' | 'fallback'
}

export interface IdempotencyKey {
  key: string
  workspace_id: string | null
  processed_at: string // ISO 8601
  result: unknown
  expires_at: string // ISO 8601
}

export interface InputGuardResult {
  allowed: boolean
  reason?: string
}

// Output layer types — T15

export type OutputAction = 'continue' | 'truncate' | 're_plan'

export interface ValidationResult {
  valid: boolean
  action: OutputAction
  sanitized_text?: string
  violations: string[]
}

export interface OutputFilterResult {
  safe: boolean
  layer: 'output_filter'
  pattern_matched?: string
}

export interface LeakResult {
  has_leak: boolean
  leaked_ids: string[]
  leaked_phones: string[]
}
