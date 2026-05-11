'use client'

import { Square, X, Send, Loader2, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { UseAudioRecorder } from '@/hooks/useAudioRecorder'
import { cn } from '@/lib/utils'

interface AudioRecorderProps {
  /** Recorder externamente controlado para callsite poder iniciar via botão Mic em outro lugar. */
  recorder: UseAudioRecorder
  onSend: (blob: Blob, mimeType: string, durationMs: number) => Promise<void>
  /** True enquanto upload+send está em andamento. */
  pending?: boolean
  className?: string
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function Waveform() {
  return (
    <div className="flex items-center gap-0.5 h-6">
      {Array.from({ length: 16 }).map((_, i) => (
        <span
          key={i}
          className="w-0.5 bg-primary rounded-full"
          style={{
            height: `${30 + (Math.sin(i) + 1) * 25}%`,
            animation: 'pulse 800ms infinite',
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  )
}

export function AudioRecorder({ recorder, onSend, pending, className }: AudioRecorderProps) {
  const { status, durationMs, audioBlob, audioUrl, mimeType, error, stop, cancel } = recorder

  if (status === 'idle') return null

  if (status === 'requesting') {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground p-2', className)}>
        <Loader2 className="size-4 animate-spin" />
        <span>Solicitando microfone...</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-destructive p-2', className)}>
        <AlertCircle className="size-4" />
        <span className="flex-1 truncate">{error ?? 'Erro ao gravar áudio'}</span>
        <Button variant="ghost" size="icon" onClick={cancel} aria-label="Fechar">
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  if (status === 'recording') {
    return (
      <div className={cn('flex items-center gap-2 p-2 rounded-md bg-card border', className)}>
        <span className="size-2 rounded-full bg-destructive animate-pulse shrink-0" />
        <Waveform />
        <span className="font-mono text-sm tabular-nums">{formatDuration(durationMs)}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={cancel} aria-label="Cancelar gravação">
          <X className="size-4" />
        </Button>
        <Button variant="default" size="icon" onClick={stop} aria-label="Parar gravação">
          <Square className="size-4" />
        </Button>
      </div>
    )
  }

  // stopped — preview com player + send
  return (
    <div className={cn('flex items-center gap-2 p-2 rounded-md bg-card border', className)}>
      {audioUrl && <audio src={audioUrl} controls className="h-8 max-w-[200px] flex-1" />}
      <span className="font-mono text-xs text-muted-foreground tabular-nums">
        {formatDuration(durationMs)}
      </span>
      <Button variant="ghost" size="icon" onClick={cancel} aria-label="Descartar">
        <X className="size-4" />
      </Button>
      <Button
        size="icon"
        disabled={pending || !audioBlob}
        onClick={() => audioBlob && mimeType && void onSend(audioBlob, mimeType, durationMs)}
        aria-label="Enviar áudio"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
      </Button>
    </div>
  )
}
