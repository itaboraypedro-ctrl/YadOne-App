// lib/db/followup-timers.ts — Timers de followup (Job 1)
// TODO: substituir tipos inline após merge da T02 (não há tipo dedicado em /types/, declarar local).

import { supabase } from './client'

export interface FollowupTimer {
  id: string
  session_id: string
  workspace_id: string
  client_id: string | null
  target_node_id: string | null
  scheduled_at: string
  status: string
  created_at: string
}

interface CreateTimerInput {
  session_id: string
  workspace_id: string
  client_id?: string | null
  target_node_id?: string | null
  scheduled_at: string
}

export async function createTimer(input: CreateTimerInput): Promise<FollowupTimer> {
  const { data, error } = await supabase
    .from('followup_timers')
    .insert({
      session_id: input.session_id,
      workspace_id: input.workspace_id,
      client_id: input.client_id ?? null,
      target_node_id: input.target_node_id ?? null,
      scheduled_at: input.scheduled_at,
    })
    .select('*')
    .single()
  if (error) throw new Error(`createTimer failed: ${error.message}`)
  return data as FollowupTimer
}

export async function getPendingTimers(limit: number = 100): Promise<FollowupTimer[]> {
  const { data, error } = await supabase
    .from('followup_timers')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(`getPendingTimers failed: ${error.message}`)
  return (data as FollowupTimer[]) ?? []
}

export async function getTimer(id: string): Promise<FollowupTimer | null> {
  const { data, error } = await supabase
    .from('followup_timers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getTimer(${id}) failed: ${error.message}`)
  return (data as FollowupTimer) ?? null
}

export async function markTimerFired(id: string): Promise<void> {
  const { error } = await supabase
    .from('followup_timers')
    .update({ status: 'fired' })
    .eq('id', id)
  if (error) throw new Error(`markTimerFired(${id}) failed: ${error.message}`)
}

export async function cancelTimersBySession(session_id: string): Promise<void> {
  const { error } = await supabase
    .from('followup_timers')
    .update({ status: 'cancelled' })
    .eq('session_id', session_id)
    .eq('status', 'pending')
  if (error) throw new Error(`cancelTimersBySession(${session_id}) failed: ${error.message}`)
}
