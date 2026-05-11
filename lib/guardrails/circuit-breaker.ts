// lib/guardrails/circuit-breaker.ts — Session breaker (replan_count) + Tool breaker (in-memory).
// SPEC §14.5 (Circuit Breaker).
//
// Decisão MVP: estado do tool breaker em memória de processo (Map). Não persiste entre
// restarts nem é compartilhado entre instâncias. Em produção multi-instância, mover para
// Redis/Supabase (Job 7 reconcilia). Para o MVP single-process isto basta.

import { getReplanCount } from '@/lib/db/sessions'

const MAX_REPLAN = 3
const TOOL_FAILURE_THRESHOLD = 3
const TOOL_OPEN_DURATION_MS = 5 * 60 * 1000 // 5 minutos

export interface SessionBreakerResult {
  allowed: boolean
  reason?: string
}

export interface ToolBreakerResult {
  allowed: boolean
  reason?: string
}

interface ToolBreakerState {
  failures: number
  opened_at: number // epoch ms; 0 quando closed
  first_failure_at: number // epoch ms; janela de 5 min para 3 falhas seguidas
}

const toolBreakerStates: Map<string, ToolBreakerState> = new Map()

function toolKey(tool_id: string, workspace_id: string): string {
  return `${workspace_id}:${tool_id}`
}

/**
 * Sessão com replan_count >= 3 deve forçar handoff.
 */
export async function checkSessionBreaker(session_id: string): Promise<SessionBreakerResult> {
  if (!session_id) throw new Error('checkSessionBreaker: session_id is required')
  const count = await getReplanCount(session_id)
  if (count >= MAX_REPLAN) {
    return { allowed: false, reason: 'replan_limit_exceeded' }
  }
  return { allowed: true }
}

/**
 * Tool breaker: se aberto e ainda dentro da janela de 5min, bloqueia. Senão reseta e libera.
 */
export function checkToolBreaker(tool_id: string, workspace_id: string): ToolBreakerResult {
  if (!tool_id) throw new Error('checkToolBreaker: tool_id is required')
  if (!workspace_id) throw new Error('checkToolBreaker: workspace_id is required')

  const key = toolKey(tool_id, workspace_id)
  const state = toolBreakerStates.get(key)
  if (!state || state.opened_at === 0) return { allowed: true }

  const now = Date.now()
  if (now - state.opened_at >= TOOL_OPEN_DURATION_MS) {
    // Janela expirou — reset (half-open implícito; primeira chamada passa).
    toolBreakerStates.delete(key)
    return { allowed: true }
  }

  return { allowed: false, reason: 'tool_breaker_open' }
}

/**
 * Registra uma falha do tool. 3 falhas em janela de 5min → abre o breaker.
 */
export function recordToolFailure(tool_id: string, workspace_id: string): void {
  if (!tool_id) throw new Error('recordToolFailure: tool_id is required')
  if (!workspace_id) throw new Error('recordToolFailure: workspace_id is required')

  const key = toolKey(tool_id, workspace_id)
  const now = Date.now()
  const existing = toolBreakerStates.get(key)

  if (!existing) {
    toolBreakerStates.set(key, { failures: 1, opened_at: 0, first_failure_at: now })
    return
  }

  // Se a janela de 5min desde a primeira falha expirou, reseta a contagem.
  if (now - existing.first_failure_at >= TOOL_OPEN_DURATION_MS) {
    toolBreakerStates.set(key, { failures: 1, opened_at: 0, first_failure_at: now })
    return
  }

  const failures = existing.failures + 1
  const opened_at = failures >= TOOL_FAILURE_THRESHOLD ? now : existing.opened_at
  toolBreakerStates.set(key, {
    failures,
    opened_at,
    first_failure_at: existing.first_failure_at,
  })
}

/**
 * Sucesso do tool — limpa o estado.
 */
export function resetToolBreaker(tool_id: string, workspace_id: string): void {
  if (!tool_id) throw new Error('resetToolBreaker: tool_id is required')
  if (!workspace_id) throw new Error('resetToolBreaker: workspace_id is required')
  toolBreakerStates.delete(toolKey(tool_id, workspace_id))
}

/**
 * Helper de teste — limpa todos os states (não usar em runtime).
 */
export function __resetAllToolBreakers(): void {
  toolBreakerStates.clear()
}
