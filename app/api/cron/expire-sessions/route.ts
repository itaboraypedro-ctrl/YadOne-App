// app/api/cron/expire-sessions/route.ts — Endpoint cron para expirar sessões inativas (T19).
//
// Protegido por Authorization: Bearer ${CRON_SECRET}.
// Schedule sugerido: a cada 1h (0 * * * *).
//
// Respostas:
//  503 — CRON_SECRET não configurado
//  401 — header ausente ou token diferente
//  200 — { expired, errors, ts }
//  500 — erro inesperado

import { NextRequest, NextResponse } from 'next/server'
import { processExpiredSessions } from '@/lib/jobs/session-expirer'
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
    const result = await processExpiredSessions()
    return NextResponse.json({ ...result, ts: new Date().toISOString() })
  } catch (e) {
    const msg = (e as Error).message
    void logAudit('cron.expire_sessions.error', { error: msg }, {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
