// app/api/conversations/route.ts — GET lista paginada de conversas do workspace.
// SPEC_FRONTEND_CONVERSATIONS.md §9.1.

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type {
  AIStatus,
  ConversationsListResponse,
  ConversationWithMeta,
} from '@/lib/types/frontend'
import type { Session, SessionStatus } from '@/types/session'
import type { Client } from '@/types/client'
import type { Message } from '@/types/message'

export const dynamic = 'force-dynamic'

interface ChannelConfigRow {
  id: string
  channel_type: string
  phone_number: string
  ai_enabled: boolean
}

const VALID_FILTERS = new Set(['all', 'active', 'paused', 'waiting', 'handoff'])

export async function GET(req: NextRequest) {
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, svc } = auth.ctx

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const filter = url.searchParams.get('filter') ?? 'all'
  const rawLimit = Number(url.searchParams.get('limit') ?? '30')
  const limit = Math.max(1, Math.min(100, Number.isFinite(rawLimit) ? rawLimit : 30))

  if (!VALID_FILTERS.has(filter)) {
    return NextResponse.json({ error: 'invalid_filter' }, { status: 400 })
  }

  // Carrega config global de IA
  const { data: agentConfigRow } = await svc
    .from('workspace_agent_config')
    .select('ai_enabled')
    .eq('workspace_id', workspace_id)
    .maybeSingle()
  // Coluna ai_enabled pode não existir ainda no workspace_agent_config; assumimos true.
  const aiGlobalEnabled =
    agentConfigRow && typeof (agentConfigRow as { ai_enabled?: unknown }).ai_enabled === 'boolean'
      ? ((agentConfigRow as { ai_enabled: boolean }).ai_enabled)
      : true

  let query = svc
    .from('sessions')
    .select('*')
    .eq('workspace_id', workspace_id)
    .order('updated_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('updated_at', cursor)
  }

  if (filter === 'active') {
    query = query.eq('status', 'active').eq('ai_paused', false)
  } else if (filter === 'paused') {
    query = query.eq('ai_paused', true)
  } else if (filter === 'waiting') {
    query = query.eq('status', 'waiting')
  } else if (filter === 'handoff') {
    query = query.eq('status', 'handoff')
  }

  const { data: sessions, error: sessErr } = await query
  if (sessErr) {
    return NextResponse.json({ error: 'sessions_query_failed', detail: sessErr.message }, { status: 500 })
  }

  const rows = (sessions ?? []) as Session[] & {
    ai_paused?: boolean
    ai_paused_by?: string | null
  }[]
  const hasMore = rows.length > limit
  const pageSessions = (hasMore ? rows.slice(0, limit) : rows) as Array<
    Session & { ai_paused: boolean; ai_paused_by: string | null }
  >

  if (pageSessions.length === 0) {
    const empty: ConversationsListResponse = {
      conversations: [],
      next_cursor: null,
      has_more: false,
    }
    return NextResponse.json({ ...empty, _warnings: ['last_read_at not in schema'] })
  }

  const sessionIds = pageSessions.map((s) => s.id)
  const clientIds = Array.from(new Set(pageSessions.map((s) => s.client_id)))

  // Carrega clients, channel_configs do workspace e last_message em paralelo
  const [clientsRes, channelsRes, lastMsgsRes] = await Promise.all([
    svc.from('clients').select('*').in('id', clientIds).eq('workspace_id', workspace_id),
    svc
      .from('channel_configs')
      .select('id, channel_type, phone_number, ai_enabled')
      .eq('workspace_id', workspace_id),
    Promise.all(
      sessionIds.map((sid) =>
        svc
          .from('messages')
          .select('id, role, content, created_at, source')
          .eq('session_id', sid)
          .eq('workspace_id', workspace_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data }) => ({ session_id: sid, message: data }))
      )
    ),
  ])

  if (clientsRes.error) {
    return NextResponse.json(
      { error: 'clients_query_failed', detail: clientsRes.error.message },
      { status: 500 },
    )
  }
  if (channelsRes.error) {
    return NextResponse.json(
      { error: 'channels_query_failed', detail: channelsRes.error.message },
      { status: 500 },
    )
  }

  const clientsById = new Map<string, Client>()
  for (const c of (clientsRes.data ?? []) as Client[]) clientsById.set(c.id, c)

  const channels = (channelsRes.data ?? []) as ChannelConfigRow[]
  const channelByType = new Map<string, ChannelConfigRow>()
  for (const ch of channels) channelByType.set(ch.channel_type, ch)

  const lastMsgBySession = new Map<
    string,
    | (Pick<Message, 'id' | 'role' | 'content' | 'created_at'> & {
        source?: 'ai' | 'human' | null
      })
    | null
  >()
  for (const r of lastMsgsRes) {
    lastMsgBySession.set(
      r.session_id,
      (r.message as
        | (Pick<Message, 'id' | 'role' | 'content' | 'created_at'> & {
            source?: 'ai' | 'human' | null
          })
        | null) ?? null,
    )
  }

  const conversations: ConversationWithMeta[] = pageSessions
    .map((s) => {
      const client = clientsById.get(s.client_id)
      if (!client) return null
      // Resolve channel pelo tipo (sessions.channel é text 'ycloud'|'zapi'|'evolution')
      const channelCfg = channelByType.get(s.channel) ?? null
      const channel = channelCfg
        ? {
            id: channelCfg.id,
            channel_type: channelCfg.channel_type,
            phone_number: channelCfg.phone_number,
          }
        : { id: '', channel_type: s.channel, phone_number: '' }

      // Prioridade: conversation > channel > global
      let aiStatus: AIStatus = 'active'
      if (s.ai_paused) aiStatus = 'paused_conversation'
      else if (channelCfg && channelCfg.ai_enabled === false) aiStatus = 'paused_channel'
      else if (!aiGlobalEnabled) aiStatus = 'paused_global'

      const conv: ConversationWithMeta = {
        session: s as Session,
        client,
        channel,
        last_message: lastMsgBySession.get(s.id) ?? null,
        unread_count: 0, // last_read_at not in schema
        ai_status: aiStatus,
        ai_paused: !!s.ai_paused,
        ai_paused_by: s.ai_paused_by ?? null,
        status: s.status as SessionStatus,
      }
      return conv
    })
    .filter((c): c is ConversationWithMeta => c !== null)

  const last = pageSessions[pageSessions.length - 1]
  const next_cursor = hasMore && last ? last.updated_at : null

  const payload: ConversationsListResponse & { _warnings?: string[] } = {
    conversations,
    next_cursor,
    has_more: hasMore,
    _warnings: ['last_read_at not in schema'],
  }
  return NextResponse.json(payload)
}
