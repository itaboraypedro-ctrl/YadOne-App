// components/chat/AudioPlayer.tsx — Player de áudio inline (F16).
// Usado em MessageBubble para mensagens com media_type === 'audio'.

'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AudioPlayerProps {
  url: string
  /** Duração em segundos, se conhecida (do upload). Se ausente, calcula via metadata. */
  duration?: number | null
  className?: string
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function AudioPlayer({ url, duration, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalTime, setTotalTime] = useState<number>(duration ?? 0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onLoaded = () => {
      if (Number.isFinite(a.duration)) setTotalTime(a.duration)
      setLoading(false)
    }
    const onTime = () => setCurrentTime(a.currentTime)
    const onEnd = () => {
      setPlaying(false)
      setCurrentTime(0)
      a.currentTime = 0
    }
    const onErr = () => {
      setError('Falha ao carregar áudio')
      setLoading(false)
    }
    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    a.addEventListener('error', onErr)
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
      a.removeEventListener('error', onErr)
    }
  }, [url])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      void a
        .play()
        .then(() => setPlaying(true))
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : 'Erro ao reproduzir'
          setError(msg)
        })
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !totalTime || !Number.isFinite(totalTime)) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    a.currentTime = ratio * totalTime
    setCurrentTime(a.currentTime)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 min-w-[200px] max-w-[260px]',
        className,
      )}
    >
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        disabled={loading || !!error}
        className="size-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 hover:opacity-90 transition shrink-0"
        aria-label={playing ? 'Pausar' : 'Reproduzir'}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : playing ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4 ml-0.5" />
        )}
      </button>

      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        {/* Waveform decorativa fixa (16 barras) + progress overlay */}
        <div
          onClick={seek}
          className="relative h-6 cursor-pointer flex items-center gap-0.5 select-none"
          role="slider"
          aria-label="Progresso do áudio"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalTime)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
        >
          {Array.from({ length: 16 }).map((_, i) => {
            const heightPct = 30 + ((i * 17) % 70) // valores estáticos pseudo-aleatórios
            const filled =
              i / 16 <= currentTime / Math.max(totalTime, 0.001)
            return (
              <span
                key={i}
                className={cn(
                  'flex-1 rounded-full transition-colors',
                  filled ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
                style={{ height: `${heightPct}%` }}
              />
            )
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalTime)}</span>
        </div>
        {error && (
          <span className="text-[10px] text-destructive">{error}</span>
        )}
      </div>
    </div>
  )
}

export default AudioPlayer
