// app/api/workspace/channels/route.ts — GET lista de canais ativos do workspace.
// SPEC_FRONTEND_CONVERSATIONS.md §3.2 — alimenta AIControlChannel (toggle por canal).

import { NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type { ChannelStatus } from '@/lib/types/frontend'

export const dynamic = 'force-dynamic'

interface ChannelRow {
  id: string
  channel_type: string
  phone_number: string | null
  ai_enabled: boolean | null
  is_active: boolean | null
}

export async function GET() {
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, svc } = auth.ctx

  const { data: channels, error } = await svc
    .from('channel_configs')
    .select('id, channel_type, phone_number, ai_enabled, is_active')
    .eq('workspace_id', workspace_id)
    .eq('is_active', true)

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', detail: error.message },
      { status: 500 },
    )
  }

  const rows = (channels ?? []) as ChannelRow[]

  // Conta sessões ativas por canal em paralelo.
  const enriched: ChannelStatus[] = await Promise.all(
    rows.map(async (c) => {
      const { count } = await svc
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace_id)
        .eq('channel', c.channel_type)
        .eq('status', 'active')
      return {
        id: c.id,
        channel_type: c.channel_type,
        phone_number: c.phone_number ?? '',
        ai_enabled: c.ai_enabled ?? true,
        active_sessions_count: count ?? 0,
      }
    }),
  )

  return NextResponse.json({ channels: enriched })
}
