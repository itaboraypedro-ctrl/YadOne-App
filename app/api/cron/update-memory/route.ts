// app/api/cron/update-memory/route.ts — Endpoint cron para gerar memória pós-conversa (T20).
//
// Protegido por Authorization: Bearer ${CRON_SECRET}.
// Schedule sugerido: a cada 15 min (*/15 * * * *).
//
// Respostas:
//  503 — CRON_SECRET não configurado
//  401 — header ausente ou token diferente
//  200 — { processed, episodes_indexed, errors, ts }
//  500 — erro inesperado

import { NextRequest, NextResponse } from 'next/server'
import { processMemoryUpdates } from '@/lib/jobs/memory-updater'
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
    const result = await processMemoryUpdates()
    return NextResponse.json({ ...result, ts: new Date().toISOString() })
  } catch (e) {
    const msg = (e as Error).message
    void logAudit('cron.update_memory.error', { error: msg }, {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
