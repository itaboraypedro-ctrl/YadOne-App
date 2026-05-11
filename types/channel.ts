// types/channel.ts — Adapters de canais de mensageria (YCloud, ZAPI, Evolution)

import type { InboundMessage, OutboundMessage } from './message'

export type ChannelType = 'ycloud' | 'zapi' | 'evolution'

export interface ChannelCredentials {
  api_key?: string
  webhook_secret?: string
  instance_id?: string
  token?: string
  client_token?: string
  base_url?: string
}

export interface ChannelAdapter {
  readonly type: ChannelType
  send(to: string, message: OutboundMessage): Promise<void>
  parseInbound(payload: unknown): InboundMessage
  downloadMedia(url: string): Promise<Buffer>
  validateSignature(headers: Record<string, string>, rawBody: string): boolean
}

export interface ChannelConfig {
  id: string
  workspace_id: string
  channel_type: ChannelType
  credentials: ChannelCredentials
  phone_number: string
  is_active: boolean
  created_at: string // ISO 8601
}
