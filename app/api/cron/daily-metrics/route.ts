// app/api/cron/daily-metrics/route.ts — Endpoint cron diário consolidado (T22).
//
// Combina 3 jobs do SPEC: agregação de métricas, reset mensal de cost caps
// e cleanup de buckets/idempotency_keys.
//
// Protegido por Authorization: Bearer ${CRON_SECRET}.
// Schedule sugerido: 1x/dia 03:00 UTC (0 3 * * *).
//
// Respostas:
//  503 — CRON_SECRET não configurado
//  401 — header ausente ou token diferente
//  200 — { workspaces_aggregated, monthly_caps_reset, buckets_cleaned, idempotency_cleaned, errors, ts }
//  500 — erro inesperado

import { NextRequest, NextResponse } from 'next/server'
import { processDailyAggregation } from '@/lib/jobs/daily-aggregator'
import { logAudit } from '@/lib/db/audit'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return NextResponse.json({ error: 'cron_disabled' }, { status: 503 })
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDailyAggregation()
    return NextResponse.json({ ...result, ts: new Date().toISOString() })
  } catch (e) {
    const msg = (e as Error).message
    void logAudit('cron.daily_metrics.error', { error: msg }, {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
