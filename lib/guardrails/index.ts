// lib/guardrails/index.ts — Orquestra hard guardrails do input layer.
// SPEC §14.3, §14.4. Session breaker (§14.5) é checado em ponto distinto do pipeline.

import { checkRateLimit } from './rate-limiter'
import { checkCostCap } from './cost-cap'
import { logAudit } from '@/lib/db/audit'

export {
  checkRateLimit,
  type RateLimitCheckResult,
} from './rate-limiter'

export {
  checkCostCap,
  type CostCapCheckResult,
  type CostCapStatus,
} from './cost-cap'

export {
  checkSessionBreaker,
  checkToolBreaker,
  recordToolFailure,
  resetToolBreaker,
  type SessionBreakerResult,
  type ToolBreakerResult,
} from './circuit-breaker'

export interface InputGuardInput {
  workspace_id: string
  phone: string
}

export interface InputGuardResult {
  allowed: boolean
  reason?: string
}

/**
 * Roda os guards de entrada na ordem: rate-limit → cost-cap.
 * Session breaker NÃO é checado aqui — ele é avaliado em outro ponto do pipeline
 * (após session loaded), conforme SPEC §14.5.
 *
 * Em qualquer bloqueio, registra audit log e retorna allowed=false com reason.
 */
export async function runInputGuards(input: InputGuardInput): Promise<InputGuardResult> {
  const { workspace_id, phone } = input
  if (!workspace_id) throw new Error('runInputGuards: workspace_id is required')
  if (!phone) throw new Error('runInputGuards: phone is required')

  // 1) Rate limit
  const rl = await checkRateLimit(workspace_id, phone)
  if (!rl.allowed) {
    await logAudit(
      'guardrail.rate_limited',
      {
        phone,
        current: rl.current,
        limit: rl.limit,
      },
      { workspace_id },
    )
    return { allowed: false, reason: 'rate_limit_exceeded' }
  }

  // 2) Cost cap
  const cap = await checkCostCap(workspace_id)
  if (cap.status === 'blocked') {
    await logAudit(
      'guardrail.cost_capped',
      {
        current_usd: cap.current_usd,
        cap_usd: cap.cap_usd,
        percentage: cap.percentage,
      },
      { workspace_id },
    )
    return { allowed: false, reason: 'cost_cap_reached' }
  }

  return { allowed: true }
}
