// lib/metrics/aggregator.ts — Agregações diárias de métricas por workspace.
// Consumido pelo Job 7 (T22) para popular daily_metrics.

import { supabase } from '@/lib/db/client'
import { upsertDailyMetric } from '@/lib/db/metrics'
import type { DailyMetric } from '@/types/metrics'

/**
 * Agrega métricas do dia `date` (YYYY-MM-DD) para o workspace e persiste em daily_metrics.
 * Retorna o registro atualizado.
 */
export async function aggregateDailyMetrics(
  workspace_id: string,
  date: string,
): Promise<DailyMetric> {
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  // 1) Total de mensagens no dia.
  const { count: msgCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspace_id)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  const total_messages = msgCount ?? 0

  // 2) Sessões criadas no dia.
  const { data: sessionsData } = await supabase
    .from('sessions')
    .select('id, status, replan_count')
    .eq('workspace_id', workspace_id)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  const sessions = (sessionsData ?? []) as Array<{
    id: string
    status: string
    replan_count: number | null
  }>
  const total_sessions = sessions.length

  // 3) Média de mensagens por sessão (avg_session_length).
  let avg_session_length = 0
  if (total_sessions > 0) {
    const sessionIds = sessions.map((s) => s.id)
    const { data: msgPerSession } = await supabase
      .from('messages')
      .select('session_id')
      .in('session_id', sessionIds)

    const perSession = (msgPerSession ?? []) as Array<{ session_id: string }>
    const counts: Record<string, number> = {}
    for (const row of perSession) {
      counts[row.session_id] = (counts[row.session_id] ?? 0) + 1
    }
    const lengths = Object.values(counts)
    avg_session_length =
      lengths.length > 0
        ? lengths.reduce((acc, n) => acc + n, 0) / lengths.length
        : 0
  }

  // 4) Custo total via usage_metrics.
  const { data: costData } = await supabase
    .from('usage_metrics')
    .select('cost_usd')
    .eq('workspace_id', workspace_id)
    .gte('recorded_at', dayStart)
    .lte('recorded_at', dayEnd)

  const total_cost_usd = ((costData ?? []) as Array<{ cost_usd: number }>).reduce(
    (acc, row) => acc + Number(row.cost_usd),
    0,
  )

  // 5) Handoff rate: sessões com status='handoff' / total.
  const handoff_count = sessions.filter((s) => s.status === 'handoff').length
  const handoff_rate = total_sessions > 0 ? handoff_count / total_sessions : 0

  // 6) Replan rate: soma de replan_count / total_sessions.
  const total_replans = sessions.reduce((acc, s) => acc + (s.replan_count ?? 0), 0)
  const replan_rate = total_sessions > 0 ? total_replans / total_sessions : 0

  // 7) Tool usage breakdown (tool.executed events no dia).
  const { data: toolEvents } = await supabase
    .from('audit_logs')
    .select('payload')
    .eq('workspace_id', workspace_id)
    .eq('event_type', 'tool.executed')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  const tool_usage_breakdown: Record<string, number> = {}
  for (const row of (toolEvents ?? []) as Array<{ payload: Record<string, unknown> }>) {
    const tool_id = (row.payload?.tool_id as string) ?? 'unknown'
    tool_usage_breakdown[tool_id] = (tool_usage_breakdown[tool_id] ?? 0) + 1
  }

  return upsertDailyMetric(workspace_id, date, {
    total_messages,
    total_sessions,
    avg_session_length,
    total_cost_usd,
    handoff_rate,
    replan_rate,
    tool_usage_breakdown,
  })
}

// ============================================================
// Funções de leitura (query helpers)
// ============================================================

export interface PeriodFilter {
  start: string // ISO 8601
  end: string // ISO 8601
}

/**
 * Retorna custo total por workspace num período.
 */
export async function getCostByWorkspace(
  workspace_id: string,
  period: PeriodFilter,
): Promise<number> {
  const { data } = await supabase
    .from('usage_metrics')
    .select('cost_usd')
    .eq('workspace_id', workspace_id)
    .gte('recorded_at', period.start)
    .lte('recorded_at', period.end)

  return ((data ?? []) as Array<{ cost_usd: number }>).reduce(
    (acc, row) => acc + Number(row.cost_usd),
    0,
  )
}

/**
 * Retorna custo agrupado por modelo num período.
 */
export async function getCostByModel(
  workspace_id: string,
  period: PeriodFilter,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('usage_metrics')
    .select('model, cost_usd')
    .eq('workspace_id', workspace_id)
    .gte('recorded_at', period.start)
    .lte('recorded_at', period.end)

  const result: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ model: string; cost_usd: number }>) {
    result[row.model] = (result[row.model] ?? 0) + Number(row.cost_usd)
  }
  return result
}

/**
 * Retorna contagem de eventos de auditoria agrupados por event_type num período.
 */
export async function getEventCounts(
  workspace_id: string,
  period: PeriodFilter,
): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('audit_logs')
    .select('event_type')
    .eq('workspace_id', workspace_id)
    .gte('created_at', period.start)
    .lte('created_at', period.end)

  const result: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ event_type: string }>) {
    result[row.event_type] = (result[row.event_type] ?? 0) + 1
  }
  return result
}

/**
 * Retorna os event_types de erro mais frequentes num período.
 */
export async function getTopErrors(
  workspace_id: string,
  period: PeriodFilter,
  limit: number = 10,
): Promise<Array<{ event_type: string; count: number }>> {
  const errorPrefixes = ['guardrail.', 'tool.failed', 'error', 'media.processing_failed']

  const { data } = await supabase
    .from('audit_logs')
    .select('event_type')
    .eq('workspace_id', workspace_id)
    .gte('created_at', period.start)
    .lte('created_at', period.end)

  const counts: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ event_type: string }>) {
    const isError = errorPrefixes.some(
      (p) => row.event_type.startsWith(p) || row.event_type === p,
    )
    if (isError) {
      counts[row.event_type] = (counts[row.event_type] ?? 0) + 1
    }
  }

  return Object.entries(counts)
    .map(([event_type, count]) => ({ event_type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
