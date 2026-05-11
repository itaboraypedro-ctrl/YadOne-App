'use client'

// hooks/useConversationDetail.ts — Hook para detalhe de uma conversa.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3 / §9.2.

import { useCallback, useEffect, useState } from 'react'
import type { ConversationWithMeta } from '@/lib/types/frontend'
import type { SessionStatus } from '@/types/session'
import { useRealtimeSubscription } from './useRealtimeSubscription'

export interface UseConversationDetailResult {
  conversation: ConversationWithMeta | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  setConversation: React.Dispatch<
    React.SetStateAction<ConversationWithMeta | null>
  >
}

export function useConversationDetail(
  conversationId: string,
): UseConversationDetailResult {
  const [conversation, setConversation] = useState<ConversationWithMeta | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
      })
      if (res.status === 401) {
        if (typeof window !== 'undefined') window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text}`)
      }
      // API retorna o ConversationWithMeta diretamente (não envelopado).
      const data = (await res.json()) as ConversationWithMeta
      setConversation(data)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // Realtime (F18): UPDATE da própria session (ai_paused, status, etc).
  useRealtimeSubscription<{
    id: string
    ai_paused?: boolean
    ai_paused_by?: string | null
    status?: string
  }>({
    channel: `conversation-detail:${conversationId}`,
    table: 'sessions',
    event: 'UPDATE',
    filter: conversationId ? `id=eq.${conversationId}` : undefined,
    enabled: !!conversationId,
    onPayload: (payload) => {
      const s = payload.new as {
        id: string
        ai_paused?: boolean
        ai_paused_by?: string | null
        status?: string
      }
      if (!s || !s.id) return
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              ai_paused: s.ai_paused === true,
              ai_paused_by: s.ai_paused_by ?? prev.ai_paused_by,
              session: {
                ...prev.session,
                status: (s.status as SessionStatus) ?? prev.session.status,
              },
              status: (s.status as SessionStatus) ?? prev.status,
            }
          : prev,
      )
    },
  })

  return { conversation, loading, error, refetch, setConversation }
}
