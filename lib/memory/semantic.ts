// lib/memory/semantic.ts — Memória semântica (camada de domínio sobre /lib/db/memory.ts)
// SPEC §7: estrutura completa preferred_name / preferences / last_service /
// observations / raw_insights, persistida em client_memory.

import {
  getMemorySemantic,
  upsertMemorySemantic,
} from '@/lib/db/memory'
import type { ClientMemorySemantic } from '@/types/memory'

interface UpsertSemanticInput {
  client_id: string
  workspace_id: string
  memory_summary: string
  preferred_name: string | null
  preferences: string[]
  last_service: string | null
  observations: string | null
  raw_insights: Record<string, unknown>
}

/**
 * Lê a memória semântica do cliente naquele workspace.
 * Retorna null para clientes novos (não é erro).
 */
export async function getSemantic(
  client_id: string,
  workspace_id: string,
): Promise<ClientMemorySemantic | null> {
  return getMemorySemantic(client_id, workspace_id)
}

/**
 * Upsert da memória semântica. O caller (job T20) é responsável pela lógica
 * incremental — aqui apenas persiste o estado já consolidado.
 */
export async function upsertSemantic(
  input: UpsertSemanticInput,
): Promise<ClientMemorySemantic> {
  return upsertMemorySemantic({
    client_id: input.client_id,
    workspace_id: input.workspace_id,
    memory_summary: input.memory_summary,
    preferred_name: input.preferred_name,
    preferences: input.preferences,
    last_service: input.last_service,
    observations: input.observations,
    raw_insights: input.raw_insights,
  })
}
