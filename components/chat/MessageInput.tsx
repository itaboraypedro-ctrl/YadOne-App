'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Bot, Loader2, Mic, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AudioRecorder } from '@/components/chat/AudioRecorder'
import { MediaAttachButton } from '@/components/chat/MediaAttachButton'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { useSendMessage } from '@/hooks/useSendMessage'
import type { MessageWithMeta } from '@/lib/types/frontend'

export interface MessageInputProps {
  conversationId: string
  /** Indica se a IA da conversa está pausada (input habilitado se true). Vem da F09. */
  aiPaused: boolean
  /** Callback quando usuário pede para pausar IA (botão no estado bloqueado). */
  onRequestPauseAI?: () => void
  /** Callback após envio bem-sucedido. F09 wira para appendMessage do ChatMessages. */
  onMessageSent?: (m: MessageWithMeta) => void
}

const MAX_HEIGHT_PX = 128 // ~5 linhas (max-h-32)

function extFromMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase()
  if (base === 'audio/webm') return 'webm'
  if (base === 'audio/ogg') return 'ogg'
  if (base === 'audio/mp4') return 'm4a'
  if (base === 'audio/mpeg') return 'mp3'
  if (base === 'audio/wav') return 'wav'
  return 'bin'
}

export function MessageInput({
  conversationId,
  aiPaused,
  onRequestPauseAI,
  onMessageSent,
}: MessageInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const { send, pending, lastError } = useSendMessage()
  const recorder = useAudioRecorder()
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)

  const autosize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [])

  useEffect(() => {
    autosize()
  }, [value, autosize])

  const canSend = !pending && value.trim().length > 0

  const handleSend = useCallback(async () => {
    if (!canSend) return
    const content = value.trim()
    const result = await send({ conversation_id: conversationId, content })
    if (result.ok) {
      onMessageSent?.(result.message)
      setValue('')
      // reset autosize
      requestAnimationFrame(() => autosize())
    }
    // erro: lastError já é exibido pelo hook; mantém o valor digitado
  }, [autosize, canSend, conversationId, onMessageSent, send, value])

  const handleSendAudio = useCallback(
    async (blob: Blob, mimeType: string, _durationMs: number) => {
      setAudioError(null)
      setUploadingAudio(true)
      try {
        const ext = extFromMime(mimeType)
        const filename = `audio-${Date.now()}.${ext}`
        const file = new File([blob], filename, { type: mimeType })
        const form = new FormData()
        form.append('file', file)
        const upRes = await fetch('/api/upload', { method: 'POST', body: form })
        if (!upRes.ok) {
          const detail = await upRes.json().catch(() => ({}))
          const msg =
            (detail as { error?: string }).error ?? `Falha no upload (${upRes.status})`
          setAudioError(msg)
          return
        }
        const up = (await upRes.json()) as {
          url: string
          path: string
          size: number
          mime_type: string
        }
        const result = await send({
          conversation_id: conversationId,
          content: '',
          attachments: [
            { url: up.url, type: up.mime_type, name: filename, size: up.size },
          ],
        })
        if (result.ok) {
          onMessageSent?.(result.message)
          recorder.reset()
        } else {
          setAudioError(result.error)
        }
      } catch (e) {
        setAudioError((e as Error).message ?? 'Falha de rede')
      } finally {
        setUploadingAudio(false)
      }
    },
    [conversationId, onMessageSent, recorder, send],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  if (!aiPaused) {
    return (
      <div className="border-t bg-card p-3 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bot className="size-4 text-primary" />
          <span>IA está respondendo</span>
        </div>
        <Button variant="outline" size="sm" onClick={onRequestPauseAI}>
          Pausar IA para digitar
        </Button>
      </div>
    )
  }

  const recording = recorder.status !== 'idle'

  return (
    <TooltipProvider>
      <div className="border-t bg-card p-2 relative">
        {lastError && (
          <div className="text-xs text-destructive px-2 pb-1">{lastError}</div>
        )}
        {audioError && (
          <div className="text-xs text-destructive px-2 pb-1">{audioError}</div>
        )}
        {recording ? (
          <AudioRecorder
            recorder={recorder}
            onSend={handleSendAudio}
            pending={uploadingAudio}
          />
        ) : (
          <div className="flex items-end gap-1">
            <MediaAttachButton
              conversationId={conversationId}
              disabled={pending || uploadingAudio}
              bodyText={value}
              onMessageSent={onMessageSent}
              onSent={() => setValue('')}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void recorder.start()}
              disabled={recorder.status !== 'idle'}
              aria-label="Gravar áudio"
            >
              <Mic className="size-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Digite uma mensagem..."
              className="resize-none min-h-9 max-h-32 flex-1"
            />
            <Button
              onClick={() => void handleSend()}
              disabled={!canSend}
              size="icon"
              aria-label="Enviar mensagem"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
