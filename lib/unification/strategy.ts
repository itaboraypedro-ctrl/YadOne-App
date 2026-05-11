// lib/unification/strategy.ts — Detecção de cliente existente para unificação cross-channel.
//
// Aplica a `UnificationStrategy` do workspace para encontrar um cliente já
// existente em outro canal antes de criar duplicata. Gap #3.

import type { Client } from '@/types/client'
import {
  findClientByPhone,
  findClientBySecondaryPhone,
  findClientByEmail,
} from '@/lib/db/clients'
import { getWorkspaceUnificationPolicy } from './policy'

// Os helpers em lib/db/clients.ts ainda usam tipo inline (crm_status: string)
// — gap documentado em T03 (TODO de migrar para @/types/...). Encapsulamos a
// conversão num cast localizado para manter `Client` (com CRMStatus) na API
// pública deste módulo.
function asClient(row: unknown): Client {
  return row as Client
}

/**
 * Normaliza um telefone para forma canônica E.164-like.
 * - Remove espaços, parênteses, hífens, pontos.
 * - Mantém apenas dígitos (e o sinal '+' inicial, se houver).
 * - Garante prefixo '+' se número não-vazio.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''
  // remove tudo que não é dígito ou '+'
  const stripped = phone.replace(/[^\d+]/g, '')
  // mantém só o primeiro '+' se existir
  const hasPlus = stripped.startsWith('+')
  const digits = stripped.replace(/\+/g, '')
  if (digits.length === 0) return ''
  return hasPlus ? `+${digits}` : `+${digits}`
}

/**
 * Procura um cliente existente no workspace de acordo com a política de unificação.
 * Retorna `null` se nada bater ou se a estratégia for `disabled`/`manual_link`.
 */
export async function detectExistingClient(
  workspace_id: string,
  phone: string,
  email?: string,
): Promise<Client | null> {
  const policy = await getWorkspaceUnificationPolicy(workspace_id)

  if (policy.strategy === 'disabled') return null

  if (policy.strategy === 'manual_link') {
    // admin precisa unificar manualmente — não detecta automaticamente
    return null
  }

  if (policy.strategy === 'email') {
    if (!email) return null
    const byEmail = await findClientByEmail(workspace_id, email.toLowerCase())
    return byEmail ? asClient(byEmail) : null
  }

  // policy.strategy === 'phone' (default)
  const normalized = normalizePhone(phone)
  if (!normalized) return null

  const byPrimary = await findClientByPhone(workspace_id, normalized)
  if (byPrimary) return asClient(byPrimary)

  const bySecondary = await findClientBySecondaryPhone(workspace_id, normalized)
  return bySecondary ? asClient(bySecondary) : null
}
