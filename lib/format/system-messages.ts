// lib/format/system-messages.ts — Helpers para mensagens de sistema (efêmeras).
// Usadas em F12 para feedback visual ao pausar/retomar IA na conversa.

import type { MessageWithMeta } from '@/lib/types/frontend'

let counter = 0

/**
 * Cria uma mensagem efêmera de sistema para feedback visual no chat.
 * NÃO persiste no banco — apenas adicionada ao state local via appendMessage.
 *
 * O schema atual (`types/message.ts`) só define role como 'user' | 'assistant',
 * mas MessageBubble (F10) tem branch defensivo para `role === 'system'`.
 * Forçamos via cast `as MessageWithMeta`.
 */
export function buildSystemMessage(args: {
  session_id: string
  workspace_id: string
  text: string
}): MessageWithMeta {
  counter += 1
  const now = new Date().toISOString()
  return {
    id: `system-${Date.now()}-${counter}`,
    session_id: args.session_id,
    workspace_id: args.workspace_id,
    client_id: null,
    // Cast deliberado: 'system' é variant client-side (MessageBubble suporta).
    role: 'system' as MessageWithMeta['role'],
    content: args.text,
    media_type: 'text',
    media_url: null,
    media_transcription: null,
    node_id: null,
    trace_id: null,
    tokens_used: null,
    llm_model: null,
    channel_message_id: null,
    created_at: now,
    source: null,
    sent_by: null,
    delivery_status: null,
  } as MessageWithMeta
}

export function aiPausedText(actor: string): string {
  return `IA pausada por ${actor}`
}

export function aiResumedText(actor: string): string {
  return `IA retomada por ${actor}`
}
