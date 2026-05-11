// lib/db/messages.ts — Histórico de mensagens (com node_id + trace_id — gaps #7 e #19)
// TODO: substituir tipos inline por import from '@/types/message' após merge da T02.

import { supabase } from './client'

interface Message {
  id: string
  session_id: string
  workspace_id: string
  client_id: string | null
  role: string
  content: string
  media_type: string
  media_url: string | null
  media_transcription: string | null
  node_id: string | null
  trace_id: string | null
  tokens_used: number | null
  llm_model: string | null
  channel_message_id: string | null
  created_at: string
}

interface SaveMessageOpts {
  workspace_id: string
  client_id?: string | null
  node_id?: string | null
  trace_id?: string | null
  media_type?: string
  media_url?: string | null
  media_transcription?: string | null
  channel_message_id?: string | null
  llm_model?: string | null
  tokens_used?: number | null
}

export async function saveMessage(
  session_id: string,
  role: 'user' | 'assistant',
  content: string,
  opts: SaveMessageOpts,
): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      session_id,
      workspace_id: opts.workspace_id,
      client_id: opts.client_id ?? null,
      role,
      content,
      media_type: opts.media_type ?? 'text',
      media_url: opts.media_url ?? null,
      media_transcription: opts.media_transcription ?? null,
      node_id: opts.node_id ?? null,
      trace_id: opts.trace_id ?? null,
      llm_model: opts.llm_model ?? null,
      tokens_used: opts.tokens_used ?? null,
      channel_message_id: opts.channel_message_id ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(`saveMessage(session=${session_id}) failed: ${error.message}`)
  return data as Message
}

export async function getHistory(
  session_id: string,
  limit: number | null = 20,
): Promise<Message[]> {
  let q = supabase
    .from('messages')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: true })
  if (limit !== null) q = q.limit(limit)
  const { data, error } = await q
  if (error) throw new Error(`getHistory(${session_id}) failed: ${error.message}`)
  return (data as Message[]) ?? []
}
