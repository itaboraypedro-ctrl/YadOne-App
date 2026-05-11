// lib/idempotency/store.ts — Wrapper "process-once" sobre /lib/db/idempotency.ts (T30, gap #16).
// Garante que um mesmo `key` seja processado uma única vez mesmo sob retries concorrentes.

import {
  getIdempotencyKey,
  createIdempotencyKey,
  updateIdempotencyResult,
  deleteIdempotencyKey,
} from '@/lib/db/idempotency'

/**
 * Erro especial lançado quando duas execuções concorrentes tentam criar a mesma chave
 * (race detectada via UNIQUE violation `23505` do Postgres). Caller deve responder 409.
 */
export class IdempotencyConflictError extends Error {
  readonly key: string
  constructor(key: string) {
    super(`idempotency conflict for key=${key}`)
    this.name = 'IdempotencyConflictError'
    this.key = key
  }
}

interface PgErrorLike {
  code?: string
  message?: string
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as PgErrorLike
  if (e.code === '23505') return true
  // createIdempotencyKey re-embrulha o erro do supabase em Error: vamos olhar a mensagem.
  if (typeof e.message === 'string' && e.message.includes('23505')) return true
  if (typeof e.message === 'string' && e.message.includes('duplicate key value')) return true
  return false
}

/**
 * Executa `handler` uma única vez por `key`. Resultados são persistidos por TTL=24h.
 *
 * Algoritmo:
 *  1. SELECT — se já há registro com `result != null`, retorna cacheado.
 *  2. INSERT — se 23505 (race), lança `IdempotencyConflictError`.
 *  3. handler() — em erro, DELETE para permitir retry; re-lança erro original.
 *  4. UPDATE — persiste resultado.
 */
export async function withIdempotency<T>(
  key: string,
  workspace_id: string | null,
  handler: () => Promise<T>,
): Promise<{ result: T; cached: boolean }> {
  const existing = await getIdempotencyKey(key)
  if (existing && existing.result !== null && existing.result !== undefined) {
    return { result: existing.result as T, cached: true }
  }

  if (!existing) {
    try {
      await createIdempotencyKey(key, workspace_id, 24)
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new IdempotencyConflictError(key)
      }
      throw err
    }
  }

  let result: T
  try {
    result = await handler()
  } catch (err) {
    // Em erro, removemos a chave para permitir retry pelo provedor.
    try {
      await deleteIdempotencyKey(key)
    } catch {
      // Ignora falha no cleanup — registro expirará via TTL de qualquer forma.
    }
    throw err
  }

  await updateIdempotencyResult(key, result)
  return { result, cached: false }
}
