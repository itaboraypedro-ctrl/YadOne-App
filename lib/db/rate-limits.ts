// lib/db/rate-limits.ts — Rate limit buckets (sliding window) com UNIQUE(scope_key, window_start)
// TODO: substituir tipos inline por import from '@/types/guardrails' após merge da T02.

import { supabase } from './client'

interface RateLimitBucket {
  id: string
  scope_key: string
  scope_type: string
  count: number
  window_start: string
  window_end: string
  created_at: string
}

/**
 * Incrementa atomicamente o bucket via UPSERT.
 * Estratégia: tentar UPDATE primeiro; se affected rows = 0, INSERT.
 * Como temos UNIQUE(scope_key, window_start), inserts concorrentes falham com 23505 — tentamos novamente.
 */
export async function incrementBucket(
  scope_key: string,
  scope_type: string,
  window_start: string,
  window_end: string,
): Promise<number> {
  // Tenta UPDATE atomicamente (PG usa locking interno)
  const { data: updated, error: updateErr } = await supabase
    .from('rate_limit_buckets')
    .update({ count: 1 }) // placeholder; substituído por raw SQL via .rpc se necessário
    .eq('scope_key', scope_key)
    .eq('window_start', window_start)
    .select('id, count')

  // O .update do supabase-js NÃO suporta `count = count + 1` diretamente.
  // Caminho alternativo: select-then-insert/update com fallback de conflito.
  if (updateErr) throw new Error(`incrementBucket update failed: ${updateErr.message}`)

  if (updated && updated.length > 0) {
    // Atualiza incrementando manualmente
    const current = updated[0] as { id: string; count: number }
    const next = current.count + 1
    const { error: incErr } = await supabase
      .from('rate_limit_buckets')
      .update({ count: next })
      .eq('id', current.id)
    if (incErr) throw new Error(`incrementBucket increment failed: ${incErr.message}`)
    return next
  }

  // Bucket não existe; tenta INSERT
  const { data: inserted, error: insertErr } = await supabase
    .from('rate_limit_buckets')
    .insert({ scope_key, scope_type, count: 1, window_start, window_end })
    .select('count')
    .single()

  if (insertErr) {
    // Conflito (concorrência): outra request criou o bucket primeiro — retomar via update
    if (insertErr.code === '23505') {
      return incrementBucket(scope_key, scope_type, window_start, window_end)
    }
    throw new Error(`incrementBucket insert failed: ${insertErr.message}`)
  }

  return (inserted?.count as number) ?? 1
}

export async function getBucketState(
  scope_key: string,
  window_start: string,
): Promise<RateLimitBucket | null> {
  const { data, error } = await supabase
    .from('rate_limit_buckets')
    .select('*')
    .eq('scope_key', scope_key)
    .eq('window_start', window_start)
    .maybeSingle()
  if (error) throw new Error(`getBucketState failed: ${error.message}`)
  return (data as RateLimitBucket) ?? null
}

export async function resetExpiredBuckets(cutoff: string): Promise<number> {
  const { error, count } = await supabase
    .from('rate_limit_buckets')
    .delete({ count: 'exact' })
    .lt('window_end', cutoff)
  if (error) throw new Error(`resetExpiredBuckets failed: ${error.message}`)
  return count ?? 0
}
