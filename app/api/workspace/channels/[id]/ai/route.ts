// app/api/workspace/channels/[id]/ai/route.ts — PATCH IA por canal.
// SPEC_FRONTEND_CONVERSATIONS.md §6.

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type { AIStatus, AIToggleResponse } from '@/lib/types/frontend'

export const dynamic = 'force-dynamic'

interface Body {
  enabled?: unknown
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, svc } = auth.ctx

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled_required_boolean' }, { status: 400 })
  }
  const enabled = body.enabled

  // Ownership check do channel_config
  const { data: ch } = await svc
    .from('channel_configs')
    .select('id, workspace_id')
    .eq('id', id)
    .maybeSingle()
  if (!ch || (ch as { workspace_id: string }).workspace_id !== workspace_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { error } = await svc
    .from('channel_configs')
    .update({ ai_enabled: enabled })
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { error: 'update_failed', detail: error.message },
      { status: 500 },
    )
  }

  // Status efetivo no contexto do canal: se enabled true e global true => active, senão paused_*
  const { data: agentCfgRes } = await svc
    .from('workspace_agent_config')
    .select('ai_enabled')
    .eq('workspace_id', workspace_id)
    .maybeSingle()
  const globalEnabled =
    agentCfgRes && typeof (agentCfgRes as { ai_enabled?: unknown }).ai_enabled === 'boolean'
      ? ((agentCfgRes as { ai_enabled: boolean }).ai_enabled)
      : true

  let status: AIStatus = 'active'
  if (!enabled) status = 'paused_channel'
  else if (!globalEnabled) status = 'paused_global'

  const payload: AIToggleResponse = { ai_enabled: enabled, status }
  return NextResponse.json(payload)
}
