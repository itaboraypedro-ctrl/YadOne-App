// hooks/useMessages.ts — Carregamento + paginação cursor-based para mensagens.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MessageWithMeta,
  MessagesListResponse,
} from '@/lib/types/frontend'
import { useRealtimeSubscription } from './useRealtimeSubscription'

export interface UseMessagesResult {
  messages: MessageWithMeta[]
  loading: boolean
  error: string | null
  hasOlder: boolean
  loadOlder: () => Promise<void>
  appendMessage: (m: MessageWithMeta) => void
  refetch: () => Promise<void>
}

export function useMessages(conversationId: string): UseMessagesResult {
  // Mensagens em ordem cronológica ascendente (mais antigas primeiro).
  const [messages, setMessages] = useState<MessageWithMeta[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasOlder, setHasOlder] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reqIdRef = useRef(0)

  const loadInitial = useCallback(async () => {
    const myId = ++reqIdRef.current
    setLoading(true)
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?limit=50`,
      )
      if (res.status === 401) {
        if (typeof window !== 'undefined') window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as MessagesListResponse
      if (myId !== reqIdRef.current) return
      // API retorna DESC (mais novas primeiro) — invertemos para exibir ASC.
      const sorted = [...data.messages].reverse()
      setMessages(sorted)
      setCursor(data.next_cursor)
      setHasOlder(data.has_more)
      setError(null)
    } catch (e) {
      if (myId === reqIdRef.current) setError((e as Error).message)
    } finally {
      if (myId === reqIdRef.current) setLoading(false)
    }
  }, [conversationId])

  const loadOlder = useCallback(async () => {
    if (!cursor || !hasOlder) return
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?limit=50&cursor=${encodeURIComponent(cursor)}`,
      )
      if (!res.ok) return
      const data = (await res.json()) as MessagesListResponse
      const olderAsc = [...data.messages].reverse()
      setMessages((prev) => [...olderAsc, ...prev])
      setCursor(data.next_cursor)
      setHasOlder(data.has_more)
    } catch {
      // Silencioso: usuário pode tentar de novo.
    }
  }, [conversationId, cursor, hasOlder])

  const appendMessage = useCallback((m: MessageWithMeta) => {
    setMessages((prev) => {
      // Evita duplicatas (caso F11 já tenha otimisticamente inserido + realtime F18).
      if (prev.some((x) => x.id === m.id)) return prev
      return [...prev, m]
    })
  }, [])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  // Realtime (F18): INSERT em messages filtrado por session_id.
  // appendMessage já dedup por id — então mensagens otimisticamente injetadas
  // (envio manual) não duplicam quando o INSERT real chega.
  useRealtimeSubscription<Record<string, unknown>>({
    channel: `messages:${conversationId}`,
    table: 'messages',
    event: 'INSERT',
    filter: conversationId ? `session_id=eq.${conversationId}` : undefined,
    enabled: !!conversationId,
    onPayload: (payload) => {
      const m = payload.new as unknown as MessageWithMeta
      if (!m || !m.id) return
      appendMessage(m)
    },
  })

  return {
    messages,
    loading,
    error,
    hasOlder,
    loadOlder,
    appendMessage,
    refetch: loadInitial,
  }
}
