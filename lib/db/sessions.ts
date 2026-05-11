// lib/db/sessions.ts — Sessões de conversa
// flow_version fixado na criação (gap #11). objective_stack como JSONB array.
// TODO: substituir tipos inline por import from '@/types/session' após merge da T02.

import { supabase } from './client'

interface Session {
  id: string
  workspace_id: string
  client_id: string
  flow_id: string | null
  flow_version: number | null
  current_node_id: string | null
  channel: string
  channel_session_id: string | null
  status: string
  digression_state: string
  objective_stack: unknown[]
  collected_data: Record<string, unknown>
  completed_steps: string[]
  wait_until: string | null
  expires_at: string | null
  replan_count: number
  monitor_flags: unknown[]
  current_trace_id: string | null
  memory_processed: boolean
  created_at: string
  updated_at: string
}

interface SessionCreateInput {
  workspace_id: string
  client_id: string
  flow_id: string | null
  flow_version: number | null
  current_node_id: string | null
  channel: string
  channel_session_id?: string | null
  expires_at?: string | null
  current_trace_id?: string | null
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`getSession(${id}) failed: ${error.message}`)
  return (data as Session) ?? null
}

export async function getActiveSession(
  workspace_id: string,
  client_id: string,
  channel: string,
): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('client_id', client_id)
    .eq('channel', channel)
    .in('status', ['active', 'waiting'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getActiveSession failed: ${error.message}`)
  return (data as Session) ?? null
}

export async function createSession(input: SessionCreateInput): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      workspace_id: input.workspace_id,
      client_id: input.client_id,
      flow_id: input.flow_id,
      flow_version: input.flow_version,
      current_node_id: input.current_node_id,
      channel: input.channel,
      channel_session_id: input.channel_session_id ?? null,
      expires_at: input.expires_at ?? null,
      current_trace_id: input.current_trace_id ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(`createSession failed: ${error.message}`)
  return data as Session
}

export async function updateSession(
  id: string,
  partial: Partial<Session>,
): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .update({ ...partial, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(`updateSession(${id}) failed: ${error.message}`)
  return data as Session
}

export async function expireSession(id: string): Promise<void> {
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`expireSession(${id}) failed: ${error.message}`)
}

export async function incrementReplanCount(id: string): Promise<number> {
  // Read-modify-write — não atômico mas suficiente para MVP.
  // Se houver corrida, basta o último valor predominar (limite de 3 ainda é detectado).
  const session = await getSession(id)
  if (!session) throw new Error(`incrementReplanCount: session ${id} not found`)
  const next = (session.replan_count ?? 0) + 1
  const { error } = await supabase
    .from('sessions')
    .update({ replan_count: next, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`incrementReplanCount(${id}) failed: ${error.message}`)
  return next
}

export async function getReplanCount(id: string): Promise<number> {
  const { data, error } = await supabase
    .from('sessions')
    .select('replan_count')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getReplanCount(${id}) failed: ${error.message}`)
  return (data?.replan_count as number) ?? 0
}
