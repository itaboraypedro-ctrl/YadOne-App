// lib/resilience/retry.ts — Exponential backoff com jitter para chamadas a APIs externas (gap #14)

export interface RetryOptions {
  max_attempts?: number
  base_delay_ms?: number
  max_delay_ms?: number
  backoff_factor?: number
  retryable?: (error: unknown) => boolean
  on_retry?: (attempt: number, error: unknown) => void
}

interface ErrorWithStatus {
  status?: number
  statusCode?: number
  code?: string
  response?: { status?: number }
}

function extractStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  const e = error as ErrorWithStatus
  return e.status ?? e.statusCode ?? e.response?.status ?? null
}

function extractCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const e = error as ErrorWithStatus
  return e.code ?? null
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404, 422])
const RETRYABLE_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ECONNABORTED',
])

export function defaultRetryable(error: unknown): boolean {
  const status = extractStatus(error)
  if (status !== null) {
    if (NON_RETRYABLE_STATUS.has(status)) return false
    if (RETRYABLE_STATUS.has(status)) return true
    // 5xx genérico → retryable; 4xx genérico (não listado) → non-retryable
    if (status >= 500) return true
    if (status >= 400) return false
  }
  const code = extractCode(error)
  if (code && RETRYABLE_CODES.has(code)) return true
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const max_attempts = options.max_attempts ?? 3
  const base_delay = options.base_delay_ms ?? 500
  const max_delay = options.max_delay_ms ?? 5000
  const factor = options.backoff_factor ?? 2
  const retryable = options.retryable ?? defaultRetryable

  let lastError: unknown

  for (let attempt = 1; attempt <= max_attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === max_attempts) break
      if (!retryable(error)) break

      const exponential = Math.min(base_delay * Math.pow(factor, attempt - 1), max_delay)
      const jitter = Math.random() * 100
      const delay = exponential + jitter

      options.on_retry?.(attempt, error)
      await sleep(delay)
    }
  }

  throw lastError
}
