// app/api/conversations/[id]/messages/route.ts — GET mensagens paginadas.
// SPEC_FRONTEND_CONVERSATIONS.md §9.3.

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type { MessagesListResponse, MessageWithMeta } from '@/lib/types/frontend'
import type { Session } from '@/types/session'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, svc } = auth.ctx

  // Ownership: garante que a session pertence ao workspace
  const { data: sess, error: sErr } = await svc
    .from('sessions')
    .select('id, workspace_id')
    .eq('id', id)
    .maybeSingle()
  if (sErr) {
    return NextResponse.json({ error: 'sessions_query_failed' }, { status: 500 })
  }
  if (!sess || (sess as Pick<Session, 'workspace_id'>).workspace_id !== workspace_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const rawLimit = Number(url.searchParams.get('limit') ?? '50')
  const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 50))

  let q = svc
    .from('messages')
    .select('*')
    .eq('session_id', id)
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) q = q.lt('created_at', cursor)

  const { data, error } = await q
  if (error) {
    return NextResponse.json({ error: 'messages_query_failed', detail: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as MessageWithMeta[]
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const messages: MessageWithMeta[] = page.map((m) => ({
    ...m,
    source: (m.source ?? null) as 'ai' | 'human' | null,
    sent_by: (m.sent_by ?? null) as string | null,
    delivery_status: null,
  }))

  const next_cursor = hasMore && page.length > 0 ? page[page.length - 1].created_at : null

  const payload: MessagesListResponse = {
    messages,
    next_cursor,
    has_more: hasMore,
  }
  return NextResponse.json(payload)
}
