// lib/tools/implementations/cancelar-agendamento.ts — UPDATE status='cancelled'.

import { supabase } from '@/lib/db/client'
import type { ToolExecutionContext } from '@/types/tools'

interface Params {
  agendamento_id: string
}

interface Result {
  success: boolean
}

function isParams(p: unknown): p is Params {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as Params).agendamento_id === 'string'
  )
}

export async function cancelarAgendamento(
  params: unknown,
  ctx: ToolExecutionContext,
): Promise<Result> {
  if (!isParams(params)) {
    throw new Error('cancelarAgendamento: params inválidos')
  }

  // Restringe escopo ao workspace do ctx para evitar cross-tenant.
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', params.agendamento_id)
    .eq('workspace_id', ctx.workspace_id)

  if (error) throw new Error(`cancelarAgendamento failed: ${error.message}`)
  return { success: true }
}
