// lib/tools/implementations/registrar-ou-atualizar-cliente.ts
// Cria ou atualiza um cliente com base em `dados` (deve incluir telefone).

import { getOrCreateClient, updateClient } from '@/lib/db/clients'
import type { ToolExecutionContext } from '@/types/tools'

interface Params {
  workspace_id?: string
  dados: Record<string, unknown>
}

interface Result {
  cliente_id: string
}

function isParams(p: unknown): p is Params {
  if (typeof p !== 'object' || p === null) return false
  const o = p as Params
  return typeof o.dados === 'object' && o.dados !== null
}

function getString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key]
  return typeof v === 'string' ? v : null
}

function getStringArray(obj: Record<string, unknown>, key: string): string[] | null {
  const v = obj[key]
  if (!Array.isArray(v)) return null
  return v.every((x) => typeof x === 'string') ? (v as string[]) : null
}

export async function registrarOuAtualizarCliente(
  params: unknown,
  ctx: ToolExecutionContext,
): Promise<Result> {
  if (!isParams(params)) {
    throw new Error('registrarOuAtualizarCliente: params inválidos')
  }
  const dados = params.dados
  const telefone = getString(dados, 'telefone') ?? getString(dados, 'phone')
  if (!telefone) {
    throw new Error('registrarOuAtualizarCliente: dados.telefone é obrigatório')
  }

  const name = getString(dados, 'nome') ?? getString(dados, 'name')
  const email = getString(dados, 'email')
  const notes = getString(dados, 'observacoes') ?? getString(dados, 'notes')
  const crm_status = getString(dados, 'crm_status')
  const crm_tags = getStringArray(dados, 'crm_tags')

  const client = await getOrCreateClient(ctx.workspace_id, telefone, {
    name: name ?? undefined,
    email: email ?? undefined,
    notes: notes ?? undefined,
    crm_status: crm_status ?? undefined,
    crm_tags: crm_tags ?? undefined,
  })

  // Se o cliente já existia mas vieram novos campos, atualiza.
  const updates: Record<string, unknown> = {}
  if (name !== null && client.name !== name) updates.name = name
  if (email !== null && client.email !== email) updates.email = email
  if (notes !== null && client.notes !== notes) updates.notes = notes
  if (crm_status !== null && client.crm_status !== crm_status) updates.crm_status = crm_status
  if (crm_tags !== null) updates.crm_tags = crm_tags

  if (Object.keys(updates).length > 0) {
    const updated = await updateClient(client.id, updates)
    return { cliente_id: updated.id }
  }

  return { cliente_id: client.id }
}
