// lib/tools/authorization.ts — Allowlist de tools por fluxo (default deny).
// SPEC §14.1: tools só executam em nós cujo fluxo tem flow_tool_policies.allowed=true.

import { supabase } from '@/lib/db/client'

/**
 * Verifica se o tool_id está autorizado no flow_id atual.
 * Default deny: se não há row em flow_tool_policies, retorna `false`.
 * Só retorna `true` quando a row existe e `allowed=true`.
 */
export async function isToolAllowedInFlow(flow_id: string, tool_id: string): Promise<boolean> {
  if (!flow_id) throw new Error('isToolAllowedInFlow: flow_id is required')
  if (!tool_id) throw new Error('isToolAllowedInFlow: tool_id is required')

  const { data, error } = await supabase
    .from('flow_tool_policies')
    .select('allowed')
    .eq('flow_id', flow_id)
    .eq('tool_id', tool_id)
    .maybeSingle()

  if (error) {
    throw new Error(`isToolAllowedInFlow(${flow_id}, ${tool_id}) failed: ${error.message}`)
  }
  if (!data) return false
  return (data as { allowed: boolean }).allowed === true
}
