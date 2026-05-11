// lib/db/cost-caps.ts — Cost cap por workspace + recordUsage agregado
// TODO: substituir tipos inline por imports apropriados após merge da T02.

import { supabase } from './client'

interface WorkspaceCostCap {
  id: string
  workspace_id: string
  monthly_cap_usd: number
  current_month_usd: number
  last_reset: string
  status: string
  warning_threshold: number
  created_at: string
}

interface CapStatusResult {
  current_usd: number
  cap_usd: number
  percentage: number
  status: 'ok' | 'warning' | 'blocked'
}

export async function getCostCap(workspace_id: string): Promise<WorkspaceCostCap | null> {
  const { data, error } = await supabase
    .from('workspace_cost_caps')
    .select('*')
    .eq('workspace_id', workspace_id)
    .maybeSingle()
  if (error) throw new Error(`getCostCap failed: ${error.message}`)
  return (data as WorkspaceCostCap) ?? null
}

/**
 * Registra uma chamada LLM em usage_metrics e atualiza o agregado em workspace_cost_caps.
 * Não-atômico (duas queries) — Job 7 (T22) reconcilia diariamente.
 */
export async function recordUsage(
  workspace_id: string,
  model: string,
  input_tokens: number,
  output_tokens: number,
  cost_usd: number,
  session_id?: string | null,
): Promise<void> {
  const { error: insErr } = await supabase.from('usage_metrics').insert({
    workspace_id,
    session_id: session_id ?? null,
    model,
    input_tokens,
    output_tokens,
    cost_usd,
  })
  if (insErr) throw new Error(`recordUsage insert failed: ${insErr.message}`)

  // Atualiza current_month_usd no cap. Lê + soma (não atômico, ver Job 7 reconciliação).
  const cap = await getCostCap(workspace_id)
  if (!cap) return
  const next = Number(cap.current_month_usd) + cost_usd
  const { error: updErr } = await supabase
    .from('workspace_cost_caps')
    .update({ current_month_usd: next })
    .eq('workspace_id', workspace_id)
  if (updErr) throw new Error(`recordUsage cap update failed: ${updErr.message}`)
}

export async function checkCapStatus(workspace_id: string): Promise<CapStatusResult> {
  const cap = await getCostCap(workspace_id)
  if (!cap) {
    return { current_usd: 0, cap_usd: 0, percentage: 0, status: 'ok' }
  }
  const cap_usd = Number(cap.monthly_cap_usd)
  const current = Number(cap.current_month_usd)
  const percentage = cap_usd > 0 ? current / cap_usd : 0
  let status: 'ok' | 'warning' | 'blocked' = 'ok'
  if (percentage >= 1) status = 'blocked'
  else if (percentage >= Number(cap.warning_threshold)) status = 'warning'
  return { current_usd: current, cap_usd, percentage, status }
}
