// lib/guardrails/rate-limiter.ts — Sliding window por (workspace_id, phone), 60 msg/h.
// SPEC §14.3 (Hard Guardrails — Input Layer / Throttle).

import { incrementBucket } from '@/lib/db/rate-limits'

const HOURLY_LIMIT = 60
const SCOPE_TYPE = 'phone_hour'

export interface RateLimitCheckResult {
  allowed: boolean
  current: number
  limit: number
}

/**
 * Calcula o início da hora atual em ISO 8601 (UTC).
 * Janela é [HH:00:00, HH+1:00:00). Buckets distintos por hora truncada.
 */
function currentHourWindow(now: Date = new Date()): { start: string; end: string } {
  const start = new Date(now)
  start.setUTCMinutes(0, 0, 0)
  const end = new Date(start)
  end.setUTCHours(end.getUTCHours() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

/**
 * Incrementa o bucket atômico e retorna se a próxima mensagem é permitida.
 * allowed=false quando count > HOURLY_LIMIT após o increment (i.e. a 61ª mensagem é bloqueada).
 */
export async function checkRateLimit(
  workspace_id: string,
  phone: string,
): Promise<RateLimitCheckResult> {
  if (!workspace_id) throw new Error('checkRateLimit: workspace_id is required')
  if (!phone) throw new Error('checkRateLimit: phone is required')

  const scope_key = `${workspace_id}:${phone}:hour`
  const { start, end } = currentHourWindow()

  const current = await incrementBucket(scope_key, SCOPE_TYPE, start, end)

  return {
    allowed: current <= HOURLY_LIMIT,
    current,
    limit: HOURLY_LIMIT,
  }
}
