// lib/unification/merger.ts — Merge de dois clients (primary absorve secondary).
//
// Move messages, sessions e episodic memory do secondary para o primary,
// concatena phones, e marca o secondary com `unified_id = primary.id` (auditoria
// preservada — não deletamos para manter rastreabilidade do registro original).
//
// Memória semântica: se ambos têm registro, o do primary prevalece (não é
// fundido automaticamente para evitar perda de insights divergentes). Se só o
// secondary tem, o registro é movido (UPDATE client_id). Decisão T28.

import type { Client } from '@/types/client'
import { supabase } from '@/lib/db/client'
import { updateClient } from '@/lib/db/clients'

export interface MergeResult {
  moved: {
    messages: number
    sessions: number
    memory: boolean // true se um registro de client_memory foi reatribuído
    episodic: number
  }
}

async function loadClientById(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`loadClientById(${id}) failed: ${error.message}`)
  return (data as Client | null) ?? null
}

export async function mergeClients(
  workspace_id: string,
  primary_id: string,
  secondary_id: string,
): Promise<MergeResult> {
  if (primary_id === secondary_id) {
    throw new Error('mergeClients: primary_id and secondary_id must differ')
  }

  const [primary, secondary] = await Promise.all([
    loadClientById(primary_id),
    loadClientById(secondary_id),
  ])

  if (!primary) throw new Error(`mergeClients: primary client ${primary_id} not found`)
  if (!secondary) throw new Error(`mergeClients: secondary client ${secondary_id} not found`)
  if (primary.workspace_id !== workspace_id) {
    throw new Error('mergeClients: primary client belongs to different workspace')
  }
  if (secondary.workspace_id !== workspace_id) {
    throw new Error('mergeClients: secondary client belongs to different workspace')
  }

  // 1) Move messages
  const movedMessages = await reassign('messages', secondary_id, primary_id)

  // 2) Move sessions
  const movedSessions = await reassign('sessions', secondary_id, primary_id)

  // 3) Episodic memory
  const movedEpisodic = await reassign('client_episodic_memory', secondary_id, primary_id)

  // 4) Semantic memory (client_memory) — política conservadora
  const memoryMoved = await reassignSemanticMemory(primary_id, secondary_id)

  // 5) Concat phones (primary.phone + primary.secondary_phones + secondary.phone + secondary.secondary_phones)
  const merged = mergePhones(primary, secondary)

  await updateClient(primary_id, {
    secondary_phones: merged,
  })

  // 6) Marca o secondary como unificado (preserva registro para auditoria)
  await updateClient(secondary_id, {
    unified_id: primary_id,
  })

  return {
    moved: {
      messages: movedMessages,
      sessions: movedSessions,
      memory: memoryMoved,
      episodic: movedEpisodic,
    },
  }
}

async function reassign(
  table: 'messages' | 'sessions' | 'client_episodic_memory',
  fromClientId: string,
  toClientId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .update({ client_id: toClientId })
    .eq('client_id', fromClientId)
    .select('id')
  if (error) {
    throw new Error(
      `mergeClients: failed reassigning ${table} (${fromClientId} -> ${toClientId}): ${error.message}`,
    )
  }
  return (data?.length as number) ?? 0
}

/**
 * Para client_memory (semantic), cada client tem no máximo 1 registro (PK por client_id).
 * - Se primary já tem: deixa, NÃO sobrescreve (evita perda de insights).
 * - Se só secondary tem: reatribui para primary.
 * - Se nenhum tem: noop.
 * Retorna `true` apenas se um registro foi efetivamente movido.
 */
async function reassignSemanticMemory(
  primary_id: string,
  secondary_id: string,
): Promise<boolean> {
  const [primaryMem, secondaryMem] = await Promise.all([
    supabase
      .from('client_memory')
      .select('client_id')
      .eq('client_id', primary_id)
      .maybeSingle(),
    supabase
      .from('client_memory')
      .select('client_id')
      .eq('client_id', secondary_id)
      .maybeSingle(),
  ])

  if (primaryMem.error) {
    throw new Error(`mergeClients: failed reading primary memory: ${primaryMem.error.message}`)
  }
  if (secondaryMem.error) {
    throw new Error(
      `mergeClients: failed reading secondary memory: ${secondaryMem.error.message}`,
    )
  }

  // Primary já tem registro: nada a fazer (preserva insights do primary).
  if (primaryMem.data) return false

  // Secondary não tem registro: nada a mover.
  if (!secondaryMem.data) return false

  // Só o secondary tem: reatribui.
  const { error: updateErr } = await supabase
    .from('client_memory')
    .update({ client_id: primary_id })
    .eq('client_id', secondary_id)
  if (updateErr) {
    throw new Error(`mergeClients: failed reassigning semantic memory: ${updateErr.message}`)
  }
  return true
}

function mergePhones(primary: Client, secondary: Client): string[] {
  const set = new Set<string>()
  for (const p of primary.secondary_phones ?? []) set.add(p)
  if (secondary.phone) set.add(secondary.phone)
  for (const p of secondary.secondary_phones ?? []) set.add(p)
  // não inclui o phone primário em secondary_phones
  set.delete(primary.phone)
  return Array.from(set)
}
