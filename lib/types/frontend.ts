// lib/types/frontend.ts — Tipos específicos do frontend de Conversas (Módulo 1).

import type { Session, SessionStatus } from '@/types/session'
import type { Message } from '@/types/message'
import type { Client } from '@/types/client'

export type AIStatus =
  | 'active'
  | 'paused_global'
  | 'paused_channel'
  | 'paused_conversation'

export interface ChannelStatus {
  id: string
  channel_type: string
  phone_number: string
  ai_enabled: boolean
  active_sessions_count: number
}

export interface ConversationWithMeta {
  session: Session
  client: Client
  channel: {
    id: string
    channel_type: string
    phone_number: string
  }
  last_message: Pick<Message, 'id' | 'role' | 'content' | 'created_at'> & {
    source?: 'ai' | 'human' | null
  } | null
  unread_count: number
  ai_status: AIStatus
  ai_paused: boolean
  ai_paused_by: string | null
  status: SessionStatus
}

export interface MessageWithMeta extends Message {
  source: 'ai' | 'human' | null
  sent_by: string | null
  /** 'sent' | 'delivered' | 'read' — derivado de tabelas auxiliares; null se inbound */
  delivery_status?: 'sent' | 'delivered' | 'read' | null
}

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read'

export interface CurrentUser {
  user_id: string
  email: string
  workspace_id: string
  workspace_name: string
  role: 'owner' | 'professional'
}

export interface ConversationsListResponse {
  conversations: ConversationWithMeta[]
  next_cursor: string | null
  has_more: boolean
}

export interface MessagesListResponse {
  messages: MessageWithMeta[]
  next_cursor: string | null
  has_more: boolean
}

export interface SendMessageInput {
  conversation_id: string
  content: string
  attachments?: Array<{ url: string; type: string; name: string; size: number }>
}

export interface AIToggleResponse {
  ai_paused?: boolean
  ai_enabled?: boolean
  status: AIStatus
}
