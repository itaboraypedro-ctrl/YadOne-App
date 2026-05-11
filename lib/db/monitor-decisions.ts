// lib/db/monitor-decisions.ts — Persistência das decisões do Monitor (gap #2)
// TODO: substituir tipos inline por import from '@/types/monitor' após merge da T02.

import { supabase } from './client'

interface MonitorDecision {
  id: string
  session_id: string
  message_id: string | null
  flag: string
  confidence: number | null
  details: Record<string, unknown>
  action_taken: string
  created_at: string
}

interface RecordInput {
  session_id: string
  message_id?: string | null
  flag: string
  confidence?: number | null
  details?: Record<string, unknown>
  action_taken: string
}

export async function recordMonitorDecision(input: RecordInput): Promise<MonitorDecision> {
  const { data, error } = await supabase
    .from('monitor_decisions')
    .insert({
      session_id: input.session_id,
      message_id: input.message_id ?? null,
      flag: input.flag,
      confidence: input.confidence ?? null,
      details: input.details ?? {},
      action_taken: input.action_taken,
    })
    .select('*')
    .single()
  if (error) throw new Error(`recordMonitorDecision failed: ${error.message}`)
  return data as MonitorDecision
}

export async function getDecisionsBySession(
  session_id: string,
  limit: number = 50,
): Promise<MonitorDecision[]> {
  const { data, error } = await supabase
    .from('monitor_decisions')
    .select('*')
    .eq('session_id', session_id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`getDecisionsBySession failed: ${error.message}`)
  return (data as MonitorDecision[]) ?? []
}
