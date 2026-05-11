// lib/db/metrics.ts — Persistência de usage_metrics e daily_metrics
// recordUsage está em cost-caps.ts (lá faz sentido por causa do agregado).
// Aqui ficam helpers de daily aggregation (Job 7) e leitura.
// TODO: substituir tipos inline por import from '@/types/metrics' após merge da T02.

import { supabase } from './client'

interface UsageMetric {
  id: string
  workspace_id: string
  session_id: string | null
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  recorded_at: string
}

interface DailyMetric {
  id: string
  workspace_id: string
  date: string
  total_messages: number
  total_sessions: number
  avg_session_length: number
  total_cost_usd: number
  handoff_rate: number
  replan_rate: number
  tool_usage_breakdown: Record<string, number>
  created_at: string
}

interface DailyMetricInput {
  total_messages?: number
  total_sessions?: number
  avg_session_length?: number
  total_cost_usd?: number
  handoff_rate?: number
  replan_rate?: number
  tool_usage_breakdown?: Record<string, number>
}

export async function recordMetric(input: {
  workspace_id: string
  session_id?: string | null
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
}): Promise<UsageMetric> {
  const { data, error } = await supabase
    .from('usage_metrics')
    .insert({
      workspace_id: input.workspace_id,
      session_id: input.session_id ?? null,
      model: input.model,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      cost_usd: input.cost_usd,
    })
    .select('*')
    .single()
  if (error) throw new Error(`recordMetric failed: ${error.message}`)
  return data as UsageMetric
}

export async function upsertDailyMetric(
  workspace_id: string,
  date: string,
  partial: DailyMetricInput,
): Promise<DailyMetric> {
  const { data, error } = await supabase
    .from('daily_metrics')
    .upsert(
      {
        workspace_id,
        date,
        ...partial,
      },
      { onConflict: 'workspace_id,date' },
    )
    .select('*')
    .single()
  if (error) throw new Error(`upsertDailyMetric failed: ${error.message}`)
  return data as DailyMetric
}
