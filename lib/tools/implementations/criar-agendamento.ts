// lib/tools/implementations/criar-agendamento.ts — INSERT em appointments.

import { supabase } from '@/lib/db/client'
import type { ToolExecutionContext } from '@/types/tools'

interface Params {
  workspace_id?: string
  cliente_id: string
  servico_id: string
  horario: string // ISO 8601
}

interface Result {
  agendamento_id: string
  confirmacao: string
}

function isParams(p: unknown): p is Params {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Params
  return (
    typeof o.cliente_id === 'string' &&
    typeof o.servico_id === 'string' &&
    typeof o.horario === 'string'
  )
}

export async function criarAgendamento(
  params: unknown,
  ctx: ToolExecutionContext,
): Promise<Result> {
  if (!isParams(params)) {
    throw new Error('criarAgendamento: params inválidos')
  }

  const { data, error } = await supabase
    .from('appointments')
    .insert({
      workspace_id: ctx.workspace_id,
      client_id: params.cliente_id,
      product_id: params.servico_id,
      scheduled_at: params.horario,
      session_id: ctx.session_id,
      status: 'confirmed',
    })
    .select('id, scheduled_at')
    .single()

  if (error) throw new Error(`criarAgendamento failed: ${error.message}`)

  const row = data as { id: string; scheduled_at: string }
  return {
    agendamento_id: row.id,
    confirmacao: `Agendado para ${row.scheduled_at}`,
  }
}
