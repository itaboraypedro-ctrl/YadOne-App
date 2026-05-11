// lib/idempotency/middleware.ts — Helper específico para webhook handlers (T30).
// Compõe channel + channel_message_id como key e padroniza a resposta HTTP.

import { withIdempotency, IdempotencyConflictError } from './store'

export type WebhookChannel = 'ycloud' | 'zapi' | 'evolution'

export interface WebhookProcessOutcome {
  status: number
  body: Record<string, unknown>
}

/**
 * Processa o webhook uma única vez por (channel, channel_message_id).
 *
 * - Se já processado: 200 `{ ok: true, cached: true }`.
 * - Se outra execução em andamento (race): 409 `{ error: 'processing_in_progress' }`.
 * - Se sucesso novo: 200 `{ ok: true, ...result }` (caso `result` seja objeto;
 *   se não for, devolvido em `{ ok: true, result }`).
 */
export async function processWebhookOnce(
  channel: WebhookChannel,
  channel_message_id: string,
  workspace_id: string | null,
  handler: () => Promise<unknown>,
): Promise<WebhookProcessOutcome> {
  const key = `${channel}:${channel_message_id}`

  try {
    const { result, cached } = await withIdempotency<unknown>(key, workspace_id, handler)
    if (cached) {
      return { status: 200, body: { ok: true, cached: true } }
    }
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return {
        status: 200,
        body: { ok: true, ...(result as Record<string, unknown>) },
      }
    }
    return { status: 200, body: { ok: true, result } }
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return { status: 409, body: { error: 'processing_in_progress' } }
    }
    throw err
  }
}
