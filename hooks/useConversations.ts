'use client'

// hooks/useConversations.ts — Hook de listagem de conversas com cursor pagination.

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ConversationsListResponse,
  ConversationWithMeta,
} from '@/lib/types/frontend'
import type { SessionStatus } from '@/types/session'
import { useRealtimeSubscription } from './useRealtimeSubscription'
import { useUser } from './useUser'

const PAGE_SIZE = 30

export interface UseConversationsResult {
  conversations: ConversationWithMeta[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  refetch: () => void
}

export function useConversations(
  initialFilter: string = 'all'
): UseConversationsResult {
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Tracker da última requisição para evitar race conditions.
  const reqIdRef = useRef(0)

  const fetchPage = useCallback(
    async (opts: { append: boolean; cursor: string | null }) => {
      const reqId = ++reqIdRef.current
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('filter', initialFilter)
        params.set('limit', String(PAGE_SIZE))
        if (opts.cursor) params.set('cursor', opts.cursor)
        const res = await fetch(`/api/conversations?${params.toString()}`, {
          method: 'GET',
          credentials: 'include',
        })
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return
        }
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`HTTP ${res.status}: ${text}`)
        }
        const data = (await res.json()) as ConversationsListResponse
        // Descarta resposta caso outra requisição mais recente esteja em curso.
        if (reqId !== reqIdRef.current) return
        setConversations((prev) =>
          opts.append ? [...prev, ...data.conversations] : data.conversations
        )
        setCursor(data.next_cursor)
        setHasMore(data.has_more)
      } catch (err) {
        if (reqId !== reqIdRef.current) return
        setError(err instanceof Error ? err.message : 'Erro desconhecido')
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    },
    [initialFilter]
  )

  useEffect(() => {
    void fetchPage({ append: false, cursor: null })
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!hasMore || loading) return
    void fetchPage({ append: true, cursor })
  }, [fetchPage, hasMore, loading, cursor])

  const refetch = useCallback(() => {
    void fetchPage({ append: false, cursor: null })
  }, [fetchPage])

  // ---- Realtime (F18) -------------------------------------------------------
  const { user } = useUser()
  const workspaceId = user?.workspace_id

  // INSERT em messages do workspace: atualiza last_message, unread_count e ordem.
  useRealtimeSubscription<{
    id?: string
    session_id: string
    created_at: string
    content: string
    role: string
    workspace_id: string
    source?: 'ai' | 'human' | null
  }>({
    channel: `conversations:${workspaceId ?? 'none'}:messages`,
    table: 'messages',
    event: 'INSERT',
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    enabled: !!workspaceId,
    onPayload: (payload) => {
      const m = payload.new as {
        id?: string
        session_id: string
        created_at: string
        content: string
        role: string
        source?: 'ai' | 'human' | null
      }
      if (!m || !m.session_id) return
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.session.id === m.session_id)
        if (idx === -1) return prev // conversa nova: ignora; refetch manual cobre.
        const target = prev[idx]
        const updated: ConversationWithMeta = {
          ...target,
          last_message: {
            id: m.id ?? `realtime-${Date.now()}`,
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.content,
            created_at: m.created_at,
            source: m.source ?? null,
          },
          unread_count:
            m.role === 'user'
              ? (target.unread_count ?? 0) + 1
              : target.unread_count,
          session: { ...target.session, updated_at: m.created_at },
        }
        const others = prev.filter((_, i) => i !== idx)
        return [updated, ...others]
      })
    },
  })

  // UPDATE em sessions do workspace: atualiza status / ai_paused.
  useRealtimeSubscription<{
    id: string
    status?: string
    ai_paused?: boolean
    ai_paused_by?: string | null
  }>({
    channel: `conversations:${workspaceId ?? 'none'}:sessions`,
    table: 'sessions',
    event: 'UPDATE',
    filter: workspaceId ? `workspace_id=eq.${workspaceId}` : undefined,
    enabled: !!workspaceId,
    onPayload: (payload) => {
      const s = payload.new as {
        id: string
        status?: string
        ai_paused?: boolean
        ai_paused_by?: string | null
      }
      if (!s || !s.id) return
      setConversations((prev) =>
        prev.map((c) =>
          c.session.id === s.id
            ? {
                ...c,
                ai_paused: s.ai_paused === true,
                ai_paused_by: s.ai_paused_by ?? c.ai_paused_by,
                session: {
                  ...c.session,
                  status: (s.status as SessionStatus) ?? c.session.status,
                },
                status: (s.status as SessionStatus) ?? c.status,
              }
            : c,
        ),
      )
    },
  })

  return { conversations, loading, error, hasMore, loadMore, refetch }
}
