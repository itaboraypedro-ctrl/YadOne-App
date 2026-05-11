'use client'

import { useCallback, useEffect, useState } from 'react'
import type { CurrentUser } from '@/lib/types/frontend'

export interface UseUserResult {
  user: CurrentUser | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useUser(): UseUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? `HTTP ${res.status}`)
        }
        return (await res.json()) as CurrentUser
      })
      .then((data) => {
        if (cancelled) return
        setUser(data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setUser(null)
        setError(err instanceof Error ? err.message : 'unknown_error')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tick])

  return { user, loading, error, refetch }
}

export default useUser
