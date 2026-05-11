// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/app/api/admin/_auth'
import { supabase } from '@/lib/db/client'
import { getSession } from '@/lib/db/sessions'
import { getHistory } from '@/lib/db/messages'
import { getDecisionsBySession } from '@/lib/db/monitor-decisions'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const authError = requireAdminToken(req)
  if (authError) return authError

  const { id } = await params

  const session = await getSession(id)
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 })
  }

  const [messages, monitor_decisions, auditResult] = await Promise.all([
    getHistory(id, 100),
    getDecisionsBySession(id),
    supabase
      .from('audit_logs')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (auditResult.error) {
    return NextResponse.json({ error: auditResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    session,
    messages,
    monitor_decisions,
    audit_logs: auditResult.data ?? [],
  })
}
