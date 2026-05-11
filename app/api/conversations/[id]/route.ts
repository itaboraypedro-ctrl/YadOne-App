// app/api/conversations/[id]/route.ts — GET detalhe de uma conversa.
// SPEC_FRONTEND_CONVERSATIONS.md §9.2.

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type {
  AIStatus,
  ConversationWithMeta,
} from '@/lib/types/frontend'
import type { Session, SessionStatus } from '@/types/session'
import type { Client } from '@/types/client'
import type { Message } from '@/types/message'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, svc } = auth.ctx

  const { data: session, error: sErr } = await svc
    .from('sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (sErr) {
    return NextResponse.json({ error: 'sessions_query_failed', detail: sErr.message }, { status: 500 })
  }
  if (!session || (session as Session).workspace_id !== workspace_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const s = session as Session & { ai_paused: boolean; ai_paused_by: string | null }

  const [clientRes, channelsRes, lastMsgRes, agentCfgRes] = await Promise.all([
    svc.from('clients').select('*').eq('id', s.client_id).eq('workspace_id', workspace_id).maybeSingle(),
    svc
      .from('channel_configs')
      .select('id, channel_type, phone_number, ai_enabled')
      .eq('workspace_id', workspace_id)
      .eq('channel_type', s.channel)
      .maybeSingle(),
    svc
      .from('messages')
      .select('id, role, content, created_at, source')
      .eq('session_id', s.id)
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc
      .from('workspace_agent_config')
      .select('ai_enabled')
      .eq('workspace_id', workspace_id)
      .maybeSingle(),
  ])

  if (clientRes.error || !clientRes.data) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 })
  }
  const client = clientRes.data as Client

  const channelCfg = channelsRes.data as
    | { id: string; channel_type: string; phone_number: string; ai_enabled: boolean }
    | null

  const aiGlobalEnabled =
    agentCfgRes.data && typeof (agentCfgRes.data as { ai_enabled?: unknown }).ai_enabled === 'boolean'
      ? ((agentCfgRes.data as { ai_enabled: boolean }).ai_enabled)
      : true

  let aiStatus: AIStatus = 'active'
  if (s.ai_paused) aiStatus = 'paused_conversation'
  else if (channelCfg && channelCfg.ai_enabled === false) aiStatus = 'paused_channel'
  else if (!aiGlobalEnabled) aiStatus = 'paused_global'

  const payload: ConversationWithMeta & { _warnings?: string[] } = {
    session: s as Session,
    client,
    channel: channelCfg
      ? { id: channelCfg.id, channel_type: channelCfg.channel_type, phone_number: channelCfg.phone_number }
      : { id: '', channel_type: s.channel, phone_number: '' },
    last_message:
      (lastMsgRes.data as
        | (Pick<Message, 'id' | 'role' | 'content' | 'created_at'> & {
            source?: 'ai' | 'human' | null
          })
        | null) ?? null,
    unread_count: 0,
    ai_status: aiStatus,
    ai_paused: !!s.ai_paused,
    ai_paused_by: s.ai_paused_by ?? null,
    status: s.status as SessionStatus,
    _warnings: ['last_read_at not in schema'],
  }
  return NextResponse.json(payload)
}
