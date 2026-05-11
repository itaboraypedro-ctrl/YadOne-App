// lib/db/crm-events.ts — Eventos para o CRM (com trace_id — gap #19)
// TODO: substituir tipos inline por import from '@/types/crm' após merge da T02.

import { supabase } from './client'

interface CRMEvent {
  id: string
  event_type: string
  workspace_id: string
  client_id: string | null
  session_id: string | null
  payload: Record<string, unknown>
  processed: boolean
  trace_id: string | null
  created_at: string
}

interface EventContext {
  workspace_id: string
  client_id?: string | null
  session_id?: string | null
  trace_id?: string | null
}

export async function emitEvent(
  event_type: string,
  payload: Record<string, unknown>,
  ctx: EventContext,
): Promise<CRMEvent> {
  const { data, error } = await supabase
    .from('crm_events')
    .insert({
      event_type,
      workspace_id: ctx.workspace_id,
      client_id: ctx.client_id ?? null,
      session_id: ctx.session_id ?? null,
      payload,
      trace_id: ctx.trace_id ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(`emitEvent(${event_type}) failed: ${error.message}`)
  return data as CRMEvent
}

export async function getUnprocessedEvents(
  workspace_id: string,
  limit: number = 100,
): Promise<CRMEvent[]> {
  const { data, error } = await supabase
    .from('crm_events')
    .select('*')
    .eq('workspace_id', workspace_id)
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`getUnprocessedEvents failed: ${error.message}`)
  return (data as CRMEvent[]) ?? []
}

export async function markProcessed(event_id: string): Promise<void> {
  const { error } = await supabase
    .from('crm_events')
    .update({ processed: true })
    .eq('id', event_id)
  if (error) throw new Error(`markProcessed(${event_id}) failed: ${error.message}`)
}
