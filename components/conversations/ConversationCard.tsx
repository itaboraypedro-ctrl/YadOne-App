'use client'

// components/conversations/ConversationCard.tsx — Card individual da lista de conversas.

import { Bot, Check, Pause } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  colorFromString,
  formatRelativeTime,
  initialFromName,
} from '@/lib/format/relative-time'
import type { ConversationWithMeta } from '@/lib/types/frontend'

export interface ConversationCardProps {
  conversation: ConversationWithMeta
  isActive: boolean
  onClick: () => void
}

export function ConversationCard({
  conversation,
  isActive,
  onClick,
}: ConversationCardProps) {
  const { client, channel, last_message, unread_count, ai_status, ai_paused, session } =
    conversation

  const displayName = client.name?.trim() || client.phone || 'Sem nome'

  const avatarColor = colorFromString(client.id)
  const avatarInitial = initialFromName(displayName)

  // Cor da borda esquerda conforme estado.
  const borderClass = isActive
    ? 'border-l-primary'
    : session.status === 'handoff' || ai_paused
      ? 'border-l-warning'
      : 'border-l-transparent'

  const lastMessagePrefix =
    last_message?.role === 'assistant' ? 'Você: ' : ''
  const lastMessageContent = last_message?.content ?? ''

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 p-3 text-left cursor-pointer hover:bg-accent transition-colors duration-150 border-l-2',
        borderClass,
        isActive && 'bg-accent'
      )}
    >
      <Avatar>
        <AvatarImage alt={displayName} />
        <AvatarFallback
          style={{ backgroundColor: avatarColor, color: '#fff' }}
        >
          {avatarInitial}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="flex-1 truncate font-medium text-sm">
            {displayName}
          </span>
          {last_message?.created_at && (
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeTime(last_message.created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 mt-0.5">
          {last_message?.role === 'assistant' && (
            // TODO: usar delivery_status real quando schema expor (sent/delivered/read).
            <span
              className="inline-flex items-center text-muted-foreground shrink-0"
              aria-label="Enviada"
            >
              <Check className="size-3" />
            </span>
          )}
          <p className="text-sm text-muted-foreground line-clamp-1 flex-1 min-w-0">
            {lastMessagePrefix}
            {lastMessageContent || (
              <span className="italic">Sem mensagens</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 mt-1.5">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {channel.channel_type}
          </Badge>
          {client.crm_tags?.[0] && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {client.crm_tags[0]}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {ai_paused ? (
          <Pause
            className="size-4 text-warning"
            aria-label="IA pausada"
          />
        ) : ai_status === 'active' ? (
          <Bot
            className="size-4 text-primary"
            aria-label="IA ativa"
          />
        ) : null}
        {unread_count > 0 && (
          <span
            className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-medium"
            aria-label={`${unread_count} não lidas`}
          >
            {unread_count > 99 ? '99+' : unread_count}
          </span>
        )}
      </div>
    </button>
  )
}
