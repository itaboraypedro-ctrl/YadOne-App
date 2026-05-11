'use client'

// components/chat/AIStatusBanner.tsx — Banner de status da IA por conversa.
// SPEC_FRONTEND_CONVERSATIONS.md §3.3.

import { Bot, Loader2, Pause, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ConversationWithMeta } from '@/lib/types/frontend'

interface AIStatusBannerProps {
  conversation: ConversationWithMeta
  onToggleAIPause: (paused: boolean) => Promise<void>
  pending?: boolean
  onDismiss?: () => void
  dismissed?: boolean
}

export function AIStatusBanner({
  conversation,
  onToggleAIPause,
  pending = false,
  onDismiss,
  dismissed = false,
}: AIStatusBannerProps) {
  if (dismissed) return null

  const paused = conversation.ai_paused

  // Estados que não são por-conversa (paused_global, paused_channel) são tratados
  // por outros banners; aqui só mostramos quando faz sentido contextualmente.
  // Mostramos sempre para active (lembrete) ou paused_conversation (aviso).
  if (
    conversation.ai_status !== 'active' &&
    conversation.ai_status !== 'paused_conversation'
  ) {
    return null
  }

  return (
    <div
      className={cn(
        'border-b p-2.5 flex items-center justify-between gap-2 text-sm animate-slide-down',
        paused
          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-900'
          : 'bg-primary/10 text-foreground border-primary/20',
      )}
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0">
        {paused ? (
          <Pause className="h-4 w-4 shrink-0" />
        ) : (
          <Bot className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span className="truncate">
          {paused
            ? 'IA pausada — você está no controle'
            : 'IA respondendo automaticamente'}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant={paused ? 'default' : 'outline'}
          size="sm"
          disabled={pending}
          onClick={() => {
            void onToggleAIPause(!paused)
          }}
        >
          {pending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          {paused ? 'Retomar IA' : 'Pausar IA'}
        </Button>
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Dispensar"
            onClick={onDismiss}
            disabled={pending}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}
