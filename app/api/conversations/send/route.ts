// app/api/conversations/send/route.ts — POST envio manual (humano).
// SPEC_FRONTEND_CONVERSATIONS.md §7.

import { NextRequest, NextResponse } from 'next/server'
import { getApiAuthContext } from '@/lib/auth/api-context'
import { getChannelAdapter } from '@/lib/channels/factory'
import type { Session } from '@/types/session'
import type { Client } from '@/types/client'

export const dynamic = 'force-dynamic'

interface SendBody {
  conversation_id?: string
  content?: string
  attachments?: Array<{ url: string; type: string; name: string; size: number }>
}

export async function POST(req: NextRequest) {
  const auth = await getApiAuthContext()
  if (!auth.ok) return auth.response
  const { workspace_id, user, svc } = auth.ctx

  let body: SendBody
  try {
    body = (await req.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const conversation_id = typeof body.conversation_id === 'string' ? body.conversation_id : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!conversation_id) {
    return NextResponse.json({ error: 'conversation_id_required' }, { status: 400 })
  }
  if (!content && (!body.attachments || body.attachments.length === 0)) {
    return NextResponse.json({ error: 'content_or_attachment_required' }, { status: 400 })
  }

  // Validar attachments (URL pertence ao workspace)
  if (Array.isArray(body.attachments)) {
    for (const att of body.attachments) {
      if (
        !att ||
        typeof att.url !== 'string' ||
        !att.url.includes(`/${workspace_id}/`)
      ) {
        return NextResponse.json({ error: 'invalid_attachment' }, { status: 400 })
      }
    }
  }

  // Carregar session com ownership
  const { data: sessRow, error: sErr } = await svc
    .from('sessions')
    .select('*')
    .eq('id', conversation_id)
    .maybeSingle()
  if (sErr) return NextResponse.json({ error: 'sessions_query_failed' }, { status: 500 })
  const session = sessRow as (Session & { ai_paused: boolean }) | null
  if (!session || session.workspace_id !== workspace_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Spec §7: humano só envia com IA pausada
  if (!session.ai_paused) {
    return NextResponse.json({ error: 'ai_must_be_paused' }, { status: 409 })
  }

  // Carregar phone do client para envio via canal
  const { data: clientRow } = await svc
    .from('clients')
    .select('id, phone, workspace_id')
    .eq('id', session.client_id)
    .maybeSingle()
  const client = clientRow as Pick<Client, 'id' | 'phone' | 'workspace_id'> | null

  // Persistir mensagem (role=assistant, source=human, sent_by=user)
  const firstAttachment = body.attachments && body.attachments.length > 0 ? body.attachments[0] : null
  const mediaType = firstAttachment
    ? firstAttachment.type.startsWith('image/')
      ? 'image'
      : firstAttachment.type.startsWith('audio/')
        ? 'audio'
        : 'document'
    : 'text'

  const { data: insertedMsg, error: mErr } = await svc
    .from('messages')
    .insert({
      session_id: session.id,
      workspace_id,
      client_id: session.client_id,
      role: 'assistant',
      content,
      media_type: mediaType,
      media_url: firstAttachment ? firstAttachment.url : null,
      source: 'human',
      sent_by: user.id,
    })
    .select('*')
    .single()

  if (mErr || !insertedMsg) {
    return NextResponse.json({ error: 'persist_failed', detail: mErr?.message }, { status: 500 })
  }

  // Atualiza updated_at da session
  await svc
    .from('sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', session.id)

  // Envio pelo canal
  const warnings: string[] = []
  if (client?.phone) {
    try {
      const adapter = await getChannelAdapter(workspace_id)
      await adapter.send(client.phone, {
        text: content,
        media_url: firstAttachment ? firstAttachment.url : undefined,
        media_type: firstAttachment
          ? mediaType === 'text'
            ? undefined
            : (mediaType as 'image' | 'audio' | 'document')
          : undefined,
      })
    } catch {
      warnings.push('channel_send_failed')
    }
  } else {
    warnings.push('client_phone_missing')
  }

  return NextResponse.json({
    message: insertedMsg,
    _warnings: warnings.length > 0 ? warnings : undefined,
  })
}
