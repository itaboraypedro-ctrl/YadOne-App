// lib/channels/ycloud.ts — Adapter para YCloud (WhatsApp Business API oficial)
// Spec seção 10. Signature: HMAC-SHA256 do raw body com webhook_secret, header `x-ycloud-signature`.

import crypto from 'node:crypto'
import {
  ChannelAdapter,
  ChannelCredentials,
  InboundMessage,
  MediaType,
  OutboundMessage,
  simulateTypingDelay,
  sleep,
} from './types'

const YCLOUD_BASE = 'https://api.ycloud.com/v2/whatsapp/messages'

interface YCloudInboundPayload {
  from?: string
  to?: string
  id?: string
  type?: string
  text?: { body?: string }
  image?: { link?: string; caption?: string }
  audio?: { link?: string }
  video?: { link?: string }
  document?: { link?: string; caption?: string }
  timestamp?: string
}

export class YCloudAdapter implements ChannelAdapter {
  readonly type = 'ycloud' as const
  private readonly api_key: string
  private readonly webhook_secret: string

  constructor(credentials: ChannelCredentials) {
    if (!credentials.api_key) throw new Error('[YCloud] api_key obrigatório')
    if (!credentials.webhook_secret) throw new Error('[YCloud] webhook_secret obrigatório')
    this.api_key = credentials.api_key
    this.webhook_secret = credentials.webhook_secret
  }

  async send(to: string, message: OutboundMessage): Promise<void> {
    if (message.typing_simulation !== false) {
      await sleep(message.typing_delay_ms ?? simulateTypingDelay(message.text))
    }

    const body = this.buildSendBody(to, message)
    const res = await fetch(YCLOUD_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.api_key,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`[YCloud] send failed ${res.status}: ${text}`)
    }
  }

  parseInbound(payload: unknown): InboundMessage {
    const p = payload as YCloudInboundPayload
    const id = p.id ?? `ycloud-${Date.now()}`
    const from = p.from ?? ''
    const timestamp = p.timestamp ?? new Date().toISOString()

    let media_type: MediaType = 'text'
    let media_url: string | undefined
    let content = ''

    if (p.text?.body) {
      content = p.text.body
    } else if (p.image?.link) {
      media_type = 'image'
      media_url = p.image.link
      content = p.image.caption ?? ''
    } else if (p.audio?.link) {
      media_type = 'audio'
      media_url = p.audio.link
    } else if (p.document?.link) {
      media_type = 'document'
      media_url = p.document.link
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
    const res = await fetch(url, {
      headers: { 'X-API-Key': this.api_key },
    })
    if (!res.ok) throw new Error(`[YCloud] downloadMedia failed ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  validateSignature(headers: Record<string, string>, rawBody: string): boolean {
    const provided = headers['x-ycloud-signature'] ?? headers['X-YCloud-Signature']
    if (!provided) return false
    const expected = crypto.createHmac('sha256', this.webhook_secret).update(rawBody).digest('hex')
    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(provided, 'utf8')
    if (a.length !== b.length) return false
    try {
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  private buildSendBody(to: string, message: OutboundMessage): Record<string, unknown> {
    if (message.media_url && message.media_type === 'image') {
      return {
        to,
        type: 'image',
        image: { link: message.media_url, caption: message.text },
      }
    }
    if (message.media_url && message.media_type === 'audio') {
      return { to, type: 'audio', audio: { link: message.media_url } }
    }
    if (message.media_url && message.media_type === 'document') {
      return {
        to,
        type: 'document',
        document: { link: message.media_url, caption: message.text },
      }
    }
    return { to, type: 'text', text: { body: message.text } }
  }
}
