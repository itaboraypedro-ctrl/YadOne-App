// app/api/cron/index-knowledge/route.ts — Endpoint cron para indexação de KB (T21).
//
// Protegido por Authorization: Bearer ${CRON_SECRET}.
// Schedule sugerido: a cada 5 min (*/5 * * * *).
//
// Respostas:
//  503 — CRON_SECRET não configurado
//  401 — header ausente ou token diferente
//  200 — { workspaces_processed, total_kb_items_indexed, errors, ts }
//  500 — erro inesperado

import { NextRequest, NextResponse } from 'next/server'
import { processKnowledgeIndexing } from '@/lib/jobs/knowledge-indexer'
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
    const result = await processKnowledgeIndexing()
    return NextResponse.json({ ...result, ts: new Date().toISOString() })
  } catch (e) {
    const msg = (e as Error).message
    void logAudit('cron.index_knowledge.error', { error: msg }, {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
