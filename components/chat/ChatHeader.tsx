'use client'

// components/chat/ChatHeader.tsx — Cabeçalho da área de chat.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.

import Link from 'next/link'
import { ArrowLeft, Info, MoreVertical, Phone } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ConversationWithMeta } from '@/lib/types/frontend'
import { colorFromString, initialFromName } from '@/lib/format/relative-time'

interface ChatHeaderProps {
  conversation: ConversationWithMeta
  onToggleClientPanel: () => void
}

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

export function ChatHeader({
  conversation,
  onToggleClientPanel,
}: ChatHeaderProps) {
  const { client, channel, last_message } = conversation
  const name = client.name ?? client.phone ?? 'Cliente'
  const initial = initialFromName(name)
  const color = colorFromString(client.id)

  const isOnline =
    last_message?.created_at &&
    Date.now() - new Date(last_message.created_at).getTime() <
      ONLINE_THRESHOLD_MS

  const placeholderAlert = () => {
    if (typeof window !== 'undefined') window.alert('Em breve')
  }

  return (
    <div className="border-b p-3 flex items-center gap-3 bg-card">
      <Link
        href="/conversations"
        className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <Avatar className="h-10 w-10">
        <AvatarFallback
          style={{ backgroundColor: color, color: 'white' }}
          className="text-sm font-medium"
        >
          {initial}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{name}</span>
          {isOnline ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              online
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {client.phone ?? '—'} · {channel.channel_type}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label="Ligar (em breve)"
          title="Em breve"
        >
          <Phone className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Detalhes do cliente"
          onClick={onToggleClientPanel}
        >
          <Info className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Mais ações">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={placeholderAlert}>
              Marcar como não lido
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={placeholderAlert}>
              Arquivar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={placeholderAlert}>
              Ver histórico
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
