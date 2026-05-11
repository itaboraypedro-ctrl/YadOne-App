// app/api/webhooks/evolution/route.ts — webhook Evolution (POST)
// Valida signature antes de processar.
// Idempotência por channel_message_id (T30). Dispara orchestrator T17 fire-and-forget.

import { NextRequest, NextResponse } from 'next/server'
import { resolveChannelByPhoneNumber } from '@/lib/channels/factory'
import { processWebhookOnce } from '@/lib/idempotency/middleware'
import { filterInput } from '@/lib/guardrails/content-filter-input'
import { processMessage } from '@/lib/engine/orchestrator'
import { generateTraceId } from '@/lib/engine/orchestrator-helpers'

interface EvolutionWebhookPayload {
  instance?: string
  data?: { owner?: string }
  owner?: string
}

function extractTargetPhone(payload: unknown): string | null {
  const p = payload as EvolutionWebhookPayload
  // Evolution geralmente expõe `owner` (jid do número conectado) — fallback para data.owner
  const owner = p?.owner ?? p?.data?.owner
  if (!owner) return null
  // jid pode vir como `5511999999999@s.whatsapp.net` — normalizar para só o número com prefixo `+`
  const number = owner.split('@')[0]
  if (!number) return null
  return number.startsWith('+') ? number : `+${number}`
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const headers = Object.fromEntries(req.headers.entries())

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const targetPhone = extractTargetPhone(payload)
  if (!targetPhone) {
    return NextResponse.json({ error: 'cannot identify workspace' }, { status: 400 })
  }

  let resolution
  try {
    resolution = await resolveChannelByPhoneNumber(targetPhone)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }

  if (!resolution.adapter.validateSignature(headers, rawBody)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  const inbound = resolution.adapter.parseInbound(payload)
  const workspace_id = resolution.workspace_id

  const outcome = await processWebhookOnce(
    'evolution',
    inbound.channel_message_id,
    workspace_id,
    async () => {
      const filter = await filterInput(inbound.content)
      if (!filter.safe) {
        return { processed: true, filtered: true }
      }

      const trace_id = generateTraceId()
      void processMessage({
        workspace_id,
        channel: 'whatsapp_evolution',
        inbound,
      }).catch(() => {
        // processMessage tem try/catch interno
      })

      return { processed: true, queued: true, trace_id }
    },
  )
  return NextResponse.json(outcome.body, { status: outcome.status })
}
