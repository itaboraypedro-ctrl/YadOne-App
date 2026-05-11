'use client'

// hooks/useClientHistory.ts — F17. Busca histórico de sessões do cliente.

import { useEffect, useState } from 'react'
import type {
  ClientSessionsResponse,
  ClientSessionSummary,
} from '@/app/api/clients/[id]/sessions/route'

export function useClientHistory(clientId: string | undefined) {
  const [sessions, setSessions] = useState<ClientSessionSummary[]>([])
  const [total, setTotal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) {
      setSessions([])
      setTotal(0)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/clients/${clientId}/sessions`)
      .then(async (r) => {
        if (r.status === 401) {
          if (typeof window !== 'undefined') window.location.href = '/login'
          return null
        }
        if (!r.ok) throw new Error(`sessions_fetch_failed_${r.status}`)
        return (await r.json()) as ClientSessionsResponse
      })
      .then((d) => {
        if (cancelled || !d) return
        setSessions(d.sessions)
        setTotal(d.total)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'unknown_error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clientId])

  return { sessions, total, loading, error }
}
