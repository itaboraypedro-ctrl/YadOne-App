// lib/resilience/circuit-breaker.ts — Circuit breaker em memória por API
// closed → open → half-open. Map<api_name, BreakerState>.

import { CircuitBreakerOpenError } from '@/types/tools'

export type BreakerState = 'closed' | 'open' | 'half-open'

export interface BreakerConfig {
  failure_threshold?: number
  open_duration_ms?: number
}

interface BreakerEntry {
  state: BreakerState
  failures: number
  opened_at: number | null
  config: Required<BreakerConfig>
}

const DEFAULT_CONFIG: Required<BreakerConfig> = {
  failure_threshold: 5,
  open_duration_ms: 30_000,
}

const breakers = new Map<string, BreakerEntry>()

function getOrCreate(api_name: string, config?: BreakerConfig): BreakerEntry {
  let entry = breakers.get(api_name)
  if (!entry) {
    entry = {
      state: 'closed',
      failures: 0,
      opened_at: null,
      config: { ...DEFAULT_CONFIG, ...config },
    }
    breakers.set(api_name, entry)
  } else if (config) {
    entry.config = { ...entry.config, ...config }
  }
  return entry
}

export function getBreakerState(api_name: string): BreakerState {
  const entry = breakers.get(api_name)
  if (!entry) return 'closed'
  // Verifica se open expirou para half-open lazy
  if (entry.state === 'open' && entry.opened_at !== null) {
    if (Date.now() - entry.opened_at >= entry.config.open_duration_ms) {
      entry.state = 'half-open'
    }
  }
  return entry.state
}

export function recordSuccess(api_name: string): void {
  const entry = breakers.get(api_name)
  if (!entry) return
  entry.state = 'closed'
  entry.failures = 0
  entry.opened_at = null
}

export function recordFailure(api_name: string): void {
  const entry = getOrCreate(api_name)
  entry.failures += 1
  if (entry.state === 'half-open') {
    // Falha em half-open reabre imediatamente
    entry.state = 'open'
    entry.opened_at = Date.now()
    return
  }
  if (entry.failures >= entry.config.failure_threshold) {
    entry.state = 'open'
    entry.opened_at = Date.now()
  }
}

export function resetBreaker(api_name: string): void {
  breakers.delete(api_name)
}

export async function withBreaker<T>(
  api_name: string,
  fn: () => Promise<T>,
  config?: BreakerConfig,
): Promise<T> {
  const entry = getOrCreate(api_name, config)
  const state = getBreakerState(api_name)

  if (state === 'open') {
    throw new CircuitBreakerOpenError(api_name)
  }

  try {
    const result = await fn()
    recordSuccess(api_name)
    return result
  } catch (error) {
    recordFailure(api_name)
    throw error
  } finally {
    // referência de uso para evitar dead-code elimination da reatribuição em entry.state
    void entry
  }
}
