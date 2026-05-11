// lib/engine/digression-detector.ts — Máquina de estados pura da digressão.
// SPEC §6 + GAPS #5 (estado nested) e #6 (FRUSTRATION). Sem I/O.
//
// Regras:
//  - Stack máximo 3 níveis. 4ª tentativa força resume.
//  - DIGRESSION: push do objetivo atual; state none→active, active→nested, nested→nested.
//  - ON_TOPIC com state≠none: pop top do stack; nested→active, active→resuming, resuming→none.
//  - ESCALATION/CANCELLATION: força handoff.
//  - FRUSTRATION: action vem do LLM; sinaliza frustration_signal.
//  - CHITCHAT: passa direto, action vem do LLM.
//
// Caller (planner.ts) aplica esta transição depois de validar saída do LLM.

import type { DigressionState, MessageClassification, ObjectivePending } from '@/types/session'
import type { PlannerAction } from '@/types/planner'

export const MAX_DIGRESSION_DEPTH = 3

export interface DigressionTransition {
  next_state: DigressionState
  next_stack: ObjectivePending[]
  /** Action a ser usada (sobrescreve o LLM quando regras de profundidade ou escalation aplicam). */
  resolved_action: PlannerAction
  /** Top do stack (LIFO) que está sendo retomado quando resolved_action='resume'. */
  resumed_objective?: ObjectivePending
  /** Objetivo que entrou no stack (quando resolved_action='digress'). */
  pushed_objective?: ObjectivePending
  /** Nome de evento de auditoria opcional, quando regra de profundidade ou escalation aplica. */
  audit_event?: string
}

interface ApplyInput {
  current_state: DigressionState
  current_stack: ObjectivePending[]
  classification: MessageClassification
  llm_action: PlannerAction
  current_objective: ObjectivePending | null
}

/**
 * Aplica as regras determinísticas de transição do estado de digressão.
 * Pure function — não toca em banco nem efeitos colaterais.
 */
export function applyDigressionRules(input: ApplyInput): DigressionTransition {
  const { current_state, current_stack, classification, llm_action, current_objective } = input

  // Escalation e cancellation são absolutos — independem de estado/stack.
  if (classification === 'ESCALATION' || classification === 'CANCELLATION') {
    return {
      next_state: current_state,
      next_stack: current_stack,
      resolved_action: 'handoff',
      audit_event: 'planner.escalation_or_cancellation',
    }
  }

  if (classification === 'DIGRESSION') {
    // 4ª digressão aninhada: força resume do top atual.
    if (current_stack.length >= MAX_DIGRESSION_DEPTH) {
      const top = current_stack[current_stack.length - 1]
      const next_stack = current_stack.slice(0, -1)
      const next_state: DigressionState =
        next_stack.length === 0 ? 'resuming' : next_stack.length === 1 ? 'active' : 'nested'
      return {
        next_state,
        next_stack,
        resolved_action: 'resume',
        resumed_objective: top,
        audit_event: 'planner.digression_depth_exceeded',
      }
    }
    // Push do objetivo atual no stack (se existir).
    const next_stack = current_objective ? [...current_stack, current_objective] : current_stack
    const next_state: DigressionState =
      next_stack.length === 0 ? 'none' : next_stack.length === 1 ? 'active' : 'nested'
    return {
      next_state,
      next_stack,
      resolved_action: 'digress',
      pushed_objective: current_objective ?? undefined,
    }
  }

  if (classification === 'ON_TOPIC') {
    if (current_state !== 'none' && current_stack.length > 0) {
      // Cliente voltou ao tópico de cima do stack — pop e marca resuming/active/none.
      const top = current_stack[current_stack.length - 1]
      const next_stack = current_stack.slice(0, -1)
      const next_state: DigressionState =
        next_stack.length === 0 ? 'resuming' : next_stack.length === 1 ? 'active' : 'nested'
      return {
        next_state,
        next_stack,
        resolved_action: 'resume',
        resumed_objective: top,
      }
    }
    // ON_TOPIC sem digressão pendente — segue ação do LLM.
    return {
      next_state: current_state,
      next_stack: current_stack,
      resolved_action: llm_action,
    }
  }

  // FRUSTRATION e CHITCHAT: action do LLM, estado preservado, sem mudança no stack.
  // resuming → none após um turno respondendo (transição natural).
  let next_state = current_state
  if (current_state === 'resuming') next_state = current_stack.length > 0 ? 'active' : 'none'
  return {
    next_state,
    next_stack: current_stack,
    resolved_action: llm_action,
  }
}
