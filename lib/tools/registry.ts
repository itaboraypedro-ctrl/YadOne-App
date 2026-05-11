// lib/tools/registry.ts — Lookup de definições de tool em tools_registry.
// SPEC §3.3 (tool_call), §14.1 (tool authorization), TAREFA 11 do PART_1.

import { supabase } from '@/lib/db/client'
import type { ToolDefinition } from '@/types/tools'

/**
 * Carrega a definição de uma tool pelo `tool_id` lógico (ex: 'criar_agendamento').
 * Retorna `null` se não existir ou estiver inativa.
 */
export async function getToolDefinition(tool_id: string): Promise<ToolDefinition | null> {
  if (!tool_id) throw new Error('getToolDefinition: tool_id is required')

  const { data, error } = await supabase
    .from('tools_registry')
    .select('*')
    .eq('tool_id', tool_id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`getToolDefinition(${tool_id}) failed: ${error.message}`)
  return (data as ToolDefinition) ?? null
}

/**
 * Lista todas as tools ativas — útil para painéis admin e construção do prompt
 * (T10 enumera as tools disponíveis para o LLM).
 */
export async function listAvailableTools(): Promise<ToolDefinition[]> {
  const { data, error } = await supabase
    .from('tools_registry')
    .select('*')
    .eq('is_active', true)
    .order('tool_id', { ascending: true })

  if (error) throw new Error(`listAvailableTools failed: ${error.message}`)
  return (data as ToolDefinition[]) ?? []
}
