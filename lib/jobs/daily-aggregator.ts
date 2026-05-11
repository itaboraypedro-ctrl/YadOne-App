// lib/jobs/daily-aggregator.ts — Worker diário de métricas + housekeeping (T22).
//
// Consolida 3 jobs do SPEC original:
//  - Job 7 (Daily Aggregator): agrega métricas de ontem por workspace.
//  - Job 6 (Cost Cap Reset): em dia 1 do mês, zera current_month_usd e desbloqueia
//    workspaces com status='blocked_cost_cap'.
//  - Job 8 (Bucket Cleanup): remove rate_limit_buckets antigos (>24h)
//    e idempotency_keys expirados (expires_at < now).
//
// Cada fase é isolada por try/catch — falha de uma não impede as demais.

import { supabase } from '@/lib/db/client'
import { aggregateDailyMetrics } from '@/lib/metrics/aggregator'
import { logAudit } from '@/lib/db/audit'

interface WorkspaceRow {
  id: string
}

export async function processDailyAggregation(): Promise<{
  workspaces_aggregated: number
  monthly_caps_reset: number
  buckets_cleaned: number
  idempotency_cleaned: number
  errors: number
}> {
  let workspaces_aggregated = 0
  let monthly_caps_reset = 0
  let buckets_cleaned = 0
  let idempotency_cleaned = 0
  let errors = 0

  // ── Fase 1: agregação por workspace ──────────────────────────
  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: wsData, error: wsError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('status', 'active')
    .limit(100)

  if (wsError) {
    errors++
    void logAudit('job.daily_aggregator_query_failed', { error: wsError.message }, {})
  } else {
    const wsRows = (wsData ?? []) as WorkspaceRow[]
    for (const ws of wsRows) {
      try {
        await aggregateDailyMetrics(ws.id, ontem)
        workspaces_aggregated++
      } catch (e) {
        errors++
        void logAudit(
          'job.daily_aggregator_failed',
          { workspace_id: ws.id, error: (e as Error).message },
          { workspace_id: ws.id },
        )
      }
    }
  }

  // ── Fase 2: reset mensal de cost caps (somente dia 1 UTC) ────
  if (new Date().getUTCDate() === 1) {
    try {
      const { data: capRows, error: capErr } = await supabase
        .from('workspace_cost_caps')
        .update({
          current_month_usd: 0,
          last_reset: new Date().toISOString(),
        })
        .not('id', 'is', null)
        .select('id')

      if (capErr) throw capErr
      monthly_caps_reset = (capRows ?? []).length

      // Desbloqueia workspaces que estavam blocked_cost_cap
      const { error: wsResetErr } = await supabase
        .from('workspaces')
        .update({ status: 'active' })
        .eq('status', 'blocked_cost_cap')
      if (wsResetErr) throw wsResetErr
    } catch (e) {
      errors++
      void logAudit(
        'job.cost_cap_reset_failed',
        { error: (e as Error).message },
        {},
      )
    }
  }

  // ── Fase 3: cleanup rate_limit_buckets (window_end < now - 24h) ──
  try {
    const cutoffBuckets = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count, error: bucketErr } = await supabase
      .from('rate_limit_buckets')
      .delete({ count: 'exact' })
      .lt('window_end', cutoffBuckets)
    if (bucketErr) throw bucketErr
    buckets_cleaned = count ?? 0
  } catch (e) {
    errors++
    void logAudit('job.bucket_cleanup_failed', { error: (e as Error).message }, {})
  }

  // ── Fase 4: cleanup idempotency_keys (expires_at < now) ──────
  // Tabela usa expires_at (TTL nativo) — não tem created_at.
  try {
    const nowIso = new Date().toISOString()
    const { count, error: idemErr } = await supabase
      .from('idempotency_keys')
      .delete({ count: 'exact' })
      .lt('expires_at', nowIso)
    if (idemErr) throw idemErr
    idempotency_cleaned = count ?? 0
  } catch (e) {
    errors++
    void logAudit('job.idempotency_cleanup_failed', { error: (e as Error).message }, {})
  }

  return {
    workspaces_aggregated,
    monthly_caps_reset,
    buckets_cleaned,
    idempotency_cleaned,
    errors,
  }
}
