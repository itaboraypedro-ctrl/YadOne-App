// lib/engine/loop-detector.ts — Detecção de loops de decisão do Planner.
//
// Lê últimas N decisões do Planner via audit_logs (event_type='planner.decision').
// Se 3+ ações consecutivas iguais → flag de loop.
//
// Limitação MVP (ajuste #2): audit_logs é fire-and-forget e pode ter latência <1s.
// Como fallback, também consulta sessions.monitor_flags (mantido pelo próprio Monitor)
// para confirmar loops já detectados anteriormente nesta sessão.

import { supabase } from '@/lib/db/client'

const LOOKBACK_LIMIT = 5
const LOOP_THRESHOLD = 3

export interface LoopDetectionResult {
  is_looping: boolean
  same_action_count: number
  /** Action repetida quando is_looping=true. */
  looping_action: string | null
  /** Fonte da detecção: 'audit' lê de audit_logs, 'snapshot' usa sessions.monitor_flags. */
  source: 'audit' | 'snapshot' | 'none'
}

interface AuditRow {
  payload: Record<string, unknown>
  created_at: string
}

interface SessionFlagsRow {
  monitor_flags: Array<{ type?: string; flagged_at?: string }> | null
}

async function readRecentPlannerActions(session_id: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('payload, created_at')
    .eq('session_id', session_id)
    .eq('event_type', 'planner.decision')
    .order('created_at', { ascending: false })
    .limit(LOOKBACK_LIMIT)
  if (error) {
    // Não throw — loop-detector é informativo, não crítico.
    console.error('[loop-detector] audit query failed', error.message)
    return []
  }
  const rows = (data as AuditRow[]) ?? []
  return rows
    .map((r) => {
      const a = (r.payload as { action?: unknown }).action
      return typeof a === 'string' ? a : null
    })
    .filter((a): a is string => !!a)
}

async function readSessionMonitorFlags(session_id: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('monitor_flags')
    .eq('id', session_id)
    .maybeSingle()
  if (error) {
    console.error('[loop-detector] session query failed', error.message)
    return []
  }
  const flags = (data as SessionFlagsRow | null)?.monitor_flags ?? []
  return flags.map((f) => f.type ?? '').filter(Boolean)
}

export async function detectLoop(session_id: string): Promise<LoopDetectionResult> {
  // Camada 1: audit_logs.
  const actions = await readRecentPlannerActions(session_id)
  if (actions.length >= LOOP_THRESHOLD) {
    const head = actions[0]
    let count = 1
    for (let i = 1; i < actions.length; i++) {
      if (actions[i] === head) count++
      else break
    }
    if (count >= LOOP_THRESHOLD) {
      return {
        is_looping: true,
        same_action_count: count,
        looping_action: head,
        source: 'audit',
      }
    }
  }

  // Camada 2 (fallback): snapshot em sessions.monitor_flags.
  const flagTypes = await readSessionMonitorFlags(session_id)
  const recentLoopFlags = flagTypes.filter((t) => t === 'loop').length
  if (recentLoopFlags >= 1) {
    return {
      is_looping: true,
      same_action_count: actions.length,
      looping_action: actions[0] ?? null,
      source: 'snapshot',
    }
  }

  return {
    is_looping: false,
    same_action_count: actions.length > 0 ? 1 : 0,
    looping_action: null,
    source: 'none',
  }
}
