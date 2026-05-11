// types/message.ts — mensagens inbound/outbound e histórico persistido

export type MediaType = 'text' | 'audio' | 'image' | 'document'
export type MessageRole = 'user' | 'assistant'

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

export interface Message {
  id: string
  session_id: string
  workspace_id: string
  client_id: string | null
  role: MessageRole
  content: string
  media_type: MediaType
  media_url: string | null
  media_transcription: string | null
  node_id: string | null
  trace_id: string | null
  tokens_used: number | null
  llm_model: string | null
  channel_message_id: string | null
  created_at: string // ISO 8601
}
