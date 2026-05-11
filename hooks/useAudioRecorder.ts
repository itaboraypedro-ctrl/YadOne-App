'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopped' | 'error'

const MAX_DURATION_MS = 5 * 60 * 1000 // 5min

function pickMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return undefined
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c
  }
  return undefined
}

export interface UseAudioRecorder {
  status: RecorderStatus
  durationMs: number
  audioBlob: Blob | null
  audioUrl: string | null
  mimeType: string | null
  error: string | null
  start: () => Promise<void>
  stop: () => void
  cancel: () => void
  reset: () => void
}

export function useAudioRecorder(): UseAudioRecorder {
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTsRef = useRef<number>(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(
    () => () => {
      cleanup()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    },
    [cleanup, audioUrl],
  )

  const start = useCallback(async () => {
    if (status === 'recording' || status === 'requesting') return
    setError(null)
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mt = pickMimeType()
      const recorder = mt ? new MediaRecorder(stream, { mimeType: mt }) : new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      setMimeType(mt ?? recorder.mimeType ?? 'audio/webm')

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mt ?? 'audio/webm' })
        setAudioBlob(blob)
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setStatus('stopped')
      }
      recorder.onerror = (ev) => {
        setError(`Recorder error: ${(ev as ErrorEvent).message ?? 'unknown'}`)
        setStatus('error')
      }

      recorder.start()
      startTsRef.current = Date.now()
      setDurationMs(0)
      tickRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTsRef.current)
      }, 100)
      autoStopRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      }, MAX_DURATION_MS)

      setStatus('recording')
    } catch (e) {
      setError((e as Error).message ?? 'Permissão negada')
      setStatus('error')
      cleanup()
    }
  }, [status, cleanup])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = null as unknown as MediaRecorder['onstop']
      mediaRecorderRef.current.stop()
    }
    cleanup()
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setMimeType(null)
    setDurationMs(0)
    setStatus('idle')
    setError(null)
  }, [audioUrl, cleanup])

  const reset = cancel

  return { status, durationMs, audioBlob, audioUrl, mimeType, error, start, stop, cancel, reset }
}
