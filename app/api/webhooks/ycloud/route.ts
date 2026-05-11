// app/api/webhooks/ycloud/route.ts — webhook YCloud (POST)
// Valida signature antes de processar. Retorna 200 imediato após enfileirar.
// Idempotência por channel_message_id (T30). Dispara orchestrator T17 fire-and-forget.

import { NextRequest, NextResponse } from 'next/server'
import { resolveChannelByPhoneNumber } from '@/lib/channels/factory'
import { processWebhookOnce } from '@/lib/idempotency/middleware'
import { filterInput } from '@/lib/guardrails/content-filter-input'
import { processMessage } from '@/lib/engine/orchestrator'
import { generateTraceId } from '@/lib/engine/orchestrator-helpers'

interface YCloudWebhookPayload {
  to?: string
  // outros campos parseados pelo adapter
}

function extractTargetPhone(payload: unknown): string | null {
  const p = payload as YCloudWebhookPayload
  return p?.to ?? null
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
    'ycloud',
    inbound.channel_message_id,
    workspace_id,
    async () => {
      // T06 — filtro de input (regex + classificador LLM)
      const filter = await filterInput(inbound.content)
      if (!filter.safe) {
        return { processed: true, filtered: true }
      }

      const trace_id = generateTraceId()
      // Fire-and-forget: orchestrator processa em background, webhook retorna imediato.
      void processMessage({
        workspace_id,
        channel: 'whatsapp_ycloud',
        inbound,
      }).catch(() => {
        // processMessage tem try/catch interno; catch aqui apenas evita Promise não-tratada.
      })

      return { processed: true, queued: true, trace_id }
    },
  )
  return NextResponse.json(outcome.body, { status: outcome.status })
}
