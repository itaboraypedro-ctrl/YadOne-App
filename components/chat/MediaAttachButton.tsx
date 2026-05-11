// components/chat/MediaAttachButton.tsx — botão Paperclip self-contained com preview/upload/send.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3 + §7.

'use client'

import { useCallback, useRef, useState } from 'react'
import { Paperclip, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { MediaPreview, type PendingAttachment } from './MediaPreview'
import { useFileUpload } from '@/hooks/useFileUpload'
import { useSendMessage } from '@/hooks/useSendMessage'
import { classifyFile } from '@/lib/format/file-icons'
import type { MessageWithMeta } from '@/lib/types/frontend'
import { cn } from '@/lib/utils'

const ACCEPT = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx'

interface MediaAttachButtonProps {
  conversationId: string
  disabled?: boolean
  onMessageSent?: (m: MessageWithMeta) => void
  /** Texto opcional acompanhando os anexos (puxado do MessageInput pai via state lifting — opcional). */
  bodyText?: string
  /** Callback após envio bem-sucedido para o pai limpar o textarea. */
  onSent?: () => void
}

export function MediaAttachButton({
  conversationId,
  disabled,
  onMessageSent,
  bodyText,
  onSent,
}: MediaAttachButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const {
    upload,
    pending: uploadPending,
    lastError: uploadError,
  } = useFileUpload()
  const { send, pending: sendPending } = useSendMessage()
  const [error, setError] = useState<string | null>(null)

  const onPick = () => inputRef.current?.click()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    const additions: PendingAttachment[] = files.map((f) => {
      const info = classifyFile(f.type, f.name)
      return {
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        file: f,
        previewUrl: info.isImage ? URL.createObjectURL(f) : undefined,
      }
    })
    setPending((prev) => [...prev, ...additions])
    e.target.value = '' // permite re-selecionar mesmo arquivo
  }

  const removePending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  const sendAttachments = useCallback(async () => {
    if (pending.length === 0) return
    setError(null)
    const uploaded: Array<{
      url: string
      type: string
      name: string
      size: number
    }> = []
    for (const att of pending) {
      const res = await upload(att.file)
      if ('error' in res) {
        setError(res.error)
        return
      }
      uploaded.push({
        url: res.url,
        type: res.mime_type,
        name: att.file.name,
        size: res.size,
      })
    }
    const result = await send({
      conversation_id: conversationId,
      content: bodyText ?? '',
      attachments: uploaded,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    pending.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    setPending([])
    onMessageSent?.(result.message)
    onSent?.()
  }, [pending, upload, send, conversationId, bodyText, onMessageSent, onSent])

  return (
    <div className="contents">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={onFileChange}
      />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={onPick}
              aria-label="Anexar arquivo"
            >
              <Paperclip className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Anexar arquivo</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {pending.length > 0 && (
        <div
          className={cn(
            'absolute left-2 right-2 bottom-full mb-2 bg-card border rounded-md shadow-sm z-10',
          )}
        >
          <MediaPreview attachments={pending} onRemove={removePending} />
          {(error ?? uploadError) && (
            <div className="text-xs text-destructive px-3 pb-1">
              {error ?? uploadError}
            </div>
          )}
          <div className="flex justify-end gap-2 p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                pending.forEach(
                  (p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl),
                )
                setPending([])
                setError(null)
              }}
              disabled={uploadPending || sendPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => void sendAttachments()}
              disabled={uploadPending || sendPending}
            >
              {uploadPending || sendPending ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Send className="size-4 mr-2" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MediaAttachButton
