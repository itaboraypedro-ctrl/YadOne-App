'use client'

import { useCallback, useState } from 'react'
import type { MessageWithMeta } from '@/lib/types/frontend'

export interface SendOptions {
  conversation_id: string
  content: string
  attachments?: Array<{ url: string; type: string; name: string; size: number }>
}

export interface SendResult {
  ok: true
  message: MessageWithMeta
}

export interface SendError {
  ok: false
  error: string
  code?: 'ai_must_be_paused' | 'unauthorized' | 'network' | 'unknown'
}

export function useSendMessage() {
  const [pending, setPending] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const send = useCallback(
    async (opts: SendOptions): Promise<SendResult | SendError> => {
      setPending(true)
      setLastError(null)
      try {
        const res = await fetch('/api/conversations/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(opts),
        })
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            window.location.href = '/login'
          }
          return { ok: false, error: 'unauthorized', code: 'unauthorized' }
        }
        if (res.status === 409) {
          await res.json().catch(() => ({}))
          const msg = 'IA precisa estar pausada para enviar mensagens manualmente.'
          setLastError(msg)
          return { ok: false, error: msg, code: 'ai_must_be_paused' }
        }
        if (!res.ok) {
          const msg = `Erro ${res.status}`
          setLastError(msg)
          return { ok: false, error: msg, code: 'unknown' }
        }
        const data = (await res.json()) as { message: MessageWithMeta }
        return { ok: true, message: data.message }
      } catch (e) {
        const msg = (e as Error).message || 'Falha de rede'
        setLastError(msg)
        return { ok: false, error: msg, code: 'network' }
      } finally {
        setPending(false)
      }
    },
    [],
  )

  const clearError = useCallback(() => setLastError(null), [])

  return { send, pending, lastError, clearError }
}
