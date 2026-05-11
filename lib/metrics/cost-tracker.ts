// lib/metrics/cost-tracker.ts — Tracking de uso por chamada LLM.
// FIRE-AND-FORGET: nunca lança erro para não quebrar o motor.

import { calculateCost } from './cost-calculator'
import { recordUsage, checkCapStatus } from '@/lib/db/cost-caps'
import { emitEvent } from '@/lib/db/crm-events'

/**
 * Registra uso de tokens de uma chamada LLM, atualiza o agregado do workspace
 * e verifica thresholds de cost cap.
 *
 * Deve ser chamado com `void trackUsage(...)` — não awaitar no hot path.
 */
export async function trackUsage(
  workspace_id: string,
  model: string,
  input_tokens: number,
  output_tokens: number,
  session_id?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const cost_usd = calculateCost(model, input_tokens, output_tokens)

    // Persiste em usage_metrics e atualiza workspace_cost_caps.current_month_usd.
    await recordUsage(workspace_id, model, input_tokens, output_tokens, cost_usd, session_id ?? null)

    // Verifica threshold após registrar.
    const capStatus = await checkCapStatus(workspace_id)
    if (capStatus.status === 'warning') {
      void emitEvent(
        'cost.threshold_warning',
        {
          workspace_id,
          current_usd: capStatus.current_usd,
          cap_usd: capStatus.cap_usd,
          percentage: capStatus.percentage,
          model,
          session_id: session_id ?? null,
          ...metadata,
        },
        { workspace_id, session_id: session_id ?? null },
      )
    } else if (capStatus.status === 'blocked') {
      void emitEvent(
        'cost.threshold_blocked',
        {
          workspace_id,
          current_usd: capStatus.current_usd,
          cap_usd: capStatus.cap_usd,
          percentage: capStatus.percentage,
          model,
          session_id: session_id ?? null,
          ...metadata,
        },
        { workspace_id, session_id: session_id ?? null },
      )
    }
  } catch (e) {
    // Falha de telemetria NÃO pode quebrar o motor — apenas log.
    console.error('[cost-tracker] falha ao registrar uso', {
      workspace_id,
      model,
      error: (e as Error).message,
    })
  }
}
