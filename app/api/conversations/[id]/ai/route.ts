// app/api/conversations/[id]/ai/route.ts — PATCH controle IA por conversa.
// SPEC_FRONTEND_CONVERSATIONS.md §6.

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type { AIStatus, AIToggleResponse } from '@/lib/types/frontend'
import type { Session } from '@/types/session'

export const dynamic = 'force-dynamic'

interface Body {
  paused?: unknown
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, user, svc } = auth.ctx

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (typeof body.paused !== 'boolean') {
    return NextResponse.json({ error: 'paused_required_boolean' }, { status: 400 })
  }
  const paused = body.paused

  // Ownership check
  const { data: sessRow } = await svc
    .from('sessions')
    .select('id, workspace_id, channel')
    .eq('id', id)
    .maybeSingle()
  if (!sessRow || (sessRow as Pick<Session, 'workspace_id'>).workspace_id !== workspace_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const { error } = await svc
    .from('sessions')
    .update({
      ai_paused: paused,
      ai_paused_by: paused ? user.id : null,
      ai_paused_at: paused ? now : null,
      updated_at: now,
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 })
  }

  // Resolve ai_status efetivo (precedence)
  const channel = (sessRow as { channel: string }).channel
  const [chCfgRes, agentCfgRes] = await Promise.all([
    svc
      .from('channel_configs')
      .select('ai_enabled')
      .eq('workspace_id', workspace_id)
      .eq('channel_type', channel)
      .maybeSingle(),
    svc
      .from('workspace_agent_config')
      .select('ai_enabled')
      .eq('workspace_id', workspace_id)
      .maybeSingle(),
  ])
  const channelEnabled =
    chCfgRes.data && typeof (chCfgRes.data as { ai_enabled?: unknown }).ai_enabled === 'boolean'
      ? ((chCfgRes.data as { ai_enabled: boolean }).ai_enabled)
      : true
  const globalEnabled =
    agentCfgRes.data && typeof (agentCfgRes.data as { ai_enabled?: unknown }).ai_enabled === 'boolean'
      ? ((agentCfgRes.data as { ai_enabled: boolean }).ai_enabled)
      : true

  let status: AIStatus = 'active'
  if (paused) status = 'paused_conversation'
  else if (!channelEnabled) status = 'paused_channel'
  else if (!globalEnabled) status = 'paused_global'

  const payload: AIToggleResponse = { ai_paused: paused, status }
  return NextResponse.json(payload)
}
