// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/app/api/admin/_auth'
import { getSession, updateSession } from '@/lib/db/sessions'
import { emitEvent } from '@/lib/db/crm-events'
import { logAudit } from '@/lib/db/audit'

export async function POST(
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

  let body: { reason?: string } = {}
  try {
    body = await req.json()
  } catch {
    // body is optional; default to empty
  }

  const reason = body.reason ?? 'manual_admin'

  await updateSession(id, { status: 'handoff' })

  await emitEvent(
    'conversation.handoff',
    { reason, forced: true, source: 'admin' },
    {
      workspace_id: session.workspace_id,
      session_id: id,
      client_id: session.client_id,
      trace_id: session.current_trace_id ?? null,
    },
  )

  await logAudit(
    'admin.handoff',
    { reason, session_id: id },
    { workspace_id: session.workspace_id, session_id: id },
  )

  return NextResponse.json({ ok: true, session_id: id, status: 'handoff' })
}
