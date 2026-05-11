// app/api/workspace/ai/route.ts — GET/PATCH IA global do workspace.
// SPEC_FRONTEND_CONVERSATIONS.md §6.
//
// SPEC §6: motor consulta workspace_agent_config.ai_enabled em runtime — F13.
// Retomar global NÃO retoma conversas pausadas individualmente — apenas atualizamos
// o flag e o orchestrator (F13) respeita a hierarquia (conversation > channel > global).

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import type { AIStatus, AIToggleResponse } from '@/lib/types/frontend'

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, svc } = auth.ctx

  const { data, error } = await svc
    .from('workspace_agent_config')
    .select('ai_enabled')
    .eq('workspace_id', workspace_id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'fetch_failed', detail: error.message },
      { status: 500 },
    )
  }

  const ai_enabled =
    data && typeof (data as { ai_enabled?: unknown }).ai_enabled === 'boolean'
      ? (data as { ai_enabled: boolean }).ai_enabled
      : true
  const status: AIStatus = ai_enabled ? 'active' : 'paused_global'
  const payload: AIToggleResponse = { ai_enabled, status }
  return NextResponse.json(payload)
}

interface Body {
  enabled?: unknown
}

export async function PATCH(req: NextRequest) {
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

  // SPEC §6 não restringe role — owner e agent podem alternar IA global.
  const { error } = await svc
    .from('workspace_agent_config')
    .update({ ai_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('workspace_id', workspace_id)

  if (error) {
    return NextResponse.json(
      { error: 'update_failed', detail: error.message },
      { status: 500 },
    )
  }

  const status: AIStatus = enabled ? 'active' : 'paused_global'
  const payload: AIToggleResponse = { ai_enabled: enabled, status }
  return NextResponse.json(payload)
}
