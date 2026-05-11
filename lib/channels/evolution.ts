// lib/channels/evolution.ts — Adapter para Evolution API (open-source, self-hosted)
// Signature: header `apikey` deve igualar credentials.api_key (constant-time).

import {
  ChannelAdapter,
  ChannelCredentials,
  constantTimeEqual,
  InboundMessage,
  MediaType,
  OutboundMessage,
  simulateTypingDelay,
  sleep,
} from './types'

interface EvolutionInboundPayload {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean }
  message?: {
    conversation?: string
    extendedTextMessage?: { text?: string }
    imageMessage?: { url?: string; caption?: string }
    audioMessage?: { url?: string }
    documentMessage?: { url?: string; caption?: string; fileName?: string }
  }
  messageTimestamp?: number
  pushName?: string
  instance?: string
}

export class EvolutionAdapter implements ChannelAdapter {
  readonly type = 'evolution' as const
  private readonly base_url: string
  private readonly instance_id: string
  private readonly api_key: string

  constructor(credentials: ChannelCredentials) {
    if (!credentials.base_url) throw new Error('[Evolution] base_url obrigatório')
    if (!credentials.instance_id) throw new Error('[Evolution] instance_id obrigatório')
    if (!credentials.api_key) throw new Error('[Evolution] api_key obrigatório')
    this.base_url = credentials.base_url.replace(/\/$/, '')
    this.instance_id = credentials.instance_id
    this.api_key = credentials.api_key
  }

  async send(to: string, message: OutboundMessage): Promise<void> {
    if (message.typing_simulation !== false) {
      await sleep(message.typing_delay_ms ?? simulateTypingDelay(message.text))
    }

    const { path, body } = this.buildSendRequest(to, message)
    const url = `${this.base_url}${path}/${this.instance_id}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.api_key,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`[Evolution] send failed ${res.status}: ${text}`)
    }
  }

  parseInbound(payload: unknown): InboundMessage {
    const p = payload as EvolutionInboundPayload
    const id = p.key?.id ?? `evo-${Date.now()}`
    // remoteJid no formato `5511999999999@s.whatsapp.net` — extrair só o número
    const remoteJid = p.key?.remoteJid ?? ''
    const from = remoteJid.split('@')[0] ?? remoteJid
    const timestamp = p.messageTimestamp
      ? new Date(p.messageTimestamp * 1000).toISOString()
      : new Date().toISOString()

    let media_type: MediaType = 'text'
    let media_url: string | undefined
    let content = ''

    const m = p.message
    if (m?.conversation) {
      content = m.conversation
    } else if (m?.extendedTextMessage?.text) {
      content = m.extendedTextMessage.text
    } else if (m?.imageMessage?.url) {
      media_type = 'image'
      media_url = m.imageMessage.url
      content = m.imageMessage.caption ?? ''
    } else if (m?.audioMessage?.url) {
      media_type = 'audio'
      media_url = m.audioMessage.url
    } else if (m?.documentMessage?.url) {
      media_type = 'document'
      media_url = m.documentMessage.url
      content = m.documentMessage.caption ?? m.documentMessage.fileName ?? ''
    }

    return {
      from,
      content,
      media_type,
      media_url,
      timestamp,
      channel_message_id: id,
      raw_payload: payload,
    }
  }

  async downloadMedia(url: string): Promise<Buffer> {
    const res = await fetch(url, { headers: { apikey: this.api_key } })
    if (!res.ok) throw new Error(`[Evolution] downloadMedia failed ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  validateSignature(headers: Record<string, string>, _rawBody: string): boolean {
    const provided = headers['apikey'] ?? headers['Apikey']
    if (!provided) return false
    return constantTimeEqual(provided, this.api_key)
  }

  private buildSendRequest(
    to: string,
    message: OutboundMessage,
  ): { path: string; body: Record<string, unknown> } {
    if (message.media_url && message.media_type === 'image') {
      return {
        path: '/message/sendImage',
        body: { number: to, mediaMessage: { mediatype: 'image', media: message.media_url, caption: message.text } },
      }
    }
    if (message.media_url && message.media_type === 'audio') {
      return {
        path: '/message/sendAudio',
        body: { number: to, audioMessage: { audio: message.media_url } },
      }
    }
    if (message.media_url && message.media_type === 'document') {
      return {
        path: '/message/sendDocument',
        body: {
          number: to,
          mediaMessage: { mediatype: 'document', media: message.media_url, caption: message.text },
        },
      }
    }
    return { path: '/message/sendText', body: { number: to, textMessage: { text: message.text } } }
  }
}
