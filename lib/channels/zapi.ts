// lib/channels/zapi.ts — Adapter para ZAPI (WhatsApp não-oficial)
// Signature: header `Client-Token` deve igualar credentials.client_token (constant-time).

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

const ZAPI_BASE = 'https://api.z-api.io/instances'

interface ZAPIInboundPayload {
  phone?: string
  messageId?: string
  fromMe?: boolean
  momment?: number
  type?: string
  text?: { message?: string }
  image?: { imageUrl?: string; caption?: string }
  audio?: { audioUrl?: string }
  document?: { documentUrl?: string; caption?: string }
}

export class ZAPIAdapter implements ChannelAdapter {
  readonly type = 'zapi' as const
  private readonly instance_id: string
  private readonly token: string
  private readonly client_token: string

  constructor(credentials: ChannelCredentials) {
    if (!credentials.instance_id) throw new Error('[ZAPI] instance_id obrigatório')
    if (!credentials.token) throw new Error('[ZAPI] token obrigatório')
    if (!credentials.client_token) throw new Error('[ZAPI] client_token obrigatório')
    this.instance_id = credentials.instance_id
    this.token = credentials.token
    this.client_token = credentials.client_token
  }

  async send(to: string, message: OutboundMessage): Promise<void> {
    if (message.typing_simulation !== false) {
      await sleep(message.typing_delay_ms ?? simulateTypingDelay(message.text))
    }

    const { url, body } = this.buildSendRequest(to, message)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': this.client_token,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`[ZAPI] send failed ${res.status}: ${text}`)
    }
  }

  parseInbound(payload: unknown): InboundMessage {
    const p = payload as ZAPIInboundPayload
    const id = p.messageId ?? `zapi-${Date.now()}`
    const from = p.phone ?? ''
    const timestamp = p.momment
      ? new Date(p.momment * 1000).toISOString()
      : new Date().toISOString()

    let media_type: MediaType = 'text'
    let media_url: string | undefined
    let content = ''

    if (p.text?.message) {
      content = p.text.message
    } else if (p.image?.imageUrl) {
      media_type = 'image'
      media_url = p.image.imageUrl
      content = p.image.caption ?? ''
    } else if (p.audio?.audioUrl) {
      media_type = 'audio'
      media_url = p.audio.audioUrl
    } else if (p.document?.documentUrl) {
      media_type = 'document'
      media_url = p.document.documentUrl
      content = p.document.caption ?? ''
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
    const res = await fetch(url)
    if (!res.ok) throw new Error(`[ZAPI] downloadMedia failed ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  validateSignature(headers: Record<string, string>, _rawBody: string): boolean {
    const provided = headers['client-token'] ?? headers['Client-Token']
    if (!provided) return false
    return constantTimeEqual(provided, this.client_token)
  }

  private buildSendRequest(
    to: string,
    message: OutboundMessage,
  ): { url: string; body: Record<string, unknown> } {
    const base = `${ZAPI_BASE}/${this.instance_id}/token/${this.token}`
    if (message.media_url && message.media_type === 'image') {
      return { url: `${base}/send-image`, body: { phone: to, image: message.media_url, caption: message.text } }
    }
    if (message.media_url && message.media_type === 'audio') {
      return { url: `${base}/send-audio`, body: { phone: to, audio: message.media_url } }
    }
    if (message.media_url && message.media_type === 'document') {
      return {
        url: `${base}/send-document`,
        body: { phone: to, document: message.media_url, caption: message.text },
      }
    }
    return { url: `${base}/send-text`, body: { phone: to, message: message.text } }
  }
}
