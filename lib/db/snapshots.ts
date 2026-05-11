// lib/db/snapshots.ts — Snapshots de fluxos para versionamento (gap #1; T27 implementa logic)
// TODO: substituir tipos inline por import from '@/types/flow' após merge da T02.

import { supabase } from './client'

interface FlowSnapshot {
  id: string
  flow_id: string
  version: number
  snapshot: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export async function createSnapshot(
  flow_id: string,
  snapshot_data: Record<string, unknown>,
  created_by: string | null,
  version: number,
): Promise<FlowSnapshot> {
  const { data, error } = await supabase
    .from('flow_snapshots')
    .insert({
      flow_id,
      version,
      snapshot: snapshot_data,
      created_by,
    })
    .select('*')
    .single()
  if (error) throw new Error(`createSnapshot failed: ${error.message}`)
  return data as FlowSnapshot
}

export async function getSnapshot(flow_id: string, version: number): Promise<FlowSnapshot | null> {
  const { data, error } = await supabase
    .from('flow_snapshots')
    .select('*')
    .eq('flow_id', flow_id)
    .eq('version', version)
    .maybeSingle()
  if (error) throw new Error(`getSnapshot failed: ${error.message}`)
  return (data as FlowSnapshot) ?? null
}

export async function listSnapshots(flow_id: string): Promise<FlowSnapshot[]> {
  const { data, error } = await supabase
    .from('flow_snapshots')
    .select('*')
    .eq('flow_id', flow_id)
    .order('version', { ascending: false })
  if (error) throw new Error(`listSnapshots(${flow_id}) failed: ${error.message}`)
  return (data as FlowSnapshot[]) ?? []
}

export async function getLatestVersion(flow_id: string): Promise<number> {
  const { data, error } = await supabase
    .from('flow_snapshots')
    .select('version')
    .eq('flow_id', flow_id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`getLatestVersion(${flow_id}) failed: ${error.message}`)
  return (data?.version as number) ?? 0
}
