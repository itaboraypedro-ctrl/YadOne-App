// lib/tools/implementations/buscar-historico-cliente.ts
// Lookup do cliente por telefone + listagem de agendamentos ordenados por scheduled_at DESC.

import { supabase } from '@/lib/db/client'
import { findClientByPhone } from '@/lib/db/clients'
import type { ToolExecutionContext } from '@/types/tools'

interface Params {
  workspace_id?: string
  telefone: string
}

interface Result {
  agendamentos: Array<Record<string, unknown>>
  total_visitas: number
  ultimo_servico: string | null
}

function isParams(p: unknown): p is Params {
  return typeof p === 'object' && p !== null && typeof (p as Params).telefone === 'string'
}

export async function buscarHistoricoCliente(
  params: unknown,
  ctx: ToolExecutionContext,
): Promise<Result> {
  if (!isParams(params)) {
    throw new Error('buscarHistoricoCliente: params inválidos')
  }

  const client = await findClientByPhone(ctx.workspace_id, params.telefone)
  if (!client) {
    return { agendamentos: [], total_visitas: 0, ultimo_servico: null }
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status, product_id, professional_name, notes')
    .eq('client_id', client.id)
    .eq('workspace_id', ctx.workspace_id)
    .order('scheduled_at', { ascending: false })

  if (error) throw new Error(`buscarHistoricoCliente failed: ${error.message}`)

  const rows = (data as Array<Record<string, unknown>>) ?? []
  const completed = rows.filter((r) => r.status === 'confirmed' || r.status === 'completed')
  const ultimo = rows[0]
  const ultimo_servico =
    ultimo && typeof ultimo.product_id === 'string' ? (ultimo.product_id as string) : null

  return {
    agendamentos: rows,
    total_visitas: completed.length,
    ultimo_servico,
  }
}
