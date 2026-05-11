// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção
//
// app/api/admin/metrics/route.ts (T25)
//
// Métricas agregadas em tempo real para um workspace.
// Períodos: day (24h), week (7d), month (30d).
//
// Campos retornados:
//   total_sessions, total_messages, avg_response_time_ms, handoff_rate,
//   replan_rate, cost_usd, top_tools_used.
//
// avg_response_time_ms: calculado como diff entre user message e a próxima
// assistant message no mesmo session_id (não há coluna latency_ms direta
// em messages). Se não houver pares válidos, retorna null.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/app/api/admin/_auth'
import { supabase } from '@/lib/db/client'

type Period = 'day' | 'week' | 'month'

interface PeriodWindow {
  from: Date
  to: Date
}

function resolvePeriod(period: Period): PeriodWindow {
  const to = new Date()
  const from = new Date(to)
  if (period === 'day') {
    from.setUTCDate(from.getUTCDate() - 1)
  } else if (period === 'week') {
    from.setUTCDate(from.getUTCDate() - 7)
  } else {
    from.setUTCDate(from.getUTCDate() - 30)
  }
  return { from, to }
}

interface MetricsResponse {
  workspace_id: string
  period: Period
  from: string
  to: string
  total_sessions: number
  total_messages: number
  avg_response_time_ms: number | null
  handoff_rate: number | null
  replan_rate: number | null
  cost_usd: number | null
  top_tools_used: Array<{ tool: string; count: number }>
  _warnings?: string[]
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdminToken(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)

  const workspace_id = searchParams.get('workspace_id')
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
  }

  const periodParam = (searchParams.get('period') ?? 'day') as Period
  const validPeriods: Period[] = ['day', 'week', 'month']
  const period: Period = validPeriods.includes(periodParam) ? periodParam : 'day'

  const { from, to } = resolvePeriod(period)
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  const warnings: string[] = []

  // ============================================================
  // Queries em paralelo
  // ============================================================
  const [
    sessionsCountResult,
    sessionsListResult,
    messagesCountResult,
    messagesForLatencyResult,
    costResult,
    toolEventsResult,
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('sessions')
      .select('id, status, replan_count')
      .eq('workspace_id', workspace_id)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('messages')
      .select('session_id, role, created_at')
      .eq('workspace_id', workspace_id)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('session_id', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('usage_metrics')
      .select('cost_usd')
      .eq('workspace_id', workspace_id)
      .gte('recorded_at', fromIso)
      .lte('recorded_at', toIso),
    supabase
      .from('audit_logs')
      .select('event_type, payload')
      .eq('workspace_id', workspace_id)
      .like('event_type', 'tool.%')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
  ])

  // ---------- total_sessions ----------
  if (sessionsCountResult.error) {
    return NextResponse.json({ error: sessionsCountResult.error.message }, { status: 500 })
  }
  const total_sessions = sessionsCountResult.count ?? 0

  // ---------- handoff_rate + replan_rate ----------
  if (sessionsListResult.error) {
    return NextResponse.json({ error: sessionsListResult.error.message }, { status: 500 })
  }
  const sessionsList = (sessionsListResult.data ?? []) as Array<{
    id: string
    status: string | null
    replan_count: number | null
  }>

  let handoff_rate: number | null = null
  let replan_rate: number | null = null
  if (sessionsList.length > 0) {
    const handoffCount = sessionsList.filter((s) => s.status === 'handoff').length
    handoff_rate = handoffCount / sessionsList.length
    const replanned = sessionsList.filter((s) => (s.replan_count ?? 0) > 0).length
    replan_rate = replanned / sessionsList.length
  } else {
    warnings.push('handoff_rate and replan_rate are null because no sessions in period')
  }

  // ---------- total_messages ----------
  if (messagesCountResult.error) {
    return NextResponse.json({ error: messagesCountResult.error.message }, { status: 500 })
  }
  const total_messages = messagesCountResult.count ?? 0

  // ---------- avg_response_time_ms ----------
  if (messagesForLatencyResult.error) {
    return NextResponse.json(
      { error: messagesForLatencyResult.error.message },
      { status: 500 },
    )
  }
  const messagesForLatency = (messagesForLatencyResult.data ?? []) as Array<{
    session_id: string
    role: string
    created_at: string
  }>

  let avg_response_time_ms: number | null = null
  if (messagesForLatency.length > 0) {
    // Para cada session_id, encontrar pares user→assistant consecutivos
    // e calcular o diff em ms.
    const bySession: Record<string, Array<{ role: string; ts: number }>> = {}
    for (const m of messagesForLatency) {
      if (!bySession[m.session_id]) bySession[m.session_id] = []
      bySession[m.session_id].push({ role: m.role, ts: new Date(m.created_at).getTime() })
    }
    const diffs: number[] = []
    for (const list of Object.values(bySession)) {
      for (let i = 0; i < list.length - 1; i++) {
        if (list[i].role === 'user' && list[i + 1].role === 'assistant') {
          const d = list[i + 1].ts - list[i].ts
          if (d >= 0 && d < 60 * 60 * 1000) {
            // ignorar diffs maiores que 1h (provavelmente sessões inativas)
            diffs.push(d)
          }
        }
      }
    }
    if (diffs.length > 0) {
      avg_response_time_ms = diffs.reduce((a, b) => a + b, 0) / diffs.length
    } else {
      warnings.push(
        'avg_response_time_ms is null: no consecutive user→assistant message pairs found',
      )
    }
  } else {
    warnings.push('avg_response_time_ms is null: no messages in period')
  }

  // ---------- cost_usd ----------
  let cost_usd: number | null = null
  if (costResult.error) {
    warnings.push(`cost_usd is null: usage_metrics query failed (${costResult.error.message})`)
  } else {
    const rows = (costResult.data ?? []) as Array<{ cost_usd: number | string }>
    cost_usd = rows.reduce((acc, r) => acc + Number(r.cost_usd ?? 0), 0)
  }

  // ---------- top_tools_used ----------
  let top_tools_used: Array<{ tool: string; count: number }> = []
  if (toolEventsResult.error) {
    warnings.push(
      `top_tools_used empty: audit_logs query failed (${toolEventsResult.error.message})`,
    )
  } else {
    const events = (toolEventsResult.data ?? []) as Array<{
      event_type: string
      payload: Record<string, unknown> | null
    }>
    const counts: Record<string, number> = {}
    for (const ev of events) {
      const tool =
        (ev.payload?.tool_id as string | undefined) ??
        (ev.payload?.tool as string | undefined) ??
        (ev.payload?.tool_name as string | undefined) ??
        'unknown'
      counts[tool] = (counts[tool] ?? 0) + 1
    }
    top_tools_used = Object.entries(counts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  const response: MetricsResponse = {
    workspace_id,
    period,
    from: fromIso,
    to: toIso,
    total_sessions,
    total_messages,
    avg_response_time_ms,
    handoff_rate,
    replan_rate,
    cost_usd,
    top_tools_used,
  }
  if (warnings.length > 0) {
    response._warnings = warnings
  }

  return NextResponse.json(response)
}
