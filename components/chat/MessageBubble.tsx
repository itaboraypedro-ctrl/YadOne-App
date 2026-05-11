// components/chat/MessageBubble.tsx — Balão de mensagem (user / assistant / system).
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.

'use client'

import { useState } from 'react'
import {
  Bot,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  User,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ImageLightbox } from './ImageLightbox'
import { AudioPlayer } from './AudioPlayer'
import { cn } from '@/lib/utils'
import { colorFromString, initialFromName } from '@/lib/format/relative-time'
import { formatTime, formatFullDateTime } from '@/lib/format/messages'
import type { MessageWithMeta } from '@/lib/types/frontend'

export interface MessageBubbleProps {
  message: MessageWithMeta
  client?: { name?: string | null; id: string } | null
}

export function MessageBubble({ message, client }: MessageBubbleProps) {
  const role = message.role

  // System messages (mensagens internas/sistema): texto centralizado sem balão.
  // Schema atual só tem 'user' | 'assistant', mas defensivo.
  if ((role as string) === 'system') {
    return (
      <div className="my-2 flex justify-center animate-message-in">
        <span className="text-xs text-muted-foreground italic px-3 py-1">
          {message.content}
        </span>
      </div>
    )
  }

  const isAssistant = role === 'assistant'
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex items-end gap-2 px-3 py-1 animate-message-in',
        isAssistant ? 'justify-end' : 'justify-start',
      )}
    >
      {isUser && (
        <ClientAvatar
          name={client?.name ?? null}
          id={client?.id ?? message.client_id ?? message.id}
        />
      )}

      <div
        className={cn(
          'flex flex-col max-w-[75%] sm:max-w-[60%]',
          isAssistant ? 'items-end' : 'items-start',
        )}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'px-3 py-2 rounded-2xl shadow-sm',
                  isAssistant
                    ? 'bg-primary/10 dark:bg-primary/20 rounded-br-sm'
                    : 'bg-card border rounded-bl-sm',
                )}
              >
                <BubbleContent message={message} />
              </div>
            </TooltipTrigger>
            <TooltipContent side={isAssistant ? 'left' : 'right'}>
              {formatFullDateTime(message.created_at)}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <BubbleFooter message={message} isAssistant={isAssistant} />
      </div>

      {isAssistant && <AssistantAvatar />}
    </div>
  )
}

function ClientAvatar({ name, id }: { name: string | null; id: string }) {
  const initial = initialFromName(name ?? '')
  const color = colorFromString(id)
  return (
    <div
      className="size-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
      style={{ backgroundColor: color }}
      aria-label={name ?? 'Cliente'}
    >
      {initial}
    </div>
  )
}

function AssistantAvatar() {
  return (
    <div
      className="size-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"
      aria-label="Assistente"
    >
      <Bot className="size-3.5 text-primary" />
    </div>
  )
}

function BubbleContent({ message }: { message: MessageWithMeta }) {
  const { media_type, media_url, content } = message

  if (media_type === 'audio' && media_url) {
    return <AudioPlayer url={media_url} duration={null} />
  }

  if (media_type === 'image' && media_url) {
    return <ImageBubble src={media_url} caption={content} />
  }

  if (media_type === 'document' && media_url) {
    return (
      <a
        href={media_url}
        download
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-sm hover:underline"
      >
        <FileText className="size-4 shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          {content || 'Arquivo'}
        </span>
        <Download className="size-4 shrink-0 opacity-70" />
      </a>
    )
  }

  // Fallback se media_type não-text mas sem URL: mostra placeholder + content
  if (media_type !== 'text' && !media_url) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ImageIcon className="size-4" />
        <span>{content || `(${media_type})`}</span>
      </div>
    )
  }

  return (
    <p className="whitespace-pre-wrap break-words text-sm">{content}</p>
  )
}

function ImageBubble({
  src,
  caption,
}: {
  src: string
  caption: string | null
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="block"
        onClick={() => setLightboxOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={caption || 'Imagem'}
          className="max-w-[240px] rounded-lg cursor-zoom-in"
        />
      </button>
      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        src={src}
        alt={caption ?? 'Imagem'}
      />
      {caption && (
        <p className="whitespace-pre-wrap break-words text-sm">{caption}</p>
      )}
    </div>
  )
}

function BubbleFooter({
  message,
  isAssistant,
}: {
  message: MessageWithMeta
  isAssistant: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 mt-0.5 px-1 text-[10px] text-muted-foreground',
        isAssistant ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      <span>{formatTime(message.created_at)}</span>
      {isAssistant && (
        <>
          {/* TODO: ticks reais quando delivery_status existir no schema */}
          <Check className="size-3 opacity-70" aria-label="enviado" />
          {message.source === 'ai' && (
            <Bot className="size-3 text-primary" aria-label="Enviado pela IA" />
          )}
          {message.source === 'human' && (
            <User
              className="size-3 text-muted-foreground"
              aria-label="Enviado por humano"
            />
          )}
        </>
      )}
    </div>
  )
}

export default MessageBubble
