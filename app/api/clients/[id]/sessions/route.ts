// app/api/clients/[id]/sessions/route.ts — GET histórico de sessões do cliente.
// SPEC_FRONTEND_CONVERSATIONS.md §3.4 (F17 — painel lateral).

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type { Client } from '@/types/client'
import type { SessionStatus } from '@/types/session'

export const dynamic = 'force-dynamic'

export interface ClientSessionSummary {
  id: string
  status: SessionStatus
  channel: string
  created_at: string
  updated_at: string
  expires_at: string | null
}

export interface ClientSessionsResponse {
  sessions: ClientSessionSummary[]
  total: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { svc, workspace_id } = auth.ctx
  const { id } = await params

  // Defesa IDOR: confirma que o cliente pertence ao workspace.
  const { data: clientRow, error: cErr } = await svc
    .from('clients')
    .select('id, workspace_id')
    .eq('id', id)
    .maybeSingle()
  if (cErr) {
    return NextResponse.json(
      { error: 'clients_query_failed', detail: cErr.message },
      { status: 500 },
    )
  }
  if (
    !clientRow ||
    (clientRow as Pick<Client, 'id' | 'workspace_id'>).workspace_id !==
      workspace_id
  ) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data, error, count } = await svc
    .from('sessions')
    .select('id, status, channel, created_at, updated_at, expires_at', {
      count: 'exact',
    })
    .eq('client_id', id)
    .eq('workspace_id', workspace_id)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json(
      { error: 'sessions_query_failed', detail: error.message },
      { status: 500 },
    )
  }

  const sessions = ((data as ClientSessionSummary[] | null) ?? []).map(
    (s) => ({
      id: s.id,
      status: s.status,
      channel: s.channel,
      created_at: s.created_at,
      updated_at: s.updated_at,
      expires_at: s.expires_at,
    }),
  )

  const payload: ClientSessionsResponse = {
    sessions,
    total: count ?? sessions.length,
  }
  return NextResponse.json(payload)
}
