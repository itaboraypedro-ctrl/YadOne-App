// lib/db/idempotency.ts — Chaves de idempotência (gap #16, CRÍTICO)
// TODO: substituir tipos inline por import from '@/types/guardrails' após merge da T02.

import { supabase } from './client'

interface IdempotencyKey {
  key: string
  workspace_id: string | null
  processed_at: string
  result: unknown
  expires_at: string
}

export async function getIdempotencyKey(key: string): Promise<IdempotencyKey | null> {
  const { data, error } = await supabase
    .from('idempotency_keys')
    .select('*')
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(`getIdempotencyKey failed: ${error.message}`)
  return (data as IdempotencyKey) ?? null
}

export async function createIdempotencyKey(
  key: string,
  workspace_id: string | null = null,
  ttl_hours: number = 24,
): Promise<IdempotencyKey> {
  const expires_at = new Date(Date.now() + ttl_hours * 3600 * 1000).toISOString()
  const { data, error } = await supabase
    .from('idempotency_keys')
    .insert({ key, workspace_id, expires_at })
    .select('*')
    .single()
  if (error) throw new Error(`createIdempotencyKey(${key}) failed: ${error.message}`)
  return data as IdempotencyKey
}

export async function updateIdempotencyResult(key: string, result: unknown): Promise<void> {
  const { error } = await supabase
    .from('idempotency_keys')
    .update({ result })
    .eq('key', key)
  if (error) throw new Error(`updateIdempotencyResult(${key}) failed: ${error.message}`)
}

export async function deleteIdempotencyKey(key: string): Promise<void> {
  const { error } = await supabase.from('idempotency_keys').delete().eq('key', key)
  if (error) throw new Error(`deleteIdempotencyKey(${key}) failed: ${error.message}`)
}

export async function cleanupExpired(cutoff: string): Promise<number> {
  const { error, count } = await supabase
    .from('idempotency_keys')
    .delete({ count: 'exact' })
    .lt('expires_at', cutoff)
  if (error) throw new Error(`cleanupExpired failed: ${error.message}`)
  return count ?? 0
}
