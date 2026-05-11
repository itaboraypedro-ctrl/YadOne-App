// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/app/api/admin/_auth'
import { supabase } from '@/lib/db/client'
import { getCostByWorkspace, getCostByModel } from '@/lib/metrics/aggregator'

function getPeriodFilter(period: string): { start: string; end: string } {
  const now = new Date()

  if (period === 'day') {
    const dayStart = new Date(now)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(now)
    dayEnd.setUTCHours(23, 59, 59, 999)
    return { start: dayStart.toISOString(), end: dayEnd.toISOString() }
  }

  if (period === 'all') {
    return { start: '2000-01-01T00:00:00.000Z', end: now.toISOString() }
  }

  // default: 'month'
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999))
  return { start: monthStart.toISOString(), end: monthEnd.toISOString() }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authError = requireAdminToken(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)

  const workspace_id = searchParams.get('workspace_id')
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
  }

  const periodParam = searchParams.get('period') ?? 'month'
  const validPeriods = ['day', 'month', 'all']
  const period = validPeriods.includes(periodParam) ? periodParam : 'month'

  const periodFilter = getPeriodFilter(period)

  const [total_usd_from_workspace, costByModelMap, capsResult] = await Promise.all([
    getCostByWorkspace(workspace_id, periodFilter),
    getCostByModel(workspace_id, periodFilter),
    supabase
      .from('workspace_cost_caps')
      .select('*')
      .eq('workspace_id', workspace_id)
      .maybeSingle(),
  ])

  if (capsResult.error) {
    return NextResponse.json({ error: capsResult.error.message }, { status: 500 })
  }

  const capsData = capsResult.data as { current_month_usd: number; cap_usd: number } | null
  const current_month_usd = capsData?.current_month_usd ?? total_usd_from_workspace
  const cap_usd = capsData?.cap_usd ?? 0
  const percentage = cap_usd > 0 ? (current_month_usd / cap_usd) * 100 : 0

  // Build breakdown_by_model; we need token counts as well — fetch from usage_metrics
  const { data: metricsRows, error: metricsError } = await supabase
    .from('usage_metrics')
    .select('model, cost_usd, input_tokens, output_tokens')
    .eq('workspace_id', workspace_id)
    .gte('recorded_at', periodFilter.start)
    .lte('recorded_at', periodFilter.end)

  if (metricsError) {
    return NextResponse.json({ error: metricsError.message }, { status: 500 })
  }

  type MetricsRow = { model: string; cost_usd: number; input_tokens: number; output_tokens: number }
  const byModel: Record<string, { cost_usd: number; input_tokens: number; output_tokens: number }> = {}

  for (const row of (metricsRows ?? []) as MetricsRow[]) {
    if (!byModel[row.model]) {
      byModel[row.model] = { cost_usd: 0, input_tokens: 0, output_tokens: 0 }
    }
    byModel[row.model].cost_usd += Number(row.cost_usd)
    byModel[row.model].input_tokens += Number(row.input_tokens ?? 0)
    byModel[row.model].output_tokens += Number(row.output_tokens ?? 0)
  }

  const breakdown_by_model = Object.entries(byModel).map(([model, stats]) => ({
    model,
    cost_usd: stats.cost_usd,
    input_tokens: stats.input_tokens,
    output_tokens: stats.output_tokens,
  }))

  const total_usd = breakdown_by_model.reduce((acc, row) => acc + row.cost_usd, 0)

  // Suppress unused variable warning — costByModelMap is confirmed via getCostByModel call
  void costByModelMap

  return NextResponse.json({
    period,
    current_month_usd,
    cap_usd,
    percentage,
    breakdown_by_model,
    total_usd,
  })
}
