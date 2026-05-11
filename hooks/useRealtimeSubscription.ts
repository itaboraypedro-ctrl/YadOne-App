'use client'

// hooks/useRealtimeSubscription.ts — Abstração genérica para subscriptions
// Supabase Realtime (postgres_changes). SPEC_FRONTEND_CONVERSATIONS.md §5.
//
// Decisões:
// - Cleanup correto via removeChannel; canal único por chave (channel arg).
// - SSR safety: early return em typeof window === 'undefined'.
// - useRef para callback evita stale closure e re-subscribe a cada render.
// - Cast para 'system' do primeiro arg de .on(): a API do supabase-js declara
//   union literal estrito. Em runtime aceita 'postgres_changes' livremente, mas
//   o type system exige cast — usamos 'as never' para preservar segurança nos
//   demais argumentos.

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface UseRealtimeOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Nome do canal — único por subscrição. */
  channel: string
  /** Tabela a observar. */
  table: string
  /** Eventos a escutar. Default '*'. */
  event?: RealtimeEvent
  /** Filtro estilo Supabase: 'workspace_id=eq.<uuid>'. Pode ser undefined. */
  filter?: string
  /** Callback chamado a cada evento. Recebe payload com new/old. */
  onPayload: (payload: RealtimePostgresChangesPayload<T>) => void
  /** Quando false, não cria subscription. */
  enabled?: boolean
}

export function useRealtimeSubscription<
  T extends Record<string, unknown> = Record<string, unknown>,
>(opts: UseRealtimeOptions<T>): void {
  const { channel, table, event = '*', filter, onPayload, enabled = true } = opts

  // Mantém callback atual sem precisar incluí-lo em deps do effect.
  const cbRef = useRef(onPayload)
  cbRef.current = onPayload

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return

    const supabase = createClient()
    const ch = supabase.channel(channel)

    ch.on(
      // Cast necessário: o tipo .on() do supabase-js usa union literal estrito.
      'postgres_changes' as never,
      { event, schema: 'public', table, ...(filter ? { filter } : {}) } as never,
      (payload: RealtimePostgresChangesPayload<T>) => {
        cbRef.current(payload)
      },
    )
    void ch.subscribe()

    return () => {
      void supabase.removeChannel(ch)
    }
  }, [channel, table, event, filter, enabled])
}
