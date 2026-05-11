// lib/channels/types.ts — Interfaces compartilhadas dos canais + utilitários
// TODO: substituir interfaces inline por import from '@/types/channel' e '@/types/message'
// após merge da T02. Mantemos cópias locais por enquanto para evitar acoplamento.

export type ChannelType = 'ycloud' | 'zapi' | 'evolution'

export type MediaType = 'text' | 'audio' | 'image' | 'document'

export interface InboundMessage {
  from: string
  content: string
  media_type: MediaType
  media_url?: string
  timestamp: string // ISO 8601
  channel_message_id: string
  raw_payload?: unknown
}

export interface OutboundMessage {
  text: string
  typing_simulation?: boolean
  typing_delay_ms?: number
  media_url?: string
  media_type?: 'image' | 'audio' | 'document'
}

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

/** ≈50 chars/seg, clamp [1000, 3000] ms para simulação de digitação. */
export function simulateTypingDelay(text: string): number {
  const charsPerSecond = 50
  const ms = (text.length / charsPerSecond) * 1000
  return Math.max(1000, Math.min(3000, Math.round(ms)))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Comparação constant-time de strings. Retorna false se tamanhos diferentes. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}
