'use client'

// hooks/useClientMemory.ts — F17. Busca memória semântica + episódica do cliente.

import { useEffect, useState } from 'react'
import type { ClientMemoryResponse } from '@/app/api/clients/[id]/memory/route'

export function useClientMemory(clientId: string | undefined) {
  const [data, setData] = useState<ClientMemoryResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) {
      setData(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/clients/${clientId}/memory`)
      .then(async (r) => {
        if (r.status === 401) {
          if (typeof window !== 'undefined') window.location.href = '/login'
          return null
        }
        if (!r.ok) {
          throw new Error(`memory_fetch_failed_${r.status}`)
        }
        return (await r.json()) as ClientMemoryResponse
      })
      .then((d) => {
        if (cancelled) return
        setData(d)
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

  return { data, loading, error }
}
