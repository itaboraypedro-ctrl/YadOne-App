// types/planner.ts — Decisão do Planner (Camada 2)

import type { MessageClassification, ObjectivePending } from './session'

export type PlannerAction =
  | 'respond'
  | 'call_tool'
  | 'digress'
  | 'resume'
  | 'handoff'
  | 'wait'
  | 'advance'
  | 're_plan'

export interface PlannerDecision {
  classification: MessageClassification
  action: PlannerAction
  tool_name?: string
  tool_params?: Record<string, unknown>
  digression_topic?: string
  objective_pending?: ObjectivePending
  next_node_id?: string
  confidence: number
  reasoning: string
  frustration_signal?: boolean
  low_confidence_flag?: boolean
}

export interface PlannerInput {
  system_prompt: string
  current_message: string
  trace_id?: string
  replan?: boolean
}
