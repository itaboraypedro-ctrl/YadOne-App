// lib/guardrails/cost-cap.ts — Bloqueia em 100% do monthly_cap_usd, alerta em 80%.
// SPEC §14.4 (Cost Cap). Emissão de eventos é "fire-and-forget"; Job 7 deduplica.

import { checkCapStatus } from '@/lib/db/cost-caps'
import { emitEvent } from '@/lib/db/crm-events'

export type CostCapStatus = 'ok' | 'warning' | 'blocked'

export interface CostCapCheckResult {
  status: CostCapStatus
  current_usd: number
  cap_usd: number
  percentage: number
}

const WARNING_THRESHOLD = 0.8
const BLOCKED_THRESHOLD = 1.0

/**
 * Lê estado do cap e, ao cruzar limiares, emite eventos para o CRM.
 * Idempotência: Job 7 (T22) deduplica eventos repetidos. Emitimos a cada chamada
 * que detecta status warning/blocked (decisão MVP).
 */
export async function checkCostCap(workspace_id: string): Promise<CostCapCheckResult> {
  if (!workspace_id) throw new Error('checkCostCap: workspace_id is required')

  const cap = await checkCapStatus(workspace_id)

  // Sem cap configurado → sempre 'ok' (workspace ainda não atingiu nada).
  if (cap.cap_usd <= 0) {
    return {
      status: 'ok',
      current_usd: cap.current_usd,
      cap_usd: cap.cap_usd,
      percentage: cap.percentage,
    }
  }

  let status: CostCapStatus = 'ok'
  if (cap.percentage >= BLOCKED_THRESHOLD) status = 'blocked'
  else if (cap.percentage >= WARNING_THRESHOLD) status = 'warning'

  if (status === 'blocked') {
    try {
      await emitEvent(
        'cost.threshold_blocked',
        {
          current_usd: cap.current_usd,
          cap_usd: cap.cap_usd,
          percentage: cap.percentage,
        },
        { workspace_id },
      )
    } catch (e) {
      console.error('[cost-cap] failed to emit cost.threshold_blocked', {
        workspace_id,
        error: (e as Error).message,
      })
    }
  } else if (status === 'warning') {
    try {
      await emitEvent(
        'cost.threshold_warning',
        {
          current_usd: cap.current_usd,
          cap_usd: cap.cap_usd,
          percentage: cap.percentage,
        },
        { workspace_id },
      )
    } catch (e) {
      console.error('[cost-cap] failed to emit cost.threshold_warning', {
        workspace_id,
        error: (e as Error).message,
      })
    }
  }

  return {
    status,
    current_usd: cap.current_usd,
    cap_usd: cap.cap_usd,
    percentage: cap.percentage,
  }
}
