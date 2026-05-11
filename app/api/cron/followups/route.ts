// app/api/cron/followups/route.ts — Endpoint cron para disparo de followup timers (T29).
//
// Protegido por Authorization: Bearer ${CRON_SECRET}.
// Invocado pelo scheduler externo (Vercel Cron / cron job manual) a cada 1 min.
//
// Respostas:
//  503 — CRON_SECRET não configurado (cron desabilitado)
//  401 — header ausente ou token diferente
//  200 — { fired, errors, skipped, ts }
//  500 — erro inesperado ao executar o worker

import { NextRequest, NextResponse } from 'next/server'
import { processFollowupTimers } from '@/lib/jobs/followup-worker'
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
    const result = await processFollowupTimers()
    return NextResponse.json({ ...result, ts: new Date().toISOString() })
  } catch (e) {
    const msg = (e as Error).message
    void logAudit('cron.followups.error', { error: msg }, {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
