// TODO: substituir Bearer ADMIN_TOKEN por auth proper (RBAC) na fase de produção
//
// app/api/admin/trace/[trace_id]/route.ts (T25)
//
// Endpoint de timeline para um trace_id. Junta eventos de audit_logs,
// messages e monitor_decisions ordenados por created_at, permitindo
// reconstruir a jornada completa de uma request distribuída.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdminToken } from '@/app/api/admin/_auth'
import { supabase } from '@/lib/db/client'

type TimelineKind = 'audit' | 'message' | 'monitor'

interface TimelineEvent {
  kind: TimelineKind
  created_at: string
  data: Record<string, unknown>
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trace_id: string }> },
): Promise<NextResponse> {
  const authError = requireAdminToken(req)
  if (authError) return authError

  const { trace_id } = await params

  if (!trace_id || trace_id.trim().length === 0) {
    return NextResponse.json({ error: 'trace_id is required' }, { status: 400 })
  }

  // monitor_decisions não tem coluna trace_id direta; resolvemos via session_id
  // dos audit_logs/messages que carregam esse trace_id. Buscamos primeiro
  // audit + messages, depois fetcheamos monitor_decisions filtrando pelos
  // session_ids relevantes e pela janela temporal.
  const [auditResult, messagesResult] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('*')
      .eq('trace_id', trace_id)
      .order('created_at', { ascending: true }),
    supabase
      .from('messages')
      .select('*')
      .eq('trace_id', trace_id)
      .order('created_at', { ascending: true }),
  ])

  if (auditResult.error) {
    return NextResponse.json({ error: auditResult.error.message }, { status: 500 })
  }
  if (messagesResult.error) {
    return NextResponse.json({ error: messagesResult.error.message }, { status: 500 })
  }

  const auditRows = (auditResult.data ?? []) as Array<
    Record<string, unknown> & { created_at: string; session_id: string | null }
  >
  const messageRows = (messagesResult.data ?? []) as Array<
    Record<string, unknown> & {
      created_at: string
      session_id: string
      id: string
    }
  >

  // Coletar session_ids para buscar monitor_decisions associadas.
  const sessionIds = new Set<string>()
  for (const r of auditRows) {
    if (r.session_id) sessionIds.add(r.session_id)
  }
  for (const r of messageRows) {
    if (r.session_id) sessionIds.add(r.session_id)
  }
  const messageIds = new Set(messageRows.map((m) => m.id))

  let monitorRows: Array<Record<string, unknown> & { created_at: string }> = []
  if (sessionIds.size > 0) {
    const { data: monitorData, error: monitorError } = await supabase
      .from('monitor_decisions')
      .select('*')
      .in('session_id', Array.from(sessionIds))
      .order('created_at', { ascending: true })

    if (monitorError) {
      return NextResponse.json({ error: monitorError.message }, { status: 500 })
    }
    // Filtra por message_id pertencente ao trace OU por janela temporal
    // do trace (entre primeiro e último evento). Se message_id é null,
    // fallback temporal evita perder decisões.
    const allTimes = [...auditRows, ...messageRows].map((r) => r.created_at).sort()
    const minTs = allTimes[0]
    const maxTs = allTimes[allTimes.length - 1]

    monitorRows = ((monitorData ?? []) as Array<
      Record<string, unknown> & {
        created_at: string
        message_id: string | null
      }
    >).filter((d) => {
      if (d.message_id && messageIds.has(d.message_id)) return true
      if (minTs && maxTs && d.created_at >= minTs && d.created_at <= maxTs) return true
      return false
    })
  }

  const timeline: TimelineEvent[] = [
    ...auditRows.map((r) => ({
      kind: 'audit' as const,
      created_at: r.created_at,
      data: r,
    })),
    ...messageRows.map((r) => ({
      kind: 'message' as const,
      created_at: r.created_at,
      data: r,
    })),
    ...monitorRows.map((r) => ({
      kind: 'monitor' as const,
      created_at: r.created_at,
      data: r,
    })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return NextResponse.json({
    trace_id,
    count: timeline.length,
    timeline,
  })
}
