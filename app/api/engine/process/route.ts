// app/api/engine/process/route.ts — POST endpoint que dispara o orchestrator (T17).
//
// Resposta 202 imediata com `{ queued: true, trace_id, session_id? }` — o pipeline
// roda em background (Promise sem await). Usado por testes manuais e Bloco 10.
// Os webhooks dos 3 canais NÃO chamam este endpoint via HTTP — chamam
// `processMessage` diretamente (import). O endpoint existe como wrapper HTTP.
//
// Body: { workspace_id, channel, inbound: InboundMessage, synthetic?: boolean }

import { NextRequest, NextResponse } from 'next/server'
import { processMessage, type ProcessMessageInput } from '@/lib/engine/orchestrator'
import { generateTraceId } from '@/lib/engine/orchestrator-helpers'
import { getActiveSession } from '@/lib/db/sessions'
import { detectExistingClient } from '@/lib/unification/strategy'

interface ProcessRoutePayload {
  workspace_id?: string
  channel?: string
  inbound?: {
    from?: string
    content?: string
    media_type?: string
    media_url?: string
    timestamp?: string
    channel_message_id?: string
    raw_payload?: unknown
  }
  synthetic?: boolean
}

function isValidInbound(p: unknown): p is ProcessMessageInput['inbound'] {
  if (!p || typeof p !== 'object') return false
  const o = p as Record<string, unknown>
  if (typeof o.from !== 'string' || !o.from) return false
  if (typeof o.content !== 'string') return false
  if (typeof o.media_type !== 'string') return false
  if (typeof o.channel_message_id !== 'string' || !o.channel_message_id) return false
  return true
}

export async function POST(req: NextRequest) {
  let body: ProcessRoutePayload
  try {
    body = (await req.json()) as ProcessRoutePayload
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  if (!body.workspace_id) {
    return NextResponse.json({ error: 'missing workspace_id' }, { status: 400 })
  }
  if (!body.channel) {
    return NextResponse.json({ error: 'missing channel' }, { status: 400 })
  }
  if (!isValidInbound(body.inbound)) {
    return NextResponse.json({ error: 'invalid inbound' }, { status: 400 })
  }

  const trace_id = generateTraceId()

  // Tenta resolver session_id existente (para devolver no body) — best-effort.
  let session_id: string | null = null
  try {
    const existing_client = await detectExistingClient(
      body.workspace_id,
      body.inbound.from!,
    )
    if (existing_client) {
      const existing_session = await getActiveSession(
        body.workspace_id,
        existing_client.id,
        body.channel,
      )
      session_id = existing_session?.id ?? null
    }
  } catch {
    // best-effort apenas
  }

  const input: ProcessMessageInput = {
    workspace_id: body.workspace_id,
    channel: body.channel,
    inbound: {
      from: body.inbound.from!,
      content: body.inbound.content!,
      media_type: body.inbound.media_type as ProcessMessageInput['inbound']['media_type'],
      media_url: body.inbound.media_url,
      timestamp: body.inbound.timestamp ?? new Date().toISOString(),
      channel_message_id: body.inbound.channel_message_id!,
      raw_payload: body.inbound.raw_payload,
    },
    synthetic: body.synthetic === true,
  }

  // Fire-and-forget: não esperamos pelo resultado para não estourar o timeout.
  void processMessage(input).catch(() => {
    // processMessage já tem try/catch interno — este catch existe apenas para
    // satisfazer o linter (Promise não-tratada).
  })

  return NextResponse.json(
    { queued: true, trace_id, session_id },
    { status: 202 },
  )
}
