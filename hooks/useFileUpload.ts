// hooks/useFileUpload.ts — hook para POST /api/upload (F05).
// SPEC_FRONTEND_CONVERSATIONS.md §3.3 + §7.

'use client'

import { useCallback, useState } from 'react'

export interface UploadResult {
  url: string
  path: string
  size: number
  mime_type: string
}

export interface UseFileUpload {
  upload: (file: File) => Promise<UploadResult | { error: string }>
  pending: boolean
  lastError: string | null
}

const MAX_BYTES = 10 * 1024 * 1024 // 10MB

const ALLOWED = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export function useFileUpload(): UseFileUpload {
  const [pending, setPending] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const upload = useCallback(async (file: File) => {
    setLastError(null)
    if (file.size > MAX_BYTES) {
      const msg = 'Arquivo excede 10 MB.'
      setLastError(msg)
      return { error: msg }
    }
    if (!ALLOWED.includes(file.type) && !file.type.startsWith('image/')) {
      const msg = `Tipo não permitido: ${file.type || 'desconhecido'}`
      setLastError(msg)
      return { error: msg }
    }
    setPending(true)
    try {
      const fd = new FormData()
      fd.append('file', file, file.name)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return { error: 'unauthorized' }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg =
          (data as { error?: string }).error ?? `Upload falhou: ${res.status}`
        setLastError(msg)
        return { error: msg }
      }
      return (await res.json()) as UploadResult
    } catch (e) {
      const msg = (e as Error).message ?? 'Falha de rede'
      setLastError(msg)
      return { error: msg }
    } finally {
      setPending(false)
    }
  }, [])

  return { upload, pending, lastError }
}
